import {
  REPLAY_LABEL,
  MendError,
  canTransition,
  computeSplit,
  isDisputable,
  isNearAccount,
  PRE_AWARD_STATES,
  type WorkOrderState,
} from '@mend/protocol';
import type {
  BidRevealRecord,
  ChainCommandRecord,
  DaoApprovalRecord,
  EscrowRecord,
  EvidencePackageRecord,
  InspectionRecord,
  PaymentRecord,
  Repository,
  WarrantyCaseRecord,
  WorkOrderRecord,
} from '@mend/db';
import type { AppConfig } from '../config.js';
import { actionRoles, requireRole, type AuthContext, type WorkOrderAction } from '../auth.js';
import { ChainCommandService, HUB_METHOD_BY_ACTION, type Clock, systemClock } from './chain.js';

export interface ActionDependencies {
  repo: Repository;
  config: AppConfig;
  commands: ChainCommandService;
  clock?: Clock;
}

export interface ActionResult {
  workOrder: WorkOrderRecord;
  command: ChainCommandRecord;
  applied: boolean;
  payments: PaymentRecord[];
}

function micro(value: unknown, field: string): bigint {
  if (typeof value === 'bigint') return value;
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+$/.test(text)) {
    throw new MendError('VALIDATION_ERROR', `${field} must be a non-negative integer string in micro-units`);
  }
  return BigInt(text);
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new MendError('VALIDATION_ERROR', 'Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

function asIso(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new MendError('VALIDATION_ERROR', `${field} must be an ISO datetime`);
  }
  return new Date(value).toISOString();
}

function transition(
  workOrder: WorkOrderRecord,
  to: WorkOrderState,
  context: { pausedFrom?: WorkOrderState; humanResolution?: boolean } = {},
): void {
  const check = canTransition(workOrder.status, to, context);
  if (!check.ok) {
    throw new MendError('INVALID_TRANSITION', check.reason ?? `cannot move ${workOrder.status} to ${to}`, {
      from: workOrder.status,
      to,
    });
  }
}

function requireState(workOrder: WorkOrderRecord, allowed: readonly WorkOrderState[], action: string): void {
  if (!allowed.includes(workOrder.status)) {
    throw new MendError('INVALID_STATE', `${action} is not allowed while ${workOrder.status}`, {
      action,
      status: workOrder.status,
      allowed,
    });
  }
}

async function loadWorkOrder(repo: Repository, id: string): Promise<WorkOrderRecord> {
  const workOrder = await repo.getWorkOrder(id);
  if (!workOrder) throw new MendError('NOT_FOUND', 'Work order not found', { workOrderId: id });
  return workOrder;
}

async function loadApproval(repo: Repository, workOrder: WorkOrderRecord): Promise<DaoApprovalRecord> {
  const approval = await repo.getDaoApproval(workOrder.daoApprovalId);
  if (!approval) throw new MendError('DAO_APPROVAL_MISMATCH', 'DAO approval referenced by the work order is missing');
  if (approval.state !== 'APPROVED') {
    throw new MendError('POLICY_NOT_APPROVED', 'DAO approval is not approved', { state: approval.state });
  }
  return approval;
}

export function isRostered(approval: DaoApprovalRecord, account: string, roster: 'contractor' | 'inspector'): boolean {
  return (roster === 'contractor' ? approval.contractorRoster : approval.inspectorRoster).includes(account);
}

async function audit(
  repo: Repository,
  clock: Clock,
  name: string,
  actor: string,
  meta: { workOrderId?: string; assetId?: string },
  data: Record<string, unknown>,
): Promise<void> {
  await repo.appendAudit({
    id: `A-${String(await repo.nextSequence('audit')).padStart(5, '0')}`,
    name,
    actor,
    at: clock.now().toISOString(),
    ...meta,
    data,
  });
}

function replayLabel(command: ChainCommandRecord): string | undefined {
  return command.realTransaction ? undefined : REPLAY_LABEL;
}

async function payment(
  repo: Repository,
  config: AppConfig,
  workOrder: WorkOrderRecord,
  input: {
    kind: PaymentRecord['kind'];
    amountMicro: string;
    recipient: string;
    txHash?: string;
    label?: string;
    now: string;
  },
): Promise<PaymentRecord> {
  const seq = await repo.nextSequence('payment');
  return repo.createPayment({
    id: `PMT-${String(seq).padStart(4, '0')}`,
    workOrderId: workOrder.id,
    kind: input.kind,
    amountMicro: input.amountMicro,
    recipient: input.recipient,
    status: 'SUCCESS',
    ...(input.txHash ? { txHash: input.txHash } : {}),
    releasedAt: input.now,
    ...(input.label ? { label: input.label } : {}),
    createdAt: input.now,
    isDemo: workOrder.isDemo,
  });
}

/**
 * Applies one explicit hub action. A state transition is only applied after the
 * chain adapter returned SUCCESS with a transaction hash. Replay mode is
 * labelled REPLAY and never claims to be a live transaction.
 */
export async function performWorkOrderAction(
  deps: ActionDependencies,
  workOrderId: string,
  action: WorkOrderAction,
  rawBody: unknown,
  auth: AuthContext,
): Promise<ActionResult> {
  const body = asRecord(rawBody ?? {});
  const clock = deps.clock ?? systemClock;
  const role = requireRole(auth, actionRoles(action), `work_order:${action}`);
  const method = HUB_METHOD_BY_ACTION[action] ?? action;

  return deps.repo.transaction(async (tx) => {
    const workOrder = await loadWorkOrder(tx, workOrderId);
    const approval = await loadApproval(tx, workOrder);
    const prepared = await prepare(tx, deps, workOrder, approval, action, body, role);
    const command = await deps.commands.submit(tx, {
      workOrderId,
      action,
      method,
      args: prepared.args,
      isDemo: workOrder.isDemo,
    });
    if (command.state !== 'SUCCESS') {
      return { workOrder, command, applied: false, payments: [] };
    }
    const applied = await apply(tx, deps, clock, workOrder, approval, action, body, role, command);
    return { ...applied, command };
  });
}

interface Prepared {
  args: Record<string, unknown>;
}

async function prepare(
  repo: Repository,
  deps: ActionDependencies,
  workOrder: WorkOrderRecord,
  approval: DaoApprovalRecord,
  action: WorkOrderAction,
  body: Record<string, unknown>,
  auth: AuthContext,
): Promise<Prepared> {
  const now = (deps.clock ?? systemClock).now();
  switch (action) {
    case 'dao_authorize': {
      requireState(workOrder, ['DRAFT'], action);
      if (approval.policyHash !== workOrder.policyHash) {
        throw new MendError('DAO_APPROVAL_MISMATCH', 'DAO policy hash does not match the work order policy hash');
      }
      if (approval.budgetMicro !== workOrder.budgetMicro) {
        throw new MendError('DAO_APPROVAL_MISMATCH', 'DAO approved budget does not match the work order budget', {
          approvedBudgetMicro: approval.budgetMicro,
          workOrderBudgetMicro: workOrder.budgetMicro,
        });
      }
      if (body.scopeHash !== undefined && body.scopeHash !== workOrder.scopeHash) {
        throw new MendError('DAO_APPROVAL_MISMATCH', 'DAO approval scope hash does not match the work order scope');
      }
      return { args: { workOrderId: workOrder.id, daoApprovalId: workOrder.daoApprovalId, policyHash: workOrder.policyHash } };
    }
    case 'fund': {
      requireState(workOrder, ['POLICY_APPROVED'], action);
      const amount = micro(body.amountMicro ?? workOrder.budgetMicro, 'amountMicro');
      const token = typeof body.token === 'string' ? body.token : deps.config.chain.tokenAccount;
      if (token !== workOrder.fundingToken) {
        throw new MendError('FUNDING_WRONG_TOKEN', 'Funding token does not match the work order token', {
          expected: workOrder.fundingToken,
          received: token,
        });
      }
      const budget = BigInt(workOrder.budgetMicro);
      if (amount > budget) throw new MendError('FUNDING_OVERFUND', 'Funding exceeds the exact remaining budget');
      if (amount < budget) throw new MendError('FUNDING_WRONG_AMOUNT', 'Funding is below the exact budget');
      const sponsor = typeof body.sponsorId === 'string' ? body.sponsorId : auth.account;
      if (!isNearAccount(sponsor)) throw new MendError('VALIDATION_ERROR', 'Invalid sponsor account');
      return { args: { workOrderId: workOrder.id, amountMicro: amount.toString(), token, sponsorId: sponsor } };
    }
    case 'open_bidding': {
      requireState(workOrder, ['FUNDED'], action);
      const commitDeadline = body.commitDeadline
        ? asIso(body.commitDeadline, 'commitDeadline')
        : (workOrder.commitDeadline ?? new Date(now.getTime() + deps.config.bidding.commitWindowSeconds * 1000).toISOString());
      const revealDeadline = body.revealDeadline
        ? asIso(body.revealDeadline, 'revealDeadline')
        : (workOrder.revealDeadline ?? new Date(Date.parse(commitDeadline) + deps.config.bidding.revealWindowSeconds * 1000).toISOString());
      if (Date.parse(revealDeadline) <= Date.parse(commitDeadline)) {
        throw new MendError('VALIDATION_ERROR', 'revealDeadline must be after commitDeadline');
      }
      return { args: { workOrderId: workOrder.id, commitDeadline, revealDeadline } };
    }
    case 'close_bidding': {
      requireState(workOrder, ['BIDDING_OPEN'], action);
      if (workOrder.revealDeadline && now.getTime() < Date.parse(workOrder.revealDeadline)) {
        throw new MendError('INVALID_STATE', 'The reveal window is still open', {
          revealDeadline: workOrder.revealDeadline,
        });
      }
      return { args: { workOrderId: workOrder.id } };
    }
    case 'award': {
      requireState(workOrder, ['SCORED'], action);
      const score = await repo.getLatestScoreExecution(workOrder.id);
      if (!score) throw new MendError('SCORE_STALE', 'No score exists for this work order');
      const winner = [...score.ranking].sort((a, b) => a.rank - b.rank)[0];
      if (!winner) throw new MendError('SCORE_INVALID', 'Score contains no ranking');
      if (body.bidId !== undefined && body.bidId !== winner.bidId) {
        throw new MendError('INELIGIBLE_WINNER', 'Only the deterministic rank-1 bid can be awarded', {
          requested: body.bidId,
          rank1: winner.bidId,
        });
      }
      const reveal = await repo.getBidReveal(workOrder.id, winner.bidId);
      if (!reveal) throw new MendError('INELIGIBLE_WINNER', 'Winning bid has no reveal');
      if (!isRostered(approval, reveal.contractorId, 'contractor')) {
        throw new MendError('NOT_ROSTERED', 'Winning contractor is not on the DAO roster');
      }
      if (BigInt(reveal.priceMicro) > BigInt(workOrder.budgetMicro)) {
        throw new MendError('ESCROW_MISMATCH', 'Winning bid exceeds the approved budget');
      }
      return { args: { workOrderId: workOrder.id, bidId: winner.bidId, priceMicro: reveal.priceMicro } };
    }
    case 'start_work': {
      requireState(workOrder, ['AWARDED', 'WARRANTY_REOPENED'], action);
      if (workOrder.contractorId !== auth.account) {
        throw new MendError('FORBIDDEN_ROLE', 'Only the awarded contractor can start work', {
          contractorId: workOrder.contractorId,
          account: auth.account,
        });
      }
      return { args: { workOrderId: workOrder.id, contractorId: auth.account } };
    }
    case 'submit_completion': {
      requireState(workOrder, ['IN_PROGRESS'], action);
      if (workOrder.contractorId !== auth.account) {
        throw new MendError('FORBIDDEN_ROLE', 'Only the awarded contractor can submit completion');
      }
      const evidenceId = body.evidenceId;
      if (typeof evidenceId !== 'string') throw new MendError('VALIDATION_ERROR', 'evidenceId is required');
      const evidence = await repo.getEvidencePackage(evidenceId);
      if (!evidence || evidence.workOrderId !== workOrder.id) {
        throw new MendError('NOT_FOUND', 'Evidence package not found for this work order', { evidenceId });
      }
      if (body.evidenceHash !== undefined && !evidence.evidenceHashes.includes(String(body.evidenceHash))) {
        throw new MendError('EVIDENCE_REPLAY', 'Evidence hash is not part of the package');
      }
      return {
        args: {
          workOrderId: workOrder.id,
          evidenceId,
          evidenceHash: evidence.evidenceHashes[0],
        },
      };
    }
    case 'accept_completion': {
      requireState(workOrder, ['COMPLETION_SUBMITTED'], action);
      if (workOrder.contractorId === auth.account) {
        throw new MendError('CONTRACTOR_SELF_INSPECTION', 'Contractor cannot inspect their own work');
      }
      if (!isRostered(approval, auth.account, 'inspector')) {
        throw new MendError('NOT_ROSTERED', 'Inspector is not on the DAO-approved roster');
      }
      const inspection = await loadInspection(repo, body.inspectionId, workOrder.id, 'COMPLETION');
      if (inspection.inspectorId !== auth.account) {
        throw new MendError('FORBIDDEN_ROLE', 'Inspection was signed by a different inspector');
      }
      if (inspection.decision !== 'APPROVED') {
        throw new MendError('INVALID_STATE', 'Completion inspection was not approved');
      }
      return { args: { workOrderId: workOrder.id, inspectionId: inspection.id, notesHash: inspection.notesHash } };
    }
    case 'inspect_durability': {
      requireState(workOrder, ['DURABILITY_PENDING'], action);
      if (workOrder.contractorId === auth.account) {
        throw new MendError('CONTRACTOR_SELF_INSPECTION', 'Contractor cannot inspect their own work');
      }
      if (!isRostered(approval, auth.account, 'inspector')) {
        throw new MendError('NOT_ROSTERED', 'Inspector is not on the DAO-approved roster');
      }
      if (typeof body.passed !== 'boolean') throw new MendError('VALIDATION_ERROR', 'passed must be a boolean');
      const inspection = await loadInspection(repo, body.inspectionId, workOrder.id, 'DURABILITY');
      if (inspection.inspectorId !== auth.account) {
        throw new MendError('FORBIDDEN_ROLE', 'Inspection was signed by a different inspector');
      }
      if ((inspection.decision === 'APPROVED') !== body.passed) {
        throw new MendError('INVALID_STATE', 'Durability decision does not match the signed inspection');
      }
      return { args: { workOrderId: workOrder.id, inspectionId: inspection.id, passed: body.passed } };
    }
    case 'open_dispute': {
      if (!isDisputable(workOrder.status)) {
        throw new MendError('INVALID_STATE', `Disputes cannot be opened while ${workOrder.status}`);
      }
      if (auth.role === 'CONTRACTOR' && workOrder.contractorId !== auth.account) {
        throw new MendError('FORBIDDEN_ROLE', 'Only the awarded contractor can open a dispute');
      }
      return { args: { workOrderId: workOrder.id, reasonHash: body.reasonHash ?? null } };
    }
    case 'resolve_dispute': {
      requireState(workOrder, ['DISPUTED'], action);
      if (typeof body.targetState !== 'string') throw new MendError('VALIDATION_ERROR', 'targetState is required');
      const check = canTransition(workOrder.status, body.targetState as WorkOrderState, { humanResolution: true });
      if (!check.ok) throw new MendError('INVALID_TRANSITION', check.reason ?? 'invalid dispute resolution target');
      return { args: { workOrderId: workOrder.id, targetState: body.targetState } };
    }
    case 'cancel_work_order': {
      if (!(PRE_AWARD_STATES as readonly string[]).includes(workOrder.status)) {
        throw new MendError('INVALID_STATE', 'Only pre-award work orders can be cancelled');
      }
      return { args: { workOrderId: workOrder.id } };
    }
    case 'refund': {
      requireState(workOrder, ['CANCELLED', 'FUNDED', 'SCORED'], action);
      const escrow = await repo.getEscrow(workOrder.id);
      if (!escrow) throw new MendError('ESCROW_MISMATCH', 'No escrow account exists for this work order');
      const remaining = remainingEscrow(escrow);
      if (remaining <= 0n) throw new MendError('DOUBLE_PAYMENT', 'No refundable escrow remains');
      if (!workOrder.sponsorId) throw new MendError('ESCROW_MISMATCH', 'Sponsor is unknown; cannot refund honestly');
      return { args: { workOrderId: workOrder.id, amountMicro: remaining.toString(), recipient: workOrder.sponsorId } };
    }
    case 'pause': {
      if (workOrder.status === 'PAUSED') throw new MendError('INVALID_STATE', 'Work order is already paused');
      const check = canTransition(workOrder.status, 'PAUSED');
      if (!check.ok) throw new MendError('INVALID_TRANSITION', check.reason ?? 'contract cannot be paused');
      return { args: { workOrderId: workOrder.id, reasonHash: body.reasonHash ?? null } };
    }
    case 'unpause': {
      requireState(workOrder, ['PAUSED'], action);
      if (!workOrder.pausedFrom) throw new MendError('INVALID_STATE', 'Paused-from state is missing');
      return { args: { workOrderId: workOrder.id } };
    }
    default: {
      const exhaustive: never = action;
      throw new MendError('VALIDATION_ERROR', `Unknown action ${String(exhaustive)}`);
    }
  }
}

async function loadInspection(
  repo: Repository,
  inspectionId: unknown,
  workOrderId: string,
  kind: InspectionRecord['kind'],
): Promise<InspectionRecord> {
  if (typeof inspectionId !== 'string') throw new MendError('VALIDATION_ERROR', 'inspectionId is required');
  const inspection = await repo.getInspection(inspectionId);
  if (!inspection || inspection.workOrderId !== workOrderId) {
    throw new MendError('NOT_FOUND', 'Inspection not found for this work order', { inspectionId });
  }
  if (inspection.kind !== kind) {
    throw new MendError('INVALID_STATE', `Expected a ${kind} inspection`, { actual: inspection.kind });
  }
  return inspection;
}

export function remainingEscrow(escrow: EscrowRecord): bigint {
  return BigInt(escrow.fundedMicro)
    - BigInt(escrow.refundedMicro)
    - BigInt(escrow.completionPaidMicro)
    - BigInt(escrow.holdbackHeldMicro)
    - BigInt(escrow.holdbackReleasedMicro);
}

async function apply(
  repo: Repository,
  deps: ActionDependencies,
  clock: Clock,
  workOrder: WorkOrderRecord,
  approval: DaoApprovalRecord,
  action: WorkOrderAction,
  body: Record<string, unknown>,
  auth: AuthContext,
  command: ChainCommandRecord,
): Promise<{ workOrder: WorkOrderRecord; applied: boolean; payments: PaymentRecord[] }> {
  const now = clock.now().toISOString();
  const payments: PaymentRecord[] = [];
  let updated = workOrder;

  switch (action) {
    case 'dao_authorize': {
      transition(updated, 'POLICY_APPROVED');
      updated = (await repo.updateWorkOrder(updated.id, { status: 'POLICY_APPROVED', updatedAt: now }))!;
      await audit(repo, clock, 'policy_approved', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        daoApprovalId: approval.id,
        policyHash: approval.policyHash,
      });
      break;
    }
    case 'fund': {
      transition(updated, 'FUNDED');
      const amount = micro(body.amountMicro ?? updated.budgetMicro, 'amountMicro');
      const sponsor = typeof body.sponsorId === 'string' ? body.sponsorId : auth.account;
      await repo.upsertEscrow({
        workOrderId: updated.id,
        token: updated.fundingToken,
        fundedMicro: amount.toString(),
        refundedMicro: '0',
        completionPaidMicro: '0',
        holdbackHeldMicro: '0',
        holdbackReleasedMicro: '0',
        isDemo: updated.isDemo,
      });
      updated = (await repo.updateWorkOrder(updated.id, {
        status: 'FUNDED',
        sponsorId: sponsor,
        fundingTxHash: command.txHash,
        updatedAt: now,
      }))!;
      await audit(repo, clock, 'work_order_funded', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        amountMicro: amount.toString(),
        sponsorId: sponsor,
        realTransaction: command.realTransaction,
        txHash: command.txHash,
      });
      break;
    }
    case 'open_bidding': {
      transition(updated, 'BIDDING_OPEN');
      updated = (await repo.updateWorkOrder(updated.id, {
        status: 'BIDDING_OPEN',
        commitDeadline: String(command.args.commitDeadline),
        revealDeadline: String(command.args.revealDeadline),
        updatedAt: now,
      }))!;
      await audit(repo, clock, 'bidding_opened', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        commitDeadline: updated.commitDeadline,
        revealDeadline: updated.revealDeadline,
      });
      break;
    }
    case 'close_bidding': {
      transition(updated, 'BIDDING_REVEAL');
      updated = (await repo.updateWorkOrder(updated.id, { status: 'BIDDING_REVEAL', updatedAt: now }))!;
      await audit(repo, clock, 'bidding_closed', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {});
      break;
    }
    case 'award': {
      transition(updated, 'AWARDED');
      const score = await repo.getLatestScoreExecution(updated.id);
      const winner = score ? [...score.ranking].sort((a, b) => a.rank - b.rank)[0] : undefined;
      const reveal = winner ? await repo.getBidReveal(updated.id, winner.bidId) : null;
      if (!winner || !reveal) throw new MendError('SCORE_STALE', 'Winning bid is no longer available');
      const budget = BigInt(updated.budgetMicro);
      const price = BigInt(reveal.priceMicro);
      const refund = budget - price;
      const escrow = await repo.getEscrow(updated.id);
      if (!escrow) throw new MendError('ESCROW_MISMATCH', 'Funding escrow is missing');
      await repo.upsertEscrow({
        ...escrow,
        refundedMicro: (BigInt(escrow.refundedMicro) + refund).toString(),
      });
      if (refund > 0n) {
        if (!updated.sponsorId) throw new MendError('ESCROW_MISMATCH', 'Sponsor is unknown; cannot refund excess budget');
        const refundPayment = await payment(repo, deps.config, updated, {
          kind: 'REFUND',
          amountMicro: refund.toString(),
          recipient: updated.sponsorId,
          txHash: command.txHash,
          label: replayLabel(command),
          now,
        });
        payments.push(refundPayment);
        await audit(repo, clock, 'payment_released', 'chain-command-service', {
          workOrderId: updated.id,
          assetId: updated.assetId,
        }, {
          paymentId: refundPayment.id,
          kind: 'REFUND',
          amountMicro: refund.toString(),
          realTransaction: command.realTransaction,
        });
      }
      updated = (await repo.updateWorkOrder(updated.id, {
        status: 'AWARDED',
        awardedBidId: winner.bidId,
        contractorId: reveal.contractorId,
        updatedAt: now,
      }))!;
      await audit(repo, clock, 'work_order_awarded', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        bidId: winner.bidId,
        contractorId: reveal.contractorId,
        priceMicro: reveal.priceMicro,
        refundMicro: refund.toString(),
      });
      break;
    }
    case 'start_work': {
      transition(updated, 'IN_PROGRESS');
      updated = (await repo.updateWorkOrder(updated.id, { status: 'IN_PROGRESS', updatedAt: now }))!;
      const warranties = await repo.listWarrantyCases(updated.id);
      for (const warranty of warranties.filter((w) => w.state === 'OPEN')) {
        await repo.updateWarrantyCase(warranty.id, { state: 'REMEDIATING' });
      }
      await audit(repo, clock, 'work_started', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        contractorId: auth.account,
      });
      break;
    }
    case 'submit_completion': {
      transition(updated, 'COMPLETION_SUBMITTED');
      updated = (await repo.updateWorkOrder(updated.id, { status: 'COMPLETION_SUBMITTED', updatedAt: now }))!;
      await audit(repo, clock, 'completion_submitted', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        evidenceId: command.args.evidenceId,
        evidenceHash: command.args.evidenceHash,
      });
      break;
    }
    case 'accept_completion': {
      transition(updated, 'COMPLETION_ACCEPTED');
      const escrow = await repo.getEscrow(updated.id);
      if (!escrow) throw new MendError('ESCROW_MISMATCH', 'Funding escrow is missing');
      const firstAcceptance = BigInt(escrow.completionPaidMicro) === 0n;
      if (firstAcceptance) {
        if (!updated.awardedBidId) throw new MendError('ESCROW_MISMATCH', 'Awarded bid is missing');
        const reveal = await repo.getBidReveal(updated.id, updated.awardedBidId);
        if (!reveal) throw new MendError('ESCROW_MISMATCH', 'Awarded bid reveal is missing');
        const split = computeSplit(BigInt(reveal.priceMicro));
        const done = await payment(repo, deps.config, updated, {
          kind: 'COMPLETION',
          amountMicro: split.completion.toString(),
          recipient: updated.contractorId ?? reveal.contractorId,
          txHash: command.txHash,
          label: replayLabel(command),
          now,
        });
        payments.push(done);
        await repo.upsertEscrow({
          ...escrow,
          completionPaidMicro: (BigInt(escrow.completionPaidMicro) + split.completion).toString(),
          holdbackHeldMicro: (BigInt(escrow.holdbackHeldMicro) + split.holdback).toString(),
        });
        await audit(repo, clock, 'payment_released', 'chain-command-service', {
          workOrderId: updated.id,
          assetId: updated.assetId,
        }, {
          paymentId: done.id,
          kind: 'COMPLETION',
          amountMicro: split.completion.toString(),
          holdbackMicro: split.holdback.toString(),
          realTransaction: command.realTransaction,
        });
      }
      updated = (await repo.updateWorkOrder(updated.id, { status: 'COMPLETION_ACCEPTED', updatedAt: now }))!;
      transition(updated, 'DURABILITY_PENDING');
      const durabilityDueAt = new Date(
        clock.now().getTime() + deps.config.durabilityMinutes * 60_000,
      ).toISOString();
      updated = (await repo.updateWorkOrder(updated.id, {
        status: 'DURABILITY_PENDING',
        durabilityDueAt,
        updatedAt: now,
      }))!;
      await audit(repo, clock, 'completion_accepted', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        inspectionId: command.args.inspectionId,
        durabilityDueAt,
        firstAcceptance,
        durabilityIntervalMinutes: deps.config.durabilityMinutes,
      });
      break;
    }
    case 'inspect_durability': {
      const passed = body.passed === true;
      if (passed) {
        transition(updated, 'CLOSED');
        const escrow = await repo.getEscrow(updated.id);
        if (!escrow) throw new MendError('ESCROW_MISMATCH', 'Funding escrow is missing');
        const held = BigInt(escrow.holdbackHeldMicro);
        if (held <= 0n) throw new MendError('DOUBLE_PAYMENT', 'Holdback was already released or never held');
        if (!updated.contractorId) throw new MendError('ESCROW_MISMATCH', 'Awarded contractor is missing');
        const holdbackPayment = await payment(repo, deps.config, updated, {
          kind: 'HOLDBACK',
          amountMicro: held.toString(),
          recipient: updated.contractorId,
          txHash: command.txHash,
          label: replayLabel(command),
          now,
        });
        payments.push(holdbackPayment);
        await repo.upsertEscrow({
          ...escrow,
          holdbackHeldMicro: '0',
          holdbackReleasedMicro: (BigInt(escrow.holdbackReleasedMicro) + held).toString(),
        });
        updated = (await repo.updateWorkOrder(updated.id, { status: 'CLOSED', updatedAt: now }))!;
        for (const warranty of await repo.listWarrantyCases(updated.id)) {
          if (warranty.state !== 'CLOSED') {
            await repo.updateWarrantyCase(warranty.id, { state: 'CLOSED', closedAt: now });
          }
        }
        await audit(repo, clock, 'durability_passed', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
          inspectionId: command.args.inspectionId,
          holdbackMicro: held.toString(),
        });
        await audit(repo, clock, 'payment_released', 'chain-command-service', {
          workOrderId: updated.id,
          assetId: updated.assetId,
        }, {
          paymentId: holdbackPayment.id,
          kind: 'HOLDBACK',
          amountMicro: held.toString(),
          realTransaction: command.realTransaction,
        });
      } else {
        transition(updated, 'WARRANTY_REOPENED');
        updated = (await repo.updateWorkOrder(updated.id, {
          status: 'WARRANTY_REOPENED',
          reopenCount: updated.reopenCount + 1,
          updatedAt: now,
        }))!;
        const warranties = await repo.listWarrantyCases(updated.id);
        if (!warranties.some((w) => w.state !== 'CLOSED')) {
          const seq = await repo.nextSequence('warranty');
          await repo.createWarrantyCase({
            id: `WC-${String(seq).padStart(4, '0')}`,
            workOrderId: updated.id,
            failedInspectionId: String(command.args.inspectionId),
            state: 'OPEN',
            openedAt: now,
            isDemo: updated.isDemo,
          });
        }
        await audit(repo, clock, 'durability_inspection_recorded', auth.account, {
          workOrderId: updated.id,
          assetId: updated.assetId,
        }, { passed: false, inspectionId: command.args.inspectionId });
        await audit(repo, clock, 'warranty_reopened', auth.account, {
          workOrderId: updated.id,
          assetId: updated.assetId,
        }, {
          workOrderId: updated.id,
          reopenCount: updated.reopenCount,
          newFundingMicro: '0',
        });
      }
      break;
    }
    case 'open_dispute': {
      transition(updated, 'DISPUTED');
      updated = (await repo.updateWorkOrder(updated.id, { status: 'DISPUTED', updatedAt: now }))!;
      await audit(repo, clock, 'dispute_opened', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        reasonHash: body.reasonHash ?? null,
      });
      break;
    }
    case 'resolve_dispute': {
      const target = body.targetState as WorkOrderState;
      transition(updated, target, { humanResolution: true });
      updated = (await repo.updateWorkOrder(updated.id, { status: target, updatedAt: now }))!;
      await audit(repo, clock, 'dispute_resolved', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        targetState: target,
      });
      break;
    }
    case 'cancel_work_order': {
      transition(updated, 'CANCELLED');
      updated = (await repo.updateWorkOrder(updated.id, { status: 'CANCELLED', updatedAt: now }))!;
      await audit(repo, clock, 'work_order_cancelled', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {});
      break;
    }
    case 'refund': {
      const escrow = await repo.getEscrow(updated.id);
      if (!escrow) throw new MendError('ESCROW_MISMATCH', 'Funding escrow is missing');
      const remaining = remainingEscrow(escrow);
      if (remaining <= 0n) throw new MendError('DOUBLE_PAYMENT', 'No refundable escrow remains');
      if (!updated.sponsorId) throw new MendError('ESCROW_MISMATCH', 'Sponsor is unknown');
      const refundPayment = await payment(repo, deps.config, updated, {
        kind: 'REFUND',
        amountMicro: remaining.toString(),
        recipient: updated.sponsorId,
        txHash: command.txHash,
        label: replayLabel(command),
        now,
      });
      payments.push(refundPayment);
      await repo.upsertEscrow({
        ...escrow,
        refundedMicro: (BigInt(escrow.refundedMicro) + remaining).toString(),
      });
      transition(updated, 'REFUNDED');
      updated = (await repo.updateWorkOrder(updated.id, { status: 'REFUNDED', updatedAt: now }))!;
      await audit(repo, clock, 'work_order_refunded', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        paymentId: refundPayment.id,
        amountMicro: remaining.toString(),
      });
      break;
    }
    case 'pause': {
      const previous = updated.status;
      updated = (await repo.updateWorkOrder(updated.id, {
        status: 'PAUSED',
        pausedFrom: previous,
        updatedAt: now,
      }))!;
      await audit(repo, clock, 'contract_paused', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        pausedFrom: previous,
      });
      break;
    }
    case 'unpause': {
      const target = updated.pausedFrom;
      if (!target) throw new MendError('INVALID_STATE', 'Paused-from state is missing');
      transition(updated, target, { pausedFrom: target });
      updated = (await repo.updateWorkOrder(updated.id, { status: target, updatedAt: now }))!;
      await audit(repo, clock, 'contract_unpaused', auth.account, { workOrderId: updated.id, assetId: updated.assetId }, {
        resumedState: target,
      });
      break;
    }
    default: {
      const exhaustive: never = action;
      throw new MendError('VALIDATION_ERROR', `Unknown action ${String(exhaustive)}`);
    }
  }

  return { workOrder: updated, applied: true, payments };
}

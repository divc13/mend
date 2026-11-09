import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BID_ID_PATTERN,
  HASH_PATTERN,
  MendError,
  REPLAY_LABEL,
  WORK_ORDER_ID_PATTERN,
  bidCommitmentHash,
  canonicalWorkOrderId,
  isNearAccount,
} from '@mend/protocol';
import type { AppDeps } from '../context.js';
import {
  actionRoles,
  authFromHeaders,
  isWorkOrderAction,
  requireRole,
  ROLE_MATRIX,
  WORK_ORDER_ACTION_ROLES,
} from '../auth.js';
import {
  chainCommandView,
  commitmentView,
  escrowView,
  evidencePackageView,
  inspectionView,
  paymentView,
  revealView,
  scoreView,
  warrantyView,
  workOrderView,
} from '../serializers.js';
import { auditEvent } from '../services/audit.js';
import { performWorkOrderAction } from '../services/work-orders.js';
import { recordScore } from '../services/scoring.js';

const microString = z.string().regex(/^\d+$/, 'amount must be integer micro-units');
const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'invalid ISO datetime');

const createWorkOrderInput = z.object({
  id: z.string().regex(WORK_ORDER_ID_PATTERN).optional(),
  assetId: z.string().min(1),
  reportClusterId: z.string().min(1),
  scopeHash: z.string().regex(HASH_PATTERN),
  daoApprovalId: z.string().min(1),
  policyHash: z.string().regex(HASH_PATTERN).optional(),
  budgetMicro: microString.optional(),
  fundingToken: z.string().min(2).max(64).optional(),
  mode: z.enum(['LIVE_TESTNET', 'MAINNET', 'REPLAY']).optional(),
  commitDeadline: isoDate.optional(),
  revealDeadline: isoDate.optional(),
});

const bidInput = z.object({
  priceMicro: microString,
  durationDays: z.number().int().positive(),
  warrantyDays: z.number().int().nonnegative(),
  materials: z.string().max(1000).default(''),
  materialsScore: z.number().int().min(0).max(100),
  evidenceChecklistAccepted: z.boolean(),
  nonce: z.string().min(8).max(128),
});

const commitInput = z.object({
  bidId: z.string().regex(BID_ID_PATTERN),
  contractorId: z.string().min(2).max(64).optional(),
  commitmentHash: z.string().regex(HASH_PATTERN).optional(),
  bid: bidInput.optional(),
});

const revealInput = bidInput.extend({
  bidId: z.string().regex(BID_ID_PATTERN),
  contractorId: z.string().min(2).max(64).optional(),
});

const scoreInput = z.object({
  policyHash: z.string().regex(HASH_PATTERN).optional(),
}).default({});

const inspectionInput = z.object({
  kind: z.enum(['COMPLETION', 'DURABILITY', 'REMEDIATION']),
  decision: z.enum(['APPROVED', 'REJECTED']),
  evidencePackageId: z.string().min(1),
  notesHash: z.string().regex(HASH_PATTERN).optional(),
});

const paymentInput = z.object({
  kind: z.enum(['COMPLETION', 'HOLDBACK', 'REFUND']),
  amountMicro: microString,
  recipient: z.string().min(2).max(64),
  txHash: z.string().min(1).max(200).optional(),
});

const REVEAL_VISIBLE_STATES = new Set([
  'BIDDING_REVEAL', 'SCORED', 'AWARDED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED', 'DURABILITY_PENDING', 'CLOSED', 'WARRANTY_REOPENED', 'DISPUTED',
]);

export async function registerWorkOrderRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  async function requireWorkOrder(id: string) {
    const workOrder = await deps.repo.getWorkOrder(id);
    if (!workOrder) throw new MendError('NOT_FOUND', 'Work order not found', { workOrderId: id });
    return workOrder;
  }

  async function requireApproval(workOrderId: string) {
    const workOrder = await requireWorkOrder(workOrderId);
    const approval = await deps.repo.getDaoApproval(workOrder.daoApprovalId);
    if (!approval) throw new MendError('DAO_APPROVAL_MISMATCH', 'DAO approval is missing');
    return { workOrder, approval };
  }

  app.get('/v1/work-orders', async (request) => {
    const query = request.query as { status?: string; assetId?: string; contractorId?: string };
    const workOrders = await deps.repo.listWorkOrders({
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.contractorId ? { contractorId: query.contractorId } : {}),
    });
    return workOrders.map(workOrderView);
  });

  app.post('/v1/work-orders', async (request, reply) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['work_order:create'],
      'work_order:create',
    );
    const input = createWorkOrderInput.parse(request.body);
    const asset = await deps.repo.getAsset(input.assetId);
    if (!asset) throw new MendError('NOT_FOUND', 'Asset not found', { assetId: input.assetId });
    const cluster = await deps.repo.getCluster(input.reportClusterId);
    if (!cluster) throw new MendError('NOT_FOUND', 'Report cluster not found', { clusterId: input.reportClusterId });
    const approval = await deps.repo.getDaoApproval(input.daoApprovalId);
    if (!approval) throw new MendError('NOT_FOUND', 'DAO approval not found', { daoApprovalId: input.daoApprovalId });
    if (approval.state !== 'APPROVED') {
      throw new MendError('POLICY_NOT_APPROVED', 'DAO approval is not approved', { state: approval.state });
    }
    const policyHash = input.policyHash ?? approval.policyHash;
    if (policyHash !== approval.policyHash) {
      throw new MendError('DAO_APPROVAL_MISMATCH', 'Policy hash does not match the DAO approval');
    }
    const budgetMicro = input.budgetMicro ?? approval.budgetMicro;
    if (budgetMicro !== approval.budgetMicro) {
      throw new MendError('DAO_APPROVAL_MISMATCH', 'Budget must match the DAO-approved envelope');
    }
    const fundingToken = input.fundingToken ?? deps.config.chain.tokenAccount;
    if (!isNearAccount(fundingToken)) throw new MendError('VALIDATION_ERROR', 'Invalid funding token account');
    const seq = await deps.repo.nextSequence(`work-order:${input.assetId}`);
    const id = input.id ?? canonicalWorkOrderId(input.assetId, seq);
    if (await deps.repo.getWorkOrder(id)) {
      throw new MendError('VALIDATION_ERROR', 'Work order already exists', { workOrderId: id });
    }
    const now = deps.clock.now().toISOString();
    const workOrder = await deps.repo.createWorkOrder({
      id,
      assetId: input.assetId,
      reportClusterId: input.reportClusterId,
      scopeHash: input.scopeHash,
      daoApprovalId: input.daoApprovalId,
      policyHash,
      budgetMicro,
      status: 'DRAFT',
      mode: input.mode ?? deps.config.mode,
      fundingToken,
      ...(input.commitDeadline ? { commitDeadline: input.commitDeadline } : {}),
      ...(input.revealDeadline ? { revealDeadline: input.revealDeadline } : {}),
      reopenCount: 0,
      createdAt: now,
      updatedAt: now,
      isDemo: false,
    });
    await auditEvent(deps, 'work_order_created', auth.account, { workOrderId: id, assetId: input.assetId }, {
      scopeHash: workOrder.scopeHash,
      daoApprovalId: workOrder.daoApprovalId,
      policyHash: workOrder.policyHash,
      budgetMicro: workOrder.budgetMicro,
      mode: workOrder.mode,
    });
    return reply.status(201).send(workOrderView(workOrder));
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId', async (request) => {
    return workOrderView(await requireWorkOrder(request.params.workOrderId));
  });

  app.post<{ Params: { workOrderId: string; action: string } }>(
    '/v1/work-orders/:workOrderId/actions/:action',
    async (request, reply) => {
      const action = request.params.action;
      if (!isWorkOrderAction(action)) {
        throw new MendError('VALIDATION_ERROR', 'Unknown work-order action', {
          action,
          allowed: Object.keys(WORK_ORDER_ACTION_ROLES),
        });
      }
      const auth = requireRole(
        authFromHeaders(request.headers, deps.config),
        actionRoles(action),
        `work_order:${action}`,
      );
      const result = await performWorkOrderAction(deps, request.params.workOrderId, action, request.body, auth);
      const status = result.applied ? 200 : 202;
      return reply.status(status).send({
        workOrder: workOrderView(result.workOrder),
        command: chainCommandView(result.command),
        applied: result.applied,
        payments: result.payments.map(paymentView),
        label: result.command.realTransaction ? null : REPLAY_LABEL,
        adapter: deps.commands.adapterInfo,
      });
    },
  );

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/bids', async (request) => {
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    const commitments = await deps.repo.listBidCommitments(workOrder.id);
    const revealAvailable = REVEAL_VISIBLE_STATES.has(workOrder.status);
    const reveals = revealAvailable ? await deps.repo.listBidReveals(workOrder.id) : [];
    return {
      workOrderId: workOrder.id,
      phase: workOrder.status,
      commitDeadline: workOrder.commitDeadline ?? null,
      revealDeadline: workOrder.revealDeadline ?? null,
      revealAvailable,
      commitments: commitments.map(commitmentView),
      revealedCount: reveals.length,
      reveals: revealAvailable ? reveals.map(revealView) : null,
      note: revealAvailable
        ? 'Revealed bids are public after bidding closes.'
        : 'Commitments are public. Competing bid values are hidden until the reveal phase is over.',
    };
  });

  app.post<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/bids/commit', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['bid:commit'], 'bid:commit');
    const input = commitInput.parse(request.body);
    const { workOrder, approval } = await requireApproval(request.params.workOrderId);
    if (workOrder.status !== 'BIDDING_OPEN') {
      throw new MendError('BIDDING_NOT_OPEN', 'Bids can only be committed while BIDDING_OPEN', {
        status: workOrder.status,
      });
    }
    const now = deps.clock.now();
    if (workOrder.commitDeadline && now.getTime() > Date.parse(workOrder.commitDeadline)) {
      throw new MendError('BID_LATE', 'Commit deadline has passed', { commitDeadline: workOrder.commitDeadline });
    }
    const contractorId = input.contractorId ?? auth.account;
    if (contractorId !== auth.account) {
      throw new MendError('FORBIDDEN_ROLE', 'Contractor account must match the authenticated account');
    }
    if (!approval.contractorRoster.includes(contractorId)) {
      throw new MendError('NOT_ROSTERED', 'Contractor is not on the DAO-approved roster');
    }
    if (await deps.repo.getBidCommitment(workOrder.id, input.bidId)) {
      throw new MendError('BID_DUPLICATE', 'A commitment for this bid already exists');
    }
    let commitmentHash = input.commitmentHash;
    if (!commitmentHash) {
      if (!input.bid) throw new MendError('VALIDATION_ERROR', 'Either commitmentHash or bid is required');
      commitmentHash = bidCommitmentHash({
        bidId: input.bidId,
        contractorId,
        priceMicro: input.bid.priceMicro,
        durationDays: input.bid.durationDays,
        warrantyDays: input.bid.warrantyDays,
        materialsScore: input.bid.materialsScore,
        evidenceChecklistAccepted: input.bid.evidenceChecklistAccepted,
        nonce: input.bid.nonce,
      });
    }
    const commitment = await deps.repo.createBidCommitment({
      workOrderId: workOrder.id,
      bidId: input.bidId,
      contractorId,
      commitmentHash,
      committedAt: now.toISOString(),
      isDemo: workOrder.isDemo,
    });
    await auditEvent(deps, 'bid_committed', auth.account, { workOrderId: workOrder.id, assetId: workOrder.assetId }, {
      bidId: commitment.bidId,
      contractorId,
      commitmentHash,
    });
    return reply.status(201).send(commitmentView(commitment));
  });

  app.post<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/bids/reveal', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['bid:reveal'], 'bid:reveal');
    const input = revealInput.parse(request.body);
    const { workOrder, approval } = await requireApproval(request.params.workOrderId);
    if (workOrder.status !== 'BIDDING_OPEN') {
      throw new MendError('BID_LATE', 'Reveal is not allowed in this phase', { status: workOrder.status });
    }
    const now = deps.clock.now();
    if (workOrder.commitDeadline && now.getTime() < Date.parse(workOrder.commitDeadline)) {
      throw new MendError('BID_EARLY_REVEAL', 'Reveal before the commit deadline is not allowed', {
        commitDeadline: workOrder.commitDeadline,
      });
    }
    if (workOrder.revealDeadline && now.getTime() > Date.parse(workOrder.revealDeadline)) {
      throw new MendError('BID_LATE', 'Reveal deadline has passed', { revealDeadline: workOrder.revealDeadline });
    }
    const contractorId = input.contractorId ?? auth.account;
    if (contractorId !== auth.account) {
      throw new MendError('FORBIDDEN_ROLE', 'Contractor account must match the authenticated account');
    }
    if (!approval.contractorRoster.includes(contractorId)) {
      throw new MendError('NOT_ROSTERED', 'Contractor is not on the DAO-approved roster');
    }
    const commitment = await deps.repo.getBidCommitment(workOrder.id, input.bidId);
    if (!commitment) throw new MendError('BID_HASH_MISMATCH', 'No commitment exists for this bid');
    if (commitment.contractorId !== contractorId) {
      throw new MendError('FORBIDDEN_ROLE', 'Commitment belongs to a different contractor');
    }
    if (await deps.repo.getBidReveal(workOrder.id, input.bidId)) {
      throw new MendError('BID_DUPLICATE', 'Bid already revealed');
    }
    const expected = bidCommitmentHash({
      bidId: input.bidId,
      contractorId,
      priceMicro: input.priceMicro,
      durationDays: input.durationDays,
      warrantyDays: input.warrantyDays,
      materialsScore: input.materialsScore,
      evidenceChecklistAccepted: input.evidenceChecklistAccepted,
      nonce: input.nonce,
    });
    if (expected !== commitment.commitmentHash) {
      throw new MendError('BID_HASH_MISMATCH', 'Reveal does not match the commitment hash');
    }
    const reveal = await deps.repo.createBidReveal({
      workOrderId: workOrder.id,
      bidId: input.bidId,
      contractorId,
      priceMicro: input.priceMicro,
      durationDays: input.durationDays,
      warrantyDays: input.warrantyDays,
      materials: input.materials,
      materialsScore: input.materialsScore,
      evidenceChecklistAccepted: input.evidenceChecklistAccepted,
      nonce: input.nonce,
      revealedAt: now.toISOString(),
      commitmentHash: commitment.commitmentHash,
      isDemo: workOrder.isDemo,
    });
    await auditEvent(deps, 'bid_revealed', auth.account, { workOrderId: workOrder.id, assetId: workOrder.assetId }, {
      bidId: reveal.bidId,
      contractorId,
      priceMicro: reveal.priceMicro,
    });
    return reply.status(201).send({
      ...revealView(reveal),
      visiblePubliclyAfter: workOrder.revealDeadline ?? null,
      note: 'The reveal is stored but remains hidden from public bid views until bidding closes.',
    });
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/score', async (request) => {
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    const score = await deps.repo.getLatestScoreExecution(workOrder.id);
    if (!score) throw new MendError('NOT_FOUND', 'No score has been recorded for this work order');
    return {
      workOrderId: workOrder.id,
      score: scoreView(score),
      verified: score.verified,
      label: score.verified ? 'VERIFIED' : 'LOCAL_DETERMINISTIC_REPLAY',
      outlayerAvailable: false,
    };
  });

  app.post<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/score', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['score:record'], 'score:record');
    const input = scoreInput.parse(request.body ?? {});
    const result = await recordScore(deps, request.params.workOrderId, auth, input);
    return reply.status(result.applied ? 200 : 202).send({
      workOrder: workOrderView(result.workOrder),
      score: scoreView(result.score),
      command: chainCommandView(result.command),
      applied: result.applied,
      verified: result.score.verified,
      label: result.score.verified ? 'VERIFIED' : 'LOCAL_DETERMINISTIC_REPLAY',
      outlayerAvailable: false,
      note: 'No LLM chooses the winner. This is deterministic integer scoring, labelled local because OutLayer is unavailable.',
    });
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/evidence', async (request) => {
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    const packages = await deps.repo.listEvidencePackages(workOrder.id);
    const result = [];
    for (const pkg of packages) {
      const objects = await deps.repo.listEvidenceObjects(pkg.id);
      result.push(evidencePackageView(pkg, objects));
    }
    return result;
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/payments', async (request) => {
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    const [payments, escrow] = await Promise.all([
      deps.repo.listPayments(workOrder.id),
      deps.repo.getEscrow(workOrder.id),
    ]);
    return {
      workOrderId: workOrder.id,
      escrow: escrow ? escrowView(escrow) : null,
      payments: payments.map(paymentView),
      note: 'Payment status INTENT/PENDING is not a completed payment. REPLAY rows are explicitly labelled.',
    };
  });

  app.post<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/payments', async (request, reply) => {
    const auth = requireRole(authFromHeaders(request.headers, deps.config), ROLE_MATRIX['payment:create'], 'payment:create');
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    const input = paymentInput.parse(request.body);
    if (!isNearAccount(input.recipient)) throw new MendError('VALIDATION_ERROR', 'Invalid recipient account');
    const seq = await deps.repo.nextSequence('payment');
    const now = deps.clock.now().toISOString();
    const payment = await deps.repo.createPayment({
      id: `PMT-${String(seq).padStart(4, '0')}`,
      workOrderId: workOrder.id,
      kind: input.kind,
      amountMicro: input.amountMicro,
      recipient: input.recipient,
      status: input.txHash ? 'SUCCESS' : 'INTENT',
      ...(input.txHash ? { txHash: input.txHash, releasedAt: now } : {}),
      ...(input.txHash ? {} : { label: 'INTENT — not a completed payment' }),
      createdAt: now,
      isDemo: workOrder.isDemo,
    });
    await auditEvent(deps, 'payment_recorded', auth.account, { workOrderId: workOrder.id, assetId: workOrder.assetId }, {
      paymentId: payment.id,
      kind: payment.kind,
      amountMicro: payment.amountMicro,
      status: payment.status,
      chainObserved: Boolean(input.txHash),
    });
    return reply.status(201).send(paymentView(payment));
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/inspections', async (request) => {
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    return (await deps.repo.listInspections(workOrder.id)).map(inspectionView);
  });

  app.post<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/inspections', async (request, reply) => {
    const auth = requireRole(
      authFromHeaders(request.headers, deps.config),
      ROLE_MATRIX['inspection:create'],
      'inspection:create',
    );
    const input = inspectionInput.parse(request.body);
    const { workOrder, approval } = await requireApproval(request.params.workOrderId);
    if (workOrder.contractorId === auth.account) {
      throw new MendError('CONTRACTOR_SELF_INSPECTION', 'Contractor cannot inspect their own work');
    }
    if (!approval.inspectorRoster.includes(auth.account)) {
      throw new MendError('NOT_ROSTERED', 'Inspector is not on the DAO-approved roster');
    }
    const evidence = await deps.repo.getEvidencePackage(input.evidencePackageId);
    if (!evidence || evidence.workOrderId !== workOrder.id) {
      throw new MendError('NOT_FOUND', 'Evidence package not found for this work order');
    }
    const seq = await deps.repo.nextSequence('inspection');
    const inspection = await deps.repo.createInspection({
      id: `INS-${String(seq).padStart(4, '0')}`,
      workOrderId: workOrder.id,
      kind: input.kind,
      inspectorId: auth.account,
      decision: input.decision,
      evidencePackageId: evidence.id,
      ...(input.notesHash ? { notesHash: input.notesHash } : {}),
      signedAt: deps.clock.now().toISOString(),
      isDemo: workOrder.isDemo,
    });
    await auditEvent(deps, 'inspection_signed', auth.account, { workOrderId: workOrder.id, assetId: workOrder.assetId }, {
      inspectionId: inspection.id,
      kind: inspection.kind,
      decision: inspection.decision,
      evidencePackageId: evidence.id,
      humanDecision: true,
    });
    return reply.status(201).send(inspectionView(inspection));
  });

  app.get<{ Params: { inspectionId: string } }>('/v1/inspections/:inspectionId', async (request) => {
    const inspection = await deps.repo.getInspection(request.params.inspectionId);
    if (!inspection) throw new MendError('NOT_FOUND', 'Inspection not found');
    return inspectionView(inspection);
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/warranty', async (request) => {
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    return {
      workOrderId: workOrder.id,
      durabilityDueAt: workOrder.durabilityDueAt ?? null,
      durabilityIntervalMinutes: deps.config.durabilityMinutes,
      reopenCount: workOrder.reopenCount,
      cases: (await deps.repo.listWarrantyCases(workOrder.id)).map(warrantyView),
    };
  });

  app.get<{ Params: { workOrderId: string } }>('/v1/work-orders/:workOrderId/commands', async (request) => {
    const workOrder = await requireWorkOrder(request.params.workOrderId);
    return (await deps.repo.listChainCommands(workOrder.id)).map(chainCommandView);
  });
}

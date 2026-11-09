import {
  DEFAULT_SCORE_POLICY,
  MendError,
  SCORING_POLICY_VERSION,
  policyHash,
  scoreBids,
  scoreInputHash,
  scoreOutputHash,
  sha256Hex,
  stableStringify,
  type ScoreBidInput,
  type ScorePolicy,
} from '@mend/protocol';
import type { ChainCommandRecord, Repository, ScoreExecutionRecord, WorkOrderRecord } from '@mend/db';
import type { AuthContext, } from '../auth.js';
import type { AppConfig } from '../config.js';
import { ChainCommandService, HUB_METHOD_BY_ACTION, type Clock, systemClock } from './chain.js';

export interface RecordScoreResult {
  score: ScoreExecutionRecord;
  command: ChainCommandRecord;
  workOrder: WorkOrderRecord;
  applied: boolean;
}

function localPolicy(config: AppConfig): ScorePolicy {
  return {
    version: config.scoring.version || SCORING_POLICY_VERSION,
    weightsBps: config.scoring.weightsBps,
  };
}

/**
 * Deterministic integer scoring. OutLayer execution is not available in this
 * wave, so the result is explicitly labelled LOCAL_REPLAY and never presented
 * as an OutLayer attestation.
 */
export async function recordScore(
  deps: { repo: Repository; config: AppConfig; commands: ChainCommandService; clock?: Clock },
  workOrderId: string,
  auth: AuthContext,
  rawBody: unknown,
): Promise<RecordScoreResult> {
  const clock = deps.clock ?? systemClock;
  const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? rawBody
    : {}) as Record<string, unknown>;

  const policy = localPolicy(deps.config);
  const expectedPolicyHash = policyHash(policy);
  if (body.policyHash !== undefined && body.policyHash !== expectedPolicyHash) {
    throw new MendError('SCORE_POLICY_MISMATCH', 'Provided policy hash does not match the configured policy');
  }

  return deps.repo.transaction(async (tx) => {
    const workOrder = await tx.getWorkOrder(workOrderId);
    if (!workOrder) throw new MendError('NOT_FOUND', 'Work order not found', { workOrderId });
    if (workOrder.status !== 'BIDDING_REVEAL') {
      throw new MendError('INVALID_STATE', 'Score can only be recorded during BIDDING_REVEAL', {
        status: workOrder.status,
      });
    }
    if (workOrder.policyHash !== expectedPolicyHash) {
      throw new MendError('SCORE_POLICY_MISMATCH', 'Work-order policy hash does not match the configured policy', {
        workOrderPolicyHash: workOrder.policyHash,
        expectedPolicyHash,
      });
    }
    const approval = await tx.getDaoApproval(workOrder.daoApprovalId);
    if (!approval || approval.state !== 'APPROVED') {
      throw new MendError('POLICY_NOT_APPROVED', 'DAO approval is not active');
    }

    const reveals = await tx.listBidReveals(workOrder.id);
    if (reveals.length === 0) throw new MendError('SCORE_INVALID', 'No revealed bids to score');
    const commitments = await tx.listBidCommitments(workOrder.id);
    const commitmentHashes = commitments.map((commitment) => commitment.commitmentHash);

    const inputs: ScoreBidInput[] = reveals.map((reveal) => {
      const eligible = approval.contractorRoster.includes(reveal.contractorId)
        && commitments.some((commitment) => commitment.bidId === reveal.bidId && commitment.contractorId === reveal.contractorId);
      return {
        bidId: reveal.bidId,
        contractorId: reveal.contractorId,
        priceMicro: reveal.priceMicro,
        durationDays: reveal.durationDays,
        warrantyDays: reveal.warrantyDays,
        materialsScore: reveal.materialsScore,
        eligible,
      };
    });

    const result = scoreBids(inputs, policy);
    const ranking = result.ranking.map((bid) => ({
      rank: bid.rank,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      scoreBps: bid.scoreBps,
    }));

    const wasmHash = sha256Hex(`MEND_BID_RULES_LOCAL_V1|${deps.config.scoring.policyHashSeed}`);
    const inputHash = scoreInputHash(expectedPolicyHash, commitmentHashes);
    const outputHash = scoreOutputHash(stableStringify(ranking));
    const now = clock.now().toISOString();
    const executionRef = `local-replay:${deps.config.scoring.version}`;

    const command = await deps.commands.submit(tx, {
      workOrderId: workOrder.id,
      action: 'record_score',
      method: HUB_METHOD_BY_ACTION.record_score!,
      args: {
        workOrderId: workOrder.id,
        policyHash: expectedPolicyHash,
        wasmHash,
        inputHash,
        outputHash,
        ranking,
      },
      isDemo: workOrder.isDemo,
    });
    if (command.state !== 'SUCCESS') {
      const existing = await tx.getLatestScoreExecution(workOrder.id);
      if (!existing) {
        throw new MendError('UPSTREAM_UNAVAILABLE', 'Score command was not confirmed and no prior score exists', {
          commandState: command.state,
        });
      }
      return { score: existing, command, workOrder, applied: false };
    }

    const seq = await tx.nextSequence('score-execution');
    const score = await tx.createScoreExecution({
      id: `SX-${String(seq).padStart(4, '0')}`,
      workOrderId: workOrder.id,
      policyHash: expectedPolicyHash,
      wasmHash,
      inputHash,
      outputHash,
      ranking,
      executionRef,
      verified: false,
      unavailableReason:
        'OutLayer deterministic execution is not available in this wave. `verified` is false; this is a labelled local integer replay, not an OutLayer attestation.',
      createdAt: now,
      isDemo: workOrder.isDemo,
    });

    const updated = (await tx.updateWorkOrder(workOrder.id, { status: 'SCORED', updatedAt: now }))!;
    await tx.appendAudit({
      id: `A-${String(await tx.nextSequence('audit')).padStart(5, '0')}`,
      name: 'score_recorded',
      actor: auth.account,
      workOrderId: workOrder.id,
      assetId: workOrder.assetId,
      at: now,
      data: {
        executionId: score.id,
        policyHash: expectedPolicyHash,
        outputHash,
        winnerBidId: ranking[0]?.bidId,
        verified: false,
        executionRef,
      },
    });
    // A local hash-integrity artifact, not an OutLayer claim.
    await tx.createAttestation({
      id: `ATT-${String(await tx.nextSequence('attestation')).padStart(4, '0')}`,
      kind: 'LOCAL_REPLAY',
      subjectHash: outputHash,
      artifact: {
        kind: 'LOCAL_DETERMINISTIC_SCORE',
        provider: 'local-replay',
        policyHash: expectedPolicyHash,
        ranking,
        wasmHash,
        inputHash,
        outputHash,
        outlayerExecuted: false,
      },
      artifactHash: outputHash,
      verified: true,
      unavailableReason: 'Not an OutLayer execution: no OutLayer credentials/execution in this wave.',
      createdAt: now,
      isDemo: workOrder.isDemo,
    });
    return { score, command, workOrder: updated, applied: true };
  });
}

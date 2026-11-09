import {
  MendError,
  sha256Hex,
  stableStringify,
  type WorkOrderState,
} from '@mend/protocol';
import type {
  AssetRecord,
  AttestationRecord,
  BidCommitmentRecord,
  BidRevealRecord,
  DaoApprovalRecord,
  EscrowRecord,
  EvidencePackageRecord,
  InspectionRecord,
  PaymentRecord,
  ReportClusterRecord,
  Repository,
  ScoreExecutionRecord,
  WarrantyCaseRecord,
  WorkOrderRecord,
} from '@mend/db';
import { stripUndefined } from '@mend/db';
import type { IndexedHubEvent } from './events.js';

const STATUS_BY_EVENT: Partial<Record<IndexedHubEvent['name'], WorkOrderState>> = {
  policy_approved: 'POLICY_APPROVED',
  work_order_funded: 'FUNDED',
  funding_failed: 'FUNDING_FAILED',
  bidding_opened: 'BIDDING_OPEN',
  bidding_closed: 'BIDDING_REVEAL',
  score_recorded: 'SCORED',
  work_order_awarded: 'AWARDED',
  work_started: 'IN_PROGRESS',
  completion_submitted: 'COMPLETION_SUBMITTED',
  completion_accepted: 'DURABILITY_PENDING',
  durability_passed: 'CLOSED',
  warranty_reopened: 'WARRANTY_REOPENED',
  dispute_opened: 'DISPUTED',
  work_order_refunded: 'REFUNDED',
  work_order_cancelled: 'CANCELLED',
  contract_paused: 'PAUSED',
};

function dataOf(event: IndexedHubEvent): Record<string, unknown> {
  return (event.data ?? {}) as Record<string, unknown>;
}

function snapshotWithDemo<T extends object>(value: unknown): T & { isDemo: boolean } {
  if (!value || typeof value !== 'object') throw new MendError('VALIDATION_ERROR', 'Event snapshot is missing');
  return { ...(value as T), isDemo: Boolean((value as { isDemo?: boolean }).isDemo) };
}

async function upsertAsset(repo: Repository, snapshot: AssetRecord): Promise<void> {
  const existing = await repo.getAsset(snapshot.id);
  if (!existing) {
    await repo.createAsset({ ...snapshot, isDemo: false });
    return;
  }
  await repo.updateAsset(snapshot.id, {
    publicDescription: snapshot.publicDescription,
    assetType: snapshot.assetType,
    publicLocation: snapshot.publicLocation,
    ...(snapshot.passportTokenId ? { passportTokenId: snapshot.passportTokenId } : {}),
  });
}

async function upsertWorkOrder(repo: Repository, snapshot: WorkOrderRecord): Promise<void> {
  const existing = await repo.getWorkOrder(snapshot.id);
  if (!existing) {
    await repo.createWorkOrder({ ...snapshot, isDemo: false });
    return;
  }
  const patch: Parameters<Repository['updateWorkOrder']>[1] = {
    scopeHash: snapshot.scopeHash,
    daoApprovalId: snapshot.daoApprovalId,
    policyHash: snapshot.policyHash,
    budgetMicro: snapshot.budgetMicro,
    status: snapshot.status,
    reopenCount: snapshot.reopenCount,
    updatedAt: snapshot.updatedAt,
  };
  if (snapshot.awardedBidId !== undefined) patch.awardedBidId = snapshot.awardedBidId;
  if (snapshot.contractorId !== undefined) patch.contractorId = snapshot.contractorId;
  if (snapshot.inspectorId !== undefined) patch.inspectorId = snapshot.inspectorId;
  if (snapshot.sponsorId !== undefined) patch.sponsorId = snapshot.sponsorId;
  if (snapshot.fundingTxHash !== undefined) patch.fundingTxHash = snapshot.fundingTxHash;
  if (snapshot.durabilityDueAt !== undefined) patch.durabilityDueAt = snapshot.durabilityDueAt;
  if (snapshot.commitDeadline !== undefined) patch.commitDeadline = snapshot.commitDeadline;
  if (snapshot.revealDeadline !== undefined) patch.revealDeadline = snapshot.revealDeadline;
  if (snapshot.pausedFrom !== undefined) patch.pausedFrom = snapshot.pausedFrom;
  await repo.updateWorkOrder(snapshot.id, patch);
}

async function applySnapshots(repo: Repository, data: Record<string, unknown>): Promise<void> {
  if (data.asset) {
    await upsertAsset(repo, snapshotWithDemo<AssetRecord>(data.asset));
  }
  if (data.cluster) {
    const cluster = snapshotWithDemo<ReportClusterRecord>(data.cluster);
    const existing = await repo.getCluster(cluster.id);
    if (!existing) await repo.createCluster(cluster);
    else {
      await repo.updateCluster(cluster.id, {
        reportIds: cluster.reportIds,
        confidenceBps: cluster.confidenceBps,
        rationale: cluster.rationale,
        status: cluster.status,
        ...(cluster.confirmedBy ? { confirmedBy: cluster.confirmedBy } : {}),
      });
    }
  }
  if (data.daoApproval) {
    const approval = snapshotWithDemo<DaoApprovalRecord>(data.daoApproval);
    const existing = await repo.getDaoApproval(approval.id);
    if (!existing) await repo.createDaoApproval(approval);
    else {
      await repo.updateDaoApproval(approval.id, {
        state: approval.state,
        ...(approval.approvedAt ? { approvedAt: approval.approvedAt } : {}),
      });
    }
  }
  if (data.workOrder) {
    await upsertWorkOrder(repo, snapshotWithDemo<WorkOrderRecord>(data.workOrder));
  }
  if (data.commitment) {
    const commitment = snapshotWithDemo<BidCommitmentRecord>(data.commitment);
    if (!(await repo.getBidCommitment(commitment.workOrderId, commitment.bidId))) {
      await repo.createBidCommitment(commitment);
    }
  }
  if (data.reveal) {
    const reveal = snapshotWithDemo<BidRevealRecord>(data.reveal);
    if (!(await repo.getBidReveal(reveal.workOrderId, reveal.bidId))) {
      await repo.createBidReveal(reveal);
    }
  }
  if (data.score) {
    const score = snapshotWithDemo<ScoreExecutionRecord>(data.score);
    if (!(await repo.getScoreExecution(score.id))) await repo.createScoreExecution(score);
  }
  if (data.attestation) {
    const attestation = snapshotWithDemo<AttestationRecord>(data.attestation);
    if (!(await repo.getAttestation(attestation.id))) await repo.createAttestation(attestation);
  }
  if (data.evidence) {
    const evidence = snapshotWithDemo<EvidencePackageRecord>(data.evidence);
    if (!(await repo.getEvidencePackage(evidence.id))) await repo.createEvidencePackage(evidence);
  }
  if (data.inspection) {
    const inspection = snapshotWithDemo<InspectionRecord>(data.inspection);
    if (!(await repo.getInspection(inspection.id))) await repo.createInspection(inspection);
  }
  if (data.escrow) {
    const escrow = snapshotWithDemo<EscrowRecord>(data.escrow);
    await repo.upsertEscrow(escrow);
  }
  if (data.payment) {
    const snapshot = snapshotWithDemo<PaymentRecord>(data.payment);
    const existing = await repo.getPayment(snapshot.id);
    if (!existing) await repo.createPayment(snapshot);
    else {
      await repo.updatePayment(snapshot.id, {
        status: snapshot.status,
        ...(snapshot.txHash ? { txHash: snapshot.txHash } : {}),
        ...(snapshot.releasedAt ? { releasedAt: snapshot.releasedAt } : {}),
      });
    }
  }
  if (data.warranty) {
    const warranty = snapshotWithDemo<WarrantyCaseRecord>(data.warranty);
    const existing = await repo.getWarrantyCase(warranty.id);
    if (!existing) await repo.createWarrantyCase(warranty);
    else {
      await repo.updateWarrantyCase(warranty.id, {
        state: warranty.state,
        ...(warranty.closedAt ? { closedAt: warranty.closedAt } : {}),
      });
    }
  }
}

async function applyStatusFallback(repo: Repository, event: IndexedHubEvent): Promise<void> {
  const data = dataOf(event);
  if (!event.workOrderId) return;
  const target = event.name === 'dispute_resolved'
    ? (typeof data.targetState === 'string' ? data.targetState as WorkOrderState : undefined)
    : event.name === 'contract_unpaused'
      ? (typeof data.resumedState === 'string' ? data.resumedState as WorkOrderState : undefined)
      : STATUS_BY_EVENT[event.name];
  if (!target) return;
  const workOrder = await repo.getWorkOrder(event.workOrderId);
  if (!workOrder) return;
  const patch: Parameters<Repository['updateWorkOrder']>[1] = {
    status: target,
    updatedAt: event.timestamp,
  };
  if (target === 'WARRANTY_REOPENED' && typeof data.reopenCount === 'number') {
    patch.reopenCount = data.reopenCount;
  }
  if (target === 'DURABILITY_PENDING' && typeof data.durabilityDueAt === 'string') {
    patch.durabilityDueAt = data.durabilityDueAt;
  }
  if (target === 'PAUSED' && workOrder.status !== 'PAUSED') {
    patch.pausedFrom = workOrder.status;
  }
  await repo.updateWorkOrder(event.workOrderId, patch);
}

async function applyEventSpecific(repo: Repository, event: IndexedHubEvent): Promise<void> {
  const data = dataOf(event);
  if (event.name === 'passport_minted' && event.assetId && typeof data.tokenId === 'string') {
    await repo.updateAsset(event.assetId, { passportTokenId: data.tokenId });
  }
  if (event.name === 'work_order_refunded' && event.workOrderId && typeof data.paymentId === 'string') {
    const payment = await repo.getPayment(data.paymentId);
    if (payment) await repo.updatePayment(payment.id, { status: 'SUCCESS' });
  }
}

/**
 * Applies one hub event to the read model. The caller must enforce idempotency
 * (markEventProcessed inside the same transaction) before calling this.
 */
export async function applyEvent(repo: Repository, event: IndexedHubEvent): Promise<void> {
  const data = dataOf(event);
  await applySnapshots(repo, data);
  await applyStatusFallback(repo, event);
  await applyEventSpecific(repo, event);
}

function publicAsset(asset: AssetRecord): Record<string, unknown> {
  return {
    id: asset.id,
    publicDescription: asset.publicDescription,
    assetType: asset.assetType,
    publicLocation: asset.publicLocation,
    ...(asset.passportTokenId ? { passportTokenId: asset.passportTokenId } : {}),
    createdAt: asset.createdAt,
  };
}

/**
 * Public state snapshot for rebuild-equivalence tests. Private tables, demo
 * flags, audit history, id sequences and storage keys are excluded.
 */
export async function publicStateSnapshot(repo: Repository): Promise<Record<string, unknown>> {
  const assets = (await repo.listAssets()).sort((a, b) => a.id.localeCompare(b.id));
  const reports = (await repo.listReports()).sort((a, b) => a.id.localeCompare(b.id));
  const clusters = (await repo.listClusters()).sort((a, b) => a.id.localeCompare(b.id));
  const approvals = (await repo.listDaoApprovals()).sort((a, b) => a.id.localeCompare(b.id));
  const workOrders = (await repo.listWorkOrders()).sort((a, b) => a.id.localeCompare(b.id));
  const agents = (await repo.listAgents()).sort((a, b) => `${a.account}:${a.role}`.localeCompare(`${b.account}:${b.role}`));
  const triage = [];
  for (const report of reports) triage.push(...(await repo.listTriageSuggestions(report.id)));
  triage.sort((a, b) => a.id.localeCompare(b.id));

  const workOrderState = [];
  for (const workOrder of workOrders) {
    const [commitments, reveals, scores, evidence, inspections, escrow, payments, warranties, commands] = await Promise.all([
      repo.listBidCommitments(workOrder.id),
      repo.listBidReveals(workOrder.id),
      repo.listScoreExecutions(workOrder.id),
      repo.listEvidencePackages(workOrder.id),
      repo.listInspections(workOrder.id),
      repo.getEscrow(workOrder.id),
      repo.listPayments(workOrder.id),
      repo.listWarrantyCases(workOrder.id),
      repo.listChainCommands(workOrder.id),
    ]);
    const attestations = [];
    for (const score of scores) {
      attestations.push(...(await repo.listAttestationsBySubject(score.outputHash)));
    }
    workOrderState.push({
      workOrder,
      commitments,
      reveals,
      scores,
      evidence,
      inspections,
      escrow,
      payments,
      warranties,
      commands,
      attestations,
    });
  }

  return {
    assets: assets.map(publicAsset),
    reports: reports.map((report) => ({
      id: report.id,
      assetId: report.assetId,
      description: report.description,
      publicLocation: report.publicLocation,
      ...(report.redactedMediaHash ? { redactedMediaHash: report.redactedMediaHash } : {}),
      ...(report.perceptualHash ? { perceptualHash: report.perceptualHash } : {}),
      exifStripped: report.exifStripped,
      status: report.status,
      ...(report.clusterId ? { clusterId: report.clusterId } : {}),
      createdAt: report.createdAt,
      source: report.source,
    })),
    clusters,
    approvals,
    workOrderState,
    agents,
    triage,
  };
}

export async function publicStateHash(repo: Repository): Promise<string> {
  return sha256Hex(stableStringify(stripUndefined(await publicStateSnapshot(repo))));
}

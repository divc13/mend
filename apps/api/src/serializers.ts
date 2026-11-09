import { REPLAY_LABEL } from '@mend/protocol';
import type {
  AgentRecord,
  AssetRecord,
  AttestationRecord,
  BidCommitmentRecord,
  BidRevealRecord,
  ChainCommandRecord,
  EscrowRecord,
  EvidenceObjectRecord,
  EvidencePackageRecord,
  InspectionRecord,
  PaymentRecord,
  ReportClusterRecord,
  ReportPrivateRecord,
  ReportRecord,
  ScoreExecutionRecord,
  TriageSuggestionRecord,
  WarrantyCaseRecord,
  WorkOrderRecord,
} from '@mend/db';

export function assetView(asset: AssetRecord): Record<string, unknown> {
  return {
    id: asset.id,
    publicDescription: asset.publicDescription,
    assetType: asset.assetType,
    publicLocation: asset.publicLocation,
    ...(asset.passportTokenId ? { passportTokenId: asset.passportTokenId } : {}),
    createdAt: asset.createdAt,
  };
}

export function reportView(report: ReportRecord, caseLink?: string): Record<string, unknown> {
  return {
    id: report.id,
    assetId: report.assetId,
    description: report.description,
    publicLocation: report.publicLocation,
    reporterCaseLink: caseLink ?? 'case_link_protected',
    ...(report.redactedMediaHash ? { redactedMediaHash: report.redactedMediaHash } : {}),
    ...(report.perceptualHash ? { perceptualHash: report.perceptualHash } : {}),
    exifStripped: report.exifStripped,
    status: report.status,
    ...(report.clusterId ? { clusterId: report.clusterId } : {}),
    createdAt: report.createdAt,
  };
}

export function reportPrivateView(record: ReportPrivateRecord): Record<string, unknown> {
  return {
    reportId: record.reportId,
    preciseLocation: record.preciseLocation ?? null,
    retentionUntil: record.retentionUntil ?? null,
    hasPrivateMedia: Boolean(record.privateMediaKey),
    privateMediaHash: record.privateMediaHash ?? null,
  };
}

export function clusterView(cluster: ReportClusterRecord): Record<string, unknown> {
  return {
    id: cluster.id,
    reportIds: cluster.reportIds,
    confidenceBps: cluster.confidenceBps,
    rationale: cluster.rationale,
    status: cluster.status,
    ...(cluster.confirmedBy ? { confirmedBy: cluster.confirmedBy } : {}),
    createdAt: cluster.createdAt,
  };
}

export function workOrderView(workOrder: WorkOrderRecord): Record<string, unknown> {
  return {
    id: workOrder.id,
    assetId: workOrder.assetId,
    reportClusterId: workOrder.reportClusterId,
    scopeHash: workOrder.scopeHash,
    daoApprovalId: workOrder.daoApprovalId,
    policyHash: workOrder.policyHash,
    budgetMicro: workOrder.budgetMicro,
    status: workOrder.status,
    mode: workOrder.mode,
    ...(workOrder.awardedBidId ? { awardedBidId: workOrder.awardedBidId } : {}),
    ...(workOrder.contractorId ? { contractorId: workOrder.contractorId } : {}),
    ...(workOrder.inspectorId ? { inspectorId: workOrder.inspectorId } : {}),
    ...(workOrder.sponsorId ? { sponsorId: workOrder.sponsorId } : {}),
    fundingToken: workOrder.fundingToken,
    ...(workOrder.fundingTxHash ? { fundingTxHash: workOrder.fundingTxHash } : {}),
    ...(workOrder.durabilityDueAt ? { durabilityDueAt: workOrder.durabilityDueAt } : {}),
    ...(workOrder.commitDeadline ? { commitDeadline: workOrder.commitDeadline } : {}),
    ...(workOrder.revealDeadline ? { revealDeadline: workOrder.revealDeadline } : {}),
    ...(workOrder.pausedFrom ? { pausedFrom: workOrder.pausedFrom } : {}),
    reopenCount: workOrder.reopenCount,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
  };
}

export function commitmentView(commitment: BidCommitmentRecord): Record<string, unknown> {
  return {
    workOrderId: commitment.workOrderId,
    bidId: commitment.bidId,
    contractorId: commitment.contractorId,
    commitmentHash: commitment.commitmentHash,
    committedAt: commitment.committedAt,
  };
}

export function revealView(reveal: BidRevealRecord): Record<string, unknown> {
  return {
    workOrderId: reveal.workOrderId,
    bidId: reveal.bidId,
    contractorId: reveal.contractorId,
    priceMicro: reveal.priceMicro,
    durationDays: reveal.durationDays,
    warrantyDays: reveal.warrantyDays,
    availableInDays: reveal.availableInDays,
    materials: reveal.materials,
    materialsScore: reveal.materialsScore,
    evidenceChecklistAccepted: reveal.evidenceChecklistAccepted,
    nonce: reveal.nonce,
    revealedAt: reveal.revealedAt,
    commitmentHash: reveal.commitmentHash,
  };
}

export function scoreView(score: ScoreExecutionRecord): Record<string, unknown> {
  return {
    id: score.id,
    workOrderId: score.workOrderId,
    policyHash: score.policyHash,
    wasmHash: score.wasmHash,
    inputHash: score.inputHash,
    outputHash: score.outputHash,
    ranking: score.ranking,
    ...(score.executionRef ? { executionRef: score.executionRef } : {}),
    verified: score.verified,
    ...(score.unavailableReason ? { unavailableReason: score.unavailableReason } : {}),
    createdAt: score.createdAt,
  };
}

export function evidencePackageView(
  pkg: EvidencePackageRecord,
  objects: EvidenceObjectRecord[] = [],
): Record<string, unknown> {
  return {
    id: pkg.id,
    workOrderId: pkg.workOrderId,
    kind: pkg.kind,
    evidenceHashes: pkg.evidenceHashes,
    checklist: pkg.checklist,
    redacted: true,
    submittedBy: pkg.submittedBy,
    submittedAt: pkg.submittedAt,
    objects: objects.map((object) => ({
      id: object.id,
      sha256: object.sha256,
      contentType: object.contentType,
      sizeBytes: object.sizeBytes,
      redacted: object.redacted,
    })),
  };
}

export function inspectionView(inspection: InspectionRecord): Record<string, unknown> {
  return {
    id: inspection.id,
    workOrderId: inspection.workOrderId,
    kind: inspection.kind,
    inspectorId: inspection.inspectorId,
    decision: inspection.decision,
    evidencePackageId: inspection.evidencePackageId,
    ...(inspection.notesHash ? { notesHash: inspection.notesHash } : {}),
    signedAt: inspection.signedAt,
    ...(inspection.txHash ? { txHash: inspection.txHash } : {}),
  };
}

export function escrowView(escrow: EscrowRecord): Record<string, unknown> {
  return {
    workOrderId: escrow.workOrderId,
    token: escrow.token,
    fundedMicro: escrow.fundedMicro,
    refundedMicro: escrow.refundedMicro,
    completionPaidMicro: escrow.completionPaidMicro,
    holdbackHeldMicro: escrow.holdbackHeldMicro,
    holdbackReleasedMicro: escrow.holdbackReleasedMicro,
  };
}

export function paymentView(payment: PaymentRecord): Record<string, unknown> {
  return {
    id: payment.id,
    workOrderId: payment.workOrderId,
    kind: payment.kind,
    amountMicro: payment.amountMicro,
    recipient: payment.recipient,
    status: payment.status,
    ...(payment.txHash ? { txHash: payment.txHash } : {}),
    ...(payment.releasedAt ? { releasedAt: payment.releasedAt } : {}),
    ...(payment.label ? { label: payment.label } : {}),
  };
}

export function warrantyView(warranty: WarrantyCaseRecord): Record<string, unknown> {
  return {
    id: warranty.id,
    workOrderId: warranty.workOrderId,
    failedInspectionId: warranty.failedInspectionId,
    state: warranty.state,
    openedAt: warranty.openedAt,
    ...(warranty.closedAt ? { closedAt: warranty.closedAt } : {}),
  };
}

export function chainCommandView(command: ChainCommandRecord): Record<string, unknown> {
  return {
    id: command.id,
    ...(command.workOrderId ? { workOrderId: command.workOrderId } : {}),
    action: command.action,
    method: command.method,
    args: command.args,
    state: command.state,
    mode: command.mode,
    adapter: command.adapter,
    ...(command.txHash ? { txHash: command.txHash } : {}),
    ...(command.errorCode ? { errorCode: command.errorCode } : {}),
    ...(command.errorMessage ? { errorMessage: command.errorMessage } : {}),
    realTransaction: command.realTransaction,
    label: command.realTransaction ? null : REPLAY_LABEL,
    createdAt: command.createdAt,
    updatedAt: command.updatedAt,
  };
}

export function triageView(suggestion: TriageSuggestionRecord): Record<string, unknown> {
  return {
    id: suggestion.id,
    reportId: suggestion.reportId,
    provider: suggestion.provider,
    ...(suggestion.model ? { model: suggestion.model } : {}),
    available: suggestion.available,
    ...(suggestion.confidenceBps !== undefined ? { confidenceBps: suggestion.confidenceBps } : {}),
    ...(suggestion.rationale ? { rationale: suggestion.rationale } : {}),
    duplicateCandidates: suggestion.duplicateCandidates,
    ...(suggestion.scope ? { scope: suggestion.scope } : {}),
    ...(suggestion.attestationId ? { attestationId: suggestion.attestationId } : {}),
    ...(suggestion.unavailableReason ? { unavailableReason: suggestion.unavailableReason } : {}),
    createdAt: suggestion.createdAt,
  };
}

export function agentView(agent: AgentRecord): Record<string, unknown> {
  return {
    account: agent.account,
    role: agent.role,
    keyKind: agent.keyKind,
    allowedReceiver: agent.allowedReceiver,
    allowedMethods: agent.allowedMethods,
    ...(agent.allowanceMicro ? { allowanceMicro: agent.allowanceMicro } : {}),
    canReleaseEscrow: false,
    label: agent.label,
  };
}

export function attestationView(attestation: AttestationRecord, verified: boolean): Record<string, unknown> {
  return {
    id: attestation.id,
    kind: attestation.kind,
    subjectHash: attestation.subjectHash,
    evidence: attestation.artifact,
    ...(attestation.signature ? { signature: attestation.signature } : {}),
    verified,
    artifactHash: attestation.artifactHash,
    ...(attestation.unavailableReason ? { unavailableReason: attestation.unavailableReason } : {}),
    createdAt: attestation.createdAt,
  };
}

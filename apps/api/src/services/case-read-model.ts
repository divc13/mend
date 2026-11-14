import {
  REPLAY_LABEL,
  policyHash,
  scoreBids,
  sha256Hex,
  stableStringify,
  type WorkOrderMode,
  type WorkOrderState,
} from '@mend/protocol';
import type {
  AssetRecord,
  AttestationRecord,
  AuditEventRecord,
  BidCommitmentRecord,
  BidRevealRecord,
  DaoApprovalRecord,
  EscrowRecord,
  EvidencePackageRecord,
  IntentExecutionRecord,
  IntentQuoteRecord,
  ReportClusterRecord,
  ReportRecord,
  Repository,
  ScoreExecutionRecord,
  WarrantyCaseRecord,
  WorkOrderRecord,
} from '@mend/db';
import type { AppConfig } from '../config.js';
import {
  clusterView,
  commitmentView,
  daoApprovalView,
  escrowView,
  inspectionView,
  paymentView,
  reportView,
  revealView,
  warrantyView,
  workOrderView,
} from '../serializers.js';

export interface CaseReadDeps {
  repo: Repository;
  config: AppConfig;
}

export interface DimensionWeightsBps {
  price: number;
  warranty: number;
  duration: number;
  materials: number;
}

export interface PublicAssetView {
  id: string;
  publicDescription: string;
  assetType: AssetRecord['assetType'];
  publicLocation: AssetRecord['publicLocation'];
  passportTokenId?: string;
  createdAt: string;
  transferable: false;
  owner?: string;
  ownerNote?: string;
}

export interface CaseSummary {
  id: string;
  assetId: string;
  title: string;
  summary: string;
  status: WorkOrderState;
  mode: WorkOrderMode;
  budgetMicro: string;
  winningBidMicro?: string;
  refundMicro?: string;
  completionPaymentMicro?: string;
  holdbackMicro?: string;
  scopeHash: string;
  policyHash: string;
  contractorId?: string;
  inspectorId?: string;
  fundingToken: string;
  fundingTxHash?: string;
  durabilityDueAt?: string;
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  reportCount: number;
  evidenceCount: number;
  asset?: PublicAssetView;
  labels?: Record<string, string>;
}

export interface CaseBundleView extends CaseSummary {
  scope: string;
  /** Full public work-order view, including deadlines and pausedFrom. */
  workOrder: Record<string, unknown>;
  daoApproval?: Record<string, unknown>;
  policyVersion: string;
  policyWeightsBps: DimensionWeightsBps;
  reports: Record<string, unknown>[];
  cluster?: Record<string, unknown>;
  commitments: Record<string, unknown>[];
  reveals: Record<string, unknown>[];
  score?: Record<string, unknown>;
  evidence: Record<string, unknown>[];
  inspections: Record<string, unknown>[];
  escrow: Record<string, unknown>;
  payments: Record<string, unknown>[];
  warranty?: Record<string, unknown>;
  warranties?: Record<string, unknown>[];
  attestations: Record<string, unknown>[];
  events: Record<string, unknown>[];
  intent?: Record<string, unknown>;
  /** Fields that are absent or intentionally represented by a placeholder/label. */
  unavailable: string[];
}

interface CaseCore {
  workOrder: WorkOrderRecord;
  asset: AssetRecord | null;
  approval: DaoApprovalRecord | null;
  cluster: ReportClusterRecord | null;
  reports: ReportRecord[];
  evidence: EvidencePackageRecord[];
  escrow: EscrowRecord | null;
  reveals: BidRevealRecord[];
}

const REVEAL_VISIBLE_STATES = new Set<WorkOrderState>([
  'BIDDING_REVEAL',
  'SCORED',
  'AWARDED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED',
  'DURABILITY_PENDING',
  'CLOSED',
  'WARRANTY_REOPENED',
  'DISPUTED',
]);

const SCOPE_UNAVAILABLE =
  'Unavailable: the public read model stores only scopeHash; the approved scope text is not persisted.';

const EVENT_COPY: Record<string, { kind: string; title: string; detail?: string }> = {
  report_submitted: { kind: 'report', title: 'Report submitted' },
  report_updated: { kind: 'report', title: 'Report updated' },
  report_triaged: { kind: 'triage', title: 'Report triaged' },
  report_cluster_suggested: { kind: 'triage', title: 'Duplicate cluster suggested' },
  report_cluster_confirmed: { kind: 'triage', title: 'Duplicate cluster confirmed' },
  report_cluster_rejected: { kind: 'triage', title: 'Duplicate cluster rejected' },
  report_cluster_updated: { kind: 'triage', title: 'Duplicate cluster updated' },
  policy_approved: { kind: 'policy', title: 'DAO policy approved' },
  work_order_created: { kind: 'work', title: 'Work order created' },
  work_order_funded: { kind: 'funding', title: 'Work order funded' },
  bidding_opened: { kind: 'bid', title: 'Bidding opened' },
  bidding_closed: { kind: 'bid', title: 'Bidding closed' },
  bid_committed: { kind: 'bid', title: 'Bid commitment recorded' },
  bid_revealed: { kind: 'bid', title: 'Bid revealed' },
  score_recorded: { kind: 'score', title: 'Deterministic score recorded' },
  work_order_awarded: { kind: 'award', title: 'Work order awarded' },
  work_started: { kind: 'work', title: 'Contractor started work' },
  completion_submitted: { kind: 'evidence', title: 'Completion evidence submitted' },
  completion_accepted: { kind: 'inspection', title: 'Completion accepted by inspector' },
  inspection_signed: { kind: 'inspection', title: 'Inspection decision recorded' },
  durability_passed: { kind: 'inspection', title: 'Durability inspection passed' },
  durability_inspection_recorded: { kind: 'inspection', title: 'Durability inspection recorded' },
  warranty_reopened: { kind: 'warranty', title: 'Warranty case opened' },
  payment_recorded: { kind: 'payment', title: 'Payment recorded' },
  payment_released: { kind: 'payment', title: 'Payment released' },
  dispute_opened: { kind: 'dispute', title: 'Dispute opened' },
  dispute_resolved: { kind: 'dispute', title: 'Dispute resolved' },
  work_order_cancelled: { kind: 'close', title: 'Work order cancelled' },
  work_order_refunded: { kind: 'payment', title: 'Work order refunded' },
  contract_paused: { kind: 'work', title: 'Contract paused' },
  contract_unpaused: { kind: 'work', title: 'Contract unpaused' },
  evidence_submitted: { kind: 'evidence', title: 'Evidence package submitted' },
};

function microOrZero(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function activePolicy(config: AppConfig): { version: string; weightsBps: DimensionWeightsBps } {
  return {
    version: config.scoring.version,
    weightsBps: {
      price: config.scoring.weightsBps.price,
      warranty: config.scoring.weightsBps.warranty,
      duration: config.scoring.weightsBps.duration,
      materials: config.scoring.weightsBps.materials,
    },
  };
}

function publicAssetView(asset: AssetRecord, approval: DaoApprovalRecord | null): PublicAssetView {
  return {
    id: asset.id,
    publicDescription: asset.publicDescription,
    assetType: asset.assetType,
    publicLocation: asset.publicLocation,
    ...(asset.passportTokenId ? { passportTokenId: asset.passportTokenId } : {}),
    createdAt: asset.createdAt,
    transferable: false,
    ...(approval
      ? {
          owner: approval.daoAccount,
          ownerNote:
            'The passport is held by the DAO/protocol for maintenance history. It is not legal ownership of the physical asset.',
        }
      : {}),
  };
}

function winnerReveal(workOrder: WorkOrderRecord, reveals: BidRevealRecord[]): BidRevealRecord | undefined {
  if (!workOrder.awardedBidId) return undefined;
  return reveals.find((reveal) => reveal.bidId === workOrder.awardedBidId);
}

function escrowAmounts(escrow: EscrowRecord | null): {
  refundMicro?: string;
  completionPaymentMicro?: string;
  holdbackMicro?: string;
} {
  if (!escrow) return {};
  return {
    refundMicro: escrow.refundedMicro,
    completionPaymentMicro: escrow.completionPaidMicro,
    holdbackMicro: (
      microOrZero(escrow.holdbackHeldMicro) + microOrZero(escrow.holdbackReleasedMicro)
    ).toString(),
  };
}

async function loadCaseCore(repo: Repository, workOrder: WorkOrderRecord): Promise<CaseCore> {
  const revealsVisible = REVEAL_VISIBLE_STATES.has(workOrder.status);
  const [asset, approval, cluster, escrow, reports, evidence, reveals] = await Promise.all([
    repo.getAsset(workOrder.assetId),
    repo.getDaoApproval(workOrder.daoApprovalId),
    repo.getCluster(workOrder.reportClusterId),
    repo.getEscrow(workOrder.id),
    repo.listReports({ assetId: workOrder.assetId, clusterId: workOrder.reportClusterId }),
    repo.listEvidencePackages(workOrder.id),
    revealsVisible ? repo.listBidReveals(workOrder.id) : Promise.resolve([] as BidRevealRecord[]),
  ]);
  return { workOrder, asset, approval, cluster, reports, evidence, escrow, reveals };
}

function summaryFromCore(core: CaseCore): CaseSummary {
  const { workOrder } = core;
  const labels: Record<string, string> = {};
  const firstReport = core.reports[0];
  const title = core.asset?.publicDescription ?? workOrder.id;
  const summary = firstReport?.description ?? '';

  labels.title = core.asset
    ? 'Derived from asset.publicDescription; the read model stores no separate case title.'
    : 'No asset record is linked to this work order; the work order id is used as the title.';
  labels.summary = firstReport
    ? 'Derived from the first clustered report description; the read model stores no separate case summary.'
    : 'No clustered report description is available for this work order.';

  const winner = winnerReveal(workOrder, core.reveals);
  if (workOrder.awardedBidId && !winner) {
    labels.winningBidMicro =
      'The work order references an awarded bid, but its public reveal is not available.';
  }

  return {
    id: workOrder.id,
    assetId: workOrder.assetId,
    title,
    summary,
    status: workOrder.status,
    mode: workOrder.mode,
    budgetMicro: workOrder.budgetMicro,
    ...(winner ? { winningBidMicro: winner.priceMicro } : {}),
    ...escrowAmounts(core.escrow),
    scopeHash: workOrder.scopeHash,
    policyHash: workOrder.policyHash,
    ...(workOrder.contractorId ? { contractorId: workOrder.contractorId } : {}),
    ...(workOrder.inspectorId ? { inspectorId: workOrder.inspectorId } : {}),
    fundingToken: workOrder.fundingToken,
    ...(workOrder.fundingTxHash ? { fundingTxHash: workOrder.fundingTxHash } : {}),
    ...(workOrder.durabilityDueAt ? { durabilityDueAt: workOrder.durabilityDueAt } : {}),
    reopenCount: workOrder.reopenCount,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
    reportCount: core.reports.length,
    evidenceCount: core.evidence.length,
    ...(core.asset ? { asset: publicAssetView(core.asset, core.approval) } : {}),
    labels,
  };
}

export async function buildCaseSummary(deps: CaseReadDeps, workOrder: WorkOrderRecord): Promise<CaseSummary> {
  return summaryFromCore(await loadCaseCore(deps.repo, workOrder));
}

export async function buildCaseSummaries(
  deps: CaseReadDeps,
  workOrders: WorkOrderRecord[],
): Promise<CaseSummary[]> {
  return Promise.all(workOrders.map((workOrder) => buildCaseSummary(deps, workOrder)));
}

function escrowBundleView(
  workOrder: WorkOrderRecord,
  escrow: EscrowRecord | null,
  labels: Record<string, string>,
  unavailable: string[],
): Record<string, unknown> {
  if (!escrow) {
    unavailable.push('escrow');
    labels.escrow = 'No escrow record exists for this work order; zero values are placeholders.';
    return {
      workOrderId: workOrder.id,
      token: workOrder.fundingToken,
      fundedMicro: '0',
      refundedMicro: '0',
      completionPaidMicro: '0',
      holdbackHeldMicro: '0',
      holdbackReleasedMicro: '0',
      label: 'NO_ESCROW_RECORD',
    };
  }

  const escrowed =
    microOrZero(escrow.fundedMicro) -
    microOrZero(escrow.refundedMicro) -
    microOrZero(escrow.completionPaidMicro) -
    microOrZero(escrow.holdbackHeldMicro) -
    microOrZero(escrow.holdbackReleasedMicro);

  return {
    ...escrowView(escrow),
    ...(escrowed > 0n ? { escrowedMicro: escrowed.toString() } : {}),
  };
}

function evidenceBundleView(pkg: EvidencePackageRecord): Record<string, unknown> {
  return {
    id: pkg.id,
    workOrderId: pkg.workOrderId,
    kind: pkg.kind,
    evidenceHashes: pkg.evidenceHashes,
    checklist: Object.entries(pkg.checklist).map(([label, complete]) => ({ label, complete })),
    redacted: true,
    submittedBy: pkg.submittedBy,
    submittedAt: pkg.submittedAt,
  };
}

function warrantyBundleView(warranty: WarrantyCaseRecord): Record<string, unknown> {
  return {
    ...warrantyView(warranty),
    note: 'Unavailable: warranty notes are not stored in the public read model.',
  };
}

function scoreBundleView(input: {
  score: ScoreExecutionRecord;
  reveals: BidRevealRecord[];
  commitments: BidCommitmentRecord[];
  approval: DaoApprovalRecord | null;
  config: AppConfig;
}): { view: Record<string, unknown>; dimensionsAvailable: boolean } {
  const policy = activePolicy(input.config);
  const expectedPolicyHash = policyHash(policy);
  const revealByBid = new Map(input.reveals.map((reveal) => [reveal.bidId, reveal]));
  const approval = input.approval;

  let derivedDimensions: Map<string, DimensionWeightsBps> | undefined;
  if (input.score.policyHash === expectedPolicyHash && approval) {
    try {
      const inputs = input.reveals.map((reveal) => ({
        bidId: reveal.bidId,
        contractorId: reveal.contractorId,
        priceMicro: reveal.priceMicro,
        durationDays: reveal.durationDays,
        warrantyDays: reveal.warrantyDays,
        materialsScore: reveal.materialsScore,
        eligible:
          approval.contractorRoster.includes(reveal.contractorId) &&
          input.commitments.some(
            (commitment) =>
              commitment.bidId === reveal.bidId && commitment.contractorId === reveal.contractorId,
          ),
      }));
      const result = scoreBids(inputs, policy);
      const matches =
        result.ranking.length === input.score.ranking.length &&
        result.ranking.every((bid, index) => {
          const stored = input.score.ranking[index];
          return (
            stored !== undefined &&
            stored.rank === bid.rank &&
            stored.bidId === bid.bidId &&
            stored.contractorId === bid.contractorId &&
            stored.scoreBps === bid.scoreBps
          );
        });
      if (matches) {
        derivedDimensions = new Map(result.ranking.map((bid) => [bid.bidId, bid.dimensionsBps]));
      }
    } catch {
      // A stale or partial read model must not make the public case endpoint fail.
      derivedDimensions = undefined;
    }
  }

  let dimensionsAvailable = true;
  const ranking = input.score.ranking.map((entry) => {
    const reveal = revealByBid.get(entry.bidId);
    if (!reveal) {
      dimensionsAvailable = false;
      return {
        rank: entry.rank,
        bidId: entry.bidId,
        contractorId: entry.contractorId,
        scoreBps: entry.scoreBps,
      };
    }
    const dimensions = derivedDimensions?.get(entry.bidId);
    if (!dimensions) dimensionsAvailable = false;
    return {
      rank: entry.rank,
      bidId: entry.bidId,
      contractorId: entry.contractorId,
      scoreBps: entry.scoreBps,
      ...(dimensions ? { dimensions } : {}),
      priceMicro: reveal.priceMicro,
      durationDays: reveal.durationDays,
      warrantyDays: reveal.warrantyDays,
      availableInDays: reveal.availableInDays,
      materialsScore: reveal.materialsScore,
    };
  });

  return {
    view: {
      id: input.score.id,
      workOrderId: input.score.workOrderId,
      policyHash: input.score.policyHash,
      policyVersion: policy.version,
      weightsBps: policy.weightsBps,
      wasmHash: input.score.wasmHash,
      inputHash: input.score.inputHash,
      outputHash: input.score.outputHash,
      ranking,
      verified: input.score.verified,
      ...(input.score.unavailableReason ? { unavailableReason: input.score.unavailableReason } : {}),
      ...(input.score.executionRef ? { executionRef: input.score.executionRef } : {}),
      createdAt: input.score.createdAt,
    },
    dimensionsAvailable,
  };
}

function intentBundleView(
  quote: IntentQuoteRecord,
  executions: IntentExecutionRecord[],
  labels: Record<string, string>,
): Record<string, unknown> {
  const execution = [...executions]
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .at(-1);

  if (quote.feesUsd === undefined) {
    labels['intent.feesUsd'] = 'The stored quote did not include a fee amount.';
  }
  if (!quote.depositAddress) {
    labels['intent.depositAddress'] = 'No deposit address is stored for this quote.';
  }
  if (!quote.depositMemo) {
    labels['intent.depositMemo'] = 'No deposit memo is stored for this quote.';
  }
  if (!quote.deadline) {
    labels['intent.deadline'] = 'No quote deadline is stored.';
  }

  return {
    id: quote.id,
    dry: quote.dry,
    srcChain: quote.srcChain,
    srcAsset: quote.srcAsset,
    dstChain: 'near',
    dstAsset: quote.dstAsset,
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
    ...(quote.feesUsd !== undefined ? { feesUsd: quote.feesUsd } : {}),
    recipient: quote.recipient,
    ...(quote.depositAddress ? { depositAddress: quote.depositAddress } : {}),
    ...(quote.depositMemo ? { depositMemo: quote.depositMemo } : {}),
    ...(quote.deadline ? { deadline: quote.deadline } : {}),
    status: execution?.status ?? quote.status,
    ...(execution?.destinationTxHash ? { destinationTxHash: execution.destinationTxHash } : {}),
    ...(execution?.explorerUrl ? { explorerUrl: execution.explorerUrl } : {}),
    updatedAt: execution?.updatedAt ?? quote.createdAt,
  };
}

function caseAttestationView(attestation: AttestationRecord): Record<string, unknown> {
  const integrity = sha256Hex(stableStringify(attestation.artifact)) === attestation.artifactHash;
  const artifactKind =
    typeof attestation.artifact.kind === 'string' ? attestation.artifact.kind : undefined;
  const label = artifactKind
    ? artifactKind.replace(/_/g, ' ')
    : `${attestation.kind.replace(/_/g, ' ')} attestation`;
  const detail =
    artifactKind === 'LOCAL_DETERMINISTIC_SCORE'
      ? 'Local deterministic integer score artifact. Not an OutLayer execution or a signature-backed claim.'
      : (attestation.unavailableReason ??
        `${attestation.kind.replace(/_/g, ' ')} artifact recorded. Re-hashed on read; modified artifacts fail verification.`);

  return {
    id: attestation.id,
    kind: attestation.kind,
    label,
    subjectHash: attestation.subjectHash,
    verified: integrity && attestation.verified,
    ...(attestation.unavailableReason ? { unavailableReason: attestation.unavailableReason } : {}),
    detail,
    ...(attestation.signature ? { signature: attestation.signature } : {}),
    createdAt: attestation.createdAt,
    artifactHash: attestation.artifactHash,
  };
}

function mergeAttestations(...groups: AttestationRecord[][]): AttestationRecord[] {
  const byId = new Map<string, AttestationRecord>();
  for (const group of groups) {
    for (const attestation of group) byId.set(attestation.id, attestation);
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function loadAttestations(
  repo: Repository,
  subjectHashes: string[],
): Promise<AttestationRecord[]> {
  const unique = [...new Set(subjectHashes.filter((hash) => Boolean(hash)))];
  const groups = await Promise.all(unique.map((hash) => repo.listAttestationsBySubject(hash)));
  return mergeAttestations(...groups);
}

async function loadTriageAttestations(
  repo: Repository,
  reports: ReportRecord[],
): Promise<AttestationRecord[]> {
  const suggestionGroups = await Promise.all(
    reports.map((report) => repo.listTriageSuggestions(report.id)),
  );
  const attestationIds = new Set<string>();
  for (const suggestions of suggestionGroups) {
    for (const suggestion of suggestions) {
      if (suggestion.attestationId) attestationIds.add(suggestion.attestationId);
    }
  }
  const records = await Promise.all(
    [...attestationIds].map((attestationId) => repo.getAttestation(attestationId)),
  );
  return records.filter((attestation): attestation is AttestationRecord => Boolean(attestation));
}

function eventCopy(event: AuditEventRecord): { kind: string; title: string; detail?: string } {
  const mapped = EVENT_COPY[event.name];
  if (mapped) return mapped;
  if (event.name.startsWith('chain_command_')) {
    const state = event.name.slice('chain_command_'.length).toUpperCase();
    const action =
      typeof event.data.action === 'string' ? event.data.action.replace(/_/g, ' ') : 'chain action';
    return {
      kind: 'work',
      title: `${action} — ${state.toLowerCase()}`,
      detail: `Chain command recorded by ${event.actor}.`,
    };
  }
  return { kind: 'work', title: event.name.replace(/_/g, ' ') };
}

function eventDetail(event: AuditEventRecord): string {
  const data = event.data;
  const bits: string[] = [];
  if (typeof data.amountMicro === 'string') bits.push(`amount ${data.amountMicro} micro`);
  if (typeof data.reportId === 'string') bits.push(`report ${data.reportId}`);
  if (typeof data.clusterId === 'string') bits.push(`cluster ${data.clusterId}`);
  if (typeof data.bidId === 'string') bits.push(`bid ${data.bidId}`);
  if (typeof data.contractorId === 'string') bits.push(`contractor ${data.contractorId}`);
  if (typeof data.inspectionId === 'string') bits.push(`inspection ${data.inspectionId}`);
  if (typeof data.evidenceId === 'string') bits.push(`evidence ${data.evidenceId}`);
  if (typeof data.paymentId === 'string') bits.push(`payment ${data.paymentId}`);
  if (typeof data.reopenCount === 'number') bits.push(`reopen count ${data.reopenCount}`);
  return bits.join(' · ');
}

function eventEvidence(
  event: AuditEventRecord,
  config: AppConfig,
): Array<Record<string, unknown>> | undefined {
  const evidence: Array<Record<string, unknown>> = [];
  const txHashes = new Set<string>();
  if (typeof event.data.txHash === 'string') txHashes.add(event.data.txHash);
  if (Array.isArray(event.data.txHashes)) {
    for (const value of event.data.txHashes) {
      if (typeof value === 'string') txHashes.add(value);
    }
  }
  for (const txHash of txHashes) {
    const replay = txHash.startsWith('replay:');
    evidence.push({
      label: replay ? REPLAY_LABEL : 'NEAR testnet transaction',
      kind: 'TX',
      value: txHash,
      ...(replay || config.chain.network !== 'testnet'
        ? {}
        : {
            href: `https://explorer.testnet.near.org/transactions/${encodeURIComponent(txHash)}`,
          }),
    });
  }
  if (typeof event.data.evidenceHash === 'string') {
    evidence.push({ label: 'Evidence hash', kind: 'HASH', value: event.data.evidenceHash });
  }
  if (typeof event.data.outputHash === 'string') {
    evidence.push({ label: 'Score output hash', kind: 'HASH', value: event.data.outputHash });
  }
  return evidence.length > 0 ? evidence : undefined;
}

function auditEventView(event: AuditEventRecord, config: AppConfig): Record<string, unknown> {
  const copy = eventCopy(event);
  const title =
    event.name === 'durability_inspection_recorded' && event.data.passed === false
      ? 'Durability inspection failed'
      : copy.title;
  const detail = [copy.detail, eventDetail(event)].filter(Boolean).join(' · ');
  const evidence = eventEvidence(event, config);
  return {
    id: event.id,
    at: event.at,
    title,
    detail,
    actor: event.actor,
    kind: copy.kind,
    ...(evidence ? { evidence } : {}),
  };
}

export async function buildCaseBundle(
  deps: CaseReadDeps,
  workOrder: WorkOrderRecord,
): Promise<CaseBundleView> {
  const core = await loadCaseCore(deps.repo, workOrder);
  const [
    commitments,
    score,
    inspections,
    payments,
    warranties,
    workOrderAudits,
    assetAudits,
    quotes,
    executions,
  ] = await Promise.all([
    deps.repo.listBidCommitments(workOrder.id),
    deps.repo.getLatestScoreExecution(workOrder.id),
    deps.repo.listInspections(workOrder.id),
    deps.repo.listPayments(workOrder.id),
    deps.repo.listWarrantyCases(workOrder.id),
    deps.repo.listAudit({ workOrderId: workOrder.id }),
    deps.repo.listAudit({ assetId: workOrder.assetId }),
    deps.repo.listIntentQuotes(),
    deps.repo.listIntentExecutions(workOrder.id),
  ]);

  const reportIds = new Set(core.reports.map((report) => report.id));
  const auditsById = new Map<string, AuditEventRecord>();
  for (const event of [...workOrderAudits, ...assetAudits]) {
    if (event.workOrderId && event.workOrderId !== workOrder.id) continue;
    if (!event.workOrderId) {
      const reportId = typeof event.data.reportId === 'string' ? event.data.reportId : undefined;
      const clusterId = typeof event.data.clusterId === 'string' ? event.data.clusterId : undefined;
      if (reportId) {
        if (!reportIds.has(reportId)) continue;
      } else if (clusterId) {
        if (clusterId !== workOrder.reportClusterId) continue;
      } else {
        continue;
      }
    }
    auditsById.set(event.id, event);
  }
  const audits = [...auditsById.values()].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );

  const summary = summaryFromCore(core);
  const labels: Record<string, string> = { ...(summary.labels ?? {}) };
  const unavailable: string[] = ['scope'];
  labels.scope = SCOPE_UNAVAILABLE;

  const policy = activePolicy(deps.config);
  const policyMatches = workOrder.policyHash === policyHash(policy);
  if (!policyMatches) {
    labels.policyVersion =
      'The API active scoring policy version is shown; this work order stores a different policyHash.';
    labels.policyWeightsBps =
      'The API active scoring policy weights are shown; this work order stores a different policyHash.';
  }

  let scoreView: Record<string, unknown> | undefined;
  if (score) {
    const result = scoreBundleView({
      score,
      reveals: core.reveals,
      commitments,
      approval: core.approval,
      config: deps.config,
    });
    scoreView = result.view;
    if (!result.dimensionsAvailable) {
      labels['score.ranking[].dimensions'] =
        'Dimension scores could not be re-derived from the public reveal set; only stored rank/score fields are shown.';
      unavailable.push('score.ranking[].dimensions');
    }
  } else {
    labels.score = 'Scoring has not run for this work order.';
  }

  if (!REVEAL_VISIBLE_STATES.has(workOrder.status)) {
    labels.reveals = 'Bid reveal values are sealed until bidding closes.';
    unavailable.push('reveals');
  }

  const escrow = escrowBundleView(workOrder, core.escrow, labels, unavailable);

  const latestWarranty = [...warranties]
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
    .at(-1);

  const linkedQuotes = quotes.filter((quote) => quote.workOrderId === workOrder.id);
  const latestQuote = [...linkedQuotes]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
  let intentView: Record<string, unknown> | undefined;
  if (latestQuote) {
    const linkedExecutions = executions.filter(
      (execution) => execution.quoteId === latestQuote.id,
    );
    intentView = intentBundleView(latestQuote, linkedExecutions, labels);
  } else {
    labels.intent = 'No NEAR Intents quote is linked to this work order.';
    unavailable.push('intent');
  }

  if (!score) unavailable.push('score');
  if (!core.cluster) {
    unavailable.push('cluster');
    labels.cluster = 'No report cluster is linked to this work order.';
  }
  if (!core.approval) {
    unavailable.push('daoApproval');
    labels.daoApproval = 'No DAO approval record is linked to this work order.';
  }
  if (!core.asset) {
    unavailable.push('asset');
    labels.asset = 'No asset record is linked to this work order.';
  }

  const subjectHashes: Array<string | undefined> = [
    workOrder.scopeHash,
    workOrder.policyHash,
    workOrder.fundingTxHash,
    ...core.reports.map((report) => report.redactedMediaHash),
    ...core.evidence.flatMap((pkg) => pkg.evidenceHashes),
    ...(score ? [score.outputHash, score.inputHash, score.wasmHash] : []),
    ...payments.map((payment) => payment.txHash),
    ...inspections.map((inspection) => inspection.txHash),
  ];
  const [subjectAttestations, triageAttestations] = await Promise.all([
    loadAttestations(
      deps.repo,
      subjectHashes.filter((hash): hash is string => Boolean(hash)),
    ),
    loadTriageAttestations(deps.repo, core.reports),
  ]);
  const attestations = mergeAttestations(subjectAttestations, triageAttestations);

  return {
    ...summary,
    scope: SCOPE_UNAVAILABLE,
    workOrder: workOrderView(workOrder),
    ...(core.approval ? { daoApproval: daoApprovalView(core.approval) } : {}),
    policyVersion: policy.version,
    policyWeightsBps: policy.weightsBps,
    reports: core.reports.map((report) => reportView(report)),
    ...(core.cluster ? { cluster: clusterView(core.cluster) } : {}),
    commitments: commitments.map(commitmentView),
    reveals: core.reveals.map(revealView),
    ...(scoreView ? { score: scoreView } : {}),
    evidence: core.evidence.map(evidenceBundleView),
    inspections: inspections.map(inspectionView),
    escrow,
    payments: payments.map(paymentView),
    ...(latestWarranty ? { warranty: warrantyBundleView(latestWarranty) } : {}),
    ...(warranties.length > 0 ? { warranties: warranties.map(warrantyBundleView) } : {}),
    attestations: attestations.map(caseAttestationView),
    events: audits.map((event) => auditEventView(event, deps.config)),
    ...(intentView ? { intent: intentView } : {}),
    labels,
    unavailable,
  };
}

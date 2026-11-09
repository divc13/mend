import {
  FIXTURE_ACCOUNTS,
  FIXTURE_ASSET_BENCH,
  FIXTURE_BID_INPUTS,
  FIXTURE_CLUSTER,
  FIXTURE_DAO_APPROVAL,
  FIXTURE_EXPECTED_RANKING,
  FIXTURE_IDS,
  FIXTURE_POLICY,
  FIXTURE_TIMESTAMPS,
  MendError,
  bidCommitmentHash,
  makeEvent,
  policyHash,
  sha256Hex,
  stableStringify,
  type EventName,
  type MendEvent,
} from '@mend/protocol';
import type {
  AttestationRecord,
  BidCommitmentRecord,
  BidRevealRecord,
  EscrowRecord,
  EvidencePackageRecord,
  InspectionRecord,
  PaymentRecord,
  ScoreExecutionRecord,
  WarrantyCaseRecord,
  WorkOrderRecord,
} from '@mend/db';

export interface IndexedHubEvent extends MendEvent {
  /** Stable content hash used for idempotency. */
  key: string;
  /** Source cursor for this event, e.g. evt-0007. */
  cursor: string;
}

export interface EventBatch {
  events: IndexedHubEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface HubEventSource {
  readonly name: string;
  readonly available: boolean;
  readonly unavailableReason?: string;
  fetch(cursor?: string | null): Promise<EventBatch>;
}

const H = (c: string) => c.repeat(64);

function indexed(
  name: EventName,
  data: Record<string, unknown>,
  meta: { workOrderId?: string; assetId?: string; actor?: string },
  timestamp: string,
  index: number,
): IndexedHubEvent {
  const event = makeEvent(name, data, { ...meta, timestamp });
  return {
    ...event,
    key: sha256Hex(stableStringify(event)),
    cursor: `evt-${String(index + 1).padStart(4, '0')}`,
  };
}

const BASE_WORK_ORDER: WorkOrderRecord = {
  id: FIXTURE_IDS.workOrder,
  assetId: FIXTURE_IDS.assetBench,
  reportClusterId: FIXTURE_IDS.cluster,
  scopeHash: 'c'.repeat(64),
  daoApprovalId: FIXTURE_DAO_APPROVAL.id,
  policyHash: policyHash(FIXTURE_POLICY),
  budgetMicro: '100000000',
  status: 'DRAFT',
  mode: 'REPLAY',
  fundingToken: FIXTURE_ACCOUNTS.token,
  reopenCount: 0,
  createdAt: FIXTURE_TIMESTAMPS.assetCreated,
  updatedAt: FIXTURE_TIMESTAMPS.assetCreated,
  isDemo: false,
};

function workOrder(patch: Partial<WorkOrderRecord>): WorkOrderRecord {
  return { ...BASE_WORK_ORDER, ...patch };
}

function escrow(patch: Partial<EscrowRecord>): EscrowRecord {
  return {
    workOrderId: FIXTURE_IDS.workOrder,
    token: FIXTURE_ACCOUNTS.token,
    fundedMicro: '100000000',
    refundedMicro: '0',
    completionPaidMicro: '0',
    holdbackHeldMicro: '0',
    holdbackReleasedMicro: '0',
    isDemo: false,
    ...patch,
  };
}

function payment(
  id: string,
  kind: PaymentRecord['kind'],
  amountMicro: string,
  recipient: string,
  createdAt: string,
  txHash: string,
): PaymentRecord {
  return {
    id,
    workOrderId: FIXTURE_IDS.workOrder,
    kind,
    amountMicro,
    recipient,
    status: 'SUCCESS',
    txHash,
    releasedAt: createdAt,
    label: 'REPLAY / SIMULATION',
    createdAt,
    isDemo: false,
  };
}

/**
 * Deterministic replay source covering a complete repair lifecycle. Event data
 * carries read-model snapshots so a rebuild from an empty database can
 * reproduce public state without reading any private table.
 */
export function replayEvents(): IndexedHubEvent[] {
  const meta = { workOrderId: FIXTURE_IDS.workOrder, assetId: FIXTURE_IDS.assetBench };
  const events: IndexedHubEvent[] = [];
  const push = (
    name: EventName,
    data: Record<string, unknown>,
    timestamp: string,
    actor: string,
    eventMeta: { workOrderId?: string; assetId?: string } = meta,
  ) => {
    events.push(indexed(name, data, { ...eventMeta, actor }, timestamp, events.length));
  };

  const draft = workOrder({});
  push('work_order_created', {
    asset: { ...FIXTURE_ASSET_BENCH, isDemo: false },
    cluster: { ...FIXTURE_CLUSTER, isDemo: false },
    daoApproval: { ...FIXTURE_DAO_APPROVAL, isDemo: false },
    workOrder: draft,
  }, FIXTURE_TIMESTAMPS.assetCreated, FIXTURE_ACCOUNTS.steward);

  const approved = workOrder({ status: 'POLICY_APPROVED', updatedAt: FIXTURE_TIMESTAMPS.policyApproved });
  push('policy_approved', { workOrder: approved }, FIXTURE_TIMESTAMPS.policyApproved, FIXTURE_ACCOUNTS.dao);

  const funded = workOrder({
    status: 'FUNDED',
    sponsorId: FIXTURE_ACCOUNTS.sponsor,
    fundingTxHash: 'replay:funding',
    updatedAt: FIXTURE_TIMESTAMPS.funded,
  });
  push('work_order_funded', {
    workOrder: funded,
    escrow: escrow({}),
  }, FIXTURE_TIMESTAMPS.funded, FIXTURE_ACCOUNTS.sponsor);

  const bidding = workOrder({
    status: 'BIDDING_OPEN',
    commitDeadline: FIXTURE_TIMESTAMPS.revealStart,
    revealDeadline: FIXTURE_TIMESTAMPS.revealEnd,
    updatedAt: FIXTURE_TIMESTAMPS.biddingOpen,
  });
  push('bidding_opened', { workOrder: bidding }, FIXTURE_TIMESTAMPS.biddingOpen, FIXTURE_ACCOUNTS.steward);

  for (const key of ['A', 'B', 'C'] as const) {
    const bid = FIXTURE_BID_INPUTS[key];
    const commitment: BidCommitmentRecord = {
      workOrderId: FIXTURE_IDS.workOrder,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      commitmentHash: bidCommitmentHash(bid),
      committedAt: FIXTURE_TIMESTAMPS.biddingOpen,
      isDemo: false,
    };
    push('bid_committed', { commitment }, FIXTURE_TIMESTAMPS.biddingOpen, bid.contractorId);
  }

  for (const key of ['A', 'B', 'C'] as const) {
    const bid = FIXTURE_BID_INPUTS[key];
    const reveal: BidRevealRecord = {
      workOrderId: FIXTURE_IDS.workOrder,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      priceMicro: bid.priceMicro,
      durationDays: bid.durationDays,
      warrantyDays: bid.warrantyDays,
      materials: key === 'B' ? 'Marine-grade stainless hardware and sealed timber' : 'Fixture materials',
      materialsScore: bid.materialsScore,
      availableInDays: bid.availableInDays,
      evidenceChecklistAccepted: bid.evidenceChecklistAccepted,
      nonce: bid.nonce,
      revealedAt: FIXTURE_TIMESTAMPS.revealStart,
      commitmentHash: bidCommitmentHash(bid),
      isDemo: false,
    };
    push('bid_revealed', { reveal }, FIXTURE_TIMESTAMPS.revealStart, bid.contractorId);
  }

  const revealPhase = workOrder({ status: 'BIDDING_REVEAL', updatedAt: FIXTURE_TIMESTAMPS.revealEnd });
  push('bidding_closed', { workOrder: revealPhase }, FIXTURE_TIMESTAMPS.revealEnd, FIXTURE_ACCOUNTS.steward);

  const outputHash = sha256Hex(stableStringify(FIXTURE_EXPECTED_RANKING));
  const score: ScoreExecutionRecord = {
    id: FIXTURE_IDS.scoreExecution,
    workOrderId: FIXTURE_IDS.workOrder,
    policyHash: policyHash(FIXTURE_POLICY),
    wasmHash: sha256Hex('mend-bid-rules-local-replay'),
    inputHash: sha256Hex('mend-score-input-replay'),
    outputHash,
    ranking: [...FIXTURE_EXPECTED_RANKING],
    executionRef: 'local-replay:indexer',
    verified: false,
    unavailableReason: 'Local deterministic replay; not an OutLayer execution.',
    createdAt: FIXTURE_TIMESTAMPS.scored,
    isDemo: false,
  };
  const scored = workOrder({ status: 'SCORED', updatedAt: FIXTURE_TIMESTAMPS.scored });
  const attestation: AttestationRecord = {
    id: 'ATT-0001',
    kind: 'LOCAL_REPLAY',
    subjectHash: outputHash,
    artifact: { kind: 'LOCAL_DETERMINISTIC_SCORE', ranking: FIXTURE_EXPECTED_RANKING, outlayerExecuted: false },
    artifactHash: outputHash,
    verified: true,
    unavailableReason: 'Local deterministic replay; not an OutLayer execution.',
    createdAt: FIXTURE_TIMESTAMPS.scored,
    isDemo: false,
  };
  push('score_recorded', { workOrder: scored, score, attestation }, FIXTURE_TIMESTAMPS.scored, FIXTURE_ACCOUNTS.steward);

  const awarded = workOrder({
    status: 'AWARDED',
    awardedBidId: FIXTURE_IDS.bidB,
    contractorId: FIXTURE_ACCOUNTS.contractorB,
    inspectorId: FIXTURE_ACCOUNTS.inspector,
    updatedAt: FIXTURE_TIMESTAMPS.awarded,
  });
  push('work_order_awarded', {
    workOrder: awarded,
    escrow: escrow({ refundedMicro: '20000000' }),
    payment: payment('PMT-0001', 'REFUND', '20000000', FIXTURE_ACCOUNTS.sponsor, FIXTURE_TIMESTAMPS.awarded, 'replay:refund'),
  }, FIXTURE_TIMESTAMPS.awarded, FIXTURE_ACCOUNTS.steward);

  const started = workOrder({ status: 'IN_PROGRESS', updatedAt: '2026-11-10T09:30:00.000Z' });
  push('work_started', { workOrder: started }, '2026-11-10T09:30:00.000Z', FIXTURE_ACCOUNTS.contractorB);

  const evidence: EvidencePackageRecord = {
    id: FIXTURE_IDS.evidenceCompletion,
    workOrderId: FIXTURE_IDS.workOrder,
    kind: 'COMPLETION',
    evidenceHashes: [H('e')],
    checklist: { beforePhoto: true, afterPhoto: true, materialsReceipt: true, safety: true },
    redacted: true,
    submittedBy: FIXTURE_ACCOUNTS.contractorB,
    submittedAt: FIXTURE_TIMESTAMPS.completionSubmitted,
    isDemo: false,
  };
  const completionSubmitted = workOrder({
    status: 'COMPLETION_SUBMITTED',
    updatedAt: FIXTURE_TIMESTAMPS.completionSubmitted,
  });
  push('completion_submitted', {
    workOrder: completionSubmitted,
    evidence,
  }, FIXTURE_TIMESTAMPS.completionSubmitted, FIXTURE_ACCOUNTS.contractorB);

  const completionInspection: InspectionRecord = {
    id: FIXTURE_IDS.inspectionCompletion,
    workOrderId: FIXTURE_IDS.workOrder,
    kind: 'COMPLETION',
    inspectorId: FIXTURE_ACCOUNTS.inspector,
    decision: 'APPROVED',
    evidencePackageId: FIXTURE_IDS.evidenceCompletion,
    notesHash: H('1'),
    signedAt: FIXTURE_TIMESTAMPS.completionAccepted,
    isDemo: false,
  };
  const durabilityPending = workOrder({
    status: 'DURABILITY_PENDING',
    durabilityDueAt: FIXTURE_TIMESTAMPS.durabilityDue,
    updatedAt: FIXTURE_TIMESTAMPS.completionAccepted,
  });
  const completionPayment = payment(
    'PMT-0002', 'COMPLETION', '72000000', FIXTURE_ACCOUNTS.contractorB,
    FIXTURE_TIMESTAMPS.completionAccepted, 'replay:completion',
  );
  push('completion_accepted', {
    workOrder: durabilityPending,
    inspection: completionInspection,
    payment: completionPayment,
    escrow: escrow({
      refundedMicro: '20000000',
      completionPaidMicro: '72000000',
      holdbackHeldMicro: '8000000',
    }),
  }, FIXTURE_TIMESTAMPS.completionAccepted, FIXTURE_ACCOUNTS.inspector);

  push('payment_released', {
    payment: completionPayment,
  }, FIXTURE_TIMESTAMPS.completionAccepted, 'chain-command-service');

  const durabilityInspection: InspectionRecord = {
    id: FIXTURE_IDS.inspectionDurability,
    workOrderId: FIXTURE_IDS.workOrder,
    kind: 'DURABILITY',
    inspectorId: FIXTURE_ACCOUNTS.inspector,
    decision: 'APPROVED',
    evidencePackageId: FIXTURE_IDS.evidenceCompletion,
    notesHash: H('2'),
    signedAt: FIXTURE_TIMESTAMPS.durabilityPassed,
    isDemo: false,
  };
  push('durability_inspection_recorded', {
    inspection: durabilityInspection,
  }, FIXTURE_TIMESTAMPS.durabilityPassed, FIXTURE_ACCOUNTS.inspector);

  const closed = workOrder({ status: 'CLOSED', updatedAt: FIXTURE_TIMESTAMPS.durabilityPassed });
  const holdbackPayment = payment(
    'PMT-0003', 'HOLDBACK', '8000000', FIXTURE_ACCOUNTS.contractorB,
    FIXTURE_TIMESTAMPS.durabilityPassed, 'replay:holdback',
  );
  push('durability_passed', {
    workOrder: closed,
    payment: holdbackPayment,
    escrow: escrow({
      refundedMicro: '20000000',
      completionPaidMicro: '72000000',
      holdbackHeldMicro: '0',
      holdbackReleasedMicro: '8000000',
    }),
  }, FIXTURE_TIMESTAMPS.durabilityPassed, FIXTURE_ACCOUNTS.inspector);

  return events;
}

export class ReplayHubEventSource implements HubEventSource {
  readonly name = 'replay';
  readonly available = true;

  constructor(private readonly events: IndexedHubEvent[] = replayEvents(), private readonly batchSize = 500) {}

  async fetch(cursor?: string | null): Promise<EventBatch> {
    const match = cursor ? /^evt-(\d+)$/.exec(cursor) : null;
    const start = match ? Number(match[1]) : 0;
    const batch = this.events.slice(start, start + this.batchSize);
    const end = start + batch.length;
    return {
      events: batch,
      nextCursor: batch.length > 0 ? `evt-${String(end).padStart(4, '0')}` : (cursor ?? null),
      hasMore: end < this.events.length,
      };
  }
}

/**
 * Live RPC event streaming is optional and disabled here. NEAR JSON-RPC does
 * not expose a generic "all contract EVENT_JSON logs since cursor" feed; it
 * requires an archival/log indexer or a deployed hub with a known block range.
 * The adapter refuses rather than inventing an endpoint.
 */
export class NearLiveRpcEventSource implements HubEventSource {
  readonly name = 'live-rpc';
  readonly available = false;
  readonly unavailableReason: string;

  constructor(rpcUrl?: string, hubAccount?: string) {
    this.unavailableReason = !rpcUrl || !hubAccount
      ? 'Live RPC indexing needs NEAR_RPC_URL and HUB_ACCOUNT; not configured.'
      : `Live RPC event streaming for ${hubAccount} is not activated in this wave. It needs a deployed hub, a block-range crawler and receipt-log decoding; no endpoint is invented.`;
  }

  async fetch(): Promise<EventBatch> {
    throw new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason, { source: this.name });
  }
}

export function createEventSource(env: NodeJS.ProcessEnv = process.env): HubEventSource {
  const source = (env.INDEXER_SOURCE ?? 'replay').toLowerCase();
  if (source === 'live-rpc' || source === 'live') {
    return new NearLiveRpcEventSource(env.NEAR_RPC_URL, env.HUB_ACCOUNT);
  }
  return new ReplayHubEventSource();
}

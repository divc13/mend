import type {
  Asset,
  AssetType,
  AttestationKind,
  AttestationView,
  BidCommitmentView,
  BidRevealView,
  CaseBundle,
  DaoApproval,
  DimensionScores,
  EscrowView,
  EvidencePackageView,
  InspectionView,
  IntentQuoteView,
  Mode,
  PaymentView,
  PublicLocation,
  Report,
  ReportCluster,
  ScoreView,
  ScoredBidView,
  TimelineEvent,
  TimelineKind,
  WarrantyView,
  WorkOrderState,
} from './types';
import { WORK_ORDER_STATES } from './types';
import { CASES, casesForAsset, getAsset, getCase } from './fixtures';

/**
 * Server-side read client for the public MEND API.
 *
 * This module is intentionally server-only: it reads MEND_API_BASE_URL and is
 * never imported by a Client Component. It makes no browser-visible call and
 * forwards no cookies, API keys or private evidence URLs.
 *
 * The public pages prefer `GET /v1/cases` / `GET /v1/cases/:id` when the API is
 * configured. If the endpoint is absent, unreachable, returns 404 or returns a
 * payload that does not match the public CaseBundle shape, the page falls back
 * to the frozen replay fixtures and labels the fallback.
 */

export type PublicDataSource = 'api' | 'fixture';

export interface CaseLoadResult {
  caseData: CaseBundle | undefined;
  source: PublicDataSource;
  apiConfigured: boolean;
  /** Human-readable reason when a fixture fallback is shown. */
  fallbackReason?: string;
}

export interface CasesLoadResult {
  cases: CaseBundle[];
  source: PublicDataSource;
  apiConfigured: boolean;
  fallbackReason?: string;
}

export interface AssetLoadResult {
  asset: Asset | undefined;
  cases: CaseBundle[];
  source: PublicDataSource;
  apiConfigured: boolean;
  fallbackReason?: string;
}

type JsonObject = Record<string, unknown>;

type ApiFailureReason = 'unconfigured' | 'not-found' | 'http' | 'unreachable' | 'invalid-response';

type ApiReadResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; reason: ApiFailureReason; message: string };

const ASSET_TYPES: readonly AssetType[] = ['bench', 'bicycle_rack', 'fence', 'door', 'playground', 'other'];
const MODES: readonly Mode[] = ['LIVE_TESTNET', 'MAINNET', 'REPLAY'];
const REPORT_STATES = ['SUBMITTED', 'TRIAGED', 'CLUSTERED', 'DUPLICATE', 'ACCEPTED'] as const;
const CLUSTER_STATES = ['SUGGESTED', 'CONFIRMED', 'REJECTED'] as const;
const DAO_STATES = ['PROPOSED', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
const EVIDENCE_KINDS = ['COMPLETION', 'REMEDIATION', 'DURABILITY'] as const;
const INSPECTION_KINDS = ['COMPLETION', 'DURABILITY', 'REMEDIATION'] as const;
const DECISIONS = ['APPROVED', 'REJECTED'] as const;
const PAYMENT_KINDS = ['COMPLETION', 'HOLDBACK', 'REFUND'] as const;
const PAYMENT_STATES = ['INTENT', 'PENDING', 'SUCCESS', 'FAILED'] as const;
const WARRANTY_STATES = ['OPEN', 'REMEDIATING', 'CLOSED'] as const;
const INTENT_STATES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'INCOMPLETE', 'EXPIRED'] as const;
const ATTESTATION_KINDS: readonly AttestationKind[] = [
  'NEAR_AI',
  'OUTLAYER',
  'DAO',
  'TRANSACTION',
  'HUMAN',
  'LOCAL_REPLAY',
];
const TIMELINE_KINDS: readonly TimelineKind[] = [
  'report',
  'triage',
  'policy',
  'funding',
  'bid',
  'score',
  'award',
  'work',
  'evidence',
  'inspection',
  'payment',
  'warranty',
  'dispute',
  'close',
];
const EVIDENCE_REF_KINDS = ['HASH', 'HUMAN', 'PHYSICAL', 'TX', 'ATTESTATION'] as const;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function obj(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function record(value: unknown): JsonObject | undefined {
  return isRecord(value) ? value : undefined;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function optionalStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function int(value: unknown, fallback = 0): number {
  return Math.trunc(num(value, fallback));
}

function micro(value: unknown, fallback = '0'): string {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}

function optionalPick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  return undefined;
}

function stringList(value: unknown): string[] {
  return arr(value).filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function normalizeLocation(value: unknown): PublicLocation {
  const raw = obj(value);
  return {
    label: str(raw.label, 'Location not published by the API'),
    coarseLat: num(raw.coarseLat),
    coarseLng: num(raw.coarseLng),
    ...(optionalStr(raw.area) ? { area: optionalStr(raw.area) } : {}),
  };
}

function normalizeWeights(value: unknown): DimensionScores {
  const raw = obj(value);
  return {
    price: int(raw.price),
    warranty: int(raw.warranty),
    duration: int(raw.duration),
    materials: int(raw.materials),
  };
}

function normalizeReport(value: unknown): Report {
  const raw = obj(value);
  return {
    id: str(raw.id, 'REPORT'),
    assetId: str(raw.assetId),
    description: str(raw.description),
    publicLocation: normalizeLocation(raw.publicLocation),
    reporterCaseLink: str(raw.reporterCaseLink, 'protected'),
    ...(optionalStr(raw.redactedMediaHash) ? { redactedMediaHash: optionalStr(raw.redactedMediaHash) } : {}),
    ...(optionalStr(raw.perceptualHash) ? { perceptualHash: optionalStr(raw.perceptualHash) } : {}),
    exifStripped: bool(raw.exifStripped),
    status: pick(raw.status, REPORT_STATES, 'SUBMITTED'),
    ...(optionalStr(raw.clusterId) ? { clusterId: optionalStr(raw.clusterId) } : {}),
    createdAt: str(raw.createdAt),
  };
}

function normalizeCluster(value: unknown): ReportCluster | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  return {
    id: str(raw.id, 'CLUSTER'),
    reportIds: stringList(raw.reportIds),
    confidenceBps: int(raw.confidenceBps),
    rationale: str(raw.rationale),
    status: pick(raw.status, CLUSTER_STATES, 'SUGGESTED'),
    ...(optionalStr(raw.confirmedBy) ? { confirmedBy: optionalStr(raw.confirmedBy) } : {}),
    createdAt: str(raw.createdAt),
  };
}

function normalizeDaoApproval(value: unknown, budgetMicro: string, policyHash: string): DaoApproval {
  const raw = obj(value);
  return {
    id: str(raw.id, 'DAO-APPROVAL'),
    daoAccount: str(raw.daoAccount, 'DAO account not published'),
    proposalId: str(raw.proposalId, '—'),
    budgetMicro: micro(raw.budgetMicro, budgetMicro),
    contractorRoster: stringList(raw.contractorRoster),
    inspectorRoster: stringList(raw.inspectorRoster),
    policyHash: str(raw.policyHash, policyHash),
    state: pick(raw.state, DAO_STATES, 'PROPOSED'),
    ...(optionalStr(raw.approvedAt) ? { approvedAt: optionalStr(raw.approvedAt) } : {}),
  };
}

function normalizeCommitment(value: unknown): BidCommitmentView {
  const raw = obj(value);
  return {
    bidId: str(raw.bidId, 'BID'),
    contractorId: str(raw.contractorId),
    commitmentHash: str(raw.commitmentHash),
    committedAt: str(raw.committedAt),
  };
}

function normalizeReveal(value: unknown): BidRevealView {
  const raw = obj(value);
  return {
    bidId: str(raw.bidId, 'BID'),
    contractorId: str(raw.contractorId),
    commitmentHash: str(raw.commitmentHash),
    committedAt: str(raw.committedAt),
    priceMicro: micro(raw.priceMicro),
    durationDays: int(raw.durationDays),
    warrantyDays: int(raw.warrantyDays),
    availableInDays: int(raw.availableInDays),
    materials: str(raw.materials),
    materialsScore: int(raw.materialsScore),
    evidenceChecklistAccepted: bool(raw.evidenceChecklistAccepted),
    revealedAt: str(raw.revealedAt),
  };
}

function normalizeRanking(value: unknown, index: number): ScoredBidView {
  const raw = obj(value);
  return {
    rank: int(raw.rank, index + 1),
    bidId: str(raw.bidId, 'BID'),
    contractorId: str(raw.contractorId),
    scoreBps: int(raw.scoreBps),
    dimensions: normalizeWeights(raw.dimensions),
    priceMicro: micro(raw.priceMicro),
    durationDays: int(raw.durationDays),
    warrantyDays: int(raw.warrantyDays),
    availableInDays: int(raw.availableInDays),
    materialsScore: int(raw.materialsScore),
  };
}

function normalizeScore(value: unknown, fallbackPolicyHash: string, fallbackPolicyVersion: string): ScoreView | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  return {
    id: str(raw.id, 'SCORE'),
    policyHash: str(raw.policyHash, fallbackPolicyHash),
    policyVersion: str(raw.policyVersion, fallbackPolicyVersion),
    weightsBps: normalizeWeights(raw.weightsBps),
    wasmHash: str(raw.wasmHash),
    inputHash: str(raw.inputHash),
    outputHash: str(raw.outputHash),
    ranking: arr(raw.ranking).map((item, index) => normalizeRanking(item, index)),
    verified: bool(raw.verified),
    ...(optionalStr(raw.unavailableReason) ? { unavailableReason: optionalStr(raw.unavailableReason) } : {}),
    createdAt: str(raw.createdAt),
  };
}

function normalizeChecklist(value: unknown): EvidencePackageView['checklist'] {
  return arr(value)
    .map((item) => obj(item))
    .filter((item) => typeof item.label === 'string' && item.label.length > 0)
    .map((item) => ({
      label: str(item.label),
      complete: bool(item.complete),
      ...(optionalStr(item.note) ? { note: optionalStr(item.note) } : {}),
    }));
}

function normalizeEvidence(value: unknown): EvidencePackageView {
  const raw = obj(value);
  return {
    id: str(raw.id, 'EVIDENCE'),
    kind: pick(raw.kind, EVIDENCE_KINDS, 'COMPLETION'),
    evidenceHashes: stringList(raw.evidenceHashes),
    checklist: normalizeChecklist(raw.checklist),
    redacted: true,
    submittedBy: str(raw.submittedBy),
    submittedAt: str(raw.submittedAt),
  };
}

function normalizeInspection(value: unknown): InspectionView {
  const raw = obj(value);
  return {
    id: str(raw.id, 'INSPECTION'),
    kind: pick(raw.kind, INSPECTION_KINDS, 'COMPLETION'),
    inspectorId: str(raw.inspectorId),
    decision: pick(raw.decision, DECISIONS, 'REJECTED'),
    evidencePackageId: str(raw.evidencePackageId),
    ...(optionalStr(raw.notesHash) ? { notesHash: optionalStr(raw.notesHash) } : {}),
    signedAt: str(raw.signedAt),
    ...(optionalStr(raw.txHash) ? { txHash: optionalStr(raw.txHash) } : {}),
  };
}

function normalizeEscrow(value: unknown, token: string): EscrowView {
  const raw = obj(value);
  return {
    token: str(raw.token, token),
    fundedMicro: micro(raw.fundedMicro),
    refundedMicro: micro(raw.refundedMicro),
    ...(optionalStr(raw.escrowedMicro) ? { escrowedMicro: micro(raw.escrowedMicro) } : {}),
    completionPaidMicro: micro(raw.completionPaidMicro),
    holdbackHeldMicro: micro(raw.holdbackHeldMicro),
    holdbackReleasedMicro: micro(raw.holdbackReleasedMicro),
  };
}

function normalizePayment(value: unknown): PaymentView {
  const raw = obj(value);
  return {
    id: str(raw.id, 'PAYMENT'),
    kind: pick(raw.kind, PAYMENT_KINDS, 'COMPLETION'),
    amountMicro: micro(raw.amountMicro),
    recipient: str(raw.recipient),
    status: pick(raw.status, PAYMENT_STATES, 'INTENT'),
    ...(optionalStr(raw.txHash) ? { txHash: optionalStr(raw.txHash) } : {}),
    ...(optionalStr(raw.releasedAt) ? { releasedAt: optionalStr(raw.releasedAt) } : {}),
  };
}

function normalizeWarranty(value: unknown): WarrantyView | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  return {
    id: str(raw.id, 'WARRANTY'),
    state: pick(raw.state, WARRANTY_STATES, 'OPEN'),
    openedAt: str(raw.openedAt),
    ...(optionalStr(raw.closedAt) ? { closedAt: optionalStr(raw.closedAt) } : {}),
    failedInspectionId: str(raw.failedInspectionId),
    note: str(raw.note),
  };
}

function normalizeAttestation(value: unknown): AttestationView {
  const raw = obj(value);
  return {
    id: str(raw.id, 'ATTESTATION'),
    kind: pick(raw.kind, ATTESTATION_KINDS, 'HUMAN'),
    label: str(raw.label, 'Unlabelled attestation'),
    subjectHash: str(raw.subjectHash),
    verified: bool(raw.verified),
    ...(optionalStr(raw.unavailableReason) ? { unavailableReason: optionalStr(raw.unavailableReason) } : {}),
    detail: str(raw.detail),
    ...(optionalStr(raw.signature) ? { signature: optionalStr(raw.signature) } : {}),
    ...(optionalStr(raw.explorerUrl) ? { explorerUrl: optionalStr(raw.explorerUrl) } : {}),
    createdAt: str(raw.createdAt),
  };
}

function normalizeEventEvidence(value: unknown): NonNullable<TimelineEvent['evidence']> {
  return arr(value)
    .map((item) => obj(item))
    .filter((item) => typeof item.label === 'string' && item.label.length > 0)
    .map((item) => ({
      label: str(item.label),
      kind: pick(item.kind, EVIDENCE_REF_KINDS, 'HASH'),
      ...(optionalStr(item.value) ? { value: optionalStr(item.value) } : {}),
      ...(optionalStr(item.href) ? { href: optionalStr(item.href) } : {}),
    }));
}

function normalizeEvent(value: unknown): TimelineEvent {
  const raw = obj(value);
  const evidence = normalizeEventEvidence(raw.evidence);
  return {
    id: str(raw.id, 'EVENT'),
    at: str(raw.at),
    title: str(raw.title, 'Untitled event'),
    detail: str(raw.detail),
    actor: str(raw.actor),
    kind: pick(raw.kind, TIMELINE_KINDS, 'report'),
    ...(evidence.length > 0 ? { evidence } : {}),
  };
}

function normalizeIntent(value: unknown, updatedAt: string): IntentQuoteView {
  const raw = obj(value);
  return {
    id: str(raw.id, 'INTENT-UNAVAILABLE'),
    dry: bool(raw.dry, true),
    srcChain: str(raw.srcChain, 'Unavailable'),
    srcAsset: str(raw.srcAsset, 'Unavailable'),
    dstChain: 'near',
    dstAsset: str(raw.dstAsset, 'Unavailable'),
    amountIn: str(raw.amountIn, '0'),
    amountOut: str(raw.amountOut, '0'),
    feesUsd: num(raw.feesUsd),
    recipient: str(raw.recipient, 'Unavailable'),
    depositAddress: str(raw.depositAddress, 'Unavailable'),
    depositMemo: str(raw.depositMemo, 'Unavailable'),
    deadline: str(raw.deadline, updatedAt),
    status: pick(raw.status, INTENT_STATES, 'PENDING'),
    ...(optionalStr(raw.destinationTxHash) ? { destinationTxHash: optionalStr(raw.destinationTxHash) } : {}),
    ...(optionalStr(raw.explorerUrl) ? { explorerUrl: optionalStr(raw.explorerUrl) } : {}),
    updatedAt: str(raw.updatedAt, updatedAt),
  };
}

function isWorkOrderState(value: string): value is WorkOrderState {
  return (WORK_ORDER_STATES as readonly string[]).includes(value);
}

function singleCasePayload(value: unknown): JsonObject | undefined {
  const root = record(value);
  if (!root) return undefined;
  if (str(root.id)) return root;
  for (const key of ['case', 'caseBundle', 'workOrder']) {
    const nested = record(root[key]);
    if (nested) return singleCasePayload(nested);
  }
  for (const key of ['data', 'result', 'payload']) {
    const nested = record(root[key]);
    if (nested) return singleCasePayload(nested);
  }
  return undefined;
}

/**
 * Normalises one public CaseBundle record. Returns null when the record lacks
 * the identifiers, state, reports or escrow the public pages require, so the
 * caller can fall back rather than render a partial live case as if it were
 * complete. This also rejects `/v1/cases` summaries, which intentionally omit
 * the full bundle and must be hydrated through `/v1/cases/:id`.
 */
export function normalizeCasePayload(value: unknown, requestedId?: string): CaseBundle | null {
  const raw = singleCasePayload(value);
  if (!raw) return null;

  const id = str(raw.id);
  if (!id) return null;
  if (requestedId && id !== requestedId) return null;

  const assetId = str(raw.assetId);
  const status = str(raw.status);
  if (!assetId || !isWorkOrderState(status)) return null;
  if (!Array.isArray(raw.reports) || !isRecord(raw.escrow)) return null;

  const createdAt = str(raw.createdAt);
  const updatedAt = str(raw.updatedAt, createdAt);
  const budgetMicro = micro(raw.budgetMicro);
  const policyHash = str(raw.policyHash);
  const policyVersion = str(raw.policyVersion, 'unpublished policy');
  const reports = arr(raw.reports).map(normalizeReport);
  const firstReport = reports[0];
  const cluster = normalizeCluster(raw.cluster);
  const score = normalizeScore(raw.score, policyHash, policyVersion);
  const warranty = normalizeWarranty(raw.warranty);
  const fundingToken = str(raw.fundingToken, 'Token not published');

  return {
    id,
    assetId,
    title: str(raw.title, firstReport?.description ?? `Case ${id}`),
    summary: str(raw.summary, ''),
    status,
    mode: pick(raw.mode, MODES, 'REPLAY'),
    budgetMicro,
    ...(optionalStr(raw.winningBidMicro) ? { winningBidMicro: micro(raw.winningBidMicro) } : {}),
    ...(optionalStr(raw.refundMicro) ? { refundMicro: micro(raw.refundMicro) } : {}),
    ...(optionalStr(raw.completionPaymentMicro) ? { completionPaymentMicro: micro(raw.completionPaymentMicro) } : {}),
    ...(optionalStr(raw.holdbackMicro) ? { holdbackMicro: micro(raw.holdbackMicro) } : {}),
    scope: str(raw.scope, 'No public scope text was supplied by the API.'),
    scopeHash: str(raw.scopeHash),
    daoApproval: normalizeDaoApproval(raw.daoApproval, budgetMicro, policyHash),
    policyVersion,
    policyWeightsBps: normalizeWeights(raw.policyWeightsBps),
    policyHash,
    ...(optionalStr(raw.contractorId) ? { contractorId: optionalStr(raw.contractorId) } : {}),
    ...(optionalStr(raw.inspectorId) ? { inspectorId: optionalStr(raw.inspectorId) } : {}),
    fundingToken,
    ...(optionalStr(raw.fundingTxHash) ? { fundingTxHash: optionalStr(raw.fundingTxHash) } : {}),
    ...(optionalStr(raw.durabilityDueAt) ? { durabilityDueAt: optionalStr(raw.durabilityDueAt) } : {}),
    reopenCount: int(raw.reopenCount),
    createdAt,
    updatedAt,
    reports,
    ...(cluster ? { cluster } : {}),
    commitments: arr(raw.commitments).map(normalizeCommitment),
    reveals: arr(raw.reveals).map(normalizeReveal),
    ...(score ? { score } : {}),
    evidence: arr(raw.evidence).map(normalizeEvidence),
    inspections: arr(raw.inspections).map(normalizeInspection),
    escrow: normalizeEscrow(raw.escrow, fundingToken),
    payments: arr(raw.payments).map(normalizePayment),
    ...(warranty ? { warranty } : {}),
    attestations: arr(raw.attestations).map(normalizeAttestation),
    events: arr(raw.events).map(normalizeEvent),
    intent: normalizeIntent(raw.intent, updatedAt),
  };
}

function unwrapEnvelope(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(current)) break;
    const envelope = current;
    const key = ['data', 'result', 'payload'].find((candidate) => candidate in envelope);
    if (!key) break;
    current = envelope[key];
  }
  return current;
}

function caseCandidates(payload: unknown): unknown[] {
  const root = unwrapEnvelope(payload);
  if (Array.isArray(root)) return root;
  if (!isRecord(root)) return [];

  const candidates: unknown[] = [];
  for (const key of ['cases', 'items', 'results', 'records']) {
    if (Array.isArray(root[key])) candidates.push(...root[key]);
  }
  for (const key of ['case', 'caseBundle', 'workOrder']) {
    if (isRecord(root[key])) candidates.push(root[key]);
  }
  if (candidates.length === 0 && (root.id || root.assetId)) candidates.push(root);
  return candidates;
}

/** Returns a list of valid cases, an empty list for valid-empty, or null for a shape mismatch. */
export function normalizeCaseListPayload(payload: unknown): CaseBundle[] | null {
  const candidates = caseCandidates(payload);
  if (candidates.length === 0) {
    const root = unwrapEnvelope(payload);
    if (Array.isArray(root)) return [];
    if (isRecord(root) && Array.isArray(root.cases)) return [];
    return null;
  }
  const cases = candidates
    .map((candidate) => normalizeCasePayload(candidate))
    .filter((candidate): candidate is CaseBundle => candidate !== null);
  if (cases.length === 0) return null;
  return cases;
}

/**
 * Reads the ids from a `/v1/cases` or `/v1/cases/by-asset/:assetId` response.
 * The list endpoint returns CaseSummary records, not full bundles, so the
 * caller hydrates each id from `/v1/cases/:id`.
 */
function caseReferenceIds(payload: unknown): string[] | null {
  const root = unwrapEnvelope(payload);
  let items: unknown[] | undefined;

  if (Array.isArray(root)) {
    items = root;
  } else if (isRecord(root)) {
    for (const key of ['cases', 'items', 'results', 'records']) {
      if (Array.isArray(root[key])) {
        items = root[key];
        break;
      }
    }
    if (!items && typeof root.id === 'string' && root.id.length > 0) {
      return [root.id];
    }
  }

  if (!items) return null;
  const ids = items
    .map((item) => record(item))
    .map((item) => (item ? str(item.id) : ''))
    .filter((id) => id.length > 0);
  return [...new Set(ids)];
}

async function hydrateCaseDetails(ids: string[]): Promise<CaseBundle[]> {
  const uniqueIds = [...new Set(ids)];
  const cases = await Promise.all(
    uniqueIds.map(async (id) => {
      const response = await readApiJson(`/v1/cases/${encodeURIComponent(id)}`);
      if (!response.ok) return null;
      return normalizeCasePayload(response.data, id);
    }),
  );
  return cases.filter((caseData): caseData is CaseBundle => caseData !== null);
}

function getApiBaseUrl(): string | undefined {
  const raw = process.env.MEND_API_BASE_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return raw.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

export function isPublicApiConfigured(): boolean {
  return Boolean(getApiBaseUrl());
}

async function readApiJson(path: string): Promise<ApiReadResult> {
  const base = getApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 0,
      reason: 'unconfigured',
      message: 'MEND_API_BASE_URL is not configured.',
    };
  }

  try {
    const response = await fetch(`${base}${path}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason: response.status === 404 ? 'not-found' : 'http',
        message: `The live API returned HTTP ${response.status}.`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        status: response.status,
        reason: 'invalid-response',
        message: 'The live API did not return JSON.',
      };
    }

    if (payload === null || payload === undefined) {
      return {
        ok: false,
        status: response.status,
        reason: 'invalid-response',
        message: 'The live API returned an empty response.',
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return {
      ok: false,
      status: 0,
      reason: 'unreachable',
      message: timedOut ? 'The live API did not respond in time.' : 'The live API is unreachable.',
    };
  }
}

function fallbackReasonFor(failure: ApiReadResult, noun: string): string {
  if (failure.ok) return '';
  if (failure.reason === 'not-found') {
    return `The live API has no ${noun} for this id; the frozen replay fixture is shown instead.`;
  }
  return `${failure.message} Frozen replay fixtures are shown instead of live data.`;
}

export async function loadCase(workOrderId: string): Promise<CaseLoadResult> {
  const fixture = getCase(workOrderId);
  const apiConfigured = isPublicApiConfigured();

  if (!apiConfigured) {
    return {
      caseData: fixture,
      source: 'fixture',
      apiConfigured: false,
      fallbackReason: fixture
        ? 'MEND_API_BASE_URL is not configured; frozen replay fixture shown.'
        : 'MEND_API_BASE_URL is not configured and no replay fixture exists for this id.',
    };
  }

  const response = await readApiJson(`/v1/cases/${encodeURIComponent(workOrderId)}`);
  if (response.ok) {
    const caseData = normalizeCasePayload(response.data, workOrderId);
    if (caseData) {
      return { caseData, source: 'api', apiConfigured: true };
    }
    return {
      caseData: fixture,
      source: 'fixture',
      apiConfigured: true,
      fallbackReason:
        'The live API returned a case that did not match the public CaseBundle shape; the frozen replay fixture is shown instead.',
    };
  }

  return {
    caseData: fixture,
    source: 'fixture',
    apiConfigured: true,
    fallbackReason: fallbackReasonFor(response, 'case record'),
  };
}

export async function loadCases(): Promise<CasesLoadResult> {
  const apiConfigured = isPublicApiConfigured();
  if (!apiConfigured) {
    return {
      cases: CASES,
      source: 'fixture',
      apiConfigured: false,
      fallbackReason: 'MEND_API_BASE_URL is not configured; frozen replay fixtures shown.',
    };
  }

  const response = await readApiJson('/v1/cases');
  if (response.ok) {
    const ids = caseReferenceIds(response.data);
    if (ids && ids.length > 0) {
      const cases = await hydrateCaseDetails(ids);
      if (cases.length > 0) {
        return { cases, source: 'api', apiConfigured: true };
      }
      return {
        cases: CASES,
        source: 'fixture',
        apiConfigured: true,
        fallbackReason:
          'The live API listed public cases but did not return usable case bundles; the frozen replay fixtures are shown instead.',
      };
    }
    if (ids && ids.length === 0) {
      return {
        cases: CASES,
        source: 'fixture',
        apiConfigured: true,
        fallbackReason: 'The live API returned no public cases; the frozen replay fixtures are shown instead.',
      };
    }
    return {
      cases: CASES,
      source: 'fixture',
      apiConfigured: true,
      fallbackReason:
        'The live API returned a payload that did not match the public case list shape; the frozen replay fixtures are shown instead.',
    };
  }

  return {
    cases: CASES,
    source: 'fixture',
    apiConfigured: true,
    fallbackReason: fallbackReasonFor(response, 'public case list'),
  };
}

function assetObject(payload: unknown): JsonObject | undefined {
  const root = unwrapEnvelope(payload);
  if (!isRecord(root)) return undefined;
  for (const key of ['asset', 'assetView', 'passport']) {
    if (isRecord(root[key])) return root[key];
  }
  return root;
}

function buildAsset(assetId: string, rawAsset: JsonObject | undefined, cases: CaseBundle[]): Asset {
  const reports = cases.flatMap((caseData) => caseData.reports);
  const firstReport = reports[0];
  const firstCase = cases[0];
  const approvedRepairs = cases
    .flatMap((caseData) => caseData.inspections)
    .filter(
      (inspection) =>
        (inspection.kind === 'COMPLETION' || inspection.kind === 'REMEDIATION') &&
        inspection.decision === 'APPROVED',
    );
  const location = rawAsset?.publicLocation
    ? normalizeLocation(rawAsset.publicLocation)
    : firstReport?.publicLocation ?? {
        label: 'Location not published by the API',
        coarseLat: 0,
        coarseLng: 0,
      };
  const createdCandidates = [optionalStr(rawAsset?.createdAt), ...cases.map((caseData) => caseData.createdAt)]
    .filter((candidate): candidate is string => Boolean(candidate))
    .sort();

  return {
    id: assetId,
    publicDescription: str(
      rawAsset?.publicDescription,
      firstReport?.description ?? firstCase?.title ?? `Public asset ${assetId}`,
    ),
    assetType: pick(rawAsset?.assetType, ASSET_TYPES, 'other'),
    publicLocation: location,
    passportTokenId: str(rawAsset?.passportTokenId, 'Not minted'),
    createdAt: createdCandidates[0] ?? '',
    owner: str(rawAsset?.owner, firstCase?.daoApproval.daoAccount ?? 'Owner not published by the API'),
    transferable: false,
    repairCount: approvedRepairs.length,
    replacementCount: 0,
    repeatFailures: cases.reduce((total, caseData) => total + caseData.reopenCount, 0),
  };
}

/** Builds the minimum public passport view from one live or fixture case. */
export function assetFromCase(caseData: CaseBundle): Asset {
  return buildAsset(caseData.assetId, undefined, [caseData]);
}

export async function loadAsset(assetId: string): Promise<AssetLoadResult> {
  const fixtureAsset = getAsset(assetId);
  const fixtureCases = casesForAsset(assetId);
  const apiConfigured = isPublicApiConfigured();

  if (!apiConfigured) {
    return {
      asset: fixtureAsset,
      cases: fixtureCases,
      source: 'fixture',
      apiConfigured: false,
      ...(fixtureAsset
        ? { fallbackReason: 'MEND_API_BASE_URL is not configured; frozen replay fixture shown.' }
        : {}),
    };
  }

  const byAsset = await readApiJson(`/v1/cases/by-asset/${encodeURIComponent(assetId)}`);
  if (byAsset.ok) {
    const rawAsset = assetObject(byAsset.data);
    const ids = caseReferenceIds(byAsset.data) ?? [];
    const cases = await hydrateCaseDetails(ids);
    if (ids.length > 0 && cases.length === 0 && fixtureAsset) {
      return {
        asset: fixtureAsset,
        cases: fixtureCases,
        source: 'fixture',
        apiConfigured: true,
        fallbackReason:
          'The live API listed cases for this asset but did not return usable case bundles; the frozen replay fixture is shown instead.',
      };
    }
    return {
      asset: buildAsset(assetId, rawAsset, cases),
      cases,
      source: 'api',
      apiConfigured: true,
    };
  }

  // Supports API builds that expose /v1/cases and /v1/cases/:id before the
  // asset-grouped convenience route is deployed.
  const filtered = await readApiJson(`/v1/cases?assetId=${encodeURIComponent(assetId)}`);
  if (filtered.ok) {
    const ids = caseReferenceIds(filtered.data);
    const cases = ids ? await hydrateCaseDetails(ids) : [];
    if (cases.length > 0) {
      return {
        asset: buildAsset(assetId, undefined, cases),
        cases,
        source: 'api',
        apiConfigured: true,
      };
    }
    return {
      asset: fixtureAsset,
      cases: fixtureCases,
      source: 'fixture',
      apiConfigured: true,
      ...(fixtureAsset
        ? {
            fallbackReason:
              ids && ids.length === 0
                ? 'The live API returned no case records for this asset; the frozen replay fixture is shown instead.'
                : 'The live API did not return usable case bundles for this asset; the frozen replay fixture is shown instead.',
          }
        : {}),
    };
  }

  const failure = byAsset.reason === 'not-found' && !filtered.ok ? filtered : byAsset;
  return {
    asset: fixtureAsset,
    cases: fixtureCases,
    source: 'fixture',
    apiConfigured: true,
    ...(fixtureAsset ? { fallbackReason: fallbackReasonFor(failure, 'asset record') } : {}),
  };
}

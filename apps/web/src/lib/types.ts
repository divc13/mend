/**
 * View models for the MEND web experience.
 *
 * These intentionally mirror the frozen protocol records in
 * `packages/protocol/src/schemas.ts` but are narrowed to what the UI renders.
 * Financial values are always integer micro-units encoded as strings.
 */

export const WORK_ORDER_STATES = [
  'DRAFT',
  'POLICY_APPROVED',
  'FUNDED',
  'BIDDING_OPEN',
  'BIDDING_REVEAL',
  'BIDDING',
  'SCORED',
  'AWARDED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED',
  'DURABILITY_PENDING',
  'CLOSED',
  'WARRANTY_REOPENED',
  'DISPUTED',
  'CANCELLED',
  'REFUNDED',
  'FUNDING_FAILED',
  'PAUSED',
] as const;

export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];
export type Mode = 'LIVE_TESTNET' | 'MAINNET' | 'REPLAY';
export type AssetType = 'bench' | 'bicycle_rack' | 'fence' | 'door' | 'playground' | 'other';

export interface PublicLocation {
  label: string;
  coarseLat: number;
  coarseLng: number;
  area?: string;
}

export interface Asset {
  id: string;
  publicDescription: string;
  assetType: AssetType;
  publicLocation: PublicLocation;
  passportTokenId: string;
  createdAt: string;
  owner: string;
  transferable: false;
  repairCount: number;
  replacementCount: number;
  repeatFailures: number;
}

export interface Report {
  id: string;
  assetId: string;
  description: string;
  publicLocation: PublicLocation;
  reporterCaseLink: string;
  redactedMediaHash?: string;
  perceptualHash?: string;
  exifStripped: boolean;
  status: 'SUBMITTED' | 'TRIAGED' | 'CLUSTERED' | 'DUPLICATE' | 'ACCEPTED';
  clusterId?: string;
  createdAt: string;
}

export interface ReportCluster {
  id: string;
  reportIds: string[];
  confidenceBps: number;
  rationale: string;
  status: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
  confirmedBy?: string;
  createdAt: string;
}

export interface DaoApproval {
  id: string;
  daoAccount: string;
  proposalId: string;
  budgetMicro: string;
  contractorRoster: string[];
  inspectorRoster: string[];
  policyHash: string;
  state: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  approvedAt?: string;
}

export interface BidCommitmentView {
  bidId: string;
  contractorId: string;
  commitmentHash: string;
  committedAt: string;
}

export interface BidRevealView extends BidCommitmentView {
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  /** Whole days until the contractor can start after award. Committed with the bid. */
  availableInDays: number;
  materials: string;
  materialsScore: number;
  evidenceChecklistAccepted: boolean;
  revealedAt: string;
}

export interface DimensionScores {
  price: number;
  warranty: number;
  duration: number;
  materials: number;
}

export interface ScoredBidView {
  rank: number;
  bidId: string;
  contractorId: string;
  scoreBps: number;
  dimensions: DimensionScores;
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  /** Whole days until the contractor can start after award. Committed with the bid. */
  availableInDays: number;
  materialsScore: number;
}

export interface ScoreView {
  id: string;
  policyHash: string;
  policyVersion: string;
  weightsBps: DimensionScores;
  wasmHash: string;
  inputHash: string;
  outputHash: string;
  ranking: ScoredBidView[];
  verified: boolean;
  unavailableReason?: string;
  createdAt: string;
}

export interface EvidencePackageView {
  id: string;
  kind: 'COMPLETION' | 'REMEDIATION' | 'DURABILITY';
  evidenceHashes: string[];
  checklist: { label: string; complete: boolean; note?: string }[];
  redacted: true;
  submittedBy: string;
  submittedAt: string;
}

export interface InspectionView {
  id: string;
  kind: 'COMPLETION' | 'DURABILITY' | 'REMEDIATION';
  inspectorId: string;
  decision: 'APPROVED' | 'REJECTED';
  evidencePackageId: string;
  notesHash?: string;
  signedAt: string;
  txHash?: string;
}

export interface EscrowView {
  token: string;
  fundedMicro: string;
  refundedMicro: string;
  /** Award still held but not yet split into completion/holdback. */
  escrowedMicro?: string;
  completionPaidMicro: string;
  holdbackHeldMicro: string;
  holdbackReleasedMicro: string;
}

export interface PaymentView {
  id: string;
  kind: 'COMPLETION' | 'HOLDBACK' | 'REFUND';
  amountMicro: string;
  recipient: string;
  status: 'INTENT' | 'PENDING' | 'SUCCESS' | 'FAILED';
  txHash?: string;
  releasedAt?: string;
}

export interface WarrantyView {
  id: string;
  state: 'OPEN' | 'REMEDIATING' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  failedInspectionId: string;
  note: string;
}

export type AttestationKind = 'NEAR_AI' | 'OUTLAYER' | 'DAO' | 'TRANSACTION' | 'HUMAN' | 'LOCAL_REPLAY';

export interface AttestationView {
  id: string;
  kind: AttestationKind;
  label: string;
  subjectHash: string;
  verified: boolean;
  unavailableReason?: string;
  detail: string;
  signature?: string;
  explorerUrl?: string;
  createdAt: string;
}

export type TimelineKind =
  | 'report'
  | 'triage'
  | 'policy'
  | 'funding'
  | 'bid'
  | 'score'
  | 'award'
  | 'work'
  | 'evidence'
  | 'inspection'
  | 'payment'
  | 'warranty'
  | 'dispute'
  | 'close';

export interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  detail: string;
  actor: string;
  kind: TimelineKind;
  evidence?: {
    label: string;
    kind: 'HASH' | 'HUMAN' | 'PHYSICAL' | 'TX' | 'ATTESTATION';
    value?: string;
    href?: string;
  }[];
}

export interface IntentQuoteView {
  id: string;
  dry: boolean;
  srcChain: string;
  srcAsset: string;
  dstChain: 'near';
  dstAsset: string;
  amountIn: string;
  amountOut: string;
  feesUsd: number;
  recipient: string;
  depositAddress: string;
  depositMemo: string;
  deadline: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'INCOMPLETE' | 'EXPIRED';
  destinationTxHash?: string;
  explorerUrl?: string;
  updatedAt: string;
}

export interface CaseBundle {
  id: string;
  assetId: string;
  title: string;
  summary: string;
  status: WorkOrderState;
  mode: Mode;
  budgetMicro: string;
  winningBidMicro?: string;
  refundMicro?: string;
  completionPaymentMicro?: string;
  holdbackMicro?: string;
  scope: string;
  scopeHash: string;
  daoApproval: DaoApproval;
  policyVersion: string;
  policyWeightsBps: DimensionScores;
  policyHash: string;
  contractorId?: string;
  inspectorId?: string;
  fundingToken: string;
  fundingTxHash?: string;
  durabilityDueAt?: string;
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  reports: Report[];
  cluster?: ReportCluster;
  commitments: BidCommitmentView[];
  reveals: BidRevealView[];
  score?: ScoreView;
  evidence: EvidencePackageView[];
  inspections: InspectionView[];
  escrow: EscrowView;
  payments: PaymentView[];
  warranty?: WarrantyView;
  attestations: AttestationView[];
  events: TimelineEvent[];
  intent: IntentQuoteView;
}

export interface ScenarioView {
  id: string;
  code: string;
  title: string;
  description: string;
  expected: string;
  caseId?: string;
  tags: string[];
  transcript?: { speaker: string; text: string; tone?: 'neutral' | 'warning' | 'success' }[];
}

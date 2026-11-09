/**
 * Repository contracts shared by the in-memory and Postgres implementations.
 *
 * Postgres is a read model and private-data index. The hub contract remains the
 * financial source of truth; nothing in this package may be treated as authority
 * to move money.
 */
import {
  IntentStatusSchema,
  PublicLocationSchema,
  ScoredRankSchema,
} from '@mend/protocol';
import type {
  Asset,
  BidReveal,
  EvidencePackage,
  Inspection,
  Payment,
  Role,
  WorkOrderState,
  WorkOrderMode,
} from '@mend/protocol';
import type { z } from 'zod';

export type PublicLocation = z.infer<typeof PublicLocationSchema>;
export type ScoredRank = z.infer<typeof ScoredRankSchema>;
export type IntentStatus = z.infer<typeof IntentStatusSchema>;
export type ReportStatus = 'SUBMITTED' | 'TRIAGED' | 'CLUSTERED' | 'DUPLICATE' | 'ACCEPTED';
export type ClusterStatus = 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
export type ChainCommandState = 'INTENT' | 'PENDING' | 'SUCCESS' | 'FAILED';
export type PaymentKind = 'COMPLETION' | 'HOLDBACK' | 'REFUND';
export type PaymentState = 'INTENT' | 'PENDING' | 'SUCCESS' | 'FAILED';
export type EvidenceKind = 'COMPLETION' | 'REMEDIATION' | 'DURABILITY';
export type InspectionKind = 'COMPLETION' | 'DURABILITY' | 'REMEDIATION';

/** Precise coordinates are private and must never appear in a public response. */
export interface PreciseLocation {
  lat: number;
  lng: number;
  accuracyM?: number;
  capturedAt?: string;
}

export interface AssetRecord extends Asset {
  isDemo: boolean;
}

export interface ReportRecord {
  id: string;
  assetId: string;
  description: string;
  publicLocation: PublicLocation;
  redactedMediaHash?: string;
  perceptualHash?: string;
  exifStripped: boolean;
  status: ReportStatus;
  clusterId?: string;
  createdAt: string;
  /** Walletless reports never require an account. */
  source: 'WALLETLESS' | 'ACCOUNT';
  isDemo: boolean;
}

export interface ReportPrivateRecord {
  reportId: string;
  preciseLocation?: PreciseLocation;
  reporterCaseLink: string;
  caseLinkHash: string;
  privateMediaKey?: string;
  privateMediaHash?: string;
  retentionUntil?: string;
}

export interface ReportClusterRecord {
  id: string;
  reportIds: string[];
  confidenceBps: number;
  rationale: string;
  status: ClusterStatus;
  confirmedBy?: string;
  createdAt: string;
  isDemo: boolean;
}

export interface DaoApprovalRecord {
  id: string;
  daoAccount: string;
  proposalId: string;
  budgetMicro: string;
  contractorRoster: string[];
  inspectorRoster: string[];
  policyHash: string;
  state: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  approvedAt?: string;
  isDemo: boolean;
}

export interface WorkOrderRecord {
  id: string;
  assetId: string;
  reportClusterId: string;
  scopeHash: string;
  daoApprovalId: string;
  policyHash: string;
  budgetMicro: string;
  status: WorkOrderState;
  mode: WorkOrderMode;
  awardedBidId?: string;
  contractorId?: string;
  inspectorId?: string;
  sponsorId?: string;
  fundingToken: string;
  fundingTxHash?: string;
  durabilityDueAt?: string;
  commitDeadline?: string;
  revealDeadline?: string;
  pausedFrom?: WorkOrderState;
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

export interface BidCommitmentRecord {
  workOrderId: string;
  bidId: string;
  contractorId: string;
  commitmentHash: string;
  committedAt: string;
  isDemo: boolean;
}

export interface BidRevealRecord extends BidReveal {
  isDemo: boolean;
}

export interface ScoreExecutionRecord {
  id: string;
  workOrderId: string;
  policyHash: string;
  wasmHash: string;
  inputHash: string;
  outputHash: string;
  ranking: ScoredRank[];
  executionRef?: string;
  verified: boolean;
  unavailableReason?: string;
  createdAt: string;
  isDemo: boolean;
}

export interface EvidencePackageRecord extends Omit<EvidencePackage, 'redacted'> {
  redacted: true;
  isDemo: boolean;
}

export interface EvidenceObjectRecord {
  id: string;
  evidencePackageId: string;
  storageKey: string;
  sha256: string;
  contentType: string;
  sizeBytes: number;
  redacted: boolean;
  createdAt: string;
}

export interface InspectionRecord extends Inspection {
  isDemo: boolean;
}

export interface EscrowRecord {
  workOrderId: string;
  token: string;
  fundedMicro: string;
  refundedMicro: string;
  completionPaidMicro: string;
  holdbackHeldMicro: string;
  holdbackReleasedMicro: string;
  isDemo: boolean;
}

export interface PaymentRecord extends Omit<Payment, 'status'> {
  status: PaymentState;
  createdAt: string;
  /** Replay commands are labelled so no viewer mistakes them for a live transfer. */
  label?: string;
  isDemo: boolean;
}

export interface WarrantyCaseRecord {
  id: string;
  workOrderId: string;
  failedInspectionId: string;
  state: 'OPEN' | 'REMEDIATING' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  isDemo: boolean;
}

export interface AgentRecord {
  account: string;
  role: Role;
  keyKind: 'FUNCTION_CALL' | 'HUMAN_WALLET' | 'CONTRACT';
  allowedReceiver: string;
  allowedMethods: string[];
  allowanceMicro?: string;
  canReleaseEscrow: false;
  label: string;
  isDemo: boolean;
}

export interface AttestationRecord {
  id: string;
  kind: 'NEAR_AI' | 'OUTLAYER' | 'DAO' | 'TRANSACTION' | 'HUMAN' | 'LOCAL_REPLAY';
  subjectHash: string;
  artifact: Record<string, unknown>;
  artifactHash: string;
  signature?: string;
  verified: boolean;
  unavailableReason?: string;
  createdAt: string;
  isDemo: boolean;
}

export interface IntentQuoteRecord {
  id: string;
  dry: boolean;
  srcChain: string;
  srcAsset: string;
  dstChain: 'near';
  dstAsset: string;
  amountIn: string;
  amountOut: string;
  feesUsd?: number;
  recipient: string;
  depositAddress?: string;
  depositMemo?: string;
  deadline?: string;
  status: IntentStatus;
  workOrderId?: string;
  raw?: Record<string, unknown>;
  createdAt: string;
  isDemo: boolean;
}

export interface IntentExecutionRecord {
  id: string;
  quoteId: string;
  workOrderId: string;
  status: IntentStatus;
  destinationTxHash?: string;
  explorerUrl?: string;
  updatedAt: string;
  isDemo: boolean;
}

export interface TriageSuggestionRecord {
  id: string;
  reportId: string;
  provider: string;
  model?: string;
  available: boolean;
  confidenceBps?: number;
  rationale?: string;
  duplicateCandidates: Array<{ reportId: string; scoreBps: number; reasons: string[] }>;
  scope?: string;
  attestationId?: string;
  unavailableReason?: string;
  createdAt: string;
  isDemo: boolean;
}

export interface ChainCommandRecord {
  id: string;
  workOrderId?: string;
  action: string;
  method: string;
  args: Record<string, unknown>;
  state: ChainCommandState;
  mode: WorkOrderMode;
  adapter: string;
  txHash?: string;
  errorCode?: string;
  errorMessage?: string;
  realTransaction: boolean;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

export interface AuditEventRecord {
  id: string;
  name: string;
  actor: string;
  workOrderId?: string;
  assetId?: string;
  at: string;
  data: Record<string, unknown>;
}

export interface ListFilter {
  limit?: number;
  offset?: number;
}

export interface ReportFilter extends ListFilter {
  status?: ReportStatus;
  assetId?: string;
  clusterId?: string;
}

export interface WorkOrderFilter extends ListFilter {
  status?: WorkOrderState;
  assetId?: string;
  contractorId?: string;
}

export interface AuditFilter extends ListFilter {
  workOrderId?: string;
  assetId?: string;
  name?: string;
}

export interface AssetPatch {
  publicDescription?: string;
  assetType?: Asset['assetType'];
  publicLocation?: PublicLocation;
  passportTokenId?: string;
}

export interface ReportPatch {
  status?: ReportStatus;
  clusterId?: string | null;
}

export interface ClusterPatch {
  reportIds?: string[];
  confidenceBps?: number;
  rationale?: string;
  status?: ClusterStatus;
  confirmedBy?: string;
}

export interface DaoApprovalPatch {
  state?: DaoApprovalRecord['state'];
  approvedAt?: string;
}

export interface WorkOrderPatch {
  scopeHash?: string;
  daoApprovalId?: string;
  policyHash?: string;
  budgetMicro?: string;
  status?: WorkOrderState;
  awardedBidId?: string;
  contractorId?: string;
  inspectorId?: string;
  sponsorId?: string;
  fundingTxHash?: string;
  durabilityDueAt?: string;
  commitDeadline?: string;
  revealDeadline?: string;
  pausedFrom?: WorkOrderState;
  reopenCount?: number;
  updatedAt?: string;
}

export interface PaymentPatch {
  status?: PaymentState;
  txHash?: string;
  releasedAt?: string;
}

export interface WarrantyPatch {
  state?: WarrantyCaseRecord['state'];
  closedAt?: string;
  failedInspectionId?: string;
}

export interface ChainCommandPatch {
  state?: ChainCommandState;
  txHash?: string;
  errorCode?: string;
  errorMessage?: string;
  realTransaction?: boolean;
  updatedAt?: string;
}

export interface IntentQuotePatch {
  status?: IntentStatus;
  amountOut?: string;
  feesUsd?: number;
  depositAddress?: string;
  depositMemo?: string;
  deadline?: string;
  raw?: Record<string, unknown>;
}

export interface IntentExecutionPatch {
  status?: IntentStatus;
  destinationTxHash?: string;
  explorerUrl?: string;
  updatedAt?: string;
}

export interface AuditQueryResult {
  items: AuditEventRecord[];
  total: number;
}

export interface Repository {
  readonly kind: 'memory' | 'postgres';

  ping(): Promise<boolean>;
  close(): Promise<void>;
  transaction<T>(fn: (repo: Repository) => Promise<T>): Promise<T>;
  /** Monotonic per-name sequence used to allocate human-readable IDs. */
  nextSequence(name: string): Promise<number>;

  createAsset(asset: AssetRecord): Promise<AssetRecord>;
  getAsset(id: string): Promise<AssetRecord | null>;
  listAssets(filter?: ListFilter): Promise<AssetRecord[]>;
  updateAsset(id: string, patch: AssetPatch): Promise<AssetRecord | null>;
  deleteAsset(id: string): Promise<boolean>;

  createReport(report: ReportRecord): Promise<ReportRecord>;
  getReport(id: string): Promise<ReportRecord | null>;
  listReports(filter?: ReportFilter): Promise<ReportRecord[]>;
  updateReport(id: string, patch: ReportPatch): Promise<ReportRecord | null>;
  createReportPrivate(record: ReportPrivateRecord): Promise<void>;
  getReportPrivate(reportId: string): Promise<ReportPrivateRecord | null>;
  findReportByCaseLinkHash(hash: string): Promise<ReportRecord | null>;

  createCluster(cluster: ReportClusterRecord): Promise<ReportClusterRecord>;
  getCluster(id: string): Promise<ReportClusterRecord | null>;
  listClusters(filter?: ListFilter): Promise<ReportClusterRecord[]>;
  updateCluster(id: string, patch: ClusterPatch): Promise<ReportClusterRecord | null>;

  createDaoApproval(approval: DaoApprovalRecord): Promise<DaoApprovalRecord>;
  getDaoApproval(id: string): Promise<DaoApprovalRecord | null>;
  listDaoApprovals(filter?: ListFilter): Promise<DaoApprovalRecord[]>;
  updateDaoApproval(id: string, patch: DaoApprovalPatch): Promise<DaoApprovalRecord | null>;

  createWorkOrder(workOrder: WorkOrderRecord): Promise<WorkOrderRecord>;
  getWorkOrder(id: string): Promise<WorkOrderRecord | null>;
  listWorkOrders(filter?: WorkOrderFilter): Promise<WorkOrderRecord[]>;
  updateWorkOrder(id: string, patch: WorkOrderPatch): Promise<WorkOrderRecord | null>;

  createBidCommitment(commitment: BidCommitmentRecord): Promise<BidCommitmentRecord>;
  getBidCommitment(workOrderId: string, bidId: string): Promise<BidCommitmentRecord | null>;
  listBidCommitments(workOrderId: string): Promise<BidCommitmentRecord[]>;
  createBidReveal(reveal: BidRevealRecord): Promise<BidRevealRecord>;
  getBidReveal(workOrderId: string, bidId: string): Promise<BidRevealRecord | null>;
  listBidReveals(workOrderId: string): Promise<BidRevealRecord[]>;

  createScoreExecution(score: ScoreExecutionRecord): Promise<ScoreExecutionRecord>;
  getScoreExecution(id: string): Promise<ScoreExecutionRecord | null>;
  listScoreExecutions(workOrderId: string): Promise<ScoreExecutionRecord[]>;
  getLatestScoreExecution(workOrderId: string): Promise<ScoreExecutionRecord | null>;

  createEvidencePackage(pkg: EvidencePackageRecord): Promise<EvidencePackageRecord>;
  getEvidencePackage(id: string): Promise<EvidencePackageRecord | null>;
  listEvidencePackages(workOrderId: string): Promise<EvidencePackageRecord[]>;
  createEvidenceObject(object: EvidenceObjectRecord): Promise<EvidenceObjectRecord>;
  getEvidenceObject(id: string): Promise<EvidenceObjectRecord | null>;
  listEvidenceObjects(evidencePackageId: string): Promise<EvidenceObjectRecord[]>;

  createInspection(inspection: InspectionRecord): Promise<InspectionRecord>;
  getInspection(id: string): Promise<InspectionRecord | null>;
  listInspections(workOrderId: string): Promise<InspectionRecord[]>;

  upsertEscrow(escrow: EscrowRecord): Promise<EscrowRecord>;
  getEscrow(workOrderId: string): Promise<EscrowRecord | null>;

  createPayment(payment: PaymentRecord): Promise<PaymentRecord>;
  getPayment(id: string): Promise<PaymentRecord | null>;
  listPayments(workOrderId: string): Promise<PaymentRecord[]>;
  updatePayment(id: string, patch: PaymentPatch): Promise<PaymentRecord | null>;

  createWarrantyCase(warranty: WarrantyCaseRecord): Promise<WarrantyCaseRecord>;
  getWarrantyCase(id: string): Promise<WarrantyCaseRecord | null>;
  listWarrantyCases(workOrderId: string): Promise<WarrantyCaseRecord[]>;
  updateWarrantyCase(id: string, patch: WarrantyPatch): Promise<WarrantyCaseRecord | null>;

  upsertAgent(agent: AgentRecord): Promise<AgentRecord>;
  getAgent(account: string, role: Role): Promise<AgentRecord | null>;
  listAgents(filter?: ListFilter): Promise<AgentRecord[]>;

  createAttestation(attestation: AttestationRecord): Promise<AttestationRecord>;
  getAttestation(id: string): Promise<AttestationRecord | null>;
  listAttestationsBySubject(subjectHash: string): Promise<AttestationRecord[]>;

  createIntentQuote(quote: IntentQuoteRecord): Promise<IntentQuoteRecord>;
  getIntentQuote(id: string): Promise<IntentQuoteRecord | null>;
  listIntentQuotes(filter?: ListFilter): Promise<IntentQuoteRecord[]>;
  updateIntentQuote(id: string, patch: IntentQuotePatch): Promise<IntentQuoteRecord | null>;
  createIntentExecution(execution: IntentExecutionRecord): Promise<IntentExecutionRecord>;
  getIntentExecution(id: string): Promise<IntentExecutionRecord | null>;
  listIntentExecutions(workOrderId: string): Promise<IntentExecutionRecord[]>;

  createTriageSuggestion(suggestion: TriageSuggestionRecord): Promise<TriageSuggestionRecord>;
  getTriageSuggestion(id: string): Promise<TriageSuggestionRecord | null>;
  listTriageSuggestions(reportId: string): Promise<TriageSuggestionRecord[]>;

  createChainCommand(command: ChainCommandRecord): Promise<ChainCommandRecord>;
  getChainCommand(id: string): Promise<ChainCommandRecord | null>;
  listChainCommands(workOrderId: string): Promise<ChainCommandRecord[]>;
  updateChainCommand(id: string, patch: ChainCommandPatch): Promise<ChainCommandRecord | null>;

  /** Append-only. No update or delete method exists by design. */
  appendAudit(event: AuditEventRecord): Promise<AuditEventRecord>;
  listAudit(filter?: AuditFilter): Promise<AuditEventRecord[]>;

  markEventProcessed(eventKey: string, source: string): Promise<boolean>;
  getIndexerCursor(source: string): Promise<string | null>;
  setIndexerCursor(source: string, cursor: string): Promise<void>;
  resetIndexerState(source?: string): Promise<void>;

  /** Deletes only rows explicitly marked as demo data. */
  clearDemoData(): Promise<void>;

  /**
   * Deletes the entire public read model and indexer bookkeeping. Audit events
   * are append-only and intentionally survive. Used only by an explicit
   * read-model rebuild, never by an API request.
   */
  clearReadModel(): Promise<void>;

  listTablesForDiagnostics?(): Promise<string[]>;
}

import { z } from 'zod';
import { ROLES, WORK_ORDER_MODES } from './constants.js';
import { NEAR_ACCOUNT_PATTERN } from './ids.js';
import { WORK_ORDER_STATES } from './state-machine.js';

const datetime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'invalid ISO datetime');
const microAmount = z.string().regex(/^\d+$/, 'amount must be integer micro-units');
const hash = z.string().regex(/^[a-f0-9]{64}$/, 'must be lowercase sha256 hex');
const account = z.string().min(2).max(64).regex(NEAR_ACCOUNT_PATTERN, 'invalid NEAR account');
const bps = z.number().int().min(0).max(10_000);

export const RoleSchema = z.enum(ROLES);
export const ModeSchema = z.enum(WORK_ORDER_MODES);
export const WorkOrderStateSchema = z.enum(WORK_ORDER_STATES);

export const PublicLocationSchema = z.object({
  label: z.string().min(1).max(200),
  coarseLat: z.number().min(-90).max(90),
  coarseLng: z.number().min(-180).max(180),
  /** Optional city/neighbourhood; never exact coordinates. */
  area: z.string().max(200).optional(),
});

export const AssetSchema = z.object({
  id: z.string().regex(/^[A-Z]{2,12}-\d{3}$/),
  publicDescription: z.string().min(1).max(2000),
  assetType: z.enum(['bench', 'bicycle_rack', 'fence', 'door', 'playground', 'other']),
  publicLocation: PublicLocationSchema,
  passportTokenId: z.string().optional(),
  createdAt: datetime,
});

export const ReportSchema = z.object({
  id: z.string().regex(/^R-\d{3}$/),
  assetId: z.string(),
  description: z.string().min(1).max(4000),
  publicLocation: PublicLocationSchema,
  /** Private precise location is stored off-chain only. */
  preciseLocationRef: z.string().optional(),
  reporterCaseLink: z.string().min(16),
  redactedMediaHash: hash.optional(),
  perceptualHash: z.string().min(8).max(128).optional(),
  exifStripped: z.boolean(),
  status: z.enum(['SUBMITTED', 'TRIAGED', 'CLUSTERED', 'DUPLICATE', 'ACCEPTED']),
  clusterId: z.string().optional(),
  createdAt: datetime,
});

export const ReportClusterSchema = z.object({
  id: z.string().regex(/^CL-\d{4}$/),
  reportIds: z.array(z.string()).min(1),
  confidenceBps: bps,
  rationale: z.string().max(2000),
  status: z.enum(['SUGGESTED', 'CONFIRMED', 'REJECTED']),
  confirmedBy: account.optional(),
  createdAt: datetime,
});

export const DaoApprovalSchema = z.object({
  id: z.string(),
  daoAccount: account,
  proposalId: z.string().regex(/^\d{1,10}$/),
  budgetMicro: microAmount,
  contractorRoster: z.array(account).min(1),
  inspectorRoster: z.array(account).min(1),
  policyHash: hash,
  state: z.enum(['PROPOSED', 'APPROVED', 'REJECTED', 'EXPIRED']),
  approvedAt: datetime.optional(),
});

export const WorkOrderSchema = z.object({
  id: z.string().regex(/^WO-[A-Z0-9-]+-\d{4}$/),
  assetId: z.string(),
  reportClusterId: z.string(),
  scopeHash: hash,
  daoApprovalId: z.string(),
  policyHash: hash,
  budgetMicro: microAmount,
  status: WorkOrderStateSchema,
  mode: ModeSchema,
  awardedBidId: z.string().optional(),
  contractorId: account.optional(),
  inspectorId: account.optional(),
  fundingToken: account,
  fundingTxHash: z.string().optional(),
  durabilityDueAt: datetime.optional(),
  reopenCount: z.number().int().min(0).default(0),
  createdAt: datetime,
  updatedAt: datetime,
});

export const BidCommitmentSchema = z.object({
  workOrderId: z.string(),
  bidId: z.string().regex(/^BID-[A-Z]-[A-Z0-9-]+$/),
  contractorId: account,
  commitmentHash: hash,
  committedAt: datetime,
});

export const BidRevealSchema = z.object({
  workOrderId: z.string(),
  bidId: z.string(),
  contractorId: account,
  priceMicro: microAmount,
  durationDays: z.number().int().positive(),
  warrantyDays: z.number().int().nonnegative(),
  materials: z.string().max(1000),
  materialsScore: z.number().int().min(0).max(100),
  evidenceChecklistAccepted: z.boolean(),
  nonce: z.string().min(8).max(128),
  revealedAt: datetime,
  commitmentHash: hash,
});

export const ScoredRankSchema = z.object({
  rank: z.number().int().positive(),
  bidId: z.string(),
  contractorId: account,
  scoreBps: bps,
});

export const ScoreExecutionSchema = z.object({
  id: z.string(),
  workOrderId: z.string(),
  policyHash: hash,
  wasmHash: hash,
  inputHash: hash,
  outputHash: hash,
  ranking: z.array(ScoredRankSchema).min(1),
  executionRef: z.string().optional(),
  verified: z.boolean(),
  unavailableReason: z.string().optional(),
  createdAt: datetime,
});

export const EvidencePackageSchema = z.object({
  id: z.string(),
  workOrderId: z.string(),
  kind: z.enum(['COMPLETION', 'REMEDIATION', 'DURABILITY']),
  evidenceHashes: z.array(hash).min(1),
  checklist: z.record(z.string(), z.boolean()),
  redacted: z.literal(true),
  submittedBy: account,
  submittedAt: datetime,
});

export const InspectionSchema = z.object({
  id: z.string(),
  workOrderId: z.string(),
  kind: z.enum(['COMPLETION', 'DURABILITY', 'REMEDIATION']),
  inspectorId: account,
  decision: z.enum(['APPROVED', 'REJECTED']),
  evidencePackageId: z.string(),
  notesHash: hash.optional(),
  signedAt: datetime,
  txHash: z.string().optional(),
});

export const EscrowAccountSchema = z.object({
  workOrderId: z.string(),
  token: account,
  fundedMicro: microAmount,
  refundedMicro: microAmount,
  completionPaidMicro: microAmount,
  holdbackHeldMicro: microAmount,
  holdbackReleasedMicro: microAmount,
});

export const PaymentSchema = z.object({
  id: z.string(),
  workOrderId: z.string(),
  kind: z.enum(['COMPLETION', 'HOLDBACK', 'REFUND']),
  amountMicro: microAmount,
  recipient: account,
  status: z.enum(['INTENT', 'PENDING', 'SUCCESS', 'FAILED']),
  txHash: z.string().optional(),
  releasedAt: datetime.optional(),
});

export const WarrantyCaseSchema = z.object({
  id: z.string(),
  workOrderId: z.string(),
  failedInspectionId: z.string(),
  state: z.enum(['OPEN', 'REMEDIATING', 'CLOSED']),
  openedAt: datetime,
  closedAt: datetime.optional(),
});

export const AgentIdentitySchema = z.object({
  account,
  role: RoleSchema,
  keyKind: z.enum(['FUNCTION_CALL', 'HUMAN_WALLET', 'CONTRACT']),
  allowedReceiver: account,
  allowedMethods: z.array(z.string()).min(1),
  allowanceMicro: microAmount.optional(),
  canReleaseEscrow: z.literal(false),
  label: z.string(),
});

export const AttestationSchema = z.object({
  id: z.string(),
  kind: z.enum(['NEAR_AI', 'OUTLAYER', 'DAO', 'TRANSACTION', 'HUMAN']),
  subjectHash: hash,
  evidence: z.record(z.string(), z.unknown()),
  signature: z.string().optional(),
  verified: z.boolean(),
  unavailableReason: z.string().optional(),
  createdAt: datetime,
});

export const IntentStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'INCOMPLETE', 'EXPIRED']);

export const IntentQuoteSchema = z.object({
  id: z.string(),
  dry: z.boolean(),
  srcChain: z.string(),
  srcAsset: z.string(),
  dstChain: z.literal('near'),
  dstAsset: z.string(),
  amountIn: z.string(),
  amountOut: z.string(),
  feesUsd: z.number().nonnegative().optional(),
  recipient: account,
  depositAddress: z.string().optional(),
  depositMemo: z.string().optional(),
  deadline: datetime.optional(),
  status: IntentStatusSchema,
  createdAt: datetime,
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const IntentExecutionSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  workOrderId: z.string(),
  status: IntentStatusSchema,
  destinationTxHash: z.string().optional(),
  explorerUrl: z.string().url().optional(),
  updatedAt: datetime,
});

export const AuditEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  actor: z.string(),
  workOrderId: z.string().optional(),
  assetId: z.string().optional(),
  at: datetime,
  data: z.record(z.string(), z.unknown()),
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type Asset = z.infer<typeof AssetSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ReportCluster = z.infer<typeof ReportClusterSchema>;
export type DaoApproval = z.infer<typeof DaoApprovalSchema>;
export type WorkOrder = z.infer<typeof WorkOrderSchema>;
export type BidCommitment = z.infer<typeof BidCommitmentSchema>;
export type BidReveal = z.infer<typeof BidRevealSchema>;
export type ScoreExecution = z.infer<typeof ScoreExecutionSchema>;
export type EvidencePackage = z.infer<typeof EvidencePackageSchema>;
export type Inspection = z.infer<typeof InspectionSchema>;
export type EscrowAccount = z.infer<typeof EscrowAccountSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type WarrantyCase = z.infer<typeof WarrantyCaseSchema>;
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;
export type Attestation = z.infer<typeof AttestationSchema>;
export type IntentQuote = z.infer<typeof IntentQuoteSchema>;
export type IntentExecution = z.infer<typeof IntentExecutionSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;

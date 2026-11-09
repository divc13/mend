import { z } from 'zod';
import { ASSET_ID_PATTERN, PublicLocationSchema, isNearAccount } from '@mend/protocol';

const microAmount = z.string().regex(/^\d+$/, 'amount must be integer micro-units');

export const ScopeProposalSchema = z.object({
  summary: z.string().min(1).max(2000),
  tasks: z.array(z.string().min(1).max(500)).min(1).max(50),
  safetyExclusions: z.array(z.string().min(1).max(500)).min(1).max(50),
  requiredEvidence: z.array(z.string().min(1).max(500)).min(1).max(50),
  budgetRecommendationMicro: microAmount,
  humanReviewRequired: z.literal(true),
});

export const ClusterInputSchema = z.object({
  id: z.string().regex(/^CL-\d{4}$/),
  reportIds: z.array(z.string()).min(1),
  confidenceBps: z.number().int().min(0).max(10_000),
  rationale: z.string().max(2000),
  status: z.literal('CONFIRMED'),
});

export const CoordinatorIntakeSchema = z.object({
  requestId: z.string().min(3).max(120),
  assetId: z.string().regex(ASSET_ID_PATTERN),
  assetType: z.enum(['bench', 'bicycle_rack', 'fence', 'door', 'playground', 'other']),
  publicDescription: z.string().min(1).max(4000),
  publicLocation: PublicLocationSchema,
  cluster: ClusterInputSchema,
  scope: ScopeProposalSchema,
  requestedBy: z.string().refine(isNearAccount, 'invalid NEAR account'),
  mode: z.enum(['LIVE_TESTNET', 'MAINNET', 'REPLAY']).default('REPLAY'),
  sequence: z.number().int().min(1).max(9999).default(1),
});

export type CoordinatorIntake = z.infer<typeof CoordinatorIntakeSchema>;
export type ScopeProposal = z.infer<typeof ScopeProposalSchema>;

export const CoordinatorOutputSchema = z.object({
  requestId: z.string(),
  draftAsset: z.object({
    id: z.string(),
    publicDescription: z.string(),
    assetType: z.enum(['bench', 'bicycle_rack', 'fence', 'door', 'playground', 'other']),
    publicLocation: PublicLocationSchema,
    createdAt: z.string(),
  }),
  draftWorkOrder: z.object({
    id: z.string(),
    assetId: z.string(),
    reportClusterId: z.string(),
    scopeHash: z.string(),
    daoApprovalId: z.string(),
    policyHash: z.string(),
    budgetMicro: microAmount,
    status: z.literal('DRAFT'),
    mode: z.enum(['LIVE_TESTNET', 'MAINNET', 'REPLAY']),
    fundingToken: z.string(),
    reopenCount: z.number().int().min(0),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  scope: ScopeProposalSchema.extend({ scopeHash: z.string() }),
  auditEvents: z.array(z.record(z.string(), z.unknown())).min(1),
  humanApprovalRequired: z.literal(true),
});

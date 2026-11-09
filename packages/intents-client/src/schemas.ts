import { z } from 'zod';

/**
 * Wire schemas for the 1Click Swap API (NEAR Intents distribution channel).
 *
 * Pinned to OpenAPI v0 / spec 0.1.10 and SDK 0.1.26. Fields are only those
 * documented or observed in orchestration/research/R0-C-intents.md. Unknown
 * fields are stripped from parsed values but the raw JSON is always retained
 * by the client for diagnostics and signature verification.
 *
 * MAINNET ONLY: every quote, deposit address and status is a real mainnet
 * object. There is no testnet.
 */

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'invalid ISO datetime');
const integerString = z.string().regex(/^\d+$/, 'amount must be an integer string in base units');

export const SWAP_TYPES = ['EXACT_INPUT', 'EXACT_OUTPUT', 'FLEX_INPUT', 'ANY_INPUT'] as const;
export const DEPOSIT_TYPES = ['ORIGIN_CHAIN', 'INTENTS', 'CONFIDENTIAL_INTENTS'] as const;
export const RECIPIENT_TYPES = ['DESTINATION_CHAIN', 'INTENTS', 'CONFIDENTIAL_INTENTS'] as const;
export const CONFIDENTIALITY_LEVELS = ['public', 'basic', 'advanced'] as const;

/** Exact documented execution-status enum. There is no EXPIRED status. */
export const EXECUTION_STATUSES = [
  'PENDING_DEPOSIT',
  'KNOWN_DEPOSIT_TX',
  'PROCESSING',
  'SUCCESS',
  'INCOMPLETE_DEPOSIT',
  'REFUNDED',
  'FAILED',
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/** MEND's six client-facing states (mirrors @mend/protocol IntentStatusSchema). */
export const MEND_INTENT_STATES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'INCOMPLETE', 'EXPIRED'] as const;
export type MendIntentState = (typeof MEND_INTENT_STATES)[number];

export const AppFeeSchema = z.object({
  recipient: z.string().min(1),
  fee: z.number().int().min(0).max(10_000),
  limitOrderId: z.string().nullable().optional(),
});
export type AppFee = z.infer<typeof AppFeeSchema>;

export const TokenResponseSchema = z.object({
  assetId: z.string().min(1),
  decimals: z.number().int().min(0).max(36),
  blockchain: z.string().min(1),
  symbol: z.string().min(1),
  price: z.number().finite().nonnegative(),
  priceUpdatedAt: isoDateTime,
  contractAddress: z.string().optional(),
  coingeckoId: z.string().optional(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const QuoteRequestSchema = z.object({
  dry: z.boolean(),
  swapType: z.enum(SWAP_TYPES),
  slippageTolerance: z.number().int().min(0).max(10_000),
  originAsset: z.string().min(1),
  depositType: z.enum(DEPOSIT_TYPES),
  destinationAsset: z.string().min(1),
  amount: integerString,
  refundTo: z.string().min(1),
  refundType: z.enum(DEPOSIT_TYPES),
  recipient: z.string().min(1),
  recipientType: z.enum(RECIPIENT_TYPES),
  deadline: isoDateTime,
  depositMode: z.string().optional(),
  connectedWallets: z.array(z.string()).optional(),
  sessionId: z.string().nullable().optional(),
  virtualChainRecipient: z.string().nullable().optional(),
  virtualChainRefundRecipient: z.string().nullable().optional(),
  customRecipientMsg: z.string().nullable().optional(),
  confidentiality: z.enum(CONFIDENTIALITY_LEVELS).optional(),
  referral: z.string().nullable().optional(),
  rebates: z.array(z.unknown()).optional(),
  quoteWaitingTimeMs: z.number().optional(),
  appFees: z.array(AppFeeSchema).optional(),
  insured: z.boolean().optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const QuoteSchema = z.object({
  amountIn: integerString,
  amountInFormatted: z.string(),
  amountInUsd: z.string(),
  minAmountIn: integerString,
  amountOut: integerString,
  amountOutFormatted: z.string(),
  amountOutUsd: z.string(),
  minAmountOut: integerString,
  timeEstimate: z.number().optional(),
  refundFee: z.string().optional(),
  withdrawFee: z.string().optional(),
  /** Omitted when dry:true. */
  depositAddress: z.string().optional(),
  /** Mandatory when present. */
  depositMemo: z.string().optional(),
  /** Omitted when dry:true. */
  deadline: isoDateTime.optional(),
  /** Omitted when dry:true. */
  timeWhenInactive: isoDateTime.optional(),
  virtualChainRecipient: z.string().nullable().optional(),
  virtualChainRefundRecipient: z.string().nullable().optional(),
  customRecipientMsg: z.string().nullable().optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const QuoteResponseSchema = z.object({
  /** Present on /v0/quote responses; not always echoed in status.quoteResponse. */
  correlationId: z.string().optional(),
  timestamp: isoDateTime,
  signature: z.string().regex(/^ed25519:/, 'signature must start with ed25519:'),
  quoteRequest: QuoteRequestSchema,
  quote: QuoteSchema,
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

export const TxHashSchema = z.object({
  hash: z.string().min(1),
  /** Live API returned an empty string even on SUCCESS. */
  explorerUrl: z.string().optional().default(''),
});
export type TxHash = z.infer<typeof TxHashSchema>;

const nullableAmount = z.string().nullable().optional();

export const SwapDetailsSchema = z.object({
  depositedAmount: nullableAmount,
  depositedAmountFormatted: nullableAmount,
  depositedAmountUsd: nullableAmount,
  intentHashes: z.array(z.string()).optional().default([]),
  nearTxHashes: z.array(z.string()).optional().default([]),
  amountIn: nullableAmount,
  amountInFormatted: nullableAmount,
  amountInUsd: nullableAmount,
  amountOut: nullableAmount,
  amountOutFormatted: nullableAmount,
  amountOutUsd: nullableAmount,
  slippage: z.number().nullable().optional(),
  refundedAmount: z.string().optional(),
  refundedAmountFormatted: z.string().optional(),
  refundedAmountUsd: z.string().optional(),
  refundReason: z.string().nullable().optional(),
  /** Live field, not in OpenAPI SwapDetails; tolerated. */
  refundFee: z.string().optional(),
  withdrawFee: z.string().optional(),
  originChainTxHashes: z.array(TxHashSchema).optional().default([]),
  destinationChainTxHashes: z.array(TxHashSchema).optional().default([]),
});
export type SwapDetails = z.infer<typeof SwapDetailsSchema>;

export const ExecutionStatusResponseSchema = z.object({
  /**
   * Deliberately a string, not the enum: an unknown future value must pass
   * shape validation and then fail closed in the status tracker as INCOMPLETE.
   */
  status: z.string().min(1),
  updatedAt: isoDateTime,
  correlationId: z.string().optional(),
  swapDetails: SwapDetailsSchema,
  /** Signed original quote. Absent in some recorded excerpts. */
  quoteResponse: QuoteResponseSchema.optional(),
});
export type ExecutionStatusResponse = z.infer<typeof ExecutionStatusResponseSchema>;

export const IntentsErrorBodySchema = z.object({
  message: z.string().optional(),
  error: z.string().optional(),
  statusCode: z.number().optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
  correlationId: z.string().optional(),
});
export type IntentsErrorBody = z.infer<typeof IntentsErrorBodySchema>;

export function isKnownExecutionStatus(value: string): value is ExecutionStatus {
  return (EXECUTION_STATUSES as readonly string[]).includes(value);
}

export function isMendIntentState(value: string): value is MendIntentState {
  return (MEND_INTENT_STATES as readonly string[]).includes(value);
}

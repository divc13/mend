/**
 * MEND protocol constants. All monetary amounts are integer micro-units
 * (stablecoin with 6 decimals). 1 USDC = 1_000_000 micro.
 */

export const USDC_DECIMALS = 6 as const;
export const MICRO_PER_USD = 10n ** BigInt(USDC_DECIMALS);

export const BPS_DENOMINATOR = 10_000 as const;
export const COMPLETION_BPS = 9_000 as const; // 90%
export const HOLDBACK_BPS = 1_000 as const; // 10%

export const WORK_ORDER_MODES = ['LIVE_TESTNET', 'MAINNET', 'REPLAY'] as const;
export type WorkOrderMode = (typeof WORK_ORDER_MODES)[number];

export const ROLES = [
  'REPORTER',
  'STEWARD',
  'SPONSOR',
  'CONTRACTOR',
  'INSPECTOR',
  'DAO',
  'COORDINATOR_AI',
  'REVIEWER_AI',
  'RELAYER',
  'ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that may never move money or self-approve. */
export const NON_AUTHORIZING_AI_ROLES: readonly Role[] = ['COORDINATOR_AI', 'REVIEWER_AI'];

/** Canonical demo scoring policy weights in basis points. Must total 10_000. */
export const DEFAULT_SCORING_POLICY_BPS = {
  price: 4_500,
  warranty: 2_500,
  duration: 2_000,
  materials: 1_000,
} as const;

export const SCORING_POLICY_VERSION = 'mend-bid-policy-v1' as const;

/** Demo durability interval. Explicitly configured, never a hidden backdoor. */
export const DEMO_DURABILITY_INTERVAL_MINUTES = 2 as const;

/** Canonical pilot fixture amounts (micro-units). */
export const CANONICAL_AMOUNTS = {
  sponsorBudget: 100_000_000n, // 100 USDC
  winningBid: 80_000_000n, // 80 USDC
  refund: 20_000_000n, // 20 USDC
  completionPayment: 72_000_000n, // 72 USDC
  durabilityHoldback: 8_000_000n, // 8 USDC
} as const;

export const HUB_METHODS = {
  createWorkOrder: 'create_work_order',
  approvePolicy: 'approve_policy',
  fundWorkOrder: 'fund_work_order',
  openBidding: 'open_bidding',
  closeBidding: 'close_bidding',
  commitBid: 'commit_bid',
  revealBid: 'reveal_bid',
  recordScore: 'record_score',
  award: 'award',
  submitCompletion: 'submit_completion',
  acceptCompletion: 'accept_completion',
  inspectDurability: 'inspect_durability',
  openDispute: 'open_dispute',
  resolveDispute: 'resolve_dispute',
  refund: 'refund',
  pause: 'pause',
  unpause: 'unpause',
  mintPassport: 'mint_passport',
  nftTransfer: 'nft_transfer',
} as const;

/** Methods a relayer is allowed to forward. Never arbitrary contracts. */
export const RELAYABLE_METHODS: readonly string[] = [
  HUB_METHODS.createWorkOrder,
  HUB_METHODS.commitBid,
  HUB_METHODS.revealBid,
  HUB_METHODS.submitCompletion,
] as const;

export const TESTNET_HUB_ACCOUNT = 'mend-hub.testnet' as const;
export const TESTNET_TOKEN_ACCOUNT = 'mend-usdc.testnet' as const;

export const REPLAY_LABEL = 'REPLAY / SIMULATION' as const;
export const MAINNET_LABEL = 'MAINNET — REAL FUNDS' as const;
export const TESTNET_LABEL = 'LIVE TESTNET — TEST VALUE ONLY' as const;

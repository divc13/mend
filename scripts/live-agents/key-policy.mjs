/**
 * Live scoped-key policy. Mirrors AGENT_KEY_METHODS and AGENT_FORBIDDEN_METHODS
 * in packages/near-client/src/provisioning.ts. The near-client unit test
 * `scoped-key-policy.test.ts` guards this copy against drift.
 */
export const HUB_ACCOUNT = 'mend-hub.testnet';
export const NETWORK = 'testnet';
export const RPC_URL = process.env.MEND_RPC_URL ?? 'https://rpc.testnet.fastnear.com';

/** 0.05 NEAR of gas allowance per key. Small, finite and auditable. */
export const ALLOWANCE_NEAR = '0.05';
export const ALLOWANCE_YOCTO = '50000000000000000000000';

export const AGENT_KEY_METHODS = {
  COORDINATOR_AI: ['create_asset', 'create_work_order'],
  CONTRACTOR: ['commit_bid', 'reveal_bid', 'submit_completion'],
  INSPECTOR: ['accept_completion', 'inspect_durability'],
};

export const NEVER_AGENT_METHODS = [
  'set_role',
  'pause',
  'unpause',
  'dao_authorize',
  'approve_policy',
  'fund_work_order',
  'ft_transfer',
  'ft_transfer_call',
  'storage_deposit',
  'resolve_dispute',
  'mint_passport',
  'nft_transfer',
  'nft_transfer_call',
  'nft_approve',
];

const BID_AND_PAYMENT_DENIALS = [
  'award',
  'accept_completion',
  'inspect_durability',
  'refund',
  'open_dispute',
  'cancel_work_order',
  'record_score',
  'open_bidding',
  'close_bidding',
];

export const AGENT_FORBIDDEN_METHODS = {
  COORDINATOR_AI: [...NEVER_AGENT_METHODS, ...BID_AND_PAYMENT_DENIALS],
  CONTRACTOR: [...NEVER_AGENT_METHODS, ...BID_AND_PAYMENT_DENIALS],
  INSPECTOR: [
    ...NEVER_AGENT_METHODS,
    'award',
    'commit_bid',
    'reveal_bid',
    'start_work',
    'submit_completion',
    'refund',
    'open_dispute',
    'cancel_work_order',
    'record_score',
    'open_bidding',
    'close_bidding',
  ],
};

/** Evidence targets: every listed method must be absent from the key scope. */
export const BOUNDARY_TARGETS = {
  CONTRACTOR: ['accept_completion', 'inspect_durability', 'refund'],
  INSPECTOR: ['award', 'commit_bid'],
  COORDINATOR_AI: ['award', 'accept_completion', 'refund'],
};

/** Accounts that receive a scoped key, in deterministic reporting order. */
export const SCOPED_KEY_TARGETS = [
  { accountId: 'mend-contractor-a.testnet', role: 'CONTRACTOR' },
  { accountId: 'mend-contractor-b.testnet', role: 'CONTRACTOR' },
  { accountId: 'mend-contractor-c.testnet', role: 'CONTRACTOR' },
  { accountId: 'mend-contractor-d.testnet', role: 'CONTRACTOR' },
  { accountId: 'mend-contractor-e.testnet', role: 'CONTRACTOR' },
  { accountId: 'mend-inspector.testnet', role: 'INSPECTOR' },
  { accountId: 'mend-inspector-2.testnet', role: 'INSPECTOR' },
  { accountId: 'mend-coordinator-ai.testnet', role: 'COORDINATOR_AI' },
];

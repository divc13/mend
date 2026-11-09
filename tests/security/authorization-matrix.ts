import { HUB_METHODS, RELAYABLE_METHODS, ROLES, type Role } from '@mend/protocol';

/** Anonymous callers are a first-class column in the authorization matrix. */
export const SUBJECTS = ['ANON', ...ROLES, 'ORACLE', 'OWNER'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const MUTATING_HUB_METHODS = [
  HUB_METHODS.createWorkOrder,
  'create_asset',
  HUB_METHODS.approvePolicy,
  'dao_authorize',
  HUB_METHODS.fundWorkOrder,
  'ft_on_transfer',
  HUB_METHODS.openBidding,
  HUB_METHODS.closeBidding,
  HUB_METHODS.commitBid,
  HUB_METHODS.revealBid,
  HUB_METHODS.recordScore,
  'request_score',
  HUB_METHODS.award,
  'start_work',
  HUB_METHODS.submitCompletion,
  HUB_METHODS.acceptCompletion,
  HUB_METHODS.inspectDurability,
  HUB_METHODS.openDispute,
  HUB_METHODS.resolveDispute,
  'cancel_work_order',
  HUB_METHODS.refund,
  HUB_METHODS.pause,
  HUB_METHODS.unpause,
  'set_role',
  'set_outlayer_config',
  HUB_METHODS.mintPassport,
  HUB_METHODS.nftTransfer,
] as const;
export type MutatingHubMethod = (typeof MUTATING_HUB_METHODS)[number];

/**
 * Expected authority for a direct call whose NEAR predecessor is the subject.
 * This mirrors the contract's separation of duties and the protocol's relayer
 * allowlist. It is deliberately conservative: anything not listed is denied.
 */
export const ALLOWED: Readonly<Record<MutatingHubMethod, readonly Subject[]>> = {
  create_work_order: ['STEWARD', 'COORDINATOR_AI'],
  create_asset: ['STEWARD', 'COORDINATOR_AI'],
  approve_policy: ['DAO', 'OWNER'],
  dao_authorize: ['DAO'],
  fund_work_order: [],
  ft_on_transfer: ['SPONSOR'],
  open_bidding: ['STEWARD'],
  close_bidding: ['STEWARD'],
  commit_bid: ['CONTRACTOR', 'RELAYER'],
  reveal_bid: ['CONTRACTOR', 'RELAYER'],
  record_score: ['STEWARD', 'ORACLE'],
  request_score: ['STEWARD'],
  award: ['STEWARD'],
  start_work: ['CONTRACTOR'],
  submit_completion: ['CONTRACTOR', 'RELAYER'],
  accept_completion: ['INSPECTOR'],
  inspect_durability: ['INSPECTOR'],
  open_dispute: ['STEWARD', 'INSPECTOR', 'CONTRACTOR'],
  resolve_dispute: ['DAO'],
  cancel_work_order: ['STEWARD'],
  refund: ['STEWARD', 'DAO'],
  pause: ['OWNER', 'DAO'],
  unpause: ['OWNER', 'DAO'],
  set_role: ['OWNER', 'DAO'],
  set_outlayer_config: ['OWNER', 'DAO'],
  mint_passport: ['STEWARD'],
  nft_transfer: [],
};

const MONEY_OR_AUTHORITY_METHODS: readonly MutatingHubMethod[] = [
  'award',
  'accept_completion',
  'inspect_durability',
  'refund',
  'resolve_dispute',
  'record_score',
  'request_score',
  'set_role',
  'pause',
  'unpause',
  'set_outlayer_config',
  'dao_authorize',
  'cancel_work_order',
  'submit_completion',
  'start_work',
  'fund_work_order',
  'ft_on_transfer',
  'nft_transfer',
];

export function isAllowed(method: MutatingHubMethod, subject: Subject): boolean {
  return ALLOWED[method].includes(subject);
}

export function matrixCells(): Array<{ method: MutatingHubMethod; subject: Subject; allowed: boolean }> {
  return MUTATING_HUB_METHODS.flatMap((method) =>
    SUBJECTS.map((subject) => ({ method, subject, allowed: isAllowed(method, subject) })),
  );
}

export const AI_SUBJECTS = ['COORDINATOR_AI', 'REVIEWER_AI'] as const;

export function assertMatrixInvariants(): string[] {
  const problems: string[] = [];

  for (const method of MUTATING_HUB_METHODS) {
    if (!(method in ALLOWED)) problems.push(`missing matrix row for ${method}`);
    if (ALLOWED[method].length === 0) continue;
    for (const subject of AI_SUBJECTS) {
      if (MONEY_OR_AUTHORITY_METHODS.includes(method) && ALLOWED[method].includes(subject)) {
        problems.push(`AI role ${subject} is allowed to call ${method}`);
      }
    }
    for (const subject of ALLOWED[method]) {
      if (!SUBJECTS.includes(subject)) problems.push(`unknown subject ${subject} for ${method}`);
    }
  }

  // Contractor and inspector authority must not overlap on acceptance/award.
  if (ALLOWED.accept_completion.includes('CONTRACTOR')) problems.push('contractor may accept completion');
  if (ALLOWED.award.includes('INSPECTOR')) problems.push('inspector may award');
  if (ALLOWED.refund.includes('CONTRACTOR') || ALLOWED.refund.includes('INSPECTOR')) {
    problems.push('non-financial role may refund');
  }

  // The relayer is restricted to the protocol allowlist, never award/refund.
  for (const method of MUTATING_HUB_METHODS) {
    if (!RELAYABLE_METHODS.includes(method) && ALLOWED[method].includes('RELAYER')) {
      problems.push(`relayer may call non-relayable method ${method}`);
    }
  }

  // Roles whose mutations happen outside the hub (walletless report intake) or
  // who are intentionally read-only. Listed explicitly so a new role cannot be
  // forgotten silently.
  const noDirectHubMutation: readonly Subject[] = ['ANON', 'REPORTER', 'REVIEWER_AI', 'ADMIN'];
  for (const role of ROLES) {
    const hasMutation = MUTATING_HUB_METHODS.some((method) => ALLOWED[method].includes(role));
    if (!hasMutation && !noDirectHubMutation.includes(role)) {
      problems.push(`role ${role} has no possible hub mutation and is not in the documented exception list`);
    }
  }

  return problems;
}

export function roleMatrixFor(method: MutatingHubMethod): Record<Subject, boolean> {
  return Object.fromEntries(SUBJECTS.map((subject) => [subject, isAllowed(method, subject)])) as Record<
    Subject,
    boolean
  >;
}

/** Mutating HTTP operations in the frozen OpenAPI document. */
export interface ApiMutation {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  operationId: string;
  allowed: readonly Subject[];
}

export const API_MUTATIONS: readonly ApiMutation[] = [
  {
    method: 'POST',
    path: '/v1/assets',
    operationId: 'createAsset',
    allowed: ['STEWARD', 'COORDINATOR_AI', 'ADMIN'],
  },
  {
    // F01 walletless reporting: an anonymous member of the public may submit a
    // report. It can never carry a role, recipient or payment instruction.
    method: 'POST',
    path: '/v1/reports',
    operationId: 'createReport',
    // Walletless reporting: any caller may submit a report. Submission carries
    // no role, recipient, scope or payment authority.
    allowed: [...SUBJECTS],
  },
  {
    method: 'POST',
    path: '/v1/work-orders',
    operationId: 'createWorkOrder',
    allowed: ['STEWARD', 'COORDINATOR_AI', 'ADMIN'],
  },
  {
    // A quote is a preview/deposit request, never a payment or escrow credit.
    method: 'POST',
    path: '/v1/intents/quote',
    operationId: 'quoteIntent',
    allowed: ['SPONSOR', 'ADMIN'],
  },
];

export function apiMatrixCells(): Array<{ path: string; method: string; subject: Subject; allowed: boolean }> {
  return API_MUTATIONS.flatMap((operation) =>
    SUBJECTS.map((subject) => ({
      path: operation.path,
      method: operation.method,
      subject,
      allowed: operation.allowed.includes(subject),
    })),
  );
}

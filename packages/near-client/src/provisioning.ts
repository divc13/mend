import type { Role } from '@mend/protocol';
import { isNearAccount } from '@mend/protocol';
import { NearClientError } from './errors.js';
import type { AccessKeyPermissionView, AccessKeyView, AccessKeyList } from './rpc.js';

const NEAR_DECIMALS = 24n;
const NEAR_PER_YOCTO = 10n ** NEAR_DECIMALS;
const MAX_DEFAULT_ALLOWANCE = 250_000_000_000_000_000_000_000n; // 0.25 NEAR

/** Roles that may hold a hub-scoped function-call key. */
export type AgentKeyRole = 'COORDINATOR_AI' | 'CONTRACTOR' | 'INSPECTOR';

/** Explicit method lists for each agent key. No method list is ever empty. */
export const AGENT_KEY_METHODS: Readonly<Record<AgentKeyRole, readonly string[]>> = {
  COORDINATOR_AI: ['create_asset', 'create_work_order'],
  CONTRACTOR: ['commit_bid', 'reveal_bid', 'submit_completion'],
  INSPECTOR: ['accept_completion', 'inspect_durability'],
};

/** The reviewer/evidence assistant deliberately has no on-chain hub key. */
export const NO_ONCHAIN_KEY_ROLES: readonly Role[] = ['REVIEWER_AI'];

/** Administrative and money-moving methods that no agent key may ever call. */
export const NEVER_AGENT_METHODS: readonly string[] = [
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

/**
 * Role-specific denials. The human inspector key is the only agent key allowed
 * to call `accept_completion`; it must not be able to award, bid or refund.
 */
export const AGENT_FORBIDDEN_METHODS: Readonly<Record<AgentKeyRole, readonly string[]>> = {
  COORDINATOR_AI: [
    ...NEVER_AGENT_METHODS,
    'award',
    'accept_completion',
    'inspect_durability',
    'refund',
    'open_dispute',
    'cancel_work_order',
    'record_score',
    'open_bidding',
    'close_bidding',
  ],
  CONTRACTOR: [
    ...NEVER_AGENT_METHODS,
    'award',
    'accept_completion',
    'inspect_durability',
    'refund',
    'open_dispute',
    'cancel_work_order',
    'record_score',
    'open_bidding',
    'close_bidding',
  ],
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

/** Payment/acceptance methods that can move or release escrow. */
export const ESCROW_METHODS: readonly string[] = [
  'award',
  'accept_completion',
  'refund',
  'fund_work_order',
  'resolve_dispute',
  'ft_transfer',
  'ft_transfer_call',
];

export interface FunctionCallKeySpec {
  role: AgentKeyRole;
  accountId: string;
  publicKey: string;
  receiverId: string;
  methodNames: string[];
  allowanceYocto: string;
  network: 'testnet' | 'mainnet';
}

export interface FunctionCallKeyPlan {
  role: AgentKeyRole;
  spec: FunctionCallKeySpec;
  json: {
    account_id: string;
    public_key: string;
    permission: { FunctionCall: { allowance: string; receiver_id: string; method_names: string[] } };
  };
  commands: string[];
  notes: string[];
}

export interface KeyPlanInput {
  role: Role;
  accountId: string;
  publicKey: string;
  receiverId: string;
  network: 'testnet' | 'mainnet';
  /** Human-readable NEAR amount, e.g. "0.25". */
  allowanceNear?: string;
}

function assertPublicKey(publicKey: string): void {
  if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(publicKey)) {
    throw new NearClientError('INVALID_PUBLIC_KEY', 'expected an ed25519 public key (never a secret key)');
  }
}

function allowanceToYocto(allowanceNear: string): string {
  if (!/^\d+(\.\d{1,24})?$/.test(allowanceNear)) {
    throw new NearClientError('INVALID_CONFIG', `invalid allowance: ${allowanceNear}`);
  }
  const [whole = '0', frac = ''] = allowanceNear.split('.');
  const value = BigInt(whole) * NEAR_PER_YOCTO + BigInt(frac.padEnd(Number(NEAR_DECIMALS), '0'));
  if (value <= 0n) throw new NearClientError('INVALID_CONFIG', 'allowance must be greater than zero');
  if (value > MAX_DEFAULT_ALLOWANCE) {
    throw new NearClientError('INVALID_CONFIG', 'allowance exceeds the 0.25 NEAR agent-key cap');
  }
  return value.toString();
}

function methodsForRole(role: Role): readonly string[] {
  if (role === 'COORDINATOR_AI' || role === 'CONTRACTOR' || role === 'INSPECTOR') {
    return AGENT_KEY_METHODS[role];
  }
  if (NO_ONCHAIN_KEY_ROLES.includes(role)) {
    throw new NearClientError(
      'NO_ONCHAIN_KEY',
      `${role} must not hold a hub key; evidence review and human acceptance stay off-chain/human`,
    );
  }
  throw new NearClientError('KEY_NOT_ALLOWED', `${role} is not an agent role that may receive a function-call key`);
}

/**
 * Produces a reviewable provisioning plan: explicit non-empty method list,
 * explicit receiver, finite allowance, public key only. It never generates or
 * stores a private key and never emits a full-access key.
 */
export function buildFunctionCallKeyPlan(input: KeyPlanInput): FunctionCallKeyPlan {
  if (!isNearAccount(input.accountId)) {
    throw new NearClientError('INVALID_ACCOUNT', `invalid agent account: ${input.accountId}`);
  }
  if (!isNearAccount(input.receiverId)) {
    throw new NearClientError('INVALID_ACCOUNT', `invalid receiver account: ${input.receiverId}`);
  }
  assertPublicKey(input.publicKey);
  if (input.network === 'mainnet') {
    throw new NearClientError('MAINNET_NOT_ALLOWED', 'mainnet key provisioning is not allowed; plans are testnet/local only');
  }

  const methodNames = [...methodsForRole(input.role)];
  if (methodNames.length === 0) {
    throw new NearClientError('KEY_NOT_ALLOWED', 'method list must be explicit and non-empty');
  }
  const role = input.role as AgentKeyRole;
  const overlap = methodNames.filter((method) => AGENT_FORBIDDEN_METHODS[role].includes(method));
  if (overlap.length > 0) {
    throw new NearClientError('KEY_NOT_ALLOWED', 'agent key method list contains a forbidden method', { overlap });
  }
  const allowanceYocto = allowanceToYocto(input.allowanceNear ?? '0.25');

  const spec: FunctionCallKeySpec = {
    role,
    accountId: input.accountId,
    publicKey: input.publicKey,
    receiverId: input.receiverId,
    methodNames,
    allowanceYocto,
    network: input.network,
  };

  const commands = [
    [
      'near account add-key',
      input.accountId,
      'grant-function-call-access',
      `--allowance '${input.allowanceNear ?? '0.25'} NEAR'`,
      `--contract-account-id ${input.receiverId}`,
      `--function-names '${methodNames.join(',')}'`,
      `use-manually-provided-public-key ${input.publicKey}`,
      'network-config testnet',
      'sign-with-keychain send',
    ].join(' '),
    `near account delete-keys ${input.accountId} public-keys <OLD_FULL_ACCESS_PUBLIC_KEY> network-config testnet sign-with-keychain send`,
    `near account list-keys ${input.accountId} network-config testnet now`,
  ];

  return {
    role: input.role as 'COORDINATOR_AI' | 'CONTRACTOR',
    spec,
    json: {
      account_id: input.accountId,
      public_key: input.publicKey,
      permission: {
        FunctionCall: {
          allowance: allowanceYocto,
          receiver_id: input.receiverId,
          method_names: methodNames,
        },
      },
    },
    commands,
    notes: [
      'Contains a public key only; the private key must be generated and stored by the operator secret manager.',
      'Delete or take offline every full-access key on the agent sub-account before use.',
      'Function-call keys cannot attach a deposit: gasless escrow funding is not possible with this key.',
      'The contract enforces roles independently; method scoping is a blast-radius reducer, not authorization.',
    ],
  };
}

export interface KeyViolation {
  code: string;
  message: string;
}

export interface KeyVerification {
  ok: boolean;
  isFullAccess: boolean;
  permittedMethods: string[];
  /** True when the key can call a method that moves or releases escrow. */
  canReleaseEscrow: boolean;
  violations: KeyViolation[];
}

function functionCallPermission(view: AccessKeyView): AccessKeyPermissionView | undefined {
  if (view.access_key.permission === 'FullAccess') return undefined;
  return view.access_key.permission;
}

/**
 * Asserts an RPC access-key view is a restricted function-call key, matches the
 * approved method list for its role and cannot call any role-forbidden method.
 */
export function verifyFunctionCallKey(view: AccessKeyView, spec: FunctionCallKeySpec): KeyVerification {
  const violations: KeyViolation[] = [];
  const isFullAccess = view.access_key.permission === 'FullAccess';
  const permission = functionCallPermission(view);
  const fc = permission?.FunctionCall;
  const role = spec.role;
  const roleForbidden = AGENT_FORBIDDEN_METHODS[role] ?? [];

  if (isFullAccess) {
    violations.push({ code: 'FULL_ACCESS', message: 'key is full access; agent keys must be function-call scoped' });
  }
  if (view.public_key !== spec.publicKey) {
    violations.push({ code: 'PUBLIC_KEY_MISMATCH', message: 'RPC key does not match the planned public key' });
  }
  if (!fc) {
    violations.push({ code: 'NOT_FUNCTION_CALL', message: 'key has no function-call permission' });
  } else {
    if (fc.receiver_id !== spec.receiverId) {
      violations.push({ code: 'WRONG_RECEIVER', message: `receiver ${fc.receiver_id} is not ${spec.receiverId}` });
    }
    if (!Array.isArray(fc.method_names) || fc.method_names.length === 0) {
      violations.push({ code: 'EMPTY_METHODS', message: 'empty method list permits every method on the contract' });
    } else {
      const actual = [...fc.method_names].sort();
      const expected = [...spec.methodNames].sort();
      if (actual.join('|') !== expected.join('|')) {
        violations.push({ code: 'METHOD_MISMATCH', message: 'method list differs from the approved plan' });
      }
      const forbidden = fc.method_names.filter((method) => roleForbidden.includes(method));
      if (forbidden.length > 0) {
        violations.push({ code: 'FORBIDDEN_METHOD', message: `forbidden methods for ${role}: ${forbidden.join(',')}` });
      }
    }
    if (fc.allowance === null) {
      violations.push({ code: 'UNLIMITED_ALLOWANCE', message: 'allowance is unlimited' });
    } else {
      let allowance: bigint;
      try {
        allowance = BigInt(fc.allowance);
      } catch {
        allowance = -1n;
      }
      if (allowance <= 0n) {
        violations.push({ code: 'INVALID_ALLOWANCE', message: 'allowance must be a positive yocto integer' });
      } else if (allowance > BigInt(spec.allowanceYocto)) {
        violations.push({ code: 'ALLOWANCE_TOO_HIGH', message: 'allowance exceeds the approved cap' });
      }
    }
  }

  const permittedMethods = fc ? [...fc.method_names] : [];
  const escrowMethods = permittedMethods.filter((method) => ESCROW_METHODS.includes(method));
  const canReleaseEscrow = isFullAccess || escrowMethods.length > 0;
  // Only the inspector key may hold acceptance authority. Any other agent key
  // that can touch escrow is a separation-of-duties violation.
  if (canReleaseEscrow && role !== 'INSPECTOR') {
    violations.push({ code: 'CAN_RELEASE_ESCROW', message: 'key scope can call a payment/acceptance method' });
  }

  return { ok: violations.length === 0, isFullAccess, permittedMethods, canReleaseEscrow, violations };
}

export function assertFunctionCallKeyRestricted(view: AccessKeyView, spec: FunctionCallKeySpec): KeyVerification {
  const verification = verifyFunctionCallKey(view, spec);
  if (!verification.ok) {
    throw new NearClientError('KEY_NOT_ALLOWED', 'access key failed the restricted-key check', {
      violations: verification.violations,
    });
  }
  return verification;
}

export function assertCannotCall(verification: KeyVerification, method: string): void {
  if (verification.isFullAccess || verification.permittedMethods.includes(method)) {
    throw new NearClientError('KEY_NOT_ALLOWED', `key can call ${method}; this violates separation of duties`);
  }
}

/** Fails if any key on an agent account is full access or unrestricted. */
export function findUnsafeAgentKeys(list: AccessKeyList): KeyViolation[] {
  const violations: KeyViolation[] = [];
  for (const key of list.keys) {
    if (key.access_key.permission === 'FullAccess') {
      violations.push({ code: 'FULL_ACCESS_KEY_PRESENT', message: `${key.public_key} is full access` });
      continue;
    }
    const fc = key.access_key.permission.FunctionCall;
    if (!fc) {
      violations.push({ code: 'NOT_FUNCTION_CALL', message: `${key.public_key} is not a function-call key` });
      continue;
    }
    if (fc.method_names.length === 0) {
      violations.push({ code: 'EMPTY_METHODS', message: `${key.public_key} permits every method` });
    }
    if (fc.allowance === null) {
      violations.push({ code: 'UNLIMITED_ALLOWANCE', message: `${key.public_key} has unlimited allowance` });
    }
  }
  return violations;
}

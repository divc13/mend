import {
  HASH_PATTERN,
  MendError,
  WORK_ORDER_ID_PATTERN,
  isNearAccount,
  sha256Hex,
} from '@mend/protocol';

export const DAO_AUTHORIZE_METHOD = 'dao_authorize';
export const DEFAULT_DAO_AUTHORIZE_GAS = '30000000000000'; // 30 Tgas
const MAX_AUTHORIZE_GAS = 100_000_000_000_000n; // 100 Tgas
const RAW_INTEGER_KEYS = new Set(['commit_deadline', 'reveal_deadline']);

export interface DaoAuthorizeArgs {
  work_order_id: string;
  proposal_id: string;
  scope_hash: string;
  policy_hash: string;
  /** Integer micro-units, serialized as a decimal string (U128). */
  budget: string;
  contractor_roster: string[];
  inspector_roster: string[];
  /** Absolute block timestamp in nanoseconds, serialized as a JSON integer. */
  commit_deadline: string;
  reveal_deadline: string;
}

export interface DaoAuthorizeInput extends Omit<DaoAuthorizeArgs, 'contractor_roster' | 'inspector_roster'> {
  contractor_roster: readonly string[];
  inspector_roster: readonly string[];
}

export interface SputnikFunctionCallAction {
  method_name: string;
  args: string;
  deposit: string;
  gas: string;
}

export interface SputnikFunctionCallProposal {
  description: string;
  kind: {
    FunctionCall: {
      receiver_id: string;
      actions: SputnikFunctionCallAction[];
    };
  };
}

export interface DaoAuthorizeProposal {
  args: DaoAuthorizeArgs;
  argsBase64: string;
  argsHash: string;
  canonicalArgsJson: string;
  action: SputnikFunctionCallAction;
  proposal: SputnikFunctionCallProposal;
  addProposalArgs: { proposal: SputnikFunctionCallProposal };
}

function assertAccountRoster(name: string, roster: readonly string[]): void {
  if (roster.length === 0) throw new MendError('VALIDATION_ERROR', `${name} cannot be empty`);
  const seen = new Set<string>();
  for (const account of roster) {
    if (!isNearAccount(account)) throw new MendError('VALIDATION_ERROR', `${name} has invalid account ${account}`);
    if (seen.has(account)) throw new MendError('VALIDATION_ERROR', `${name} has duplicate account ${account}`);
    seen.add(account);
  }
}

function assertDeadline(name: string, value: string): void {
  if (!/^\d{1,20}$/.test(value) || value === '0') {
    throw new MendError('VALIDATION_ERROR', `${name} must be a positive integer nanosecond timestamp string`);
  }
}

export function validateDaoAuthorizeArgs(input: DaoAuthorizeInput): DaoAuthorizeArgs {
  if (!WORK_ORDER_ID_PATTERN.test(input.work_order_id)) {
    throw new MendError('VALIDATION_ERROR', `invalid work order id: ${input.work_order_id}`);
  }
  if (!/^\d{1,10}$/.test(input.proposal_id)) {
    throw new MendError('VALIDATION_ERROR', `invalid proposal id: ${input.proposal_id}`);
  }
  if (!HASH_PATTERN.test(input.scope_hash)) throw new MendError('VALIDATION_ERROR', 'invalid scope hash');
  if (!HASH_PATTERN.test(input.policy_hash)) throw new MendError('VALIDATION_ERROR', 'invalid policy hash');
  if (!/^\d+$/.test(input.budget) || BigInt(input.budget) <= 0n) {
    throw new MendError('VALIDATION_ERROR', 'budget must be a positive integer micro amount');
  }
  assertAccountRoster('contractor_roster', input.contractor_roster);
  assertAccountRoster('inspector_roster', input.inspector_roster);
  const overlap = input.contractor_roster.filter((account) => input.inspector_roster.includes(account));
  if (overlap.length > 0) {
    throw new MendError('VALIDATION_ERROR', 'contractor and inspector rosters must be disjoint', { overlap });
  }
  assertDeadline('commit_deadline', input.commit_deadline);
  assertDeadline('reveal_deadline', input.reveal_deadline);
  if (BigInt(input.commit_deadline) >= BigInt(input.reveal_deadline)) {
    throw new MendError('VALIDATION_ERROR', 'commit_deadline must be before reveal_deadline');
  }
  return {
    ...input,
    contractor_roster: [...input.contractor_roster],
    inspector_roster: [...input.inspector_roster],
  };
}

/** Canonical JSON: sorted keys, UTF-8, no whitespace; deadlines stay raw integers. */
export function canonicalDaoArgs(args: DaoAuthorizeArgs): string {
  return serialize(args);
}

function serialize(value: unknown, key?: string): string {
  if (key && RAW_INTEGER_KEYS.has(key) && typeof value === 'string' && /^\d+$/.test(value)) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => serialize(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${serialize(record[k], k)}`).join(',')}}`;
}

export function encodeDaoAuthorizeArgs(input: DaoAuthorizeInput): {
  args: DaoAuthorizeArgs;
  canonicalArgsJson: string;
  argsBase64: string;
  argsHash: string;
} {
  const args = validateDaoAuthorizeArgs(input);
  const canonicalArgsJson = canonicalDaoArgs(args);
  return {
    args,
    canonicalArgsJson,
    argsBase64: Buffer.from(canonicalArgsJson, 'utf8').toString('base64'),
    argsHash: sha256Hex(canonicalArgsJson),
  };
}

export function buildDaoAuthorizeProposal(input: {
  authorization: DaoAuthorizeInput;
  hubAccount: string;
  proposalId: string;
  gas?: string;
}): DaoAuthorizeProposal {
  if (!isNearAccount(input.hubAccount)) {
    throw new MendError('VALIDATION_ERROR', `invalid hub account: ${input.hubAccount}`);
  }
  if (input.authorization.proposal_id !== input.proposalId) {
    throw new MendError('VALIDATION_ERROR', 'proposal id mismatch between input and authorization');
  }
  const encoded = encodeDaoAuthorizeArgs(input.authorization);
  const gas = input.gas ?? DEFAULT_DAO_AUTHORIZE_GAS;
  if (!/^\d+$/.test(gas) || BigInt(gas) > MAX_AUTHORIZE_GAS) {
    throw new MendError('VALIDATION_ERROR', 'authorize gas exceeds 100 Tgas');
  }
  const action: SputnikFunctionCallAction = {
    method_name: DAO_AUTHORIZE_METHOD,
    args: encoded.argsBase64,
    deposit: '0',
    gas,
  };
  const description = `MEND ${encoded.args.work_order_id}: authorize ${encoded.args.budget} micro-USDC budget, contractor/inspector rosters, policy ${encoded.args.policy_hash}`;
  const proposal: SputnikFunctionCallProposal = {
    description,
    kind: { FunctionCall: { receiver_id: input.hubAccount, actions: [action] } },
  };
  return {
    args: encoded.args,
    argsBase64: encoded.argsBase64,
    argsHash: encoded.argsHash,
    canonicalArgsJson: encoded.canonicalArgsJson,
    action,
    proposal,
    addProposalArgs: { proposal },
  };
}

import { z } from 'zod';
import { MendError, sha256Hex } from '@mend/protocol';
import {
  DAO_AUTHORIZE_METHOD,
  DEFAULT_DAO_AUTHORIZE_GAS,
  canonicalDaoArgs,
  validateDaoAuthorizeArgs,
} from './payload.js';
import type { DaoAuthorizeArgs, DaoAuthorizeInput } from './payload.js';

export const SputnikProposalSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    proposer: z.string(),
    description: z.string(),
    kind: z.unknown(),
    status: z.enum(['InProgress', 'Approved', 'Rejected', 'Removed', 'Expired', 'Moved', 'Failed']),
    vote_counts: z.record(z.string(), z.array(z.number())).optional(),
    votes: z.record(z.string(), z.string()).optional(),
    submission_time: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type SputnikProposal = z.infer<typeof SputnikProposalSchema>;

const VotePolicySchema = z
  .object({
    weight_kind: z.string().optional(),
    quorum: z.union([z.string(), z.number()]).optional(),
    threshold: z.union([z.string(), z.number(), z.array(z.number())]).optional(),
  })
  .passthrough();

const RoleSchema = z
  .object({
    name: z.string(),
    kind: z.union([z.literal('Everyone'), z.object({ Group: z.array(z.string()) }).passthrough()]),
    permissions: z.array(z.string()),
    vote_policy: VotePolicySchema.optional(),
  })
  .passthrough();

export const SputnikPolicySchema = z
  .object({
    roles: z.array(RoleSchema),
    default_vote_policy: VotePolicySchema,
    proposal_bond: z.union([z.string(), z.number()]),
    proposal_period: z.union([z.string(), z.number()]),
  })
  .passthrough();

export type SputnikPolicy = z.infer<typeof SputnikPolicySchema>;

export interface ProposalVerification {
  ok: true;
  proposalId: string;
  args: DaoAuthorizeArgs;
  argsHash: string;
  canonicalArgsJson: string;
  checks: string[];
}

export interface AuthorizationExpectation {
  hubAccount: string;
  authorization: DaoAuthorizeInput;
  /** Proposal ID as a decimal string; must match the proposal and the args. */
  proposalId: string;
  maxGas?: string;
  expectedStatus?: SputnikProposal['status'];
}

const ARG_KEYS = [
  'work_order_id',
  'proposal_id',
  'scope_hash',
  'policy_hash',
  'budget',
  'contractor_roster',
  'inspector_roster',
  'commit_deadline',
  'reveal_deadline',
] as const;

function fail(message: string, details?: Record<string, unknown>): never {
  throw new MendError('DAO_APPROVAL_MISMATCH', message, details);
}

function normalizeDeadline(value: unknown, name: string): string {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    try {
      return BigInt(value).toString();
    } catch {
      fail(`${name} is not an integer timestamp`);
    }
  }
  return fail(`${name} must be an integer nanosecond timestamp`);
}

function decodeArgs(base64: string): Record<string, unknown> {
  let decoded: string;
  try {
    decoded = Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    fail('dao_authorize args are not valid base64');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    fail('dao_authorize args are not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('dao_authorize args must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

/** Verifies the exact FunctionCall proposal shape and payload for dao_authorize. */
export function verifyDaoAuthorizationProposal(
  rawProposal: unknown,
  expectation: AuthorizationExpectation,
): ProposalVerification {
  const proposal = SputnikProposalSchema.parse(rawProposal);
  const expectedArgs = validateDaoAuthorizeArgs(expectation.authorization);
  if (expectedArgs.proposal_id !== expectation.proposalId) {
    fail('expectation proposal id does not match the authorization args');
  }
  const expectedStatus = expectation.expectedStatus ?? 'Approved';
  if (proposal.status !== expectedStatus) {
    fail(`proposal status is ${proposal.status}, expected ${expectedStatus}`);
  }
  if (String(proposal.id) !== expectation.proposalId) {
    fail(`proposal id ${String(proposal.id)} does not match expected ${expectation.proposalId}`);
  }

  const kind = proposal.kind as Record<string, unknown> | undefined;
  const functionCall = kind?.FunctionCall as Record<string, unknown> | undefined;
  if (!functionCall) fail('proposal kind is not a single FunctionCall');
  if (functionCall.receiver_id !== expectation.hubAccount) {
    fail('proposal receiver is not the MEND hub', { receiver: functionCall.receiver_id });
  }
  const actions = functionCall.actions;
  if (!Array.isArray(actions) || actions.length !== 1) {
    fail('proposal must contain exactly one FunctionCall action');
  }
  const action = actions[0] as Record<string, unknown>;
  if (action.method_name !== DAO_AUTHORIZE_METHOD) {
    fail('proposal method is not dao_authorize', { method: action.method_name });
  }
  if (action.deposit !== '0') fail('dao_authorize proposal must attach zero deposit');
  const gas = String(action.gas ?? '');
  if (!/^\d+$/.test(gas)) fail('proposal gas is not an integer');
  const maxGas = expectation.maxGas ?? '100000000000000';
  if (BigInt(gas) > BigInt(maxGas)) fail('proposal gas exceeds the authorization cap');
  if (BigInt(gas) < BigInt(DEFAULT_DAO_AUTHORIZE_GAS)) {
    fail('proposal gas is below the 30 Tgas required by the hub call');
  }

  const rawArgs = decodeArgs(String(action.args ?? ''));
  const actualKeys = Object.keys(rawArgs).sort();
  const expectedKeys = [...ARG_KEYS].sort();
  if (actualKeys.join('|') !== expectedKeys.join('|')) {
    fail('dao_authorize args contain missing or unexpected fields', { actualKeys, expectedKeys });
  }
  const actualArgs: DaoAuthorizeArgs = {
    work_order_id: String(rawArgs.work_order_id),
    proposal_id: String(rawArgs.proposal_id),
    scope_hash: String(rawArgs.scope_hash),
    policy_hash: String(rawArgs.policy_hash),
    budget: String(rawArgs.budget),
    contractor_roster: z.array(z.string()).parse(rawArgs.contractor_roster),
    inspector_roster: z.array(z.string()).parse(rawArgs.inspector_roster),
    commit_deadline: normalizeDeadline(rawArgs.commit_deadline, 'commit_deadline'),
    reveal_deadline: normalizeDeadline(rawArgs.reveal_deadline, 'reveal_deadline'),
  };

  let validatedActual: DaoAuthorizeArgs;
  try {
    validatedActual = validateDaoAuthorizeArgs(actualArgs);
  } catch (error) {
    fail('decoded dao_authorize args are invalid', { cause: (error as Error).message });
  }
  const expectedCanonical = canonicalDaoArgs(expectedArgs);
  const actualCanonical = canonicalDaoArgs(validatedActual);
  if (expectedCanonical !== actualCanonical) {
    fail('dao_authorize args do not match the expected work order authorization');
  }

  return {
    ok: true,
    proposalId: String(proposal.id),
    args: validatedActual,
    argsHash: sha256Hex(actualCanonical),
    canonicalArgsJson: actualCanonical,
    checks: [
      'status-approved',
      'function-call-kind',
      'hub-receiver',
      'single-action',
      'dao-authorize-method',
      'zero-deposit',
      'gas-bounded',
      'exact-args-payload',
    ],
  };
}

export interface PolicyCheckOptions {
  expectedBondYocto?: string;
  maxProposalPeriodNs?: string;
  minCouncilMembers?: number;
  minApprovals?: number;
}

export interface PolicyVerification {
  ok: boolean;
  councilMembers: string[];
  quorumVotes: number;
  thresholdVotes: number;
  effectiveApprovalsRequired: number;
  violations: string[];
}

function toBigInt(value: string | number | undefined, fallback = '0'): bigint {
  try {
    return BigInt(value ?? fallback);
  } catch {
    return -1n;
  }
}

function thresholdVotes(threshold: string | number | number[] | undefined, total: number): number {
  if (Array.isArray(threshold)) {
    const [num, den] = threshold;
    if (typeof num !== 'number' || typeof den !== 'number' || den <= 0) return Number.MAX_SAFE_INTEGER;
    return Math.ceil((num * total) / den);
  }
  if (threshold === undefined) return total;
  const fixed = toBigInt(threshold, String(total));
  return fixed < 0n ? Number.MAX_SAFE_INTEGER : Number(fixed);
}

export function verifyDaoPolicy(rawPolicy: unknown, options: PolicyCheckOptions = {}): PolicyVerification {
  const policy = SputnikPolicySchema.parse(rawPolicy);
  const violations: string[] = [];
  const minMembers = options.minCouncilMembers ?? 3;
  const minApprovals = options.minApprovals ?? 2;
  const expectedBond = BigInt(options.expectedBondYocto ?? '1000000000000000000000000');
  const maxPeriod = BigInt(options.maxProposalPeriodNs ?? '604800000000000');

  const councilRole =
    policy.roles.find((role) => role.name === 'council') ??
    policy.roles.find((role) => role.permissions.some((permission) => permission === '*:VoteApprove'));
  const members =
    councilRole && councilRole.kind !== 'Everyone' && Array.isArray(councilRole.kind.Group)
      ? [...councilRole.kind.Group]
      : [];
  if (!councilRole) violations.push('no council role with vote permission');
  if (members.length === 0) violations.push('council has no members');
  if (members.length < minMembers) violations.push(`council needs at least ${minMembers} human members`);
  if (new Set(members).size !== members.length) violations.push('council contains duplicate members');
  if (members.some((member) => /(^|\.)(coordinator-ai|reviewer-ai)\./.test(member))) {
    violations.push('AI agent account must not be a council member');
  }

  const votePolicy = { ...policy.default_vote_policy, ...(councilRole?.vote_policy ?? {}) };
  const quorum = Number(toBigInt(votePolicy.quorum, '0'));
  const threshold = thresholdVotes(votePolicy.threshold, members.length);
  const effective = Math.max(quorum, threshold);
  if (effective < minApprovals) {
    violations.push(`effective approval threshold ${effective} is below the required ${minApprovals}`);
  }

  const bond = toBigInt(policy.proposal_bond);
  if (bond !== expectedBond) violations.push('proposal bond does not match the expected value');
  const period = toBigInt(policy.proposal_period);
  if (period > maxPeriod) violations.push('proposal period is longer than the allowed maximum');

  return {
    ok: violations.length === 0,
    councilMembers: members,
    quorumVotes: quorum,
    thresholdVotes: threshold,
    effectiveApprovalsRequired: effective,
    violations,
  };
}

export function assertPolicySuitable(rawPolicy: unknown, options: PolicyCheckOptions = {}): PolicyVerification {
  const result = verifyDaoPolicy(rawPolicy, options);
  if (!result.ok) {
    throw new MendError('DAO_APPROVAL_MISMATCH', 'DAO policy is not suitable for budget authorization', {
      violations: result.violations,
    });
  }
  return result;
}

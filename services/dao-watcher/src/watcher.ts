import { MendError, isNearAccount } from '@mend/protocol';
import {
  SputnikPolicySchema,
  SputnikProposalSchema,
  assertPolicySuitable,
  verifyDaoAuthorizationProposal,
} from './verify.js';
import type {
  AuthorizationExpectation,
  PolicyCheckOptions,
  PolicyVerification,
  ProposalVerification,
  SputnikPolicy,
  SputnikProposal,
} from './verify.js';

/** Read-only view surface. There is deliberately no signer, proposal or vote method. */
export interface DaoReadClient {
  view<T>(accountId: string, method: string, args: Record<string, unknown>): Promise<{ value: T }>;
}

export interface DaoWatcherConfig {
  client: DaoReadClient;
  daoAccount: string;
  hubAccount: string;
  policyOptions?: PolicyCheckOptions;
}

export interface VerifiedAuthorization {
  proposal: SputnikProposal;
  policy: SputnikPolicy;
  proposalVerification: ProposalVerification;
  policyVerification: PolicyVerification;
}

/**
 * Off-chain DAO watcher. It can read a Sputnik policy/proposal and verify that
 * the exact FunctionCall payload would authorize a MEND work order. It never
 * holds a key, creates a proposal or votes.
 */
export class DaoWatcher {
  private readonly client: DaoReadClient;
  readonly daoAccount: string;
  readonly hubAccount: string;
  private readonly policyOptions: PolicyCheckOptions;

  constructor(config: DaoWatcherConfig) {
    if (!isNearAccount(config.daoAccount) || !isNearAccount(config.hubAccount)) {
      throw new MendError('VALIDATION_ERROR', 'invalid DAO or hub account');
    }
    this.client = config.client;
    this.daoAccount = config.daoAccount;
    this.hubAccount = config.hubAccount;
    this.policyOptions = config.policyOptions ?? {};
  }

  async getProposal(proposalId: string | number): Promise<SputnikProposal> {
    const id = String(proposalId);
    if (!/^\d{1,10}$/.test(id)) throw new MendError('VALIDATION_ERROR', `invalid proposal id: ${id}`);
    const result = await this.client.view<unknown>(this.daoAccount, 'get_proposal', { id: Number(id) });
    return SputnikProposalSchema.parse(result.value);
  }

  async getPolicy(): Promise<SputnikPolicy> {
    const result = await this.client.view<unknown>(this.daoAccount, 'get_policy', {});
    return SputnikPolicySchema.parse(result.value);
  }

  async verifyWorkOrderAuthorization(expectation: AuthorizationExpectation): Promise<VerifiedAuthorization> {
    const proposal = await this.getProposal(expectation.proposalId);
    const policy = await this.getPolicy();
    const policyVerification = assertPolicySuitable(policy, this.policyOptions);
    const proposalVerification = verifyDaoAuthorizationProposal(proposal, {
      ...expectation,
      hubAccount: this.hubAccount,
    });
    return { proposal, policy, proposalVerification, policyVerification };
  }
}

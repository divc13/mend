import { writeFileSync } from 'node:fs';
import { FIXTURE_ACCOUNTS, FIXTURE_POLICY, policyHash } from '@mend/protocol';
import { buildDaoAuthorizeProposal } from '../src/payload.js';
import type { DaoAuthorizeInput } from '../src/payload.js';

const root = new URL('../../../fixtures/agents/dao/', import.meta.url);

const authorization: DaoAuthorizeInput = {
  work_order_id: 'WO-BENCH-001-0001',
  proposal_id: '42',
  scope_hash: 'c'.repeat(64),
  policy_hash: policyHash(FIXTURE_POLICY),
  budget: '100000000',
  contractor_roster: [FIXTURE_ACCOUNTS.contractorA, FIXTURE_ACCOUNTS.contractorB, FIXTURE_ACCOUNTS.contractorC],
  inspector_roster: [FIXTURE_ACCOUNTS.inspector, FIXTURE_ACCOUNTS.inspector2],
  commit_deadline: '1794301800000000000',
  reveal_deadline: '1794302400000000000',
};

const built = buildDaoAuthorizeProposal({
  authorization,
  hubAccount: FIXTURE_ACCOUNTS.hub,
  proposalId: '42',
});

const file = {
  meta: {
    recorded: true,
    replayLabel: 'REPLAY / SIMULATION',
    kind: 'sputnik-function-call-proposal',
    note: 'Deterministic dao_authorize proposal generated from the frozen payload builder. No proposal was created on-chain.',
  },
  expected: authorization,
  payload: {
    argsBase64: built.argsBase64,
    argsHash: built.argsHash,
    canonicalArgsJson: built.canonicalArgsJson,
  },
  proposal: {
    id: 42,
    proposer: 'steward.mend.testnet',
    description: built.proposal.description,
    kind: built.proposal.kind,
    status: 'Approved',
    vote_counts: { council: [2, 0, 0] },
    votes: { 'steward.mend.testnet': 'Approve', 'backup.mend.testnet': 'Approve' },
    submission_time: '1794301200000000000',
  },
};

writeFileSync(new URL('proposal-approved.json', root), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
console.log(`wrote proposal-approved.json (args hash ${built.argsHash})`);

import { writeFileSync } from 'node:fs';
import { FIXTURE_ACCOUNTS, FIXTURE_POLICY, policyHash } from '@mend/protocol';

const root = new URL('../../../fixtures/agents/relayer/', import.meta.url);
const publicKey = 'ed25519:5BZbX1hYq8m9N2vR4tL7cK3pQ6sD8fG1jHaZxCvBnMq';

const args = {
  work_order_id: 'WO-BENCH-001-0001',
  asset_id: 'BENCH-001',
  cluster_hash: 'a'.repeat(64),
  scope_hash: 'c'.repeat(64),
  dao_proposal_id: '42',
  policy_hash: policyHash(FIXTURE_POLICY),
  budget: '100000000',
  sponsor: FIXTURE_ACCOUNTS.sponsor,
  contractor_roster: [FIXTURE_ACCOUNTS.contractorA, FIXTURE_ACCOUNTS.contractorB, FIXTURE_ACCOUNTS.contractorC],
  inspector_roster: [FIXTURE_ACCOUNTS.inspector, FIXTURE_ACCOUNTS.inspector2],
  commit_deadline: 1794301800000000000,
  reveal_deadline: 1794302400000000000,
};

const file = {
  meta: {
    recorded: true,
    replayLabel: 'REPLAY / SIMULATION',
    kind: 'nep366-signed-delegate',
    note: 'Offline fixture only. Signature bytes are a placeholder; a live relayer must verify the real ed25519 signature and the on-chain key before sponsoring.',
  },
  accessKey: {
    public_key: publicKey,
    access_key: {
      nonce: 4,
      permission: {
        FunctionCall: {
          allowance: '250000000000000000000000',
          receiver_id: FIXTURE_ACCOUNTS.hub,
          method_names: ['create_work_order'],
        },
      },
    },
  },
  signedDelegate: {
    delegateAction: {
      senderId: FIXTURE_ACCOUNTS.coordinatorAi,
      receiverId: FIXTURE_ACCOUNTS.hub,
      actions: [
        {
          functionCall: {
            methodName: 'create_work_order',
            args: Buffer.from(JSON.stringify(args), 'utf8').toString('base64'),
            gas: '100000000000000',
            deposit: '0',
          },
        },
      ],
      nonce: '5',
      maxBlockHeight: 1005,
      publicKey,
    },
    signature: 'ed25519:fixture-signature-not-a-real-signature',
  },
};

writeFileSync(new URL('valid-delegate.json', root), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
console.log('wrote valid-delegate.json');

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWalletKeyFile,
  explorerTxUrl,
  isPlausibleNearTxHash,
  microAmountLabel,
  normalizeFaucet,
  normalizeScenarioRun,
  normalizeWallet,
  storagePercent,
  toMicro,
  walletKeyFilename,
} from '../src/lib/testnet';

const TX = 'EkD9xQm2zR4tY6uP8aL1cV3bN5mK7jH9gF2dS4aQ6wE8rT';

test('toMicro accepts integer micro and decimal token amounts', () => {
  assert.equal(toMicro('100000000'), '100000000');
  assert.equal(toMicro('100.00'), '100000000');
  assert.equal(toMicro('100.5 mUSDC'), '100500000');
  assert.equal(toMicro('0.000001'), '1');
  assert.equal(toMicro('nonsense'), undefined);
});

test('wallet normalization handles wrapped snake_case and storage', () => {
  const wallet = normalizeWallet(
    {
      data: {
        account_id: 'alice.testnet',
        public_key: 'ed25519:public',
        secret_key: 'ed25519:secret',
        balance: {
          token_micro: '100000000',
          near_balance_yocto: '2000000000000000000000000',
          storage_used_bytes: 1_000,
          storage_limit_bytes: 10_000,
        },
      },
    },
    { allowSecret: true },
  );

  assert.ok(wallet);
  assert.equal(wallet.accountId, 'alice.testnet');
  assert.equal(wallet.publicKey, 'ed25519:public');
  assert.equal(wallet.secretKey, 'ed25519:secret');
  assert.equal(wallet.balance.tokenMicro, '100000000');
  assert.equal(wallet.balance.nearYocto, '2000000000000000000000000');
  assert.equal(wallet.balance.storageUsedBytes, 1_000);
  assert.equal(wallet.balance.storageLimitBytes, 10_000);
  assert.equal(storagePercent(1_000, 10_000), 10);
});

test('wallet reads never keep a secret key', () => {
  const wallet = normalizeWallet({ accountId: 'alice.testnet', secretKey: 'ed25519:secret' });
  assert.ok(wallet);
  assert.equal(wallet.secretKey, undefined);
});

test('faucet normalization links only plausible testnet hashes', () => {
  const receipt = normalizeFaucet(
    {
      data: {
        account_id: 'alice.testnet',
        amountMicro: '100000000',
        status: 'SUCCESS',
        tx_hash: TX,
      },
    },
    'fallback.testnet',
  );

  assert.equal(receipt.accountId, 'alice.testnet');
  assert.equal(receipt.status, 'SUCCESS');
  assert.equal(receipt.amountMicro, '100000000');
  assert.equal(receipt.txHash, TX);
  assert.equal(receipt.explorerUrl, `https://explorer.testnet.near.org/transactions/${TX}`);

  const missing = normalizeFaucet({ accountId: 'alice.testnet' });
  assert.equal(missing.status, 'UNKNOWN');
  assert.equal(missing.explorerUrl, undefined);
});

test('replay-looking strings never become explorer links', () => {
  assert.equal(isPlausibleNearTxHash('replay-fixture-transaction-hash-000000'), false);
  assert.equal(explorerTxUrl('replay'), undefined);
  assert.equal(explorerTxUrl(TX)?.startsWith('https://explorer.testnet.near.org/'), true);
});

test('scenario normalization keeps ordered steps and honest hash links', () => {
  const run = normalizeScenarioRun({
    data: {
      scenarioId: 'canonical',
      title: 'Canonical repair',
      status: 'SUCCESS',
      steps: [
        {
          id: 'create-wallet',
          title: 'Create testnet wallet',
          status: 'COMPLETED',
          tx_hash: TX,
          detail: 'Account created',
        },
        {
          id: 'faucet',
          label: 'Fund 100 mUSDC',
          status: 'COMPLETED',
          transactions: [{ hash: 'not-a-near-hash' }],
        },
        {
          id: 'score',
          name: 'Deterministic score',
          state: 'FAILED',
          message: 'Verifier unavailable',
        },
      ],
    },
  });

  assert.ok(run);
  assert.equal(run.steps.length, 3);
  assert.deepEqual(
    run.steps.map((step) => step.title),
    ['Create testnet wallet', 'Fund 100 mUSDC', 'Deterministic score'],
  );
  assert.equal(run.steps[0]?.status, 'SUCCESS');
  assert.equal(run.steps[0]?.explorerUrls.length, 1);
  assert.equal(run.steps[1]?.txHashes[0], 'not-a-near-hash');
  assert.equal(run.steps[1]?.explorerUrls.length, 0);
  assert.equal(run.steps[2]?.status, 'FAILED');
  assert.equal(run.transactionCount, 2);
  assert.equal(run.linkableTransactionCount, 1);
});

test('scenario normalization rejects empty payloads', () => {
  assert.equal(normalizeScenarioRun(null), null);
  assert.equal(normalizeScenarioRun({ data: { status: 'SUCCESS' } }), null);
});

test('key file is explicit about testnet and one-time storage', () => {
  const file = buildWalletKeyFile({
    accountId: 'alice.testnet',
    publicKey: 'ed25519:public',
    secretKey: 'ed25519:secret',
    network: 'testnet',
    hubAccount: 'mend-hub.testnet',
    tokenAccount: 'mend-usdc.testnet',
    createdAt: '2026-11-09T00:00:00.000Z',
    balance: {},
  });

  assert.equal(file.network, 'testnet');
  assert.equal(file.secretKey, 'ed25519:secret');
  assert.match(String(file.warning), /TESTNET ONLY/);
  assert.equal(walletKeyFilename('alice.testnet'), 'mend-testnet-alice.testnet.json');
});

test('amount labels keep test value readable', () => {
  assert.equal(microAmountLabel('100000000'), '100.00 mUSDC');
  assert.equal(microAmountLabel(undefined), 'Not reported');
});

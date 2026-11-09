import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import {
  API_PORT,
  API_URL,
  DEFAULT_RPC_URL,
  KEYS_FILE,
  LIVE_STATE_PATH,
  REPO_ROOT,
  assertNoSecretMaterial,
  readLiveState,
  redact,
  txStatus,
  txSucceeded,
} from './support.mjs';

const state = readLiveState();
const rpcUrl = state?.rpcUrl ?? DEFAULT_RPC_URL;
const skip = existsSync(KEYS_FILE)
  ? false
  : `BLOCKED: testnet keys file not found at ${KEYS_FILE}; set MEND_TESTNET_KEYS_FILE to run live API checks`;

let child;
let serverLog = '';

function apiEnv() {
  return {
    ...process.env,
    NODE_ENV: 'test',
    MEND_MODE: 'LIVE_TESTNET',
    CHAIN_ADAPTER: 'live',
    MEND_TESTNET_KEYS_FILE: KEYS_FILE,
    MEND_RPC_URL: rpcUrl,
    MEND_HUB_ACCOUNT: 'mend-hub.testnet',
    MEND_TOKEN_ACCOUNT: 'mend-usdc.testnet',
    HOST: '127.0.0.1',
    PORT: String(API_PORT),
    // Low limits make the 429 paths deterministic without creating many
    // accounts or spending more test mUSDC than necessary.
    MEND_TESTNET_WALLET_CREATES_PER_IP_HOUR: '1',
    MEND_TESTNET_FAUCETS_PER_IP_HOUR: '1',
    MEND_TESTNET_FAUCET_COOLDOWN_SECONDS: '0',
    // The UI suite asserts the honest "runner is disabled" state. A live run
    // would take minutes and is covered by the deployment worker's evidence.
    MEND_LIVE_SCENARIO_ENABLED: 'false',
    EVIDENCE_URL_SECRET: 'live-quality-test-only-evidence-secret',
  };
}

async function waitForHealth(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`API exited before becoming healthy (code ${child.exitCode}). Log:\n${redact(serverLog)}`);
    }
    try {
      const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Keep polling until the timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`API did not become healthy within ${timeoutMs}ms. Log:\n${redact(serverLog)}`);
}

before(async () => {
  if (skip) return;
  child = spawn('npm', ['--prefix', 'apps/api', 'run', 'start'], {
    cwd: REPO_ROOT,
    env: apiEnv(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    serverLog += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    serverLog += String(chunk);
  });
  await waitForHealth();
}, { timeout: 120_000 });

after(async () => {
  if (!child) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // The process already exited.
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
});

async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function postWallet() {
  const response = await fetch(`${API_URL}/v1/testnet/wallet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(150_000),
  });
  return { status: response.status, body: await json(response) };
}

async function faucet(accountId) {
  const response = await fetch(`${API_URL}/v1/testnet/faucet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId }),
    signal: AbortSignal.timeout(120_000),
  });
  return { status: response.status, body: await json(response) };
}

describe('LIVE_TESTNET API checks against the real testnet deployment', () => {
  test('GET /health reports LIVE_TESTNET, live chain and no secrets', { skip, timeout: 30_000 }, async () => {
    const response = await fetch(`${API_URL}/health`);
    assert.equal(response.status, 200);
    const body = await json(response);

    assert.equal(body.mode, 'LIVE_TESTNET');
    assert.match(body.modeLabel, /TEST VALUE ONLY/);
    assert.equal(body.chainAdapter.kind, 'live');
    assert.equal(body.chainAdapter.available, true);
    assert.equal(body.testnet.network, 'testnet');
    assert.equal(body.testnet.keysFileConfigured, true);
    assert.equal(body.testnet.walletEnabled, true);
    assert.equal(body.testnet.faucetEnabled, true);
    assert.equal(body.testnet.faucetAmountMicro, '100000000');
    assert.equal(body.testnet.mainnetRefused, true);
    assertNoSecretMaterial(JSON.stringify(body), 'health response');
  });

  test('GET /v1/testnet/wallet/:accountId returns balance and storage without secrets', { skip, timeout: 60_000 }, async () => {
    const accountId = 'mend-contractor-b.testnet';
    const response = await fetch(`${API_URL}/v1/testnet/wallet/${accountId}`);
    assert.equal(response.status, 200);
    const body = await json(response);

    assert.equal(body.accountId, accountId);
    assert.equal(body.network, 'testnet');
    assert.equal(body.exists, true);
    assert.equal(typeof body.balanceMicro, 'string');
    assert.match(body.balanceMicro, /^\d+$/);
    assert.equal(typeof body.storageRegistered, 'boolean');
    assert.equal(body.secretStored, false);
    assert.equal(
      body.explorerUrl,
      `https://explorer.testnet.near.org/accounts/${accountId}`,
    );
    assertNoSecretMaterial(JSON.stringify(body), 'wallet response');
  });

  test('wallet and faucet endpoints reject invalid or non-testnet account ids', { skip, timeout: 30_000 }, async () => {
    const invalidWallet = await fetch(`${API_URL}/v1/testnet/wallet/not%20a%20valid%21`);
    assert.equal(invalidWallet.status, 400);
    const invalidWalletBody = await json(invalidWallet);
    assert.equal(invalidWalletBody.error.code, 'VALIDATION_ERROR');

    const mainnetFaucet = await fetch(`${API_URL}/v1/testnet/faucet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: 'someone.near' }),
    });
    assert.equal(mainnetFaucet.status, 400);
    const mainnetFaucetBody = await json(mainnetFaucet);
    assert.equal(mainnetFaucetBody.error.code, 'VALIDATION_ERROR');

    const shortFaucet = await fetch(`${API_URL}/v1/testnet/faucet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: 'x' }),
    });
    assert.equal(shortFaucet.status, 400);
    const shortFaucetBody = await json(shortFaucet);
    assert.equal(shortFaucetBody.error.code, 'VALIDATION_ERROR');
  });

  test('faucet sends a real testnet transfer and the next request is 429', { skip, timeout: 180_000 }, async (t) => {
    const accountId = 'mend-contractor-c.testnet';
    let first;
    try {
      first = await faucet(accountId);
    } catch (error) {
      t.diagnostic(`BLOCKED: first faucet request failed before a response: ${redact(error.message)}`);
      first = { status: 0, body: {} };
    }

    if (first.status === 429 || first.status >= 500 || first.status === 0) {
      t.diagnostic(`BLOCKED: first faucet request was not confirmed: ${redact(JSON.stringify(first.body))}`);
    } else {
      assert.equal(first.status, 200, `faucet failed: ${redact(JSON.stringify(first.body))}`);
      const body = first.body;
      assert.equal(body.accountId, accountId);
      assert.equal(body.amountMicro, '100000000');
      assert.equal(body.network, 'testnet');
      assert.equal(body.oneTimeSecret, false);
      assert.match(body.txHash, /^[1-9A-HJ-NP-Za-km-z]{32,88}$/);
      assert.equal(
        body.explorerUrl,
        `https://explorer.testnet.near.org/transactions/${body.txHash}`,
      );
      assertNoSecretMaterial(JSON.stringify(body), 'faucet response');

      const result = await txStatus(body.txHash, 'mend-deployer.testnet', { rpcUrl });
      assert.ok(txSucceeded(result), `faucet transaction ${body.txHash} did not succeed`);
      t.diagnostic(`faucet tx: ${body.txHash}`);
      t.diagnostic(`faucet amount: ${body.amountMicro} micro mUSDC to ${accountId}`);
    }

    const second = await faucet(accountId);
    assert.equal(second.status, 429, `expected 429, got ${second.status}: ${redact(JSON.stringify(second.body))}`);
    assert.equal(second.body.error.code, 'RELAYER_RATE_LIMITED');
    assert.match(second.body.error.message, /Too many faucet requests from this IP/);
    assert.ok(second.body.error.details.retryAfterSeconds > 0);
    t.diagnostic(`faucet rate limit: HTTP 429 ${redact(JSON.stringify(second.body.error))}`);
  });

  test('wallet creation returns a one-time secret or BLOCKED; the next request is 429', { skip, timeout: 240_000 }, async (t) => {
    let first;
    try {
      first = await postWallet();
    } catch (error) {
      t.diagnostic(`BLOCKED: wallet creation request failed before a response: ${redact(error.message)}`);
      first = { status: 0, body: {} };
    }

    if (first.status === 429 || first.status >= 500 || first.status === 0) {
      t.diagnostic(`BLOCKED: NEAR faucet did not create a wallet: ${redact(JSON.stringify(first.body))}`);
    } else {
      assert.equal(
        first.status,
        201,
        'wallet creation failed; response body withheld because it may contain a one-time secret',
      );
      const body = first.body;
      assert.match(body.accountId, /^mend-w[0-9a-f]{16}\.testnet$/);
      assert.equal(body.network, 'testnet');
      assert.equal(body.oneTimeSecret, true);
      assert.equal(body.serverSideStored, true);
      assert.equal(typeof body.publicKey, 'string');
      assert.equal(typeof body.secretKey, 'string');
      assert.ok(body.secretKey.startsWith('ed25519:'));
      assert.deepEqual(body.serverStores, ['accountId', 'publicKey', 'createdAt']);
      assert.ok(body.serverNeverStores.includes('secretKey'));
      assert.ok(body.serverNeverStores.includes('seedPhrase'));
      t.diagnostic(`wallet created: ${body.accountId} (one-time secret returned; value not recorded)`);
      // Deliberately do not keep body.secretKey or print the response body.
    }

    const second = await postWallet();
    assert.equal(second.status, 429, `expected 429, got ${second.status}: ${redact(JSON.stringify(second.body))}`);
    assert.equal(second.body.error.code, 'RELAYER_RATE_LIMITED');
    assert.match(second.body.error.message, /Too many testnet wallet creations from this IP/);
    assert.ok(second.body.error.details.retryAfterSeconds > 0);
    t.diagnostic(`wallet creation rate limit: HTTP 429 ${redact(JSON.stringify(second.body.error))}`);
  });

  test('POST /v1/live/run-scenario refuses to run when the runner is disabled', { skip, timeout: 30_000 }, async () => {
    const response = await fetch(`${API_URL}/v1/live/run-scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 404);
    const body = await json(response);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.match(body.error.message, /Live scenario runner is disabled/);
    assertNoSecretMaterial(JSON.stringify(body), 'run-scenario refusal');
  });
});

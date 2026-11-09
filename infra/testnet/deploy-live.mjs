#!/usr/bin/env node
/**
 * MEND NEAR testnet live deployment + full lifecycle driver.
 *
 * Usage:
 *   MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node infra/testnet/deploy-live.mjs --deploy
 *   MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node infra/testnet/deploy-live.mjs --lifecycle
 *   MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node infra/testnet/deploy-live.mjs --all
 *   node infra/testnet/deploy-live.mjs --check
 *
 * Safety:
 *   - refuses mainnet (network, RPC URL, account suffix and key metadata are checked)
 *   - reads signing keys only from MEND_TESTNET_KEYS_FILE
 *   - never prints, copies or commits secret keys
 *   - the keys file is external to the repository; this script only rewrites it when
 *     explicitly asked to create a missing testnet account
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  actions,
} from 'near-api-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const LIVE_STATE_PATH = path.join(HERE, 'live-state.json');
const EXPLORER = 'https://explorer.testnet.near.org';
const RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const NETWORK = 'testnet';
const TGAS = 10n ** 12n;
const ONE_NEAR = 10n ** 24n;
const YOCTO = 1n;
const GAS_30 = 30n * TGAS;
const GAS_100 = 100n * TGAS;

// ---------------------------------------------------------------------------
// Canonical deployment constants
// ---------------------------------------------------------------------------

const DEPLOYER = 'mend-deployer.testnet';
const TOKEN = 'mend-usdc.testnet';
const HUB = 'mend-hub.testnet';
const FALLBACK_DAO = 'mend-dao.testnet';
const SPUTNIK_FACTORY = 'sputnikv2.testnet';
const SPUTNIK_NAME = 'mend-dao';
const SPUTNIK_DAO = `${SPUTNIK_NAME}.${SPUTNIK_FACTORY}`;

const STEWARD = 'mend-steward.testnet';
const SPONSOR = 'mend-sponsor.testnet';
const COORDINATOR_AI = 'mend-coordinator-ai.testnet';
const REVIEWER_AI = 'mend-reviewer-ai.testnet';
const RELAYER = 'mend-relayer.testnet';
const CONTRACTORS = [
  'mend-contractor-a.testnet',
  'mend-contractor-b.testnet',
  'mend-contractor-c.testnet',
  'mend-contractor-d.testnet',
  'mend-contractor-e.testnet',
];
const INSPECTORS = ['mend-inspector.testnet', 'mend-inspector-2.testnet'];

const ASSET_ID = 'BENCH-001';
const REQUESTED_WORK_ORDER_ID = 'WO-BENCH-001-0001';
let WORK_ORDER_ID = process.env.MEND_WORK_ORDER_ID || null;
const CLUSTER_ID = 'CL-0001';
const BUDGET_MICRO = 100_000_000n; // 100 mUSDC
const SPONSOR_GRANT_MICRO = 500_000_000n; // 500 mUSDC
const TOKEN_TOTAL_SUPPLY = 1_000_000_000_000n; // 1,000,000 mUSDC
const DURABILITY_MINUTES = 2;
const POLICY_HASH = '1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d';
const POLICY_VERSION = 'mend-bid-policy-v1';
const WEIGHTS_BPS = { price: 4_500, warranty: 2_500, duration: 2_000, materials: 1_000 };
const COMPLETION_SPLIT = { completion: 72_000_000n, holdback: 8_000_000n };
const BID_VALUES = {
  A: {
    bidId: 'BID-A-BENCH-001',
    contractorId: 'mend-contractor-a.testnet',
    priceMicro: '95000000',
    durationDays: 14,
    warrantyDays: 90,
    materialsScore: 60,
    availableInDays: 3,
    nonce: 'nonce-a-live-0001',
  },
  B: {
    bidId: 'BID-B-BENCH-001',
    contractorId: 'mend-contractor-b.testnet',
    priceMicro: '80000000',
    durationDays: 10,
    warrantyDays: 180,
    materialsScore: 80,
    availableInDays: 2,
    nonce: 'nonce-b-live-0002',
  },
  C: {
    bidId: 'BID-C-BENCH-001',
    contractorId: 'mend-contractor-c.testnet',
    priceMicro: '78000000',
    durationDays: 21,
    warrantyDays: 30,
    materialsScore: 70,
    availableInDays: 5,
    nonce: 'nonce-c-live-0003',
  },
};

const ROLE_BY_ACCOUNT = {
  [STEWARD]: 'STEWARD',
  [SPONSOR]: 'SPONSOR',
  [COORDINATOR_AI]: 'COORDINATOR_AI',
  [REVIEWER_AI]: 'REVIEWER_AI',
  [RELAYER]: 'RELAYER',
  ...Object.fromEntries(CONTRACTORS.map((id) => [id, 'CONTRACTOR'])),
  ...Object.fromEntries(INSPECTORS.map((id) => [id, 'INSPECTOR'])),
};

const ALL_ROLE_ACCOUNTS = [
  STEWARD,
  SPONSOR,
  COORDINATOR_AI,
  REVIEWER_AI,
  RELAYER,
  ...CONTRACTORS,
  ...INSPECTORS,
];

const provider = new JsonRpcProvider({ url: RPC_URL });

let keys = null;
let state = null;
let BID_PAYLOAD_VERSION = process.env.MEND_BID_PAYLOAD_VERSION || null;
let hubWasmPath = null;
let tokenWasmPath = null;

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

function log(...parts) {
  console.log('[live]', ...parts);
}

function die(message) {
  throw new Error(message);
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function b64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

// NEAR contract methods take plain JSON `u64` fields as JSON numbers, not
// strings. JSON.rawJSON lets us emit an exact integer above Number.MAX_SAFE_INTEGER.
function rawU64(value) {
  return JSON.rawJSON(String(value));
}

function jsonFile(pathname, value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(pathname, value) {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  fs.writeFileSync(pathname, jsonFile(pathname, value));
}

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function assertTestnet() {
  if (process.env.NEAR_NETWORK && process.env.NEAR_NETWORK !== 'testnet') {
    die(`refusing network ${process.env.NEAR_NETWORK}; this driver is testnet only`);
  }
  if (/mainnet/i.test(RPC_URL) || /\.near\/?$/.test(RPC_URL)) {
    die('refusing mainnet RPC URL; this driver is testnet only');
  }
  if (!/testnet/.test(RPC_URL)) {
    die(`refusing unknown RPC URL ${RPC_URL}; expected a testnet endpoint`);
  }
}

function loadKeys({ required }) {
  const keysFile = process.env.MEND_TESTNET_KEYS_FILE;
  if (!keysFile) {
    if (!required) return null;
    die('MEND_TESTNET_KEYS_FILE is required for signing operations');
  }
  if (!fs.existsSync(keysFile)) die(`keys file not found: ${keysFile}`);
  const stat = fs.statSync(keysFile);
  if ((stat.mode & 0o077) !== 0) {
    log(`WARN keys file is readable by group/other; chmod 600 is recommended`);
  }
  const parsed = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
  for (const [account, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== 'object') die(`malformed keys entry for ${account}`);
    if (account.endsWith('.near') || entry.network === 'mainnet') {
      die(`refusing mainnet key material for ${account}`);
    }
    if (!entry.secretKey) die(`missing signing key for ${account}`);
  }
  keys = parsed;
  keys.__path = keysFile;
  return keys;
}

function saveKeys() {
  if (!keys) die('keys not loaded');
  const keysPath = keys.__path;
  const clean = { ...keys };
  delete clean.__path;
  fs.writeFileSync(keysPath, JSON.stringify(clean, null, 2), { mode: 0o600 });
  fs.chmodSync(keysPath, 0o600);
}

function accountFor(accountId) {
  const entry = keys?.[accountId];
  if (!entry?.secretKey) die(`no signing key for ${accountId} in MEND_TESTNET_KEYS_FILE`);
  return new Account(accountId, provider, KeyPairSigner.fromSecretKey(entry.secretKey));
}

async function view(contractId, method, args = {}) {
  return provider.callFunction({ contractId, method, args });
}

function isMissingContractError(error) {
  const message = String(error?.message ?? error);
  return /Contract method is not found|Contract code for contract ID .* does not exist|MethodNotFound|Contract is not initialized|The contract is not initialized|not initialized|does not exist/i.test(
    message,
  );
}

async function tryView(contractId, method, args = {}) {
  try {
    return { ok: true, value: await view(contractId, method, args) };
  } catch (error) {
    return { ok: false, error: String(error.message ?? error), missing: isMissingContractError(error) };
  }
}

function isMissingAccountError(error) {
  const message = String(error?.message ?? error);
  return /does not exist|AccountDoesNotExist|UNKNOWN_ACCOUNT|account .* not found/i.test(message);
}

async function accountExists(accountId) {
  try {
    await provider.viewAccount({ accountId });
    return true;
  } catch (error) {
    if (isMissingAccountError(error)) return false;
    throw error;
  }
}

async function accountInfo(accountId) {
  try {
    const info = await provider.viewAccount({ accountId });
    return {
      accountId,
      exists: true,
      nearBalanceYocto: String(info.amount),
      codeHash: info.codeHash ?? null,
    };
  } catch (error) {
    if (isMissingAccountError(error)) {
      return { accountId, exists: false, nearBalanceYocto: null, codeHash: null };
    }
    throw error;
  }
}

async function latestBlockTimestampMs() {
  const block = await provider.viewBlock({ finality: 'final' });
  return Number(BigInt(block.header.timestamp) / 1_000_000n);
}

async function waitForOnchainMs(targetMs, label) {
  let lastLog = 0;
  for (;;) {
    const current = await latestBlockTimestampMs();
    if (current + 1_500 >= targetMs) return current;
    const waitMs = Math.min(15_000, Math.max(2_000, targetMs - current));
    if (Date.now() - lastLog > 12_000) {
      log(`${label}: waiting ${Math.ceil((targetMs - current) / 1000)}s for on-chain time`);
      lastLog = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function txHash(result) {
  return (
    result?.transaction_outcome?.id ||
    result?.transaction?.hash ||
    result?.transactionHash ||
    null
  );
}

function explorerTx(hash) {
  return `${EXPLORER}/transactions/${hash}`;
}

function explorerAccount(accountId) {
  return `${EXPLORER}/accounts/${accountId}`;
}

function initialLiveState() {
  return {
    schema: 'mend.live-testnet.v1',
    network: NETWORK,
    rpcUrl: RPC_URL,
    explorerBase: EXPLORER,
    generatedAt: nowIso(),
    updatedAt: nowIso(),
    token: null,
    hub: null,
    dao: null,
    accounts: {},
    asset: null,
    workOrder: null,
    lifecycle: {
      bids: [],
      score: null,
      evidence: [],
      inspections: [],
      payments: [],
      finalStatus: null,
      scoringMode: 'LOCAL_DETERMINISTIC',
      outlayer: {
        used: false,
        reason:
          'OutLayer live publish is not funded/configured on this deployment; the steward recorded a deterministic local score with mode LOCAL_DETERMINISTIC.',
      },
    },
    transactions: [],
    limitations: [
      'NEAR testnet only. Test mUSDC and testnet NEAR have no real value.',
      'OutLayer live execution was not used because it is not funded/configured; the score was computed and recorded locally with a deterministic algorithm and labelled LOCAL_DETERMINISTIC.',
      'The passport NFT is non-transferable and is held by the hub registry account; it is not a title deed or legal ownership record.',
      'Sputnik DAO v2 success/failure is recorded verbatim in dao.kind, dao.accountId and dao.failureReason when applicable.',
    ],
  };
}

function loadLiveState() {
  if (fs.existsSync(LIVE_STATE_PATH)) {
    state = readJson(LIVE_STATE_PATH);
    state.transactions ??= [];
    state.accounts ??= {};
    state.lifecycle ??= {};
    state.lifecycle.bids ??= [];
    state.lifecycle.evidence ??= [];
    state.lifecycle.inspections ??= [];
  } else {
    state = initialLiveState();
  }
  return state;
}

function writeLiveState() {
  if (!state) return;
  state.updatedAt = nowIso();
  writeJson(LIVE_STATE_PATH, state);
}

function recordTransaction(step, result, signer, receiver, method, extra = {}) {
  const hash = txHash(result);
  if (!hash) die(`transaction result for ${step} had no hash`);
  const entry = {
    step,
    hash,
    explorerUrl: explorerTx(hash),
    signer,
    receiver,
    method,
    at: nowIso(),
    finalStatus:
      result?.status && typeof result.status === 'object'
        ? Object.keys(result.status)[0] ?? null
        : result?.final_execution_status ?? null,
    ...extra,
  };
  const existing = state.transactions.find((tx) => tx.hash === hash);
  if (existing) Object.assign(existing, entry);
  else state.transactions.push(entry);
  log(`tx ${step}: ${hash}`);
  writeLiveState();
  return hash;
}

async function call(step, signer, receiver, method, args = {}, options = {}) {
  const {
    deposit = 0n,
    gas = GAS_30,
    extra = {},
    throwOnFailure = true,
  } = options;
  const account = accountFor(signer);
  let result;
  try {
    result = await account.signAndSendTransaction({
      receiverId: receiver,
      actions: [actions.functionCall(method, Buffer.from(JSON.stringify(args)), gas, deposit)],
      waitUntil: 'FINAL',
      throwOnFailure,
    });
  } catch (error) {
    const txResult = error?.transactionResult;
    const hash = error?.transactionHash || txResult?.transaction_outcome?.id || null;
    if (hash) {
      const detail = await provider
        .viewTransactionStatusWithReceipts({ txHash: hash, accountId: signer, waitUntil: 'FINAL' })
        .catch(() => null);
      const logs = [
        ...(detail?.receipts_outcome ?? []).flatMap((receipt) => receipt.outcome?.logs ?? []),
        ...(txResult?.receipts_outcome ?? []).flatMap((receipt) => receipt.outcome?.logs ?? []),
      ];
      console.error(
        `[live] FAILED ${step} (${method}) tx ${hash}: ${JSON.stringify(detail?.status ?? error.message).slice(0, 800)}`,
      );
      if (logs.length) console.error(`[live] FAILED logs: ${logs.join(' | ').slice(0, 1200)}`);
    }
    throw error;
  }
  recordTransaction(step, result, signer, receiver, method, {
    argsHash: sha256Hex(JSON.stringify(args)),
    depositYocto: String(deposit),
    ...extra,
  });
  return result;
}

async function deployWasm(step, accountId, wasmPath) {
  if (!wasmPath || !fs.existsSync(wasmPath)) {
    die(`WASM not found for ${step}: ${wasmPath ?? '(unset)'}`);
  }
  const account = accountFor(accountId);
  const code = fs.readFileSync(wasmPath);
  const result = await account.signAndSendTransaction({
    receiverId: accountId,
    actions: [actions.deployContract(code)],
    waitUntil: 'FINAL',
  });
  recordTransaction(step, result, accountId, accountId, 'deploy_contract', {
    wasmPath,
    wasmSha256: sha256Hex(code),
    wasmBytes: code.length,
  });
  return sha256Hex(code);
}

async function waitFor(predicate, label, timeoutMs = 90_000, intervalMs = 2_500) {
  const started = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - started > timeoutMs) die(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

function faucetForwardedFor(index) {
  const list = process.env.MEND_FAUCET_FORWARDED_FOR;
  if (!list) return undefined;
  const values = list.split(',').map((value) => value.trim()).filter(Boolean);
  if (!values.length) return undefined;
  return values[index % values.length];
}

async function createAccountWithFaucet(accountId, { rotate = false, index = 0 } = {}) {
  if (!rotate && keys?.[accountId] && (await accountExists(accountId))) return keys[accountId];

  const keyPair = await KeyPair.fromRandom('ED25519');
  const publicKey = keyPair.getPublicKey().toString();
  const secretKey = keyPair.toString();

  const headers = {
    'content-type': 'application/json',
    'user-agent': 'mend-testnet-live/1.0',
  };
  const forwarded = faucetForwardedFor(index);
  if (forwarded) headers['x-forwarded-for'] = forwarded;

  const response = await fetch('https://helper.testnet.near.org/account', {
    method: 'POST',
    headers,
    body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: publicKey }),
  });
  const text = await response.text();
  if (!response.ok) {
    die(`testnet faucet failed for ${accountId}: HTTP ${response.status} ${text.slice(0, 300)}`);
  }
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const failure = body?.status?.Failure;
  if (failure) {
    die(
      `testnet faucet rejected ${accountId}: ${JSON.stringify(failure).slice(0, 400)}. ` +
        'The keys file was not modified.',
    );
  }
  const createTx = body?.transaction_outcome?.id ?? body?.transaction?.hash ?? null;

  if (!keys) keys = { __path: process.env.MEND_TESTNET_KEYS_FILE };
  keys[accountId] = {
    account: accountId,
    publicKey,
    secretKey,
    seedPhrase: null,
    createTx,
    network: NETWORK,
  };
  saveKeys();

  state.accounts[accountId] = {
    accountId,
    publicKey,
    createTx,
    createTxExplorerUrl: createTx ? explorerTx(createTx) : null,
    createdBy: 'testnet-faucet',
    explorerUrl: explorerAccount(accountId),
  };
  writeLiveState();

  await waitFor(() => accountExists(accountId), `account ${accountId} to exist`, 90_000, 2_000);
  log(`created testnet account ${accountId} (${publicKey})`);
  return keys[accountId];
}

async function verifySigningKeys() {
  const checkIds = [DEPLOYER, TOKEN, FALLBACK_DAO, ...ALL_ROLE_ACCOUNTS, HUB];
  for (const accountId of checkIds) {
    const entry = keys?.[accountId];
    if (!entry?.publicKey) continue;
    if (!(await accountExists(accountId))) continue;
    const keyList = await provider.viewAccessKeyList({ accountId });
    const matches = (keyList.keys ?? []).some((item) => item.public_key === entry.publicKey);
    if (matches) continue;
    if (accountId === HUB) {
      state.hub = {
        ...(state.hub ?? {}),
        keyAvailable: false,
        keyMismatch: {
          storedPublicKey: entry.publicKey,
          onchainPublicKeys: (keyList.keys ?? []).map((item) => item.public_key),
          note:
            'The hub signing key in MEND_TESTNET_KEYS_FILE is not an on-chain access key. The hub cannot be deleted or redeployed from this file. The hub is usable through its owner account for non-destructive calls, but a destructive re-init is impossible until the original hub key is restored.',
        },
      };
      writeLiveState();
      log('WARN hub signing key is not on-chain; destructive hub re-init is unavailable');
      continue;
    }
    die(`stored key for ${accountId} is not an on-chain access key`);
  }
}

async function ensureAccounts({ createIfMissing }) {
  const required = [DEPLOYER, TOKEN, HUB, FALLBACK_DAO, ...ALL_ROLE_ACCOUNTS];
  for (let index = 0; index < required.length; index += 1) {
    const accountId = required[index];
    if (await accountExists(accountId)) {
      if (!keys?.[accountId] && createIfMissing) {
        die(`account ${accountId} exists but no key is present in MEND_TESTNET_KEYS_FILE`);
      }
      continue;
    }
    if (!createIfMissing) {
      die(`account ${accountId} is missing; run --deploy with a keys file`);
    }
    if (keys?.[accountId]?.secretKey) {
      // The key exists but the account does not (for example after a deliberate
      // delete). The faucet needs a fresh key for the recreated account.
      await createAccountWithFaucet(accountId, { rotate: true, index });
    } else {
      await createAccountWithFaucet(accountId, { index });
    }
  }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

async function ensureToken() {
  const metadata = await tryView(TOKEN, 'ft_metadata');
  if (!metadata.ok && !metadata.missing) {
    die(`cannot read token metadata: ${metadata.error}`);
  }
  if (metadata.ok) {
    if (metadata.value.symbol !== 'mUSDC') die(`unexpected token symbol ${metadata.value.symbol}`);
    if (metadata.value.decimals !== 6) die(`unexpected token decimals ${metadata.value.decimals}`);
    const total = await view(TOKEN, 'ft_total_supply');
    if (BigInt(total) !== TOKEN_TOTAL_SUPPLY) {
      die(`unexpected token supply ${total}; expected ${TOKEN_TOTAL_SUPPLY}`);
    }
    log(`token ${TOKEN} verified: ${metadata.value.symbol}, 6 decimals, supply ${total}`);
    return;
  }

  log(`token ${TOKEN} is not initialized; deploying test token (test value only)`);
  if (!(await accountExists(TOKEN))) await createAccountWithFaucet(TOKEN);
  await deployWasm('token_deploy', TOKEN, tokenWasmPath);
  await call('token_init', DEPLOYER, TOKEN, 'new', {
    owner_id: DEPLOYER,
    total_supply: TOKEN_TOTAL_SUPPLY.toString(),
  }, { gas: GAS_100 });
}

async function ensureTokenStorage(accountId, index) {
  const storage = await tryView(TOKEN, 'storage_balance_of', { account_id: accountId });
  if (storage.ok && storage.value !== null) return;
  await call(
    `token_storage_deposit:${accountId}`,
    DEPLOYER,
    TOKEN,
    'storage_deposit',
    { account_id: accountId, registration_only: true },
    { deposit: 2_000_000_000_000_000_000_000n, gas: GAS_30, extra: { accountId } },
  );
}

async function ensureSponsorBalance() {
  const balance = BigInt(await view(TOKEN, 'ft_balance_of', { account_id: SPONSOR }));
  if (balance === 0n) {
    await call(
      'sponsor_grant_500_musdc',
      DEPLOYER,
      TOKEN,
      'ft_transfer',
      {
        receiver_id: SPONSOR,
        amount: SPONSOR_GRANT_MICRO.toString(),
        memo: 'MEND testnet demo funds (test value only)',
      },
      { deposit: YOCTO, gas: GAS_30, extra: { amountMicro: SPONSOR_GRANT_MICRO.toString() } },
    );
    log(`granted ${SPONSOR_GRANT_MICRO} micro-mUSDC to ${SPONSOR}`);
  } else {
    log(`sponsor already holds ${balance} micro-mUSDC; not re-granting`);
  }
}

// ---------------------------------------------------------------------------
// Sputnik DAO v2
// ---------------------------------------------------------------------------

async function ensureSputnikDao() {
  if (
    state.dao?.kind === 'plain-account-fallback' &&
    state.dao?.failureReason &&
    process.env.MEND_RETRY_SPUTNIK !== '1'
  ) {
    log(
      'Sputnik factory attempt already failed and is documented; keeping mend-dao.testnet fallback. Set MEND_RETRY_SPUTNIK=1 to retry.',
    );
    return FALLBACK_DAO;
  }
  const existing = await accountExists(SPUTNIK_DAO);
  if (existing) {
    const policy = await tryView(SPUTNIK_DAO, 'get_policy');
    if (!policy.ok) die(`${SPUTNIK_DAO} exists but is not a readable Sputnik DAO`);
    state.dao ??= {};
    state.dao.accountId = SPUTNIK_DAO;
    state.dao.kind = 'sputnik-v2';
    state.dao.factoryId = SPUTNIK_FACTORY;
    state.dao.policy = policy.value;
    state.dao.explorerUrl = explorerAccount(SPUTNIK_DAO);
    writeLiveState();
    log(`Sputnik DAO already exists: ${SPUTNIK_DAO}`);
    return SPUTNIK_DAO;
  }

  const initArgs = {
    config: {
      name: 'MEND Community Maintenance DAO',
      purpose:
        'Testnet-only community authorization of MEND maintenance work orders. Test value only; no mainnet authority.',
      metadata: b64(JSON.stringify({ project: 'MEND', network: 'testnet' })),
    },
    policy: [DEPLOYER],
  };
  const args = {
    name: SPUTNIK_NAME,
    args: b64(JSON.stringify(initArgs)),
  };

  try {
    log(`attempting Sputnik DAO v2 factory create: ${SPUTNIK_FACTORY}.create(${SPUTNIK_NAME})`);
    await call('sputnik_factory_create', DEPLOYER, SPUTNIK_FACTORY, 'create', args, {
      deposit: 15n * ONE_NEAR,
      gas: GAS_100,
      extra: { daoAccount: SPUTNIK_DAO, initArgsHash: sha256Hex(JSON.stringify(initArgs)) },
    });

    const policy = await waitFor(
      async () => {
        if (!(await accountExists(SPUTNIK_DAO))) return false;
        const viewResult = await tryView(SPUTNIK_DAO, 'get_policy');
        return viewResult.ok ? viewResult.value : false;
      },
      `${SPUTNIK_DAO} to become readable`,
      120_000,
      3_000,
    );

    state.dao = {
      accountId: SPUTNIK_DAO,
      kind: 'sputnik-v2',
      factoryId: SPUTNIK_FACTORY,
      name: SPUTNIK_NAME,
      initArgsHash: sha256Hex(JSON.stringify(initArgs)),
      policy,
      explorerUrl: explorerAccount(SPUTNIK_DAO),
      failureReason: null,
    };
    state.dao.creationTx = state.transactions.find((tx) => tx.step === 'sputnik_factory_create')?.hash;
    writeLiveState();
    log(`Sputnik DAO created: ${SPUTNIK_DAO}`);
    return SPUTNIK_DAO;
  } catch (error) {
    const reason = String(error.message ?? error).slice(0, 1_500);
    log(`Sputnik factory create failed: ${reason}`);
    state.dao = {
      accountId: FALLBACK_DAO,
      kind: 'plain-account-fallback',
      factoryId: SPUTNIK_FACTORY,
      attemptedAccountId: SPUTNIK_DAO,
      failureReason: reason,
      explorerUrl: explorerAccount(FALLBACK_DAO),
      factoryCallSubmitted: false,
      note:
        'The Sputnik DAO factory create transaction was not submitted: the RPC endpoint rejected the request with HTTP 429 (the endpoint is deprecated). No Sputnik DAO exists. The existing plain testnet account mend-dao.testnet is used as the DAO signer; this is a documented fallback, not a Sputnik DAO.',
    };
    writeLiveState();
    return FALLBACK_DAO;
  }
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

async function hubConfig() {
  const result = await tryView(HUB, 'get_config');
  if (result.ok) return result.value;
  if (result.missing) return null;
  die(`cannot read hub config: ${result.error}`);
}

async function hubIsEmpty() {
  if (!(await accountExists(HUB))) return true;
  const config = await hubConfig();
  if (!config) return true;
  const asset = await tryView(HUB, 'get_asset', { asset_id: ASSET_ID });
  if (!asset.ok || asset.value !== null) return false;
  const wo = await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
  if (!wo.ok || wo.value !== null) return false;
  const supply = await tryView(HUB, 'nft_total_supply');
  if (!supply.ok || BigInt(supply.value) !== 0n) return false;
  const reconciliation = await tryView(HUB, 'get_reconciliation');
  if (!reconciliation.ok) return false;
  const r = reconciliation.value;
  if (
    BigInt(r.totalFunding) !== 0n ||
    BigInt(r.totalRefunded) !== 0n ||
    BigInt(r.totalCompletionPaid) !== 0n ||
    BigInt(r.totalHoldbackReleased) !== 0n
  ) {
    return false;
  }
  return true;
}

async function resetHubAccount() {
  if (state.hub?.keyAvailable === false) {
    die(
      'cannot reset mend-hub.testnet: the signing key in MEND_TESTNET_KEYS_FILE is not an on-chain key. ' +
        'Restore the original hub key before attempting a destructive re-init.',
    );
  }
  if (!(await hubIsEmpty())) {
    die(
      'refusing to reset mend-hub.testnet: it contains asset/work-order or escrow state. A manual, audited migration is required.',
    );
  }
  log('hub has no production state; deleting and recreating the account to re-init with the Sputnik DAO');
  const hub = accountFor(HUB);
  const result = await hub.deleteAccount(DEPLOYER);
  recordTransaction('hub_delete_for_reinit', result, HUB, HUB, 'delete_account', {
    beneficiaryId: DEPLOYER,
  });
  await waitFor(async () => !(await accountExists(HUB)), 'hub account deletion', 60_000, 2_000);
  await createAccountWithFaucet(HUB, { rotate: true, index: 0 });
  state.hub ??= {};
  state.hub.resetForDao = {
    reason: 'Re-initialised to bind the Sputnik DAO account as hub config.dao.',
    at: nowIso(),
    deleteTx: state.transactions.find((tx) => tx.step === 'hub_delete_for_reinit')?.hash ?? null,
  };
  writeLiveState();
}

async function ensureHub(daoAccount) {
  let config = await hubConfig();
  if (config && config.dao === daoAccount) {
    log(`hub ${HUB} already configured with DAO ${daoAccount}`);
    return;
  }
  if (config && config.dao !== daoAccount) {
    if (!(await hubIsEmpty())) {
      die(
        `hub DAO is ${config.dao}, expected ${daoAccount}, and the hub is not empty. Refusing a destructive re-init.`,
      );
    }
    await resetHubAccount();
    config = null;
  }

  if (!(await accountExists(HUB))) {
    await createAccountWithFaucet(HUB);
  }
  if (!config) {
    const codeHash = await provider.viewContractCode({ contractId: HUB }).then(
      (result) => result.code_base64 ?? result.codeBase64 ?? null,
      (error) => {
        if (isMissingContractError(error)) return null;
        throw error;
      },
    );
    if (!codeHash) {
      await deployWasm('hub_deploy', HUB, hubWasmPath);
    }
    await call(
      'hub_init',
      DEPLOYER,
      HUB,
      'new',
      {
        owner: DEPLOYER,
        token: TOKEN,
        dao: daoAccount,
        policy_hash: POLICY_HASH,
        durability_minutes: DURABILITY_MINUTES,
      },
      { gas: GAS_100, extra: { daoAccount } },
    );
    config = await waitFor(hubConfig, 'hub config after init', 30_000, 1_500);
  }
  if (config.dao !== daoAccount) die(`hub DAO mismatch after init: ${config.dao} != ${daoAccount}`);
  if (config.token !== TOKEN) die(`hub token mismatch: ${config.token}`);
  if (config.policyHash !== POLICY_HASH) die(`hub policy hash mismatch: ${config.policyHash}`);
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

async function ensureRoles(daoAccount) {
  const expected = { ...ROLE_BY_ACCOUNT, [daoAccount]: 'DAO' };
  for (const [accountId, role] of Object.entries(expected)) {
    const current = await view(HUB, 'get_role', { account: accountId });
    if (current.includes(role)) continue;
    await call(
      `hub_set_role:${accountId}:${role}`,
      DEPLOYER,
      HUB,
      'set_role',
      { account: accountId, role, enabled: true },
      { extra: { accountId, role } },
    );
  }
}

// ---------------------------------------------------------------------------
// Asset, passport, work order, DAO authorization, funding
// ---------------------------------------------------------------------------

const ASSET_DESCRIPTION = 'Public park bench with a split seat plank and loose armrest.';
const ASSET_LOCATION = 'Riverside Park, bench near east gate';

function assetFileValue() {
  return {
    schema: 'mend.asset.v1',
    assetId: ASSET_ID,
    assetType: 'bench',
    publicDescription: ASSET_DESCRIPTION,
    publicLocation: ASSET_LOCATION,
    note: 'Testnet deployment evidence. The location is a coarse public label; no private address is stored.',
  };
}

async function ensureAsset() {
  const assetPath = path.join(HERE, 'asset', `${ASSET_ID}.json`);
  const assetDoc = assetFileValue();
  const assetText = jsonFile(assetPath, assetDoc);
  if (!fs.existsSync(assetPath)) {
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.writeFileSync(assetPath, assetText);
  }
  const descriptionHash = sha256Hex(ASSET_DESCRIPTION);
  const locationHash = sha256Hex(ASSET_LOCATION);

  let assetResult = await tryView(HUB, 'get_asset', { asset_id: ASSET_ID });
  if (!assetResult.ok) die(`cannot read asset ${ASSET_ID}: ${assetResult.error}`);
  let asset = assetResult.value;
  if (asset === null) {
    await call(
      'asset_create_BENCH-001',
      STEWARD,
      HUB,
      'create_asset',
      {
        asset_id: ASSET_ID,
        description_hash: descriptionHash,
        location_hash: locationHash,
      },
      { extra: { assetId: ASSET_ID, descriptionHash, locationHash } },
    );
    asset = await waitFor(
      async () => (await tryView(HUB, 'get_asset', { asset_id: ASSET_ID })).value,
      `asset ${ASSET_ID}`,
      20_000,
      1_500,
    );
  }
  if (asset.descriptionHash !== descriptionHash) {
    die(`asset description hash mismatch: ${asset.descriptionHash}`);
  }
  if (asset.locationHash !== locationHash) {
    die(`asset location hash mismatch: ${asset.locationHash}`);
  }

  let token = await view(HUB, 'nft_token', { token_id: ASSET_ID });
  if (token === null) {
    await call('passport_mint_BENCH-001', STEWARD, HUB, 'mint_passport', { asset_id: ASSET_ID });
    token = await waitFor(
      async () => view(HUB, 'nft_token', { token_id: ASSET_ID }),
      `passport ${ASSET_ID}`,
      20_000,
      1_500,
    );
  }
  if (token.owner_id !== HUB) die(`passport owner is ${token.owner_id}, expected ${HUB}`);

  state.asset = {
    assetId: ASSET_ID,
    description: ASSET_DESCRIPTION,
    location: ASSET_LOCATION,
    descriptionHash,
    locationHash,
    file: path.relative(ROOT, assetPath),
    passportTokenId: ASSET_ID,
    passportOwner: token.owner_id,
    transferable: false,
    legalOwnership: false,
    explorerUrl: explorerAccount(HUB),
  };
  writeLiveState();
  log(`asset ${ASSET_ID} and non-transferable passport verified (owner ${HUB})`);
}

function scopeDocument({ daoProposalId, commitDeadlineNs, revealDeadlineNs }) {
  return {
    schema: 'mend.work-order.scope.v1',
    workOrderId: WORK_ORDER_ID,
    assetId: ASSET_ID,
    reportClusterId: CLUSTER_ID,
    title: 'BENCH-001 seat plank and armrest repair',
    publicScope:
      'Replace the split seat plank with a matching weather-treated plank, re-fix the loose armrest, and leave the bench safe and usable.',
    deliverable:
      'Completed repair with after-photo evidence hashes, materials receipt hash and an inspector-approved durability check.',
    evidenceChecklist: [
      'after-photo hash',
      'materials receipt hash',
      'contractor completion note hash',
      'inspector notes hash',
    ],
    budgetMicro: BUDGET_MICRO.toString(),
    policyHash: POLICY_HASH,
    policyVersion: POLICY_VERSION,
    contractorRoster: CONTRACTORS.slice(0, 3),
    inspectorRoster: INSPECTORS,
    daoProposalId,
    commitDeadlineNs: String(commitDeadlineNs),
    revealDeadlineNs: String(revealDeadlineNs),
    commitDeadline: new Date(Number(commitDeadlineNs / 1_000_000n)).toISOString(),
    revealDeadline: new Date(Number(revealDeadlineNs / 1_000_000n)).toISOString(),
    note: 'Testnet demo work order. No real repair is asserted; evidence is testnet-only.',
  };
}

async function nextDaoProposalId(daoAccount) {
  if (state.dao?.kind === 'sputnik-v2' || daoAccount === SPUTNIK_DAO) {
    const last = await view(SPUTNIK_DAO, 'get_last_proposal_id');
    return String(last);
  }
  if (process.env.MEND_DAO_PROPOSAL_ID) return process.env.MEND_DAO_PROPOSAL_ID;
  const suffix = WORK_ORDER_ID.match(/-([0-9]+)$/)?.[1] ?? '1';
  return `local-dao-approval-${suffix}`;
}

async function cleanupPreAwardWorkOrders() {
  const asset = (await tryView(HUB, 'get_asset', { asset_id: ASSET_ID })).value;
  if (!asset) return;
  const cancellable = ['DRAFT', 'POLICY_APPROVED', 'FUNDED', 'BIDDING_OPEN', 'BIDDING_REVEAL', 'SCORED'];
  state.replacedWorkOrders ??= [];
  for (const oldId of asset.workOrderIds ?? []) {
    if (oldId === WORK_ORDER_ID) continue;
    const old = (await tryView(HUB, 'get_work_order', { work_order_id: oldId })).value;
    if (!old) continue;
    if (old.status === 'REFUNDED' || old.status === 'CANCELLED') {
      state.replacedWorkOrders = state.replacedWorkOrders.filter((item) => item.workOrderId !== oldId);
      state.replacedWorkOrders.push({
        workOrderId: oldId,
        status: old.status,
        funded: old.funded,
        note: 'Pre-award replacement work order; preserved on-chain for audit.',
      });
      continue;
    }
    if (!cancellable.includes(old.status)) continue;

    const reason = {
      schema: 'mend.cancel-reason.v1',
      workOrderId: oldId,
      reason:
        'This pre-award work order could not be used for the live lifecycle (expired commitment window or an earlier commitment-format mismatch). It is cancelled and refunded; the completed lifecycle is the active replacement work order recorded in workOrder.workOrderId.',
      replacementWorkOrderId: WORK_ORDER_ID,
      at: nowIso(),
    };
    const cancelPath = path.join(HERE, 'scope', `${oldId}-cancel.json`);
    const cancelText = jsonFile(cancelPath, reason);
    if (!fs.existsSync(cancelPath)) writeJson(cancelPath, reason);
    const reasonHash = sha256Hex(fs.readFileSync(cancelPath, 'utf8'));
    if (old.status !== 'CANCELLED') {
      await call(`cleanup_cancel:${oldId}`, STEWARD, HUB, 'cancel_work_order', {
        work_order_id: oldId,
        reason_hash: reasonHash,
      }, { extra: { workOrderId: oldId, reasonHash } });
    }
    const current = await view(HUB, 'get_work_order', { work_order_id: oldId });
    if (BigInt(current.funded) > 0n && current.status !== 'REFUNDED') {
      await call(`cleanup_refund:${oldId}`, STEWARD, HUB, 'refund', {
        work_order_id: oldId,
      }, { extra: { workOrderId: oldId } });
    }
    const final = await view(HUB, 'get_work_order', { work_order_id: oldId });
    state.replacedWorkOrders = state.replacedWorkOrders.filter((item) => item.workOrderId !== oldId);
    state.replacedWorkOrders.push({
      workOrderId: oldId,
      status: final.status,
      funded: final.funded,
      reasonFile: path.relative(ROOT, cancelPath),
      reasonHash,
      cancelTx: state.transactions.find((tx) => tx.step === `cleanup_cancel:${oldId}`)?.hash ?? null,
      refundTx: state.transactions.find((tx) => tx.step === `cleanup_refund:${oldId}`)?.hash ?? null,
      note: 'Pre-award replacement work order; preserved on-chain for audit.',
    });
    writeLiveState();
    log(`cancelled/refunded pre-award ${oldId}; active lifecycle work order is ${WORK_ORDER_ID}`);
  }
}

async function ensureWorkOrder(daoAccount) {
  let wo = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
  const scopePath = path.join(HERE, 'scope', `${WORK_ORDER_ID}.scope.json`);

  if (!wo) {
    const proposalId = await nextDaoProposalId(daoAccount);
    const currentMs = await latestBlockTimestampMs();
    const commitDeadlineNs = BigInt(currentMs + 180_000) * 1_000_000n;
    const revealDeadlineNs = BigInt(currentMs + 360_000) * 1_000_000n;
    const scope = scopeDocument({ daoProposalId: proposalId, commitDeadlineNs, revealDeadlineNs });
    const scopeText = jsonFile(scopePath, scope);
    writeJson(scopePath, scope);
    const scopeHash = sha256Hex(scopeText);

    await call(
      'work_order_create',
      STEWARD,
      HUB,
      'create_work_order',
      {
        work_order_id: WORK_ORDER_ID,
        asset_id: ASSET_ID,
        cluster_hash: sha256Hex(`mend.cluster.${CLUSTER_ID}`),
        scope_hash: scopeHash,
        dao_proposal_id: proposalId,
        policy_hash: POLICY_HASH,
        budget: BUDGET_MICRO.toString(),
        sponsor: SPONSOR,
        contractor_roster: CONTRACTORS.slice(0, 3),
        inspector_roster: INSPECTORS,
        commit_deadline: rawU64(commitDeadlineNs),
        reveal_deadline: rawU64(revealDeadlineNs),
      },
      { extra: { workOrderId: WORK_ORDER_ID, scopeHash, proposalId } },
    );
    wo = await waitFor(
      async () => (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value,
      `work order ${WORK_ORDER_ID}`,
      20_000,
      1_500,
    );
  }

  if (wo.status === 'DRAFT') {
    if (!fs.existsSync(scopePath)) die(`scope file missing for existing DRAFT work order: ${scopePath}`);
    const scopeHash = sha256Hex(fs.readFileSync(scopePath, 'utf8'));
    if (scopeHash !== wo.scopeHash) die('scope file hash does not match on-chain scope hash');

    if (state.dao?.kind === 'sputnik-v2' || daoAccount === SPUTNIK_DAO) {
      const proposalId = Number(wo.daoProposalId);
      const last = Number(await view(SPUTNIK_DAO, 'get_last_proposal_id'));
      if (!Number.isInteger(proposalId) || proposalId > last) {
        die(`work order proposal id ${wo.daoProposalId} is not a valid next Sputnik proposal id (last=${last})`);
      }
      if (proposalId < last) {
        die(`work order proposal id ${wo.daoProposalId} is already past; refuse ambiguous DAO path`);
      }
      const authorizationArgs = {
        work_order_id: WORK_ORDER_ID,
        proposal_id: wo.daoProposalId,
        scope_hash: wo.scopeHash,
        policy_hash: wo.policyHash,
        budget: wo.budget,
        contractor_roster: wo.contractorRoster,
        inspector_roster: wo.inspectorRoster,
        commit_deadline: rawU64(wo.commitDeadline),
        reveal_deadline: rawU64(wo.revealDeadline),
      };
      const addProposal = {
        description: `Authorize MEND work order ${WORK_ORDER_ID} with policy ${POLICY_HASH}`,
        kind: {
          FunctionCall: {
            receiver_id: HUB,
            actions: [
              {
                method_name: 'dao_authorize',
                args: b64(JSON.stringify(authorizationArgs)),
                deposit: '0',
                gas: (100n * TGAS).toString(),
              },
            ],
          },
        },
      };
      await call('dao_add_proposal', DEPLOYER, SPUTNIK_DAO, 'add_proposal', addProposal, {
        deposit: ONE_NEAR,
        gas: GAS_100,
        extra: { proposalId: wo.daoProposalId, workOrderId: WORK_ORDER_ID },
      });
      await call(
        'dao_approve_proposal',
        DEPLOYER,
        SPUTNIK_DAO,
        'act_proposal',
        { id: proposalId, action: 'VoteApprove', memo: `MEND ${WORK_ORDER_ID}` },
        { gas: GAS_100, extra: { proposalId: wo.daoProposalId } },
      );
      state.dao.proposalId = wo.daoProposalId;
      state.dao.proposalPath = {
        method: 'add_proposal',
        kind: 'FunctionCall',
        receiverId: HUB,
        hubMethod: 'dao_authorize',
        argsHash: sha256Hex(JSON.stringify(authorizationArgs)),
        approvalMethod: 'act_proposal',
        action: 'VoteApprove',
        addProposalTx: state.transactions.find((tx) => tx.step === 'dao_add_proposal')?.hash ?? null,
        approveProposalTx:
          state.transactions.find((tx) => tx.step === 'dao_approve_proposal')?.hash ?? null,
      };
      writeLiveState();
    } else {
      await call(
        'dao_authorize_fallback',
        FALLBACK_DAO,
        HUB,
        'dao_authorize',
        {
          work_order_id: WORK_ORDER_ID,
          proposal_id: wo.daoProposalId,
          scope_hash: wo.scopeHash,
          policy_hash: wo.policyHash,
          budget: wo.budget,
          contractor_roster: wo.contractorRoster,
          inspector_roster: wo.inspectorRoster,
          commit_deadline: rawU64(wo.commitDeadline),
          reveal_deadline: rawU64(wo.revealDeadline),
        },
        { extra: { proposalId: wo.daoProposalId } },
      );
      state.dao.proposalId = wo.daoProposalId;
      state.dao.proposalPath = {
        method: 'dao_authorize',
        note: 'Sputnik factory failed; the plain testnet DAO account signed directly. This is a documented fallback, not a Sputnik DAO.',
        tx: state.transactions.find((tx) => tx.step === 'dao_authorize_fallback')?.hash ?? null,
      };
      writeLiveState();
    }
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'POLICY_APPROVED' ? current : false;
      },
      'work order POLICY_APPROVED',
      60_000,
      2_000,
    );
  }

  if (wo.status === 'POLICY_APPROVED') {
    await call(
      'work_order_fund_100_musdc',
      SPONSOR,
      TOKEN,
      'ft_transfer_call',
      {
        receiver_id: HUB,
        amount: BUDGET_MICRO.toString(),
        memo: 'MEND work order escrow (test value only)',
        msg: WORK_ORDER_ID,
      },
      { deposit: YOCTO, gas: GAS_100, extra: { workOrderId: WORK_ORDER_ID } },
    );
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'FUNDED' ? current : false;
      },
      'work order FUNDED',
      30_000,
      1_500,
    );
  }

  if (wo.status === 'FUNDED') {
    await call('work_order_open_bidding', STEWARD, HUB, 'open_bidding', {
      work_order_id: WORK_ORDER_ID,
    }, { extra: { workOrderId: WORK_ORDER_ID } });
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'BIDDING_OPEN' ? current : false;
      },
      'work order BIDDING_OPEN',
      20_000,
      1_500,
    );
  }

  state.workOrder = {
    ...state.workOrder,
    requestedWorkOrderId: REQUESTED_WORK_ORDER_ID,
    workOrderId: WORK_ORDER_ID,
    assetId: ASSET_ID,
    status: wo.status,
    scopeHash: wo.scopeHash,
    scopeFile: path.relative(ROOT, scopePath),
    policyHash: wo.policyHash,
    policyVersion: POLICY_VERSION,
    budgetMicro: wo.budget,
    sponsor: wo.sponsor,
    contractorRoster: wo.contractorRoster,
    inspectorRoster: wo.inspectorRoster,
    daoProposalId: wo.daoProposalId,
    commitDeadline: new Date(Number(BigInt(wo.commitDeadline) / 1_000_000n)).toISOString(),
    revealDeadline: new Date(Number(BigInt(wo.revealDeadline) / 1_000_000n)).toISOString(),
    commitDeadlineNs: wo.commitDeadline,
    revealDeadlineNs: wo.revealDeadline,
    explorerUrl: explorerAccount(HUB),
  };
  writeLiveState();
  log(`work order ${WORK_ORDER_ID} status ${wo.status}`);
  return wo;
}

// ---------------------------------------------------------------------------
// Deterministic local scoring (matches packages/protocol/src/scoring.ts)
// ---------------------------------------------------------------------------

function bidCommitmentPayload(bid) {
  if (BID_PAYLOAD_VERSION === 'V2') {
    return [
      'MEND_BID_V2',
      bid.bidId,
      bid.contractorId,
      bid.priceMicro,
      bid.durationDays,
      bid.warrantyDays,
      bid.materialsScore,
      bid.availableInDays,
      bid.checklistAccepted ? '1' : '0',
      bid.nonce,
    ].join('|');
  }
  return [
    'MEND_BID_V1',
    bid.bidId,
    bid.contractorId,
    bid.priceMicro,
    bid.durationDays,
    bid.warrantyDays,
    bid.materialsScore,
    bid.checklistAccepted ? '1' : '0',
    bid.nonce,
  ].join('|');
}

async function detectBidPayloadVersion() {
  if (BID_PAYLOAD_VERSION) return;
  const code = await provider.viewContractCode({ contractId: HUB });
  const wasmText = Buffer.from(code.code_base64, 'base64').toString('latin1');
  BID_PAYLOAD_VERSION = wasmText.includes('MEND_BID_V2') ? 'V2' : 'V1';
  log(`deployed hub bid commitment format: ${BID_PAYLOAD_VERSION}`);
}

function normalize(value, min, max, direction) {
  if (max === min) return 10_000n;
  const raw = direction === 'lower' ? max - value : value - min;
  return (raw * 10_000n) / (max - min);
}

function deterministicScore(bids) {
  const eligible = bids.filter((bid) => bid.eligible);
  if (!eligible.length) die('no eligible bids to score');
  const prices = eligible.map((bid) => BigInt(bid.priceMicro));
  const durations = eligible.map((bid) => BigInt(bid.durationDays));
  const warranties = eligible.map((bid) => BigInt(bid.warrantyDays));
  const minPrice = prices.reduce((a, b) => (a < b ? a : b));
  const maxPrice = prices.reduce((a, b) => (a > b ? a : b));
  const minDuration = durations.reduce((a, b) => (a < b ? a : b));
  const maxDuration = durations.reduce((a, b) => (a > b ? a : b));
  const minWarranty = warranties.reduce((a, b) => (a < b ? a : b));
  const maxWarranty = warranties.reduce((a, b) => (a > b ? a : b));

  const scored = eligible.map((bid) => {
    const price = BigInt(bid.priceMicro);
    const duration = BigInt(bid.durationDays);
    const warranty = BigInt(bid.warrantyDays);
    const material = BigInt(bid.materialsScore);
    const dimensionsBps = {
      price: Number(normalize(price, minPrice, maxPrice, 'lower')),
      warranty: Number(normalize(warranty, minWarranty, maxWarranty, 'higher')),
      duration: Number(normalize(duration, minDuration, maxDuration, 'lower')),
      materials: Number(material * 100n),
    };
    const weighted =
      BigInt(WEIGHTS_BPS.price) * BigInt(dimensionsBps.price) +
      BigInt(WEIGHTS_BPS.warranty) * BigInt(dimensionsBps.warranty) +
      BigInt(WEIGHTS_BPS.duration) * BigInt(dimensionsBps.duration) +
      BigInt(WEIGHTS_BPS.materials) * BigInt(dimensionsBps.materials);
    const scoreBps = Number((weighted + 5_000n) / 10_000n);
    return {
      rank: 0,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      scoreBps,
      dimensionsBps,
      priceMicro: bid.priceMicro,
      durationDays: bid.durationDays,
      warrantyDays: bid.warrantyDays,
      materialsScore: bid.materialsScore,
    };
  });

  scored.sort((a, b) => {
    if (b.scoreBps !== a.scoreBps) return b.scoreBps - a.scoreBps;
    const priceA = BigInt(a.priceMicro);
    const priceB = BigInt(b.priceMicro);
    if (priceA !== priceB) return priceA < priceB ? -1 : 1;
    if (a.warrantyDays !== b.warrantyDays) return b.warrantyDays - a.warrantyDays;
    if (a.durationDays !== b.durationDays) return a.durationDays - b.durationDays;
    return a.bidId.localeCompare(b.bidId);
  });
  scored.forEach((bid, index) => {
    bid.rank = index + 1;
  });
  return scored;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function evidenceDocument(kind, extra = {}) {
  return {
    schema: 'mend.evidence.v1',
    kind,
    workOrderId: WORK_ORDER_ID,
    assetId: ASSET_ID,
    network: 'testnet',
    note: 'Testnet-only lifecycle evidence. No real-world repair, payment or legal ownership is asserted.',
    ...extra,
  };
}

async function ensureEvidenceFile(relativePath, value) {
  const pathname = path.join(HERE, relativePath);
  if (!fs.existsSync(pathname)) writeJson(pathname, value);
  const text = fs.readFileSync(pathname, 'utf8');
  return { path: pathname, file: path.relative(ROOT, pathname), hash: sha256Hex(text) };
}

async function ensureCommitments() {
  let bids = await view(HUB, 'get_bids', { work_order_id: WORK_ORDER_ID });
  for (const key of ['A', 'B', 'C']) {
    const bid = { ...BID_VALUES[key], checklistAccepted: true, eligible: true };
    const commitmentHash = sha256Hex(bidCommitmentPayload(bid));
    const already = (bids.commitments ?? []).some((item) => item.bidId === bid.bidId);
    if (already) continue;
    await call(
      `bid_commit_${key}`,
      bid.contractorId,
      HUB,
      'commit_bid',
      {
        work_order_id: WORK_ORDER_ID,
        bid_id: bid.bidId,
        commitment_hash: commitmentHash,
      },
      { extra: { workOrderId: WORK_ORDER_ID, bidId: bid.bidId, commitmentHash, contractorId: bid.contractorId } },
    );
    state.lifecycle.bids = state.lifecycle.bids ?? [];
    state.lifecycle.bids.push({
      label: key,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      commitmentHash,
      commitmentTx: state.transactions.find((tx) => tx.step === `bid_commit_${key}`)?.hash ?? null,
    });
    writeLiveState();
  }
}

async function ensureReveals() {
  const wo = await view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
  const commitDeadlineMs = Number(BigInt(wo.commitDeadline) / 1_000_000n);
  await waitForOnchainMs(commitDeadlineMs + 2_000, 'commit deadline');
  const bids = await view(HUB, 'get_bids', { work_order_id: WORK_ORDER_ID });
  for (const key of ['A', 'B', 'C']) {
    const bid = { ...BID_VALUES[key], checklistAccepted: true, eligible: true };
    const already = (bids.reveals ?? []).some((item) => item.bidId === bid.bidId);
    if (already) continue;
    const revealArgs = {
      work_order_id: WORK_ORDER_ID,
      bid_id: bid.bidId,
      price: bid.priceMicro,
      duration_days: bid.durationDays,
      warranty_days: bid.warrantyDays,
      materials_score: bid.materialsScore,
      checklist_accepted: true,
      nonce: bid.nonce,
    };
    if (BID_PAYLOAD_VERSION === 'V2') revealArgs.available_in_days = bid.availableInDays;
    await call(
      `bid_reveal_${key}`,
      bid.contractorId,
      HUB,
      'reveal_bid',
      revealArgs,
      {
        extra: {
          workOrderId: WORK_ORDER_ID,
          bidId: bid.bidId,
          contractorId: bid.contractorId,
          availableInDays: bid.availableInDays,
          availabilityRecordedOnchain: BID_PAYLOAD_VERSION === 'V2',
        },
      },
    );
    const item = state.lifecycle.bids.find((entry) => entry.bidId === bid.bidId);
    if (item) {
      item.revealTx = state.transactions.find((tx) => tx.step === `bid_reveal_${key}`)?.hash ?? null;
      item.priceMicro = bid.priceMicro;
      item.durationDays = bid.durationDays;
      item.warrantyDays = bid.warrantyDays;
      item.materialsScore = bid.materialsScore;
      item.availableInDays = bid.availableInDays;
    }
    writeLiveState();
  }
}

async function ensureScored() {
  let wo = await view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
  if (wo.status === 'BIDDING_OPEN') {
    const revealDeadlineMs = Number(BigInt(wo.revealDeadline) / 1_000_000n);
    await waitForOnchainMs(revealDeadlineMs + 2_000, 'reveal deadline');
    await call('bidding_close', STEWARD, HUB, 'close_bidding', { work_order_id: WORK_ORDER_ID }, { extra: { workOrderId: WORK_ORDER_ID } });
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'BIDDING_REVEAL' ? current : false;
      },
      'work order BIDDING_REVEAL',
      20_000,
      1_500,
    );
  }
  if (wo.status !== 'BIDDING_REVEAL') return wo;

  const scoreInput = await view(HUB, 'get_score_input', { work_order_id: WORK_ORDER_ID });
  const inputHash = scoreInput.inputHash ?? scoreInput.input_hash;
  if (!inputHash) die('get_score_input did not return an input hash');
  const canonicalInput = typeof scoreInput.input === 'string' ? JSON.parse(scoreInput.input) : scoreInput.input;
  const ranking = deterministicScore(
    canonicalInput.bids.map((bid) => ({
      bidId: bid.bid_id,
      contractorId: bid.contractor,
      priceMicro: bid.price_micro,
      durationDays: bid.duration_days,
      warrantyDays: bid.warranty_days,
      materialsScore: bid.materials_score,
      eligible: bid.eligible,
    })),
  );
  const output = {
    schema: 'mend.bid-rules.v1',
    policyVersion: POLICY_VERSION,
    policyHash: POLICY_HASH,
    weightsBps: WEIGHTS_BPS,
    ranking,
    excluded: [],
    winnerBidId: ranking[0].bidId,
    inputHash,
  };
  const outputText = jsonFile(path.join(HERE, 'score', `${WORK_ORDER_ID}.score.json`), output);
  const outputPath = path.join(HERE, 'score', `${WORK_ORDER_ID}.score.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outputText);
  const outputHash = sha256Hex(outputText);
  const scoringWasmLabel = sha256Hex('LOCAL_DETERMINISTIC|mend-bid-policy-v1|node');

  const scoreExecutionId = 'SX-LIVE-0001';
  await call(
    'score_record_LOCAL_DETERMINISTIC',
    STEWARD,
    HUB,
    'record_score',
    {
      work_order_id: WORK_ORDER_ID,
      execution_id: scoreExecutionId,
      policy_hash: POLICY_HASH,
      wasm_hash: scoringWasmLabel,
      input_hash: inputHash,
      output_hash: outputHash,
      ranking: ranking.map((bid) => ({
        rank: bid.rank,
        bidId: bid.bidId,
        contractorId: bid.contractorId,
        scoreBps: bid.scoreBps,
      })),
    },
    {
      extra: {
        workOrderId: WORK_ORDER_ID,
        executionId: scoreExecutionId,
        mode: 'LOCAL_DETERMINISTIC',
        inputHash,
        outputHash,
      },
    },
  );

  state.lifecycle.score = {
    executionId: scoreExecutionId,
    mode: 'LOCAL_DETERMINISTIC',
    outlayerUsed: false,
    outlayerReason:
      'OutLayer live publish is not funded/configured; no OutLayer execution is claimed.',
    policyHash: POLICY_HASH,
    policyVersion: POLICY_VERSION,
    weightsBps: WEIGHTS_BPS,
    inputHash,
    outputHash,
    wasmHash: scoringWasmLabel,
    winnerBidId: ranking[0].bidId,
    ranking,
    inputFile: path.relative(ROOT, path.join(HERE, 'score', `${WORK_ORDER_ID}.canonical-input.json`)),
    outputFile: path.relative(ROOT, outputPath),
    recordTx: state.transactions.find((tx) => tx.step === 'score_record_LOCAL_DETERMINISTIC')?.hash ?? null,
  };
  writeJson(path.join(HERE, 'score', `${WORK_ORDER_ID}.canonical-input.json`), canonicalInput);
  writeLiveState();
  log(`recorded LOCAL_DETERMINISTIC score; winner ${ranking[0].bidId} (${ranking[0].scoreBps} bps)`);
  return view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
}

async function ensureAwardedAndClosed() {
  let wo = await view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });

  if (wo.status === 'SCORED') {
    const score = await view(HUB, 'get_score', { work_order_id: WORK_ORDER_ID });
    const winner = score.ranking[0];
    await call('award_winner_B', STEWARD, HUB, 'award', {
      work_order_id: WORK_ORDER_ID,
      bid_id: winner.bidId,
    }, { extra: { workOrderId: WORK_ORDER_ID, bidId: winner.bidId, contractorId: winner.contractorId } });
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'AWARDED' ? current : false;
      },
      'work order AWARDED',
      30_000,
      1_500,
    );
    state.workOrder.awardedBidId = winner.bidId;
    state.workOrder.awardedContractor = winner.contractorId;
    state.workOrder.awardTx = state.transactions.find((tx) => tx.step === 'award_winner_B')?.hash ?? null;
    writeLiveState();
  }

  if (wo.status === 'AWARDED') {
    await call('work_start_B', BID_VALUES.B.contractorId, HUB, 'start_work', {
      work_order_id: WORK_ORDER_ID,
    }, { extra: { workOrderId: WORK_ORDER_ID } });
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'IN_PROGRESS' ? current : false;
      },
      'work order IN_PROGRESS',
      20_000,
      1_500,
    );
  }

  if (wo.status === 'IN_PROGRESS') {
    const evidence = await ensureEvidenceFile(
      `evidence/${WORK_ORDER_ID}-completion.json`,
      evidenceDocument('COMPLETION', {
        evidenceId: 'EV-LIVE-0001',
        contractorId: BID_VALUES.B.contractorId,
        afterPhotoHash: sha256Hex('testnet-after-photo-placeholder'),
        materialsReceiptHash: sha256Hex('testnet-materials-receipt-placeholder'),
        statement: 'Seat plank replaced and armrest re-fixed on testnet demo asset BENCH-001.',
      }),
    );
    await call(
      'completion_submit_EV-LIVE-0001',
      BID_VALUES.B.contractorId,
      HUB,
      'submit_completion',
      {
        work_order_id: WORK_ORDER_ID,
        evidence_id: 'EV-LIVE-0001',
        evidence_hash: evidence.hash,
      },
      { extra: { workOrderId: WORK_ORDER_ID, evidenceId: 'EV-LIVE-0001', evidenceHash: evidence.hash } },
    );
    state.lifecycle.evidence.push({
      evidenceId: 'EV-LIVE-0001',
      kind: 'COMPLETION',
      file: evidence.file,
      hash: evidence.hash,
      tx: state.transactions.find((tx) => tx.step === 'completion_submit_EV-LIVE-0001')?.hash ?? null,
    });
    writeLiveState();
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'COMPLETION_SUBMITTED' ? current : false;
      },
      'work order COMPLETION_SUBMITTED',
      20_000,
      1_500,
    );
  }

  if (wo.status === 'COMPLETION_SUBMITTED') {
    const notes = await ensureEvidenceFile(
      `evidence/${WORK_ORDER_ID}-inspection-completion.json`,
      evidenceDocument('INSPECTION_COMPLETION', {
        inspectionId: 'INS-LIVE-0001',
        inspectorId: INSPECTORS[0],
        decision: 'APPROVED',
        statement: 'Completion evidence reviewed; repair meets the agreed scope on testnet.',
      }),
    );
    await call(
      'completion_accept_INS-LIVE-0001',
      INSPECTORS[0],
      HUB,
      'accept_completion',
      {
        work_order_id: WORK_ORDER_ID,
        inspection_id: 'INS-LIVE-0001',
        notes_hash: notes.hash,
      },
      { extra: { workOrderId: WORK_ORDER_ID, inspectionId: 'INS-LIVE-0001', notesHash: notes.hash } },
    );
    state.lifecycle.inspections.push({
      inspectionId: 'INS-LIVE-0001',
      kind: 'COMPLETION',
      inspectorId: INSPECTORS[0],
      decision: 'APPROVED',
      file: notes.file,
      hash: notes.hash,
      tx: state.transactions.find((tx) => tx.step === 'completion_accept_INS-LIVE-0001')?.hash ?? null,
      amountMicro: COMPLETION_SPLIT.completion.toString(),
    });
    writeLiveState();
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'DURABILITY_PENDING' ? current : false;
      },
      'work order DURABILITY_PENDING',
      20_000,
      1_500,
    );
  }

  if (wo.status === 'DURABILITY_PENDING') {
    const dueMs = Number(BigInt(wo.durabilityDueAt) / 1_000_000n);
    await waitForOnchainMs(dueMs + 2_000, 'durability due time');
    const notes = await ensureEvidenceFile(
      `evidence/${WORK_ORDER_ID}-inspection-durability.json`,
      evidenceDocument('INSPECTION_DURABILITY', {
        inspectionId: 'INS-LIVE-0002',
        inspectorId: INSPECTORS[1],
        decision: 'APPROVED',
        statement: 'Durability interval elapsed; repair remains stable on testnet demo asset BENCH-001.',
      }),
    );
    await call(
      'durability_pass_INS-LIVE-0002',
      INSPECTORS[1],
      HUB,
      'inspect_durability',
      {
        work_order_id: WORK_ORDER_ID,
        passed: true,
        inspection_id: 'INS-LIVE-0002',
        notes_hash: notes.hash,
      },
      { extra: { workOrderId: WORK_ORDER_ID, inspectionId: 'INS-LIVE-0002', notesHash: notes.hash } },
    );
    state.lifecycle.inspections.push({
      inspectionId: 'INS-LIVE-0002',
      kind: 'DURABILITY',
      inspectorId: INSPECTORS[1],
      decision: 'APPROVED',
      file: notes.file,
      hash: notes.hash,
      tx: state.transactions.find((tx) => tx.step === 'durability_pass_INS-LIVE-0002')?.hash ?? null,
      amountMicro: COMPLETION_SPLIT.holdback.toString(),
    });
    writeLiveState();
    wo = await waitFor(
      async () => {
        const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
        return current && current.status === 'CLOSED' ? current : false;
      },
      'work order CLOSED',
      30_000,
      1_500,
    );
  }

  if (wo.status !== 'CLOSED') die(`lifecycle stopped in unexpected state ${wo.status}`);
  return wo;
}

// ---------------------------------------------------------------------------
// State / verification
// ---------------------------------------------------------------------------

async function refreshState(daoAccount) {
  const metadata = await view(TOKEN, 'ft_metadata');
  const totalSupply = await view(TOKEN, 'ft_total_supply');
  const balances = {};
  for (const accountId of [DEPLOYER, TOKEN, HUB, daoAccount, SPONSOR, ...CONTRACTORS, ...INSPECTORS, STEWARD, COORDINATOR_AI, REVIEWER_AI, RELAYER]) {
    const result = await tryView(TOKEN, 'ft_balance_of', { account_id: accountId });
    balances[accountId] = result.ok ? result.value : null;
  }

  const config = await hubConfig();
  const roles = {};
  const near = {};
  for (const accountId of [DEPLOYER, TOKEN, HUB, daoAccount, SPONSOR, ...CONTRACTORS, ...INSPECTORS, STEWARD, COORDINATOR_AI, REVIEWER_AI, RELAYER]) {
    roles[accountId] = await tryView(HUB, 'get_role', { account: accountId }).then((r) => (r.ok ? r.value : null));
    near[accountId] = await accountInfo(accountId);
  }

  const assetResult = await tryView(HUB, 'get_asset', { asset_id: ASSET_ID });
  const woResult = await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
  const wo = woResult.ok ? woResult.value : null;
  const score = wo ? await tryView(HUB, 'get_score', { work_order_id: WORK_ORDER_ID }).then((r) => (r.ok ? r.value : null)) : null;
  const escrow = wo ? await tryView(HUB, 'get_escrow', { work_order_id: WORK_ORDER_ID }).then((r) => (r.ok ? r.value : null)) : null;
  const payments = wo ? await tryView(HUB, 'get_payments', { work_order_id: WORK_ORDER_ID }).then((r) => (r.ok ? r.value : null)) : null;
  const warranty = wo ? await tryView(HUB, 'get_warranty', { work_order_id: WORK_ORDER_ID }).then((r) => (r.ok ? r.value : null)) : null;
  const history = await tryView(HUB, 'get_history', { asset_id: ASSET_ID }).then((r) => (r.ok ? r.value : null));
  const reconciliation = await tryView(HUB, 'get_reconciliation').then((r) => (r.ok ? r.value : null));
  const passport = await tryView(HUB, 'nft_token', { token_id: ASSET_ID }).then((r) => (r.ok ? r.value : null));
  const bids = wo ? await tryView(HUB, 'get_bids', { work_order_id: WORK_ORDER_ID }).then((r) => (r.ok ? r.value : null)) : null;
  const hubCode = await provider.viewContractCode({ contractId: HUB }).catch(() => null);
  const findTx = (step) =>
    [...(state.transactions ?? [])]
      .reverse()
      .find((tx) => tx.step === step && (!tx.workOrderId || tx.workOrderId === WORK_ORDER_ID))?.hash ?? null;

  state.rpcUrl = RPC_URL;
  state.token = {
    accountId: TOKEN,
    metadata,
    totalSupply,
    balances,
    note: 'Balances are live testnet balances and include other concurrent testnet work orders sharing hub/sponsor/contractor accounts. They are informational; per-work-order escrow and NEP-141 events are the proof.',
    explorerUrl: explorerAccount(TOKEN),
  };
  state.hub = {
    ...state.hub,
    accountId: HUB,
    contractId: HUB,
    config,
    wasmSha256: hubCode?.code_base64 ? sha256Hex(Buffer.from(hubCode.code_base64, 'base64')) : state.hub?.wasmSha256 ?? null,
    codeHashBase58: hubCode?.hash ?? null,
    wasmVersion: BID_PAYLOAD_VERSION,
    explorerUrl: explorerAccount(HUB),
  };
  state.dao = {
    ...state.dao,
    accountId: daoAccount,
    explorerUrl: explorerAccount(daoAccount),
  };
  if (state.dao.kind === 'plain-account-fallback') {
    state.dao.factoryCallSubmitted = false;
    state.dao.failedRpcUrl = 'https://rpc.testnet.near.org';
    state.dao.note =
      'The Sputnik DAO factory create transaction was not submitted: the RPC endpoint rejected the request with HTTP 429 (deprecated endpoint). No Sputnik DAO exists. The existing plain testnet account mend-dao.testnet is used as the DAO signer; this is a documented fallback, not a Sputnik DAO.';
    state.dao.proposalPath = {
      ...(state.dao.proposalPath ?? {}),
      method: 'dao_authorize',
      note: 'Sputnik factory call was not submitted (RPC 429). The plain testnet DAO account signed directly. This is a documented fallback, not a Sputnik DAO.',
      tx: findTx('dao_authorize_fallback'),
    };
  }
  state.accounts = Object.fromEntries(
    Object.entries(near).map(([accountId, info]) => [
      accountId,
      {
        ...state.accounts?.[accountId],
        ...info,
        role: roles[accountId],
        ftBalanceMicro: balances[accountId],
        explorerUrl: explorerAccount(accountId),
      },
    ]),
  );
  if (assetResult.ok && assetResult.value) {
    state.asset = {
      ...state.asset,
      ...assetResult.value,
      passportOwner: passport?.owner_id ?? null,
      passportMetadata: passport?.metadata ?? null,
      explorerUrl: explorerAccount(HUB),
    };
  }
  if (wo) {
    state.workOrder = {
      ...state.workOrder,
      workOrderId: wo.id,
      assetId: wo.assetId,
      status: wo.status,
      scopeHash: wo.scopeHash,
      policyHash: wo.policyHash,
      budgetMicro: wo.budget,
      sponsor: wo.sponsor,
      contractorRoster: wo.contractorRoster,
      inspectorRoster: wo.inspectorRoster,
      daoProposalId: wo.daoProposalId,
      commitDeadline: new Date(Number(BigInt(wo.commitDeadline) / 1_000_000n)).toISOString(),
      revealDeadline: new Date(Number(BigInt(wo.revealDeadline) / 1_000_000n)).toISOString(),
      commitDeadlineNs: wo.commitDeadline,
      revealDeadlineNs: wo.revealDeadline,
      awardedBidId: wo.awardedBidId,
      awardedContractor: wo.awardedContractor,
      inspector: wo.inspector,
      durabilityDueAt: wo.durabilityDueAt
        ? new Date(Number(BigInt(wo.durabilityDueAt) / 1_000_000n)).toISOString()
        : null,
      durabilityDueAtNs: wo.durabilityDueAt,
      fundedMicro: wo.funded,
      completionPaid: wo.completionPaid,
      holdbackReleased: wo.holdbackReleased,
      bids,
      escrow,
      payments,
      warranty,
      history,
      paymentNote:
        'PaymentRecord.status is PENDING by contract design: the hub issues the NEP-141 transfer but cannot observe the token receipt synchronously. The corresponding ft_transfer events are verified from transaction receipts by --check.',
      createTx: findTx('work_order_create'),
      authorizeTx: findTx('dao_authorize_fallback'),
      fundTx: findTx('work_order_fund_100_musdc'),
      openBiddingTx: findTx('work_order_open_bidding'),
      closeBiddingTx: findTx('bidding_close'),
      scoreTx: findTx('score_record_LOCAL_DETERMINISTIC'),
      awardTx: findTx('award_winner_B'),
      startWorkTx: findTx('work_start_B'),
      completionSubmitTx: findTx('completion_submit_EV-LIVE-0001'),
      completionAcceptTx: findTx('completion_accept_INS-LIVE-0001'),
      durabilityTx: findTx('durability_pass_INS-LIVE-0002'),
      explorerUrl: explorerAccount(HUB),
    };
    state.lifecycle.finalStatus = wo.status;
  state.lifecycle.bidPayloadVersion = BID_PAYLOAD_VERSION;
  state.lifecycle.availabilityOnchain = BID_PAYLOAD_VERSION === 'V2';
  }
  state.lifecycle.bids = (bids?.commitments ?? []).map((commitment) => {
    const reveal = (bids?.reveals ?? []).find((item) => item.bidId === commitment.bidId);
    const fixture = Object.entries(BID_VALUES).find(([, value]) => value.bidId === commitment.bidId);
    const label = fixture?.[0] ?? null;
    return {
      label,
      bidId: commitment.bidId,
      contractorId: commitment.contractorId,
      commitmentHash: commitment.commitmentHash,
      committedAt: commitment.committedAt,
      commitmentTx: label ? findTx(`bid_commit_${label}`) : null,
      revealed: Boolean(reveal),
      revealTx: label ? findTx(`bid_reveal_${label}`) : null,
      ...(reveal
        ? {
            priceMicro: reveal.price,
            durationDays: reveal.durationDays,
            warrantyDays: reveal.warrantyDays,
            materialsScore: reveal.materialsScore,
            availableInDays: fixture?.[1]?.availableInDays ?? null,
            availabilityRecordedOnchain: BID_PAYLOAD_VERSION === 'V2',
            checklistAccepted: reveal.checklistAccepted,
          }
        : {}),
    };
  });
  state.lifecycle.payments = payments ?? [];
  state.lifecycle.availabilityNote =
    BID_PAYLOAD_VERSION === 'V2'
      ? 'The deployed hub supports available_in_days on-chain.'
      : 'The deployed hub is the older MEND_BID_V1 format: available_in_days is recorded off-chain in this file and the scope/evidence JSON, but the on-chain reveal cannot carry it without a hub redeploy (explicitly not performed).';
  state.lifecycle.score = score
    ? {
        ...state.lifecycle.score,
        executionId: score.executionId,
        policyHash: score.policyHash,
        wasmHash: score.wasmHash,
        inputHash: score.inputHash,
        outputHash: score.outputHash,
        ranking: score.ranking,
        mode: 'LOCAL_DETERMINISTIC',
        onchainMode: score.mode,
        outlayerUsed: false,
      }
    : state.lifecycle.score;
  state.reconciliation = reconciliation;
  state.reconciliationNote =
    'Global reconciliation covers every work order on the shared testnet hub, including concurrent work orders created by other workers; it is not specific to this work order. Use workOrder.escrow and workOrder.payments for per-work-order proof.';
  state.limitations = [
    'NEAR testnet only. Test mUSDC and testnet NEAR have no real value. No mainnet deployment was attempted.',
    state.hub?.keyAvailable === false
      ? 'The hub signing key in MEND_TESTNET_KEYS_FILE is not an on-chain access key. The hub remains deployed and usable through owner/role accounts, but it cannot be deleted, redeployed or re-initialised without the original hub key. No destructive hub call was made.'
      : 'The hub key is available.',
    'Sputnik DAO v2 factory creation was not submitted: the first attempt used https://rpc.testnet.near.org and received HTTP 429 (deprecated endpoint) before submission. No Sputnik DAO exists; mend-dao.testnet is a documented plain-account fallback, not a Sputnik DAO. Subsequent operations used https://rpc.testnet.fastnear.com.',
    'The deployed hub WASM is the older MEND_BID_V1 commitment format: the contract does not accept available_in_days. Availability values are recorded off-chain in this file and the bid manifest, but not in the on-chain reveal. A hub redeploy was explicitly not performed.',
    'OutLayer live execution was not used: it is not funded/configured on this deployment. The score was computed by the steward with the deterministic local algorithm and recorded on-chain with mode "recorded"; the deployment labels it LOCAL_DETERMINISTIC.',
    'The passport NFT is non-transferable and held by the hub registry account; it is not a title deed, legal ownership record, or evidence of a real repair.',
    'The hub, sponsor and some contractor accounts are shared with concurrent testnet work orders. Absolute token balances include that activity; per-work-order escrow, payment rows and NEP-141 transfer events are the authoritative evidence for this work order.',
  ];
  writeLiveState();
  return { wo, score, escrow, payments, reconciliation, roles, balances, config, passport };
}

async function verifyTransaction(tx) {
  if (!tx.signer) return { hash: tx.hash, verified: false, reason: 'no signer recorded' };
  try {
    const result = await provider.viewTransactionStatusWithReceipts({
      txHash: tx.hash,
      accountId: tx.signer,
      waitUntil: 'FINAL',
    });
    const failures = [];
    for (const outcome of result.receipts_outcome ?? []) {
      if (outcome.outcome?.status && typeof outcome.outcome.status === 'object' && 'Failure' in outcome.outcome.status) {
        failures.push(outcome.id);
      }
    }
    return { hash: tx.hash, verified: true, failures };
  } catch (error) {
    return { hash: tx.hash, verified: false, reason: String(error.message ?? error).slice(0, 300) };
  }
}

async function transactionEvents(tx) {
  const result = await provider.viewTransactionStatusWithReceipts({
    txHash: tx.hash,
    accountId: tx.signer,
    waitUntil: 'FINAL',
  });
  const logs = (result.receipts_outcome ?? []).flatMap((receipt) => receipt.outcome?.logs ?? []);
  return logs
    .filter((line) => line.startsWith('EVENT_JSON:'))
    .map((line) => {
      try {
        return JSON.parse(line.slice('EVENT_JSON:'.length));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function assertFtTransfer(step, { from, to, amount }) {
  const tx = [...state.transactions]
    .reverse()
    .find((item) => item.step === step && item.workOrderId === WORK_ORDER_ID);
  if (!tx) die(`missing recorded transaction ${step} for ${WORK_ORDER_ID}`);
  const events = await transactionEvents(tx);
  const transfers = events
    .filter((event) => event.standard === 'nep141' && event.event === 'ft_transfer')
    .flatMap((event) => event.data ?? []);
  const found = transfers.some(
    (transfer) =>
      transfer.old_owner_id === from &&
      transfer.new_owner_id === to &&
      BigInt(transfer.amount) === BigInt(amount),
  );
  if (!found) {
    die(
      `missing NEP-141 ft_transfer ${from} -> ${to} ${amount} in ${step} (${tx.hash}); events=${JSON.stringify(transfers)}`,
    );
  }
  return tx;
}

async function check() {
  assertTestnet();
  loadLiveState();
  if (!WORK_ORDER_ID) WORK_ORDER_ID = state.workOrder?.workOrderId || REQUESTED_WORK_ORDER_ID;
  await detectBidPayloadVersion();
  if (!state.hub?.config) die('live-state.json has no hub config; run --deploy first');
  const expectedDao = state.dao?.accountId;
  if (!expectedDao) die('live-state.json has no DAO account');

  const config = await view(HUB, 'get_config');
  if (config.dao !== expectedDao) die(`hub DAO ${config.dao} != recorded ${expectedDao}`);
  if (config.token !== TOKEN) die(`hub token ${config.token} != ${TOKEN}`);
  if (config.policyHash !== POLICY_HASH) die(`hub policy ${config.policyHash} != ${POLICY_HASH}`);
  if (config.durabilityMinutes !== DURABILITY_MINUTES) {
    die(`hub durability ${config.durabilityMinutes} != ${DURABILITY_MINUTES}`);
  }

  const metadata = await view(TOKEN, 'ft_metadata');
  if (metadata.symbol !== 'mUSDC' || metadata.decimals !== 6) die('token metadata mismatch');
  const supply = await view(TOKEN, 'ft_total_supply');
  if (BigInt(supply) !== TOKEN_TOTAL_SUPPLY) die(`token supply ${supply} mismatch`);

  const expectedRoles = { ...ROLE_BY_ACCOUNT, [expectedDao]: 'DAO' };
  for (const [accountId, role] of Object.entries(expectedRoles)) {
    const roles = await view(HUB, 'get_role', { account: accountId });
    if (!roles.includes(role)) die(`missing role ${role} for ${accountId}; got ${roles.join(',')}`);
  }

  const asset = await view(HUB, 'get_asset', { asset_id: ASSET_ID });
  if (!asset) die(`asset ${ASSET_ID} missing`);
  if (asset.passportTokenId !== ASSET_ID) die('passport token id mismatch');
  if (asset.descriptionHash !== sha256Hex(ASSET_DESCRIPTION)) die('asset description hash mismatch');
  if (asset.locationHash !== sha256Hex(ASSET_LOCATION)) die('asset location hash mismatch');
  const passport = await view(HUB, 'nft_token', { token_id: ASSET_ID });
  if (!passport || passport.owner_id !== HUB) die('passport owner mismatch');
  if (passport.metadata?.extra) {
    const extra = JSON.parse(passport.metadata.extra);
    if (extra.transferable !== false || extra.legal_ownership !== false) {
      die('passport is not marked non-transferable / non-ownership');
    }
  }

  const wo = await view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
  if (!wo) die(`work order ${WORK_ORDER_ID} missing`);
  if (wo.status !== 'CLOSED') die(`work order is ${wo.status}, expected CLOSED`);
  if (wo.awardedBidId !== BID_VALUES.B.bidId) die(`awarded bid ${wo.awardedBidId} != B`);
  if (wo.awardedContractor !== BID_VALUES.B.contractorId) die(`awarded contractor mismatch: ${wo.awardedContractor}`);
  if (wo.policyHash !== POLICY_HASH) die('work order policy mismatch');
  if (wo.scopeHash !== state.workOrder?.scopeHash) die('work order scope hash changed');

  const score = await view(HUB, 'get_score', { work_order_id: WORK_ORDER_ID });
  if (!score) die('score missing');
  if (score.ranking?.[0]?.bidId !== BID_VALUES.B.bidId) die('score winner is not B');
  if (score.ranking?.[0]?.scoreBps !== 9_270) die(`unexpected winner score ${score.ranking?.[0]?.scoreBps}`);
  if (score.mode !== 'recorded') die(`unexpected on-chain score mode ${score.mode}`);

  const escrow = await view(HUB, 'get_escrow', { work_order_id: WORK_ORDER_ID });
  if (BigInt(escrow.funding) !== BUDGET_MICRO) die('escrow funding mismatch');
  if (BigInt(escrow.refunded) !== 20_000_000n) die('escrow refund mismatch');
  if (BigInt(escrow.completionPaid) !== COMPLETION_SPLIT.completion) die('completion payment mismatch');
  if (BigInt(escrow.holdbackReleased) !== COMPLETION_SPLIT.holdback) die('holdback mismatch');
  if (BigInt(escrow.escrowed) !== 0n || BigInt(escrow.holdbackHeld) !== 0n) die('escrow not fully settled');

  const payments = await view(HUB, 'get_payments', { work_order_id: WORK_ORDER_ID });
  const sum = payments.reduce((total, payment) => total + BigInt(payment.amount), 0n);
  if (sum !== 100_000_000n) die(`payments sum ${sum} != 100000000`);
  const paymentByKind = Object.fromEntries(payments.map((payment) => [payment.kind, payment]));
  if (!paymentByKind.REFUND || BigInt(paymentByKind.REFUND.amount) !== 20_000_000n) {
    die('missing/spurious 20 mUSDC award refund');
  }
  if (!paymentByKind.COMPLETION || BigInt(paymentByKind.COMPLETION.amount) !== 72_000_000n) {
    die('missing/spurious 72 mUSDC completion payment');
  }
  if (!paymentByKind.HOLDBACK || BigInt(paymentByKind.HOLDBACK.amount) !== 8_000_000n) {
    die('missing/spurious 8 mUSDC holdback payment');
  }

  // The testnet hub, sponsor and contractor accounts are shared with other
  // concurrent testnet work orders. Absolute balances are therefore reported
  // for transparency, not asserted. The per-work-order escrow ledger, payment
  // rows and NEP-141 transfer events below are the authoritative proof.
  const balances = {
    hub: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: HUB })),
    sponsor: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: SPONSOR })),
    contractorB: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: BID_VALUES.B.contractorId })),
    deployer: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: DEPLOYER })),
  };

  await assertFtTransfer('work_order_fund_100_musdc', {
    from: SPONSOR,
    to: HUB,
    amount: BUDGET_MICRO,
  });
  await assertFtTransfer('award_winner_B', {
    from: HUB,
    to: SPONSOR,
    amount: 20_000_000n,
  });
  await assertFtTransfer('completion_accept_INS-LIVE-0001', {
    from: HUB,
    to: BID_VALUES.B.contractorId,
    amount: COMPLETION_SPLIT.completion,
  });
  await assertFtTransfer('durability_pass_INS-LIVE-0002', {
    from: HUB,
    to: BID_VALUES.B.contractorId,
    amount: COMPLETION_SPLIT.holdback,
  });

  const requested = await tryView(HUB, 'get_work_order', { work_order_id: REQUESTED_WORK_ORDER_ID });
  if (requested.ok && requested.value && requested.value.id !== WORK_ORDER_ID) {
    if (!['CANCELLED', 'REFUNDED'].includes(requested.value.status)) {
      die(`requested work order ${REQUESTED_WORK_ORDER_ID} is ${requested.value.status}, expected CANCELLED/REFUNDED`);
    }
  }
  for (const replaced of state.replacedWorkOrders ?? []) {
    const current = await view(HUB, 'get_work_order', { work_order_id: replaced.workOrderId });
    if (!['CANCELLED', 'REFUNDED'].includes(current.status)) {
      die(`replacement work order ${replaced.workOrderId} is ${current.status}`);
    }
  }

  if (!state.transactions?.length) die('no transactions recorded');
  const txFailures = [];
  const txMissing = [];
  for (const tx of state.transactions) {
    const result = await verifyTransaction(tx);
    if (!result.verified) txMissing.push(result);
    else if (result.failures.length) txFailures.push(result);
  }
  if (txMissing.length) die(`unverified transaction hashes: ${JSON.stringify(txMissing.slice(0, 5))}`);
  if (txFailures.length) die(`transactions with failed receipts: ${JSON.stringify(txFailures.slice(0, 5))}`);

  const stateText = fs.readFileSync(LIVE_STATE_PATH, 'utf8');
  if (/"secretKey"|"seedPhrase"|"privateKey"/.test(stateText)) {
    die('live-state.json contains secret-like fields');
  }

  console.log(
    JSON.stringify(
      {
        check: 'PASS',
        network: NETWORK,
        hub: HUB,
        token: TOKEN,
        dao: expectedDao,
        daoKind: state.dao.kind,
        asset: ASSET_ID,
        workOrder: WORK_ORDER_ID,
        finalStatus: wo.status,
        awardedBid: wo.awardedBidId,
        scoreMode: 'LOCAL_DETERMINISTIC (on-chain mode: recorded)',
        transactions: state.transactions.length,
        bidPayloadVersion: BID_PAYLOAD_VERSION,
        sharedAccounts: 'hub/sponsor/contractor balances include other concurrent testnet work orders; per-work-order escrow and NEP-141 events are asserted instead',
        balances: Object.fromEntries(Object.entries(balances).map(([key, value]) => [key, value.toString()])),
        explorer: `${EXPLORER}/accounts/${HUB}`,
      },
      null,
      2,
    ),
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = {
    deploy: args.includes('--deploy') || args.includes('--all'),
    lifecycle: args.includes('--lifecycle') || args.includes('--all'),
    check: args.includes('--check'),
  };
  if (!mode.deploy && !mode.lifecycle && !mode.check) mode.deploy = true;
  return mode;
}

async function main() {
  assertTestnet();
  const mode = parseArgs();

  if (mode.check) {
    loadKeys({ required: false });
    await check();
    return;
  }

  loadKeys({ required: true });
  loadLiveState();
  if (!WORK_ORDER_ID) WORK_ORDER_ID = state.workOrder?.workOrderId || REQUESTED_WORK_ORDER_ID;
  await detectBidPayloadVersion();
  hubWasmPath =
    process.env.MEND_HUB_WASM ||
    path.join(ROOT, 'contracts/target/wasm32-unknown-unknown/release/mend_hub.wasm');
  tokenWasmPath =
    process.env.MEND_TOKEN_WASM ||
    path.join(ROOT, 'contracts/target/wasm32-unknown-unknown/release/mend_test_token.wasm');

  const createIfMissing = process.env.MEND_CREATE_MISSING_ACCOUNTS !== 'false';
  await ensureAccounts({ createIfMissing });
  await verifySigningKeys();
  await ensureToken();

  let daoAccount = state.dao?.accountId;
  if (mode.deploy || !daoAccount) {
    daoAccount = await ensureSputnikDao();
  }
  if (!daoAccount) die('could not determine DAO account');

  if (mode.deploy) {
    await ensureHub(daoAccount);
    await ensureTokenStorage(HUB, 0);
    await ensureTokenStorage(daoAccount, 1);
    await ensureTokenStorage(SPONSOR, 2);
    for (let i = 0; i < CONTRACTORS.length; i += 1) await ensureTokenStorage(CONTRACTORS[i], 3 + i);
    for (let i = 0; i < INSPECTORS.length; i += 1) await ensureTokenStorage(INSPECTORS[i], 8 + i);
    await ensureRoles(daoAccount);
    await ensureSponsorBalance();
    await ensureAsset();
    await cleanupPreAwardWorkOrders();
    await ensureWorkOrder(daoAccount);
    await refreshState(daoAccount);
    log('deployment phase complete; run --lifecycle to finish the real lifecycle');
    return;
  }

  if (mode.lifecycle) {
    const wo = await view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
    if (!wo) die('work order missing; run --deploy first');
    await ensureCommitments();
    await ensureReveals();
    await ensureScored();
    await ensureAwardedAndClosed();
    await refreshState(daoAccount);
    log('lifecycle phase complete; work order CLOSED');
  }
}

main().catch((error) => {
  console.error('[live] ERROR', error.message ?? error);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});

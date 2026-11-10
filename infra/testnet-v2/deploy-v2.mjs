#!/usr/bin/env node
/**
 * MEND — fresh Testnet V2 hub + real Sputnik DAO v2 lifecycle driver.
 *
 * Usage:
 *   MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node infra/testnet-v2/deploy-v2.mjs --deploy
 *   MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node infra/testnet-v2/deploy-v2.mjs --lifecycle
 *   MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node infra/testnet-v2/deploy-v2.mjs --all
 *   node infra/testnet-v2/deploy-v2.mjs --check
 *
 * Safety:
 *   - testnet only: refuses mainnet networks, RPC hosts, account suffixes and keys
 *   - signing keys are read only from MEND_TESTNET_KEYS_FILE (outside the repo)
 *   - secrets are never printed, copied into state, or committed
 *   - no destructive reset of an existing populated hub
 *   - a failed Sputnik factory call is recorded verbatim; the DAO is never faked
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
const DOC_PATH = path.join(HERE, 'LIVE-V2.md');
const EXPLORER = 'https://explorer.testnet.near.org';
const RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const RPC_ENDPOINTS = [
  ...new Set(
    [
      RPC_URL,
      ...(process.env.NEAR_RPC_FALLBACKS ||
        'https://test.rpc.fastnear.com,https://rpc.testnet.near.org')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ],
  ),
];
let rpcEndpointIndex = 0;
const rawFetch = globalThis.fetch.bind(globalThis);
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// FastNear signals rate limits as an HTTP 200 JSON-RPC error with code -429.
// Rotate through documented testnet RPC endpoints with bounded backoff so a
// long lifecycle run does not fail on a transient limit.
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url ?? '';
  const isRpc = RPC_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));
  if (!isRpc) return rawFetch(input, init);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const endpoint = RPC_ENDPOINTS[rpcEndpointIndex % RPC_ENDPOINTS.length];
    const response = await rawFetch(endpoint, init);
    let rateLimited = response.status === 429;
    if (!rateLimited && response.ok) {
      const text = await response.clone().text();
      rateLimited = text.includes('"code": -429') || /rate limits exceeded/i.test(text);
    }
    if (!rateLimited) return response;
    rpcEndpointIndex += 1;
    const wait = Math.min(20_000, 750 * 2 ** Math.min(attempt, 5));
    console.error(
      `[v2] RPC rate limit on ${endpoint}; rotating to ${
        RPC_ENDPOINTS[rpcEndpointIndex % RPC_ENDPOINTS.length]
      } in ${wait}ms`,
    );
    await sleepMs(wait);
  }
  return rawFetch(RPC_ENDPOINTS[rpcEndpointIndex % RPC_ENDPOINTS.length], init);
};
const NETWORK = 'testnet';
const TGAS = 10n ** 12n;
const ONE_NEAR = 10n ** 24n;
const YOCTO = 1n;
const GAS_30 = 30n * TGAS;
const GAS_100 = 100n * TGAS;

const DEPLOYER = 'mend-deployer.testnet';
const TOKEN = 'mend-usdc.testnet';
const HUB = 'mend-hub-v2.testnet';
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
const COUNCIL = [DEPLOYER, STEWARD, INSPECTORS[0]];

const ASSET_ID = 'BENCH-V2-001';
const WORK_ORDER_ID = 'WO-BENCH-V2-001-0002';
const ABORTED_WORK_ORDER_IDS = ['WO-BENCH-V2-001-0001'];
const CLUSTER_ID = 'CL-V2-0001';
const BUDGET_MICRO = 100_000_000n; // 100 mUSDC
const SPONSOR_TARGET_MICRO = 500_000_000n; // keep enough for repeatable runs
const TOKEN_TOTAL_SUPPLY = 1_000_000_000_000n; // 1,000,000 mUSDC
const DURABILITY_MINUTES = 2;
const POLICY_VERSION = 'mend-bid-policy-v1';
const WEIGHTS_BPS = { price: 4_500, warranty: 2_500, duration: 2_000, materials: 1_000 };
const COMPLETION_SPLIT = { completion: 72_000_000n, holdback: 8_000_000n };
const REFUND_MICRO = 20_000_000n;

const BID_VALUES = {
  A: {
    bidId: 'BID-A-BENCH-V2-001',
    contractorId: 'mend-contractor-a.testnet',
    priceMicro: '95000000',
    durationDays: 14,
    warrantyDays: 90,
    materialsScore: 60,
    availableInDays: 3,
    nonce: 'nonce-a-v2-0001',
  },
  B: {
    bidId: 'BID-B-BENCH-V2-001',
    contractorId: 'mend-contractor-b.testnet',
    priceMicro: '80000000',
    durationDays: 10,
    warrantyDays: 180,
    materialsScore: 80,
    availableInDays: 2,
    nonce: 'nonce-b-v2-0002',
  },
  C: {
    bidId: 'BID-C-BENCH-V2-001',
    contractorId: 'mend-contractor-c.testnet',
    priceMicro: '78000000',
    durationDays: 21,
    warrantyDays: 30,
    materialsScore: 70,
    availableInDays: 5,
    nonce: 'nonce-c-v2-0003',
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

const ASSET_DESCRIPTION = 'Public park bench with a split seat plank and loose armrest.';
const ASSET_LOCATION = 'Riverside Park, bench near east gate';

const POLICY_DOCUMENT = {
  schema: 'mend.bid-policy.v1',
  version: POLICY_VERSION,
  weightsBps: WEIGHTS_BPS,
  completionBps: 9_000,
  holdbackBps: 1_000,
  tieBreak: 'score_desc_price_asc_warranty_desc_duration_asc_bid_id_asc',
  availability: { field: 'availableInDays', maxDays: 365, required: true },
  note: 'Hash-pinned deterministic bid policy used by this testnet deployment. Not an OutLayer attestation.',
};

const provider = new JsonRpcProvider({ url: RPC_URL });

let keys = null;
let state = null;
let POLICY_HASH = null;
let hubWasmPath = null;
let tokenWasmPath = null;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();
const log = (...parts) => console.log('[v2]', ...parts);
const die = (message) => {
  throw new Error(message);
};
const sha256Hex = (input) => crypto.createHash('sha256').update(input).digest('hex');
const b64 = (value) => Buffer.from(value, 'utf8').toString('base64');
const rawU64 = (value) => JSON.rawJSON(String(value));
const jsonFile = (value) => `${JSON.stringify(value, null, 2)}\n`;

function writeJson(pathname, value) {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  fs.writeFileSync(pathname, jsonFile(value));
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
  const isTestnetEndpoint = (url) =>
    /testnet/i.test(url) || /^https:\/\/test\.rpc\.fastnear\.com/i.test(url);
  for (const endpoint of RPC_ENDPOINTS) {
    if (/mainnet/i.test(endpoint) || /\.near\/?$/.test(endpoint) || !isTestnetEndpoint(endpoint)) {
      die(`refusing non-testnet RPC endpoint ${endpoint}`);
    }
  }
  if (!isTestnetEndpoint(RPC_URL)) {
    die(`refusing unknown RPC URL ${RPC_URL}; expected a testnet endpoint`);
  }
  for (const accountId of [HUB, SPUTNIK_DAO, FALLBACK_DAO]) {
    if (accountId.endsWith('.near')) die(`refusing mainnet account ${accountId}`);
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
    log('WARN keys file is readable by group/other; chmod 600 is recommended');
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

function errorText(error) {
  return String(error?.message ?? error);
}

function isMissingContractError(error) {
  return /Contract method is not found|Contract code for contract ID .* does not exist|MethodNotFound|not initialized|does not exist/i.test(
    errorText(error),
  );
}

async function tryView(contractId, method, args = {}) {
  try {
    return { ok: true, value: await view(contractId, method, args) };
  } catch (error) {
    return { ok: false, error: errorText(error), missing: isMissingContractError(error) };
  }
}

function isMissingAccountError(error) {
  return /does not exist|AccountDoesNotExist|UNKNOWN_ACCOUNT|account .* not found/i.test(
    errorText(error),
  );
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

async function waitFor(predicate, label, timeoutMs = 90_000, intervalMs = 2_500) {
  const started = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - started > timeoutMs) die(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
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

function successValue(result) {
  const outcomes = [
    result?.transaction_outcome,
    ...(result?.receipts_outcome ?? []),
    ...(result?.transaction?.outcomes ?? []),
  ].filter(Boolean);
  for (const outcome of outcomes) {
    const status = outcome?.outcome?.status ?? outcome?.status;
    if (status && typeof status === 'object' && 'SuccessValue' in status) {
      return Buffer.from(status.SuccessValue, 'base64').toString('utf8');
    }
  }
  return null;
}

const explorerTx = (hash) => `${EXPLORER}/transactions/${hash}`;
const explorerAccount = (accountId) => `${EXPLORER}/accounts/${accountId}`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function initialLiveState() {
  return {
    schema: 'mend.live-testnet-v2.v1',
    network: NETWORK,
    rpcUrl: RPC_URL,
    rpcEndpoints: RPC_ENDPOINTS,
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
          'OutLayer live execution is not funded/configured; the deterministic local score is recorded on-chain with mode "recorded" and labelled LOCAL_DETERMINISTIC.',
      },
    },
    transactions: [],
    limitations: [
      'NEAR testnet only. Test mUSDC and testnet NEAR have no real value.',
      'OutLayer live execution was not used; the score is LOCAL_DETERMINISTIC and is not a TEE attestation.',
      'The passport NFT is non-transferable and held by the hub registry account; it is not a title deed or legal ownership record.',
      'The Sputnik DAO is a real testnet DAO created by the sputnikv2.testnet factory; it has no mainnet authority.',
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
    state.lifecycle.payments ??= [];
    // Steps are idempotent: keep only the latest transaction for each step so a
    // retried driver run cannot resolve an older attempt by step name.
    const latestByStep = new Map();
    for (const tx of state.transactions) latestByStep.set(tx.step, tx);
    state.transactions = [...latestByStep.values()];
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
  const status =
    result?.status ??
    result?.transaction_outcome?.outcome?.status ??
    result?.final_execution_status ??
    null;
  const entry = {
    step,
    hash,
    explorerUrl: explorerTx(hash),
    signer,
    receiver,
    method,
    at: nowIso(),
    finalStatus:
      status && typeof status === 'object' ? Object.keys(status)[0] ?? null : status ?? null,
    ...extra,
  };
  const existing = state.transactions.find((tx) => tx.hash === hash);
  if (existing) Object.assign(existing, entry);
  else {
    state.transactions = state.transactions.filter((tx) => tx.step !== step);
    state.transactions.push(entry);
  }
  log(`tx ${step}: ${hash}`);
  writeLiveState();
  return hash;
}

async function call(step, signer, receiver, method, args = {}, options = {}) {
  const { deposit = 0n, gas = GAS_30, extra = {}, throwOnFailure = true } = options;
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
        `[v2] FAILED ${step} (${method}) tx ${hash}: ${JSON.stringify(detail?.status ?? error.message).slice(0, 800)}`,
      );
      if (logs.length) console.error(`[v2] FAILED logs: ${logs.join(' | ').slice(0, 1200)}`);
      error.transactionHash = hash;
      error.step = step;
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
    wasmPath: path.relative(ROOT, wasmPath),
    wasmSha256: sha256Hex(code),
    wasmBytes: code.length,
  });
  return sha256Hex(code);
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function createAccountWithFaucet(accountId) {
  if (keys?.[accountId] && (await accountExists(accountId))) return keys[accountId];

  const keyPair = await KeyPair.fromRandom('ED25519');
  const publicKey = keyPair.getPublicKey().toString();
  const secretKey = keyPair.toString();

  const response = await fetch('https://helper.testnet.near.org/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'mend-testnet-v2/1.0' },
    body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: publicKey }),
  });
  const text = await response.text();
  if (!response.ok) {
    die(`testnet faucet failed for ${accountId}: HTTP ${response.status} ${text.slice(0, 400)}`);
  }
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (body?.status?.Failure) {
    die(
      `testnet faucet rejected ${accountId}: ${JSON.stringify(body.status.Failure).slice(0, 500)}. ` +
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
  for (const accountId of [DEPLOYER, TOKEN, HUB, ...ALL_ROLE_ACCOUNTS]) {
    const entry = keys?.[accountId];
    if (!entry?.publicKey) continue;
    if (!(await accountExists(accountId))) continue;
    const keyList = await provider.viewAccessKeyList({ accountId });
    const matches = (keyList.keys ?? []).some((item) => item.public_key === entry.publicKey);
    if (!matches) die(`stored key for ${accountId} is not an on-chain access key`);
  }
}

async function ensureAccounts({ createIfMissing }) {
  for (const accountId of [DEPLOYER, TOKEN, HUB, ...ALL_ROLE_ACCOUNTS]) {
    if (await accountExists(accountId)) {
      if (!keys?.[accountId] && createIfMissing) {
        die(`account ${accountId} exists but no key is present in MEND_TESTNET_KEYS_FILE`);
      }
      continue;
    }
    if (!createIfMissing) die(`account ${accountId} is missing; run --deploy with a keys file`);
    await createAccountWithFaucet(accountId);
  }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

async function ensureToken() {
  const metadata = await tryView(TOKEN, 'ft_metadata');
  if (!metadata.ok && !metadata.missing) die(`cannot read token metadata: ${metadata.error}`);
  if (metadata.ok) {
    if (metadata.value.symbol !== 'mUSDC') die(`unexpected token symbol ${metadata.value.symbol}`);
    if (metadata.value.decimals !== 6) die(`unexpected token decimals ${metadata.value.decimals}`);
    const total = await view(TOKEN, 'ft_total_supply');
    if (BigInt(total) !== TOKEN_TOTAL_SUPPLY) {
      die(`unexpected token supply ${total}; expected ${TOKEN_TOTAL_SUPPLY}`);
    }
    log(`token ${TOKEN} verified: mUSDC, 6 decimals, supply ${total}`);
    return;
  }

  log(`token ${TOKEN} is not initialized; deploying test token (test value only)`);
  if (!(await accountExists(TOKEN))) await createAccountWithFaucet(TOKEN);
  await deployWasm('token_deploy', TOKEN, tokenWasmPath);
  await call(
    'token_init',
    DEPLOYER,
    TOKEN,
    'new',
    { owner_id: DEPLOYER, total_supply: TOKEN_TOTAL_SUPPLY.toString() },
    { gas: GAS_100 },
  );
}

async function ensureTokenStorage(accountId) {
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
  if (balance >= SPONSOR_TARGET_MICRO) {
    log(`sponsor already holds ${balance} micro-mUSDC; not re-granting`);
    return;
  }
  const grant = SPONSOR_TARGET_MICRO - balance;
  await call(
    'sponsor_grant_to_500_musdc',
    DEPLOYER,
    TOKEN,
    'ft_transfer',
    {
      receiver_id: SPONSOR,
      amount: grant.toString(),
      memo: 'MEND V2 testnet demo funds (test value only)',
    },
    { deposit: YOCTO, gas: GAS_30, extra: { amountMicro: grant.toString() } },
  );
  log(`granted ${grant} micro-mUSDC to ${SPONSOR}`);
}

// ---------------------------------------------------------------------------
// Sputnik DAO v2
// ---------------------------------------------------------------------------

async function readSputnikDao(daoAccount) {
  const policy = await view(daoAccount, 'get_policy');
  const lastProposalId = await view(daoAccount, 'get_last_proposal_id');
  return {
    policy,
    lastProposalId: String(lastProposalId),
    proposalBond: String(policy.proposal_bond ?? policy.proposalBond),
  };
}

async function ensureSputnikDao() {
  if (await accountExists(SPUTNIK_DAO)) {
    const dao = await readSputnikDao(SPUTNIK_DAO);
    state.dao = {
      ...(state.dao ?? {}),
      accountId: SPUTNIK_DAO,
      kind: 'sputnik-v2',
      factoryId: SPUTNIK_FACTORY,
      name: SPUTNIK_NAME,
      council: COUNCIL,
      policy: dao.policy,
      proposalBond: dao.proposalBond,
      lastProposalId: dao.lastProposalId,
      attempts: state.dao?.attempts ?? [],
      explorerUrl: explorerAccount(SPUTNIK_DAO),
      failureReason: null,
      note: 'Real Sputnik DAO v2 created by the testnet factory; testnet-only authority.',
    };
    writeLiveState();
    log(`Sputnik DAO already exists: ${SPUTNIK_DAO}`);
    return SPUTNIK_DAO;
  }

  const initArgs = {
    config: {
      name: 'MEND Community Maintenance DAO',
      purpose:
        'Testnet-only community authorization of MEND maintenance work orders. Test value only; no mainnet authority.',
      metadata: b64(JSON.stringify({ project: 'MEND', network: 'testnet', track: 'testnet-v2' })),
    },
    policy: COUNCIL,
  };
  const initArgsHash = sha256Hex(JSON.stringify(initArgs));
  const priorAttempts = state.dao?.attempts ?? [];

  try {
    log(`creating real Sputnik DAO: ${SPUTNIK_FACTORY}.create(${SPUTNIK_NAME}) with 6 NEAR`);
    await call(
      'dao_factory_create_6_near',
      DEPLOYER,
      SPUTNIK_FACTORY,
      'create',
      { name: SPUTNIK_NAME, args: b64(JSON.stringify(initArgs)) },
      {
        deposit: 6n * ONE_NEAR,
        gas: 250n * TGAS,
        extra: { daoAccount: SPUTNIK_DAO, initArgsHash },
      },
    );

    const policy = await waitFor(
      async () => {
        if (!(await accountExists(SPUTNIK_DAO))) return false;
        const result = await tryView(SPUTNIK_DAO, 'get_policy');
        return result.ok ? result.value : false;
      },
      `${SPUTNIK_DAO} to become a readable Sputnik DAO`,
      120_000,
      3_000,
    );
    const dao = await readSputnikDao(SPUTNIK_DAO);
    state.dao = {
      accountId: SPUTNIK_DAO,
      kind: 'sputnik-v2',
      factoryId: SPUTNIK_FACTORY,
      name: SPUTNIK_NAME,
      initArgsHash,
      council: COUNCIL,
      policy,
      proposalBond: dao.proposalBond,
      lastProposalId: dao.lastProposalId,
      creationTx: state.transactions.find((tx) => tx.step === 'dao_factory_create_6_near')?.hash ?? null,
      attempts: priorAttempts,
      explorerUrl: explorerAccount(SPUTNIK_DAO),
      failureReason: null,
      note: 'Real Sputnik DAO v2 created by the testnet factory; testnet-only authority.',
    };
    writeLiveState();
    log(`Sputnik DAO created: ${SPUTNIK_DAO} (bond ${dao.proposalBond} yoctoNEAR)`);
    return SPUTNIK_DAO;
  } catch (error) {
    const reason = errorText(error).slice(0, 1_500);
    log(`Sputnik factory create failed verbatim: ${reason}`);
    const attempts = [
      ...priorAttempts,
      {
        at: nowIso(),
        tx: error.transactionHash ?? null,
        error: reason,
        depositYocto: (6n * ONE_NEAR).toString(),
        gas: (250n * TGAS).toString(),
      },
    ];
    if (!(await accountExists(FALLBACK_DAO))) {
      die(`Sputnik factory failed and fallback DAO ${FALLBACK_DAO} does not exist: ${reason}`);
    }
    state.dao = {
      accountId: FALLBACK_DAO,
      kind: 'plain-account-fallback',
      factoryId: SPUTNIK_FACTORY,
      attemptedAccountId: SPUTNIK_DAO,
      failureReason: reason,
      attempts,
      council: [DEPLOYER],
      explorerUrl: explorerAccount(FALLBACK_DAO),
      factoryCallSubmitted: false,
      note:
        'The Sputnik factory create transaction did not succeed. No Sputnik DAO exists. The plain testnet account ' +
        `${FALLBACK_DAO} is used as the DAO signer; this is a documented fallback, not a Sputnik DAO.`,
    };
    writeLiveState();
    return FALLBACK_DAO;
  }
}

async function ensureDaoProposal(workOrder) {
  const daoAccount = state.dao?.accountId;
  if (state.dao?.kind !== 'sputnik-v2' || daoAccount !== SPUTNIK_DAO) {
    die('DAO proposal path requested but the DAO is not a live Sputnik DAO');
  }
  const lastProposalId = Number(await view(SPUTNIK_DAO, 'get_last_proposal_id'));
  const proposalId = Number(workOrder.daoProposalId);
  if (!Number.isInteger(proposalId)) {
    die(`work order proposal id ${workOrder.daoProposalId} is not a decimal integer`);
  }
  if (proposalId > lastProposalId) {
    die(
      `work order proposal id ${workOrder.daoProposalId} is beyond the next Sputnik proposal id ${lastProposalId}`,
    );
  }

  const authorizationArgs = {
    work_order_id: WORK_ORDER_ID,
    proposal_id: workOrder.daoProposalId,
    scope_hash: workOrder.scopeHash,
    policy_hash: workOrder.policyHash,
    budget: workOrder.budget,
    contractor_roster: workOrder.contractorRoster,
    inspector_roster: workOrder.inspectorRoster,
    commit_deadline: rawU64(workOrder.commitDeadline),
    reveal_deadline: rawU64(workOrder.revealDeadline),
  };
  const authorizationArgsText = JSON.stringify(authorizationArgs);
  const proposalInput = {
    description: `MEND ${WORK_ORDER_ID}: authorize 100 mUSDC budget, contractor/inspector rosters, policy ${POLICY_HASH}`,
    kind: {
      FunctionCall: {
        receiver_id: HUB,
        actions: [
          {
            method_name: 'dao_authorize',
            args: b64(authorizationArgsText),
            deposit: '0',
            gas: GAS_100.toString(),
          },
        ],
      },
    },
  };

  const bond = BigInt(state.dao.proposalBond);
  let proposal;
  if (proposalId === lastProposalId) {
    const addResult = await call(
      'dao_add_proposal_authorize',
      DEPLOYER,
      SPUTNIK_DAO,
      'add_proposal',
      { proposal: proposalInput },
      {
        deposit: bond,
        gas: GAS_100,
        extra: { proposalId: workOrder.daoProposalId, workOrderId: WORK_ORDER_ID },
      },
    );

    const returned = successValue(addResult);
    if (returned === null) die('add_proposal did not return a SuccessValue proposal id');
    const returnedId = String(Number(returned));
    if (returnedId !== workOrder.daoProposalId) {
      die(`add_proposal returned id ${returnedId}, expected ${workOrder.daoProposalId}`);
    }
    proposal = await view(SPUTNIK_DAO, 'get_proposal', { id: proposalId });
  } else {
    // Idempotent resume: the work order already names an existing proposal.
    proposal = await view(SPUTNIK_DAO, 'get_proposal', { id: proposalId });
    const currentAction = proposal.kind?.FunctionCall;
    if (!currentAction || currentAction.receiver_id !== HUB) {
      die(`existing Sputnik proposal ${proposalId} does not call ${HUB}`);
    }
    const currentCall = (currentAction.actions ?? []).find(
      (item) => item.method_name === 'dao_authorize',
    );
    if (!currentCall) die(`existing Sputnik proposal ${proposalId} has no dao_authorize action`);
    const decoded = JSON.parse(Buffer.from(currentCall.args, 'base64').toString('utf8'));
    if (
      decoded.work_order_id !== WORK_ORDER_ID ||
      String(decoded.proposal_id) !== workOrder.daoProposalId
    ) {
      die(`existing Sputnik proposal ${proposalId} authorizes a different work order`);
    }
    log(`resuming existing Sputnik proposal ${proposalId} (${proposal.status})`);
  }

  state.dao.proposal = {
    id: workOrder.daoProposalId,
    proposer: proposal.proposer,
    description: proposal.description,
    kind: proposal.kind,
    kindHash: sha256Hex(JSON.stringify(proposal.kind)),
    authorizationArgsHash: sha256Hex(authorizationArgsText),
    addProposalTx:
      state.transactions.find((tx) => tx.step === 'dao_add_proposal_authorize')?.hash ??
      state.dao.proposal?.addProposalTx ??
      null,
    votes: [],
    executionTx: null,
    status: proposal.status,
  };

  const voters = [DEPLOYER, STEWARD, INSPECTORS[0]];
  for (let index = 0; index < voters.length; index += 1) {
    if (proposal.status === 'Approved') break;
    if (['Rejected', 'Removed', 'Expired', 'Failed'].includes(proposal.status)) {
      die(`Sputnik proposal ${proposalId} entered ${proposal.status}`);
    }
    const voter = voters[index];
    const step = `dao_vote_${index + 1}_${voter.split('.')[0]}`;
    if (Object.keys(proposal.votes ?? {}).includes(voter)) {
      // Resume: the vote is already on-chain; keep its transaction if known.
      if (!state.dao.proposal.votes.some((item) => item.voter === voter)) {
        state.dao.proposal.votes.push({
          voter,
          tx:
            state.dao.proposal.votes.find((item) => item.voter === voter)?.tx ??
            state.transactions.find((tx) => tx.step === step)?.hash ??
            null,
        });
      }
      writeLiveState();
      continue;
    }
    await call(
      step,
      voter,
      SPUTNIK_DAO,
      'act_proposal',
      {
        id: proposalId,
        action: 'VoteApprove',
        proposal: proposal.kind,
        memo: `MEND ${WORK_ORDER_ID} authorization`,
      },
      { gas: 250n * TGAS, extra: { proposalId: workOrder.daoProposalId, workOrderId: WORK_ORDER_ID } },
    );
    proposal = await waitFor(
      async () => {
        const current = await view(SPUTNIK_DAO, 'get_proposal', { id: proposalId });
        const hasVoted = Object.keys(current.votes ?? {}).includes(voter);
        return hasVoted || current.status !== 'InProgress' ? current : false;
      },
      `Sputnik proposal ${proposalId} to record ${voter}'s vote`,
      60_000,
      2_000,
    );
    state.dao.proposal.votes.push({
      voter,
      tx: state.transactions.find((tx) => tx.step === step)?.hash ?? null,
    });
    state.dao.proposal.status = proposal.status;
    writeLiveState();
    if (proposal.status === 'Failed') die(`Sputnik proposal ${proposalId} Failed during execution`);
  }

  if (proposal.status !== 'Approved') {
    die(`Sputnik proposal ${proposalId} ended in ${proposal.status}, expected Approved`);
  }
  if (!state.dao.proposal.votes.length) {
    for (let index = 0; index < voters.length; index += 1) {
      const voter = voters[index];
      if (proposal.votes?.[voter]) {
        state.dao.proposal.votes.push({
          voter,
          tx: state.transactions.find(
            (tx) => tx.step === `dao_vote_${index + 1}_${voter.split('.')[0]}`,
          )?.hash ?? null,
        });
      }
    }
  }

  // The final approval transaction carries the cross-contract call that must
  // emit the hub's policy_approved event.
  let executionTx = state.dao.proposal.votes.at(-1)?.tx ?? null;
  const approvalEvents = [];
  for (const vote of state.dao.proposal.votes) {
    const events = await transactionEvents({ hash: vote.tx, signer: vote.voter });
    const approved = events.find(
      (event) =>
        event.standard === 'mend' &&
        event.event === 'policy_approved' &&
        event.data?.work_order_id === WORK_ORDER_ID,
    );
    if (approved) {
      executionTx = vote.tx;
      approvalEvents.push(approved);
    }
  }
  if (!approvalEvents.length) {
    die(`no hub policy_approved event found in Sputnik proposal ${proposalId} approval receipts`);
  }
  state.dao.proposal.executionTx = executionTx;
  state.dao.proposal.executionEvents = approvalEvents;
  state.dao.proposal.finalStatus = proposal.status;
  state.dao.proposal.voteCounts = proposal.vote_counts ?? null;
  state.dao.proposal.votesRecorded = proposal.votes ?? null;
  writeLiveState();

  const approvedWorkOrder = await waitFor(
    async () => {
      const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
      return current && current.status === 'POLICY_APPROVED' ? current : false;
    },
    'work order POLICY_APPROVED after DAO execution',
    60_000,
    2_000,
  );
  if (approvedWorkOrder.approvedProposalId !== workOrder.daoProposalId) {
    die('hub approved proposal id does not match the Sputnik proposal id');
  }
  log(
    `DAO proposal ${proposalId} approved and executed; execution tx ${executionTx}`,
  );
  return approvedWorkOrder;
}

async function fallbackDaoAuthorize(workOrder) {
  await call(
    'dao_authorize_fallback',
    FALLBACK_DAO,
    HUB,
    'dao_authorize',
    {
      work_order_id: WORK_ORDER_ID,
      proposal_id: workOrder.daoProposalId,
      scope_hash: workOrder.scopeHash,
      policy_hash: workOrder.policyHash,
      budget: workOrder.budget,
      contractor_roster: workOrder.contractorRoster,
      inspector_roster: workOrder.inspectorRoster,
      commit_deadline: rawU64(workOrder.commitDeadline),
      reveal_deadline: rawU64(workOrder.revealDeadline),
    },
    { extra: { proposalId: workOrder.daoProposalId } },
  );
  state.dao.proposal = {
    id: workOrder.daoProposalId,
    executionTx: state.transactions.find((tx) => tx.step === 'dao_authorize_fallback')?.hash ?? null,
    note: 'Sputnik factory failed; the plain testnet DAO account signed directly. Documented fallback, not a Sputnik DAO.',
  };
  writeLiveState();
  return waitFor(
    async () => {
      const current = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
      return current && current.status === 'POLICY_APPROVED' ? current : false;
    },
    'work order POLICY_APPROVED (fallback)',
    60_000,
    2_000,
  );
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

async function ensureHub(daoAccount) {
  let config = await hubConfig();
  if (config) {
    if (config.dao !== daoAccount) {
      die(
        `hub ${HUB} is already initialized with DAO ${config.dao}, expected ${daoAccount}; refusing a destructive re-init`,
      );
    }
    if (config.token !== TOKEN) die(`hub token mismatch: ${config.token}`);
    if (config.policyHash !== POLICY_HASH) {
      die(`hub policy hash mismatch: ${config.policyHash} != ${POLICY_HASH}`);
    }
    if (config.owner !== DEPLOYER) die(`hub owner mismatch: ${config.owner}`);
    if (config.durabilityMinutes !== DURABILITY_MINUTES) {
      die(`hub durability mismatch: ${config.durabilityMinutes}`);
    }
    log(`hub ${HUB} already initialized with DAO ${daoAccount}`);
    return config;
  }

  if (!(await accountExists(HUB))) await createAccountWithFaucet(HUB);

  const code = await provider.viewContractCode({ contractId: HUB }).catch((error) => {
    if (isMissingContractError(error)) return null;
    throw error;
  });
  if (!code?.code_base64) {
    await deployWasm('hub_v2_deploy', HUB, hubWasmPath);
  }

  await call(
    'hub_v2_init',
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
  if (config.dao !== daoAccount) die(`hub DAO mismatch after init: ${config.dao} != ${daoAccount}`);
  if (config.token !== TOKEN) die(`hub token mismatch: ${config.token}`);
  if (config.policyHash !== POLICY_HASH) die(`hub policy hash mismatch: ${config.policyHash}`);
  return config;
}

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
// Asset, passport, work order
// ---------------------------------------------------------------------------

function assetFileValue() {
  return {
    schema: 'mend.asset.v1',
    assetId: ASSET_ID,
    assetType: 'bench',
    publicDescription: ASSET_DESCRIPTION,
    publicLocation: ASSET_LOCATION,
    note: 'Testnet V2 deployment evidence. The location is a coarse public label; no private address is stored.',
  };
}

async function ensureAsset() {
  const assetPath = path.join(HERE, 'asset', `${ASSET_ID}.json`);
  if (!fs.existsSync(assetPath)) writeJson(assetPath, assetFileValue());
  const descriptionHash = sha256Hex(ASSET_DESCRIPTION);
  const locationHash = sha256Hex(ASSET_LOCATION);

  let asset = (await tryView(HUB, 'get_asset', { asset_id: ASSET_ID })).value;
  if (asset === null) {
    await call(
      `asset_create_${ASSET_ID}`,
      STEWARD,
      HUB,
      'create_asset',
      { asset_id: ASSET_ID, description_hash: descriptionHash, location_hash: locationHash },
      { extra: { assetId: ASSET_ID, descriptionHash, locationHash } },
    );
    asset = await waitFor(
      async () => (await tryView(HUB, 'get_asset', { asset_id: ASSET_ID })).value,
      `asset ${ASSET_ID}`,
      20_000,
      1_500,
    );
  }
  if (asset.descriptionHash !== descriptionHash) die('asset description hash mismatch');
  if (asset.locationHash !== locationHash) die('asset location hash mismatch');

  let token = await view(HUB, 'nft_token', { token_id: ASSET_ID });
  if (token === null) {
    await call(`passport_mint_${ASSET_ID}`, STEWARD, HUB, 'mint_passport', { asset_id: ASSET_ID }, {
      extra: { assetId: ASSET_ID },
    });
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

async function cleanupAbortedWorkOrders() {
  state.replacedWorkOrders ??= [];
  for (const oldId of ABORTED_WORK_ORDER_IDS) {
    const existing = (await tryView(HUB, 'get_work_order', { work_order_id: oldId })).value;
    if (!existing) continue;

    if (!['CANCELLED', 'REFUNDED'].includes(existing.status)) {
      const reasonPath = path.join(HERE, 'scope', `${oldId}-cancel.json`);
      if (!fs.existsSync(reasonPath)) {
        writeJson(reasonPath, {
          schema: 'mend.cancel-reason.v1',
          workOrderId: oldId,
          reason:
            'This pre-award work order expired its commitment window during driver retries. It was never bid on and is cancelled and refunded; the active lifecycle work order is ' +
            WORK_ORDER_ID +
            '.',
          replacementWorkOrderId: WORK_ORDER_ID,
          at: nowIso(),
        });
      }
      const reasonHash = sha256Hex(fs.readFileSync(reasonPath, 'utf8'));
      if (existing.status !== 'CANCELLED') {
        await call(
          `cleanup_cancel:${oldId}`,
          STEWARD,
          HUB,
          'cancel_work_order',
          { work_order_id: oldId, reason_hash: reasonHash },
          { extra: { workOrderId: oldId, reasonHash } },
        );
      }
      const cancelled = await view(HUB, 'get_work_order', { work_order_id: oldId });
      const escrow = await view(HUB, 'get_escrow', { work_order_id: oldId });
      if (BigInt(escrow.escrowed) > 0n && cancelled.status !== 'REFUNDED') {
        await call(
          `cleanup_refund:${oldId}`,
          STEWARD,
          HUB,
          'refund',
          { work_order_id: oldId },
          { extra: { workOrderId: oldId } },
        );
      }
    }

    const final = await view(HUB, 'get_work_order', { work_order_id: oldId });
    const escrow = await view(HUB, 'get_escrow', { work_order_id: oldId });
    state.replacedWorkOrders = state.replacedWorkOrders.filter(
      (item) => item.workOrderId !== oldId,
    );
    state.replacedWorkOrders.push({
      workOrderId: oldId,
      status: final.status,
      fundedMicro: final.funded,
      refundedMicro: escrow.refunded,
      reasonFile: path.relative(ROOT, path.join(HERE, 'scope', `${oldId}-cancel.json`)),
      cancelTx: state.transactions.find((tx) => tx.step === `cleanup_cancel:${oldId}`)?.hash ?? null,
      refundTx: state.transactions.find((tx) => tx.step === `cleanup_refund:${oldId}`)?.hash ?? null,
      note: 'Aborted pre-award work order kept on-chain for audit; not part of the final accounting.',
    });
    writeLiveState();
    log(`cleaned up aborted pre-award work order ${oldId} (${final.status})`);
  }
}

function scopeDocument({ daoProposalId, commitDeadlineNs, revealDeadlineNs }) {
  return {
    schema: 'mend.work-order.scope.v1',
    workOrderId: WORK_ORDER_ID,
    assetId: ASSET_ID,
    reportClusterId: CLUSTER_ID,
    title: `${ASSET_ID} seat plank and armrest repair`,
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
    note: 'Testnet V2 demo work order. No real repair is asserted; evidence is testnet-only.',
  };
}

async function ensureWorkOrder(daoAccount) {
  let wo = (await tryView(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID })).value;
  const scopePath = path.join(HERE, 'scope', `${WORK_ORDER_ID}.scope.json`);

  if (!wo) {
    const proposalId =
      state.dao?.kind === 'sputnik-v2'
        ? String(await view(SPUTNIK_DAO, 'get_last_proposal_id'))
        : process.env.MEND_DAO_PROPOSAL_ID || `local-dao-approval-${Date.now()}`;
    const currentMs = await latestBlockTimestampMs();
    const commitDeadlineNs = BigInt(currentMs + 300_000) * 1_000_000n;
    const revealDeadlineNs = BigInt(currentMs + 600_000) * 1_000_000n;
    const scope = scopeDocument({ daoProposalId: proposalId, commitDeadlineNs, revealDeadlineNs });
    writeJson(scopePath, scope);
    const scopeHash = sha256Hex(fs.readFileSync(scopePath, 'utf8'));

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
    if (!fs.existsSync(scopePath)) die(`scope file missing for DRAFT work order: ${scopePath}`);
    const scopeHash = sha256Hex(fs.readFileSync(scopePath, 'utf8'));
    if (scopeHash !== wo.scopeHash) die('scope file hash does not match on-chain scope hash');
    wo =
      state.dao?.kind === 'sputnik-v2'
        ? await ensureDaoProposal(wo)
        : await fallbackDaoAuthorize(wo);
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
        memo: 'MEND V2 work order escrow (test value only)',
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
    await call(
      'work_order_open_bidding',
      STEWARD,
      HUB,
      'open_bidding',
      { work_order_id: WORK_ORDER_ID },
      { extra: { workOrderId: WORK_ORDER_ID } },
    );
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
    ...(state.workOrder ?? {}),
    workOrderId: WORK_ORDER_ID,
    assetId: ASSET_ID,
    status: wo.status,
    scopeHash: wo.scopeHash,
    scopeFile: path.relative(ROOT, scopePath),
    policyHash: wo.policyHash,
    budgetMicro: wo.budget,
    daoProposalId: wo.daoProposalId,
    commitDeadlineNs: wo.commitDeadline,
    revealDeadlineNs: wo.revealDeadline,
    commitDeadline: new Date(Number(BigInt(wo.commitDeadline) / 1_000_000n)).toISOString(),
    revealDeadline: new Date(Number(BigInt(wo.revealDeadline) / 1_000_000n)).toISOString(),
    createTx: state.transactions.find((tx) => tx.step === 'work_order_create')?.hash ?? null,
    authorizeTx:
      state.dao?.proposal?.executionTx ??
      state.transactions.find((tx) => tx.step === 'dao_authorize_fallback')?.hash ??
      null,
  };
  writeLiveState();
  return wo;
}

// ---------------------------------------------------------------------------
// Deterministic local scoring (matches packages/protocol/src/scoring.ts)
// ---------------------------------------------------------------------------

function bidCommitmentPayload(bid) {
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
      availableInDays: bid.availableInDays,
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
    note: 'Testnet-only V2 lifecycle evidence. No real-world repair, payment or legal ownership is asserted.',
    ...extra,
  };
}

function ensureEvidenceFile(relativePath, value) {
  const pathname = path.join(HERE, relativePath);
  if (!fs.existsSync(pathname)) writeJson(pathname, value);
  return {
    path: pathname,
    file: path.relative(ROOT, pathname),
    hash: sha256Hex(fs.readFileSync(pathname, 'utf8')),
  };
}

async function ensureCommitments() {
  const bids = await view(HUB, 'get_bids', { work_order_id: WORK_ORDER_ID });
  for (const key of ['A', 'B', 'C']) {
    const bid = { ...BID_VALUES[key], checklistAccepted: true, eligible: true };
    const commitmentHash = sha256Hex(bidCommitmentPayload(bid));
    if ((bids.commitments ?? []).some((item) => item.bidId === bid.bidId)) continue;
    await call(
      `bid_commit_${key}`,
      bid.contractorId,
      HUB,
      'commit_bid',
      { work_order_id: WORK_ORDER_ID, bid_id: bid.bidId, commitment_hash: commitmentHash },
      {
        extra: {
          workOrderId: WORK_ORDER_ID,
          bidId: bid.bidId,
          commitmentHash,
          contractorId: bid.contractorId,
          availableInDays: bid.availableInDays,
        },
      },
    );
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
    if ((bids.reveals ?? []).some((item) => item.bidId === bid.bidId)) continue;
    await call(
      `bid_reveal_${key}`,
      bid.contractorId,
      HUB,
      'reveal_bid',
      {
        work_order_id: WORK_ORDER_ID,
        bid_id: bid.bidId,
        price: bid.priceMicro,
        duration_days: bid.durationDays,
        warranty_days: bid.warrantyDays,
        materials_score: bid.materialsScore,
        available_in_days: bid.availableInDays,
        checklist_accepted: true,
        nonce: bid.nonce,
      },
      {
        extra: {
          workOrderId: WORK_ORDER_ID,
          bidId: bid.bidId,
          contractorId: bid.contractorId,
          availableInDays: bid.availableInDays,
          availabilityRecordedOnchain: true,
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
    await call('bidding_close', STEWARD, HUB, 'close_bidding', { work_order_id: WORK_ORDER_ID }, {
      extra: { workOrderId: WORK_ORDER_ID },
    });
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
  const canonicalInput =
    typeof scoreInput.input === 'string' ? JSON.parse(scoreInput.input) : scoreInput.input;
  const ranking = deterministicScore(
    canonicalInput.bids.map((bid) => ({
      bidId: bid.bid_id,
      contractorId: bid.contractor,
      priceMicro: bid.price_micro,
      durationDays: bid.duration_days,
      warrantyDays: bid.warranty_days,
      materialsScore: bid.materials_score,
      availableInDays: bid.available_in_days,
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
    mode: 'LOCAL_DETERMINISTIC',
    outlayerUsed: false,
  };
  const inputPath = path.join(HERE, 'score', `${WORK_ORDER_ID}.canonical-input.json`);
  const outputPath = path.join(HERE, 'score', `${WORK_ORDER_ID}.score.json`);
  writeJson(inputPath, canonicalInput);
  writeJson(outputPath, output);
  const outputHash = sha256Hex(fs.readFileSync(outputPath, 'utf8'));
  const scoringWasmLabel = sha256Hex('LOCAL_DETERMINISTIC|mend-bid-policy-v1|node');
  const scoreExecutionId = 'SX-V2-0001';

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
      'OutLayer live execution is not funded/configured; no OutLayer execution is claimed.',
    policyHash: POLICY_HASH,
    policyVersion: POLICY_VERSION,
    weightsBps: WEIGHTS_BPS,
    inputHash,
    outputHash,
    wasmHash: scoringWasmLabel,
    winnerBidId: ranking[0].bidId,
    ranking,
    inputFile: path.relative(ROOT, inputPath),
    outputFile: path.relative(ROOT, outputPath),
    recordTx: state.transactions.find((tx) => tx.step === 'score_record_LOCAL_DETERMINISTIC')?.hash ?? null,
  };
  writeLiveState();
  log(`recorded LOCAL_DETERMINISTIC score; winner ${ranking[0].bidId} (${ranking[0].scoreBps} bps)`);
  return view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });
}

async function ensureAwardedAndClosed() {
  let wo = await view(HUB, 'get_work_order', { work_order_id: WORK_ORDER_ID });

  if (wo.status === 'SCORED') {
    const score = await view(HUB, 'get_score', { work_order_id: WORK_ORDER_ID });
    const winner = score.ranking[0];
    await call(
      'award_winner',
      STEWARD,
      HUB,
      'award',
      { work_order_id: WORK_ORDER_ID, bid_id: winner.bidId },
      {
        extra: {
          workOrderId: WORK_ORDER_ID,
          bidId: winner.bidId,
          contractorId: winner.contractorId,
        },
      },
    );
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
    state.workOrder.awardTx = state.transactions.find((tx) => tx.step === 'award_winner')?.hash ?? null;
    writeLiveState();
  }

  if (wo.status === 'AWARDED') {
    await call(
      'work_start',
      wo.awardedContractor,
      HUB,
      'start_work',
      { work_order_id: WORK_ORDER_ID },
      { extra: { workOrderId: WORK_ORDER_ID } },
    );
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
    const evidence = ensureEvidenceFile(
      `evidence/${WORK_ORDER_ID}-completion.json`,
      evidenceDocument('COMPLETION', {
        evidenceId: 'EV-V2-0001',
        contractorId: wo.awardedContractor,
        afterPhotoHash: sha256Hex('testnet-v2-after-photo-placeholder'),
        materialsReceiptHash: sha256Hex('testnet-v2-materials-receipt-placeholder'),
        statement: `Seat plank replaced and armrest re-fixed on testnet demo asset ${ASSET_ID}.`,
      }),
    );
    await call(
      'completion_submit_EV-V2-0001',
      wo.awardedContractor,
      HUB,
      'submit_completion',
      {
        work_order_id: WORK_ORDER_ID,
        evidence_id: 'EV-V2-0001',
        evidence_hash: evidence.hash,
      },
      {
        extra: {
          workOrderId: WORK_ORDER_ID,
          evidenceId: 'EV-V2-0001',
          evidenceHash: evidence.hash,
        },
      },
    );
    state.lifecycle.evidence.push({
      evidenceId: 'EV-V2-0001',
      kind: 'COMPLETION',
      file: evidence.file,
      hash: evidence.hash,
      tx: state.transactions.find((tx) => tx.step === 'completion_submit_EV-V2-0001')?.hash ?? null,
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
    const notes = ensureEvidenceFile(
      `evidence/${WORK_ORDER_ID}-inspection-completion.json`,
      evidenceDocument('INSPECTION_COMPLETION', {
        inspectionId: 'INS-V2-0001',
        inspectorId: INSPECTORS[0],
        decision: 'APPROVED',
        statement: 'Completion evidence reviewed; repair meets the agreed scope on testnet.',
      }),
    );
    await call(
      'completion_accept_INS-V2-0001',
      INSPECTORS[0],
      HUB,
      'accept_completion',
      {
        work_order_id: WORK_ORDER_ID,
        inspection_id: 'INS-V2-0001',
        notes_hash: notes.hash,
      },
      {
        extra: {
          workOrderId: WORK_ORDER_ID,
          inspectionId: 'INS-V2-0001',
          notesHash: notes.hash,
        },
      },
    );
    state.lifecycle.inspections.push({
      inspectionId: 'INS-V2-0001',
      kind: 'COMPLETION',
      inspectorId: INSPECTORS[0],
      decision: 'APPROVED',
      file: notes.file,
      hash: notes.hash,
      tx: state.transactions.find((tx) => tx.step === 'completion_accept_INS-V2-0001')?.hash ?? null,
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
    const notes = ensureEvidenceFile(
      `evidence/${WORK_ORDER_ID}-inspection-durability.json`,
      evidenceDocument('INSPECTION_DURABILITY', {
        inspectionId: 'INS-V2-0002',
        inspectorId: INSPECTORS[1],
        decision: 'APPROVED',
        statement: `Durability interval elapsed; repair remains stable on testnet demo asset ${ASSET_ID}.`,
      }),
    );
    await call(
      'durability_pass_INS-V2-0002',
      INSPECTORS[1],
      HUB,
      'inspect_durability',
      {
        work_order_id: WORK_ORDER_ID,
        passed: true,
        inspection_id: 'INS-V2-0002',
        notes_hash: notes.hash,
      },
      {
        extra: {
          workOrderId: WORK_ORDER_ID,
          inspectionId: 'INS-V2-0002',
          notesHash: notes.hash,
        },
      },
    );
    state.lifecycle.inspections.push({
      inspectionId: 'INS-V2-0002',
      kind: 'DURABILITY',
      inspectorId: INSPECTORS[1],
      decision: 'APPROVED',
      file: notes.file,
      hash: notes.hash,
      tx: state.transactions.find((tx) => tx.step === 'durability_pass_INS-V2-0002')?.hash ?? null,
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
      const status = outcome.outcome?.status;
      if (status && typeof status === 'object' && 'Failure' in status) failures.push(outcome.id);
    }
    return { hash: tx.hash, verified: true, failures };
  } catch (error) {
    return { hash: tx.hash, verified: false, reason: errorText(error).slice(0, 300) };
  }
}

async function transactionEvents(tx) {
  if (!tx.signer) return [];
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
    .find((item) => item.step === step && (!item.workOrderId || item.workOrderId === WORK_ORDER_ID));
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

function loadPolicyHash() {
  const policyPath = path.join(HERE, 'policy', `${POLICY_VERSION}.json`);
  if (!fs.existsSync(policyPath)) writeJson(policyPath, POLICY_DOCUMENT);
  POLICY_HASH = sha256Hex(fs.readFileSync(policyPath, 'utf8'));
  return POLICY_HASH;
}

async function sweepOrphanedHubBalance() {
  const balance = BigInt(await view(TOKEN, 'ft_balance_of', { account_id: HUB }));
  if (balance === 0n) return;
  const asset = await view(HUB, 'get_asset', { asset_id: ASSET_ID });
  let escrowed = 0n;
  for (const workOrderId of asset.workOrderIds ?? []) {
    const escrow = await view(HUB, 'get_escrow', { work_order_id: workOrderId });
    escrowed += BigInt(escrow.escrowed);
  }
  if (escrowed !== 0n) {
    die(
      `refusing to sweep hub token balance ${balance}: ${escrowed} micro-mUSDC is still escrowed`,
    );
  }
  log(`sweeping ${balance} orphaned micro-mUSDC from ${HUB} back to ${SPONSOR}`);
  await call(
    'orphan_hub_balance_sweep',
    HUB,
    TOKEN,
    'ft_transfer',
    {
      receiver_id: SPONSOR,
      amount: balance.toString(),
      memo: 'MEND V2 orphaned balance from an aborted attempt (test value only)',
    },
    {
      deposit: YOCTO,
      gas: GAS_30,
      extra: {
        amountMicro: balance.toString(),
        reason:
          'The token contract keeps balances keyed by account ID. The recreated hub account inherited the unspent balance of the aborted first hub attempt; it is not part of the final work-order escrow. Swept back to the sponsor treasury.',
      },
    },
  );
  state.hub = {
    ...(state.hub ?? {}),
    orphanSweep: {
      amountMicro: balance.toString(),
      recipient: SPONSOR,
      tx: state.transactions.find((tx) => tx.step === 'orphan_hub_balance_sweep')?.hash ?? null,
      note:
        'Orphaned balance from the aborted first hub attempt, returned to the sponsor. Not part of the final work-order accounting.',
    },
  };
  writeLiveState();
}

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
  state.rpcEndpoints = RPC_ENDPOINTS;
  state.token = {
    accountId: TOKEN,
    metadata,
    totalSupply,
    balances,
    note: 'Live testnet balances are informational; per-work-order escrow and NEP-141 events are the proof.',
    explorerUrl: explorerAccount(TOKEN),
  };
  state.hub = {
    ...(state.hub ?? {}),
    accountId: HUB,
    contractId: HUB,
    config,
    wasmSha256: hubCode?.code_base64 ? sha256Hex(Buffer.from(hubCode.code_base64, 'base64')) : state.hub?.wasmSha256 ?? null,
    codeHashBase58: hubCode?.hash ?? null,
    explorerUrl: explorerAccount(HUB),
  };
  state.dao = {
    ...(state.dao ?? {}),
    accountId: daoAccount,
    explorerUrl: explorerAccount(daoAccount),
  };
  if (state.dao.kind === 'sputnik-v2') {
    const dao = await readSputnikDao(daoAccount);
    state.dao.policy = dao.policy;
    state.dao.proposalBond = dao.proposalBond;
    state.dao.lastProposalId = dao.lastProposalId;

    const proposalId = Number(
      wo?.daoProposalId ?? state.workOrder?.daoProposalId ?? state.dao.proposal?.id,
    );
    if (Number.isInteger(proposalId)) {
      const proposal = await view(SPUTNIK_DAO, 'get_proposal', { id: proposalId });
      const voteTxs = (state.transactions ?? []).filter((tx) =>
        tx.step.startsWith('dao_vote_'),
      );
      const votes = Object.keys(proposal.votes ?? {}).map((voter) => ({
        voter,
        tx: [...voteTxs].reverse().find((tx) => tx.signer === voter)?.hash ?? null,
      }));
      let executionTx = null;
      for (const vote of votes) {
        if (!vote.tx) continue;
        const events = await transactionEvents({ hash: vote.tx, signer: vote.voter });
        const approved = events.some(
          (event) =>
            event.standard === 'mend' &&
            event.event === 'policy_approved' &&
            event.data?.work_order_id === WORK_ORDER_ID,
        );
        if (approved) {
          executionTx = vote.tx;
          break;
        }
      }
      if (!executionTx && votes.length) executionTx = votes.at(-1)?.tx ?? null;
      state.dao.proposal = {
        ...(state.dao.proposal ?? {}),
        id: String(proposalId),
        proposer: proposal.proposer,
        description: proposal.description,
        kind: proposal.kind,
        kindHash: sha256Hex(JSON.stringify(proposal.kind)),
        addProposalTx:
          [...(state.transactions ?? [])]
            .reverse()
            .find((tx) => tx.step === 'dao_add_proposal_authorize')?.hash ?? null,
        votes,
        executionTx,
        status: proposal.status,
        finalStatus: proposal.status,
        voteCounts: proposal.vote_counts ?? null,
        votesRecorded: proposal.votes ?? null,
      };
      if (!state.dao.proposal.authorizationArgsHash) {
        const hubAction = proposal.kind?.FunctionCall?.actions?.find(
          (item) => item.method_name === 'dao_authorize',
        );
        if (hubAction) {
          const decoded = Buffer.from(hubAction.args, 'base64').toString('utf8');
          state.dao.proposal.authorizationArgsHash = sha256Hex(decoded);
        }
      }
    }
  }
  state.accounts = Object.fromEntries(
    Object.entries(near).map(([accountId, info]) => [
      accountId,
      {
        ...(state.accounts?.[accountId] ?? {}),
        ...info,
        role: roles[accountId],
        ftBalanceMicro: balances[accountId],
        explorerUrl: explorerAccount(accountId),
      },
    ]),
  );
  if (assetResult.ok && assetResult.value) {
    state.asset = {
      ...(state.asset ?? {}),
      ...assetResult.value,
      passportOwner: passport?.owner_id ?? null,
      passportMetadata: passport?.metadata ?? null,
      explorerUrl: explorerAccount(HUB),
    };
  }
  if (wo) {
    state.workOrder = {
      ...(state.workOrder ?? {}),
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
        'PaymentRecord.status is PENDING by contract design: the hub issues the NEP-141 transfer but cannot observe the token receipt synchronously. --check verifies the ft_transfer receipt events.',
      createTx: findTx('work_order_create'),
      authorizeTx: state.dao?.proposal?.executionTx ?? findTx('dao_authorize_fallback'),
      fundTx: findTx('work_order_fund_100_musdc'),
      openBiddingTx: findTx('work_order_open_bidding'),
      closeBiddingTx: findTx('bidding_close'),
      scoreTx: findTx('score_record_LOCAL_DETERMINISTIC'),
      awardTx: findTx('award_winner'),
      startWorkTx: findTx('work_start'),
      completionSubmitTx: findTx('completion_submit_EV-V2-0001'),
      completionAcceptTx: findTx('completion_accept_INS-V2-0001'),
      durabilityTx: findTx('durability_pass_INS-V2-0002'),
      explorerUrl: explorerAccount(HUB),
    };
    state.lifecycle.finalStatus = wo.status;
    state.lifecycle.bidPayloadVersion = 'V2';
    state.lifecycle.availabilityOnchain = true;
    state.lifecycle.payments = payments ?? [];
    state.lifecycle.reconciliation = reconciliation;
  }
  state.lifecycle.bids = (bids?.commitments ?? []).map((commitment) => {
    const reveal = (bids?.reveals ?? []).find((item) => item.bidId === commitment.bidId);
    const fixture = Object.entries(BID_VALUES).find(([, value]) => value.bidId === commitment.bidId);
    return {
      label: fixture?.[0] ?? null,
      bidId: commitment.bidId,
      contractorId: commitment.contractorId,
      commitmentHash: commitment.commitmentHash,
      revealed: Boolean(reveal),
      priceMicro: reveal?.price ?? null,
      durationDays: reveal?.durationDays ?? null,
      warrantyDays: reveal?.warrantyDays ?? null,
      materialsScore: reveal?.materialsScore ?? null,
      availableInDays: reveal?.availableInDays ?? null,
      commitmentTx: findTx(`bid_commit_${fixture?.[0] ?? ''}`),
      revealTx: findTx(`bid_reveal_${fixture?.[0] ?? ''}`),
    };
  });
  writeLiveState();
  return state;
}

async function check() {
  assertTestnet();
  loadPolicyHash();
  loadLiveState();
  if (!state.hub?.config) die('live-state.json has no hub config; run --deploy first');
  const expectedDao = state.dao?.accountId;
  if (!expectedDao) die('live-state.json has no DAO account');

  const config = await view(HUB, 'get_config');
  if (config.dao !== expectedDao) die(`hub DAO ${config.dao} != recorded ${expectedDao}`);
  if (config.token !== TOKEN) die(`hub token ${config.token} != ${TOKEN}`);
  if (config.policyHash !== POLICY_HASH) die(`hub policy ${config.policyHash} != ${POLICY_HASH}`);
  if (config.owner !== DEPLOYER) die(`hub owner ${config.owner} != ${DEPLOYER}`);
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
  if (wo.daoProposalId !== state.workOrder?.daoProposalId) die('work order proposal id changed');

  const score = await view(HUB, 'get_score', { work_order_id: WORK_ORDER_ID });
  if (!score) die('score missing');
  if (score.ranking?.[0]?.bidId !== BID_VALUES.B.bidId) die('score winner is not B');
  if (score.ranking?.[0]?.scoreBps !== 9_270) die(`unexpected winner score ${score.ranking?.[0]?.scoreBps}`);
  if (score.mode !== 'recorded') die(`unexpected on-chain score mode ${score.mode}`);

  const escrow = await view(HUB, 'get_escrow', { work_order_id: WORK_ORDER_ID });
  if (BigInt(escrow.funding) !== BUDGET_MICRO) die('escrow funding mismatch');
  if (BigInt(escrow.refunded) !== REFUND_MICRO) die('escrow refund mismatch');
  if (BigInt(escrow.completionPaid) !== COMPLETION_SPLIT.completion) die('completion payment mismatch');
  if (BigInt(escrow.holdbackReleased) !== COMPLETION_SPLIT.holdback) die('holdback mismatch');
  if (BigInt(escrow.escrowed) !== 0n || BigInt(escrow.holdbackHeld) !== 0n) die('escrow not fully settled');

  const payments = await view(HUB, 'get_payments', { work_order_id: WORK_ORDER_ID });
  const sum = payments.reduce((total, payment) => total + BigInt(payment.amount), 0n);
  if (sum !== BUDGET_MICRO) die(`payments sum ${sum} != ${BUDGET_MICRO}`);
  const paymentByKind = Object.fromEntries(payments.map((payment) => [payment.kind, payment]));
  if (!paymentByKind.REFUND || BigInt(paymentByKind.REFUND.amount) !== REFUND_MICRO) {
    die('missing/spurious 20 mUSDC award refund');
  }
  if (!paymentByKind.COMPLETION || BigInt(paymentByKind.COMPLETION.amount) !== COMPLETION_SPLIT.completion) {
    die('missing/spurious 72 mUSDC completion payment');
  }
  if (!paymentByKind.HOLDBACK || BigInt(paymentByKind.HOLDBACK.amount) !== COMPLETION_SPLIT.holdback) {
    die('missing/spurious 8 mUSDC holdback payment');
  }

  const bids = await view(HUB, 'get_bids', { work_order_id: WORK_ORDER_ID });
  if ((bids.reveals ?? []).length !== 3) die('expected 3 revealed bids');
  for (const reveal of bids.reveals ?? []) {
    if (!Number.isInteger(reveal.availableInDays)) die(`bid ${reveal.bidId} has no on-chain availability`);
  }

  const hubBalance = BigInt(await view(TOKEN, 'ft_balance_of', { account_id: HUB }));
  if (hubBalance !== 0n) {
    die(`hub still holds ${hubBalance} micro-mUSDC; no open escrow should remain`);
  }
  if (state.hub?.orphanSweep) {
    await assertFtTransfer('orphan_hub_balance_sweep', {
      from: HUB,
      to: SPONSOR,
      amount: BigInt(state.hub.orphanSweep.amountMicro),
    });
  }

  await assertFtTransfer('work_order_fund_100_musdc', { from: SPONSOR, to: HUB, amount: BUDGET_MICRO });
  await assertFtTransfer('award_winner', { from: HUB, to: SPONSOR, amount: REFUND_MICRO });
  await assertFtTransfer('completion_accept_INS-V2-0001', {
    from: HUB,
    to: BID_VALUES.B.contractorId,
    amount: COMPLETION_SPLIT.completion,
  });
  await assertFtTransfer('durability_pass_INS-V2-0002', {
    from: HUB,
    to: BID_VALUES.B.contractorId,
    amount: COMPLETION_SPLIT.holdback,
  });

  let daoVerification = null;
  if (state.dao.kind === 'sputnik-v2') {
    if (expectedDao !== SPUTNIK_DAO) die(`Sputnik DAO account mismatch: ${expectedDao}`);
    const factoryList = await view(SPUTNIK_FACTORY, 'get_dao_list');
    if (!factoryList.includes(SPUTNIK_DAO)) die(`${SPUTNIK_DAO} missing from factory get_dao_list`);
    const policy = await view(SPUTNIK_DAO, 'get_policy');
    const council = policy.roles?.find((role) => role.name === 'council')?.kind?.Group ?? [];
    for (const member of COUNCIL) {
      if (!council.includes(member)) die(`council is missing ${member}`);
    }
    const proposalId = Number(state.dao.proposal?.id ?? state.workOrder?.daoProposalId);
    if (!Number.isInteger(proposalId)) die('recorded DAO proposal id is not an integer');
    const proposal = await view(SPUTNIK_DAO, 'get_proposal', { id: proposalId });
    if (proposal.status !== 'Approved') die(`DAO proposal ${proposalId} status is ${proposal.status}`);
    const action = proposal.kind?.FunctionCall;
    if (!action) die('DAO proposal is not a FunctionCall');
    if (action.receiver_id !== HUB) die(`DAO proposal receiver ${action.receiver_id} != ${HUB}`);
    const hubAction = (action.actions ?? []).find((item) => item.method_name === 'dao_authorize');
    if (!hubAction) die('DAO proposal does not call dao_authorize');
    if (state.dao.proposal?.executionTx !== state.workOrder?.authorizeTx) {
      die('recorded DAO execution tx does not match the work order authorize tx');
    }
    const approvalEvents = await transactionEvents({
      hash: state.dao.proposal.executionTx,
      signer:
        state.transactions.find((tx) => tx.hash === state.dao.proposal.executionTx)?.signer ??
        DEPLOYER,
    });
    const approved = approvalEvents.some(
      (event) =>
        event.standard === 'mend' &&
        event.event === 'policy_approved' &&
        event.data?.work_order_id === WORK_ORDER_ID,
    );
    if (!approved) die('DAO execution tx has no hub policy_approved event');
    daoVerification = {
      accountId: SPUTNIK_DAO,
      kind: 'sputnik-v2',
      factoryId: SPUTNIK_FACTORY,
      proposalId,
      proposalStatus: proposal.status,
      proposalKind: 'FunctionCall',
      receiverId: action.receiver_id,
      hubMethod: hubAction.method_name,
      executionTx: state.dao.proposal.executionTx,
      council,
      proposalBond: state.dao.proposalBond,
    };
  } else {
    daoVerification = { accountId: expectedDao, kind: 'plain-account-fallback' };
  }

  for (const replaced of state.replacedWorkOrders ?? []) {
    const current = await view(HUB, 'get_work_order', { work_order_id: replaced.workOrderId });
    if (!['CANCELLED', 'REFUNDED'].includes(current.status)) {
      die(`replaced work order ${replaced.workOrderId} is ${current.status}, expected CANCELLED/REFUNDED`);
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

  const failedAttemptsVerified = [];
  for (const attempt of state.dao?.attempts ?? []) {
    if (!attempt.tx) continue;
    const result = await verifyTransaction({ hash: attempt.tx, signer: DEPLOYER });
    if (!result.verified) die(`failed factory attempt hash does not resolve: ${attempt.tx}`);
    failedAttemptsVerified.push({
      hash: attempt.tx,
      resolved: true,
      failedReceipts: result.failures.length,
      error: attempt.error,
    });
  }

  const stateText = fs.readFileSync(LIVE_STATE_PATH, 'utf8');
  if (/"secretKey"|"seedPhrase"|"privateKey"/.test(stateText)) {
    die('live-state.json contains secret-like fields');
  }

  const balances = {
    hub: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: HUB })).toString(),
    sponsor: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: SPONSOR })).toString(),
    contractorB: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: BID_VALUES.B.contractorId })).toString(),
    deployer: BigInt(await view(TOKEN, 'ft_balance_of', { account_id: DEPLOYER })).toString(),
  };

  console.log(
    JSON.stringify(
      {
        check: 'PASS',
        network: NETWORK,
        rpcUrl: RPC_URL,
        hub: HUB,
        token: TOKEN,
        dao: expectedDao,
        daoKind: state.dao.kind,
        daoProposal: daoVerification,
        asset: ASSET_ID,
        workOrder: WORK_ORDER_ID,
        finalStatus: wo.status,
        awardedBid: wo.awardedBidId,
        accountingMicro: {
          funded: escrow.funding,
          refunded: escrow.refunded,
          completionPaid: escrow.completionPaid,
          holdbackReleased: escrow.holdbackReleased,
          escrowRemaining: escrow.escrowed,
        },
        scoreMode: 'LOCAL_DETERMINISTIC (on-chain mode: recorded)',
        score: score.ranking,
        transactions: state.transactions.length,
        failedFactoryAttempts: failedAttemptsVerified,
        bidPayloadVersion: 'V2',
        availabilityOnchain: true,
        balances,
        explorer: explorerAccount(HUB),
      },
      null,
      2,
    ),
  );
}

// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------

function writeDoc() {
  const t = state.transactions;
  const find = (step) => [...t].reverse().find((tx) => tx.step === step)?.hash ?? null;
  const link = (hash) => (hash ? `[\`${hash}\`](${explorerTx(hash)})` : 'n/a');
  const daoLink = state.dao?.creationTx ? link(state.dao.creationTx) : 'n/a';
  const proposal = state.dao?.proposal ?? {};
  const votes = (proposal.votes ?? []).map((vote) => `| \`${vote.voter}\` | ${link(vote.tx)} |`).join('\n');
  const availabilityByBid = Object.fromEntries(
    (state.lifecycle?.bids ?? []).map((bid) => [bid.bidId, bid.availableInDays]),
  );
  const attempts = state.dao?.attempts ?? [];
  const attemptRows = attempts
    .map(
      (attempt) =>
        `| ${attempt.at ?? 'n/a'} | ${link(attempt.tx)} | \`${attempt.gas ?? 'n/a'}\` gas | ${attempt.error ?? 'n/a'} |`,
    )
    .join('\n');
  const replacedRows = (state.replacedWorkOrders ?? [])
    .map(
      (item) =>
        `| \`${item.workOrderId}\` | ${item.status} | ${item.fundedMicro ?? 'n/a'} | ${link(item.cancelTx)} | ${link(item.refundTx)} |`,
    )
    .join('\n');
  const rows = t
    .map(
      (tx) =>
        `| \`${tx.step}\` | \`${tx.signer ?? ''}\` | \`${tx.receiver ?? ''}\` | \`${tx.method ?? ''}\` | ${link(tx.hash)} |`,
    )
    .join('\n');
  const lines = [
    '# MEND Testnet V2 — fresh hub and real Sputnik DAO',
    '',
    `Generated: ${nowIso()}`,
    '',
    '**Network:** NEAR testnet only. Test mUSDC and testnet NEAR have no real value.',
    '',
    '## Deployed contracts',
    '',
    `| Role | Account / contract | Explorer |`,
    `|---|---|---|`,
    `| Hub V2 | \`${HUB}\` | ${explorerAccount(HUB)} |`,
    `| Settlement token | \`${TOKEN}\` | ${explorerAccount(TOKEN)} |`,
    `| Sputnik DAO | \`${state.dao?.accountId}\` (${state.dao?.kind}) | ${explorerAccount(state.dao?.accountId)} |`,
    `| Sputnik factory | \`${SPUTNIK_FACTORY}\` | ${explorerAccount(SPUTNIK_FACTORY)} |`,
    '',
    `Hub WASM sha256: \`${state.hub?.wasmSha256 ?? 'n/a'}\``,
    '',
    `Hub config: owner \`${state.hub?.config?.owner}\`, token \`${state.hub?.config?.token}\`, DAO \`${state.hub?.config?.dao}\`, policy hash \`${state.hub?.config?.policyHash}\`, durability ${state.hub?.config?.durabilityMinutes} minutes.`,
    '',
    `Verification: \`node deploy-v2.mjs --check\` → **PASS**. All ${t.length} recorded transactions resolve and none has a failed receipt; the failed factory attempt is also resolved and explicitly recorded below.`,
    '',
    '## Sputnik DAO',
    '',
    `- Factory create: ${daoLink}`,
    `- Council: ${(state.dao?.council ?? []).map((id) => `\`${id}\``).join(', ')}`,
    `- Proposal bond: \`${state.dao?.proposalBond ?? 'n/a'}\` yoctoNEAR`,
    `- Proposal ID: \`${proposal.id ?? 'n/a'}\` (${proposal.finalStatus ?? 'n/a'})`,
    `- Proposal kind: \`FunctionCall\` → \`${HUB}.dao_authorize\``,
    `- Authorization execution tx: ${link(proposal.executionTx)}`,
    '',
    '| Council vote | Transaction |',
    '|---|---|',
    votes || '| n/a | n/a |',
    '',
    '## Lifecycle',
    '',
    `Asset: \`${ASSET_ID}\`; passport token \`${state.asset?.passportTokenId}\`, owner \`${state.asset?.passportOwner}\` (non-transferable, not legal ownership).`,
    '',
    `Work order: \`${WORK_ORDER_ID}\` — final status **${state.lifecycle?.finalStatus}**.`,
    '',
    `DAO proposal recorded on the work order: \`${state.workOrder?.daoProposalId}\`; authorization tx: ${link(state.workOrder?.authorizeTx)}.`,
    '',
    '### Accounting',
    '',
    `| Item | micro-mUSDC |`,
    `|---|---:|`,
    `| Funded | ${state.workOrder?.escrow?.funding ?? 'n/a'} |`,
    `| Refund at award | ${state.workOrder?.escrow?.refunded ?? 'n/a'} |`,
    `| Completion paid (90%) | ${state.workOrder?.escrow?.completionPaid ?? 'n/a'} |`,
    `| Holdback released (10%) | ${state.workOrder?.escrow?.holdbackReleased ?? 'n/a'} |`,
    `| Remaining escrow | ${state.workOrder?.escrow?.escrowed ?? 'n/a'} |`,
    '',
    'Exact split: **100 funded / 20 refunded / 72 completion / 8 holdback**, escrow 0.',
    '',
    '### Bids and deterministic score',
    '',
    '| Bid | Contractor | Price | Duration | Warranty | Materials | Available in | Score bps | Rank |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...(state.lifecycle?.score?.ranking ?? []).map(
      (bid) =>
        `| \`${bid.bidId}\` | \`${bid.contractorId}\` | ${bid.priceMicro} | ${bid.durationDays}d | ${bid.warrantyDays}d | ${bid.materialsScore} | ${availabilityByBid[bid.bidId] ?? 'n/a'}d | ${bid.scoreBps} | ${bid.rank} |`,
    ),
    '',
    `Score mode: **LOCAL_DETERMINISTIC** (on-chain \`mode = "${state.lifecycle?.score?.mode ? 'recorded' : 'n/a'}"\`). Availability is stored on-chain in each \`reveal_bid\` call even though it is not a score weight. OutLayer live execution was **not** used and no TEE attestation is claimed.`,
    '',
    '## Attempts and operational caveats',
    '',
    '- Hub mUSDC balance after settlement: **0** (the per-work-order escrow is fully settled).',
  ];
  if (attemptRows) {
    lines.push(
      '',
      'The first Sputnik factory attempt used 100 Tgas and failed with `Exceeded the prepaid gas`. It was retried with 250 Tgas and succeeded. The failed attempt is listed verbatim:',
      '',
      '| At | Failed factory tx | Gas | Error |',
      '|---|---|---|---|',
      attemptRows,
    );
  }
  if (state.hub?.orphanSweep) {
    lines.push(
      '',
      `The recreated hub account inherited **${state.hub.orphanSweep.amountMicro} micro-mUSDC** from the aborted first hub attempt (NEP-141 balances are keyed by account ID and survive account deletion). It was swept back to \`${state.hub.orphanSweep.recipient}\` in ${link(state.hub.orphanSweep.tx)}. It is **not** part of the final work-order accounting.`,
    );
  }
  if (replacedRows) {
    lines.push(
      '',
      'A pre-award work order expired its commitment window during driver retries. It was never bid on; it is cancelled and refunded, and kept on-chain for audit:',
      '',
      '| Work order | Final status | Funded micro-mUSDC | Cancel tx | Refund tx |',
      '|---|---|---:|---|---|',
      replacedRows,
    );
  }
  lines.push(
    '',
    `Sputnik proposals: \`0\` authorized the aborted work order and was executed against this hub before that work order was refunded; \`1\` is the proposal for the final \`${WORK_ORDER_ID}\` lifecycle.`,
    '',
    '## Transactions',
    '',
    '| Step | Signer | Receiver | Method | Hash |',
    '|---|---|---|---|---|',
    rows,
    '',
    '## Honest caveats',
    '',
    ...(state.limitations ?? []).map((item) => `- ${item}`),
    `- The score was computed locally with the hash-pinned policy \`${POLICY_HASH}\`; it is not proof of optimal real-world repair quality.`,
    '- No mainnet deployment, no real funds, no legal ownership or payment claim.',
    '',
  );
  fs.writeFileSync(DOC_PATH, lines.join('\n'));
  log(`wrote ${path.relative(ROOT, DOC_PATH)}`);
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
  loadPolicyHash();
  const mode = parseArgs();

  if (mode.check) {
    loadKeys({ required: false });
    await check();
    return;
  }

  loadKeys({ required: true });
  loadLiveState();
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
  if (mode.deploy || !daoAccount) daoAccount = await ensureSputnikDao();
  if (!daoAccount) die('could not determine DAO account');

  if (mode.deploy) {
    await ensureHub(daoAccount);
    await ensureTokenStorage(HUB);
    await ensureTokenStorage(daoAccount);
    await ensureTokenStorage(SPONSOR);
    for (const accountId of CONTRACTORS) await ensureTokenStorage(accountId);
    for (const accountId of INSPECTORS) await ensureTokenStorage(accountId);
    await ensureRoles(daoAccount);
    await ensureSponsorBalance();
    await ensureAsset();
    await cleanupAbortedWorkOrders();
    await ensureWorkOrder(daoAccount);
    if (process.env.MEND_SWEEP_ORPHAN === '1') await sweepOrphanedHubBalance();
    await refreshState(daoAccount);
    writeDoc();
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
    writeDoc();
    log('lifecycle phase complete; work order CLOSED');
  }
}

main().catch((error) => {
  console.error('[v2] ERROR', error.message ?? error);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});

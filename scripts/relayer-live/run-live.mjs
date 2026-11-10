#!/usr/bin/env node
/**
 * MEND live NEP-366 relayer proof.
 *
 * Usage:
 *   node scripts/relayer-live/run-live.mjs --check
 *   node scripts/relayer-live/run-live.mjs
 *   node scripts/relayer-live/run-live.mjs --force
 *
 * What it does (default, once):
 *   1. Builds a real NEP-366 SignedDelegateAction for a testnet sender whose
 *      function-call key is scoped to mend-hub.testnet.
 *   2. Evaluates it through the real @mend/relayer RelayGate (real ed25519
 *      signature verification + live access-key scope).
 *   3. Has mend-relayer.testnet submit it inside a relay transaction.
 *   4. Deliberately submits four negative probes and records the real
 *      rejection errors: replay, wrong receiver, wrong method, expired.
 *
 * The valid action is `create_work_order`, an allowlisted MEND method that
 * creates a DRAFT work order and moves no funds. It is deliberately never
 * funded. No mainnet, no secret printing, no secret copying.
 *
 * --check verifies the committed evidence against live testnet RPC without
 * sending anything. If no evidence exists yet it runs a read-only preflight.
 * Re-running the default command is idempotent: it verifies and skips.
 */

import crypto from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Account,
  JsonRpcProvider,
  KeyPairSigner,
  PublicKey,
  actions,
  buildDelegateAction,
  encodeDelegateAction,
} from 'near-api-js';
import { tsImport } from 'tsx/esm/api';

// ---------------------------------------------------------------------------
// Fixed live-testnet scope
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const RPC_URL = process.env.MEND_RPC_URL ?? 'https://rpc.testnet.fastnear.com';
const NETWORK = 'testnet';
const HUB = 'mend-hub.testnet';
const SENDER = process.env.MEND_RELAYER_SENDER ?? 'mend-coordinator-ai.testnet';
const RELAYER = 'mend-relayer.testnet';
const METHOD = 'create_work_order';
const ASSET_ID = 'BENCH-001';
const SPONSOR = 'mend-sponsor.testnet';
const CONTRACTORS = [
  'mend-contractor-a.testnet',
  'mend-contractor-b.testnet',
  'mend-contractor-c.testnet',
];
const INSPECTORS = ['mend-inspector.testnet', 'mend-inspector-2.testnet'];
const POLICY_HASH = '1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d';
const KEYS_PATH = process.env.MEND_KEYS_PATH ?? '/Volumes/sandisk/Users/dc/.mend/testnet/keys.json';
const SCOPED_PATH =
  process.env.MEND_SCOPED_KEYS_PATH ?? '/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json';
const RESULT_PATH = resolve(HERE, 'live-result.json');
const GAS = 100n * 10n ** 12n; // 100 Tgas, below the relayer's 300 Tgas cap.
const BLOCK_TTL = 100; // below the relayer's 120-block cap.
const WORK_ORDER_PREFIX = 'WO-RELAYER-LIVE';
const WORK_ORDER_SUFFIX_MAX = 99;

// ---------------------------------------------------------------------------
// Real relayer gate (TypeScript workspace package)
// ---------------------------------------------------------------------------

const { RelayGate, createRelayerPolicy, buildRelayTransaction } = await tsImport(
  '../../services/relayer/src/index.ts',
  import.meta.url,
);
const { RELAYABLE_METHODS, WORK_ORDER_ID_PATTERN } = await tsImport('@mend/protocol', import.meta.url);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const FORCE = args.includes('--force');
const HELP = args.includes('--help') || args.includes('-h');

function usage() {
  console.log(`Usage: node scripts/relayer-live/run-live.mjs [--check] [--force]

  (default)  run or verify the live NEP-366 delegate proof
  --check    no writes: verify committed evidence against testnet RPC
  --force    run a fresh proof even when evidence already exists

Network guard: testnet only. Accounts: ${SENDER} -> ${RELAYER} -> ${HUB}.
Secrets are read only from ${KEYS_PATH} and ${SCOPED_PATH};
they are never printed, copied into the repo or committed.`);
}

if (HELP) {
  usage();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Logging and safety helpers
// ---------------------------------------------------------------------------

const SECRET_PATTERN = /ed25519:[1-9A-HJ-NP-Za-km-z]{80,}/g;
const SECRET_FIELD_PATTERN = /"secretKey"\s*:\s*"[^"]+"/g;

function sanitize(value) {
  return String(value)
    .replace(SECRET_PATTERN, 'ed25519:[REDACTED]')
    .replace(SECRET_FIELD_PATTERN, '"secretKey":"[REDACTED]"')
    .replace(/\n\s+at .*/g, '');
}

function log(message) {
  console.log(sanitize(message));
}

function fail(message) {
  console.error(`FAIL ${sanitize(message)}`);
  process.exit(1);
}

function assertTestnet() {
  const host = new URL(RPC_URL).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (!host.includes('testnet') && !local) {
    fail(`mainnet guard: RPC host ${host} is not a testnet host`);
  }
  if (host.includes('mainnet')) fail(`mainnet guard: RPC host ${host}`);
  for (const [label, value] of [
    ['MEND_NEAR_NETWORK', process.env.MEND_NEAR_NETWORK],
    ['NEAR_NETWORK', process.env.NEAR_NETWORK],
  ]) {
    if (value && value !== 'testnet') fail(`mainnet guard: ${label}=${value}`);
  }
  for (const [label, value] of [
    ['hub', HUB],
    ['sender', SENDER],
    ['relayer', RELAYER],
    ['sponsor', SPONSOR],
  ]) {
    if (!value.endsWith('.testnet')) fail(`mainnet guard: ${label} account ${value} is not .testnet`);
  }
  if (!RELAYABLE_METHODS.includes(METHOD)) fail(`method ${METHOD} is not relayable`);
  if (!WORK_ORDER_ID_PATTERN.test(`${WORK_ORDER_PREFIX}-0001`)) fail('work-order id pattern changed');
}

function assertOutsideRepo(path, label) {
  const absolute = resolve(path);
  if (absolute === ROOT || absolute.startsWith(`${ROOT}/`)) {
    fail(`${label} must live outside the repository: ${absolute}`);
  }
  return absolute;
}

function assertPrivateMode(path, label) {
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600) fail(`${label} must be chmod 600 (found ${mode.toString(8)}): ${path}`);
}

function loadPrivateJson(path, label) {
  assertOutsideRepo(path, label);
  if (!existsSync(path)) fail(`${label} does not exist: ${path}`);
  assertPrivateMode(path, label);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${sanitize(error.message)}`);
  }
}

function writeJsonAtomic(path, value) {
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 });
  renameSync(temp, path);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------------------
// RPC helpers (read-only unless a signed transaction is deliberately sent)
// ---------------------------------------------------------------------------

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'mend-relayer-live', method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? body.error.name ?? 'RPC error');
  if (body.result?.error) throw new Error(body.result.error);
  return body.result;
}

async function view(accountId, methodName, callArgs = {}) {
  const result = await rpc('query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: accountId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(callArgs), 'utf8').toString('base64'),
  });
  const text = Buffer.from(result.result ?? [], 'base64').toString('utf8');
  return text.length === 0 ? null : JSON.parse(text);
}

async function viewAccount(accountId) {
  return rpc('query', { request_type: 'view_account', finality: 'final', account_id: accountId });
}

/** Normalizes raw RPC into the shape @mend/relayer expects. */
async function viewAccessKey(accountId, publicKey) {
  const result = await rpc('query', {
    request_type: 'view_access_key',
    finality: 'final',
    account_id: accountId,
    public_key: publicKey,
  });
  return {
    public_key: publicKey,
    access_key: {
      nonce: Number(result.nonce),
      permission: result.permission,
    },
  };
}

async function currentBlockHeight() {
  const block = await rpc('block', { finality: 'final' });
  return block.header.height;
}

async function viewWorkOrder(workOrderId) {
  return view(HUB, 'get_work_order', { work_order_id: workOrderId });
}

// ---------------------------------------------------------------------------
// NEP-366 canonical conversion, signing and verification
// ---------------------------------------------------------------------------

/** near-api-js SignedDelegate -> the canonical shape used by @mend/relayer. */
function toCanonical(signedDelegate) {
  const da = signedDelegate.delegateAction;
  const action = da.actions?.[0];
  if (!action?.functionCall) throw new Error('signed delegate does not contain one function call');
  return {
    delegateAction: {
      senderId: da.senderId,
      receiverId: da.receiverId,
      actions: [
        {
          functionCall: {
            methodName: action.functionCall.methodName,
            args: Buffer.from(action.functionCall.args).toString('base64'),
            gas: BigInt(action.functionCall.gas).toString(),
            deposit: BigInt(action.functionCall.deposit).toString(),
          },
        },
      ],
      nonce: BigInt(da.nonce).toString(),
      maxBlockHeight: Number(da.maxBlockHeight),
      publicKey: da.publicKey.toString(),
    },
    signature: Buffer.from(signedDelegate.signature.data).toString('base64'),
  };
}

/** Canonical shape -> a fresh near-api-js DelegateAction for signature checks. */
function canonicalToNear(canonical) {
  const da = canonical.delegateAction;
  const fc = da.actions[0].functionCall;
  return buildDelegateAction({
    senderId: da.senderId,
    receiverId: da.receiverId,
    actions: [
      actions.functionCall(fc.methodName, Buffer.from(fc.args, 'base64'), BigInt(fc.gas), BigInt(fc.deposit)),
    ],
    nonce: BigInt(da.nonce),
    maxBlockHeight: BigInt(da.maxBlockHeight),
    publicKey: PublicKey.from(da.publicKey),
  });
}

/** Real ed25519 verification over the NEP-366/NEP-461 Borsh hash. */
function verifyCanonicalDelegate(canonical) {
  try {
    const delegateAction = canonicalToNear(canonical);
    const hash = crypto.createHash('sha256').update(Buffer.from(encodeDelegateAction(delegateAction))).digest();
    const signature = Buffer.from(canonical.signature, 'base64');
    if (signature.length !== 64) return false;
    return PublicKey.from(canonical.delegateAction.publicKey).verify(hash, signature);
  } catch {
    return false;
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

/** Human-readable failure summary that keeps the NEP-366 error variant names. */
function describeFailure(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(describeFailure).filter(Boolean).join(' | ');
  if (typeof value !== 'object') return String(value);
  const parts = [];
  for (const [key, item] of Object.entries(value)) {
    if (item === null || item === undefined) {
      parts.push(key);
    } else if (typeof item === 'object') {
      const nested = describeFailure(item);
      parts.push(nested ? `${key}(${nested})` : key);
    } else {
      parts.push(`${key}=${item}`);
    }
  }
  return parts.join(' ');
}

/** Reads top-level and receipt failures, not just the outer transaction status. */
function analyzeExecution(result) {
  const failures = [];
  if (result?.status && typeof result.status === 'object' && 'Failure' in result.status) {
    failures.push(result.status.Failure);
  }
  for (const receipt of result?.receipts_outcome ?? []) {
    const status = receipt?.outcome?.status;
    if (status && typeof status === 'object' && 'Failure' in status) failures.push(status.Failure);
  }
  const logs = (result?.receipts_outcome ?? []).flatMap((receipt) => receipt?.outcome?.logs ?? []);
  const described = [...new Set(failures.map(describeFailure).filter(Boolean).map(sanitize))];
  return {
    hash: txHash(result),
    success: failures.length === 0,
    error: described.join(' || ').slice(0, 1600) || (failures.length ? JSON.stringify(failures[0]).slice(0, 1600) : null),
    logs,
  };
}

async function submitDelegate(relayerAccount, signedDelegate) {
  try {
    const result = await relayerAccount.signAndSendTransaction({
      receiverId: signedDelegate.delegateAction.senderId,
      actions: [actions.signedDelegate(signedDelegate)],
      waitUntil: 'FINAL',
      throwOnFailure: false,
    });
    return analyzeExecution(result);
  } catch (error) {
    const transactionResult = error?.transactionResult;
    if (transactionResult) {
      const analyzed = analyzeExecution(transactionResult);
      if (analyzed.hash) return analyzed;
    }
    return {
      hash: error?.transactionHash ?? null,
      success: false,
      error: sanitize(error?.message ?? error),
      logs: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Delegate builders
// ---------------------------------------------------------------------------

async function findNextWorkOrder() {
  for (let index = 1; index <= WORK_ORDER_SUFFIX_MAX; index += 1) {
    const id = `${WORK_ORDER_PREFIX}-${String(index).padStart(4, '0')}`;
    if (!WORK_ORDER_ID_PATTERN.test(id)) fail(`generated invalid work-order id: ${id}`);
    const existing = await viewWorkOrder(id);
    if (!existing) return { id, index };
  }
  fail(`no free ${WORK_ORDER_PREFIX}-NNNN id in 1..${WORK_ORDER_SUFFIX_MAX}`);
}

function createWorkOrderArgs(workOrderId, index) {
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  return {
    work_order_id: workOrderId,
    asset_id: ASSET_ID,
    cluster_hash: sha256Hex('mend.relayer-live.cluster.v1'),
    scope_hash: sha256Hex(`mend.relayer-live.scope.${index}`),
    dao_proposal_id: `relayer-live-${String(index).padStart(4, '0')}`,
    policy_hash: POLICY_HASH,
    budget: '100000000',
    sponsor: SPONSOR,
    contractor_roster: CONTRACTORS,
    inspector_roster: INSPECTORS,
    // near-sdk u64 fields are JSON numbers, not quoted strings. Use rawJSON so
    // the value is serialized exactly once and never loses precision.
    commit_deadline: JSON.rawJSON((nowNs + 7_200_000_000_000n).toString()), // +2h
    reveal_deadline: JSON.rawJSON((nowNs + 14_400_000_000_000n).toString()), // +4h
  };
}

async function buildSignedDelegate(senderAccount, senderSigner, options) {
  const { receiverId, methodName, callArgs, maxBlockHeight } = options;
  if (maxBlockHeight !== undefined) {
    const publicKey = await senderSigner.getPublicKey();
    const [accessKey, block] = await Promise.all([
      senderAccount.getAccessKey(publicKey),
      senderAccount.provider.viewBlock({ finality: 'final' }),
    ]);
    const delegateAction = buildDelegateAction({
      senderId: SENDER,
      receiverId,
      actions: [
        actions.functionCall(methodName, Buffer.from(JSON.stringify(callArgs)), GAS, 0n),
      ],
      nonce: BigInt(accessKey.nonce) + 1n,
      maxBlockHeight: BigInt(maxBlockHeight ?? block.header.height),
      publicKey,
    });
    const { signedDelegate } = await senderSigner.signDelegateAction(delegateAction);
    return signedDelegate;
  }
  const { signedDelegate } = await senderAccount.createSignedMetaTransaction({
    receiverId,
    actions: [actions.functionCall(methodName, Buffer.from(JSON.stringify(callArgs)), GAS, 0n)],
    blockHeightTtl: BLOCK_TTL,
    signer: senderSigner,
  });
  return signedDelegate;
}

// ---------------------------------------------------------------------------
// Gate helpers
// ---------------------------------------------------------------------------

function gateContext(accessKey, blockHeight) {
  return {
    currentBlockHeight: blockHeight,
    now: Date.now(),
    accessKey,
    signatureVerifier: { verify: verifyCanonicalDelegate },
  };
}

function tryGate(gate, canonical, context) {
  try {
    return { ok: true, decision: gate.evaluate(canonical, context) };
  } catch (error) {
    return {
      ok: false,
      code: error?.code ?? 'UNKNOWN',
      message: sanitize(error?.message ?? error),
    };
  }
}

// ---------------------------------------------------------------------------
// Preflight (read-only)
// ---------------------------------------------------------------------------

async function preflight() {
  assertTestnet();

  const keys = loadPrivateJson(KEYS_PATH, 'keys file');
  const scoped = loadPrivateJson(SCOPED_PATH, 'scoped-keys file');

  const relayerEntry = keys[RELAYER];
  if (!relayerEntry?.secretKey) fail(`keys file has no ${RELAYER} secret`);
  if (relayerEntry.network && relayerEntry.network !== NETWORK) {
    fail(`relayer key network is ${relayerEntry.network}`);
  }

  if (scoped.network !== NETWORK) fail(`scoped key file network is ${scoped.network}`);
  if (scoped.hubAccount !== HUB) fail(`scoped key file hub is ${scoped.hubAccount}`);

  const senderEntry = scoped.accounts?.[SENDER];
  if (!senderEntry?.secretKey) fail(`scoped key file has no ${SENDER} secret`);
  if (senderEntry.receiverId !== HUB) fail(`${SENDER} scoped key receiver is ${senderEntry.receiverId}`);
  if (!Array.isArray(senderEntry.methodNames) || !senderEntry.methodNames.includes(METHOD)) {
    fail(`${SENDER} scoped key does not allow ${METHOD}`);
  }

  const accessKey = await viewAccessKey(SENDER, senderEntry.publicKey);
  if (accessKey.access_key.permission === 'FullAccess') fail(`${SENDER} key is full access`);
  const fc = accessKey.access_key.permission?.FunctionCall;
  if (!fc) fail(`${SENDER} key is not a function-call key`);
  if (fc.receiver_id !== HUB) fail(`${SENDER} key is scoped to ${fc.receiver_id}`);
  if (!fc.method_names?.includes(METHOD)) fail(`${SENDER} key does not allow ${METHOD}`);
  if (fc.allowance === null) fail(`${SENDER} key has unlimited allowance`);

  const relayerAccount = await viewAccount(RELAYER);
  if (BigInt(relayerAccount.amount) <= 0n) fail(`${RELAYER} has no NEAR for gas`);

  const asset = await view(HUB, 'get_asset', { asset_id: ASSET_ID });
  if (!asset) fail(`asset ${ASSET_ID} does not exist on ${HUB}`);

  const config = await view(HUB, 'get_config');
  if (config.paused) fail(`${HUB} is paused`);

  log(
    `PASS preflight sender=${SENDER} key=${senderEntry.publicKey} receiver=${fc.receiver_id} ` +
      `methods=${fc.method_names.join(',')} allowance=${fc.allowance} ` +
      `relayer=${RELAYER} relayer_balance_yocto=${relayerAccount.amount} asset=${ASSET_ID}`,
  );

  return { keys, scoped, senderEntry, relayerEntry, accessKey, config };
}

// ---------------------------------------------------------------------------
// Evidence verification (read-only)
// ---------------------------------------------------------------------------

async function verifyEvidence(evidence) {
  assertTestnet();
  if (evidence.network !== NETWORK || evidence.hubAccount !== HUB) {
    fail(`evidence network/hub mismatch: ${evidence.network}/${evidence.hubAccount}`);
  }
  if (!evidence.valid?.txHash) fail('evidence has no valid transaction hash');
  if (!Array.isArray(evidence.rejections) || evidence.rejections.length < 3) {
    fail('evidence does not contain the three required rejection probes');
  }

  const validRaw = await rpc('tx', {
    tx_hash: evidence.valid.txHash,
    sender_account_id: RELAYER,
    wait_until: 'FINAL',
  });
  const valid = analyzeExecution(validRaw);
  if (!valid.success) fail(`recorded valid transaction does not resolve as success: ${valid.error}`);
  log(`PASS evidence valid tx=${evidence.valid.txHash} method=${evidence.method} status=success`);

  const workOrder = await viewWorkOrder(evidence.workOrderId);
  if (!workOrder) fail(`recorded work order ${evidence.workOrderId} does not exist`);
  const escrow = await view(HUB, 'get_escrow', { work_order_id: evidence.workOrderId });
  if (!escrow || escrow.funding !== '0' || escrow.escrowed !== '0') {
    fail(`recorded work order is funded; the no-funds claim no longer holds: ${JSON.stringify(escrow)}`);
  }
  log(
    `PASS evidence work_order=${evidence.workOrderId} status=${workOrder.status} ` +
      `proposedBy=${workOrder.proposedBy} budget=${workOrder.budget} ` +
      `escrow_funding=${escrow.funding} escrow_escrowed=${escrow.escrowed}`,
  );

  for (const rejection of evidence.rejections) {
    if (!rejection.txHash) {
      if (!rejection.error) fail(`rejection ${rejection.kind} has neither a hash nor an error`);
      log(`PASS evidence rejection kind=${rejection.kind} tx=none recorded_error="${rejection.error.slice(0, 220)}"`);
      continue;
    }
    const raw = await rpc('tx', {
      tx_hash: rejection.txHash,
      sender_account_id: RELAYER,
      wait_until: 'FINAL',
    });
    const analyzed = analyzeExecution(raw);
    if (analyzed.success) fail(`recorded ${rejection.kind} rejection unexpectedly succeeded: ${rejection.txHash}`);
    log(
      `PASS evidence rejection kind=${rejection.kind} tx=${rejection.txHash} ` +
        `error="${(analyzed.error ?? rejection.error ?? 'unrecorded').slice(0, 220)}"`,
    );
  }

  const keys = evidence.rejections.map((rejection) => rejection.kind).sort().join(',');
  const required = ['expired', 'replay', 'wrong-method', 'wrong-receiver'];
  if (!required.every((kind) => keys.includes(kind))) fail(`missing rejection kinds: have ${keys}`);
  log(`SUMMARY check passed valid=1 rejections=${evidence.rejections.length}`);
}

// ---------------------------------------------------------------------------
// Live proof
// ---------------------------------------------------------------------------

async function runLive() {
  if (existsSync(RESULT_PATH) && !FORCE) {
    log(`SKIP live proof already recorded at ${relative(ROOT, RESULT_PATH)}; verifying (use --force to run again)`);
    const evidence = JSON.parse(readFileSync(RESULT_PATH, 'utf8'));
    await verifyEvidence(evidence);
    return;
  }

  const { senderEntry, relayerEntry } = await preflight();

  const provider = new JsonRpcProvider({ url: RPC_URL });
  const senderSigner = KeyPairSigner.fromSecretKey(senderEntry.secretKey);
  const senderAccount = new Account(SENDER, provider, senderSigner);
  const relayerAccount = new Account(RELAYER, provider, relayerEntry.secretKey);

  const policy = createRelayerPolicy({
    hubAccount: HUB,
    allowedSenders: [SENDER],
    allowedMethods: [METHOD],
    maxBlockTtl: 120,
    requireSignature: true,
    requireScopedKey: true,
  });
  const gate = new RelayGate(policy);

  const { id: workOrderId, index } = await findNextWorkOrder();
  const args = createWorkOrderArgs(workOrderId, index);
  const expiredWorkOrderId = `${WORK_ORDER_PREFIX}-EXPIRE-${String(index).padStart(4, '0')}`;
  if (!WORK_ORDER_ID_PATTERN.test(expiredWorkOrderId)) fail(`invalid expired probe id ${expiredWorkOrderId}`);

  // ----- Valid delegate -----------------------------------------------------
  const validSigned = await buildSignedDelegate(senderAccount, senderSigner, {
    receiverId: HUB,
    methodName: METHOD,
    callArgs: args,
  });
  const validCanonical = toCanonical(validSigned);
  const validAccessKey = await viewAccessKey(SENDER, senderEntry.publicKey);
  const validBlockHeight = await currentBlockHeight();
  const validGate = tryGate(gate, validCanonical, gateContext(validAccessKey, validBlockHeight));
  if (!validGate.ok) {
    fail(`gate rejected the valid delegate: ${validGate.code} ${validGate.message}`);
  }
  const decision = validGate.decision;
  log(
    `GATE PASS delegateHash=${decision.delegateHash} sender=${decision.senderId} receiver=${decision.receiverId} ` +
      `method=${decision.method} workOrder=${decision.workOrderId} signatureVerified=${decision.signatureVerified} ` +
      `keyScoped=${decision.keyScoped}`,
  );

  const relayShape = buildRelayTransaction(validCanonical, RELAYER);
  if (relayShape.receiverId !== SENDER || relayShape.actions.length !== 1) {
    fail('relay transaction shape is not the NEP-366 sender envelope');
  }

  log(`TX submit valid method=${METHOD} sender=${SENDER} relayer=${RELAYER} workOrder=${workOrderId}`);
  const validRun = await submitDelegate(relayerAccount, validSigned);
  if (!validRun.success) {
    fail(
      `valid delegate did not execute: hash=${validRun.hash ?? 'none'} ` +
        `error=${validRun.error ?? 'unknown failure'} logs=${validRun.logs.slice(0, 6).join(' | ')}`,
    );
  }
  if (!validRun.hash) fail('valid delegate returned no transaction hash');
  log(`TX valid hash=${validRun.hash} status=success`);

  let workOrder = null;
  for (let attempt = 0; attempt < 20 && !workOrder; attempt += 1) {
    workOrder = await viewWorkOrder(workOrderId);
    if (!workOrder) await sleep(1500);
  }
  if (!workOrder) fail(`work order ${workOrderId} was not created by the relayed call`);
  if (workOrder.proposedBy !== SENDER) fail(`work order proposedBy is ${workOrder.proposedBy}`);
  if (workOrder.status !== 'DRAFT') fail(`work order status is ${workOrder.status}, expected DRAFT`);
  const escrow = await view(HUB, 'get_escrow', { work_order_id: workOrderId });
  if (!escrow || escrow.funding !== '0' || escrow.escrowed !== '0') {
    fail(`relayed work order unexpectedly holds funds: ${JSON.stringify(escrow)}`);
  }
  log(
    `VIEW work_order=${workOrderId} status=${workOrder.status} proposedBy=${workOrder.proposedBy} ` +
      `budget=${workOrder.budget} escrow_funding=${escrow.funding} escrow_escrowed=${escrow.escrowed}`,
  );

  // ----- Negative probes ----------------------------------------------------
  const rejections = [];

  async function recordRejection(kind, signed, gateExpectation) {
    const canonical = toCanonical(signed);
    const accessKey = await viewAccessKey(SENDER, senderEntry.publicKey);
    const blockHeight = await currentBlockHeight();
    const gateResult = tryGate(gate, canonical, gateContext(accessKey, blockHeight));
    if (gateResult.ok) fail(`gate unexpectedly accepted ${kind} probe`);
    if (gateExpectation && gateResult.code !== gateExpectation) {
      log(`NOTE gate ${kind} code=${gateResult.code} (expected ${gateExpectation}) message="${gateResult.message}"`);
    }
    log(`GATE rejection kind=${kind} code=${gateResult.code} message="${gateResult.message}"`);

    const run = await submitDelegate(relayerAccount, signed);
    if (run.success) fail(`chain unexpectedly accepted ${kind} probe: ${run.hash}`);
    log(
      `TX rejection kind=${kind} hash=${run.hash ?? 'none'} error="${(run.error ?? 'recorded by RPC').slice(0, 300)}"`,
    );
    rejections.push({
      kind,
      txHash: run.hash,
      error: run.error,
      gateCode: gateResult.code,
      gateMessage: gateResult.message,
    });
  }

  // Replay: the exact same signed delegate, after its nonce has been consumed.
  await recordRejection('replay', validSigned, 'RELAYER_REPLAY');

  // Wrong receiver: a valid signature that points at the token contract.
  const wrongReceiverSigned = await buildSignedDelegate(senderAccount, senderSigner, {
    receiverId: 'mend-usdc.testnet',
    methodName: METHOD,
    callArgs: createWorkOrderArgs(`${WORK_ORDER_PREFIX}-WRONG-${String(index).padStart(4, '0')}`, index),
  });
  await recordRejection('wrong-receiver', wrongReceiverSigned, 'RELAYER_TARGET_NOT_ALLOWED');

  // Wrong method: a valid signature for a method the scoped key does not allow.
  const wrongMethodSigned = await buildSignedDelegate(senderAccount, senderSigner, {
    receiverId: HUB,
    methodName: 'accept_completion',
    callArgs: { work_order_id: workOrderId },
  });
  await recordRejection('wrong-method', wrongMethodSigned, 'RELAYER_METHOD_NOT_ALLOWED');

  // Expired: the max block height is already behind the current chain height.
  const expiredSigned = await buildSignedDelegate(senderAccount, senderSigner, {
    receiverId: HUB,
    methodName: METHOD,
    callArgs: createWorkOrderArgs(expiredWorkOrderId, index),
    maxBlockHeight: (await currentBlockHeight()) - 1,
  });
  await recordRejection('expired', expiredSigned, 'VALIDATION_ERROR');

  // ----- Evidence -----------------------------------------------------------
  const evidence = {
    schema: 'mend.relayer-live.v1',
    network: NETWORK,
    rpcUrl: RPC_URL,
    hubAccount: HUB,
    senderAccount: SENDER,
    senderPublicKey: senderEntry.publicKey,
    relayerAccount: RELAYER,
    method: METHOD,
    workOrderId,
    generatedAt: new Date().toISOString(),
    valid: {
      txHash: validRun.hash,
      success: true,
      logs: validRun.logs.slice(0, 40),
    },
    gate: {
      delegateHash: decision.delegateHash,
      receiverId: decision.receiverId,
      method: decision.method,
      workOrderId: decision.workOrderId,
      signatureVerified: decision.signatureVerified,
      keyScoped: decision.keyScoped,
    },
    workOrder: {
      id: workOrderId,
      status: workOrder.status,
      proposedBy: workOrder.proposedBy,
      budget: workOrder.budget,
      escrow,
    },
    rejections,
  };
  writeJsonAtomic(RESULT_PATH, evidence);
  log(`EVIDENCE ${relative(ROOT, RESULT_PATH)}`);
  log(`SUMMARY live proof valid=1 rejections=${rejections.length} workOrder=${workOrderId}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  assertTestnet();
  if (CHECK_ONLY) {
    if (existsSync(RESULT_PATH)) {
      const evidence = JSON.parse(readFileSync(RESULT_PATH, 'utf8'));
      await verifyEvidence(evidence);
    } else {
      await preflight();
      log('SUMMARY check passed preflight-only valid=0 rejections=0 (run without --check for the live proof)');
    }
  } else {
    await runLive();
  }
} catch (error) {
  fail(error?.message ?? error);
}

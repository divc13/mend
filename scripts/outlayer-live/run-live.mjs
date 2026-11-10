#!/usr/bin/env node
/**
 * MEND — live OutLayer testnet publish/execute driver and evidence checker.
 *
 * Usage:
 *   node scripts/outlayer-live/run-live.mjs --build
 *   node scripts/outlayer-live/run-live.mjs --publish
 *   node scripts/outlayer-live/run-live.mjs --execute
 *   node scripts/outlayer-live/run-live.mjs --verify
 *   node scripts/outlayer-live/run-live.mjs --all
 *   node scripts/outlayer-live/run-live.mjs --check     # PASS | BLOCKED, no writes
 *   node scripts/outlayer-live/run-live.mjs --doc       # regenerate LIVE-OUTLAY.md
 *
 * Safety:
 *   - refuses mainnet: every account id must end in `.testnet`, the RPC URL must
 *     contain `testnet`, and the key metadata must say `testnet`
 *   - signing keys are read from MEND_TESTNET_KEYS_FILE only and are never
 *     printed, copied into evidence, or committed
 *   - the WASM is only ever requested with an explicit version key = sha256
 *   - this script never claims a TEE execution that did not happen: every
 *     "verified" claim in the output is derived from a live attestation record
 *
 * Tools used:
 *   cargo (wasm32-wasip1 build), node:wasi (local deterministic run),
 *   NEAR JSON-RPC, OutLayer testnet REST API, FastFS (`__fastdata_fastfs`).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  Account,
  JsonRpcProvider,
  KeyPairSigner,
  actions,
} from 'near-api-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const INFRA = path.join(ROOT, 'infra/outlayer-live');
const EVIDENCE_DIR = path.join(INFRA, 'evidence');
const STATE_PATH = path.join(INFRA, 'live-state.json');
const DOC_PATH = path.join(INFRA, 'LIVE-OUTLAY.md');

const MANIFEST = path.join(ROOT, 'compute/bid-rules/Cargo.toml');
const WASM_REL = 'compute/bid-rules/target/wasm32-wasip1/release/mend-bid-rules.wasm';
const WASM_PATH = path.join(ROOT, WASM_REL);
const ARTIFACT_RECORD = path.join(ROOT, 'compute/bid-rules/artifacts/wasm-sha256.json');
const BUILD_LOG = path.join(ROOT, 'compute/bid-rules/artifacts/build.txt');

const FIXTURE_IN = path.join(ROOT, 'fixtures/recorded-responses/bid-rules/canonical-input.json');
const FIXTURE_OUT = path.join(ROOT, 'fixtures/recorded-responses/bid-rules/canonical-output.json');

const NETWORK = 'testnet';
const OUTLAYER_ACCOUNT = 'outlayer.testnet';
const WORKER_ACCOUNT = 'worker.outlayer.testnet';
const API_BASE = process.env.OUTLAYER_API_BASE || 'https://testnet-api.outlayer.ai';
const RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const FASTFS_HOST = 'test.fastfs.io';
const FASTFS_RECEIVER = OUTLAYER_ACCOUNT;
const BUILD_TARGET = 'wasm32-wasip1';
const EXPLORER = 'https://explorer.testnet.near.org';

const OWNER = process.env.MEND_OUTLAYER_OWNER || 'mend-deployer.testnet';
const PROJECT_NAME = process.env.MEND_OUTLAYER_PROJECT || 'bid-rules';
const PROJECT_ID = `${OWNER}/${PROJECT_NAME}`;
/** The canonical id from the research doc; only usable if MEND controls the account. */
const CANONICAL_PROJECT_ID = 'mend.testnet/bid-rules';

const TGAS = 10n ** 12n;
const GAS_UPLOAD = 1n; // FastFS uploads intentionally run out of gas
const GAS_CREATE = 100n * TGAS;
const GAS_REQUEST = 300n * TGAS;
const DEPOSIT_CREATE = 50_000_000_000_000_000_000_000n; // 0.05 NEAR, excess refunded
const DEPOSIT_REQUEST = 4_000_000_000_000_000_000_000n; // 0.004 NEAR, excess refunded

const LIMITS = {
  max_instructions: 5_000_000_000,
  max_memory_mb: 128,
  max_execution_seconds: 10,
};

const POLICY_HASH = '1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d';
const EXPECTED_WINNER = 'BID-B-BENCH-001';
const EXPECTED_PROTOCOL_INPUT_HASH = 'b06906891107bc8171b2a99c6b561fd31e917cf54368e8ac5363028d4c583244';
const EXPECTED_PROTOCOL_OUTPUT_HASH = '905950627b0c7b870fdfc96034f1168bd4654cd6497d443debe6162e6efef134';

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const nowIso = () => new Date().toISOString();
const short = (s, n = 10) => (typeof s === 'string' && s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-n)}` : s);

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function section(title) {
  process.stdout.write(`\n== ${title}\n`);
}

function fail(msg) {
  process.stderr.write(`\nFATAL: ${msg}\n`);
  process.exit(1);
}

function readJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);
}

function writeIfChanged(p, text) {
  let prev = null;
  try {
    prev = fs.readFileSync(p, 'utf8');
  } catch {
    /* new file */
  }
  if (prev === text) return false;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return true;
}

function loadState() {
  return readJson(STATE_PATH, {
    schema: 'mend.outlayer-live.state.v1',
    network: NETWORK,
    outlayerAccount: OUTLAYER_ACCOUNT,
    apiBase: API_BASE,
    requestedProjectId: CANONICAL_PROJECT_ID,
    projectId: PROJECT_ID,
    owner: OWNER,
  });
}

function saveState(state) {
  state.updatedAt = nowIso();
  writeJson(STATE_PATH, state);
}

function assertTestnetAccount(id) {
  if (typeof id !== 'string' || !id.endsWith('.testnet')) {
    fail(`refusing non-testnet account id: ${id}`);
  }
}

function assertNoSecrets(text, where) {
  if (/"secretKey"|"secret_key"|"seedPhrase"|"seed_phrase"|"privateKey"|ed25519:[1-9A-HJ-NP-Za-km-z]{40,}/.test(text)) {
    fail(`refusing to write ${where}: it looks like it contains a secret`);
  }
}

// ---------------------------------------------------------------------------
// Signing keys (never printed)
// ---------------------------------------------------------------------------

const KEYS_FILE =
  process.env.MEND_TESTNET_KEYS_FILE || '/Volumes/sandisk/Users/dc/.mend/testnet/keys.json';

const provider = new JsonRpcProvider({ url: RPC_URL });

function loadSigner(accountId) {
  assertTestnetAccount(accountId);
  if (!fs.existsSync(KEYS_FILE)) fail(`keys file not found: ${KEYS_FILE} (set MEND_TESTNET_KEYS_FILE)`);
  const keys = readJson(KEYS_FILE);
  const entry = keys[accountId];
  if (!entry || !entry.secretKey) fail(`no signing key for ${accountId} in MEND_TESTNET_KEYS_FILE`);
  if (entry.network && entry.network !== NETWORK) fail(`key for ${accountId} is for network ${entry.network}`);
  const signer = KeyPairSigner.fromSecretKey(entry.secretKey);
  return new Account(accountId, provider, signer);
}

// ---------------------------------------------------------------------------
// Chain reads
// ---------------------------------------------------------------------------

async function viewFunction(accountId, method, args = {}) {
  const raw = await provider.callFunctionRaw({ contractId: accountId, method, args });
  const bytes = Buffer.isBuffer(raw)
    ? raw
    : raw instanceof Uint8Array
      ? Buffer.from(raw)
      : Array.isArray(raw?.result)
        ? Buffer.from(raw.result)
        : raw == null
          ? Buffer.from('null')
          : Buffer.from(JSON.stringify(raw));
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return bytes.toString('utf8');
  }
}

async function viewAccount(accountId) {
  try {
    return await provider.viewAccount({ accountId });
  } catch (err) {
    if (/does not exist|UNKNOWN_ACCOUNT/i.test(String(err))) return null;
    throw err;
  }
}

async function sendTx(account, { receiverId, method, args = {}, gas, deposit = 0n }) {
  assertTestnetAccount(receiverId);
  const signed = await account.createSignedTransaction({
    receiverId,
    actions: [
      actions.functionCall(
        method,
        Buffer.from(JSON.stringify(args)),
        gas,
        deposit,
      ),
    ],
  });
  const outcome = await provider.sendTransactionUntil(signed, 'FINAL');
  return outcome;
}

function txHashOf(outcome) {
  return outcome?.transaction_outcome?.id ?? outcome?.transaction?.hash ?? null;
}

function txStatusOf(outcome) {
  const status = outcome?.status;
  if (!status) return { ok: false, kind: 'unknown' };
  if (typeof status === 'object' && status !== null && 'SuccessValue' in status) {
    return {
      ok: true,
      kind: 'SuccessValue',
      value: Buffer.from(status.SuccessValue, 'base64').toString('utf8'),
    };
  }
  return { ok: false, kind: JSON.stringify(status) };
}

function logsOf(outcome) {
  const out = [];
  for (const r of outcome?.receipts_outcome ?? []) {
    for (const line of r?.outcome?.logs ?? []) out.push(line);
  }
  return out;
}

function eventLogs(outcome, eventName) {
  const found = [];
  for (const line of logsOf(outcome)) {
    const idx = line.indexOf('EVENT_JSON:');
    if (idx < 0) continue;
    let parsed;
    try {
      parsed = JSON.parse(line.slice(idx + 'EVENT_JSON:'.length));
    } catch {
      continue;
    }
    if (parsed.event === eventName) found.push(parsed);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Network snapshot (context for the evidence package)
// ---------------------------------------------------------------------------

async function captureNetworkSnapshot() {
  section('network snapshot (testnet)');
  const snap = { schema: 'mend.outlayer-live.network.v1', capturedAt: nowIso(), rpc: RPC_URL, api: API_BASE };
  try {
    const res = await fetch(`${API_BASE}/health`);
    snap.health = { status: res.status, body: await res.json() };
  } catch (err) {
    snap.health = { error: err.message };
  }
  try {
    const res = await fetch(`${API_BASE}/public/pricing`);
    snap.pricing = { status: res.status, body: await res.json() };
  } catch (err) {
    snap.pricing = { error: err.message };
  }
  try {
    const res = await fetch(`${API_BASE}/public/stats`);
    snap.stats = { status: res.status, body: await res.json() };
  } catch (err) {
    snap.stats = { error: err.message };
  }
  try {
    snap.contract = {
      paused: await viewFunction(OUTLAYER_ACCOUNT, 'is_paused', {}),
      config: await viewFunction(OUTLAYER_ACCOUNT, 'get_config', {}),
      maxLimits: await viewFunction(OUTLAYER_ACCOUNT, 'get_max_limits', {}),
      eventMetadata: await viewFunction(OUTLAYER_ACCOUNT, 'get_event_metadata', {}),
      estimate: await viewFunction(OUTLAYER_ACCOUNT, 'estimate_execution_cost', {
        resource_limits: LIMITS,
        input_len: fs.readFileSync(FIXTURE_IN).length,
      }),
    };
  } catch (err) {
    snap.contract = { error: err.message };
  }
  writeJson(path.join(EVIDENCE_DIR, 'network.json'), snap);
  log(`  health:  ${JSON.stringify(snap.health?.body ?? snap.health?.error)}`);
  log(`  paused:  ${snap.contract?.paused}`);
  log(`  saved:   ${path.relative(ROOT, path.join(EVIDENCE_DIR, 'network.json'))}`);
  return snap;
}

// ---------------------------------------------------------------------------
// Build + local deterministic run
// ---------------------------------------------------------------------------

function buildWasm() {
  section('build wasm32-wasip1');
  fs.mkdirSync(path.dirname(WASM_PATH), { recursive: true });
  const res = spawnSync(
    'cargo',
    ['build', '--manifest-path', MANIFEST, '--target', BUILD_TARGET, '--release'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (res.status !== 0) fail(`cargo build failed:\n${res.stdout}\n${res.stderr}`);
  const bytes = fs.readFileSync(WASM_PATH);
  const hash = sha256(bytes);
  const rustc = spawnSync('rustc', ['--version'], { encoding: 'utf8' }).stdout.trim();
  log(`  artifact: ${WASM_REL}`);
  log(`  size:     ${bytes.length} bytes`);
  log(`  sha256:   ${hash}`);
  log(`  rustc:    ${rustc}`);

  const record = {
    schema: 'mend.outlayer-live.wasm-sha256.v1',
    artifact: WASM_REL,
    buildTarget: BUILD_TARGET,
    buildCommand: `cargo build --manifest-path compute/bid-rules/Cargo.toml --target ${BUILD_TARGET} --release`,
    toolchain: rustc,
    sizeBytes: bytes.length,
    sha256: hash,
    recordedAt: nowIso(),
  };
  writeIfChanged(ARTIFACT_RECORD, `${JSON.stringify(record, null, 2)}\n`);

  const state = loadState();
  state.build = {
    target: BUILD_TARGET,
    toolchain: rustc,
    wasmPath: WASM_REL,
    sizeBytes: bytes.length,
    wasmSha256: hash,
    artifactRecord: path.relative(ROOT, ARTIFACT_RECORD),
  };
  saveState(state);
  return { hash, size: bytes.length, rustc };
}

async function runWasiLocal(inputBytes) {
  const { WASI } = await import('node:wasi');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mend-wasi-'));
  const inPath = path.join(tmp, 'stdin.json');
  const outPath = path.join(tmp, 'stdout.json');
  fs.writeFileSync(inPath, inputBytes);
  const outFd = fs.openSync(outPath, 'w');
  const inFd = fs.openSync(inPath, 'r');
  const wasi = new WASI({ version: 'preview1', args: [], env: {}, stdin: inFd, stdout: outFd, stderr: 2 });
  const module = new WebAssembly.Module(fs.readFileSync(WASM_PATH));
  const instance = new WebAssembly.Instance(module, wasi.getImportObject());
  try {
    wasi.start(instance);
  } finally {
    fs.closeSync(outFd);
    fs.closeSync(inFd);
  }
  const out = fs.readFileSync(outPath);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

/**
 * OutLayer hashes `serde_json::Value::to_string()` of the parsed stdout, not the
 * raw bytes (worker/src/main.rs). serde_json's map is a BTreeMap, so the
 * preimage is compact JSON with lexicographically sorted keys. Reproduce that
 * so the attestation output_hash can be checked byte-for-byte.
 */
function canonicalJson(value) {
  const sortKeys = (v) =>
    Array.isArray(v)
      ? v.map(sortKeys)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
        : v;
  return JSON.stringify(sortKeys(value));
}

async function localDeterminismCheck({ persist = true } = {}) {
  section('local deterministic run (node:wasi preview1)');
  if (!fs.existsSync(WASM_PATH)) fail(`wasm not built: ${WASM_REL} (run --build)`);
  const inputBytes = fs.readFileSync(FIXTURE_IN);
  const fixtureOutBytes = fs.readFileSync(FIXTURE_OUT);
  const stdout = await runWasiLocal(inputBytes);
  const stdoutHash = sha256(stdout);
  const fixtureText = fixtureOutBytes.toString('utf8');
  const stdoutText = stdout.toString('utf8');

  let outJson;
  try {
    outJson = JSON.parse(stdoutText);
  } catch {
    fail('WASI binary did not emit valid JSON');
  }
  const fixtureJson = JSON.parse(fixtureText);

  // OutLayer hashes `serde_json::Value::to_string()` of the parsed stdout, not
  // the raw bytes (worker/src/main.rs). serde_json's map is a BTreeMap, so the
  // preimage is compact JSON with lexicographically sorted keys. Reproduce that
  // here so the attestation output_hash can be checked byte-for-byte.
  const overlayerOutputPreimage = canonicalJson(outJson);
  const overlayerOutputHash = sha256(Buffer.from(overlayerOutputPreimage, 'utf8'));

  const semanticEqual = JSON.stringify(outJson) === JSON.stringify(fixtureJson);
  const checks = {
    inputSha256: sha256(inputBytes),
    inputBytes: inputBytes.length,
    fixtureOutputFileSha256: sha256(fixtureOutBytes),
    fixtureOutputFileBytes: fixtureOutBytes.length,
    localStdoutSha256: stdoutHash,
    localStdoutBytes: stdout.length,
    stdoutEqualsFixtureBytes: stdoutText === fixtureText,
    stdoutSemanticallyEqualsFixture: semanticEqual,
    canonicalOutputSha256: overlayerOutputHash,
    canonicalOutputBytes: Buffer.byteLength(overlayerOutputPreimage),
    canonicalOutputRule:
      'sha256(compact JSON, keys sorted) — matches worker/src/main.rs sha256(serde_json::Value::to_string())',
    winnerBidId: outJson.winnerBidId,
    protocolInputHash: outJson.inputHash,
    protocolOutputHash: outJson.outputHash,
    singleResumePayloadLimitBytes: 1024,
    exceedsSingleResumeLimit: stdout.length > 1024,
  };
  log(`  stdout sha256:       ${stdoutHash} (${stdout.length} bytes)`);
  log(`  OutLayer output hash:${overlayerOutputHash} (sorted-key JSON, ${checks.canonicalOutputBytes} bytes)`);
  log(`  fixture file sha256: ${checks.fixtureOutputFileSha256} (pretty-printed)`);
  log(`  winner:              ${checks.winnerBidId}`);
  log(`  protocol inputHash:  ${checks.protocolInputHash}`);
  log(`  protocol outputHash: ${checks.protocolOutputHash}`);
  log(`  stdout == fixture (semantic): ${semanticEqual}`);
  log(`  output > 1024-byte single-resume limit: ${checks.exceedsSingleResumeLimit}`);
  if (!semanticEqual) fail('WASI output does not match the canonical fixture');
  if (checks.winnerBidId !== EXPECTED_WINNER) fail(`unexpected winner ${checks.winnerBidId}`);
  if (checks.protocolInputHash !== EXPECTED_PROTOCOL_INPUT_HASH) fail('unexpected protocol inputHash');
  if (checks.protocolOutputHash !== EXPECTED_PROTOCOL_OUTPUT_HASH) fail('unexpected protocol outputHash');

  if (persist) {
    const state = loadState();
    state.fixtures = {
      inputPath: path.relative(ROOT, FIXTURE_IN),
      outputPath: path.relative(ROOT, FIXTURE_OUT),
      policyHash: POLICY_HASH,
      ...checks,
      recordedAt: nowIso(),
    };
    if (state.build?.wasmSha256) {
      state.fixtures.wasmSha256Used = state.build.wasmSha256;
    }
    saveState(state);
  }
  return checks;
}

// ---------------------------------------------------------------------------
// FastFS upload (Borsh, `__fastdata_fastfs`, gas = 1 by design)
// ---------------------------------------------------------------------------

function borshString(s) {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}

function borshBytes(b) {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}

/** enum FastfsData::Simple { relative_path, content: Some({mime_type, content}) } */
function fastfsPayload(relativePath, mimeType, content) {
  return Buffer.concat([
    Buffer.from([0]), // Enum variant 0 = Simple
    borshString(relativePath),
    Buffer.from([1]), // Option::Some
    borshString(mimeType),
    borshBytes(content),
  ]);
}

function fastfsUrl(sender, hash) {
  return `https://${FASTFS_HOST}/${sender}/${FASTFS_RECEIVER}/${hash}.wasm`;
}

async function fetchWasm(url, expectedHash, timeoutMs = 240_000) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const hash = sha256(buf);
        if (hash === expectedHash) return { ok: true, bytes: buf.length, hash };
        last = `HTTP ${res.status}, ${buf.length} bytes, sha256 ${short(hash)}`;
      } else {
        last = `HTTP ${res.status}`;
      }
    } catch (err) {
      last = `fetch error: ${err.message}`;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { ok: false, error: last };
}

async function publish() {
  const state = loadState();
  if (!state.build?.wasmSha256) fail('no build recorded; run --build first');
  const wasmBytes = fs.readFileSync(WASM_PATH);
  const hash = sha256(wasmBytes);
  if (hash !== state.build.wasmSha256) {
    fail(`built wasm sha256 ${hash} does not match recorded ${state.build.wasmSha256}`);
  }

  assertTestnetAccount(OWNER);
  const ownerAccount = await viewAccount(OWNER);
  if (!ownerAccount) fail(`owner account ${OWNER} does not exist on testnet`);

  // The research doc names `mend.testnet/bid-rules`, but OutLayer derives the
  // project id from the *predecessor* account, so that id needs a MEND-controlled
  // `mend.testnet` account. Record the live answer instead of assuming.
  const canonicalOwner = CANONICAL_PROJECT_ID.split('/')[0];
  const canonicalOwnerAccount = await viewAccount(canonicalOwner);
  const canonicalBlocker = canonicalOwnerAccount
    ? null
    : `account ${canonicalOwner} does not exist on testnet (NEAR RPC: UNKNOWN_ACCOUNT), so the outlayer.testnet-derived project id ${CANONICAL_PROJECT_ID} cannot be created; publishing under the controlled owner ${OWNER} instead`;
  log(`  requested project id: ${CANONICAL_PROJECT_ID}`);
  log(`  canonical owner account ${canonicalOwner}: ${canonicalOwnerAccount ? 'exists' : 'UNKNOWN_ACCOUNT'}`);
  log(`  project id in use:    ${PROJECT_ID}`);

  const account = loadSigner(OWNER);
  const url = fastfsUrl(OWNER, hash);

  section('publish: FastFS upload');
  const payload = fastfsPayload(`${hash}.wasm`, 'application/wasm', wasmBytes);
  log(`  file:     ${WASM_REL}`);
  log(`  size:     ${wasmBytes.length} bytes`);
  log(`  sha256:   ${hash}`);
  log(`  sender:   ${OWNER}`);
  log(`  receiver: ${FASTFS_RECEIVER}`);
  log(`  payload:  ${payload.length} bytes (Borsh FastfsData::Simple)`);

  let uploadTx = null;
  const alreadyServed = await fetchWasm(url, hash, 10_000);
  if (alreadyServed.ok) {
    uploadTx = state.fastfs?.uploadTx ?? null;
    log('  already served by FastFS (verified exact bytes); skipping duplicate upload');
    if (uploadTx) log(`  previous tx: ${uploadTx}`);
  } else {
    log('  note:     the call is sent with gas=1 and is expected to fail execution;');
    log('            the FastFS indexer reads the file from the transaction args.');

    // The args are Borsh bytes, not JSON, so build the function call directly.
    const signed = await account.createSignedTransaction({
      receiverId: FASTFS_RECEIVER,
      actions: [actions.functionCall('__fastdata_fastfs', payload, GAS_UPLOAD, 0n)],
    });
    const outcome = await provider.sendTransactionUntil(signed, 'FINAL');
    uploadTx = txHashOf(outcome);
    if (!uploadTx) fail('FastFS upload did not return a transaction hash');
    log(`  tx:       ${uploadTx}`);
    log(`  explorer: ${EXPLORER}/transactions/${uploadTx}`);
  }
  log(`  url:      ${url}`);
  log('  waiting for the FastFS gateway to serve the exact bytes…');

  const networkSnap = await captureNetworkSnapshot();
  const served = alreadyServed.ok ? alreadyServed : await fetchWasm(url, hash);
  if (!served.ok) {
    state.fastfs = { url, uploadTx, hash, served: false, error: served.error, recordedAt: nowIso() };
    saveState(state);
    fail(`FastFS did not serve ${url}: ${served.error}`);
  }
  log(`  served:   yes (${served.bytes} bytes, sha256 verified)`);

  section('publish: create_project / add_version');
  const existing = await viewFunction(OUTLAYER_ACCOUNT, 'get_project', { project_id: PROJECT_ID });
  let createTx = state.project?.createTx ?? null;
  const version = existing
    ? await viewFunction(OUTLAYER_ACCOUNT, 'get_version', { project_id: PROJECT_ID, version_key: hash })
    : null;

  if (!existing) {
    const outcome = await sendTx(account, {
      receiverId: OUTLAYER_ACCOUNT,
      method: 'create_project',
      args: {
        name: PROJECT_NAME,
        source: { WasmUrl: { url, hash, build_target: BUILD_TARGET } },
      },
      gas: GAS_CREATE,
      deposit: DEPOSIT_CREATE,
    });
    const status = txStatusOf(outcome);
    createTx = txHashOf(outcome);
    log(`  create_project tx: ${createTx}`);
    log(`  status:            ${status.ok ? 'success' : status.kind}`);
    if (!status.ok) fail(`create_project failed: ${status.kind}`);
  } else if (!version) {
    const outcome = await sendTx(account, {
      receiverId: OUTLAYER_ACCOUNT,
      method: 'add_version',
      args: {
        project_name: PROJECT_NAME,
        source: { WasmUrl: { url, hash, build_target: BUILD_TARGET } },
        set_active: true,
      },
      gas: GAS_CREATE,
      deposit: DEPOSIT_CREATE,
    });
    const status = txStatusOf(outcome);
    createTx = txHashOf(outcome);
    log(`  add_version tx:    ${createTx}`);
    log(`  status:            ${status.ok ? 'success' : status.kind}`);
    if (!status.ok) fail(`add_version failed: ${status.kind}`);
  } else {
    log(`  project already exists with version ${short(hash)}; no write needed`);
  }

  let project = await viewFunction(OUTLAYER_ACCOUNT, 'get_project', { project_id: PROJECT_ID });
  let versionAfter = await viewFunction(OUTLAYER_ACCOUNT, 'get_version', {
    project_id: PROJECT_ID,
    version_key: hash,
  });
  for (let i = 0; i < 10 && (!project || !versionAfter); i += 1) {
    log('  waiting for the project view to catch up…');
    await new Promise((r) => setTimeout(r, 3000));
    project = await viewFunction(OUTLAYER_ACCOUNT, 'get_project', { project_id: PROJECT_ID });
    versionAfter = await viewFunction(OUTLAYER_ACCOUNT, 'get_version', {
      project_id: PROJECT_ID,
      version_key: hash,
    });
  }
  if (!project) fail(`get_project(${PROJECT_ID}) returned null after publish`);
  if (!versionAfter) fail(`get_version(${PROJECT_ID}, ${hash}) returned null after publish`);
  const source = versionAfter?.source ?? null;
  const sourceHash = source?.WasmUrl?.hash ?? source?.hash ?? null;
  log(`  project:           ${PROJECT_ID}`);
  log(`  active version:    ${project.active_version ?? '(unknown field)'}`);
  log(`  version hash:      ${sourceHash ?? '(unknown field)'}`);
  if (sourceHash !== hash) fail(`on-chain version hash ${sourceHash} != built wasm sha256 ${hash}`);

  state.fastfs = { url, uploadTx, hash, served: true, bytes: served.bytes, recordedAt: nowIso() };
  state.networkSnapshot = {
    evidenceFile: path.relative(ROOT, path.join(EVIDENCE_DIR, 'network.json')),
    health: networkSnap.health?.body ?? networkSnap.health?.error,
    pricing: networkSnap.pricing?.body ?? networkSnap.pricing?.error,
    maxLimits: networkSnap.contract?.maxLimits ?? null,
    paused: networkSnap.contract?.paused ?? null,
    capturedAt: networkSnap.capturedAt,
  };
  state.project = {
    projectId: PROJECT_ID,
    requestedProjectId: CANONICAL_PROJECT_ID,
    name: PROJECT_NAME,
    owner: OWNER,
    createTx,
    versionKey: hash,
    buildTarget: BUILD_TARGET,
    projectView: project,
    versionView: versionAfter,
    canonicalIdBlocker: canonicalBlocker,
    recordedAt: nowIso(),
  };
  saveState(state);
  return state.project;
}

// ---------------------------------------------------------------------------
// Execute on OutLayer testnet
// ---------------------------------------------------------------------------

function requestArgs(state) {
  const inputText = fs.readFileSync(FIXTURE_IN, 'utf8');
  return {
    source: {
      Project: {
        project_id: PROJECT_ID,
        version_key: state.build.wasmSha256,
      },
    },
    resource_limits: LIMITS,
    input_data: inputText,
    secrets_ref: null,
    response_format: 'Json',
    payer_account_id: OWNER,
    params: null,
  };
}

async function execute() {
  const state = loadState();
  if (!state.project?.versionKey) fail('project not published; run --publish first');
  const inputBytes = fs.readFileSync(FIXTURE_IN);
  const inputText = inputBytes.toString('utf8');

  section('execute: estimate_execution_cost');
  const estimate = await viewFunction(OUTLAYER_ACCOUNT, 'estimate_execution_cost', {
    resource_limits: LIMITS,
    input_len: inputBytes.length,
  });
  const estimateYocto = BigInt(estimate);
  const deposit = DEPOSIT_REQUEST > estimateYocto ? DEPOSIT_REQUEST : estimateYocto + 1_000_000_000_000_000_000_000n;
  log(`  estimate: ${estimateYocto} yocto (${Number(estimateYocto) / 1e24} NEAR)`);
  log(`  deposit:  ${deposit} yocto (${Number(deposit) / 1e24} NEAR)`);
  log(`  limits:   ${JSON.stringify(LIMITS)}`);
  log(`  input:    ${inputBytes.length} bytes, sha256 ${sha256(inputBytes)}`);

  const paused = await viewFunction(OUTLAYER_ACCOUNT, 'is_paused', {});
  if (paused === true) fail('outlayer.testnet is paused');

  const account = loadSigner(OWNER);
  section('execute: request_execution');
  const args = requestArgs(state);
  const outcome = await sendTx(account, {
    receiverId: OUTLAYER_ACCOUNT,
    method: 'request_execution',
    args,
    gas: GAS_REQUEST,
    deposit,
  });
  const txHash = txHashOf(outcome);
  const status = txStatusOf(outcome);
  log(`  tx:        ${txHash}`);
  log(`  explorer:  ${EXPLORER}/transactions/${txHash}`);
  log(`  status:    ${status.ok ? 'success' : status.kind}`);
  if (!status.ok) {
    state.execution = { requestTx: txHash, success: false, failure: status.kind, recordedAt: nowIso() };
    saveState(state);
    fail(`request_execution failed: ${status.kind}`);
  }

  // request_id is in the `execution_requested` event (request_data is a JSON string).
  let requestId = null;
  for (const event of eventLogs(outcome, 'execution_requested')) {
    for (const item of event.data ?? []) {
      try {
        const rd = JSON.parse(item.request_data);
        if (rd.request_id != null) requestId = rd.request_id;
      } catch {
        /* ignore malformed */
      }
    }
  }
  if (requestId == null) {
    // Fallback: find our request by scanning pending + recent ids is not reliable,
    // so fail loudly rather than guess.
    fail('could not read request_id from the execution_requested event');
  }
  log(`  request_id: ${requestId}`);

  const completed = eventLogs(outcome, 'execution_completed');
  if (completed.length) log(`  execution_completed event: ${JSON.stringify(completed[0].data)}`);

  const request = await viewFunction(OUTLAYER_ACCOUNT, 'get_request', { request_id: requestId });
  log(`  on-chain get_request: ${request ? `sender=${request.sender_id} payment=${request.payment}` : '(null)'}`);

  const requestEventData = eventLogs(outcome, 'execution_requested').map((e) => e.data ?? []);
  writeJson(path.join(EVIDENCE_DIR, `request-${requestId}.json`), {
    schema: 'mend.outlayer-live.request.v1',
    requestId,
    txHash,
    explorer: `${EXPLORER}/transactions/${txHash}`,
    sentAt: nowIso(),
    requestArgs: { ...args, input_data: `<${inputBytes.length} bytes, sha256 ${sha256(inputBytes)}>` },
    status: status.ok ? 'success' : status.kind,
    requestEventData,
    logs: logsOf(outcome),
    receiptsOutcome: (outcome.receipts_outcome ?? []).map((r) => ({
      id: r.id,
      executorId: r.outcome?.executor_id,
      logs: r.outcome?.logs ?? [],
      gasBurnt: r.outcome?.gas_burnt,
    })),
    getRequest: request,
  });

  state.execution = {
    requestTx: txHash,
    requestId,
    success: true,
    estimateYocto: estimateYocto.toString(),
    depositYocto: deposit.toString(),
    limits: LIMITS,
    responseFormat: 'Json',
    payerAccountId: OWNER,
    projectVersionKey: state.build.wasmSha256,
    inputSha256: sha256(inputBytes),
    inputBytes: inputBytes.length,
    executionCompletedEvent: completed[0]?.data ?? null,
    requestView: request,
    evidenceFile: path.relative(ROOT, path.join(EVIDENCE_DIR, `request-${requestId}.json`)),
    recordedAt: nowIso(),
  };
  saveState(state);

  section('execute: capture attestation');
  await captureAttestation(state, requestId, txHash);
  return state.execution;
}

// ---------------------------------------------------------------------------
// Settlement (worker resolve) transaction discovery
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpcCall(method, params) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const body = await res.json();
    if (!body.error) return body.result;
    const text = JSON.stringify(body.error);
    if (text.includes('-429') || /rate limit/i.test(text)) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    throw new Error(`${method}: ${text.slice(0, 200)}`);
  }
  throw new Error(`${method}: rate limited`);
}

/**
 * The attestation exposes only the *request* tx. Settlement is a second tx from
 * the operator account (`submit_execution_output_and_resolve` for outputs over
 * the 1024-byte resume limit, otherwise `resolve_execution`). Find it in the
 * blocks after the request block. Bounded scan, no unbounded indexing.
 */
async function findSettlementTx(centerHeight, { back = 4, forward = 16 } = {}) {
  const from = Math.max(1, centerHeight - back);
  const to = centerHeight + forward;
  for (let h = from; h <= to; h += 1) {
    let block;
    try {
      block = await rpcCall('block', { block_id: h });
    } catch {
      continue;
    }
    await sleep(600);
    for (const chunk of block.chunks ?? []) {
      let full;
      try {
        full = await rpcCall('chunk', { chunk_id: chunk.chunk_hash });
      } catch {
        continue;
      }
      await sleep(600);
      for (const tx of full.transactions ?? []) {
        const methods = (tx.actions ?? []).map((a) => a.FunctionCall?.method_name).filter(Boolean);
        const settleMethod = methods.find(
          (m) => m === 'resolve_execution' || m === 'submit_execution_output_and_resolve',
        );
        if (tx.receiver_id === OUTLAYER_ACCOUNT && settleMethod) {
          return {
            txHash: tx.hash,
            blockHeight: h,
            signerId: tx.signer_id,
            receiverId: tx.receiver_id,
            method: settleMethod,
          };
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Attestation capture + verification
// ---------------------------------------------------------------------------

function tdxReportData(quote) {
  // TDX Quote v4: header 48 + TD report; report_data is at 568..632.
  if (!quote || quote.length < 632) return null;
  return quote.subarray(568, 632);
}

function tdxMeasurements(quote) {
  if (!quote || quote.length < 568) return null;
  const hex = (o) => quote.subarray(o, o + 48).toString('hex');
  return { mrtd: hex(184), rtmr0: hex(376), rtmr1: hex(424), rtmr2: hex(472), rtmr3: hex(520) };
}

/** Exact preimage from worker/src/tdx_attestation.rs. */
function recomputeTaskHash(record) {
  const h = crypto.createHash('sha256');
  const u64 = (n) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(n));
    return b;
  };
  const str = (v) => (v === null || v === undefined || v === '' ? null : String(v));
  h.update(String(record.task_type ?? 'execute'));
  h.update(u64(record.task_id ?? 0));
  for (const key of ['repo_url', 'commit_hash', 'build_target', 'wasm_hash', 'input_hash']) {
    const v = str(record[key]);
    if (v) h.update(v);
  }
  h.update(String(record.output_hash)); // always present
  if (record.block_height != null) h.update(u64(record.block_height));
  for (const key of ['caller_account_id', 'project_id', 'secrets_ref']) {
    const v = str(record[key]);
    if (v) h.update(v);
  }
  h.update(u64(record.timestamp ?? 0));
  const usd = str(record.attached_usd);
  if (usd) h.update(usd);
  return h.digest('hex');
}

async function fetchAttestation(requestId, txHash) {
  for (const [label, url] of [
    ['by-request', `${API_BASE}/attestations/by-request/${requestId}`],
    ['by-tx', `${API_BASE}/attestations/by-tx/${txHash}`],
  ]) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        return { via: label, url, record: body };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function captureSettlement(state, rec) {
  if (state.execution.settlement?.txHash) return state.execution.settlement;
  const found = await findSettlementTx(rec.block_height ?? state.execution.attestation?.block_height);
  if (!found) {
    state.execution.settlement = {
      found: false,
      scannedAroundBlock: rec.block_height ?? null,
      checkedAt: nowIso(),
    };
    saveState(state);
    log('  settlement tx: not found in the scanned window');
    return null;
  }

  let outcome = null;
  try {
    outcome = await provider.viewTransactionStatusWithReceipts({
      txHash: found.txHash,
      accountId: found.signerId,
      waitUntil: 'FINAL',
    });
  } catch (err) {
    log(`  settlement tx outcome: unavailable (${err.message})`);
  }
  const logLines = [];
  for (const r of outcome?.receipts_outcome ?? []) logLines.push(...(r?.outcome?.logs ?? []));

  const settlement = {
    ...found,
    explorer: `${EXPLORER}/transactions/${found.txHash}`,
    status: outcome?.status && 'SuccessValue' in outcome.status ? 'success' : JSON.stringify(outcome?.status ?? 'unknown'),
    logs: logLines,
    receipts: (outcome?.receipts_outcome ?? []).map((r) => ({
      id: r.id,
      executorId: r.outcome?.executor_id,
      logs: r.outcome?.logs ?? [],
      gasBurnt: r.outcome?.gas_burnt,
    })),
    recordedAt: nowIso(),
  };
  writeJson(path.join(EVIDENCE_DIR, `settlement-${state.execution.requestId}.json`), {
    schema: 'mend.outlayer-live.settlement.v1',
    requestId: state.execution.requestId,
    ...settlement,
  });
  state.execution.settlement = settlement;
  saveState(state);
  log(`  settlement tx: ${found.txHash} (${found.method} by ${found.signerId} @ ${found.blockHeight})`);
  log(`  explorer:      ${settlement.explorer}`);
  for (const line of logLines) log(`  settle log:    ${line.slice(0, 200)}`);
  return settlement;
}

async function captureAttestation(state, requestId, txHash) {
  const started = Date.now();
  const timeoutMs = Number(process.env.MEND_OUTLAYER_ATTESTATION_TIMEOUT_MS || 300_000);
  let found = null;
  while (Date.now() - started < timeoutMs) {
    found = await fetchAttestation(requestId, txHash);
    if (found) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!found) {
    log('  attestation: not available yet (recorded as pending)');
    state.execution.attestation = { available: false, checkedAt: nowIso() };
    saveState(state);
    return null;
  }

  const rec = found.record;
  log(`  attestation: ${found.via} ${found.url}`);
  log(`  wasm_hash:   ${rec.wasm_hash}`);
  log(`  input_hash:  ${rec.input_hash}`);
  log(`  output_hash: ${rec.output_hash}`);
  log(`  worker_measurement: ${short(rec.worker_measurement, 12)}`);

  const quoteBuf = Buffer.from(rec.tdx_quote ?? '', 'base64');
  const reportData = tdxReportData(quoteBuf);
  const recomputed = recomputeTaskHash(rec);
  const reportDataHash = reportData ? reportData.subarray(0, 32).toString('hex') : null;
  const measurements = tdxMeasurements(quoteBuf);
  const approved = measurements
    ? await viewFunction(WORKER_ACCOUNT, 'get_approved_measurements', {})
    : null;
  const measurementApproved = Boolean(
    approved &&
      measurements &&
      approved.some(
        (m) =>
          m.mrtd === measurements.mrtd &&
          m.rtmr0 === measurements.rtmr0 &&
          m.rtmr1 === measurements.rtmr1 &&
          m.rtmr2 === measurements.rtmr2 &&
          m.rtmr3 === measurements.rtmr3,
      ),
  );

  const snapshot = {
    schema: 'mend.outlayer-live.attestation.v1',
    fetchedVia: found.via,
    fetchedFrom: found.url,
    fetchedAt: nowIso(),
    record: rec,
    derived: {
      quoteSha256: quoteBuf.length ? sha256(quoteBuf) : null,
      quoteBytes: quoteBuf.length,
      reportData: reportData ? reportData.toString('hex') : null,
      recomputedTaskHash: recomputed,
      taskHashMatchesReportData: reportDataHash === recomputed,
      measurements,
      measurementsApproved: measurementApproved,
      approvedMeasurementSets: approved ? approved.length : null,
      verificationScope:
        'hashes + task-hash binding + measurement allowlist; Intel DCAP signature chain NOT checked here',
    },
  };
  writeJson(path.join(EVIDENCE_DIR, `attestation-request-${requestId}.json`), snapshot);

  state.execution.attestation = {
    available: true,
    // Flattened record fields so --check compares the same names the API uses.
    id: rec.id,
    task_id: rec.task_id,
    task_type: rec.task_type,
    request_id: rec.request_id,
    caller_account_id: rec.caller_account_id,
    transaction_hash: rec.transaction_hash,
    block_height: rec.block_height,
    repo_url: rec.repo_url ?? null,
    commit_hash: rec.commit_hash ?? null,
    build_target: rec.build_target,
    wasm_hash: rec.wasm_hash,
    executed_wasm_sha256: rec.executed_wasm_sha256 ?? null,
    input_hash: rec.input_hash,
    output_hash: rec.output_hash,
    project_id: rec.project_id ?? null,
    attached_usd: rec.attached_usd ?? null,
    timestamp: rec.timestamp,
    worker_measurement: rec.worker_measurement,
    ...snapshot.derived,
    record: { ...rec, tdx_quote: `<${quoteBuf.length} bytes, sha256 ${sha256(quoteBuf)}>` },
    evidenceFile: path.relative(ROOT, path.join(EVIDENCE_DIR, `attestation-request-${requestId}.json`)),
  };
  saveState(state);
  await captureSettlement(state, rec);
  return snapshot;
}

// ---------------------------------------------------------------------------
// Verification (no writes except the evidence snapshot refresh)
// ---------------------------------------------------------------------------

async function verifyLive(state) {
  section('verify: live re-read');
  const out = { live: {}, problems: [], notes: [] };

  // OutLayer contract is reachable and unpaused
  try {
    const paused = await viewFunction(OUTLAYER_ACCOUNT, 'is_paused', {});
    out.live.outlayerReachable = true;
    out.live.paused = paused;
    if (paused === true) out.problems.push('outlayer.testnet is paused');
  } catch (err) {
    out.live.outlayerReachable = false;
    out.problems.push(`outlayer.testnet view failed: ${err.message}`);
  }

  // project + version still on chain
  if (state.project?.projectId) {
    const project = await viewFunction(OUTLAYER_ACCOUNT, 'get_project', {
      project_id: state.project.projectId,
    });
    out.live.projectPresent = Boolean(project);
    if (!project) out.problems.push(`${state.project.projectId} is not present on chain`);
    else {
      const version = await viewFunction(OUTLAYER_ACCOUNT, 'get_version', {
        project_id: state.project.projectId,
        version_key: state.project.versionKey,
      });
      out.live.versionPresent = Boolean(version);
      if (!version) out.problems.push(`version ${state.project.versionKey} is not present on chain`);
    }
  }

  // request still readable
  if (state.execution?.requestId != null) {
    const req = await viewFunction(OUTLAYER_ACCOUNT, 'get_request', {
      request_id: state.execution.requestId,
    });
    out.live.requestPresent = Boolean(req);
    if (req) {
      out.live.request = {
        sender_id: req.sender_id,
        response_format: req.response_format,
        payment: req.payment,
        input_len: req.input_data ? Buffer.byteLength(req.input_data) : null,
        resolved_source: req.resolved_source,
      };
      const src = req.resolved_source;
      const onchainHash = src?.WasmUrl?.hash ?? null;
      if (onchainHash && onchainHash !== state.build.wasmSha256) {
        out.problems.push('on-chain request source hash != built wasm hash');
      }
      if (req.response_format && JSON.stringify(req.response_format).includes('Json') === false) {
        out.problems.push('on-chain request response_format is not Json');
      }
    } else {
      out.notes.push('get_request returned null (request state may be archived)');
    }
  }

  // attestation still served by the API, else fall back to the captured snapshot
  if (state.execution?.requestId != null) {
    const found = await fetchAttestation(state.execution.requestId, state.execution.requestTx);
    out.live.attestationAvailable = Boolean(found);
    if (found) {
      out.live.attestationFetchedVia = found.via;
      const rec = found.record;
      if (rec.output_hash !== state.execution?.attestation?.output_hash) {
        out.problems.push('live attestation output_hash differs from the captured evidence');
      }
    } else if (state.execution?.attestation?.available) {
      out.notes.push('attestation no longer served live; verifying against the captured snapshot');
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Markdown evidence doc
// ---------------------------------------------------------------------------

function renderDoc(state, check) {
  const b = state.build ?? {};
  const f = state.fixtures ?? {};
  const p = state.project ?? {};
  const e = state.execution ?? {};
  const a = e.attestation ?? {};
  const status = check.result;
  const lines = [];
  const push = (...xs) => lines.push(...xs);

  push('# MEND × OutLayer — live testnet publish/execute evidence', '');
  push(`Status: **${status}** — generated ${nowIso()} by \`scripts/outlayer-live/run-live.mjs --doc\`.`);
  push('');
  push('This document is generated from `infra/outlayer-live/live-state.json` and the');
  push('captured evidence files. It reports exactly what happened: a real testnet');
  push('publication and execution, or the precise blocker that stopped one.');
  push('');

  push('## 1. Scope and network', '');
  push('| Item | Value |');
  push('|---|---|');
  push(`| Network | **testnet** (mainnet refused by the script) |`);
  push(`| OutLayer contract | \`${OUTLAYER_ACCOUNT}\` |`);
  push(`| OutLayer API | ${state.apiBase} |`);
  push(`| Worker/operator account | \`${WORKER_ACCOUNT}\` |`);
  push(`| Publisher / caller | \`${state.owner}\` |`);
  push(`| Project id requested by the task | \`${state.requestedProjectId ?? CANONICAL_PROJECT_ID}\` |`);
  push(`| Project id actually used | \`${state.projectId}\` |`);
  push('');
  if (p.canonicalIdBlocker) {
    push(`> **Canonical id note.** ${p.canonicalIdBlocker}`);
    push('');
  }

  push('## 2. WASM artifact', '');
  push('```bash');
  push('cargo build --manifest-path compute/bid-rules/Cargo.toml --target wasm32-wasip1 --release');
  push('shasum -a 256 compute/bid-rules/target/wasm32-wasip1/release/mend-bid-rules.wasm');
  push('```', '');
  push('| Field | Value |');
  push('|---|---|');
  push(`| Target | \`${b.target ?? BUILD_TARGET}\` |`);
  push(`| Toolchain | \`${b.toolchain ?? 'n/a'}\` |`);
  push(`| Size | ${b.sizeBytes ?? 'n/a'} bytes |`);
  push(`| SHA-256 | \`${b.wasmSha256 ?? 'n/a'}\` |`);
  push(`| Hash record | \`${b.artifactRecord ?? 'compute/bid-rules/artifacts/wasm-sha256.json'}\` |`);
  push('');

  push('## 3. Canonical input/output', '');
  push('| Field | Value |');
  push('|---|---|');
  push(`| Input file | \`${f.inputPath ?? 'fixtures/recorded-responses/bid-rules/canonical-input.json'}\` |`);
  push(`| Input bytes | ${f.inputBytes ?? 'n/a'} |`);
  push(`| Input SHA-256 | \`${f.inputSha256 ?? 'n/a'}\` |`);
  push(`| Output (worker stdout) bytes | ${f.localStdoutBytes ?? 'n/a'} |`);
  push(`| Output SHA-256 (stdout) | \`${f.localStdoutSha256 ?? 'n/a'}\` |`);
  push(`| Output SHA-256 (OutLayer canonical) | \`${f.canonicalOutputSha256 ?? 'n/a'}\` |`);
  push(`| Output file (pretty-printed) SHA-256 | \`${f.fixtureOutputFileSha256 ?? 'n/a'}\` |`);
  push(`| Protocol \`inputHash\` | \`${f.protocolInputHash ?? 'n/a'}\` |`);
  push(`| Protocol \`outputHash\` | \`${f.protocolOutputHash ?? 'n/a'}\` |`);
  push(`| Winner | \`${f.winnerBidId ?? 'n/a'}\` |`);
  push(`| stdout > 1024-byte single-resume limit | ${f.exceedsSingleResumeLimit ?? 'n/a'} |`);
  push('');

  push('## 4. Publication', '');
  if (p.versionKey) {
    push('```text');
    push('node scripts/outlayer-live/run-live.mjs --publish');
    push('  -> FastFS upload: outlayer.testnet::__fastdata_fastfs (gas = 1, fails by design)');
    push('  -> outlayer.testnet::create_project(name, {WasmUrl:{url,hash,build_target}})');
    push('```', '');
    push('| Field | Value |');
    push('|---|---|');
    push(`| Wasm URL | ${state.fastfs?.url ? `<${state.fastfs.url}>` : 'n/a'} |`);
    push(`| FastFS upload tx | ${state.fastfs?.uploadTx ? `[\`${state.fastfs.uploadTx}\`](${EXPLORER}/transactions/${state.fastfs.uploadTx})` : 'n/a'} |`);
    push(`| FastFS served exact bytes | ${state.fastfs?.served ?? false} |`);
    push(`| create_project tx | ${p.createTx ? `[\`${p.createTx}\`](${EXPLORER}/transactions/${p.createTx})` : 'n/a'} |`);
    push(`| tx verification | \`infra/outlayer-live/evidence/publish-txs.json\` |`);
    push(`| Pinned version key | \`${p.versionKey}\` |`);
    push(`| Build target | \`${p.buildTarget}\` |`);
    push('');
  } else {
    push('Not published. See §7 for the blocker.', '');
  }

  push('## 5. Execution', '');
  if (e.success) {
    push('```text');
    push('node scripts/outlayer-live/run-live.mjs --execute');
    push('  -> outlayer.testnet::estimate_execution_cost(resource_limits, input_len)');
    push('  -> outlayer.testnet::request_execution(source=Project{project_id, version_key}, Json)');
    push('```', '');
    push('| Field | Value |');
    push('|---|---|');
    push(`| request_execution tx | [\`${e.requestTx}\`](${EXPLORER}/transactions/${e.requestTx}) |`);
    push(`| worker settlement tx | ${e.settlement?.txHash ? `[\`${e.settlement.txHash}\`](${EXPLORER}/transactions/${e.settlement.txHash}) (\`${e.settlement.method}\` by \`${e.settlement.signerId}\` at block ${e.settlement.blockHeight})` : 'not located'} |`);
    push(`| request_id | ${e.requestId ?? 'n/a'} |`);
    push(`| resource limits | \`${JSON.stringify(e.limits ?? {})}\` |`);
    push(`| estimated cost (yocto) | ${e.estimateYocto ?? 'n/a'} |`);
    push(`| attached deposit (yocto) | ${e.depositYocto ?? 'n/a'} |`);
    push(`| payer_account_id | \`${e.payerAccountId ?? ''}\` |`);
    push(`| response_format | \`${e.responseFormat ?? ''}\` |`);
    if (e.executionCompletedEvent?.[0]) {
      const ev = e.executionCompletedEvent[0];
      push(`| execution success | ${ev.success} |`);
      push(`| instructions / time_ms | ${ev.resources_used?.instructions ?? 'n/a'} / ${ev.resources_used?.time_ms ?? 'n/a'} |`);
      push(`| compile time / note | ${ev.resources_used?.compile_time_ms ?? 'n/a'} ms / ${ev.compilation_note ?? 'n/a'} |`);
      push(`| payment charged / refunded (yocto) | ${ev.payment_charged ?? 'n/a'} / ${ev.payment_refunded ?? 'n/a'} |`);
    }
    push('');
  } else {
    push('No successful `request_execution` was recorded.', '');
  }

  push('## 6. Attestation', '');
  if (a.available) {
    push('| Field | Value |');
    push('|---|---|');
    push(`| attestation id | ${a.record?.id ?? 'n/a'} |`);
    push(`| task id / type | ${a.record?.task_id ?? 'n/a'} / ${a.record?.task_type ?? 'n/a'} |`);
    push(`| request_id | ${a.record?.request_id ?? 'n/a'} |`);
    push(`| transaction_hash | [\`${a.record?.transaction_hash ?? ''}\`](${EXPLORER}/transactions/${a.record?.transaction_hash ?? ''}) |`);
    push(`| caller_account_id | \`${a.record?.caller_account_id ?? ''}\` |`);
    push(`| build_target | \`${a.record?.build_target ?? ''}\` |`);
    push(`| wasm_hash | \`${a.record?.wasm_hash ?? ''}\` |`);
    push(`| input_hash | \`${a.record?.input_hash ?? ''}\` |`);
    push(`| output_hash | \`${a.record?.output_hash ?? ''}\` |`);
    push(`| worker_measurement (RTMR3) | \`${a.record?.worker_measurement ?? ''}\` |`);
    push(`| TDX quote sha256 | \`${a.quoteSha256 ?? 'n/a'}\` (${a.quoteBytes ?? 0} bytes) |`);
    push(`| quote measurements in allowlist | **${a.measurementsApproved ?? false}** (${a.approvedMeasurementSets ?? 'n/a'} sets) |`);
    push(`| recomputed task hash == report_data | **${a.taskHashMatchesReportData ?? false}** |`);
    push(`| evidence snapshot | \`${a.evidenceFile ?? ''}\` |`);
    push('');
    push('Verified: the attestation binds the exact code hash, exact input bytes and');
    push('exact output bytes to a TDX quote whose five measurements are on the');
    push(`\`${WORKER_ACCOUNT}\` allowlist, and the recomputed task hash appears in`);
    push('`report_data[0..32]`.');
    push('');
    push('**Not** verified here: the Intel DCAP signature chain. `outlayer-verify`');
    push('(or a DCAP implementation) must be run against the raw quote for that; the');
    push('raw quote is stored in the evidence snapshot.');
    push('');
  } else {
    push('No attestation was captured. The execution result is **unattested**.', '');
  }

  push('## 7. Findings from the live run', '');
  push('1. **Code hash is reproducible.** Two independent builds with the recorded');
  push(`   toolchain produced \`${b.wasmSha256 ?? ''}\`, the value pinned on chain and in the attestation.`);
  push('2. **Input hash is the exact input bytes.** `sha256(canonical-input.json)` =');
  push(`   \`${f.inputSha256 ?? ''}\` = attestation \`input_hash\`. The fixture file is passed verbatim as \`input_data\`.`);
  push('3. **`output_hash` is not `sha256(stdout)` for `Json`.** The worker parses stdout');
  push('   into `serde_json::Value` and hashes `Value::to_string()`');
  push('   (`worker/src/main.rs`), i.e. compact JSON with lexicographically sorted keys.');
  push(`   stdout sha256 = \`${f.localStdoutSha256 ?? ''}\`;`);
  push(`   canonical/sorted-key sha256 = \`${f.canonicalOutputSha256 ?? ''}\`; the attestation reports the latter.`);
  push('4. **The 1024-byte single-resume limit was hit.** The canonical output is 1204 bytes,');
  push('   so OutLayer used the two-call flow: the settlement transaction is');
  push('   `submit_execution_output_and_resolve`, and its log says "Retrieving large output');
  push('   from storage". A MEND caller must keep this in mind: the value returned to the');
  push('   callback is the re-serialized JSON, not the raw stdout bytes.');
  push('5. **Publication needs an owner account, not an API key.** `create_project` derives');
  push('   the project id from `predecessor_account_id`; the publish path used the funded');
  push('   `mend-deployer.testnet` key and attached a storage deposit (excess refunded).');
  push('');

  push('## 8. Result and blockers', '');
  push(`**${status}**`);
  push('');
  if (check.problems?.length) {
    push('Blockers / failures:');
    for (const item of check.problems) push(`- ${item}`);
    push('');
  }
  if (check.notes?.length) {
    push('Notes:');
    for (const item of check.notes) push(`- ${item}`);
    push('');
  }

  push('## 9. What this does not prove', '');
  push('- It does not prove the WASM logic is correct, only which bytes ran.');
  push('- It does not prove the binary matches this source tree repo-wide; the');
  push('  reproducible-build claim is limited to the recorded toolchain and command.');
  push('- Intel DCAP quote verification is out of scope for this script.');
  push('- Testnet only. No mainnet claim, no production value.');
  push('');

  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// --check
// ---------------------------------------------------------------------------

async function check({ quiet = false } = {}) {
  const state = loadState();
  const local = { problems: [], notes: [] };
  const problems = [];
  const notes = [];

  if (!quiet) section('check: local artifact and fixtures');
  if (!state.build?.wasmSha256) problems.push('no wasm build recorded (run --build)');
  if (!state.fixtures?.localStdoutSha256) problems.push('no local deterministic run recorded');
  if (!state.fixtures?.canonicalOutputSha256) problems.push('no canonical (OutLayer-serialized) output hash recorded');

  if (fs.existsSync(WASM_PATH)) {
    const liveHash = sha256(fs.readFileSync(WASM_PATH));
    if (state.build?.wasmSha256 && liveHash !== state.build.wasmSha256) {
      problems.push(`built wasm hash ${short(liveHash)} != recorded ${short(state.build.wasmSha256)}`);
    }
  } else {
    notes.push('built wasm not present in this checkout; recorded hash used');
  }
  if (!fs.existsSync(ARTIFACT_RECORD)) problems.push('compute/bid-rules/artifacts/wasm-sha256.json is missing');
  else if (readJson(ARTIFACT_RECORD).sha256 !== state.build?.wasmSha256) {
    problems.push('artifacts/wasm-sha256.json does not match the recorded build hash');
  }
  if (state.fixtures?.inputSha256 && fs.existsSync(FIXTURE_IN)) {
    const h = sha256(fs.readFileSync(FIXTURE_IN));
    if (h !== state.fixtures.inputSha256) problems.push('canonical-input.json changed since the recorded run');
  }
  if (state.fixtures?.canonicalOutputSha256 && fs.existsSync(FIXTURE_OUT)) {
    const canonHash = sha256(Buffer.from(canonicalJson(JSON.parse(fs.readFileSync(FIXTURE_OUT, 'utf8'))), 'utf8'));
    if (canonHash !== state.fixtures.canonicalOutputSha256) {
      problems.push('canonical-output.json no longer canonicalizes to the recorded output hash');
    }
  }
  if (state.fixtures?.winnerBidId !== EXPECTED_WINNER) problems.push('recorded winner is not the canonical winner');
  if (state.fixtures?.protocolOutputHash !== EXPECTED_PROTOCOL_OUTPUT_HASH) {
    problems.push('recorded protocol outputHash does not match the fixture');
  }
  if (state.fixtures?.protocolInputHash !== EXPECTED_PROTOCOL_INPUT_HASH) {
    problems.push('recorded protocol inputHash does not match the fixture');
  }

  if (!quiet) section('check: live testnet state');
  if (state.project?.versionKey) {
    try {
      const project = await viewFunction(OUTLAYER_ACCOUNT, 'get_project', {
        project_id: state.project.projectId,
      });
      if (!project) problems.push(`${state.project.projectId} is not present on outlayer.testnet`);
      else {
        const version = await viewFunction(OUTLAYER_ACCOUNT, 'get_version', {
          project_id: state.project.projectId,
          version_key: state.project.versionKey,
        });
        if (!version) problems.push(`version ${short(state.project.versionKey)} is not present`);
      }
      const paused = await viewFunction(OUTLAYER_ACCOUNT, 'is_paused', {});
      if (paused === true) problems.push('outlayer.testnet is paused');
    } catch (err) {
      problems.push(`live OutLayer view failed: ${err.message}`);
    }
  } else {
    problems.push(`wasm not published to OutLayer testnet (requested id ${CANONICAL_PROJECT_ID}, used ${PROJECT_ID})`);
  }

  if (!state.execution?.success) {
    problems.push('no successful outlayer.testnet::request_execution recorded');
  } else if (state.execution?.requestId != null) {
    try {
      const req = await viewFunction(OUTLAYER_ACCOUNT, 'get_request', {
        request_id: state.execution.requestId,
      });
      if (!req) notes.push('get_request returned null (request state archived or pruned)');
    } catch {
      notes.push('get_request lookup failed; relying on the captured evidence');
    }
    const found = await fetchAttestation(state.execution.requestId, state.execution.requestTx);
    if (found) {
      notes.push(`attestation still served live via ${found.via}`);
    } else if (state.execution?.attestation?.available) {
      notes.push('attestation no longer served live; captured snapshot is the evidence of record');
    }
  }

  if (state.execution?.success) {
    const att = state.execution.attestation;
    const settle = state.execution.settlement;
    if (settle?.txHash) {
      if (settle.signerId !== WORKER_ACCOUNT) {
        problems.push(`settlement tx signer ${settle.signerId} != ${WORKER_ACCOUNT}`);
      }
      if (!['resolve_execution', 'submit_execution_output_and_resolve'].includes(settle.method)) {
        problems.push(`unexpected settlement method ${settle.method}`);
      }
    } else {
      notes.push('worker settlement tx was not located in the scanned block window');
    }
    if (!att?.available) {
      problems.push('execution has no attestation record (result is unattested)');
    } else {
      if (att.wasm_hash !== state.build.wasmSha256) problems.push('attestation wasm_hash != built wasm sha256');
      if (att.input_hash !== state.fixtures.inputSha256) problems.push('attestation input_hash != canonical input sha256');
      if (att.output_hash !== state.fixtures.canonicalOutputSha256) {
        problems.push('attestation output_hash != canonical output sha256');
      }
      if (att.build_target !== BUILD_TARGET) problems.push(`attestation build_target != ${BUILD_TARGET}`);
      if (!att.taskHashMatchesReportData) problems.push('recomputed task hash != TDX report_data');
      if (!att.measurementsApproved) problems.push('quote measurements are not on the worker allowlist');
    }
  }

  const result = problems.length === 0 ? 'PASS' : 'BLOCKED';

  if (!quiet) {
    section('summary');
    log(`  wasm sha256:      ${state.build?.wasmSha256 ?? '(none)'}`);
    log(`  project:          ${state.project?.projectId ?? '(none)'}${state.project?.versionKey ? ` @ ${short(state.project.versionKey)}` : ''}`);
    log(`  request tx:       ${state.execution?.requestTx ?? '(none)'}`);
    log(`  request id:       ${state.execution?.requestId ?? '(none)'}`);
    log(`  attestation:      ${state.execution?.attestation?.available ? `captured (output ${short(state.execution.attestation.output_hash)})` : 'none'}`);
    if (state.execution?.settlement?.txHash) {
      log(`  settlement tx:    ${state.execution.settlement.txHash} (${state.execution.settlement.method})`);
    }
    log('');
    if (notes.length) {
      log('  notes:');
      for (const n of notes) log(`    - ${n}`);
      log('');
    }
    if (problems.length) {
      log('  blockers:');
      for (const p of problems) log(`    - ${p}`);
      log('');
    }
    log(`RESULT: ${result}`);
    if (result === 'PASS') {
      log('  A live testnet publication and execution is recorded, and the attestation');
      log('  binds the built code hash, the canonical input and the canonical output.');
      log('  Intel DCAP signature-chain verification is explicitly out of scope.');
    } else {
      log('  No verified live TEE execution is claimed. The local deterministic');
      log('  fallback (compute/bid-rules + fixtures) remains the evidence of record.');
    }
  }

  return { result, problems, notes, state };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const known = ['--build', '--publish', '--execute', '--verify', '--all', '--check', '--doc'];
  for (const a of argv) if (!known.includes(a)) fail(`unknown flag ${a}`);

  if (!argv.length) {
    log('usage: node scripts/outlayer-live/run-live.mjs [--build|--publish|--execute|--verify|--all|--check|--doc]');
    process.exit(0);
  }

  if (has('--doc')) {
    const res = await check({ quiet: true });
    const text = renderDoc(res.state, res);
    assertNoSecrets(text, path.relative(ROOT, DOC_PATH));
    const changed = writeIfChanged(DOC_PATH, text);
    log(`${changed ? 'wrote' : 'unchanged'}: ${path.relative(ROOT, DOC_PATH)} (${res.result})`);
    process.exit(res.result === 'PASS' ? 0 : 2);
  }

  if (has('--check')) {
    const res = await check();
    process.exit(res.result === 'PASS' ? 0 : 2);
  }

  if (has('--all') || has('--build')) {
    buildWasm();
    await localDeterminismCheck();
  }
  if (has('--all') || has('--publish')) {
    await publish();
  }
  if (has('--all') || has('--execute')) {
    await execute();
  }
  if (has('--all') || has('--verify')) {
    const state = loadState();
    if (state.execution?.requestId != null && state.execution?.success) {
      // Refresh the attestation evidence from the live API while it is still served.
      await captureAttestation(loadState(), state.execution.requestId, state.execution.requestTx);
    }
    const v = await verifyLive(loadState());
    if (v.problems.length) for (const p of v.problems) log(`  PROBLEM: ${p}`);
    if (v.notes.length) for (const n of v.notes) log(`  note: ${n}`);
    writeJson(path.join(EVIDENCE_DIR, 'live-verify.json'), {
      schema: 'mend.outlayer-live.live-verify.v1',
      checkedAt: nowIso(),
      rpc: RPC_URL,
      api: API_BASE,
      ...v,
    });
  }

  const res = await check();
  process.exit(res.result === 'PASS' ? 0 : 2);
}

main().catch((err) => {
  process.stderr.write(`\nFATAL: ${err?.stack ?? err}\n`);
  process.exit(1);
});

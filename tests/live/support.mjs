import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Repository root for the live-quality worktree. */
export const REPO_ROOT = path.resolve(HERE, '../..');

/**
 * The testnet deployment worker owns live-state.json in the sibling worktree.
 * Override MEND_LIVE_STATE when the deployment lives somewhere else.
 */
export const LIVE_STATE_PATH =
  process.env.MEND_LIVE_STATE ??
  (existsSync(path.resolve(REPO_ROOT, 'infra', 'testnet', 'live-state.json'))
    ? path.resolve(REPO_ROOT, 'infra', 'testnet', 'live-state.json')
    : path.resolve(REPO_ROOT, '..', 'testnet', 'infra', 'testnet', 'live-state.json'));

/**
 * Human-managed testnet keys live outside every repository. Only the path is
 * ever used here; the file contents are never read by the quality suite.
 */
export const KEYS_FILE =
  process.env.MEND_TESTNET_KEYS_FILE ?? path.resolve(os.homedir(), '.mend', 'testnet', 'keys.json');

export const DEFAULT_RPC_URL = 'https://rpc.testnet.fastnear.com';
export const HUB_ACCOUNT = process.env.MEND_HUB_ACCOUNT ?? 'mend-hub.testnet';
export const TOKEN_ACCOUNT = process.env.MEND_TOKEN_ACCOUNT ?? 'mend-usdc.testnet';
export const EXPLORER = 'https://explorer.testnet.near.org';

/** API checks use their own port so the Playwright webServer can own 4311. */
export const API_PORT = Number(process.env.MEND_LIVE_API_PORT ?? 4312);
export const API_URL = `http://127.0.0.1:${API_PORT}`;

export function readLiveState() {
  if (!existsSync(LIVE_STATE_PATH)) return undefined;
  return JSON.parse(readFileSync(LIVE_STATE_PATH, 'utf8'));
}

export function redact(value) {
  return String(value)
    .replace(/ed25519:[A-Za-z0-9]+/g, 'ed25519:[redacted]')
    .replace(/("(?:secretKey|privateKey|seedPhrase)"\s*:\s*)"[^"]*"/gi, '$1"[redacted]"');
}

/** Assert a response/document does not leak a private key or seed phrase. */
export function assertNoSecretMaterial(text, label = 'payload') {
  assert.doesNotMatch(text, /ed25519:[1-9A-HJ-NP-Za-km-z]{32,}/, `${label} must not contain a private key`);
  assert.doesNotMatch(
    text,
    /"(?:secretKey|privateKey|seedPhrase)"\s*:\s*"[^"]+"/i,
    `${label} must not contain secretKey/privateKey/seedPhrase values`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * JSON-RPC helper with bounded retries for the public testnet RPC. Top-level
 * JSON-RPC errors are surfaced; contract-level errors are returned by viewCall.
 */
export async function rpc(method, params, { rpcUrl = DEFAULT_RPC_URL, retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: String(attempt + 1), method, params }),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      const payload = JSON.parse(text);
      if (payload.error) {
        const message = JSON.stringify(payload.error);
        if (/rate|too many|429|timeout/i.test(message)) throw new Error(message);
        throw Object.assign(new Error(message), { rpcError: payload.error });
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

/**
 * Call a view method. Set allowFailure to receive a contract panic as data
 * instead of an exception (used to prove nft_transfer is disabled).
 */
export async function viewCall(accountId, methodName, args, options = {}) {
  const payload = await rpc(
    'query',
    {
      request_type: 'call_function',
      finality: 'final',
      account_id: accountId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
    },
    options,
  );
  const result = payload.result;
  if (!result) throw new Error(`${methodName} returned no result`);
  if (result.error) {
    if (options.allowFailure) {
      return { ok: false, error: String(result.error), logs: result.logs ?? [] };
    }
    throw new Error(`${methodName} failed: ${result.error}`);
  }
  const text = Buffer.from(result.result ?? []).toString('utf8');
  return { ok: true, value: JSON.parse(text), logs: result.logs ?? [] };
}

export async function txStatus(hash, senderAccountId, options = {}) {
  const payload = await rpc(
    'tx',
    { tx_hash: hash, sender_account_id: senderAccountId, wait_until: 'FINAL' },
    options,
  );
  if (!payload.result) throw new Error(`tx ${hash} returned no result`);
  return payload.result;
}

export function txSucceeded(result) {
  const status = result?.status;
  if (!status || status.Failure) return false;
  return (
    Object.prototype.hasOwnProperty.call(status, 'SuccessValue') ||
    Object.prototype.hasOwnProperty.call(status, 'SuccessReceiptId')
  );
}

/** Extract NEP-141 ft_transfer event payloads from a transaction result. */
export function ftTransferEvents(result) {
  const events = [];
  for (const receipt of result?.receipts_outcome ?? []) {
    for (const log of receipt?.outcome?.logs ?? []) {
      if (!log.startsWith('EVENT_JSON:')) continue;
      try {
        const parsed = JSON.parse(log.slice('EVENT_JSON:'.length));
        if (parsed?.standard === 'nep141' && parsed?.event === 'ft_transfer') {
          for (const item of parsed.data ?? []) events.push(item);
        }
      } catch {
        // Ignore logs that are not JSON events.
      }
    }
  }
  return events;
}

/** Every transaction hash referenced outside live-state.transactions. */
export function collectReferencedHashes(state) {
  const hashes = new Set();
  const add = (value) => {
    if (typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(value)) hashes.add(value);
  };
  const workOrder = state?.workOrder ?? {};
  for (const key of [
    'awardTx',
    'createTx',
    'authorizeTx',
    'fundTx',
    'openBiddingTx',
    'closeBiddingTx',
    'scoreTx',
    'startWorkTx',
    'completionSubmitTx',
    'completionAcceptTx',
    'durabilityTx',
  ]) {
    add(workOrder[key]);
  }
  for (const bid of state?.lifecycle?.bids ?? []) {
    add(bid.commitmentTx);
    add(bid.revealTx);
  }
  add(state?.lifecycle?.score?.recordTx);
  for (const evidence of state?.lifecycle?.evidence ?? []) add(evidence.tx);
  for (const inspection of state?.lifecycle?.inspections ?? []) add(inspection.tx);
  for (const transaction of state?.transactions ?? []) add(transaction.hash);
  return [...hashes];
}

#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Account, KeyPair } from 'near-api-js';
import {
  AGENT_FORBIDDEN_METHODS,
  AGENT_KEY_METHODS,
  ALLOWANCE_NEAR,
  ALLOWANCE_YOCTO,
  HUB_ACCOUNT,
  NETWORK,
  RPC_URL,
  SCOPED_KEY_TARGETS,
} from './key-policy.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_KEYS_PATH = '/Volumes/sandisk/Users/dc/.mend/testnet/keys.json';
const DEFAULT_SCOPED_PATH = '/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json';
const KEYS_PATH = process.env.MEND_KEYS_PATH ?? DEFAULT_KEYS_PATH;
const SCOPED_PATH = process.env.MEND_SCOPED_KEYS_PATH ?? DEFAULT_SCOPED_PATH;
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const FORCE = args.includes('--force');
const PRUNE = args.includes('--prune');
const HELP = args.includes('--help') || args.includes('-h');

function usage() {
  console.log(`Usage: node scripts/live-agents/provision-scoped-keys.mjs [--check] [--force] [--prune]

  (default)  create one scoped function-call key per agent account
  --check    verify the stored scoped keys against live RPC; never writes
  --force    replace the stored key pair even when the old key still verifies
  --prune    delete stale hub function-call keys not present in scoped-keys.json

Paths (outside the repo):
  keys:        ${KEYS_PATH}
  scoped keys: ${SCOPED_PATH}

Both files must be outside the repository and chmod 600. Secrets are never printed.`);
}

function fail(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}

function assertOutsideRepo(path, label) {
  const absolute = resolve(path);
  if (absolute === REPO_ROOT || absolute.startsWith(`${REPO_ROOT}/`)) {
    fail(`${label} must live outside the repository: ${absolute}`);
  }
  return absolute;
}

function assertPrivateMode(path, label) {
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600) fail(`${label} must be chmod 600 (found ${mode.toString(8)}): ${path}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sanitize(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{60,}/g, 'ed25519:[REDACTED]')
    .replace(/\n\s+at .*/g, '');
}

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'mend-scoped-keys', method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? body.error.name ?? 'RPC error');
  if (body.result?.error) throw new Error(body.result.error);
  return body.result;
}

async function viewAccount(accountId) {
  try {
    return await rpc('query', { request_type: 'view_account', finality: 'final', account_id: accountId });
  } catch (error) {
    if (/UNKNOWN_ACCOUNT|does not exist/i.test(sanitize(error))) return null;
    throw error;
  }
}

async function viewAccessKey(accountId, publicKey) {
  const result = await rpc('query', {
    request_type: 'view_access_key',
    finality: 'final',
    account_id: accountId,
    public_key: publicKey,
  });
  if (process.env.MEND_DEBUG_KEYS === '1') console.error(`DEBUG raw=${JSON.stringify(result)}`);
  // Raw RPC omits the public key and nests permission at the top level.
  return {
    public_key: publicKey,
    access_key: {
      nonce: result.nonce,
      permission: result.permission,
    },
  };
}

async function viewAccessKeys(accountId) {
  const result = await rpc('query', {
    request_type: 'view_access_key_list',
    finality: 'final',
    account_id: accountId,
  });
  return result.keys ?? [];
}

function expectedMethods(role) {
  const methods = AGENT_KEY_METHODS[role];
  if (!methods || methods.length === 0) throw new Error(`no method list for role ${role}`);
  return methods;
}

/** Verifies one RPC view against the policy and the stored key entry. */
function verifyView(view, target, entry) {
  const errors = [];
  const expected = expectedMethods(target.role);
  const forbidden = AGENT_FORBIDDEN_METHODS[target.role];
  const permission = view?.access_key?.permission;

  if (view?.public_key !== entry.publicKey) errors.push('public key mismatch');
  if (permission === 'FullAccess') {
    errors.push('key is full access');
    return { ok: false, errors, methods: [], allowance: null, receiver: null };
  }
  const fc = permission?.FunctionCall;
  if (!fc) {
    errors.push('key is not function-call scoped');
    return { ok: false, errors, methods: [], allowance: null, receiver: null };
  }
  if (fc.receiver_id !== HUB_ACCOUNT) errors.push(`receiver is ${fc.receiver_id}`);
  const actual = [...(fc.method_names ?? [])].sort();
  const wanted = [...expected].sort();
  if (actual.length === 0) errors.push('empty method list');
  if (actual.join('|') !== wanted.join('|')) errors.push(`methods are ${actual.join(',') || '(none)'}`);
  const overlap = actual.filter((method) => forbidden.includes(method));
  if (overlap.length > 0) errors.push(`forbidden methods: ${overlap.join(',')}`);
  if (fc.allowance === null) {
    errors.push('unlimited allowance');
  } else {
    const allowance = BigInt(fc.allowance);
    if (allowance <= 0n) errors.push('non-positive allowance');
    if (allowance > BigInt(ALLOWANCE_YOCTO)) errors.push(`allowance ${allowance} exceeds ${ALLOWANCE_YOCTO}`);
  }
  return { ok: errors.length === 0, errors, methods: [...(fc.method_names ?? [])], allowance: fc.allowance, receiver: fc.receiver_id };
}

function fmtAllowance(yocto) {
  if (yocto === null || yocto === undefined) return 'unlimited';
  const value = BigInt(yocto);
  const whole = value / 10n ** 24n;
  const frac = (value % 10n ** 24n).toString().padStart(24, '0').replace(/0+$/, '');
  return `${whole}${frac ? `.${frac}` : ''} NEAR`;
}

async function waitForKey(accountId, publicKey, attempts = 8) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await viewAccessKey(accountId, publicKey);
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500 * (i + 1)));
    }
  }
  throw new Error(`key ${publicKey} not visible on ${accountId} after ${attempts} attempts`);
}

function atomicWritePrivate(path, value) {
  const data = `${JSON.stringify(value, null, 2)}\n`;
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, data, { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
  chmodSync(path, 0o600);
}

async function loadScopedFile() {
  if (!existsSync(SCOPED_PATH)) return null;
  assertPrivateMode(SCOPED_PATH, 'scoped-keys file');
  const parsed = readJson(SCOPED_PATH);
  if (!parsed.accounts || typeof parsed.accounts !== 'object') {
    fail(`scoped-keys file has no accounts map: ${SCOPED_PATH}`);
  }
  return parsed;
}

async function check() {
  const scoped = await loadScopedFile();
  if (!scoped) fail(`scoped-keys file does not exist: ${SCOPED_PATH}; run without --check first`);
  let passed = 0;
  let failed = 0;
  for (const target of SCOPED_KEY_TARGETS) {
    const entry = scoped.accounts[target.accountId];
    if (!entry) {
      console.log(`FAIL ${target.accountId} role=${target.role} reason=no stored scoped key`);
      failed += 1;
      continue;
    }
    if (entry.role !== target.role) {
      console.log(`FAIL ${target.accountId} reason=role ${entry.role} != ${target.role}`);
      failed += 1;
      continue;
    }
    try {
      const view = await viewAccessKey(target.accountId, entry.publicKey);
      const result = verifyView(view, target, entry);
      if (!result.ok) {
        console.log(
          `FAIL ${target.accountId} role=${target.role} key=${entry.publicKey} reason=${result.errors.join('; ')}`,
        );
        failed += 1;
        continue;
      }
      const forbidden = AGENT_FORBIDDEN_METHODS[target.role];
      const claimed = result.methods.filter((method) => forbidden.includes(method));
      console.log(
        `PASS ${target.accountId} role=${target.role} key=${entry.publicKey} receiver=${result.receiver} ` +
          `allowance=${fmtAllowance(result.allowance)} methods=${result.methods.join(',')} ` +
          `forbidden_claimed=${claimed.length === 0 ? 'none' : claimed.join(',')}`,
      );
      passed += 1;
    } catch (error) {
      console.log(`FAIL ${target.accountId} role=${target.role} reason=${sanitize(error)}`);
      failed += 1;
    }
  }
  console.log(`SUMMARY check passed=${passed} failed=${failed} total=${SCOPED_KEY_TARGETS.length}`);
  if (failed > 0) process.exit(1);
}

async function provision() {
  if (!existsSync(KEYS_PATH)) fail(`keys file does not exist: ${KEYS_PATH}`);
  assertPrivateMode(KEYS_PATH, 'keys file');
  const sourceKeys = readJson(KEYS_PATH);
  const scoped = (await loadScopedFile()) ?? {
    version: 1,
    network: NETWORK,
    hubAccount: HUB_ACCOUNT,
    rpcUrl: RPC_URL,
    createdAt: new Date().toISOString(),
    accounts: {},
  };

  for (const target of SCOPED_KEY_TARGETS) {
    const source = sourceKeys[target.accountId];
    if (!source?.secretKey) {
      console.log(`MISSING_ACCOUNT ${target.accountId} no secret in ${KEYS_PATH}`);
      process.exitCode = 1;
      continue;
    }
    if (!(await viewAccount(target.accountId))) {
      console.log(`MISSING_ACCOUNT ${target.accountId} not found on ${NETWORK}`);
      process.exitCode = 1;
      continue;
    }

    const existing = scoped.accounts[target.accountId];
    if (existing && !FORCE) {
      try {
        const view = await viewAccessKey(target.accountId, existing.publicKey);
        const result = verifyView(view, target, existing);
        if (result.ok) {
          console.log(
            `SKIP ${target.accountId} role=${target.role} key=${existing.publicKey} verified=true ` +
              `methods=${result.methods.join(',')}`,
          );
          continue;
        }
      } catch {
        // Fall through and add a fresh key; the old key is not visible.
      }
    }

    const keyPair = KeyPair.fromRandom('ed25519');
    const publicKey = keyPair.getPublicKey().toString();
    const secretKey = keyPair.toString();
    const methods = expectedMethods(target.role);
    const account = new Account(target.accountId, RPC_URL, source.secretKey);
    let response;
    try {
      response = await account.addFunctionCallAccessKey({
        publicKey,
        contractId: HUB_ACCOUNT,
        methodNames: methods,
        allowance: ALLOWANCE_YOCTO,
      });
    } catch (error) {
      console.log(`FAIL ${target.accountId} add-key failed: ${sanitize(error)}`);
      process.exitCode = 1;
      continue;
    }
    const view = await waitForKey(target.accountId, publicKey);
    const entry = {
      accountId: target.accountId,
      role: target.role,
      publicKey,
      secretKey,
      receiverId: HUB_ACCOUNT,
      methodNames: methods,
      allowanceYocto: ALLOWANCE_YOCTO,
      allowanceNear: ALLOWANCE_NEAR,
      addedAt: new Date().toISOString(),
      txHash: response?.transaction?.hash ?? response?.transaction_outcome?.id ?? null,
    };
    const result = verifyView(view, target, entry);
    if (!result.ok) {
      console.log(`FAIL ${target.accountId} post-add verification: ${result.errors.join('; ')}`);
      process.exitCode = 1;
      continue;
    }
    scoped.accounts[target.accountId] = entry;
    scoped.updatedAt = new Date().toISOString();
    atomicWritePrivate(SCOPED_PATH, scoped);
    console.log(
      `ADD ${target.accountId} role=${target.role} key=${publicKey} receiver=${HUB_ACCOUNT} ` +
        `allowance=${ALLOWANCE_NEAR} NEAR methods=${methods.join(',')} tx=${entry.txHash ?? 'pending'}`,
    );
  }

  if (PRUNE) {
    for (const target of SCOPED_KEY_TARGETS) {
      const source = sourceKeys[target.accountId];
      if (!source?.secretKey) continue;
      const keep = scoped.accounts[target.accountId]?.publicKey;
      const keys = await viewAccessKeys(target.accountId);
      for (const key of keys) {
        const fc = key.access_key?.permission?.FunctionCall;
        if (!fc || fc.receiver_id !== HUB_ACCOUNT) continue;
        if (keep && key.public_key === keep) continue;
        const account = new Account(target.accountId, RPC_URL, source.secretKey);
        await account.deleteKey(key.public_key);
        console.log(`PRUNE ${target.accountId} removed_stale_key=${key.public_key}`);
      }
    }
  }

  console.log(`SUMMARY provisioned=${Object.keys(scoped.accounts).length} file=${SCOPED_PATH}`);
}

if (HELP) {
  usage();
  process.exit(0);
}

assertOutsideRepo(KEYS_PATH, 'keys file');
assertOutsideRepo(SCOPED_PATH, 'scoped-keys file');
mkdirSync(dirname(SCOPED_PATH), { recursive: true, mode: 0o700 });

try {
  if (CHECK_ONLY) await check();
  else await provision();
} catch (error) {
  fail(sanitize(error));
}

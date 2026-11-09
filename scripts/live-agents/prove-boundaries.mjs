#!/usr/bin/env node
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Account, actions } from 'near-api-js';
import {
  BOUNDARY_TARGETS,
  HUB_ACCOUNT,
  RPC_URL,
  SCOPED_KEY_TARGETS,
} from './key-policy.mjs';

const SCOPED_PATH = process.env.MEND_SCOPED_KEYS_PATH ?? '/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json';
const EVIDENCE_PATH = process.env.MEND_BOUNDARY_EVIDENCE ?? resolve('scripts/live-agents/boundary-proof.json');
const GAS = 30_000_000_000_000n;

function sanitize(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{60,}/g, 'ed25519:[REDACTED]')
    .replace(/\s+at .*/g, '')
    .trim();
}

function isKeyRejection(message) {
  return /access key|AccessKey|does not have permission|MethodNotAllowed|not allowed|permission/i.test(message);
}

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'mend-boundaries', method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? body.error.name ?? 'RPC error');
  if (body.result?.error) throw new Error(body.result.error);
  return body.result;
}

function table(rows) {
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => String(row[index]).length)));
  return rows.map((row) => row.map((cell, index) => String(cell).padEnd(widths[index])).join('  ')).join('\n');
}

if (!existsSync(SCOPED_PATH)) {
  console.error(`ERROR scoped-keys file does not exist: ${SCOPED_PATH}`);
  process.exit(1);
}
const mode = statSync(SCOPED_PATH).mode & 0o777;
if (mode !== 0o600) {
  console.error(`ERROR scoped-keys file must be chmod 600 (found ${mode.toString(8)})`);
  process.exit(1);
}
const scoped = JSON.parse(readFileSync(SCOPED_PATH, 'utf8'));

const representative = new Map();
for (const target of SCOPED_KEY_TARGETS) {
  if (!representative.has(target.role)) representative.set(target.role, target);
}

const results = [];
for (const [role, target] of representative) {
  const entry = scoped.accounts[target.accountId];
  if (!entry) {
    console.error(`ERROR no scoped key for ${target.accountId}`);
    process.exitCode = 1;
    continue;
  }
  const view = await rpc('query', {
    request_type: 'view_access_key',
    finality: 'final',
    account_id: target.accountId,
    public_key: entry.publicKey,
  });
  const fc = view.permission?.FunctionCall;
  console.log(
    `SCOPE ${target.accountId} key=${entry.publicKey} receiver=${fc?.receiver_id ?? '?'} ` +
      `methods=${(fc?.method_names ?? []).join(',')}`,
  );
  for (const method of BOUNDARY_TARGETS[role]) {
    const account = new Account(target.accountId, RPC_URL, entry.secretKey);
    try {
      await account.signAndSendTransaction({
        receiverId: HUB_ACCOUNT,
        actions: [actions.functionCall(method, {}, GAS, 0n)],
        waitUntil: 'FINAL',
      });
      results.push({ accountId: target.accountId, role, method, status: 'ALLOWED_UNEXPECTEDLY', error: null });
      console.log(`FAIL ${target.accountId} ${method} was allowed`);
      process.exitCode = 1;
    } catch (error) {
      const message = sanitize(error);
      const rejected = isKeyRejection(message);
      results.push({
        accountId: target.accountId,
        role,
        method,
        status: rejected ? 'REJECTED_BY_KEY' : 'REJECTED_OTHER',
        error: message,
      });
      console.log(
        `${rejected ? 'REJECTED' : 'REJECTED_OTHER'} ${target.accountId} ${method} error="${message}"`,
      );
      if (!rejected) process.exitCode = 1;
    }
  }
}

console.log('');
console.log(
  table([
    ['ACCOUNT', 'ROLE', 'FORBIDDEN METHOD', 'RESULT'],
    ...results.map((result) => [result.accountId, result.role, result.method, result.status]),
  ]),
);
const rejectedByKey = results.filter((result) => result.status === 'REJECTED_BY_KEY').length;
console.log(`SUMMARY rejected_by_key=${rejectedByKey} total=${results.length}`);
writeFileSync(
  EVIDENCE_PATH,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      network: 'testnet',
      hubAccount: HUB_ACCOUNT,
      rpcUrl: RPC_URL,
      note: 'A rejected transaction is evidence that the access-key scope is enforced by the network.',
      results,
    },
    null,
    2,
  )}\n`,
  { mode: 0o644 },
);
chmodSync(EVIDENCE_PATH, 0o644);
console.log(`EVIDENCE ${EVIDENCE_PATH}`);
if (rejectedByKey !== results.length) process.exitCode = 1;

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Plain `node` cannot import the TypeScript workspace sources directly on every
 * supported Node version. Re-exec once with the repo's tsx loader, then use the
 * real agent code instead of duplicating hashing or bid payloads here.
 */
if (process.env.MEND_LIVE_TSX !== '1') {
  const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, MEND_LIVE_TSX: '1' },
  });
  process.exit(child.status ?? 1);
}

const { Account, actions } = await import('near-api-js');
const {
  buildCanonicalLiveBidPlans,
  loadContractorLiveConfig,
  readContractorKeyMaterial,
} = await import('@mend/contractor-agent');
const { HUB_ACCOUNT, RPC_URL } = await import('./key-policy.mjs');

const args = process.argv.slice(2);
const send = args.includes('--send');
const workOrderId =
  (args.includes('--work-order') ? args[args.indexOf('--work-order') + 1] : undefined) ??
  process.env.MEND_WORK_ORDER_ID ??
  'WO-BENCH-001-0001';

const config = loadContractorLiveConfig(process.env);
const plans = buildCanonicalLiveBidPlans({ workOrderId, accounts: config.accounts });

function printPlan(plan) {
  console.log(`\n[${plan.strategy}] ${plan.accountId} availableInDays=${plan.bid.availableInDays}`);
  console.log(`  bid_input: ${JSON.stringify(plan.bid)}`);
  console.log(`  commitment_hash: ${plan.commitmentHash}`);
  console.log(`  commit_payload: ${JSON.stringify(plan.commit.args)}`);
  console.log(`  reveal_payload: ${JSON.stringify(plan.reveal.args)}`);
}

console.log(`WORK_ORDER ${workOrderId}`);
console.log(`HUB ${HUB_ACCOUNT}`);
console.log(`NETWORK ${config.network}`);
console.log(`KEY_PATH ${config.keyPath ?? '(not set; dry run only)'}`);
console.log(`MODE ${send ? 'SEND_IF_BIDDING_OPEN' : 'DRY_RUN'}`);
for (const plan of plans) printPlan(plan);

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'mend-agent-dry', method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? 'RPC error');
  return body.result;
}

async function viewWorkOrder() {
  const result = await rpc('query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: HUB_ACCOUNT,
    method_name: 'get_work_order',
    args_base64: Buffer.from(JSON.stringify({ work_order_id: workOrderId }), 'utf8').toString('base64'),
  });
  if (result.error) return null;
  const text = Buffer.from(result.result ?? [], 'utf8').toString('utf8');
  return text.length === 0 ? null : JSON.parse(text);
}

if (!send) {
  console.log('\nDRY_RUN complete: payloads and hashes above were not sent.');
  process.exit(0);
}

const workOrder = await viewWorkOrder();
if (!workOrder) {
  console.log(`SEND_SKIPPED reason=work_order_not_found workOrder=${workOrderId}`);
  process.exit(0);
}
if (workOrder.status !== 'BIDDING_OPEN') {
  console.log(`SEND_SKIPPED reason=work_order_status_${workOrder.status} workOrder=${workOrderId}`);
  process.exit(0);
}
if (!config.keyPath) {
  console.log('SEND_SKIPPED reason=MEND_CONTRACTOR_KEY_PATH_not_set');
  process.exit(0);
}
if (!existsSync(config.keyPath)) {
  console.log(`SEND_SKIPPED reason=key_path_missing path=${config.keyPath}`);
  process.exit(0);
}
if ((statSync(config.keyPath).mode & 0o777) !== 0o600) {
  console.log(`SEND_SKIPPED reason=key_path_not_600 path=${config.keyPath}`);
  process.exit(0);
}

const nowSeconds = Math.floor(Date.now() / 1000);
let phase;
if (nowSeconds < Number(workOrder.commit_deadline)) phase = 'commit';
else if (nowSeconds < Number(workOrder.reveal_deadline)) phase = 'reveal';
else {
  console.log(`SEND_SKIPPED reason=both_deadlines_passed commit=${workOrder.commit_deadline} reveal=${workOrder.reveal_deadline}`);
  process.exit(0);
}
console.log(`\nSEND phase=${phase} commit_deadline=${workOrder.commit_deadline} reveal_deadline=${workOrder.reveal_deadline}`);

for (const plan of plans) {
  const material = readContractorKeyMaterial(config.keyPath, plan.accountId);
  const account = new Account(plan.accountId, RPC_URL, material.secretKey);
  const payload = phase === 'commit' ? plan.commit : plan.reveal;
  try {
    const response = await account.signAndSendTransaction({
      receiverId: HUB_ACCOUNT,
      actions: [actions.functionCall(payload.method, payload.args, 60_000_000_000_000n, 0n)],
      waitUntil: 'FINAL',
    });
    const hash = response?.transaction?.hash ?? response?.transaction_outcome?.id ?? 'unknown';
    console.log(`SENT ${plan.accountId} ${payload.method} tx=${hash}`);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{60,}/g, 'ed25519:[REDACTED]')
      .split('\n')[0];
    console.log(`SEND_FAILED ${plan.accountId} ${payload.method} error=${message}`);
    process.exitCode = 1;
  }
}

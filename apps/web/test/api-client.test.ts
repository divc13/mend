import assert from 'node:assert/strict';
import test from 'node:test';
import {
  apiFetch,
  checkApiHealth,
  clearDemoIdentity,
  isDemoAccount,
  storeDemoIdentity,
} from '../src/lib/api';

const storage = new Map<string, string>();
const calls: Array<{ url: string; headers: Record<string, string> }> = [];

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { origin: 'https://mend.example' },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
    },
  },
});

function mockResponse(payload: unknown, status = 200) {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = async (input, init = {}) => {
    calls.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init.headers).entries()),
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function reset() {
  storage.clear();
  calls.length = 0;
}

test('demo headers attach only to same-origin /api/mend calls and cannot be overridden', async () => {
  reset();
  assert.equal(storeDemoIdentity({ role: 'STEWARD', account: 'mend-steward.testnet' }), true);
  mockResponse({ ok: true });

  const result = await apiFetch('/v1/assets', {
    headers: { 'x-mend-role': 'ADMIN', 'x-mend-account': 'attacker.testnet' },
  });
  assert.equal(result.ok, true);
  assert.equal(calls[0]?.url, 'https://mend.example/api/mend/v1/assets');
  assert.equal(calls[0]?.headers['x-mend-role'], 'STEWARD');
  assert.equal(calls[0]?.headers['x-mend-account'], 'mend-steward.testnet');

  const absolute = await apiFetch('https://evil.example/steal');
  assert.equal(absolute.ok, false);
  assert.equal(absolute.code, 'PROXY_ONLY');

  const protocolRelative = await apiFetch('//evil.example/steal');
  assert.equal(protocolRelative.ok, false);
  assert.equal(protocolRelative.code, 'PROXY_ONLY');
  assert.equal(calls.length, 1);

  clearDemoIdentity();
  await apiFetch('/health');
  assert.equal(calls.at(-1)?.headers['x-mend-role'], undefined);
  assert.equal(calls.at(-1)?.headers['x-mend-account'], undefined);
});

test('health reports live only when the API mode is LIVE_TESTNET and not degraded', async () => {
  reset();
  mockResponse({
    status: 'ok',
    mode: 'LIVE_TESTNET',
    service: 'mend-api',
    database: 'reachable',
    testnet: { liveScenarioEnabled: false, roleAccounts: { steward: 'mend-steward.testnet' } },
  });

  const live = await checkApiHealth();
  assert.equal(live.ok, true);
  assert.equal(live.mode, 'LIVE_TESTNET');
  assert.equal(live.liveScenarioEnabled, false);
  assert.equal(live.roleAccounts?.steward, 'mend-steward.testnet');

  mockResponse({ status: 'ok', mode: 'REPLAY' });
  const replay = await checkApiHealth();
  assert.equal(replay.ok, false);
  assert.equal(replay.mode, 'REPLAY');

  mockResponse({ status: 'degraded', mode: 'LIVE_TESTNET' });
  const degraded = await checkApiHealth();
  assert.equal(degraded.ok, false);
  assert.equal(degraded.mode, 'LIVE_TESTNET');

  mockResponse({ error: { code: 'API_UNCONFIGURED', message: 'not configured' } }, 503);
  const missing = await checkApiHealth();
  assert.equal(missing.ok, false);
  assert.equal(missing.mode, 'UNKNOWN');
  assert.equal(missing.httpStatus, 503);
});

test('demo accounts are testnet-only', () => {
  assert.equal(isDemoAccount('mend-steward.testnet'), true);
  assert.equal(isDemoAccount('mend-steward.near'), false);
  assert.equal(isDemoAccount('MEND-STEWARD.testnet'), false);
  assert.equal(isDemoAccount('not an account'), false);
});

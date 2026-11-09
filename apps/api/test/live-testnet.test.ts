import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import type { LiveChainCallOptions, LiveChainExecutor, LiveChainTx, SignerDirectory } from '../src/services/testnet-chain.js';
import { LiveChainTxFailure, NearLiveChain } from '../src/services/testnet-chain.js';
import { LiveRpcChainAdapter, liveHubArgs, type ChainIntentInput } from '../src/services/chain.js';
import { sha256Hex } from '@mend/protocol';
import {
  NearTestnetOnboarding,
  TESTNET_FAUCET_WARNING,
  TESTNET_WALLET_WARNING,
  parseWalletCliOutput,
  sanitizeCliOutput,
  type TestnetOnboarding,
} from '../src/services/testnet-onboarding.js';
import { LiveScenarioRunner } from '../src/services/live-scenario.js';
import { MemoryRepository } from '@mend/db';
import { makeTestApp, testClock, call } from './helpers.js';

const ROLE_ACCOUNTS = {
  deployer: 'mend-deployer.testnet',
  steward: 'mend-steward.testnet',
  sponsor: 'mend-sponsor.testnet',
  dao: 'mend-dao.testnet',
  contractor: 'mend-contractor-a.testnet',
  inspector: 'mend-inspector.testnet',
  admin: 'mend-deployer.testnet',
};

function liveConfig(extra: Record<string, string | undefined> = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    MEND_MODE: 'LIVE_TESTNET',
    CHAIN_ADAPTER: 'live',
    MEND_HUB_ACCOUNT: 'mend-hub.testnet',
    MEND_TOKEN_ACCOUNT: 'mend-usdc.testnet',
    MEND_RPC_URL: 'https://rpc.testnet.near.org',
    MEND_TESTNET_KEYS_FILE: '/tmp/mend-test-keys-does-not-exist.json',
    MEND_TESTNET_WALLET_ENABLED: 'true',
    MEND_TESTNET_FAUCET_ENABLED: 'true',
    MEND_LIVE_SCENARIO_ENABLED: 'true',
    EVIDENCE_URL_SECRET: 'test-only-evidence-secret',
    DEMO_DURABILITY_MINUTES: '2',
    ...extra,
  });
}

interface RecordedCall {
  signer: string;
  receiver: string;
  method: string;
  args: Record<string, unknown>;
  options: LiveChainCallOptions;
}

class FakeLiveChain implements LiveChainExecutor {
  readonly available = true;
  readonly network = 'testnet' as const;
  readonly hubAccount = 'mend-hub.testnet';
  readonly tokenAccount = 'mend-usdc.testnet';
  readonly calls: RecordedCall[] = [];
  readonly accounts = new Set(Object.values(ROLE_ACCOUNTS));
  readonly roles: Record<string, string[]> = {
    'mend-steward.testnet': ['STEWARD'],
    'mend-contractor-a.testnet': ['CONTRACTOR'],
    'mend-inspector.testnet': ['INSPECTOR'],
  };
  readonly balances = new Map<string, string>([
    ['mend-deployer.testnet', '100000000000'],
    ['mend-sponsor.testnet', '500000000'],
  ]);
  readonly storage = new Set<string>([
    'mend-deployer.testnet',
    'mend-sponsor.testnet',
    'mend-hub.testnet',
  ]);
  failOnMethod?: string;
  detectBidPayloadVersion?: () => Promise<'v1' | 'v2' | undefined>;
  private counter = 0;

  readonly keys: SignerDirectory = {
    has: (accountId: string) => this.accounts.has(accountId),
    accountIds: () => [...this.accounts].sort(),
  };

  async call(
    signerAccountId: string,
    receiverId: string,
    method: string,
    args: Record<string, unknown>,
    options: LiveChainCallOptions = {},
  ): Promise<LiveChainTx> {
    if (this.failOnMethod === method) {
      this.failOnMethod = undefined;
      throw new LiveChainTxFailure(`simulated chain failure on ${method}`);
    }
    this.calls.push({ signer: signerAccountId, receiver: receiverId, method, args, options });
    this.counter += 1;
    const txHash = `${this.counter.toString(16).padStart(64, '0')}`;
    return {
      txHash,
      explorerUrl: `https://explorer.testnet.near.org/transactions/${txHash}`,
      signer: signerAccountId,
      receiver: receiverId,
      method,
      realTransaction: true,
    };
  }

  async view<T = unknown>(receiverId: string, method: string, args: Record<string, unknown>): Promise<T> {
    if (method === 'get_config') {
      return {
        token: 'mend-usdc.testnet',
        dao: 'mend-dao.testnet',
        paused: false,
        durability_minutes: 0,
      } as T;
    }
    if (method === 'get_role') {
      const account = String(args.account ?? '');
      return (this.roles[account] ?? []) as T;
    }
    if (method === 'get_work_order') {
      return { status: 'CLOSED' } as T;
    }
    if (method === 'ft_balance_of') {
      return (this.balances.get(String(args.account_id ?? '')) ?? '0') as T;
    }
    if (method === 'storage_balance_of') {
      const account = String(args.account_id ?? '');
      return (this.storage.has(account) ? { total: '1', available: '0' } : null) as T;
    }
    return {} as T;
  }

  async accountExists(): Promise<boolean> {
    return true;
  }

  async ftBalance(accountId: string): Promise<string> {
    return this.balances.get(accountId) ?? '0';
  }

  async storageBalance(accountId: string) {
    return this.storage.has(accountId) ? { total: '1', available: '0' } : null;
  }
}

function fakeOnboarding(overrides: Partial<TestnetOnboarding> = {}): TestnetOnboarding & { counters: { create: number; faucet: number } } {
  const counters = { create: 0, faucet: 0 };
  const service = {
    available: true,
    counters,
    async createWallet() {
      counters.create += 1;
      return {
        accountId: 'mend-wone.testnet',
        publicKey: 'ed25519:11111111111111111111111111111111',
        secretKey: 'ed25519:5JsecretSECRETsecretSECRETsecretSECRETsecretSECRETsecretSECRETsecret',
        seedPhrase: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu',
        network: 'testnet' as const,
        warning: TESTNET_WALLET_WARNING,
        createdAt: '2026-11-10T09:00:00.000Z',
      };
    },
    async faucet(accountId: string) {
      counters.faucet += 1;
      return {
        accountId,
        amountMicro: '100000000',
        balanceMicro: '100000000',
        storageRegistered: true,
        txHash: 'abc123',
        explorerUrl: 'https://explorer.testnet.near.org/transactions/abc123',
        network: 'testnet' as const,
        warning: TESTNET_FAUCET_WARNING,
      };
    },
    async wallet(accountId: string) {
      return {
        accountId,
        network: 'testnet' as const,
        exists: true,
        balanceMicro: '100000000',
        storageRegistered: true,
        explorerUrl: `https://explorer.testnet.near.org/accounts/${accountId}`,
        warning: TESTNET_FAUCET_WARNING,
      };
    },
    ...overrides,
  };
  return service;
}

function intent(action: string, args: Record<string, unknown>): ChainIntentInput {
  return {
    id: 'CMD-0001',
    workOrderId: 'WO-BENCH-001-0001',
    action,
    method: action === 'fund' ? 'fund_work_order' : action,
    args,
    mode: 'LIVE_TESTNET',
  };
}

describe('LIVE_TESTNET role adapter', () => {
  it('signs funding with the sponsor role and returns the real testnet tx hash', async () => {
    const config = liveConfig();
    const chain = new FakeLiveChain();
    const adapter = new LiveRpcChainAdapter(chain, { ...config.chain, keysFile: '/outside/keys.json', signerConfigured: true });
    const result = await adapter.submit(intent('fund', {
      workOrderId: 'WO-BENCH-001-0001',
      amountMicro: '100000000',
      token: 'mend-usdc.testnet',
      sponsorId: 'mend-sponsor.testnet',
    }));
    expect(result.state).toBe('SUCCESS');
    expect(result.realTransaction).toBe(true);
    expect(result.txHash).toMatch(/^[a-f0-9]{64}$/);
    expect(chain.calls).toHaveLength(1);
    expect(chain.calls[0]?.signer).toBe('mend-sponsor.testnet');
    expect(chain.calls[0]?.receiver).toBe('mend-usdc.testnet');
    expect(chain.calls[0]?.method).toBe('ft_transfer_call');
    expect(chain.calls[0]?.args.msg).toBe('WO-BENCH-001-0001');
  });

  it('refuses when the action role signer is missing and never returns SUCCESS', async () => {
    const config = liveConfig();
    const chain = new FakeLiveChain();
    chain.accounts.delete('mend-contractor-a.testnet');
    const adapter = new LiveRpcChainAdapter(chain, { ...config.chain, keysFile: '/outside/keys.json', signerConfigured: true });
    const result = await adapter.submit(intent('start_work', { workOrderId: 'WO-BENCH-001-0001' }));
    expect(result.state).toBe('FAILED');
    expect(result.realTransaction).toBe(false);
    expect(result.txHash).toBeUndefined();
    expect(chain.calls).toHaveLength(0);
  });

  it('keeps an on-chain failure as FAILED, never executed', async () => {
    const config = liveConfig();
    const chain = new FakeLiveChain();
    chain.failOnMethod = 'open_bidding';
    const adapter = new LiveRpcChainAdapter(chain, { ...config.chain, keysFile: '/outside/keys.json', signerConfigured: true });
    const result = await adapter.submit(intent('open_bidding', { workOrderId: 'WO-BENCH-001-0001' }));
    expect(result.state).toBe('FAILED');
    expect(result.realTransaction).toBe(false);
  });

  it('maps nested ScoredRank fields to the hub camelCase JSON schema', () => {
    const args = liveHubArgs('record_score', {
      workOrderId: 'WO-BENCH-001-0001',
      policyHash: 'a'.repeat(64),
      wasmHash: 'b'.repeat(64),
      inputHash: 'c'.repeat(64),
      outputHash: 'd'.repeat(64),
      ranking: [{ rank: 1, bidId: 'BID-A', contractorId: 'mend-contractor-a.testnet', scoreBps: 9000 }],
    }, 'CMD-0001');
    expect(args.ranking).toEqual([{
      rank: 1,
      bidId: 'BID-A',
      contractorId: 'mend-contractor-a.testnet',
      scoreBps: 9000,
    }]);
  });

  it('refuses mainnet before signing anything', async () => {
    const config = liveConfig({ MEND_MODE: 'MAINNET' });
    const chain = new FakeLiveChain();
    chain.accounts.clear();
    const adapter = new LiveRpcChainAdapter(chain, { ...config.chain, keysFile: '/outside/keys.json', signerConfigured: true });
    const result = await adapter.submit(intent('fund', { workOrderId: 'X', amountMicro: '1' }));
    expect(result.state).toBe('INTENT');
    expect(result.realTransaction).toBe(false);
    expect(chain.calls).toHaveLength(0);
  });
});

describe('faucet CLI parsing and secret hygiene', () => {
  it('parses faucet output and never includes ANSI escapes', () => {
    const parsed = parseWalletCliOutput(`
\u001b[33mPublic Key: ed25519:9abcKEY\u001b[0m
SECRET KEYPAIR: ed25519:5JsecretKEY
Master Seed Phrase: alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
`, 'mend-wnew.testnet');
    expect(parsed.accountId).toBe('mend-wnew.testnet');
    expect(parsed.publicKey).toBe('ed25519:9abcKEY');
    expect(parsed.secretKey).toBe('ed25519:5JsecretKEY');
    expect(parsed.seedPhrase).toContain('alpha beta gamma');
  });

  it('sanitizes child output so a rate-limit error cannot leak a generated key', () => {
    const sanitized = sanitizeCliOutput('warning\nSECRET KEYPAIR: ed25519:5JsecretKEY\nseed phrase: alpha beta');
    expect(sanitized).not.toContain('5JsecretKEY');
    expect(sanitized).toContain('ed25519:[redacted]');
  });

  it('returns a clear 429 when the public faucet rate-limits account creation', async () => {
    const config = liveConfig({ MEND_NEAR_CLI_PATH: 'near' });
    const chain = new FakeLiveChain();
    const service = new NearTestnetOnboarding(
      chain,
      config,
      async () => ({
        exitCode: 1,
        stdout: 'The new account could not be created successfully.\nSECRET KEYPAIR: ed25519:5JsecretKEY',
        stderr: 'The faucet server failed with status code <429 Too Many Requests>',
      }),
      async () => {},
      () => new Date('2026-11-10T09:00:00.000Z'),
    );
    await expect(service.createWallet()).rejects.toMatchObject({
      code: 'RELAYER_RATE_LIMITED',
      details: { accountCreated: false, secretReturned: false },
    });
  });
});

describe('testnet routes', () => {
  it('returns the wallet secret exactly once and stores only account/public key', async () => {
    const config = liveConfig();
    const testnet = fakeOnboarding();
    const target = await makeTestApp({ config, testnet });
    try {
      const created = await call(target.app, 'POST', '/v1/testnet/wallet', { headers: { 'x-forwarded-for': '10.0.0.1' } });
      expect(created.status).toBe(201);
      expect(created.body.accountId).toBe('mend-wone.testnet');
      expect(created.body.secretKey).toMatch(/^ed25519:/);
      expect(created.body.warning).toContain('TESTNET ONLY');

      const stored = await target.deps.repo.getTestnetWallet('mend-wone.testnet');
      expect(stored?.publicKey).toBe('ed25519:11111111111111111111111111111111');
      expect(JSON.stringify(stored)).not.toContain(created.body.secretKey);
      expect(JSON.stringify(stored)).not.toContain('alpha beta gamma');

      const status = await call(target.app, 'GET', '/v1/testnet/wallet/mend-wone.testnet');
      expect(status.status).toBe(200);
      expect(status.body.balanceMicro).toBe('100000000');
      expect(status.body.publicKey).toBe(stored?.publicKey);
      expect(status.raw).not.toContain(created.body.secretKey);
      expect(status.raw).not.toContain('alpha beta gamma');

      const audit = await target.deps.repo.listAudit({ name: 'testnet_wallet_created' });
      expect(audit).toHaveLength(1);
      expect(JSON.stringify(audit)).not.toContain(created.body.secretKey);
      expect(JSON.stringify(audit)).not.toContain('alpha beta gamma');
    } finally {
      await target.close();
    }
  });

  it('returns a faucet tx hash and rate-limits the second faucet request', async () => {
    const config = liveConfig();
    const testnet = fakeOnboarding();
    const target = await makeTestApp({ config, testnet });
    try {
      const first = await call(target.app, 'POST', '/v1/testnet/faucet', {
        headers: { 'x-forwarded-for': '10.0.0.2' },
        body: { accountId: 'mend-wone.testnet' },
      });
      expect(first.status).toBe(200);
      expect(first.body.txHash).toBe('abc123');
      expect(first.body.balanceMicro).toBe('100000000');
      expect(first.body.warning).toContain('Testnet mUSDC has no real value');

      const second = await call(target.app, 'POST', '/v1/testnet/faucet', {
        headers: { 'x-forwarded-for': '10.0.0.2' },
        body: { accountId: 'mend-wone.testnet' },
      });
      expect(second.status).toBe(429);
      expect(second.body.error.code).toBe('RELAYER_RATE_LIMITED');
      expect(second.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    } finally {
      await target.close();
    }
  });

  it('runs the canonical live scenario with ordered real testnet tx hashes', async () => {
    const config = liveConfig({ MEND_LIVE_SCENARIO_COMMIT_SECONDS: '0', MEND_LIVE_SCENARIO_REVEAL_SECONDS: '0' });
    const clock = testClock();
    const chain = new FakeLiveChain();
    const repo = new MemoryRepository();
    const runner = new LiveScenarioRunner(chain, config, repo, async () => {}, () => clock.now());
    const target = await makeTestApp({ config, liveChain: chain, liveScenario: runner, repo, clock });
    try {
      const response = await call(target.app, 'POST', '/v1/live/run-scenario');
      expect(response.status).toBe(200);
      expect(response.body.scenario).toBe('canonicalRepair');
      expect(response.body.network).toBe('testnet');
      expect(response.body.steps.length).toBeGreaterThanOrEqual(14);
      expect(response.body.verification.finalStatus).toBe('CLOSED');
      expect(response.body.verification.contractVerified).toBe(true);
      for (const [index, step] of response.body.steps.entries()) {
        expect(step.index).toBe(index + 1);
        expect(step.status).toBe('SUCCESS');
        expect(step.txHash).toMatch(/^[a-f0-9]{64}$/);
        expect(step.explorerUrl).toBe(`https://explorer.testnet.near.org/transactions/${step.txHash}`);
      }
      expect(response.raw).not.toMatch(/ed25519:/);
      expect(response.body.steps.map((step: { label: string }) => step.label)).toContain('fund_work_order');
      expect(response.body.steps.map((step: { label: string }) => step.label)).toContain('inspect_durability');
      const commands = await repo.listChainCommands(undefined as never);
      expect(commands).toHaveLength(response.body.steps.length);
    } finally {
      await target.close();
    }
  });

  it('detects a deployed MEND_BID_V1 hub and commits the matching payload', async () => {
    const config = liveConfig({ MEND_LIVE_SCENARIO_COMMIT_SECONDS: '0', MEND_LIVE_SCENARIO_REVEAL_SECONDS: '0' });
    const clock = testClock();
    const chain = new FakeLiveChain();
    chain.detectBidPayloadVersion = async () => 'v1';
    const runner = new LiveScenarioRunner(chain, config, undefined, async () => {}, () => clock.now());
    const target = await makeTestApp({ config, liveChain: chain, liveScenario: runner, clock });
    try {
      const response = await call(target.app, 'POST', '/v1/live/run-scenario');
      expect(response.status).toBe(200);
      expect(response.body.bidPayloadVersion).toBe('v1');
      const commit = chain.calls.find((item) => item.method === 'commit_bid');
      const reveal = chain.calls.find((item) => item.method === 'reveal_bid');
      expect(commit).toBeTruthy();
      expect(reveal).toBeTruthy();
      // Rebuild the payload from the recorded reveal so this test fails if the
      // version or field order drifts.
      const payload = [
        'MEND_BID_V1',
        String(reveal?.args.bid_id),
        'mend-contractor-a.testnet',
        String(reveal?.args.price),
        String(reveal?.args.duration_days),
        String(reveal?.args.warranty_days),
        String(reveal?.args.materials_score),
        reveal?.args.checklist_accepted === true ? '1' : '0',
        String(reveal?.args.nonce),
      ].join('|');
      expect(commit?.args.commitment_hash).toBe(sha256Hex(payload));
    } finally {
      await target.close();
    }
  });

  it('refuses the live scenario when a role signer is missing, before any call', async () => {
    const config = liveConfig();
    const clock = testClock();
    const chain = new FakeLiveChain();
    chain.accounts.delete('mend-inspector.testnet');
    const runner = new LiveScenarioRunner(chain, config, undefined, async () => {}, () => clock.now());
    const target = await makeTestApp({ config, liveChain: chain, liveScenario: runner, clock });
    try {
      const response = await call(target.app, 'POST', '/v1/live/run-scenario');
      expect(response.status).toBe(503);
      expect(response.body.error.message).toContain('missing testnet signer');
      expect(response.body.error.details.missingSigners).toEqual([
        { role: 'inspector', account: 'mend-inspector.testnet' },
      ]);
      expect(chain.calls).toHaveLength(0);
    } finally {
      await target.close();
    }
  });

  it('refuses mainnet and keeps the live scenario disabled outside LIVE_TESTNET', async () => {
    const mainnet = loadConfig({ NODE_ENV: 'test', MEND_MODE: 'MAINNET', CHAIN_ADAPTER: 'live' });
    const target = await makeTestApp({ config: mainnet });
    try {
      const response = await call(target.app, 'POST', '/v1/live/run-scenario');
      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Mainnet is refused');
    } finally {
      await target.close();
    }

    const disabled = liveConfig({ MEND_LIVE_SCENARIO_ENABLED: 'false' });
    const chain = new FakeLiveChain();
    const target2 = await makeTestApp({ config: disabled, liveChain: chain });
    try {
      const response = await call(target2.app, 'POST', '/v1/live/run-scenario');
      expect(response.status).toBe(404);
      expect(chain.calls).toHaveLength(0);
    } finally {
      await target2.close();
    }
  });

  it('kill switch blocks wallet, faucet and live scenario mutations', async () => {
    const config = liveConfig({ MEND_LIVE_SCENARIO_COMMIT_SECONDS: '0', MEND_LIVE_SCENARIO_REVEAL_SECONDS: '0' });
    const clock = testClock();
    const chain = new FakeLiveChain();
    const testnet = fakeOnboarding();
    const runner = new LiveScenarioRunner(chain, config, undefined, async () => {}, () => clock.now());
    const target = await makeTestApp({ config, liveChain: chain, testnet, liveScenario: runner, clock });
    try {
      target.deps.killSwitch.set(true, 'operator test pause', 'admin.mend.testnet');
      const wallet = await call(target.app, 'POST', '/v1/testnet/wallet');
      const faucet = await call(target.app, 'POST', '/v1/testnet/faucet', { body: { accountId: 'mend-wone.testnet' } });
      const scenario = await call(target.app, 'POST', '/v1/live/run-scenario');
      expect(wallet.status).toBe(423);
      expect(faucet.status).toBe(423);
      expect(scenario.status).toBe(423);
      expect(testnet.counters.create).toBe(0);
      expect(testnet.counters.faucet).toBe(0);
      expect(chain.calls).toHaveLength(0);
    } finally {
      await target.close();
    }
  });
});

// Live tests are opt-in and read-only by default. They may only run against testnet.
const liveKeys = process.env.MEND_TESTNET_KEYS_FILE;
const runLive = process.env.MEND_RUN_LIVE_TESTS === '1' && Boolean(liveKeys);
const runLiveScenario = runLive && process.env.MEND_RUN_LIVE_SCENARIO === '1';

describe.skipIf(!runLive)('live testnet read-only (gated by MEND_RUN_LIVE_TESTS=1)', () => {
  it('reads a real testnet token balance without mutating', async () => {
    const config = loadConfig({
      MEND_MODE: 'LIVE_TESTNET',
      CHAIN_ADAPTER: 'live',
      MEND_RPC_URL: process.env.MEND_RPC_URL ?? 'https://rpc.testnet.near.org',
      MEND_TESTNET_KEYS_FILE: liveKeys,
      MEND_TESTNET_WALLET_ENABLED: 'true',
      MEND_TESTNET_FAUCET_ENABLED: 'true',
    });
    const chain = new NearLiveChain(config.chain);
    expect(chain.available).toBe(true);
    const onboarding = new NearTestnetOnboarding(chain, config);
    const status = await onboarding.wallet(config.chain.roleAccounts.deployer);
    expect(status.exists).toBe(true);
    expect(BigInt(status.balanceMicro)).toBeGreaterThanOrEqual(0n);
    expect(status).not.toHaveProperty('secretKey');
  });
});

describe.skipIf(!runLiveScenario)('live testnet scenario (gated by MEND_RUN_LIVE_TESTS=1 MEND_RUN_LIVE_SCENARIO=1)', () => {
  it('runs the canonical lifecycle with real tx hashes', async () => {
    const config = loadConfig({
      MEND_MODE: 'LIVE_TESTNET',
      CHAIN_ADAPTER: 'live',
      MEND_RPC_URL: process.env.MEND_RPC_URL ?? 'https://rpc.testnet.near.org',
      MEND_TESTNET_KEYS_FILE: liveKeys,
      MEND_LIVE_SCENARIO_ENABLED: 'true',
    });
    const chain = new NearLiveChain(config.chain);
    const runner = new LiveScenarioRunner(chain, config);
    const result = await runner.run();
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.verification.contractVerified).toBe(true);
  });
});

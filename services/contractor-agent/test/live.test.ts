import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MendError, bidCommitmentHash } from '@mend/protocol';
import {
  LIVE_CONTRACTOR_ACCOUNTS,
  buildCanonicalLiveBidPlans,
  buildLiveBidPlan,
  loadContractorLiveConfig,
  readContractorKeyMaterial,
  redactContractorLiveConfig,
} from '../src/index.js';

const WORK_ORDER = 'WO-BENCH-001-0001';
const FAKE_SECRET = 'ed25519:11111111111111111111111111111111';
const tempDirs: string[] = [];

function tempKeyFile(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'mend-contractor-live-'));
  tempDirs.push(dir);
  const path = join(dir, 'keys.json');
  writeFileSync(path, JSON.stringify(content), { mode: 0o600 });
  return path;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('contractor live configuration', () => {
  it('defaults to the testnet hub and one live account per canonical strategy', () => {
    const config = loadContractorLiveConfig({});
    expect(config.network).toBe('testnet');
    expect(config.hubAccount).toBe('mend-hub.testnet');
    expect(config.keyPath).toBeNull();
    expect(config.accounts).toEqual(LIVE_CONTRACTOR_ACCOUNTS);
    expect(config.accountId).toBe('mend-contractor-a.testnet');
    expect(JSON.stringify(redactContractorLiveConfig(config))).not.toContain('secret');
  });

  it('loads an external key path and per-strategy account overrides from env', () => {
    const config = loadContractorLiveConfig({
      MEND_CONTRACTOR_STRATEGY: 'B',
      MEND_CONTRACTOR_ACCOUNT_B: 'mend-contractor-b.testnet',
      MEND_CONTRACTOR_KEY_PATH: '/tmp/scoped-keys.json',
    });
    expect(config.strategy).toBe('B');
    expect(config.accountId).toBe('mend-contractor-b.testnet');
    expect(config.keyPath).toBe('/tmp/scoped-keys.json');
  });

  it('rejects mainnet and malformed account overrides', () => {
    expect(() => loadContractorLiveConfig({ MEND_NEAR_NETWORK: 'mainnet' })).toThrow(MendError);
    expect(() => loadContractorLiveConfig({ MEND_CONTRACTOR_ACCOUNT_A: 'not an account' })).toThrow(/invalid/i);
    expect(() => loadContractorLiveConfig({ MEND_CONTRACTOR_STRATEGY: 'Z' })).toThrow(/strategy/i);
    expect(() => loadContractorLiveConfig({ MEND_CONTRACTOR_STRATEGY: 'D' })).toThrow(/strategy/i);
  });
});

describe('canonical live bid plans', () => {
  it('rebinds A/B/C to live accounts and commits availableInDays', () => {
    const plans = buildCanonicalLiveBidPlans({ workOrderId: WORK_ORDER });
    expect(plans.map((plan) => plan.strategy)).toEqual(['A', 'B', 'C']);
    expect(plans.map((plan) => plan.accountId)).toEqual([
      'mend-contractor-a.testnet',
      'mend-contractor-b.testnet',
      'mend-contractor-c.testnet',
    ]);
    expect(plans.map((plan) => plan.reveal.args.available_in_days)).toEqual([3, 2, 5]);
    expect(plans.map((plan) => plan.bid.availableInDays)).toEqual([3, 2, 5]);
    for (const plan of plans) {
      expect(plan.commitmentHash).toBe(bidCommitmentHash(plan.bid));
      expect(plan.commit.args.commitment_hash).toBe(plan.commitmentHash);
      expect(plan.commit.args.work_order_id).toBe(WORK_ORDER);
      expect(plan.reveal.args.price).toMatch(/^\d+$/);
    }
  });

  it('is deterministic for a live account and differs from the fixture account hash', () => {
    const first = buildLiveBidPlan('A', WORK_ORDER, 'mend-contractor-a.testnet');
    const second = buildLiveBidPlan('A', WORK_ORDER, 'mend-contractor-a.testnet');
    expect(first.commitmentHash).toBe(second.commitmentHash);
    expect(first.commitmentHash).not.toBe(bidCommitmentHash({ ...first.bid, contractorId: 'contractor-a.mend.testnet' }));
  });

  it('rejects non-canonical strategies for live bidding', () => {
    expect(() => buildLiveBidPlan('D' as never, WORK_ORDER, 'mend-contractor-d.testnet')).toThrow(/canonical/i);
  });
});

describe('external scoped key loading', () => {
  it('reads the scoped-keys.json account map without leaking the secret', () => {
    const path = tempKeyFile({
      accounts: {
        'mend-contractor-a.testnet': { publicKey: 'ed25519:pub', secretKey: FAKE_SECRET, role: 'CONTRACTOR' },
      },
    });
    const material = readContractorKeyMaterial(path, 'mend-contractor-a.testnet');
    expect(material.accountId).toBe('mend-contractor-a.testnet');
    expect(material.secretKey).toBe(FAKE_SECRET);
    expect(material.publicKey).toBe('ed25519:pub');
  });

  it('reads the operator keys.json account map', () => {
    const path = tempKeyFile({
      'mend-contractor-b.testnet': { account: 'mend-contractor-b.testnet', secretKey: FAKE_SECRET },
    });
    expect(readContractorKeyMaterial(path, 'mend-contractor-b.testnet').secretKey).toBe(FAKE_SECRET);
  });

  it('fails closed for a missing account and never echoes key material', () => {
    const path = tempKeyFile({ 'mend-contractor-a.testnet': { secretKey: FAKE_SECRET } });
    let message = '';
    try {
      readContractorKeyMaterial(path, 'mend-contractor-c.testnet');
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/no entry/i);
    expect(message).not.toContain(FAKE_SECRET);
  });
});

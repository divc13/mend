import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ACCOUNTS,
  FIXTURE_ASSET_BENCH,
  FIXTURE_BIDS,
  FIXTURE_IDS,
  FIXTURE_REPORT_1,
  FIXTURE_WORK_ORDER,
} from '@mend/protocol';
import { canonicalFixtures, loadCanonicalFixtures } from '../src/index.js';

describe('canonical fixture loaders', () => {
  it('re-exports the protocol values by identity (no copies)', () => {
    const fixtures = loadCanonicalFixtures();
    expect(fixtures.accounts).toBe(FIXTURE_ACCOUNTS);
    expect(fixtures.assetBench).toBe(FIXTURE_ASSET_BENCH);
    expect(fixtures.report1).toBe(FIXTURE_REPORT_1);
    expect(fixtures.workOrder).toBe(FIXTURE_WORK_ORDER);
    expect(fixtures.bids).toBe(FIXTURE_BIDS);
    expect(canonicalFixtures).toBe(loadCanonicalFixtures);
  });

  it('keeps the shared canonical identifiers and money values', () => {
    const fixtures = loadCanonicalFixtures();
    expect(fixtures.ids.assetBench).toBe('BENCH-001');
    expect(fixtures.ids.workOrder).toBe('WO-BENCH-001-0001');
    expect(fixtures.ids.report1).toBe(FIXTURE_IDS.report1);
    expect(fixtures.expectedMoney).toEqual({
      sponsorBudgetMicro: '100000000',
      winningBidMicro: '80000000',
      refundMicro: '20000000',
      completionPaymentMicro: '72000000',
      durabilityHoldbackMicro: '8000000',
    });
  });

  it('is filesystem- and network-free and repeatable', () => {
    const first = loadCanonicalFixtures();
    const second = loadCanonicalFixtures();
    expect(first).not.toBe(second);
    expect(first.workOrder).toBe(second.workOrder);
    expect(JSON.stringify(first.expectedMoney)).toBe(JSON.stringify(second.expectedMoney));
  });
});

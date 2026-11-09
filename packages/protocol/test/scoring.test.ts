import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCORE_POLICY,
  scoreBids,
  validatePolicy,
  type ScoreBidInput,
  type ScorePolicy,
} from '../src/scoring.js';
import { FIXTURE_BIDS, FIXTURE_EXPECTED_RANKING } from '../src/fixtures.js';

describe('deterministic bid scoring', () => {
  it('produces the frozen canonical ranking', () => {
    const result = scoreBids(FIXTURE_BIDS);
    expect(result.ranking.map((b) => ({ rank: b.rank, bidId: b.bidId, scoreBps: b.scoreBps }))).toEqual(
      FIXTURE_EXPECTED_RANKING.map(({ rank, bidId, scoreBps }) => ({ rank, bidId, scoreBps })),
    );
    expect(result.ranking[0]!.bidId).toBe('BID-B-BENCH-001');
  });

  it('returns per-dimension normalized values', () => {
    const result = scoreBids(FIXTURE_BIDS);
    const b = result.ranking.find((x) => x.bidId === 'BID-B-BENCH-001')!;
    expect(b.dimensionsBps.price).toBe(8_823);
    expect(b.dimensionsBps.warranty).toBe(10_000);
    expect(b.dimensionsBps.duration).toBe(10_000);
    expect(b.dimensionsBps.materials).toBe(8_000);
  });

  it('never scores price alone', () => {
    const result = scoreBids(FIXTURE_BIDS);
    const cheapest = [...FIXTURE_BIDS].sort((a, b) => Number(BigInt(a.priceMicro) - BigInt(b.priceMicro)))[0]!;
    expect(cheapest.bidId).toBe('BID-C-BENCH-001');
    expect(result.ranking[0]!.bidId).not.toBe(cheapest.bidId);
  });

  it('excludes ineligible bids and refuses to score when none remain', () => {
    const withIneligible = FIXTURE_BIDS.map((b) => ({
      ...b,
      eligible: b.bidId !== 'BID-B-BENCH-001',
    }));
    const result = scoreBids(withIneligible);
    expect(result.ranking.map((b) => b.bidId)).not.toContain('BID-B-BENCH-001');
    expect(result.excluded).toContainEqual({ bidId: 'BID-B-BENCH-001', reason: 'ineligible' });

    const none = FIXTURE_BIDS.map((b) => ({ ...b, eligible: false }));
    expect(() => scoreBids(none)).toThrow(/no eligible bids/);
  });

  it('handles identical values without division by zero', () => {
    const same: ScoreBidInput[] = [FIXTURE_BIDS[0]!, { ...FIXTURE_BIDS[0]!, bidId: 'BID-X-TIE-0001', contractorId: 'contractor-x.mend.testnet' }];
    const result = scoreBids(same);
    expect(result.ranking).toHaveLength(2);
    expect(result.ranking.every((b) => b.dimensionsBps.price === 10_000)).toBe(true);
    expect(result.ranking[0]!.bidId).toBe('BID-A-BENCH-001'); // lexicographic tie-break
  });

  it('rejects invalid weights, durations and materials scores', () => {
    const badPolicy: ScorePolicy = { version: 'bad', weightsBps: { price: 1, warranty: 1, duration: 1, materials: 1 } };
    expect(() => validatePolicy(badPolicy)).toThrow(/total/);
    expect(() => scoreBids([{ ...FIXTURE_BIDS[0]!, durationDays: 0 }])).toThrow(/duration/);
    expect(() => scoreBids([{ ...FIXTURE_BIDS[0]!, materialsScore: 101 }])).toThrow(/materials/);
    expect(() => scoreBids([{ ...FIXTURE_BIDS[0]!, priceMicro: '0' }])).toThrow(/price/);
  });

  it('is deterministic across input order', () => {
    const a = scoreBids([...FIXTURE_BIDS]);
    const b = scoreBids([...FIXTURE_BIDS].reverse());
    expect(a.ranking).toEqual(b.ranking);
  });

  it('exposes the frozen default policy', () => {
    expect(DEFAULT_SCORE_POLICY.weightsBps).toEqual({
      price: 4_500,
      warranty: 2_500,
      duration: 2_000,
      materials: 1_000,
    });
  });
});

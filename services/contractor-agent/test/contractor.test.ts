import { describe, expect, it } from 'vitest';
import {
  BidCommitmentSchema,
  BidRevealSchema,
  FIXTURE_BID_COMMITMENTS,
  FIXTURE_BID_INPUTS,
  FIXTURE_EXPLANATIONS,
  FIXTURE_EXTRA_BID_INPUTS,
  FIXTURE_EXTRA_EXPLANATIONS,
  MendError,
  bidCommitmentHash,
  bidCommitmentPayload,
} from '@mend/protocol';
import {
  CONTRACTOR_STRATEGIES,
  ContractorBidder,
  SealedBidMarket,
  assertStrategiesMatchProtocol,
} from '../src/index.js';

const WORK_ORDER = 'WO-BENCH-001-0001';
const WINDOW = {
  commitDeadline: '2026-11-10T09:10:00.000Z',
  revealDeadline: '2026-11-10T09:20:00.000Z',
};
const CANONICAL_KEYS = ['A', 'B', 'C'] as const;
const EXTRA_KEYS = ['D', 'E'] as const;
const ALL_KEYS = [...CANONICAL_KEYS, ...EXTRA_KEYS] as const;

function market(roster?: readonly string[]) {
  return new SealedBidMarket({ window: WINDOW, ...(roster ? { contractorRoster: roster } : {}) });
}

describe('contractor agents', () => {
  it('matches the five frozen strategies exactly', () => {
    expect(() => assertStrategiesMatchProtocol()).not.toThrow();
    expect(Object.keys(CONTRACTOR_STRATEGIES)).toEqual(['A', 'B', 'C', 'D', 'E']);

    expect(CONTRACTOR_STRATEGIES.A.bid).toMatchObject({ priceMicro: '95000000', durationDays: 14, warrantyDays: 90, materialsScore: 60, availableInDays: 3 });
    expect(CONTRACTOR_STRATEGIES.B.bid).toMatchObject({ priceMicro: '80000000', durationDays: 10, warrantyDays: 180, materialsScore: 80, availableInDays: 2 });
    expect(CONTRACTOR_STRATEGIES.C.bid).toMatchObject({ priceMicro: '78000000', durationDays: 21, warrantyDays: 30, materialsScore: 70, availableInDays: 5 });
    expect(CONTRACTOR_STRATEGIES.D.bid).toMatchObject({ priceMicro: '85000000', durationDays: 12, warrantyDays: 120, materialsScore: 75, availableInDays: 1 });
    expect(CONTRACTOR_STRATEGIES.E.bid).toMatchObject({ priceMicro: '90000000', durationDays: 7, warrantyDays: 60, materialsScore: 90, availableInDays: 7 });

    for (const key of CANONICAL_KEYS) {
      expect(CONTRACTOR_STRATEGIES[key].canonical).toBe(true);
      expect(CONTRACTOR_STRATEGIES[key].bid).toEqual(FIXTURE_BID_INPUTS[key]);
    }
    for (const key of EXTRA_KEYS) {
      expect(CONTRACTOR_STRATEGIES[key].canonical).toBe(false);
      expect(CONTRACTOR_STRATEGIES[key].bid).toEqual(FIXTURE_EXTRA_BID_INPUTS[key]);
    }
  });

  it('uses a separate sub-account per agent', () => {
    const accounts = ALL_KEYS.map((key) => new ContractorBidder(key).account);
    expect(new Set(accounts).size).toBe(5);
    expect(accounts).toEqual([
      'contractor-a.mend.testnet',
      'contractor-b.mend.testnet',
      'contractor-c.mend.testnet',
      'contractor-d.mend.testnet',
      'contractor-e.mend.testnet',
    ]);
  });

  it('computes the exact MEND_BID_V2 protocol commitment hashes', () => {
    for (const key of CANONICAL_KEYS) {
      const bidder = new ContractorBidder(key);
      const commitment = bidder.createCommitment(WORK_ORDER, '2026-11-10T09:00:00.000Z');
      expect(bidCommitmentPayload(CONTRACTOR_STRATEGIES[key].bid).startsWith('MEND_BID_V2|')).toBe(true);
      expect(commitment.commitmentHash).toBe(bidCommitmentHash(FIXTURE_BID_INPUTS[key]));
      expect(commitment.commitmentHash).toBe(FIXTURE_BID_COMMITMENTS.find((entry) => entry.bidId === commitment.bidId)?.commitmentHash);
      expect(() => BidCommitmentSchema.parse(commitment)).not.toThrow();
    }

    for (const key of EXTRA_KEYS) {
      const bidder = new ContractorBidder(key);
      const commitment = bidder.createCommitment(WORK_ORDER, '2026-11-10T09:00:00.000Z');
      expect(bidCommitmentPayload(CONTRACTOR_STRATEGIES[key].bid).startsWith('MEND_BID_V2|')).toBe(true);
      expect(commitment.commitmentHash).toBe(bidCommitmentHash(FIXTURE_EXTRA_BID_INPUTS[key]));
      expect(() => BidCommitmentSchema.parse(commitment)).not.toThrow();
    }
  });

  it('keeps competing bids sealed before the reveal phase', () => {
    const book = market();
    const bidders = CANONICAL_KEYS.map((key) => new ContractorBidder(key));
    for (const bidder of bidders) book.commit(bidder, WORK_ORDER, '2026-11-10T09:00:00.000Z');

    const publicCommitments = book.publicCommitments(WORK_ORDER);
    expect(publicCommitments).toHaveLength(3);
    expect(JSON.stringify(publicCommitments)).not.toContain('80000000');
    expect(JSON.stringify(publicCommitments)).not.toContain('95000000');
    expect(publicCommitments[0]).not.toHaveProperty('priceMicro');

    expect(() => book.revealedBids(WORK_ORDER, '2026-11-10T09:05:00.000Z')).toThrow(MendError);
  });

  it('reveals valid bids after the commit deadline and rejects late reveals', () => {
    const book = market();
    const bidder = new ContractorBidder('B');
    book.commit(bidder, WORK_ORDER, '2026-11-10T09:00:00.000Z');
    expect(() => book.reveal(bidder, WORK_ORDER, '2026-11-10T09:05:00.000Z')).toThrow(/not open|EARLY/i);

    const reveal = book.reveal(bidder, WORK_ORDER, '2026-11-10T09:10:00.000Z');
    expect(reveal.priceMicro).toBe('80000000');
    expect(reveal.durationDays).toBe(10);
    expect(reveal.warrantyDays).toBe(180);
    expect(reveal.availableInDays).toBe(2);
    expect(reveal.materialsScore).toBe(80);
    expect(reveal.commitmentHash).toBe(bidCommitmentHash(FIXTURE_BID_INPUTS.B));
    expect(() => BidRevealSchema.parse(reveal)).not.toThrow();

    expect(() => book.reveal(bidder, WORK_ORDER, '2026-11-10T09:21:00.000Z')).toThrow(/passed|LATE/i);
  });

  it('supports the extra D/E demo strategies when they are on the roster', () => {
    const book = market(ALL_KEYS.map((key) => CONTRACTOR_STRATEGIES[key].account));
    for (const key of EXTRA_KEYS) {
      const bidder = new ContractorBidder(key);
      book.commit(bidder, WORK_ORDER, '2026-11-10T09:00:00.000Z');
      const reveal = book.reveal(bidder, WORK_ORDER, '2026-11-10T09:10:00.000Z');
      expect(reveal.availableInDays).toBe(FIXTURE_EXTRA_BID_INPUTS[key].availableInDays);
      expect(reveal.commitmentHash).toBe(bidCommitmentHash(FIXTURE_EXTRA_BID_INPUTS[key]));
    }
    expect(book.revealedBids(WORK_ORDER, '2026-11-10T09:15:00.000Z')).toHaveLength(2);
  });

  it('rejects duplicate commitments and non-roster bidders', () => {
    const book = market();
    const bidder = new ContractorBidder('A');
    book.commit(bidder, WORK_ORDER, '2026-11-10T09:00:00.000Z');
    expect(() => book.commit(bidder, WORK_ORDER, '2026-11-10T09:01:00.000Z')).toThrow(MendError);

    const restricted = market(['contractor-a.mend.testnet']);
    expect(() => restricted.commit(new ContractorBidder('B'), WORK_ORDER, '2026-11-10T09:00:00.000Z')).toThrow(
      /roster/i,
    );
  });

  it('cannot award, accept, inspect or pay', () => {
    const bidder = new ContractorBidder('A');
    for (const method of ['award', 'accept_completion', 'inspect_durability', 'refund', 'set_role', 'fund_work_order']) {
      expect(() => bidder.performAction(method)).toThrow(MendError);
    }
    expect(bidder.performAction('commit_bid')).toEqual({
      account: 'contractor-a.mend.testnet',
      method: 'commit_bid',
      signed: false,
    });
  });

  it('uses only the frozen fixture explanation over structured values', () => {
    for (const key of CANONICAL_KEYS) {
      expect(new ContractorBidder(key).explain()).toBe(FIXTURE_EXPLANATIONS[key]);
    }
    for (const key of EXTRA_KEYS) {
      expect(new ContractorBidder(key).explain()).toBe(FIXTURE_EXTRA_EXPLANATIONS[key]);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  BidCommitmentSchema,
  BidRevealSchema,
  FIXTURE_BID_COMMITMENTS,
  FIXTURE_BID_INPUTS,
  FIXTURE_EXPLANATIONS,
  MendError,
  bidCommitmentHash,
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

function market(roster?: readonly string[]) {
  return new SealedBidMarket({ window: WINDOW, ...(roster ? { contractorRoster: roster } : {}) });
}

describe('contractor agents', () => {
  it('matches the frozen strategies exactly', () => {
    expect(() => assertStrategiesMatchProtocol()).not.toThrow();
    expect(CONTRACTOR_STRATEGIES.A.bid).toMatchObject({ priceMicro: '95000000', durationDays: 14, warrantyDays: 90, materialsScore: 60 });
    expect(CONTRACTOR_STRATEGIES.B.bid).toMatchObject({ priceMicro: '80000000', durationDays: 10, warrantyDays: 180, materialsScore: 80 });
    expect(CONTRACTOR_STRATEGIES.C.bid).toMatchObject({ priceMicro: '78000000', durationDays: 21, warrantyDays: 30, materialsScore: 70 });
    expect(CONTRACTOR_STRATEGIES.A.bid).toEqual(FIXTURE_BID_INPUTS.A);
    expect(CONTRACTOR_STRATEGIES.B.bid).toEqual(FIXTURE_BID_INPUTS.B);
    expect(CONTRACTOR_STRATEGIES.C.bid).toEqual(FIXTURE_BID_INPUTS.C);
  });

  it('uses a separate sub-account per agent', () => {
    const accounts = (['A', 'B', 'C'] as const).map((key) => new ContractorBidder(key).account);
    expect(new Set(accounts).size).toBe(3);
    expect(accounts).toEqual([
      'contractor-a.mend.testnet',
      'contractor-b.mend.testnet',
      'contractor-c.mend.testnet',
    ]);
  });

  it('computes the exact protocol commitment hashes', () => {
    for (const key of ['A', 'B', 'C'] as const) {
      const bidder = new ContractorBidder(key);
      const commitment = bidder.createCommitment(WORK_ORDER, '2026-11-10T09:00:00.000Z');
      expect(commitment.commitmentHash).toBe(bidCommitmentHash(FIXTURE_BID_INPUTS[key]));
      expect(commitment.commitmentHash).toBe(FIXTURE_BID_COMMITMENTS.find((entry) => entry.bidId === commitment.bidId)?.commitmentHash);
      expect(() => BidCommitmentSchema.parse(commitment)).not.toThrow();
    }
  });

  it('keeps competing bids sealed before the reveal phase', () => {
    const book = market();
    const bidders = (['A', 'B', 'C'] as const).map((key) => new ContractorBidder(key));
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
    expect(reveal.materialsScore).toBe(80);
    expect(reveal.commitmentHash).toBe(bidCommitmentHash(FIXTURE_BID_INPUTS.B));
    expect(() => BidRevealSchema.parse(reveal)).not.toThrow();

    expect(() => book.reveal(bidder, WORK_ORDER, '2026-11-10T09:21:00.000Z')).toThrow(/passed|LATE/i);
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
    for (const key of ['A', 'B', 'C'] as const) {
      expect(new ContractorBidder(key).explain()).toBe(FIXTURE_EXPLANATIONS[key]);
    }
  });
});

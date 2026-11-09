import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  FIXTURE_EXPECTED_RANKING,
  bidCommitmentHash,
  scoreBids,
  scoreInputHash,
  type ScoreBidInput,
} from '@mend/protocol';
import { describe, expect, it } from 'vitest';

import { scoreOutputHash } from '../src/canonical.js';

const INPUT_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/bid-rules/canonical-input.json', import.meta.url),
);
const OUTPUT_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/bid-rules/canonical-output.json', import.meta.url),
);

interface CanonicalBid {
  bidId: string;
  contractorId: string;
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  materialsScore: number;
  availableInDays: number;
  eligible: boolean;
  evidenceChecklistAccepted: boolean;
  nonce: string;
  commitmentHash: string;
}

interface CanonicalInput {
  policyHash: string;
  bids: CanonicalBid[];
}

interface CanonicalOutput {
  policyHash: string;
  inputHash: string;
  outputHash: string;
  winnerBidId: string;
  ranking: Array<{
    rank: number;
    bidId: string;
    contractorId: string;
    scoreBps: number;
    dimensionsBps: { price: number; warranty: number; duration: number; materials: number };
    priceMicro: string;
    durationDays: number;
    warrantyDays: number;
    materialsScore: number;
  }>;
  excluded: Array<{ bidId: string; reason: string }>;
}

function loadFixtures(): { input: CanonicalInput; output: CanonicalOutput } {
  return {
    input: JSON.parse(readFileSync(INPUT_FIXTURE, 'utf8')) as CanonicalInput,
    output: JSON.parse(readFileSync(OUTPUT_FIXTURE, 'utf8')) as CanonicalOutput,
  };
}

describe('Rust ↔ TypeScript canonical parity', () => {
  it('produces exactly the committed Rust ranking B 9270 > C 5200 > A 2873', () => {
    const { input, output } = loadFixtures();
    const bids: ScoreBidInput[] = input.bids.map((bid) => ({
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      priceMicro: bid.priceMicro,
      durationDays: bid.durationDays,
      warrantyDays: bid.warrantyDays,
      materialsScore: bid.materialsScore,
      eligible: bid.eligible,
    }));

    const result = scoreBids(bids);

    expect(result.ranking.map((bid) => ({ rank: bid.rank, bidId: bid.bidId, scoreBps: bid.scoreBps }))).toEqual([
      { rank: 1, bidId: 'BID-B-BENCH-001', scoreBps: 9270 },
      { rank: 2, bidId: 'BID-C-BENCH-001', scoreBps: 5200 },
      { rank: 3, bidId: 'BID-A-BENCH-001', scoreBps: 2873 },
    ]);
    expect(output.ranking.map((bid) => ({ rank: bid.rank, bidId: bid.bidId, scoreBps: bid.scoreBps }))).toEqual(
      FIXTURE_EXPECTED_RANKING.map(({ rank, bidId, scoreBps }) => ({ rank, bidId, scoreBps })),
    );
    expect(result.ranking.map((bid) => bid.bidId)).toEqual(output.ranking.map((bid) => bid.bidId));
    expect(result.ranking.map((bid) => bid.dimensionsBps)).toEqual(
      output.ranking.map((bid) => bid.dimensionsBps),
    );
    expect(output.winnerBidId).toBe('BID-B-BENCH-001');
    expect(output.excluded).toEqual([]);
  });

  it('recomputes the Rust inputHash and outputHash from protocol hashing', () => {
    const { input, output } = loadFixtures();
    const availability = Object.fromEntries(input.bids.map((bid) => [bid.bidId, bid.availableInDays]));
    expect(availability).toEqual({
      'BID-A-BENCH-001': 3,
      'BID-B-BENCH-001': 2,
      'BID-C-BENCH-001': 5,
    });
    const commitmentHashes = input.bids.map((bid) =>
      bidCommitmentHash({
        bidId: bid.bidId,
        contractorId: bid.contractorId,
        priceMicro: bid.priceMicro,
        durationDays: bid.durationDays,
        warrantyDays: bid.warrantyDays,
        materialsScore: bid.materialsScore,
        availableInDays: bid.availableInDays,
        evidenceChecklistAccepted: bid.evidenceChecklistAccepted,
        nonce: bid.nonce,
      }),
    );
    expect(commitmentHashes.sort()).toEqual(input.bids.map((bid) => bid.commitmentHash).sort());
    expect(scoreInputHash(output.policyHash, commitmentHashes)).toBe(output.inputHash);

    const result = scoreBids(
      input.bids.map((bid) => ({
        bidId: bid.bidId,
        contractorId: bid.contractorId,
        priceMicro: bid.priceMicro,
        durationDays: bid.durationDays,
        warrantyDays: bid.warrantyDays,
        materialsScore: bid.materialsScore,
        eligible: bid.eligible,
      })),
    );
    expect(scoreOutputHash(result.ranking)).toBe(output.outputHash);
  });
});

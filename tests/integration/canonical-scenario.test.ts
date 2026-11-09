import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CANONICAL_AMOUNTS,
  FIXTURE_BID_COMMITMENTS,
  FIXTURE_BIDS,
  FIXTURE_IDS,
  FIXTURE_BID_INPUTS,
  FIXTURE_DAO_APPROVAL,
  FIXTURE_EXPECTED_MONEY,
  FIXTURE_POLICY,
  FIXTURE_WORK_ORDER,
  awardLedger,
  bidCommitmentHash,
  canTransition,
  completionLedger,
  computeRefund,
  computeSplit,
  formatMicroToUsdc,
  policyHash,
  scoreBids,
  scoreInputHash,
  type WorkOrderState,
} from '@mend/protocol';
import { canonicalRankingJson, scoreOutputHash } from '@mend/ai-client/server';

import { repoPath } from '../security/support/repo.js';

const recordedOutput = JSON.parse(
  readFileSync(repoPath('fixtures', 'recorded-responses', 'bid-rules', 'canonical-output.json'), 'utf8'),
) as {
  ranking: unknown[];
  inputHash: string;
  outputHash: string;
  winnerBidId: string;
};

describe('canonical scenario A — exact 100/80/72/8 replay', () => {
  it('scores the canonical bids deterministically as B > C > A', () => {
    const result = scoreBids(FIXTURE_BIDS);
    expect(result.ranking.map((bid) => [bid.rank, bid.bidId, bid.scoreBps])).toEqual([
      [1, FIXTURE_IDS.bidB, 9_270],
      [2, FIXTURE_IDS.bidC, 5_200],
      [3, FIXTURE_IDS.bidA, 2_873],
    ]);
    expect(result.policyVersion).toBe(FIXTURE_POLICY.version);
    expect(result.weightsBps).toEqual(FIXTURE_POLICY.weightsBps);
    expect(scoreOutputHash(result.ranking)).toBe(recordedOutput.outputHash);
    expect(canonicalRankingJson(result.ranking)).toBe(JSON.stringify(recordedOutput.ranking));
  });

  it('binds the exact policy, commitments and recorded output hashes', () => {
    const digest = policyHash(FIXTURE_POLICY);
    expect(digest).toBe(FIXTURE_DAO_APPROVAL.policyHash);
    for (const [index, commitment] of FIXTURE_BID_COMMITMENTS.entries()) {
      const bidKey = (['A', 'B', 'C'] as const)[index]!;
      expect(bidCommitmentHash(FIXTURE_BID_INPUTS[bidKey])).toBe(commitment.commitmentHash);
    }
    expect(
      scoreInputHash(
        digest,
        FIXTURE_BID_COMMITMENTS.map((commitment) => commitment.commitmentHash),
      ),
    ).toBe(recordedOutput.inputHash);
  });

  it('applies the award refund and the 90/10 split exactly once', () => {
    expect(formatMicroToUsdc(CANONICAL_AMOUNTS.sponsorBudget)).toBe('100.000000');
    expect(computeRefund(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid)).toBe(
      CANONICAL_AMOUNTS.refund,
    );

    const awarded = awardLedger(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid);
    expect(awarded.refund).toBe(20_000_000n);
    expect(awarded.escrowedMicro).toBe(80_000_000n);
    expect(awarded.refundedMicro + awarded.escrowedMicro).toBe(awarded.fundingMicro);

    const split = computeSplit(CANONICAL_AMOUNTS.winningBid);
    expect(split.completion).toBe(72_000_000n);
    expect(split.holdback).toBe(8_000_000n);

    const completed = completionLedger(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid);
    expect(completed.completionPaidMicro).toBe(72_000_000n);
    expect(completed.holdbackHeldMicro).toBe(8_000_000n);
    expect(completed.holdbackReleasedMicro).toBe(0n);
    expect(
      completed.refundedMicro +
        completed.escrowedMicro +
        completed.completionPaidMicro +
        completed.holdbackHeldMicro +
        completed.holdbackReleasedMicro,
    ).toBe(completed.fundingMicro);

    // The canonical lifecycle state machine accepts only the documented route.
    const route: WorkOrderState[] = [
      'DRAFT',
      'POLICY_APPROVED',
      'FUNDED',
      'BIDDING_OPEN',
      'BIDDING_REVEAL',
      'SCORED',
      'AWARDED',
      'IN_PROGRESS',
      'COMPLETION_SUBMITTED',
      'COMPLETION_ACCEPTED',
      'DURABILITY_PENDING',
      'CLOSED',
    ];
    for (let i = 0; i < route.length - 1; i += 1) {
      expect(canTransition(route[i]!, route[i + 1]!).ok, `${route[i]} -> ${route[i + 1]}`).toBe(true);
    }
    expect(canTransition('CLOSED', 'AWARDED').ok).toBe(false);
    expect(canTransition('DURABILITY_PENDING', 'CLOSED', { humanResolution: false }).ok).toBe(true);
    expect(canTransition('PAUSED', 'SCORED', { pausedFrom: 'SCORED' }).ok).toBe(true);
    expect(canTransition('PAUSED', 'AWARDED', { pausedFrom: 'SCORED' }).ok).toBe(false);
  });

  it('keeps the canonical fixture work order in REPLAY mode with no live claim', () => {
    expect(FIXTURE_WORK_ORDER.status).toBe('AWARDED');
    expect(FIXTURE_WORK_ORDER.mode).toBe('REPLAY');
    expect(FIXTURE_WORK_ORDER.awardedBidId).toBe(FIXTURE_IDS.bidB);
    expect(FIXTURE_EXPECTED_MONEY.completionPaymentMicro).toBe('72000000');
    expect(FIXTURE_EXPECTED_MONEY.durabilityHoldbackMicro).toBe('8000000');
  });
});

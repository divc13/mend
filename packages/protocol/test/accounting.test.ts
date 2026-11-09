import { describe, expect, it } from 'vitest';
import {
  assertLedgerBalanced,
  awardLedger,
  completionLedger,
  computeRefund,
  computeSplit,
  formatMicroToUsdc,
  isLedgerBalanced,
  parseUsdcToMicro,
} from '../src/accounting.js';
import { CANONICAL_AMOUNTS } from '../src/constants.js';

describe('USDC accounting', () => {
  it('parses and formats micro-units exactly', () => {
    expect(parseUsdcToMicro('100')).toBe(100_000_000n);
    expect(parseUsdcToMicro('0.000001')).toBe(1n);
    expect(parseUsdcToMicro('80.5')).toBe(80_500_000n);
    expect(formatMicroToUsdc(100_000_000n)).toBe('100.000000');
    expect(formatMicroToUsdc(1n)).toBe('0.000001');
    expect(() => parseUsdcToMicro('1.0000001')).toThrow();
    expect(() => parseUsdcToMicro('-1')).toThrow();
  });

  it('computes the canonical 80 -> 72 / 8 split', () => {
    const split = computeSplit(CANONICAL_AMOUNTS.winningBid);
    expect(split.completion).toBe(72_000_000n);
    expect(split.holdback).toBe(8_000_000n);
    expect(split.completion + split.holdback).toBe(CANONICAL_AMOUNTS.winningBid);
  });

  it('computes the canonical 100 - 80 = 20 refund', () => {
    expect(computeRefund(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid)).toBe(
      CANONICAL_AMOUNTS.refund,
    );
    expect(() => computeRefund(1n, 2n)).toThrow();
  });

  it('keeps the award ledger balanced', () => {
    const ledger = awardLedger(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid);
    expect(ledger.refund).toBe(20_000_000n);
    expect(isLedgerBalanced(ledger)).toBe(true);
  });

  it('keeps funding = refund + completion + holdback after completion', () => {
    const ledger = completionLedger(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid);
    expect(ledger.refundedMicro + ledger.completionPaidMicro + ledger.holdbackHeldMicro).toBe(
      CANONICAL_AMOUNTS.sponsorBudget,
    );
    expect(ledger.completion).toBe(72_000_000n);
    expect(ledger.holdback).toBe(8_000_000n);
    assertLedgerBalanced(ledger);
  });

  it('rejects unbalanced ledgers and double-release snapshots', () => {
    expect(
      isLedgerBalanced({
        fundingMicro: 100n,
        refundedMicro: 20n,
        escrowedMicro: 0n,
        completionPaidMicro: 72n,
        holdbackHeldMicro: 8n,
        holdbackReleasedMicro: 8n,
      }),
    ).toBe(false);
    expect(() =>
      assertLedgerBalanced({
        fundingMicro: 100n,
        refundedMicro: 20n,
        escrowedMicro: 0n,
        completionPaidMicro: 72n,
        holdbackHeldMicro: 0n,
        holdbackReleasedMicro: 0n,
      }),
    ).toThrow(/unbalanced/);
  });

  it('sends integer-division remainder to the holdback, never losing a micro-unit', () => {
    const split = computeSplit(1n);
    expect(split.completion).toBe(0n);
    expect(split.holdback).toBe(1n);
    const split2 = computeSplit(101n);
    expect(split2.completion + split2.holdback).toBe(101n);
  });
});

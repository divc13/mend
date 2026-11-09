import { describe, expect, it } from 'vitest';
import {
  CANONICAL_LEDGER_AMOUNTS,
  CANONICAL_LEDGER_USDC,
  CANONICAL_MODE_LABELS,
  assertCanonicalAwardLedger,
  assertCanonicalCompletionLedger,
  assertCanonicalHoldbackReleasedLedger,
  assertCanonicalLedger,
  assertDistinctModeLabels,
  assertModeLabel,
  canonicalAwardLedger,
  canonicalCompletionLedger,
  canonicalHoldbackReleasedLedger,
} from '../src/index.js';

describe('canonical 100/80/72/8 ledger', () => {
  it('freezes the canonical amounts and USDC rendering', () => {
    expect(CANONICAL_LEDGER_AMOUNTS).toEqual({
      sponsorBudgetMicro: 100_000_000n,
      winningBidMicro: 80_000_000n,
      refundMicro: 20_000_000n,
      completionPaymentMicro: 72_000_000n,
      durabilityHoldbackMicro: 8_000_000n,
    });
    expect(CANONICAL_LEDGER_USDC).toEqual({
      sponsorBudget: '100.000000',
      winningBid: '80.000000',
      refund: '20.000000',
      completionPayment: '72.000000',
      durabilityHoldback: '8.000000',
    });
    expect(Object.isFrozen(CANONICAL_LEDGER_AMOUNTS)).toBe(true);
  });

  it('accepts the award, completion and released ledgers', () => {
    expect(() => assertCanonicalAwardLedger()).not.toThrow();
    expect(() => assertCanonicalCompletionLedger()).not.toThrow();
    expect(() => assertCanonicalHoldbackReleasedLedger()).not.toThrow();
    expect(() => assertCanonicalLedger('award')).not.toThrow();
    expect(() => assertCanonicalLedger('completion')).not.toThrow();
    expect(() => assertCanonicalLedger('holdback-released')).not.toThrow();

    expect(canonicalAwardLedger().escrowedMicro).toBe(80_000_000n);
    expect(canonicalAwardLedger().refund).toBe(20_000_000n);
    expect(canonicalCompletionLedger().completion).toBe(72_000_000n);
    expect(canonicalCompletionLedger().holdback).toBe(8_000_000n);
    expect(canonicalHoldbackReleasedLedger().holdbackReleasedMicro).toBe(8_000_000n);
  });

  it('rejects any deviation, double payment or unbalanced total', () => {
    const award = canonicalAwardLedger();
    expect(() => assertCanonicalAwardLedger({ ...award, escrowedMicro: 81_000_000n })).toThrow(
      /unbalanced|mismatch/,
    );
    expect(() => assertCanonicalCompletionLedger({ ...canonicalCompletionLedger(), holdbackHeldMicro: 0n })).toThrow();
    expect(() =>
      assertCanonicalHoldbackReleasedLedger({
        fundingMicro: 100_000_000n,
        refundedMicro: 20_000_000n,
        escrowedMicro: 0n,
        completionPaidMicro: 72_000_000n,
        holdbackHeldMicro: 8_000_000n,
        holdbackReleasedMicro: 8_000_000n,
      }),
    ).toThrow(/unbalanced/);
  });

  it('checks mode labels and mandatory disclosure text', () => {
    expect(assertModeLabel('REPLAY')).toBe('REPLAY / SIMULATION');
    expect(assertModeLabel('LIVE_TESTNET')).toMatch(/TESTNET/);
    expect(assertModeLabel('MAINNET')).toMatch(/REAL FUNDS/);
    expect(CANONICAL_MODE_LABELS.REPLAY).toBe('REPLAY / SIMULATION');
    expect(() => assertDistinctModeLabels()).not.toThrow();
    expect(() => assertModeLabel('REPLAY', 'LIVE TESTNET')).toThrow(/mismatch/);
    expect(() => assertModeLabel('REPLAY', 'SIMULATION')).toThrow(/mismatch/);
  });
});

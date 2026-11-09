import { MODE_LABELS, modeLabel } from '@mend/config';
import {
  CANONICAL_AMOUNTS,
  assertLedgerBalanced,
  awardLedger,
  completionLedger,
  formatMicroToUsdc,
  type LedgerSnapshot,
  type Split,
  type WorkOrderMode,
} from '@mend/protocol';

/** Canonical pilot budgets in micro-units: 100 / 80 / 20 / 72 / 8. */
export const CANONICAL_LEDGER_AMOUNTS = Object.freeze({
  sponsorBudgetMicro: CANONICAL_AMOUNTS.sponsorBudget,
  winningBidMicro: CANONICAL_AMOUNTS.winningBid,
  refundMicro: CANONICAL_AMOUNTS.refund,
  completionPaymentMicro: CANONICAL_AMOUNTS.completionPayment,
  durabilityHoldbackMicro: CANONICAL_AMOUNTS.durabilityHoldback,
});

/** The same canonical values rendered as whole USDC strings. */
export const CANONICAL_LEDGER_USDC = Object.freeze({
  sponsorBudget: '100.000000',
  winningBid: '80.000000',
  refund: '20.000000',
  completionPayment: '72.000000',
  durabilityHoldback: '8.000000',
});

export type AwardLedger = LedgerSnapshot & { refund: bigint };
export type CompletionLedger = LedgerSnapshot & Split;
export type CanonicalLedgerStage = 'award' | 'completion' | 'holdback-released';

export function canonicalAwardLedger(): AwardLedger {
  return awardLedger(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid);
}

export function canonicalCompletionLedger(): CompletionLedger {
  return completionLedger(CANONICAL_AMOUNTS.sponsorBudget, CANONICAL_AMOUNTS.winningBid);
}

/** After a successful durability inspection the holdback is released exactly once. */
export function canonicalHoldbackReleasedLedger(): LedgerSnapshot {
  const ledger: LedgerSnapshot = {
    fundingMicro: CANONICAL_AMOUNTS.sponsorBudget,
    refundedMicro: CANONICAL_AMOUNTS.refund,
    escrowedMicro: 0n,
    completionPaidMicro: CANONICAL_AMOUNTS.completionPayment,
    holdbackHeldMicro: 0n,
    holdbackReleasedMicro: CANONICAL_AMOUNTS.durabilityHoldback,
  };
  assertLedgerBalanced(ledger);
  return ledger;
}

type AmountField = keyof LedgerSnapshot;

function assertAmounts(
  ledger: LedgerSnapshot,
  expected: Readonly<Record<AmountField, bigint>>,
  stage: string,
): void {
  assertLedgerBalanced(ledger);
  for (const field of Object.keys(expected) as AmountField[]) {
    const actual = ledger[field];
    const wanted = expected[field];
    if (actual !== wanted) {
      throw new Error(
        `${stage} ledger mismatch for ${field}: expected ${wanted} micro (${formatMicroToUsdc(wanted)} USDC), received ${actual} micro`,
      );
    }
  }
}

export function assertCanonicalAwardLedger(ledger: LedgerSnapshot = canonicalAwardLedger()): void {
  assertAmounts(
    ledger,
    {
      fundingMicro: 100_000_000n,
      refundedMicro: 20_000_000n,
      escrowedMicro: 80_000_000n,
      completionPaidMicro: 0n,
      holdbackHeldMicro: 0n,
      holdbackReleasedMicro: 0n,
    },
    'award',
  );
}

export function assertCanonicalCompletionLedger(ledger: LedgerSnapshot = canonicalCompletionLedger()): void {
  assertAmounts(
    ledger,
    {
      fundingMicro: 100_000_000n,
      refundedMicro: 20_000_000n,
      escrowedMicro: 0n,
      completionPaidMicro: 72_000_000n,
      holdbackHeldMicro: 8_000_000n,
      holdbackReleasedMicro: 0n,
    },
    'completion',
  );
}

export function assertCanonicalHoldbackReleasedLedger(
  ledger: LedgerSnapshot = canonicalHoldbackReleasedLedger(),
): void {
  assertAmounts(
    ledger,
    {
      fundingMicro: 100_000_000n,
      refundedMicro: 20_000_000n,
      escrowedMicro: 0n,
      completionPaidMicro: 72_000_000n,
      holdbackHeldMicro: 0n,
      holdbackReleasedMicro: 8_000_000n,
    },
    'holdback-released',
  );
}

export function assertCanonicalLedger(
  stage: CanonicalLedgerStage,
  ledger?: LedgerSnapshot,
): void {
  switch (stage) {
    case 'award':
      assertCanonicalAwardLedger(ledger ?? canonicalAwardLedger());
      return;
    case 'completion':
      assertCanonicalCompletionLedger(ledger ?? canonicalCompletionLedger());
      return;
    case 'holdback-released':
      assertCanonicalHoldbackReleasedLedger(ledger ?? canonicalHoldbackReleasedLedger());
      return;
    default: {
      const unreachable: never = stage;
      throw new Error(`unknown canonical ledger stage: ${String(unreachable)}`);
    }
  }
}

/** Mode labels are part of the contract: replay must never look live. */
export const CANONICAL_MODE_LABELS = MODE_LABELS;

const REQUIRED_LABEL_FRAGMENT: Readonly<Record<WorkOrderMode, RegExp>> = Object.freeze({
  LIVE_TESTNET: /TESTNET/,
  MAINNET: /MAINNET/,
  REPLAY: /REPLAY/,
});

export function assertModeLabel(mode: WorkOrderMode, expected?: string): string {
  const actual = modeLabel(mode);
  const wanted = expected ?? MODE_LABELS[mode];
  if (actual !== wanted) {
    throw new Error(`mode label mismatch for ${mode}: expected "${wanted}", received "${actual}"`);
  }
  if (!REQUIRED_LABEL_FRAGMENT[mode].test(actual)) {
    throw new Error(`mode label for ${mode} is missing its mandatory disclosure: "${actual}"`);
  }
  return actual;
}

export function assertDistinctModeLabels(): void {
  const labels = (Object.keys(MODE_LABELS) as WorkOrderMode[]).map((mode) => modeLabel(mode));
  if (new Set(labels).size !== labels.length) {
    throw new Error(`mode labels must be distinct: ${labels.join(' | ')}`);
  }
}

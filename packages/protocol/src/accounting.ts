import { BPS_DENOMINATOR, COMPLETION_BPS, HOLDBACK_BPS, MICRO_PER_USD, USDC_DECIMALS } from './constants.js';

export type MicroAmount = bigint;

export function parseUsdcToMicro(value: string): MicroAmount {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`invalid USDC amount: ${value}`);
  }
  const [whole = '0', frac = ''] = trimmed.split('.');
  const padded = frac.padEnd(USDC_DECIMALS, '0');
  return BigInt(whole) * MICRO_PER_USD + BigInt(padded);
}

export function formatMicroToUsdc(amount: MicroAmount, decimals = USDC_DECIMALS): string {
  if (amount < 0n) throw new Error('amount cannot be negative');
  const whole = amount / MICRO_PER_USD;
  const frac = amount % MICRO_PER_USD;
  return `${whole}.${frac.toString().padStart(decimals, '0')}`;
}

export interface Split {
  completion: MicroAmount;
  holdback: MicroAmount;
}

/** 90/10 split with exact integer accounting; the remainder always lands in the holdback. */
export function computeSplit(amount: MicroAmount, completionBps: number = COMPLETION_BPS): Split {
  if (amount < 0n) throw new Error('amount cannot be negative');
  if (!Number.isInteger(completionBps) || completionBps < 0 || completionBps > BPS_DENOMINATOR) {
    throw new Error(`invalid completion bps: ${completionBps}`);
  }
  const completion = (amount * BigInt(completionBps)) / BigInt(BPS_DENOMINATOR);
  return { completion, holdback: amount - completion };
}

export function computeRefund(budget: MicroAmount, award: MicroAmount): MicroAmount {
  if (budget < 0n || award < 0n) throw new Error('amounts cannot be negative');
  if (award > budget) throw new Error('award exceeds budget');
  return budget - award;
}

export interface LedgerSnapshot {
  fundingMicro: MicroAmount;
  refundedMicro: MicroAmount;
  /** Award still held in escrow but not yet paid or classified as holdback. */
  escrowedMicro: MicroAmount;
  completionPaidMicro: MicroAmount;
  holdbackHeldMicro: MicroAmount;
  holdbackReleasedMicro: MicroAmount;
}

/**
 * Total payouts + remaining escrow + refunds must equal total funding.
 * During a warranty remediation there is no new funding; the invariant still holds.
 */
export function isLedgerBalanced(ledger: LedgerSnapshot): boolean {
  const total =
    ledger.refundedMicro +
    ledger.escrowedMicro +
    ledger.completionPaidMicro +
    ledger.holdbackHeldMicro +
    ledger.holdbackReleasedMicro;
  return total === ledger.fundingMicro;
}

export function assertLedgerBalanced(ledger: LedgerSnapshot): void {
  if (!isLedgerBalanced(ledger)) {
    throw new Error(
      `unbalanced ledger: funding=${ledger.fundingMicro} accounted=${ledger.refundedMicro + ledger.escrowedMicro + ledger.completionPaidMicro + ledger.holdbackHeldMicro + ledger.holdbackReleasedMicro}`,
    );
  }
}

/** Award-time ledger: unawarded budget becomes an explicit refund; award stays in escrow. */
export function awardLedger(funding: MicroAmount, award: MicroAmount): LedgerSnapshot & { refund: MicroAmount } {
  const refund = computeRefund(funding, award);
  const ledger = {
    fundingMicro: funding,
    refundedMicro: refund,
    escrowedMicro: award,
    completionPaidMicro: 0n,
    holdbackHeldMicro: 0n,
    holdbackReleasedMicro: 0n,
    refund,
  };
  assertLedgerBalanced(ledger);
  return ledger;
}

/** Post-completion ledger: exactly 90% paid, 10% held. */
export function completionLedger(funding: MicroAmount, award: MicroAmount): LedgerSnapshot & Split {
  const refund = computeRefund(funding, award);
  const split = computeSplit(award);
  const ledger = {
    fundingMicro: funding,
    refundedMicro: refund,
    escrowedMicro: 0n,
    completionPaidMicro: split.completion,
    holdbackHeldMicro: split.holdback,
    holdbackReleasedMicro: 0n,
    ...split,
  };
  assertLedgerBalanced(ledger);
  return ledger as LedgerSnapshot & Split;
}

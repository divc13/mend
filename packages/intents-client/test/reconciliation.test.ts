import { describe, expect, it } from 'vitest';
import { reconcileStatus, type EscrowFunding, type SponsorshipBinding } from '../src/reconciliation.js';
import { loadFixture, statusLike, BASE_USDC, LIVE_DEPOSIT_ADDRESS, NEAR_USDC, WORK_ORDER_ID } from './helpers.js';

const NEAR_USDC_CONTRACT = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';

const BINDING: SponsorshipBinding = {
  workOrderId: WORK_ORDER_ID,
  depositAddress: LIVE_DEPOSIT_ADDRESS,
  originAsset: BASE_USDC,
  destinationAsset: NEAR_USDC,
  recipient: 'mend.near',
  amountIn: '10000000',
  minAmountOut: '9893715',
  destinationChain: 'near',
  escrowToken: NEAR_USDC_CONTRACT,
};

const ESCROW: EscrowFunding = {
  workOrderId: WORK_ORDER_ID,
  token: NEAR_USDC_CONTRACT,
  fundedMicro: '9993652',
};

const BEFORE_DEADLINE = new Date('2026-11-09T09:45:00.000Z');
const AFTER_DEADLINE = new Date('2026-11-13T00:00:00.000Z');

function successRaw(): any {
  return structuredClone(loadFixture('status.success.near.synthetic.json'));
}

function reconcile(raw: unknown, overrides: Partial<Parameters<typeof reconcileStatus>[1]> = {}) {
  return reconcileStatus(statusLike(raw), {
    binding: BINDING,
    escrow: ESCROW,
    now: BEFORE_DEADLINE,
    ...overrides,
  });
}

describe('sponsorship reconciliation', () => {
  it('credits exactly once when signature, binding, destination tx, amount and escrow all match', () => {
    const result = reconcile(successRaw());
    expect(result.outcome).toBe('FUNDED');
    expect(result.credited).toBe(true);
    expect(result.creditedAmount).toBe('9993652');
    expect(result.workOrderId).toBe(WORK_ORDER_ID);
    expect(result.destinationTxHash).toBe('11111111111111111111111111111111');
    expect(result.explorerUrl).toBe('https://nearblocks.io/txns/11111111111111111111111111111111');
    expect(result.overpaid).toBe(false);
    expect(result.shortfall).toBeNull();
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  it('handles underpayment without crediting', () => {
    const raw = successRaw();
    raw.swapDetails.depositedAmount = '5000000';
    raw.swapDetails.amountIn = '5000000';
    const result = reconcile(raw);
    expect(result.outcome).toBe('UNDERFUNDED');
    expect(result.credited).toBe(false);
    expect(result.creditedAmount).toBeNull();
    expect(result.shortfall).toBe('5000000');
    expect(result.reason).toBe('UNDERPAYMENT');
  });

  it('handles overpayment by crediting only the intended output and reporting the excess', () => {
    const raw = successRaw();
    raw.swapDetails.depositedAmount = '12000000';
    raw.swapDetails.amountIn = '12000000';
    const result = reconcile(raw);
    expect(result.outcome).toBe('FUNDED');
    expect(result.credited).toBe(true);
    expect(result.creditedAmount).toBe('9993652');
    expect(result.overpaid).toBe(true);
    expect(result.excess).toBe('2000000');
  });

  it('rejects a duplicate callback for an already-seen destination tx', () => {
    const result = reconcile(successRaw(), { seenDestinationTxHashes: ['11111111111111111111111111111111'] });
    expect(result.outcome).toBe('DUPLICATE');
    expect(result.credited).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(result.reason).toBe('DUPLICATE_DESTINATION_TX');
  });

  it('rejects a duplicate callback when the work order is already credited', () => {
    const result = reconcile(successRaw(), { alreadyCredited: true });
    expect(result.outcome).toBe('DUPLICATE');
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('ALREADY_CREDITED');
  });

  it('accepts delayed settlement after the quote deadline when SUCCESS proof is present', () => {
    const result = reconcile(successRaw(), { now: AFTER_DEADLINE });
    expect(result.state).toBe('SUCCESS');
    expect(result.outcome).toBe('FUNDED');
    expect(result.credited).toBe(true);
  });

  it('maps a pending deposit past the deadline to EXPIRED without crediting', () => {
    const result = reconcile(loadFixture('status.pending-deposit.json'), { now: AFTER_DEADLINE });
    expect(result.outcome).toBe('EXPIRED');
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('QUOTE_DEADLINE_PASSED');
  });

  it('handles refunds with amount and reason', () => {
    const result = reconcile(loadFixture('status.refunded.synthetic.json'));
    expect(result.outcome).toBe('REFUNDED');
    expect(result.credited).toBe(false);
    expect(result.refundedAmount).toBe('4997600');
    expect(result.refundReason).toBe('PARTIAL_DEPOSIT');
  });

  it('handles failure without crediting', () => {
    const result = reconcile(loadFixture('status.failed.synthetic.json'));
    expect(result.outcome).toBe('FAILED');
    expect(result.credited).toBe(false);
  });

  it('handles INCOMPLETE_DEPOSIT as underfunded with a shortfall', () => {
    const result = reconcile(loadFixture('status.incomplete-deposit.synthetic.json'));
    expect(result.outcome).toBe('UNDERFUNDED');
    expect(result.credited).toBe(false);
    expect(result.shortfall).toBe('5000000');
  });

  it('fails closed on an unknown status and preserves the raw status', () => {
    const result = reconcile(loadFixture('status.unknown.synthetic.json'));
    expect(result.outcome).toBe('UNDERFUNDED');
    expect(result.credited).toBe(false);
    expect(result.rawStatus).toBe('FUTURE_STATUS_NOT_IN_DOCS');
    expect(result.reason).toBe('UNKNOWN_STATUS:FUTURE_STATUS_NOT_IN_DOCS');
  });

  it('refuses to credit when the recipient binding does not match', () => {
    const result = reconcile(successRaw(), { binding: { ...BINDING, recipient: 'attacker.near' } });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('CHECK_FAILED:recipient');
  });

  it('refuses to credit when the destination asset does not match', () => {
    const result = reconcile(successRaw(), { binding: { ...BINDING, destinationAsset: 'nep141:other' } });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.reason).toBe('CHECK_FAILED:destinationAsset');
  });

  it('refuses to credit when the output is below the signed minimum', () => {
    const raw = successRaw();
    raw.swapDetails.amountOut = '100';
    const result = reconcile(raw);
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('OUTPUT_BELOW_MINIMUM');
  });

  it('does not credit SUCCESS without a destination transaction', () => {
    const raw = successRaw();
    raw.swapDetails.destinationChainTxHashes = [];
    const result = reconcile(raw);
    expect(result.outcome).toBe('PENDING');
    expect(result.proofPending).toBe(true);
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('AWAITING_DESTINATION_TX');
  });

  it('does not credit without escrow funding evidence', () => {
    const result = reconcile(successRaw(), { escrow: undefined });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('MISSING_ESCROW_FUNDING');
  });

  it('does not credit when escrow belongs to another work order', () => {
    const result = reconcile(successRaw(), { escrow: { ...ESCROW, workOrderId: 'WO-OTHER-0001' } });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.reason).toBe('CHECK_FAILED:escrowWorkOrder');
  });

  it('does not credit when escrow is underfunded', () => {
    const result = reconcile(successRaw(), { escrow: { ...ESCROW, fundedMicro: '100' } });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.reason).toBe('CHECK_FAILED:escrowAmount');
  });

  it('does not credit when the escrow token does not match', () => {
    const result = reconcile(successRaw(), { escrow: { ...ESCROW, token: 'wrong-token.near' } });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.reason).toBe('CHECK_FAILED:escrowToken');
  });

  it('does not credit an unverified signed quote', () => {
    const raw = successRaw();
    const result = reconcileStatus(statusLike(raw, false), { binding: BINDING, escrow: ESCROW, now: BEFORE_DEADLINE });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('CHECK_FAILED:signature');
  });

  it('does not credit when the signed quote is missing', () => {
    const result = reconcile(loadFixture('status.success.public-btc-sample.json'));
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.credited).toBe(false);
    expect(result.reason).toBe('MISSING_SIGNED_QUOTE');
  });

  it('does not credit an empty work-order binding', () => {
    const result = reconcile(successRaw(), { binding: { ...BINDING, workOrderId: '  ' } });
    expect(result.outcome).toBe('INCOMPLETE');
    expect(result.reason).toBe('CHECK_FAILED:workOrderId');
  });

  it('uses the API explorerUrl when populated and builds one when empty', () => {
    const withUrl = successRaw();
    withUrl.swapDetails.destinationChainTxHashes[0].explorerUrl = 'https://example.com/tx/abc';
    expect(reconcile(withUrl).explorerUrl).toBe('https://example.com/tx/abc');

    const empty = successRaw();
    empty.swapDetails.destinationChainTxHashes[0].explorerUrl = '';
    expect(reconcile(empty).explorerUrl).toBe('https://nearblocks.io/txns/11111111111111111111111111111111');
  });
});

import { describe, expect, it } from 'vitest';
import { extractQuoteDeadline, trackStatus } from '../src/status.js';
import { loadFixture, statusLike } from './helpers.js';

const BEFORE_DEADLINE = new Date('2026-11-09T09:40:30.000Z');
const AFTER_DEADLINE = new Date('2026-11-13T00:00:00.000Z');

describe('status tracker', () => {
  const documented: Array<[string, string, string, boolean]> = [
    ['status.pending-deposit.json', 'PENDING', 'AWAITING_SPONSOR_FUNDS', false],
    ['status.known-deposit-tx.synthetic.json', 'PENDING', 'DEPOSIT_DETECTED', false],
    ['status.processing.synthetic.json', 'PENDING', 'SETTLING', false],
    ['status.success.near.synthetic.json', 'SUCCESS', 'SETTLING', true],
    ['status.incomplete-deposit.synthetic.json', 'INCOMPLETE', 'UNDERFUNDED', false],
    ['status.refunded.synthetic.json', 'REFUNDED', 'REFUNDED', true],
    ['status.failed.synthetic.json', 'FAILED', 'FAILED', true],
  ];
  for (const [file, state, flowState, terminal] of documented) {
    it(`maps ${file} to ${state}`, () => {
      const tracked = trackStatus(statusLike(loadFixture(file)), { now: BEFORE_DEADLINE });
      expect(tracked.state).toBe(state);
      expect(tracked.flowState).toBe(flowState);
      expect(tracked.terminal).toBe(terminal);
      expect(tracked.known).toBe(true);
      expect(tracked.failClosed).toBe(false);
    });
  }

  it('maps an undocumented status to INCOMPLETE, fails closed and preserves the raw response', () => {
    const raw = loadFixture('status.unknown.synthetic.json');
    const tracked = trackStatus(statusLike(raw), { now: BEFORE_DEADLINE });
    expect(tracked.state).toBe('INCOMPLETE');
    expect(tracked.flowState).toBe('UNDERFUNDED');
    expect(tracked.known).toBe(false);
    expect(tracked.failClosed).toBe(true);
    expect(tracked.terminal).toBe(false);
    expect(tracked.rawStatus).toBe('FUTURE_STATUS_NOT_IN_DOCS');
    expect(tracked.reason).toBe('UNKNOWN_STATUS:FUTURE_STATUS_NOT_IN_DOCS');
    expect(tracked.raw).toEqual(raw);
  });

  it('computes client-only expiry when PENDING_DEPOSIT is past the quote deadline', () => {
    const tracked = trackStatus(statusLike(loadFixture('status.pending-deposit.json')), { now: AFTER_DEADLINE });
    expect(tracked.state).toBe('EXPIRED');
    expect(tracked.flowState).toBe('EXPIRED');
    expect(tracked.terminal).toBe(true);
    expect(tracked.clientExpired).toBe(true);
    expect(tracked.expired).toBe(true);
    expect(tracked.quoteDeadline).toBe('2026-11-12T10:10:22.000Z');
    expect(tracked.reason).toBe('QUOTE_DEADLINE_PASSED');
  });

  it('does not expire a pending deposit before the deadline', () => {
    const tracked = trackStatus(statusLike(loadFixture('status.pending-deposit.json')), { now: BEFORE_DEADLINE });
    expect(tracked.state).toBe('PENDING');
    expect(tracked.clientExpired).toBe(false);
  });

  it('honours an explicit deadline override', () => {
    const tracked = trackStatus(statusLike(loadFixture('status.pending-deposit.json')), {
      now: BEFORE_DEADLINE,
      deadline: '2026-11-09T09:00:00.000Z',
    });
    expect(tracked.state).toBe('EXPIRED');
  });

  it('does not mark a SUCCESS after the deadline as expired', () => {
    const tracked = trackStatus(statusLike(loadFixture('status.success.near.synthetic.json')), { now: AFTER_DEADLINE });
    expect(tracked.state).toBe('SUCCESS');
    expect(tracked.clientExpired).toBe(false);
  });

  it('extracts the signed quote deadline', () => {
    const response = statusLike(loadFixture('status.pending-deposit.json')).response;
    expect(extractQuoteDeadline(response)).toBe('2026-11-12T10:10:22.000Z');
  });

  it('captures refund reason, refunded amount and destination transaction hashes', () => {
    const refunded = trackStatus(statusLike(loadFixture('status.refunded.synthetic.json')), { now: BEFORE_DEADLINE });
    expect(refunded.refundReason).toBe('PARTIAL_DEPOSIT');
    expect(refunded.substatus).toBe('PARTIAL_DEPOSIT');
    expect(refunded.refundedAmount).toBe('4997600');

    const success = trackStatus(statusLike(loadFixture('status.success.near.synthetic.json')), { now: BEFORE_DEADLINE });
    expect(success.destinationTxHashes).toEqual(['11111111111111111111111111111111']);
    expect(success.amountOut).toBe('9993652');
    expect(success.depositedAmount).toBe('10000000');
  });

  it('tracks the recorded public BTC SUCCESS excerpt', () => {
    const tracked = trackStatus(statusLike(loadFixture('status.success.public-btc-sample.json'), false), { now: BEFORE_DEADLINE });
    expect(tracked.state).toBe('SUCCESS');
    expect(tracked.terminal).toBe(true);
    expect(tracked.verified).toBe(false);
    expect(tracked.destinationTxHashes).toEqual(['f2e2647f61553f9c38822d5920f5fa897e5bb0cd7982d34a1cd20feb936f718b']);
  });
});

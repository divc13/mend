import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ExecutionStatusResponseSchema,
  QuoteResponseSchema,
  TokenResponseSchema,
  buildQuoteView,
  reconcileStatus,
  trackStatus,
  verifySignedQuote,
  type StatusLike,
} from '@mend/intents-client';

import { repoPath } from '../security/support/repo.js';

function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(repoPath('fixtures', 'payments', name), 'utf8')) as T;
}

const tokens = (fixture<{ tokens: unknown[] }>('tokens.snapshot.json').tokens ?? []).map((token) =>
  TokenResponseSchema.parse(token),
);

function statusLike(raw: unknown, verified = true): StatusLike {
  return { response: ExecutionStatusResponseSchema.parse(raw), raw, verified };
}

function statusBinding(raw: unknown, workOrderId = 'WO-BENCH-001-0001') {
  const parsed = ExecutionStatusResponseSchema.parse(raw);
  const request = parsed.quoteResponse?.quoteRequest;
  if (!request) throw new Error('fixture has no signed quoteRequest');
  return {
    workOrderId,
    depositAddress: parsed.quoteResponse?.quote.depositAddress ?? '',
    originAsset: request.originAsset,
    destinationAsset: request.destinationAsset,
    recipient: request.recipient,
    amountIn: request.amount,
    minAmountOut: parsed.quoteResponse?.quote.minAmountOut,
    destinationChain: 'near',
  };
}

describe('scenario D — sponsorship uncertainty', () => {
  it('never presents a dry quote as a payment', () => {
    const raw = fixture('quote.dry.base-usdc-near-usdc.json');
    const parsed = QuoteResponseSchema.parse(raw);
    const view = buildQuoteView({ response: parsed, raw, verified: verifySignedQuote(raw) }, { tokens });

    expect(view.quoteKind).toBe('DRY_PREVIEW');
    expect(view.isPayment).toBe(false);
    expect(view.canBePresentedAsPayment).toBe(false);
    expect(view.requiresReconciliation).toBe(true);
    expect(view.deposit).toBeNull();
    expect(view.label).toMatch(/preview only/i);
    expect(view.warnings.join(' ')).toMatch(/not a payment/i);
    expect(view.mainnetOnly).toBe(true);
  });

  it('presents a live quote as a deposit request, never as a completed payment', () => {
    const raw = fixture('quote.live.base-usdc-near-usdc.json');
    const parsed = QuoteResponseSchema.parse(raw);
    const view = buildQuoteView(
      { response: parsed, raw, verified: verifySignedQuote(raw) },
      { tokens, workOrderId: 'WO-BENCH-001-0001' },
    );

    expect(view.quoteKind).toBe('LIVE_DEPOSIT_REQUEST');
    expect(view.isPayment).toBe(false);
    expect(view.canBePresentedAsPayment).toBe(false);
    expect(view.deposit?.address).toBeTruthy();
    expect(view.warnings.join(' ')).toMatch(/not a completed payment/i);
    expect(view.workOrderId).toBe('WO-BENCH-001-0001');
  });

  it('rejects a quote whose recipient was tampered with', () => {
    const raw = fixture('quote.dry.tampered-recipient.json');
    expect(verifySignedQuote(raw)).toBe(false);
    expect(verifySignedQuote(fixture('quote.dry.base-usdc-near-usdc.json'))).toBe(true);
  });

  it('maps every documented status and fails closed on unknown values', () => {
    const now = new Date('2026-11-09T09:40:30.000Z');
    const cases = [
      ['status.pending-deposit.json', 'PENDING', 'AWAITING_SPONSOR_FUNDS', false],
      ['status.known-deposit-tx.synthetic.json', 'PENDING', 'DEPOSIT_DETECTED', false],
      ['status.processing.synthetic.json', 'PENDING', 'SETTLING', false],
      ['status.success.near.synthetic.json', 'SUCCESS', 'SETTLING', true],
      ['status.incomplete-deposit.synthetic.json', 'INCOMPLETE', 'UNDERFUNDED', false],
      ['status.refunded.synthetic.json', 'REFUNDED', 'REFUNDED', true],
      ['status.failed.synthetic.json', 'FAILED', 'FAILED', true],
    ] as const;
    for (const [file, state, flowState, terminal] of cases) {
      const tracked = trackStatus(statusLike(fixture(file)), { now });
      expect(tracked.state, file).toBe(state);
      expect(tracked.flowState, file).toBe(flowState);
      expect(tracked.terminal, file).toBe(terminal);
    }

    const unknown = trackStatus(statusLike(fixture('status.unknown.synthetic.json')), { now });
    expect(unknown.known).toBe(false);
    expect(unknown.failClosed).toBe(true);
    expect(unknown.state).toBe('INCOMPLETE');
  });

  it('computes client-only expiry instead of inventing an EXPIRED API status', () => {
    const tracked = trackStatus(statusLike(fixture('status.pending-deposit.json')), {
      now: new Date('2026-11-13T00:00:00.000Z'),
    });
    expect(tracked.state).toBe('EXPIRED');
    expect(tracked.clientExpired).toBe(true);
    expect(tracked.reason).toBe('QUOTE_DEADLINE_PASSED');
  });

  it('never credits an underpayment, refund or failure', () => {
    const incompleteRaw = fixture('status.incomplete-deposit.synthetic.json');
    const incomplete = reconcileStatus(statusLike(incompleteRaw), {
      binding: statusBinding(incompleteRaw),
      now: new Date('2026-11-09T09:40:30.000Z'),
    });
    expect(incomplete.outcome).toBe('UNDERFUNDED');
    expect(incomplete.credited).toBe(false);
    expect(incomplete.creditedAmount).toBeNull();

    const refundedRaw = fixture('status.refunded.synthetic.json');
    const refunded = reconcileStatus(statusLike(refundedRaw), {
      binding: statusBinding(refundedRaw),
      now: new Date('2026-11-09T09:40:30.000Z'),
    });
    expect(refunded.outcome).toBe('REFUNDED');
    expect(refunded.credited).toBe(false);

    const failedRaw = fixture('status.failed.synthetic.json');
    const failed = reconcileStatus(statusLike(failedRaw), {
      binding: statusBinding(failedRaw),
      now: new Date('2026-11-09T09:40:30.000Z'),
    });
    expect(failed.outcome).toBe('FAILED');
    expect(failed.credited).toBe(false);
  });

  it('marks replay fixtures as mainnet-only recorded data, not testnet payments', () => {
    const manifest = fixture<{
      network: string;
      mainnetOnly: boolean;
      note: string;
      files: Record<string, { provenance: string }>;
    }>('manifest.json');
    expect(manifest.network).toBe('mainnet');
    expect(manifest.mainnetOnly).toBe(true);
    expect(manifest.note).toMatch(/not payments/i);
    for (const entry of Object.values(manifest.files)) {
      expect(['RECORDED', 'RECORDED_SUBSET', 'RECORDED_EXCERPT', 'COMPOSED_SYNTHETIC', 'SCHEMA_SYNTHETIC', 'DERIVED_TAMPERED', 'RECORDED_SHAPE']).toContain(
        entry.provenance,
      );
    }
  });
});

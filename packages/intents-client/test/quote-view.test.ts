import { describe, expect, it } from 'vitest';
import { UNAUTHENTICATED_FEE_NOTICE, buildQuoteView } from '../src/quote-view.js';
import { QuoteResponseSchema, type QuoteResponse, type TokenResponse } from '../src/schemas.js';
import { MAINNET_ONLY_LABEL } from '../src/mainnet-guard.js';
import { loadFixture } from './helpers.js';

function quoteResult(file: string) {
  const raw = loadFixture(file);
  return { response: QuoteResponseSchema.parse(raw) as QuoteResponse, raw, verified: true as const };
}

const tokens = loadFixture<TokenResponse[]>('tokens.snapshot.json');

describe('quote UX data', () => {
  it('labels a dry quote as preview-only and gives it no deposit instructions', () => {
    const view = buildQuoteView(quoteResult('quote.dry.base-usdc-near-usdc.json'), { tokens, workOrderId: 'WO-BENCH-001-0001' });
    expect(view.quoteKind).toBe('DRY_PREVIEW');
    expect(view.isPayment).toBe(false);
    expect(view.canBePresentedAsPayment).toBe(false);
    expect(view.requiresReconciliation).toBe(true);
    expect(view.deposit).toBeNull();
    expect(view.label).toContain('Preview only');
    expect(view.mainnetOnly).toBe(true);
    expect(view.mainnetNotice).toBe(MAINNET_ONLY_LABEL);
    expect(view.workOrderId).toBe('WO-BENCH-001-0001');
    expect(view.expiresAt).toBeNull();
    expect(view.requestDeadline).toBe('2026-11-09T10:17:25.000Z');
    expect(view.warnings).toContain('Preview only — no deposit address yet. This is not a payment.');
  });

  it('shows source, destination, recipient binding, estimated output and fees', () => {
    const view = buildQuoteView(quoteResult('quote.dry.base-usdc-near-usdc.json'), { tokens });
    expect(view.source.chain).toBe('base');
    expect(view.source.symbol).toBe('USDC');
    expect(view.source.amount).toBe('150000');
    expect(view.destination.chain).toBe('near');
    expect(view.destination.symbol).toBe('USDC');
    expect(view.destination.recipient).toBe('root.near');
    expect(view.destination.recipientType).toBe('DESTINATION_CHAIN');
    expect(view.recipientBinding.signatureVerified).toBe(true);
    expect(view.estimatedOutput).toBe('149968');
    expect(view.minimumOutput).toBe('148468');
    expect(view.timeEstimateSeconds).toBe(35);
    expect(view.fees.refundFee).toBe('2400');
    expect(view.fees.withdrawFee).toBe('0');
    expect(view.fees.appFeeBpsTotal).toBe(1);
    expect(view.fees.estimated).toBe(true);
    expect(view.fees.estimatedFeeUsd).toBeGreaterThan(0);
  });

  it('shows deposit instructions for a live quote but still marks it as not a payment', () => {
    const view = buildQuoteView(quoteResult('quote.live.base-usdc-near-usdc.json'), { tokens });
    expect(view.quoteKind).toBe('LIVE_DEPOSIT_REQUEST');
    expect(view.isPayment).toBe(false);
    expect(view.canBePresentedAsPayment).toBe(false);
    expect(view.deposit).not.toBeNull();
    expect(view.deposit?.address).toBe('0x5eFF1eda63DF64B9831483888702e56Ea62Def95');
    expect(view.deposit?.memo).toBeNull();
    expect(view.deposit?.instructions).toContain('Send exactly 10.0 USDC on base');
    expect(view.deposit?.intentExplorerUrl.url).toBe('https://explorer.near-intents.org/transactions/0x5eFF1eda63DF64B9831483888702e56Ea62Def95');
    expect(view.expiresAt).toBe('2026-11-12T10:10:22.000Z');
    expect(view.warnings.some((warning) => warning.includes('not a completed payment'))).toBe(true);
    expect(view.warnings.some((warning) => warning.includes('Funds arrive at the MEND hub only after SUCCESS'))).toBe(true);
  });

  it('surfaces a required memo and an encoded intent explorer link', () => {
    const result = quoteResult('quote.live.base-usdc-near-usdc.json');
    result.response.quote.depositMemo = 'MEMO 1';
    const view = buildQuoteView(result, { tokens });
    expect(view.deposit?.memo).toBe('MEMO 1');
    expect(view.deposit?.instructions).not.toContain('Memo');
    expect(view.warnings).toContain('Memo required: MEMO 1');
    expect(view.deposit?.intentExplorerUrl.url).toContain('depositMemo=MEMO%201');
  });

  it('does not fabricate a deposit when a live quote is missing its address', () => {
    const result = quoteResult('quote.live.base-usdc-near-usdc.json');
    delete result.response.quote.depositAddress;
    const view = buildQuoteView(result, { tokens });
    expect(view.deposit).toBeNull();
    expect(view.warnings).toContain('Deposit address missing — do not send funds.');
  });

  it('discloses the possible 25 bps fee for unauthenticated quotes', () => {
    const view = buildQuoteView(quoteResult('quote.dry.base-usdc-near-usdc.json'), { tokens, authenticated: false });
    expect(view.warnings).toContain(UNAUTHENTICATED_FEE_NOTICE);
    const authenticated = buildQuoteView(quoteResult('quote.dry.base-usdc-near-usdc.json'), { tokens, authenticated: true });
    expect(authenticated.warnings).not.toContain(UNAUTHENTICATED_FEE_NOTICE);
  });

  it('degrades honestly when token metadata is unavailable', () => {
    const view = buildQuoteView(quoteResult('quote.dry.base-usdc-near-usdc.json'));
    expect(view.source.symbol).toBeNull();
    expect(view.source.chain).toBe('unknown');
    expect(view.destination.symbol).toBeNull();
    expect(view.destination.chain).toBe('near');
  });
});

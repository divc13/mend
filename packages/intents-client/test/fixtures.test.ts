import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  EXECUTION_STATUSES,
  ExecutionStatusResponseSchema,
  QuoteResponseSchema,
  TokenResponseSchema,
} from '../src/schemas.js';
import { verifySignedQuote } from '../src/signature.js';
import { loadFixture } from './helpers.js';

describe('recorded Intents fixtures', () => {
  it('validates the token snapshot subset', () => {
    const tokens = loadFixture('tokens.snapshot.json');
    const parsed = TokenResponseSchema.array().parse(tokens);
    expect(parsed.length).toBeGreaterThanOrEqual(5);
    expect(parsed.some((token) => token.blockchain === 'near' && token.symbol === 'USDC')).toBe(true);
    expect(parsed.some((token) => token.blockchain === 'base' && token.symbol === 'USDC')).toBe(true);
  });

  it('validates and verifies the recorded dry quote', () => {
    const raw = loadFixture('quote.dry.base-usdc-near-usdc.json');
    const parsed = QuoteResponseSchema.parse(raw);
    expect(parsed.quoteRequest.dry).toBe(true);
    expect(parsed.quote.depositAddress).toBeUndefined();
    expect(verifySignedQuote(raw)).toBe(true);
  });

  it('validates and verifies the recorded non-dry quote', () => {
    const raw = loadFixture('quote.live.base-usdc-near-usdc.json');
    const parsed = QuoteResponseSchema.parse(raw);
    expect(parsed.quoteRequest.dry).toBe(false);
    expect(parsed.quote.depositAddress).toBe('0x5eFF1eda63DF64B9831483888702e56Ea62Def95');
    expect(verifySignedQuote(raw)).toBe(true);
  });

  it('rejects a tampered recipient signature', () => {
    const raw = loadFixture('quote.dry.tampered-recipient.json');
    const parsed = QuoteResponseSchema.parse(raw);
    expect(parsed.quoteRequest.recipient).toBe('attacker.near');
    expect(verifySignedQuote(raw)).toBe(false);
  });

  it('validates every recorded/synthetic status fixture', () => {
    const files = [
      'status.pending-deposit.json',
      'status.success.near.synthetic.json',
      'status.success.public-btc-sample.json',
      'status.refunded.synthetic.json',
      'status.failed.synthetic.json',
      'status.incomplete-deposit.synthetic.json',
      'status.known-deposit-tx.synthetic.json',
      'status.processing.synthetic.json',
      'status.unknown.synthetic.json',
    ];
    for (const file of files) {
      const raw = loadFixture(file);
      const parsed = ExecutionStatusResponseSchema.parse(raw);
      expect(parsed.status.length).toBeGreaterThan(0);
    }
  });

  it('verifies the signed quoteResponse embedded in recorded/synthetic statuses', () => {
    for (const file of ['status.pending-deposit.json', 'status.success.near.synthetic.json', 'status.refunded.synthetic.json']) {
      const raw = loadFixture(file);
      const parsed = ExecutionStatusResponseSchema.parse(raw);
      expect(parsed.quoteResponse).toBeDefined();
      expect(verifySignedQuote(raw.quoteResponse)).toBe(true);
    }
  });

  it('keeps the documented status enum exact', () => {
    expect(EXECUTION_STATUSES).toEqual([
      'PENDING_DEPOSIT',
      'KNOWN_DEPOSIT_TX',
      'PROCESSING',
      'SUCCESS',
      'INCOMPLETE_DEPOSIT',
      'REFUNDED',
      'FAILED',
    ]);
    expect(EXECUTION_STATUSES).not.toContain('EXPIRED');
  });

  it('records the public BTC SUCCESS excerpt without inventing a signature', () => {
    const raw = loadFixture('status.success.public-btc-sample.json');
    const parsed = ExecutionStatusResponseSchema.parse(raw);
    expect(parsed.status).toBe('SUCCESS');
    expect(parsed.quoteResponse).toBeUndefined();
    expect(parsed.swapDetails.destinationChainTxHashes[0]?.explorerUrl).toBe('');
  });

  it('has a manifest entry and file for every fixture', () => {
    const manifest = loadFixture('manifest.json');
    expect(manifest.mainnetOnly).toBe(true);
    for (const file of Object.keys(manifest.files as Record<string, unknown>)) {
      const url = new URL(`../../../fixtures/payments/${file}`, import.meta.url);
      expect(() => readFileSync(url, 'utf8')).not.toThrow();
    }
  });
});

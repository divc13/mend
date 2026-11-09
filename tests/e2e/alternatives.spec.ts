import { expect, test } from '@playwright/test';

import {
  ExecutionStatusResponseSchema,
  QuoteResponseSchema,
  buildQuoteView,
  trackStatus,
} from '@mend/intents-client';

import {
  API_URL,
  apiReachable,
  cargoAvailable,
  readJsonFixture,
  runCargoTest,
  webReachable,
} from './support/env.js';

/**
 * T07.6 / Scenarios B and D — alternative lifecycles.
 *
 * Contract replay and recorded Intents replay always run. API/UI tests skip
 * with an explicit reason until the backend/frontend tracks are merged.
 */
test.describe('alternative paths', () => {
  test.describe('contract replay', () => {
    const cases: Array<{ name: string; filter: string }> = [
      {
        name: 'failed durability reopens the same work order and remediation releases the holdback once',
        filter: 'failed_durability_reopens_same_work_order_and_remediation_releases_holdback_once',
      },
      { name: 'dispute freezes payouts and only the DAO resolves', filter: 'disputes_freeze_payouts_and_only_dao_resolves' },
      { name: 'dispute refund cannot double pay', filter: 'dispute_refund_cannot_double_pay' },
      { name: 'cancellation and refund release exact escrow once', filter: 'cancel_and_refund_release_exact_escrow_once' },
      { name: 'warranty reopening creates no new escrow', filter: 'failed_durability_reopens_same_work_order' },
    ];

    for (const item of cases) {
      test(item.name, () => {
        test.skip(!cargoAvailable(), 'SKIP: cargo is not installed; contract replay cannot run');
        const result = runCargoTest('contracts/Cargo.toml', item.filter);
        expect(result.ok, result.output.slice(-6_000)).toBe(true);
        expect(result.output).toMatch(/1 passed/);
      });
    }
  });

  test.describe('recorded Intents replay', () => {
    test('a failed sponsorship is FAILED and never a payment', () => {
      const raw = readJsonFixture('fixtures', 'payments', 'status.failed.synthetic.json');
      const tracked = trackStatus({ response: ExecutionStatusResponseSchema.parse(raw), raw, verified: false });
      expect(tracked.state).toBe('FAILED');
      expect(tracked.flowState).toBe('FAILED');
      expect(tracked.terminal).toBe(true);
    });

    test('a dry quote is a preview with no deposit address and is never a payment', () => {
      const raw = readJsonFixture('fixtures', 'payments', 'quote.dry.base-usdc-near-usdc.json');
      const parsed = QuoteResponseSchema.parse(raw);
      const view = buildQuoteView({ response: parsed, raw, verified: true });
      expect(view.quoteKind).toBe('DRY_PREVIEW');
      expect(view.isPayment).toBe(false);
      expect(view.deposit).toBeNull();
      expect(view.warnings.join(' ')).toMatch(/not a payment/i);
    });

    test('a refunded sponsorship stays REFUNDED with no credit', () => {
      const raw = readJsonFixture('fixtures', 'payments', 'status.refunded.synthetic.json');
      const tracked = trackStatus({ response: ExecutionStatusResponseSchema.parse(raw), raw, verified: false });
      expect(tracked.state).toBe('REFUNDED');
      expect(tracked.flowState).toBe('REFUNDED');
      expect(tracked.terminal).toBe(true);
    });
  });

  test.describe('API alternatives', () => {
    test.beforeEach(async ({ request }) => {
      const reachable = await apiReachable(request);
      test.skip(!reachable, 'SKIP: apps/api is not merged or the API health check is unreachable');
    });

    for (const [name, statuses] of [
      ['failed durability / remediation', /WARRANTY_REOPENED|REMEDIATING/i],
      ['dispute', /DISPUTED/i],
      ['cancellation or refund', /CANCELLED|REFUNDED/i],
    ] as const) {
      test(`${name} is visible through the API when seeded`, async ({ request }) => {
        const list = await request.get(`${API_URL}/v1/work-orders`, { failOnStatusCode: false });
        test.skip(!list.ok(), 'SKIP: work-order list endpoint is unavailable');
        const workOrders = (await list.json()) as Array<{ id: string; status: string }>;
        const match = workOrders.find((workOrder) => statuses.test(workOrder.status));
        test.skip(!match, `SKIP: no seeded work order currently has a ${name} status`);
        if (!match) return;

        const response = await request.get(`${API_URL}/v1/work-orders/${match.id}`, {
          failOnStatusCode: false,
        });
        expect(response.ok()).toBe(true);
        expect(JSON.stringify(await response.json())).toMatch(statuses);
      });
    }
  });

  test.describe('UI alternatives', () => {
    test.beforeEach(async ({ page }) => {
      const reachable = await webReachable(page);
      test.skip(!reachable, 'SKIP: apps/web is not merged or the web URL is unreachable');
    });

    test('warranty and dispute states are labelled in plain language', async ({ page }) => {
      await page.goto('/');
      const body = page.locator('body');
      await expect(body).toContainText(/warranty|durability/i);
      await expect(body).toContainText(/dispute|refund|cancel/i);
    });
  });
});

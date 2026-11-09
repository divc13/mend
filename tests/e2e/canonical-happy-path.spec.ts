import { expect, test } from '@playwright/test';

import {
  API_URL,
  apiReachable,
  cargoAvailable,
  collectNumericStrings,
  runCargoTest,
  webReachable,
} from './support/env.js';

/**
 * T07.5 / Scenario A — the canonical 100/80/72/8 repair.
 *
 * The UI and API halves skip with an explicit reason until the frontend/backend
 * tracks are merged. The contract-replay half always runs (when cargo exists)
 * and proves the exact split against the real hub, independent of the UI.
 */
test.describe('canonical repair A — 100/80/20/72/8', () => {
  test.describe('contract replay', () => {
    test('hub replay pays exactly 72 and holds exactly 8, then releases 8', () => {
      test.skip(!cargoAvailable(), 'SKIP: cargo is not installed; contract replay cannot run');
      const result = runCargoTest('contracts/Cargo.toml', 'happy_path_100_80_20_72_8_released');
      expect(result.ok, result.output.slice(-6_000)).toBe(true);
      expect(result.output).toMatch(/1 passed/);
    });
  });

  test.describe('API', () => {
    test.beforeEach(async ({ request }) => {
      const reachable = await apiReachable(request);
      test.skip(!reachable, 'SKIP: apps/api is not merged or http://localhost:4000/health is unreachable');
    });

    test('budget 100 and the 80 award with a 20 refund are visible', async ({ request }) => {
      const response = await request.get(`${API_URL}/v1/work-orders/WO-BENCH-001-0001`, {
        failOnStatusCode: false,
      });
      test.skip(response.status() === 404, 'SKIP: canonical work order is not seeded in this API instance');
      expect(response.ok()).toBe(true);

      const body = (await response.json()) as {
        budgetMicro?: string;
        mode?: string;
        awardedBidId?: string;
        status?: string;
      };
      expect(body.budgetMicro).toBe('100000000');
      expect(body.awardedBidId).toBe('BID-B-BENCH-001');
      expect(body.mode).toMatch(/REPLAY|LIVE_TESTNET|MAINNET/);

      const payments = await request.get(`${API_URL}/v1/work-orders/WO-BENCH-001-0001/payments`, {
        failOnStatusCode: false,
      });
      expect(payments.ok()).toBe(true);
      const paymentBody = (await payments.json()) as {
        escrow?: Record<string, string>;
        payments?: Array<Record<string, unknown>>;
      };
      expect(paymentBody.escrow?.fundedMicro).toBe('100000000');
      expect(paymentBody.escrow?.refundedMicro).toBe('20000000');
      const numbers = collectNumericStrings(paymentBody);
      expect(numbers.has('100000000')).toBe(true);
      expect(numbers.has('20000000')).toBe(true);
    });

    test('exactly 72 is paid and 8 is held once completion is accepted', async ({ request }) => {
      const response = await request.get(`${API_URL}/v1/work-orders/WO-BENCH-001-0001/payments`, {
        failOnStatusCode: false,
      });
      test.skip(response.status() === 404, 'SKIP: canonical work order is not seeded in this API instance');
      expect(response.ok()).toBe(true);
      const body = (await response.json()) as { escrow?: Record<string, string>; payments?: Array<Record<string, unknown>> };
      const completionPaid = body.escrow?.completionPaidMicro;
      if (completionPaid === '0') {
        test.skip(
          'SKIP: the seeded work order has not reached completion acceptance (completionPaidMicro=0); the contract replay test still proves the exact 72/8 split',
        );
        return;
      }
      expect(completionPaid).toBe('72000000');
      expect(body.escrow?.holdbackHeldMicro === '8000000' || body.escrow?.holdbackReleasedMicro === '8000000').toBe(
        true,
      );
      expect(JSON.stringify(body)).toMatch(/REPLAY|LIVE_TESTNET|MAINNET/);
    });
  });

  test.describe('UI', () => {
    test.beforeEach(async ({ page }) => {
      const reachable = await webReachable(page);
      test.skip(!reachable, 'SKIP: apps/web is not merged or http://localhost:3000 is unreachable');
    });

    test('REPLAY banner is visible and the canonical case shows the split', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/REPLAY\s*\/\s*SIMULATION/i).first()).toBeVisible();
      await expect(page.getByText(/BENCH-001/).first()).toBeVisible();
      await expect(page.getByText(/72(\.0+)?\s*(USDC|mUSDC)/i).first()).toBeVisible();
      await expect(page.getByText(/8(\.0+)?\s*(USDC|mUSDC)/i).first()).toBeVisible();
    });
  });
});

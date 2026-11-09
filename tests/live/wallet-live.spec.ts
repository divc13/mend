import { expect, test } from '@playwright/test';

const LIVE_ACCOUNT = 'mend-contractor-b.testnet';
const MAINNET_LABEL = 'MAINNET — REAL FUNDS';

test.describe('LIVE_TESTNET wallet and live console', () => {
  test.beforeEach(async ({ page }) => {
    // Select live mode before the app boots. ModeProvider still performs its
    // own API health check; the page only enables live controls after that.
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem('mend-mode', 'LIVE_TESTNET');
      } catch {
        // Storage can be unavailable; the server-rendered initial mode is live.
      }
    });
  });

  test('wallet renders create/faucet controls, the testnet warning and a real balance', async ({ page }) => {
    await page.goto('/wallet');

    const createWallet = page.getByTestId('create-testnet-wallet');
    await expect(createWallet).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByTestId('request-testnet-faucet')).toBeVisible();
    await expect(page.getByTestId('request-testnet-faucet')).toBeDisabled();
    await expect(page.getByText('LIVE TESTNET — TEST VALUE ONLY').first()).toBeVisible();
    await expect(page.getByText('No mainnet. No real funds. No deploy.')).toBeVisible();
    await expect(page.getByText('LIVE TESTNET selected. Every account and transaction below is testnet-only.')).toBeVisible();
    // The footer deliberately shows a locked MAINNET label; the active mode
    // banner and every control must stay on LIVE TESTNET.
    const modeBanner = page.getByTestId('mode-badge');
    await expect(modeBanner).toContainText('LIVE TESTNET — TEST VALUE ONLY');
    await expect(modeBanner).not.toContainText(MAINNET_LABEL);
    await expect(page.getByText('MAINNET — REAL FUNDS · locked')).toBeVisible();
    await expect(page.getByRole('button', { name: /mainnet/i })).toHaveCount(0);

    // Exercise the web -> /api/mend proxy -> live API -> testnet RPC path with
    // a known account. This does not create or fund anything.
    await page.locator('#wallet-account-input').fill(LIVE_ACCOUNT);
    await page.getByRole('button', { name: 'Load wallet' }).click();
    await expect(page.getByText(LIVE_ACCOUNT).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('80.00 mUSDC').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Testnet account').first()).toBeVisible();

    const storage = await page.evaluate(() => ({
      html: document.documentElement.innerHTML,
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    }));
    expect(storage.html).not.toMatch(/ed25519:[1-9A-HJ-NP-Za-km-z]{32,}/);
    expect(JSON.stringify(storage.local)).not.toMatch(/ed25519:|secretKey|privateKey|seedPhrase/);
    expect(JSON.stringify(storage.session)).not.toMatch(/ed25519:|secretKey|privateKey|seedPhrase/);
    expect(storage.session['mend-wallet-account-id']).toBe(LIVE_ACCOUNT);
  });

  test('live console renders the run control and an honest unavailable state', async ({ page }) => {
    await page.goto('/live');

    const run = page.getByTestId('run-live-scenario');
    await expect(run).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByText('LIVE TESTNET — TEST VALUE ONLY').first()).toBeVisible();
    await expect(page.getByText('No mainnet, no deploy, no real funds.')).toBeVisible();
    const modeBanner = page.getByTestId('mode-badge');
    await expect(modeBanner).toContainText('LIVE TESTNET — TEST VALUE ONLY');
    await expect(modeBanner).not.toContainText(MAINNET_LABEL);
    await expect(page.getByText('MAINNET — REAL FUNDS · locked')).toBeVisible();
    await expect(page.getByRole('button', { name: /mainnet/i })).toHaveCount(0);

    // The API is started with MEND_LIVE_SCENARIO_ENABLED=false so the suite
    // does not run a multi-minute lifecycle. The UI must say so honestly.
    await run.click();
    await expect(page.getByText('The live run was not confirmed.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Live scenario runner is disabled/)).toBeVisible();
    await expect(page.getByText(/The replay path below is a recording/)).toBeVisible();

    const storage = await page.evaluate(() => ({
      html: document.documentElement.innerHTML,
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    }));
    expect(storage.html).not.toMatch(/ed25519:[1-9A-HJ-NP-Za-km-z]{32,}/);
    expect(JSON.stringify(storage.local)).not.toMatch(/ed25519:|secretKey|privateKey|seedPhrase/);
    expect(JSON.stringify(storage.session)).not.toMatch(/ed25519:|secretKey|privateKey|seedPhrase/);
  });
});

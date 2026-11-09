/**
 * LIVE_TESTNET quality suite. It starts the real API and the Next.js web app
 * with LIVE_TESTNET configuration, then drives the wallet and live-console
 * pages in headless Chromium.
 *
 * The testnet key file is read by the API process from outside the repository;
 * this config only passes its path. No secret is loaded into Playwright.
 */
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const apiUrl = process.env.MEND_LIVE_API_URL ?? 'http://127.0.0.1:4311';
// Next.js 16 dev blocks cross-origin HMR/dev resources when the browser uses
// 127.0.0.1 but the dev server advertises localhost. Use localhost for the web
// origin so the client bundle hydrates; the API stays on 127.0.0.1.
const webUrl = process.env.MEND_LIVE_WEB_URL ?? 'http://localhost:3101';
const keysFile =
  process.env.MEND_TESTNET_KEYS_FILE ?? path.resolve(os.homedir(), '.mend', 'testnet', 'keys.json');

if (!existsSync(keysFile)) {
  // The API still starts, but the live wallet/lookup calls will be unavailable.
  // The suite records that as an explicit failure rather than pretending.
  console.warn(`[live-quality] testnet keys file not found: ${keysFile}`);
}

function env(overrides: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...overrides }).filter(([, value]) => typeof value === 'string'),
  ) as Record<string, string>;
}

export default {
  testDir: './tests/live',
  testMatch: /.*\.spec\.ts$/,
  outputDir: './tests/live/test-results',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure' as const,
    screenshot: 'only-on-failure' as const,
    video: 'off' as const,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'live-chromium',
      use: {
        browserName: 'chromium' as const,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix apps/api run start',
      url: `${apiUrl}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: env({
        NODE_ENV: 'test',
        MEND_MODE: 'LIVE_TESTNET',
        CHAIN_ADAPTER: 'live',
        MEND_TESTNET_KEYS_FILE: keysFile,
        MEND_RPC_URL: 'https://rpc.testnet.fastnear.com',
        MEND_HUB_ACCOUNT: 'mend-hub.testnet',
        MEND_TOKEN_ACCOUNT: 'mend-usdc.testnet',
        HOST: '127.0.0.1',
        PORT: '4311',
        MEND_TESTNET_WALLET_CREATES_PER_IP_HOUR: '1',
        MEND_TESTNET_FAUCETS_PER_IP_HOUR: '1',
        MEND_TESTNET_FAUCET_COOLDOWN_SECONDS: '0',
        MEND_LIVE_SCENARIO_ENABLED: 'false',
        EVIDENCE_URL_SECRET: 'live-quality-test-only-evidence-secret',
      }),
    },
    {
      // Turbopack persists HMR/chunk state under apps/web/.next/dev. A cache
      // left behind by an older checkout or build can make the dev server
      // serve stale chunk hashes, so the client receives
      // reloadPage("HMR hash mismatch") and the page reloads in a tight loop.
      // Always start the live UI from a fresh dev cache; build output in
      // apps/web/.next is left untouched.
      command:
        'node -e "require(\'node:fs\').rmSync(\'apps/web/.next/dev\', { recursive: true, force: true })" && npm --prefix apps/web run dev -- --port 3101',
      url: `${webUrl}/api/config`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: env({
        NODE_ENV: 'test',
        MEND_MODE: 'LIVE_TESTNET',
        MEND_API_BASE_URL: apiUrl,
        NEXT_TELEMETRY_DISABLED: '1',
      }),
    },
  ],
};

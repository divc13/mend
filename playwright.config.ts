/**
 * Root Playwright configuration. Kept dependency-free so `npx playwright test`
 * can load it; spec files import @playwright/test from tests/node_modules after
 * `npm ci --prefix tests`.
 *
 * No webServer is configured: the local stack is started by `scripts/dev.sh`,
 * and suites skip with an explicit reason when the UI/API is absent.
 */
const webUrl = process.env.MEND_WEB_URL ?? 'http://localhost:3000';

export default {
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list']],
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure' as const,
    screenshot: 'only-on-failure' as const,
    video: 'off' as const,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        browserName: 'chromium' as const,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium' as const,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
};

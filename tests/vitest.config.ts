import { defineConfig } from 'vitest/config';

/**
 * Independent T07 suites. Playwright specs live under tests/e2e and are run by
 * the repository root playwright.config.ts, not by Vitest.
 */
export default defineConfig({
  test: {
    include: [
      'integration/**/*.test.ts',
      'security/**/*.test.ts',
      'clean-room/**/*.test.ts',
    ],
    testTimeout: 240_000,
    hookTimeout: 240_000,
    // Contract cargo tests and clean-room checks spawn child processes and
    // inspect the real repository. Keep suites in one worker to avoid racing
    // on cargo's target directory.
    fileParallelism: false,
    reporters: ['default'],
  },
});

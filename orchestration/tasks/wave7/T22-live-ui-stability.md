You are the visible Live UI Stability worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/live-web (branch track/live-web). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and `npm install` at the repo root if needed.

PROBLEM: `npm run test:live` (from the repo root) fails its 2 Playwright LIVE_TESTNET tests. The page repeatedly navigates/re-renders; Playwright reports "element was detached from the DOM, retrying" for `Load wallet` and `run-live-scenario`. The suite passed before the live-web changes were merged, so this is a regression in the live UI or its dev-server interaction.

SCOPE: `apps/web/**` and `tests/live/wallet-live.spec.ts` + `playwright.live.config.ts`. Do NOT edit API, contracts, packages, services, docs, orchestration, root config.

REQUIRED:
1. Reproduce with:
   `cd tests/live && node ../node_modules/@playwright/test/cli.js test --config ../../playwright.live.config.ts --reporter=list`
   Inspect the dev-server/browser console. Find the root cause of the navigation/re-render loop (HMR reload, hydration mismatch, redirect, mode-provider loop, or a test that triggers navigation).
2. Fix the app (or the test only if the test is genuinely wrong) so the wallet and live pages are stable. No test weakening, no arbitrary sleeps to hide a loop.
3. Ensure LIVE_TESTNET mode is selected before boot, wallet controls are stable, the run button is clickable, and the honest disabled-runner state appears.
4. Re-run the full live suite and paste exact results. Also run `cd apps/web && npm run build`.

ACCEPTANCE:
```bash
cd tests/live && node ../node_modules/@playwright/test/cli.js test --config ../../playwright.live.config.ts --reporter=list
cd apps/web && npm run build
```
No mainnet, no deploy, no push.

Commit on branch track/live-web with message `fix(web): stabilize live wallet and scenario UI`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

You are the visible Live Web & Wallet UI worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/live-web (branch track/live-web). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and run `npm install` at the repo root if needed. Then read the context below.

CONTEXT:
- The backend is adding LIVE_TESTNET endpoints: `POST /v1/testnet/wallet`, `POST /v1/testnet/faucet`, `GET /v1/testnet/wallet/:accountId`, `POST /v1/live/run-scenario`, plus the existing API.
- Testnet contracts: hub `mend-hub.testnet`, token `mend-usdc.testnet`. Explorer: `https://explorer.testnet.near.org`.
- REPLAY remains the default. LIVE_TESTNET must be explicit and clearly labeled. MAINNET must never be selectable.

SCOPE: only `apps/web/**`.

GOAL: Build a beautiful, functional testnet wallet + live demo experience, and polish the overall UI.

REQUIRED:
1. `/wallet` page:
   - “Create testnet wallet” → calls the API, shows account ID/public key, displays the secret key ONCE with a download JSON button and a strong warning; never stores the secret in localStorage.
   - “Get 100 test mUSDC” faucet button → calls the API, shows tx hash/explorer link and refreshed balance.
   - Balance/storage status, copy buttons, empty/loading/error states, rate-limit guidance.
   - Clearly labeled `LIVE TESTNET — TEST VALUE ONLY`.
2. `/live` page (or a Live tab in the demo control room):
   - “Run live testnet scenario” → calls `/v1/live/run-scenario`, shows an ordered step timeline with real tx hashes and explorer links.
   - Never show a replay tx as live; if the API is unavailable or mode is REPLAY, show the replay path instead.
3. Navigation: add Wallet and Live links to header/footer; keep the mode banner visible.
4. Visual polish: consistent spacing, typography, cards, buttons, focus states, responsive 390px, reduced motion, accessible labels. Use the existing design system; no new heavy dependencies.
5. Build must pass; add a small component test or Playwright spec if practical.

ACCEPTANCE (paste real output):
```bash
cd apps/web && npm run build
```
No mainnet, no deploy, no push.

Commit on branch track/live-web with message `feat(web): testnet wallet, faucet and live scenario UI`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

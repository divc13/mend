You are the visible Live Quality worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/live-quality (branch track/live-quality). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and `npm install` at the repo root if needed.

CONTEXT:
- The testnet deployment worker has completed a real lifecycle on NEAR testnet; state is in `/Volumes/sandisk/Users/dc/mend-wt/testnet/infra/testnet/live-state.json` (read-only reference; it may update until that worker commits).
- Contracts: hub `mend-hub.testnet`, token `mend-usdc.testnet`. Explorer `https://explorer.testnet.near.org`.
- Keys are OUTSIDE the repo at `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json`. NEVER print, copy or commit secrets.
- Main now includes the live API (`apps/api/src/routes/testnet.ts`, `live-scenario.ts`) and web `/wallet`, `/live` pages.

SCOPE: `tests/live/**`, `playwright.live.config.ts` (new files only). Do NOT edit apps, packages, contracts, services, docs, orchestration, root config.

GOAL: Independently verify the real testnet deployment and live UI/API end-to-end.

REQUIRED:
1. RPC verification script/test:
   - Read live-state.json; query hub `get_work_order`, `get_escrow`, `get_payments`, `get_warranty`, `get_asset`, passport `nft_token` for the final work order.
   - Assert final status `CLOSED`, funding 100000000, refund 20000000, completion 72000000, holdback released 8000000, and every tx hash resolves on testnet RPC.
   - Assert passport transfer fails (`nft_transfer` simulation or view/negative call) and owner is the hub.
2. Live API checks (start the API with LIVE_TESTNET env if needed):
   - `/health` shows LIVE_TESTNET; `/v1/testnet/wallet/:accountId` returns balance/storage without secrets; wallet/faucet endpoints validate input and rate limits.
   - If the faucet creates a real account, record the tx; if rate-limited, record the exact 429 and mark that sub-check BLOCKED, not failed.
3. Playwright live UI (headless):
   - Start web with `MEND_MODE=LIVE_TESTNET` and `MEND_API_BASE_URL` pointing at the live API.
   - `/wallet` renders create-wallet/faucet controls and the testnet-only warning; `/live` renders the run-scenario control or honest unavailable state.
   - No mainnet label, no secret in page HTML/localStorage.
4. Write `tests/live/LIVE-EVIDENCE.md` with exact commands, tx hashes, pass/fail/skip and limitations. Do not fake a result.
5. Run your tests and report exact counts.

ACCEPTANCE (paste real output):
```bash
# whatever commands you add; at minimum:
npm --prefix tests run test:live  # if you add the script, otherwise document exact command
npx playwright test --config playwright.live.config.ts --list
```
No mainnet, no deploy, no push.

Commit on branch track/live-quality with message `test(live): verify testnet lifecycle, API and wallet UI`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TX HASHES, TESTS, BLOCKERS, RISKS, COMMIT.

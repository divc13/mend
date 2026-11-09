You are the visible Testnet Deployment worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/testnet (branch track/testnet). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and run `npm install` at the repo root if needed. Then read the context below.

CONTEXT (already done by the orchestrator, testnet only):
- NEAR testnet accounts exist and keys are stored OUTSIDE the repo at `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json` (chmod 600). NEVER print, copy or commit secrets.
- Accounts: mend-deployer.testnet, mend-hub.testnet, mend-usdc.testnet, mend-dao.testnet, mend-steward.testnet, mend-sponsor.testnet, mend-coordinator-ai.testnet, mend-reviewer-ai.testnet, mend-relayer.testnet, mend-contractor-a..e.testnet, mend-inspector.testnet, mend-inspector-2.testnet.
- `mend-usdc.testnet` has the test token deployed and initialized (symbol mUSDC, 6 decimals, 1,000,000 supply to mend-deployer).
- `mend-hub.testnet` has the hub deployed and initialized (owner mend-deployer, token mend-usdc, dao mend-dao, policy hash `1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d`, durability 2 minutes).
- Partial roles/funding may have failed. Verify everything yourself.
- A working near-api-js install exists at `/Volumes/sandisk/Users/dc/.mend/testnet/deploy/node_modules`; you may reuse it or install in your worktree (never commit node_modules or keys).

SCOPE: `infra/testnet/**` and `scripts/testnet/**` only. Do NOT edit apps, packages, contracts, services, docs, orchestration, root config.

GOAL: Finish a real, complete NEAR TESTNET deployment and prove one full lifecycle with real transaction hashes.

REQUIRED:
1. Verify token metadata/supply, hub config, balances, roles. Register token storage for hub, sponsor, contractors, inspectors and DAO. Transfer 500 mUSDC to mend-sponsor.testnet.
2. Attempt Sputnik DAO v2 creation via factory `sputnikv2.testnet` for name `mend-dao` (yield `mend-dao.sputnikv2.testnet`). If successful, redeploy/re-init the hub with that DAO account (hub has no production state yet) and record the DAO proposal path. If factory fails, keep `mend-dao.testnet` and document exactly why; do not fake a DAO.
3. Create asset `BENCH-001`, mint the non-transferable passport, create work order `WO-BENCH-001-0001` with canonical scope/policy/rosters/deadlines, authorize it from the DAO account (or Sputnik FunctionCall), fund 100 mUSDC via `ft_transfer_call`, open bidding.
4. Run a real lifecycle with role signers:
   - three contractor commitments/reveals (A/B/C canonical bids; include availability),
   - deterministic local score recorded by the steward (OutLayer live publish is not funded; label `LOCAL_DETERMINISTIC` honestly),
   - award B, start work, submit completion evidence hash, inspector acceptance (72 mUSDC), durability pass (8 mUSDC), final `CLOSED`.
5. Write `infra/testnet/live-state.json` with: network, contract IDs, account IDs (no secrets), deadlines, policy hash, work-order ID, asset ID, and every transaction hash + explorer URL. Write `infra/testnet/LIVE-DEPLOYMENT.md` with exact commands, outcomes, and honest limitations (Sputnik success/failure, OutLayer local fallback, no mainnet).
6. Add a repeatable script `infra/testnet/deploy-live.mjs` that performs the deployment/idempotent checks using the keys file path from `MEND_TESTNET_KEYS_FILE` env. It must refuse mainnet and never print secret keys.

ACCEPTANCE:
- `node infra/testnet/deploy-live.mjs --check` (or documented command) passes.
- All transaction hashes are real and queryable on testnet explorer.
- No secret appears in any committed file, log or report.

No mainnet, no git push. Commit on branch track/testnet with message `feat(testnet): live deployment and full lifecycle evidence`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TX HASHES, TESTS, BLOCKERS, RISKS, COMMIT.

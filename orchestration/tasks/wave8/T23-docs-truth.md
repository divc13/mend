You are the visible Documentation Truth worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/docs-demo (branch track/docs-demo). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and read the current evidence files.

CONTEXT — authoritative current reality (do not overclaim):
- Local + testnet implementation is real; CI is now running on GitHub for the first time.
- Real NEAR testnet lifecycle: `WO-BENCH-001-0003` CLOSED, 57 tx, funding 100 mUSDC, refund 20, completion 72, holdback 8 released, escrow 0. Evidence: `orchestration/reports/G3-evidence.md`, `infra/testnet/live-state.json`, `tests/live/LIVE-EVIDENCE.md`.
- G3 PASS with caveats: Sputnik DAO factory failed (plain `mend-dao.testnet` fallback), OutLayer live not used (LOCAL_DETERMINISTIC), hub signing key unavailable (no redeploy), wallet creation rate-limited by public faucet.
- G4 is NOT fully complete. Still incomplete: F02 live NEAR AI inference/signature/attestation; F04 real Sputnik DAO; F05 real Intents deposit/settlement; F07 OutLayer TEE execution; F09 live NEP-366 relayer transaction; F10 live Agent Market listing/job; F13 narration/captions/physical repair media; F14 hosted demo/public repo/X post/submission.
- The repo is now pushed to the private GitHub repo; CI results are pending. Do not claim CI green until it is.
- The 99% figure was wrong relative to PLAN.md; the honest overall status is a strong prototype with G3 passing and several required integrations still incomplete.

SCOPE: `docs/**`, `README.md`, `tests/README.md`, `orchestration/reports/G4-evidence.md`, `orchestration/PROGRESS.md`, and a new root `STATUS.md`. Do NOT edit app/contract/service code, tests logic, or orchestration research/decisions.

REQUIRED:
1. Create `STATUS.md` as the single authoritative matrix: F01–F14 status with exact evidence and gaps, G0–G5 status, and "what is proven / what is not". Use statuses: PASS, PASS_WITH_CAVEATS, PARTIAL, BLOCKED_ON_HUMAN, NOT_STARTED. No inflated percentages.
2. Fix every contradictory stale claim the reviewer found:
   - `docs/README.md:12` (says no live testnet tx)
   - `docs/11-limitations.md:15` (says testnet blocked)
   - `docs/03-architecture.md:242` (says testnet accounts do not exist)
   - `docs/14-submission-package.md:42-45`
   - `docs/16-integration-evidence.md:181` (G4 blocked)
   - `orchestration/reports/G4-evidence.md:49` vs line 55 (G3 blocked then passed)
   - `tests/README.md` old blockers
   - `docs/13-demo-script.md:7` (says no recording; silent MP4 exists)
3. Update `README.md` status block to point to `STATUS.md` and state the real testnet lifecycle + remaining gaps.
4. Update `orchestration/PROGRESS.md`: replace 99% with an honest status (no single inflated percentage; use gate/feature matrix). Include CI-pending note.
5. Keep docs links valid; run `node scripts/demo/check-docs.mjs` and fix failures.
6. Do not invent credentials, hosted URLs, tx hashes, media or CI results.

ACCEPTANCE (paste real output):
```bash
node scripts/demo/check-docs.mjs
```
Commit on branch track/docs-demo with message `docs: authoritative status matrix and remove stale claims`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, BLOCKERS, RISKS, COMMIT.

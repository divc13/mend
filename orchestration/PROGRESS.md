# MEND — Progress Tracker

Last updated: 2026-11-10
Overall: **strong prototype.** No single percentage. The local product and a real
NEAR testnet escrow lifecycle are proven; six features remain partial and several
required live integrations are still blocked on human action. The authoritative
matrix is [`STATUS.md`](../STATUS.md).
Current wave / gate: **G3 PASS_WITH_CAVEATS · G4 PARTIAL · G5 BLOCKED_ON_HUMAN**
CI: **not green** — the first GitHub Actions run failed; a follow-up run was in
progress.
Leader: opencode-go/deepseek-v4.1-flash · Workers: #high, visible iTerm2 tabs (closed when done)

## Done

- [x] Plan read and frozen; no scope cuts
- [x] T00 foundation: worker contract, protocol package, canonical fixtures, traceability, ADR, hub interface
- [x] Wave 0: 5 live research reports (NEAR AI, OutLayer, Intents, DAO+Agent Market, NEAR platform); G0 PASS
- [x] Wave 1: contracts, AI/compute, backend, frontend, payments, infra — merged and independently verified; G1 PASS
- [x] Wave 2: agents/DAO/relayer/Agent Market, quality/security/E2E/clean-room, docs/demo — merged and verified
- [x] G2 local vertical slice: real API + Postgres + web; exact 100 → 20 refund → 72 → 8 → 8 release → CLOSED
- [x] Backend integration: real `@mend/ai-client` + `@mend/intents-client` wiring, honest unavailable states
- [x] Prompt-injection runtime guard fixed in API; attack visible as `prompt_injection_blocked`
- [x] Quality: 55 suites pass incl. independent adversarial Rust crate; E2E 32 pass; axe/keyboard/mobile pass
- [x] Clean-room: 8 pass; `npm ci` from fresh worktree reproducible
- [x] CI updated to install quality tests, run suites, install Chromium and E2E
- [x] 90-second H.264 REPLAY video + 5 scenario screenshots + manifest (`fixtures/demo/captures/`)
- [x] `scripts/verify.sh`: 18 passed, 0 failed, 2 skipped
- [x] G4 evidence written and reconciled to `STATUS.md`: F01/F03/F06/F08/F12 PASS; F07/F09/F11 PASS_WITH_CAVEATS; F02/F04/F05/F10/F13/F14 PARTIAL
- [x] **Real NEAR testnet deployment**: hub/token live, asset + passport, work order funded, 3 bids, award, completion 72 mUSDC, durability 8 mUSDC, final `CLOSED`; 57 tx hashes
- [x] Live testnet API adapter, wallet creation/faucet endpoints, live scenario runner
- [x] `/wallet` and `/live` UI with real testnet balance/faucet and tx explorer links
- [x] Live quality suite: 10 RPC/API checks + 2 Playwright live UI checks PASS
- [x] Real scoped function-call keys provisioned; contractor/inspector/coordinator boundaries proven
- [x] Mainnet USDC profile verified (`17208628…33a1`), guarded by explicit human approval

## Feature matrix

| Status | Features |
|---|---|
| PASS | F01 reporting, F03 passport, F06 sealed market, F08 identities, F12 public case |
| PASS_WITH_CAVEATS | F07 scoring (testnet `LOCAL_DETERMINISTIC`), F09 escrow (no live NEP-366), F11 warranty (failed branch contract-only) |
| PARTIAL | F02 AI triage, F04 DAO, F05 sponsorship, F10 inspection/Agent Market, F13 demo media, F14 submission |
| NOT_STARTED | none |

Full detail: [`STATUS.md`](../STATUS.md).

## Remaining — blocked on human / operational

- CI: the first GitHub Actions run failed; a follow-up run was in progress. Do not claim green until it completes successfully
- F02: live NEAR AI key → authenticated inference + signature/attestation evidence
- F04: real Sputnik DAO; the public factory failed, `mend-dao.testnet` fallback used
- F05: Intents partner JWT or disclosed no-JWT fee; any mainnet deposit requires explicit approval
- F07: OutLayer project publication + funded testnet execution (local deterministic fallback used)
- F09: live NEP-366 relayer transaction
- F10: Agent Market account/token/balance + real job
- F13: narration/captions, final edited video, consented real repair media
- F14: hosted demo, public repository, X post, final submission fields (G5)

## Final test totals

| Suite | Result |
|---|---|
| Protocol | 26 |
| AI & Compute | 41 (+1 skipped live) / Rust 12 |
| Intents | 99 |
| API | 33 (+1 skipped) / with Postgres 34 |
| DB + indexer | 14 + 4 |
| Agents/services | 90 |
| Config + Testkit | 20 + 32 |
| Contracts | 35 + 2 WASM builds |
| Quality | 55 |
| E2E | 32 passed, 8 honest skips |
| Verify script | 18 passed, 0 failed, 2 skipped |
| Live testnet suite | 10 RPC/API checks + 2 Playwright live UI checks passed |

## Gates

| Gate | Status | Note |
|---|---|---|
| G0 | ✅ PASS | Research freeze |
| G1 | ✅ PASS | Track tests and scope checks |
| G2 | ✅ PASS | Local REPLAY vertical slice, exact accounting |
| G3 | ✅ PASS_WITH_CAVEATS | Real testnet lifecycle; Sputnik/OutLayer/hub-key/faucet caveats (see `reports/G3-evidence.md`) |
| G4 | ⚠️ PARTIAL | F02/F04/F05/F10/F13/F14 incomplete; live integrations and human deliverables missing |
| G5 | ⛔ BLOCKED_ON_HUMAN | Final submission approval |

## Evidence files

- `orchestration/reports/G1-evidence.md`
- `orchestration/reports/G2-evidence.md`
- `orchestration/reports/G3-evidence.md`
- `orchestration/reports/G4-evidence.md`
- `orchestration/TRACEABILITY.md`
- `fixtures/demo/captures/capture-manifest.json`
- `STATUS.md`
- `infra/testnet/live-state.json`
- `tests/live/LIVE-EVIDENCE.md`

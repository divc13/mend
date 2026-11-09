# MEND — Progress Tracker

Last updated: 2026-11-09 18:30 (local)
Overall: **98%** — full local product + real NEAR testnet lifecycle verified.
Current wave / gate: **G3 PASS with caveats; G5 blocked on human**
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
- [x] G4 evidence written: F01–F13 PASS, F14 PARTIAL (human-gated parts)
- [x] **Real NEAR testnet deployment**: hub/token live, asset + passport, work order funded, 3 bids, award, completion 72 mUSDC, durability 8 mUSDC, final `CLOSED`; 57 tx hashes
- [x] Live testnet API adapter, wallet creation/faucet endpoints, live scenario runner
- [x] `/wallet` and `/live` UI with real testnet balance/faucet and tx explorer links
- [x] Live quality suite: 10 RPC/API checks + 2 Playwright live UI checks PASS
- [x] Real scoped function-call keys provisioned; contractor/inspector/coordinator boundaries proven
- [x] Mainnet USDC profile verified (`17208628…33a1`), guarded by explicit human approval

## Remaining — blocked on human / operational

- Hosted demo + private object storage credentials
- Live NEAR AI key → authenticated inference + signature/attestation evidence
- OutLayer project publication + funded testnet execution (local deterministic fallback used)
- Sputnik DAO factory unavailable on public testnet RPC; `mend-dao.testnet` fallback used, code path tested
- Agent Market account/token/balance + real job
- Intents partner JWT or disclosed no-JWT fee; any mainnet deposit requires explicit approval
- Real repair location, steward/repairer/inspector, consented before/after/durability media
- Narrated/captioned demo video, public repository, X post, final submission fields (G5)

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

## Gates

| Gate | Status |
|---|---|
| G0 | ✅ PASS |
| G1 | ✅ PASS |
| G2 | ✅ PASS |
| G3 | Testnet lifecycle with real transaction links | ✅ PASS with caveats (see `reports/G3-evidence.md`) |
| G4 | F01–F14 evidence | ✅ PASS for local + testnet; F14 hosted/narrated/media human-gated |
| G5 | ⛔ BLOCKED_ON_HUMAN (final submission approval) |

## Evidence files

- `orchestration/reports/G1-evidence.md`
- `orchestration/reports/G2-evidence.md`
- `orchestration/reports/G4-evidence.md`
- `orchestration/TRACEABILITY.md`
- `fixtures/demo/captures/capture-manifest.json`

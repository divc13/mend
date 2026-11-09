# G1 — Foundation verification evidence

Date: 2026-11-09
Orchestrator runs every command independently; worker text is not evidence.

## AI & Compute — `track/ai-compute` @ `b7546e6`

Scope check: only `compute/`, `packages/ai-client/`, `fixtures/` changed. PASS.

| Check | Command | Result |
|---|---|---|
| Rust unit/integration | `cargo test --manifest-path compute/bid-rules/Cargo.toml` | **12 passed, 0 failed** |
| WASM unknown | `cargo build ... --target wasm32-unknown-unknown --release` | PASS, `mend-bid-rules.wasm` 113,917 bytes |
| WASM WASI | `cargo build ... --target wasm32-wasip1 --release` | PASS, `mend-bid-rules.wasm` 131,248 bytes |
| TS tests | `cd packages/ai-client && npm test` | **41 passed, 1 skipped (live key test)** |
| TS typecheck | `npm run typecheck` | PASS |
| Parity | canonical fixture test `canonical_fixture_ranks_b_c_a_with_frozen_scores` | PASS (B 9270, C 5200, A 2873) |
| Prompt injection | `test/promptInjection.test.ts` | PASS |
| Privacy | `test/privacy.test.ts` (EXIF, pHash, redaction) | PASS |

WASM sha256 (WASI): `2d8e5adb069e19d46864dea6d5a1a2988e528df45828ac884856b5d1be44a3e3`
WASM sha256 (unknown): `4a38a7c13d3c1c1fbec30516ac76da423ce63502ed4f535097cf8e3b48c0f214`

Status: **G1 AI & Compute PASS**, pending merge into `main`.

## Remaining tracks

Contracts, Backend, Frontend, Payments, Infra: in progress.

You are the visible AI & Compute worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/ai-compute (git branch track/ai-compute). Do not ask questions; proceed.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (F02, F07, T02)
- /Volumes/sandisk/Users/dc/mend/docs/RULES.md
- /Volumes/sandisk/Users/dc/mend/packages/protocol/src/{scoring,hashing,fixtures,schemas}.ts
- /Volumes/sandisk/Users/dc/mend/orchestration/research/R0-A-near-ai.md and R0-B-outlayer.md (if missing, mark BLOCKED for the live parts and implement offline parts)

SCOPE (only these paths):
- compute/bid-rules/** — deterministic Rust scoring library + WASM
- packages/ai-client/** — TypeScript AI/privacy/verification client
- fixtures/recorded-responses/** and fixtures/attacks/** (AI/OutLayer related only)
Do NOT edit contracts/, apps/, services/, other packages, orchestration/, root config.

PART A — deterministic bid rules (Rust):
1. Implement the exact integer algorithm in docs/RULES.md: min-max normalization for price/warranty/duration, absolute materialsScore*100, weights 4500/2500/2000/1000, round-half-up final score, tie-break price, warranty, duration, bidId.
2. Pure deterministic library `evaluate_json(input: &str) -> String`; serde JSON input/output; no clock, randomness, network or floats. Input carries policyHash + bids; output carries ranking, excluded, inputHash/outputHash-compatible canonical JSON.
3. Add tests matching the frozen canonical ranking (B 9270, C 5200, A 2873), ties, single bid, ineligible, invalid inputs.
4. Build a WASM artifact (`cargo build --target wasm32-unknown-unknown --release` and, if supported, `wasm32-wasip1`). Document the exact OutLayer registration/invoke shape in compute/bid-rules/README.md, honestly marking unverified items.

PART B — packages/ai-client (TypeScript, ESM):
1. `nearAiClient`: OpenAI-compatible chat call using env config (`NEAR_AI_BASE_URL`, `NEAR_AI_API_KEY`, `NEAR_AI_MODEL`); strict JSON output validated with zod schemas from @mend/protocol; request/response hashes; server-side only (never import into browser-safe entry).
2. `privacy`: EXIF stripping, deterministic perceptual hash, manual redaction (image bytes transform), coarse vs precise location separation. Tests prove metadata is gone and hashes are stable.
3. `duplicateEngine`: deterministic geospatial proximity + pHash Hamming similarity + text trigram similarity, combined into confidence; model reasoning optional and private; suggestions only, never auto-merge.
4. `scopeGenerator` and `evidenceReviewer`: strict schemas; reviewer returns missing checklist items only and never physical-safety certification language.
5. `verification`: NEAR AI attestation/response-signature verification per R0-A with honest `VERIFIED | UNAVAILABLE | HUMAN_DECISION | PHYSICAL_CLAIM` states; tampered bytes fail; missing evidence is labeled, never fabricated.
6. Recorded fixtures for all model interactions; all tests run offline with no API key. If `NEAR_AI_API_KEY` exists, add an opt-in live smoke test marked skipped by default.
7. Prompt-injection tests: malicious report/evidence text cannot change recipient, role, scope hash, payout rule or acceptance.
8. A TypeScript parity test that loads the same canonical fixture JSON and asserts the Rust-produced expected ranking (read the committed Rust test output fixture); document how parity is verified.

ACCEPTANCE (run and paste real output):
```bash
cargo test --manifest-path compute/bid-rules/Cargo.toml
cargo build --manifest-path compute/bid-rules/Cargo.toml --target wasm32-unknown-unknown --release
cd packages/ai-client && npm test && npm run typecheck
```
No secrets in code, fixtures, logs or bundles. No network calls in default tests. No mainnet/deploy/push.

Commit on branch track/ai-compute with message `feat(ai-compute): deterministic bid rules wasm and private AI client`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

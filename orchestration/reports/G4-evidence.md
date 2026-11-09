# G4 — Feature evidence (F01–F14)

Date: 2026-11-09
Main commit at verification: `a04131d` + guard/quality merges
Mode: local + **REPLAY / SIMULATION**; no real transaction is claimed.

## Automated evidence totals

| Suite | Result |
|---|---|
| Protocol | 26 passed |
| AI & Compute (TS) | 41 passed, 1 skipped (live key) |
| AI & Compute (Rust/WASM) | 12 passed; wasm32-unknown + wasm32-wasip1 builds |
| Intents client | 99 passed; live read-only dry smoke verified |
| API | 33 passed, 1 skipped (Postgres-only variant also passes with DB) |
| DB (with Postgres 16) | 14 passed |
| Indexer | 4 passed |
| Agents/services | 90 passed (near-client 31, coordinator 7, contractor 8, inspector 9, market 11, DAO 10, relayer 14) |
| Config + Testkit | 20 + 32 passed (mainnet guard, secret boundary, clock, fake adapters, ledger) |
| Contracts | 35 passed (hub 30, token 5); both WASM builds |
| Quality suites | 55 passed (8 files) incl. independent adversarial Rust crate |
| Playwright E2E | 32 passed, 8 skipped (honest seed/API-state skips) |
| Web build | PASS (all routes) |
| `scripts/verify.sh` | 18 passed, 0 failed, 2 skipped |
| Clean-room | 8 passed; `npm ci` from fresh worktree PASS |
| Live testnet | 10 RPC/API checks + 2 Playwright live UI checks passed; 57 real tx hashes |

## Feature matrix

| Feature | Evidence | Status |
|---|---|---|
| F01 Walletless reporting | `POST /v1/reports` returned R-005 + private `case_...` link with no wallet; report flow UI + API tests | **PASS** |
| F02 Private AI triage | `packages/ai-client` 41 tests (schema validation, EXIF, pHash, duplicate engine, scope, evidence review, attestation states, prompt injection); API 33 tests incl. guard + `prompt_injection_blocked`; no key → honest UNAVAILABLE | **PASS (live inference BLOCKED_ON_HUMAN)** |
| F03 Asset passport | Hub NEP-171 tests incl. transfer rejection; API `POST /v1/passport/BENCH-001/transfer` → `TRANSFER_DISABLED` | **PASS** |
| F04 Steward + DAO authorization | Contract `dao_authorize` predecessor check tests; DAO watcher 10 tests; exact Sputnik FunctionCall payload fixture | **PASS (live DAO BLOCKED_ON_HUMAN)** |
| F05 Cross-chain sponsorship | Intents client 99 tests (quote/dry/status/reconciliation/mainnet guard/signature); live read-only smoke: 216 tokens, dry quote 0.15→0.149968, SUCCESS status, no funds moved | **PASS (live deposit BLOCKED_ON_HUMAN)** |
| F06 Sealed contractor market | Three deterministic strategies match fixtures; commit/reveal hash tests; contract early/late/mismatch/duplicate tests | **PASS** |
| F07 Deterministic bid evaluation | `docs/RULES.md`; Rust 12 tests + TS parity; canonical B 9270 > C 5200 > A 2873; hub policy/WASM/input/output binding tests; OutLayer request/callback tests | **PASS (live OutLayer publish BLOCKED_ON_HUMAN)** |
| F08 Secure identities/permissions | near-client provisioning/guard 31 tests; relayer 14 tests (allowlist, replay, quotas, kill switch); contract role/self-inspection tests | **PASS** |
| F09 Stablecoin escrow + gasless | Hub escrow 30 tests; G2 API lifecycle exact 100/20/72/8; relayer NEP-366 tests; gasless-funding limitation documented honestly | **PASS (testnet deploy BLOCKED_ON_HUMAN)** |
| F10 Independent inspection + Agent Market | Inspector agent 9 tests (missing items only, no certification language); market worker 11 tests (poll/start/submit, redacted brief, no accept); API inspection flow + human acceptance | **PASS (live market job BLOCKED_ON_HUMAN)** |
| F11 Settlement + warranty | Contract failed-durability test reopens same work order, no new escrow, releases holdback once; E2E contract replay | **PASS** |
| F12 Public case experience | Next build; Playwright 32 passed incl. axe (no serious/critical), keyboard-only, mobile 390×844, REPLAY banner; case page renders 100/20/72/8 | **PASS** |
| F13 Demo, replay, simulation | 9 scenarios in demo room; 90-second H.264 REPLAY video (`fixtures/demo/captures/mend-replay-demo.mp4`); capture manifest; deterministic reset; modes unmistakable | **PASS** |
| F14 Production-quality submission | Docs 25 files, link check PASS, threat/privacy models, README Do X→See Y, CI, clean-room PASS, license, submission drafts | **PARTIAL — hosted demo, narrated video, real media, final human submission fields BLOCKED_ON_HUMAN** |

## Honest limits

- G3 (real testnet lifecycle with transaction links) is **BLOCKED_ON_HUMAN**: no testnet accounts/faucet funds/deployment credentials were provided. No transaction is fabricated.
- Live NEAR AI inference/signature, OutLayer publication/execution, Agent Market job, Sputnik DAO deployment and any mainnet Intents deposit are **BLOCKED_ON_HUMAN**.
- Hosted demo and public repository/post/submission require human approval.
- The 90s demo video is a silent screen recording; narration/captions and real repair media are human production steps.
- 8 Playwright API-alternative tests skip because those scenarios are not seeded in the running instance; the contract replay tests prove the same lifecycle paths.

**G4: PASS for all locally and testnet executable features; human-gated hosting, narration, real repair media, Sputnik factory, OutLayer live and Agent Market live remain blocked, not faked.**

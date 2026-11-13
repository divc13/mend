# G4 — Feature evidence (F01–F14)

Date: 2026-11-09; status reconciled 2026-11-13
Main commit at verification: `a04131d` + guard/quality merges + live testnet lifecycle
Mode: local + **REPLAY / SIMULATION** + real NEAR **testnet** lifecycle evidence.
The authoritative per-feature matrix is [`STATUS.md`](../../STATUS.md). **G4 is PARTIAL**, not complete.

## Automated evidence totals

| Suite | Result |
|---|---|
| Protocol | 26 passed |
| AI & Compute (TS) | 41 passed, 1 skipped (live key) |
| AI & Compute (Rust/WASM) | 12 passed; wasm32-unknown + wasm32-wasip1 builds |
| Intents client | 99 passed; live read-only dry smoke verified |
| API | 53 passed, 3 skipped (Postgres-only variant also passes with DB) |
| DB (with Postgres 16) | 14 passed |
| Indexer | 4 passed |
| Agents/services | 91 passed (near-client 31, coordinator 7, contractor 8, inspector 9, market 12, DAO 10, relayer 14) |
| Config + Testkit | 20 + 32 passed (mainnet guard, secret boundary, clock, fake adapters, ledger) |
| Contracts | 35 passed (hub 30, token 5); both WASM builds |
| Quality suites | 52 passed, 3 skipped (8 files) incl. independent adversarial Rust crate |
| Playwright E2E | 32 passed, 8 skipped (honest seed/API-state skips) |
| Web build | PASS (all routes) |
| `scripts/verify.sh` | 18 passed, 0 failed, 2 skipped |
| Clean-room | 8 passed; `npm ci` from fresh worktree PASS |
| Live testnet | 10 RPC/API checks + 2 Playwright live UI checks passed; 57 real tx hashes |

## Feature matrix

| Feature | Evidence | Status |
|---|---|---|
| F01 Walletless reporting | `POST /v1/reports` returned R-005 + private `case_...` link with no wallet; report flow UI + API tests | **PASS** |
| F02 Private AI triage | `packages/ai-client` 41 passed, 1 skipped (live key); schema validation, EXIF, pHash, duplicate engine, scope, evidence review, attestation states and prompt injection; API guard + `prompt_injection_blocked`. **Live NEAR AI smoke passed. Live API triage** on `R-001` returned `available:true`, `confidenceBps:7600`, a rationale, a generated scope and `ATT-0001`. A `provider_tee` ECDSA signature was fetched; request/response/signed-text/signature checks are all true. The stored attestation is `verified:false` because no matching TEE report was retained; the API label is `UNVERIFIED_INFERENCE` and the UI shows unavailable evidence. See `scripts/near-ai-live/LIVE-NEAR-AI.md` | **PASS_WITH_CAVEATS — signature valid; TEE report/DCAP-ITA not verified** |
| F03 Asset passport | Hub NEP-171 tests incl. transfer rejection; API `POST /v1/passport/BENCH-001/transfer` → `TRANSFER_DISABLED`; testnet `BENCH-001` minted, hub-owned, transfer rejected | **PASS** |
| F04 Steward + DAO authorization | Contract `dao_authorize` predecessor check tests; DAO watcher 10 tests. **Real Sputnik DAO v2** `mend-dao.sputnikv2.testnet` created via factory; proposal 1 (`FunctionCall` → `dao_authorize`) approved 2/3 and executed on `mend-hub-v2.testnet` | **PASS** |
| F05 Cross-chain sponsorship | Intents client 99 tests (quote/dry/status/reconciliation/mainnet guard/signature); live read-only smoke: 216 tokens, dry quote 0.15→0.149968, SUCCESS status, no funds moved. **Fresh live signed non-dry quote**: 0.15 USDT NEAR → 0.145411 USDC NEAR (min 0.144683), deposit address `3229d389...c2a63`, status `PENDING_DEPOSIT`; recipient USDC storage is missing, so four human-signed transactions are required | **PARTIAL — live deposit/settlement not executed; same-chain cross-token only** |
| F06 Sealed contractor market | Three deterministic strategies match fixtures; commit/reveal hash tests; contract early/late/mismatch/duplicate tests; testnet three contractor commits/reveals | **PASS** |
| F07 Deterministic bid evaluation | `docs/RULES.md`; Rust 12 tests + TS parity; canonical B 9270 > C 5200 > A 2873; hub binding tests. **Live OutLayer testnet publish/execute**: project `mend-deployer.testnet/bid-rules`, request 15579, settlement tx `HHBDS4ymrGbUisX9NvfZJ6XTaC24aTShmomroX5XJYAQ`, attestation captured | **PASS_WITH_CAVEATS — hub V2 score LOCAL_DETERMINISTIC; full DCAP/ITA chain not verified** |
| F08 Secure identities/permissions | near-client provisioning/guard 31 tests; relayer 14 tests (allowlist, replay, quotas, kill switch); contract role/self-inspection tests; scoped keys exercised on testnet | **PASS** |
| F09 Stablecoin escrow + gasless | Hub escrow 30 tests; real testnet lifecycle exact 100/20/72/8 with escrow 0. **Live NEP-366 delegate proof**: valid `create_work_order` relayed (`Getpks826tszmEhMJBSEqT5z7kH9KsrCqQrZtBXxSSju`), replay/wrong-receiver/wrong-method/expired rejected on chain | **PASS_WITH_CAVEATS — gasless escrow funding impossible with function-call key** |
| F10 Independent inspection + Agent Market | Inspector agent 9 tests (missing items only, no certification language); market worker 12 tests (poll/start/submit, redacted brief, no accept, null bid id); API inspection flow + human acceptance; testnet completion/durability inspections. **Live listing `mend-evidence-review` is `live`** (`delivered_jobs: 1`, `success_rate: 100`); paid hire `76ef7a92-b654-46cc-87d9-dc032c3a8500` had `escrowAmount: 0.0100 USDC`, was started/submitted by the worker and accepted by the human buyer (`finalizedAt 2026-11-13T11:50:00Z`) | **PASS_WITH_CAVEATS — self-hire; actual seller payout ledger row NOT_COLLECTED** |
| F11 Settlement + warranty | Contract failed-durability test reopens same work order, no new escrow, releases holdback once; E2E contract replay; testnet durability pass released 8 and closed | **PASS_WITH_CAVEATS — failed-durability branch proven in contract/replay, not live testnet** |
| F12 Public case experience | Next build; Playwright 32 passed incl. axe (no serious/critical), keyboard-only, mobile 390×844, REPLAY banner; case page renders 100/20/72/8 | **PASS** |
| F13 Demo, replay, simulation | 9 scenarios in demo room; silent 91.6 s H.264 REPLAY video (`fixtures/demo/captures/mend-replay-demo.mp4`); capture manifest; deterministic reset; modes unmistakable | **PARTIAL — narration/captions/physical media BLOCKED_ON_HUMAN** |
| F14 Production-quality submission | Docs 25 files, link check PASS, threat/privacy models, README Do X→See Y, clean-room PASS, license, submission drafts, private GitHub push, **GitHub Actions green** | **PARTIAL — hosted demo, public repo, X post, final submission BLOCKED_ON_HUMAN** |

## Honest limits

- G3 (real testnet lifecycle with transaction links) is **PASS_WITH_CAVEATS**: the final V2 hub `mend-hub-v2.testnet` + real Sputnik DAO run `WO-BENCH-V2-001-0002` is `CLOSED` with 42 real transactions and exact 100/20/72/8 accounting; the earlier 57-tx `mend-hub.testnet` run remains as history. Caveats: OutLayer was executed separately from the hub score, testnet only, no hosted demo.
- Live NEAR AI inference, response-signature verification and a stored attestation pass; the signature is cryptographically valid but there is no matching TEE attestation report (`signerMatchesReport:false`), so the artifact remains `UNAVAILABLE` and is never shown as verified. Any mainnet Intents deposit is **BLOCKED_ON_HUMAN**. The live Agent Market listing and paid hire are verified; the actual seller payout ledger row is **NOT_COLLECTED** because a worker token cannot read the owner wallet.
- Hosted demo, public repository, X post and submission require human approval. GitHub Actions is green on `main`.
- The 90s demo video is a silent screen recording; narration/captions and real repair media are human production steps.
- 8 Playwright API-alternative tests skip because those scenarios are not seeded in the running instance; the contract replay tests prove the same lifecycle paths.

**G4: PARTIAL. Local, testnet escrow, Sputnik DAO, OutLayer, NEP-366, live NEAR AI inference/signature and a live paid Agent Market hire pass; F02, F07, F09, F10 and F11 pass with caveats; F05, F13 and F14 remain incomplete because required live integrations and human-gated deliverables are missing. Nothing is faked.**

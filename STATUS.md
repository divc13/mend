# MEND — authoritative status

Last updated: 2026-11-13
This file is the single source of truth for feature and gate status. If another
document disagrees with this matrix, this file wins. No percentage is used: the
project is a **strong prototype with a proven testnet escrow lifecycle and several
required live integrations still incomplete**.

Statuses used here: `PASS`, `PASS_WITH_CAVEATS`, `PARTIAL`,
`BLOCKED_ON_HUMAN`, `NOT_STARTED`.

## Environment reality

| Item | Reality |
|---|---|
| Local implementation | Implemented and covered by local suites and the REPLAY vertical slice (G2). |
| NEAR testnet | Fresh active deployment: `mend-hub-v2.testnet` + real Sputnik DAO `mend-dao.sputnikv2.testnet`; `WO-BENCH-V2-001-0002` final `CLOSED`, 42 transactions, token `mend-usdc.testnet` (test mUSDC). The earlier `mend-hub.testnet` 57-transaction run remains historical evidence. |
| Mainnet | A production Agent Market listing is live and a paid `0.0100 USDC` self-hire was accepted; one signed 1Click quote is allocated and remains `PENDING_DEPOSIT`. No mainnet protocol contract is deployed and no Intents funds have moved. All mainnet actions require explicit human approval. |
| GitHub / CI | Pushed to the **private** GitHub repo. GitHub Actions is **green** on `main` (Node/TypeScript, Contracts/Rust, secret scan, dependency audit). |
| Hosting | No hosted demo; hosting and public visibility are human-owned. The web app runs locally against the live testnet API. |

## Features F01–F14

| ID | Feature | Status | Exact evidence | Remaining gap |
|---|---|---|---|---|
| F01 | Walletless community reporting | **PASS** | `POST /v1/reports` returns a report ID and private `case_...` link with no wallet; report-flow API and UI tests pass (G4). | None required for the local/API scope. A live testnet report flow was not separately exercised beyond the lifecycle work order. |
| F02 | Privacy-preserving AI triage | **PASS_WITH_CAVEATS** | `packages/ai-client` 41 tests: schema validation, EXIF removal, pHash, duplicate engine, scope generation, evidence review, attestation states, prompt injection. API includes the runtime guard and `prompt_injection_blocked`. **Live NEAR AI smoke passed**; **live API triage** on `R-001` returned `available:true`, `confidenceBps:7600`, a structured rationale, a generated scope and `ATT-0001`. It fetched a `provider_tee` ECDSA signature; request/response/signed-text/signature checks are all `true`. The stored attestation is `verified:false` because no matching TEE report was retained; the API label is `UNVERIFIED_INFERENCE` and the UI renders it as `Unavailable evidence`, never verified. See `scripts/near-ai-live/LIVE-NEAR-AI.md`. | The response signature is cryptographically valid, but `signerMatchesReport:false`; no matching TEE attestation report, DCAP/ITA quote or RTMR replay exists. The artifact is correctly `UNAVAILABLE`, never shown as verified. |
| F03 | Asset registry and living passport | **PASS** | Hub NEP-171 tests, including transfer rejection. On testnet, `BENCH-001` and `BENCH-V2-001` were created, passports were minted and owned by the hub, and `nft_transfer` is rejected by the contract (G3). | None. The passport is non-transferable and confers no legal ownership. |
| F04 | Steward and DAO authorization | **PASS** | Contract `dao_authorize` predecessor checks, DAO watcher 10 tests and the exact Sputnik `FunctionCall` payload fixture pass. On testnet, a real Sputnik DAO v2 (`mend-dao.sputnikv2.testnet`, council `mend-deployer`/`mend-steward`/`mend-inspector`) approved proposal `1` (2/3) and executed `mend-hub-v2.testnet.dao_authorize`; see `infra/testnet-v2/LIVE-V2.md`. | Testnet-only governance; no mainnet DAO or mainnet authority is claimed. |
| F05 | Cross-chain sponsorship | **PARTIAL** | `packages/intents-client` 99 tests: quote, dry preview, status, reconciliation, mainnet guard, signature. Live read-only mainnet smoke: 216 tokens, dry quote 0.15 → 0.149968, `SUCCESS` status, no funds moved. **Fresh live signed non-dry quote:** `0.15 USDT` NEAR → `0.145411 USDC` NEAR (min `0.144683`), deposit address `3229d3894d42123c1fb93ee8c0c46536f7d9d3b771672198a182fd0632fc2a63`, status `PENDING_DEPOSIT`; see `scripts/intents-live/LIVE-INTENTS.md`. | **No live Intents deposit or settlement** (`BLOCKED_ON_HUMAN`): `divyanshc.near` has no USDC storage and the four required transactions are not signed. The quote used `allowUnverifiedRecipient:true`; this is a same-chain cross-token test, not cross-chain sponsorship. |
| F06 | Sealed contractor market | **PASS** | Three deterministic strategies match fixtures; commit/reveal hash tests; contract early/late/mismatch/duplicate-bid tests. The testnet lifecycles ran three contractor commits and reveals for `WO-BENCH-001-0003` and `WO-BENCH-V2-001-0002` (with on-chain availability). | None for the demo-market scope. |
| F07 | Deterministic bid evaluation | **PASS_WITH_CAVEATS** | `docs/RULES.md`; 12 Rust tests plus TypeScript parity; canonical ranking B 9270 > C 5200 > A 2873; hub policy/WASM/input/output binding tests. **Live OutLayer testnet publish/execute succeeded**: project `mend-deployer.testnet/bid-rules`, request `15579`, settlement tx `HHBDS4ymrGbUisX9NvfZJ6XTaC24aTShmomroX5XJYAQ`, attestation captured with the built code hash, canonical input and output; see `infra/outlayer-live/LIVE-OUTLAY.md`. | The hub V2 lifecycle score was still recorded as `LOCAL_DETERMINISTIC`; full Intel DCAP/ITA signature-chain verification is explicitly out of scope. |
| F08 | Secure agent identities and permissions | **PASS** | near-client provisioning/guard 31 tests; relayer 14 tests (allowlist, replay, quotas, kill switch); contract role and self-inspection tests; scoped function-call keys and role boundaries were exercised on testnet. | Human key custody and production rotation remain operational work. |
| F09 | Stablecoin escrow and gasless actions | **PASS_WITH_CAVEATS** | Hub escrow 30 tests; real testnet lifecycle with exact `100 / 20 / 72 / 8` accounting and escrow 0; independent RPC payment-event checks. Relayer 14 tests. **Live NEP-366 delegate proof:** `mend-relayer.testnet` relayed a real `create_work_order` signed by `mend-coordinator-ai.testnet`'s hub-scoped function-call key (`Getpks826tszmEhMJBSEqT5z7kH9KsrCqQrZtBXxSSju`); replay, wrong-receiver, wrong-method and expired delegates were rejected at the gate and on chain (see `scripts/relayer-live/LIVE-RELAYER.md`). | Gasless escrow *funding* is still not possible with a function-call key and is documented as a limitation. The live proof creates an unfunded DRAFT work order and moves no funds. |
| F10 | Independent inspection and Agent Market | **PASS_WITH_CAVEATS** | Inspector agent 9 tests (missing items only, no certification language); market worker 12 tests (poll/start/submit, redacted brief, no auto-accept, null bid id); API inspection flow with human acceptance; testnet completion and durability inspections by separate inspector accounts. **Live Agent Market listing is `live`** (`delivered_jobs: 1`, `success_rate: 100`); the worker started and submitted a paid `$0.01` USDC hire (`76ef7a92-b654-46cc-87d9-dc032c3a8500`, escrow `0.0100 USDC`) and the human buyer accepted it (`finalizedAt 2026-11-13T11:50:00Z`); see `scripts/agent-market-live/LIVE-AGENT-MARKET.md`. | Self-hire, not independent market reputation. The actual seller payout/5% fee ledger row is `NOT_COLLECTED` because a worker `aat_` token cannot read `/v1/wallet/ledger`; escrow and acceptance are verified. |
| F11 | Settlement, durability and warranty | **PASS_WITH_CAVEATS** | Contract failed-durability test reopens the same work order with no new escrow and releases the holdback once; E2E contract replay; real testnet durability pass released 8 mUSDC and closed the order. | The **failed-durability branch was proven in contract/replay tests, not on live testnet**. The testnet run exercised the passing-durability branch. |
| F12 | Public case experience | **PASS** | Next.js build passes all routes; Playwright 32 passed including axe (no serious/critical), keyboard-only, mobile 390×844 and the REPLAY banner; the case page renders the exact `100 / 20 / 72 / 8` split. | Production load, real-user and public-map/dashboard coverage are not claimed. |
| F13 | Demo, replay and simulation | **PARTIAL** | Nine REPLAY scenarios in the demo room; a silent 91.6 s H.264 `REPLAY / SIMULATION` video at `fixtures/demo/captures/mend-replay-demo.mp4`; five scenario screenshots; capture manifest; deterministic reset; explicit mode labels. | **Narration, captions, a final edited cut and physical repair media are missing** (`BLOCKED_ON_HUMAN` / `NOT COLLECTED`). The MP4 is silent. |
| F14 | Production-quality submission | **PARTIAL** | Docs package, valid relative links, threat/privacy models, README `Do X → See Y`, local test suites, clean-room checks, CI workflow definition, license. The repo is pushed to a private GitHub repo. | CI is green on `main`. The human will handle hosting and make the repository public. **X post and final submission fields are not done** (`BLOCKED_ON_HUMAN`). |

### Feature summary

| Status | Features |
|---|---|
| `PASS` | F01, F03, F04, F06, F08, F12 |
| `PASS_WITH_CAVEATS` | F02, F07, F09, F10, F11 |
| `PARTIAL` | F05, F13, F14 |
| `BLOCKED_ON_HUMAN` | none as the whole feature; the live gaps inside F05/F13/F14 are blocked on human action |
| `NOT_STARTED` | none |

## Gates G0–G5

| Gate | Status | Evidence | Caveats / gaps |
|---|---|---|---|
| G0 — No assumed endpoints or invented SDK methods | **PASS** | Wave 0 research reports `orchestration/research/R0-A..R0-E`; frozen decisions. | Research is dated 2026-11-09 and must be re-checked before any live mainnet claim. |
| G1 — Each track passes local tests and reports only owned-path changes | **PASS** | `orchestration/reports/G1-evidence.md`: protocol 26, contracts 35, intents 99, AI 41 + Rust 12, verified by the orchestrator. | None for the local scope. |
| G2 — Local/sandbox vertical slice without hand-editing the database | **PASS** | `orchestration/reports/G2-evidence.md`: real API + Postgres + web, exact 100 → 20 refund → 72 → 8 holdback → 8 release → `CLOSED`. | REPLAY/SIMULATION only, as labelled. |
| G3 — Successful testnet repair lifecycle with real transaction links | **PASS_WITH_CAVEATS** | Fresh final hub `mend-hub-v2.testnet` + real Sputnik DAO `mend-dao.sputnikv2.testnet`: `WO-BENCH-V2-001-0002` `CLOSED`, 42 tx, funding 100, refund 20, completion 72, holdback 8 released, escrow 0; 42/42 hashes resolved; payment events exact; passport transfer rejected. Earlier `mend-hub.testnet` / 57-tx run remains in `infra/testnet/live-state.json`. | OutLayer live execution used a separate testnet request (see F07), not the hub score; testnet only; one aborted pre-award work order was cancelled/refunded; no hosted demo. |
| G4 — Every feature F01–F14 has passing evidence | **PARTIAL** | F01, F03, F04, F06, F08, F12 pass; F02, F07, F09, F10, F11 pass with caveats; F05, F13, F14 are partial. | **G4 is not fully complete.** Remaining live gaps: Intents deposit/settlement; narration/captions/physical media; hosted demo/public repo/X post/submission. |
| G5 — Human accepts the complete submission payload | **BLOCKED_ON_HUMAN** | Submission drafts exist; nothing has been posted or submitted. | Team identity, wallet, public repo URL, hosted demo URL, video URL, track, tags and final confirmation are human-supplied. |

## What is proven

1. **Local protocol and accounting.** Protocol schemas, state machine, exact
   integer `100 / 20 / 72 / 8` accounting, hashing and canonical fixtures pass
   locally; bids A/B/C score 2873 / 9270 / 5200 and B wins.
2. **Local vertical slice.** A real API, Postgres and web app execute the
   canonical repair lifecycle end-to-end in REPLAY with the exact final escrow.
3. **Real NEAR testnet escrow lifecycle.** `WO-BENCH-001-0003` on
   `mend-hub.testnet` reached `CLOSED` with 57 real transactions, funding
   100 mUSDC, refund 20, completion 72, holdback 8 released and escrow 0.
4. **Independent testnet verification.** 57/57 recorded hashes resolve with
   success; NEP-141 `ft_transfer` events match the exact amounts; the passport is
   hub-owned and `nft_transfer` is rejected.
5. **Live wallet/API/UI surfaces on testnet.** `LIVE_TESTNET` health, balances,
   invalid-account rejection, a real faucet transfer
   (`BbRhpPTjGJX27tcHhkz1WyfxBkuzPJNuzE1QF1ou5tvC`) and honest unavailable states
   pass.
6. **Automated quality evidence.** The suites recorded in
   `orchestration/reports/G4-evidence.md` pass locally, including security,
   adversarial, accessibility and end-to-end checks.
7. **A silent demo artifact exists.** A 91.6 s 1920×1080 H.264 REPLAY recording
   exists with a manifest and five screenshots.
8. **A fresh V2 hub with a real Sputnik DAO.** `mend-hub-v2.testnet` runs the
   current WASM; `mend-dao.sputnikv2.testnet` was created by the real
   `sputnikv2.testnet` factory with a 3-member council. Proposal `1`
   (`FunctionCall` → `dao_authorize`) was approved 2/3 and executed, and
   `WO-BENCH-V2-001-0002` reached `CLOSED` with the exact `100 / 20 / 72 / 8`
   split and escrow 0.
9. **V2 independent verification.** All 42 recorded V2 transactions resolve with
   success; NEP-141 events match funding, refund, completion and holdback; the
   hub token balance is 0 and the passport remains non-transferable.
10. **Live Agent Market listing and paid hire.** `mend-evidence-review` is
    publicly live (`listing_status: live`, `delivered_jobs: 1`, `success_rate:
    100`). The worker started and submitted paid assignment
    `76ef7a92-b654-46cc-87d9-dc032c3a8500` with `escrowAmount: 0.0100 USDC`;
    the human buyer accepted it and the job completed. The free test run is
    recorded separately and is not counted as a paid job.
11. **Live NEAR AI inference, signature and stored attestation.** A live triage
    of `R-001` returned `available:true`, `confidenceBps:7600`, a scope and
    `ATT-0001`. The provider's `provider_tee` ECDSA signature binds the exact
    request/response bytes and all four cryptographic checks pass. The artifact
    remains `UNAVAILABLE` because no matching TEE report was retained; the UI
    labels it `UNVERIFIED_INFERENCE`.

## What is not proven

1. **A fully verified NEAR AI TEE attestation.** The live signature is
   cryptographically valid, but no matching attestation report was retained
   (`signerMatchesReport:false`); DCAP/ITA quote verification and RTMR replay
   remain out of scope.
2. **Mainnet DAO authority.** The Sputnik DAO is real but testnet-only; no
   mainnet governance or mainnet authority is claimed.
3. **A live NEAR Intents deposit or settlement.** A fresh signed non-dry quote
   is allocated and `PENDING_DEPOSIT`, but no deposit, swap or settlement has
   executed. `divyanshc.near` also lacks USDC storage, so four human-signed
   transactions are required. No funds moved.
4. **Full Intel DCAP/ITA attestation-chain verification.** A live OutLayer
   request and attestation were captured, but the Intel signature chain is not
   independently verified by MEND.
5. **Gasless escrow funding.** A function-call key cannot attach a deposit. The
   live NEP-366 proof relays a zero-deposit `create_work_order` (unfunded DRAFT)
   and records chain rejections for replay, wrong receiver, wrong method and
   expiry; it does not prove gasless escrow funding.
6. **The actual Agent Market seller payout ledger row and 5% fee.** The paid
   hire's `0.0100 USDC` escrow and human acceptance are verified, but the worker
   `aat_` token cannot read the owner wallet ledger; the expected payout is
   `0.0095 USDC`, not an observed balance.
7. **Narration, captions, a final edited video, real repair media and a physical
   durability inspection.** The MP4 is silent and no repair was performed for
   MEND.
8. **A hosted demo, public repository, X post or submitted entry.** The GitHub
   repo is private and CI is still pending; submission fields are human-supplied.
9. **Any mainnet execution, security audit, accessibility certification, city
   adoption or partnership.** None exists.
10. **CI green.** The first GitHub Actions run failed; a follow-up run was in
    progress at the time of writing. CI is not green.

## Evidence index

- `orchestration/reports/G1-evidence.md`
- `orchestration/reports/G2-evidence.md`
- `orchestration/reports/G3-evidence.md`
- `orchestration/reports/G4-evidence.md`
- `infra/testnet/live-state.json`
- `infra/testnet-v2/live-state.json`
- `infra/testnet-v2/LIVE-V2.md`
- `scripts/agent-market-live/LIVE-AGENT-MARKET.md`
- `scripts/intents-live/LIVE-INTENTS.md`
- `scripts/near-ai-live/LIVE-NEAR-AI.md`
- `tests/live/LIVE-EVIDENCE.md`
- [docs/16 — Integration evidence](./docs/16-integration-evidence.md)
- [docs/11 — Limitations](./docs/11-limitations.md)

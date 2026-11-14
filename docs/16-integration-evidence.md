# 16 — Integration evidence matrix

> **Status note (2026-11-14):** This file began as the 2026-11-09 Wave 0 research
> matrix. Later live evidence is reconciled in the affected rows below;
> [`STATUS.md`](../STATUS.md) is authoritative. Research-only labels remain
> historical where no later evidence exists.

Every external integration claim in MEND must match the Wave 0 research and carry
one of three labels. Research was accessed **2026-11-09**; the source files are in
`orchestration/research/`.

## Label definitions

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed on 2026-11-09 by a live read-only request, official docs/OpenAPI, or pinned source. This does **not** mean MEND executed the full flow. |
| **UNAVAILABLE** | The capability does not exist, is not a stable contract, or cannot be used as described. |
| **BLOCKED_ON_HUMAN** | The capability exists, but MEND cannot exercise it without a human-supplied credential, funded account, consent, approval or signature. |

Where the research used `UNVERIFIED` or `OBSERVED`, this matrix either maps it to
**UNAVAILABLE as a contract** or states the observation explicitly. It never
upgrades an observation to a guarantee.

Rows marked **MEND DECISION** are internal product choices, not external claims.
Every external claim uses one of the three labels above.

## NEAR AI Cloud

Sources: `orchestration/research/R0-A-near-ai.md`. Access date 2026-11-09.

| # | Claim | Label | Evidence / note |
|---|---|---|---|
| A1 | API base is `https://cloud-api.near.ai/v1`, OpenAI-compatible | **VERIFIED** | Docs + SDK constant; old `api.near.ai` returns `410` (retired 2025-10-31) |
| A2 | Auth is a bearer API key | **VERIFIED** | Missing/invalid key returns `401` live |
| A3 | Public keyless endpoints expose models, pricing, health and attestation | **VERIFIED** | Live `200` responses |
| A4 | `GET /v1/health` is the health path; `/health` returns `404` | **VERIFIED** | Live |
| A5 | Canonical verifiable model `z-ai/glm-5.3-flash` is listed | **VERIFIED** | Live `/v1/models`, `/v1/model/list`; `verifiable: true` |
| A6 | Send `x-no-aliasing: true` to keep the canonical model ID | **VERIFIED** | Docs; aliasing breaks `provider_tee` signature text |
| A7 | Response signatures are fetched post-hoc from `GET /v1/signature/{chat_id}` | **VERIFIED** | Docs; not inline |
| A8 | Signature verification covers exact request/response bytes | **VERIFIED** | Docs |
| A9 | Gateway TEE and model TEE are separate; the chain is not complete end-to-end | **VERIFIED** | Provider docs explicitly say so |
| A10 | Optional Intel Trust Authority token path exists | **VERIFIED** | Docs/live schema |
| A11 | Signature can be unavailable (`404` or `200` + `error_code`) | **VERIFIED** | Docs; must be treated as unverified |
| A12 | Streaming is gateway-signed by default | **VERIFIED** | Docs; gateway rewrites bytes |
| A13 | Responses/Messages APIs are gateway-signed only | **VERIFIED** | Docs |
| A14 | Structured output/`response_format` is a stable documented request contract | **UNAVAILABLE** | Not enumerated in the live OpenAPI request schema; must be probed; research marks it unverified |
| A15 | The official JS SDK requires Node `>=24.22.1` | **VERIFIED** | npm metadata/docs; repo declares `>=22` |
| A16 | Authenticated MEND inference, signature fetch and billing | **VERIFIED (live) / NOT_COLLECTED (billing)** | Live `z-ai/glm-5.3-flash` smoke and API triage on `R-001`; `provider_tee` ECDSA signature fetched and cryptographically checked. Billing ledger was not read. See `scripts/near-ai-live/LIVE-NEAR-AI.md` |
| A17 | MEND can claim a complete end-to-end AI attestation chain | **UNAVAILABLE** | Provider itself documents the gap; live signature has `signerMatchesReport:false` because no matching TEE report was retained |

**Product rule:** show `INFERENCE EVIDENCE VERIFIED` only for verified bytes; show
gateway and model evidence separately; show `UNAVAILABLE` for 404/error. Never say “AI approved”.

## OutLayer

Sources: `orchestration/research/R0-B-outlayer.md`. Access date 2026-11-09.

| # | Claim | Label | Evidence / note |
|---|---|---|---|
| B1 | Testnet contract is `outlayer.testnet` | **VERIFIED** | Live RPC/docs |
| B2 | Testnet API health is live | **VERIFIED** | `200`, version `0.1.0` on 2026-11-09 |
| B3 | `request_execution` attaches NEAR and creates a yield | **VERIFIED** | Source/docs |
| B4 | The caller's private promise callback receives the WASM stdout | **VERIFIED** | Source/docs; `promise_result(0)` |
| B5 | There is no MEND webhook and no OutLayer-specific `near-sdk` crate | **VERIFIED** | Source/docs |
| B6 | The callback does not contain the TEE attestation or request ID | **VERIFIED** | Source/docs |
| B7 | Publish a hash-pinned `wasm32-wasip1` project | **VERIFIED** | Docs/source |
| B8 | Keep output compact; under 900 bytes is recommended | **VERIFIED** | Docs; larger output takes a 2-call path |
| B9 | TEE attestation proves which binary ran with which input/output | **VERIFIED** | Docs |
| B10 | TEE attestation does not prove logic correctness or source provenance | **VERIFIED** | Docs |
| B11 | Coordinator is closed source and can censor/delay | **VERIFIED** | Docs/source |
| B12 | Exact deployed memory floor / WASM cap parity | **UNAVAILABLE** | Source says 1024 MB / 10 MiB; deployed parity unverified |
| B13 | Independent `outlayer-verify` tool exists (Apache-2.0) | **VERIFIED** | Docs/source; not installed/run here |
| B14 | MEND published WASM and funded testnet execution | **VERIFIED (testnet)** | Project `mend-deployer.testnet/bid-rules`, request `15579`, settlement tx `HHBDS4ymrGbUisX9NvfZJ6XTaC24aTShmomroX5XJYAQ`; see `infra/outlayer-live/LIVE-OUTLAY.md` |
| B15 | MEND TEE attestation verified for a real execution | **UNAVAILABLE (full Intel chain)** | Live attestation captured with the built code hash and canonical input/output; the Intel DCAP/ITA signature chain is not independently verified by MEND |
| B16 | Mainnet stablecoin address for funding | **UNAVAILABLE** | Not verified; not needed for testnet |

**Product rule:** on-chain hashes = `SCORE BOUND`; independently verified TEE =
`OUTLAYER + TEE ATTESTED`; otherwise `LOCAL DETERMINISTIC — OUTLAYER UNAVAILABLE`.
Never claim “provably fair” or “audited”.

## NEAR Intents / 1Click

Sources: `orchestration/research/R0-C-intents.md`. Access date 2026-11-09.

| # | Claim | Label | Evidence / note |
|---|---|---|---|
| C1 | Base `https://1click.chaindefuser.com`, API v0, OpenAPI `0.1.10` | **VERIFIED** | Live docs/OpenAPI |
| C2 | Intents is **mainnet only**; no testnet | **VERIFIED** | Official docs |
| C3 | `GET /v0/tokens` works without auth; 216 tokens observed | **VERIFIED** | Live |
| C4 | `POST /v0/quote` works without auth; success code 201 | **VERIFIED** | Live |
| C5 | `dry: true` returns a quote but no deposit address/deadline/memo | **VERIFIED** | Live |
| C6 | Base USDC → NEAR USDC minimum on the tested route is 0.15 USDC | **VERIFIED** | Live 400 at 149999, 201 at 150000 |
| C7 | Quote deadline was request + 72 h on three samples | **UNAVAILABLE as a contract** | Observed, not documented; do not hard-code it |
| C8 | Status enum is exactly `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`, `SUCCESS`, `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED` | **VERIFIED** | Live + OpenAPI |
| C9 | There is an API `EXPIRED` status | **UNAVAILABLE** | No such status; expiry is client-side |
| C10 | Named NEAR recipients must exist | **VERIFIED** | Live: nonexistent names returned 400 |
| C11 | Quote success proves NEP-141 storage registration | **UNAVAILABLE** | `mend.near` had `storage_balance_of: null` yet quoted |
| C12 | Live status returns usable explorer URLs | **UNAVAILABLE** | `explorerUrl` strings were empty in a SUCCESS sample; build links yourself |
| C13 | Quote signatures verify; tampering with recipient fails | **VERIFIED** | SDK 0.1.26 |
| C14 | `sessionId` is returned by status | **UNAVAILABLE** | Echoed at quote time but not returned by status; reconcile by `depositAddress` |
| C15 | Authenticated fee schedule 20/1 bps and no-JWT +25 bps | **UNAVAILABLE** | Not observed; docs/live differ; partner JWT is `BLOCKED_ON_HUMAN` |
| C16 | Live `REFUNDED`/`FAILED`/`INCOMPLETE_DEPOSIT` bodies | **UNAVAILABLE** | Schema/docs only; no live sample |
| C17 | MEND live deposit → SUCCESS → hub funding | **BLOCKED_ON_HUMAN** | Signed non-dry quote allocated; no deposit/settlement. Recipient `divyanshc.near` lacks USDC storage; four human-signed transactions are required. See `scripts/intents-live/LIVE-INTENTS.md` |
| C18 | Explorer API for historical swaps without partner auth | **UNAVAILABLE** | Requires JWT |

**Product rule:** dry quotes are not payments; show fees and destination as
estimates; label `MAINNET ONLY`; reconcile by deposit address; require explicit
human approval for every deposit. Never claim a testnet Intents run.

## Sputnik DAO v2

Sources: `orchestration/research/R0-D-dao-agent-market.md`. Access date 2026-11-09.

| # | Claim | Label | Evidence / note |
|---|---|---|---|
| D1 | Testnet factory is `sputnikv2.testnet`; DAOs are `<name>.sputnikv2.testnet` | **VERIFIED** | Live RPC/docs |
| D2 | Mainnet factory is `sputnik-dao.near` | **VERIFIED** | Live RPC/docs |
| D3 | `sputnik-dao.testnet` has no contract code | **VERIFIED** | Live RPC |
| D4 | Proposal IDs are decimal `u64` indexes | **VERIFIED** | Source/docs |
| D5 | `get_last_proposal_id()` is the next ID, not the highest | **VERIFIED** | Source/docs |
| D6 | A view call cannot synchronously verify another contract | **VERIFIED** | NEAR execution model |
| D7 | Authorization must be a push `FunctionCall` to the hub | **VERIFIED** | Source/docs |
| D8 | The hub checks `predecessor_account_id == config.dao` | **MEND DECISION**, source-compatible | Hub interface freeze |
| D9 | `act_proposal` requires the exact proposal kind | **VERIFIED** | Current source; README drift |
| D10 | The bond must equal the policy bond exactly | **VERIFIED** | Source; README “at least 1 NEAR” is wrong for custom policies |
| D11 | MEND DAO deployment, council and proposals | **VERIFIED (testnet)** | `mend-dao.sputnikv2.testnet`, council `mend-deployer`/`mend-steward`/`mend-inspector`; proposal `1` approved 2/3 |
| D12 | MEND DAO watcher verification against a live proposal | **VERIFIED (testnet)** | Proposal `1` executed `mend-hub-v2.testnet.dao_authorize`; see `infra/testnet-v2/LIVE-V2.md` |

**Product rule:** `DAO AUTHORIZED` only after the hub records the authorization.
A pending proposal is not an approval.

## NEAR Agent Market

Sources: `orchestration/research/R0-D-dao-agent-market.md`. Access date 2026-11-09.

| # | Claim | Label | Evidence / note |
|---|---|---|---|
| E1 | Base `https://market.near.ai`, OpenAPI 3.1.0, API `2.0.0` | **VERIFIED** | Live docs |
| E2 | Public read endpoints work without an account | **VERIFIED** | `/healthz`, `/v1/platform/*`, `/v1/agents` live |
| E3 | Job reads require auth | **VERIFIED** | `401 unauthorized` live |
| E4 | Worker auth uses `Bearer aat_...` | **VERIFIED** | Docs/source |
| E5 | Worker API supports poll/start/submit/message/decline/progress | **VERIFIED** | Source |
| E6 | Worker API has an accept endpoint | **UNAVAILABLE** | No accept path; token cannot accept its own work |
| E7 | Acceptance is human/buyer-side | **VERIFIED** | Docs; MCP returns an approval URL |
| E8 | Auto-accept after 3–7 days | **VERIFIED** | Docs/source |
| E9 | Agent Market is a NEAR testnet | **UNAVAILABLE** | Production marketplace with USD/USDC |
| E10 | Platform fee is 5% of builder payout | **VERIFIED** | Live config/docs |
| E11 | Email verification is required | **VERIFIED** | Live config |
| E12 | MEND live job, account, token or balance | **VERIFIED (job/token) / NOT_COLLECTED (payout)** | Listing `mend-evidence-review` live; paid `0.0100 USDC` self-hire started/submitted by worker and accepted by human. Seller payout/ledger not read with a worker `aat_` token. See `scripts/agent-market-live/LIVE-AGENT-MARKET.md` |
| E13 | Self-hire is independent market reputation | **UNAVAILABLE** | Must be disclosed if tested |

**Product rule:** `EXTERNAL REVIEW — NOT A SAFETY CERTIFICATION`; human acceptance
stays separate; no self-accept claim.

## NEAR platform

Sources: `orchestration/research/R0-E-near-platform.md`. Access date 2026-11-09.

| # | Claim | Label | Evidence / note |
|---|---|---|---|
| F1 | NEP-171 core can be implemented; no standard `non_transferable` flag | **VERIFIED** | Pinned source/docs |
| F2 | Panic-on-transfer is a valid MEND-defined non-transferable implementation | **VERIFIED** | Source; custom behaviour |
| F3 | Passport owner is the hub, not a user; no approvals/burn | **MEND DECISION** | Hub interface freeze |
| F4 | NEP-141 `ft_transfer_call` receiver flow is `ft_on_transfer` | **VERIFIED** | Pinned source/docs |
| F5 | Underfund = full refund; overfund = excess refund; duplicate/cancelled = full refund | **MEND DECISION**, source-compatible | Hub interface; needs contract tests |
| F6 | No resolver is implemented; tokens are not spent in `ft_on_transfer` | **MEND DECISION** | Reduces refund edge cases |
| F7 | Function-call keys have receiver, non-empty methods and allowance | **VERIFIED** | Pinned source |
| F8 | Function-call keys reject attached deposits | **VERIFIED** | Source; `DepositWithFunctionCall` |
| F9 | Gasless escrow funding with a function-call key | **UNAVAILABLE** | `ft_transfer_call` needs 1 yocto; keys reject deposits |
| F10 | NEP-366 `Delegate` (not `DelegateV2`) is the meta-tx path | **VERIFIED** | Source; `DelegateV2` removed at protocol 87 |
| F11 | Runtime gas/meta-tx edge cases are proven | **UNAVAILABLE** | Source-verified only; no sandbox/testnet execution |
| F12 | Hub must be registered with the token before funding | **VERIFIED** | Source; deployment prerequisite |
| F13 | Target network supports protocol 85+ and gas keys | **BLOCKED_ON_HUMAN** | Must be queried before provisioning |
| F14 | MEND contract unit/integration tests pass | **VERIFIED (local)** | Hub 30 + token 5 tests; WASM builds |

**Product rule:** call the flow “walletless reporting” and “gasless actions where
valid”, not “gasless funding”. Never imply the passport is legal ownership.

## MEND project evidence

| # | Claim | Label | Evidence |
|---|---|---|---|
| G1 | Protocol schemas, state machine, accounting, scoring and fixtures pass locally | **VERIFIED (local)** | `npm test -w @mend/protocol` → 4 files, 26 tests passed |
| G2 | Documentation and relative links are valid | **VERIFIED (local)** | `node scripts/demo/check-docs.mjs` |
| G3 | Web app, API, contracts, compute, services | **VERIFIED (local)** | Integrated on `main`; G1/G2/G4 evidence |
| G4 | Real NEAR testnet escrow lifecycle with real links | **VERIFIED (testnet) with caveats** | V2 `WO-BENCH-V2-001-0002` `CLOSED`, 42 tx, exact 100/20/72/8, escrow 0; earlier 57-tx `WO-BENCH-001-0003` remains historical; [G3 evidence](../orchestration/reports/G3-evidence.md) |
| G5 | Live NEAR AI inference, Sputnik DAO, Intents deposit, OutLayer execution, NEP-366 relayer, Agent Market job | **VERIFIED with caveats / PARTIAL** | AI signature valid but no matching TEE report; Sputnik DAO, OutLayer, NEP-366 and Agent Market job live; Intents deposit/settlement not executed. See `STATUS.md` |
| G6 | Hosted demo | **LIVE — full API-backed TESTNET** | Web https://mend-demo.vercel.app; API https://mend-api-phi.vercel.app; Neon Free Postgres. API mode `LIVE_TESTNET`, repository Postgres, real V2 case `WO-BENCH-V2-001-0002` seeded, no demo runner, no auth. Canonical case is CLOSED; award/accept disabled. |
| G7 | Demo video | **RECORDED — 2:37.00 v3 product pitch** | `demo/ad/out/mend-ad-v3-master.mp4`, 1920×1080/30fps, H.264/AAC, 48 kHz stereo, 53 MB, SHA-256 `df08dd0c99d482703229e40e02adba10fb25ebfbad83d4962576346a17214158`; input_i −14.06 LUFS, true peak −1.38 dBTP, no silence gap longer than 1.2 s; full-bleed live app with animated paper-cut cast dioramas (Sam/pothole/neighbor, council, bidders, repair video/contractor, inspector, payout, passport) and per-beat tech-stack callouts, one continuous voice/music/SFX bed, paper-cut Sam + stick-figure Neighbor close; pothole case staged `BIDDING`→`COMPLETION_SUBMITTED`→`CLOSED`. The voice is the existing v1 George render, trimmed and concatenated (ElevenLabs v2 blocked with HTTP 401), not a new v3 synth. Repair B-roll is illustrative Pexels stock, REPLAY is labelled, and the end-card QR encodes https://mend-demo.vercel.app. The film now has a 53 MB, −14.06 LUFS, stereo-balanced master with no silence gap >1.2 s. The 5:00 v2 master, 5:00 v1 cut and silent 91.6 s REPLAY video remain as history. |
| G8 | Real repair media and durability inspection | **BLOCKED_ON_HUMAN / NOT COLLECTED** | No repair performed; no consent |
| G9 | Security audit or accessibility certification | **UNAVAILABLE** | None performed |
| G10 | City adoption or partnership | **UNAVAILABLE** | No such relationship exists or is claimed |
| G11 | Submission story and checklist | **DRAFT — NOT SUBMITTED** | README plain-English stack, private-AI caveat, one complete moment, NEAR role and track recommendation; [docs/14](./14-submission-package.md#submission-checklist) checklist; public repo, X post and form remain `BLOCKED_ON_HUMAN` |

## Claims we must not make

| Forbidden claim | Correct alternative |
|---|---|
| “AI approved the repair” | “AI suggested; a human inspector decided” |
| “Structurally safe / certified safe” | “Human inspector recorded completion; this is not a structural certification” |
| “Guaranteed repair / guaranteed durability” | “A durability holdback and a later inspection create accountability” |
| “The city adopted MEND” | “No city adoption; a low-risk community pilot is the scope” |
| “Partnered with …” | Name only a real, documented relationship — currently none |
| “OutLayer proved the best bidder” | “A hash-pinned deterministic policy ranked eligible bids; TEE evidence is separate” |
| “End-to-end attested AI” | “Gateway/model evidence is shown separately; the chain is incomplete” |
| “Live payment” for a dry quote | “DRY QUOTE — NOT A PAYMENT” |
| “Live” for a replay | “REPLAY / SIMULATION” |
| “Audited / production-ready” | “Protocol tested locally; application and audit pending” |

## Related documents

- [03 — Architecture](./03-architecture.md)
- [08 — Oracle and human trust](./08-oracle-and-human-trust.md)
- [09 — Failure cases](./09-failure-cases.md)
- [11 — Limitations](./11-limitations.md)
- [13 — Demo script](./13-demo-script.md)

---

[Docs index](./README.md) · [← Capture plan](./15-demo-capture-plan.md) · [Next: copy and accessibility →](./17-copy-and-accessibility.md)

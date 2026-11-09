# G0 — External API validation and protocol freeze

Date: 2026-11-09
Status: **PASS (with human-credential conditions)**
Evidence: `orchestration/research/R0-A..R0-E` (live tests where possible, citations, access date)
Protocol freeze: commit `c21b694`, `packages/protocol` 26/26 tests pass

## Frozen decisions

| Area | Decision | Evidence |
|---|---|---|
| NEAR AI | Base `https://cloud-api.near.ai/v1`, bearer key, canonical model `z-ai/glm-5.3-flash` (verifiable), `x-no-aliasing: true`; response signatures fetched from `/v1/signature/{chat_id}`; gateway + model attestations fetched separately; never claim full E2E chain. | R0-A, live endpoints + docs |
| OutLayer | Testnet contract `outlayer.testnet`; publish `mend.testnet/bid-rules` as `wasm32-wasip1`; contract calls `request_execution` with hash-pinned version, JSON input/output, attached NEAR; result arrives through the hub's private promise callback (`promise_result(0)`), not a relayer. Attestation verified off-chain by tx/request ID; UI shows pending until verified. | R0-B, live RPC/docs/source |
| Intents / 1Click | Base `https://1click.chaindefuser.com`, API v0, **mainnet only**; quote 201, `dry:true` has no deposit address; statuses PENDING_DEPOSIT / KNOWN_DEPOSIT_TX / PROCESSING / SUCCESS / INCOMPLETE_DEPOSIT / REFUNDED / FAILED; no EXPIRED status (client-only); recipient must exist + have NEP-141 storage; verify quote signatures; reconcile by depositAddress; build explorer links ourselves. | R0-C, live calls |
| Sputnik DAO | Testnet factory `sputnikv2.testnet`, DAO `<name>.sputnikv2.testnet`; authorization is a **push path**: an approved FunctionCall proposal calls `dao_authorize` on the hub, which checks `predecessor == config.dao`. No new multisig, no oracle, no view-call trust. | R0-D, live RPC/source |
| Agent Market | `https://market.near.ai`, API v2.0.0, worker token `aat_...`; poll/start/submit only, **no worker accept endpoint**; acceptance is human/buyer; production marketplace, not testnet; redacted briefs only. | R0-D, live docs/endpoints |
| NEAR platform | Passport: NEP-171 core, owner = hub, transfers/approvals/burn always fail. Escrow: `ft_on_transfer` only, accepted token, sponsor-only, strict msg, underfund full refund, overfund excess refund. Agent keys: separate sub-accounts + function-call keys (receiver + methods + allowance), contract enforces roles. Gasless: NEP-366 Delegate, zero deposit, relayer gates; funding cannot be gasless with a function-call key. | R0-E, crate source/docs |

## Protocol freeze

- States, transitions, invariants, error codes, event names, IDs, amount math and fixtures are in `packages/protocol` and `docs/RULES.md`.
- Canonical scenario: 100 budget → 80 award → 20 refund → 72 completion → 8 holdback → 8 release.
- Canonical bids: A 95/14d/90d/60, B 80/10d/180d/80, C 78/21d/30d/70 → B wins 9270 vs C 5200 vs A 2873.

## Conditions / blocked on human

- No NEAR AI key → authenticated inference/signature calls are BLOCKED_ON_HUMAN; offline fixtures + honest UNAVAILABLE labels are required.
- No OutLayer project publication/funds → live execution BLOCKED_ON_HUMAN; hash-pinned local WASM fallback must be labeled.
- No Intents JWT → unauthenticated quotes only; disclose possible 25 bps fee; no deposits without human approval.
- No Sputnik DAO account/funds → DAO deployment and proposals BLOCKED_ON_HUMAN.
- No Agent Market account/token/balance → live job BLOCKED_ON_HUMAN; recorded fixtures labeled REPLAY.
- No testnet accounts/faucet → deployment BLOCKED_ON_HUMAN.

No endpoint or SDK method in the architecture is assumed; unverified items are explicitly labeled in the research docs and must remain labeled in the product.

**Gate G0: PASS.** Wave 1 implementation may proceed.

# ADR-001 — MEND architecture freeze (Wave 0)

Status: accepted, external-API sections pending research confirmations.

## Decisions

1. **Monorepo, npm workspaces.** Node 26, TypeScript strict, Vitest 5, Next 16, Fastify 5.
2. **Hub contract is the financial source of truth.** Postgres is a read model and private-data index only. Nothing in the API may claim a payment or state change that the hub did not record.
3. **Protocol package first.** `packages/protocol` owns schemas, state machine, error codes, event names, IDs, payment bps and canonical fixtures. Every track imports it; no duplicate local types.
4. **Amounts are integer micro-units** (6 decimals). All splits use integer math; remainder goes to the holdback. Funding = refund + escrow/completion + holdback (+ released holdback) at every point.
5. **State machine is explicit and tested.** Invalid transitions fail in contract and protocol tests. Dispute resolution requires an explicit human/DAO resolution flag. Unpause must return to the exact previous state.
6. **Deterministic scoring only.** `docs/RULES.md` is the human-readable policy; Rust/WASM in `compute/bid-rules` is the executable policy; the hub stores policy/WASM/input/output hashes and only accepts the deterministic top-ranked eligible bid. No LLM ranks or selects.
7. **AI is a proposal engine.** NEAR AI Cloud output is schema-validated, treated as untrusted text, and never holds a key or money authority. Attestation is shown as VERIFIED / UNAVAILABLE / HUMAN DECISION / PHYSICAL CLAIM. No fabricated attestations.
8. **Human inspection is required.** The evidence-completeness reviewer may only list missing checklist items. A human inspector account, different from the contractor, signs acceptance and durability decisions.
9. **Privacy:** raw media stays in private storage; only redacted hashes go on-chain/public. EXIF stripped client-side. Precise location never enters public state or public API.
10. **Modes are unmistakable:** `LIVE_TESTNET`, `MAINNET — REAL FUNDS`, `REPLAY / SIMULATION`. Replay data can never be rendered as a live transaction. Dry Intents quotes are never shown as payments.
11. **Agent keys are method-scoped function-call keys**, separate sub-accounts, allowances; no plaintext full-access key. Contractor cannot release escrow; inspector cannot alter bids/recipients; coordinator cannot inspect its own work.
12. **Relayer is allowlisted** to MEND hub methods only, with replay protection and rate limits. It cannot call arbitrary contracts.
13. **Warranty reopens the same work order.** No new bounty, no new escrow, no new work-order ID. Repeat failures remain in one asset history.
14. **OutLayer fallback** (if testnet unavailable): run the same hash-pinned WASM locally and label evidence `LOCAL DETERMINISTIC — OUTLAYER UNAVAILABLE`. Never claim OutLayer execution that did not happen.

## Open items (Wave 0 research)

- NEAR AI Cloud exact base URL/model IDs/attestation fields (R0-A).
- OutLayer exact execute/callback schema and testnet availability (R0-B).
- 1Click quote/status schema and mainnet constraints (R0-C).
- Sputnik DAO v2 proposal flow and Agent Market worker API (R0-D).
- near-sdk 5.30 non-transferable NFT and meta-transaction specifics (R0-E).

These become `orchestration/decisions/G0-freeze.md` at gate G0.

Updated: 2026-11-09

# 08 — Oracle and human trust assumptions

MEND combines deterministic code, on-chain authorization, a verifiable-compute
provider, a private AI provider and human decisions. Each proves something
different. Confusing those proofs is the most likely way to make the product
dishonest, so this document states the trust boundary for each one.

The controlling rule: **if evidence is unavailable, the UI says `UNAVAILABLE`; it
does not show a green check.**

## Trust layers at a glance

| Layer | Proves | Does not prove | MEND label |
|---|---|---|---|
| Hub contract | State, roles, escrow arithmetic, who signed what transaction | That a physical repair happened | On-chain fact |
| Deterministic scorer | A specific binary produced a specific ranking from specific inputs | That the binary's policy is fair, or that the source matches the binary | `SCORE BOUND` / `OUTLAYER ATTESTED` / `LOCAL DETERMINISTIC` |
| OutLayer TEE | Which WASM ran with which input/output, attested by hardware | Correctness, source provenance, honest operator | `TEE ATTESTED` only after independent verification |
| NEAR AI Cloud gateway + model attestation | Evidence about the gateway and the model | A complete model→gateway→client chain | `INFERENCE EVIDENCE VERIFIED` / `UNAVAILABLE` |
| Sputnik DAO | A proposal was approved and executed a `FunctionCall` | That the proposal text was wise or honest | `DAO AUTHORIZED` |
| Human inspector | A named human signed a completion/durability decision | Structural engineering safety or future durability | `HUMAN ACCEPTED` / `HUMAN REJECTED` |
| Agent Market reviewer | A checklist-completeness opinion | Physical quality, independence, or MEND payment authority | `EXTERNAL REVIEW` |
| Indexer / API | A read model derived from chain events | Financial truth if it disagrees with the hub | `INDEXED` / `INDEXING` |
| Replay fixtures | A recorded scenario for judging | Live transactions | `REPLAY / SIMULATION` |

## NEAR AI attestation

**Verified facts from R0-A (2026-11-09):**

- Base URL: `https://cloud-api.near.ai/v1`; OpenAI-compatible; bearer auth.
- Canonical triage model: `z-ai/glm-5.3-flash`; send canonical IDs and
  `x-no-aliasing: true`.
- Public, keyless endpoints cover models, pricing, health and attestation reports.
- Response signatures are **not inline**. They are fetched after the fact from
  `GET /v1/signature/{chat_id}` and cover the exact request/response bytes.
- Attestation is split into **gateway TEE** and **model TEE** (`model_attestations[]`),
  plus an optional Intel Trust Authority token. The provider's own documentation
  says this is **not yet a complete end-to-end chain**.
- Signature retrieval can return `404`, or `200` with an `error_code` (for example
  a disconnected stream). Those cases are **unverified**, not “probably fine”.
- Legacy signatures may omit `signature_kind`; if policy requires provenance,
  reject them.
- The verifier SDK requires Node `>=24.22.1`; the repository currently declares
  Node `>=22`, so a runtime bump or a hand-rolled verifier is required.

**MEND behaviour:**

| Condition | UI label | What the user can conclude |
|---|---|---|
| Signature and attestation bytes verified for this request | `INFERENCE EVIDENCE VERIFIED` | These exact request/response bytes were signed; gateway/model evidence is separately shown |
| Signature fetch returns 404/error, or verification fails | `INFERENCE EVIDENCE UNAVAILABLE` | The suggestion is still usable as a proposal, but its provenance is not proven |
| No key configured (current state) | `BLOCKED_ON_HUMAN` + `UNAVAILABLE` | Offline fixtures may be replayed; no authenticated inference claim is made |
| Streaming or Responses/Messages API used | `GATEWAY-VERIFIED ONLY` | No model-level `provider_tee` claim |

**Never:** “AI approved”, “AI verified the repair”, “end-to-end attested” or a
green check for a signature that was not fetched and verified. See
[16 — Integration evidence](./16-integration-evidence.md#near-ai-cloud).

## OutLayer and the deterministic scorer

**Verified facts from R0-B (2026-11-09):**

- Testnet contract: `outlayer.testnet`. MEND would publish
  `mend.testnet/bid-rules` as a `wasm32-wasip1` project and pin the SHA-256 of the
  version.
- A contract calls `request_execution` with attached NEAR. OutLayer executes the
  WASM and resumes the caller's promise; there is no MEND webhook and no
  OutLayer-specific SDK crate.
- The MEND callback reads `promise_result(0)` as the module's stdout. The
  attestation is **not** in the callback; it must be fetched off-chain by
  transaction/request ID and verified separately.
- The TEE attestation proves which binary ran with which input and output. It does
  **not** prove that the binary logic is correct, that it was built from the
  published source, or that the operator is honest. The coordinator is closed
  source and can censor or delay.
- Recommended output is compact JSON under 900 bytes. Attach a small testnet
  deposit (the research example is 0.003 NEAR for 5B instructions / 10 s) and
  reserve gas for the callback.
- Live execution was **not** performed: no funded account and no published MEND
  project. That is `BLOCKED_ON_HUMAN`.

**MEND behaviour:**

| Condition | UI label | Meaning |
|---|---|---|
| On-chain callback stored policy/WASM/input/output hashes and the ranking | `SCORE BOUND` | The contract accepted a hash-bound ranking |
| Off-chain `outlayer-verify` succeeds for the transaction/request | `OUTLAYER + TEE ATTESTED` | The named binary ran with the named input/output, per Intel DCAP evidence |
| Attestation not fetched yet | `ATTESTATION PENDING` | Do not say “verified” |
| OutLayer unavailable or unverified | `LOCAL DETERMINISTIC — OUTLAYER UNAVAILABLE` | The same hash-pinned WASM ran locally; the result is deterministic but not TEE-attested |
| No eligible bids | `SCORE INVALID` | No winner is invented; steward may cancel/refund |

**Never:** “the AI picked the winner”, “the best contractor”, “provably fair” or
“audited”. The correct claim is narrow: this policy, this WASM, this input, this
ranking, with the evidence available.

## Sputnik DAO authorization

**Verified facts from R0-D (2026-11-09):**

- Testnet factory: `sputnikv2.testnet`, creating `<name>.sputnikv2.testnet`.
  Mainnet: `sputnik-dao.near`, creating `<name>.sputnik-dao.near`.
- `sputnik-dao.testnet` has no contract code and must not be used.
- Authorization must be a **push path**: an approved Sputnik `FunctionCall`
  proposal calls the hub's `dao_authorize`. The hub checks
  `predecessor_account_id == config.dao`.
- A NEAR view call cannot synchronously verify another contract. Reading a
  proposal off-chain is not on-chain authorization.
- Proposal IDs are decimal `u64` indexes. `get_last_proposal_id()` is the next ID,
  not the highest existing ID.
- A proposal must echo the exact proposal kind; a new DAO should fetch it rather
  than rely on stale README examples. The bond is the exact policy bond, not
  “at least 1 NEAR”.
- No MEND DAO exists yet. Deployment and proposals are `BLOCKED_ON_HUMAN`.

**MEND behaviour:** the work order stores the DAO account and decimal proposal ID.
The UI may say `DAO AUTHORIZED` only after the hub records a successful
`dao_authorize` from `config.dao`. A pending proposal is `PENDING`, a rejected one
is `REJECTED`, and an unverifiable reference is `UNAVAILABLE`.

**Never:** “the DAO approved” when only a proposal was created, or when MEND read
proposal text without the hub receiving the authorization call.

## Agent Market

**Verified facts from R0-D (2026-11-09):**

- Base: `https://market.near.ai`, OpenAPI 3.1.0, API version `2.0.0`.
- Worker auth uses `Authorization: Bearer aat_...`.
- The worker REST surface is poll/start/submit/message/decline/progress. There is
  **no worker accept endpoint**; an `aat_` token cannot accept its own work.
- Acceptance is a buyer/human action, or auto-accept after a 3–7 day window.
- Platform fee is 5% of the builder payout. It is a production marketplace with
  USD/USDC balances, not a NEAR testnet.
- Public read-only endpoints work without an account; job reads require auth.
- A live MEND job is `BLOCKED_ON_HUMAN` (no account/token/balance).

**MEND behaviour:** the Agent Market reviewer may return completeness findings.
The UI must label this `EXTERNAL REVIEW — NOT A SAFETY CERTIFICATION` and keep the
human inspector's decision separate. Self-hire testing must be disclosed and must
not be presented as independent market reputation.

## Human inspection

A human inspector account, different from the awarded contractor, signs:

- completion acceptance (triggers the 90% payment);
- durability pass/fail (releases or reopens the 10% holdback);
- remediation decisions on a reopened work order.

What this proves: a named account made a decision at a known time with a known
evidence package. What it does not prove: engineering safety, regulatory
compliance, future durability or absence of collusion. Copy must say
`HUMAN ACCEPTED`, not “safe”, “certified” or “guaranteed”.

If the inspector and contractor are the same person or share a key, the contract
must reject the decision. The public page shows both accounts so a reviewer can
see the separation.

## Indexer, API and RPC

- The hub is the financial source of truth. If Postgres says “paid” and the hub
  does not, the hub wins and the UI must show an inconsistency state.
- The indexer may lag. Show `INDEXING` for a transaction that is not yet in the
  read model; never fill the gap with an optimistic success.
- An RPC error is `UNAVAILABLE`, not “failed”. A failed transaction is `FAILED`.
  These are different user experiences.

## Trust matrix: claim → evidence required

| Claim shown in UI | Required evidence | If missing |
|---|---|---|
| `FUNDED` | Hub escrow record with exact token and amount | `PENDING` / `UNAVAILABLE` |
| `DAO AUTHORIZED` | Hub `dao_authorize` from `config.dao` + proposal ID | `PENDING` / `UNAVAILABLE` |
| `SCORE BOUND` | Hub score record with policy/WASM/input/output hashes | `PENDING` |
| `OUTLAYER + TEE ATTESTED` | Verified DCAP evidence for the transaction/request | `LOCAL DETERMINISTIC` or `ATTESTATION UNAVAILABLE` |
| `INFERENCE EVIDENCE VERIFIED` | Verified response signature + separately shown gateway/model evidence | `UNAVAILABLE` |
| `HUMAN ACCEPTED` | Inspector-signed acceptance, inspector ≠ contractor | `AWAITING INSPECTION` |
| `PAID 72 / HELD 8` | Hub payment records + token transfer result | `PENDING` / `FAILED` |
| `WARRANTY REOPENED` | Hub durability failure for the same work-order ID | `NOT REOPENED` |
| `PASSPORT` | NEP-171 token owned by the hub, transfer disabled | `UNAVAILABLE` |
| `REPLAY / SIMULATION` | Mode property + recorded fixtures | Never omit the label |

## Incident rule

If an external proof cannot be obtained, MEND must degrade the **claim**, not the
honesty:

1. Keep the suggested action available as a proposal.
2. Mark the evidence `UNAVAILABLE` with a short reason.
3. Keep the human decision and the on-chain fact separate.
4. Log the provider failure without secrets.
5. Never substitute a fabricated attestation, transaction or media file.

## Related documents

- [07 — Threat model](./07-threat-model.md)
- [09 — Failure cases](./09-failure-cases.md)
- [16 — Integration evidence](./16-integration-evidence.md)
- [17 — Copy and accessibility](./17-copy-and-accessibility.md)

---

[Docs index](./README.md) · [← Threat model](./07-threat-model.md) · [Next: failure cases →](./09-failure-cases.md)

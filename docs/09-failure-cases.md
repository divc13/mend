# 09 — Failure cases

MEND is designed to fail **visibly and safely**. A failed external service must
not become a fake success, a missing payment must not become a “processing”
screen forever, and a repeat repair failure must reopen the same work order rather
than disappear.

This page is a behaviour contract for the UI, API and contract. Test status is
honest: local paths are implemented and covered by the suites in
`orchestration/reports/G4-evidence.md`; live testnet/mainnet paths remain
`BLOCKED_ON_HUMAN`.

## Failure matrix

| # | Failure | Expected behaviour | State / record | User-visible status | Test status |
|---|---|---|---|---|---|
| 1 | Sponsor underfunds | Reject the funding and refund the full received amount | Stays `POLICY_APPROVED` or `FUNDING_FAILED` | `Funding incomplete — refunded` | `IMPLEMENTED (local)` |
| 2 | Sponsor overfunds | Credit only the exact remaining budget; refund excess | `FUNDED` once exact | `Funded; excess returned` | `IMPLEMENTED (local)` |
| 3 | Wrong token | Reject and refund | No credit | `Wrong token — refunded` | `IMPLEMENTED (local)` |
| 4 | Duplicate funding | Refund duplicate in full | No extra credit | `Duplicate funding refunded` | `IMPLEMENTED (local)` |
| 5 | Funding after cancellation | Refund in full | `CANCELLED` / `REFUNDED` | `Cancelled — refunded` | `IMPLEMENTED (local)` |
| 6 | NEAR AI unavailable | Keep report accepted; mark triage unavailable; allow manual steward triage | No AI claim | `AI triage unavailable — needs human review` | `BLOCKED_ON_HUMAN` for live AI; offline fallback is explicit |
| 7 | AI returns invalid JSON | Reject output; retry once; then require human triage | No state change | `AI suggestion rejected` | `IMPLEMENTED (local)` |
| 8 | AI attestation unavailable | Show suggestion with `UNAVAILABLE` evidence | No verified claim | `Inference evidence unavailable` | `IMPLEMENTED (local)` |
| 9 | Prompt injection detected | Treat as data; reject unauthorized action; audit event | No recipient/role change | `Blocked unsafe instruction` | `IMPLEMENTED (local)` (T07.2) |
| 10 | OutLayer unavailable | Keep `BIDDING_REVEAL`; retry/timeout; clearly labelled local fallback or wait | No fake score | `Scoring unavailable — retry` / `LOCAL DETERMINISTIC — OUTLAYER UNAVAILABLE` | `BLOCKED_ON_HUMAN` for live OutLayer |
| 11 | OutLayer callback malformed | Reject; do not record score | Stays `BIDDING_REVEAL` | `Score rejected — retry` | `IMPLEMENTED (local)` |
| 12 | Wrong WASM/policy/input hash | Reject score | Stays `BIDDING_REVEAL` | `Score rejected — hash mismatch` | `IMPLEMENTED (local)` |
| 13 | Stale score | Reject award/record | No winner | `Score stale — rescore required` | `IMPLEMENTED (local)` |
| 14 | No eligible bids | `SCORE_INVALID`; no winner | `BIDDING_REVEAL`; steward may cancel/refund | `No eligible bids` | Protocol tested; contract pending |
| 15 | Contractor never starts | Steward/DAO dispute per state rules; cancellation is pre-award only | `AWARDED` → `DISPUTED` | `Awarded — work not started` | `IMPLEMENTED (local)` |
| 16 | Contractor misses deadline | No automatic blame; evidence and contract rules decide | Dispute/cancel path | `Deadline missed — review` | `IMPLEMENTED (local)` |
| 17 | Evidence missing checklist item | Reviewer lists missing items; inspector cannot accept as complete | Stays `COMPLETION_SUBMITTED` | `Missing evidence: …` | `IMPLEMENTED (local)` |
| 18 | Evidence replay (old photo) | Reject duplicate evidence hash; human review | No acceptance | `Evidence already used` | `IMPLEMENTED (local)` |
| 19 | Contractor tries self-inspection | Contract rejects | No state change | `Contractor cannot inspect own work` | Protocol tested; contract pending |
| 20 | Inspector tries to award self | Contract rejects | No award | `Inspector cannot be awarded` | Protocol tested; contract pending |
| 21 | Durability fails | Reopen same work order; no new money; holdback held | `WARRANTY_REOPENED` | `Durability failed — warranty reopened` | Protocol tested; contract pending |
| 22 | Remediation fails again | Same work order reopens again; history grows | `WARRANTY_REOPENED` | `Warranty reopened again` | `IMPLEMENTED (local)` |
| 23 | Dispute opened | Freeze relevant payouts; require DAO resolution | `DISPUTED` | `Disputed — funds frozen` | `IMPLEMENTED (local)` |
| 24 | DAO resolution missing | No movement | Stays `DISPUTED` | `Awaiting DAO resolution` | `IMPLEMENTED (local)` |
| 25 | Double payment attempt | Reject; closed order immutable | No second payment | `Already paid` | Protocol tested; contract pending |
| 26 | Warranty tries to mint funds | Reject; no new escrow | Same work order | `Warranty cannot create funds` | Protocol tested; contract pending |
| 27 | Pause during action | Reject state-changing action; remember previous state | `PAUSED` | `Contract paused` | `IMPLEMENTED (local)` |
| 28 | Unpause attempts wrong state | Reject; must restore exact previous state | `PAUSED` | `Paused — resume blocked` | Protocol tested; contract pending |
| 29 | Intents dry quote only | Show quote/fees/destination; no deposit address | No funding | `DRY QUOTE — NOT A PAYMENT` | Read-only API **VERIFIED**; live deposit `BLOCKED_ON_HUMAN` |
| 30 | Intents pending | Poll status; do not credit | No funding | `PENDING_DEPOSIT` / `PROCESSING` | `BLOCKED_ON_HUMAN` for live funds |
| 31 | Intents underpayment | Show `INCOMPLETE_DEPOSIT`; top-up before deadline or refund path | No credit | `Incomplete deposit` | `BLOCKED_ON_HUMAN` |
| 32 | Intents failure/refund | Show `FAILED` / `REFUNDED`; reconcile; no payment claim | No funding | `Sponsorship failed` / `Refunded` | `BLOCKED_ON_HUMAN` |
| 33 | Intents quote expires | Client-side `EXPIRED`; there is no API `EXPIRED` status | No deposit | `Quote expired` | Read-only **VERIFIED** (no `EXPIRED` API status) |
| 34 | Intents success | Credit only after destination tx + hub funding match | `FUNDED` if exact | `Sponsorship settled` | `BLOCKED_ON_HUMAN` |
| 35 | Agent Market unavailable | Keep human review path; mark external review unavailable | No acceptance | `External review unavailable` | `BLOCKED_ON_HUMAN` for live jobs |
| 36 | Agent Market job times out | Human inspector proceeds; record the gap | No fake review | `External review timed out` | `IMPLEMENTED (local)` |
| 37 | Agent Market self-accept attempt | No worker accept endpoint; acceptance stays human | No acceptance | `Awaiting human acceptance` | **VERIFIED** gap |
| 38 | Indexer lag | Show `INDEXING`; do not invent state | Read model catches up | `Indexing transaction…` | `IMPLEMENTED (local)` |
| 39 | RPC unavailable | Show `UNAVAILABLE`; retry | No state change | `Chain unavailable — retry` | `IMPLEMENTED (local)` |
| 40 | Object storage unavailable | Block evidence upload/review; no fake hash | No evidence recorded | `Evidence storage unavailable` | `IMPLEMENTED (local)` |
| 41 | Key compromise suspected | Pause, revoke scoped keys, rotate, audit | `PAUSED` | `Security pause` | `IMPLEMENTED (local)` |
| 42 | Replay reset | Reset only designated demo data; deterministic initial state | `REPLAY` fixtures | `REPLAY / SIMULATION` | `IMPLEMENTED (local)` |
| 43 | Live/replay confusion | Mode badge on every screen and capture; no live links in replay | Mode property | `REPLAY / SIMULATION` | `IMPLEMENTED (local)` |

## Recovery playbooks

### Funding does not complete

1. Do not open bidding.
2. Show the exact expected amount, token and sponsor.
3. Refund underfunded/duplicate/wrong-token transfers in full.
4. If the sponsor used Intents, keep the deposit address and status visible; an
   intent or pending status is not funding.
5. Reconcile the destination transaction with the intended work order before
   crediting.

### Scoring does not complete

1. Keep the order in `BIDDING_REVEAL`.
2. Show the OutLayer request/transaction reference and a retry action.
3. If a local deterministic fallback runs, label it
   `LOCAL DETERMINISTIC — OUTLAYER UNAVAILABLE` and never claim TEE attestation.
4. If no eligible bids remain, fail with `SCORE_INVALID`; do not invent a winner.
5. Only a verified, hash-bound ranking can move to `SCORED`.

### Completion evidence is incomplete

1. Reviewer lists missing items only.
2. Inspector cannot record acceptance until the checklist is complete or an
   explicit human exception is recorded.
3. Evidence replay (a previously used hash) is rejected.
4. The contractor may submit a corrected package; the work order stays in
   `COMPLETION_SUBMITTED`.

### Durability fails

1. Record the failure against the same work-order ID.
2. Move to `WARRANTY_REOPENED`; keep the 8 USDC holdback held.
3. Create no new bounty, no new escrow and no new work-order ID.
4. Contractor submits remediation evidence; a different/independent inspection
   decides.
5. Release the holdback at most once after a passing inspection.
6. The passport shows both the failure and the remedy.

### Dispute

1. Freeze relevant funds.
2. Publish a reason hash and the disputed state.
3. Require an explicit DAO/human resolution target.
4. No payout, refund or acceptance while `DISPUTED`.
5. Record the resolution event and keep the asset history.

### External provider outage

1. Mark the provider `UNAVAILABLE` with a timestamp.
2. Keep the last confirmed on-chain state visible.
3. Do not auto-substitute a mock that looks live.
4. Offer a retry and, where legitimate, a labelled fallback.
5. Log the failure without secrets or private evidence.

## What must never happen

- A dry quote shown as a payment.
- A pending transaction shown as `SUCCESS`.
- A replay shown as a live transaction.
- An AI suggestion shown as an approval.
- A score without a policy/WASM/input/output binding.
- A payment without an accepted inspection.
- A second completion payment or a second refund.
- A warranty reopening that creates new escrow.
- A passport transfer that succeeds.
- A private media URL or precise location in public state.
- A fabricated attestation, transaction hash, media file or consent record.

## Related documents

- [04 — State machine](./04-state-machine.md)
- [05 — Payment accounting](./05-payment-accounting.md)
- [08 — Oracle and human trust](./08-oracle-and-human-trust.md)
- [11 — Limitations](./11-limitations.md)
- [16 — Integration evidence](./16-integration-evidence.md)

---

[Docs index](./README.md) · [← Oracle and human trust](./08-oracle-and-human-trust.md) · [Next: deployment guide →](./10-deployment-guide.md)

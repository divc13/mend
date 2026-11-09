# 04 — State machine

The work-order lifecycle is explicit in `packages/protocol/src/state-machine.ts`.
Invalid transitions fail in protocol and contract tests; they are not handled by
convention or UI state. See `orchestration/decisions/HUB-INTERFACE.md`
and the [state-machine tests](../packages/protocol/test/state-machine.test.ts).

## Normal lifecycle

```text
DRAFT
  → POLICY_APPROVED
  → FUNDED
  → BIDDING_OPEN
  → BIDDING_REVEAL
  → SCORED
  → AWARDED
  → IN_PROGRESS
  → COMPLETION_SUBMITTED
  → COMPLETION_ACCEPTED
  → DURABILITY_PENDING
  → CLOSED
```

`COMPLETION_ACCEPTED` records the inspector's acceptance decision. The same
acceptance action moves the order into `DURABILITY_PENDING` and starts the
durability clock. Implementations may persist the intermediate state, but the UI
must not show a second payment opportunity.

## Warranty reopening

A failed durability inspection does **not** create a new work order, a new bounty
or new escrow. It reopens the same order:

```text
DURABILITY_PENDING
  → WARRANTY_REOPENED
  → IN_PROGRESS
  → COMPLETION_SUBMITTED
  → COMPLETION_ACCEPTED
  → DURABILITY_PENDING
```

The original work-order ID, funding, bid, contractor, inspector history and asset
history remain. The holdback stays held and is released at most once after a
passing durability inspection. Remediation acceptance pays nothing a second time.
See [05 — Payment accounting](./05-payment-accounting.md#warranty-remediation-creates-no-new-money).

## Exceptional transitions

```text
Any eligible active state       → DISPUTED
DISPUTED                        → explicit human/DAO resolution target
Pre-award states                → CANCELLED → REFUNDED
Failed funding                  → FUNDING_FAILED → REFUNDED
Any non-terminal active state   → PAUSED → exact previous state
```

Dispute resolution is not a normal transition table entry. It requires
`humanResolution: true` in the protocol context and a DAO-only contract call. A
dispute freezes payouts; nothing moves until resolution.

## States

| State | Meaning | Who acts next |
|---|---|---|
| `DRAFT` | Scope and maximum budget proposed; no DAO approval yet | Steward proposes; DAO authorizes |
| `POLICY_APPROVED` | DAO approved budget, roster and scoring policy; awaiting funds | Sponsor funds |
| `FUNDED` | Exact budget is held by the hub | Steward opens bidding |
| `BIDDING_OPEN` | Commitments accepted; reveal only after the commit deadline | Contractors commit/reveal |
| `BIDDING_REVEAL` | Reveal window closed; awaiting deterministic score | Steward requests score |
| `SCORED` | Hash-bound ranking recorded | Steward confirms rank 1 |
| `AWARDED` | Winner and price fixed; unallocated budget refunded | Contractor starts work |
| `IN_PROGRESS` | Physical repair or remediation under way | Contractor submits evidence |
| `COMPLETION_SUBMITTED` | Redacted evidence and checklist submitted | Inspector reviews |
| `COMPLETION_ACCEPTED` | Inspector accepted completion; 90% paid once | Move to durability |
| `DURABILITY_PENDING` | Holdback retained until the public durability timestamp | Inspector inspects later |
| `CLOSED` | Durability passed and holdback released once | No further financial action |
| `WARRANTY_REOPENED` | Durability failed; same work order reopens | Contractor remediates |
| `DISPUTED` | Funds frozen pending human/DAO resolution | DAO resolves |
| `CANCELLED` | Pre-award cancellation recorded | Refund |
| `REFUNDED` | Remaining escrow returned; terminal | — |
| `FUNDING_FAILED` | Funding did not complete; terminal path to refund | Refund |
| `PAUSED` | Contract-level pause; remembers the previous state | Owner/DAO unpauses |

A `PAUSED` work order rejects state-changing agent actions. Unpause must return to
the exact remembered state, not to a fresh state.

## Transition table

Allowed transitions from `packages/protocol/src/state-machine.ts`:

| From | Allowed to |
|---|---|
| `DRAFT` | `POLICY_APPROVED`, `CANCELLED`, `PAUSED` |
| `POLICY_APPROVED` | `FUNDED`, `FUNDING_FAILED`, `CANCELLED`, `PAUSED` |
| `FUNDED` | `BIDDING_OPEN`, `CANCELLED`, `REFUNDED`, `PAUSED` |
| `BIDDING_OPEN` | `BIDDING_REVEAL`, `CANCELLED`, `PAUSED` |
| `BIDDING_REVEAL` | `SCORED`, `CANCELLED`, `PAUSED` |
| `SCORED` | `AWARDED`, `CANCELLED`, `REFUNDED`, `PAUSED` |
| `AWARDED` | `IN_PROGRESS`, `DISPUTED`, `PAUSED` |
| `IN_PROGRESS` | `COMPLETION_SUBMITTED`, `DISPUTED`, `PAUSED` |
| `COMPLETION_SUBMITTED` | `COMPLETION_ACCEPTED`, `DISPUTED`, `PAUSED` |
| `COMPLETION_ACCEPTED` | `DURABILITY_PENDING`, `DISPUTED`, `PAUSED` |
| `DURABILITY_PENDING` | `CLOSED`, `WARRANTY_REOPENED`, `DISPUTED`, `PAUSED` |
| `WARRANTY_REOPENED` | `IN_PROGRESS`, `DISPUTED`, `PAUSED` |
| `DISPUTED` | Explicit resolution target only (see below) |
| `CANCELLED` | `REFUNDED` |
| `REFUNDED` | — terminal |
| `FUNDING_FAILED` | `REFUNDED` |
| `CLOSED` | — terminal |
| `PAUSED` | Exact previous state only |

Dispute resolution targets accepted by the protocol:

```text
AWARDED, IN_PROGRESS, COMPLETION_SUBMITTED, COMPLETION_ACCEPTED,
DURABILITY_PENDING, WARRANTY_REOPENED, CLOSED, REFUNDED
```

## Transition triggers

| Transition | Trigger | Authority |
|---|---|---|
| `DRAFT → POLICY_APPROVED` | `dao_authorize` | DAO only, via approved Sputnik proposal |
| `POLICY_APPROVED → FUNDED` | Full `ft_transfer_call` funding | Sponsor only |
| `POLICY_APPROVED → FUNDING_FAILED` | Funding failure | Contract/token callback |
| `FUNDED → BIDDING_OPEN` | `open_bidding` | Steward |
| `BIDDING_OPEN → BIDDING_REVEAL` | `close_bidding` after reveal deadline | Steward |
| `BIDDING_REVEAL → SCORED` | `record_score` after verified OutLayer callback | Steward / oracle path |
| `SCORED → AWARDED` | `award(rank 1)` | Steward |
| `AWARDED → IN_PROGRESS` | `start_work` | Awarded contractor |
| `IN_PROGRESS → COMPLETION_SUBMITTED` | `submit_completion` | Awarded contractor |
| `COMPLETION_SUBMITTED → COMPLETION_ACCEPTED` | `accept_completion` | Rostered inspector ≠ contractor |
| `COMPLETION_ACCEPTED → DURABILITY_PENDING` | Acceptance action sets durability deadline | Contract |
| `DURABILITY_PENDING → CLOSED` | `inspect_durability(passed = true)` | Rostered inspector ≠ contractor |
| `DURABILITY_PENDING → WARRANTY_REOPENED` | `inspect_durability(passed = false)` | Rostered inspector ≠ contractor |
| `WARRANTY_REOPENED → IN_PROGRESS` | `start_work` on remediation | Awarded contractor |
| `* → DISPUTED` | `open_dispute` | Steward, inspector or contractor |
| `DISPUTED → target` | `resolve_dispute` with explicit resolution | DAO only |
| `Pre-award → CANCELLED` | `cancel_work_order` | Steward |
| `CANCELLED → REFUNDED` | `refund` | DAO/steward |
| `* → PAUSED` | `pause(reason_hash)` | Owner/DAO |
| `PAUSED → previous` | `unpause` | Owner/DAO |

## Invariants

These are enforced in contract code and must fail in contract tests:

1. Contractor cannot inspect their own work; inspector cannot be the awarded contractor.
2. Only the awarded contractor can start or submit work; only a rostered inspector can accept.
3. AI roles cannot award, accept, refund or release funds.
4. A bid cannot be revealed before the reveal phase; a late bid cannot be awarded.
5. Only a deterministic rank-1 eligible bid can be awarded.
6. Funding equals refunded + still-escrowed + completion paid + holdback held + holdback released at every point.
7. Completion payment and holdback are calculated exactly once.
8. A closed work order cannot be paid again.
9. Warranty reopening cannot mint new escrow and keeps the same work-order ID.
10. Paused contracts reject state-changing agent actions; unpause restores the exact previous state.
11. Passport transfer always fails; no evidence URL, precise location or raw media is in public state.
12. A disputed work order cannot move until an explicit human/DAO resolution.

The ledger invariant is explained numerically in
[05 — Payment accounting](./05-payment-accounting.md#the-ledger-invariant).

## Events

Every state change emits one `EVENT_JSON` event with standard `mend`, version
`1.0.0`, work-order ID, actor and transaction-relevant fields. Event names include
`work_order_created`, `policy_approved`, `work_order_funded`, `bid_committed`,
`bid_revealed`, `score_recorded`, `work_order_awarded`, `completion_accepted`,
`payment_released`, `durability_passed`, `warranty_reopened`, `dispute_opened`,
`dispute_resolved`, `work_order_refunded`, `passport_transfer_rejected` and
`prompt_injection_blocked`. The full list is `packages/protocol/src/events.ts`.

## Replay and live state

Mode is a property of the work order: `LIVE_TESTNET`, `MAINNET` or `REPLAY`.
Replay fixtures may use the same state machine, but the UI must render
`REPLAY / SIMULATION` prominently and must never show a replay transition as a
live transaction. See [17 — Copy and accessibility](./17-copy-and-accessibility.md#mode-labels).

---

[Docs index](./README.md) · [← Architecture](./03-architecture.md) · [Next: payment accounting →](./05-payment-accounting.md)

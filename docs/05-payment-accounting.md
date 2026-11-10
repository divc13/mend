# 05 — Payment accounting

All MEND amounts are integer **micro-units** of a 6-decimal stablecoin
(`1 USDC = 1,000,000 micro`). No floating-point arithmetic is used for money.
Constants live in `packages/protocol/src/constants.ts`; the accounting functions
and ledger invariant live in `packages/protocol/src/accounting.ts`.

## Canonical scenario

The canonical pilot uses a **100 USDC** sponsor budget and an **80 USDC** winning
bid:

| Line | Amount | Micro-units |
|---|---:|---:|
| Sponsor budget | 100.000000 USDC | `100000000` |
| Winning bid / locked award | 80.000000 USDC | `80000000` |
| Unallocated refund to sponsor | 20.000000 USDC | `20000000` |
| Completion payment (90% of award) | 72.000000 USDC | `72000000` |
| Durability holdback (10% of award) | 8.000000 USDC | `8000000` |

The 20 is an **explicit refund**, not a hidden fee. It is returned when the award
is recorded, because the winning price is below the approved budget.

## Ledger at each stage

The ledger has six fields: funding, refunded, still-escrowed, completion paid,
holdback held and holdback released. Their sum must always equal total funding.

| Stage | Funding | Refunded | Escrowed | Completion paid | Holdback held | Holdback released | Sum |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fully funded | 100 | 0 | 100 | 0 | 0 | 0 | 100 |
| Award recorded | 100 | 20 | 80 | 0 | 0 | 0 | 100 |
| Completion accepted | 100 | 20 | 0 | 72 | 8 | 0 | 100 |
| Durability failed | 100 | 20 | 0 | 72 | 8 | 0 | 100 |
| Remediation accepted | 100 | 20 | 0 | 72 | 8 | 0 | 100 |
| Durability passed | 100 | 20 | 0 | 72 | 0 | 8 | 100 |
| Closed | 100 | 20 | 0 | 72 | 0 | 8 | 100 |

A warranty reopening changes **no row** in this table. It changes the lifecycle
state and creates new inspection work, not new money.

## Exact integer math

```text
completion = floor(award × 9000 / 10000)
holdback   = award − completion
refund     = budget − award
```

The remainder always lands in the holdback. This makes every split exact and
prevents lost micro-units. For the canonical award:

```text
completion = floor(80,000,000 × 9,000 / 10,000) = 72,000,000
holdback   = 80,000,000 − 72,000,000           =  8,000,000
refund     = 100,000,000 − 80,000,000          = 20,000,000
```

For an award of 95.000000 USDC:

```text
completion = 85,500,000
holdback   =  9,500,000
```

For an award that does not divide evenly (for example 77.777777 USDC):

```text
completion = floor(77,777,777 × 9,000 / 10,000) = 69,999,999
holdback   = 77,777,777 − 69,999,999           =  7,777,778
```

The extra micro-unit belongs to the holdback, never to an unaccounted remainder.

## The ledger invariant

```text
funding
  = refunded
  + still-escrowed
  + completion paid
  + holdback held
  + holdback released
```

`assertLedgerBalanced` in `packages/protocol/src/accounting.ts` fails closed if the
invariant is broken. The same invariant is enforced in the hub contract and its
tests.

## Funding rules

| Case | Behaviour |
|---|---|
| Correct token, correct sponsor, exact remaining budget | Work order becomes `FUNDED` |
| Wrong token | Reject and refund the transfer |
| Underfund | Reject and refund the full received amount; order stays unfunded |
| Overfund | Accept only the remaining budget; refund the excess |
| Duplicate funding | Refund the duplicate in full |
| Funding after cancellation | Refund in full |
| Funding callback failure | No credit; refund path applies; state remains honest |
| Sponsor not the recorded sponsor | Reject and refund |

The hub is registered with the settlement token before any `ft_transfer_call`;
otherwise the token transfer fails at the token contract. This is a deployment
prerequisite, not a MEND accounting rule.

## Award, refund and cancellation

| Action | Money movement |
|---|---|
| Award rank-1 eligible bid | `budget − price` returns to the sponsor; `price` stays in escrow |
| Cancel before award | Remaining escrow returns to the sponsor; `REFUNDED` |
| Refund a cancelled or eligible pre-award order | Remaining escrow returns once; repeat calls fail |
| No eligible bids | Scoring fails (`SCORE_INVALID`); no winner is invented; steward may cancel/refund |
| Closed order | No further payment or refund is possible |

## Warranty remediation creates no new money

A failed durability inspection:

- keeps the same work-order ID and asset history;
- keeps the 8 USDC holdback held;
- creates no new escrow, no new bounty and no new funding round;
- pays nothing on remediation acceptance;
- releases the 8 USDC holdback at most once, after a later passing inspection.

A repeat failure repeats the same rule. The asset passport records both the
failure and the remedy.

## Disputes

Opening a dispute freezes the relevant funds. Only an explicit human/DAO
resolution moves a disputed order. The contract must reject:

- a payout while `DISPUTED`;
- a resolution without the explicit human/DAO flag and DAO authority;
- a second resolution or a second refund.

## Payment records

Each payment record has `kind` (`COMPLETION`, `HOLDBACK`, `REFUND`), amount in
micro-units, recipient, status (`INTENT`, `PENDING`, `SUCCESS`, `FAILED`) and an
optional transaction hash. The UI must not show `SUCCESS` without a confirmed
transaction result. An intent or a pending transaction is not a payment.

## What the user must see

For every payment, the interface should show, in plain language:

1. **What** is being paid: completion, holdback release or refund.
2. **Who** receives it: the contractor account or sponsor.
3. **How much**, with the exact split (for example `72 + 8 = 80`).
4. **Why now**: which accepted inspection or durability result triggered it.
5. **Proof**: transaction hash and explorer link, or an explicit
   `PENDING` / `UNAVAILABLE` state.
6. **Mode**: `LIVE TESTNET — TEST VALUE ONLY`, `MAINNET — REAL FUNDS` or
   `REPLAY / SIMULATION`.

No user should need to understand NEAR gas, yoctoNEAR or NEP-141 terminology to
understand a payment.

## Intents sponsorship is not accounting

A 1Click quote shows an estimate, fees and a destination amount. It is **not** a
payment and does not credit the work order. Only the confirmed NEP-141 funding
receipt, matched to the intended work order, moves the ledger. A dry quote has no
deposit address. See
[16 — Integration evidence](./16-integration-evidence.md#near-intents--1click).

## Evidence

| Claim | Status | Evidence |
|---|---|---|
| 100 → 20 refund → 80 escrow → 72 completion → 8 holdback is exact | **VERIFIED (local)** | `packages/protocol/test/accounting.test.ts`; `npm test -w @mend/protocol` |
| Ledger invariant is tested | **VERIFIED (local)** | `isLedgerBalanced` / `assertLedgerBalanced` tests |
| On-chain payment behaviour is proven on NEAR testnet | **VERIFIED (testnet)** | `WO-BENCH-001-0003` `CLOSED`, 57 tx, exact NEP-141 events for refund 20 / completion 72 / holdback 8, escrow 0; see `orchestration/reports/G3-evidence.md` and `tests/live/LIVE-EVIDENCE.md` |
| Mainnet payment behaviour | **BLOCKED_ON_HUMAN** | No mainnet deployment, funds or approval |

---

[Docs index](./README.md) · [← State machine](./04-state-machine.md) · [Next: privacy model →](./06-privacy-model.md)

# 01 — Problem and product

## The problem

Community-controlled assets fail in public: a bench loses a slat, a bicycle rack
bends, a fence panel comes loose, a community-centre door stops latching. The
repair itself is usually small. The system around it is not.

| Failure in the current pattern | Consequence |
|---|---|
| Reports arrive through different channels (chat groups, forms, phone calls) | Duplicates, lost context and no single public record |
| Triage exposes reporters and exact locations | People stop reporting, or report less precisely |
| Repairs are one-off purchases | No warranty history, no comparison, no accountability after payment |
| The cheapest bid wins | Short warranties and rushed work are rewarded |
| Payment and evidence are disconnected | A paid repair can fail and simply disappear |
| A repeat failure starts a fresh process | The previous failure is erased instead of remembered |
| Cross-chain sponsors cannot easily fund a local repair | Community budgets stay fragmented |

MEND addresses the whole loop, not just the repair transaction.

## The product

**MEND — Maintenance with memory.** A community asset moves through one
continuous, inspectable lifecycle:

```text
Report
→ Private triage and duplicate suggestion
→ Steward scope and budget proposal
→ DAO authorization of budget, roster and policy
→ Sponsor funding
→ Sealed contractor offers
→ Deterministic bid evaluation
→ Award
→ Physical repair
→ Independent evidence review and human acceptance
→ 90% contractor payment
→ 10% durability holdback
→ Later inspection
→ Holdback release OR warranty reopening
→ Permanent asset maintenance history
```

### Promise

> **Get it fixed. Keep it fixed.**

### The differentiator

A failed repair **reopens the original work order and warranty history**. It does
not create a fresh bounty, a new work-order ID or new money. The failure stays in
the asset's permanent record next to the remedy. See
[04 — State machine](./04-state-machine.md#warranty-reopening) and
[05 — Payment accounting](./05-payment-accounting.md#warranty-remediation-creates-no-new-money).

## Design principles

1. **The contract is the financial source of truth.** The API and database are a
   read model. See [03 — Architecture](./03-architecture.md#source-of-truth-rules).
2. **AI proposes; humans and code decide.** AI produces untrusted, schema-validated
   suggestions. It never holds payment, award or acceptance authority. See
   [08 — Oracle and human trust](./08-oracle-and-human-trust.md).
3. **The winner is computed, not chosen.** A versioned, hash-pinned deterministic
   scorer ranks eligible bids. No LLM picks a winner. See [`RULES.md`](./RULES.md).
4. **Privacy is the default.** Raw media, precise location and reporter identity
   stay off-chain and out of public state. See [06 — Privacy model](./06-privacy-model.md).
5. **Modes are unmistakable.** `LIVE TESTNET — TEST VALUE ONLY`,
   `MAINNET — REAL FUNDS` and `REPLAY / SIMULATION` are always visible. A replay is
   never rendered as a live transaction. See [17 — Copy and accessibility](./17-copy-and-accessibility.md).
6. **Missing evidence is labelled, never invented.** External claims are
   **VERIFIED**, **UNAVAILABLE** or **BLOCKED_ON_HUMAN**. See
   [16 — Integration evidence matrix](./16-integration-evidence.md).

## Pilot scope

The pilot is deliberately low-risk and community-controlled:

- park or community-centre bench
- bicycle rack
- fence panel
- community-centre door (non-emergency)
- non-electrical playground fixture
- another similar low-risk fixture

The pilot explicitly excludes municipal roads, electrical systems, gas,
structural work, emergency dispatch and anything requiring a licensed emergency
response. MEND does not certify physical safety.

## What MEND is not

| Not this | Why it matters |
|---|---|
| A structural-safety certification system | Human inspectors record completion and durability decisions; they do not certify engineering safety. |
| An AI approval system | AI may suggest, classify, cluster and list missing evidence. It cannot approve, award, inspect or pay. |
| An autonomous municipal dispatch system | No emergency dispatch, no city adoption claims, no implied government partnership. |
| A speculative asset or memecoin | The passport is non-transferable and non-speculative; it confers no legal ownership of a physical asset. |
| A guarantee of repair quality | MEND creates evidence, incentives and a durable record; it cannot guarantee physical outcomes. |
| A finished production system | Current status and non-claims are in [11 — Limitations](./11-limitations.md). |

## Users at a glance

| User | Primary need | First document |
|---|---|---|
| Reporter | Report without a wallet, without exposing identity or precise location | [02 — Roles](./02-user-roles.md), [06 — Privacy](./06-privacy-model.md) |
| Steward | Turn reports into a scoped, fundable work order | [02](./02-user-roles.md), [04](./04-state-machine.md) |
| Sponsor | Fund a known budget and see exactly what happened | [05 — Accounting](./05-payment-accounting.md) |
| DAO | Authorize policy, roster and budget without micromanaging | [08 — Trust](./08-oracle-and-human-trust.md#sputnik-dao-authorization) |
| Contractor | Compete on total value, not just price | [`RULES.md`](./RULES.md), [04](./04-state-machine.md) |
| Inspector | Record independent completion and durability decisions | [02](./02-user-roles.md), [08](./08-oracle-and-human-trust.md#human-inspection) |
| Judge or auditor | Replay the whole story without credentials and verify what is real | [13 — Demo script](./13-demo-script.md), [15 — Capture plan](./15-demo-capture-plan.md) |

## Current status

The protocol, canonical fixtures and accounting are frozen and tested. The
application, contracts, agents and external integrations are being built in
parallel worktrees. No live testnet lifecycle, hosted demo or physical repair
media exists yet. The exact evidence state is in
[16 — Integration evidence matrix](./16-integration-evidence.md) and
[11 — Limitations](./11-limitations.md).

---

[Docs index](./README.md) · [Next: user roles →](./02-user-roles.md) · [Root README](../README.md)

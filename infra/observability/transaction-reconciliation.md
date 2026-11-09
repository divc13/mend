# Transaction reconciliation: alerts and checklist (T08.5)

The hub contract is the financial source of truth. Postgres and logs are read
models. Reconciliation compares the two and the external rails (Intents/1Click,
NEP-141 transfers) against the intended work order. A mismatch is never silently
retried into a second payment.

## Invariants

For every work order:

```text
total funding = completion paid + durability holdback held/released + refunds + remaining escrow
```

For the canonical 100 / 80 scenario:

```text
sponsor funding       100
locked award           80
completion payment     72   (90% of 80, exactly once)
durability holdback     8   (10% of 80, exactly once)
unawarded refund       20
```

- Completion and holdback are calculated and paid exactly once.
- A closed work order cannot be paid again.
- Warranty reopening creates no new escrow.
- A pending/failed/refunded Intent must never appear as a successful funding.
- Underpayment, overpayment and duplicate callbacks are explicit outcomes.

## Alert rules (Prometheus)

See [`alerts/transaction-reconciliation.rules.yml`](alerts/transaction-reconciliation.rules.yml).
Services must emit the counters described in [logging.md](logging.md); parsing
log lines is not an acceptable alerting path.

| Alert | Severity | Meaning |
|---|---|---|
| `MendReconciliationMismatch` | critical | Any mismatch between chain state and the read model. |
| `MendEscrowAccountingMismatch` | critical | Funding ≠ payouts + holdback + refunds + remaining. |
| `MendDuplicatePaymentSuspected` | critical | More than one completion/holdback payout for a work order. |
| `MendIntentPendingStale` | warning | Intent pending beyond the expected settlement window. |
| `MendIntentFailedNotSurfaced` | critical | `FAILED`/`REFUNDED` execution missing from work-order state. |
| `MendIndexerLagHigh` | warning | Indexer trailing the chain beyond the threshold. |
| `MendOutLayerVerificationFailure` | warning | Score execution evidence failed hash/signature checks. |
| `MendAIAttestationUnavailable` | info | AI evidence unavailable; UI must say so. |
| `MendApiReadinessFailing` | critical | API not ready for an extended period. |

## Daily / demo-run checklist

Run after every full lifecycle and before any demo recording.

1. **Funding**
   - Intent quote ID and destination transaction exist.
   - Destination asset is the verified testnet token; amount matches funding.
   - Status is `SUCCESS`; `PENDING`, `FAILED`, `REFUNDED` are not counted as funded.
   - Explorer link resolves and points to the expected account.
2. **Escrow**
   - Hub view shows funded amount equal to the locked award.
   - No duplicate `ft_transfer_call` / duplicate callback credited twice.
3. **Award and bids**
   - Winning bid is eligible, revealed in time and matches the policy hash.
   - OutLayer code/input/output hashes verify against the published artefacts.
4. **Settlement**
   - Completion transfer is exactly 72 and holdback exactly 8 (canonical).
   - No second completion payment exists for the work order.
5. **Durability**
   - Holdback release exists exactly once and only after the durability inspection.
   - Failed durability reopened the same work order (`reopenCount` increased, no
     new funding).
6. **Read model**
   - Indexer lag is within threshold; rebuild from an empty database produces
     the same public state.
   - Postgres amounts match hub views for every active work order.
7. **Evidence and privacy**
   - Chain records contain redacted hashes only.
   - Logs contain no raw media, precise location, case link, key or signed URL.
8. **Labels**
   - Every UI/log surface in replay says `REPLAY / SIMULATION`.
   - No dry quote is shown as a payment.

## Investigation runbook

1. **Freeze, do not retry.** Pause the relevant work order/contract if a
   duplicate payment or accounting mismatch is suspected.
2. Capture the work-order ID, transaction hashes, block heights and the
   reconciliation diff. Do not paste keys, signed URLs or private evidence into
   tickets or chat.
3. Compare hub contract state (authoritative) with Postgres and the Intent
   record. Never "fix" the chain state by editing Postgres.
4. For Intents: poll the documented status endpoint again; if still ambiguous,
   mark `PENDING` and escalate. A refund is a distinct outcome, not a success.
5. For duplicate payment: do not issue compensating transactions from an agent.
   Escalate to the human steward/DAO resolution path and record a dispute.
6. Update the read model by re-indexing events; if the rebuild disagrees with the
   hub, stop and escalate.
7. Write an audit event with the sanitised diff and link it to the work order.
8. Only a human may resume payments after resolution.

## What must never be logged

- API keys/JWTs/private or function-call keys, seed phrases
- Raw or signed evidence URLs, media bytes, precise coordinates
- Reporter case links and unredacted descriptions
- Full unrevealed bids

Log record IDs, redacted hashes, amounts, status strings and transaction hashes
only.

# MEND hub indexer (`services/indexer`)

Consumes hub `EVENT_JSON` events into the Postgres read model and can rebuild the
public read model from an empty database.

## Run

```bash
npm run typecheck
npm test

# one replay pass using the in-memory repository
npx tsx src/main.ts

# one pass against Postgres (runs migrations first)
DATABASE_URL=postgres://... npx tsx src/main.ts

# wipe the public read model and replay from the beginning
DATABASE_URL=postgres://... INDEXER_REBUILD=true npx tsx src/main.ts
```

`INDEXER_SOURCE=replay` (default) uses the deterministic recorded lifecycle
fixture. `INDEXER_SOURCE=live-rpc` selects the live adapter, which currently
reports `UNAVAILABLE` with a reason: NEAR JSON-RPC has no generic
"all contract logs since cursor" feed, and no endpoint is invented. A live
adapter needs a deployed hub plus block-range/receipt-log crawling.

## Guarantees

- **Idempotent:** every event has a content hash. The key is inserted in the
  same transaction that applies the event. Replayed events are counted as
  skipped and never double-apply.
- **Cursor-based:** the source cursor is stored in `indexer_cursors`. A crash
  leaves both the cursor and the uncommitted event rolled back.
- **Rebuildable:** `HubIndexer.rebuild()` clears the public read model (not audit
  events, which are append-only) and replays the source. The public-state hash is
  identical across repeated rebuilds and across memory/Postgres.
- **Private data excluded:** public snapshots contain no precise locations,
  private media keys, signed URLs or audit history.
- **No fabricated events:** an unavailable source throws
  `UPSTREAM_UNAVAILABLE`; the CLI prints `status: "unavailable"` and changes no
  state.

> **Operational note:** a read-model rebuild clears hub-derived rows including
> `evidence_packages` metadata. Private blobs in the evidence store are not
> deleted, but their database mapping is. On a deployment with live private
> evidence, take a metadata backup before rebuilding or restore the mappings
> afterwards. Audit events always survive.

## Event payloads used by the replay fixture

Events follow `packages/protocol/src/events.ts`. The replay stream includes full
read-model snapshots inside `data` (`asset`, `cluster`, `daoApproval`,
`workOrder`, `commitment`, `reveal`, `score`, `attestation`, `evidence`,
`inspection`, `payment`, `escrow`, `warranty`). The applier also supports
field-specific fallbacks (status, payment, passport token, dispute resolution)
for events without snapshots.

The fixture covers the complete lifecycle:

```text
work_order_created → policy_approved → work_order_funded → bidding_opened
→ bid_committed ×3 → bid_revealed ×3 → bidding_closed → score_recorded
→ work_order_awarded → work_started → completion_submitted
→ completion_accepted → payment_released → durability_inspection_recorded
→ durability_passed
```

Final canonical money (micro-USDC): funded 100, refunded 20, completion paid 72,
holdback released 8, remaining 0. Duplicate payment events update the same
payment ID instead of creating a second payout.

## Postgres test

With `DATABASE_URL`, the integration test creates a unique temporary schema,
runs migrations, rebuilds twice and compares the public-state hash with the
in-memory indexer. Without `DATABASE_URL` it is skipped and reported honestly.

# `@mend/db`

Repository contracts, SQL migrations, an in-memory implementation for tests and
the Postgres read model/private-data index.

Postgres is **not** the financial source of truth. The hub contract is. The API
must never use this package to decide that money moved; it stores what the chain
or a labelled replay produced.

## Migrations

`migrations/001_init.sql` is forward-only and creates every core record from
`PLAN.md` §3:

`assets`, `reports`, `report_private`, `report_clusters`, `dao_approvals`,
`work_orders`, `bid_commitments`, `bid_reveals`, `score_executions`,
`evidence_packages`, `evidence_objects`, `inspections`, `escrow_accounts`,
`payments`, `warranty_cases`, `agent_identities`, `attestations`,
`intent_quotes`, `intent_executions`, `audit_events`, plus indexer and API
support tables (`chain_commands`, `triage_suggestions`, `processed_events`,
`indexer_cursors`, `id_sequences`, `schema_migrations`).

Notable constraints:

- amounts are exact integer micro-units stored as text with digit checks;
- escrow cannot account for more than it received;
- successful chain commands must have a transaction hash;
- agents can never have `can_release_escrow = true`;
- evidence packages must be redacted;
- bid reveals reference their commits;
- foreign keys and unique keys protect history.

`audit_events` is append-only: a trigger rejects `UPDATE`, `DELETE` and
`TRUNCATE`. It is never cleared by demo reset or read-model rebuild.

`001_init.down.sql` is a **local-only manual teardown**, not used by production
tooling.

Run migrations:

```bash
DATABASE_URL=postgres://... npm run migrate
```

`runMigrations` records applied files in `schema_migrations`, wraps each file in
a transaction and uses a Postgres advisory lock.

## Repositories

`Repository` is the shared interface. Implementations:

- `MemoryRepository` — deep-cloned maps, snapshot/rollback transactions, used by
  tests and replay demos;
- `PgRepository` — parameterised SQL via `pg`, real transactions, same interface.

`nextSequence(name)` allocates human-readable IDs atomically. `clearDemoData()`
deletes only rows with `is_demo = true` and preserves audit history.
`clearReadModel()` deletes the complete public read model for an indexer rebuild
and also preserves audit history.

`stripUndefined()` normalises optional record fields so memory and Postgres
fingerprints are byte-identical.

## Tests

```bash
npm test
npm run typecheck
```

Without `DATABASE_URL`, the Postgres integration suite is skipped. With a
disposable database URL, it creates a unique temporary schema, runs migrations,
exercises CRUD/constraints/append-only audit/demo reset, then drops the schema.
Never point it at a database whose schema naming you do not control.

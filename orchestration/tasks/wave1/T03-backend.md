You are the visible Backend worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/backend (git branch track/backend). Do not ask questions; proceed.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (F01, F03, F09, F12, T03)
- /Volumes/sandisk/Users/dc/mend/packages/protocol/src/** and generated/openapi.json
- /Volumes/sandisk/Users/dc/mend/orchestration/decisions/HUB-INTERFACE.md
- /Volumes/sandisk/Users/dc/mend/orchestration/research/R0-A-near-ai.md, R0-C-intents.md, R0-E-near-platform.md (if missing, implement adapters with clearly labeled unavailable states)

SCOPE (only these paths):
- apps/api/** — Fastify 5 API and background jobs
- packages/db/** — migrations, repositories (in-memory + Postgres)
- services/indexer/** — hub event indexer/read-model rebuild
Do NOT edit apps/web, contracts, packages/ai-client, other packages, orchestration, root config.

REQUIREMENTS:
1. Fastify 5 + TypeScript strict + tsx dev. Config from env with safe defaults; no secrets committed.
2. Routes (prefix /v1 unless noted): `/health`, `/v1/modes`, assets CRUD, reports (walletless submission, reporter case link, EXIF-stripped redacted media hash, precise location stored privately), triage suggestions (adapter; label unavailable honestly), report clusters, work orders, bids (commitments public; reveals only after reveal), score, evidence (private signed access), inspections, payments, passport/history, verification artifacts, metrics, demo reset, intents quote/status proxy.
3. Authorization: demo role headers (`x-mend-role`, `x-mend-account`) validated against protocol roles; mutating endpoints enforce role matrix; tests hit every mutating endpoint with wrong roles. Document that production replaces headers with real signatures/JWT.
4. packages/db: SQL migrations for all core records in PLAN.md §3, append-only audit_events, constraints/indexes; repository interfaces; in-memory repo for tests; Postgres repo using `pg` (integration test skips cleanly if no DATABASE_URL). No hand-editing data needed for the vertical slice: seed/reset service.
5. Evidence service: private local disk adapter now, S3-compatible interface; signed time-limited access; public responses never contain private URLs or precise locations; on-chain record only redacted hash.
6. Chain command service: explicit transaction intents with states INTENT/PENDING/SUCCESS/FAILED; never show unsigned actions as executed; RPC failures remain pending/failed honestly. Use a mock/replay adapter when no signer/credentials.
7. Indexer: consume hub events (mock/replay source now, optional live RPC), rebuild Postgres read model from empty and produce identical public state; tests for replay/idempotency.
8. Demo reset: only designated demo data, repeatable identical initial state; no production reset route.
9. API error format `{ error: { code, message, details? } }` using protocol error codes/HTTP mapping.

ACCEPTANCE (run and paste real output):
```bash
cd apps/api && npm test && npm run typecheck
cd packages/db && npm test
cd services/indexer && npm test
```
Postgres-dependent tests may skip only when DATABASE_URL is absent; state the skip count honestly. No mainnet/deploy/push.

Commit on branch track/backend with message `feat(backend): API, read model, evidence service and indexer`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

You are the visible Backend worker for MEND (product completion). Working directory: /Volumes/sandisk/Users/dc/mend-wt/backend (branch track/backend). Do not ask questions; proceed.

FIRST: `git merge main --no-edit`. Main now has protocol commit `f2677db` with bid availability.

SCOPE: `apps/api/**` and, only if a persisted field is required, `packages/db/**`.

REQUIRED:
1. Add `availableInDays` to the bid reveal API input, persistence record, serializer/view and tests. It must match the protocol `BidRevealSchema`. Reject negative values and >365.
2. Add a real human kill switch:
   - `POST /v1/admin/kill-switch` `{enabled: boolean, reason: string}` — ADMIN role only.
   - `GET /v1/admin/kill-switch` — ADMIN/staff read.
   - When enabled, every mutating `/v1/*` route returns HTTP 423 with `CONTRACT_PAUSED` and a clear message; reads still work.
   - Emit append-only audit events `kill_switch_enabled` / `kill_switch_disabled` with actor and reason.
   - Also create an explicit chain command intent to pause/unpause the hub through the existing chain adapter (never claim it executed unless the adapter returns SUCCESS with a tx hash).
   - Tests: non-admin refused; enabled blocks mutations but not reads; disabled restores; audit events exist; chain intent honesty.
3. Keep all existing tests passing.

ACCEPTANCE (paste real output):
```bash
cd apps/api && npm test && npm run typecheck
```
If DATABASE_URL is available, also run the Postgres variant. No mainnet/deploy/push.

Commit on branch track/backend with message `feat(api): bid availability and human kill switch`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

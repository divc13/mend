You are the visible Frontend worker for MEND (product completion). Working directory: /Volumes/sandisk/Users/dc/mend-wt/frontend (branch track/frontend). Do not ask questions; proceed.

FIRST: `git merge main --no-edit`. Main now has protocol commit `f2677db` with bid availability.

SCOPE: only `apps/web/**`.

REQUIRED:
1. Add `availableInDays` to bid types and fixtures; show "Available in N days" in the bid room sealed/revealed tables and comparison, clearly labelled as committed bid data.
2. Ensure hidden bids still show no availability before reveal.
3. Add contractor/inspector history visibility on the asset passport page if missing: contractor account, inspector account, completed repairs, warranty reopenings, and "repair vs replacement" language derived from history. No invented data.
4. Keep REPLAY labeling and accessibility.
5. Build must pass.

ACCEPTANCE (paste real output):
```bash
cd apps/web && npm run build
```
No mainnet/deploy/push.

Commit on branch track/frontend with message `feat(web): bid availability and asset actor history`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

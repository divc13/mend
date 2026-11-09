You are the visible Agents & Fixtures worker for MEND (product completion). Working directory: /Volumes/sandisk/Users/dc/mend-wt/agents (branch track/agents). Do not ask questions; proceed.

FIRST: `git merge main --no-edit`. Main now has protocol commit `f2677db` with bid availability and extra D/E fixtures.

SCOPE:
- `services/contractor-agent/**`
- `fixtures/demo/reports-25.json`, `fixtures/demo/inspectors.json`
- `scripts/demo/generate-demo-reports.mjs` (new, deterministic)
Do NOT edit other services, apps, contracts, packages, docs, orchestration.

REQUIRED:
1. Update contractor strategies A/B/C with `availableInDays` (A 3, B 2, C 5) and keep the commitment hash matching protocol `MEND_BID_V2`.
2. Add strategies D and E using `FIXTURE_EXTRA_BID_INPUTS` and `FIXTURE_EXTRA_EXPLANATIONS` (five strategies total). Keep A/B/C as the canonical scoring scenario; D/E are additional demo strategies. Assert all five match protocol fixtures.
3. Generate `fixtures/demo/reports-25.json`: exactly 25 deterministic reports with IDs R-001..R-025, varied assets (BENCH-001, RACK-002, DOOR-003, FENCE-004, PLAY-005), descriptions, coarse public locations, redacted media hashes, perceptual hashes (some duplicates), reporter case links, statuses. Include duplicate clusters (at least 3 pairs) and at least one prompt-injection-looking report. Include `generated: true` and a version header. No precise locations, no private media, no real personal data.
4. Generate `fixtures/demo/inspectors.json` with the two canonical inspectors, their accounts, roles, and disclosure that self-hire tests are not independent reputation.
5. `scripts/demo/generate-demo-reports.mjs` must regenerate the 25-report file deterministically and validate count/IDs.
6. Tests: five strategies deterministic; D/E commitment hashes match protocol; reports file has exactly 25 unique IDs, schema-valid shapes, no private fields; inspectors file has two accounts.

ACCEPTANCE (paste real output):
```bash
cd services/contractor-agent && npm test && npm run typecheck
node scripts/demo/generate-demo-reports.mjs --check
```
No mainnet/deploy/push.

Commit on branch track/agents with message `feat(agents,demo): five strategies, 25 reports and two inspectors`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

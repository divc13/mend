You are the visible Backend Integration worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/backend (branch track/backend). Do not ask questions; proceed.

FIRST: sync to the merged main:
```bash
git merge main --no-edit
```
Main now contains contracts, packages/ai-client, packages/intents-client, agents, web, infra, docs. Re-run `npm install` at the repo root if needed.

GOAL: Replace the Wave-1 placeholder adapters in `apps/api` with the real merged clients, without inventing credentials or faking live results.

SCOPE: only `apps/api/**` (and its tests). Do not edit packages/clients, contracts, web, orchestration, docs.

REQUIREMENTS:
1. AI triage integration (`src/services/triage.ts`): use `@mend/ai-client` nearAiClient/duplicateEngine/scopeGenerator when `NEAR_AI_API_KEY` is configured; strict schema validation; store request/response hashes; if no key, keep deterministic duplicate heuristics and mark `available:false` with an honest reason. Never mark AI output verified without attestation/signature evidence; add a `verification` artifact with `VERIFIED | UNAVAILABLE` states.
2. Intents integration (`src/services/intents.ts`): use `@mend/intents-client` for capabilities, dry quote and status. Enable dry quotes when `INTENTS_ENABLED=true`; live/mainnet execution remains disabled unless `INTENTS_ALLOW_LIVE=true` and an explicit human-confirmation flag is supplied. Preserve the mainnet-only label. No signing/transfer.
3. Update `/health` capability output to reflect the real wiring and the current research (remove the stale "R0-C not available" reason).
4. Add tests proving: (a) no key → honest unavailable, no invented confidence; (b) mocked AI client → schema-validated suggestion + verification artifact; (c) dry quote via mocked Intents client → labeled preview, no deposit address presented as payment; (d) live request without confirmation → refused; (e) no secret ever serialized in responses.
5. Run the full API suite with and without Postgres if available. Do not weaken existing tests.

ACCEPTANCE (paste real output):
```bash
cd apps/api && npm test && npm run typecheck
# optional with DATABASE_URL set: npm test
```
No mainnet, no deploy, no push.

Commit on branch track/backend with message `feat(api): wire real AI and Intents clients with honest unavailable states`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

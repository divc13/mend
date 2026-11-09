You are the visible Backend Guard-fix worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/backend (branch track/backend). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and `npm install` at the repo root if needed. Main now includes the quality suite `tests/security/runtime-guard-wiring.test.ts`.

PROBLEM (real failing test, do not dismiss):
`tests/security/runtime-guard-wiring.test.ts` fails: apps/api does not reference `guardUntrustedText`/`scanPromptInjection`/`enforceTrustedAction`, and `services/triage.ts` still contains `description: input.report.description`. The triage path must treat report text as untrusted data and make an injection attempt visible in the security log.

SCOPE: only `apps/api/**`. Do not edit tests, packages, contracts, web, docs, orchestration.

REQUIRED FIX:
1. In `apps/api/src/services/triage.ts`, import `scanPromptInjection` and `sanitizeUntrustedText` from `@mend/ai-client`.
2. Sanitize the report description before any prompt/scope call; never interpolate the raw description. Remove the exact pattern `description: input.report.description`.
3. Scan the untrusted text; include `injectionScan` (detected, categories, matches) in `TriageResult`.
4. In `apps/api/src/routes/reports.ts` (triage route), if `injectionScan.detected`, emit an append-only audit event named `prompt_injection_blocked` with `{ reportId, categories, action: 'treated-as-untrusted-data' }`. The request may still return a classification, but the attack must be visible and must not change recipient, role, scope hash, payout rule or acceptance.
5. Add an API test proving: malicious report text → `prompt_injection_blocked` audit event exists; response contains no attacker recipient/role/acceptance change; output still schema-valid.
6. Keep all existing tests passing. No weakening.

ACCEPTANCE (paste real output):
```bash
cd apps/api && npm test && npm run typecheck
```
Also confirm:
```bash
grep -rn "scanPromptInjection\|sanitizeUntrustedText" apps/api/src
grep -n "description: input.report.description" apps/api/src/services/triage.ts || echo NO_RAW_INTERPOLATION
```
No mainnet, no deploy, no push.

Commit on branch track/backend with message `fix(api): guard untrusted triage text and log prompt-injection attempts`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

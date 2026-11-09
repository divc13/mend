You are the visible Quality & Security worker for MEND (Wave 2/3). Working directory: /Volumes/sandisk/Users/dc/mend-wt/quality (git branch track/quality). Do not ask questions; proceed.

FIRST STEP — sync your worktree to the merged foundation:
```bash
git merge main --no-edit   # main has contracts/, compute/, packages/, infra/, docs/RULES.md; apps may still be in progress
```
Then read the files below. Do not edit anything outside your scope.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (T07, scenarios A–E, final completion standard)
- packages/protocol, docs/RULES.md, orchestration/decisions/HUB-INTERFACE.md, orchestration/research/*
- Existing apps/contracts once merged (this worktree starts from the foundation commit; fetch/rebase from main before starting if the orchestrator has merged tracks — check `git log --all`).

SCOPE (only these paths):
- tests/integration/**
- tests/e2e/**
- tests/security/**
- tests/clean-room/**
- fixtures/attacks/**
- playwright.config.ts, test package configs inside tests/**
Do NOT edit app/contract/service source. If a test finds a bug, report it; do not patch another track.

REQUIREMENTS:
1. Contract adversarial suite: self-approval, contractor self-inspection, inspector self-award, replay/double payment, wrong token, stale score, wrong policy, early/late reveal, pause bypass, passport transfer, warranty no-new-funds. (If Rust tests already cover some, add independent black-box tests where practical; otherwise document coverage mapping with exact test names.)
2. Prompt-injection suite: malicious instructions in report text, evidence package, bid explanation and Agent Market brief. Required: no recipient/role/scope/payment-rule change, no signature, attack visible in security log.
3. Privacy suite: scan browser bundles for secrets; check API responses/logs/DB fields/object ACLs/chain state for precise location, raw media URLs, private evidence; assert only redacted hashes on-chain/public.
4. API authorization matrix: every mutating endpoint × every role, including AI roles, contractor, inspector, steward, DAO, relayer.
5. E2E happy path: canonical 100/80/72/8 scenario through API/UI or API + contract replay.
6. E2E alternatives: failed durability, remediation, dispute, cancellation, refund, failed Intents status, dry quote never shown as payment.
7. UX: Playwright + axe accessibility, keyboard-only, mobile viewport, mode banner unmistakable.
8. Clean-room: from a fresh clone/worktree, follow only README to reach REPLAY demo; no undocumented manual step.
9. Tests must run in CI with clear PASS/FAIL/SKIP; no fake results. Use the API/UI only when available; skip with explicit reason otherwise.

ACCEPTANCE (run and paste real output):
```bash
npx playwright test --list
# plus each suite you can run; report pass/fail/skip counts honestly
```
No mainnet, no deploy, no push.

Commit on branch track/quality with message `test(quality): adversarial, privacy, authorization, e2e and clean-room suites`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

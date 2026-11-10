# MEND quality & security suites (T07)

Independent, black-box-first suites for `tests/**`. They are owned by the
Quality track and do not import application internals beyond the public package
entry points.

## Suites

| Path | Requirement | Current status |
|---|---|---|
| `tests/integration/contract-adversarial.test.ts` | T07.1 attack coverage map + `cargo test` | yes (cargo) |
| `tests/integration/contract-adversarial/` | independent public-API Rust attacks | yes (cargo) |
| `tests/integration/canonical-scenario.test.ts` | T07.5 exact 100/80/72/8 replay | yes |
| `tests/integration/intents-uncertainty.test.ts` | T07.6 Intents dry/status/failure | yes |
| `tests/security/prompt-injection.test.ts` | T07.2 report/evidence/bid/market brief | yes (one live-log test skips) |
| `tests/security/privacy.test.ts` | T07.3 bundle/log/DB/ACL/chain privacy | yes (bundle + live-API tests skip without the stack) |
| `tests/security/authorization-matrix.test.ts` | T07.4 every mutation × every role | yes (live-API matrix skips without the stack) |
| `tests/e2e/*.spec.ts` | T07.5–T07.7 UI/API + contract replay | 32 passed, 8 honest API-state skips |
| `tests/clean-room/clean-room.test.ts` | T07.8 README → REPLAY | 8 passed; `npm ci` from a fresh worktree passes |
| `tests/clean-room/run.sh` | fresh worktree clean-room runner | `--static` yes, `--full` needs the local stack |
| `tests/live/*` | real testnet RPC/API/UI checks | 10 Node checks + 2 Playwright UI checks pass; one wallet-creation sub-check BLOCKED by the public faucet |

## Install and run

```bash
# one-time, from the repository root
npm ci --prefix tests

# all Vitest suites (integration + security + clean-room)
npm --prefix tests test

# individual suites
npm --prefix tests run test:integration
npm --prefix tests run test:security
npm --prefix tests run test:clean-room
npm --prefix tests run test:contract      # independent Rust crate

# Playwright (tests package owns @playwright/test)
npm --prefix tests run test:e2e
npm --prefix tests run test:e2e:list

# or from the repository root when the binary is resolvable:
npx playwright test --list
npx playwright test
```

`npx playwright test` at the repository root requires `@playwright/test` to be
visible from the root. In this worktree it was installed as a local
(non-committed) dependency/symlink. On a clean clone use the `npm --prefix
tests` commands, or add `@playwright/test` and `@axe-core/playwright` to the
root `devDependencies` (orchestrator/infra change).

The local stack is **not** started automatically. Start it first with:

```bash
bash scripts/dev.sh
# optional overrides
MEND_WEB_URL=http://localhost:3000 MEND_API_URL=http://localhost:4000 npx playwright test
```

## CI

`bash tests/ci.sh` prints a PASS/FAIL/SKIP table with exact reasons and exits
non-zero if any suite fails. It remains the intended local CI entry point.

The GitHub workflow (`.github/workflows/ci.yml`) now installs the test package,
installs Chromium and runs the suites. The first GitHub Actions run **failed**
and a follow-up run was in progress at the time of writing, so green CI is not
claimed.

No suite is allowed to fake a result:

- API/UI tests call `test.skip(..., '<exact reason>')` when the app is absent.
- Clean-room failures are real failures, not skips, when a documented
  prerequisite is broken.
- No mainnet call, deploy, signature or push is performed.

## Current status and residual gaps

The blockers previously recorded here are resolved:

1. `npm ci` succeeds at the repository root from the committed lockfile.
2. Root `README.md` exists and documents the REPLAY path.
3. `apps/api`, `apps/web` and `services/*` are merged; E2E passes 32 checks.
4. The runtime prompt-injection guard is wired into the API; the security-log
   integration test passes.

What remains:

1. CI must actually pass. The repository is pushed to a private GitHub repo; the
   first GitHub Actions run failed and a follow-up was in progress at the time of
   writing. CI is **not green**.
2. Live suites require the testnet API and keys outside the repo; they are not
   part of a default clean clone.
3. Live NEAR AI, Sputnik DAO, Intents deposit, OutLayer execution, NEP-366
   relayer and Agent Market job evidence still requires human-supplied
   credentials/funds. See [`STATUS.md`](../STATUS.md).

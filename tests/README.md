# MEND quality & security suites (T07)

Independent, black-box-first suites for `tests/**`. They are owned by the
Quality track and do not import application internals beyond the public package
entry points.

## Suites

| Path | Requirement | Runs now |
|---|---|---|
| `tests/integration/contract-adversarial.test.ts` | T07.1 attack coverage map + `cargo test` | yes (cargo) |
| `tests/integration/contract-adversarial/` | independent public-API Rust attacks | yes (cargo) |
| `tests/integration/canonical-scenario.test.ts` | T07.5 exact 100/80/72/8 replay | yes |
| `tests/integration/intents-uncertainty.test.ts` | T07.6 Intents dry/status/failure | yes |
| `tests/security/prompt-injection.test.ts` | T07.2 report/evidence/bid/market brief | yes (one live-log test skips) |
| `tests/security/privacy.test.ts` | T07.3 bundle/log/DB/ACL/chain privacy | yes (bundle + live-API tests skip) |
| `tests/security/authorization-matrix.test.ts` | T07.4 every mutation × every role | yes (live-API matrix skips) |
| `tests/e2e/*.spec.ts` | T07.5–T07.7 UI/API + contract replay | contract/replay passes; UI/API skip |
| `tests/clean-room/clean-room.test.ts` | T07.8 README → REPLAY | static checks pass; README/`npm ci` blockers reported |
| `tests/clean-room/run.sh` | fresh worktree clean-room runner | `--static` yes, `--full` needs web |

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
non-zero if any suite fails. It is the intended CI entry point.

The existing `.github/workflows/ci.yml` (infra-owned) does not yet install the
test package or call `tests/ci.sh`. The required CI steps are:

```yaml
- run: npm ci --prefix tests
- run: npx --prefix tests playwright install --with-deps chromium
- run: bash tests/ci.sh
```

No suite is allowed to fake a result:

- API/UI tests call `test.skip(..., '<exact reason>')` when the app is absent.
- Clean-room failures are real failures, not skips, when a documented
  prerequisite is broken.
- No mainnet call, deploy, signature or push is performed.

## Current blockers found by these suites

1. `npm ci` fails at the repository root because `package-lock.json` is out of
   sync with the merged `@mend/ai-client` workspace. This breaks a clean clone.
2. Root `README.md` does not exist yet, so the documented REPLAY path cannot be
   exercised end-to-end.
3. `apps/api`, `apps/web` and `services/*` are not merged in this worktree; the
   live authorization/privacy/UX matrices skip with explicit reasons.
4. The merged `@mend/ai-client` exports `scanPromptInjection` and
   `enforceTrustedAction`, but no runtime service calls them yet, so the
   security-log integration test skips until a service lands.

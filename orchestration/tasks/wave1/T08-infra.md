You are the visible Infrastructure worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/infra (git branch track/infra). Do not ask questions; proceed.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (F13, F14, T08)
- /Volumes/sandisk/Users/dc/mend/package.json and worktree layout

SCOPE (only these paths):
- infra/** — docker compose, Dockerfiles, deployment scripts, observability config, docs
- .github/** — CI workflows
- scripts/** — developer/verification scripts (do not edit root package.json)
Do NOT edit apps/, packages/, contracts/, services/, orchestration/, docs/, root package.json.

REQUIREMENTS:
1. `infra/docker-compose.yml`: Postgres 16, MinIO (private evidence), API, web, indexer, with healthchecks, volumes, env separation. Use build contexts pointing at the repo root and Dockerfiles under infra/docker/. No secrets in files; env via `.env`.
2. `infra/env.example`: every required env var with safe local defaults; clearly marks which need human credentials (NEAR AI, OutLayer, Agent Market, DAO, RPC, mainnet).
3. Dockerfiles for API and web that work with npm workspaces (Node 22/26, multi-stage or tsx runtime), non-root user.
4. One-command local dev: `scripts/dev.sh` (compose up, wait for health, seed/demo reset, print URLs). Robust on macOS/Linux, `set -euo pipefail`.
5. One-command verification: `scripts/verify.sh` runs formatting/lint if present, typecheck, protocol tests, API tests, contract cargo tests + wasm builds when toolchain exists, and prints a clear PASS/FAIL/SKIP table. It must not hide failures.
6. CI workflow: npm ci, typecheck, protocol/API/agent tests, cargo test, wasm builds, secret scan, dependency audit (non-blocking only for known dev-only advisories, with explicit note). Cache npm and cargo.
7. Testnet deployment runbook + scripts (account creation, deploy token/hub, init, roles) that are idempotent and refuse mainnet by default. Do not run them.
8. Observability: structured log config guidance, health endpoints, transaction reconciliation alert rules/checklist; never log secrets or private evidence.
9. Demo replay packaging script that copies versioned fixtures/artifacts into a release bundle.
10. Keep docs inside infra/; do not write docs/.

ACCEPTANCE (run and paste real output):
```bash
docker compose -f infra/docker-compose.yml config >/dev/null && echo COMPOSE_OK
bash -n scripts/dev.sh && bash -n scripts/verify.sh && echo SCRIPTS_OK
# If Docker daemon available, optionally: docker compose -f infra/docker-compose.yml build api
```
All configs must validate. No deployment, no push.

Commit on branch track/infra with message `feat(infra): local stack, CI, deploy runbook and verification scripts`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

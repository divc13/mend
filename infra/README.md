# MEND infrastructure (T08)

Local stack, container images, CI, testnet deployment and observability for the
MEND monorepo. This directory is owned by the infrastructure track.

## Quick start

```bash
# From the repository root
bash scripts/dev.sh
```

That command:

1. copies `infra/env.example` to `infra/.env` if missing,
2. builds and starts Postgres 16, MinIO (private evidence), API, indexer, web,
3. waits for healthchecks,
4. calls the demo reset endpoint (or reports that it is not implemented yet),
5. prints URLs and the active mode label.

Useful variants:

```bash
bash scripts/dev.sh --fresh      # remove local volumes, start clean, reseed
bash scripts/dev.sh --no-build   # reuse images
bash scripts/dev.sh --no-seed    # do not reset demo data
bash scripts/dev.sh --down       # stop, keep volumes
```

Requirements: Docker with Compose v2 (or `docker-compose`), `curl`. Works on
macOS and Linux.

## Services and ports

| Service | Port | Purpose |
|---|---|---|
| `postgres` | 5432 | Read model, private index, audit events |
| `minio` | 9000 / 9001 | Private evidence/artefact object storage + console |
| `api` | 4000 | Fastify API, `/health` and `/health/ready` |
| `indexer` | 4100 | Hub event indexer, `/health` |
| `web` | 3000 | Next.js UI |

All services run on the `mend-local` bridge network. Data lives in named volumes
`pgdata`, `miniodata` and `workspace_node_modules`.

The MinIO init job creates two **private** buckets (`mend-evidence`,
`mend-artifacts`), disables anonymous access and enables object versioning.
Evidence is served only through short-lived signed URLs.

## Configuration and secrets

- Template: `infra/env.example` — every variable with a safe local default.
- Runtime file: `infra/.env` — gitignored, created by `scripts/dev.sh`.
- Markers in the template: `[LOCAL]`, `[HUMAN]`, `[OPTIONAL]`, `[MAINNET]`.
- Human credentials (NEAR AI, OutLayer, Agent Market, DAO, keyed RPC, mainnet)
  are blank and must be supplied by a human. Never commit them.
- `MEND_MODE` defaults to `REPLAY`; the UI must render `REPLAY / SIMULATION`
  whenever this is set. `MAINNET` is never enabled by agent work.

Compose validates with **no** `.env` present because every value has a default.
No secret is stored in `infra/docker-compose.yml`.

## Container images

| Image | Dockerfile | User | Notes |
|---|---|---|---|
| API/worker | `infra/docker/api.Dockerfile` | non-root `node` (uid 1000) | `dev` target for bind-mounted local dev, `runtime` for production |
| Web | `infra/docker/web.Dockerfile` | non-root `node` (uid 1000) | Next.js workspace build/start |

Both use the repository root as build context so npm workspaces resolve, Node 22
by default (`NODE_VERSION=26` opts in to Node 26), and `dumb-init` for signal
handling. The selected workspace is controlled by `MEND_WORKSPACE` /
`MEND_APP_DIR`.

Build manually:

```bash
docker build -f infra/docker/api.Dockerfile --target dev \
  --build-arg MEND_WORKSPACE=@mend/api --build-arg MEND_APP_DIR=apps/api \
  -t mend-api:local .
```

> **Integration item:** the root `.dockerignore` is owned by the orchestrator.
> Copy `infra/docker/dockerignore.template` to the repository root before
> building images. Without it, `node_modules` and local `.env` files enter the
> build context.

## Verification

```bash
bash scripts/verify.sh
```

Runs, when available: formatting, lint, typecheck, protocol tests, API tests,
agent/service tests, E2E, contract cargo tests, WASM builds, secret scan, Compose
config validation, shell syntax and dependency audit. Prints a PASS/FAIL/SKIP
table with exact reasons; failing output is printed and the exit code is non-zero.
`SKIP` is never used to hide a failure.

Helper scripts:

- `scripts/secret-scan.sh` — dependency-free credential scan.
- `scripts/package-replay.sh` — build a versioned offline replay bundle with a
  SHA-256 manifest.
- `scripts/deploy-testnet.sh` — idempotent testnet deployment (refuses mainnet).

## CI

`.github/workflows/ci.yml` runs on push/PR:

- secret scan;
- Node 22: `npm ci`, formatting, lint, typecheck, protocol/API/agent/E2E tests,
  Compose config, shell syntax;
- Rust: cargo tests + release WASM build when `contracts/Cargo.toml` exists;
- dependency audit: production audit is blocking; high/critical advisories in
  dev-only dependencies are non-blocking with an explicit note (the production
  audit must pass first).

npm and Cargo caches are enabled. Contracts steps print a skip notice when the
workspace is not present, so a partial monorepo is not silently reported green.

## Deployment

- Testnet runbook: [`docs/TESTNET_DEPLOY.md`](docs/TESTNET_DEPLOY.md)
- Script: `scripts/deploy-testnet.sh` (`accounts`, `token`, `hub`, `init`,
  `roles`, `verify`, `all`; `--dry-run`; refuses mainnet by default).

Hosted environments reuse the same images and environment contract, with:

- managed Postgres and private S3-compatible storage,
- `MEND_MODE=LIVE_TESTNET` (or `MAINNET` only under human control),
- JSON logs (`LOG_FORMAT=json`) and health probes from
  [`observability/health-endpoints.md`](observability/health-endpoints.md),
- separate credentials per environment; never share local defaults.

## Observability

See [`observability/`](observability/):

- structured log schema and forbidden fields,
- health/readiness contract,
- transaction reconciliation alerts, daily checklist and investigation runbook,
- Prometheus rules in `observability/alerts/`.

Never log secrets or private evidence. Log redacted hashes and record IDs.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker compose config` fails | Check `infra/.env` for malformed values; the stack validates without it too. |
| API unhealthy | `docker compose -f infra/docker-compose.yml logs api`; check `/health/ready`. |
| Web unhealthy | Confirm the frontend workspace/scripts exist and port 3000 is free. |
| Indexer unhealthy | Confirm `services/indexer` exposes `/health` and port 4100. |
| MinIO buckets missing | Check `docker compose ... logs minio-init`; rerun `up -d minio-init`. |
| Seed skipped | The demo reset endpoint is not implemented yet or returned 404; see the warning. |
| Ports already in use | Override `POSTGRES_PORT`, `API_PORT`, `INDEXER_PORT`, `WEB_PORT`, `MINIO_PORT` in `infra/.env`. |

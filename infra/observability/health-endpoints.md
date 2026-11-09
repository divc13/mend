# Health endpoints

Every long-running service exposes health endpoints on its configured port. The
Docker Compose healthchecks and the deployment verification script depend on
these exact paths.

## API (`apps/api`, default port 4000)

| Path | Purpose | Success | Failure |
|---|---|---|---|
| `GET /health` | Liveness. Process is running and can serve HTTP. | `200` `{"status":"ok"}` | no response / non-2xx |
| `GET /health/ready` | Readiness. DB pool acquired and migrations current; object store reachable. | `200` `{"status":"ready","checks":{...}}` | `503` with failing checks |
| `GET /health/deps` | Detailed dependency states (no secrets). | `200` or `503` | `503` |
| `GET /metrics` | Prometheus metrics (hosted only; protect or bind internally). | `200` text | — |

`/health/ready` must report, without leaking values:

```json
{
  "status": "ready",
  "checks": {
    "postgres": "ok",
    "objectStore": "ok",
    "indexer": "ok",
    "rpc": "degraded"
  }
}
```

- A degraded RPC does not make the API unready by itself; it must be visible.
- Missing human credentials (NEAR AI, OutLayer, Agent Market) are reported as
  `unavailable`, not `ok` and not `failed`. Their features must show an honest
  "verification unavailable" state.
- Never include DSNs, bucket names with credentials, API keys or signed URLs.

## Indexer (`services/indexer`, default port 4100)

- `GET /health` — liveness.
- `GET /health/ready` — database reachable and last processed block is within
  the configured lag threshold (`INDEXER_MAX_LAG_BLOCKS`, default 50).

## Web (`apps/web`, default port 3000)

- `GET /` must return `200` when the app renders.
- If a dedicated route exists, `GET /api/health` is preferred for container
  healthchecks. The compose healthcheck currently probes `/`.

## Workers / agents

Scheduled workers and agents expose `GET /health` on `WORKER_PORT` when they run
as services. One-shot jobs exit non-zero on failure so Compose/CI can detect it.

## Compose usage

`infra/docker-compose.yml` probes:

- Postgres with `pg_isready`
- MinIO with `/minio/health/live`
- API/Indexer with `node -e "fetch(...)"` against `/health`
- Web with `node -e "fetch(...)"` against `/`

`scripts/dev.sh` waits for these checks before seeding demo data.

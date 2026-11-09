#!/usr/bin/env bash
# MEND one-command local development (T08.1).
#
#   bash scripts/dev.sh                 start (or update) the stack, wait, seed
#   bash scripts/dev.sh --fresh         destroy local volumes, start clean, seed
#   bash scripts/dev.sh --no-build      reuse existing images
#   bash scripts/dev.sh --no-seed       do not call the demo reset endpoint
#   bash scripts/dev.sh --down          stop the stack (keeps volumes)
#
# Requirements: Docker with the Compose plugin (or docker-compose), curl.
# Works on macOS (bash 3.2) and Linux. No secrets are read from this script;
# configuration lives in infra/.env, which is created from infra/env.example.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
TEMPLATE_ENV="$ROOT_DIR/infra/env.example"
RUNTIME_ENV="$ROOT_DIR/infra/.env"
WAIT_TIMEOUT="${MEND_DEV_WAIT_SECONDS:-300}"
WAIT_SERVICES="${MEND_DEV_WAIT_SERVICES:-postgres minio api indexer web}"

DO_BUILD=1
DO_SEED=1
DO_FRESH=0
DO_DOWN=0

log() { printf '[dev] %s\n' "$*"; }
warn() { printf '[dev] WARN: %s\n' "$*" >&2; }
die() { printf '[dev] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
MEND one-command local development.

  bash scripts/dev.sh                 start (or update) the stack, wait, seed
  bash scripts/dev.sh --fresh         destroy local volumes, start clean, seed
  bash scripts/dev.sh --no-build      reuse existing images
  bash scripts/dev.sh --no-seed       do not call the demo reset endpoint
  bash scripts/dev.sh --down          stop the stack (keeps volumes)

Requirements: Docker with the Compose plugin (or docker-compose), curl.
Works on macOS (bash 3.2) and Linux. Configuration lives in infra/.env, created
from infra/env.example. No secrets are stored in this script.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --fresh) DO_FRESH=1 ;;
    --no-build) DO_BUILD=0 ;;
    --no-seed) DO_SEED=0 ;;
    --down) DO_DOWN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

command -v docker >/dev/null 2>&1 || die "docker is not installed"
docker info >/dev/null 2>&1 || die "Docker daemon is not running"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose -f "$COMPOSE_FILE")
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose -f "$COMPOSE_FILE")
else
  die "Docker Compose is not installed (need 'docker compose' or 'docker-compose')"
fi

compose() {
  "${COMPOSE[@]}" "$@"
}

if [ ! -f "$RUNTIME_ENV" ]; then
  [ -f "$TEMPLATE_ENV" ] || die "missing template: $TEMPLATE_ENV"
  cp "$TEMPLATE_ENV" "$RUNTIME_ENV"
  chmod 600 "$RUNTIME_ENV"
  log "created infra/.env from infra/env.example (edit it to add human credentials)"
fi

# Read a single value from infra/.env without exporting the whole file.
env_value() {
  key="$1"
  fallback="$2"
  value="$(grep -E "^${key}=" "$RUNTIME_ENV" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  if [ -n "$value" ]; then
    printf '%s' "$value"
  else
    printf '%s' "$fallback"
  fi
}

if [ "$DO_DOWN" -eq 1 ]; then
  log "stopping the stack (volumes are kept)"
  compose down --remove-orphans
  exit 0
fi

if [ "$DO_FRESH" -eq 1 ]; then
  log "fresh start: removing local volumes"
  compose down --volumes --remove-orphans
fi

if [ "$DO_BUILD" -eq 1 ]; then
  log "building images"
  compose build
else
  log "skipping image build (--no-build)"
fi

log "starting services"
compose up -d --remove-orphans

fail_with_logs() {
  service="$1"
  printf '\n[dev] last logs for %s:\n' "$service" >&2
  compose logs --tail=80 "$service" >&2 || true
  die "service did not become healthy: $service"
}

wait_service() {
  service="$1"
  deadline=$((SECONDS + WAIT_TIMEOUT))
  printf '[dev] waiting for %s' "$service"
  while [ "$SECONDS" -lt "$deadline" ]; do
    container_id="$(compose ps -q "$service" 2>/dev/null | head -n 1 || true)"
    if [ -n "$container_id" ]; then
      state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || echo unknown)"
      case "$state" in
        healthy|running)
          printf ' [%s]\n' "$state"
          return 0
          ;;
        exited|dead)
          printf ' [%s]\n' "$state"
          fail_with_logs "$service"
          ;;
      esac
    fi
    printf '.'
    sleep 3
  done
  printf ' [timeout after %ss]\n' "$WAIT_TIMEOUT"
  fail_with_logs "$service"
}

for service in $WAIT_SERVICES; do
  wait_service "$service"
done

# The one-shot bucket initialiser must have exited successfully.
init_state="$(docker inspect -f '{{.State.Status}}/{{.State.ExitCode}}' "$(compose ps -a -q minio-init 2>/dev/null | head -n 1)" 2>/dev/null || echo missing)"
case "$init_state" in
  exited/0) log "private MinIO buckets initialised" ;;
  *) warn "minio-init state is '$init_state'; private evidence buckets may be missing" ;;
esac

API_BASE_LOCAL="http://localhost:$(env_value API_PORT 4000)"
WEB_BASE_LOCAL="http://localhost:$(env_value WEB_PORT 3000)"
MINIO_CONSOLE_LOCAL="http://localhost:$(env_value MINIO_CONSOLE_PORT 9001)"
MODE="$(env_value MEND_MODE REPLAY)"
RESET_TOKEN="$(env_value DEMO_RESET_TOKEN local-demo-reset-token)"

seed_demo() {
  if ! command -v curl >/dev/null 2>&1; then
    warn "curl not found; skipping demo reset"
    return 0
  fi

  if ! curl -fsS "$API_BASE_LOCAL/health" >/dev/null 2>&1; then
    warn "API /health is not reachable at $API_BASE_LOCAL; skipping demo reset"
    return 0
  fi

  body_file="$(mktemp "${TMPDIR:-/tmp}/mend-seed.XXXXXX")"
  code="$(curl -sS -o "$body_file" -w '%{http_code}' \
    -X POST \
    -H "content-type: application/json" \
    -H "x-demo-reset-token: $RESET_TOKEN" \
    -d "{\"mode\":\"$MODE\",\"seed\":\"canonical\"}" \
    "$API_BASE_LOCAL/api/demo/reset" 2>/dev/null || true)"

  case "$code" in
    2*)
      log "demo data reset and seeded (HTTP $code)"
      ;;
    401|403)
      rm -f "$body_file"
      die "demo reset rejected (HTTP $code); check DEMO_RESET_TOKEN in infra/.env"
      ;;
    404|405|501)
      rm -f "$body_file"
      warn "demo reset endpoint not available yet (HTTP $code); continuing without seed"
      ;;
    *)
      warn "demo reset failed (HTTP ${code:-none}); response:"
      cat "$body_file" >&2 || true
      rm -f "$body_file"
      return 1
      ;;
  esac
  rm -f "$body_file"
  return 0
}

if [ "$DO_SEED" -eq 1 ]; then
  seed_demo || die "demo reset failed"
else
  log "skipping demo reset (--no-seed)"
fi

case "$MODE" in
  REPLAY)
    MODE_LABEL="REPLAY / SIMULATION — no live transactions"
    ;;
  LIVE_TESTNET)
    MODE_LABEL="LIVE TESTNET — TEST VALUE ONLY"
    ;;
  MAINNET)
    MODE_LABEL="MAINNET — REAL FUNDS (requires separate human approval per transaction)"
    warn "MEND_MODE=MAINNET. The local stack must never sign mainnet transactions."
    ;;
  *)
    MODE_LABEL="$MODE"
    ;;
esac

cat <<EOF

MEND local stack is ready.

  Mode:              $MODE_LABEL
  Web:               $WEB_BASE_LOCAL
  API:               $API_BASE_LOCAL  (health: $API_BASE_LOCAL/health)
  Indexer:           http://localhost:$(env_value INDEXER_PORT 4100)  (health: /health)
  MinIO console:     $MINIO_CONSOLE_LOCAL  (private evidence bucket; local creds in infra/.env)
  Postgres:          localhost:$(env_value POSTGRES_PORT 5432)  (DSN: DATABASE_URL_HOST in infra/.env)

Next:
  bash scripts/verify.sh
  docker compose -f infra/docker-compose.yml logs -f
  bash scripts/dev.sh --fresh    # deterministic reset
  bash scripts/dev.sh --down     # stop, keep volumes

EOF

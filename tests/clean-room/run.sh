#!/usr/bin/env bash
# T07.8 clean-room runner.
#
# Modes:
#   --static (default)  create a detached worktree at HEAD and prove the
#                       documented files exist without local state. Does not
#                       start containers.
#   --full              also follow the README quick start (npm ci + local
#                       stack) and require the REPLAY banner at the web URL.
#
# The runner never pushes, never touches mainnet and never writes to the
# developer's checkout. It prints PASS / FAIL / SKIP with an exact reason.
set -uo pipefail

MODE="static"
BASE_DIR="${TMPDIR:-/tmp}"
KEEP=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --static) MODE="static" ;;
    --full) MODE="full" ;;
    --keep) KEEP=1 ;;
    --worktree-root)
      shift
      BASE_DIR="${1:?--worktree-root requires a directory}"
      ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
  shift
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 2

if ! command -v git >/dev/null 2>&1; then
  printf 'CLEAN-ROOM SKIP: git is not installed\n'
  exit 0
fi

TMP_ROOT="$(mktemp -d "${BASE_DIR%/}/mend-cleanroom.XXXXXX")" || {
  printf 'CLEAN-ROOM FAIL: cannot create a temporary directory\n'
  exit 1
}
WORKTREE="$TMP_ROOT/repo"

cleanup() {
  if [ "$KEEP" = "1" ]; then
    printf 'clean-room worktree kept at %s\n' "$WORKTREE"
    return
  fi
  git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

printf '==> fresh worktree at HEAD (no local node_modules, .env or build output)\n'
if ! git -C "$REPO_ROOT" worktree add --detach "$WORKTREE" HEAD >/dev/null 2>&1; then
  printf 'CLEAN-ROOM FAIL: git worktree add failed\n'
  exit 1
fi

cd "$WORKTREE" || exit 1

if [ ! -f README.md ]; then
  printf 'CLEAN-ROOM SKIP: root README.md is not merged at HEAD. A clean clone has no documented path to the REPLAY demo yet.\n'
  exit 0
fi

printf '==> static clean-room checks\n'
missing=0
for path in package.json package-lock.json scripts/dev.sh infra/docker-compose.yml infra/env.example; do
  if [ ! -e "$path" ]; then
    printf 'CLEAN-ROOM FAIL: README path dependency missing: %s\n' "$path"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi

if grep -Eq '/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+' README.md scripts/dev.sh infra/docker-compose.yml infra/env.example 2>/dev/null; then
  printf 'CLEAN-ROOM FAIL: a documented file contains a developer-machine absolute path\n'
  exit 1
fi

if grep -Eq '<your[-_ ]|TODO|TBD|FIXME' README.md; then
  printf 'CLEAN-ROOM FAIL: README contains an undocumented placeholder step\n'
  exit 1
fi

if ! grep -q 'REPLAY' README.md; then
  printf 'CLEAN-ROOM FAIL: README does not describe the REPLAY / SIMULATION mode\n'
  exit 1
fi

if ! grep -qE 'npm (ci|install)' README.md; then
  printf 'CLEAN-ROOM FAIL: README does not document dependency installation\n'
  exit 1
fi

if ! grep -qE 'scripts/dev\.sh|docker compose' README.md; then
  printf 'CLEAN-ROOM FAIL: README does not document how to start the local stack\n'
  exit 1
fi

printf '==> npm ci reproducibility\n'
if ! npm ci --dry-run --ignore-scripts >"$TMP_ROOT/npm-ci.log" 2>&1; then
  printf 'CLEAN-ROOM FAIL: npm ci does not resolve from the clean checkout (package-lock out of sync)\n'
  tail -n 20 "$TMP_ROOT/npm-ci.log"
  exit 1
fi

if [ "$MODE" = "static" ]; then
  printf 'CLEAN-ROOM PASS (static): README instructions and clean-clone file set are present\n'
  exit 0
fi

printf '==> full clean-room run: npm ci + documented local stack\n'
if ! npm ci >"$TMP_ROOT/npm-ci-install.log" 2>&1; then
  printf 'CLEAN-ROOM FAIL: npm ci failed\n'
  tail -n 40 "$TMP_ROOT/npm-ci-install.log"
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  printf 'CLEAN-ROOM FAIL: Docker is required by the documented quick start but is not installed\n'
  exit 1
}

printf '==> bash scripts/dev.sh --fresh\n'
if command -v timeout >/dev/null 2>&1; then
  dev_runner=(timeout 900 bash scripts/dev.sh --fresh)
else
  dev_runner=(bash scripts/dev.sh --fresh)
fi
if ! "${dev_runner[@]}" >"$TMP_ROOT/dev.log" 2>&1; then
  printf 'CLEAN-ROOM FAIL: scripts/dev.sh --fresh failed\n'
  tail -n 60 "$TMP_ROOT/dev.log"
  exit 1
fi

WEB_URL="${MEND_WEB_URL:-http://localhost:${WEB_PORT:-3000}}"
printf '==> checking REPLAY banner at %s\n' "$WEB_URL"
ok=0
for _ in $(seq 1 60); do
  if curl -fsS "$WEB_URL" 2>/dev/null | grep -qi 'REPLAY'; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  printf 'CLEAN-ROOM FAIL: the web UI did not show a REPLAY label at %s\n' "$WEB_URL"
  tail -n 60 "$TMP_ROOT/dev.log"
  exit 1
fi

printf '==> stopping the stack\n'
bash scripts/dev.sh --down >/dev/null 2>&1 || true

printf 'CLEAN-ROOM PASS: a fresh clone followed only README instructions and reached the REPLAY demo\n'

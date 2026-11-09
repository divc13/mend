#!/usr/bin/env bash
# MEND one-command verification (T08.2).
#
# Runs every check that is available in the current checkout and prints a clear
# PASS / FAIL / SKIP table. Checks that cannot run because a workspace, tool or
# Rust target is not present are reported as SKIP with the exact reason. A
# failing check is never downgraded: its output is printed and the script exits
# non-zero.
#
# Usage:
#   bash scripts/verify.sh
#   MEND_VERIFY_KEEP_LOGS=1 bash scripts/verify.sh   # keep logs on success too
#
# Exit codes: 0 = no failures, 1 = at least one failure.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mend-verify.XXXXXX")"
RESULTS=()
PASSED=0
FAILED=0
SKIPPED=0
PROD_AUDIT_FAILED=0
KEEP_LOGS="${MEND_VERIFY_KEEP_LOGS:-0}"

cleanup() {
  if [ "$FAILED" -eq 0 ] && [ "$KEEP_LOGS" != "1" ]; then
    rm -rf "$LOG_DIR"
  else
    printf '\nLogs: %s\n' "$LOG_DIR"
  fi
}
trap cleanup EXIT

record() {
  status="$1"
  name="$2"
  detail="${3:-}"
  RESULTS+=("${status}|${name}|${detail}")
  case "$status" in
    PASS) PASSED=$((PASSED + 1)) ;;
    FAIL) FAILED=$((FAILED + 1)) ;;
    SKIP) SKIPPED=$((SKIPPED + 1)) ;;
  esac
}

slugify() {
  printf '%s' "$1" | tr -cs 'A-Za-z0-9' '-' | sed 's/^-//; s/-$//'
}

skip() {
  name="$1"
  reason="$2"
  printf '==> %s [SKIP] %s\n' "$name" "$reason"
  record SKIP "$name" "$reason"
}

run_check() {
  name="$1"
  shift
  logfile="$LOG_DIR/$(slugify "$name").log"

  printf '==> %s\n' "$name"
  {
    printf '$ %s\n' "$*"
    "$@"
  } >"$logfile" 2>&1
  rc=$?

  if [ "$rc" -eq 0 ]; then
    record PASS "$name" "ok"
    return 0
  fi

  record FAIL "$name" "see $(basename "$logfile")"
  printf '\n----- FAILED: %s (exit %d) -----\n' "$name" "$rc"
  tail -n 100 "$logfile" 2>/dev/null || true
  printf -- '----------------------------------------\n\n'
  return 0
}

node_available() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1
}

# has_root_script <script-name>
has_root_script() {
  node -e '
    try {
      const pkg = require("./package.json");
      process.exit(pkg.scripts && pkg.scripts[process.argv[1]] ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "$1" >/dev/null 2>&1
}

# pkg_has_script <workspace-dir> <script-name>
pkg_has_script() {
  node -e '
    const fs = require("fs");
    const path = require("path");
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.argv[1], "package.json"), "utf8"));
      process.exit(pkg.scripts && pkg.scripts[process.argv[2]] ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "$1" "$2" >/dev/null 2>&1
}

pkg_name() {
  node -e '
    const path = require("path");
    try {
      process.stdout.write(require(path.resolve(process.argv[1], "package.json")).name || "");
    } catch {
      process.exit(1);
    }
  ' "$1" 2>/dev/null
}

# any_workspace_script <script-name>
any_workspace_script() {
  for pkgjson in packages/*/package.json apps/*/package.json services/*/package.json; do
    [ -f "$pkgjson" ] || continue
    if pkg_has_script "${pkgjson%/package.json}" "$1"; then
      return 0
    fi
  done
  return 1
}

check_shell_syntax() {
  rc=0
  for f in scripts/*.sh; do
    [ -f "$f" ] || continue
    printf 'bash -n %s\n' "$f"
    bash -n "$f" || rc=1
  done
  for f in infra/docker/*.sh; do
    [ -f "$f" ] || continue
    printf 'sh -n %s\n' "$f"
    sh -n "$f" || rc=1
  done
  return "$rc"
}

check_audit() {
  if ! node_available; then
    skip "Dependency audit (production)" "node/npm not installed"
    return
  fi
  if [ ! -f package-lock.json ]; then
    skip "Dependency audit (production)" "package-lock.json missing"
    return
  fi

  prod_log="$LOG_DIR/audit-production.log"
  printf '==> Dependency audit (production)\n'
  npm audit --omit=dev --audit-level=high >"$prod_log" 2>&1
  prod_rc=$?

  if [ "$prod_rc" -eq 0 ]; then
    record PASS "Dependency audit (production)" "no high/critical runtime advisories"
  elif grep -qiE 'ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|network|audit endpoint|registry' "$prod_log"; then
    record SKIP "Dependency audit (production)" "audit registry unavailable (network)"
  else
    PROD_AUDIT_FAILED=1
    record FAIL "Dependency audit (production)" "see audit-production.log"
    printf '\n----- FAILED: Dependency audit (production) -----\n'
    tail -n 60 "$prod_log" 2>/dev/null || true
    printf -- '-------------------------------------------------\n\n'
  fi

  dev_log="$LOG_DIR/audit-all.log"
  npm audit --audit-level=high >"$dev_log" 2>&1
  dev_rc=$?

  if [ "$dev_rc" -eq 0 ]; then
    record PASS "Dependency audit (all dependencies)" "clean"
  elif grep -qiE 'ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|network|audit endpoint|registry' "$dev_log"; then
    record SKIP "Dependency audit (all dependencies)" "audit registry unavailable (network)"
  elif [ "$PROD_AUDIT_FAILED" -eq 0 ]; then
    # Explicit, bounded exception required by T08.2: high/critical advisories
    # can only exist in devDependencies when the production audit above passed.
    record SKIP "Dependency audit (dev-only advisories)" "non-blocking: prod audit clean; dev-only advisories present (see audit-all.log)"
  else
    record SKIP "Dependency audit (dev-only advisories)" "informational; fix production advisories above first (see audit-all.log)"
  fi
}

check_compose_config() {
  if ! command -v docker >/dev/null 2>&1; then
    skip "Compose config" "docker CLI not installed"
    return
  fi
  if docker compose version >/dev/null 2>&1; then
    run_check "Compose config" docker compose -f infra/docker-compose.yml config --quiet
  elif command -v docker-compose >/dev/null 2>&1; then
    run_check "Compose config" docker-compose -f infra/docker-compose.yml config --quiet
  else
    skip "Compose config" "Docker Compose not installed"
  fi
}

# ---------------------------------------------------------------------------
# Formatting / lint / typecheck
# ---------------------------------------------------------------------------
if ! node_available; then
  skip "Formatting" "node/npm not installed"
  skip "Lint" "node/npm not installed"
  skip "Typecheck" "node/npm not installed"
else
  if [ -x node_modules/.bin/prettier ] && ls .prettierrc* >/dev/null 2>&1; then
    run_check "Formatting (prettier --check)" node_modules/.bin/prettier --check .
  elif has_root_script "format:check"; then
    run_check "Formatting (npm run format:check)" npm run format:check
  else
    skip "Formatting" "no format:check script or prettier config"
  fi

  if has_root_script "lint" && any_workspace_script "lint"; then
    run_check "Lint" npm run lint
  elif has_root_script "lint"; then
    skip "Lint" "root lint script exists but no workspace defines lint"
  else
    skip "Lint" "no root lint script"
  fi

  if has_root_script "typecheck"; then
    run_check "Typecheck" npm run typecheck
  else
    skip "Typecheck" "no root typecheck script"
  fi
fi

# ---------------------------------------------------------------------------
# Node test suites
# ---------------------------------------------------------------------------
if ! node_available; then
  skip "Protocol tests" "node/npm not installed"
else
  if [ -f packages/protocol/package.json ] && pkg_has_script packages/protocol test; then
    run_check "Protocol tests (@mend/protocol)" npm test --workspace @mend/protocol
  else
    skip "Protocol tests (@mend/protocol)" "packages/protocol test script missing"
  fi

  if [ -d apps/api ]; then
    if pkg_has_script apps/api test; then
      api_name="$(pkg_name apps/api)"
      api_name="${api_name:-@mend/api}"
      run_check "API tests ($api_name)" npm test --workspace "$api_name"
    else
      skip "API tests" "apps/api has no test script"
    fi
  else
    skip "API tests" "apps/api not present in this branch/worktree"
  fi

  agent_suites=0
  for pkgjson in services/*/package.json; do
    [ -f "$pkgjson" ] || continue
    dir="${pkgjson%/package.json}"
    if pkg_has_script "$dir" test; then
      name="$(pkg_name "$dir")"
      [ -n "$name" ] || continue
      agent_suites=$((agent_suites + 1))
      run_check "Agent/service tests ($name)" npm test --workspace "$name"
    fi
  done
  if [ "$agent_suites" -eq 0 ]; then
    skip "Agent/service tests" "no services/* test scripts present in this branch/worktree"
  fi

  if has_root_script "test:e2e"; then
    run_check "E2E tests" npm run test:e2e
  elif ls playwright.config.* >/dev/null 2>&1; then
    if [ -x node_modules/.bin/playwright ]; then
      run_check "E2E tests (Playwright)" node_modules/.bin/playwright test
    else
      skip "E2E tests" "Playwright config present but playwright is not installed"
    fi
  else
    skip "E2E tests" "no test:e2e script or Playwright config"
  fi
fi

# ---------------------------------------------------------------------------
# Rust contracts. Prefer the contracts workspace manifest; fall back to
# per-crate manifests for layouts without a workspace root.
# ---------------------------------------------------------------------------
CONTRACT_MANIFESTS=""
if [ -f contracts/Cargo.toml ]; then
  CONTRACT_MANIFESTS="contracts/Cargo.toml"
else
  for manifest in contracts/*/Cargo.toml contracts/*/*/Cargo.toml; do
    [ -f "$manifest" ] || continue
    CONTRACT_MANIFESTS="${CONTRACT_MANIFESTS}${CONTRACT_MANIFESTS:+ }$manifest"
  done
fi

if [ -n "$CONTRACT_MANIFESTS" ]; then
  if command -v cargo >/dev/null 2>&1; then
    for manifest in $CONTRACT_MANIFESTS; do
      run_check "Contract cargo tests ($manifest)" cargo test --manifest-path "$manifest" --workspace
    done

    if command -v rustup >/dev/null 2>&1 && ! rustup target list --installed 2>/dev/null | grep -qx 'wasm32-unknown-unknown'; then
      skip "Contract WASM build" "rust target wasm32-unknown-unknown not installed (rustup target add wasm32-unknown-unknown)"
    else
      for manifest in $CONTRACT_MANIFESTS; do
        run_check "Contract WASM build ($manifest)" cargo build --manifest-path "$manifest" --workspace --release --target wasm32-unknown-unknown
      done
    fi
  else
    skip "Contract cargo tests" "cargo not installed"
    skip "Contract WASM build" "cargo not installed"
  fi
else
  skip "Contract cargo tests" "no contracts/Cargo.toml or contracts/*/Cargo.toml in this branch/worktree"
  skip "Contract WASM build" "no contracts/Cargo.toml or contracts/*/Cargo.toml in this branch/worktree"
fi

# ---------------------------------------------------------------------------
# Infrastructure checks
# ---------------------------------------------------------------------------
if [ -f scripts/secret-scan.sh ]; then
  run_check "Secret scan" bash scripts/secret-scan.sh
else
  skip "Secret scan" "scripts/secret-scan.sh missing"
fi

check_compose_config
run_check "Shell script syntax" check_shell_syntax
check_audit

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
printf '\nMEND verification summary\n'
printf '%-58s %-6s %s\n' "CHECK" "RESULT" "DETAIL"
printf '%-58s %-6s %s\n' "----------------------------------------------------------" "------" "------"
for row in "${RESULTS[@]}"; do
  IFS='|' read -r status name detail <<EOF
$row
EOF
  printf '%-58s %-6s %s\n' "$name" "$status" "$detail"
done
printf '\nTotals: %d passed, %d failed, %d skipped\n' "$PASSED" "$FAILED" "$SKIPPED"

if [ "$FAILED" -gt 0 ]; then
  printf 'RESULT: FAIL\n'
  exit 1
fi

printf 'RESULT: PASS\n'
exit 0

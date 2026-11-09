#!/usr/bin/env bash
# T07 CI runner: one command, explicit PASS/FAIL/SKIP per suite.
#
# Usage: bash tests/ci.sh
# Exit: 0 only when no suite failed. Skips are printed with their reason and
# are never counted as passes.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 2

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf 'RESULT: FAIL — node/npm are not installed\n'
  exit 1
fi

if [ ! -x tests/node_modules/.bin/vitest ] || [ ! -x tests/node_modules/.bin/playwright ]; then
  printf 'RESULT: FAIL — test dependencies are not installed.\n'
  printf 'Run: npm ci --prefix tests && npx --prefix tests playwright install chromium\n'
  exit 1
fi

LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mend-quality.XXXXXX")"
RESULTS=()
FAILED=0
SKIPPED_TOTAL=0
PASSED_TOTAL=0

cleanup() {
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT

record() {
  RESULTS+=("$1|$2|$3")
}

run_vitest_suite() {
  name="$1"
  shift
  log="$LOG_DIR/$(printf '%s' "$name" | tr -cs 'A-Za-z0-9' '-').log"
  printf '==> %s\n' "$name"
  ( cd tests && ./node_modules/.bin/vitest run "$@" ) >"$log" 2>&1
  rc=$?
  passed="$(grep -oE '[0-9]+ passed' "$log" | tail -n 1 | awk '{print $1}')"
  failed="$(grep -oE '[0-9]+ failed' "$log" | tail -n 1 | awk '{print $1}')"
  skipped="$(grep -oE '[0-9]+ skipped' "$log" | tail -n 1 | awk '{print $1}')"
  summary="${passed:-0} passed, ${failed:-0} failed, ${skipped:-0} skipped"
  PASSED_TOTAL=$((PASSED_TOTAL + ${passed:-0}))
  SKIPPED_TOTAL=$((SKIPPED_TOTAL + ${skipped:-0}))
  if [ "$rc" -eq 0 ]; then
    record PASS "$name" "$summary"
  else
    FAILED=1
    record FAIL "$name" "$summary"
    printf '\n----- FAILED: %s -----\n' "$name"
    tail -n 80 "$log" 2>/dev/null || true
    printf -- '------------------------\n\n'
  fi
}

run_playwright() {
  log="$LOG_DIR/playwright.log"
  printf '==> Playwright E2E\n'
  ( cd tests && ./node_modules/.bin/playwright test --config ../playwright.config.ts ) >"$log" 2>&1
  rc=$?
  passed="$(grep -oE '[0-9]+ passed' "$log" | tail -n 1 | awk '{print $1}')"
  failed="$(grep -oE '[0-9]+ failed' "$log" | tail -n 1 | awk '{print $1}')"
  skipped="$(grep -oE '[0-9]+ skipped' "$log" | tail -n 1 | awk '{print $1}')"
  summary="${passed:-0} passed, ${failed:-0} failed, ${skipped:-0} skipped"
  PASSED_TOTAL=$((PASSED_TOTAL + ${passed:-0}))
  SKIPPED_TOTAL=$((SKIPPED_TOTAL + ${skipped:-0}))
  if [ "$rc" -eq 0 ]; then
    record PASS "Playwright E2E" "$summary"
  else
    FAILED=1
    record FAIL "Playwright E2E" "$summary"
    printf '\n----- FAILED: Playwright E2E -----\n'
    tail -n 100 "$log" 2>/dev/null || true
    printf -- '----------------------------------\n\n'
  fi
}

run_vitest_suite "Integration" integration
run_vitest_suite "Security" security
run_vitest_suite "Clean-room" clean-room
run_playwright

printf '\nMEND quality summary\n'
printf '%-40s %-6s %s\n' "SUITE" "RESULT" "DETAIL"
printf '%-40s %-6s %s\n' "----------------------------------------" "------" "------"
for row in "${RESULTS[@]}"; do
  IFS='|' read -r status name detail <<EOF
$row
EOF
  printf '%-40s %-6s %s\n' "$name" "$status" "$detail"
done
printf '\nTotals: %d passed, %d skipped, failures: %s\n' "$PASSED_TOTAL" "$SKIPPED_TOTAL" "$([ "$FAILED" -eq 0 ] && echo 0 || echo 'at least 1 suite')"

if [ "$FAILED" -ne 0 ]; then
  printf 'RESULT: FAIL\n'
  exit 1
fi
printf 'RESULT: PASS\n'

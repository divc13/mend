#!/usr/bin/env bash
# Deterministic secret scan used by scripts/verify.sh and CI.
#
# Scans tracked files for high-confidence credential patterns and for committed
# .env files. Intentionally dependency-free so it works on macOS, Linux and a
# fresh GitHub runner without installing gitleaks/trufflehog.
#
# Exit codes: 0 = clean, 1 = findings.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FINDINGS=0
SCANNED=0

finding() {
  FINDINGS=$((FINDINGS + 1))
  printf 'SECRET-SCAN: %s\n' "$*" >&2
}

# High-confidence credential formats. Placeholders such as ed25519:<base58>
# do not match because '<' is not part of the base58 character class.
HARD_PATTERN='-----BEGIN ([A-Z0-9]+ )?PRIVATE KEY-----|ed25519:[1-9A-HJ-NP-Za-km-z]{40,}|AKIA[0-9A-Z]{16}|(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-[A-Za-z0-9]{32,}|xox[baprs]-[A-Za-z0-9-]{10,}'

# Assignment-shaped secrets. Only flagged outside env templates, and only when
# the value does not look like an obvious local placeholder.
ASSIGN_PATTERN='^[[:space:]]*[A-Za-z0-9_]*(PASSWORD|PASSWD|SECRET|PRIVATE_KEY|API_KEY|TOKEN)[A-Za-z0-9_]*[[:space:]]*=[[:space:]]*[^[:space:]]{16,}$'

list_files() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git ls-files
  else
    find . -type f \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path '*/node_modules/*' \
      -not -path './dist/*' \
      -not -path './coverage/*'
  fi
}

is_placeholder_line() {
  line_lc="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$line_lc" in
    *example*|*placeholder*|*changeme*|*change-me*|*replace-me*|*your_*|*your-*|*dummy*|*redacted*|*not-a-real*|*local_dev*|*local-dev*|*local-demo*|*mend_local*|*mend-local*|*'<'*|*'${'*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue

  # Never flag the template itself; it is documentation, not a credential.
  base="$(basename "$file")"
  case "$base" in
    .env.example|env.example) template=1 ;;
    *) template=0 ;;
  esac

  # A committed .env file is always a failure, even if its values look local.
  case "$base" in
    .env|.env.*)
      if [ "$template" -eq 0 ]; then
        finding "committed environment file: $file"
      fi
      ;;
  esac

  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.wasm|*.woff|*.woff2|*.ttf|*.ico|package-lock.json|*/package-lock.json)
      continue
      ;;
  esac

  SCANNED=$((SCANNED + 1))

  if grep -IqE "$HARD_PATTERN" "$file" 2>/dev/null; then
    while IFS= read -r match; do
      finding "credential pattern in $file: $match"
    done < <(grep -InE "$HARD_PATTERN" "$file" 2>/dev/null)
  fi

  if [ "$template" -eq 0 ]; then
    if grep -IqE "$ASSIGN_PATTERN" "$file" 2>/dev/null; then
      while IFS= read -r match; do
        if ! is_placeholder_line "$match"; then
          finding "secret-like assignment in $file: $match"
        fi
      done < <(grep -InE "$ASSIGN_PATTERN" "$file" 2>/dev/null)
    fi
  fi
done < <(list_files)

if [ "$FINDINGS" -gt 0 ]; then
  printf 'SECRET-SCAN: FAIL (%d finding(s) across %d scanned file(s))\n' "$FINDINGS" "$SCANNED" >&2
  exit 1
fi

printf 'SECRET-SCAN: PASS (%d tracked file(s) scanned)\n' "$SCANNED"
exit 0

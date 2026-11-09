#!/usr/bin/env bash
# MEND replay packaging (T08.6 / F13 scenario E).
#
# Copies versioned, offline-safe fixtures and public verification artefacts into
# a release bundle that judges can use without credentials. The bundle is
# explicitly labelled REPLAY / SIMULATION and contains no live transaction
# claims, secrets or private evidence.
#
# Usage:
#   bash scripts/package-replay.sh
#   bash scripts/package-replay.sh --strict --tar
#
# Output:
#   dist/replay/mend-replay-v<version>-<commit>/
#   dist/replay/mend-replay-v<version>-<commit>/manifest.json
#
# Flags:
#   --strict   fail if fixtures/demo or fixtures/recorded-responses are missing
#   --tar      also create a .tar.gz next to the bundle directory
#
# Environment:
#   MEND_REPLAY_OUT     output root (default: <repo>/dist/replay)
#   MEND_REPLAY_VERSION version label (default: root package.json version)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STRICT=0
MAKE_TAR=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --tar) MAKE_TAR=1 ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf '[replay] ERROR: unknown option %s\n' "$1" >&2; exit 1 ;;
  esac
  shift
done

log() { printf '[replay] %s\n' "$*"; }
warn() { printf '[replay] WARN: %s\n' "$*" >&2; }
die() { printf '[replay] ERROR: %s\n' "$*" >&2; exit 1; }

hash_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    die "need shasum or sha256sum"
  fi
}

VERSION="${MEND_REPLAY_VERSION:-}"
if [ -z "$VERSION" ] && command -v node >/dev/null 2>&1; then
  VERSION="$(node -p "require('./package.json').version" 2>/dev/null || true)"
fi
VERSION="${VERSION:-0.0.0}"
VERSION="$(printf '%s' "$VERSION" | tr -cs 'A-Za-z0-9._-' '-' | sed 's/^-//; s/-$//')"

GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
GIT_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
GIT_DIRTY="false"
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  GIT_DIRTY="true"
fi

OUT_ROOT="${MEND_REPLAY_OUT:-$ROOT_DIR/dist/replay}"
BUNDLE_NAME="mend-replay-v${VERSION}-${GIT_SHORT}"
BUNDLE_DIR="$OUT_ROOT/$BUNDLE_NAME"

[ -n "$BUNDLE_DIR" ] || die "refusing empty output path"
case "$BUNDLE_DIR" in
  /|.) die "refusing unsafe output path: $BUNDLE_DIR" ;;
esac

mkdir -p "$OUT_ROOT"
if [ -e "$BUNDLE_DIR" ]; then
  log "replacing existing bundle: $BUNDLE_DIR"
  rm -rf "$BUNDLE_DIR"
fi
mkdir -p "$BUNDLE_DIR"

missing_required=0
copy_source() {
  src="$1"
  dest="$2"
  if [ -e "$src" ]; then
    mkdir -p "$BUNDLE_DIR/$dest"
    cp -R "$src/." "$BUNDLE_DIR/$dest/"
    log "copied $src -> $dest"
  else
    warn "missing source: $src"
  fi
}

if [ "$STRICT" -eq 1 ]; then
  [ -d fixtures/demo ] || { warn "strict: fixtures/demo missing"; missing_required=1; }
  [ -d fixtures/recorded-responses ] || { warn "strict: fixtures/recorded-responses missing"; missing_required=1; }
  [ "$missing_required" -eq 0 ] || die "strict packaging failed: required fixture sets missing"
fi

copy_source "fixtures/demo" "fixtures/demo"
copy_source "fixtures/recorded-responses" "fixtures/recorded-responses"
copy_source "fixtures/attacks" "fixtures/attacks"
copy_source "packages/protocol/generated" "protocol/generated"

if [ -f "docs/RULES.md" ]; then
  mkdir -p "$BUNDLE_DIR/docs"
  cp "docs/RULES.md" "$BUNDLE_DIR/docs/RULES.md"
  log "copied docs/RULES.md"
fi

# Optional compiled WASM for independent verification. Never copy private keys.
for wasm in contracts/target/wasm32-unknown-unknown/release/*.wasm; do
  [ -f "$wasm" ] || continue
  mkdir -p "$BUNDLE_DIR/artifacts/wasm"
  cp "$wasm" "$BUNDLE_DIR/artifacts/wasm/"
  log "copied $wasm"
done

# Refuse to ship anything that looks like a secret or private evidence.
sensitive="$(find "$BUNDLE_DIR" -type f \
  \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' \
     -o -name 'id_ed25519' -o -name 'id_rsa' \) -print 2>/dev/null || true)"
if [ -n "$sensitive" ]; then
  printf '%s\n' "$sensitive" >&2
  die "refusing to package secrets; remove the files above"
fi
private_dirs="$(find "$BUNDLE_DIR" -type d \
  \( -name 'private-evidence' -o -name 'evidence-private' -o -name 'raw-evidence' \) -print 2>/dev/null || true)"
if [ -n "$private_dirs" ]; then
  printf '%s\n' "$private_dirs" >&2
  die "refusing to package private evidence paths"
fi

cat > "$BUNDLE_DIR/README.md" <<'EOF'
# MEND replay bundle

Label: **REPLAY / SIMULATION**

This bundle contains recorded fixtures and public verification artefacts only.
It contains no live transactions, no credentials and no private evidence.

- Every scenario run from this bundle must display `REPLAY / SIMULATION`.
- Transaction references are historical testnet/replay references, not live
  payments. Do not describe them as current transactions.
- `manifest.json` records the source commit, packaging time and SHA-256 of every
  file. Verify with `shasum -a 256 <file>` (macOS) or `sha256sum <file>` (Linux).

See `manifest.json` for the authoritative file list and hashes.
EOF

CREATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
ENTRIES_FILE="$OUT_ROOT/.entries.$$"
: > "$ENTRIES_FILE"

first=1
while IFS= read -r file; do
  rel="${file#"$BUNDLE_DIR"/}"
  [ "$rel" = "manifest.json" ] && continue
  digest="$(hash_file "$file")"
  bytes="$(wc -c < "$file" | tr -d ' ')"
  if [ "$first" -eq 1 ]; then
    first=0
  else
    printf ',\n' >> "$ENTRIES_FILE"
  fi
  printf '    {"path":"%s","bytes":%s,"sha256":"%s"}' "$rel" "$bytes" "$digest" >> "$ENTRIES_FILE"
done < <(find "$BUNDLE_DIR" -type f | sort)

{
  printf '{\n'
  printf '  "label": "REPLAY / SIMULATION",\n'
  printf '  "bundle": "%s",\n' "$BUNDLE_NAME"
  printf '  "version": "%s",\n' "$VERSION"
  printf '  "createdAt": "%s",\n' "$CREATED_AT"
  printf '  "gitCommit": "%s",\n' "$GIT_COMMIT"
  printf '  "gitDirty": %s,\n' "$GIT_DIRTY"
  printf '  "containsLiveTransactions": false,\n'
  printf '  "files": [\n'
  cat "$ENTRIES_FILE"
  printf '\n  ]\n'
  printf '}\n'
} > "$BUNDLE_DIR/manifest.json"
rm -f "$ENTRIES_FILE"

if command -v node >/dev/null 2>&1; then
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$BUNDLE_DIR/manifest.json" \
    || die "manifest.json is not valid JSON"
fi

if [ "$MAKE_TAR" -eq 1 ]; then
  (cd "$OUT_ROOT" && tar -czf "$BUNDLE_NAME.tar.gz" "$BUNDLE_NAME")
  log "archive: $OUT_ROOT/$BUNDLE_NAME.tar.gz"
fi

log "bundle: $BUNDLE_DIR"
log "manifest: $BUNDLE_DIR/manifest.json"
log "files: $(find "$BUNDLE_DIR" -type f | wc -l | tr -d ' ')"

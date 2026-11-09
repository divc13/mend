#!/bin/sh
# Resolve and run the requested npm workspace without hard-coding app internals.
# Used as the CMD of the MEND api/web Docker images.
set -eu

: "${MEND_WORKSPACE:?MEND_WORKSPACE is required (for example @mend/api)}"
MEND_APP_DIR="${MEND_APP_DIR:-}"

cd /app

has_script() {
  script_name="$1"
  node -e '
    const fs = require("fs");
    const path = require("path");
    const dir = process.argv[1];
    const name = process.argv[2];
    if (!dir) process.exit(1);
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      process.exit(pkg.scripts && pkg.scripts[name] ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "$MEND_APP_DIR" "$script_name"
}

if [ -n "${MEND_COMMAND:-}" ]; then
  exec sh -c "$MEND_COMMAND"
fi

if [ "${NODE_ENV:-development}" = "production" ] && has_script start; then
  exec npm run start --workspace "$MEND_WORKSPACE"
fi

if has_script dev; then
  exec npm run dev --workspace "$MEND_WORKSPACE"
fi

if has_script start; then
  exec npm run start --workspace "$MEND_WORKSPACE"
fi

echo "mend-run: workspace $MEND_WORKSPACE ($MEND_APP_DIR) defines neither a dev nor a start script" >&2
exit 1

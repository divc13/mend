#!/usr/bin/env bash
# Reproduce the live NEAR AI triage path. The API must already be running with
# NEAR_AI_API_KEY, e.g.:
#   PORT=4011 MEND_MODE=REPLAY NEAR_AI_MODEL=z-ai/glm-5.3-flash \
#     NEAR_AI_TIMEOUT_MS=120000 npx tsx apps/api/src/index.ts
set -euo pipefail

BASE="${MEND_API_BASE:-http://127.0.0.1:4011}"
HEADERS=(-H 'x-mend-role: STEWARD' -H 'x-mend-account: mend-steward.testnet')

curl -sS -X POST "$BASE/v1/assets" \
  -H 'content-type: application/json' \
  "${HEADERS[@]}" \
  --data '{"id":"BENCH-901","publicDescription":"Riverside Park bench with a cracked seat slat and exposed bolt","assetType":"bench","publicLocation":{"label":"Riverside Park","coarseLat":52.52,"coarseLng":13.405,"area":"Riverside"}}'

curl -sS -X POST "$BASE/v1/reports" \
  -H 'content-type: application/json' \
  --data '{"assetId":"BENCH-901","description":"The third seat slat on the riverside bench is cracked and flexes when sat on. One bolt is exposed and the wood splinters at the edge. No photo attached; reported by a park visitor.","publicLocation":{"label":"Riverside Park","coarseLat":52.52,"coarseLng":13.405,"area":"Riverside"}}'

curl -sS -X POST "$BASE/v1/reports/R-001/triage" \
  "${HEADERS[@]}" \
  -o /tmp/mend-triage.json \
  -w 'triage HTTP %{http_code} in %{time_total}s\n'

python3 - <<'PY'
import json
p = '/tmp/mend-triage.json'
d = json.load(open(p))
print(json.dumps({
    'available': d.get('available'),
    'verified': d.get('verified'),
    'label': d.get('label'),
    'verification': d.get('verification'),
    'attestationId': (d.get('suggestion') or {}).get('attestationId'),
}, indent=2))
PY

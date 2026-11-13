#!/usr/bin/env bash
# Human-signed live Intents deposit for the same-chain USDT -> USDC test.
# The final USDC lands in divyanshc.near. The deposit address is 1Click's
# temporary implicit account, not a wallet you keep.
set -euo pipefail

ACCOUNT="divyanshc.near"
USDT="usdt.tether-token.near"
USDC="17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
DEPOSIT="3229d3894d42123c1fb93ee8c0c46536f7d9d3b771672198a182fd0632fc2a63"
AMOUNT_USDT="0.15"
STATUS_URL="https://1click.chaindefuser.com/v0/status?depositAddress=${DEPOSIT}"
CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
fi

cat <<EOF
MEND / NEAR Intents live test — MAINNET ONLY
  From:      ${ACCOUNT}
  Send:      ${AMOUNT_USDT} USDT
  Receive:   USDC on NEAR
  Recipient: ${ACCOUNT} (same wallet)
  Temp 1Click deposit account: ${DEPOSIT}
  Quote deadline: 2026-11-16T13:25:01Z

This runs four signed transactions:
  0. register USDC storage for ${ACCOUNT} if it is missing
  1. create the temporary implicit account (0.001 NEAR)
  2. register USDT storage for it (0.00125 NEAR)
  3. send exactly ${AMOUNT_USDT} USDT

Step 0 is required because 1Click delivers USDC with a NEP-141 transfer. The
recipient currently has no USDC storage, so delivery would fail without it.
The temporary account is required by 1Click. The final USDC is delivered to
${ACCOUNT}; no USDC is left in the temporary account.
EOF

if [[ "${CHECK_ONLY}" != "1" ]]; then
  read -r -p "Type YES to continue: " confirm
  if [[ "${confirm}" != "YES" ]]; then
    echo "Aborted. No transaction was sent."
    exit 1
  fi
fi

# Read-only preflight: do not pay for a duplicate USDC storage registration.
USDC_STORAGE=$(python3 - "$USDC" "$ACCOUNT" <<'PY'
import base64, json, sys, urllib.request

contract, account = sys.argv[1], sys.argv[2]
body = json.dumps({
    "jsonrpc": "2.0",
    "id": "mend-storage-check",
    "method": "query",
    "params": {
        "request_type": "call_function",
        "finality": "final",
        "account_id": contract,
        "method_name": "storage_balance_of",
        "args_base64": base64.b64encode(json.dumps({"account_id": account}).encode()).decode(),
    },
}).encode()
req = urllib.request.Request("https://rpc.mainnet.near.org", data=body, headers={"content-type": "application/json"})
with urllib.request.urlopen(req, timeout=30) as response:
    payload = json.load(response)
raw = bytes(payload["result"]["result"]).decode()
print("null" if json.loads(raw) is None else "registered")
PY
)

if [ "$USDC_STORAGE" = "null" ]; then
  echo "USDC storage is not registered for ${ACCOUNT}; step 0 would add 0.00125 NEAR storage."
  if [[ "${CHECK_ONLY}" != "1" ]]; then
    near account manage-storage-deposit "${USDC}" deposit "${ACCOUNT}" \
      '0.00125 NEAR' \
      sign-as "${ACCOUNT}" network-config mainnet sign-with-keychain send
    sleep 2
  fi
else
  echo "USDC storage is already registered for ${ACCOUNT}; step 0 would be skipped."
fi

if [[ "${CHECK_ONLY}" == "1" ]]; then
  echo "CHECK ONLY: no transaction was sent. Re-run without --check to sign and send."
  exit 0
fi

near tokens "${ACCOUNT}" send-near \
  "${DEPOSIT}" \
  '0.001 NEAR' \
  network-config mainnet sign-with-keychain send

sleep 2

near account manage-storage-deposit "${USDT}" deposit \
  "${DEPOSIT}" \
  '0.00125 NEAR' \
  sign-as "${ACCOUNT}" network-config mainnet sign-with-keychain send

sleep 2

near tokens "${ACCOUNT}" send-ft \
  "${USDT}" \
  "${DEPOSIT}" \
  "${AMOUNT_USDT}" memo '' \
  network-config mainnet sign-with-keychain send

cat <<EOF

Deposit sent. Poll status:
  ${STATUS_URL}

MEND will verify SUCCESS, the destination transaction, amount and recipient.
EOF

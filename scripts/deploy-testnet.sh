#!/usr/bin/env bash
# MEND testnet deployment driver (T08.3).
#
# Idempotent commands for account creation, contract deployment, initialisation
# and role setup. It refuses mainnet unless three independent human gates are
# satisfied (see assert_network). Never run this from an agent session.
#
# Usage:
#   bash scripts/deploy-testnet.sh accounts  [--dry-run]
#   bash scripts/deploy-testnet.sh token     [--dry-run]
#   bash scripts/deploy-testnet.sh hub       [--dry-run]
#   bash scripts/deploy-testnet.sh init      [--dry-run]
#   bash scripts/deploy-testnet.sh roles     [--dry-run]
#   bash scripts/deploy-testnet.sh verify    [--dry-run]
#   bash scripts/deploy-testnet.sh all       [--dry-run]
#
# Flags:
#   --dry-run        print commands without executing them
#   --force-deploy   redeploy even when contract code already exists
#                    (WARNING: deploying over a live contract resets its state)
#   --force-init     call init even when the initialised view is unknown
#   --allow-mainnet  one of three gates required for mainnet; default refuses
#
# Requirements:
#   - near-cli-rs (`near`) installed and version-pinned in the runbook
#   - the deployer account already exists in the local NEAR keychain
#   - compiled WASM from the contracts track
#   - infra/.env (or MEND_ENV_FILE) for account IDs and WASM paths
#
# This script never reads or writes raw private keys. Signing goes through the
# near-cli keychain / hardware wallet flow.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${MEND_ENV_FILE:-$ROOT_DIR/infra/.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

NEAR_BIN="${NEAR_BIN:-near}"
NETWORK="${NEAR_NETWORK:-testnet}"
DRY_RUN=0
ALLOW_MAINNET_FLAG=0
FORCE_DEPLOY=0
FORCE_INIT=0
COMMAND=""

DEPLOYER="${NEAR_DEPLOYER_ACCOUNT_ID:-mend-deployer.testnet}"
TOKEN="${NEAR_TOKEN_ACCOUNT_ID:-mend-usdc.testnet}"
HUB="${NEAR_HUB_ACCOUNT_ID:-mend-hub.testnet}"
DAO="${NEAR_DAO_ACCOUNT_ID:-mend-dao.sputnikv2.testnet}"
STEWARD="${NEAR_STEWARD_ACCOUNT_ID:-steward.mend.testnet}"
COORDINATOR="${NEAR_COORDINATOR_ACCOUNT_ID:-coordinator-ai.mend.testnet}"
REVIEWER="${NEAR_REVIEWER_ACCOUNT_ID:-reviewer-ai.mend.testnet}"
RELAYER="${NEAR_RELAYER_ACCOUNT_ID:-relayer.mend.testnet}"
CONTRACTORS="${NEAR_CONTRACTOR_ACCOUNT_IDS:-contractor-a.mend.testnet,contractor-b.mend.testnet,contractor-c.mend.testnet}"
INSPECTORS="${NEAR_INSPECTOR_ACCOUNT_IDS:-inspector.mend.testnet,inspector-2.mend.testnet}"
SPONSOR="${NEAR_SPONSOR_ACCOUNT_ID:-sponsor.mend.testnet}"

TOKEN_WASM="${NEAR_TOKEN_WASM_PATH:-contracts/target/wasm32-unknown-unknown/release/mend_test_token.wasm}"
HUB_WASM="${NEAR_HUB_WASM_PATH:-contracts/target/wasm32-unknown-unknown/release/mend_hub.wasm}"
ACCOUNT_BALANCE="${NEAR_ACCOUNT_INITIAL_BALANCE:-10}"
CONTRACT_BALANCE="${NEAR_CONTRACT_INITIAL_BALANCE:-30}"

HUB_INIT_METHOD="${HUB_INIT_METHOD:-new}"
HUB_INITIALIZED_VIEW="${HUB_INITIALIZED_VIEW:-is_initialized}"
HUB_ROLE_METHOD="${HUB_ROLE_METHOD:-grant_role}"
HUB_HAS_ROLE_VIEW="${HUB_HAS_ROLE_VIEW:-has_role}"
TOKEN_INIT_METHOD="${TOKEN_INIT_METHOD:-new}"

if [ -z "${TOKEN_INIT_ARGS_JSON:-}" ]; then
  TOKEN_INIT_ARGS_JSON="$(printf '{"owner_id":"%s","total_supply":"1000000000000000","metadata":{"spec":"ft-1.0.0","name":"MEND Test USDC","symbol":"tUSDC","decimals":6}}' "$DEPLOYER")"
fi
if [ -z "${HUB_INIT_ARGS_JSON:-}" ]; then
  HUB_INIT_ARGS_JSON="$(printf '{"owner_id":"%s","token_account_id":"%s","dao_account_id":"%s"}' "$DEPLOYER" "$TOKEN" "$DAO")"
fi

log() { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy] WARN: %s\n' "$*" >&2; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --allow-mainnet) ALLOW_MAINNET_FLAG=1 ;;
    --force-deploy) FORCE_DEPLOY=1 ;;
    --force-init) FORCE_INIT=1 ;;
    -h|--help) usage; exit 0 ;;
    -*)
      die "unknown option: $1"
      ;;
    *)
      if [ -z "$COMMAND" ]; then
        COMMAND="$1"
      else
        die "unexpected argument: $1"
      fi
      ;;
  esac
  shift
done

[ -n "$COMMAND" ] || { usage; exit 1; }

assert_network() {
  case "$NETWORK" in
    testnet|testnet-fast)
      return 0
      ;;
    mainnet|mainnet-fast)
      # Three independent gates. Any missing gate refuses the deployment.
      if [ "$ALLOW_MAINNET_FLAG" -ne 1 ]; then
        die "refusing mainnet: pass --allow-mainnet only after human approval"
      fi
      if [ "${MEND_ALLOW_MAINNET:-false}" != "true" ]; then
        die "refusing mainnet: MEND_ALLOW_MAINNET is not true"
      fi
      if [ "${MEND_MAINNET_HUMAN_APPROVED:-false}" != "true" ]; then
        die "refusing mainnet: MEND_MAINNET_HUMAN_APPROVED is not true"
      fi
      warn "MAINNET — REAL FUNDS. Every transaction needs separate human approval."
      printf 'Type "I UNDERSTAND MAINNET" to continue: '
      read -r answer
      [ "$answer" = "I UNDERSTAND MAINNET" ] || die "mainnet confirmation not provided"
      ;;
    *)
      die "unsupported NEAR network: $NETWORK (expected testnet; mainnet is gated)"
      ;;
  esac
}

assert_network

require_near() {
  if ! command -v "$NEAR_BIN" >/dev/null 2>&1; then
    die "near CLI not found (set NEAR_BIN). See infra/docs/TESTNET_DEPLOY.md"
  fi
}

run_near() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] near %s\n' "$*"
    return 0
  fi
  "$NEAR_BIN" "$@"
}

# Read-only calls are never executed in dry-run; callers handle the unknown
# state explicitly instead of guessing.
near_read() {
  account="$1"
  method="$2"
  args="$3"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] near contract call-function as-read-only %s %s json-args %s network-config %s now\n' \
      "$account" "$method" "$args" "$NETWORK" >&2
    return 3
  fi
  "$NEAR_BIN" contract call-function as-read-only "$account" "$method" \
    json-args "$args" network-config "$NETWORK" now
}

account_exists() {
  account="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    return 1
  fi
  "$NEAR_BIN" account view-account-summary "$account" network-config "$NETWORK" now >/dev/null 2>&1
}

contract_deployed() {
  account="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    return 1
  fi
  "$NEAR_BIN" contract view-state "$account" network-config "$NETWORK" now >/dev/null 2>&1
}

create_account() {
  account="$1"
  balance="${2:-$ACCOUNT_BALANCE}"
  if account_exists "$account"; then
    log "account exists: $account"
    return 0
  fi
  log "creating account: $account ($balance NEAR from $DEPLOYER)"
  run_near account create-account fund-myself "$account" "$balance NEAR" autogenerate \
    network-config "$NETWORK" sign-with-keychain send
}

# deploy_contract <account> <wasm> <init-method|-> <init-args>
deploy_contract() {
  account="$1"
  wasm="$2"
  init_method="$3"
  init_args="$4"

  if [ "$FORCE_DEPLOY" -ne 1 ] && contract_deployed "$account"; then
    log "contract already deployed: $account (use --force-deploy only if intentional)"
    return 0
  fi

  if [ ! -f "$wasm" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      warn "WASM not found yet: $wasm (dry-run still prints the command)"
    else
      die "WASM not found: $wasm (run the contracts WASM build first)"
    fi
  fi

  log "deploying $wasm -> $account"
  if [ "$init_method" = "-" ] || [ -z "$init_method" ]; then
    run_near contract deploy "$account" use-file "$wasm" without-init-call \
      network-config "$NETWORK" sign-with-keychain send
  else
    run_near contract deploy "$account" use-file "$wasm" \
      with-init-call "$init_method" json-args "$init_args" \
      prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
      network-config "$NETWORK" sign-with-keychain send
  fi
}

call_method() {
  account="$1"
  method="$2"
  args="$3"
  run_near contract call-function as-transaction "$account" "$method" \
    json-args "$args" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
    sign-with-keychain send network-config "$NETWORK"
}

# 0 = role present, 1 = role absent, 2 = cannot determine
role_present() {
  account="$1"
  role="$2"
  output="$(near_read "$HUB" "$HUB_HAS_ROLE_VIEW" "{\"account_id\":\"$account\",\"role\":\"$role\"}" 2>&1)" || true
  case "$output" in
    *true*) return 0 ;;
    *false*) return 1 ;;
    *) return 2 ;;
  esac
}

grant_role() {
  account="$1"
  role="$2"

  present=0
  role_present "$account" "$role" || present=$?
  if [ "$present" -eq 0 ]; then
    log "role already granted: $role -> $account"
    return 0
  fi
  if [ "$present" -eq 2 ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      log "dry-run: cannot read $HUB_HAS_ROLE_VIEW; printing grant"
    else
      warn "cannot read $HUB_HAS_ROLE_VIEW; relying on contract-side idempotency"
    fi
  fi

  args="{\"account_id\":\"$account\",\"role\":\"$role\"}"
  log "granting $role -> $account"
  if output="$(call_method "$HUB" "$HUB_ROLE_METHOD" "$args" 2>&1)"; then
    printf '%s\n' "$output"
  else
    printf '%s\n' "$output" >&2
    case "$output" in
      *already*|*Already*|*duplicate*|*Duplicate*)
        warn "role already present on-chain; treating as idempotent success"
        ;;
      *)
        die "grant_role failed for $account ($role)"
        ;;
    esac
  fi
}

list_from_csv() {
  printf '%s' "$1" | tr ',' ' '
}

cmd_accounts() {
  require_near
  if ! account_exists "$DEPLOYER"; then
    if [ "$DRY_RUN" -eq 1 ]; then
      warn "deployer $DEPLOYER not verified in dry-run; it must exist in the keychain"
    else
      die "deployer account $DEPLOYER does not exist or is not visible on $NETWORK"
    fi
  fi

  for account in "$TOKEN" "$HUB" "$STEWARD" "$SPONSOR" "$COORDINATOR" "$REVIEWER" "$RELAYER"; do
    create_account "$account"
  done
  for account in $(list_from_csv "$CONTRACTORS") $(list_from_csv "$INSPECTORS"); do
    create_account "$account"
  done
  log "accounts complete (DAO $DAO is created by the human DAO operator, not this script)"
}

cmd_token() {
  require_near
  deploy_contract "$TOKEN" "$TOKEN_WASM" "$TOKEN_INIT_METHOD" "$TOKEN_INIT_ARGS_JSON"
}

cmd_hub() {
  require_near
  deploy_contract "$HUB" "$HUB_WASM" "-" "{}"
}

cmd_init() {
  require_near
  if [ "$DRY_RUN" -ne 1 ]; then
    contract_deployed "$HUB" || die "hub contract is not deployed: $HUB"
  fi

  state="$(near_read "$HUB" "$HUB_INITIALIZED_VIEW" '{}' 2>&1)" || true

  case "$state" in
    *true*)
      log "hub already initialised"
      return 0
      ;;
    *false*)
      log "initialising hub"
      call_method "$HUB" "$HUB_INIT_METHOD" "$HUB_INIT_ARGS_JSON"
      ;;
    *)
      if [ "$DRY_RUN" -eq 1 ]; then
        log "dry-run: cannot read $HUB_INITIALIZED_VIEW; printing init call"
        call_method "$HUB" "$HUB_INIT_METHOD" "$HUB_INIT_ARGS_JSON"
      elif [ "$FORCE_INIT" -eq 1 ]; then
        warn "--force-init set; calling init even though state is unknown"
        call_method "$HUB" "$HUB_INIT_METHOD" "$HUB_INIT_ARGS_JSON"
      else
        die "cannot determine init state; refusing to re-initialise (inspect $HUB, then use --force-init only if truly uninitialised)"
      fi
      ;;
  esac
}

cmd_roles() {
  require_near
  if [ "$DRY_RUN" -ne 1 ]; then
    contract_deployed "$HUB" || die "hub contract is not deployed: $HUB"
  fi

  grant_role "$STEWARD" "STEWARD"
  for account in $(list_from_csv "$CONTRACTORS"); do
    grant_role "$account" "CONTRACTOR"
  done
  for account in $(list_from_csv "$INSPECTORS"); do
    grant_role "$account" "INSPECTOR"
  done
  grant_role "$COORDINATOR" "COORDINATOR_AI"
  grant_role "$REVIEWER" "REVIEWER_AI"
  grant_role "$RELAYER" "RELAYER"
  log "roles complete"
}

cmd_verify() {
  require_near
  if [ "$DRY_RUN" -eq 1 ]; then
    log "dry-run: verification needs live RPC reads; skipping"
    return 0
  fi
  failures=0
  printf '%-46s %s\n' "CHECK" "RESULT"

  check_account() {
    if account_exists "$1"; then
      printf '%-46s %s\n' "account $1" "PASS"
    else
      printf '%-46s %s\n' "account $1" "FAIL"
      failures=$((failures + 1))
    fi
  }
  check_contract() {
    if contract_deployed "$1"; then
      printf '%-46s %s\n' "contract $1" "PASS"
    else
      printf '%-46s %s\n' "contract $1" "FAIL"
      failures=$((failures + 1))
    fi
  }

  for account in "$DEPLOYER" "$TOKEN" "$HUB" "$STEWARD" "$SPONSOR" "$COORDINATOR" "$REVIEWER" "$RELAYER"; do
    check_account "$account"
  done
  for account in $(list_from_csv "$CONTRACTORS") $(list_from_csv "$INSPECTORS"); do
    check_account "$account"
  done

  check_contract "$TOKEN"
  check_contract "$HUB"

  if contract_deployed "$HUB"; then
    check_role() {
      rc=0
      role_present "$1" "$2" || rc=$?
      if [ "$rc" -eq 0 ]; then
        printf '%-46s %s\n' "role $2 -> $1" "PASS"
      elif [ "$rc" -eq 1 ]; then
        printf '%-46s %s\n' "role $2 -> $1" "FAIL"
        failures=$((failures + 1))
      else
        printf '%-46s %s\n' "role $2 -> $1" "SKIP (view unavailable)"
      fi
    }
    check_role "$STEWARD" "STEWARD"
    for account in $(list_from_csv "$CONTRACTORS"); do
      check_role "$account" "CONTRACTOR"
    done
    for account in $(list_from_csv "$INSPECTORS"); do
      check_role "$account" "INSPECTOR"
    done
    check_role "$COORDINATOR" "COORDINATOR_AI"
    check_role "$REVIEWER" "REVIEWER_AI"
    check_role "$RELAYER" "RELAYER"
  fi

  if [ "$failures" -gt 0 ]; then
    printf 'RESULT: FAIL (%d checks)\n' "$failures"
    exit 1
  fi
  printf 'RESULT: PASS\n'
}

case "$COMMAND" in
  accounts) cmd_accounts ;;
  token) cmd_token ;;
  hub) cmd_hub ;;
  init) cmd_init ;;
  roles) cmd_roles ;;
  verify) cmd_verify ;;
  all)
    cmd_accounts
    cmd_token
    cmd_hub
    cmd_init
    cmd_roles
    cmd_verify
    ;;
  *)
    usage
    die "unknown command: $COMMAND"
    ;;
esac

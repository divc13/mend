# Testnet deployment runbook (T08.3)

Repeatable, idempotent testnet deployment for the MEND hub, test token, agent
accounts and roles. **This runbook and its scripts are testnet-only by default.
They refuse mainnet unless three independent human gates are satisfied.**

Agents must not run these commands. Deployment is a human-approved action.

## 1. Human prerequisites (blocked-on-human)

| Item | Why |
|---|---|
| `near-cli-rs` (`near`) installed, version pinned | Signing and deployment |
| `mend-deployer.testnet` account in the local keychain with testnet NEAR | Creates accounts and deploys |
| Testnet faucet funds for deployer and contracts | Storage and calls |
| `NEAR_AI_API_KEY` + credits | AI triage/verification evidence |
| OutLayer credentials/payment | Deterministic score execution |
| Agent Market account, confirmed email, agent token | Evidence-review job |
| Sputnik DAO testnet account + proposal permissions | Budget/roster authorisation |
| Separate scoped keys for agents (T05.5) | Function-call permissions |
| Intents partner JWT (or accept disclosed no-JWT fee) | Sponsorship |
| Explicit approval for any mainnet action | Real funds |

Never paste keys into this repository, shell history, logs or reports. Signing
uses the NEAR keychain / hardware wallet flow, not environment variables.

## 2. One-time setup

```bash
# from the repository root
cp infra/env.example infra/.env
# edit infra/.env: set the deployer account and confirm the WASM paths

# Build the contracts first (contracts track):
#   cargo build --manifest-path contracts/Cargo.toml --workspace \
#     --release --target wasm32-unknown-unknown

near --version                 # record the version in the deployment report
near account view-account-summary mend-deployer.testnet \
  network-config testnet now   # must succeed before continuing
```

The scripts load `infra/.env` automatically. Override with `MEND_ENV_FILE=...`.

## 3. Commands

Always dry-run first. Dry-run prints commands and performs no RPC writes.

```bash
bash scripts/deploy-testnet.sh accounts --dry-run
bash scripts/deploy-testnet.sh accounts

bash scripts/deploy-testnet.sh token --dry-run
bash scripts/deploy-testnet.sh token

bash scripts/deploy-testnet.sh hub --dry-run
bash scripts/deploy-testnet.sh hub

bash scripts/deploy-testnet.sh init --dry-run
bash scripts/deploy-testnet.sh init

bash scripts/deploy-testnet.sh roles --dry-run
bash scripts/deploy-testnet.sh roles

bash scripts/deploy-testnet.sh verify
```

`all` runs the sequence: accounts → token → hub → init → roles → verify.

### What each command does

- **accounts** — creates the token, hub, steward, sponsor, coordinator, reviewer,
  relayer, contractor and inspector sub-accounts if missing. The DAO account is
  created by the human DAO operator with Sputnik, not by this script.
- **token** — deploys the testnet-only NEP-141 token and calls its init method
  atomically. Clearly test value; never a mainnet asset.
- **hub** — deploys the hub contract without init.
- **init** — calls the hub init method only when `is_initialized` is false.
  If the state cannot be read, it refuses to re-initialise unless
  `--force-init` is explicitly supplied.
- **roles** — grants `STEWARD`, `CONTRACTOR`, `INSPECTOR`, `COORDINATOR_AI`,
  `REVIEWER_AI` and `RELAYER` through `grant_role`, skipping existing grants and
  treating an "already granted" contract response as idempotent success.
- **verify** — checks accounts, contract code and roles, prints PASS/FAIL and
  exits non-zero on failure. It never reports SKIP as PASS.

### Idempotency guarantees

- Existing accounts are not recreated.
- Existing contract code is not redeployed without `--force-deploy`.
  **Redeploying over a live contract resets its state**; use only for a
  conscious testnet reset.
- Existing roles are not re-granted.
- Init is skipped when the contract reports initialised.
- Re-running the whole sequence is safe; the second run prints "exists",
  "already deployed", "already initialised" and "role already granted".

### Provisional contract interface

`HUB_INIT_METHOD`, `HUB_INIT_ARGS_JSON`, `HUB_ROLE_METHOD`,
`HUB_HAS_ROLE_VIEW`, `HUB_INITIALIZED_VIEW` and `TOKEN_INIT_METHOD/ARGS` are
configuration, not guesses baked into the script. Confirm them against the
frozen contracts before the first real deployment. If the contracts track changes
a name, update `infra/.env` (not the script).

## 4. Role matrix (from canonical fixtures)

| Account | Role |
|---|---|
| `steward.mend.testnet` | `STEWARD` |
| `contractor-a/b/c.mend.testnet` | `CONTRACTOR` |
| `inspector.mend.testnet`, `inspector-2.mend.testnet` | `INSPECTOR` |
| `coordinator-ai.mend.testnet` | `COORDINATOR_AI` |
| `reviewer-ai.mend.testnet` | `REVIEWER_AI` |
| `relayer.mend.testnet` | `RELAYER` |
| Sputnik DAO account | `DAO` (authorisation through proposals) |

AI roles can never approve their own scope, award or payment. Contractor and
inspector accounts must remain separate; self-hire is disclosed and not counted
as independent reputation.

## 5. Optional scoped keys

Account creation does not grant permissions. The agents/governance track adds
method-restricted function-call keys (T05.5) limited by contract, methods and
allowance. Verify restrictions with RPC inspection and record the evidence.
Never store a full-access key in plaintext.

## 6. Post-deploy verification checklist

- [ ] `deploy-testnet.sh verify` prints `RESULT: PASS`.
- [ ] Token account is the testnet mock USDC, labelled test value.
- [ ] Hub account ID matches `NEAR_HUB_ACCOUNT_ID`.
- [ ] Roles match the matrix above.
- [ ] Contract state is initialised once (`is_initialized == true`).
- [ ] Indexer processes genesis/current events and reports readiness.
- [ ] Explorer links resolve for token deployment and hub deployment.
- [ ] `.env` is not committed; `bash scripts/secret-scan.sh` passes.
- [ ] No real key appears in logs or reports.
- [ ] UI labels `LIVE TESTNET — TEST VALUE ONLY`.

Record the deployment report with: commit hash, near-cli version, account IDs,
transaction hashes, explorer links, role verification output and any SKIP with
its reason.

## 7. Mainnet refusal

By default `NEAR_NETWORK=testnet` and mainnet is refused. Enabling mainnet
requires **all** of:

1. `--allow-mainnet`
2. `MEND_ALLOW_MAINNET=true`
3. `MEND_MAINNET_HUMAN_APPROVED=true`
4. Typing `I UNDERSTAND MAINNET` interactively

Even then, every transaction requires separate human approval. Agents must never
set these values, sign mainnet transactions or deploy mainnet contracts.

## 8. Reset / rollback

- **Local/demo reset:** `bash scripts/dev.sh --fresh` (removes local volumes).
- **Testnet redeploy:** deploy to fresh account IDs rather than wiping a live
  contract. Keep the old accounts and transaction history for audit.
- **Forced redeploy on the same account:** `--force-deploy` resets state. Only do
  this for a documented testnet reset, then re-run `init` and `roles`.
- **Failed role grant:** inspect `has_role`, fix the account ID or signer, re-run
  `roles`; do not hand-edit state.

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| `near: command not found` | Install near-cli-rs and set `NEAR_BIN` if non-standard. |
| Account creation fails | Deployer exists, keychain unlocked, enough testnet NEAR. |
| WASM not found | Run the contracts WASM build; confirm `NEAR_*_WASM_PATH`. |
| Init state unknown | Inspect contract state manually; do not guess. Use `--force-init` only when truly uninitialised. |
| Role grant errors | Confirm method/role names and that caller is the owner. |
| Explorer mismatch | Testnet vs mainnet URL; confirm account ID suffix `.testnet`. |

## 10. Mainnet (explicitly out of scope for agent work)

The only mainnet action contemplated by the plan is a tiny, human-approved
Intents execution (T06.6). It uses separate accounts, separate configuration and
a written checklist. No deployment script in this repository supports autonomous
mainnet deployment.

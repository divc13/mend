# Live testnet scoped keys

Real testnet keys for the MEND agent permission boundary. This file contains
**public keys and account IDs only**. Private keys live outside the repository in
`/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json` (chmod `600`).

Network: NEAR testnet · Hub: `mend-hub.testnet` · Token: `mend-usdc.testnet`

## Accounts and key restrictions

Every agent account keeps one full-access key for provisioning/administration and
receives one additional function-call key. The scoped key is the boundary an
automated agent may use; it cannot attach a deposit and cannot leave the hub.

| Account | Role | Allowed methods | Receiver | Allowance | Scoped public key |
|---|---|---|---|---|---|
| `mend-contractor-a.testnet` | `CONTRACTOR` | `commit_bid`, `reveal_bid`, `submit_completion` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:6DAFhscnHWvcTiddT6QmMQ3xfF7pLNSTFxX75CChunkn` |
| `mend-contractor-b.testnet` | `CONTRACTOR` | `commit_bid`, `reveal_bid`, `submit_completion` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:34b7CAL3ZrNdebdgzpytz31eJAPDnYozYDTbCh5kAvNw` |
| `mend-contractor-c.testnet` | `CONTRACTOR` | `commit_bid`, `reveal_bid`, `submit_completion` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:8WRbCQGExLxV589zmrRB2vZ5ciQAVFY8stgrzmWue6Yg` |
| `mend-contractor-d.testnet` | `CONTRACTOR` | `commit_bid`, `reveal_bid`, `submit_completion` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:6JtYpdwX5qYpRCqaCiETdHw7wysfjUZkGMHupttCtnSj` |
| `mend-contractor-e.testnet` | `CONTRACTOR` | `commit_bid`, `reveal_bid`, `submit_completion` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:ARf5jhjaCaWAFEz1sYHpQwP15Nh7yLJWgJNZF4ZqYBkC` |
| `mend-inspector.testnet` | `INSPECTOR` | `accept_completion`, `inspect_durability` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:GxcbCbftFrQip1M7ZbXYLJiAJJ44HGNC1VK5B3yhwWwc` |
| `mend-inspector-2.testnet` | `INSPECTOR` | `accept_completion`, `inspect_durability` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:9uSaFitzyyqpktqz1g1X21XYhEL7owPxHpq1kRWY47yM` |
| `mend-coordinator-ai.testnet` | `COORDINATOR_AI` | `create_asset`, `create_work_order` | `mend-hub.testnet` | 0.05 NEAR | `ed25519:8i2GziZuWU6aGiirqoRqXZKX1mw922sWTNpVTdPnxu4E` |

Deliberately absent from every list: `award`, `refund`, `resolve_dispute`,
`fund_work_order`, `set_role`, `pause`, `unpause`, and all FT/NFT methods. The
inspector key is the only scoped key that can call `accept_completion`; it still
cannot `award`, `commit_bid`, `reveal_bid`, `submit_completion` or `refund`.

## Provision

```bash
node scripts/live-agents/provision-scoped-keys.mjs
```

The script:

- reads `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json` (mode 600);
- generates one fresh ed25519 key pair per account and adds a function-call key;
- writes `/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json` atomically with mode 600;
- refuses any path inside the repository and never prints a secret;
- is idempotent (`SKIP` when the stored key still verifies);
- with `--prune`, deletes hub function-call keys that are not the stored key.

## Verify restrictions via RPC

```bash
node scripts/live-agents/provision-scoped-keys.mjs --check
```

Real output:

```text
PASS mend-contractor-a.testnet role=CONTRACTOR key=ed25519:6DAFhscnHWvcTiddT6QmMQ3xfF7pLNSTFxX75CChunkn receiver=mend-hub.testnet allowance=0.05 NEAR methods=commit_bid,reveal_bid,submit_completion forbidden_claimed=none
PASS mend-contractor-b.testnet role=CONTRACTOR key=ed25519:34b7CAL3ZrNdebdgzpytz31eJAPDnYozYDTbCh5kAvNw receiver=mend-hub.testnet allowance=0.05 NEAR methods=commit_bid,reveal_bid,submit_completion forbidden_claimed=none
PASS mend-contractor-c.testnet role=CONTRACTOR key=ed25519:8WRbCQGExLxV589zmrRB2vZ5ciQAVFY8stgrzmWue6Yg receiver=mend-hub.testnet allowance=0.05 NEAR methods=commit_bid,reveal_bid,submit_completion forbidden_claimed=none
PASS mend-contractor-d.testnet role=CONTRACTOR key=ed25519:6JtYpdwX5qYpRCqaCiETdHw7wysfjUZkGMHupttCtnSj receiver=mend-hub.testnet allowance=0.05 NEAR methods=commit_bid,reveal_bid,submit_completion forbidden_claimed=none
PASS mend-contractor-e.testnet role=CONTRACTOR key=ed25519:ARf5jhjaCaWAFEz1sYHpQwP15Nh7yLJWgJNZF4ZqYBkC receiver=mend-hub.testnet allowance=0.05 NEAR methods=commit_bid,reveal_bid,submit_completion forbidden_claimed=none
PASS mend-inspector.testnet role=INSPECTOR key=ed25519:GxcbCbftFrQip1M7ZbXYLJiAJJ44HGNC1VK5B3yhwWwc receiver=mend-hub.testnet allowance=0.05 NEAR methods=accept_completion,inspect_durability forbidden_claimed=none
PASS mend-inspector-2.testnet role=INSPECTOR key=ed25519:9uSaFitzyyqpktqz1g1X21XYhEL7owPxHpq1kRWY47yM receiver=mend-hub.testnet allowance=0.05 NEAR methods=accept_completion,inspect_durability forbidden_claimed=none
PASS mend-coordinator-ai.testnet role=COORDINATOR_AI key=ed25519:8i2GziZuWU6aGiirqoRqXZKX1mw922sWTNpVTdPnxu4E receiver=mend-hub.testnet allowance=0.05 NEAR methods=create_asset,create_work_order forbidden_claimed=none
SUMMARY check passed=8 failed=0 total=8
```

Raw RPC shape (example, contractor A):

```bash
curl -s -X POST https://rpc.testnet.fastnear.com \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_access_key","finality":"final","account_id":"mend-contractor-a.testnet","public_key":"ed25519:6DAFhscnHWvcTiddT6QmMQ3xfF7pLNSTFxX75CChunkn"}}'
```

```json
{
  "jsonrpc": "2.0",
  "result": {
    "nonce": 276946641000000,
    "permission": {
      "FunctionCall": {
        "allowance": "50000000000000000000000",
        "method_names": ["commit_bid", "reveal_bid", "submit_completion"],
        "receiver_id": "mend-hub.testnet"
      }
    }
  }
}
```

## Prove boundaries with rejected transactions

A rejected transaction is evidence: the network checks the access-key scope
before the hub role logic runs.

```bash
node scripts/live-agents/prove-boundaries.mjs
```

Real output:

```text
SCOPE mend-contractor-a.testnet key=ed25519:6DAFhscnHWvcTiddT6QmMQ3xfF7pLNSTFxX75CChunkn receiver=mend-hub.testnet methods=commit_bid,reveal_bid,submit_completion
REJECTED mend-contractor-a.testnet accept_completion error="Access key does not allow method accept_completion"
REJECTED mend-contractor-a.testnet inspect_durability error="Access key does not allow method inspect_durability"
REJECTED mend-contractor-a.testnet refund error="Access key does not allow method refund"
SCOPE mend-inspector.testnet key=ed25519:GxcbCbftFrQip1M7ZbXYLJiAJJ44HGNC1VK5B3yhwWwc receiver=mend-hub.testnet methods=accept_completion,inspect_durability
REJECTED mend-inspector.testnet award error="Access key does not allow method award"
REJECTED mend-inspector.testnet commit_bid error="Access key does not allow method commit_bid"
SCOPE mend-coordinator-ai.testnet key=ed25519:8i2GziZuWU6aGiirqoRqXZKX1mw922sWTNpVTdPnxu4E receiver=mend-hub.testnet methods=create_asset,create_work_order
REJECTED mend-coordinator-ai.testnet award error="Access key does not allow method award"
REJECTED mend-coordinator-ai.testnet accept_completion error="Access key does not allow method accept_completion"
REJECTED mend-coordinator-ai.testnet refund error="Access key does not allow method refund"
SUMMARY rejected_by_key=8 total=8
EVIDENCE scripts/live-agents/boundary-proof.json
```

The full machine-readable result is committed at
`scripts/live-agents/boundary-proof.json`.

## Contractor dry run

```bash
MEND_CONTRACTOR_KEY_PATH=/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json \
  node scripts/live-agents/run-agent-dry.mjs
```

It prints the exact `commit_bid` and `reveal_bid` payloads plus the
`MEND_BID_V2` hashes for strategies A/B/C, rebound to the live accounts. The
`availableInDays` value is part of the hash and appears as `available_in_days`
in the reveal payload. With `--send`, it first views `get_work_order`; if the
work order is not `BIDDING_OPEN`, it skips instead of sending.

Live configuration for `services/contractor-agent`:

| Variable | Meaning |
|---|---|
| `MEND_NEAR_NETWORK` | must be `testnet` |
| `MEND_HUB_ACCOUNT` | defaults to `mend-hub.testnet` |
| `MEND_CONTRACTOR_STRATEGY` | `A`, `B` or `C` (default `A`; live mode is canonical-only) |
| `MEND_CONTRACTOR_KEY_PATH` | external JSON key path; never a secret value |
| `MEND_CONTRACTOR_ACCOUNT_A/B/C` | optional live account overrides |
| `MEND_CONTRACTOR_ACCOUNT` | optional override for the selected strategy |

## Risks and operational notes

- The full-access key remains on each testnet account for administration. A
  production deployment should move it offline or delete it after provisioning.
- The inspector scoped key can accept completion and therefore release the 90%
  completion payment. That is intentional and rostered; the same key cannot
  award, bid, submit completion or refund.
- Contractors can commit/reveal/submit completion with the scoped key but cannot
  `start_work`; if the live lifecycle needs `start_work`, the policy must be
  widened deliberately and re-reviewed.
- Method scoping is a blast-radius boundary, not authorization. The hub still
  enforces roles, rosters and state transitions.
- No mainnet key, account or transaction is used by these scripts.

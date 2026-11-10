# Live NEP-366 delegate proof

Real NEAR testnet proof that MEND's relayer gate and a relay transaction execute
a NEP-366 `SignedDelegateAction` end to end. No mainnet, no deposit, no user
funds.

- Network: `testnet`
- Hub: `mend-hub.testnet`
- Sender: `mend-coordinator-ai.testnet`
- Sender key: `ed25519:8i2GziZuWU6aGiirqoRqXZKX1mw922sWTNpVTdPnxu4E`
  (`create_asset`, `create_work_order`, receiver `mend-hub.testnet`, allowance
  `0.05 NEAR`)
- Relayer: `mend-relayer.testnet`
- Relayed method: `create_work_order` (one of `RELAYABLE_METHODS`)
- Work order: `WO-RELAYER-LIVE-0002` (`DRAFT`, never funded)

## Why `create_work_order`

Every existing live work order was already `CLOSED` or `REFUNDED`, so there was
no open bidding window for a safe `commit_bid`. `create_work_order` is an
allowlisted MEND method with `deposit = 0`; it creates a `DRAFT` work order and
moves no funds. The proof deliberately never funds it. This is the smallest safe
action that still exercises a real state-changing function call.

## Real transactions

| Step | Result | Transaction |
|---|---|---|
| Valid delegate (`create_work_order`) | success, creates `WO-RELAYER-LIVE-0002` | [`Getpks826tszmEhMJBSEqT5z7kH9KsrCqQrZtBXxSSju`](https://explorer.testnet.near.org/transactions/Getpks826tszmEhMJBSEqT5z7kH9KsrCqQrZtBXxSSju) |
| Replay of the exact same delegate | rejected: `DelegateActionInvalidNonce` | [`CSkWirRgSgxgJWk6msUkL48UJk9eynDmMZ2EathEZyvM`](https://explorer.testnet.near.org/transactions/CSkWirRgSgxgJWk6msUkL48UJk9eynDmMZ2EathEZyvM) |
| Wrong receiver (`mend-usdc.testnet`) | rejected: `DelegateActionAccessKeyError(ReceiverMismatch)` | [`DqCf2aMzXXUnwp2BW9TLgv3dzQB2Dm6XSE4PEgas3rkj`](https://explorer.testnet.near.org/transactions/DqCf2aMzXXUnwp2BW9TLgv3dzQB2Dm6XSE4PEgas3rkj) |
| Wrong method (`accept_completion`) | rejected: `DelegateActionAccessKeyError(MethodNameMismatch)` | [`99MvQ9ARMZND2fXatKJ3DfngUWug8XuDZkfXsEe9SCo7`](https://explorer.testnet.near.org/transactions/99MvQ9ARMZND2fXatKJ3DfngUWug8XuDZkfXsEe9SCo7) |
| Expired delegate (`maxBlockHeight` behind head) | rejected: `DelegateActionExpired` | [`GLcSZJ67iyk7Sz5K6eXfVLi6qi67AWV4Tzud31yra8QX`](https://explorer.testnet.near.org/transactions/GLcSZJ67iyk7Sz5K6eXfVLi6qi67AWV4Tzud31yra8QX) |

The committed machine-readable evidence is
`scripts/relayer-live/live-result.json`.

## Gate decisions before submission

The live script evaluates every delegate through the real
`@mend/relayer` `RelayGate`, with the live access key and a real ed25519
verifier over the NEP-366/NEP-461 Borsh hash. It does not use a fixture
verifier.

| Probe | Gate code | Gate message |
|---|---|---|
| Valid | pass | `signatureVerified=true`, `keyScoped=true`, delegate hash `e6458c9c8c2cdd433af2460a799f0f09b84e4f09de815add06d08dbe2f508c33` |
| Replay | `RELAYER_REPLAY` | `delegate nonce is not greater than the last seen nonce` |
| Wrong receiver | `RELAYER_TARGET_NOT_ALLOWED` | `delegate receiver is not the MEND hub` |
| Wrong method | `RELAYER_METHOD_NOT_ALLOWED` | `method accept_completion is not relayable` |
| Expired | `VALIDATION_ERROR` | `delegate has expired` |

## Commands and real results

Preflight / evidence check (read-only):

```bash
node scripts/relayer-live/run-live.mjs --check
```

Before any evidence existed, `--check` ran the read-only preflight:

```text
PASS preflight sender=mend-coordinator-ai.testnet key=ed25519:8i2GziZuWU6aGiirqoRqXZKX1mw922sWTNpVTdPnxu4E receiver=mend-hub.testnet methods=create_asset,create_work_order allowance=50000000000000000000000 relayer=mend-relayer.testnet relayer_balance_yocto=10000000000000000000000000 asset=BENCH-001
SUMMARY check passed preflight-only valid=0 rejections=0 (run without --check for the live proof)
```

Run the live proof once:

```bash
node scripts/relayer-live/run-live.mjs
```

Re-running the default command is idempotent: when
`scripts/relayer-live/live-result.json` exists it verifies the recorded
transactions and skips sending. `--force` starts a new proof with the next free
`WO-RELAYER-LIVE-NNNN` id.

Real output from the run that produced the committed evidence:

```text
PASS preflight sender=mend-coordinator-ai.testnet key=ed25519:8i2GziZuWU6aGiirqoRqXZKX1mw922sWTNpVTdPnxu4E receiver=mend-hub.testnet methods=create_asset,create_work_order allowance=50000000000000000000000 relayer=mend-relayer.testnet relayer_balance_yocto=9998767138805217200000000 asset=BENCH-001
GATE PASS delegateHash=e6458c9c8c2cdd433af2460a799f0f09b84e4f09de815add06d08dbe2f508c33 sender=mend-coordinator-ai.testnet receiver=mend-hub.testnet method=create_work_order workOrder=WO-RELAYER-LIVE-0002 signatureVerified=true keyScoped=true
TX submit valid method=create_work_order sender=mend-coordinator-ai.testnet relayer=mend-relayer.testnet workOrder=WO-RELAYER-LIVE-0002
TX valid hash=Getpks826tszmEhMJBSEqT5z7kH9KsrCqQrZtBXxSSju status=success
VIEW work_order=WO-RELAYER-LIVE-0002 status=DRAFT proposedBy=mend-coordinator-ai.testnet budget=100000000 escrow_funding=0 escrow_escrowed=0
GATE rejection kind=replay code=RELAYER_REPLAY message="delegate nonce is not greater than the last seen nonce"
TX rejection kind=replay hash=CSkWirRgSgxgJWk6msUkL48UJk9eynDmMZ2EathEZyvM error="ActionError(index=0 kind(DelegateActionInvalidNonce(ak_nonce=276946726000003 delegate_nonce=276946726000003)))"
GATE rejection kind=wrong-receiver code=RELAYER_TARGET_NOT_ALLOWED message="delegate receiver is not the MEND hub"
TX rejection kind=wrong-receiver hash=DqCf2aMzXXUnwp2BW9TLgv3dzQB2Dm6XSE4PEgas3rkj error="ActionError(index=0 kind(DelegateActionAccessKeyError(ReceiverMismatch(ak_receiver=mend-hub.testnet tx_receiver=mend-usdc.testnet))))"
GATE rejection kind=wrong-method code=RELAYER_METHOD_NOT_ALLOWED message="method accept_completion is not relayable"
TX rejection kind=wrong-method hash=99MvQ9ARMZND2fXatKJ3DfngUWug8XuDZkfXsEe9SCo7 error="ActionError(index=0 kind(DelegateActionAccessKeyError(MethodNameMismatch(method_name=accept_completion))))"
GATE rejection kind=expired code=VALIDATION_ERROR message="delegate has expired"
TX rejection kind=expired hash=GLcSZJ67iyk7Sz5K6eXfVLi6qi67AWV4Tzud31yra8QX error="ActionError(index=0 kind=DelegateActionExpired)"
EVIDENCE scripts/relayer-live/live-result.json
SUMMARY live proof valid=1 rejections=4 workOrder=WO-RELAYER-LIVE-0002
```

Verify the committed evidence against live RPC:

```bash
node scripts/relayer-live/run-live.mjs --check
```

```text
PASS evidence valid tx=Getpks826tszmEhMJBSEqT5z7kH9KsrCqQrZtBXxSSju method=create_work_order status=success
PASS evidence work_order=WO-RELAYER-LIVE-0002 status=DRAFT proposedBy=mend-coordinator-ai.testnet budget=100000000 escrow_funding=0 escrow_escrowed=0
PASS evidence rejection kind=replay tx=CSkWirRgSgxgJWk6msUkL48UJk9eynDmMZ2EathEZyvM error="ActionError(index=0 kind(DelegateActionInvalidNonce(ak_nonce=276946726000003 delegate_nonce=276946726000003)))"
PASS evidence rejection kind=wrong-receiver tx=DqCf2aMzXXUnwp2BW9TLgv3dzQB2Dm6XSE4PEgas3rkj error="ActionError(index=0 kind(DelegateActionAccessKeyError(ReceiverMismatch(ak_receiver=mend-hub.testnet tx_receiver=mend-usdc.testnet))))"
PASS evidence rejection kind=wrong-method tx=99MvQ9ARMZND2fXatKJ3DfngUWug8XuDZkfXsEe9SCo7 error="ActionError(index=0 kind(DelegateActionAccessKeyError(MethodNameMismatch(method_name=accept_completion))))"
PASS evidence rejection kind=expired tx=GLcSZJ67iyk7Sz5K6eXfVLi6qi67AWV4Tzud31yra8QX error="ActionError(index=0 kind=DelegateActionExpired)"
SUMMARY check passed valid=1 rejections=4
```

Relayer tests and typecheck:

```bash
npm test --workspace @mend/relayer
npm run typecheck --workspace @mend/relayer
```

```text
Test Files  1 passed (1)
     Tests  14 passed (14)
```

## Safety properties

- **Testnet only.** The script refuses any RPC host without `testnet`, any
  account not ending in `.testnet`, and any `MEND_NEAR_NETWORK` /
  `NEAR_NETWORK` value other than `testnet`:

  ```text
  $ MEND_RPC_URL=https://rpc.mainnet.near.org node scripts/relayer-live/run-live.mjs --check
  FAIL mainnet guard: RPC host rpc.mainnet.near.org is not a testnet host

  $ MEND_NEAR_NETWORK=mainnet node scripts/relayer-live/run-live.mjs --check
  FAIL mainnet guard: MEND_NEAR_NETWORK=mainnet
  ```
- **Secrets stay outside the repo.** Keys are read from
  `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json` and
  `/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json` (both mode `600`,
  both outside the repository). The script never prints, copies or commits a
  secret; errors are redacted.
- **No funds move.** Every delegate is `deposit = 0`. The valid call creates an
  unfunded `DRAFT` work order. There is no `ft_transfer`, funding call or
  mainnet call.
- **Negative probes are deliberate and safe.** The replay uses the exact
  already-consumed delegate; the wrong receiver points at
  `mend-usdc.testnet`; the wrong method is `accept_completion` (the coordinator
  is not an inspector); the expired probe never reaches the contract. If any
  probe had succeeded, the script would abort instead of recording it.

## Operational notes

- The relayer pays gas from `mend-relayer.testnet`. The sender's function-call
  key is only used to sign the delegate.
- Two unfunded proof work orders exist on testnet: `WO-RELAYER-LIVE-0001`
  (created by the first successful proof run) and `WO-RELAYER-LIVE-0002` (the
  committed evidence). Both are `DRAFT` and unfunded.
- `create_work_order` proves relaying, not gasless escrow funding. A
  function-call key cannot attach a deposit, so gasless funding remains a
  documented limitation.
- The gate's replay cache is process-local. The durable replay boundary is the
  sender access-key nonce enforced by the chain; the live replay probe shows the
  chain rejects the consumed nonce even with a fresh outer relayer transaction.
- `RelayGate` takes a `DelegateSignatureVerifier` dependency. This live script
  supplies the real NEP-366/NEP-461 Borsh hash and ed25519 verification. A
  production relayer must keep that verifier wired, or `requireSignature`
  correctly refuses to sponsor.
- `mend-relayer.testnet` currently uses a full-access testnet key to pay gas.
  That key is external to the repo. A production relayer should use a dedicated
  low-balance hot key or a restricted gas key.
- `Node.js >= 22` is required for `JSON.rawJSON` (used for the contract `u64`
  deadline fields) and for the `tsx` TypeScript import bridge.

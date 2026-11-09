# @mend/near-client

Typed, offline-first NEAR access for MEND agents.

## What it provides

- `loadNearClientConfig` — typed testnet/mainnet profile. Live calls are off unless `MEND_LIVE_CALLS=1`; mainnet also requires `MEND_MAINNET_APPROVED=1`.
- `NearRpcClient` — JSON-RPC `view`, `viewAccount`, `viewAccessKey(s)` and `blockHeight`; `call` requires an explicitly supplied external signer and refuses deposit-bearing calls.
- `parseMendEvents` — parses `EVENT_JSON:` logs with `standard: "mend"` and ignores unknown/malformed events.
- `guardUntrustedText` / `assertTrustedFieldsUnchanged` — prompt-injection scanning, sanitisation and protected-field comparison (recipient, role, scope hash, payment rule, acceptance).
- `buildFunctionCallKeyPlan` — explicit receiver, non-empty method list, finite allowance, public key only. Reviewer agents deliberately receive no hub key.
- `verifyFunctionCallKey` / `findUnsafeAgentKeys` — checks an RPC access-key view and proves an agent key cannot call `accept_completion`, `award`, `refund` or other payment methods.

## Security boundaries

- This package never stores or generates a private key. The signer is injected at the edge by an operator process.
- A function-call key cannot attach a deposit. **Gasless escrow funding is impossible with a function-call key**; funding requires a funded sponsor wallet, a full-access wallet, or Intents/1Click.
- Method scoping reduces blast radius but is not authorization. The hub contract enforces roles.

## Test

```bash
npm test && npm run typecheck
```

All default tests are offline. No RPC or transaction is made.

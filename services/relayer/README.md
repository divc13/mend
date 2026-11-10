# NEP-366 relayer gate

Offline policy gate for gasless zero-deposit MEND hub calls. Uses `Delegate` (not `DelegateV2`) with exactly one non-delegate `FunctionCall`.

## Rejections enforced

- kill switch active
- missing/invalid signature, no verifier, or failed verification
- sender not on allowlist
- receiver not the configured MEND hub (arbitrary contract)
- not exactly one action, or action is not `FunctionCall`
- method outside `create_work_order`, `commit_bid`, `reveal_bid`, `submit_completion`
- deposit other than `0`
- gas zero/excess
- expired or over-long `maxBlockHeight` TTL
- non-advancing/too-far nonce
- replayed delegate hash
- full-access delegate key, wrong key receiver/method, empty method list, unlimited allowance
- malformed base64/JSON args or invalid work-order id
- per-sender sliding-window rate limit, daily call cap, daily sponsored-budget cap
- per-work-order call cap, duplicate `create_work_order`, per-work-order budget cap

Every rejection is recorded as a `relayer_rejected` event. Accepted delegates return the outer transaction shape for a relayer hot key to sign; this package never holds a key.

## Honest limits

- Offline tests inject a deterministic signature verifier and recorded access-key view. The gate still takes a `DelegateSignatureVerifier` dependency; the live harness supplies the real Borsh `SignedDelegateAction` decoding, ed25519 verification over the NEP-366/NEP-461 hash, and fetched access key.
- A live testnet proof now exists: `scripts/relayer-live/run-live.mjs` relayed a real `create_work_order` and recorded chain rejections for replay, wrong receiver, wrong method and expiry. See `scripts/relayer-live/LIVE-RELAYER.md`.
- The relayer account needs a separate hot key (full-access or full-access gas key) with a minimal balance. The testnet proof uses an external full-access testnet key; production key custody and rotation remain operational work.
- Gasless escrow funding is impossible with a function-call key; this relayer only forwards zero-deposit methods.
- Protocol nonce is authoritative; the replay cache is defence in depth, not a substitute for contract idempotency.

```bash
npm test && npm run typecheck
```

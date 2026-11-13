# Live Intents test — same-chain USDT → USDC on NEAR

**Status:** `PENDING_DEPOSIT` (signed quote allocated; no funds moved)
**Mainnet only — real funds. No testnet.**
**Scope:** same-chain, cross-token swap. This does **not** prove cross-chain sponsorship.

## Current quote (2026-11-13T12:25Z)

- Quote kind: `LIVE_DEPOSIT_REQUEST` (signed 1Click response, signature verified)
- Correlation ID: `49aa2ea9-59e5-4b9e-b37a-ba720f79d61c`
- Origin: `0.15 USDT` on NEAR (`nep141:usdt.tether-token.near`)
- Destination: USDC on NEAR (`nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`)
- Recipient / refund: `divyanshc.near`
- Expected output: `0.145411 USDC`
- Minimum output: `0.144683 USDC`
- Withdraw fee: `0.004427 USDC`
- Deposit address: `3229d3894d42123c1fb93ee8c0c46536f7d9d3b771672198a182fd0632fc2a63`
- Deposit memo: none
- Deposit deadline: `2026-11-16T13:25:01.933Z`
- Signature verified by `@mend/intents-client`: yes

The signed raw response is in `live-quote.json`. A status snapshot is in
`status-pending.json` (`PENDING_DEPOSIT`, no origin/destination transaction
hashes). The earlier quote (`0e3f6b9e...c5265`, correlation `ee149223-...`) is
preserved as `live-quote-2026-11-13T1126Z.json`; its one-hour request deadline
has passed, so it is historical evidence only and is not the deposit target.

## Recipient readiness — USDC storage is missing

`checkNearRecipientReadiness` against mainnet returned `exists:true` but
`storageRegistered:false` for USDC, with `storageBalance:null`. The raw check is
in `recipient-readiness.json`. 1Click delivers USDC with a NEP-141 transfer, so
`divyanshc.near` must register USDC storage before the swap can land there.
The quote was therefore created with the explicit diagnostic escape hatch
`allowUnverifiedRecipient: true`; this is a caveat, not a claim that the
recipient is ready. The deposit script now performs the storage registration
first.

## Why four transactions

1Click returns a **fresh implicit NEAR account** as the deposit address. It does
not exist yet, and USDT storage is not registered for it. The final recipient
also has no USDC storage. The human must sign:

0. Register USDC storage for `divyanshc.near` (`0.00125 NEAR`) if missing.
1. Create the implicit deposit account with a small NEAR transfer (`0.003 NEAR`;
   this covers the account's own storage).
2. Register USDT storage for it (`0.00125 NEAR`).
3. Send exactly `0.15 USDT` with `ft_transfer`.

The user signs all four transactions. MEND never signs or sends a mainnet
transaction. The temporary account receives only the exact USDT and small NEAR
storage; the final USDC goes to `divyanshc.near`.

## One command

```bash
# Read-only preflight: checks USDC storage and prints the warning.
bash scripts/intents-live/run-deposit.sh --check

# Sign and send after reviewing the warning.
bash scripts/intents-live/run-deposit.sh
```

It prints the warning, asks for `YES`, checks USDC storage, then runs the
transactions below. It never stores a key; `near` uses your local keychain.

## Commands (run in this order, signed by `divyanshc.near`)

```bash
# 0. Register USDC storage for the final recipient, if missing.
near account manage-storage-deposit \
  17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1 \
  deposit divyanshc.near '0.00125 NEAR' \
  sign-as divyanshc.near network-config mainnet sign-with-keychain send

# 1. Create the implicit deposit account. Keep this small; it is a real NEAR transfer.
near tokens divyanshc.near send-near \
  3229d3894d42123c1fb93ee8c0c46536f7d9d3b771672198a182fd0632fc2a63 \
  '0.003 NEAR' \
  network-config mainnet sign-with-keychain send

# 2. Register USDT storage for the deposit account.
near account manage-storage-deposit usdt.tether-token.near deposit \
  3229d3894d42123c1fb93ee8c0c46536f7d9d3b771672198a182fd0632fc2a63 \
  '0.00125 NEAR' \
  sign-as divyanshc.near network-config mainnet sign-with-keychain send

# 3. Send exactly 0.15 USDT.
near tokens divyanshc.near send-ft \
  usdt.tether-token.near \
  3229d3894d42123c1fb93ee8c0c46536f7d9d3b771672198a182fd0632fc2a63 \
  '0.15' memo '' \
  network-config mainnet sign-with-keychain send
```

If `near` does not have the `divyanshc.near` key, import it with
`near account import-account` or use a wallet that can sign these function calls.
Do not send USDT before steps 0–2; delivery or the transfer will fail.

## Verification after sending

```bash
curl -sS \
  'https://1click.chaindefuser.com/v0/status?depositAddress=3229d3894d42123c1fb93ee8c0c46536f7d9d3b771672198a182fd0632fc2a63'
```

Expect the status to move from `PENDING_DEPOSIT` to `KNOWN_DEPOSIT_TX` /
`PROCESSING` / `SUCCESS`. Record the deposit transaction hash and the destination
transaction hash. If the status becomes `INCOMPLETE_DEPOSIT` or `REFUNDED`, do
not credit the swap; record the raw status and reason.

## Signing blocker

The agent environment has no mainnet private key for `divyanshc.near`; the
NEAR CLI keychain contains only testnet credentials. The agent must not request
or handle a seed phrase/private key. The four transactions above therefore
remain **`BLOCKED_ON_HUMAN`** until the account owner signs them. The agent can
poll the status and verify the destination transaction once the deposit exists.

## Honest gate note

F05 remains **`PARTIAL`** until a real deposit/settlement is observed. A completed
same-chain cross-token swap would still not prove cross-chain sponsorship; a
true cross-chain leg needs a destination address on another chain (for example
Base) and would be a separate test.

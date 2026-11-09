# Payment / NEAR Intents fixtures

**MAINNET ONLY — real funds. No testnet.**

These files support offline tests and judging for `@mend/intents-client`. They
are not payments and must not be sent to a deposit address.

Provenance for every file is in [`manifest.json`](./manifest.json):

- `RECORDED` — captured from the live 1Click API on 2026-11-09.
- `RECORDED_SUBSET` / `RECORDED_EXCERPT` — honest subsets of a live response.
- `COMPOSED_SYNTHETIC` — real signed quote plus synthetic swap details.
- `SCHEMA_SYNTHETIC` — documented shape only; no live sample exists.
- `DERIVED_TAMPERED` — deliberately modified to test signature rejection.

Key facts reflected here:

- Base URL `https://1click.chaindefuser.com`, API v0, OpenAPI 0.1.10.
- Quote success is HTTP 201. `dry:true` has no `depositAddress`, `deadline`,
  `timeWhenInactive` or `depositMemo`.
- Status enum is exactly `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`,
  `SUCCESS`, `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED`. There is no `EXPIRED`
  status; MEND computes expiry client-side.
- `explorerUrl` can be empty even on `SUCCESS`; links are built from chain +
  hash.
- `sessionId` is not returned by status. `depositAddress` is the reconciliation
  key.
- A detected deposit is never a completed sponsorship. Only a verified
  `SUCCESS` with destination transaction, amount, recipient, work-order and
  escrow checks may credit a work order.

# @mend/intents-client

Real 1Click / NEAR Intents client for MEND sponsorship (F05, T06).

**MAINNET ONLY — real funds. No testnet.**

## What it does

- Supported-asset discovery (`GET /v0/tokens`), zod-validated.
- Quotes (`POST /v0/quote`) and `dry:true` previews, zod-validated and
  ed25519-signature-verified with the pinned Intents SDK `0.1.26`.
- Deposit instructions with explicit dry/live labeling. A dry quote can never
  be rendered as a payment.
- Status polling with backoff, timeouts and a client-only expiry because 1Click
  has no `EXPIRED` status.
- Reconciliation against the work order, recipient, asset, amount, destination
  transaction, escrow funding, duplicates, refunds and failures.
- Explorer links per chain, labeled mainnet-only. The API's `explorerUrl` is
  used when non-empty; otherwise MEND builds the link.
- Read-only NEAR recipient readiness check (`view_account` +
  `storage_balance_of`) before enabling live sponsorship.
- Mainnet guard: non-dry quotes require `MEND_ALLOW_MAINNET=true` **and**
  `confirmMainnet: true`. No signing or transaction-sending code exists here.

## Usage

```ts
import { OneClickClient, buildQuoteView } from '@mend/intents-client';

const client = new OneClickClient({ apiKey: process.env.INTENTS_API_KEY });

const dry = await client.getDryQuote({
  originAsset: BASE_USDC,
  destinationAsset: NEAR_USDC,
  amount: '150000',
  recipient: 'mend.near',
  refundTo: sponsorBaseAddress,
});
const view = buildQuoteView(dry);
// view.quoteKind === 'DRY_PREVIEW'
// view.canBePresentedAsPayment === false
// view.deposit === null
```

A live deposit request additionally needs the environment flag, an explicit
per-call confirmation, and a passing NEAR recipient readiness check:

```ts
const readiness = await checkNearRecipientReadiness({
  accountId: 'mend.near',
  tokenAccount: NEAR_USDC_CONTRACT,
});

const live = await client.createDepositQuote(params, {
  confirmMainnet: true,
  recipientReadiness: readiness,
});
```

The readiness check verifies `view_account` and NEP-141 `storage_balance_of`.
A quote succeeding does not prove either. `allowUnverifiedRecipient: true` is a
diagnostic escape hatch and must never enable live sponsorship.

If no partner JWT is configured, pass `authenticated: false` to
`buildQuoteView` so the UI discloses the possible 25 bps unauthenticated fee.

## Smoke test

```bash
npm run smoke            # skipped, exit 0
npm run smoke -- --dry   # live read-only tokens + dry quote + status
```

The smoke script never creates a non-dry quote, never calls `deposit/submit`,
never signs and never spends funds. If the network is unavailable it exits 0
with an explicit `SKIPPED` message rather than a fake result.

## Tests

Tests use recorded/synthetic fixtures only. No network by default and no
secrets. Fixture provenance is documented in
`fixtures/payments/manifest.json`.

```bash
npm test
npm run typecheck
```

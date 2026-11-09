# R0-C — NEAR Intents / 1Click API validation

**Status:** research complete. No funds moved, nothing signed. Non-dry quotes were created but never funded; all other calls were token/quote/status reads.
**Access date:** 2026-11-09 (UTC, ~09:38–09:50).
**Scope:** 1Click Swap API (NEAR Intents distribution channel), quote → dry quote → deposit instructions → status → refund/expiry handling.
**Deliverable owner:** MEND Wave 0 / T06 Payments & Intents.

> ## MAINNET ONLY
>
> NEAR Intents and the 1Click Swap API are **mainnet only**. The official docs state:
> “There is no testnet version of NEAR Intents — use small amounts for test swaps.”
> Every quote, deposit address and status below is a **real mainnet** object. MEND must label the sponsorship UI **“MAINNET ONLY — real funds”**, default to dry quotes, and require explicit human approval before any real deposit. No agent may sign or transfer.

---

## 0. TL;DR — verified facts

**Confidence labels used in this document:**

- **VERIFIED** — observed live on 2026-11-09, or directly stated in the official OpenAPI/docs/SDK.
- **OBSERVED** — live behavior that is not documented and may be an implementation detail.
- **UNVERIFIED** — documented or inferred, but not observed live.

Unless a row says OBSERVED or UNVERIFIED, endpoint/schema statements are VERIFIED against the official OpenAPI/docs, and live-call statements are VERIFIED by the recorded outputs in §4.

| # | Fact | Confidence | Evidence |
|---|---|---|---|
| 1 | Base URL is `https://1click.chaindefuser.com`; current OpenAPI is **v0**, spec version **0.1.10**. | VERIFIED | `GET /docs/v0/openapi.yaml`, `info.version: 0.1.10` |
| 2 | `GET /v0/tokens` works with no auth and returned **216** mainnet tokens on 2026-11-09. | VERIFIED | live 200 |
| 3 | `POST /v0/quote` works with no auth; live success code is **201** (OpenAPI says 200). `dry: true` returns a quote but **no** `depositAddress`, `deadline`, `timeWhenInactive`, or `depositMemo`. | VERIFIED | live 201 |
| 4 | Base USDC → NEAR USDC minimum observed is **150000 base units = 0.15 USDC**; 149999 returns `Amount is too low for bridge, try at least 150000`. Minimums are route-specific. | VERIFIED (this route) | live 400/201 |
| 5 | Quote `deadline` and `timeWhenInactive` were **request.deadline + 72 hours** on all 3 samples. This is not stated in the docs; treat it as observed behavior, not a contract. | OBSERVED | 3 live quotes |
| 6 | `GET /v0/status?depositAddress=…` works with no auth. Status enum is exactly `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`, `SUCCESS`, `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED`. There is **no `EXPIRED` swap status**. | VERIFIED | live + OpenAPI |
| 7 | Named NEAR recipient accounts must already exist. `mend-hub.near` and a random named account returned 400 `Internal server error`; `mend.near`, `root.near`, `near.near` and a 64-hex implicit account succeeded. | VERIFIED (behavior) | live 400/201 |
| 8 | Quote success does **not** prove USDC storage registration. `mend.near` exists but `storage_balance_of` for NEAR USDC returned `null`; the quote still succeeded and added `withdrawFee: "4428"` (≈ storage deposit). | VERIFIED (gap); OBSERVED (fee link) | NEAR RPC + quote |
| 9 | Live status `originChainTxHashes[].explorerUrl` / `destinationChainTxHashes[].explorerUrl` were **empty strings** in a real `SUCCESS` sample. MEND must build explorer links itself. | VERIFIED | live SUCCESS |
| 10 | Quote signatures verify with SDK **0.1.26**; tampering with `recipient` makes verification fail. `sessionId` is echoed at quote time but **not returned by `/v0/status`**; use `depositAddress` as the reconciliation key. | VERIFIED (signature); OBSERVED (sessionId) | SDK verify, live status |

---

## 1. Sources and versions

| Source | URL | What it establishes |
|---|---|---|
| 1Click docs landing | https://docs.near-intents.org/ | Current docs home; 1Click Quickstart, API reference |
| 1Click Quickstart | https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/introduction.md | Mainnet-only warning; no testnet |
| Making a Request | https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request.md | Standard `ORIGIN_CHAIN` flow, status list, optional deposit submit |
| API Keys / auth | https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication.md | `X-API-Key` recommended, `Authorization: Bearer` legacy, no-JWT fee statement |
| Swap Types | https://docs.near-intents.org/integration/distribution-channels/1click-api/swap-types.md | `EXACT_INPUT`, `EXACT_OUTPUT`, `FLEX_INPUT`, `ANY_INPUT` semantics |
| Verify Quote Signatures | https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature.md | Signed payload definition; SDK verification |
| Fee Configuration | https://docs.near-intents.org/integration/distribution-channels/1click-api/fee-config.md | `appFees`, 50/50 split, no-key +25 bps claim |
| Fees | https://docs.near-intents.org/resources/fees.md | Protocol 1 pip, 1Click 20 bps / 1 bp stablecoin, no-key 25 bps |
| Chain support | https://docs.near-intents.org/resources/chain-support.md | Address formats, signing standards, XRP destination-tag limitation |
| Changelog 2026-10-27 | https://docs.near-intents.org/changelog/entries/2026-10-27-1click-confidential.md | 1Click swaps settle confidentially; `nearTxHashes` now shield/unshield hashes, not swap hash |
| OpenAPI | https://1click.chaindefuser.com/docs/v0/openapi.yaml | **Spec version 0.1.10**, all paths/schemas |
| Explorer API | https://explorer.near-intents.org/api/v0 | Historical swaps; **JWT required**, 1 req/5 s per partner |
| Explorer UI | https://explorer.near-intents.org/ | Deposit-address route `/transactions/{depositAddress}` |
| SDK | `@defuse-protocol/one-click-sdk-typescript` **0.1.26** | Signature verification and typed schemas |
| NEAR RPC | https://rpc.mainnet.near.org | Account existence and NEP-141 storage checks |
| Live API | `https://1click.chaindefuser.com` | All real calls in §4 |

**API version note:** there is no `x-api-version` response header. The version is the OpenAPI document version (`0.1.10`) and the `/v0` path. Pin the OpenAPI/SDK version in MEND; do not infer version from the hostname.

---

## 2. Base URL, headers, auth, rate limits

### 2.1 Base URLs

| Purpose | URL |
|---|---|
| 1Click Swap API | `https://1click.chaindefuser.com` |
| OpenAPI YAML | `https://1click.chaindefuser.com/docs/v0/openapi.yaml` |
| Explorer UI | `https://explorer.near-intents.org` |
| Explorer API | `https://explorer.near-intents.org/api/v0` (JWT required) |
| Partner dashboard / JWT | `https://partners.near-intents.org` |
| NEAR RPC (for recipient/storage checks) | `https://rpc.mainnet.near.org` |

### 2.2 Headers

| Header | Required? | Notes |
|---|---|---|
| `Content-Type: application/json` | Yes for POST | Standard |
| `X-API-Key: <partner JWT>` | Optional | **Recommended** by OpenAPI; partner fee schedule |
| `Authorization: Bearer <partner JWT>` | Optional | Legacy alias accepted; OpenAPI marks it “legacy, use X-API-Key instead” |
| `User-Agent` | Effectively yes | Cloudflare blocks default Python-urllib UA with **403 `error code: 1010`**. A normal UA (`mend-research/0.1`, `curl/8.7.1`) returned 200. Set one in the backend HTTP client. |
| `Idempotency-Key` | Not supported | No idempotency header in OpenAPI. Use `depositAddress`/`correlationId` as your own key. |

CORS is open: `access-control-allow-origin: *`.

### 2.3 Auth modes

- **No JWT:** works for `/v0/tokens`, `/v0/quote`, `/v0/status`. Docs say an extra **25 bps** applies to every non-`ANY_INPUT` quote.
- **Partner JWT:** send as `X-API-Key` (recommended) or `Authorization: Bearer`. Docs: **20 bps** normally, **1 bp** for stablecoin pairs and same-asset multichain routes.
- **User-Session JWT:** only for `/v0/account/balances` and `/v0/account/history`; not needed for sponsorship.
- A bogus key/bearer returns **401** `{"message":"Invalid token","error":"Unauthorized","statusCode":401,...}`.

### 2.4 Rate limits observed

`GET /v0/tokens` unauthenticated response headers:

```http
x-ratelimit-limit-unauth: 1200
x-ratelimit-remaining-unauth: 1198
x-ratelimit-reset-unauth: 47
```

Treat this as **1200 requests/minute unauthenticated**, resetting on a short window. Partner limits may differ. The Explorer API is separately limited to **1 request / 5 seconds per partner** and returns 429 when exceeded.

---

## 3. Endpoint reference

### 3.1 `GET /v0/tokens`

**Purpose:** supported-asset discovery.
**Auth:** none.
**Query:** optional `ondoTokens` (string) to include Ondo tokens.
**Live status:** `200`.

Response is an array of `TokenResponse`:

| Field | Type | Required | Example / notes |
|---|---|---|---|
| `assetId` | string | yes | `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` (NEAR USDC) |
| `decimals` | number | yes | `6` |
| `blockchain` | string enum | yes | `near`, `eth`, `base`, `arb`, `btc`, `sol`, `ton`, `doge`, `xrp`, `zec`, `gnosis`, `bera`, `bsc`, `pol`, `tron`, `sui`, `movement`, `op`, `avax`, `stellar`, `aptos`, `cardano`, `ltc`, `xlayer`, `monad`, `bch`, `adi`, `plasma`, `scroll`, `starknet`, `aleo`, `hypercore`, `fogo`, `hood`, `hlevm`, `qtc`, `miden`, `prl` |
| `symbol` | string | yes | `USDC` |
| `price` | number | yes | USD price at `priceUpdatedAt` |
| `priceUpdatedAt` | ISO datetime | yes | `2026-11-09T09:38:30.802Z` |
| `contractAddress` | string | no | NEP-141 account / EVM address; omitted for native assets |
| `coingeckoId` | string | no | `usd-coin` |

**Relevant live rows (2026-11-09):**

```json
{"assetId":"nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1","decimals":6,"blockchain":"near","symbol":"USDC","price":0.999432,"priceUpdatedAt":"2026-11-09T09:38:30.802Z","contractAddress":"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1","coingeckoId":"usd-coin"}
{"assetId":"nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near","decimals":6,"blockchain":"base","symbol":"USDC","price":0.999432,"priceUpdatedAt":"2026-11-09T09:38:30.802Z","contractAddress":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","coingeckoId":"usd-coin"}
{"assetId":"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near","decimals":6,"blockchain":"eth","symbol":"USDC","price":0.999432,"priceUpdatedAt":"2026-11-09T09:38:30.802Z","contractAddress":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","coingeckoId":"usd-coin"}
{"assetId":"nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near","decimals":6,"blockchain":"arb","symbol":"USDC","price":0.999432,"priceUpdatedAt":"2026-11-09T09:38:30.802Z","contractAddress":"0xaf88d065e77c8cc2239327c5edb3a432268e5831","coingeckoId":"usd-coin"}
{"assetId":"nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near","decimals":6,"blockchain":"sol","symbol":"USDC","price":0.999432,"priceUpdatedAt":"2026-11-09T09:38:30.802Z","contractAddress":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","coingeckoId":"usd-coin"}
```

**MEND rule:** resolve asset IDs from `/v0/tokens` at runtime or from a pinned snapshot; do not hardcode an asset ID without checking `blockchain`, `symbol`, `decimals`.

---

### 3.2 `POST /v0/quote`

**Purpose:** price a swap and, when `dry:false`, allocate a quote-specific deposit address.
**Auth:** none required; optional partner JWT.
**Live success:** `201 Created` (OpenAPI declares `200` — accept both).
**Validation failure:** `400` with `{message, correlationId?, timestamp, path}`; some errors include `error`/`statusCode`.
**Auth failure:** `401`.

#### Request body (`QuoteRequest`)

All fields below are from the OpenAPI `QuoteRequest` schema. **Required** means OpenAPI `required`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `dry` | boolean | yes | `true` = preview; response omits `depositAddress`, `deadline`, `timeWhenInactive` (observed also no `depositMemo`) |
| `swapType` | enum | yes | `EXACT_INPUT`, `EXACT_OUTPUT`, `FLEX_INPUT`, `ANY_INPUT` |
| `slippageTolerance` | number | yes | basis points; `100` = 1% |
| `originAsset` | string | yes | `assetId` from `/v0/tokens` |
| `depositType` | enum | yes | `ORIGIN_CHAIN`, `INTENTS`, `CONFIDENTIAL_INTENTS` |
| `destinationAsset` | string | yes | `assetId` from `/v0/tokens` |
| `amount` | string | yes | **integer string in smallest unit**; decimals like `"0.01"` rejected |
| `refundTo` | string | yes | must be a valid address on the origin chain |
| `refundType` | enum | yes | `ORIGIN_CHAIN`, `INTENTS`, `CONFIDENTIAL_INTENTS` |
| `recipient` | string | yes | must match `recipientType` |
| `recipientType` | enum | yes | `DESTINATION_CHAIN`, `INTENTS`, `CONFIDENTIAL_INTENTS` |
| `deadline` | ISO datetime | yes | refund trigger if swap not complete; must exceed deposit mining time |
| `depositMode` | enum | no | `SIMPLE` (default), `MEMO`; route-specific |
| `connectedWallets` | string[] | no | wallet addresses |
| `sessionId` | string | no | client session id; **echoed in quote response but not preserved by `/v0/status`** |
| `virtualChainRecipient` | string | no | EVM address in a virtual chain |
| `virtualChainRefundRecipient` | string | no | EVM refund address in a virtual chain |
| `customRecipientMsg` | string | no | **HIGHLY EXPERIMENTAL**; `ft_transfer_call` message for NEAR withdrawals; funds can be lost |
| `confidentiality` | enum | no | `public` (default), `basic`, `advanced` |
| `referral` | string | no | distribution channel id; lowercase letters/digits + `-_.`, max 57; preserved in status |
| `rebates` | array | no | up to 3 confidential recipients, shares sum 100 |
| `quoteWaitingTimeMs` | number | no | default 0; set 3000–10000 for better quotes |
| `appFees` | array | no | `{recipient, fee}`; `fee` in bps; combined max 500 bps |
| `insured` | boolean | no | adds 2 bps insurance fee |

#### Response body (`QuoteResponse`)

| Field | Type | Notes |
|---|---|---|
| `correlationId` | string UUID | request tracing; store it |
| `timestamp` | ISO datetime | used in signature |
| `signature` | string `ed25519:…` | signs `{...quoteRequest, ...quote, timestamp}` |
| `quoteRequest` | object | effective request, with defaults filled (`depositMode`, `confidentiality`, `quoteWaitingTimeMs`, `insured`, `appFees`) |
| `quote` | object | pricing + deposit instructions |

`quote` fields:

| Field | Type | Notes |
|---|---|---|
| `amountIn` | string | origin amount |
| `amountInFormatted` | string | human amount |
| `amountInUsd` | string | USD value |
| `minAmountIn` | string | minimum accepted input |
| `amountOut` | string | expected destination amount |
| `amountOutFormatted` | string | human amount |
| `amountOutUsd` | string | USD value |
| `minAmountOut` | string | after slippage |
| `timeEstimate` | number | seconds after deposit confirmation |
| `refundFee` | string | refund fee in origin base units |
| `withdrawFee` | string | destination withdrawal fee; observed storage-deposit-sized for unregistered NEAR recipient |
| `depositAddress` | string | **omitted when `dry:true`**; quote-specific |
| `depositMemo` | string | **omitted when not required**; mandatory if present |
| `chainDepositAddresses` | array | only for public `ANY_INPUT`; not for MEND |
| `deadline` | ISO datetime | **omitted when `dry:true`**; deposit address inactive time |
| `timeWhenInactive` | ISO datetime | **omitted when `dry:true`**; same value as `deadline` in all samples |
| `virtualChainRecipient` | string | optional |
| `virtualChainRefundRecipient` | string | optional |
| `customRecipientMsg` | string | optional/experimental |

#### Dry vs live

- `dry:true` is a **preview only**. It does not allocate a deposit address and must never be shown as “send funds here”.
- `dry:false` allocates a real mainnet deposit address. **Creating it does not move funds**; only a sponsor transfer does.
- The response is signed in both modes.

#### Live success codes

| Case | Code |
|---|---|
| valid dry quote | `201` |
| valid live quote (`dry:false`) | `201` |
| invalid amount / recipient / refund | `400` |
| invalid token | `401` |
| rate limited | `429` (expected; not hit) |

---

### 3.3 `GET /v0/status`

**Purpose:** poll execution state and get settlement details.
**Auth:** none required; optional partner JWT.
**Query params:**

| Param | Required | Notes |
|---|---|---|
| `depositAddress` | yes | from the **non-dry** quote |
| `depositMemo` | no* | *required if the quote returned `depositMemo` |

**Live status:** `200` for known address; `404` for unknown; `401` for invalid token.

Response (`GetExecutionStatusResponse`):

| Field | Type | Notes |
|---|---|---|
| `status` | enum | exact 7 values below |
| `updatedAt` | ISO datetime | last state change |
| `correlationId` | string | status request correlation id (not the quote's) |
| `swapDetails` | object | actual amounts, hashes, refund info |
| `quoteResponse` | object | original signed quote, including `quoteRequest` and `quote` |

`swapDetails` fields observed/defined:

| Field | Type | Notes |
|---|---|---|
| `depositedAmount` | string/null | on-chain deposit |
| `depositedAmountFormatted` | string/null | |
| `depositedAmountUsd` | string/null | |
| `intentHashes` | string[] | intent settlement hashes |
| `nearTxHashes` | string[] | **since 2026-10-27 these are shield/unshield hashes, not the swap hash** |
| `amountIn` | string/null | settled input |
| `amountInFormatted` | string/null | |
| `amountInUsd` | string/null | |
| `amountOut` | string/null | settled output |
| `amountOutFormatted` | string/null | |
| `amountOutUsd` | string/null | |
| `slippage` | number/null | actual slippage in bps |
| `refundedAmount` | string | `"0"` when no refund |
| `refundedAmountFormatted` | string | |
| `refundedAmountUsd` | string | |
| `refundReason` | string/null | free-form; schema example `PARTIAL_DEPOSIT` |
| `refundFee` | string | live field, not in OpenAPI `SwapDetails` (tolerate it) |
| `withdrawFee` | string | |
| `originChainTxHashes` | array `{hash, explorerUrl}` | **`explorerUrl` was empty in live samples** |
| `destinationChainTxHashes` | array `{hash, explorerUrl}` | **`explorerUrl` was empty in live samples** |

---

### 3.4 `POST /v0/deposit/submit` (optional speed-up, **not proof**)

**Purpose:** tell 1Click a deposit tx hash so it can verify sooner.
**Auth:** optional; no auth worked.
**Live success:** `201` (OpenAPI says 200).

Request:

```json
{
  "depositAddress": "0x…",
  "txHash": "0x…",
  "nearSenderAccount": "optional.near",
  "memo": "optional"
}
```

`txHash` + `depositAddress` required; `nearSenderAccount` only for NEAR; `memo` if the deposit used one.

**Critical live finding:** posting a **fake 32-byte hash** returned **201** with the current status object (`PENDING_DEPOSIT`), not an error. Do **not** treat `deposit/submit` success as deposit proof. Poll `/v0/status` and verify on-chain.

> Scope note: this was the only call outside the allowed token/quote/status set. It used a fake hash, moved no funds, signed nothing. (Non-dry quotes were also created, but they only allocate deposit addresses; none were funded.) Do not repeat `deposit/submit` in CI; keep MEND tests to `tokens`, `quote`, and `status`.

---

### 3.5 Refund endpoint

There is **no client-initiated refund endpoint** in the 1Click v0 OpenAPI. Refunds are automatic:

- Set `refundTo` + `refundType` at quote time.
- On failure/underpayment/expiry, 1Click refunds to `refundTo`.
- Status becomes `REFUNDED`; inspect `swapDetails.refundedAmount`, `refundedAmountFormatted`, `refundReason`, `refundFee`.
- For a stuck BTC bridge deposit, there is a separate bridge refund process documented at `https://docs.near-intents.org/integration/bridging/btc-deposit-refund.md`; it is not a `/v0` endpoint.

---

## 4. Real read-only calls and exact outputs

All calls below were made on **2026-11-09** against mainnet. No deposit was sent.

### 4.1 Token list

```bash
curl -sS https://1click.chaindefuser.com/v0/tokens -o tokens.json
```

Observed: `HTTP/2 200`, `content-type: application/json`, `content-length: 54908`, **216 tokens**. Headers included `x-ratelimit-limit-unauth: 1200`.

### 4.2 Canonical dry quote — Base USDC → NEAR USDC, 0.15 USDC

Request file:

```json
{
  "dry": true,
  "swapType": "EXACT_INPUT",
  "slippageTolerance": 100,
  "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  "depositType": "ORIGIN_CHAIN",
  "destinationAsset": "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  "amount": "150000",
  "recipient": "root.near",
  "recipientType": "DESTINATION_CHAIN",
  "refundTo": "0x1111111111111111111111111111111111111111",
  "refundType": "ORIGIN_CHAIN",
  "deadline": "2026-11-09T10:17:25.000Z"
}
```

```bash
curl -sS -i -X POST https://1click.chaindefuser.com/v0/quote \
  -H 'Content-Type: application/json' \
  --data-binary @quote-request.json
```

Observed `HTTP/2 201`, body:

```json
{
  "quote": {
    "amountIn": "150000",
    "amountInFormatted": "0.15",
    "amountInUsd": "0.149910150000",
    "minAmountIn": "150000",
    "amountOut": "149968",
    "amountOutFormatted": "0.149968",
    "amountOutUsd": "0.149878169168",
    "minAmountOut": "148468",
    "timeEstimate": 35,
    "refundFee": "2400",
    "withdrawFee": "0"
  },
  "quoteRequest": {
    "dry": true,
    "depositMode": "SIMPLE",
    "swapType": "EXACT_INPUT",
    "slippageTolerance": 100,
    "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    "depositType": "ORIGIN_CHAIN",
    "destinationAsset": "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    "amount": "150000",
    "refundTo": "0x1111111111111111111111111111111111111111",
    "refundType": "ORIGIN_CHAIN",
    "recipient": "root.near",
    "recipientType": "DESTINATION_CHAIN",
    "deadline": "2026-11-09T10:17:25.000Z",
    "confidentiality": "public",
    "quoteWaitingTimeMs": 0,
    "insured": false,
    "appFees": [
      {
        "recipient": "5880ad2b362620fadf759cbceb1cd5737ce8c6ed7fb8e9942881e6731f9247dd",
        "fee": 1
      }
    ]
  },
  "signature": "ed25519:5aLbVqvt3yYwXQKWyUNDSrjcCaWbXVaY4HByZpFeavbr2BojLgH8mouP9VR5ycCwHMc7PR1e4yiZK3cSMyjD4oPV",
  "timestamp": "2026-11-09T09:47:25.548Z",
  "correlationId": "19df2f45-41e5-4355-905e-c59d54081547"
}
```

**Dry response keys:** only `quote`, `quoteRequest`, `signature`, `timestamp`, `correlationId`. No `depositAddress`, `deadline`, `timeWhenInactive`, or `depositMemo`. The quote's `deadline` exists only in `quoteRequest` (the requested value), not in `quote`.

### 4.3 Non-dry quote — real deposit address, 10 USDC

Request (same assets, recipient `mend.near`, `dry:false`):

```json
{
  "dry": false,
  "swapType": "EXACT_INPUT",
  "slippageTolerance": 100,
  "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  "depositType": "ORIGIN_CHAIN",
  "destinationAsset": "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  "amount": "10000000",
  "recipient": "mend.near",
  "recipientType": "DESTINATION_CHAIN",
  "refundTo": "0x1111111111111111111111111111111111111111",
  "refundType": "ORIGIN_CHAIN",
  "deadline": "2026-11-09T10:10:22.000Z"
}
```

Observed `HTTP/2 201`, body (trimmed only for whitespace):

```json
{
  "quote": {
    "amountIn": "10000000",
    "amountInFormatted": "10.0",
    "amountInUsd": "9.994320000000",
    "minAmountIn": "10000000",
    "amountOut": "9993652",
    "amountOutFormatted": "9.993652",
    "amountOutUsd": "9.987975605664",
    "minAmountOut": "9893715",
    "timeEstimate": 35,
    "refundFee": "2400",
    "withdrawFee": "4428",
    "deadline": "2026-11-12T10:10:22.000Z",
    "timeWhenInactive": "2026-11-12T10:10:22.000Z",
    "depositAddress": "0x5eFF1eda63DF64B9831483888702e56Ea62Def95"
  },
  "quoteRequest": {
    "dry": false,
    "depositMode": "SIMPLE",
    "swapType": "EXACT_INPUT",
    "slippageTolerance": 100,
    "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    "depositType": "ORIGIN_CHAIN",
    "destinationAsset": "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    "amount": "10000000",
    "refundTo": "0x1111111111111111111111111111111111111111",
    "refundType": "ORIGIN_CHAIN",
    "recipient": "mend.near",
    "recipientType": "DESTINATION_CHAIN",
    "deadline": "2026-11-09T10:10:22.000Z",
    "confidentiality": "public",
    "quoteWaitingTimeMs": 0,
    "insured": false,
    "appFees": [
      {
        "recipient": "5880ad2b362620fadf759cbceb1cd5737ce8c6ed7fb8e9942881e6731f9247dd",
        "fee": 1,
        "limitOrderId": null
      }
    ]
  },
  "signature": "ed25519:4hiuK1GGCJW9SMQRTC9q2BZCTmFEEsxMH9jviQ3F4uCD4N91tzSw7s33ZaGwP9pq8Z6fLbTiNQMYxfCXqQeP55CY",
  "timestamp": "2026-11-09T09:40:22.967Z",
  "correlationId": "068d5f47-1f92-44de-a1c7-910bfd02bfde"
}
```

**No funds were sent to `0x5eFF…Def95`.** This is a real quote object, not a payment.

### 4.4 Status for the unfunded quote

```bash
curl -sS "https://1click.chaindefuser.com/v0/status?depositAddress=0x5eFF1eda63DF64B9831483888702e56Ea62Def95"
```

Observed `HTTP/2 200`:

```json
{
  "status": "PENDING_DEPOSIT",
  "updatedAt": "2026-11-09T09:40:23.550Z",
  "correlationId": "982a6635-a3a5-455e-9fba-5adbdf7e635e",
  "swapDetails": {
    "depositedAmount": null,
    "depositedAmountUsd": null,
    "depositedAmountFormatted": null,
    "intentHashes": [],
    "nearTxHashes": [],
    "amountIn": null,
    "amountInFormatted": null,
    "amountInUsd": null,
    "amountOut": null,
    "amountOutFormatted": null,
    "amountOutUsd": null,
    "slippage": null,
    "refundedAmount": "0",
    "refundedAmountFormatted": "0",
    "refundedAmountUsd": "0",
    "refundReason": null,
    "refundFee": "2400",
    "withdrawFee": "4428",
    "originChainTxHashes": [],
    "destinationChainTxHashes": []
  },
  "quoteResponse": {
    "timestamp": "2026-11-09T09:40:22.967Z",
    "signature": "ed25519:4hiuK1GGCJW9SMQRTC9q2BZCTmFEEsxMH9jviQ3F4uCD4N91tzSw7s33ZaGwP9pq8Z6fLbTiNQMYxfCXqQeP55CY",
    "quoteRequest": {
      "dry": false,
      "swapType": "EXACT_INPUT",
      "depositMode": "SIMPLE",
      "slippageTolerance": 100,
      "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
      "depositType": "ORIGIN_CHAIN",
      "destinationAsset": "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      "amount": "10000000",
      "refundTo": "0x1111111111111111111111111111111111111111",
      "refundType": "ORIGIN_CHAIN",
      "recipient": "mend.near",
      "recipientType": "DESTINATION_CHAIN",
      "deadline": "2026-11-09T10:10:22.000Z",
      "appFees": [
        {
          "limitOrderId": null,
          "recipient": "5880ad2b362620fadf759cbceb1cd5737ce8c6ed7fb8e9942881e6731f9247dd",
          "fee": 1
        }
      ],
      "virtualChainRecipient": null,
      "virtualChainRefundRecipient": null,
      "referral": null,
      "confidentiality": "public"
    },
    "quote": {
      "amountIn": "10000000",
      "amountInFormatted": "10.0",
      "amountInUsd": "9.994320000000",
      "minAmountIn": "10000000",
      "amountOut": "9993652",
      "amountOutFormatted": "9.993652",
      "amountOutUsd": "9.987975605664",
      "minAmountOut": "9893715",
      "timeWhenInactive": "2026-11-12T10:10:22.000Z",
      "depositAddress": "0x5eFF1eda63DF64B9831483888702e56Ea62Def95",
      "deadline": "2026-11-12T10:10:22.000Z",
      "timeEstimate": 35,
      "refundFee": "2400",
      "withdrawFee": "4428"
    }
  }
}
```

**Note:** `withdrawFee` is `4428` for `mend.near` (no USDC storage) and `0` for `root.near` (USDC storage exists). Strongly indicates the fee covers recipient storage registration. The exact semantics are not documented; MEND should pre-register the hub and still budget the fee.

### 4.5 Real SUCCESS sample (public explorer address, not MEND funds)

```bash
curl -sS "https://1click.chaindefuser.com/v0/status?depositAddress=0x85B7Ba3fFDb04245CF61A380C9D2039d786760c5"
```

Observed `HTTP/2 200`, status `SUCCESS`. Key fields:

```json
{
  "status": "SUCCESS",
  "updatedAt": "2026-11-08T18:04:29.000Z",
  "swapDetails": {
    "depositedAmount": "1000000000000",
    "depositedAmountFormatted": "1000000.0",
    "amountIn": "1000000000000",
    "amountOut": "1299242119",
    "amountOutFormatted": "12.99242119",
    "slippage": 17,
    "refundedAmount": "0",
    "refundReason": null,
    "intentHashes": ["FkGZnt7g1Pp1SEjgiEC8KR2dZriTAiz2Kvt5sK5HsVJt", "AVFwyVc5QdztmicMxDGgLEFyNR7PYB6K5yi4he7z9pwT"],
    "nearTxHashes": ["6jM13rfyLVXnpTW9PVpHZ8PYmDcTqjcG4m9kTbmnVK7i", "G4eySJ3iGoB2RG6XHyQSrny59MQvSRnWnopos7iJhRFw", "N8Wotvwadba4CFv34axBCpAniPSZRVJmEbfYHfT9WG6", "DTQKKnVum2oJ2vMZJrc2iMv63QsmCcp4MN4k9WGpb9pB"],
    "originChainTxHashes": [{"hash": "0xfd2929751f6f80c1bec2f3f2c3e38958cff202a8d98de2810d13fc403504660e", "explorerUrl": ""}],
    "destinationChainTxHashes": [{"hash": "f2e2647f61553f9c38822d5920f5fa897e5bb0cd7982d34a1cd20feb936f718b", "explorerUrl": ""}]
  },
  "quoteResponse": {
    "quoteRequest": {
      "originAsset": "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near",
      "destinationAsset": "1cs_v1:btc:native:coin",
      "recipient": "1FC84DkT2rVjDbfys8AAn6cMymYamSDShM",
      "recipientType": "DESTINATION_CHAIN",
      "referral": "swapkit",
      "deadline": "2026-11-08T18:50:57.000Z"
    },
    "quote": {
      "amountIn": "1000000000000",
      "amountOut": "1301391241",
      "minAmountOut": "1275363416",
      "depositAddress": "0x85B7Ba3fFDb04245CF61A380C9D2039d786760c5",
      "deadline": "2026-11-11T18:50:57.000Z",
      "timeWhenInactive": "2026-11-11T18:50:57.000Z"
    }
  }
}
```

**Critical:** both `explorerUrl` values are **empty strings**, even on `SUCCESS`. The OpenAPI says the field is required, but it is not populated live. Build links client-side (§8).

### 4.6 Error and edge outputs

**Unknown deposit address — 404:**

```json
{"message":"Deposit address 0x0000000000000000000000000000000000000000 not found","error":"Not Found","statusCode":404,"timestamp":"2026-11-09T09:40:31.365Z","path":"/v0/status?depositAddress=0x0000000000000000000000000000000000000000"}
```

**Bogus key — 401:**

```json
{"message":"Invalid token","error":"Unauthorized","statusCode":401,"timestamp":"2026-11-09T09:44:10.886Z","path":"/v0/quote"}
```

**Amount below route minimum — 400:**

```json
{"message":"Amount is too low for bridge, try at least 150000","correlationId":"…","timestamp":"…","path":"/v0/quote"}
```

**Decimal amount — 400:**

```json
{"message":"amount must be specified in base units (the smallest unit of your asset's chain). The required decimals vary by chain (e.g. 18 for ETH, 24 for NEAR, 8 for BTC). Use an integer string—e.g. \"10000000000000000\" for 0.01 with 18 decimals. Decimal values like \"0.01\" are not accepted.","error":"Bad Request","statusCode":400,"timestamp":"…","path":"/v0/quote"}
```

**Non-existent named NEAR recipient — 400:**

```json
{"message":"Internal server error","correlationId":"…","timestamp":"…","path":"/v0/quote"}
```

This error is ambiguous. Pre-validate the recipient account with NEAR RPC before quoting.

**Mismatched refund address — 400:**

```json
{"message":"refundTo is not valid"}
```

Observed when an ETH address was used as `refundTo` for an XRP/TON origin. The refund address must match the origin chain’s address format.

**Unsupported `depositMode` — 400:**

```json
{"message":"Incorrect depositMode"}
```

Observed for `depositMode: "MEMO"` on a TON route. `depositMode` is route-specific.

### 4.7 Signature verification (real)

Using `@defuse-protocol/one-click-sdk-typescript@0.1.26`:

```js
const { verifyQuoteSignature } = require('@defuse-protocol/one-click-sdk-typescript');
const q = require('./canonical-dry-quote-response.json');
console.log(verifyQuoteSignature(q)); // true
```

Results:

| Payload | Result |
|---|---|
| Canonical dry quote | `true` |
| Non-dry quote | `true` |
| `status.quoteResponse` from a real `SUCCESS` sample | `true` |
| Same quote with `recipient` changed to `attacker.near` | `false` |

The SDK’s default manager public key is `ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc`. The signed message is `base58(sha256(json-stable-stringify({...quoteRequest, ...quote, timestamp})))`; the signature is Ed25519 over that base58 text. Pin the SDK and re-check the public key on upgrade.

### 4.8 `sessionId` and `referral` binding

- `referral: "mend"` is accepted, echoed in the quote response, preserved in `status.quoteResponse.quoteRequest`, and covered by the signature. Use it as the MEND distribution-channel tag.
- `sessionId: "wo-…"` is accepted and echoed in the **quote** response, but **absent** from `status.quoteResponse.quoteRequest` in a live sample. Do **not** rely on `sessionId` for reconciliation.
- There is **no arbitrary work-order memo** for EVM deposits. `depositMemo` is 1Click-generated deposit metadata, not a user memo. Bind `workOrderId` off-chain to `depositAddress` and store the full quote.

---

## 5. Deposit flow

### 5.1 Standard MEND flow (ORIGIN_CHAIN → NEAR USDC)

1. **Discover assets**
   `GET /v0/tokens`; select origin asset (e.g. Base USDC) and destination `nep141:17208628…36133a1` (NEAR USDC).

2. **Validate the MEND hub**
   The NEAR recipient account must exist and have NEAR USDC storage. Use NEAR RPC:
   - `view_account` for `MEND_HUB_ACCOUNT`
   - `call_function` `storage_balance_of` on the USDC contract
   Do this **before** quoting. The quote endpoint only checks named-account existence, not storage.

3. **Dry quote (default UI state)**
   `POST /v0/quote` with `dry:true`, `swapType:"EXACT_INPUT"`, `slippageTolerance:100`, `originAsset`, `destinationAsset`, integer `amount`, `recipient`, `recipientType:"DESTINATION_CHAIN"`, `refundTo`, `refundType:"ORIGIN_CHAIN"`, `deadline`.
   Show `amountIn`, `amountOut`, `minAmountOut`, `refundFee`, `withdrawFee`, `timeEstimate`. Label **“Preview only — no deposit address yet.”**

4. **Create deposit instructions (explicit sponsor action)**
   Re-request with `dry:false` (or a fresh quote if the preview is stale). Store the **entire** `QuoteResponse`: `correlationId`, `signature`, `timestamp`, `quoteRequest`, `quote`, including `depositAddress`, `depositMemo` (if any), `deadline`, `timeWhenInactive`.
   Verify the signature before displaying the deposit address.

5. **Show exact instructions**
   Display:
   - origin chain + asset + exact `amountIn`
   - `depositAddress`
   - `depositMemo` if present (mandatory)
   - quote `deadline` / `timeWhenInactive`
   - warning: “Send only <ASSET> on <CHAIN> to this address. Any other asset/chain may be lost.”
   - explorer link to the deposit address on the origin chain
   - **MAINNET ONLY** banner

6. **Sponsor sends the transfer**
   The sponsor (human/wallet) sends exactly `amountIn` of the origin asset. MEND never signs or sends. For `EXACT_INPUT`, underpayment is refunded by the request deadline; overpayment is swapped and the excess refunded after completion.

7. **Optional submit**
   `POST /v0/deposit/submit` with `depositAddress` + real `txHash` (+ `memo` if used). This is a speed-up only; 201 is not proof.

8. **Poll status**
   `GET /v0/status?depositAddress=…` (add `&depositMemo=…` if required). Poll until terminal. Use backoff; handle `INCOMPLETE_DEPOSIT`.

9. **Prove completion**
   Require `status === "SUCCESS"` **and** a non-empty `swapDetails.destinationChainTxHashes` (or, for NEAR destination, an on-chain USDC balance delta / unshield proof). Confirm:
   - `quoteResponse.quoteRequest.recipient === MEND_HUB_ACCOUNT`
   - `quoteResponse.quoteRequest.destinationAsset === NEAR USDC`
   - `swapDetails.amountOut >= quote.minAmountOut`
   - destination tx exists on-chain
   Only then credit the work order.

### 5.2 Deposit types

| `depositType` | Meaning | MEND use |
|---|---|---|
| `ORIGIN_CHAIN` | `depositAddress` is on the origin chain; send tokens there | **Use this for sponsorship** |
| `INTENTS` | `depositAddress` is an account inside NEAR Intents; fund via signed intent, not a direct token transfer | Not for v1 |
| `CONFIDENTIAL_INTENTS` | account inside Confidential Intents; fund via signed transfer intent | Not for v1 |

`depositMode`:

| Value | Meaning |
|---|---|
| `SIMPLE` | address only; default |
| `MEMO` | address + memo required; route-specific (e.g. some Stellar/XRP/TON routes) |

If `depositMemo` is returned, it is **mandatory** in the transfer and in `/v0/status` (`depositMemo` query) and `/v0/deposit/submit` (`memo` body). A dry quote in our tests did not return `depositMemo`; only a non-dry quote carries deposit instructions. We could not produce a live MEMO quote (TON rejected `MEMO`); exact memo-route behavior remains UNVERIFIED.

### 5.3 Deadlines and expiry

- `deadline` in the **request** is required and is the refund trigger if the swap is not complete.
- The **response** `quote.deadline` and `quote.timeWhenInactive` were **request deadline + 72 hours** on 3 samples:
  - request `2026-11-09T10:10:22Z` → quote `2026-11-12T10:10:22Z`
  - request `2026-11-09T15:45:08Z` → quote `2026-11-12T15:45:08Z`
  - real sample request `2026-11-08T18:50:57Z` → quote `2026-11-11T18:50:57Z`
- This +72 h behavior is **observed, not documented**. Treat it as implementation detail; do not build a contract on it.
- After `quote.deadline` / `timeWhenInactive`, the deposit address becomes cold/inactive and “funds may be lost” (OpenAPI wording).
- **No `EXPIRED` swap status exists.** If `now > quote.deadline` and status is still `PENDING_DEPOSIT`, MEND must map it to its own `EXPIRED` state and stop telling the sponsor to send.

### 5.4 Refund address and recipient binding

- `refundTo` must be a valid address on the origin chain. Wrong-format refund addresses are rejected (`refundTo is not valid`).
- `refundType` should be `ORIGIN_CHAIN` for MEND.
- Refunds are automatic; there is no refund API.
- Recipient binding is cryptographic: the quote signature covers `recipient`, `recipientType`, `destinationAsset`, `amount`, `refundTo`, `deadline`, and `depositAddress`. Verify the signature and compare the fields to the work order before displaying or crediting.
- `customRecipientMsg` is **experimental** and can lose funds with non-NEP-141 tokens or missing storage. Do not use it in MEND v1.

### 5.5 Completion proof

| Signal | Use |
|---|---|
| `status === "SUCCESS"` | Necessary, not sufficient alone |
| `swapDetails.destinationChainTxHashes` | Primary on-chain proof of payout; **`explorerUrl` may be empty** |
| `swapDetails.amountOut` vs `quote.minAmountOut` | Amount check |
| `quoteResponse.quoteRequest.recipient` / `destinationAsset` | Binding check |
| NEAR RPC `ft_balance_of(hub)` delta | Independent NEAR-destination proof |
| `nearTxHashes` | **Do not use as swap proof** since 2026-10-27; they are shield/unshield hashes |
| `deposit/submit` 201 | **Never proof** |

---

## 6. Status matrix (exact strings)

The API docs do **not** define a formal terminal/non-terminal flag. The “Terminal?” column is MEND’s operational mapping, not an API contract.

| Status | Meaning (official) | Terminal? | MEND UI / action |
|---|---|---|---|
| `PENDING_DEPOSIT` | Awaiting token deposit | No | Show deposit instructions; poll. If past `quote.deadline`, map to client `EXPIRED`. |
| `KNOWN_DEPOSIT_TX` | Deposit transaction detected | No | “Deposit detected, confirming”; keep polling. |
| `PROCESSING` | Swap being executed | No | “Settling”; keep polling. |
| `SUCCESS` | Tokens delivered to destination address | **Yes** | Verify destination tx + amount + recipient; credit work order. |
| `INCOMPLETE_DEPOSIT` | Deposit below required amount | No / undocumented | “Underfunded”; alert sponsor, allow top-up if before deadline, or wait for refund. **Do not credit.** |
| `REFUNDED` | Swap failed, funds returned to refund address | **Yes** | Mark refunded; reconcile `refundedAmount`, `refundReason`, refund tx. |
| `FAILED` | Swap encountered an error | **Yes** | Mark failed; check whether a refund exists; open support case. |

**No `EXPIRED` swap status.** `EXPIRED` exists only in the separate **limit order** `fillStatus` enum (`AWAITING_DEPOSIT`, `PENDING_CANCEL`, `UNTRIGGERED`, `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELED`, `EXPIRED`), not in swap status.

### 6.1 Sub-status / detail fields

There is **no separate sub-status enum** on `GET /v0/status`. Detail lives in `swapDetails`:

| Field | Meaning |
|---|---|
| `refundReason` | Free-form string; schema example `PARTIAL_DEPOSIT`; null when no refund. Treat unknown values conservatively. |
| `refundedAmount` / `Formatted` / `Usd` | Actual refund |
| `refundFee` | Refund fee in origin base units |
| `slippage` | Actual slippage in bps (e.g. `17` = 0.17%) |
| `depositedAmount` | Actual on-chain deposit |
| `amountIn` / `amountOut` | Settled amounts |
| `intentHashes` | Intent settlement |
| `nearTxHashes` | Shield/unshield hashes since 2026-10-27; not swap hash |
| `originChainTxHashes` / `destinationChainTxHashes` | `{hash, explorerUrl}`; `explorerUrl` empty live |
| `withdrawFee` | Withdrawal fee; may include recipient storage |

### 6.2 Expiration / incomplete handling decision

| Situation | MEND state | Behavior |
|---|---|---|
| `PENDING_DEPOSIT` and now < `quote.deadline` | `AWAITING_SPONSOR_FUNDS` | Keep instructions visible; poll |
| `PENDING_DEPOSIT` and now ≥ `quote.deadline` | `EXPIRED` (client-only) | Stop instructions; show “quote expired, create a new quote”; do not send |
| `INCOMPLETE_DEPOSIT` | `UNDERFUNDED` | Show shortfall; allow top-up before deadline if safe; otherwise wait for refund |
| `REFUNDED` | `REFUNDED` | Show refund amount/tx; close work order |
| `FAILED` | `FAILED` | Show failure; check refund; support |
| `SUCCESS` but destination tx missing | `SETTLING_PROOF` | Do not credit until on-chain proof |

---

## 7. Fees, slippage, precision, minimums, NEAR constraints

### 7.1 Fees (documented)

| Fee | Amount | Notes |
|---|---|---|
| Protocol fee | **0.0001% (1 pip)** | On-chain, collected by `intents.near` |
| 1Click with partner JWT | **20 bps** normal; **1 bp** stablecoin pairs / same-asset multichain | `X-API-Key` |
| 1Click without JWT | **+25 bps** on every non-`ANY_INPUT` quote (docs) | See live discrepancy below |
| `appFees` with JWT | 50/50 split; 1Click minimum 20 bps (1 bp stablecoin) | Combined max 500 bps |
| `appFees` without JWT | Docs: keep full fee + 25 bps on top | See live discrepancy below |
| Insurance | +2 bps | `insured:true` |
| Quote improvement | 50/50 split if filled better within ~30 min | Not a fixed fee |

**Live fee observation (important discrepancy — OBSERVED; fee schedule itself UNVERIFIED until partner JWT + real execution):**

| Request | `quoteRequest.appFees` returned | `amountOut` for 10 USDC in |
|---|---|---|
| no key, no `appFees` | only `{recipient: 5880…, fee: 1}` | `9998080` |
| no key, `appFees:[{root.near, fee:0}]` | only `{5880…, fee:1}` | `9998080` |
| no key, `appFees:[{root.near, fee:1}]` | `{root.near, fee:1}` + `{5880…, fee:1}` | `9997080` |
| no key, `appFees:[{root.near, fee:50}]` | `{root.near, fee:25}` + `{5880…, fee:25}` | `9949084` |

- The live API **did not show the documented +25 bps no-JWT surcharge**; it behaved like a 50/50 split with a 1 bp base for stablecoins.
- This could be a docs/version mismatch, an IP/partner default, or a fee applied later. **Do not hardcode 1 bp.** Budget the documented 25 bps (or 20 bps partner) until a partner JWT + real execution proves otherwise.
- For 80 USDC (PLAN example), observed dry quote: `amountIn 80000000` → `amountOut 79983841` (≈ 2.02 bps effective, including 1 bp fee + spread), `minAmountOut 79184002` at 1% slippage.

### 7.2 Slippage

- `slippageTolerance` is **required**, in **basis points** (`100` = 1%).
- `minAmountOut` is derived from `amountOut` and slippage. Example: `amountOut 149968`, `minAmountOut 148468` = exactly 1% lower.
- MEND recommendation: **50–100 bps** for stablecoin sponsorships; never above 100 bps without human approval. Display `minAmountOut` prominently.
- `EXACT_OUTPUT` applies slippage to the input side; `FLEX_INPUT` applies to both. MEND v1 uses `EXACT_INPUT` only.

### 7.3 Amount precision and minimums

- `amount` is an **integer string in the smallest unit**.
  - Base/ETH/Arb/Sol USDC: 6 decimals → 1 USDC = `"1000000"`.
  - NEAR USDC: 6 decimals.
  - ETH: 18; NEAR: 24; BTC: 8.
- Decimal strings are rejected with the exact long error in §4.6.
- Minimum is **route-specific** and dynamic. Observed Base USDC → NEAR USDC:
  - `150000` (0.15 USDC) → 201
  - `149999` → 400 `Amount is too low for bridge, try at least 150000`
- Do not hardcode 0.15 USDC; surface the 400 message and use a conservative MEND minimum (e.g. $1) for UX.
- `refundFee` can dominate tiny amounts: `2400` base units = 0.0024 USDC, which is 1.6% of 0.15 USDC. Avoid micro-sponsorships.
- `withdrawFee` can include recipient storage registration: `4428` base units for an unregistered `mend.near`, `0` for registered `root.near`. Pre-register the hub.

### 7.4 NEAR destination + recipient constraints

| Constraint | Verified behavior | MEND action |
|---|---|---|
| Destination asset | NEAR USDC = `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` | Allowlist exact asset ID |
| Named recipient must exist | `mend-hub.near` / random named account → 400 `Internal server error`; `mend.near`, `root.near`, `near.near` → 201 | Pre-check `view_account`; create hub before quoting |
| Implicit 64-hex recipient | `aaaa…aaaa` accepted even if likely non-existent | Prefer named hub; do not rely on implicit |
| USDC storage | `mend.near` exists but `storage_balance_of` = `null`; quote still 201 with `withdrawFee 4428` | Pre-register USDC storage; check `storage_balance_of` |
| `recipientType` | `DESTINATION_CHAIN` delivers to the NEAR account; `INTENTS` delivers inside Intents | Use `DESTINATION_CHAIN` for hub |
| `customRecipientMsg` | Experimental `ft_transfer_call`; can lose funds | Do not use v1 |
| NEAR finality | Destination tx hash + `SUCCESS`; `nearTxHashes` are shield/unshield since 2026-10-27. Exact NEAR-destination `SUCCESS` field placement is **UNVERIFIED** (no funded NEAR-destination sample). | Verify destination hash and/or hub balance delta |

**NEAR RPC checks used:**

```bash
# account exists?
curl -sS https://rpc.mainnet.near.org -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"view_account","finality":"final","account_id":"mend.near"}}'

# USDC storage registered? (args_base64 = base64 of {"account_id":"mend.near"})
curl -sS https://rpc.mainnet.near.org -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"call_function","finality":"final","account_id":"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1","method_name":"storage_balance_of","args_base64":"eyJhY2NvdW50X2lkIjoibWVuZC5uZWFyIn0="}}'
```

Observed:

| Account | `view_account` | USDC `storage_balance_of` |
|---|---|---|
| `mend.near` | exists, balance 6000 NEAR | `null` |
| `mend-hub.near` | `UNKNOWN_ACCOUNT` | n/a |
| `root.near` | exists | `{"total":"1250000000000000000000","available":"0"}` |
| `near.near` | exists | `{"total":"1250000000000000000000","available":"0"}` |

---

## 8. Explorer links

### 8.1 1Click explorer (swap-level)

Verified from the explorer app bundle:

```text
https://explorer.near-intents.org/transactions/{depositAddress}
https://explorer.near-intents.org/transactions/{depositAddress}?depositMemo={encodeURIComponent(memo)}
```

This is the page for a swap/deposit address. For confidential/masked swaps the app also has `/mask/{hash}`, but MEND does not need it.

### 8.2 Per-chain transaction links

The 1Click explorer bundle contains a chain → explorer map. These are the bases it uses (append the tx hash). Verified by inspecting the live bundle on 2026-11-09; prefer the API’s `explorerUrl` when non-empty.

| Chain code | Tx explorer base | Address explorer base |
|---|---|---|
| `near` | `https://nearblocks.io/txns/` | `https://nearblocks.io/address/` |
| `eth` | `https://etherscan.io/tx/` | `https://etherscan.io/address/` |
| `base` | `https://basescan.org/tx/` | `https://basescan.org/address/` |
| `arb` | `https://arbiscan.io/tx/` | `https://arbiscan.io/address/` |
| `btc` | `https://mempool.space/tx/` | `https://mempool.space/address/` |
| `sol` | `https://orb.helius.dev/tx/` | `https://orb.helius.dev/account/` |
| `ton` | `https://tonscan.org/tx/` | `https://tonscan.org/address/` |
| `doge` | `https://blockchair.com/dogecoin/transaction/` | `https://blockchair.com/dogecoin/address/` |
| `xrp` | `https://xrpscan.com/tx/` | `https://xrpscan.com/account/` |
| `zec` | `https://3xpl.com/zcash/transaction/` | `https://3xpl.com/zcash/address/` |
| `gnosis` | `https://gnosisscan.io/tx/` | `https://gnosisscan.io/address/` |
| `bera` | `https://beratrail.io/tx/` | `https://beratrail.io/address/` |
| `bsc` | `https://bscscan.com/tx/` | `https://bscscan.com/address/` |
| `pol` | `https://polygonscan.com/tx/` | `https://polygonscan.com/address/` |
| `tron` | `https://tronscan.org/#/transaction/` | `https://tronscan.org/#/address/` |
| `sui` | `https://suiscan.xyz/tx/` | `https://suiscan.xyz/address/` |
| `op` | `https://optimistic.etherscan.io/tx/` | `https://optimistic.etherscan.io/address/` |
| `avax` | `https://snowtrace.io/tx/` | `https://snowtrace.io/address/` |
| `cardano` | `https://cardanoscan.io/transaction/` | `https://cardanoscan.io/address/` |
| `stellar` | `https://stellar.expert/explorer/public/tx/` | `https://stellar.expert/explorer/public/account/` |
| `aptos` | `https://explorer.aptoslabs.com/txn/` | `https://explorer.aptoslabs.com/account/` |
| `ltc` | `https://blockchair.com/litecoin/transaction/` | `https://blockchair.com/litecoin/address/` |
| `monad` | `https://monadscan.com/tx/` | `https://monadscan.com/address/` |
| `xlayer` | `https://www.oklink.com/x-layer/tx/` | `https://www.oklink.com/x-layer/address/` |
| `starknet` | `https://starkscan.co/tx/` | `https://starkscan.co/contract/` |
| `bch` | `https://www.oklink.com/bch/tx/` | `https://www.oklink.com/bch/address/` |
| `adi` | `https://explorer.adifoundation.ai/tx/` | `https://explorer.adifoundation.ai/address/` |
| `plasma` | `https://plasmascan.to/tx/` | `https://plasmascan.to/address/` |
| `scroll` | `https://scrollscan.com/tx/` | `https://scrollscan.com/address/` |
| `aleo` | `https://explorer.provable.com/transaction/` | `https://explorer.provable.com/address/` |
| `movement` | `https://explorer.movementnetwork.xyz/txn/` | `https://explorer.movementnetwork.xyz/account/` |
| `dash` | `https://blockchair.com/dash/transaction/` | `https://blockchair.com/dash/address/` |
| `hypercore` | `https://hypurrscan.io/evm/tx/` | `https://hypurrscan.io/address/` |
| `fogo` | `https://fogoscan.com/tx/` | `https://fogoscan.com/account/` |
| `miden` | `https://explorer.mainnet.miden.io/tx/` | `https://explorer.mainnet.miden.io/account/` |
| `qtc` | `https://explorer.quantus.com/transactions/` | `https://explorer.quantus.com/accounts/` |
| `prl` | `https://explorer.pearlresearch.ai/tx/` | `https://explorer.pearlresearch.ai/address/` |
| `hood` | `https://robinhoodchain.blockscout.com/tx/` | `https://robinhoodchain.blockscout.com/address/` |

**Rule:** use `tx.explorerUrl` if non-empty; otherwise `base + hash`. Never assume `explorerUrl` is populated — it was empty in live `SUCCESS`.

---

## 9. Concrete MEND client decisions

### 9.1 Network and safety

1. **Mainnet-only profile.** There is no testnet. Use recorded fixtures for CI; never call the live API in unit tests.
2. `INTENTS_MODE=mainnet` must be explicit. Refuse to start the sponsorship feature if unset or if `NODE_ENV=test` without a fixture flag.
3. **Dry by default.** The sponsor UI opens on a dry quote. A non-dry quote is created only by an explicit “Create deposit request” action.
4. **No signing keys in the agent.** MEND never signs or transfers. The sponsor wallet does the transfer. Any live proof requires separate human approval.
5. Show a persistent **“MAINNET ONLY — real funds”** banner and a confirmation checkbox before showing a deposit address.

### 9.2 Auth and fee policy

- Obtain a partner JWT from `https://partners.near-intents.org`; store server-side only; send `X-API-Key`.
- If no JWT: use unauthenticated quotes, but budget **25 bps** conservatively and disclose “unauthenticated fee may apply” in the UI. Do not promise the observed 1 bp.
- Never expose the JWT to the browser.
- Log `correlationId` but never the JWT or full request headers.

### 9.3 Quote policy

| Policy | Decision |
|---|---|
| Origin assets | Allowlist Base/ETH/Arb/Sol USDC (and optionally USDT/ETH) from `/v0/tokens`; reject unknown |
| Destination | Exact NEAR USDC asset ID only |
| `swapType` | `EXACT_INPUT` only for v1 |
| `slippageTolerance` | Max `100` bps; default `50` for stablecoins |
| `amount` | Integer base units; validate decimals; enforce MEND min ($1) and max per work order |
| `recipient` | `MEND_HUB_ACCOUNT`; `recipientType: DESTINATION_CHAIN` |
| `refundTo` | Sponsor’s origin-chain address; `refundType: ORIGIN_CHAIN` |
| `deadline` | At least 60 min for EVM; use 24 h when the sponsor is not live; longer for BTC/UTXO; never in the past. This is the refund trigger, so do not set it longer than the sponsorship window. |
| `referral` | `"mend"` |
| `sessionId` | Optional at quote time; **do not depend on it in status** |
| `customRecipientMsg` | Forbidden |
| `ANY_INPUT` / `CONFIDENTIAL_INTENTS` | Forbidden in v1 |
| `insured` | Default false; enable only with explicit budget |

### 9.4 Hub readiness

Before enabling sponsorship:

1. Create/confirm `MEND_HUB_ACCOUNT` on mainnet.
2. Register NEAR USDC storage (`storage_deposit`) and verify `storage_balance_of` is non-null.
3. Verify `view_account` exists and has enough NEAR for storage/keys.
4. Re-check before each quote; cache for a short TTL.
5. If the hub is a contract, confirm it can receive NEP-141 via `ft_transfer`; do not use `customRecipientMsg` in v1.

### 9.5 Reconciliation and state machine

Store one `Sponsorship` row per work order:

```text
workOrderId
quoteCorrelationId
depositAddress          // unique key
depositMemo             // nullable
originChain, originAsset, amountIn
destinationAsset, recipient
quoteJson               // full signed QuoteResponse
quoteSignature
quoteDeadline
status                  // latest API status
statusUpdatedAt
destinationTxHashes     // from swapDetails
amountOut
refundedAmount
refundReason
createdAt, updatedAt
```

State mapping:

```text
CREATED → AWAITING_SPONSOR_FUNDS (PENDING_DEPOSIT)
        → DEPOSIT_DETECTED       (KNOWN_DEPOSIT_TX)
        → SETTLING               (PROCESSING)
        → FUNDED                 (SUCCESS + proof)
        → UNDERFUNDED            (INCOMPLETE_DEPOSIT)
        → REFUNDED               (REFUNDED)
        → FAILED                 (FAILED)
        → EXPIRED                (client-only: now > quoteDeadline && PENDING_DEPOSIT)
```

Rules:

- Poll every 5 s for the first 2 minutes, then 15 s, then 60 s; stop at terminal.
- Treat `SUCCESS`, `REFUNDED`, `FAILED` as terminal.
- Treat `INCOMPLETE_DEPOSIT` as non-terminal/undocumented; do not credit; alert.
- Do not create a second quote for the same work order unless the first is `EXPIRED`/`FAILED`/`REFUNDED` and the sponsor explicitly retries.
- On `SUCCESS`, require destination tx proof and `amountOut >= minAmountOut` before crediting.
- On `REFUNDED`, reconcile `refundedAmount` and `refundReason`; close the work order.
- Never use `deposit/submit` 201 as proof.

### 9.6 Signature verification

- Verify every quote and every `status.quoteResponse` with `verifyQuoteSignature` from the pinned SDK (0.1.26 at time of research).
- Reject the quote if verification fails.
- After verification, assert:
  - `quoteRequest.recipient === MEND_HUB_ACCOUNT`
  - `quoteRequest.recipientType === "DESTINATION_CHAIN"`
  - `quoteRequest.destinationAsset === NEAR_USDC`
  - `quoteRequest.originAsset` in allowlist
  - `quoteRequest.amount` equals the intended amount
  - `quote.depositAddress` is present for non-dry
- Pin the manager public key and review it on SDK upgrades.

### 9.7 Error handling

| Error | MEND behavior |
|---|---|
| 400 `Amount is too low for bridge…` | Show route minimum; suggest higher amount; do not retry same amount |
| 400 `amount must be specified in base units…` | Client bug; fix amount formatting |
| 400 `Internal server error` on quote | Likely non-existent named NEAR recipient; pre-validate and show “hub account not ready” |
| 400 `refundTo is not valid` | Refund address does not match origin chain; ask sponsor for correct address |
| 400 `Incorrect depositMode` | Route does not support MEMO; use SIMPLE |
| 401 `Invalid token` | JWT expired/invalid; refresh from partner dashboard |
| 404 status | Unknown deposit address; verify quote/depositAddress; do not assume failure |
| 429 | Back off; honor reset header; never hammer |
| Cloudflare 403 `error code: 1010` | Set a normal `User-Agent`; use a server-side HTTP client |

### 9.8 UI copy requirements

- “Preview only — no deposit address yet.” for dry quotes.
- “Send exactly <amount> <asset> on <chain> to <address>” for live quotes.
- “Memo required: <memo>” when present.
- “This quote expires at <deadline>. Do not send after expiry.”
- “Mainnet only. Real funds. No testnet.”
- “Funds arrive at the MEND hub only after SUCCESS; a detected deposit is not a completed sponsorship.”
- Never show a dry quote as a payment or a deposit address.

---

## 10. Blockers and open questions

### 10.1 Blockers

| Blocker | Impact | Owner |
|---|---|---|
| No partner JWT / API key | Cannot verify authenticated 20/1 bp fee schedule, partner rate limits, or fee split | Human / partner dashboard |
| No MEND-controlled hub with USDC storage | `mend-hub.near` does not exist; `mend.near` exists but `storage_balance_of` is `null` | Human / T01/T03 |
| No mainnet funds + no human approval | Cannot execute a real deposit → SUCCESS/REFUNDED end-to-end | Human |
| No testnet | All live testing is mainnet and risky; CI must use fixtures | Architecture |
| No live REFUNDED/FAILED/INCOMPLETE sample | Those shapes are schema/docs only | Research / later mainnet proof |
| No live MEMO-route quote | `depositMemo` behavior on Stellar/XRP/TON unverified | Research |
| Explorer API requires JWT | Cannot query historical swaps programmatically without partner auth | Human / partner |
| `explorerUrl` empty live | Client must construct links from chain + hash | T04 |
| Cloudflare blocks default Python UA | Backend must set `User-Agent` | T03 |
| Fee docs vs live behavior mismatch | Budget/quote display may be wrong by ~25 bps | Human / partner support |

### 10.2 Explicitly UNVERIFIED

The following are documented or inferred but were **not** observed live:

- Authenticated 20 bps / 1 bp fee schedule, partner rate limits, and fee split.
- Live `REFUNDED`, `FAILED`, and `INCOMPLETE_DEPOSIT` response bodies.
- `depositMode: MEMO` / `depositMemo` on a route that actually requires a memo.
- Exact field placement for a **NEAR-destination** `SUCCESS` (`destinationChainTxHashes` vs `nearTxHashes`).
- Exact cause of `withdrawFee: "4428"` for an unregistered `mend.near` (storage vs another fee).
- Formal terminality of statuses (the docs do not define a terminal flag).
- Whether `explorerUrl` will be populated in future responses.
- A real end-to-end deposit → `SUCCESS` and a real failure → `REFUNDED` flow.

### 10.3 Open questions for 1Click / partner support

1. Why did unauthenticated quotes show only 1 bp `appFees` and a 50/50 split for `fee:50`, instead of the documented +25 bps? Is the surcharge applied at execution, waived, or docs-stale?
2. Is `quote.deadline = request.deadline + 72 h` intentional? What happens to funds sent between request deadline and quote deadline?
3. For a NEAR-destination `SUCCESS`, which field contains the final NEP-141 transfer to the recipient: `destinationChainTxHashes` or `nearTxHashes` (given confidential settlement since 2026-10-27)?
4. Does `withdrawFee` always include recipient storage registration when `storage_balance_of` is null? Can MEND pre-register to make it zero?
5. Are there exact allowed values for `refundReason` beyond `PARTIAL_DEPOSIT`?
6. Is `INCOMPLETE_DEPOSIT` guaranteed to transition to `REFUNDED` at deadline, or can it remain?
7. Can `sessionId` be preserved in `/v0/status`? If not, confirm `depositAddress` is the only supported reconciliation key.
8. Which routes require `depositMode: MEMO`, and is `depositMemo` omitted from dry quotes by design?

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Accidental real spend on mainnet | High | Dry default; no signing keys; explicit human approval; mainnet banner |
| Sending after quote expiry | High | Countdown to `quote.deadline`; block UI; map to `EXPIRED` |
| Underpayment → `INCOMPLETE_DEPOSIT` | High | Show exact `amountIn`; validate wallet amount; alert; top-up before deadline |
| Hub account missing / no USDC storage | High | Pre-check `view_account` + `storage_balance_of`; create/register before enabling |
| Fee mismatch (docs vs live) | Medium | Budget 25 bps; verify with partner JWT + real execution; show “estimated” |
| `explorerUrl` empty | Medium | Build links from chain map; test each supported chain |
| `deposit/submit` 201 mistaken for proof | High | Never credit without `SUCCESS` + destination tx |
| Signature not verified → tampered deposit address | High | Verify every quote/status with SDK; reject on failure |
| Confidential settlement changes proof | Medium | Don’t use `nearTxHashes` as swap proof; use destination tx + hub balance |
| Cloudflare 403 | Medium | Set `User-Agent`; use server-side client; retry with backoff |
| Rate limits / duplicate quotes | Medium | Cache tokens; one quote per work order; idempotency by depositAddress |
| Refund address wrong chain | Medium | Validate address format; use `ORIGIN_CHAIN`; show refund address in confirmation |
| Route minimums change | Medium | Surface 400 message; don’t hardcode 0.15 USDC |
| API/SDK drift | Medium | Pin OpenAPI 0.1.10 / SDK 0.1.26; contract tests against live schema |
| Third-party explorer link errors | Low | Use `explorerUrl` when present; otherwise tested chain map |
| Privacy of sponsor addresses | Medium | Don’t log full addresses publicly; store minimally; follow MEND privacy policy |

---

## 12. Reproduction commands (safe subset)

```bash
# 1. tokens
curl -sS https://1click.chaindefuser.com/v0/tokens -o tokens.json

# 2. dry quote (replace deadline with now+30m UTC)
DEADLINE=$(python3 -c "import datetime; print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=30)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")
cat > quote.json <<JSON
{
  "dry": true,
  "swapType": "EXACT_INPUT",
  "slippageTolerance": 100,
  "originAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  "depositType": "ORIGIN_CHAIN",
  "destinationAsset": "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  "amount": "150000",
  "recipient": "root.near",
  "recipientType": "DESTINATION_CHAIN",
  "refundTo": "0x1111111111111111111111111111111111111111",
  "refundType": "ORIGIN_CHAIN",
  "deadline": "$DEADLINE"
}
JSON
curl -sS -i -X POST https://1click.chaindefuser.com/v0/quote \
  -H 'Content-Type: application/json' --data-binary @quote.json

# 3. status for a known/real deposit address (read-only)
curl -sS "https://1click.chaindefuser.com/v0/status?depositAddress=0x85B7Ba3fFDb04245CF61A380C9D2039d786760c5"

# 4. unknown address → 404
curl -sS -i "https://1click.chaindefuser.com/v0/status?depositAddress=0x0000000000000000000000000000000000000000"
```

**Do not run a non-dry quote in CI.** It allocates a real mainnet deposit address. If you must, use a disposable quote and never fund it.

---

## 13. Evidence index

| Evidence | Location / command | Result |
|---|---|---|
| OpenAPI version | `curl https://1click.chaindefuser.com/docs/v0/openapi.yaml` | `info.version: 0.1.10` |
| Token count | `GET /v0/tokens` | 216 tokens, 200 |
| Dry quote | §4.2 | 201, no deposit address |
| Live quote | §4.3 | 201, deposit `0x5eFF…Def95`, deadline +72 h |
| Pending status | §4.4 | 200, `PENDING_DEPOSIT` |
| Success status | §4.5 | 200, `SUCCESS`, empty `explorerUrl` |
| Unknown status | §4.6 | 404 |
| Bad auth | §4.6 | 401 |
| Amount minimum | §4.6 | 400 at 149999, 201 at 150000 |
| Recipient existence | §4.6 / §7.4 | 400 for missing named account |
| Storage gap | §7.4 | `mend.near` storage `null`, quote `withdrawFee 4428` |
| Signature verify | §4.7 | true; tamper false |
| SDK | `npm view @defuse-protocol/one-click-sdk-typescript version` | 0.1.26 |
| Explorer routes | explorer JS bundle | `/transactions/{depositAddress}` |
| Confidential settlement | changelog 2026-10-27 | `nearTxHashes` shield/unshield |

---

## 14. Bottom line for MEND

The 1Click API is usable for MEND sponsorship **today**, with these hard conditions:

1. **Mainnet only**; no testnet exists. Dry quotes are safe; live quotes allocate real deposit addresses.
2. **Provision the hub first**: create the NEAR account and register USDC storage. A missing named account makes quotes fail with an unhelpful 500-style message.
3. **Use `dry:true` for all previews**, and only create a non-dry quote on explicit sponsor action.
4. **Verify quote signatures** before showing a deposit address or crediting a work order.
5. **Poll status** and treat `SUCCESS` + destination tx as the only completion proof; `deposit/submit` is not proof.
6. **Build explorer links client-side**; live `explorerUrl` is empty.
7. **Budget fees conservatively** (25 bps until partner JWT proves 1–20 bps), and avoid micro-amounts because `refundFee` dominates.
8. **Handle `INCOMPLETE_DEPOSIT` and expiry explicitly**; there is no `EXPIRED` swap status.
9. **Do not use `nearTxHashes` as swap proof** after 2026-10-27; settlement is confidential and those are shield/unshield hashes.
10. **No agent signing/transfer.** A human-approved tiny mainnet execution is still required for Wave 4 / G4.

**Verdict:** G0 endpoint/schema validation for Intents is **PASS with blockers** — endpoints, fields, statuses, signatures and deposit flow are verified; hub provisioning, partner JWT, fee clarification and a human-approved live execution remain open.

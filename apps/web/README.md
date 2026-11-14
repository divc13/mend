# MEND web

Next.js 16 App Router frontend for the MEND public case experience, consoles and replay demo.

## Run

```bash
cd apps/web
npm install --workspaces=false
npm run dev
```

The app defaults to **REPLAY / SIMULATION** and renders the frozen protocol fixtures in
`src/lib/fixtures.ts`. No wallet, API credentials or network access is required for the demo.

## Environment

Server-side only:

```bash
# Optional. Absent means the app stays in replay.
MEND_API_BASE_URL=http://localhost:4000

# Optional. LIVE_TESTNET is only honoured when the API is configured and healthy.
# MAINNET is never selected by this UI.
MEND_MODE=REPLAY
```

Browser code calls the same-origin proxy at `/api/mend/*`. The upstream base URL, API keys and
private evidence URLs never enter the browser bundle. When the API is unreachable, pages label the
fallback and keep replay fixtures visible.

The public read pages use a server-only client (`src/lib/server-api.ts`):

| Page | API |
| --- | --- |
| `/cases/:workOrderId` | `GET /v1/cases/:workOrderId` |
| `/bids/:workOrderId` | `GET /v1/cases/:workOrderId` |
| `/assets/:assetId` | `GET /v1/cases/by-asset/:assetId` then `GET /v1/cases/:id` per summary |

`GET /v1/cases` returns summaries, so the web app hydrates each listed id from the detail endpoint.
The detail response is expected to match the public `CaseBundle` shape in `src/lib/types.ts`. A
missing endpoint, 404, timeout, malformed payload or missing required fields causes the page to
render the frozen fixture instead, with a visible `REPLAY / SIMULATION · FIXTURE FALLBACK` label.

## Testnet wallet and live run

`/wallet` and `/live` call the testnet API through the same-origin proxy:

| UI action | API |
| --- | --- |
| Create testnet wallet | `POST /v1/testnet/wallet` |
| Read balance/storage | `GET /v1/testnet/wallet/:accountId` |
| Faucet (100 mUSDC) | `POST /v1/testnet/faucet` |
| Live scenario | `POST /v1/live/run-scenario` |

Testnet contracts are `mend-hub.testnet` and `mend-usdc.testnet`; explorer links target
`https://explorer.testnet.near.org`. Responses are normalised in `src/lib/testnet.ts`, which accepts
camelCase, snake_case and `{ data: ... }` wrappers.

The wallet page remembers only the public account ID in `sessionStorage`. A secret key is kept in
React state after creation, can be downloaded once as JSON, and is discarded when the panel is
hidden or the page is left. It is never written to local storage, cookies or the URL.

When LIVE TESTNET is not selected, or the API is unavailable, `/live` shows the recorded replay
path instead. REPLAY never produces a wallet, faucet call or explorer link.

## Build and test

```bash
npm run build
npm test
```

## Safety boundaries

- MAINNET is never selectable. Every real-funds action needs separate explicit human approval.
- Replay fixtures never claim a live transaction, AI attestation, OutLayer callback or physical
  verification.
- Explorer links are rendered only for real transaction hashes.
- Reporting requires no wallet. EXIF/GPS is stripped in the browser and manual redaction is burned
  into the outgoing preview.
- Precise locations, raw media and private evidence URLs are never rendered on public pages.

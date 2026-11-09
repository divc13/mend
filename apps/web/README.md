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

## Build check

```bash
npm run build
```

## Safety boundaries

- MAINNET is never selectable. Every real-funds action needs separate explicit human approval.
- Replay fixtures never claim a live transaction, AI attestation, OutLayer callback or physical
  verification.
- Explorer links are rendered only for real transaction hashes.
- Reporting requires no wallet. EXIF/GPS is stripped in the browser and manual redaction is burned
  into the outgoing preview.
- Precise locations, raw media and private evidence URLs are never rendered on public pages.

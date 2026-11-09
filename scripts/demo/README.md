# Demo scripts

| Script | Purpose | Status |
|---|---|---|
| [`check-docs.mjs`](./check-docs.mjs) | Validate documentation, relative links, anchors, required strings, JSON templates, submission length and forbidden claims | **AVAILABLE** |
| [`capture-replay-demo.mjs`](./capture-replay-demo.mjs) | Record the integrated web app in `REPLAY / SIMULATION` mode with Playwright | **PENDING** — web app and Playwright are not on this branch |

## Run

```bash
# Documentation and link sanity
node scripts/demo/check-docs.mjs

# Capture status (prints PENDING until the app is integrated)
node scripts/demo/capture-replay-demo.mjs
```

## Capture prerequisites

- Integrated `apps/web` running at `BASE_URL` (default `http://localhost:3000`).
- Playwright available as a project dependency (not only an npx cache).
- The UI honours the `data-testid` contract in
  [the capture plan](../../docs/15-demo-capture-plan.md#ui-selector-contract).
- `ffmpeg` installed for MP4 conversion. It is **not** installed in this
  environment, so conversion commands are intentionally not documented until the
  dependency is verified.

## Rules

- Never record a screen without the mode badge.
- Never record a `MAINNET — REAL FUNDS` screen during a REPLAY capture.
- Never insert a transaction link that is not real.
- Never use unrelated stock repair footage.
- A partial recording is labelled `RECORDED_PARTIAL`; it is not presented as the
  final demo.

## Related documents

- [Demo capture plan](../../docs/15-demo-capture-plan.md)
- [Demo script](../../docs/13-demo-script.md)
- [Evidence package](../../docs/12-real-world-evidence-package.md)
- [Docs index](../../docs/README.md)

You are the visible Frontend worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/frontend (git branch track/frontend). Do not ask questions; proceed.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (F01, F02, F03, F05, F06, F09, F10, F11, F12, F13, T04)
- /Volumes/sandisk/Users/dc/mend/packages/protocol/src/{fixtures,schemas,state-machine,constants}.ts
- /Volumes/sandisk/Users/dc/mend/generated/openapi.json (in packages/protocol/generated)
- /Volumes/sandisk/Users/dc/mend/orchestration/decisions/HUB-INTERFACE.md

SCOPE (only these paths):
- apps/web/** — Next.js 16 App Router frontend
Do NOT edit API, contracts, packages, orchestration, root config.

REQUIREMENTS:
1. Next 16 + React 19 + TypeScript strict. Premium, clean MEND brand: "MEND — Maintenance with memory. Get it fixed. Keep it fixed." Accessible, responsive.
2. Pages: `/` public map + live case cards; `/report` walletless report flow (photo upload, EXIF-stripped preview, manual redaction, duplicate acknowledgment, private case link); `/cases/[workOrderId]` full timeline; `/steward` scope/budget/DAO/award console; `/bids/[workOrderId]` sealed bid room (no leaks before reveal; deterministic score comparison after); `/inspector/[workOrderId]` evidence checklist + AI completeness suggestions with human-only decision buttons; `/sponsor/[workOrderId]` Intents quote/fees/deposit/status with DRY vs LIVE labels; `/assets/[assetId]` passport/history; `/dashboard` public metrics; `/trust` privacy/trust/limitations; `/demo` control room (scenario select, reset, fast-forward, mode banner).
3. Data: API client with `MEND_API_BASE_URL`; when API is unreachable or `mode=REPLAY`, use frozen protocol fixtures and show `REPLAY / SIMULATION` everywhere. Mode banner is always visible: LIVE TESTNET / MAINNET (never selectable by default) / REPLAY.
4. Trust panel: distinguishes VERIFIED INFERENCE EVIDENCE, UNAVAILABLE EVIDENCE, HUMAN DECISION, PHYSICAL CLAIM; OutLayer hashes; explorer links only for real tx hashes.
5. No wallet required for reporting; no API keys/secrets in browser; no private precise location or private evidence URL rendered publicly.
6. Accessibility: semantic landmarks, keyboard-only flows, labels, focus states, contrast, mobile viewport. Include a skip link and reduced-motion support.
7. Visual quality: real product feel, not a wireframe. Use CSS custom properties/modules or Tailwind; no external map tile dependency (use an accessible schematic map).

ACCEPTANCE (run and paste real output):
```bash
cd apps/web && npm run build
```
Build must pass (typecheck included). If a page needs a dependency, install it in apps/web/package.json only. No deploy/push.

Commit on branch track/frontend with message `feat(web): public case experience, consoles and replay demo UI`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

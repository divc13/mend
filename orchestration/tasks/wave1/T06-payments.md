You are the visible Payments worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/payments (git branch track/payments). Do not ask questions; proceed.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (F05, T06)
- /Volumes/sandisk/Users/dc/mend/orchestration/research/R0-C-intents.md (if missing, mark live-schema work BLOCKED and build from recorded fixtures + honest unavailable states)
- packages/protocol/src/{schemas,fixtures,errors}.ts
- packages/protocol/generated/openapi.json

CRITICAL VERIFIED FACTS (from R0-C; use the full doc for schemas):
- Base URL `https://1click.chaindefuser.com`, API v0, OpenAPI 0.1.10; mainnet only, no testnet.
- `GET /v0/tokens` and `POST /v0/quote` work without auth; quote success is HTTP 201; `dry:true` returns no depositAddress/deadline/depositMemo.
- Status enum exactly: PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, PROCESSING, SUCCESS, INCOMPLETE_DEPOSIT, REFUNDED, FAILED. There is no EXPIRED status (client-only expiry).
- Named NEAR recipient accounts must already exist; quote success does not prove NEP-141 storage registration. Verify `storage_balance_of` and account existence before enabling live sponsorship.
- Explorer URLs in status can be empty; build links yourself. Reconciliation key is `depositAddress` (sessionId is not returned by status).
- Verify quote/status signatures with the pinned Intents SDK; reject tampered quotes (e.g. changed recipient).
- Auth: `X-API-Key` partner JWT server-side; unauthenticated = disclose possible 25 bps fee. Never expose JWT.
- Flow states: CREATED → AWAITING_SPONSOR_FUNDS → DEPOSIT_DETECTED → SETTLING → FUNDED | UNDERFUNDED | REFUNDED | FAILED | EXPIRED. A detected deposit is never a completed sponsorship.

SCOPE (only these paths):
- packages/intents-client/**
- fixtures/payments/** (payment/Intents fixtures only)
Do NOT edit API, web, contracts, other packages, orchestration, root config.

REQUIREMENTS:
1. Real 1Click/NEAR Intents HTTP client (fetch) for supported tokens, quote, `dry: true` preview, deposit instructions and status polling. Exact base URL/headers/fields from R0-C; zod-validate every response; never invent fields.
2. Quote UX data: source/destination asset, amount in/out, fees, destination recipient binding, estimated output, expiry/deadline. Dry quotes are explicitly labeled and can never be presented as payment.
3. Status tracker: map every documented status/substatus to SUCCESS / PENDING / FAILED / REFUNDED / INCOMPLETE / EXPIRED; unknown values fail closed as INCOMPLETE with raw preserved for diagnostics; poll with backoff and timeouts.
4. Reconciliation: match destination tx, output amount, recipient, work-order ID and escrow funding. Handle underpayment, overpayment, duplicate callback, delayed settlement, refund and failure. Tests for each.
5. Mainnet guard: client refuses non-dry execution unless `MEND_ALLOW_MAINNET=true` AND an explicit `confirmMainnet` argument; never signs or sends transactions; no keys stored.
6. Explorer link builders per chain, labeled MAINNET ONLY. Recorded fixtures for offline judging.
7. Read-only live smoke script (`npm run smoke`) that only calls token/quote(dry)/status; skipped by default and never spends funds.
8. Tests use fixtures only; no network by default; no secrets.

ACCEPTANCE (run and paste real output):
```bash
cd packages/intents-client && npm test && npm run typecheck && npm run smoke -- --dry
```
If live network is unavailable, smoke must exit 0 with an explicit SKIPPED/unavailable message, not a fake result. No transactions, no mainnet signing, no push.

Commit on branch track/payments with message `feat(payments): Intents quote, status, reconciliation and mainnet guard`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

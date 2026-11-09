# MEND API (`apps/api`)

Fastify 5 API and background-service entry points for MEND. The hub contract is
the financial source of truth. This service writes a Postgres read model plus
private off-chain data; it never authorizes money by itself.

## Run

```bash
npm install                 # from the repo root
cd apps/api
npm run dev                 # tsx watch src/index.ts, default http://127.0.0.1:4010
npm test
npm run typecheck
```

With `DATABASE_URL` set, `src/index.ts` runs the forward migrations from
`packages/db/migrations` and uses the Postgres repository. Without it the API
uses the in-memory repository (useful for tests and the replay demo).

All configuration comes from environment variables with safe defaults. See
`.env.example`. No secret is committed.

Key defaults:

| Variable | Default | Meaning |
|---|---|---|
| `MEND_MODE` | `REPLAY` | `LIVE_TESTNET`, `MAINNET` or `REPLAY` |
| `CHAIN_ADAPTER` | `replay` in REPLAY mode | `replay`, `live`, `unavailable`, `pending`, `failing` |
| `EVIDENCE_ADAPTER` | `local` | `local` or `s3` (S3 interface is present but not activated) |
| `DEMO_RESET_ENABLED` | true outside production | Demo control availability |
| `DEMO_ADMIN_ACCOUNT` | `demo-admin.mend.testnet` | Only account allowed to reset demo data |
| `DEMO_DURABILITY_MINUTES` | `2` | Explicit demo durability window |
| `INTENTS_ENABLED` | `false` | 1Click dry previews; live also needs `INTENTS_ALLOW_LIVE` plus `confirmLive: true` |

## DEMO AUTHORIZATION — replace in production

Wave 1 uses two headers:

```text
x-mend-role:    STEWARD | SPONSOR | CONTRACTOR | INSPECTOR | DAO | ...
x-mend-account: <NEAR account>
```

The role is validated against the protocol `ROLES` list and the account against
the NEAR account pattern. Every mutating route calls `requireRole` with the
matrix in `src/auth.ts`. **These headers are trivially spoofable and are demo
scaffolding only.** Production replaces `authFromHeaders` with a verified
NEP-413 signature / JWT / session middleware that produces the same
`AuthContext`; route handlers and the role matrix do not change. No mutation in
this service should be exposed publicly until that swap is done.

Walletless report submission is intentionally public and does not require a
role or wallet. It returns a one-time reporter case link; the API stores only its
SHA-256 hash for lookup. Transfer attempts always fail with
`TRANSFER_DISABLED`.

## Routes

All routes are under `/v1` except `/health`.

| Area | Routes |
|---|---|
| Health / modes | `GET /health`, `GET /v1/modes`, `GET /v1/metrics` |
| Assets / passport | `GET/POST /v1/assets`, `GET/PATCH/DELETE /v1/assets/:assetId`, `POST /v1/assets/:assetId/passport/mint`, `GET /v1/assets/:assetId/passport`, `GET /v1/assets/:assetId/history`, `GET /v1/passport/:tokenId`, `POST /v1/passport/:tokenId/transfer` |
| Reports | `POST /v1/reports`, `GET /v1/reports/:reportId` (case link required), `GET/PATCH /v1/reports/:reportId`, `GET /v1/reports/:reportId/private-location`, `POST/GET /v1/reports/:reportId/triage`, report media access/download |
| Clusters | `GET/POST /v1/report-clusters`, `GET/PATCH /v1/report-clusters/:clusterId` |
| DAO | `GET/POST /v1/dao-approvals`, `GET /v1/dao-approvals/:approvalId` |
| Work orders | `GET/POST /v1/work-orders`, `GET /v1/work-orders/:id`, `POST /v1/work-orders/:id/actions/:action`, `GET /v1/work-orders/:id/escrow`, `GET /v1/work-orders/:id/verification`, `GET /v1/work-orders/:id/commands` |
| Bids | `GET /v1/work-orders/:id/bids`, `POST .../bids/commit`, `POST .../bids/reveal` |
| Scoring | `GET/POST /v1/work-orders/:id/score` |
| Evidence | `POST /v1/evidence`, `POST /v1/work-orders/:id/evidence`, `GET /v1/evidence/:id`, `GET /v1/evidence/:id/access`, `GET /v1/evidence/:id/download` (signed) |
| Inspections | `GET/POST /v1/work-orders/:id/inspections`, `GET /v1/inspections/:id` |
| Payments | `GET/POST /v1/work-orders/:id/payments`, `GET /v1/work-orders/:id/warranty` |
| Verification | `POST /v1/verification`, `GET /v1/verification/:subjectHash`, `GET /v1/verification/artifact/:id` |
| Agents / audit | `GET/POST /v1/agents`, `GET /v1/agents/:account`, `GET /v1/audit` |
| Kill switch | `GET /v1/admin/kill-switch` (ADMIN/STEWARD/DAO), `POST /v1/admin/kill-switch` (ADMIN) |
| Demo | `POST /v1/demo/reset`, `GET /v1/demo/state` (ADMIN + designated account) |
| Intents | `GET /v1/intents/capabilities`, `POST /v1/intents/quote`, `GET /v1/intents/status/:quoteId` |

`POST /v1/work-orders/:id/actions/:action` accepts:
`dao_authorize`, `fund`, `open_bidding`, `close_bidding`, `award`, `start_work`,
`submit_completion`, `accept_completion`, `inspect_durability`, `open_dispute`,
`resolve_dispute`, `cancel_work_order`, `refund`, `pause`, `unpause`.

Bids are sealed: public bid responses expose commitments and hide all reveal
values until bidding closes. Reveals are verified against the commitment hash.
Both commit and reveal carry `availableInDays` (integer 0–365), which is bound
into the canonical commitment hash and returned in the public reveal view.

## Human kill switch

`POST /v1/admin/kill-switch` with `{ "enabled": true, "reason": "..." }`
requires `ADMIN` and immediately pauses every mutating `/v1/*` route with HTTP
`423 CONTRACT_PAUSED`; reads, `/health` and the kill-switch control route keep
working so an operator can release the pause. Each transition:

- appends an immutable `kill_switch_enabled` / `kill_switch_disabled` audit event
  with the actor and reason;
- submits an explicit hub `pause` / `unpause` chain command through the existing
  adapter. The response distinguishes a stored `INTENT` from an adapter
  `SUCCESS` with a transaction hash, and a replay hash is never presented as a
  real transaction.

On startup the last audited decision is restored, so a restart does not silently
resume writes. `GET /v1/admin/kill-switch` is available to `ADMIN`, `STEWARD`
and `DAO` staff.

## Privacy and evidence

- Precise coordinates are stored in `report_private`, never in the public report
  row, audit event, metrics or public response. Only `STEWARD`, `DAO`, `ADMIN`
  may read them.
- Uploaded JPEG/PNG bytes are stripped of EXIF/XMP metadata before hashing and
  storage. `redactedMediaHash` is the SHA-256 of the stripped bytes.
- Private media and evidence live outside any static root. Public evidence
  responses contain only hashes, checklist metadata and object sizes — never a
  storage key or URL.
- Access uses an HMAC-signed, time-limited URL (HMAC over evidence ID, object
  ID, storage key and expiry). Expired or tampered links return `401`.
- Chain commands only carry IDs, hashes and amounts. No location, media or
  signed URL is placed in command args.

## Chain commands are explicit

Every lifecycle action first creates a `chain_commands` row in `INTENT`. Only an
adapter result with `SUCCESS` and a transaction hash applies the state change.
`PENDING` and `FAILED` never apply the transition. The default replay adapter
returns `replay:<hash>` with `realTransaction: false` and the response label
`REPLAY / SIMULATION`. A live adapter without a signer remains `INTENT` with
`UPSTREAM_UNAVAILABLE`; it never reports an unsigned action as executed.

## Honest unavailable adapters

- **NEAR AI triage:** without `NEAR_AI_API_KEY`, suggestions are stored with
  `available: false` and only deterministic duplicate heuristics are shown. No
  confidence score or rationale is invented. With a key, the merged
  `@mend/ai-client` client is used with strict schemas, request/response hashes
  and the deterministic duplicate engine. Output is only `VERIFIED` when a
  response signature and matching attestation report are fetched and checked;
  otherwise the returned/stored verification artifact is `UNAVAILABLE`.
- **NEAR Intents/1Click:** the merged `@mend/intents-client` client is wired for
  capabilities, dry previews and status. Dry quotes are enabled with
  `INTENTS_ENABLED=true` and are always labelled previews with
  `isPayment: false` and no deposit address. Live deposit requests additionally
  require `INTENTS_ALLOW_LIVE=true` plus an explicit per-call `confirmLive:
  true`; the client also requires a NEAR recipient readiness proof. Mainnet-only
  is always displayed. This service has no signing or transfer capability.
- **OutLayer scoring:** deterministic local integer scoring is labelled
  `LOCAL_DETERMINISTIC_REPLAY`, `verified: false`, never an OutLayer attestation.
- **S3-compatible evidence:** the interface exists, but it reports unavailable
  until configured and activated; it never fakes a bucket.

## Error format

Every error uses the protocol code table:

```json
{ "error": { "code": "FORBIDDEN_ROLE", "message": "...", "details": { } } }
```

Zod validation failures use `VALIDATION_ERROR` with issue paths. Unknown routes
use `NOT_FOUND`.

## Demo reset

`POST /v1/demo/reset` is disabled (404) in production and when
`DEMO_RESET_ENABLED` is false. It requires `ADMIN` plus the designated
`DEMO_ADMIN_ACCOUNT`. It deletes only rows marked `is_demo` and reseeds canonical
fixtures. Audit events are append-only and survive. Scenarios:
`successfulRepair`, `duplicateReport`, `failedDurability`, `closed`. Repeated
resets produce the same public-state fingerprint; the fingerprint excludes
private data, audit history and ID sequences.

## Tests

```bash
npm test          # in-memory; no database needed
npm run typecheck
```

With `DATABASE_URL` pointing at a disposable database, the Postgres integration
test creates a unique temporary schema, runs migrations, and drops the schema.
Without `DATABASE_URL` that suite is skipped (reported as skipped).

# Structured logging contract

All services (`apps/api`, `services/*`, worker processes) must emit one JSON
object per line when `LOG_FORMAT=json`. Local development may use `LOG_FORMAT=pretty`
(human-readable), but production, hosted demo and CI logs must be JSON.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `ts` | ISO-8601 string | UTC, millisecond precision. |
| `level` | string | `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |
| `service` | string | `api`, `indexer`, `relayer`, `coordinator-agent`, `web`, ... |
| `env` | string | `local`, `ci`, `testnet`, `hosted`, ... |
| `mode` | string | `REPLAY`, `LIVE_TESTNET` or `MAINNET`. Always present. |
| `msg` | string | Short, human-readable reason. No interpolated secrets. |
| `requestId` | string (optional) | Request correlation ID; use `traceId` for distributed traces. |

## Recommended context fields

- `workOrderId`, `assetId`, `reportId`, `clusterId`, `bidId`, `inspectionId`
- `txHash`, `blockHeight`, `network` (`testnet`/`mainnet`)
- `outcome` (`success`, `pending`, `failed`, `refunded`, `unavailable`)
- `durationMs`
- `error.code`, `error.message` (sanitised), `error.retryable`
- `actor` — role name only (`STEWARD`, `CONTRACTOR`, `INSPECTOR`, `AI_REVIEWER`),
  never a raw key or credential
- `verification` — `verified`, `unavailable`, `invalid` for AI/OutLayer evidence

## Forbidden fields

Never emit any of the following, including inside error payloads or debug dumps:

- `NEAR_AI_API_KEY`, `OUTLAYER_API_KEY`, `AGENT_MARKET_AGENT_TOKEN`, `INTENTS_JWT`
- `Authorization`, `Cookie`, `Set-Cookie`, session tokens
- Private keys, seed phrases, function-call keys, `.env` contents
- Raw evidence bytes, base64 media, object-storage signed URLs
- Precise latitude/longitude, reporter case links, unredacted report text
- Full bid plaintext before the reveal phase
- Personal contact details of reporters or contractors

Use redaction middleware with an allowlist of fields. Do not rely on a denylist.

## Reference configuration (pino / Fastify)

```ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.SERVICE_NAME, env: process.env.MEND_ENV, mode: process.env.MEND_MODE },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.apiKey",
      "*.secret",
      "*.token",
      "*.privateKey",
      "*.signedUrl",
      "*.preciseLocation",
      "*.reporterCaseLink",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});
```

- Set `LOG_LEVEL=info` in hosted environments; `debug` only locally.
- Disable request-body logging for `/reports`, `/evidence` and auth routes.
- Error serializers must include the stack only when `MEND_ENV=local` or `ci`.
- Correlate transactions with `requestId`/`traceId`, but never put the raw signed
  transaction payload in logs if it contains private arguments.

## Log-derived metrics

Services should increment counters rather than forcing alert rules to parse log
lines. Required counters for the reconciliation alerts:

- `mend_reconciliation_mismatches_total{kind=...}`
- `mend_intent_pending_seconds{workOrderId=...}`
- `mend_escrow_accounting_mismatch_total`
- `mend_indexer_lag_blocks`
- `mend_outlayer_verification_failures_total`
- `mend_ai_attestation_unavailable_total`

Metric labels must not contain account credentials, case links or evidence URLs.

# @mend/config

Typed environment configuration, the MAINNET guard and secret boundaries shared
by MEND services.

- `loadConfig(env?)` — zod-validated environment with safe local defaults. The
  default mode is `REPLAY`; `MAINNET` fails closed unless both
  `MEND_MAINNET_EXPLICIT_APPROVAL` and `MEND_MAINNET_HUMAN_CONFIRMED` are true.
- `assertMainnetAllowed({ explicitApproval, humanConfirmed })` — throws unless
  both inputs are the boolean `true`. `REPLAY` / `LIVE_TESTNET` are unaffected.
- `assertServerOnly()` — throws in a browser-like context.
- `redactSecrets(text, values)` — replaces credential values in log text.
- `publicConfig(config)` — explicit allow-list projection with no secrets or
  private paths.

Importing this package has no side effects; environment values are read only
when a loader is called. `@mend/config/server` exposes `loadServerConfig()`,
which asserts the server boundary before loading.

Environment variables:

| Variable | Default | Notes |
|---|---|---|
| `MEND_MODE` | `REPLAY` | `REPLAY`, `LIVE_TESTNET` or `MAINNET` |
| `MEND_API_URL` | `http://127.0.0.1:4010` | credentials in URLs are rejected |
| `MEND_WEB_URL` | `http://127.0.0.1:3000` | |
| `MEND_WORKER_URL` | `http://127.0.0.1:4200` | |
| `MEND_EVIDENCE_ADAPTER` | `local` | `local`, `s3` or `unavailable` |
| `MEND_EVIDENCE_DIR` | `.evidence` | server-only, omitted from public config |
| `MEND_EVIDENCE_MAX_BYTES` | `8388608` | |
| `MEND_EVIDENCE_URL_TTL_SECONDS` | `300` | |
| `MEND_EVIDENCE_SIGNING_SECRET` | unset | server-only, never serialized |
| `MEND_FEATURE_*` | `false` | `INTENTS`, `AGENT_MARKET`, `AI_TRIAGE`, `DEMO_RESET` |
| `MEND_MAINNET_EXPLICIT_APPROVAL` | `false` | required for `MAINNET` |
| `MEND_MAINNET_HUMAN_CONFIRMED` | `false` | required for `MAINNET` |

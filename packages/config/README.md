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
- `assertMainnetProfileReady(profile)` — mainnet profile readiness guard; runs
  the approval guard and then requires every operator value to be supplied.
- `buildMainnetAccountUrl(account)` / `buildMainnetTxUrl(txHash)` — NEAR mainnet
  explorer links (`nearblocks.io`).

Importing this package has no side effects; environment values are read only
when a loader is called. `@mend/config/server` exposes `loadServerConfig()`,
which asserts the server boundary before loading.

## Verified NEAR mainnet USDC

`NEAR_MAINNET_USDC` is the only mainnet value in this package that is verified
rather than human-supplied:

| Field | Value |
|---|---|
| Network | NEAR mainnet |
| Token account | `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` |
| Symbol | `USDC` |
| Decimals | `6` |
| Standard | NEP-141 |
| Source | `https://rpc.mainnet.near.org` |
| Verification | `ft_metadata`, verified 2026-11-09 |

`MAINNET_PROFILE_DRAFT` deliberately contains no invented operator values. The
following are `HUMAN_SUPPLIED` placeholders until a human fills them in:

- `hubAccount` — MEND hub account on NEAR mainnet.
- `sponsorAccount` — sponsor account on NEAR mainnet.
- `rpcUrl` — mainnet RPC endpoint (must be `https`, without embedded
  credentials).
- `approval.explicitApproval` and `approval.humanConfirmed` — both must be the
  boolean `true`.

`assertMainnetProfileReady(profile)` fails closed on the draft: missing
approval raises `MainnetGuardError`, and any remaining placeholder or blank
operator value raises `MainnetProfileError`. Use `createMainnetProfile()` to
build a frozen, ready profile from explicit human input.

Mainnet is never selected by `loadConfig()`: the default remains `REPLAY`, and
the mainnet profile is a separate explicit import. Testnet and replay settings
are not reused for mainnet, and no mainnet profile field is exposed through
`publicConfig()` or serialized into browser configuration.

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

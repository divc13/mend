You are the visible Config & Testkit worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/config-testkit (branch track/config-testkit, based on main). Do not ask questions; proceed.

GOAL: Implement the two architecture packages promised in PLAN.md §3 that are still missing:
- `packages/config` — environment modes, mainnet guard, secret boundaries
- `packages/testkit` — deterministic clock, fixture helpers, fake adapters for tests

SCOPE (only these paths):
- packages/config/**
- packages/testkit/**
Do NOT edit other packages, apps, contracts, services, orchestration, docs, root config.

REQUIREMENTS — packages/config:
1. Typed environment loader using zod: `MEND_MODE` (`LIVE_TESTNET` | `MAINNET` | `REPLAY`), API/web/worker URLs, evidence settings, feature flags. Safe local defaults; no secrets logged.
2. Mainnet guard: `assertMainnetAllowed({explicitApproval, humanConfirmed})` fails closed unless both are true; never default to MAINNET; REPLAY/LIVE_TESTNET unaffected. Unit tests for every combination.
3. Secret boundary helpers: `redactSecrets(text, values)`, `assertServerOnly()` (throws in browser-like globals), `publicConfig()` that returns only non-secret fields. Tests.
4. No process-wide side effects on import.

REQUIREMENTS — packages/testkit:
1. Deterministic clock (`fixedClock`, `advance`) and ID sequence helpers.
2. Fixture loaders for `@mend/protocol` canonical fixtures (no filesystem dependency required; re-export typed values).
3. Fake adapters: in-memory chain command adapter (INTENT/PENDING/SUCCESS/FAILED), in-memory evidence store with signed-token interface, and a deterministic RNG.
4. Helpers for asserting the 100/80/72/8 ledger and mode labels.
5. Tests for clock determinism, fixture identity, fake adapter honesty (never reports success without a tx hash), and ledger assertion.

ACCEPTANCE (run and paste real output):
```bash
cd packages/config && npm test && npm run typecheck
cd packages/testkit && npm test && npm run typecheck
```
No mainnet, no deploy, no push.

Commit on branch track/config-testkit with message `feat(config,testkit): environment guards and deterministic test helpers`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

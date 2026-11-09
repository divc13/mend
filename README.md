# MEND — Maintenance with memory

**Get it fixed. Keep it fixed.**

MEND is a community asset repair protocol on NEAR. A broken public asset moves through a full lifecycle: walletless report → private AI triage → steward scope → DAO authorization → cross-chain sponsorship → sealed contractor bids → deterministic bid scoring → physical repair → independent human inspection → 90% payment → 10% durability holdback → later inspection → holdback release or warranty reopening. Every step stays in one permanent asset passport.

## Why it is different

A failed repair **reopens the original work order and warranty history**. It never creates a fresh bounty that lets the previous failure disappear.

## Repository layout

```text
apps/web                 Next.js public case experience + consoles
apps/api                 Fastify API and background jobs
contracts/hub            Registry, work orders, passport, escrow, warranty
contracts/test-token     Testnet-only NEP-141 mock USDC
compute/bid-rules        Deterministic Rust/WASM bid scoring
services/                Coordinator, contractors, inspector, DAO watcher, relayer, indexer
packages/protocol        Frozen schemas, state machine, fixtures, accounting
packages/ai-client       Private AI triage, privacy transforms, verification
packages/intents-client  1Click/Intents sponsorship client
packages/db              Postgres read model + migrations
docs/                    Rules, privacy, threat model, architecture
orchestration/           Task packets, research, decisions, progress, evidence
tests/                   Integration, E2E, security, clean-room
```

## Status

Implementation is in progress, driven by `PLAN.md` and tracked in `orchestration/PROGRESS.md`.
Live external integrations require human credentials/funds; those steps are marked **blocked on human** and are never faked. Replay mode is labeled `REPLAY / SIMULATION`.

## Quick start

```bash
npm install
npm test                      # protocol + workspace tests
npm run typecheck
bash scripts/verify.sh        # full local verification (once infra lands)
docker compose -f infra/docker-compose.yml up -d   # local stack
```

See `docs/` and `orchestration/` for the full architecture and evidence.

## Modes

- `LIVE TESTNET — TEST VALUE ONLY`
- `MAINNET — REAL FUNDS` (never selected by default; separate human approval per transaction)
- `REPLAY / SIMULATION` (recorded fixtures; never presented as live)

## License

MIT — see `LICENSE`.

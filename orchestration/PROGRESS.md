# MEND — Progress Tracker

Last updated: 2026-11-09 15:40 (local)
Overall: **16%**
Current wave / gate: **Wave 1 — foundations (G1 pending)**
Leader: opencode-go/deepseek-v4.1-flash · Workers: #high, visible iTerm2 tabs

## Done

- [x] Plan read and frozen as contract
- [x] T00.1 worker contract; T00.2 protocol package; T00.3 canonical fixtures; T00.4 traceability matrix
- [x] Protocol tests **26/26 pass**, typecheck clean, OpenAPI + JSON Schema exported
- [x] Git `c21b694`; 9 sibling worktrees under `/Volumes/sandisk/Users/dc/mend-wt/`
- [x] Wave 0 research complete: R0-A NEAR AI, R0-B OutLayer, R0-C Intents, R0-D DAO+Agent Market, R0-E NEAR platform (live-tested where possible, sources cited)
- [x] G0 freeze: `orchestration/decisions/G0-freeze.md` — **PASS** (credential-dependent parts blocked on human)
- [x] ADR-001, HUB-INTERFACE frozen (DAO push path, OutLayer private callback, non-transferable passport, sponsor-only escrow)

## In progress (visible workers)

- [ ] contracts — hub, passport, escrow, sealed bids, scoring, warranty, disputes, tests
- [ ] ai-compute — deterministic Rust/WASM scoring + private AI/privacy client
- [ ] backend — Fastify API, Postgres read model, evidence service, indexer
- [ ] frontend — Next.js public experience + consoles + replay UI
- [ ] infra — docker compose, CI, deploy runbook, verify scripts
- [ ] payments — Intents client (spawns when R0-C agent closes)

## Next

- Review each worker diff + run acceptance commands independently (G1)
- Merge in protocol → infra → contracts → AI/compute → payments → backend order
- Wave 2: agents/DAO/relayer, Agent Market worker, security tests, docs/demo

## Gates

| Gate | Status |
|---|---|
| G0 external APIs validated / protocol frozen | ✅ PASS (conditions documented) |
| G1 foundation tracks pass tests | 🟡 running |
| G2 local vertical slice | ⬜ |
| G3 testnet lifecycle | ⬜ blocked on human accounts/funds |
| G4 F01–F14 evidence | ⬜ |
| G5 human submission acceptance | ⬜ blocked on human |

## Tracks

| Track | % | Evidence |
|---|---|---|
| T00 Orchestrator | 100% | protocol 26 tests, fixtures, matrix, G0 |
| T01 Contracts | 5% | worker running |
| T02 AI & Compute | 5% | worker running |
| T03 Backend | 5% | worker running |
| T04 Frontend | 5% | worker running |
| T05 Agents/DAO/Relayer | 0% | task packet next |
| T06 Payments | 0% | worker queued |
| T07 Quality | 0% | — |
| T08 Infra | 5% | worker running |
| T09 Docs/Demo | 0% | — |

## Blocked on human

- NEAR AI key/credits, OutLayer project+funds, Agent Market token/balance, Sputnik DAO testnet accounts, testnet funds, Intents JWT (or no-JWT fee), deployment/private storage credentials, real repair location/media consent, mainnet approval, public repo/post/submission approval.

## Notes

- `iterm-agent wait/status` has a JSON parsing bug with reasoning messages; using `iterm-agent list` + output files/commits to track completion. Tabs stay visible.

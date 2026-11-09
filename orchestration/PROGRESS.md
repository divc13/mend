# MEND — Progress Tracker

Last updated: 2026-11-09, before execution started
Overall: **0%** (plan written; no code yet)
Current wave / gate: not started
Leader agent mode: **Plan mode — cannot execute yet**

## What is done

- [x] `PLAN.md` written (1,385 lines, full scope F01–F14)
- [x] Environment checked: model `opencode-go/deepseek-v4.1-flash` (variants low/high/max) works
- [x] `iterm-agent` visible-agent tool works (iTerm2 automation OK)
- [x] Repo `mend/` is clean on `main`, commit `121551f`, only `PLAN.md` inside

## What is next

1. User switches agent from Plan mode to build/execute mode.
2. Leader starts Wave 0 (API validation research, gate G0).
3. Leader creates `orchestration/` task packets and protocol package (T00).

## Gates

| Gate | Meaning | Status |
|---|---|---|
| G0 | External APIs validated, protocol frozen | ⬜ not started |
| G1 | Each foundation track passes local tests | ⬜ not started |
| G2 | Local vertical slice works without hand-editing DB | ⬜ not started |
| G3 | Testnet repair lifecycle with real tx links | ⬜ not started |
| G4 | Every feature F01–F14 has passing evidence | ⬜ not started |
| G5 | Human accepts full submission package | ⬜ not started |

## Tracks

| Track | Work | Status | Evidence |
|---|---|---|---|
| T00 | Orchestrator foundation (protocol, fixtures, matrix) | ⬜ 0% | — |
| T01 | Contracts (hub, passport, escrow, lifecycle) | ⬜ 0% | — |
| T02 | AI & verifiable compute (triage, OutLayer) | ⬜ 0% | — |
| T03 | Backend (API, DB, indexer, evidence) | ⬜ 0% | — |
| T04 | Frontend (map, timeline, cons, sponsor UI) | ⬜ 0% | — |
| T05 | Agents, DAO governance, relayer | ⬜ 0% | — |
| T06 | Payments & Intents sponsorship | ⬜ 0% | — |
| T07 | Quality & security tests | ⬜ 0% | — |
| T08 | Infrastructure (local, CI, deploy) | ⬜ 0% | — |
| T09 | Docs & demo production | ⬜ 0% | — |

## Blocked on human (plan §8)

- NEAR AI Cloud API key and credits
- OutLayer credentials/payment
- Agent Market account + token
- Sputnik DAO testnet accounts/permissions
- Testnet NEAR accounts + faucet funds
- Intents partner JWT (or accept no-JWT fee)
- Mainnet account + funds, with separate approval per transaction
- Deployment and private storage credentials
- Real repair location, steward, repairer, inspector, media consent
- Public repo approval, X post, final submission approval

## Evidence log

- none yet

## Note

This file lives in the plan folder while the agent is in Plan mode. After switching to build mode, the same tracker will be kept in the repo at `orchestration/PROGRESS.md` and updated after every work step.

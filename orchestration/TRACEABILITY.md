# MEND Feature Traceability Matrix (T00.4)

Every feature maps to an owner, implementation, automated test and demo evidence.
Status values: `PASS`, `PASS_LIVE_BLOCKED_ON_HUMAN`, `PARTIAL`, `BLOCKED_ON_HUMAN`.

| Feature | Owner track | Implementation | Automated test | Demo evidence | Status |
|---|---|---|---|---|---|
| F01 Walletless reporting | Frontend + Backend | `apps/web` report flow, `apps/api` reports/media | API report tests, privacy suite | R-005 + private case link, no wallet | PASS |
| F02 Privacy-preserving AI triage | AI & Compute | `packages/ai-client`, `apps/api` triage | 41 AI tests + 33 API tests + prompt-injection suite | duplicate suggestion + attestation panel, honest UNAVAILABLE | PASS_LIVE_BLOCKED_ON_HUMAN |
| F03 Asset passport | Contracts | `contracts/hub` NEP-171 non-transferable | hub 30 tests, API transfer-rejection test | passport page, `TRANSFER_DISABLED` | PASS |
| F04 Steward and DAO authorization | Agents & Governance | `services/dao-watcher`, hub `dao_authorize` | DAO watcher 10 tests, contract predecessor tests | DAO proposal reference on work order | PASS_LIVE_BLOCKED_ON_HUMAN |
| F05 Cross-chain sponsorship | Payments | `packages/intents-client` | 99 tests + live dry smoke | dry quote + labeled status, no funds moved | PASS_LIVE_BLOCKED_ON_HUMAN |
| F06 Sealed contractor market | Agents + Contracts | `services/contractor-agent`, hub commit/reveal | contractor 8 tests, hub bid tests | three sealed offers, reveal | PASS |
| F07 Deterministic bid evaluation | AI & Compute + Contracts | `compute/bid-rules`, hub score checks | 12 Rust + 26 protocol + parity + hub tests | B 9270 > C 5200 > A 2873, hash panel | PASS_LIVE_BLOCKED_ON_HUMAN |
| F08 Secure agent identities | Agents & Governance | `packages/near-client`, `services/relayer` | near-client 31, relayer 14, contract roles | permissions panel | PASS |
| F09 Stablecoin escrow and gasless | Contracts + Payments + Agents | hub escrow, relayer | hub 30 tests, G2 100/20/72/8, relayer tests | exact payment rail | PASS_LIVE_BLOCKED_ON_HUMAN |
| F10 Independent inspection | AI & Compute + Agents | inspector-agent, agent-market-worker | inspector 9, market 11, API inspection flow | checklist + human acceptance | PASS_LIVE_BLOCKED_ON_HUMAN |
| F11 Settlement and warranty | Contracts | hub durability + warranty transitions | failed-durability contract test, E2E replay | warranty reopening, no new funds | PASS |
| F12 Public case experience | Frontend | `apps/web` pages | Playwright 32 pass + axe + mobile | public timeline + passport | PASS |
| F13 Demo, replay and simulation | Quality + Docs & Demo | fixtures, reset service, demo control room, capture | E2E replay, clean-room, capture manifest | 90s REPLAY video | PASS |
| F14 Production-quality submission | All + Docs & Demo | repo, docs, CI, demo video | clean-room 8 pass, verify 18 pass | hosted demo/narration/media/submission human-gated | PARTIAL |

## Gate evidence

| Gate | Required evidence | Status |
|---|---|---|
| G0 | Research docs + decisions frozen | PASS — `decisions/G0-freeze.md` |
| G1 | Foundation tracks pass tests | PASS — `reports/G1-evidence.md` |
| G2 | Local vertical slice without hand-editing DB | PASS — `reports/G2-evidence.md` |
| G3 | Testnet lifecycle with real transaction links | **PASS with caveats** — `reports/G3-evidence.md` (Sputnik factory/OutLayer live/wallet rate-limit documented) |
| G4 | F01–F14 passing evidence | PASS for local features — `reports/G4-evidence.md` |
| G5 | Human accepts submission package | BLOCKED_ON_HUMAN |

Updated: 2026-11-09

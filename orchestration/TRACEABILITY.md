# MEND Feature Traceability Matrix (T00.4)

Every feature maps to an owner, implementation, automated test and demo evidence.
Status values: `PLANNED`, `IN_PROGRESS`, `PASS`, `BLOCKED_ON_HUMAN`.

| Feature | Owner track | Implementation | Automated test | Demo evidence | Status |
|---|---|---|---|---|---|
| F01 Walletless reporting | Frontend + Backend | `apps/web` report flow, `apps/api` reports/media | `tests/security/privacy`, API tests | report submitted with no wallet; case link | IN_PROGRESS |
| F02 Privacy-preserving AI triage | AI & Compute | `packages/ai-client`, `apps/api` triage | `packages/ai-client/test`, attack fixtures | duplicate suggestion + attestation panel | IN_PROGRESS |
| F03 Asset passport | Contracts | `contracts/hub` NEP-171 non-transferable | `contracts/hub` unit tests, transfer-rejection test | passport page, transfer failure | IN_PROGRESS |
| F04 Steward and DAO authorization | Agents & Governance | `services/dao-watcher`, hub roles | DAO watcher tests, contract role tests | DAO proposal reference on work order | IN_PROGRESS |
| F05 Cross-chain sponsorship | Payments | `packages/intents-client` | quote/status fixture tests | dry quote + labeled live status | IN_PROGRESS |
| F06 Sealed contractor market | Agents & Governance + Contracts | `services/contractor-agent`, hub commit/reveal | agent determinism tests, contract bid tests | three sealed offers, reveal | IN_PROGRESS |
| F07 Deterministic bid evaluation | AI & Compute + Contracts | `compute/bid-rules`, hub score checks | Rust tests, TS/Rust parity test | score panel with hashes | IN_PROGRESS |
| F08 Secure agent identities | Agents & Governance | `services/*`, contracts role gates | scoped-key checks, auth suite | permissions panel | IN_PROGRESS |
| F09 Stablecoin escrow and gasless | Contracts + Payments + Agents | hub escrow, `services/relayer` | escrow tests, relayer allowlist tests | 100/80/72/8 accounting | IN_PROGRESS |
| F10 Independent inspection | AI & Compute + Agents | inspector-agent, agent-market-worker | completeness tests, job flow tests | checklist + human acceptance | IN_PROGRESS |
| F11 Settlement and warranty | Contracts | hub durability + warranty transitions | lifecycle tests, ledger invariant tests | failed durability reopens same WO | IN_PROGRESS |
| F12 Public case experience | Frontend | `apps/web` pages | Playwright + axe | public case timeline + passport | IN_PROGRESS |
| F13 Demo, replay and simulation | Quality + Docs & Demo | fixtures, reset service, demo control room | replay e2e, reset repeatability | all scenarios in REPLAY mode | IN_PROGRESS |
| F14 Production-quality submission | All + Docs & Demo | repo, docs, CI, demo video | clean-room test, CI | hosted demo + submission pack | IN_PROGRESS |

## Gate evidence

| Gate | Required evidence | Status |
|---|---|---|
| G0 | No assumed endpoints; research docs + decisions frozen | IN_PROGRESS |
| G1 | Each foundation track passes local tests | PLANNED |
| G2 | Local vertical slice without hand-editing DB | PLANNED |
| G3 | Testnet lifecycle with real transaction links | BLOCKED_ON_HUMAN (accounts/funds) |
| G4 | F01–F14 passing evidence | PLANNED |
| G5 | Human accepts submission package | BLOCKED_ON_HUMAN |

Updated: 2026-11-09

# MEND documentation

**MEND — Maintenance with memory.** Get it fixed. Keep it fixed.

This directory is the product documentation for MEND. It describes the intended
integrated system, the frozen protocol, and — explicitly — which claims are proven
today, which are unavailable, and which are waiting on a human.

> **Repository status (2026-11-09):** the protocol, contracts, AI/compute, API,
> web app, agents, payments client, infrastructure and docs are integrated on
> this branch and covered by the evidence in `orchestration/reports/`. Live
> testnet transactions, a hosted demo, a narrated demo video and collected
> repair media do not exist yet. Do not read this documentation as evidence that
> those exist.

## Start here

| Document | What it answers |
|---|---|
| [01 — Problem and product](./01-problem-and-product.md) | Why MEND exists, what it promises, what it deliberately does not do |
| [02 — User roles and permissions](./02-user-roles.md) | Who can do what, and which duties must stay separate |
| [03 — Architecture](./03-architecture.md) | Components, real repo paths, data flow, trust boundaries |
| [04 — State machine](./04-state-machine.md) | Every lifecycle state, transition and invariant |
| [05 — Payment accounting](./05-payment-accounting.md) | The exact 100 / 80 / 72 / 8 integer accounting |
| [06 — Privacy model](./06-privacy-model.md) | Walletless reporting, redaction, location, media and retention |
| [07 — Threat model](./07-threat-model.md) | Threats, mitigations and residual risk |
| [08 — Oracle and human trust](./08-oracle-and-human-trust.md) | What AI, OutLayer, the DAO and humans can and cannot prove |
| [09 — Failure cases](./09-failure-cases.md) | What happens when funding, AI, compute, DAO, Intents or inspection fails |
| [10 — Deployment guide](./10-deployment-guide.md) | Local, testnet, mainnet and hosted deployment requirements |
| [11 — Limitations](./11-limitations.md) | Honest current limits and non-claims |
| [12 — Real-world evidence package](./12-real-world-evidence-package.md) | Media, consent and "what was real vs staged" template |
| [13 — 90-second demo script](./13-demo-script.md) | Timed narration, captions and transaction placeholders |
| [14 — Submission package](./14-submission-package.md) | Draft repository text, NEAR explanation, track case, post, disclosures |
| [15 — Demo capture plan](./15-demo-capture-plan.md) | Playwright harness, recording status and ffmpeg dependency |
| [16 — Integration evidence matrix](./16-integration-evidence.md) | Every external claim with VERIFIED / UNAVAILABLE / BLOCKED_ON_HUMAN |
| [17 — Copy and accessibility](./17-copy-and-accessibility.md) | Required trust language, forbidden claims and accessibility commitments |

## Frozen policy and source material

- [Bid evaluation rules (`RULES.md`)](./RULES.md) — version `mend-bid-policy-v1`, intended to be executed by the hash-pinned WASM scorer.
- [Root README](../README.md) — exact `Do X → See Y` commands and mode labels.
- [Master plan](../PLAN.md) — `PLAN.md` is the scope authority.
- Decision records in the orchestrator workspace: `orchestration/decisions/ADR-001-architecture.md`, `orchestration/decisions/G0-freeze.md` and `orchestration/decisions/HUB-INTERFACE.md`. These files are not tracked on this branch; they are the frozen inputs to this documentation.
- [Canonical fixtures](../packages/protocol/src/fixtures.ts) — accounts, IDs, bids, expected ranking and amounts.
- Research, all accessed 2026-11-09, in the orchestrator workspace: `orchestration/research/R0-A-near-ai.md`, `R0-B-outlayer.md`, `R0-C-intents.md`, `R0-D-dao-agent-market.md` and `R0-E-near-platform.md`. The evidence matrix in [16](./16-integration-evidence.md) summarizes every claim used here.

## Demo artifacts

- [Evidence package templates](../fixtures/demo/README.md) — media checklist, consent record, manifest and real-vs-staged log.
- [Docs checker](../scripts/demo/check-docs.mjs) — `node scripts/demo/check-docs.mjs`.
- [REPLAY capture harness](../scripts/demo/capture-replay-demo.mjs) — records the web app once it is integrated.
- [Demo capture plan](./15-demo-capture-plan.md) — current status is **PENDING**.

## Evidence labels used in this documentation

These three labels are used for external integration claims. They are defined
more fully in [16 — Integration evidence matrix](./16-integration-evidence.md).

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed on 2026-11-09 by a live read-only request, an official document/OpenAPI, or pinned source in `orchestration/research/R0-*`. "Verified" does **not** mean MEND executed the full flow. |
| **UNAVAILABLE** | The capability does not exist or cannot be used as described (for example: Intents has no testnet; Agent Market has no worker accept endpoint; gasless escrow funding is impossible with a function-call key). |
| **BLOCKED_ON_HUMAN** | The capability exists, but MEND cannot exercise it without a human-supplied credential, funded account, consent, approval or signature. Nothing in this state is faked. |

## Implementation status labels

| Label | Meaning |
|---|---|
| `FROZEN` | Protocol-level behaviour fixed and tested in this branch. |
| `IMPLEMENTED` | Present in this branch and covered by the command named next to it. |
| `BLOCKED_ON_HUMAN` | Requires a person to supply credentials, funds, consent, approval or a signature. |
| `NOT COLLECTED` | Physical-world evidence or media that does not exist yet. |

## What is proven today

| Claim | Status | Evidence |
|---|---|---|
| Protocol schemas, states, accounting, hashing and canonical fixtures compile and pass tests | **VERIFIED (local)** | `npm test -w @mend/protocol` → 4 files, 26 tests passed on 2026-11-09 |
| The canonical 100 → 80 → 20 → 72 → 8 accounting is exact integer math | **VERIFIED (local)** | [05](./05-payment-accounting.md), `packages/protocol/test/accounting.test.ts` |
| Canonical bids A/B/C score 2873 / 9270 / 5200 and B wins | **VERIFIED (local)** | `packages/protocol/test/scoring.test.ts`, [RULES.md](./RULES.md) |
| Documented external endpoints, versions and limits are traceable to the research docs | **VERIFIED (research)** | [16](./16-integration-evidence.md) |
| MEND live testnet lifecycle, hosted demo, video, repair media | **BLOCKED_ON_HUMAN / NOT COLLECTED** | No transactions or media exist yet |

## Cross-document rule

Every document in this directory links back here and to the documents that
explain its claims. Relative links are checked by
`node scripts/demo/check-docs.mjs`; a dead relative link fails the check.

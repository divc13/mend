# MEND — Maintenance with memory

**Get it fixed. Keep it fixed.**

MEND is a community asset repair protocol on NEAR. A broken bench, bicycle rack,
fence or community-centre door moves through one permanent lifecycle:

```text
Report → private triage → steward scope → DAO authorization → sponsorship →
sealed bids → deterministic scoring → physical repair → independent human
inspection → 90% payment → 10% durability holdback → later inspection →
holdback release OR warranty reopening → permanent asset history
```

**The differentiator:** a failed repair reopens the **same work order** and the
same warranty history. It does not create a fresh bounty that lets the failure
disappear.

> **Honest status (2026-11-09).** This branch contains the frozen protocol, docs
> and demo harness. The web app, API, contracts, compute and services are in
> sibling worktrees and are `PENDING INTEGRATION`. There are no live testnet
> transactions, no hosted demo, no video and no collected repair media yet.
> External claims are labelled **VERIFIED**, **UNAVAILABLE** or
> **BLOCKED_ON_HUMAN**. See [Limitations](./docs/11-limitations.md).

## Modes

| Mode | Label | Meaning |
|---|---|---|
| Replay | `REPLAY / SIMULATION` | Recorded fixtures; runs with no credentials; never shown as live |
| Testnet | `LIVE TESTNET — TEST VALUE ONLY` | Real testnet transactions with test value |
| Mainnet | `MAINNET — REAL FUNDS` | Real money; never the default; explicit human approval per transaction |

## Do X → See Y

The first block works **today** on this branch. The second block becomes available
after the orchestrator integrates the application and contracts.

### Works today

| Do X | See Y |
|---|---|
| `npm ci` | Dependencies installed; 0 vulnerabilities in the frozen workspace |
| `npm test -w @mend/protocol` | `Test Files 4 passed (4)`, `Tests 26 passed (26)` |
| `npm run typecheck -w @mend/protocol` | TypeScript completes with no errors |
| `node scripts/demo/check-docs.mjs` | `RESULT: PASS — documentation, links, anchors, templates and claims are consistent.` |
| `node scripts/demo/capture-replay-demo.mjs` | `STATUS: PENDING` with the exact missing prerequisite (web app and/or Playwright) |
| Open [docs/README.md](./docs/README.md) | Documentation index with evidence labels and status |
| Open [docs/13-demo-script.md](./docs/13-demo-script.md) | The 90-second script with timestamps, narration and placeholders |
| Open [fixtures/demo/README.md](./fixtures/demo/README.md) | Evidence, consent and real-vs-staged templates; all `NOT COLLECTED` |
| Open [docs/16-integration-evidence.md](./docs/16-integration-evidence.md) | Every external claim with `VERIFIED / UNAVAILABLE / BLOCKED_ON_HUMAN` |

### Pending integration

These commands describe the intended integrated repository. They do **not** work
on this branch yet. Do not claim they do.

| Do X | See Y | Status |
|---|---|---|
| `docker compose -f infra/docker-compose.yml up -d` | Local Postgres, private object storage, API, workers and web | `PENDING INTEGRATION` |
| Open `http://localhost:3000` | Public map, report flow and mode badge | `PENDING INTEGRATION` |
| Select `REPLAY / SIMULATION` | Scenario A (successful repair), B (failed durability), C (prompt injection), D (sponsorship uncertainty), E (judge replay) with no credentials | `PENDING INTEGRATION` |
| Run scenario A | 100 budget → 80 award → 20 refund → 72 paid → 8 held → 8 released; passport `CLOSED` | `PENDING INTEGRATION` |
| Run scenario B | Durability fails; same work order becomes `WARRANTY_REOPENED`; no new funds; holdback released once after a remedy | `PENDING INTEGRATION` |
| Run scenario C | Injected instruction is blocked; no recipient, role, scope or payment change | `PENDING INTEGRATION` |
| Run scenario D | Dry quote, pending, underpayment, failure, refund and success are all labelled honestly; a quote is never a payment | `PENDING INTEGRATION` |
| Run scenario E | Every scenario plays from recorded artifacts with a replay watermark and no live transaction links | `PENDING INTEGRATION` |
| Run `npm test` (all workspaces) | Currently only the protocol workspace runs (26 tests); contract, API, agent and E2E suites are `PENDING INTEGRATION` | `PENDING INTEGRATION` |
| Run `bash scripts/verify.sh` | Full local verification including clean-room checks | `PENDING INTEGRATION` |
| Run `npm run demo:reset` | Deterministic reset of designated demo data only | `PENDING INTEGRATION` |
| Open the inspector console | Redacted evidence, checklist, AI completeness suggestions, human acceptance controls | `PENDING INTEGRATION` |
| Open the verification panel | AI evidence, OutLayer score binding, DAO authorization and transaction links, each labelled honestly | `PENDING INTEGRATION` |

### Human-gated flows

| Do X | See Y | Status |
|---|---|---|
| Configure a NEAR AI key and run triage | Authenticated inference + signature/attestation evidence, or an honest `UNAVAILABLE` | `BLOCKED_ON_HUMAN` |
| Publish the bid-rules WASM and fund a testnet execution | Hash-bound ranking; separately verified TEE attestation | `BLOCKED_ON_HUMAN` |
| Deploy the hub, token and DAO to testnet | Real testnet lifecycle with real transaction links | `BLOCKED_ON_HUMAN` |
| Request an Intents dry quote | Quote, fees and destination, labelled `DRY QUOTE — NOT A PAYMENT` | Read-only API **VERIFIED**; live deposit `BLOCKED_ON_HUMAN` |
| Approve a tiny mainnet Intents deposit | Real mainnet execution with an explorer link | `BLOCKED_ON_HUMAN` |
| Run an Agent Market evidence-review job | External completeness findings; a human still accepts | `BLOCKED_ON_HUMAN` |
| Record the demo | A 90-second video from the integrated REPLAY app | `BLOCKED_ON_HUMAN` / `NOT COLLECTED` |

### REPLAY with no credentials

Status: `PENDING INTEGRATION`. When the app is merged, the exact flow is:

1. `npm ci`
2. `docker compose -f infra/docker-compose.yml up -d`
3. Open `http://localhost:3000`
4. Select `REPLAY / SIMULATION` in the mode control.
5. Choose scenario A, B, C, D or E.
6. Do **not** connect a wallet and do **not** enter an API key.
7. Confirm the replay watermark stays visible and every transaction link is
   absent or explicitly marked replay.

Expected: the same five scenarios run from recorded artifacts. A replay is never
shown as a live transaction, and a dry quote is never shown as a payment.

### Local stack and tests

Status: `PENDING INTEGRATION` except for the protocol workspace.

```bash
npm ci
npm test -w @mend/protocol          # works today: 26 tests
npm run typecheck -w @mend/protocol # works today
npm test                            # currently protocol only; full suites pending
bash scripts/verify.sh              # full verification; pending integration
```

## Why the winner is not an AI choice

`docs/RULES.md` is the human-readable policy; `compute/bid-rules` is the
hash-pinned WASM. Canonical bids:

| Bid | Price | Duration | Warranty | Materials | Score |
|---|---:|---:|---:|---:|---:|
| A | 95 | 14 d | 90 d | 60 | 2873 |
| B | 80 | 10 d | 180 d | 80 | **9270** |
| C | 78 | 21 d | 30 d | 70 | 5200 |

B wins on total value, not the lowest sticker price. No LLM ranks or selects the
winner. See [`RULES.md`](./docs/RULES.md) and
[Payment accounting](./docs/05-payment-accounting.md).

## Repository layout

| Path | Responsibility | Status |
|---|---|---|
| `packages/protocol` | Schemas, state machine, accounting, scoring, fixtures | **FROZEN** — 26 tests pass |
| `docs/` | Product, privacy, threat model, demo and submission docs | **IMPLEMENTED** |
| `scripts/demo/` | Docs checker and REPLAY capture harness | **IMPLEMENTED** |
| `fixtures/demo/` | Evidence, consent, transaction and submission templates | **IMPLEMENTED** (no collected media) |
| `apps/web` | Next.js public case experience and consoles | `PENDING INTEGRATION` |
| `apps/api` | Fastify API, private media and chain commands | `PENDING INTEGRATION` |
| `contracts/hub` | Registry, passport, work orders, escrow, warranty | `PENDING INTEGRATION` |
| `contracts/test-token` | Testnet-only NEP-141 mock USDC | `PENDING INTEGRATION` |
| `compute/bid-rules` | Deterministic Rust/WASM scorer | `PENDING INTEGRATION` |
| `services/` | Agents, DAO watcher, relayer, indexer | `PENDING INTEGRATION` |
| `tests/` | Integration, E2E, security and clean-room suites | `PENDING INTEGRATION` |
| `infra/` | Local stack and deployment | `PENDING INTEGRATION` |
| `orchestration/` | Research, decisions, task packets and evidence | Read-only input |

## Evidence labels

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed on 2026-11-09 by a live read-only request, official docs/OpenAPI, or pinned source. Not a claim that MEND executed the full flow. |
| **UNAVAILABLE** | The capability does not exist or is not a stable contract (for example: Intents has no testnet; Agent Market has no worker accept endpoint; gasless escrow funding is impossible with a function-call key). |
| **BLOCKED_ON_HUMAN** | The capability exists but needs a human-supplied credential, funded account, consent, approval or signature. |

The full matrix is [docs/16-integration-evidence.md](./docs/16-integration-evidence.md).

## Documentation

Start at [docs/README.md](./docs/README.md). Key pages:

- [Problem and product](./docs/01-problem-and-product.md)
- [User roles](./docs/02-user-roles.md)
- [Architecture](./docs/03-architecture.md)
- [State machine](./docs/04-state-machine.md)
- [Payment accounting](./docs/05-payment-accounting.md)
- [Privacy model](./docs/06-privacy-model.md)
- [Threat model](./docs/07-threat-model.md)
- [Oracle and human trust](./docs/08-oracle-and-human-trust.md)
- [Failure cases](./docs/09-failure-cases.md)
- [Deployment guide](./docs/10-deployment-guide.md)
- [Limitations](./docs/11-limitations.md)
- [Real-world evidence package](./docs/12-real-world-evidence-package.md)
- [90-second demo script](./docs/13-demo-script.md)
- [Submission package](./docs/14-submission-package.md)
- [Demo capture plan](./docs/15-demo-capture-plan.md)
- [Copy and accessibility](./docs/17-copy-and-accessibility.md)

## HUMAN SUPPLIED — DO NOT INVENT

The following are not in this repository and must come from a person:

- team identity, wallet/payout address, public repository URL, hosted demo URL;
- track name and required event tags;
- real testnet/mainnet transaction and explorer links;
- repair media, consent records and durability evidence;
- final submission confirmation.

See [docs/14-submission-package.md](./docs/14-submission-package.md).

## Accessibility and trust

Target: WCAG 2.2 AA, with keyboard, focus, contrast, captions and reduced-motion
commitments. An audit is pending integration. No claim of accessibility
certification is made. See
[docs/17-copy-and-accessibility.md](./docs/17-copy-and-accessibility.md).

## License

MIT. See the repository `LICENSE` file (held by the integration branch). The docs
worktree was cut before that file was staged; the orchestrator must include it in
the public repository.

## Contributing and plan

- [Master plan](./PLAN.md) — authoritative scope.
- [Contributing](./CONTRIBUTING.md) — ownership and workspace rules.
- Architecture decision and hub interface: `orchestration/decisions/ADR-001-architecture.md` and `orchestration/decisions/HUB-INTERFACE.md` (orchestrator workspace; not tracked on this branch).

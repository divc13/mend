# MEND — Maintenance with memory

**Get it fixed. Keep it fixed.**

A pothole sits at the end of a street for months. Everyone swerves. Nobody owns
it. Sam takes a photo, writes one sentence and sends it — no wallet, no account,
no home address attached.

MEND turns that report into a public repair with a memory. A steward writes the
scope. A community DAO approves the budget. Contractors bid in a sealed market.
A deterministic rule picks the best value. A different human inspects the work.
The money splits **72 paid / 8 held**, and the last 8 is released only after a
later durability check. If the repair fails, the **same work order** and the same
history reopen — not a fresh bounty that lets the failure disappear.

The point is not "put a repair on a chain". The point is that the decisions, the
money and the failure stay attached to the asset.

## Live now

| What | Where | State |
|---|---|---|
| Public app | https://mend-demo.vercel.app | Full API-backed live app; no login, no demo runner |
| Canonical case | https://mend-demo.vercel.app/cases/WO-BENCH-V2-001-0002 | Real V2 testnet case, final `CLOSED` |
| API health | https://mend-api-phi.vercel.app/health | `LIVE_TESTNET`, `repository: postgres`, `database: reachable` |
| Proof page | https://mend-demo.vercel.app/how-it-works | Stack, transactions and labelled evidence |
| Trust model | https://mend-demo.vercel.app/trust | Verified, unavailable and human evidence kept separate |
| Current film | `demo/ad/out/mend-ad-v4-master.mp4` | 3:33.57, 61 MB, SHA-256 `080e87b6d93d4a7756e48df8c024cffc51b6253e3601d197c3ba3f2d549bcd7b`; public video URL not assigned |

The hosted app runs on Vercel Functions plus Neon Free Postgres. The canonical
case is `CLOSED`, so award and accept controls are correctly disabled. Everything
on testnet is test value only.

### The 42-transaction proof

`WO-BENCH-V2-001-0002` on `mend-hub-v2.testnet` is a real NEAR testnet lifecycle
with a real Sputnik DAO: **42 recorded transactions, 42/42 resolve with success,
exact 100 / 20 / 72 / 8 accounting, escrow 0**. The passport is hub-owned and
every passport transfer path is rejected.

Spot-check the important receipts:

| Step | Transaction |
|---|---|
| DAO authorization (`mend-dao.sputnikv2.testnet`, proposal 1, 2/3) | [`8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h`](https://explorer.testnet.near.org/transactions/8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h) |
| Fund 100 test mUSDC into escrow | [`3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2`](https://explorer.testnet.near.org/transactions/3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2) |
| Inspector accepts completion (72 released) | [`EQ8HoNvDazagbM5zdUq38EK7cyhgi8hqPXJkDhzdxN2o`](https://explorer.testnet.near.org/transactions/EQ8HoNvDazagbM5zdUq38EK7cyhgi8hqPXJkDhzdxN2o) |
| Later durability pass (8 released) | [`CmmAPvfonQa7Y9CEXpcnWQhbUVcRK3nWXAADH84kJS4g`](https://explorer.testnet.near.org/transactions/CmmAPvfonQa7Y9CEXpcnWQhbUVcRK3nWXAADH84kJS4g) |

All 42 hashes, signers, methods and amounts are in
[`infra/testnet-v2/LIVE-V2.md`](./infra/testnet-v2/LIVE-V2.md) and
[`infra/testnet-v2/live-state.json`](./infra/testnet-v2/live-state.json). The
earlier 57-transaction `WO-BENCH-001-0003` run on `mend-hub.testnet` remains as
history.

## The stack, in plain English

| Piece | Kid translation | What it actually does | Why it matters |
|---|---|---|---|
| **Next.js / React** | "The website and the screens you tap." | Public case pages, the walletless report flow, and the steward and inspector consoles. Server components read the API. | A resident, steward or inspector can use MEND in a normal browser with no wallet plugin. |
| **Browser EXIF stripping** | "The phone forgets where and when the photo was taken before sending it." | The browser removes EXIF/XMP/GPS metadata and burns manual redaction boxes into the pixels before upload. | A pothole photo cannot quietly reveal a home, a school route, a plate or a daily timetable. |
| **Fastify / Postgres** | "The front desk and the filing cabinet." | Fastify validates reports, runs role checks and serves the API. Postgres stores the private case ledger and timeline. Neon hosts it in the live demo. | Residents, stewards and inspectors share one authoritative record while public pages get only the redacted view. |
| **NEAR AI** | "A helper that reads the cleaned note and makes suggestions." | Server-side private triage proposes duplicate candidates and a draft scope. Output is parsed as data against a strict schema. | Triage gets faster without giving a model a wallet, a key, an approval button or payment authority. |
| **Rust escrow on NEAR** | "A locked money box that follows written rules." | `contracts/hub` holds test mUSDC, tracks the work order, refunds unused budget at award, pays 90% on human acceptance and holds 10% for durability. | The payout rule is public code and public state, not an operator's promise. |
| **Sputnik DAO** | "The committee's public vote." | A 2-of-3 council proposal executes a `FunctionCall` to `dao_authorize`; the hub accepts authorization only from its configured DAO. | Budget and scope authority stay with named humans, and the decision has an on-chain receipt. |
| **OutLayer** | "A referee in a sealed booth who runs the scoring rule." | The hash-pinned Rust/WASM bid policy can run on OutLayer testnet with a captured attestation. Request `15579` is the live evidence. | Scoring is reproducible and independent of an LLM. The Intel DCAP/ITA chain is not independently verified, so that limit is labelled. |
| **1Click (pending)** | "A currency-exchange window that is still closed." | NEAR Intents quote, dry-preview and status client. A signed non-dry quote is allocated and `PENDING_DEPOSIT`; no deposit or settlement has executed. | Cross-chain sponsorship is designed and honestly labelled. It is **not** used for this repair and is not counted as funding. |
| **Agent Market** | "A second pair of eyes you can hire." | Listing `mend-evidence-review` lets an external worker return evidence-completeness findings. A human buyer still accepts. | Extra review without pretending a marketplace job is a safety certificate. The live paid run was a disclosed self-hire. |
| **NEP-366** | "A signed permission slip so a helper can pay the network fee." | A relayer submits allowlisted, replay-protected meta-transactions for a scoped function-call key. | An agent can act without holding the user's key. Gasless *funding* is still impossible with a function-call key. |
| **Passport** | "A permanent report card for the broken thing." | A non-transferable NEP-171 token owned by the hub links the asset to every work order, inspection, payment and warranty event. | A failed repair stays attached to the asset. The passport is history, not legal ownership. |

## Why the AI is private

A pothole photo is not just a pothole. A phone photo can carry GPS coordinates,
a timestamp, the device model and a thumbnail of a face or a licence plate. A
repair at the end of your street can draw a line from your home to your kid's
school. A photo of a broken fence can show a neighbour's plate.

MEND removes the sensitive parts **before** the model or the chain sees anything:

1. **In the browser, before upload.** EXIF/XMP/GPS is removed, the reporter can
   paint over faces and plates, and the redaction is applied to the pixels. The
   perceptual hash used for duplicate detection is computed on the cleaned image.
2. **On the server.** The AI receives the cleaned report and redacted media only.
   It does not receive the reporter's identity, the private case link, the precise
   location or the raw EXIF.
3. **In the model's job description.** The AI returns a duplicate suggestion, a
   category, a confidence and a rationale. It cannot sign a transaction, move
   money, change a recipient, award a job or accept an inspection.
4. **In the human loop.** A steward confirms any duplicate merge and edits the
   scope. The DAO authorizes the budget. A rostered human inspector — never the
   contractor and never the AI — accepts completion.

The evidence is then labelled, not blurred:

> **`SIGNED RESPONSE · TEE PROOF UNAVAILABLE (LABELLED)`**
>
> The live NEAR AI run returned a `provider_tee` ECDSA signature over the exact
> request and response bytes. Request hash, response hash, signed text and
> signature checks all pass. But no matching TEE attestation report was retained
> (`signerMatchesReport: false`), so the stored artifact is `verified: false`,
> the API label is `UNVERIFIED_INFERENCE`, and the UI shows **Unavailable
> evidence**. MEND does **not** claim a fully verified TEE, an end-to-end
> attestation chain or Intel DCAP/ITA verification. See
> [`scripts/near-ai-live/LIVE-NEAR-AI.md`](./scripts/near-ai-live/LIVE-NEAR-AI.md).

## One complete moment

This is the whole product in one repair. The film tells it with a pothole in
`REPLAY / SIMULATION`. The real money proof is the separate V2 testnet bench
lifecycle.

| Step | What happens | What proves it |
|---|---|---|
| 1. Report | Sam photographs the pothole and writes one sentence. No wallet. GPS and EXIF are stripped in the browser. | Report flow and API tests; `POST /v1/reports` returns a private `case_...` link |
| 2. Private triage | NEAR AI suggests a duplicate and a scope. A steward confirms the merge and edits the scope. | Live NEAR AI `R-001` run; signature valid, TEE report unavailable and labelled |
| 3. DAO budget | The steward sets a maximum budget and roster. The Sputnik DAO approves 2-of-3 and calls `dao_authorize`. | Real `mend-dao.sputnikv2.testnet` proposal 1, executed |
| 4. Escrow | A sponsor funds **100** test mUSDC. At award, the unused **20** is refunded; **80** stays in escrow. | V2 funding and refund transactions, escrow 0 at the end |
| 5. Sealed bids | Three contractors commit and reveal. A hash-pinned policy scores B **9270**, C **5200**, A **2873**. B wins on total value, not the lowest sticker price. | V2 commit/reveal transactions; policy hash `b35cff...ce19f` |
| 6. Repair + inspection | B repairs the asset and submits evidence hashes. A different human inspector checks the checklist and accepts. | V2 `accept_completion` by `mend-inspector.testnet` |
| 7. 100 / 20 / 72 / 8 | **72** goes to the contractor on acceptance; **8** stays in the durability holdback. A later pass releases the **8**; remaining escrow is **0**. | Exact NEP-141 events; 42/42 transactions resolve |
| 8. Passport | The non-transferable passport keeps the work order, inspection, payments and warranty state. A failure would reopen the same work order as `WARRANTY_REOPENED`, with no new funds. | Hub-owned NEP-171 passport; every transfer path rejected |

The failed-durability branch that reopens the same work order is proven in
contract and replay tests. The live V2 testnet run exercised the **passing**
durability branch; this distinction is not hidden.

## What NEAR is doing

| NEAR piece | Job in MEND | Where it ran |
|---|---|---|
| **Sputnik DAO budget** | 2-of-3 human approval of scope and budget, pushed to the hub as `dao_authorize` | **In the V2 repair**: real `mend-dao.sputnikv2.testnet`, proposal 1 |
| **Rust escrow** | Holds the budget, enforces state transitions, refunds at award, pays 90%, holds 10%, releases on durability | **In the V2 repair**: `mend-hub-v2.testnet`, exact 100/20/72/8 |
| **NEAR AI** | Private duplicate and scope suggestions with a signed response; no payment authority | **Live triage** on `R-001`; separate from the V2 escrow, TEE report unavailable |
| **NEP-366** | Relayed, allowlisted meta-transactions for a scoped function-call key | **Separate live proof**: a real relayed `create_work_order` that created an unfunded `DRAFT`; replay, wrong receiver, wrong method and expiry were rejected |
| **OutLayer** | Hash-pinned deterministic scorer with a captured testnet attestation | **Separate live request** `15579`; the V2 lifecycle score was recorded as `LOCAL_DETERMINISTIC`, not as an OutLayer score |
| **Agent Market** | External evidence-completeness review, with human acceptance | **Separate live listing and paid `$0.01` self-hire**; not part of the V2 payout |
| **1Click** | Cross-chain sponsorship quotes and status | **Pending, not used for this repair**: signed quote is `PENDING_DEPOSIT`, no funds moved |

Mainnet is never the default. The live app is `LIVE TESTNET — TEST VALUE ONLY`.
Intents is mainnet-only, and any deposit needs explicit human approval.

## Tracks

Multiple tracks are allowed. Recommendation, with one sentence each:

| Track | Why MEND fits |
|---|---|
| `social` | A walletless report and private evidence let neighbours fix shared assets without publishing a home, a school route or a plate, while the repair history stays public. |
| `realworld` | The 42-transaction V2 testnet run is an actual escrow-and-inspection lifecycle — DAO vote, sealed bids, escrow, independent inspection and a durability holdback — not a mock of one. |
| `security` | Privacy is enforced before upload, money moves only through a Rust escrow under human and DAO authority, and every AI or OutLayer claim is labelled instead of rounded up. |
| `agents` (optional) | NEAR AI drafts and checks, NEP-366 lets a scoped relayer act, and Agent Market adds an outside reviewer — each bounded, receipted and never the approver. |

The exact event track names, required tags and form fields are human-supplied.
Copy them from the current event rules; do not infer them from this table.

## Modes

| Mode | Label | Meaning |
|---|---|---|
| Replay | `REPLAY / SIMULATION` | Recorded fixtures; runs with no credentials; never shown as live |
| Testnet | `LIVE TESTNET — TEST VALUE ONLY` | Real testnet transactions with test value |
| Mainnet | `MAINNET — REAL FUNDS` | Real money; never the default; explicit human approval per transaction |

## Do X → See Y

The first block runs locally today. The second block is live on the hosted app
and on NEAR testnet. Statuses distinguish verified paths from human-gated ones.

### Works today

| Do X | See Y |
|---|---|
| `npm ci` | Dependencies installed from the committed lockfile |
| `npm test -w @mend/protocol` | `Test Files 4 passed (4)`, `Tests 26 passed (26)` |
| `npm run typecheck -w @mend/protocol` | TypeScript completes with no errors |
| `node scripts/demo/check-docs.mjs` | `RESULT: PASS — documentation, links, anchors, templates and claims are consistent.` |
| `node scripts/demo/capture-replay-demo.mjs` | The current capture state, reported honestly; it never fakes a recording (a silent MP4 exists at `fixtures/demo/captures/mend-replay-demo.mp4`) |
| Open [docs/README.md](./docs/README.md) | Documentation index with evidence labels and status |
| Open [docs/13-demo-script.md](./docs/13-demo-script.md) | The 90-second script with timestamps, narration and placeholders |
| Open [fixtures/demo/README.md](./fixtures/demo/README.md) | Evidence, consent and real-vs-staged templates; all `NOT COLLECTED` |
| Open [docs/16-integration-evidence.md](./docs/16-integration-evidence.md) | Every external claim with `VERIFIED / UNAVAILABLE / BLOCKED_ON_HUMAN` |

### See it live

| Do X | See Y | Status |
|---|---|---|
| Open https://mend-demo.vercel.app | Public map, report flow and mode badge backed by the live API | LIVE — full API-backed app |
| Open https://mend-demo.vercel.app/cases/WO-BENCH-V2-001-0002 | The canonical V2 case, final `CLOSED`, with the exact 100/20/72/8 split | VERIFIED — real testnet data |
| `curl -s https://mend-api-phi.vercel.app/health` | `LIVE_TESTNET`, Postgres reachable, chain adapter live, Intents unconfigured | VERIFIED |
| Open https://mend-demo.vercel.app/how-it-works | Transaction hashes, AI signature caveat, DAO and Agent Market evidence | VERIFIED |
| Open https://explorer.testnet.near.org/accounts/mend-hub-v2.testnet | Real hub contract and transaction history | VERIFIED — testnet |
| Run scenario A locally | 100 budget → 80 award → 20 refund → 72 paid → 8 held → 8 released; passport `CLOSED` | VERIFIED — G2 evidence |
| Run scenario B locally | Durability fails; the same work order becomes `WARRANTY_REOPENED`; no new funds; holdback released once after a remedy | CONTRACT VERIFIED; UI flow partial |
| Run scenario C locally | Injected instruction is blocked; no recipient, role, scope or payment change | PASS — guard and tests |
| Run scenario D locally | Dry quote, pending, underpayment, failure, refund and success are labelled honestly; a quote is never a payment | IMPLEMENTED — 99 client tests + live dry smoke |
| `npm test` (all workspaces) | Protocol, AI, Intents, API, DB, indexer, agents and web build pass | PASS |
| `bash scripts/verify.sh` | Full local verification including contracts and secret scan | PASS — 18 checks |

### Still human-gated or unavailable

| Do X | See Y | Status |
|---|---|---|
| Approve a tiny mainnet Intents deposit | Real mainnet execution with an explorer link | `BLOCKED_ON_HUMAN` — signed quote is `PENDING_DEPOSIT`; no funds moved |
| Publish the repository | A public GitHub repository | `BLOCKED_ON_HUMAN` — currently private |
| Post the demo on X | A public post tagging `@NEARProtocol` and `#NEARHackathon` | `BLOCKED_ON_HUMAN` — draft only |
| Submit the event form | A confirmation from the event | `BLOCKED_ON_HUMAN` — no submission performed |
| Collect real repair media | Consented before/repair/after/durability evidence | `NOT COLLECTED` — the film uses labelled illustrative stock |
| Fully verify the NEAR AI or OutLayer TEE report | Intel DCAP/ITA chain and RTMR replay | `UNAVAILABLE` — signature valid, report not retained |
| Gasless escrow funding | `ft_transfer_call` with no deposit | `UNAVAILABLE` — a function-call key cannot attach the 1 yoctoNEAR deposit |

### REPLAY with no credentials

Status: `IMPLEMENTED — verified locally in REPLAY` (see
[G2 evidence](./orchestration/reports/G2-evidence.md)). From a fresh clone, run
`git clone <repository-url>` then follow the steps below.

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

Status: `IMPLEMENTED` — all local suites run without credentials.

```bash
npm ci
npm test                            # all workspaces
bash scripts/verify.sh              # 18 checks: typecheck, protocol, API,
                                    # agents, contracts, WASM, secret scan, compose
docker compose -f infra/docker-compose.yml up -d
```

The contract replay, API, agents, web build and real testnet escrow lifecycle
are verified. Live AI signature, Sputnik DAO, OutLayer execution, NEP-366
relayer and Agent Market evidence exist with the caveats in
[`STATUS.md`](./STATUS.md). The Intents deposit/settlement and real physical
repair evidence are not done. See [`STATUS.md`](./STATUS.md).

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
| `apps/web` | Next.js public case experience and consoles | **IMPLEMENTED** — build passes |
| `apps/api` | Fastify API, private media and chain commands | **IMPLEMENTED** — 53 tests |
| `contracts/hub` | Registry, passport, work orders, escrow, warranty | **IMPLEMENTED** — 30 tests |
| `contracts/test-token` | Testnet-only NEP-141 mock USDC | **IMPLEMENTED** — 5 tests |
| `compute/bid-rules` | Deterministic Rust/WASM scorer | **IMPLEMENTED** — 12 tests + WASM |
| `services/` | Agents, DAO watcher, relayer, indexer | **IMPLEMENTED** — 91 tests |
| `tests/` | Integration, E2E, security and clean-room suites | **IMPLEMENTED** — see tests/README |
| `infra/` | Local stack and deployment | **IMPLEMENTED** — compose/CI validated |
| `orchestration/` | Research, decisions, task packets and evidence | Read-only input |

## Evidence labels

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed by a live read-only request, official docs/OpenAPI, or pinned source, and reconciled with the current evidence file. Not a claim that MEND executed every part of a flow. |
| **UNAVAILABLE** | The capability does not exist or is not a stable contract (for example: Intents has no testnet; Agent Market has no worker accept endpoint; gasless escrow funding is impossible with a function-call key). |
| **BLOCKED_ON_HUMAN** | The capability exists but needs a human-supplied credential, funded account, consent, approval or signature. |

The full matrix is [docs/16-integration-evidence.md](./docs/16-integration-evidence.md).

## Submission checklist

Full detail is in
[docs/14-submission-package.md](./docs/14-submission-package.md#submission-checklist).
Nothing here has been submitted or published.

- [ ] Make the repository public; keep the license and CI badge visible.
- [ ] Publish the X post tagging `@NEARProtocol` and `#NEARHackathon`, with the
      live demo and film links.
- [ ] Fill the event form: team identity, track(s), repo URL, demo URL, video
      URL, description, wallet/payout if required.
- [ ] Keep https://mend-demo.vercel.app, the API and Neon Postgres up through
      judging.
- [ ] Verify the canonical case, the 42 transactions and the video hash once
      more immediately before submitting.
- [ ] Have a human watch and listen to the final cut, then press submit.

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
- [Integration evidence matrix](./docs/16-integration-evidence.md)
- [Copy and accessibility](./docs/17-copy-and-accessibility.md)

The authoritative feature and gate matrix is [`STATUS.md`](./STATUS.md).

## HUMAN SUPPLIED — DO NOT INVENT

The following are not in this repository and must come from a person:

- team identity and wallet/payout address;
- public repository URL (the current repo is private);
- public video URL (the local master exists; the upload is not done);
- exact event track names, required tags and form fields;
- final submission confirmation.

Real testnet transaction links are in this repository and are not placeholders.
Mainnet links do not exist because no mainnet protocol action has executed. See
[docs/14-submission-package.md](./docs/14-submission-package.md).

## Accessibility and trust

Target: WCAG 2.2 AA, with keyboard, focus, contrast, captions and reduced-motion
commitments. An audit is pending integration. No claim of accessibility
certification is made. See
[docs/17-copy-and-accessibility.md](./docs/17-copy-and-accessibility.md).

## License

MIT. See the repository [`LICENSE`](./LICENSE) file.

## Contributing and plan

- [Master plan](./PLAN.md) — authoritative scope.
- [Contributing](./CONTRIBUTING.md) — ownership and workspace rules.
- Architecture decision and hub interface: `orchestration/decisions/ADR-001-architecture.md` and `orchestration/decisions/HUB-INTERFACE.md`.

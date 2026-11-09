# 03 — Architecture

MEND is an npm-workspaces monorepo. The hub contract is the financial source of
truth; the web app, API and indexer present that truth and hold private data.
This document names the real repository paths, the data flow, the trust
boundaries and the current implementation status of each part.

## System shape

```text
 Reporter (no wallet)          Steward / DAO / Sponsor            Public viewer
        │                              │                              │
        ▼                              ▼                              ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ apps/web — Next.js public case experience, reporter flow, consoles      │
 └───────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTPS, server-only secrets
                                 ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ apps/api — Fastify API, private media handling, chain command service   │
 │   │                    │                     │                          │
 │   │ private media      │ read model          │ signed chain commands    │
 │   ▼                    ▼                     ▼                          │
 │ object storage     Postgres              NEAR RPC                       │
 └─────────────────────────────────────────────────────────────────────────┘
        │                    ▲                     │
        │ events             │ indexer             │ transactions
        ▼                    │                     ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ contracts/hub — registry, work orders, non-transferable passport,       │
 │ escrow, sealed bids, score binding, payments, durability, warranty      │
 │ contracts/test-token — testnet-only NEP-141 mock USDC                   │
 └───────┬──────────────────────┬───────────────────────┬──────────────────┘
         │ request_execution    │ dao_authorize         │ ft_transfer_call
         ▼                      ▲                       ▲
 compute/bid-rules        Sputnik DAO v2           sponsor / Intents
 (OutLayer WASM)          (approved proposal)       (mainnet only)
```

## Components and real repository paths

`PENDING INTEGRATION` means the path is the agreed ownership location from
`PLAN.md`, but the code is not on this documentation branch. This table is the
honest state on 2026-11-09.

| Component | Real path | Responsibility | Status |
|---|---|---|---|
| Protocol | `packages/protocol` | Zod schemas, JSON Schema/OpenAPI, state machine, errors, events, IDs, payment basis points, canonical fixtures, hashing, deterministic scoring | **FROZEN** — 26 tests pass |
| Web app | `apps/web` | Public map and case pages, reporter flow, steward/inspector/sponsor consoles, bid room, passport, verification panels, demo control room | `PENDING INTEGRATION` |
| API | `apps/api` | Fastify endpoints, report workflows, private media, chain command service, verification artifacts, demo reset | `PENDING INTEGRATION` |
| Hub contract | `contracts/hub` | Role registry, assets, passport, work orders, DAO authorization, escrow, commit/reveal, score binding, award, acceptance, payments, durability, warranty, disputes, pause | `PENDING INTEGRATION` |
| Test token | `contracts/test-token` | Testnet-only NEP-141 mock USDC, clearly labelled test value | `PENDING INTEGRATION` |
| Bid rules | `compute/bid-rules` | Deterministic Rust/WASM scorer (`wasm32-wasip1`) executed by OutLayer | `PENDING INTEGRATION` |
| Coordinator agent | `services/coordinator-agent` | Scope/work-order proposals; no payment authority | `PENDING INTEGRATION` |
| Contractor agents | `services/contractor-agent` | Deterministic sealed bid strategies and commit/reveal signing | `PENDING INTEGRATION` |
| Inspector agent | `services/inspector-agent` | Completeness suggestions; no final acceptance | `PENDING INTEGRATION` |
| Agent Market worker | `services/agent-market-worker` | Poll/start/submit evidence-review jobs; redacted briefs only | `PENDING INTEGRATION` |
| DAO watcher | `services/dao-watcher` | Observe DAO proposals and hub authorization; verify roster/policy references | `PENDING INTEGRATION` |
| Relayer | `services/relayer` | NEP-366 `Delegate` forwarding for allowlisted MEND methods only | `PENDING INTEGRATION` |
| Indexer | `services/indexer` | Rebuild the Postgres read model from hub events | `PENDING INTEGRATION` |
| NEAR client | `packages/near-client` | RPC, transaction construction, view helpers, key handling | `PENDING INTEGRATION` |
| AI client | `packages/ai-client` | Privacy transforms, NEAR AI calls, JSON-schema validation, attestation/signature verification | `PENDING INTEGRATION` |
| Intents client | `packages/intents-client` | 1Click tokens/quotes/status, dry preview, signature verification, reconciliation | `PENDING INTEGRATION` |
| Database | `packages/db` | Postgres schema, migrations, constraints, append-only audit events | `PENDING INTEGRATION` |
| Config | `packages/config` | Environment modes, mainnet guard, secret boundaries | `PENDING INTEGRATION` |
| Test kit | `packages/testkit` | Sandbox helpers, fixtures, deterministic clocks | `PENDING INTEGRATION` |
| Tests | `tests/integration`, `tests/e2e`, `tests/security`, `tests/clean-room` | Lifecycle, replay, adversarial, privacy and clean-room suites | `PENDING INTEGRATION` |
| Infrastructure | `infra` | Local stack, deployment manifests, observability | `PENDING INTEGRATION` |
| Demo fixtures | `fixtures/demo` | Evidence templates and recorded-scenario artifacts | **IMPLEMENTED** (templates only; no captured media) |
| Docs and demo scripts | `docs`, `scripts/demo` | This package, docs checker, REPLAY capture harness | **IMPLEMENTED** |
| Orchestration | `orchestration` | Task packets, research, decisions, progress, evidence | Read-only input to this track |

## Request and data flows

### 1. Walletless report

```text
Browser
  → strip EXIF locally
  → local redaction
  → compute perceptual hash on the redacted image
  → upload redacted image + description + coarse public location
  → keep precise location out of public fields
apps/api
  → store private media in object storage with signed access
  → store precise location reference off-chain only
  → create report + high-entropy case link
  → call private AI triage (server-side key only)
  → return duplicate suggestions with confidence and rationale
Steward
  → confirms or rejects candidate cluster (human decision)
```

Raw media never enters public API responses or contract state. Only a redacted
media hash may be referenced publicly. See [06 — Privacy model](./06-privacy-model.md).

### 2. Work order and DAO authorization

```text
Steward
  → proposes scope hash, maximum budget, policy hash and rosters
  → creates work order in DRAFT
DAO
  → approves a Sputnik proposal whose FunctionCall invokes hub.dao_authorize(...)
  → hub checks predecessor_account_id == config.dao
  → work order becomes POLICY_APPROVED with the approved roster snapshot
```

MEND does not read proposal text and trust it. The DAO must push the authorization
to the hub. See [08 — Oracle and human trust](./08-oracle-and-human-trust.md#sputnik-dao-authorization).

### 3. Sponsorship

```text
Sponsor (or cross-chain sponsor)
  → 1Click quote (dry first; mainnet only)
  → deposit instructions; status reconciliation by depositAddress
  → USDC arrives in the sponsor/hub NEAR account
  → sponsor calls token.ft_transfer_call(msg = work_order_id) on the hub
  → hub verifies token, sponsor, exact remaining budget
  → underfund = full refund; overfund = excess refund; duplicate = full refund
  → state FUNDED only when fully funded
```

A dry quote is never a payment. Explorer links are built by MEND because live
1Click status responses returned empty `explorerUrl` strings on 2026-11-09. See
[16 — Integration evidence](./16-integration-evidence.md#near-intents--1click).

### 4. Sealed bidding and deterministic scoring

```text
Contractor A/B/C (separate sub-accounts, scoped keys)
  → commit sha256(canonical bid + nonce) inside the commit window
  → reveal price, duration, warranty, materials score, checklist acceptance, nonce
  → hub verifies the commitment hash and roster
  → hub.request_score builds byte-stable canonical input
  → OutLayer request_execution(wasm hash, input) → private promise callback
  → callback reads promise_result(0), verifies winner eligibility and max score
  → hub stores ScoreExecution: policy/wasm/input/output hashes
Steward
  → awards only the recorded rank-1 eligible bid
```

No LLM chooses the winner. The human-readable policy is [`RULES.md`](./RULES.md);
the executable policy is the hash-pinned `compute/bid-rules` WASM. TEE attestation
is fetched and verified off-chain and is shown separately from the on-chain hash
binding. See [08](./08-oracle-and-human-trust.md#outlayer-and-the-deterministic-scorer).

### 5. Completion, payment and durability

```text
Contractor
  → submits redacted evidence hashes + checklist
Reviewer AI (Agent Market or internal)
  → lists missing checklist items only
Human inspector (≠ contractor)
  → accepts completion, signs the decision
Hub
  → pays exactly 90% once
  → holds exactly 10% until durability
Later durability inspection
  → pass: release 10% once, CLOSED
  → fail: WARRANTY_REOPENED with the same work-order ID, no new funds
```

Exact amounts: [05 — Payment accounting](./05-payment-accounting.md).

### 6. Read model and public case

```text
Hub events → services/indexer → Postgres read model → apps/api → apps/web
```

The indexer may lag. The UI must show an explicit pending/indexing state and must
never present an unconfirmed action as final. Rebuilding the read model from an
empty database must reproduce the same public state.

## Source of truth rules

1. **The MEND hub contract** is authoritative for financial and work-order state.
2. **Postgres** is a read model and private-data index, never the financial source
   of truth.
3. **AI output is a proposal**, never authority to move money.
4. **OutLayer** evaluates deterministic bid rules; the contract never trusts an
   LLM ranking.
5. **Human inspectors** sign physical-completion and durability decisions.
6. **DAO approvals** authorize policy and budgets, not every operational action.
7. **On-chain hashes** reference redacted evidence; raw evidence stays encrypted
   off-chain.
8. **Replay data** is visibly distinguishable from live RPC and transaction data.

## Storage and trust boundaries

| Store | Contains | Public? | Authority |
|---|---|---|---|
| Hub contract state | Assets, work orders, roles, commitments, reveals after reveal, score hashes, escrow ledger, payment records, warranty state, passport token | Public chain data | Financial and lifecycle source of truth |
| Postgres | Read model, private case metadata, precise location references, audit index, job state | Private service | Read model only; rebuildable |
| Object storage | Raw and redacted evidence media, encrypted at rest, signed access | Private | Evidence store; retention policy applies |
| Browser | Redacted preview, case link, no server secrets | User device | Untrusted input |
| AI provider | The exact prompt/response sent for triage | Provider-controlled | Proposal source; attestation evidence stored separately |
| OutLayer | WASM input/output and TEE attestation | On-chain request/callback + off-chain attestation | Deterministic score evidence |
| 1Click / Intents | Mainnet quotes, deposit address, status | Mainnet public objects | Sponsorship rail; not MEND escrow |
| Agent Market | Redacted job brief, completeness output | Marketplace account | External review; no MEND payment authority |

## Key and secret boundaries

- Provider API keys, database URLs, object-storage credentials, worker tokens and
  relayer keys are **server-only**. They must never appear in the browser bundle.
- Agent accounts use separate sub-accounts and function-call keys restricted by
  receiver, method list and allowance. Empty method lists and unlimited
  allowances are rejected at provisioning.
- Contractor keys cannot release escrow. Inspector keys cannot alter bids or
  recipients. Coordinator keys cannot award or accept.
- The relayer cannot call arbitrary contracts; NEP-366 messages are checked
  against a receiver/method allowlist and a replay cache.
- There is no plaintext full-access agent key. The relayer's outer `Delegate`
  transaction still requires a hot-wallet key; that is an operational risk, not a
  secret that can be eliminated by design. See
  [07 — Threat model](./07-threat-model.md#keys-and-relayer).

## External integrations

| Integration | Role in MEND | Evidence label | Details |
|---|---|---|---|
| NEAR AI Cloud | Private triage, scope drafts, explanations | **VERIFIED** endpoints/models; authenticated inference **BLOCKED_ON_HUMAN** | [16](./16-integration-evidence.md#near-ai-cloud) |
| OutLayer | Deterministic bid scoring and TEE attestation | **VERIFIED** testnet contract/read-only; execution **BLOCKED_ON_HUMAN** | [16](./16-integration-evidence.md#outlayer) |
| NEAR Intents / 1Click | Cross-chain sponsorship | **VERIFIED** read-only mainnet API; live deposit **BLOCKED_ON_HUMAN**; testnet **UNAVAILABLE** | [16](./16-integration-evidence.md#near-intents--1click) |
| Sputnik DAO v2 | Budget/policy authorization | **VERIFIED** contracts and push path; deployment **BLOCKED_ON_HUMAN** | [16](./16-integration-evidence.md#sputnik-dao-v2) |
| NEAR Agent Market | External evidence-completeness review | **VERIFIED** public reads; worker job **BLOCKED_ON_HUMAN**; accept endpoint **UNAVAILABLE** | [16](./16-integration-evidence.md#near-agent-market) |
| NEAR platform | Passport, escrow, keys, meta-transactions | **VERIFIED** from pinned source/docs; runtime proof **BLOCKED_ON_HUMAN** for deployment | [16](./16-integration-evidence.md#near-platform) |

## Deployment topology

```text
Local:   web + api + worker + Postgres + object storage via infra/docker-compose.yml
         chain: NEAR sandbox or testnet (mode labelled); REPLAY needs no credentials
Hosted:  separate web/api/workers, managed Postgres, private object storage
         environment separation: replay | testnet | mainnet
Mainnet: separate account, token, hub and UI configuration; never the default;
         every transaction requires explicit human approval
```

The local stack, hosted deployment and testnet accounts do not exist on this
branch. Exact commands and human gates are in
[10 — Deployment guide](./10-deployment-guide.md).

## Observability

- Structured logs with no secrets, raw evidence or precise location.
- Transaction reconciliation alerts: intent hash vs chain result vs read model.
- Health checks for API, indexer lag, object storage and external providers.
- Explicit `UNAVAILABLE` health state for external dependencies; no silent mock
  fallback that looks live.
- Every state change emits one hub event; the indexer records the transaction hash.

## Current implementation state

Only these are present on this branch:

- `packages/protocol` — frozen protocol and 26 passing tests.
- `docs/` — this documentation package.
- `scripts/demo/` — docs sanity check and REPLAY capture harness.
- `fixtures/demo/` — evidence and submission templates with no invented data.

Everything else is `PENDING INTEGRATION`. See
[11 — Limitations](./11-limitations.md) and
[16 — Integration evidence matrix](./16-integration-evidence.md).

---

[Docs index](./README.md) · [← User roles](./02-user-roles.md) · [Next: state machine →](./04-state-machine.md)

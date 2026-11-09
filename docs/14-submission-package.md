# 14 — Submission package (draft)

This is a draft package for human review. It does not submit anything. The
orchestrator and a human must verify every field, link and claim before posting.

**Identity, wallet, repository URL, hosted demo URL, track name, event tags,
transaction links and final confirmation are HUMAN SUPPLIED — DO NOT INVENT.**

## Human-supplied fields

| Field | Value | Rule |
|---|---|---|
| Project/team identity | **HUMAN SUPPLIED — DO NOT INVENT** | Do not guess a person, company or handle |
| Wallet / payout address | **HUMAN SUPPLIED — DO NOT INVENT** | No address in this repo |
| Public repository URL | **HUMAN SUPPLIED — DO NOT INVENT** | Only after human approval to publish |
| Hosted demo URL | **HUMAN SUPPLIED — DO NOT INVENT** | Only after deployment works |
| Demo video URL | **HUMAN SUPPLIED — DO NOT INVENT** | Only after the real recording |
| Track name | **HUMAN SUPPLIED — DO NOT INVENT** | Copy from the current event rules |
| Required event tags | **HUMAN SUPPLIED — DO NOT INVENT** | Copy from the current event rules |
| Testnet transaction links | **HUMAN SUPPLIED — DO NOT INVENT** | Only real, inspected links |
| Mainnet transaction link | **HUMAN SUPPLIED — DO NOT INVENT** | Only after explicit per-transaction approval |
| Submission confirmation | **HUMAN SUPPLIED — DO NOT INVENT** | A human presses submit |

## Repository description

### Short (recommended for a repository “About” field)

> MEND — Maintenance with memory. Community asset repair on NEAR with sealed bids,
> deterministic scoring, human inspection and a durability holdback that reopens the
> same work order when a repair fails.

### Long

> MEND is a community asset repair protocol on NEAR. A broken bench, bicycle rack,
> fence or community-centre door moves through one permanent lifecycle: walletless
> report, private triage, steward scope, Sputnik DAO authorization, cross-chain
> sponsorship, sealed contractor bids, deterministic hash-pinned scoring, physical
> repair, independent human inspection, 90% completion payment and a 10% durability
> holdback. If durability fails, MEND reopens the original work order and warranty
> history instead of creating a new bounty. Raw media and precise locations stay
> off-chain; only redacted hashes and public state go on-chain. AI suggests but never
> approves, awards or pays. The repository is in active integration: the protocol and
> 100/80/72/8 accounting are tested locally; live testnet, hosted demo, video and
> physical repair evidence remain blocked on human-supplied credentials, funds,
> consent and approvals.

## NEAR integration explanation

MEND uses NEAR where on-chain enforcement matters, and labels every integration
honestly.

| NEAR capability | How MEND uses it | Evidence label |
|---|---|---|
| **Hub contract** (`contracts/hub`) | Assets, work orders, role registry, DAO authorization, sealed bids, score hash binding, escrow, 90/10 payment, durability, warranty, disputes, pause | Design frozen; contract `PENDING INTEGRATION` |
| **Non-transferable passport** | NEP-171 token owned by the hub; every transfer/approval/burn path fails; history is public; no legal title | Source-verified; runtime `BLOCKED_ON_HUMAN` |
| **NEP-141 escrow** | `ft_transfer_call` into the hub; exact token/sponsor/amount; underfund refund, overfund excess refund, duplicate refund | Source-verified; testnet `BLOCKED_ON_HUMAN` |
| **Sputnik DAO v2** | Approved `FunctionCall` proposal pushes `dao_authorize`; hub trusts only `config.dao` as predecessor | Live contracts/read path **VERIFIED**; DAO deployment `BLOCKED_ON_HUMAN` |
| **OutLayer** | Hash-pinned `wasm32-wasip1` deterministic scorer; private promise callback; TEE attestation verified off-chain | Testnet read-only **VERIFIED**; funded execution `BLOCKED_ON_HUMAN` |
| **NEAR AI Cloud** | Server-only private triage; schema-validated suggestions; signature/attestation evidence shown separately | Public endpoints **VERIFIED**; authenticated inference `BLOCKED_ON_HUMAN` |
| **NEAR Intents / 1Click** | Cross-chain sponsorship quotes and status; dry preview by default; mainnet only | Read-only mainnet API **VERIFIED**; live deposit `BLOCKED_ON_HUMAN` |
| **NEAR Agent Market** | External evidence-completeness review; no worker accept endpoint; human acceptance | Public reads **VERIFIED**; live job `BLOCKED_ON_HUMAN` |
| **Function-call keys / NEP-366** | Separate agent sub-accounts, scoped keys, allowlisted relayer; zero-deposit gasless actions where valid | Source-verified; deployment `BLOCKED_ON_HUMAN` |

MEND does **not** claim a complete NEAR AI end-to-end attestation chain, a live
OutLayer score, a live Intents deposit or a live Agent Market job. Those are
`BLOCKED_ON_HUMAN` and are labelled as such in the product and demo.

## Track justification

**Track name: HUMAN SUPPLIED — DO NOT INVENT.** Copy the exact current track name
from the event rules; do not infer it from this document.

The justification below is written to fit a **consumer / community infrastructure
or public-goods** framing. A human must confirm it matches the actual track before
submission.

> MEND is not another marketplace listing. It closes the loop after a repair:
> who approved the scope, who paid, who won, who inspected, what was paid, what was
> held back, and what happened when the repair failed. The durability holdback and
> the same-work-order warranty reopening are the core differentiators. NEAR is used
> for the parts that need public verifiability — escrow, roles, sealed bids, score
> binding and a non-transferable asset passport — while private evidence and precise
> locations stay off-chain. The project is built for a low-risk community pilot,
> with explicit human inspection and no claim of municipal adoption.

## Demo post draft

**Required event tags: HUMAN SUPPLIED — DO NOT INVENT.** The `#NEAR` and `#MEND`
tags below are product/ecosystem descriptors, not a claim about event-required
tags.

```text
One broken bench. One permanent repair history.

MEND: walletless report → DAO budget → sealed bids → deterministic scoring → human inspection → 72 paid / 8 held. A failed durability check reopens the SAME work order.

Demo: [DEMO LINK]
#NEAR #MEND [EVENT TAGS]
```

This draft is 261 characters with the placeholders. Replace `[DEMO LINK]` and
`[EVENT TAGS]` with real values and re-count before posting; X allows 280
characters.

Rules for the post:

- Do not say “AI approved”, “structurally safe”, “guaranteed”, “audited” or “production-ready”.
- Do not claim a city, partner or sponsor endorsement.
- Label replay and dry quotes in the post or the linked video.
- Insert only real links.
- A human publishes it; no agent posts.

## Submission description (20–2,000 characters)

The exact text is in
[`fixtures/demo/submission-description.txt`](../fixtures/demo/submission-description.txt).
`node scripts/demo/check-docs.mjs` verifies the 20–2,000 character bound.

Character count and exact text are reported by the checker. Do not add claims that
are not in this document.

## Baseline and library disclosures

| Item | Disclosure |
|---|---|
| Baseline | MEND was bootstrapped as a new monorepo at commit `c21b694` (“bootstrap monorepo, freeze MEND protocol v1 and canonical fixtures”). No pre-existing MEND product codebase was imported. |
| Protocol | Written for MEND; schemas, state machine, accounting, hashing, scoring and canonical fixtures live in `packages/protocol`. |
| Research | External behaviour was validated in `orchestration/research/R0-A..R0-E` on 2026-11-09; claims carry live/source/unverified labels. |
| Web framework (planned) | Next.js 16 per ADR-001; verify the pinned version and license in the integrated package. |
| API framework (planned) | Fastify 5 per ADR-001; verify the pinned version and license. |
| Language/runtime | TypeScript strict, Node `>=22` declared (Node 26 used in this environment). NEAR AI verifier SDK requires `>=24.22.1`. |
| Tests | Vitest 5; protocol tests pass locally. Other suites are pending integration. |
| NEAR SDK (planned) | `near-sdk` 5.30.x per the hub interface; verify version and license in the lockfile. |
| NEAR AI SDK | `@nearai/inference-sdk@0.3.0` is MIT per R0-A; server-only. Not installed in this worktree. |
| OutLayer verify | `outlayer-verify` is Apache-2.0 per R0-B; not installed or run here. |
| 1Click SDK | `@defuse-protocol/one-click-sdk-typescript` 0.1.26 was used for signature verification research; verify license and pin before shipping. |
| Agent Market | External production service; no vendor code copied. |
| Fonts/images/music | Must be original, licensed or public domain. No stock repair footage may be presented as MEND. Disclose licenses in the final package. |
| AI-generated assets | No AI-generated repair media may be presented as real. Diagrams may be generated but must be labelled `ILLUSTRATION`. |

## License

Project license: **MIT**. The repository `LICENSE` file is held by the integration
branch (it was staged after this docs worktree was cut); the orchestrator must
include it in the public repository. Third-party dependencies keep their own
licenses; the disclosure table above must be reconciled with the final lockfile.

## What this package does not claim

- no live testnet lifecycle yet;
- no mainnet execution;
- no hosted demo;
- no demo video;
- no physical repair or durability inspection;
- no real users, city adoption or partnership;
- no security audit or accessibility certification;
- no complete NEAR AI attestation chain;
- no live OutLayer TEE attestation;
- no live Agent Market job.

## Final human review checklist

- [ ] Identity, wallet, repository URL and demo URL filled by a human.
- [ ] Track name and required tags copied from the current rules.
- [ ] Description character count is 20–2,000.
- [ ] Every transaction link is real and inspected.
- [ ] Every media file has consent and a real/staged label.
- [ ] No forbidden trust language.
- [ ] License present in the public repository.
- [ ] Baseline/library disclosures match the final lockfile.
- [ ] Demo video matches the script and the evidence package.
- [ ] A human explicitly approves submission.

## Related documents

- [13 — Demo script](./13-demo-script.md)
- [12 — Evidence package](./12-real-world-evidence-package.md)
- [11 — Limitations](./11-limitations.md)
- [16 — Integration evidence](./16-integration-evidence.md)
- [17 — Copy and accessibility](./17-copy-and-accessibility.md)

---

[Docs index](./README.md) · [← Demo script](./13-demo-script.md) · [Next: capture plan →](./15-demo-capture-plan.md)

# 14 — Submission package (draft)

This is a draft package for human review. It does not submit anything. The
orchestrator and a human must verify every field, link and claim before posting.

**Identity, wallet, public repository URL, public video URL, exact track names,
additional event tags and final confirmation are HUMAN SUPPLIED — DO NOT INVENT.**

The live demo URL, API URL and testnet transaction links below are real and
verified; they are not placeholders. No mainnet protocol transaction exists.

## The story in one breath

A pothole sits at the end of a street for months. Everyone swerves; nobody owns
it. Sam photographs it and writes one sentence. No wallet. The browser strips
GPS and EXIF before upload. Private AI suggests a duplicate and a scope, but a
human steward confirms both. The community's Sputnik DAO approves the budget
2-of-3. Contractors submit sealed bids; a hash-pinned deterministic policy picks
the best total value, not the lowest sticker price. A different human inspects
the repair. **72 is paid, 8 is held** for durability. The non-transferable
passport keeps the whole history. If the repair fails, the same work order
reopens — no new bounty, no new money.

The film tells this with a pothole in `REPLAY / SIMULATION`. The real money proof
is the separate V2 testnet lifecycle described below.

## Human-supplied fields

| Field | Value | Rule |
|---|---|---|
| Project/team identity | **HUMAN SUPPLIED — DO NOT INVENT** | Do not guess a person, company or handle |
| Wallet / payout address | **HUMAN SUPPLIED — DO NOT INVENT** | No address in this repo |
| Public repository URL | **HUMAN SUPPLIED — DO NOT INVENT** | The current repo is private; publish only with human approval |
| Live demo URL | https://mend-demo.vercel.app | **Verified live** on 2026-11-14; API-backed, no demo runner |
| API base | https://mend-api-phi.vercel.app | **Verified live**; see `/health` |
| Public video URL | **HUMAN SUPPLIED — DO NOT INVENT** | The local master exists; no public upload URL yet |
| Track name | Recommendation below | Exact event name is **HUMAN SUPPLIED — DO NOT INVENT** |
| Required event tags | `@NEARProtocol` `#NEARHackathon` plus any event-specific tags | Confirm against the current rules before posting |
| Testnet transaction links | See “Live proof” below | Real and inspected; do not replace with placeholders |
| Mainnet transaction link | **NONE — DO NOT INVENT** | No mainnet protocol action has executed |
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
> sponsorship (pending), sealed contractor bids, deterministic hash-pinned scoring,
> physical repair, independent human inspection, 90% completion payment and a 10%
> durability holdback. If durability fails, MEND reopens the original work order and
> warranty history instead of creating a new bounty. Raw media and precise locations
> stay off-chain; the browser strips EXIF/GPS before upload and only redacted hashes
> and public state go on-chain. AI suggests but never approves, awards or pays. A full
> API-backed live app runs at https://mend-demo.vercel.app with Vercel Functions and
> Neon Postgres. A real NEAR testnet repair lifecycle completed on
> `mend-hub-v2.testnet` with a real Sputnik DAO, 42 transactions and exact 100/20/72/8
> accounting (`WO-BENCH-V2-001-0002`, final `CLOSED`); an earlier 57-transaction run
> remains historical. Live NEAR AI inference/signature, OutLayer execution, a NEP-366
> relayer transaction and a disclosed Agent Market self-hire have evidence with
> labelled caveats. The Intents deposit/settlement and real physical repair evidence
> remain incomplete or human-gated. The authoritative matrix is `STATUS.md`.

## Why the AI is private

A pothole photo can reveal a home, a school route, a daily timetable or a licence
plate. MEND removes those signals before anything leaves the browser:

- EXIF/XMP/GPS is stripped in the browser; manual redaction is burned into the
  pixels before upload.
- The AI gets the cleaned report and redacted media only — not the reporter's
  identity, case link, precise location or raw EXIF.
- AI output is a duplicate suggestion, category, confidence and scope draft. It
  cannot sign, pay, award, change a recipient or accept an inspection.
- A steward confirms the merge and scope. The DAO authorizes the budget. A
  rostered human inspector accepts completion.

The response is labelled, not oversold:

> **`SIGNED RESPONSE · TEE PROOF UNAVAILABLE (LABELLED)`**
>
> The live NEAR AI run returned a `provider_tee` ECDSA signature over the exact
> request and response bytes. The request hash, response hash, signed text and
> signature checks pass. No matching TEE attestation report was retained
> (`signerMatchesReport: false`), so the artifact stays `verified: false`, the API
> label is `UNVERIFIED_INFERENCE`, and the UI shows **Unavailable evidence**. MEND
> does not claim a fully verified TEE or a complete Intel DCAP/ITA chain. See
> [`scripts/near-ai-live/LIVE-NEAR-AI.md`](../scripts/near-ai-live/LIVE-NEAR-AI.md).

Full detail: [README — Why the AI is private](../README.md#why-the-ai-is-private).

## One complete moment

Report → private triage → steward scope → DAO authorization → **100 funded**,
**20 refunded** at award → sealed bids (B **9270**, C **5200**, A **2873**) →
independent inspector → **72 paid / 8 held** → later durability pass releases
**8** → escrow **0** → passport `CLOSED`.

If durability fails, the same work order becomes `WARRANTY_REOPENED` with no new
funds. That failed branch is proven in contract and replay tests; the live V2 run
exercised the passing branch.

Full table: [README — One complete moment](../README.md#one-complete-moment).

## NEAR integration explanation

MEND uses NEAR where on-chain enforcement matters, and labels every integration
honestly. The “In the V2 repair?” column prevents the stack from overclaiming
what the 42 transactions actually did.

| NEAR capability | How MEND uses it | Evidence label | In the V2 repair? |
|---|---|---|---|
| **Hub contract** (`contracts/hub`) | Assets, work orders, role registry, DAO authorization, sealed bids, score hash binding, escrow, 90/10 payment, durability, warranty, disputes, pause | Implemented; 30 tests + WASM build | Yes |
| **Non-transferable passport** | NEP-171 token owned by the hub; every transfer/approval/burn path fails; history is public; no legal title | Testnet-proven: `BENCH-V2-001` minted, hub-owned, `nft_transfer` rejected | Yes |
| **NEP-141 escrow** | `ft_transfer_call` into the hub; exact token/sponsor/amount; underfund refund, overfund excess refund, duplicate refund | Testnet-proven: exact 100/20/72/8, escrow 0 | Yes |
| **Sputnik DAO v2** | Approved `FunctionCall` proposal pushes `dao_authorize`; hub trusts only `config.dao` as predecessor | Live testnet DAO + proposal execution **VERIFIED**; testnet-only | Yes — `mend-dao.sputnikv2.testnet`, proposal 1, 2/3 |
| **OutLayer** | Hash-pinned `wasm32-wasip1` deterministic scorer; private promise callback; TEE attestation captured | Live testnet publish/execute **VERIFIED**; full Intel DCAP/ITA chain not verified | No — separate request `15579`; V2 score was `LOCAL_DETERMINISTIC` |
| **NEAR AI Cloud** | Server-only private triage; schema-validated suggestions; signature/attestation evidence shown separately | Live inference + `provider_tee` signature **VERIFIED**; full TEE report/DCAP/ITA `UNAVAILABLE` | No — separate live triage on `R-001` |
| **NEAR Intents / 1Click** | Cross-chain sponsorship quotes and status; dry preview by default; mainnet only | Signed non-dry quote **VERIFIED**; live deposit/settlement `BLOCKED_ON_HUMAN` | No — `PENDING_DEPOSIT`, no funds moved |
| **NEAR Agent Market** | External evidence-completeness review; no worker accept endpoint; human acceptance | Live listing + paid self-hire **VERIFIED**; seller payout `NOT_COLLECTED`; disclosed self-hire | No — separate listing and `$0.01` hire |
| **Function-call keys / NEP-366** | Separate agent sub-accounts, scoped keys, allowlisted relayer; zero-deposit gasless actions where valid | Scoped keys + live NEP-366 relayer transaction **VERIFIED**; gasless escrow funding still unavailable | No — separate unfunded `DRAFT` proof |

MEND does **not** claim a complete NEAR AI end-to-end attestation chain, a full
Intel DCAP/ITA verification, a live Intents deposit/settlement, independent
Agent Market reputation, or gasless escrow funding. These limits are labelled in
the product, the evidence files and [`STATUS.md`](../STATUS.md).

Full detail: [README — What NEAR is doing](../README.md#what-near-is-doing).

## Live proof

| What | Link | State |
|---|---|---|
| Live app | https://mend-demo.vercel.app | Full API-backed `LIVE_TESTNET`, no auth, no demo runner |
| Canonical case | https://mend-demo.vercel.app/cases/WO-BENCH-V2-001-0002 | Real V2 case, final `CLOSED` |
| API health | https://mend-api-phi.vercel.app/health | `LIVE_TESTNET`, Postgres reachable, chain adapter live |
| Hub contract | https://explorer.testnet.near.org/accounts/mend-hub-v2.testnet | Real testnet contract |
| Sputnik DAO | https://explorer.testnet.near.org/accounts/mend-dao.sputnikv2.testnet | Real testnet DAO, 3-member council |
| All 42 transactions | [`infra/testnet-v2/LIVE-V2.md`](../infra/testnet-v2/LIVE-V2.md) | 42/42 resolve with success |
| Machine-readable state | [`infra/testnet-v2/live-state.json`](../infra/testnet-v2/live-state.json) | Balances, bids, statuses |

Key receipts: DAO authorization
[`8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h`](https://explorer.testnet.near.org/transactions/8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h),
funding
[`3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2`](https://explorer.testnet.near.org/transactions/3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2),
completion acceptance
[`EQ8HoNvDazagbM5zdUq38EK7cyhgi8hqPXJkDhzdxN2o`](https://explorer.testnet.near.org/transactions/EQ8HoNvDazagbM5zdUq38EK7cyhgi8hqPXJkDhzdxN2o),
and durability release
[`CmmAPvfonQa7Y9CEXpcnWQhbUVcRK3nWXAADH84kJS4g`](https://explorer.testnet.near.org/transactions/CmmAPvfonQa7Y9CEXpcnWQhbUVcRK3nWXAADH84kJS4g).

The 42 transactions include setup, roles, DAO creation, the successful V2
lifecycle, the cancel/refund cleanup of the aborted pre-award work order
`WO-BENCH-V2-001-0001`, and an orphan-balance sweep. They do **not** include the
failed first DAO factory attempt; that attempt is recorded separately in
`LIVE-V2.md` and is not counted as a successful lifecycle transaction.

## Current film

The current cut is a **recorded 3:33.57 narrated 1080p v4 product pitch** at
`demo/ad/out/mend-ad-v4-master.mp4`: 1920×1080/30fps, H.264/AAC, 48 kHz stereo,
**61 MB**, SHA-256
`080e87b6d93d4a7756e48df8c024cffc51b6253e3601d197c3ba3f2d549bcd7b`.
It is a full-bleed live app with paper-cut cast dioramas and per-beat tech-stack
callouts, a new **Liam** narration, 0.45-second music-only section handoffs, a
plain-English private-AI explainer, and a QR to
https://mend-demo.vercel.app. Loudness is **−13.9 LUFS** with **−1.4 dBTP** true
peak; there is no silence gap longer than 1.2 seconds.

Honest labels: the pothole story is `REPLAY / SIMULATION`; repair B-roll is
illustrative Pexels stock, not a real MEND repair; the AI response is signed but
its matching TEE proof is unavailable and labelled; the human watch/listen-through
is pending. The v3 master is retained as a fallback. Replace this number only
when the parent publishes a new master and hash.

## Track recommendation

Multiple tracks are allowed. Recommended, with one sentence each:

| Track | Why MEND fits |
|---|---|
| `social` | A walletless report and private evidence let neighbours fix shared assets without publishing a home, school route or plate, while the repair history stays public. |
| `realworld` | The 42-transaction V2 testnet run is an actual escrow-and-inspection lifecycle — DAO vote, sealed bids, escrow, independent inspection and a durability holdback — not a mock of one. |
| `security` | Privacy is enforced before upload, money moves only through a Rust escrow under human and DAO authority, and every AI or OutLayer claim is labelled instead of rounded up. |
| `agents` (optional) | NEAR AI drafts and checks, NEP-366 lets a scoped relayer act, and Agent Market adds an outside reviewer — each bounded, receipted and never the approver. |

**Track name to enter: HUMAN SUPPLIED — DO NOT INVENT.** Copy the exact current
name from the event form; do not infer it from this table.

## Demo post draft

**Publish by a human only.** The required core tags are `@NEARProtocol` and
`#NEARHackathon`; add any event-specific tags from the current rules.

```text
One pothole. One permanent repair history.

MEND: walletless report → private triage → DAO budget → sealed bids → human inspection → 72 paid / 8 held. A failed durability check reopens the SAME work order.

Live demo: https://mend-demo.vercel.app
@NEARProtocol #NEARHackathon
```

Re-count before posting; X allows 280 characters. This draft is 275 characters
including the real URL and tags.

Rules for the post:

- Do not say “AI approved”, “structurally safe”, “guaranteed”, “audited” or “production-ready”.
- Do not claim a city, partner or sponsor endorsement.
- Label replay and dry quotes in the post or the linked video.
- Insert only real links.
- A human publishes it; no agent posts.

## Submission description (20–2,000 characters)

The exact text is in
[`fixtures/demo/submission-description.txt`](../fixtures/demo/submission-description.txt),
now updated to the live app, the 42-transaction V2 lifecycle and the labelled
TEE limit. `node scripts/demo/check-docs.mjs` verifies the 20–2,000 character
bound. Do not add claims that are not in this document.

## Baseline and library disclosures

| Item | Disclosure |
|---|---|
| Baseline | MEND was bootstrapped as a new monorepo at commit `c21b694` (“bootstrap monorepo, freeze MEND protocol v1 and canonical fixtures”). No pre-existing MEND product codebase was imported. |
| Protocol | Written for MEND; schemas, state machine, accounting, hashing, scoring and canonical fixtures live in `packages/protocol`. |
| Research | External behaviour was validated in `orchestration/research/R0-A..R0-E` on 2026-11-09; claims carry live/source/unverified labels. |
| Web framework | Next.js `16.4.5` in `apps/web` per ADR-001; verify the license in the lockfile. |
| API framework | Fastify `^5.12.8` in `apps/api` per ADR-001; verify the license in the lockfile. |
| Language/runtime | TypeScript strict, Node `>=22` declared (Node 26 used in this environment). NEAR AI verifier SDK requires `>=24.22.1`. |
| Tests | Vitest + Cargo suites pass locally across protocol, contracts, clients, API, DB, indexer, agents, quality and live-testnet checks; exact totals are in `orchestration/reports/G4-evidence.md`. |
| NEAR SDK | `near-sdk` per the workspace pin; used by `contracts/hub` and `contracts/test-token`; verify version and license in the lockfile. |
| NEAR AI SDK | `@nearai/inference-sdk@0.3.0` is MIT per R0-A; server-only. Live authenticated inference and signature fetch passed with a key; full TEE attestation remains unavailable. |
| OutLayer verify | `outlayer-verify` is Apache-2.0 per R0-B; not installed or run here. |
| 1Click SDK | `@defuse-protocol/one-click-sdk-typescript` 0.1.26 was used for signature verification research; verify license and pin before shipping. |
| Agent Market | External production service; no vendor code copied. The live paid job was a disclosed self-hire. |
| Fonts/images/music | Must be original, licensed or public domain. The v3 film uses Pexels repair B-roll as clearly labelled illustration, not as a real MEND repair. Music is “Mountains” by Andrew Ev under the Mixkit Free License; see `demo/ad/CREDITS.md`. |
| AI-generated assets | No AI-generated repair media may be presented as real. Diagrams may be generated but must be labelled `ILLUSTRATION`. |

## License

Project license: **MIT**. The repository `LICENSE` file is present at the repo
root. Third-party dependencies keep their own licenses; the disclosure table
above must be reconciled with the final lockfile.

## Submission checklist

Nothing here has been submitted or published. A human must complete and verify
each item.

- [ ] **Public repository:** make the GitHub repository public, with the MIT
      license, README, CI status and no secrets in history.
- [ ] **Public X post:** publish from the human account, tagging
      `@NEARProtocol` and `#NEARHackathon`, linking the live demo and the final
      film.
- [ ] **Form fields:** team identity, track name(s), public repository URL, live
      demo URL, video URL, 20–2,000 character description, and wallet/payout if
      the form requires one. Do not invent any field.
- [ ] **Live demo stays up:** keep https://mend-demo.vercel.app, the API and Neon
      Postgres available through judging. The canonical case is `CLOSED`, so
      award/accept are disabled by design.
- [ ] **Re-verify proof:** open the canonical case, the API `/health`, the 42
      transactions and the video hash on submission day.
- [ ] **Human watch/listen:** a person reviews the final cut for claims, captions,
      audio and the labelled stock footage.
- [ ] **Claims review:** confirm the TEE caveat, the pending 1Click quote, the
      illustrative repair footage and the test-value label are all still visible.
- [ ] **Docs check:** run `node scripts/demo/check-docs.mjs` and
      `git diff --check`; both must pass.
- [ ] **Submit:** a human presses submit and records the confirmation.
- [ ] **After submitting:** keep the demo live through judging and answer judge
      questions from the evidence files, not from memory.

## What this package does not claim

- **No fully verified AI TEE.** The signature over the exact bytes is valid; the
  matching TEE report and Intel DCAP/ITA chain are unavailable and labelled.
- **No mainnet protocol execution.** The live protocol is NEAR testnet only;
  test mUSDC has no value.
- **No live Intents funding.** The signed 1Click quote is `PENDING_DEPOSIT`; no
  deposit, swap or settlement moved funds.
- **No OutLayer score on the V2 repair.** The V2 score is `LOCAL_DETERMINISTIC`;
  OutLayer executed a separate testnet request with a captured attestation.
- **No real repair.** The film's pothole and repair footage are illustrative
  stock, clearly labelled; no MEND repair or physical durability inspection has
  been performed.
- **No independent Agent Market reputation.** The live paid job was a disclosed
  self-hire, and the seller payout ledger row was not collected.
- **No gasless escrow funding.** A function-call key cannot attach the 1
  yoctoNEAR deposit; the NEP-366 proof creates an unfunded `DRAFT`.
- **No city adoption, partnership, security audit or accessibility
  certification.** None exists.

## Related documents

- [13 — Demo script](./13-demo-script.md)
- [12 — Evidence package](./12-real-world-evidence-package.md)
- [11 — Limitations](./11-limitations.md)
- [16 — Integration evidence](./16-integration-evidence.md)
- [17 — Copy and accessibility](./17-copy-and-accessibility.md)
- [README — plain-English stack](../README.md#the-stack-in-plain-english)

---

[Docs index](./README.md) · [← Demo script](./13-demo-script.md) · [Next: capture plan →](./15-demo-capture-plan.md)

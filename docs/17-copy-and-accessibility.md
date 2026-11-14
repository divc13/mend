# 17 — Copy and accessibility

MEND's trust depends on saying exactly what happened. This page defines the
allowed labels, forbidden claims and accessibility commitments.

## Mode labels

Use these exact strings, visible on every relevant screen and in every capture:

| Mode | Label | Use |
|---|---|---|
| Replay | `REPLAY / SIMULATION` | Recorded fixtures; no live chain state |
| Testnet | `LIVE TESTNET — TEST VALUE ONLY` | Real testnet transactions with test tokens |
| Mainnet | `MAINNET — REAL FUNDS` | Real assets and real money; explicit approval required |

A dry quote additionally carries `DRY QUOTE — NOT A PAYMENT`. A staged repair
carries `STAGED RECONSTRUCTION — NOT A REAL MEND JOB`.

## Trust vocabulary

| Concept | Allowed copy | Do not imply |
|---|---|---|
| AI triage | “AI suggestion — needs human review” | That AI made an approval, decision or payment |
| AI evidence | “Inference evidence verified for these bytes” | A complete model→client chain |
| Missing AI evidence | “Inference evidence unavailable” | That the suggestion is invalid or verified |
| OutLayer score | “Deterministic policy ranking” / “Score bound” | That the best contractor was chosen subjectively |
| TEE | “TEE attestation verified for this execution” | That the code is correct or audited |
| Missing TEE | “TEE attestation unavailable” | A green check |
| DAO | “DAO authorized” | “The DAO supports MEND” or a partnership |
| Inspection | “Human inspector accepted” | A safety certification or engineering sign-off |
| Durability | “Holdback released after a passing inspection” | A guarantee of future condition |
| Warranty | “Same work order reopened” | A new bounty or new funds |
| Passport | “Non-transferable maintenance record” | Legal ownership or a tradable asset |
| Payment | “72 paid / 8 held” | A quote or intent is a payment |
| Sponsorship | “Dry quote — not a payment” | Live funding without a transaction |

## Forbidden claims

These phrases are banned in product copy, README, docs, demo narration, captions
and posts unless quoted as examples of what not to say:

| Forbidden phrase | Say instead |
|---|---|
| `AI approved` | “AI suggested; a human inspector decided” |
| `AI verified the repair` | “Inference evidence verified for these bytes” |
| `structurally safe` | “Human inspector recorded completion; not a structural certification” |
| `certified safe` | “No safety certification is claimed” |
| `guaranteed` | “Accountability through inspection and a durability holdback” |
| `guaranteed durability` | “A later inspection decides whether the holdback is released” |
| `the city adopted MEND` | “No city adoption; low-risk community pilot scope” |
| `official partner` / `partnered with` | Name only a real documented relationship — currently none |
| `provably fair` | “Deterministic, hash-pinned policy scoring” |
| `audited` | “Protocol tested locally; third-party audit not performed” |
| `production-ready` | “In active integration; limitations documented” |
| `fully decentralized` | Describe the actual roles, keys and operator trust |
| `trustless` | Describe what each party must trust |

## Plain-language payment copy

Use numbers and actors, not protocol jargon:

- “The sponsor funded **100**. The winning bid was **80**, so **20** went back.”
- “The contractor is paid **72** after independent acceptance.”
- “**8** is held until a later durability inspection.”
- “The durability inspection failed, so the same work order reopened. No new money
  was created.”
- “This is a dry quote. No money has moved.”
- “This transaction is pending. It is not a payment yet.”

Avoid “gas”, “yoctoNEAR”, “NEP-141”, “escrow contract invocation” and “state
transition” in primary user copy. Put technical details behind a disclosure.

## AI copy

| Situation | Copy |
|---|---|
| Suggestion available | “AI suggestion — confidence 94%. A steward must confirm.” |
| Duplicate candidate | “Possible duplicate. Same asset, similar photo, nearby report. Confirm or reject.” |
| Evidence checklist | “Missing: close-up of the repaired bracket. This is a completeness check, not a safety judgment.” |
| Attestation verified | “Inference evidence verified for this request/response.” |
| Attestation unavailable | “Inference evidence unavailable. The suggestion is unverified.” |
| Prompt injection blocked | “Unsafe instruction blocked. No payment or role change occurred.” |

Never use “AI approved”, “AI accepted”, “AI certified” or “AI decided”.

## Physical repair copy

| Situation | Copy |
|---|---|
| Real repair | “Real repair, performed with consent.” |
| Staged | “Staged reconstruction — not a real MEND job.” |
| Replay | “REPLAY / SIMULATION — recorded scenario, not a live transaction.” |
| No media | “Repair media not yet collected.” |
| Inspection | “Human inspector accepted the evidence on [date].” |
| Durability fail | “The later inspection failed. The same work order reopened.” |

Do not use “fixed forever”, “safe for use”, “municipal approval” or “community
endorsement”.

## Accessibility commitments

Target: **WCAG 2.2 AA**. This is a design target, not a certification. An audit is
pending integration.

| Area | Commitment |
|---|---|
| Semantics | Headings in order, landmarks, lists, tables with headers, form labels |
| Keyboard | Every action reachable and operable without a mouse; no keyboard trap |
| Focus | Visible focus indicator with sufficient contrast |
| Contrast | Text and essential UI at least 4.5:1; large text 3:1; non-text UI 3:1 |
| Color | Status is never conveyed by color alone; use text and icon |
| Zoom | Usable at 200% and 400% reflow without loss of content |
| Motion | Respect `prefers-reduced-motion`; no flashing or strobe |
| Captions | Demo video has burned-in captions and a `.vtt` file |
| Transcript | A text transcript is provided |
| Alt text | Meaningful images have alt text; decorative images are marked |
| Forms | Errors are described in text, associated with the field, and recoverable |
| Timing | No surprising timeout; warn and allow extension where possible |
| Touch | Targets at least 44×44 CSS pixels where practical |
| Screen reader | Status changes announced politely; no constant live-region noise |
| Language | Page language set; plain language for payments and modes |
| Mobile | Responsive layouts tested at small viewports |

## Accessibility testing plan

| Test | Status |
|---|---|
| Automated axe scan on public pages | **PASS** — no serious/critical violations (Playwright) |
| Keyboard-only walkthrough | **PASS** — Playwright keyboard navigation |
| Screen-reader smoke test | **NOT RUN** — manual human step |
| 200% / 400% zoom | **NOT RUN** — manual human step |
| Reduced-motion check | **IMPLEMENTED** — reduced-motion media query |
| Mobile viewport check | **PASS** — 390×844 Playwright project |
| Caption/transcript review | **RECORDED — v4 Liam** — 48 alignment-derived verbatim cues, `.srt`/`.vtt`; human watch/listen-through still pending |
| Color-contrast audit | **PARTIAL** — axe contrast rules pass on public pages |

## Writing style

- Short sentences. One idea per sentence.
- Active voice: “The inspector accepted the evidence,” not “The evidence was
  accepted.”
- Numbers as numerals for money and time.
- Explain a term the first time it appears.
- Put the mode label before the claim, not after.
- Link to the evidence, not to a vague “details” page.
- If something is unknown, write `UNAVAILABLE` and say why.
- If something needs a person, write `BLOCKED_ON_HUMAN` and say what is needed.
- Never fill a gap with a plausible-sounding sentence.

## Related documents

- [06 — Privacy model](./06-privacy-model.md)
- [08 — Oracle and human trust](./08-oracle-and-human-trust.md)
- [11 — Limitations](./11-limitations.md)
- [13 — Demo script](./13-demo-script.md)

---

[Docs index](./README.md) · [← Integration evidence](./16-integration-evidence.md) · [Root README](../README.md)

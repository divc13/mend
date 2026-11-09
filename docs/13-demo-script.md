# 13 — 90-second demo script

Target length: **90 seconds**. Timestamps match `PLAN.md` §9 exactly. The script
shows one complete, understandable repair — not an architecture tour, wallet setup
or track explanation.

> **Status:** script and placeholders only. No recording exists. No transaction
> link, quote ID, asset link or repair media may be inserted until it is real and
> human-approved. See [15 — Capture plan](./15-demo-capture-plan.md) and
> [12 — Real-world evidence package](./12-real-world-evidence-package.md).

## Global rules

- Mode badge is always visible: `REPLAY / SIMULATION`, `LIVE TESTNET — TEST VALUE ONLY`
  or `MAINNET — REAL FUNDS`.
- If the repair is staged, the first frame and the description say
  `STAGED RECONSTRUCTION — NOT A REAL MEND JOB`.
- If a scene is replay, the replay watermark stays on screen; no live transaction
  link is shown.
- If a scene is live testnet, the link is real and labelled test value only.
- No scene claims AI approval, structural safety, a guarantee or a city/partner
  endorsement.
- Captions are burned in and provided as a separate caption file.
- Numbers are spoken plainly: “seventy-two USDC paid, eight USDC held.” Test-value
  runs also show the `LIVE TESTNET — TEST VALUE ONLY` badge.

## Timed script

| Time | Visual | Narration | Caption / on-screen text | Evidence placeholder |
|---|---|---|---|---|
| **0–8s** | Real damaged asset: wide, then close on the split seat and loose armrest. Handheld, natural sound. | “Public assets fail in public. This bench has a split seat and a loose armrest. Reporting it should not require a wallet — or publish your home address.” | `A broken public bench. Report it without a wallet.` | `[HUMAN SUPPLIED — REAL OR STAGED BEFORE MEDIA]` |
| **8–18s** | Split screen: two report cards, redaction boxes on a face/plate, “metadata removed” indicator, duplicate suggestion with confidence. | “Two people report the same damage. MEND strips photo metadata, lets them redact faces, and privately suggests a duplicate. A steward confirms the merge. Raw media never goes on-chain.” | `2 reports → 1 case` · `EXIF removed` · `Human confirms duplicate` | `[HUMAN SUPPLIED — REPLAY OR LIVE CASE LINK]` |
| **18–28s** | Steward console: scope, maximum budget, DAO proposal reference, roster and policy hash. | “The steward writes the scope and a maximum budget. The DAO — not the AI — approves the budget, the contractor roster and a published scoring policy.” | `Steward proposes` · `DAO authorizes` · `AI has no payment authority` | `[HUMAN SUPPLIED — DAO PROPOSAL ID]` |
| **28–38s** | Sponsor view: source asset, estimated output, fees, destination, then a clear `DRY QUOTE — NOT A PAYMENT` banner. | “A sponsor prepares to fund the work order. This is a dry quote from NEAR Intents: the fees and destination are estimates, not a payment. Live Intents is mainnet-only.” | `DRY QUOTE — NOT A PAYMENT` · `MAINNET ONLY` · `Test value shown separately` | `[HUMAN SUPPLIED — 1CLICK DRY QUOTE ID]` |
| **38–50s** | Bid room: three sealed offers, then reveal, then the deterministic score table. Highlight B at 9270, C at 5200, A at 2873. | “Three contractors submit sealed offers. After reveal, a deterministic rule scores price, warranty, duration and materials. B wins on total value, not the lowest sticker price. No language model chooses the winner.” | `Sealed bids` → `Reveal` → `Deterministic score` · `B 9270 · C 5200 · A 2873` | `[HUMAN SUPPLIED — SCORE EXECUTION / ATTENTION PANEL LINK]` |
| **50–58s** | Short repair clip: start state, work in progress, completed component. If staged, the overlay is permanent. | **Real variant:** “The repair is real, performed with consent.” **Staged variant:** “This repair is a staged reconstruction, clearly labelled.” | `REAL REPAIR — CONSENTED` or `STAGED RECONSTRUCTION — NOT A REAL MEND JOB` | `[HUMAN SUPPLIED — REPAIR MEDIA]` |
| **58–68s** | Inspector console: checklist, redacted evidence, human acceptance. Then the payment split `72 + 8 = 80`. | “An independent inspector reviews the evidence and accepts. Exactly seventy-two USDC is paid to the contractor. Eight USDC stays held for durability.” | `HUMAN ACCEPTED` · `72 paid · 8 held` · `90 / 10` | `[HUMAN SUPPLIED — TESTNET COMPLETION TX]` |
| **68–78s** | Later inspection: failed check, then the same work-order ID reopening as `WARRANTY_REOPENED`. | “The later inspection fails. MEND reopens the same work order and the same warranty history. No new bounty. No new money.” | `DURABILITY FAILED` · `SAME WORK ORDER` · `NO NEW FUNDS` | `[HUMAN SUPPLIED — TESTNET DURABILITY FAILURE TX]` |
| **78–86s** | Asset passport: failure, remediation, payments, inspection timestamps, current state. | “The passport keeps the failure, the remedy and every payment in one permanent record.” | `One asset. One history.` · `Passport is not legal ownership` | `[HUMAN SUPPLIED — PASSPORT / ASSET LINK]` |
| **86–90s** | MEND wordmark on the repaired asset; quiet end frame. | “MEND. Get it fixed. Keep it fixed.” | `MEND — Get it fixed. Keep it fixed.` | — |

## Caption file

Use a standard WebVTT file. One cue per scene, maximum two lines, 42 characters
per line. Keep the mode label visible independently of captions.

```text
WEBVTT

00:00:00.000 --> 00:00:08.000
A broken public bench.
Report it without a wallet.

00:00:08.000 --> 00:00:18.000
Two reports become one case.
Raw media never goes on-chain.

00:00:18.000 --> 00:00:28.000
Steward proposes.
DAO authorizes.
AI has no payment authority.

00:00:28.000 --> 00:00:38.000
DRY QUOTE — NOT A PAYMENT.
Live Intents is mainnet-only.

00:00:38.000 --> 00:00:50.000
Three sealed offers.
A deterministic rule picks B.
No language model chooses the winner.

00:00:50.000 --> 00:00:58.000
REAL REPAIR — CONSENTED

00:00:58.000 --> 00:01:08.000
HUMAN ACCEPTED.
72 USDC paid. 8 USDC held.

00:01:08.000 --> 00:01:18.000
Durability failed.
The same work order reopens.
No new funds.

00:01:18.000 --> 00:01:26.000
One asset. One permanent history.

00:01:26.000 --> 00:01:30.000
MEND — Get it fixed. Keep it fixed.
```

Choose **one** repair variant for the actual caption file. If the repair is
staged, replace the 50–58s cue with:

```text
00:00:50.000 --> 00:00:58.000
STAGED RECONSTRUCTION — NOT A REAL MEND JOB
```

Do not publish a file that displays both variants.

## Production variants

### Variant A — real repair (preferred)

- Real consented asset, real repairer, real independent inspector.
- Before/repair/after/durability media per
  [12 — Evidence package](./12-real-world-evidence-package.md).
- Real testnet transaction links, or clearly labelled replay for software scenes.
- Narration says “The repair is real, performed with consent.”

### Variant B — staged repair (allowed only if transparent)

- A reconstruction on a real object or a set, performed safely.
- Permanent overlay: `STAGED RECONSTRUCTION — NOT A REAL MEND JOB`.
- No claim that a community repair took place.
- Software scenes may be replay, labelled `REPLAY / SIMULATION`.
- Narration says “This repair is a staged reconstruction, clearly labelled.”

### Variant C — no physical media yet

- Use an honest placeholder title card: `REPAIR MEDIA NOT YET COLLECTED`.
- Do not use stock footage of an unrelated repair as if it were MEND.
- Demo the software in `REPLAY / SIMULATION`; state that physical evidence is
  pending.

## Voice-over direction

- Calm, plain, ~150 words per minute.
- No hype, no “revolutionary”, no “guaranteed”, no “AI-approved”.
- Pronounce MEND as one word.
- Pause after “No new money.” and before the final line.
- Do not say “we partnered”, “the city adopted” or “audited”.

## Music and sound

- Optional quiet bed, licensed for the intended publication.
- Keep narration at least 6 dB above music.
- No sirens, alarms or emergency imagery.
- Captions remain readable with sound off.

## Accessibility

- Burned-in captions plus a `.vtt` file.
- High contrast for all on-screen labels.
- No rapid flashing or strobe.
- Describe visual evidence in narration where it matters.
- Provide a text transcript in the submission package.
- If the video autoplays in a web page, it starts muted with controls.

## Pre-production checklist

- [ ] Mode chosen: `REPLAY`, `LIVE TESTNET` or `MAINNET`.
- [ ] Every transaction link is real or absent; none invented.
- [ ] Repair category decided: real, staged or not collected.
- [ ] Consent records signed for every identifiable person/property.
- [ ] Media hashes recorded before editing.
- [ ] On-screen labels match the category.
- [ ] 72/8 numbers are exact and match the payment records.
- [ ] The failed durability scene uses the same work-order ID.
- [ ] No AI-approval, structural-safety, guarantee, city-adoption or partnership
      language.
- [ ] Human review of the final cut before publication.

## Related documents

- [12 — Evidence package](./12-real-world-evidence-package.md)
- [15 — Capture plan](./15-demo-capture-plan.md)
- [17 — Copy and accessibility](./17-copy-and-accessibility.md)
- [Submission package](./14-submission-package.md)

---

[Docs index](./README.md) · [← Evidence package](./12-real-world-evidence-package.md) · [Next: submission package →](./14-submission-package.md)

# 12 — Real-world evidence package

This page defines the evidence package for a pilot repair: what to photograph,
what consent to obtain, how to prove the files were not edited, and how to tell
the audience exactly what was real, staged or replayed.

> **Current status: NOT COLLECTED.** No repair has been performed for MEND, no
> media exists, no consent has been signed and no durability inspection has
> happened. The files in [`fixtures/demo/`](../fixtures/demo/README.md) are
> templates with empty fields. Do not fill them with invented evidence.

## Honesty rule

Every material claim in the demo must fall into one of these categories:

| Category | Meaning | Required label |
|---|---|---|
| **REAL** | A real repair by a real person at a real consented location, captured as it happened | `REAL REPAIR — CONSENTED` |
| **STAGED** | A reconstruction or demonstration, even if performed on a real object | `STAGED RECONSTRUCTION — NOT A REAL MEND JOB` |
| **REPLAY** | Recorded application state or fixture data | `REPLAY / SIMULATION` |
| **SIMULATED** | A modelled outcome with no physical event | `SIMULATED — NO PHYSICAL REPAIR` |
| **EDITORIAL** | A diagram, map or animation | `ILLUSTRATION` |

If an element is staged, say so **on screen** and in the narration. Do not mix a
real repair clip with a replay payment and imply they are one live event.

## Package contents

| Artifact | Template | Required? |
|---|---|---|
| Evidence manifest (asset, files, hashes, consent IDs, status) | [`evidence-manifest.template.json`](../fixtures/demo/evidence-manifest.template.json) | Yes |
| Media checklist and capture log | [`media-checklist.md`](../fixtures/demo/media-checklist.md) | Yes |
| Consent record | [`consent-record.template.md`](../fixtures/demo/consent-record.template.md) | Yes, for every identifiable person/property |
| What was real vs staged | [`what-was-real-vs-staged.template.md`](../fixtures/demo/what-was-real-vs-staged.template.md) | Yes |
| Transaction/link log | [`transactions.template.json`](../fixtures/demo/transactions.template.json) | Yes if any live transaction is shown |
| Raw originals | Private storage, access-controlled | Yes |
| Redacted public copies | Private storage with signed access; hashes on-chain | Yes |
| SHA-256 manifest | Generated from originals before editing | Yes |

## Before / repair / after / durability checklist

Use the same asset ID card in every shot when possible. Keep the original files;
redact only copies.

### Before

- [ ] Wide shot showing the asset in its public context.
- [ ] Medium shot showing the whole damaged component.
- [ ] Close shot of the specific damage.
- [ ] Scale reference (ruler, hand or known object) where useful.
- [ ] Asset ID card or public asset label visible.
- [ ] Date/time and location context without exposing a private home.
- [ ] Reporter/owner consent for the location and any identifiable person.
- [ ] No bystander faces, plates or private windows without consent/redaction.

### Repair

- [ ] Start state with the same angle as the “before” close shot.
- [ ] Materials/tools used (brand optional; no endorsement claim).
- [ ] Work in progress.
- [ ] Completed component before cleanup.
- [ ] Repairer identity/consent if shown.
- [ ] No unsafe work, electrical/gas/structural activity, or emergency scene.

### After

- [ ] Same wide angle as “before”.
- [ ] Same medium angle.
- [ ] Same close angle.
- [ ] Functional test (for example sit, open, push, latch) where safe.
- [ ] Asset ID card visible.
- [ ] Lighting/time disclosed if different from “before”.

### Durability

- [ ] Later inspection date/time, visibly after the repair.
- [ ] Same angles as the “after” set.
- [ ] Functional test repeated.
- [ ] Durability inspector identified (with consent) or anonymized.
- [ ] Pass/fail recorded with the same work-order ID.
- [ ] If failed: the failure is shown, not hidden; the remediation is a separate clip.
- [ ] Demo durability interval disclosed as configured minutes, not a real-world claim.

## Capture and integrity protocol

1. **Record the original** on the capture device; do not overwrite it.
2. **Export originals** without filters, crops or beauty modes.
3. **Compute SHA-256** for every original before editing.
4. **Redact copies** (faces, plates, private windows) and record which boxes were
   applied.
5. **Never upscale, generate or composite** damage that was not there.
6. **Keep a capture log**: file name, device, date/time, location, photographer,
   consent ID and what it shows.
7. **Store originals privately**; public copies are redacted and access-controlled.
8. **Record the hash** in the manifest. A hash is not a claim that the content is
   true; it is a claim that the file has not changed since hashing.
9. **Preserve the chain of custody**: who exported, who redacted, who approved.
10. **Disclose edits** in the real-vs-staged log, including colour correction or
    stabilization used for the demo.

## Consent record

The consent template covers:

- the person’s name/contact and role (reporter, repairer, inspector, bystander,
  property owner);
- what may be recorded (photo, video, audio, voice);
- where it may appear (demo video, repository, public post, hosted demo);
- whether the person may be identified or must be anonymized;
- the license granted to MEND and its duration;
- the right to withdraw before publication and what happens after publication;
- compensation (if any) and whether it is disclosed;
- signature/date and the MEND witness.

Special cases:

- **Minors:** do not film identifiable minors without a parent/guardian consent.
- **Bystanders:** redact faces/plates unless consent is recorded.
- **Private property:** obtain the owner’s permission before filming.
- **Repairer:** disclose whether they are a real contractor, a volunteer or a
  staged actor.
- **Inspector:** disclose whether the inspection is independent or a
  demonstration.

A consent record is not a release to fabricate. It only permits use of what was
actually captured.

## What was real vs staged

Complete the template for **every** scene. Example rows (all statuses currently
`NOT COLLECTED`):

| Element | Category | What the audience sees | Disclosure |
|---|---|---|---|
| Damaged bench | `NOT COLLECTED` | `[HUMAN SUPPLIED]` | `[HUMAN SUPPLIED]` |
| Repair clip | `NOT COLLECTED` | `[HUMAN SUPPLIED]` | `[HUMAN SUPPLIED]` |
| Two merged reports | `REPLAY` (planned) | Recorded fixture data | `REPLAY / SIMULATION` |
| Bid ranking | `REPLAY` or `LIVE TESTNET` | Deterministic score panel | Label the mode and evidence |
| 72/8 payment | `REPLAY` or `LIVE TESTNET` | Payment split | `[HUMAN SUPPLIED — TX LINK]` only if real |
| Intents view | `DRY QUOTE` | Quote/fees/destination | `DRY QUOTE — NOT A PAYMENT` |
| Durability failure | `REPLAY` or `LIVE TESTNET` | Warranty reopened | Label the mode |
| Passport history | `REPLAY` or `LIVE TESTNET` | Asset timeline | Label the mode |

If the entire repair is staged, the video must say so at the start and in the
description. It may still demonstrate the software; it must not imply a real
community repair happened.

## Transaction evidence

Only insert a transaction link after it exists and has been independently checked:

- testnet: a real testnet explorer link, labelled `LIVE TESTNET — TEST VALUE ONLY`;
- mainnet: a real mainnet explorer link, labelled `MAINNET — REAL FUNDS`, with the
  human approval record;
- replay: no transaction link; use the replay artifact and label
  `REPLAY / SIMULATION`.

Never invent a hash, an explorer URL, a quote ID or a date. The template uses
`null` and `HUMAN_SUPPLIED` placeholders for this reason.

## Storage and access

| File | Location | Access |
|---|---|---|
| Originals | Private object storage / encrypted disk | Capture lead + consent owner |
| Redacted public copies | Private object storage with signed URLs | Demo editor; public only via published video |
| Consent records | Restricted folder; not in the public repo | Human operator |
| Manifest and hashes | Repository or private evidence folder | Reviewers |
| Transaction links | Public explorer + docs | Public |

Do not commit raw identifiable media or consent records to the public repository.

## Completion criteria

The evidence package is complete only when:

- [ ] every media file has a consent record and a manifest entry;
- [ ] every original has a SHA-256 hash before editing;
- [ ] redaction is documented;
- [ ] every scene has a real/staged/replay category;
- [ ] every transaction link is real or marked absent;
- [ ] the repair and durability dates are real and consistent;
- [ ] a human has reviewed the package for privacy and accuracy;
- [ ] the demo description matches the package.

Until then, the status is **NOT COLLECTED** and the demo must say so.

## Related documents

- [06 — Privacy model](./06-privacy-model.md)
- [13 — Demo script](./13-demo-script.md)
- [15 — Capture plan](./15-demo-capture-plan.md)
- [17 — Copy and accessibility](./17-copy-and-accessibility.md)
- [Evidence templates](../fixtures/demo/README.md)

---

[Docs index](./README.md) · [← Limitations](./11-limitations.md) · [Next: demo script →](./13-demo-script.md)

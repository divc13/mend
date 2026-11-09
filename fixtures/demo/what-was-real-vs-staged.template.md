# What was real vs staged (template)

**Status: NOT COLLECTED.** Every row is unset. Fill this log only after the
material exists. If a row cannot be filled truthfully, do not show that scene.

## Categories

| Category | Meaning | Required on-screen label |
|---|---|---|
| REAL | Real repair, real people, real consented location | `REAL REPAIR — CONSENTED` |
| STAGED | Reconstruction or demonstration | `STAGED RECONSTRUCTION — NOT A REAL MEND JOB` |
| REPLAY | Recorded application state | `REPLAY / SIMULATION` |
| SIMULATED | Modelled outcome, no physical event | `SIMULATED — NO PHYSICAL REPAIR` |
| EDITORIAL | Diagram, map or animation | `ILLUSTRATION` |

## Scene log

| Scene | Element | Category | What the audience sees | Disclosure / label | Evidence |
|---|---|---|---|---|---|
| 0–8s | Damaged asset | `NOT COLLECTED` | `HUMAN SUPPLIED` | `HUMAN SUPPLIED` | `HUMAN SUPPLIED` |
| 8–18s | Reports and merge | `REPLAY` (planned) | Recorded fixture data | `REPLAY / SIMULATION` | `HUMAN SUPPLIED — CASE LINK` |
| 18–28s | Steward / DAO | `REPLAY` or `LIVE TESTNET` | Scope and authorization | Mode label | `HUMAN SUPPLIED — DAO PROPOSAL ID` |
| 28–38s | Sponsor view | `DRY QUOTE` | Quote, fees, destination | `DRY QUOTE — NOT A PAYMENT` + `MAINNET ONLY` | `HUMAN SUPPLIED — QUOTE ID` |
| 38–50s | Sealed bids | `REPLAY` or `LIVE TESTNET` | Three offers and score | Mode label | `HUMAN SUPPLIED — SCORE REF` |
| 50–58s | Repair clip | `NOT COLLECTED` | `HUMAN SUPPLIED` | `HUMAN SUPPLIED` | `HUMAN SUPPLIED` |
| 58–68s | Inspection and 72/8 | `REPLAY` or `LIVE TESTNET` | Human acceptance and split | Mode label | `HUMAN SUPPLIED — TX LINK` |
| 68–78s | Durability failure | `REPLAY` or `LIVE TESTNET` | Same work order reopens | Mode label | `HUMAN SUPPLIED — TX LINK` |
| 78–86s | Passport | `REPLAY` or `LIVE TESTNET` | Failure, remedy, payments | Mode label | `HUMAN SUPPLIED — PASSPORT LINK` |
| 86–90s | Wordmark | `EDITORIAL` | Brand end frame | `ILLUSTRATION` if animated | — |

## Summary

| Question | Answer |
|---|---|
| Was a real repair performed for MEND? | `HUMAN SUPPLIED — YES / NO / STAGED` |
| Were real people filmed? | `HUMAN SUPPLIED` |
| Is every identifiable person consented? | `HUMAN SUPPLIED` |
| Are any scenes staged? | `HUMAN SUPPLIED` |
| Are any scenes replay? | `HUMAN SUPPLIED` |
| Are all transaction links real? | `HUMAN SUPPLIED` |
| Is any stock footage used? | `HUMAN SUPPLIED` (must not be presented as MEND) |
| Was any media generated or altered? | `HUMAN SUPPLIED` (disclose) |
| Reviewer | `HUMAN SUPPLIED` |
| Review date | `HUMAN SUPPLIED` |

## Rules

- If a scene is staged, the label is permanent and in the narration.
- If a scene is replay, no live transaction link appears.
- If a dry quote is shown, it is never called a payment.
- If no physical media exists, use `REPAIR MEDIA NOT YET COLLECTED`; do not use
  unrelated footage.
- The final description must match this log.

## Related documents

- [Evidence package](../../docs/12-real-world-evidence-package.md)
- [Demo script](../../docs/13-demo-script.md)
- [Media checklist](./media-checklist.md)
- [Consent record](./consent-record.template.md)
- [Docs index](../../docs/README.md)

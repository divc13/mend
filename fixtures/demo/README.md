# MEND demo evidence templates

**Status: NOT COLLECTED.** These are empty templates. No repair has been performed
for MEND, no media exists, no consent has been signed and no transaction has been
recorded.

Do not fill these files with invented names, hashes, dates, links or media. A
placeholder stays a placeholder until a human supplies the real artifact.

## Files

| File | Use |
|---|---|
| [`media-checklist.md`](./media-checklist.md) | Before / repair / after / durability capture checklist |
| [`consent-record.template.md`](./consent-record.template.md) | Consent for identifiable people and private property |
| [`what-was-real-vs-staged.template.md`](./what-was-real-vs-staged.template.md) | Scene-by-scene honesty log |
| [`evidence-manifest.template.json`](./evidence-manifest.template.json) | Machine-readable asset, file, hash and consent manifest |
| [`transactions.template.json`](./transactions.template.json) | Real transaction/link log; placeholders until links exist |
| [`submission-description.txt`](./submission-description.txt) | 20–2,000 character submission description |

## How to use

1. Copy a template to a private working file (not the public repository if it
   contains personal data).
2. Fill only fields that are real.
3. Record SHA-256 hashes **before** editing.
4. Keep originals private; publish only redacted copies.
5. Complete the real-vs-staged log for every scene.
6. Insert a transaction link only after it exists and has been inspected.
7. Have a human review privacy, consent and accuracy.
8. Run `node scripts/demo/check-docs.mjs` before publishing.

## Rules

- No fabricated media, hashes, transaction links, quote IDs, dates or names.
- No stock repair footage presented as MEND.
- No identifiable person without consent.
- No private home, plate or face without redaction or consent.
- No claim that a staged repair was real.
- No claim that a replay is a live transaction.
- No claim of city adoption or partnership.

## Related documents

- [Real-world evidence package](../../docs/12-real-world-evidence-package.md)
- [Demo script](../../docs/13-demo-script.md)
- [Demo capture plan](../../docs/15-demo-capture-plan.md)
- [Copy and accessibility](../../docs/17-copy-and-accessibility.md)
- [Docs index](../../docs/README.md)

---

[Docs index](../../docs/README.md) · [Root README](../../README.md)

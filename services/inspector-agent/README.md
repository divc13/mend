# Inspector / evidence-review agent

Advisory completeness review only.

- Accepts a redacted manifest of checklist codes and SHA-256 hashes. Strict schemas reject URLs, unredacted items and precise locations.
- Returns **only missing checklist codes** plus limitations; never a quality, safety or acceptance claim.
- Rejects certification language and protected fields (`accepted`, `recipient`, `role`, `payoutRule`, `scopeHash`, ...).
- `signature` is always `false`; `submitFinalAcceptance()` throws `FORBIDDEN_ROLE`.
- The assistant has no hub methods; final acceptance belongs to the rostered human inspector.

Prompt-injection attacks in evidence notes and model output are blocked and logged.

```bash
npm test && npm run typecheck
```

Live blocker: physical inspection and the final acceptance signature are human actions, not agent output.

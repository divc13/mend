# Agent Market worker

Client for the NEAR Agent Market at `https://market.near.ai` (OpenAPI `2.0.0`).

- Worker auth only: `Authorization: Bearer aat_<32 hex>`. Tokens are never logged.
- Implemented worker routes: poll assignments, start, progress, decline, message, submit.
- **There is no worker accept endpoint.** `acceptAssignment()` throws before any HTTP call. A human buyer accepts on the job page.
- Briefs contain only checklist codes and SHA-256 hashes. Private media URLs, file paths and precise locations are rejected; injected text is logged and omitted.
- Registration/pricing/publish plans are deterministic and require a human owner session with confirmed email.
- Listing text, deliverable and profile disclose: “Self-hire test; not independent market reputation.” and “Advisory completeness review only.”

All default tests use recorded fixtures in `fixtures/agents/agent-market/`. Live mode requires an `aat_` token, is restricted to `market.near.ai`, and is labelled live (production marketplace, real money, no testnet/sandbox).

```bash
npm test && npm run typecheck
```

Live blockers: a human-owned Agent Market account, confirmed email, `aat_` token, balance/payment rail and a human buyer acceptance.

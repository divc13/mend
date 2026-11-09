# MEND attack fixtures (T07.2)

These files are **untrusted adversarial input for tests**. They are never sent
to a live model by CI, never treated as instructions and never presented as
production data.

## Prompt injection

| File | Attack surface | Expected result |
|---|---|---|
| `prompt-injection/report.txt` | public report description | detected by `scanPromptInjection`; wrapped as `MEND_UNTRUSTED_*` data; no recipient, role, scope, payout rule or acceptance change |
| `prompt-injection/evidence.txt` | completion evidence package | detected; evidence review returns only missing checklist items; no certification language, no signature, no acceptance |
| `prompt-injection/bid-explanation.txt` | contractor bid note / explanation | detected; deterministic scoring ignores prose; winner, price, warranty and recipient unchanged |
| `prompt-injection/agent-market-brief.txt` | Agent Market job brief | detected; brief carries redacted hashes only; worker cannot approve or change recipient/role |
| `prompt-injection/model-response-recipient-change.json` | hostile model output | rejected by `enforceTrustedAction` with `PROMPT_INJECTION_REJECTED` |
| `prompt-injection/model-response-acceptance.json` | hostile model output | rejected for physical-safety certification language |
| `prompt-injection/model-response-bid-explanation.json` | hostile model output | rejected for protected action fields (`winnerBidId`, `recipient`, `payoutRule`, `role`, `scopeHash`) |
| `prompt-injection/model-response-agent-market.json` | hostile model output | rejected for protected action fields and certification language |

`tests/security/prompt-injection.test.ts` owns the assertions. It also asserts
that every detected attack produces a security-log event with the surface name
and categories, and that the event stores a hash of the untrusted text rather
than the text itself.

## Required security-log shape

```json
{
  "schema": "mend.security-log.v1",
  "event": "PROMPT_INJECTION_DETECTED",
  "surface": "report|evidence|bid-explanation|agent-market-brief",
  "categories": ["recipient-change", "role-change"],
  "textHash": "<64 lowercase hex>",
  "textLength": 123,
  "actionTaken": "NONE",
  "authorityChanged": false
}
```

The live API/service must emit this event (or a superset) when it receives any
of these inputs. When `apps/api` or the worker services are absent from a
checkout, the live-log assertion is skipped with an explicit reason.

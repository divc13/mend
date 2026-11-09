# MEND observability

Guidance for structured logs, health endpoints and transaction reconciliation
alerts (T08.5). These documents define the contract that `apps/api`,
`services/indexer`, `services/relayer` and the agents should implement.

- [Logging contract](logging.md) — JSON schema, levels, redaction rules.
- [Health endpoints](health-endpoints.md) — liveness/readiness contract used by
  Docker, CI smoke tests and deployment checks.
- [Transaction reconciliation](transaction-reconciliation.md) — alert rules,
  daily checklist and the manual investigation runbook.
- [Alert rules](alerts/transaction-reconciliation.rules.yml) — Prometheus-style
  rules referenced by the checklist.

## Hard rules

1. **Never log secrets.** No API keys, JWTs, function-call keys, private keys,
   seed phrases, signed URLs, cookies or `Authorization` headers.
2. **Never log private evidence.** No raw media, precise locations, reporter
   case links, unredacted descriptions or signed evidence URLs. Log the redacted
   hash / record ID instead.
3. **Do not turn a quote into a payment.** Log quote/dry-run events distinctly
   from executed transactions.
4. **Logs are not the financial source of truth.** The hub contract is. Logs and
   Postgres are supporting evidence only.
5. **Unavailable verification is logged as unavailable**, never as passed.

# Coordinator agent

Deterministic draft-scope / draft-work-order proposal agent.

- Strict typed intake (`CoordinatorIntakeSchema`).
- Output is validated with `AssetSchema` and `WorkOrderSchema`; the work order is always `DRAFT` and has no contractor, inspector, winner or payment.
- Scope hash uses the canonical protocol `stableStringify` + SHA-256.
- Untrusted report text is scanned; detected prompt injection is logged as `prompt_injection_blocked` and never becomes asset/scope content.
- `performAction` has a positive allowlist (`create_asset`, `create_work_order`) and rejects award, acceptance, inspection, funding, payment, role and pause methods.

The agent cannot sign, award, accept, inspect, refund or pay. It requires a separate steward and DAO approval in the protocol lifecycle.

```bash
npm test && npm run typecheck
```

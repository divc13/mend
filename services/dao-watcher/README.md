# Sputnik DAO watcher

Read-only Sputnik DAO v2 policy/proposal checks and exact `dao_authorize` proposal construction.

- Builds the hub call for the canonical freeze:

```text
dao_authorize(work_order_id, proposal_id, scope_hash, policy_hash, budget: U128,
              contractor_roster, inspector_roster, commit_deadline: u64, reveal_deadline: u64)
```

- Args are canonical JSON (sorted keys, UTF-8, no whitespace) with deadlines as raw JSON integers in nanoseconds; `budget` stays a decimal string for `U128`.
- Produces the exact Sputnik `FunctionCall` envelope: receiver = hub, one action, method `dao_authorize`, deposit `0`, gas `30 Tgas`.
- Verification rejects wrong status, wrong method, wrong receiver, extra/missing payload fields, wrong rosters, wrong policy hash, wrong gas/deposit and proposal-id mismatch.
- Policy check requires at least three human council members and an effective approval threshold of at least two; AI accounts may not be council members.
- The watcher exposes only `get_proposal` and `get_policy`. It has no key, no `add_proposal`, no `act_proposal`, no vote and no signer.

`fixtures/agents/dao/proposal-approved.json` was generated deterministically by `scripts/generate-fixtures.ts`.

```bash
npm test && npm run typecheck
```

Live blockers: testnet DAO/council accounts, council signatures and proposal bonds are human-held. The hub's push-path check (`predecessor == config.dao`) is the trust anchor; proposal text is never trusted.

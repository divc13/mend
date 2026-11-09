# 02 — User roles and permissions

MEND separates **reporting**, **authorization**, **execution**, **inspection** and
**payment**. No single account — human or AI — should be able to invent a scope,
award itself work, inspect its own work and release money.

Roles are enforced in the hub contract, not only in the UI or agent software. See
`orchestration/decisions/HUB-INTERFACE.md` and
[03 — Architecture](./03-architecture.md).

## Role summary

| Role | Who | Can | Cannot | Key / wallet model |
|---|---|---|---|---|
| **Reporter** | Resident or community member | Submit a report with photos and description; redact media; receive a private case link; see duplicate status | Approve scope, bid, inspect or receive escrow funds | No wallet required. Private case link is the credential. |
| **Steward** | Community operator | Confirm duplicate merges; propose scope and maximum budget; open/close bidding; request and record a score; confirm the deterministic rank-1 award; cancel before award | Override the scorer, pick a non-top bid, inspect their own contracted work, release money arbitrarily | Human wallet; role registered on the hub |
| **Sponsor** | Community fund, donor or treasury | Fund the exact work-order budget; receive unallocated refund | Choose the winner, approve evidence or release holdback | Funded NEAR wallet; the only account allowed to fund that work order |
| **DAO** | Sputnik DAO on NEAR | Approve budget envelope, contractor roster, inspector roster, scoring policy; call `dao_authorize`; resolve disputes; approve refunds | Micromanage every operational action; impersonate a steward or inspector | `config.dao` account; authorization is a push path from an approved proposal |
| **Contractor** | Repair business or worker | Commit and reveal a sealed bid; start work; submit completion or remediation evidence | Inspect or accept their own work, alter the inspector roster, release escrow | Separate sub-account with a scoped function-call key |
| **Inspector** | Independent human inspector | Accept completion; record durability pass/fail; record remediation decisions | Award themselves work; be the awarded contractor; alter bids, recipients or evidence | Separate sub-account with a scoped function-call key; human decision recorded |
| **Coordinator AI** | Agent runtime | Draft asset records, scopes and work-order proposals; request private triage | Award, accept, inspect, refund or release funds | Separate AI sub-account; method-scoped key; no payment methods |
| **Reviewer AI** | Evidence-completeness agent | Compare redacted evidence with the checklist; list missing items | Certify physical quality; give final acceptance; sign payment | Separate AI sub-account; scoped key |
| **Agent Market reviewer** | External evidence-review agent on NEAR Agent Market | Review a redacted brief; submit completeness findings | Accept its own job; certify physical repair; control MEND escrow | Agent Market worker token; acceptance stays human/buyer-side |
| **Relayer** | Gasless transaction service | Forward an allowlisted MEND method inside an NEP-366 `Delegate`; apply rate limits and replay protection | Call arbitrary contracts; forward funding or payment methods | Hot wallet with a full-access key; allowlist and quota enforced in software |
| **Indexer / operator** | Backend and operations | Rebuild the Postgres read model; run health checks; operate infrastructure | Claim a payment or state change the hub did not record; sign inspection decisions | Service credentials; no financial authority |
| **Public viewer** | Anyone | Browse public assets, cases, bids after reveal, evidence hashes, payments, passport and warranty status | See private media, precise location or reporter identity; transfer the passport | No wallet required |

## Separation-of-duties rules

| Rule | Enforcement | Failure code |
|---|---|---|
| Contractor cannot inspect their own work | Hub checks `inspector != awarded contractor` and roster membership | `CONTRACTOR_SELF_INSPECTION`, `INSPECTOR_SELF_AWARD` |
| AI accounts cannot award, accept, refund or release funds | Contract role checks independent of agent software | `FORBIDDEN_ROLE` |
| Only the deterministic rank-1 eligible bid can be awarded | Hub compares the recorded ranking and eligibility | `INELIGIBLE_WINNER`, `SCORE_STALE` |
| A late or invalid bid cannot win | Commit/reveal windows and hash checks | `BID_LATE`, `BID_EARLY_REVEAL`, `BID_HASH_MISMATCH` |
| Steward cannot choose a different winner | Award method accepts only rank 1 | `INELIGIBLE_WINNER` |
| Sponsor cannot choose the winner | Sponsor has funding/refund methods only | `FORBIDDEN_ROLE` |
| DAO cannot be simulated by a view call | Hub checks `predecessor_account_id == config.dao` on `dao_authorize` | `UNAUTHORIZED` |
| Reviewer AI cannot perform final acceptance | Reviewer methods write suggestions, not inspection decisions | `FORBIDDEN_ROLE` |
| Relayer cannot call arbitrary contracts | Receiver and method allowlists plus replay cache | `RELAYER_TARGET_NOT_ALLOWED`, `RELAYER_METHOD_NOT_ALLOWED`, `RELAYER_REPLAY` |
| Passport cannot be transferred | Every transfer/approval path panics | `TRANSFER_DISABLED` |

## Authority matrix

`✓` = allowed; `—` = not allowed; `R` = allowed only for the assigned roster record.

| Action | Reporter | Steward | Sponsor | DAO | Contractor | Inspector | Coordinator AI | Reviewer AI |
|---|---|---|---|---|---|---|---|---|
| Submit report | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — |
| Confirm duplicate cluster | — | ✓ | — | — | — | — | suggest only | suggest only |
| Propose scope / max budget | — | ✓ | — | — | — | — | draft only | — |
| Authorize budget / policy / roster | — | — | — | ✓ | — | — | — | — |
| Fund work order | — | — | ✓ | — | — | — | — | — |
| Commit / reveal bid | — | — | — | — | R | — | — | — |
| Score bids | — | request/record only | — | — | — | — | — | — |
| Award | — | ✓ (rank 1 only) | — | — | — | — | — | — |
| Submit completion | — | — | — | — | R | — | — | — |
| Accept completion | — | — | — | — | — | R | — | — |
| Durability decision | — | — | — | — | — | R | — | — |
| Open dispute | — | ✓ | — | — | R | R | — | — |
| Resolve dispute | — | — | — | ✓ | — | — | — | — |
| Release payment | contract only | — | — | — | — | triggers via acceptance | — | — |
| Transfer passport | — | — | — | — | — | — | — | — |

## Walletless reporter: what the case link is and is not

A reporter does not need a NEAR account. On submission, the backend returns a
high-entropy case link (for example `case_7J2mQ9xLk4Pz1VbN` in the canonical
fixture). That link:

- is a **bearer secret**: anyone with it can view the private case view;
- is not a wallet, a token, a passport or proof of identity;
- can be rotated or revoked for the private view, while public redacted history
  remains;
- never appears in public contract state.

See [06 — Privacy model](./06-privacy-model.md#walletless-reporting) for the full
data flow.

## AI roles are deliberately narrow

| AI capability | Allowed output | Not allowed |
|---|---|---|
| Triage | Category, severity suggestion, duplicate candidates, confidence, rationale | Merge without human confirmation; write public state |
| Scope generation | Draft scope, exclusions, evidence checklist, budget suggestion | Approve its own scope; award; select a contractor |
| Bid explanation | Restate structured values and the deterministic ranking | Change a score, choose a winner, rank by hidden preference |
| Evidence completeness | List missing checklist items from redacted evidence | Say a repair is safe, accepted or complete |
| Sponsorship parsing | Normalize quote/status fields | Treat a quote as a payment; sign or move funds |

## Human dependencies

Many roles cannot be exercised until a human supplies the account, funds or
consent. The current list is maintained in [PLAN §8](../PLAN.md) and summarised in
[10 — Deployment guide](./10-deployment-guide.md#human-gates) and
[16 — Integration evidence matrix](./16-integration-evidence.md). No agent may
invent a person, an account, a signature or a media consent record.

---

[Docs index](./README.md) · [← Problem and product](./01-problem-and-product.md) · [Next: architecture →](./03-architecture.md)

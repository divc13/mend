# Hub Contract Interface (frozen for Wave 1)

Contract: `contracts/hub` · near-sdk 5.30.x · token: NEP-141 (test mock on testnet)
All amounts are integer micro-units (6 decimals). All state-changing methods require the role noted and fail while paused (except `unpause` by owner/DAO and views).

## Roles and authority

| Role | Account source | Can |
|---|---|---|
| Owner | init | `set_role`, `unpause`, upgrade-free admin actions |
| Steward | `set_role` | approve policy/scope, open/close bidding, record score, award, cancel |
| DAO | config account | create/approve policy proposals off-chain reference, resolve dispute, refund |
| Contractor | work-order roster snapshot | commit/reveal, start work, submit completion/remediation |
| Inspector | work-order roster snapshot | accept completion, durability decisions (never own contractor work) |
| Coordinator AI | `set_role` + scoped key | create draft assets/work orders only; no award/payment/inspection |
| Reviewer AI | `set_role` + scoped key | evidence completeness only; no final acceptance |
| Sponsor | funding sender | fund work order, receive unallocated refund |

AI accounts never have payment, award, acceptance or dispute-resolution authority. The contract enforces role checks independent of agent software.

## Init

```text
init(owner: AccountId, token: AccountId, dao: AccountId, policy_hash: String, durability_minutes: u32)
```

## Change methods

| Method | Caller | States | Behavior |
|---|---|---|---|
| `set_role(account, role, enabled)` | owner/DAO | any | role registry |
| `pause(reason_hash)` | owner/DAO | any | PAUSED, remembers previous state |
| `unpause()` | owner/DAO | PAUSED | restores exact previous state |
| `create_asset(asset_id, description_hash, location_hash)` | steward/coordinator | — | asset record |
| `mint_passport(asset_id)` | steward | — | non-transferable NEP-171 passport, token_id = asset_id, owner = hub account (never a user); no approvals/burn |
| `create_work_order(work_order_id, asset_id, cluster_hash, scope_hash, dao_proposal_id, policy_hash, budget, sponsor, contractor_roster, inspector_roster, commit_deadline, reveal_deadline)` | steward/coordinator | — | DRAFT (scope + maximum budget proposed by steward; sponsor is the only allowed funder) |
| `dao_authorize(work_order_id, proposal_id, scope_hash, policy_hash, budget, contractor_roster, inspector_roster, commit_deadline, reveal_deadline)` | DAO only (`predecessor == config.dao`, normally executed by an approved Sputnik FunctionCall proposal) | DRAFT | POLICY_APPROVED; stores approved roster snapshot and proposal reference |
| `fund_work_order` via token `ft_transfer_call(msg = work_order_id)`; receiver `ft_on_transfer(sender_id, amount, msg)` | sponsor only | POLICY_APPROVED | exact token and exact remaining budget; underfund = full refund; overfund = refund excess; duplicate/cancelled = full refund; state FUNDED when fully funded |
| `open_bidding(work_order_id)` | steward | FUNDED | BIDDING_OPEN |
| `commit_bid(work_order_id, bid_id, commitment_hash)` | rostered contractor | BIDDING_OPEN before commit deadline | sealed commitment |
| `reveal_bid(work_order_id, bid_id, price, duration_days, warranty_days, materials_score, checklist_accepted, nonce)` | same contractor | BIDDING_OPEN after commit deadline, before reveal deadline | verifies commitment hash, stores reveal |
| `close_bidding(work_order_id)` | steward | BIDDING_OPEN after reveal deadline | BIDDING_REVEAL |
| `record_score(work_order_id, execution_id, policy_hash, wasm_hash, input_hash, output_hash, ranking)` | steward/oracle | BIDDING_REVEAL | policy hash must equal work order; ranking must contain every revealed eligible bid exactly once; SCORED |
| `request_score(work_order_id)` (payable; 300 Tgas) | steward | BIDDING_REVEAL | builds byte-stable canonical input from revealed eligible bids + policy hash, calls OutLayer `request_execution` with hash-pinned `wasm32-wasip1` code, stores a pending execution key, then `.then(on_score_result)` |
| `on_score_result(work_order_id, expected_input_hash, expected_policy_hash)` | private self-callback only (`#[private]`) | BIDDING_REVEAL | reads `promise_result(0)` (never a caller-supplied output), hashes it, verifies winner is eligible and has the maximum score, stores ScoreExecution; SCORED. Duplicate callback ignored |
| `award(work_order_id, bid_id)` | steward | SCORED | only rank 1 eligible bid; transfers unallocated budget (budget − price) back to sponsor; AWARDED |
| `start_work(work_order_id)` | awarded contractor | AWARDED or WARRANTY_REOPENED | IN_PROGRESS |
| `submit_completion(work_order_id, evidence_id, evidence_hash)` | awarded contractor | IN_PROGRESS | COMPLETION_SUBMITTED |
| `accept_completion(work_order_id, inspection_id, notes_hash)` | rostered inspector ≠ contractor | COMPLETION_SUBMITTED | records inspection; first acceptance pays exactly 90% to contractor; sets DURABILITY_PENDING and durability deadline; remediation acceptance pays nothing |
| `inspect_durability(work_order_id, passed, inspection_id, notes_hash)` | rostered inspector ≠ contractor | DURABILITY_PENDING | pass: release exactly 10% once and CLOSED; fail: WARRANTY_REOPENED, no new funds |
| `open_dispute(work_order_id, reason_hash)` | steward/inspector/contractor | AWARDED…WARRANTY_REOPENED | DISPUTED, freeze payouts |
| `resolve_dispute(work_order_id, target_state, resolution_hash)` | DAO only | DISPUTED | explicit human/DAO resolution to an allowed state |
| `cancel_work_order(work_order_id, reason_hash)` | steward | pre-award | CANCELLED |
| `refund(work_order_id)` | DAO/steward | CANCELLED or pre-award FUNDED/SCORED | returns remaining escrow to sponsor; REFUNDED; never double-refunds |
| `nft_transfer`, `nft_transfer_call`, `nft_approve` | anyone | — | always fail `TRANSFER_DISABLED` |

## Views

`get_config`, `get_role(account)`, `is_paused`, `get_asset(asset_id)`, `get_work_order(work_order_id)`,
`get_bids(work_order_id)` (commitments; reveals only after reveal), `get_revealed_bid(work_order_id, bid_id)`,
`get_score(work_order_id)`, `get_escrow(work_order_id)`, `get_payments(work_order_id)`, `get_warranty(work_order_id)`,
`get_history(asset_id)`, `get_work_orders_by_asset(asset_id)`, `nft_token(token_id)`, `nft_metadata()`,
`nft_total_supply()`, `nft_tokens_for_owner(account_id, from_index, limit)`.

## Invariants enforced in contract code and tests

1. Contractor cannot inspect own work; inspector cannot be the awarded contractor.
2. Only awarded contractor can start/submit work; only rostered inspector accepts.
3. AI roles cannot award, accept, refund or release funds.
4. Early reveal, late reveal, hash mismatch, duplicate bid and non-roster bids fail.
5. Only the deterministic rank-1 eligible bid can be awarded; stale/wrong-policy scores fail.
6. Funding = refunded + still-escrowed + completion paid + holdback held + holdback released, at all times.
7. Completion 90% is paid exactly once; holdback 10% released exactly once; closed work orders are immutable financially.
8. Warranty reopening creates no new escrow and keeps the same work-order ID and asset history.
9. Paused contracts reject all state-changing agent actions; unpause restores the previous state only.
10. Passport transfers always fail; no raw evidence URL, precise location or private media in public state.
11. Disputes freeze payouts; only DAO resolution moves a disputed order.

## Events

`EVENT_JSON` with `standard: "mend"`, `version: "1.0.0"`, `event`, `data`. Event names follow `packages/protocol/src/events.ts`. Every state change emits one event with work-order ID, actor and transaction-relevant fields.

## Trust notes

- DAO authorization is a push path: a Sputnik `FunctionCall` proposal executes `dao_authorize` on the hub only after the DAO approves it, and the hub checks `predecessor_account_id == config.dao`. MEND does not read or trust proposal text itself.
- OutLayer execution is trusted only through hash binding and the private promise callback: policy hash, WASM hash, input hash, output hash, and `promise_result(0)` (never a relayer-supplied output). If OutLayer is unavailable, a locally run hash-pinned WASM result is labeled accordingly and cannot claim OutLayer execution.

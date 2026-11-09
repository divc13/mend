# MEND Contracts

NEAR contracts for **MEND — Maintenance with memory**.

| Path | Purpose |
|---|---|
| `hub/` | Asset passports (NEP-171), work orders, DAO authorization, sealed bids, deterministic score binding, NEP-141 escrow, completion/durability payments and disputes |
| `test-token/` | Testnet-only NEP-141 mock USDC (`mUSDC`, 6 decimals). **Test value only.** |
| `Cargo.toml` | Rust workspace for both contracts |

The authoritative interface is
`orchestration/decisions/HUB-INTERFACE.md`; scoring rules are in `docs/RULES.md`.
All amounts are integer micro-units of the configured settlement token.

## Build and test

```bash
# from the repository root
cargo test --manifest-path contracts/Cargo.toml
cargo build --manifest-path contracts/hub/Cargo.toml --target wasm32-unknown-unknown --release
cargo build --manifest-path contracts/test-token/Cargo.toml --target wasm32-unknown-unknown --release
```

Artifacts:

```text
contracts/target/wasm32-unknown-unknown/release/mend_hub.wasm
contracts/target/wasm32-unknown-unknown/release/mend_test_token.wasm
```

`rust-toolchain.toml` pins the stable channel and the
`wasm32-unknown-unknown` target. The hub uses `near-sdk 5.30.1` and
`near-contract-standards 5.30.1`.

## Roles

`set_role(account, role, enabled)` is owner/DAO-only. Roles are
`STEWARD`, `CONTRACTOR`, `INSPECTOR`, `COORDINATOR_AI`, `REVIEWER_AI`,
`ORACLE`, `ADMIN`, `SPONSOR`, `REPORTER`, `DAO`, `RELAYER`.

- `COORDINATOR_AI` may create draft assets/work orders. It may never award,
  accept, refund or release funds.
- `REVIEWER_AI` is registered for method-scoped keys but has no payment,
  award, acceptance or dispute authority in this contract.
- `STEWARD` proposes scope/budget, opens/closes bidding, records/requests
  scores, awards, cancels and refunds. A steward cannot inspect.
- `DAO` is the configured Sputnik account. `dao_authorize` and
  `resolve_dispute` check `predecessor_account_id == config.dao`; the DAO
  authorizes through a Sputnik `FunctionCall` proposal. MEND never reads
  proposal text.
- `CONTRACTOR` and `INSPECTOR` authority is additionally scoped by each work
  order's DAO-approved roster snapshot. Contractor and inspector rosters must
  be disjoint.

## Lifecycle

```text
DRAFT
 → POLICY_APPROVED   (dao_authorize; the only DRAFT exit)
 → FUNDED            (sponsor ft_transfer_call to the hub; exact budget)
 → BIDDING_OPEN      (open_bidding)
 → BIDDING_REVEAL    (close_bidding after reveal_deadline)
 → SCORED            (record_score or request_score → on_score_result)
 → AWARDED           (rank-1 bid; budget − price refunded to sponsor)
 → IN_PROGRESS       (start_work by the awarded contractor)
 → COMPLETION_SUBMITTED (submit_completion)
 → DURABILITY_PENDING   (accept_completion by a rostered inspector ≠ contractor)
 → CLOSED            (inspect_durability passed; 10% released)
```

Alternative paths: `DURABILITY_PENDING → WARRANTY_REOPENED` on a failed
durability inspection, then the **same** work order re-enters `IN_PROGRESS`.
A dispute (`DISPUTED`) can be opened by the steward, a rostered inspector or
the awarded contractor; only the DAO can resolve it. Pre-award orders can be
`CANCELLED → REFUNDED`.

### Accounting

```text
funding = refunded + escrowed + completion_paid + holdback_held + holdback_released
```

For the canonical 100/80 example:

```text
sponsor budget       100
unawarded refund      20   (award, to sponsor)
locked award          80
completion payment    72   (first acceptance, to contractor)
durability holdback    8   (held)
holdback release       8   (durability pass, to contractor)
```

The invariant is asserted after every ledger mutation. A warranty reopening
never mints new escrow and never changes the work-order ID.

## Escrow receiver

Funding uses NEP-141 `ft_transfer_call`:

```json
{
  "receiver_id": "mend-hub.testnet",
  "amount": "100000000",
  "msg": "WO-BENCH-001-0001"
}
```

`ft_on_transfer(sender_id, amount, msg)`:

- rejects any predecessor other than the configured token (full refund);
- requires `sender_id == work_order.sponsor`;
- requires `POLICY_APPROVED`, no prior funding, and `amount >= budget`;
- keeps exactly `budget` and returns `amount − budget` (overfund excess);
- returns the full amount on underfund, duplicate funding, cancelled/closed
  work order, wrong sponsor or malformed `msg`;
- while paused, returns the full amount;
- does not move tokens: the internal ledger is authoritative and the token
  resolver refunds any unused amount.

## Sealed bids

Commitment hash (identical to `packages/protocol/src/hashing.ts`):

```text
sha256("MEND_BID_V1|bidId|contractorId|priceMicro|durationDays|warrantyDays|materialsScore|checklistAccepted?1:0|nonce")
```

`commit_bid` is allowed only while `BIDDING_OPEN` and before `commit_deadline`.
`reveal_bid` is allowed only from `commit_deadline` until `reveal_deadline`.
Early reveal, late reveal, hash mismatch, duplicate bid/reveal and non-roster
bidders fail. `get_bids` and `get_revealed_bid` hide reveals until the reveal
phase begins.

## Deterministic scoring

`record_score` is the steward/oracle path. It requires the work-order policy
hash, the configured WASM hash (when configured), well-formed input/output
hashes, all revealed bids exactly once, ranks `1..n`, and deterministic order
(score desc, price asc, warranty desc, duration asc, bid ID asc). The contract
independently stores a canonical hash of the actual revealed bid set and
rejects the score at award time if that set ever changes, so an external
`input_hash` can use another documented canonicalization (for example
RULES.md's commitment-hash formula) without weakening stale-score protection.

`request_score` is the OutLayer path:

1. builds byte-stable canonical input from the revealed bids sorted by bid ID;
2. hashes the exact input bytes;
3. stores a pending execution key (duplicate requests fail);
4. calls `outlayer.testnet::request_execution` with a hash-pinned
   `version_key`, `response_format: "Json"`, attached deposit forwarded, and
   `.with_unused_gas_weight(1)`;
5. chains `.then(on_score_result(...))` with 25 Tgas reserved.

Canonical input shape:

```json
{
  "schema": "mend.bid-rules.v1",
  "work_order_id": "WO-BENCH-001-0001",
  "policy_hash": "<64 hex>",
  "policy": {
    "version": "mend-bid-policy-v1",
    "price_weight_bp": 4500,
    "warranty_weight_bp": 2500,
    "duration_weight_bp": 2000,
    "materials_weight_bp": 1000
  },
  "bids": [
    {
      "bid_id": "BID-B-BENCH-001",
      "contractor": "contractor-b.mend.testnet",
      "price_micro": "80000000",
      "duration_days": 10,
      "warranty_days": 180,
      "materials_score": 80,
      "eligible": true,
      "commitment_hash": "<64 hex>"
    }
  ],
  "tie_break": "score_desc_price_asc_warranty_desc_duration_asc_bid_id_asc"
}
```

The `get_score_input(work_order_id)` view returns the exact string and hash.

`on_score_result(work_order_id, expected_input_hash, expected_policy_hash)` is
`#[private]`. It reads `promise_result(0)` only — there is no caller-supplied
output. It verifies the schema, that every revealed bid appears exactly once,
that the winner is revealed/eligible and has the maximum score (including the
deterministic tie-break), then stores the execution. A failed promise, `null`,
malformed JSON or an invalid winner clears the pending request and scores
nothing. Duplicate callbacks after `SCORED` are ignored. OutLayer is never
faked: scoring stays disabled until the owner/DAO calls
`set_outlayer_config(outlayer_account, project_id, wasm_hash, enabled)`.

The direct `record_score` proof binds the policy hash, WASM hash, canonical
input hash and output hash. `award` re-checks that the stored input hash still
matches the revealed bid set and only accepts ranking rank 1.

## Passport

`mint_passport(asset_id)` mints a NEP-171 token with `token_id = asset_id` and
holder = the hub account. It is a maintenance record, **not** a title deed.
`nft_transfer`, `nft_transfer_call`, `nft_approve`, `nft_revoke` and
`nft_revoke_all` always panic with `TRANSFER_DISABLED`. There is no burn, no
admin transfer and no approval extension. `nft_token`, `nft_metadata`,
`nft_total_supply`, `nft_supply_for_owner` and `nft_tokens_for_owner` are
available for standard indexers.

## Public state privacy

Contract state stores only IDs and lowercase sha256 hashes. URL-like or
non-hash evidence/location inputs are rejected with `EVIDENCE_PRIVATE_URL` or
`VALIDATION_ERROR`. Raw media, precise coordinates and evidence URLs never
enter public state. The `docs/` privacy model describes the off-chain store.

## Events

Every state change emits a NEP-297-style log:

```text
EVENT_JSON:{"standard":"mend","version":"1.0.0","event":"<name>","data":{...}}
```

Event names follow `packages/protocol/src/events.ts`. `data` contains
`work_order_id`, `asset_id`, `actor`, `timestamp_ns` and the
transaction-relevant fields. Amounts are decimal strings. No private media or
URL is included.

## Test token

`test-token` is a standard NEP-141 implementation with NEP-148 metadata and
NEP-145 storage management:

```text
name:     MEND Test USDC (test value only)
symbol:   mUSDC
decimals: 6
```

`new(owner_id, total_supply)` registers the owner and mints the genesis supply
to it. `mint(account_id, amount)` is owner-only and exists only for testnet
fixtures. `ft_transfer_call` and the standard resolver are implemented so the
hub funding flow can be exercised end-to-end on testnet.

## Unit test coverage

`cargo test` covers, among others:

- exact 100 → 80 → 20 refund → 72 paid → 8 held → 8 released accounting;
- failed durability, same-work-order remediation, no new escrow, single
  holdback release;
- NEP-171 mint/metadata/enumeration, owner = hub, every transfer and approval
  rejection, duplicate mint;
- exact/under/over/duplicate/wrong-token/wrong-sponsor/malformed-msg/paused
  funding;
- commit/reveal roster, deadline, duplicate, non-roster, hash-mismatch and
  early/late cases, and hidden reveals;
- wrong policy, stale canonical input, incomplete/duplicate/out-of-order
  ranking, second score, rank-1-only award, wrong-role award;
- AI role rejection for award/accept/refund;
- self-inspection, non-rostered inspector, premature acceptance, evidence
  replay, non-awarded contractor actions;
- durability early inspection, double release, warranty reopening;
- dispute freeze, DAO-only resolution, no double refund, cancel/refund;
- pause/unpause exact-state restoration;
- OutLayer disabled/deposit/duplicate request and private callback success,
  duplicate callback, stale hash, failed promise, invalid JSON and ineligible
  winner;
- public-state URL/privacy rejection and `EVENT_JSON` shape.

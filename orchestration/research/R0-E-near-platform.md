# R0-E — NEAR Platform Mechanics for MEND

**STATUS: COMPLETE (research only)**
**Access date: 2026-11-09**
**Owner: Wave 0 visible research agent**
**Repo mode: READ-ONLY.** This is the only file created/overwritten. No code, account, deployment, key, or transaction was changed or executed.

**Verification method:** exact crate source and docs.rs for `near-sdk 5.30.1`, `near-contract-standards 5.30.1`, `near-primitives 0.38.0`; NEAR Nomicon; NEP-171, NEP-141, NEP-366; nearcore `master` runtime source; `near-cli-rs` `main` source/guide; `near-api-js 7.4.0` npm package. Claims are tagged **[VERIFIED]** or **[UNVERIFIED]**. No sandbox/testnet execution was performed, so runtime behaviour is source-verified, not empirically measured.

---

## 0. Executive decisions (short)

| Area | MEND decision | Invariant enforced |
|---|---|---|
| Passport | Implement NEP-171 core interface, but `nft_transfer` and `nft_transfer_call` **always panic** with `E_PASSPORT_NON_TRANSFERABLE`. No approval extension, no burn, no admin transfer, no resolver. Passport holder is the hub/registry account, never a user. | “Passport transfer always fails.” |
| Escrow | Hub implements only `FungibleTokenReceiver::ft_on_transfer`; never `FungibleTokenResolver`. Strict `msg` schema, accepted-token allowlist, sponsor-only, exact expected amount, underfund = full refund, overfund = refund excess, duplicate/cancelled = full refund. Internal ledger, not token balance, is authoritative. | “Total payouts + remaining escrow + refunds = total funding.” |
| Agent keys | Separate sub-accounts, function-call keys with explicit `receiver_id`, explicit non-empty `method_names`, capped `allowance`, no online full-access key. Contract still enforces roles/caps/recipient allowlists. | Separation of duties; “AI accounts cannot release funds”; “contractor cannot inspect own work.” |
| Gasless | NEP-366 `Delegate` (not `DelegateV2`), zero-deposit single `FunctionCall`, user key must be function-call-scoped to the hub. Relayer gates sender, receiver, method, args, gas, TTL, quota, and replay cache. Contract authorises by `predecessor_account_id`, never `signer_account_id`. | “Relayer cannot call arbitrary contracts”; replay protection. |
| Gasless funding | **Not possible with a function-call key.** `ft_transfer_call` requires exactly 1 yoctoNEAR and function-call keys reject any deposit (`DepositWithFunctionCall`). Escrow funding therefore uses a funded user wallet/full-access wallet, a sponsor account, or Intents/1Click — not the zero-deposit gasless path. | Honest scope of “gasless”; no hidden key escalation. |

---

## 1. NEP-171 — non-transferable passport

### 1.1 Standard facts (near-contract-standards 5.30.1)

**[VERIFIED]** `near_contract_standards::non_fungible_token::NonFungibleToken` is a **struct**, not a trait, in 5.30.1. The core trait is:

```rust
pub trait NonFungibleTokenCore {
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    );

    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool>;

    fn nft_token(&self, token_id: TokenId) -> Option<Token>;
}
```

Exact path: `near_contract_standards::non_fungible_token::core::NonFungibleTokenCore`.

Other exact traits:

- `near_contract_standards::non_fungible_token::core::NonFungibleTokenReceiver`
  - `fn nft_on_transfer(&mut self, sender_id: AccountId, previous_owner_id: AccountId, token_id: TokenId, msg: String) -> PromiseOrValue<bool>;`
- `near_contract_standards::non_fungible_token::core::NonFungibleTokenResolver`
  - `fn nft_resolve_transfer(&mut self, previous_owner_id: AccountId, receiver_id: AccountId, token_id: TokenId, approved_account_ids: Option<HashMap<AccountId, u64>>) -> bool;`
- `near_contract_standards::non_fungible_token::metadata::NonFungibleTokenMetadataProvider`
  - `fn nft_metadata(&self) -> NFTContractMetadata;`
- `near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration`
- `near_contract_standards::non_fungible_token::approval::NonFungibleTokenApproval`

**[VERIFIED]** `NonFungibleToken` fields and constructor:

```rust
pub struct NonFungibleToken {
    pub owner_id: AccountId,
    pub extra_storage_in_bytes_per_token: StorageUsage,
    pub owner_by_id: TreeMap<TokenId, AccountId>,
    pub token_metadata_by_id: Option<LookupMap<TokenId, TokenMetadata>>,
    pub tokens_per_owner: Option<LookupMap<AccountId, UnorderedSet<TokenId>>>,
    pub approvals_by_id: Option<LookupMap<TokenId, HashMap<AccountId, u64>>>,
    pub next_approval_id_by_id: Option<LookupMap<TokenId, u64>>,
}

pub fn new<Q, R, S, T>(
    owner_by_id_prefix: Q,
    owner_id: AccountId,
    token_metadata_prefix: Option<R>,
    enumeration_prefix: Option<S>,
    approval_prefix: Option<T>,
) -> Self
```

**[VERIFIED]** `Token`:

```rust
pub struct Token {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub metadata: Option<TokenMetadata>,
    pub approved_account_ids: Option<HashMap<AccountId, u64>>,
}
```

**[VERIFIED]** `nft_transfer` in the stock implementation calls `assert_one_yocto()`, then `internal_transfer`. `internal_transfer` checks the owner, clears approvals, requires owner ≠ receiver, updates `owner_by_id`, updates `tokens_per_owner` if enumeration is enabled, and emits `NftTransfer`.

**[VERIFIED]** `nft_transfer_call` in the stock implementation transfers first, then calls `nft_on_transfer` on the receiver with all unused gas (`with_unused_gas_weight(1)`), then calls `nft_resolve_transfer` on itself with 5 TGas. If `nft_on_transfer` returns `true`, fails, or returns invalid JSON, the resolver reverts the token to the previous owner (subject to the receiver still owning it).

### 1.2 Is there a standard `non_transferable` flag?

**No. [VERIFIED]**

- NEP-171 version 1.2.0 defines `nft_transfer` and `nft_transfer_call` as normal transfer methods. It has no `non_transferable`, `transferable`, `soulbound`, or equivalent field.
- `near-contract-standards 5.30.1` source contains no `non_transferable`, `transferable`, or `soulbound` symbol. A recursive grep of both `near-sdk-5.30.1/src` and `near-contract-standards-5.30.1/src` returned nothing.
- There is community discussion of a “Non-Transferable NFT Standard” on the NEAR governance forum, but it is not part of NEP-171 or the SDK. **[UNVERIFIED as a standard]** Do not depend on it.

**Conclusion:** non-transferability is a **custom contract policy**, not a standard flag. It must be enforced in code, not metadata.

### 1.3 Recommended MEND implementation

Use the standard struct for storage and views, but override the core transfer methods at the contract boundary.

1. Keep `NonFungibleToken` with:
   - `token_metadata_prefix = Some(...)` (metadata enabled),
   - `enumeration_prefix = Some(...)` (enumeration enabled),
   - `approval_prefix = None` (**no approvals**).
2. Implement `NonFungibleTokenCore` on the contract:
   - `nft_transfer` → `env::panic_str("E_PASSPORT_NON_TRANSFERABLE")`,
   - `nft_transfer_call` → `env::panic_str("E_PASSPORT_NON_TRANSFERABLE")`,
   - `nft_token` → delegate to `self.tokens.nft_token(token_id)`.
3. Do **not** implement `NonFungibleTokenApproval` (`nft_approve`, `nft_revoke`, `nft_revoke_all`, `nft_is_approved`). No approved account can exist.
4. Do **not** implement `NonFungibleTokenResolver`; there is no transfer-call path to resolve.
5. Do **not** add `nft_burn`, admin transfer, migration transfer, or any other method that writes `owner_by_id`.
6. Mint only through an admin/registry method. `internal_mint` rejects duplicate `token_id`; it also emits `NftMint`. If the hub pays storage, use `internal_mint_with_refund(..., None)` and emit the mint event manually; otherwise `internal_mint` refunds excess storage deposit to the caller.
7. Mark both transfer methods `#[payable]` so a caller attaching 1 yocto still reaches the explicit MEND error. Without `#[payable]`, the SDK rejects the deposit before the body with a generic “method doesn’t accept deposit” error. Either way the transfer fails; `#[payable]` gives a stable, documented error.
8. Panic is the correct failure mode: `nft_transfer` returns `()`, so there is no error return value. A panic reverts all state and the runtime returns the attached deposit on the failed receipt. Returning normally would falsely signal success to indexers.

**Important:** `NonFungibleToken::internal_transfer` is public. Never expose a wrapper that calls it. If a future upgrade adds one, the invariant breaks.

### 1.4 Minimal code sketch (MEND-defined names marked)

```rust
use near_sdk::{near, env, AccountId, PanicOnDefault, PromiseOrValue};
use near_contract_standards::non_fungible_token::{
    NonFungibleToken, Token, TokenId,
};
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    // MEND-defined state omitted
}

#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(
        &mut self,
        _receiver_id: AccountId,
        _token_id: TokenId,
        _approval_id: Option<u64>,
        _memo: Option<String>,
    ) {
        env::panic_str("E_PASSPORT_NON_TRANSFERABLE");
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        _receiver_id: AccountId,
        _token_id: TokenId,
        _approval_id: Option<u64>,
        _memo: Option<String>,
        _msg: String,
    ) -> PromiseOrValue<bool> {
        env::panic_str("E_PASSPORT_NON_TRANSFERABLE");
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}
```

MEND-defined error code: `E_PASSPORT_NON_TRANSFERABLE`. MEND-defined `passport_policy()` view should return `{ transferable: false, legal_ownership: false, holder_role: "registry" }`; this is advisory, not enforcement.

### 1.5 Metadata extension

**[VERIFIED]** Contract-level metadata:

```rust
pub struct NFTContractMetadata {
    pub spec: String,              // must equal NFT_METADATA_SPEC
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}
pub const NFT_METADATA_SPEC: &str = "nft-1.0.0";
```

`NFTContractMetadata::assert_valid()` requires `spec == "nft-1.0.0"`, `reference` and `reference_hash` both present or both absent, and a 32-byte `reference_hash`.

**[VERIFIED]** Token-level metadata:

```rust
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<Base64VecU8>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}
```

`TokenMetadata::assert_valid()` requires `media` and `media_hash` both present or both absent, `reference` and `reference_hash` both present or both absent, and 32-byte hashes.

**MEND metadata policy:**
- `TokenMetadata.title` = human-readable asset label.
- `TokenMetadata.description` = “MEND maintenance passport; not a title deed or legal ownership record.”
- `TokenMetadata.extra` = **small JSON string** with `{"schema":"mend.passport.v1","transferable":false,"legal_ownership":false,"asset_id":"..."}`. This is advisory and must never be the only enforcement.
- `TokenMetadata.media` / `reference` must not contain private evidence or raw media. Use only public, redacted, content-addressed URLs or omit them. The privacy invariant remains enforced by contract schema: store hashes (`[u8;32]` / `Base64VecU8`) for evidence, not URLs.
- `copies: Some(1)` for a unique passport is reasonable but is not what makes it non-transferable.

**Metadata updates:** NEP-171 1.2.0 defines `nft_metadata_update` events, but `near-contract-standards 5.30.1` only provides `NftMint`, `NftTransfer`, `NftBurn` event helpers. **[VERIFIED]** Do not rely on a library helper for metadata-update events. Prefer immutable token metadata plus a separate MEND `Passport`/history view keyed by `asset_id`.

### 1.6 Enumeration extension

**[VERIFIED]** Exact trait:

```rust
pub trait NonFungibleTokenEnumeration {
    fn nft_total_supply(&self) -> U128;
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token>;
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128;
    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token>;
}
```

**[VERIFIED]** Behaviour in 5.30.1:

- Requires `tokens_per_owner: Some(...)`; otherwise `nft_supply_for_owner` / `nft_tokens_for_owner` panic with “Could not find tokens_per_owner…”.
- `nft_total_supply` returns `owner_by_id.len()`.
- `nft_tokens(from_index, limit)` uses `TreeMap` order; panics if `from_index > total_supply`; panics if `limit == 0`; returns empty when `from_index == total_supply`.
- `nft_supply_for_owner` returns `0` for an unknown owner.
- `nft_tokens_for_owner` panics if `from_index >= token_set.len()` (note: **strictly greater-or-equal**, unlike `nft_tokens`); panics if `limit == 0`; returns empty for an owner with no tokens.
- If approvals are not configured, `Token.approved_account_ids` is `None`.

**MEND decision:** set `token_id = asset_id` (stable string) so `nft_token(asset_id)` is the primary passport lookup. Enumeration is secondary: because every passport is held by the hub/registry, `nft_tokens_for_owner(hub)` lists the registry and `nft_supply_for_owner(hub)` equals total supply. Do not use enumeration as a per-user ownership list.

### 1.7 Approval extension — deliberately disabled

**[VERIFIED]** Exact trait methods if it were enabled:

```rust
pub trait NonFungibleTokenApproval {
    fn nft_approve(&mut self, token_id: TokenId, account_id: AccountId, msg: Option<String>) -> Option<Promise>;
    fn nft_revoke(&mut self, token_id: TokenId, account_id: AccountId);
    fn nft_revoke_all(&mut self, token_id: TokenId);
    fn nft_is_approved(&self, token_id: TokenId, approved_account_id: AccountId, approval_id: Option<u64>) -> bool;
}
```

**MEND decision:** do not implement any of these. A marketplace cannot obtain transfer rights. If a caller invokes them, the method is absent (`MethodNotFound`) rather than silently succeeding.

### 1.8 Passport failure rules and tests

| Attempt | Result | State | Event |
|---|---|---|---|
| `nft_transfer` with 0 yocto | panic `E_PASSPORT_NON_TRANSFERABLE` (or SDK deposit error if not payable) | unchanged | none |
| `nft_transfer` with 1 yocto | panic `E_PASSPORT_NON_TRANSFERABLE`; deposit returned on failed receipt | unchanged | none |
| `nft_transfer_call` with any deposit | panic; no receiver call; no resolver | unchanged | none |
| `nft_approve` / `nft_revoke*` | method absent | unchanged | none |
| meta-tx `nft_transfer` via function-call key | panic inside contract | unchanged | none |
| direct storage write / migration | not exposed | — | — |
| mint duplicate `token_id` | panic “token_id must be unique” | unchanged | none |

**Required tests (T01.2):**
1. Mint passport, read `nft_token`, `nft_metadata`, enumeration.
2. Direct `nft_transfer` with 0 and 1 yocto → failure; owner unchanged; no `NftTransfer` log.
3. `nft_transfer_call` → failure; no cross-contract call; no `nft_resolve_transfer`.
4. `nft_approve` / `nft_is_approved` → method not found.
5. Meta-tx delegate calling `nft_transfer` → failure (if meta-tx path is enabled).
6. Duplicate mint → failure.
7. Enumerable pagination boundaries (`from_index == len`, `limit == 0`).
8. Metadata `extra` is advisory only; no transfer logic reads it.

---

## 2. NEP-141 — receiver flow and escrow

### 2.1 Exact types (near-contract-standards 5.30.1)

**[VERIFIED]** `near_contract_standards::fungible_token::core::FungibleTokenCore`:

```rust
pub trait FungibleTokenCore {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128>;
    fn ft_total_supply(&self) -> U128;
    fn ft_balance_of(&self, account_id: AccountId) -> U128;
}
```

**[VERIFIED]** `near_contract_standards::fungible_token::receiver::FungibleTokenReceiver`:

```rust
pub trait FungibleTokenReceiver {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128>;
}
```

**[VERIFIED]** `near_contract_standards::fungible_token::resolver::FungibleTokenResolver`:

```rust
pub trait FungibleTokenResolver {
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128;
}
```

**[VERIFIED]** `FungibleToken` implementation:

```rust
pub struct FungibleToken {
    pub accounts: LookupMap<AccountId, Balance>,
    pub total_supply: Balance,
    pub account_storage_usage: StorageUsage,
}
pub type Balance = u128;
```

**[VERIFIED]** Metadata:

```rust
pub struct FungibleTokenMetadata {
    pub spec: String,              // must equal FT_METADATA_SPEC
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
    pub decimals: u8,
}
pub const FT_METADATA_SPEC: &str = "ft-1.0.0";
```

**[VERIFIED]** Storage types:

```rust
pub struct StorageBalance {
    pub total: NearToken,
    pub available: NearToken,
}
pub struct StorageBalanceBounds {
    pub min: NearToken,
    pub max: Option<NearToken>,
}
```

Exact trait: `near_contract_standards::storage_management::StorageManagement` with `storage_deposit`, `storage_withdraw`, `storage_unregister`, `storage_balance_bounds`, `storage_balance_of`.

**[VERIFIED]** Event helpers: `near_contract_standards::fungible_token::events::{FtMint, FtTransfer, FtBurn}`. Refund transfer uses `FtTransfer { old_owner_id: receiver, new_owner_id: sender, amount, memo: Some("refund") }`.

### 2.2 Exact `ft_transfer_call` flow

1. Caller invokes `ft_transfer_call(receiver_id = hub, amount, memo, msg)` on the token contract.
2. Token contract calls `assert_one_yocto()` — **exactly 1 yoctoNEAR**, not “at least 1”. **[VERIFIED]**
3. Token contract calls `internal_transfer(sender, hub, amount, memo)`:
   - `require!(sender != receiver)`;
   - `require!(amount > 0)`;
   - withdraw from sender; deposit to hub;
   - emit `FtTransfer`.
   Both sender and hub must be registered with the token contract; otherwise `internal_unwrap_balance_of` panics “The account … is not registered”. **[VERIFIED]**
4. Token contract calls `hub.ft_on_transfer(sender_id, amount, msg)` with `with_unused_gas_weight(1)` — all remaining unused gas is forwarded. **[VERIFIED]**
5. Hub returns `PromiseOrValue::Value(U128(unused))`:
   - `0` = hub used/kept all tokens;
   - `amount` = hub used none; full refund;
   - any value in between = partial use.
6. Token contract calls its own `ft_resolve_transfer(sender_id, hub, amount)` with a fixed `GAS_FOR_RESOLVE_TRANSFER = Gas::from_tgas(5)`. **[VERIFIED]**
7. Resolver:
   - reads promise result; if failed or unparseable → `unused = amount` (full refund);
   - clamps `unused = min(unused, amount)`;
   - if `unused > 0`, refunds `min(hub_balance, unused)` from hub to sender;
   - emits `FtTransfer` with memo `"refund"`;
   - returns the amount actually spent by sender.
8. Net: sender loses `used`; hub keeps `used`; excess is returned. **[VERIFIED]**

### 2.3 `ft_on_transfer` return values

| Return | Meaning | Resolver action |
|---|---|---|
| `U128(0)` | Hub keeps all `amount` | No refund |
| `U128(x)` where `0 < x < amount` | Hub keeps `amount - x` | Refund `x` |
| `U128(amount)` | Hub keeps nothing | Full refund |
| panic / failed promise | Receiver rejected or ran out of gas | Full refund (subject to hub balance) |
| malformed JSON / wrong type | Invalid receiver | Full refund (parse fallback) |
| `x > amount` | Invalid over-refund | Clamped to `amount` |

**MEND policy:** return `U128(0)` only after committing the exact accepted amount to the internal ledger. Return `U128(amount)` for every rejection. Never return a promise; keep the receiver synchronous so accounting is deterministic.

### 2.4 Refund-on-failure rules (exact)

**[VERIFIED from `core_impl.rs`]**

- If `ft_on_transfer` panics, the promise fails; resolver uses `unwrap_or(amount)` → full refund.
- If the result is not valid JSON `U128`, resolver uses `unwrap_or(amount)` → full refund.
- If receiver returns more than `amount`, resolver uses `.min(amount)` → at most full refund.
- If receiver’s token balance is lower than the requested refund (receiver spent tokens), resolver refunds `min(receiver_balance, unused)`. The sender loses the shortfall.
- If the sender account was deleted while the call was in flight, the token contract burns the refund amount and logs it; the sender does not receive it.
- If `ft_resolve_transfer` itself runs out of gas or fails, the refund is not executed; tokens remain with the receiver. This is a token-contract-side risk. Use a standard, audited token and test the gas budget.
- `ft_resolve_transfer` must be callable only by the token contract itself (`#[private]` in the token contract). The hub must **not** implement `FungibleTokenResolver`; the hub is only the receiver.

**MEND safety rule:** do not move, spend, or promise away escrow tokens inside `ft_on_transfer`. Only update the internal ledger. Payouts happen in separate transactions after the funding receipt is final. This keeps the resolver’s refund path solvent.

### 2.5 Gas requirements

- NEP-141 requires the token contract to forward all remaining unused gas to `ft_on_transfer`. **[VERIFIED]**
- `near-contract-standards 5.30.1` uses `.with_unused_gas_weight(1)` for `ft_on_transfer` and `.with_static_gas(Gas::from_tgas(5))` for the resolver. **[VERIFIED]**
- 5.30.1 does **not** define a `GAS_FOR_FT_TRANSFER_CALL` constant and does **not** enforce a minimum prepaid-gas check in `core_impl.rs`. **[VERIFIED by source grep]**
- The Nomicon gas page states the reference FT implementation’s `ft_transfer_call` requires at least **30 TGas** even though it usually burns less. **[VERIFIED]**
- MEND decision: attach **100 TGas** to `ft_transfer_call`; keep hub `ft_on_transfer` under ~30 TGas; integration-test at 30 TGas and 100 TGas. If the hub callback exceeds the available gas, the full amount is refunded and funding fails — safe but bad UX.

### 2.6 Overfund handling options

| Option | Behaviour | MEND verdict |
|---|---|---|
| A. Refund excess from `ft_on_transfer` | Accept `expected`, return `amount - expected` | **Chosen.** Atomic, standard, exact accounting. |
| B. Reject any non-exact amount | Return full `amount` if `amount != expected` | Safe, but forces sponsor retry. Use for underfund. |
| C. Credit excess to sponsor balance | Keep excess on ledger for future work orders | Rejected: refunds/closure/accounting complexity; violates simple invariant. |
| D. Treat excess as donation | Keep all | Rejected: breaks “funding = escrow + refunds” and hides overpayment. |

**MEND rule:**
- `amount < expected` → return full `amount`; no credit.
- `amount == expected` → accept; return `0`.
- `amount > expected` → accept `expected`; return `amount - expected`.
- Duplicate funding, cancelled/closed work order, wrong sponsor, wrong token, malformed `msg` → return full `amount`.

### 2.7 Hub receiver sketch (MEND-defined names)

```rust
use near_sdk::{near, env, AccountId, PromiseOrValue};
use near_sdk::json_types::U128;
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;

#[near]
impl FungibleTokenReceiver for Contract {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        // Only the configured settlement token may call this.
        if env::predecessor_account_id() != self.accepted_token {
            return PromiseOrValue::Value(amount);
        }
        // MEND-defined FundingMsg { work_order_id, expected_amount }
        let Ok(req) = near_sdk::serde_json::from_str::<FundingMsg>(&msg) else {
            return PromiseOrValue::Value(amount);
        };
        let Some(wo) = self.work_orders.get_mut(&req.work_order_id) else {
            return PromiseOrValue::Value(amount);
        };
        if wo.status != WorkOrderStatus::AwaitingFunding || sender_id != wo.sponsor {
            return PromiseOrValue::Value(amount);
        }
        let expected = req.expected_amount.0;
        if amount.0 < expected {
            return PromiseOrValue::Value(amount);
        }
        wo.funded = wo.funded
            .checked_add(expected)
            .unwrap_or_else(|| env::panic_str("E_OVERFLOW"));
        wo.status = WorkOrderStatus::Funded;
        self.escrow_total = self.escrow_total
            .checked_add(expected)
            .unwrap_or_else(|| env::panic_str("E_OVERFLOW"));
        // MEND-defined event omitted; no token movement here.
        PromiseOrValue::Value(U128(amount.0 - expected))
    }
}
```

Notes:
- Sketch only; the exact `LookupMap` API depends on whether MEND uses `near_sdk::store` or the legacy `near_sdk::collections`. Adapt `get_mut`/`insert` accordingly.
- `env::predecessor_account_id()` is the **token contract**, not the sponsor. `sender_id` is the sponsor. This is the exact NEP-141 receiver context. **[VERIFIED]**
- Do not mark this `#[private]`; the caller is the token contract, not the hub.
- Do not call `ft_transfer` or any token method from inside this function.
- `amount.0 - expected` is safe because `amount.0 >= expected`.

### 2.8 Exact accounting invariant

Authoritative ledger fields (MEND-defined):

```text
total_funded   = sum of accepted amounts
escrow_locked  = total_funded - paid_out - refunded
paid_out       = sum of contractor/inspector payouts
refunded       = sum of sponsor refunds
```

Invariant: `total_funded == paid_out + refunded + escrow_locked` at all times.

Enforcement:
- Only `ft_on_transfer` with a valid `FundingMsg`, accepted token, correct sponsor, correct state, and `amount >= expected` increments `total_funded`/`escrow_locked`.
- Payout/refund methods decrement `escrow_locked` and increment `paid_out`/`refunded` in the same state transition, using checked arithmetic.
- Never use `ft_balance_of(hub)` as the accounting source. Unsolicited direct `ft_transfer` donations can raise the token balance without a `FundingMsg`; they must not create spendable escrow.
- Expose a MEND-defined `get_reconciliation()` view returning ledger totals and `token_balance`; surplus is `token_balance - escrow_locked` and is explicitly “unaccounted/donation”, not auto-credited.
- A closed work order cannot be funded or paid again; state guard before any mutation.

### 2.9 Escrow failure rules and tests

| Case | Hub `ft_on_transfer` return | Net result |
|---|---|---|
| Correct token, correct sponsor, exact amount | `0` | funded = expected |
| Correct token, underfund | `amount` | full refund |
| Correct token, overfund | `amount - expected` | funded = expected; excess refunded |
| Wrong token contract | `amount` | full refund |
| Malformed `msg` | `amount` | full refund |
| Unknown work order | `amount` | full refund |
| Duplicate funding / already funded | `amount` | full refund |
| Cancelled / closed work order | `amount` | full refund |
| Wrong sponsor | `amount` | full refund |
| Hub callback panic / OOG | full refund by resolver | no credit; state rollback |
| Hub spends tokens in callback | resolver may refund less | **forbidden by design** |
| Resolver OOG | no refund; tokens stay with hub | **token risk; test** |

**Required tests (T01.4):**
1. Register hub with token via `storage_deposit`.
2. Exact funding; check `ft_balance_of(hub)`, ledger, event.
3. Underfund; check full refund and unchanged ledger.
4. Overfund; check accepted amount and excess refund.
5. Wrong token; check full refund.
6. Duplicate funding; check full refund.
7. Malformed `msg`; check full refund.
8. Wrong sponsor; check full refund.
9. Cancelled work order; check full refund.
10. Force `ft_on_transfer` panic; check resolver full refund and state rollback.
11. 30 TGas vs 100 TGas.
12. Unsolicited `ft_transfer` to hub; check it does not create escrow.
13. Reconciliation property test: `total_funded == paid_out + refunded + escrow_locked`.

---

## 3. Function-call access keys

### 3.1 Exact type and fields

**[VERIFIED]** Nomicon and `near-primitives 0.38.0`:

```rust
pub struct AccessKey {
    pub nonce: Nonce,
    pub permission: AccessKeyPermission,
}

pub enum AccessKeyPermission {
    FunctionCall(FunctionCallPermission),
    FullAccess,
    GasKeyFunctionCall(GasKeyInfo, FunctionCallPermission),
    GasKeyFullAccess(GasKeyInfo),
}

pub struct FunctionCallPermission {
    pub allowance: Option<NearToken>, // None = unlimited
    pub receiver_id: String,          // exact contract account
    pub method_names: Vec<String>,    // empty = any method
}
```

Notes:
- `NearToken` is the current type in `near-primitives 0.38.0`; JSON-RPC exposes `allowance` as a decimal yoctoNEAR string or `null`.
- `receiver_id` is a `String` in the Rust struct; Nomicon describes it as `AccountId`.
- `method_names` is exact, case-sensitive entrypoint names.
- `GasKeyFunctionCall` / `GasKeyFullAccess` exist from protocol version 85 (nearcore 2.13). `GasKeyFunctionCall` must have `allowance: None`; the gas-key balance is the budget.
- `nonce` is per access key and is used for replay protection.

### 3.2 How allowance is charged

**[VERIFIED]**

- A function-call key has an allowance in yoctoNEAR. `None` means unlimited.
- On a direct transaction signed with the key, the runtime computes `total_cost` (gas + transaction fees) and:
  - debits the account balance by `total_cost`;
  - debits the key allowance by the same `total_cost`;
  - rejects with `NotEnoughAllowance` if the allowance is insufficient.
- The allowance pays **gas and transaction fees only**. It does not pay attached deposits.
- Function-call keys cannot attach a deposit at all: a transaction signed with `FunctionCall` permission must have exactly one action, that action must be `FunctionCall`, and `deposit` must be zero. Otherwise the runtime rejects with `RequiresFullAccess` or `DepositWithFunctionCall`. **[VERIFIED from nearcore `verifier.rs`]**
- The allowance cannot be increased without deleting and recreating the key. **[VERIFIED Nomicon]**
- If the allowance is exhausted, the key cannot sign more direct transactions until recreated.

### 3.3 What can still be called

With `AccessKeyPermission::FunctionCall`:

**Allowed**
- Exactly one `FunctionCall` action.
- `receiver_id` must equal the key’s `receiver_id`.
- `method_name` must be in `method_names`; if `method_names` is empty, **any method** on that contract is allowed.
- Deposit must be `0`.
- The call can be state-changing or a view call.
- The key can sign a NEP-366 `DelegateAction` if the delegate contains exactly one `FunctionCall` with zero deposit and matching receiver/method. Allowance is **not** checked for the delegate path.

**Forbidden**
- `Transfer`, `Stake`, `AddKey`, `DeleteKey`, `DeleteAccount`, `DeployContract`, `DeployGlobalContract`, `UseGlobalContract`, `DeterministicStateInit`, `UniversalStateInit`, `TransferToGasKey`, `WithdrawFromGasKey`.
- Multiple actions in one transaction.
- Any function call with `deposit > 0`.
- Any call to a different contract.
- Nested or multiple delegate actions.

**Consequence for MEND:** a function-call key cannot call deposit-requiring methods such as `ft_transfer`, `ft_transfer_call`, or `storage_deposit` (all require a deposit), nor a standard NFT's `nft_transfer` (1 yocto). MEND's passport `nft_transfer` fails regardless. It cannot fund escrow. It can call zero-deposit MEND methods such as `create_work_order`, `submit_bid`, `reveal_bid`, `submit_evidence`, and `submit_inspection` if those methods do not require a deposit.

### 3.4 Why it is not a full security boundary

1. **The contract sees only the account, not the key.** `env::predecessor_account_id()` is the account ID. All function-call keys of that account are indistinguishable to the contract. A contract role granted to the account is exercisable by any key of that account.
2. **Method scope is not argument scope.** A permitted method can accept arbitrary `receiver_id`, `amount`, `work_order_id`, or evidence payload. If the method trusts its arguments, the key can abuse them.
3. **Empty list = all methods.** `method_names: []` allows any method on the receiver. Never use an empty list for an agent key.
4. **`allowance: None` = unlimited.** Always cap it.
5. **Allowance limits fees, not state.** It does not limit token balances, contract-held funds, storage, or business authority. A permitted method can still move contract-held tokens or change critical state.
6. **Meta-transactions bypass the allowance check.** A function-call key can sign a delegate whose gas is paid by the relayer; the receiver/method checks still apply, but the allowance does not. So a key with a tiny allowance is not economically bounded on the meta-tx path.
7. **Bearer credential.** A leaked key can act as the account within scope until the key is deleted. Rotation is manual (`delete-keys` + `add-key`), and reusing the same public key has nonce-replay caveats.
8. **The account may still have a full-access key.** Provisioning a sub-account normally creates a full-access key. If that key remains online/plaintext, the function-call restriction is irrelevant. MEND must delete or offline it.

**Therefore:** use function-call keys as a coarse blast-radius reducer, not as the authorization system. The contract must enforce:
- role registry per account;
- method-level role checks;
- separation of duties (contractor ≠ inspector; AI ≠ payout);
- recipient allowlists;
- per-work-order and daily amount caps;
- pause / kill switch;
- idempotency and state-machine guards.

### 3.5 MEND key matrix (proposed)

| Account | Key permission | `receiver_id` | `method_names` (explicit, non-empty) | Allowance | Must NOT be able to call |
|---|---|---|---|---|---|
| Coordinator agent | FunctionCall | `hub.mend.testnet` | `create_work_order`, `propose_scope`, `attach_dao_ref` | e.g. 0.25 NEAR | `award`, `release`, `accept`, `set_recipient` |
| Contractor 1–3 | FunctionCall | `hub.mend.testnet` | `submit_bid`, `reveal_bid`, `submit_evidence` | e.g. 0.25 NEAR each | `award`, `accept`, `release`, `set_recipient`, `inspect` |
| Inspector assistant | FunctionCall | `hub.mend.testnet` | `submit_inspection_suggestion`, `submit_evidence_review` | e.g. 0.25 NEAR | `submit_bid`, `award`, `release`, final `accept_completion` |
| Human inspector | Wallet / multisig | — | — | — | — |
| Relayer | FullAccess or GasKeyFullAccess on relayer account | — | — | minimal hot balance | Must not hold user funds; app-layer gate only |
| DAO / admin | Cold full-access or multisig | — | — | — | Not used by agents |

MEND-defined method names above are illustrative; freeze them in `packages/protocol` before provisioning. The table’s security property is the **explicit non-empty list** and the contract-side role check, not the names themselves.

### 3.6 `near-cli-rs` commands (documentation only; **not executed**)

Add a function-call key:

```bash
near account add-key contractor-1.mend.testnet \
  grant-function-call-access \
  --allowance '0.25 NEAR' \
  --contract-account-id hub.mend.testnet \
  --function-names 'submit_bid,reveal_bid,submit_evidence' \
  use-manually-provided-public-key ed25519:REPLACE_ME \
  network-config testnet \
  sign-with-keychain \
  send
```

Add a key generated by the CLI and saved to the keychain:

```bash
near account add-key coordinator.mend.testnet \
  grant-function-call-access \
  --allowance '0.25 NEAR' \
  --contract-account-id hub.mend.testnet \
  --function-names 'create_work_order,propose_scope,attach_dao_ref' \
  autogenerate-new-keypair \
  save-to-keychain \
  network-config testnet \
  sign-with-keychain \
  send
```

Inspect keys:

```bash
near account list-keys contractor-1.mend.testnet network-config testnet now
```

Delete a key:

```bash
near account delete-keys contractor-1.mend.testnet \
  public-keys ed25519:REPLACE_ME \
  network-config testnet \
  sign-with-keychain \
  send
```

Optional gas-key variant for the relayer (protocol 85+):

```bash
near account add-key relayer.mend.testnet \
  grant-gas-key-full-access \
  --num-nonces 4 \
  use-manually-provided-public-key ed25519:REPLACE_ME \
  network-config testnet \
  sign-with-keychain \
  send
```

Direct `ft_transfer_call` (requires a funded account and exactly 1 yocto; **not gasless**):

```bash
near contract call-function as-transaction usdc.testnet ft_transfer_call \
  json-args '{"receiver_id":"hub.mend.testnet","amount":"1000000","msg":"{\"work_order_id\":\"wo_1\",\"expected_amount\":\"1000000\"}"}' \
  prepaid-gas '100 TeraGas' \
  attached-deposit '1 yoctoNEAR' \
  sign-as sponsor.mend.testnet \
  network-config testnet \
  sign-with-keychain \
  send
```

Read-only reconciliation:

```bash
near contract call-function as-read-only hub.mend.testnet get_reconciliation \
  json-args '{"work_order_id":"wo_1"}' \
  network-config testnet \
  now
```

**Do not run any of these in this research task.** They are for T05.5/T01.4 execution with human approval.

---

## 4. Meta-transactions / gasless (NEP-366)

### 4.1 Exact NEP-366 types

**[VERIFIED]** `near-primitives 0.38.0`:

```rust
// near_primitives::action::delegate::DelegateAction
pub struct DelegateAction {
    pub sender_id: AccountId,
    pub receiver_id: AccountId,
    pub actions: Vec<NonDelegateAction>,
    pub nonce: Nonce,
    pub max_block_height: BlockHeight,
    pub public_key: PublicKey,
}

// near_primitives::action::delegate::SignedDelegateAction
pub struct SignedDelegateAction {
    pub delegate_action: DelegateAction,
    pub signature: Signature,
}

// near_primitives::action::Action
Action::Delegate(Box<SignedDelegateAction>)
```

**[VERIFIED]** `NonDelegateAction` exists specifically to prevent nested delegates. `DelegateAction.actions` is `Vec<NonDelegateAction>` in current `near-primitives`; older NEP text says `Vec<Action>`, but the current type is `NonDelegateAction`.

**[VERIFIED]** `near-sdk 5.30.1` does **not** expose `DelegateAction`, `SignedDelegateAction`, `NonDelegateAction`, or `AccessKeyPermission`. A recursive grep of `near-sdk-5.30.1/src` found none. Contracts do not need these types; they see only the resulting `FunctionCall`. Off-chain relayers use `near-primitives`, `near-api` (Rust), or `near-api-js` (TypeScript).

**[VERIFIED]** NEP-366 status: Final, version 1.1.0, last updated 2023-08-03. It is an MVP with limitations.

### 4.2 Relayer flow

1. User builds `DelegateAction`:
   - `sender_id` = user account;
   - `receiver_id` = target contract (MEND hub);
   - `actions` = exactly one `FunctionCall` for MEND gasless actions;
   - `nonce` = a value greater than the current access-key nonce;
   - `max_block_height` = absolute expiry block height;
   - `public_key` = the user’s access key.
2. User signs `hash(delegate_action)` (NEP-461/NEP-483 signature scheme) and forms `SignedDelegateAction`.
3. User serialises (Borsh) and sends `SignedDelegateAction` to the relayer off-chain.
4. Relayer verifies:
   - signature and `sender_id`/`receiver_id`;
   - `max_block_height` not expired;
   - nonce greater than current key nonce;
   - action shape, method, gas, zero deposit, allowlists, quota;
   - no `Delegate`, `AddKey`, `DeleteKey`, `Transfer`, `Stake`, `DeleteAccount`, etc.
5. Relayer builds a normal transaction:
   - `signer_id` = relayer account;
   - `receiver_id` = `delegate_action.sender_id` (required);
   - `actions` = `[Action::Delegate(Box::new(signed_delegate_action))]`;
   - `nonce` = relayer key nonce;
   - signs with a relayer full-access key (or full-access gas key).
6. Runtime verifies the delegate, advances the user’s access-key nonce, and creates a receipt from the user to `receiver_id` with the inner actions. The inner receipt has:
   - `predecessor_id` = user (`sender_id`);
   - `signer_id` = relayer;
   - `signer_public_key` = relayer’s key.
7. The target contract executes the inner `FunctionCall`. It must identify the user by `predecessor_account_id`, **not** `signer_account_id`. **[VERIFIED docs.near.org]**
8. Gas refunds go to the relayer (outer signer). Attached-deposit refunds go to the delegate sender on failure, per NEP-366 and nearcore comments. The exact payer of attached deposits is disputed by docs (see §4.5); MEND avoids deposits in meta-tx.
9. Meta-transactions take an extra block and are not atomic across multiple receivers. **[VERIFIED]**

### 4.3 Replay protection (protocol + MEND)

**Protocol [VERIFIED from nearcore `actions.rs`]:**
- `DelegateAction.nonce` must be strictly greater than the current access-key nonce; otherwise `DelegateActionInvalidNonce`.
- On success, the access-key nonce is set to the delegate nonce (`access_key.nonce = delegate_nonce.nonce()`).
- `nonce` must be less than `block_height * AccessKey::ACCESS_KEY_NONCE_RANGE_MULTIPLIER`; otherwise `DelegateActionNonceTooLarge`.
- `apply_state.block_height > delegate_action.max_block_height` → `DelegateActionExpired`.
- `delegate_action.sender_id` must equal the outer transaction’s `receiver_id`; otherwise `DelegateActionSenderDoesNotMatchTxReceiver`.
- The `public_key` must exist on the sender account and the signature must verify.
- Only one `DelegateAction` per transaction; nested delegates are rejected.
- The **delegate** must be signed by a non-gas access key for `Delegate`; a gas key cannot sign the delegate (`DelegateActionRequiresNonGasKey`). The relayer may still sign the outer transaction with a full-access gas key. `DelegateV2` was the gas-key delegate variant; from protocol 87 new `DelegateV2` actions are rejected with `RemovedProtocolFeature`. **Use `Delegate` only.** **[VERIFIED Nomicon/docs]**

**MEND additions (required because protocol replay protection is per delegate, not per business action):**
- Client serialises delegates per access key; use `nonce = current + 1`; never sign two concurrent delegates with the same nonce.
- Short `max_block_height` TTL (e.g. 120 blocks ≈ 2 minutes); relayer rejects expired and far-future values.
- Relayer caches `hash(SignedDelegateAction)` and rejects duplicates (defence in depth; protocol nonce is authoritative).
- Contract enforces business idempotency:
  - `create_work_order` has a unique client reference;
  - `submit_bid` is unique per `(work_order_id, contractor_id)`;
  - `fund_work_order` only from `AwaitingFunding`;
  - `accept_completion` only from `Submitted`;
  - `release` only once; closed work order cannot be paid again;
  - warranty reopening cannot mint new escrow.
- Relayer quotas: per sender, per IP/session, per method, per day; rate limit; max gas; max actions = 1.

### 4.4 Function-call key behaviour in meta-transactions

**[VERIFIED from nearcore `actions.rs` + Nomicon]:**
- If the delegate is signed by a `FunctionCall` key:
  - `actions.len()` must be exactly 1;
  - the action must be `FunctionCall`;
  - `deposit` must be `0`;
  - `delegate_action.receiver_id` must equal the key’s `receiver_id`;
  - `method_name` must be in `method_names` (empty list = any);
  - the key allowance is **not checked** because the relayer pays.
- If the delegate is signed by a full-access key, any action is allowed (subject to normal runtime rules).
- If the delegate is signed by a gas key with a plain nonce, it fails (`DelegateActionRequiresNonGasKey`); `DelegateV2` is removed.

**MEND consequence:** require gasless users to sign with a function-call key scoped to `hub.mend.testnet` and the exact MEND method. Then even a malicious relayer cannot redirect the call to another contract or method: the protocol rejects it. The relayer’s allowlist is still needed to decide what it will sponsor, but the user’s key is the hard boundary.

### 4.5 The gasless funding limitation (important)

`ft_transfer_call` requires exactly **1 yoctoNEAR** attached (`assert_one_yocto`). A function-call access key rejects **any** `FunctionCall` with `deposit > 0` (`DepositWithFunctionCall`). A NEP-366 delegate signed by a function-call key also rejects `deposit > 0`. **[VERIFIED from `near-contract-standards` and nearcore]**

Therefore:

- **Gasless zero-deposit MEND actions** (create work order, bid, reveal, evidence, inspection suggestion) work with NEP-366 + function-call key + relayer.
- **Gasless escrow funding via `ft_transfer_call` does not work** with a function-call key. The user needs a full-access key (wallet/MPC) or a funded account, or funding must come from a sponsor/relayer/Intents flow.
- A relayer cannot “add” the 1 yocto to the inner action because the user’s signature covers `deposit = 0`; changing it invalidates the delegate.
- A function-call key also cannot call `ft_transfer` or `storage_deposit` for the same reason.

**MEND decision:** define “gasless” precisely as **gasless zero-deposit hub actions**. For escrow funding, use one of:
1. Sponsor/user wallet with a full-access key and a small NEAR balance for the 1 yocto + storage; a deposit-bearing delegate can be relayed, but the deposit payer is UNVERIFIED (see below);
2. A sponsor account or treasury that funds the work order on the user’s behalf (tokens come from the sponsor);
3. Intents/1Click cross-chain sponsorship (F05), which avoids NEAR gas for the user;
4. A full-access user key in a wallet/MPC, with explicit risk acceptance.

Do not claim “gasless escrow funding” in UI or docs until one of these is implemented and tested.

**Deposit-payer ambiguity [UNVERIFIED]:** NEP-366 and nearcore comments say the relayer prepays attached deposits and refunds go to the delegate sender; the docs.near.org relayer tutorial says “any attached deposit or transferred NEAR comes from the client’s account.” These conflict. MEND avoids the ambiguity by allowing only zero-deposit meta-transactions. If a future flow needs deposits, test on sandbox before relying on either statement.

### 4.6 `near-sdk` / JS / Rust support

**[VERIFIED]**
- `near-sdk 5.30.1`: no meta-tx/delegate types; `min_protocol_version = 85` in `Cargo.toml` package metadata. Contracts only need `#[near]`, `env`, `PromiseOrValue`, `U128`.
- `near-primitives 0.38.0`: Rust off-chain types at `near_primitives::action::delegate::{DelegateAction, SignedDelegateAction, NonDelegateAction}`, `near_primitives::action::Action`, `near_primitives::account::{AccessKey, AccessKeyPermission, FunctionCallPermission}`.
- `near-api` 0.8.6 (docs.near.org example): `near_api::types::transaction::delegate_action::SignedDelegateAction`, `Action::Delegate(Box::new(...))`, `Transaction::construct(...).add_action(...)`.
- `near-api-js 7.4.0`:
  - `Account.createSignedMetaTransaction({ receiverId, actions, blockHeightTtl }) -> { signedDelegate, delegateHash }`;
  - `encodeSignedDelegate(signedDelegate)` / `encodeDelegateAction`;
  - `SCHEMA.SignedDelegate` for Borsh;
  - `Account.relayMetaTransaction(signedDelegate)`;
  - `SignedDelegate`, `DelegateAction` classes;
  - `actions.functionCall(methodName, args, gas, deposit)`;
  - `teraToGas(n)`.
  The JS `DelegateAction` uses camelCase fields: `senderId`, `receiverId`, `actions`, `nonce`, `maxBlockHeight`, `publicKey`.

### 4.7 Reference relayer implementations

**[VERIFIED]**
- NEP-366 does **not** define a standard on-chain relayer contract. The relayer is an off-chain service. There is no standard contract address to depend on.
- `near/pagoda-relayer-rs` — Rust HTTP reference implementation. Endpoints include `/relay`, `/send_meta_tx`, `/send_meta_tx_async`, `/send_meta_tx_nopoll`; config includes `whitelisted_contracts`, `whitelisted_delegate_action_receiver_ids`, and per-account allowances; Redis is optional for whitelisting/allowances/OAuth. Uses full-access relayer keys.
- `near-examples/near-api-examples` — TypeScript client/server meta-tx example (`createSignedMetaTransaction` + `/relay` + `relayMetaTransaction`).
- `near-api-js 7.4.0` — built-in client/server helpers.
- No standard on-chain “relayer contract” exists; MEND should implement its own off-chain relayer service (`services/relayer`) and not trust a third-party contract.

### 4.8 Minimal JS sketches (short)

Client:

```ts
import { Account, JsonRpcProvider, actions, encodeSignedDelegate, teraToGas } from "near-api-js";

const user = new Account(userId, provider, userKey);
const { signedDelegate } = await user.createSignedMetaTransaction({
  receiverId: HUB,
  actions: [actions.functionCall("create_work_order", args, teraToGas(100), 0n)],
  blockHeightTtl: 120,
});
await fetch(`${RELAYER_URL}/relay`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    signedDelegate: Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64"),
  }),
});
```

Relayer gate (sketch):

```ts
import { deserialize } from "borsh";
import { SCHEMA, type SignedDelegate } from "near-api-js";

const signedDelegate = deserialize(
  SCHEMA.SignedDelegate,
  Buffer.from(body.signedDelegate, "base64"),
) as SignedDelegate;

const d = signedDelegate.delegateAction;
if (d.receiverId !== HUB) throw new Error("E_RECEIVER");
if (d.actions.length !== 1) throw new Error("E_ACTION_COUNT");
const call = d.actions[0].functionCall;
if (!call || call.deposit !== 0n) throw new Error("E_DEPOSIT");
if (!ALLOWED_METHODS.has(call.methodName)) throw new Error("E_METHOD");
if (call.gas > MAX_GAS) throw new Error("E_GAS");
if (!ALLOWED_SENDERS.has(d.senderId)) throw new Error("E_SENDER");
if (d.maxBlockHeight > currentHeight + MAX_TTL) throw new Error("E_TTL");

await relayerAccount.relayMetaTransaction(signedDelegate);
```

**Notes:**
- `relayerAccount` must be signed by a full-access key (or full-access gas key); a function-call key cannot sign the outer `Delegate` transaction.
- The relayer must verify the user’s `public_key` is a function-call key scoped to `HUB` and the method, via `view_access_key`, before sponsoring. This makes the protocol enforce the target/method even if the relayer is malicious.
- Never accept `Transfer`, `AddKey`, `DeleteKey`, `Stake`, `DeleteAccount`, `DeployContract`, or multiple actions.
- The relayer must not hold user funds; keep only a small gas balance and top it up.

### 4.9 Meta-tx failure rules and tests

| Condition | Error / result |
|---|---|
| Expired `max_block_height` | `DelegateActionExpired` |
| Nonce ≤ current | `DelegateActionInvalidNonce` |
| Nonce too large | `DelegateActionNonceTooLarge` |
| Wrong outer receiver | `DelegateActionSenderDoesNotMatchTxReceiver` |
| Bad signature | `DelegateActionInvalidSignature` |
| Unknown public key | `DelegateActionAccessKeyError` |
| Multiple delegates / nested | `DelegateActionMustBeOnlyOne` / parse rejection |
| Function-call key + 2 actions | `RequiresFullAccess` |
| Function-call key + deposit > 0 | `DepositWithFunctionCall` |
| Function-call key + wrong receiver | `ReceiverMismatch` |
| Function-call key + wrong method | `MethodNameMismatch` |
| Gas key signs `Delegate` | `DelegateActionRequiresNonGasKey` |
| New `DelegateV2` at protocol 87+ | `RemovedProtocolFeature` |
| Relayer gate rejects | HTTP 4xx; no transaction |
| Replayed delegate | Protocol nonce error; relayer cache also rejects |
| Replayed business action with a fresh nonce | Contract state guard must reject; protocol will not |

**Required tests (T05.6):**
1. Valid zero-deposit `create_work_order` delegate; success; `predecessor_account_id` is user.
2. Arbitrary contract receiver → relayer rejects; protocol would also reject if key is scoped.
3. Arbitrary method → relayer rejects; protocol `MethodNameMismatch`.
4. Deposit > 0 with function-call key → `DepositWithFunctionCall`.
5. Replay same delegate → nonce error.
6. Expired delegate → `DelegateActionExpired`.
7. Wrong sender → relayer rejects / protocol error.
8. Two actions with function-call key → `RequiresFullAccess`.
9. Fresh nonce but duplicate business action → contract state guard rejects.
10. Relayer key is not used to touch user funds.

---

## 5. MEND invariant enforcement matrix

| Invariant | Mechanism | Test evidence |
|---|---|---|
| Passport transfer always fails | `nft_transfer` / `nft_transfer_call` panic; no approvals; no burn/admin transfer; no resolver | T01.2 tests 1–7 |
| Passport is not legal ownership | Holder = hub/registry; metadata description + `passport_policy()`; UI label | T01.2 metadata test; T04.8 UI review |
| Total funding = escrow + payouts + refunds | Internal ledger; checked arithmetic; only `ft_on_transfer` credits; state guards | T01.4 tests 1–13; property test |
| Overfund handled exactly | Accept expected; return excess from `ft_on_transfer` | T01.4 overfund test |
| Underfund rejected | Return full amount; no credit | T01.4 underfund test |
| Duplicate funding rejected | State guard `AwaitingFunding`; return full amount | T01.4 duplicate test |
| Callback failure refunds | Standard token resolver; no spending in callback; gas budget | T01.4 panic/OOG test |
| Contractor cannot inspect own work | Contract role check `contractor_id != inspector_id`; separate accounts | T01.7; T05.4 |
| AI cannot release funds | Contract role check; agent key method lists exclude release; DAO/human release | T05.2; T05.5 |
| Inspector cannot bid/award | Contract role check; key method list | T05.4; T05.5 |
| Paused contract blocks mutations | `assert_not_paused` in every mutating method | T01.1; T05.9 |
| Relayer cannot call arbitrary contracts | User function-call key scoped to hub; relayer app allowlist; protocol receiver/method checks | T05.6 tests 1–10 |
| Replay protection | Protocol nonce + max height; relayer hash cache; contract idempotency | T05.6 tests 5, 9 |
| No evidence URL/raw media on-chain | Contract stores hashes only; schema rejects strings/URLs for evidence | T01.7; T07 privacy tests |
| Warranty reopening cannot mint escrow | State guard; same work order lineage; no funding method on reopened state | T01.9 |
| Closed work order cannot be paid again | Terminal state guard; single release flag | T01.8 |

---

## 6. Blockers

1. **No runtime execution in this task.** All gas, refund, and meta-tx claims are source-verified. Sandbox/testnet proof is still required for gate G0/G1.
2. **Gasless escrow funding gap.** `ft_transfer_call` requires 1 yocto; function-call keys forbid deposits. MEND must choose a funding path (funded wallet, sponsor/treasury, Intents, or full-access wallet) before claiming gasless funding.
3. **No standard non-transferable flag.** MEND’s panic-based passport is custom. Third-party marketplaces/indexers may not understand it; UI and docs must explain.
4. **Relayer key management.** The relayer must use a full-access key (or full-access gas key) to submit the outer `Delegate` transaction. That is a hot-wallet risk requiring KMS/HSM, minimal balance, rotation, and monitoring. Human/ops approval needed.
5. **Protocol version.** `near-sdk 5.30.1` declares `min_protocol_version = 85`; gas keys and current meta-tx behavior require protocol 85+. Confirm the target testnet/mainnet protocol before deployment. `DelegateV2` is removed at protocol 87; use `Delegate`.
6. **Storage registration.** The hub must be registered with the settlement token (`storage_deposit`) before any `ft_transfer_call`; otherwise the token transfer panics “account is not registered”. This is a deployment prerequisite, not a contract bug.
7. **Human approvals.** Testnet accounts, faucet funds, token addresses, relayer account, and deployment all remain blocked on human approval per `PROGRESS.md`.

## 7. Risks

1. **Function-call keys are not a full security boundary.** Contract-level role checks, caps, allowlists, pause, and separation of duties are mandatory. A permitted method with weak argument validation can be abused.
2. **Empty `method_names` or `allowance: None` is dangerous.** Provisioning must reject both. Add a CI/RPC check that every agent key has a non-empty list and a finite allowance.
3. **Meta-tx nonce races.** Concurrent delegates from the same key can collide; serialize per key or use multiple keys. The relayer must not reuse nonces.
4. **`ft_transfer_call` resolver edge cases.** If the receiver spends tokens in the callback, refunds are capped by the receiver’s remaining balance; if the resolver runs out of gas, the sender may lose the refund. Use a standard token, do not spend in `ft_on_transfer`, and test gas.
5. **Overfund refund relies on hub solvency.** Do not spend the excess before the resolver runs; keep the full amount in the hub until the funding receipt is final.
6. **Passport ownership semantics.** `owner_id` is a registry holder, not a legal owner. UI must never show “owned by” in a way that implies title. Add `legal_ownership: false` and plain-language copy.
7. **Indexer/marketplace behaviour.** A marketplace may cache a passport as transferable or attempt `nft_transfer`; it will fail, but the UX may be confusing. Do not list the passport on marketplaces.
8. **Metadata size.** `TokenMetadata.extra` and event logs have size limits; keep `extra` small and never put raw evidence or long URLs on-chain.
9. **Dependency drift.** `near-api-js` 7.4 API and `near-primitives` 0.38 types are current as of 2026-11-09 but may change. Pin versions and re-verify at T05.6.
10. **NEP-366 MVP limitations.** Single receiver, initialized account, extra block, no atomicity, deposit-payer ambiguity. Design MEND flows around these, not against them.

## 8. Open questions / UNVERIFIED

1. **Exact runtime payer of attached deposits in a meta-transaction.** NEP-366/nearcore comments say relayer prepays; docs.near.org tutorial says client account. **[UNVERIFIED]** Resolve with a sandbox test before any deposit-bearing meta-tx. MEND avoids it by requiring zero deposit.
2. **Exact gas used by the hub `ft_on_transfer` and resolver under realistic state.** **[UNVERIFIED]** Measure on sandbox at 30/100 TGas.
3. **Third-party indexer behaviour for a panic-on-transfer NEP-171 contract.** **[UNVERIFIED]** Assume no special support; test with the MEND indexer and UI.
4. **Mainnet USDC storage registration cost and token contract behaviour.** **[UNVERIFIED]** Check the verified token address and `storage_balance_bounds` before deployment.
5. **Whether the target network currently supports protocol 85+ and gas keys.** **[UNVERIFIED]** Query protocol config before provisioning gas keys.
6. **`near-api-js` 7.4 `createSignedMetaTransaction` with a function-call key and `blockHeightTtl`.** **[UNVERIFIED]** Test on sandbox; the library types support it, but the runtime permission path must be confirmed.
7. **Whether a relayer can use a full-access gas key to sign the outer `Delegate` transaction on the target protocol.** Nomicon says yes; **[UNVERIFIED]** by execution. If not, use a normal full-access key with minimal balance.

## 9. Sources (access date 2026-11-09)

### near-contract-standards 5.30.1 / near-sdk 5.30.1

- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/index.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/core/trait.NonFungibleTokenCore.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/core/struct.NonFungibleToken.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/core/trait.NonFungibleTokenReceiver.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/core/trait.NonFungibleTokenResolver.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/metadata/index.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/enumeration/trait.NonFungibleTokenEnumeration.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/approval/trait.NonFungibleTokenApproval.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/non_fungible_token/struct.Token.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/fungible_token/index.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/fungible_token/core/trait.FungibleTokenCore.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/fungible_token/receiver/trait.FungibleTokenReceiver.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/fungible_token/resolver/trait.FungibleTokenResolver.html
- https://docs.rs/near-contract-standards/5.30.1/near_contract_standards/storage_management/struct.StorageBalance.html
- Source: `near-contract-standards-5.30.1/src/non_fungible_token/core/core_impl.rs`
- Source: `near-contract-standards-5.30.1/src/fungible_token/core_impl.rs`
- Source: `near-contract-standards-5.30.1/src/non_fungible_token/metadata.rs`
- Source: `near-contract-standards-5.30.1/src/non_fungible_token/enumeration/enumeration_impl.rs`
- Source: `near-contract-standards-5.30.1/src/fungible_token/storage_impl.rs`
- Source: `near-sdk-5.30.1/Cargo.toml` (`min_protocol_version = 85`)
- https://docs.rs/near-sdk/5.30.1/near_sdk/

### near-primitives 0.38.0

- https://docs.rs/near-primitives/latest/near_primitives/account/struct.FunctionCallPermission.html
- https://docs.rs/near-primitives/latest/near_primitives/action/delegate/struct.DelegateAction.html
- https://docs.rs/near-primitives/latest/near_primitives/action/delegate/struct.SignedDelegateAction.html
- https://docs.rs/near-primitives/latest/near_primitives/action/enum.Action.html
- https://docs.rs/near-primitives/latest/near_primitives/action/delegate/index.html

### NEAR Nomicon

- https://nomicon.io/DataStructures/AccessKey.html
- https://nomicon.io/RuntimeSpec/Actions.html
- https://nomicon.io/architecture/how/meta-tx.html
- https://nomicon.io/architecture/how/gas.html

### NEPs

- NEP-171: https://github.com/near/NEPs/blob/master/neps/nep-0171.md
- NEP-141: https://github.com/near/NEPs/blob/master/neps/nep-0141.md
- NEP-366: https://github.com/near/NEPs/blob/master/neps/nep-0366.md

### docs.near.org

- https://docs.near.org/protocol/transactions/meta-tx
- https://docs.near.org/web3-apps/tutorials/meta-transactions
- https://docs.near.org/smart-contracts/security/cross-contract-calls/ft-transfer-call

### nearcore source (master, read 2026-11-09)

- `runtime/runtime/src/verifier.rs` — `verify_function_call_permission`, `check_and_compute_new_allowance`, `verify_nonce`
- `runtime/runtime/src/actions.rs` — `apply_delegate_action`, `validate_delegate_action_key`, `DepositWithFunctionCall`

### near-cli-rs

- https://github.com/near/near-cli-rs/blob/main/docs/GUIDE.en.md
- `src/commands/account/add_key/access_key_type/mod.rs` — `--allowance`, `--contract-account-id`, `--function-names`, gas-key flags
- `src/commands/account/add_key/mod.rs` — `grant-function-call-access`, `grant-gas-key-full-access`

### near-api-js 7.4.0

- npm package `near-api-js@7.4.0` (`lib/account-*.d.ts`, `lib/index.d.ts`)
- `Account.createSignedMetaTransaction`, `Account.relayMetaTransaction`
- `SignedDelegate`, `DelegateAction`, `SCHEMA.SignedDelegate`, `encodeSignedDelegate`, `buildDelegateAction`, `encodeDelegateAction`

### Relayer reference

- https://github.com/near/pagoda-relayer-rs
- https://github.com/near-examples/near-api-examples (meta-tx client/server example referenced by docs.near.org)

---

## 10. Verification log

| Claim | Tag | How checked |
|---|---|---|
| `NonFungibleToken` is a struct in 5.30.1 | VERIFIED | docs.rs + source |
| `nft_transfer` / `nft_transfer_call` signatures | VERIFIED | trait source |
| No `non_transferable` flag in NEP-171/SDK | VERIFIED | NEP text + recursive grep |
| Panic-on-transfer approach | VERIFIED design; runtime panic semantics standard | source + NEAR semantics |
| `NFT_METADATA_SPEC = "nft-1.0.0"` | VERIFIED | metadata.rs |
| Enumeration panic boundaries | VERIFIED | enumeration_impl.rs |
| `ft_on_transfer` return semantics | VERIFIED | receiver trait + NEP-141 |
| `ft_resolve_transfer` refund caps | VERIFIED | core_impl.rs |
| `ft_transfer_call` exactly 1 yocto | VERIFIED | core_impl.rs `assert_one_yocto` |
| Resolver gas = 5 TGas | VERIFIED | core_impl.rs |
| No explicit `GAS_FOR_FT_TRANSFER_CALL` in 5.30.1 | VERIFIED | source grep |
| Reference FT `ft_transfer_call` needs 30 TGas | VERIFIED | Nomicon gas page |
| Function-call fields and allowance semantics | VERIFIED | Nomicon + near-primitives docs |
| Function-call key rejects deposits | VERIFIED | nearcore verifier.rs |
| Function-call key cannot batch/transfer/stake | VERIFIED | nearcore verifier.rs + Nomicon |
| Meta-tx key allowance bypass | VERIFIED | nearcore actions.rs + Nomicon |
| `DelegateAction` exact fields | VERIFIED | near-primitives docs |
| Nonce > current; nonce advanced | VERIFIED | nearcore actions.rs |
| `max_block_height` expiry | VERIFIED | nearcore actions.rs |
| `DelegateV2` removed at protocol 87 | VERIFIED | Nomicon/docs.near.org |
| `near-sdk 5.30.1` no delegate types | VERIFIED | recursive grep |
| `near-api-js 7.4` meta-tx API | VERIFIED | npm package types |
| No standard on-chain relayer contract | VERIFIED | NEP-366 + reference docs |
| Gasless escrow funding blocked by 1 yocto | VERIFIED | core_impl.rs + verifier.rs |
| Deposit payer in meta-tx | UNVERIFIED | conflicting sources; needs sandbox |
| Hub gas usage under load | UNVERIFIED | needs measurement |
| Indexer behaviour for panic-on-transfer | UNVERIFIED | needs integration test |
| Target protocol >= 85 | UNVERIFIED | needs network query |

**End of R0-E.**

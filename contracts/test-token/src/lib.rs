#![doc = "Testnet-only NEP-141 mock USDC for MEND.

This token exists only for testnet demonstrations and unit tests. It is not
mainnet money and must never be presented as such. It implements NEP-141 core,
NEP-148 metadata and NEP-145 storage management, including `ft_transfer_call`
and the standard resolver.
"]

use near_contract_standards::fungible_token::events::FtMint;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::{
    FungibleToken, FungibleTokenCore, FungibleTokenResolver,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::borsh::BorshSerialize;
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, PanicOnDefault, PromiseOrValue};

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    FungibleToken,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    owner: AccountId,
    metadata: FungibleTokenMetadata,
}

#[near]
impl Contract {
    /// Create a test-only USDC-shaped token and mint the full supply to `owner_id`.
    /// `total_supply` is in micro-units (6 decimals).
    #[init]
    pub fn new(owner_id: AccountId, total_supply: U128) -> Self {
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "MEND Test USDC (test value only)".to_string(),
            symbol: "mUSDC".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 6,
        };
        let mut token = FungibleToken::new(StorageKey::FungibleToken);
        token.internal_register_account(&owner_id);
        if total_supply.0 > 0 {
            token.internal_deposit(&owner_id, total_supply.0);
            FtMint {
                owner_id: &owner_id,
                amount: total_supply,
                memo: Some("MEND testnet mock USDC genesis supply (test value only)"),
            }
            .emit();
        }
        Self {
            token,
            owner: owner_id,
            metadata,
        }
    }

    /// Testnet faucet-style mint. Owner only; never part of the production path.
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only the test-token owner can mint test value"
        );
        if !self.token.accounts.contains_key(&account_id) {
            self.token.internal_register_account(&account_id);
        }
        self.token.internal_deposit(&account_id, amount.0);
        FtMint {
            owner_id: &account_id,
            amount,
            memo: Some("MEND testnet mock USDC mint (test value only)"),
        }
        .emit();
    }

    pub fn owner_id(&self) -> AccountId {
        self.owner.clone()
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used_amount, burned_amount) =
            self.token
                .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned_amount > 0 {
            near_sdk::log!("Account @{} burned {}", sender_id, burned_amount);
        }
        used_amount.into()
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.clone()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<near_sdk::NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.storage_unregister(force)
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, NearToken};

    fn context(predecessor: AccountId, deposit: u128) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .predecessor_account_id(predecessor.clone())
            .signer_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit));
        builder
    }

    fn setup() -> Contract {
        let owner = accounts(0);
        testing_env!(context(owner.clone(), 0).build());
        near_sdk::mock::with_mocked_blockchain(|blockchain| {
            blockchain.take_storage();
        });
        Contract::new(owner, U128(1_000_000_000_000))
    }

    fn register(contract: &mut Contract, account: AccountId) {
        let min = contract.storage_balance_bounds().min;
        testing_env!(context(accounts(0), min.as_yoctonear()).build());
        let _ = contract.storage_deposit(Some(account), None);
    }

    #[test]
    fn metadata_is_testnet_labelled() {
        let contract = setup();
        let metadata = contract.ft_metadata();
        assert_eq!(metadata.spec, "ft-1.0.0");
        assert_eq!(metadata.symbol, "mUSDC");
        assert_eq!(metadata.decimals, 6);
        assert!(metadata.name.contains("test value only"));
    }

    #[test]
    fn transfer_moves_exact_micro_units() {
        let mut contract = setup();
        register(&mut contract, accounts(1));
        testing_env!(context(accounts(0), 1).build());
        contract.ft_transfer(accounts(1), U128(25_000_000), None);
        assert_eq!(contract.ft_balance_of(accounts(1)).0, 25_000_000);
        assert_eq!(
            contract.ft_balance_of(accounts(0)).0,
            1_000_000_000_000 - 25_000_000
        );
    }

    #[test]
    fn transfer_call_targets_receiver_and_resolver() {
        let mut contract = setup();
        register(&mut contract, accounts(2));
        testing_env!(context(accounts(0), 1).build());
        let _ = contract.ft_transfer_call(
            accounts(2),
            U128(10_000_000),
            Some("fund work order".to_string()),
            "WO-BENCH-001-0001".to_string(),
        );
        let receipts = near_sdk::test_utils::get_created_receipts();
        assert!(receipts
            .iter()
            .any(|receipt| receipt.receiver_id == accounts(2)));
        assert!(receipts
            .iter()
            .any(|receipt| receipt.receiver_id == accounts(0)));
        assert_eq!(contract.ft_balance_of(accounts(2)).0, 10_000_000);
    }

    #[test]
    fn owner_can_mint_test_value_only() {
        let mut contract = setup();
        testing_env!(context(accounts(0), 0).build());
        contract.mint(accounts(1), U128(5_000_000));
        assert_eq!(contract.ft_balance_of(accounts(1)).0, 5_000_000);
    }

    #[test]
    #[should_panic(expected = "Only the test-token owner")]
    fn non_owner_cannot_mint() {
        let mut contract = setup();
        testing_env!(context(accounts(1), 0).build());
        contract.mint(accounts(1), U128(5_000_000));
    }
}

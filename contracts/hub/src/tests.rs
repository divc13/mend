//! Hub unit tests.
//!
//! These tests use `near-sdk` unit-testing only. Cross-contract receipts are
//! inspected, not executed: no fake token balances are created and no fake
//! OutLayer execution is claimed.

use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, NearToken, PromiseResult};

const HUB: &str = "mend-hub.testnet";
const TOKEN: &str = "mend-usdc.testnet";
const WRONG_TOKEN: &str = "wrong-token.testnet";
const DAO: &str = "mend-dao.sputnikv2.testnet";
const OWNER: &str = "owner.mend.testnet";
const STEWARD: &str = "steward.mend.testnet";
const SPONSOR: &str = "sponsor.mend.testnet";
const COORDINATOR: &str = "coordinator-ai.mend.testnet";
const REVIEWER: &str = "reviewer-ai.mend.testnet";
const ORACLE: &str = "oracle.mend.testnet";
const CONTRACTOR_A: &str = "contractor-a.mend.testnet";
const CONTRACTOR_B: &str = "contractor-b.mend.testnet";
const CONTRACTOR_C: &str = "contractor-c.mend.testnet";
const INSPECTOR: &str = "inspector.mend.testnet";
const INSPECTOR_2: &str = "inspector-2.mend.testnet";
const OUTSIDER: &str = "outsider.mend.testnet";
const OUTLAYER: &str = "outlayer.testnet";

const ASSET: &str = "BENCH-001";
const WORK_ORDER: &str = "WO-BENCH-001-0001";
const BID_A: &str = "BID-A-BENCH-001";
const BID_B: &str = "BID-B-BENCH-001";
const BID_C: &str = "BID-C-BENCH-001";

const T0: u64 = 1_700_000_000_000_000_000;
const COMMIT_DEADLINE: u64 = T0 + 100_000_000_000;
const REVEAL_DEADLINE: u64 = T0 + 200_000_000_000;
const DURABILITY_NS: u64 = 120_000_000_000;

const POLICY_HASH: &str = "1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d";
const BUDGET: u128 = 100_000_000;
const PRICE_A: u128 = 95_000_000;
const PRICE_B: u128 = 80_000_000;
const PRICE_C: u128 = 78_000_000;

fn acct(value: &str) -> AccountId {
    value.parse().unwrap()
}

fn hash(ch: char) -> String {
    ch.to_string().repeat(64)
}

fn context(predecessor: &str, timestamp: u64, deposit: u128) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(acct(HUB))
        .signer_account_id(acct(predecessor))
        .predecessor_account_id(acct(predecessor))
        .block_timestamp(timestamp)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(10_000));
    builder
}

fn set_ctx(predecessor: &str, timestamp: u64) {
    testing_env!(context(predecessor, timestamp, 0).build());
}

fn set_ctx_deposit(predecessor: &str, timestamp: u64, deposit: u128) {
    testing_env!(context(predecessor, timestamp, deposit).build());
}

/// Test helper that installs a promise result for the private self-callback.
/// The callback predecessor is always the hub (self-call).
fn testing_env_with_promise_results<C>(_context: C, result: PromiseResult) {
    let mut builder = context(HUB, T0 + 230_000_000_000, 0);
    builder.predecessor_account_id(acct(HUB));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![result],
    );
}

fn expect_panic<F: FnOnce()>(f: F, needle: &str) {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
    let error = result.expect_err("expected a panic");
    let message = if let Some(message) = error.downcast_ref::<String>() {
        message.clone()
    } else if let Some(message) = error.downcast_ref::<&str>() {
        message.to_string()
    } else {
        String::new()
    };
    assert!(
        message.contains(needle),
        "panic message {:?} did not contain {:?}",
        message,
        needle
    );
}

fn setup() -> Contract {
    set_ctx(OWNER, T0);
    // Test threads may be reused; start every test with empty mocked storage.
    near_sdk::mock::with_mocked_blockchain(|blockchain| {
        blockchain.take_storage();
    });
    let mut contract = Contract::new(
        acct(OWNER),
        acct(TOKEN),
        acct(DAO),
        POLICY_HASH.to_string(),
        2,
    );
    set_ctx(OWNER, T0);
    contract.set_role(acct(STEWARD), ROLE_STEWARD.to_string(), true);
    contract.set_role(acct(ORACLE), ROLE_ORACLE.to_string(), true);
    contract.set_role(acct(COORDINATOR), ROLE_COORDINATOR_AI.to_string(), true);
    contract.set_role(acct(REVIEWER), ROLE_REVIEWER_AI.to_string(), true);
    contract.set_role(acct(CONTRACTOR_A), ROLE_CONTRACTOR.to_string(), true);
    contract.set_role(acct(CONTRACTOR_B), ROLE_CONTRACTOR.to_string(), true);
    contract.set_role(acct(CONTRACTOR_C), ROLE_CONTRACTOR.to_string(), true);
    contract.set_role(acct(INSPECTOR), ROLE_INSPECTOR.to_string(), true);
    contract.set_role(acct(INSPECTOR_2), ROLE_INSPECTOR.to_string(), true);
    contract
}

fn enable_outlayer(contract: &mut Contract) {
    set_ctx(OWNER, T0);
    contract.set_outlayer_config(
        acct(OUTLAYER),
        "mend.testnet/bid-rules".to_string(),
        hash('9'),
        true,
    );
}

fn create_asset(contract: &mut Contract) {
    set_ctx(STEWARD, T0);
    contract.create_asset(ASSET.to_string(), hash('d'), hash('e'));
}

fn create_work_order_with(
    contract: &mut Contract,
    work_order_id: &str,
    budget: u128,
    commit_deadline: u64,
    reveal_deadline: u64,
) {
    set_ctx(STEWARD, T0);
    contract.create_work_order(
        work_order_id.to_string(),
        ASSET.to_string(),
        hash('1'),
        hash('2'),
        "42".to_string(),
        POLICY_HASH.to_string(),
        U128(budget),
        acct(SPONSOR),
        vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B), acct(CONTRACTOR_C)],
        vec![acct(INSPECTOR), acct(INSPECTOR_2)],
        commit_deadline,
        reveal_deadline,
    );
    set_ctx(DAO, T0);
    contract.dao_authorize(
        work_order_id.to_string(),
        "42".to_string(),
        hash('2'),
        POLICY_HASH.to_string(),
        U128(budget),
        vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B), acct(CONTRACTOR_C)],
        vec![acct(INSPECTOR), acct(INSPECTOR_2)],
        commit_deadline,
        reveal_deadline,
    );
}

fn make_work_order(contract: &mut Contract) {
    create_asset(contract);
    create_work_order_with(
        contract,
        WORK_ORDER,
        BUDGET,
        COMMIT_DEADLINE,
        REVEAL_DEADLINE,
    );
}

fn fund(contract: &mut Contract, amount: u128) -> U128 {
    set_ctx(TOKEN, T0);
    match contract.ft_on_transfer(acct(SPONSOR), U128(amount), WORK_ORDER.to_string()) {
        PromiseOrValue::Value(value) => value,
        _ => panic!("ft_on_transfer must return a value synchronously"),
    }
}

fn commit(contract: &mut Contract, bid_id: &str, contractor: &str, commitment: &str) {
    set_ctx(contractor, T0 + 2_000_000_000);
    contract.commit_bid(
        WORK_ORDER.to_string(),
        bid_id.to_string(),
        commitment.to_string(),
    );
}

const AVAILABLE_A: u32 = 5;
const AVAILABLE_B: u32 = 2;
const AVAILABLE_C: u32 = 30;

#[allow(clippy::too_many_arguments)]
fn commitment(
    bid_id: &str,
    contractor: &str,
    price: u128,
    duration: u32,
    warranty: u32,
    materials: u32,
    available_in_days: u32,
    nonce: &str,
) -> String {
    sha256_hex(
        bid_commitment_payload(
            bid_id,
            &acct(contractor),
            price,
            duration,
            warranty,
            materials,
            available_in_days,
            true,
            nonce,
        )
        .as_bytes(),
    )
}

fn commit_all(contract: &mut Contract) {
    commit(
        contract,
        BID_A,
        CONTRACTOR_A,
        &commitment(
            BID_A,
            CONTRACTOR_A,
            PRICE_A,
            14,
            90,
            60,
            AVAILABLE_A,
            "nonce-a-0001",
        ),
    );
    commit(
        contract,
        BID_B,
        CONTRACTOR_B,
        &commitment(
            BID_B,
            CONTRACTOR_B,
            PRICE_B,
            10,
            180,
            80,
            AVAILABLE_B,
            "nonce-b-0002",
        ),
    );
    commit(
        contract,
        BID_C,
        CONTRACTOR_C,
        &commitment(
            BID_C,
            CONTRACTOR_C,
            PRICE_C,
            21,
            30,
            70,
            AVAILABLE_C,
            "nonce-c-0003",
        ),
    );
}

#[allow(clippy::too_many_arguments)]
fn reveal(
    contract: &mut Contract,
    bid_id: &str,
    contractor: &str,
    price: u128,
    duration: u32,
    warranty: u32,
    materials: u32,
    available_in_days: u32,
    nonce: &str,
) {
    set_ctx(contractor, T0 + 110_000_000_000);
    contract.reveal_bid(
        WORK_ORDER.to_string(),
        bid_id.to_string(),
        U128(price),
        duration,
        warranty,
        materials,
        available_in_days,
        true,
        nonce.to_string(),
    );
}

fn reveal_all(contract: &mut Contract) {
    reveal(
        contract,
        BID_A,
        CONTRACTOR_A,
        PRICE_A,
        14,
        90,
        60,
        AVAILABLE_A,
        "nonce-a-0001",
    );
    reveal(
        contract,
        BID_B,
        CONTRACTOR_B,
        PRICE_B,
        10,
        180,
        80,
        AVAILABLE_B,
        "nonce-b-0002",
    );
    reveal(
        contract,
        BID_C,
        CONTRACTOR_C,
        PRICE_C,
        21,
        30,
        70,
        AVAILABLE_C,
        "nonce-c-0003",
    );
}

fn open_and_bid(contract: &mut Contract) {
    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());
    commit_all(contract);
}

fn reveal_and_close(contract: &mut Contract) {
    reveal_all(contract);
    set_ctx(STEWARD, T0 + 210_000_000_000);
    contract.close_bidding(WORK_ORDER.to_string());
}

fn expected_ranking() -> Vec<ScoredRank> {
    vec![
        ScoredRank {
            rank: 1,
            bid_id: BID_B.to_string(),
            contractor_id: acct(CONTRACTOR_B),
            score_bps: 9_270,
        },
        ScoredRank {
            rank: 2,
            bid_id: BID_C.to_string(),
            contractor_id: acct(CONTRACTOR_C),
            score_bps: 5_200,
        },
        ScoredRank {
            rank: 3,
            bid_id: BID_A.to_string(),
            contractor_id: acct(CONTRACTOR_A),
            score_bps: 2_873,
        },
    ]
}

fn record_score(contract: &mut Contract) {
    let input_hash = contract
        .get_score_input(WORK_ORDER.to_string())
        .expect("canonical input")
        .input_hash;
    set_ctx(STEWARD, T0 + 220_000_000_000);
    contract.record_score(
        WORK_ORDER.to_string(),
        "SX-0001".to_string(),
        POLICY_HASH.to_string(),
        hash('8'),
        input_hash,
        hash('a'),
        expected_ranking(),
    );
}

fn prepare_scored(contract: &mut Contract) {
    make_work_order(contract);
    assert_eq!(fund(contract, BUDGET), U128(0));
    open_and_bid(contract);
    reveal_and_close(contract);
    record_score(contract);
}

fn prepare_awarded(contract: &mut Contract) {
    prepare_scored(contract);
    set_ctx(STEWARD, T0 + 230_000_000_000);
    contract.award(WORK_ORDER.to_string(), BID_B.to_string());
}

fn prepare_completion_submitted(contract: &mut Contract) {
    prepare_awarded(contract);
    set_ctx(CONTRACTOR_B, T0 + 240_000_000_000);
    contract.start_work(WORK_ORDER.to_string());
    set_ctx(CONTRACTOR_B, T0 + 250_000_000_000);
    contract.submit_completion(WORK_ORDER.to_string(), "EV-0001".to_string(), hash('b'));
}

fn prepare_durability_pending(contract: &mut Contract) {
    prepare_completion_submitted(contract);
    set_ctx(INSPECTOR, T0 + 260_000_000_000);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
}

fn token_transfer_receipt_count(recipient: &str, amount: u128) -> usize {
    let expected_amount = U128(amount).0.to_string();
    near_sdk::test_utils::get_created_receipts()
        .iter()
        .filter(|receipt| receipt.receiver_id == acct(TOKEN))
        .filter(|receipt| {
            receipt.actions.iter().any(|action| match action {
                near_sdk::mock::MockAction::FunctionCallWeight {
                    method_name, args, ..
                } => {
                    method_name == b"ft_transfer"
                        && String::from_utf8_lossy(args).contains(recipient)
                        && String::from_utf8_lossy(args).contains(&expected_amount)
                }
                _ => false,
            })
        })
        .count()
}

// ---------------------------------------------------------------------------
// Happy path and accounting
// ---------------------------------------------------------------------------

#[test]
fn happy_path_100_80_20_72_8_released() {
    let mut contract = setup();
    prepare_awarded(&mut contract);

    // Award: 20 refunded, 80 remains escrowed.
    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000);
    assert_eq!(escrow.refunded.0, 20_000_000);
    assert_eq!(escrow.escrowed.0, 80_000_000);
    assert_eq!(token_transfer_receipt_count(SPONSOR, 20_000_000), 1);

    set_ctx(CONTRACTOR_B, T0 + 240_000_000_000);
    contract.start_work(WORK_ORDER.to_string());
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        IN_PROGRESS
    );

    set_ctx(CONTRACTOR_B, T0 + 250_000_000_000);
    contract.submit_completion(WORK_ORDER.to_string(), "EV-0001".to_string(), hash('b'));

    set_ctx(INSPECTOR, T0 + 260_000_000_000);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.escrowed.0, 0);
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 8_000_000);
    assert_eq!(escrow.holdback_released.0, 0);
    assert_eq!(token_transfer_receipt_count(CONTRACTOR_B, 72_000_000), 1);

    let wo = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    assert_eq!(wo.status, DURABILITY_PENDING);
    assert_eq!(wo.inspector, Some(acct(INSPECTOR)), "inspector recorded");
    let due = wo.durability_due_at.unwrap();
    assert_eq!(due, T0 + 260_000_000_000 + DURABILITY_NS);

    // Early durability inspection is refused.
    set_ctx(INSPECTOR_2, due - 1);
    expect_panic(
        || {
            contract.inspect_durability(
                WORK_ORDER.to_string(),
                true,
                "INS-0002".to_string(),
                hash('f'),
            );
        },
        "durability inspection is not due",
    );

    set_ctx(INSPECTOR_2, due + 1);
    contract.inspect_durability(
        WORK_ORDER.to_string(),
        true,
        "INS-0002".to_string(),
        hash('f'),
    );

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000);
    assert_eq!(escrow.refunded.0, 20_000_000);
    assert_eq!(escrow.escrowed.0, 0);
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 0);
    assert_eq!(escrow.holdback_released.0, 8_000_000);
    assert_eq!(
        escrow.refunded.0
            + escrow.escrowed.0
            + escrow.completion_paid.0
            + escrow.holdback_held.0
            + escrow.holdback_released.0,
        escrow.funding.0
    );
    assert_eq!(token_transfer_receipt_count(CONTRACTOR_B, 8_000_000), 1);

    let wo = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    assert_eq!(wo.status, CLOSED);
    assert!(wo.completion_paid);
    assert!(wo.holdback_released);
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 3);

    let history = contract.get_history(ASSET.to_string());
    assert!(history
        .iter()
        .any(|entry| entry.action == "work_order_funded"));
    assert!(history
        .iter()
        .any(|entry| entry.action == "work_order_awarded"));
    assert!(history
        .iter()
        .any(|entry| entry.action == "completion_accepted"));
    assert!(history
        .iter()
        .any(|entry| entry.action == "durability_passed"));

    // Double release: closed work order cannot pay again.
    set_ctx(INSPECTOR_2, due + 2);
    expect_panic(
        || {
            contract.inspect_durability(
                WORK_ORDER.to_string(),
                true,
                "INS-0003".to_string(),
                hash('f'),
            );
        },
        "durability is not pending",
    );
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 3);
}

#[test]
fn failed_durability_reopens_same_work_order_and_remediation_releases_holdback_once() {
    let mut contract = setup();
    prepare_durability_pending(&mut contract);
    let due = contract
        .get_work_order(WORK_ORDER.to_string())
        .unwrap()
        .durability_due_at
        .unwrap();

    set_ctx(INSPECTOR_2, due + 1);
    contract.inspect_durability(
        WORK_ORDER.to_string(),
        false,
        "INS-0002".to_string(),
        hash('f'),
    );

    let wo = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    assert_eq!(wo.status, WARRANTY_REOPENED);
    assert_eq!(wo.reopen_count, 1);
    assert_eq!(wo.awarded_bid_id.as_deref(), Some(BID_B));
    assert_eq!(wo.awarded_contractor, Some(acct(CONTRACTOR_B)));
    let warranty = contract.get_warranty(WORK_ORDER.to_string()).unwrap();
    assert_eq!(warranty.state, "OPEN");
    assert_eq!(warranty.work_order_state, WARRANTY_REOPENED);
    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000, "no new funding");
    assert_eq!(escrow.escrowed.0, 0);
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 8_000_000);
    assert_eq!(escrow.holdback_released.0, 0);
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 2);

    // Reopening cannot mint new escrow, even if someone sends tokens again.
    set_ctx(TOKEN, due + 2);
    let returned =
        match contract.ft_on_transfer(acct(SPONSOR), U128(100_000_000), WORK_ORDER.to_string()) {
            PromiseOrValue::Value(value) => value,
            _ => panic!("value expected"),
        };
    assert_eq!(returned, U128(100_000_000));
    assert_eq!(
        contract
            .get_escrow(WORK_ORDER.to_string())
            .unwrap()
            .funding
            .0,
        100_000_000
    );

    // Remediation: same work order, same contractor, no new payment at acceptance.
    set_ctx(CONTRACTOR_B, due + 10);
    contract.start_work(WORK_ORDER.to_string());
    assert_eq!(
        contract.get_warranty(WORK_ORDER.to_string()).unwrap().state,
        "REMEDIATING"
    );
    set_ctx(CONTRACTOR_B, due + 20);
    contract.submit_completion(WORK_ORDER.to_string(), "EV-0002".to_string(), hash('d'));
    set_ctx(INSPECTOR, due + 30);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-0003".to_string(), hash('e'));
    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 8_000_000);
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 2);

    let remediation_due = contract
        .get_work_order(WORK_ORDER.to_string())
        .unwrap()
        .durability_due_at
        .unwrap();
    set_ctx(INSPECTOR_2, remediation_due + 1);
    contract.inspect_durability(
        WORK_ORDER.to_string(),
        true,
        "INS-0004".to_string(),
        hash('f'),
    );
    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000);
    assert_eq!(escrow.refunded.0, 20_000_000);
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 0);
    assert_eq!(escrow.holdback_released.0, 8_000_000);
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 3);
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        CLOSED
    );
    assert_eq!(
        contract.get_warranty(WORK_ORDER.to_string()).unwrap().state,
        "CLOSED"
    );
    assert!(contract
        .get_history(ASSET.to_string())
        .iter()
        .any(|entry| entry.action == "warranty_reopened"));
}

// ---------------------------------------------------------------------------
// Passport / NEP-171
// ---------------------------------------------------------------------------

#[test]
fn passport_mint_metadata_and_enumeration() {
    let mut contract = setup();
    create_asset(&mut contract);
    set_ctx(STEWARD, T0);
    contract.mint_passport(ASSET.to_string());

    let token = contract.nft_token(ASSET.to_string()).expect("passport");
    assert_eq!(token.token_id, ASSET);
    assert_eq!(token.owner_id, acct(HUB), "holder is the hub, never a user");
    assert_eq!(contract.nft_total_supply().0, 1);
    assert_eq!(contract.nft_supply_for_owner(acct(HUB)).0, 1);
    assert_eq!(
        contract.nft_tokens_for_owner(acct(HUB), None, None).len(),
        1
    );
    let metadata = contract.nft_metadata();
    assert_eq!(metadata.spec, "nft-1.0.0");
    assert!(metadata.name.contains("MEND"));
    let token_metadata = token.metadata.unwrap();
    assert!(token_metadata
        .description
        .unwrap()
        .contains("not a title deed"));
    assert!(token_metadata
        .extra
        .unwrap()
        .contains("\"transferable\":false"));
    assert_eq!(
        contract
            .get_asset(ASSET.to_string())
            .unwrap()
            .passport_token_id,
        Some(ASSET.to_string())
    );
    assert_eq!(contract.get_role(acct(STEWARD)).len(), 1);
    assert!(!contract.passport_policy()["transferable"]
        .as_bool()
        .unwrap());
}

#[test]
fn passport_transfers_and_approvals_always_fail() {
    let mut contract = setup();
    create_asset(&mut contract);
    set_ctx(STEWARD, T0);
    contract.mint_passport(ASSET.to_string());

    set_ctx_deposit(SPONSOR, T0 + 1, 1);
    expect_panic(
        || {
            contract.nft_transfer(acct(OUTSIDER), ASSET.to_string(), None, None);
        },
        "TRANSFER_DISABLED",
    );
    expect_panic(
        || {
            let _ = contract.nft_transfer_call(
                acct(OUTSIDER),
                ASSET.to_string(),
                None,
                None,
                "steal".to_string(),
            );
        },
        "TRANSFER_DISABLED",
    );
    expect_panic(
        || {
            let _ = contract.nft_approve(
                ASSET.to_string(),
                acct(OUTSIDER),
                Some("market".to_string()),
            );
        },
        "TRANSFER_DISABLED",
    );
    expect_panic(
        || contract.nft_revoke(ASSET.to_string(), acct(OUTSIDER)),
        "TRANSFER_DISABLED",
    );
    expect_panic(
        || contract.nft_revoke_all(ASSET.to_string()),
        "TRANSFER_DISABLED",
    );
    assert!(!contract.nft_is_approved(ASSET.to_string(), acct(OUTSIDER), None));
    assert_eq!(
        contract.nft_token(ASSET.to_string()).unwrap().owner_id,
        acct(HUB)
    );
}

#[test]
fn duplicate_passport_mint_fails() {
    let mut contract = setup();
    create_asset(&mut contract);
    set_ctx(STEWARD, T0);
    contract.mint_passport(ASSET.to_string());
    expect_panic(
        || contract.mint_passport(ASSET.to_string()),
        "passport already minted",
    );
}

// ---------------------------------------------------------------------------
// Escrow funding
// ---------------------------------------------------------------------------

#[test]
fn funding_exact_overfund_underfund_and_duplicate() {
    let mut contract = setup();
    make_work_order(&mut contract);

    // Underfund: full refund, no credit.
    assert_eq!(fund(&mut contract, BUDGET - 1), U128(BUDGET - 1));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        POLICY_APPROVED
    );
    assert_eq!(
        contract
            .get_escrow(WORK_ORDER.to_string())
            .unwrap()
            .funding
            .0,
        0
    );

    // Overfund: accept budget, refund excess.
    assert_eq!(fund(&mut contract, BUDGET + 20_000_000), U128(20_000_000));
    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, BUDGET);
    assert_eq!(escrow.escrowed.0, BUDGET);
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        FUNDED
    );

    // Duplicate funding: full refund, no double credit.
    assert_eq!(fund(&mut contract, BUDGET), U128(BUDGET));
    assert_eq!(
        contract
            .get_escrow(WORK_ORDER.to_string())
            .unwrap()
            .funding
            .0,
        BUDGET
    );
}

#[test]
fn funding_rejects_wrong_token_msg_sponsor_and_paused_state() {
    let mut contract = setup();
    make_work_order(&mut contract);

    // Wrong accepted token: full refund.
    set_ctx(WRONG_TOKEN, T0);
    let returned =
        match contract.ft_on_transfer(acct(SPONSOR), U128(BUDGET), WORK_ORDER.to_string()) {
            PromiseOrValue::Value(value) => value,
            _ => panic!("value expected"),
        };
    assert_eq!(returned, U128(BUDGET));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        POLICY_APPROVED
    );

    // Malformed msg: full refund.
    set_ctx(TOKEN, T0);
    let returned = match contract.ft_on_transfer(
        acct(SPONSOR),
        U128(BUDGET),
        "https://private.example/evidence".to_string(),
    ) {
        PromiseOrValue::Value(value) => value,
        _ => panic!("value expected"),
    };
    assert_eq!(returned, U128(BUDGET));

    // Wrong sponsor: full refund.
    set_ctx(TOKEN, T0);
    let returned =
        match contract.ft_on_transfer(acct(OUTSIDER), U128(BUDGET), WORK_ORDER.to_string()) {
            PromiseOrValue::Value(value) => value,
            _ => panic!("value expected"),
        };
    assert_eq!(returned, U128(BUDGET));

    // Paused funding: full refund, no state change.
    set_ctx(OWNER, T0);
    contract.pause(hash('f'));
    set_ctx(TOKEN, T0);
    let returned =
        match contract.ft_on_transfer(acct(SPONSOR), U128(BUDGET), WORK_ORDER.to_string()) {
            PromiseOrValue::Value(value) => value,
            _ => panic!("value expected"),
        };
    assert_eq!(returned, U128(BUDGET));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        POLICY_APPROVED
    );

    set_ctx(OWNER, T0);
    contract.unpause();
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
}

// ---------------------------------------------------------------------------
// Sealed bids
// ---------------------------------------------------------------------------

#[test]
fn commit_and_reveal_validate_roster_duplicates_and_windows() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));

    // Cannot commit before bidding opens.
    set_ctx(CONTRACTOR_A, T0 + 1_000_000_000);
    expect_panic(
        || {
            contract.commit_bid(WORK_ORDER.to_string(), BID_A.to_string(), hash('a'));
        },
        "bidding is not open",
    );

    set_ctx(STEWARD, T0 + 1_500_000_000);
    contract.open_bidding(WORK_ORDER.to_string());

    // Non-roster bidder fails.
    set_ctx(OUTSIDER, T0 + 2_000_000_000);
    expect_panic(
        || {
            contract.commit_bid(WORK_ORDER.to_string(), BID_A.to_string(), hash('a'));
        },
        "NOT_ROSTERED",
    );

    let commitment_a = commitment(
        BID_A,
        CONTRACTOR_A,
        PRICE_A,
        14,
        90,
        60,
        AVAILABLE_A,
        "nonce-a-0001",
    );
    commit(&mut contract, BID_A, CONTRACTOR_A, &commitment_a);

    // Duplicate bid / contractor fails.
    set_ctx(CONTRACTOR_A, T0 + 3_000_000_000);
    expect_panic(
        || {
            contract.commit_bid(
                WORK_ORDER.to_string(),
                "BID-A2-BENCH-001".to_string(),
                hash('b'),
            );
        },
        "BID_DUPLICATE",
    );

    // Early reveal fails.
    set_ctx(CONTRACTOR_A, T0 + 3_000_000_000);
    expect_panic(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_A.to_string(),
                U128(PRICE_A),
                14,
                90,
                60,
                AVAILABLE_A,
                true,
                "nonce-a-0001".to_string(),
            );
        },
        "BID_EARLY_REVEAL",
    );

    // Hash mismatch fails.
    set_ctx(CONTRACTOR_A, T0 + 110_000_000_000);
    expect_panic(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_A.to_string(),
                U128(PRICE_A - 1),
                14,
                90,
                60,
                AVAILABLE_A,
                true,
                "nonce-a-0001".to_string(),
            );
        },
        "BID_HASH_MISMATCH",
    );

    // Correct reveal works, duplicate reveal fails.
    reveal(
        &mut contract,
        BID_A,
        CONTRACTOR_A,
        PRICE_A,
        14,
        90,
        60,
        AVAILABLE_A,
        "nonce-a-0001",
    );
    set_ctx(CONTRACTOR_A, T0 + 111_000_000_000);
    expect_panic(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_A.to_string(),
                U128(PRICE_A),
                14,
                90,
                60,
                AVAILABLE_A,
                true,
                "nonce-a-0001".to_string(),
            );
        },
        "BID_DUPLICATE",
    );

    // Late reveal fails.
    set_ctx(CONTRACTOR_B, T0 + REVEAL_DEADLINE);
    expect_panic(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_B.to_string(),
                U128(PRICE_B),
                10,
                180,
                80,
                AVAILABLE_B,
                true,
                "nonce-b-0002".to_string(),
            );
        },
        "BID_LATE",
    );
}

#[test]
fn reveals_are_invisible_before_reveal_phase() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    open_and_bid(&mut contract);
    reveal_all(&mut contract);

    // Before the commit deadline no reveal may be returned, even if a reveal
    // had somehow been written.
    set_ctx(STEWARD, T0 + 50_000_000_000);
    let bids = contract.get_bids(WORK_ORDER.to_string()).unwrap();
    assert_eq!(bids.commitments.len(), 3);
    assert!(bids.reveals.is_none());
    assert!(contract
        .get_revealed_bid(WORK_ORDER.to_string(), BID_B.to_string())
        .is_none());

    // During the reveal phase reveals are visible.
    set_ctx(STEWARD, T0 + 110_000_000_000);
    let bids = contract.get_bids(WORK_ORDER.to_string()).unwrap();
    assert_eq!(bids.reveals.unwrap().len(), 3);
    let revealed = contract
        .get_revealed_bid(WORK_ORDER.to_string(), BID_B.to_string())
        .unwrap();
    assert_eq!(revealed.price.0, PRICE_B);
    assert_eq!(revealed.contractor_id, acct(CONTRACTOR_B));
}

#[test]
fn revealed_availability_is_stored_and_exposed() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    open_and_bid(&mut contract);

    // The commit view must never expose availability.
    set_ctx(STEWARD, T0 + 50_000_000_000);
    let bids_json =
        near_sdk::serde_json::to_string(&contract.get_bids(WORK_ORDER.to_string()).unwrap())
            .unwrap();
    assert!(
        !bids_json.contains("availableInDays"),
        "availability must not leak before reveal: {}",
        bids_json
    );

    reveal_all(&mut contract);

    // The reveal event carries the committed availability.
    let logs = near_sdk::test_utils::get_logs();
    assert!(
        logs.iter().any(|line| {
            line.contains("\"event\":\"bid_revealed\"")
                && line.contains("\"available_in_days\":30")
        }),
        "bid_revealed event must expose availability: {:?}",
        logs
    );

    set_ctx(STEWARD, T0 + 110_000_000_000);
    let revealed = contract
        .get_revealed_bid(WORK_ORDER.to_string(), BID_B.to_string())
        .unwrap();
    assert_eq!(revealed.available_in_days, AVAILABLE_B);
    assert_eq!(revealed.price.0, PRICE_B);
    assert_eq!(revealed.duration_days, 10);
    assert_eq!(revealed.warranty_days, 180);

    // The same value is visible in the batch view.
    let bids = contract.get_bids(WORK_ORDER.to_string()).unwrap();
    let all = bids.reveals.expect("reveals visible after commit deadline");
    let bid_b = all.iter().find(|r| r.bid_id == BID_B).unwrap();
    assert_eq!(bid_b.available_in_days, AVAILABLE_B);

    // The canonical preimage matches packages/protocol/src/hashing.ts exactly.
    let payload = bid_commitment_payload(
        BID_B,
        &acct(CONTRACTOR_B),
        PRICE_B,
        10,
        180,
        80,
        AVAILABLE_B,
        true,
        "nonce-b-0002",
    );
    assert_eq!(
        payload,
        "MEND_BID_V2|BID-B-BENCH-001|contractor-b.mend.testnet|80000000|10|180|80|2|1|nonce-b-0002"
    );
}

#[test]
fn changing_availability_after_commit_fails_hash() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));

    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());

    let committed = commitment(
        BID_B,
        CONTRACTOR_B,
        PRICE_B,
        10,
        180,
        80,
        AVAILABLE_B,
        "nonce-b-0002",
    );
    commit(&mut contract, BID_B, CONTRACTOR_B, &committed);

    set_ctx(CONTRACTOR_B, T0 + 110_000_000_000);
    expect_panic(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_B.to_string(),
                U128(PRICE_B),
                10,
                180,
                80,
                AVAILABLE_B + 1,
                true,
                "nonce-b-0002".to_string(),
            );
        },
        "BID_HASH_MISMATCH",
    );

    // Correct availability still reveals.
    reveal(
        &mut contract,
        BID_B,
        CONTRACTOR_B,
        PRICE_B,
        10,
        180,
        80,
        AVAILABLE_B,
        "nonce-b-0002",
    );
    let revealed = contract
        .get_revealed_bid(WORK_ORDER.to_string(), BID_B.to_string())
        .unwrap();
    assert_eq!(revealed.available_in_days, AVAILABLE_B);
}

#[test]
fn absurd_availability_is_rejected() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));

    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());

    let too_far = MAX_AVAILABLE_IN_DAYS + 1;
    let committed = commitment(
        BID_B,
        CONTRACTOR_B,
        PRICE_B,
        10,
        180,
        80,
        too_far,
        "nonce-b-0002",
    );
    commit(&mut contract, BID_B, CONTRACTOR_B, &committed);

    set_ctx(CONTRACTOR_B, T0 + 110_000_000_000);
    expect_panic(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_B.to_string(),
                U128(PRICE_B),
                10,
                180,
                80,
                too_far,
                true,
                "nonce-b-0002".to_string(),
            );
        },
        "available_in_days must be <= 365 days",
    );
    assert!(contract
        .get_revealed_bid(WORK_ORDER.to_string(), BID_B.to_string())
        .is_none());

    // The boundary value is accepted when it was committed.
    let boundary = commitment(
        BID_A,
        CONTRACTOR_A,
        PRICE_A,
        14,
        90,
        60,
        MAX_AVAILABLE_IN_DAYS,
        "nonce-a-0001",
    );
    commit(&mut contract, BID_A, CONTRACTOR_A, &boundary);
    reveal(
        &mut contract,
        BID_A,
        CONTRACTOR_A,
        PRICE_A,
        14,
        90,
        60,
        MAX_AVAILABLE_IN_DAYS,
        "nonce-a-0001",
    );
    assert_eq!(
        contract
            .get_revealed_bid(WORK_ORDER.to_string(), BID_A.to_string())
            .unwrap()
            .available_in_days,
        MAX_AVAILABLE_IN_DAYS
    );
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

#[test]
fn record_score_validates_policy_input_and_completeness() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    open_and_bid(&mut contract);
    reveal_and_close(&mut contract);
    enable_outlayer(&mut contract);
    let input_hash = contract
        .get_score_input(WORK_ORDER.to_string())
        .unwrap()
        .input_hash;

    // Wrong WASM hash when a scoring code is configured.
    set_ctx(STEWARD, T0 + 220_000_000_000);
    expect_panic(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-0001".to_string(),
                POLICY_HASH.to_string(),
                hash('8'),
                input_hash.clone(),
                hash('a'),
                expected_ranking(),
            );
        },
        "not the configured scoring code",
    );

    // Wrong policy.
    set_ctx(STEWARD, T0 + 220_000_000_000);
    expect_panic(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-0001".to_string(),
                hash('0'),
                hash('9'),
                input_hash.clone(),
                hash('a'),
                expected_ranking(),
            );
        },
        "SCORE_POLICY_MISMATCH",
    );

    // Malformed external input hash.
    expect_panic(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-0001".to_string(),
                POLICY_HASH.to_string(),
                hash('9'),
                "not-a-hash".to_string(),
                hash('a'),
                expected_ranking(),
            );
        },
        "input_hash must be 64 lowercase",
    );

    // Missing a revealed bid.
    let mut incomplete = expected_ranking();
    incomplete.pop();
    expect_panic(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-0001".to_string(),
                POLICY_HASH.to_string(),
                hash('9'),
                input_hash.clone(),
                hash('a'),
                incomplete,
            );
        },
        "ranking must contain every revealed bid",
    );

    // Duplicate bid in ranking.
    let mut duplicate = expected_ranking();
    duplicate[1].bid_id = BID_B.to_string();
    duplicate[1].contractor_id = acct(CONTRACTOR_B);
    expect_panic(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-0001".to_string(),
                POLICY_HASH.to_string(),
                hash('9'),
                input_hash.clone(),
                hash('a'),
                duplicate,
            );
        },
        "duplicate bid in ranking",
    );

    // Non-deterministic order.
    let mut wrong_order = expected_ranking();
    wrong_order.swap(0, 1);
    wrong_order[0].rank = 1;
    wrong_order[1].rank = 2;
    expect_panic(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-0001".to_string(),
                POLICY_HASH.to_string(),
                hash('9'),
                input_hash.clone(),
                hash('a'),
                wrong_order,
            );
        },
        "not in deterministic order",
    );

    // Correct score records. The external input hash may use another
    // canonicalization (for example RULES.md's commitment-hash formula); the
    // contract independently binds the actual revealed bid set.
    set_ctx(STEWARD, T0 + 220_000_000_000);
    contract.record_score(
        WORK_ORDER.to_string(),
        "SX-0001".to_string(),
        POLICY_HASH.to_string(),
        hash('9'),
        hash('0'),
        hash('a'),
        expected_ranking(),
    );
    let score = contract.get_score(WORK_ORDER.to_string()).unwrap();
    assert_eq!(score.ranking[0].bid_id, BID_B);
    assert_eq!(score.ranking[0].score_bps, 9_270);
    assert_eq!(score.mode, "recorded");
    assert_eq!(score.input_hash, hash('0'));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        SCORED
    );

    // Second score attempt fails: state is no longer BIDDING_REVEAL.
    expect_panic(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-0002".to_string(),
                POLICY_HASH.to_string(),
                hash('9'),
                hash('a'),
                hash('b'),
                expected_ranking(),
            );
        },
        "scoring requires BIDDING_REVEAL",
    );
}

#[test]
fn award_only_rank_one_and_stale_score_rejected() {
    let mut contract = setup();
    prepare_scored(&mut contract);

    // Non-rank-1 bid cannot be awarded.
    set_ctx(STEWARD, T0 + 230_000_000_000);
    expect_panic(
        || contract.award(WORK_ORDER.to_string(), BID_C.to_string()),
        "only the rank 1 eligible bid can win",
    );
    expect_panic(
        || contract.award(WORK_ORDER.to_string(), BID_A.to_string()),
        "only the rank 1 eligible bid can win",
    );

    // Only steward can award.
    set_ctx(CONTRACTOR_B, T0 + 230_000_000_000);
    expect_panic(
        || contract.award(WORK_ORDER.to_string(), BID_B.to_string()),
        "steward role required",
    );
    set_ctx(INSPECTOR, T0 + 230_000_000_000);
    expect_panic(
        || contract.award(WORK_ORDER.to_string(), BID_B.to_string()),
        "steward role required",
    );

    // A cancelled work order cannot be awarded even with a stored score.
    set_ctx(STEWARD, T0 + 230_000_000_000);
    contract.cancel_work_order(WORK_ORDER.to_string(), hash('f'));
    expect_panic(
        || contract.award(WORK_ORDER.to_string(), BID_B.to_string()),
        "only SCORED work orders can be awarded",
    );

    // A second work order still awards correctly.
    create_work_order_with(
        &mut contract,
        "WO-BENCH-001-0002",
        BUDGET,
        COMMIT_DEADLINE,
        REVEAL_DEADLINE,
    );
    assert_eq!(
        contract
            .get_work_order("WO-BENCH-001-0002".to_string())
            .unwrap()
            .status,
        POLICY_APPROVED
    );
}

#[test]
fn ai_roles_cannot_award_accept_or_refund() {
    let mut contract = setup();
    prepare_scored(&mut contract);

    // Give the AI account every human role too; the explicit AI guard still wins.
    set_ctx(OWNER, T0);
    contract.set_role(acct(REVIEWER), ROLE_STEWARD.to_string(), true);
    contract.set_role(acct(REVIEWER), ROLE_INSPECTOR.to_string(), true);

    set_ctx(REVIEWER, T0 + 230_000_000_000);
    expect_panic(
        || contract.award(WORK_ORDER.to_string(), BID_B.to_string()),
        "AI accounts cannot award",
    );

    // Award using the human steward, then try AI acceptance/refund.
    set_ctx(STEWARD, T0 + 230_000_000_000);
    contract.award(WORK_ORDER.to_string(), BID_B.to_string());
    set_ctx(REVIEWER, T0 + 231_000_000_000);
    expect_panic(
        || contract.refund(WORK_ORDER.to_string()),
        "AI accounts cannot award",
    );

    set_ctx(CONTRACTOR_B, T0 + 240_000_000_000);
    contract.start_work(WORK_ORDER.to_string());
    set_ctx(CONTRACTOR_B, T0 + 250_000_000_000);
    contract.submit_completion(WORK_ORDER.to_string(), "EV-0001".to_string(), hash('b'));
    set_ctx(REVIEWER, T0 + 260_000_000_000);
    expect_panic(
        || {
            contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
        },
        "AI accounts cannot award",
    );
}

// ---------------------------------------------------------------------------
// Completion / inspection separation of duties
// ---------------------------------------------------------------------------

#[test]
fn contractor_cannot_inspect_own_work_and_inspector_must_be_rostered() {
    let mut contract = setup();
    prepare_completion_submitted(&mut contract);

    set_ctx(CONTRACTOR_B, T0 + 260_000_000_000);
    expect_panic(
        || {
            contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
        },
        "CONTRACTOR_SELF_INSPECTION",
    );

    set_ctx(OUTSIDER, T0 + 260_000_000_000);
    expect_panic(
        || {
            contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
        },
        "inspector is not on the approved roster",
    );

    // Evidence replay is rejected.
    set_ctx(INSPECTOR, T0 + 260_000_000_000);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
    // The work order is now DURABILITY_PENDING, so a second acceptance is an
    // invalid transition rather than a double payment.
    set_ctx(INSPECTOR_2, T0 + 261_000_000_000);
    expect_panic(
        || {
            contract.accept_completion(WORK_ORDER.to_string(), "INS-0002".to_string(), hash('d'));
        },
        "completion is not awaiting acceptance",
    );
}

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

#[test]
fn pause_blocks_mutations_and_unpause_restores_exact_state() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());
    let before = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    let before_bids = contract
        .get_bids(WORK_ORDER.to_string())
        .unwrap()
        .commitments
        .len();

    // Steward cannot pause.
    set_ctx(STEWARD, T0 + 2_000_000_000);
    expect_panic(|| contract.pause(hash('a')), "owner or DAO only");

    set_ctx(OWNER, T0 + 2_000_000_000);
    contract.pause(hash('a'));
    assert!(contract.is_paused());

    // Mutations are blocked, state is unchanged.
    set_ctx(STEWARD, T0 + 3_000_000_000);
    expect_panic(
        || contract.close_bidding(WORK_ORDER.to_string()),
        "CONTRACT_PAUSED",
    );
    set_ctx(STEWARD, T0 + 3_000_000_000);
    expect_panic(
        || {
            contract.commit_bid(WORK_ORDER.to_string(), BID_A.to_string(), hash('a'));
        },
        "CONTRACT_PAUSED",
    );
    let during = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    assert_eq!(during.status, before.status);
    assert_eq!(during.updated_at, before.updated_at);
    assert_eq!(
        contract
            .get_bids(WORK_ORDER.to_string())
            .unwrap()
            .commitments
            .len(),
        before_bids
    );

    // Only owner/DAO can unpause; unpause restores the previous state exactly.
    set_ctx(STEWARD, T0 + 4_000_000_000);
    expect_panic(|| contract.unpause(), "owner or DAO only");
    set_ctx(OWNER, T0 + 4_000_000_000);
    contract.unpause();
    assert!(!contract.is_paused());
    let after = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    assert_eq!(after.status, BIDDING_OPEN);
    assert_eq!(after.updated_at, before.updated_at);
    assert_eq!(
        contract
            .get_bids(WORK_ORDER.to_string())
            .unwrap()
            .commitments
            .len(),
        before_bids
    );

    // State-changing actions work again.
    commit_all(&mut contract);
    assert_eq!(
        contract
            .get_bids(WORK_ORDER.to_string())
            .unwrap()
            .commitments
            .len(),
        3
    );
}

// ---------------------------------------------------------------------------
// Disputes and refunds
// ---------------------------------------------------------------------------

#[test]
fn disputes_freeze_payouts_and_only_dao_resolves() {
    let mut contract = setup();
    prepare_awarded(&mut contract);
    let payments_before = contract.get_payments(WORK_ORDER.to_string()).len();

    set_ctx(STEWARD, T0 + 240_000_000_000);
    contract.open_dispute(WORK_ORDER.to_string(), hash('d'));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        DISPUTED
    );
    assert!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .dispute_open
    );
    assert_eq!(
        contract.get_payments(WORK_ORDER.to_string()).len(),
        payments_before
    );

    // Duplicate dispute.
    set_ctx(STEWARD, T0 + 241_000_000_000);
    expect_panic(
        || contract.open_dispute(WORK_ORDER.to_string(), hash('e')),
        "DISPUTE_ALREADY_OPEN",
    );

    // Contract actions are frozen.
    set_ctx(CONTRACTOR_B, T0 + 242_000_000_000);
    expect_panic(
        || contract.start_work(WORK_ORDER.to_string()),
        "work cannot start in this state",
    );

    // Only DAO may resolve.
    set_ctx(STEWARD, T0 + 243_000_000_000);
    expect_panic(
        || {
            contract.resolve_dispute(WORK_ORDER.to_string(), AWARDED.to_string(), hash('f'));
        },
        "DAO only",
    );

    set_ctx(DAO, T0 + 244_000_000_000);
    contract.resolve_dispute(WORK_ORDER.to_string(), AWARDED.to_string(), hash('f'));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        AWARDED
    );
    set_ctx(CONTRACTOR_B, T0 + 245_000_000_000);
    contract.start_work(WORK_ORDER.to_string());
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        IN_PROGRESS
    );

    // Awarded work orders cannot be cancelled.
    set_ctx(STEWARD, T0 + 246_000_000_000);
    expect_panic(
        || contract.cancel_work_order(WORK_ORDER.to_string(), hash('a')),
        "only pre-award work orders can be cancelled",
    );
}

#[test]
fn dispute_refund_cannot_double_pay() {
    let mut contract = setup();
    prepare_awarded(&mut contract);
    set_ctx(STEWARD, T0 + 240_000_000_000);
    contract.open_dispute(WORK_ORDER.to_string(), hash('d'));

    // Resolve to REFUNDED: award escrow (80) goes back to the sponsor.
    set_ctx(DAO, T0 + 241_000_000_000);
    contract.resolve_dispute(WORK_ORDER.to_string(), REFUNDED.to_string(), hash('e'));
    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000);
    assert_eq!(escrow.refunded.0, 100_000_000);
    assert_eq!(escrow.escrowed.0, 0);
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        REFUNDED
    );
    assert_eq!(token_transfer_receipt_count(SPONSOR, 80_000_000), 1);

    // No double refund.
    set_ctx(STEWARD, T0 + 242_000_000_000);
    expect_panic(
        || contract.refund(WORK_ORDER.to_string()),
        "already refunded",
    );
    set_ctx(DAO, T0 + 242_000_000_000);
    expect_panic(
        || {
            contract.resolve_dispute(WORK_ORDER.to_string(), REFUNDED.to_string(), hash('f'));
        },
        "work order is not disputed",
    );
}

#[test]
fn dispute_after_completion_refunds_held_holdback_once() {
    let mut contract = setup();
    prepare_durability_pending(&mut contract);

    set_ctx(STEWARD, T0 + 270_000_000_000);
    contract.open_dispute(WORK_ORDER.to_string(), hash('d'));
    set_ctx(DAO, T0 + 271_000_000_000);
    contract.resolve_dispute(WORK_ORDER.to_string(), REFUNDED.to_string(), hash('e'));

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000);
    assert_eq!(
        escrow.refunded.0, 28_000_000,
        "20 unawarded + 8 held holdback"
    );
    assert_eq!(escrow.escrowed.0, 0);
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 0);
    assert_eq!(escrow.holdback_released.0, 0);
    assert_eq!(token_transfer_receipt_count(SPONSOR, 8_000_000), 1);
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        REFUNDED
    );

    set_ctx(DAO, T0 + 272_000_000_000);
    expect_panic(
        || contract.refund(WORK_ORDER.to_string()),
        "already refunded",
    );
}

#[test]
fn dao_can_close_dispute_after_completion_and_release_holdback_once() {
    let mut contract = setup();
    prepare_durability_pending(&mut contract);

    set_ctx(STEWARD, T0 + 270_000_000_000);
    contract.open_dispute(WORK_ORDER.to_string(), hash('d'));
    set_ctx(DAO, T0 + 271_000_000_000);
    contract.resolve_dispute(WORK_ORDER.to_string(), CLOSED.to_string(), hash('e'));

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000);
    assert_eq!(escrow.refunded.0, 20_000_000);
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 0);
    assert_eq!(escrow.holdback_released.0, 8_000_000);
    assert_eq!(token_transfer_receipt_count(CONTRACTOR_B, 8_000_000), 1);
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        CLOSED
    );
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 3);

    set_ctx(DAO, T0 + 272_000_000_000);
    expect_panic(
        || {
            contract.resolve_dispute(WORK_ORDER.to_string(), CLOSED.to_string(), hash('f'));
        },
        "work order is not disputed",
    );
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 3);
}

#[test]
fn cancel_and_refund_release_exact_escrow_once() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));

    // Pre-award cancellation is allowed.
    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.cancel_work_order(WORK_ORDER.to_string(), hash('d'));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        CANCELLED
    );

    set_ctx(STEWARD, T0 + 4_000_000_000);
    contract.refund(WORK_ORDER.to_string());
    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.refunded.0, BUDGET);
    assert_eq!(escrow.escrowed.0, 0);
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        REFUNDED
    );
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 1);
    assert_eq!(token_transfer_receipt_count(SPONSOR, BUDGET), 1);

    set_ctx(DAO, T0 + 5_000_000_000);
    expect_panic(
        || contract.refund(WORK_ORDER.to_string()),
        "already refunded",
    );
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 1);
}

// ---------------------------------------------------------------------------
// OutLayer request/callback
// ---------------------------------------------------------------------------

#[test]
fn request_score_requires_config_deposit_and_rejects_duplicate() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    open_and_bid(&mut contract);
    reveal_and_close(&mut contract);

    // Disabled by default: no fake OutLayer execution.
    set_ctx_deposit(STEWARD, T0 + 220_000_000_000, MIN_OUTLAYER_DEPOSIT_YOCTO);
    expect_panic(
        || {
            let _ = contract.request_score(WORK_ORDER.to_string());
        },
        "OutLayer scoring is not configured",
    );

    enable_outlayer(&mut contract);

    // Deposit is required.
    set_ctx(STEWARD, T0 + 221_000_000_000);
    expect_panic(
        || {
            let _ = contract.request_score(WORK_ORDER.to_string());
        },
        "attach at least 0.003 NEAR",
    );

    set_ctx_deposit(STEWARD, T0 + 222_000_000_000, MIN_OUTLAYER_DEPOSIT_YOCTO);
    let _ = contract.request_score(WORK_ORDER.to_string());
    let receipts = near_sdk::test_utils::get_created_receipts();
    assert!(receipts
        .iter()
        .any(|receipt| receipt.receiver_id == acct(OUTLAYER)));
    assert!(receipts
        .iter()
        .any(|receipt| receipt.receiver_id == acct(HUB)));

    // Duplicate in-flight request fails and costs no extra execution.
    set_ctx_deposit(STEWARD, T0 + 223_000_000_000, MIN_OUTLAYER_DEPOSIT_YOCTO);
    expect_panic(
        || {
            let _ = contract.request_score(WORK_ORDER.to_string());
        },
        "already pending",
    );
}

#[test]
fn outlayer_callback_settles_and_duplicate_callback_is_ignored() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    open_and_bid(&mut contract);
    reveal_and_close(&mut contract);
    enable_outlayer(&mut contract);

    let input_hash = contract
        .get_score_input(WORK_ORDER.to_string())
        .unwrap()
        .input_hash;
    set_ctx_deposit(STEWARD, T0 + 220_000_000_000, MIN_OUTLAYER_DEPOSIT_YOCTO);
    let _ = contract.request_score(WORK_ORDER.to_string());

    let output = near_sdk::serde_json::json!({
        "schema": "mend.score.v1",
        "winner_bid_id": BID_B,
        "scores": {
            BID_A: 2_873,
            BID_B: 9_270,
            BID_C: 5_200,
        }
    })
    .to_string();
    let output_hash = sha256_hex(output.as_bytes());

    // Only the private self-callback can settle, with promise_result(0).
    let mut builder = context(HUB, T0 + 230_000_000_000, 0);
    builder.predecessor_account_id(acct(HUB));
    testing_env_with_promise_results(
        builder.build(),
        PromiseResult::Successful(output.as_bytes().to_vec()),
    );
    contract.on_score_result(
        WORK_ORDER.to_string(),
        input_hash.clone(),
        POLICY_HASH.to_string(),
    );

    let score = contract.get_score(WORK_ORDER.to_string()).unwrap();
    assert_eq!(score.mode, "outlayer");
    assert_eq!(score.policy_hash, POLICY_HASH);
    assert_eq!(score.wasm_hash, hash('9'));
    assert_eq!(score.input_hash, input_hash);
    assert_eq!(score.output_hash, output_hash);
    assert_eq!(score.ranking[0].bid_id, BID_B);
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        SCORED
    );

    // Duplicate callback is ignored, never pays or changes the ranking.
    let before = contract.get_score(WORK_ORDER.to_string()).unwrap();
    testing_env_with_promise_results(
        builder.build(),
        PromiseResult::Successful(output.as_bytes().to_vec()),
    );
    contract.on_score_result(WORK_ORDER.to_string(), input_hash, POLICY_HASH.to_string());
    let after = contract.get_score(WORK_ORDER.to_string()).unwrap();
    assert_eq!(before.execution_id, after.execution_id);
    assert_eq!(after.ranking[0].score_bps, 9_270);
}

#[test]
fn outlayer_callback_rejects_wrong_winner_failed_promise_and_wrong_hash() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    open_and_bid(&mut contract);
    reveal_and_close(&mut contract);
    enable_outlayer(&mut contract);

    let input_hash = contract
        .get_score_input(WORK_ORDER.to_string())
        .unwrap()
        .input_hash;
    set_ctx_deposit(STEWARD, T0 + 220_000_000_000, MIN_OUTLAYER_DEPOSIT_YOCTO);
    let _ = contract.request_score(WORK_ORDER.to_string());

    // Wrong expected input hash is a stale callback.
    let mut builder = context(HUB, T0 + 230_000_000_000, 0);
    builder.predecessor_account_id(acct(HUB));
    testing_env_with_promise_results(
        builder.build(),
        PromiseResult::Successful(br#"{"schema":"mend.score.v1","winner_bid_id":"BID-A-BENCH-001","scores":{"BID-A-BENCH-001":2873,"BID-B-BENCH-001":9270,"BID-C-BENCH-001":5200}}"#.to_vec()),
    );
    expect_panic(
        || {
            contract.on_score_result(WORK_ORDER.to_string(), hash('0'), POLICY_HASH.to_string());
        },
        "SCORE_STALE",
    );

    // Claimed winner is not the max score: no score is stored.
    testing_env_with_promise_results(
        builder.build(),
        PromiseResult::Successful(br#"{"schema":"mend.score.v1","winner_bid_id":"BID-A-BENCH-001","scores":{"BID-A-BENCH-001":2873,"BID-B-BENCH-001":9270,"BID-C-BENCH-001":5200}}"#.to_vec()),
    );
    contract.on_score_result(
        WORK_ORDER.to_string(),
        input_hash.clone(),
        POLICY_HASH.to_string(),
    );
    assert!(contract.get_score(WORK_ORDER.to_string()).is_none());
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        BIDDING_REVEAL
    );

    // Re-request after a failed settlement, then fail the promise.
    set_ctx_deposit(STEWARD, T0 + 231_000_000_000, MIN_OUTLAYER_DEPOSIT_YOCTO);
    let _ = contract.request_score(WORK_ORDER.to_string());
    testing_env_with_promise_results(builder.build(), PromiseResult::Failed);
    contract.on_score_result(
        WORK_ORDER.to_string(),
        input_hash.clone(),
        POLICY_HASH.to_string(),
    );
    assert!(contract.get_score(WORK_ORDER.to_string()).is_none());
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        BIDDING_REVEAL
    );

    // Re-request and reject malformed JSON.
    set_ctx_deposit(STEWARD, T0 + 232_000_000_000, MIN_OUTLAYER_DEPOSIT_YOCTO);
    let _ = contract.request_score(WORK_ORDER.to_string());
    testing_env_with_promise_results(
        builder.build(),
        PromiseResult::Successful(b"not-json".to_vec()),
    );
    contract.on_score_result(WORK_ORDER.to_string(), input_hash, POLICY_HASH.to_string());
    assert!(contract.get_score(WORK_ORDER.to_string()).is_none());
}

// ---------------------------------------------------------------------------
// Privacy, roles and events
// ---------------------------------------------------------------------------

#[test]
fn public_state_rejects_urls_and_private_evidence() {
    let mut contract = setup();
    set_ctx(STEWARD, T0);
    expect_panic(
        || {
            contract.create_asset(
                ASSET.to_string(),
                "https://private.example/photo.jpg".to_string(),
                hash('e'),
            );
        },
        "EVIDENCE_PRIVATE_URL",
    );
    expect_panic(
        || {
            contract.create_asset(
                ASSET.to_string(),
                hash('d'),
                "precise: 52.5200,13.4050".to_string(),
            );
        },
        "must be 64 lowercase hex",
    );
    assert!(
        contract.get_asset(ASSET.to_string()).is_none(),
        "failed create_asset must not write public state"
    );

    prepare_completion_submitted(&mut contract);
    set_ctx(INSPECTOR, T0 + 260_000_000_000);
    expect_panic(
        || {
            contract.accept_completion(
                WORK_ORDER.to_string(),
                "INS-0001".to_string(),
                "https://private.example/notes".to_string(),
            );
        },
        "EVIDENCE_PRIVATE_URL",
    );

    // The public work-order view contains hashes/IDs only.
    let view = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    assert!(view.scope_hash.len() == 64);
    assert_eq!(view.asset_id, ASSET);
}

#[test]
fn role_and_dao_authorization_boundaries() {
    let mut contract = setup();
    create_asset(&mut contract);

    // Contractor cannot create or authorize work orders.
    set_ctx(CONTRACTOR_A, T0);
    expect_panic(
        || {
            contract.create_work_order(
                "WO-BENCH-001-9999".to_string(),
                ASSET.to_string(),
                hash('1'),
                hash('2'),
                "42".to_string(),
                POLICY_HASH.to_string(),
                U128(BUDGET),
                acct(SPONSOR),
                vec![acct(CONTRACTOR_A)],
                vec![acct(INSPECTOR)],
                COMMIT_DEADLINE,
                REVEAL_DEADLINE,
            );
        },
        "steward or coordinator role required",
    );

    // Coordinator AI may create drafts, but never mint a passport.
    set_ctx(COORDINATOR, T0);
    contract.create_work_order(
        "WO-BENCH-001-0003".to_string(),
        ASSET.to_string(),
        hash('1'),
        hash('2'),
        "42".to_string(),
        POLICY_HASH.to_string(),
        U128(BUDGET),
        acct(SPONSOR),
        vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B)],
        vec![acct(INSPECTOR)],
        COMMIT_DEADLINE,
        REVEAL_DEADLINE,
    );
    expect_panic(
        || contract.mint_passport(ASSET.to_string()),
        "steward role required",
    );

    // Only DAO can authorize, and the proposal id must match.
    set_ctx(STEWARD, T0);
    expect_panic(
        || {
            contract.dao_authorize(
                "WO-BENCH-001-0003".to_string(),
                "42".to_string(),
                hash('2'),
                POLICY_HASH.to_string(),
                U128(BUDGET),
                vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B)],
                vec![acct(INSPECTOR)],
                COMMIT_DEADLINE,
                REVEAL_DEADLINE,
            );
        },
        "DAO only",
    );
    set_ctx(DAO, T0);
    expect_panic(
        || {
            contract.dao_authorize(
                "WO-BENCH-001-0003".to_string(),
                "43".to_string(),
                hash('2'),
                POLICY_HASH.to_string(),
                U128(BUDGET),
                vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B)],
                vec![acct(INSPECTOR)],
                COMMIT_DEADLINE,
                REVEAL_DEADLINE,
            );
        },
        "DAO_APPROVAL_MISMATCH",
    );

    // Roster overlap is rejected.
    set_ctx(DAO, T0);
    expect_panic(
        || {
            contract.dao_authorize(
                "WO-BENCH-001-0003".to_string(),
                "42".to_string(),
                hash('2'),
                POLICY_HASH.to_string(),
                U128(BUDGET),
                vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B)],
                vec![acct(CONTRACTOR_A)],
                COMMIT_DEADLINE,
                REVEAL_DEADLINE,
            );
        },
        "rosters must be disjoint",
    );

    // Non-owner cannot change roles.
    set_ctx(STEWARD, T0);
    expect_panic(
        || contract.set_role(acct(OUTSIDER), ROLE_STEWARD.to_string(), true),
        "owner or DAO only",
    );
}

#[test]
fn commit_after_deadline_and_early_close_fail() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());

    // Close before the reveal deadline.
    set_ctx(STEWARD, T0 + 50_000_000_000);
    expect_panic(
        || contract.close_bidding(WORK_ORDER.to_string()),
        "reveal deadline has not passed",
    );

    // Commit exactly at the deadline is late.
    set_ctx(CONTRACTOR_A, COMMIT_DEADLINE);
    expect_panic(
        || {
            contract.commit_bid(WORK_ORDER.to_string(), BID_A.to_string(), hash('a'));
        },
        "commit deadline has passed",
    );
}

#[test]
fn evidence_replay_and_premature_acceptance_are_rejected() {
    let mut contract = setup();
    prepare_durability_pending(&mut contract);
    let due = contract
        .get_work_order(WORK_ORDER.to_string())
        .unwrap()
        .durability_due_at
        .unwrap();
    set_ctx(INSPECTOR_2, due + 1);
    contract.inspect_durability(
        WORK_ORDER.to_string(),
        false,
        "INS-0002".to_string(),
        hash('f'),
    );
    set_ctx(CONTRACTOR_B, due + 2);
    contract.start_work(WORK_ORDER.to_string());

    // The original completion evidence cannot be replayed during remediation.
    set_ctx(CONTRACTOR_B, due + 3);
    expect_panic(
        || {
            contract.submit_completion(WORK_ORDER.to_string(), "EV-0001".to_string(), hash('b'));
        },
        "EVIDENCE_REPLAY",
    );

    // A different evidence package is accepted.
    contract.submit_completion(WORK_ORDER.to_string(), "EV-0002".to_string(), hash('d'));
    assert_eq!(
        contract
            .get_work_order(WORK_ORDER.to_string())
            .unwrap()
            .status,
        COMPLETION_SUBMITTED
    );
}

#[test]
fn premature_acceptance_and_non_awarded_contractor_actions_fail() {
    let mut contract = setup();
    prepare_awarded(&mut contract);

    // Not started yet: acceptance is premature.
    set_ctx(INSPECTOR, T0 + 240_000_000_000);
    expect_panic(
        || {
            contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
        },
        "completion is not awaiting acceptance",
    );

    // Non-awarded contractor cannot start or submit.
    set_ctx(CONTRACTOR_A, T0 + 240_000_000_000);
    expect_panic(
        || contract.start_work(WORK_ORDER.to_string()),
        "only the awarded contractor can start work",
    );

    set_ctx(CONTRACTOR_B, T0 + 241_000_000_000);
    contract.start_work(WORK_ORDER.to_string());
    set_ctx(CONTRACTOR_A, T0 + 242_000_000_000);
    expect_panic(
        || {
            contract.submit_completion(WORK_ORDER.to_string(), "EV-0001".to_string(), hash('b'));
        },
        "only the awarded contractor can submit completion",
    );

    // Inspector cannot start the contractor's work.
    set_ctx(INSPECTOR, T0 + 243_000_000_000);
    expect_panic(
        || contract.start_work(WORK_ORDER.to_string()),
        "work cannot start in this state",
    );
}

#[test]
fn public_json_uses_protocol_camel_case() {
    let contract = setup();
    let config = near_sdk::serde_json::to_value(contract.get_config()).unwrap();
    assert!(config.get("durabilityMinutes").is_some());
    assert!(config.get("durability_minutes").is_none());
    assert!(config.get("scoringWasmHash").is_some());

    let rank = ScoredRank {
        rank: 1,
        bid_id: "BID-B-BENCH-001".to_string(),
        contractor_id: acct(CONTRACTOR_B),
        score_bps: 9_270,
    };
    let rank = near_sdk::serde_json::to_value(rank).unwrap();
    assert_eq!(rank["bidId"], "BID-B-BENCH-001");
    assert_eq!(rank["contractorId"], CONTRACTOR_B);
    assert_eq!(rank["scoreBps"], 9_270);
    assert!(rank.get("bid_id").is_none());

    // The internal event envelope keeps the protocol's snake_case data keys.
    assert_eq!(EVENT_STANDARD, "mend");
    assert_eq!(EVENT_VERSION, "1.0.0");
}

#[test]
fn every_state_change_emits_mend_event_json() {
    let mut contract = setup();
    create_asset(&mut contract);
    create_work_order_with(
        &mut contract,
        WORK_ORDER,
        BUDGET,
        COMMIT_DEADLINE,
        REVEAL_DEADLINE,
    );
    assert_eq!(fund(&mut contract, BUDGET), U128(0));

    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());
    let logs = near_sdk::test_utils::get_logs();
    let event_log = logs
        .iter()
        .find(|log| log.starts_with("EVENT_JSON:"))
        .expect("EVENT_JSON log");
    let payload: Value =
        near_sdk::serde_json::from_str(event_log.trim_start_matches("EVENT_JSON:"))
            .expect("valid event JSON");
    assert_eq!(payload["standard"], "mend");
    assert_eq!(payload["version"], "1.0.0");
    assert_eq!(payload["event"], "bidding_opened");
    assert_eq!(payload["data"]["work_order_id"], WORK_ORDER);
    assert_eq!(payload["data"]["asset_id"], ASSET);
    assert_eq!(payload["data"]["actor"], STEWARD);
    assert!(payload["data"]["timestamp_ns"]
        .as_str()
        .unwrap()
        .parse::<u64>()
        .is_ok());
}

#[test]
fn config_views_and_reconciliation_are_public_and_hashes_only() {
    let mut contract = setup();
    let config = contract.get_config();
    assert_eq!(config.owner, acct(OWNER));
    assert_eq!(config.token, acct(TOKEN));
    assert_eq!(config.dao, acct(DAO));
    assert_eq!(config.durability_minutes, 2);
    assert!(!config.paused);
    assert!(!config.scoring_enabled);

    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    let reconciliation = contract.get_reconciliation();
    assert_eq!(reconciliation.total_funding.0, BUDGET);
    assert_eq!(reconciliation.total_refunded.0, 0);
    assert_eq!(reconciliation.total_completion_paid.0, 0);
    assert_eq!(reconciliation.total_holdback_released.0, 0);

    // `get_work_orders_by_asset` is a stable lineage view.
    assert_eq!(
        contract.get_work_orders_by_asset(ASSET.to_string()),
        vec![WORK_ORDER.to_string()]
    );
    assert_eq!(contract.get_role(acct(OUTSIDER)), Vec::<String>::new());
    assert_eq!(
        contract.get_role(acct(STEWARD)),
        vec![ROLE_STEWARD.to_string()]
    );
}

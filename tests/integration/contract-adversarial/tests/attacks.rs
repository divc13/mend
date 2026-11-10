//! Independent adversarial tests for the MEND hub.
//!
//! These tests intentionally do not use `contracts/hub/src/tests.rs`. They
//! instantiate the contract and call only its public API (the same entry points
//! a deployed contract exposes), then assert refusals and accounting invariants.
//! They run in a NEAR SDK unit-test VM: cross-contract token transfers are
//! inspected as receipts, not executed, and no fake balances are invented.

use mend_hub::*;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, NearToken, PromiseOrValue};

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
const RELAYER: &str = "relayer.mend.testnet";
const CONTRACTOR_A: &str = "contractor-a.mend.testnet";
const CONTRACTOR_B: &str = "contractor-b.mend.testnet";
const CONTRACTOR_C: &str = "contractor-c.mend.testnet";
const INSPECTOR: &str = "inspector.mend.testnet";
const INSPECTOR_2: &str = "inspector-2.mend.testnet";
const OUTSIDER: &str = "outsider.mend.testnet";

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
    value.parse().expect("valid account")
}

fn hash(ch: char) -> String {
    ch.to_string().repeat(64)
}

fn set_ctx(predecessor: &str, timestamp: u64) {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(acct(HUB))
        .signer_account_id(acct(predecessor))
        .predecessor_account_id(acct(predecessor))
        .block_timestamp(timestamp)
        .attached_deposit(NearToken::from_yoctonear(0))
        .account_balance(NearToken::from_near(10_000));
    testing_env!(builder.build());
}

fn panic_message<F: FnOnce()>(f: F) -> String {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
    let error = result.expect_err("expected the contract to reject this action");
    if let Some(message) = error.downcast_ref::<String>() {
        return message.clone();
    }
    if let Some(message) = error.downcast_ref::<&str>() {
        return message.to_string();
    }
    String::new()
}

fn expect_rejected<F: FnOnce()>(f: F, needle: &str) {
    let message = panic_message(f);
    assert!(
        message.contains(needle),
        "expected rejection containing {needle:?}, got {message:?}"
    );
}

fn setup() -> Contract {
    set_ctx(OWNER, T0);
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
    for (account, role) in [
        (STEWARD, ROLE_STEWARD),
        (ORACLE, ROLE_ORACLE),
        (COORDINATOR, ROLE_COORDINATOR_AI),
        (REVIEWER, ROLE_REVIEWER_AI),
        (CONTRACTOR_A, ROLE_CONTRACTOR),
        (CONTRACTOR_B, ROLE_CONTRACTOR),
        (CONTRACTOR_C, ROLE_CONTRACTOR),
        (INSPECTOR, ROLE_INSPECTOR),
        (INSPECTOR_2, ROLE_INSPECTOR),
        (RELAYER, ROLE_RELAYER),
    ] {
        contract.set_role(acct(account), role.to_string(), true);
    }
    contract
}

fn create_asset(contract: &mut Contract) {
    set_ctx(STEWARD, T0);
    contract.create_asset(ASSET.to_string(), hash('d'), hash('e'));
}

#[allow(clippy::too_many_arguments)]
fn create_work_order_raw(
    contract: &mut Contract,
    contractors: Vec<AccountId>,
    inspectors: Vec<AccountId>,
) {
    set_ctx(STEWARD, T0);
    contract.create_work_order(
        WORK_ORDER.to_string(),
        ASSET.to_string(),
        hash('1'),
        hash('2'),
        "42".to_string(),
        POLICY_HASH.to_string(),
        U128(BUDGET),
        acct(SPONSOR),
        contractors.clone(),
        inspectors.clone(),
        COMMIT_DEADLINE,
        REVEAL_DEADLINE,
    );
    set_ctx(DAO, T0);
    contract.dao_authorize(
        WORK_ORDER.to_string(),
        "42".to_string(),
        hash('2'),
        POLICY_HASH.to_string(),
        U128(BUDGET),
        contractors,
        inspectors,
        COMMIT_DEADLINE,
        REVEAL_DEADLINE,
    );
}

fn make_work_order(contract: &mut Contract) {
    create_asset(contract);
    create_work_order_raw(
        contract,
        vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B), acct(CONTRACTOR_C)],
        vec![acct(INSPECTOR), acct(INSPECTOR_2)],
    );
}

fn fund(contract: &mut Contract, amount: u128) -> U128 {
    set_ctx(TOKEN, T0);
    match contract.ft_on_transfer(acct(SPONSOR), U128(amount), WORK_ORDER.to_string()) {
        PromiseOrValue::Value(value) => value,
        _ => panic!("ft_on_transfer must return synchronously"),
    }
}

fn commitment(
    bid_id: &str,
    contractor: &str,
    price: u128,
    duration: u32,
    warranty: u32,
    materials: u32,
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
            2,
            true,
            nonce,
        )
        .as_bytes(),
    )
}

fn commit(contract: &mut Contract, bid_id: &str, contractor: &str, commitment_hash: &str) {
    set_ctx(contractor, T0 + 2_000_000_000);
    contract.commit_bid(
        WORK_ORDER.to_string(),
        bid_id.to_string(),
        commitment_hash.to_string(),
    );
}

fn commit_all(contract: &mut Contract) {
    commit(
        contract,
        BID_A,
        CONTRACTOR_A,
        &commitment(BID_A, CONTRACTOR_A, PRICE_A, 14, 90, 60, "nonce-a-0001"),
    );
    commit(
        contract,
        BID_B,
        CONTRACTOR_B,
        &commitment(BID_B, CONTRACTOR_B, PRICE_B, 10, 180, 80, "nonce-b-0002"),
    );
    commit(
        contract,
        BID_C,
        CONTRACTOR_C,
        &commitment(BID_C, CONTRACTOR_C, PRICE_C, 21, 30, 70, "nonce-c-0003"),
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
        2,
        true,
        nonce.to_string(),
    );
}

fn reveal_all(contract: &mut Contract) {
    reveal(contract, BID_A, CONTRACTOR_A, PRICE_A, 14, 90, 60, "nonce-a-0001");
    reveal(contract, BID_B, CONTRACTOR_B, PRICE_B, 10, 180, 80, "nonce-b-0002");
    reveal(contract, BID_C, CONTRACTOR_C, PRICE_C, 21, 30, 70, "nonce-c-0003");
}

fn open_and_bid(contract: &mut Contract) {
    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());
    commit_all(contract);
}

fn close_bidding(contract: &mut Contract) {
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

fn record_canonical_score(contract: &mut Contract) {
    let input_hash = contract
        .get_score_input(WORK_ORDER.to_string())
        .expect("canonical score input")
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

fn prepare_bidding_reveal(contract: &mut Contract) {
    make_work_order(contract);
    assert_eq!(fund(contract, BUDGET), U128(0));
    open_and_bid(contract);
    reveal_all(contract);
    close_bidding(contract);
}

fn prepare_scored(contract: &mut Contract) {
    prepare_bidding_reveal(contract);
    record_canonical_score(contract);
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

fn prepare_durability_pending(contract: &mut Contract) -> u64 {
    prepare_completion_submitted(contract);
    set_ctx(INSPECTOR, T0 + 260_000_000_000);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
    contract
        .get_work_order(WORK_ORDER.to_string())
        .unwrap()
        .durability_due_at
        .unwrap()
}

// ---------------------------------------------------------------------------
// Required attack matrix
// ---------------------------------------------------------------------------

#[test]
fn passport_transfer_and_approval_always_fail() {
    let mut contract = setup();
    create_asset(&mut contract);
    set_ctx(STEWARD, T0);
    contract.mint_passport(ASSET.to_string());

    let token = contract
        .nft_token(ASSET.to_string())
        .expect("passport token exists");
    assert_eq!(token.owner_id, acct(HUB), "passport holder is the registry, not a user");

    set_ctx(OUTSIDER, T0);
    expect_rejected(
        || {
            contract.nft_transfer(acct(OUTSIDER), ASSET.to_string(), None, None);
        },
        "TRANSFER_DISABLED",
    );
    expect_rejected(
        || {
            contract.nft_transfer_call(
                acct(OUTSIDER),
                ASSET.to_string(),
                None,
                None,
                "{}".to_string(),
            );
        },
        "TRANSFER_DISABLED",
    );
    expect_rejected(
        || {
            contract.nft_approve(ASSET.to_string(), acct(OUTSIDER), None);
        },
        "TRANSFER_DISABLED",
    );
    expect_rejected(
        || {
            contract.nft_revoke(ASSET.to_string(), acct(OUTSIDER));
        },
        "TRANSFER_DISABLED",
    );
    expect_rejected(
        || {
            contract.nft_revoke_all(ASSET.to_string());
        },
        "TRANSFER_DISABLED",
    );
    assert_eq!(contract.nft_token(ASSET.to_string()).unwrap().owner_id, acct(HUB));
}

#[test]
fn contractor_cannot_inspect_or_accept_their_own_work() {
    let mut contract = setup();
    prepare_completion_submitted(&mut contract);

    set_ctx(CONTRACTOR_B, T0 + 270_000_000_000);
    expect_rejected(
        || {
            contract.accept_completion(
                WORK_ORDER.to_string(),
                "INS-SELF".to_string(),
                hash('c'),
            );
        },
        "CONTRACTOR_SELF_INSPECTION",
    );

    set_ctx(OUTSIDER, T0 + 270_000_000_000);
    expect_rejected(
        || {
            contract.accept_completion(
                WORK_ORDER.to_string(),
                "INS-OUTSIDER".to_string(),
                hash('c'),
            );
        },
        "inspector is not on the approved roster",
    );

    // A rostered inspector can accept, proving the rejection above was about
    // separation of duties rather than the happy path being broken.
    set_ctx(INSPECTOR, T0 + 280_000_000_000);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        DURABILITY_PENDING
    );
}

#[test]
fn inspector_cannot_self_award_and_rosters_must_be_disjoint() {
    let mut contract = setup();
    prepare_scored(&mut contract);

    set_ctx(INSPECTOR, T0 + 230_000_000_000);
    expect_rejected(
        || {
            contract.award(WORK_ORDER.to_string(), BID_B.to_string());
        },
        "steward role required",
    );
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        SCORED,
        "denied award must not change state"
    );

    // The DAO cannot approve a work order where the contractor's own account
    // appears on the inspector roster.
    let mut second = setup();
    create_asset(&mut second);
    set_ctx(STEWARD, T0);
    expect_rejected(
        || {
            second.create_work_order(
                "WO-BENCH-001-0002".to_string(),
                ASSET.to_string(),
                hash('1'),
                hash('2'),
                "43".to_string(),
                POLICY_HASH.to_string(),
                U128(BUDGET),
                acct(SPONSOR),
                vec![acct(CONTRACTOR_A), acct(CONTRACTOR_B)],
                vec![acct(CONTRACTOR_A), acct(INSPECTOR)],
                COMMIT_DEADLINE,
                REVEAL_DEADLINE,
            );
        },
        "roster",
    );
}

#[test]
fn wrong_token_paused_and_replayed_funding_are_refunded_without_credit() {
    let mut contract = setup();
    make_work_order(&mut contract);

    // Wrong token: full amount returned, nothing credited, state unchanged.
    set_ctx(WRONG_TOKEN, T0);
    let returned = match contract.ft_on_transfer(
        acct(SPONSOR),
        U128(BUDGET),
        WORK_ORDER.to_string(),
    ) {
        PromiseOrValue::Value(value) => value,
        _ => panic!("value expected"),
    };
    assert_eq!(returned, U128(BUDGET));
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        POLICY_APPROVED
    );
    assert_eq!(contract.get_escrow(WORK_ORDER.to_string()).unwrap().funding.0, 0);

    // Pause bypass: funding is returned while paused, then works after unpause.
    set_ctx(OWNER, T0);
    contract.pause(hash('9'));
    set_ctx(TOKEN, T0);
    let returned = match contract.ft_on_transfer(
        acct(SPONSOR),
        U128(BUDGET),
        WORK_ORDER.to_string(),
    ) {
        PromiseOrValue::Value(value) => value,
        _ => panic!("value expected"),
    };
    assert_eq!(returned, U128(BUDGET));
    assert_eq!(contract.get_escrow(WORK_ORDER.to_string()).unwrap().funding.0, 0);

    set_ctx(OWNER, T0);
    contract.unpause();
    assert_eq!(fund(&mut contract, BUDGET), U128(0));

    // Duplicate funding is returned in full and cannot mint escrow.
    let returned = match contract.ft_on_transfer(
        acct(SPONSOR),
        U128(BUDGET),
        WORK_ORDER.to_string(),
    ) {
        PromiseOrValue::Value(value) => value,
        _ => panic!("value expected"),
    };
    assert_eq!(returned, U128(BUDGET));
    assert_eq!(contract.get_escrow(WORK_ORDER.to_string()).unwrap().funding.0, BUDGET);
}

#[test]
fn early_and_late_reveals_and_early_close_are_rejected() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));
    set_ctx(STEWARD, T0 + 1_000_000_000);
    contract.open_bidding(WORK_ORDER.to_string());
    commit(
        &mut contract,
        BID_B,
        CONTRACTOR_B,
        &commitment(BID_B, CONTRACTOR_B, PRICE_B, 10, 180, 80, "nonce-b-0002"),
    );

    // Early reveal, before the commit deadline.
    set_ctx(CONTRACTOR_B, T0 + 2_000_000_000);
    expect_rejected(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_B.to_string(),
                U128(PRICE_B),
                10,
                180,
                80,
                2,
                true,
                "nonce-b-0002".to_string(),
            );
        },
        "BID_EARLY_REVEAL",
    );

    // Early close, before the reveal deadline.
    set_ctx(STEWARD, T0 + 2_000_000_000);
    expect_rejected(
        || {
            contract.close_bidding(WORK_ORDER.to_string());
        },
        "BID_LATE",
    );

    // Late reveal, at/after the reveal deadline.
    set_ctx(CONTRACTOR_B, REVEAL_DEADLINE);
    expect_rejected(
        || {
            contract.reveal_bid(
                WORK_ORDER.to_string(),
                BID_B.to_string(),
                U128(PRICE_B),
                10,
                180,
                80,
                2,
                true,
                "nonce-b-0002".to_string(),
            );
        },
        "BID_LATE",
    );

    // Late commit, at the commit deadline.
    set_ctx(CONTRACTOR_C, COMMIT_DEADLINE);
    expect_rejected(
        || {
            contract.commit_bid(
                WORK_ORDER.to_string(),
                BID_C.to_string(),
                commitment(BID_C, CONTRACTOR_C, PRICE_C, 21, 30, 70, "nonce-c-0003"),
            );
        },
        "BID_LATE",
    );

    // No reveal ever happened, so scoring cannot invent a winner.
    set_ctx(STEWARD, T0 + 210_000_000_000);
    contract.close_bidding(WORK_ORDER.to_string());
    expect_rejected(
        || {
            let input_hash = contract
                .get_score_input(WORK_ORDER.to_string())
                .map(|view| view.input_hash)
                .unwrap_or_else(|| hash('0'));
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-BAD".to_string(),
                POLICY_HASH.to_string(),
                hash('8'),
                input_hash,
                hash('a'),
                expected_ranking(),
            );
        },
        "SCORE_INVALID",
    );
}

#[test]
fn replay_and_double_payment_are_rejected() {
    let mut contract = setup();
    let due = prepare_durability_pending(&mut contract);
    let payments_before = contract.get_payments(WORK_ORDER.to_string()).len();
    assert_eq!(payments_before, 2);

    // Replay the completion acceptance.
    set_ctx(INSPECTOR, T0 + 270_000_000_000);
    expect_rejected(
        || {
            contract.accept_completion(
                WORK_ORDER.to_string(),
                "INS-REPLAY".to_string(),
                hash('c'),
            );
        },
        "completion is not awaiting acceptance",
    );

    // Early durability inspection cannot release the holdback.
    set_ctx(INSPECTOR_2, due - 1);
    expect_rejected(
        || {
            contract.inspect_durability(
                WORK_ORDER.to_string(),
                true,
                "INS-0002".to_string(),
                hash('f'),
            );
        },
        "not due",
    );

    set_ctx(INSPECTOR_2, due + 1);
    contract.inspect_durability(
        WORK_ORDER.to_string(),
        true,
        "INS-0002".to_string(),
        hash('f'),
    );
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 3);

    // Replay the durability acceptance after CLOSED.
    set_ctx(INSPECTOR_2, due + 2);
    expect_rejected(
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

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000);
    assert_eq!(escrow.refunded.0, 20_000_000);
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_released.0, 8_000_000);
    assert_eq!(escrow.holdback_held.0, 0);
}

#[test]
fn cancel_refund_cannot_double_pay() {
    let mut contract = setup();
    make_work_order(&mut contract);
    assert_eq!(fund(&mut contract, BUDGET), U128(0));

    set_ctx(STEWARD, T0);
    contract.cancel_work_order(WORK_ORDER.to_string(), hash('7'));
    contract.refund(WORK_ORDER.to_string());
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 1);
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        REFUNDED
    );

    expect_rejected(
        || {
            contract.refund(WORK_ORDER.to_string());
        },
        "DOUBLE_PAYMENT",
    );
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 1);
}

#[test]
fn wrong_policy_wrong_wasm_and_non_rank_one_award_are_rejected() {
    let mut contract = setup();
    prepare_bidding_reveal(&mut contract);

    // Wrong policy hash.
    let input_hash = contract
        .get_score_input(WORK_ORDER.to_string())
        .unwrap()
        .input_hash;
    set_ctx(STEWARD, T0 + 220_000_000_000);
    expect_rejected(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-WRONG-POLICY".to_string(),
                hash('0'),
                hash('8'),
                input_hash.clone(),
                hash('a'),
                expected_ranking(),
            );
        },
        "SCORE_POLICY_MISMATCH",
    );

    // Configure a pinned scoring WASM, then present a different hash. OutLayer
    // is not faked: configuration is explicit and the mismatch is refused.
    set_ctx(OWNER, T0 + 220_000_000_000);
    contract.set_outlayer_config(acct("outlayer.testnet"), "mend.testnet/bid-rules".to_string(), hash('9'), true);
    let input_hash = contract
        .get_score_input(WORK_ORDER.to_string())
        .unwrap()
        .input_hash;
    set_ctx(STEWARD, T0 + 220_000_000_000);
    expect_rejected(
        || {
            contract.record_score(
                WORK_ORDER.to_string(),
                "SX-WRONG-WASM".to_string(),
                POLICY_HASH.to_string(),
                hash('8'),
                input_hash,
                hash('a'),
                expected_ranking(),
            );
        },
        "WASM hash is not the configured scoring code",
    );

    // A correct score is recorded, but only rank 1 can be awarded. Clear the
    // pinned hash first so this test uses the plain recorded-score path (the
    // wrong-WASM refusal above was already proven).
    set_ctx(OWNER, T0 + 220_000_000_000);
    contract.set_outlayer_config(
        acct("outlayer.testnet"),
        "mend.testnet/bid-rules".to_string(),
        String::new(),
        false,
    );
    record_canonical_score(&mut contract);
    set_ctx(STEWARD, T0 + 230_000_000_000);
    expect_rejected(
        || {
            contract.award(WORK_ORDER.to_string(), BID_C.to_string());
        },
        "only the rank 1 eligible bid can win",
    );
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        SCORED
    );

    // AI accounts are refused even if someone also grants them a human role.
    set_ctx(OWNER, T0 + 230_000_000_000);
    contract.set_role(acct(COORDINATOR), ROLE_STEWARD.to_string(), true);
    set_ctx(COORDINATOR, T0 + 230_000_000_000);
    expect_rejected(
        || {
            contract.award(WORK_ORDER.to_string(), BID_B.to_string());
        },
        "AI accounts cannot award, accept, refund or release funds",
    );
}

#[test]
fn ai_roles_cannot_accept_or_release_funds() {
    let mut contract = setup();
    prepare_completion_submitted(&mut contract);

    // Give the reviewer a human inspector role as well; the AI check must still
    // take precedence and prevent final acceptance.
    set_ctx(OWNER, T0 + 270_000_000_000);
    contract.set_role(acct(REVIEWER), ROLE_INSPECTOR.to_string(), true);
    set_ctx(REVIEWER, T0 + 270_000_000_000);
    expect_rejected(
        || {
            contract.accept_completion(
                WORK_ORDER.to_string(),
                "INS-AI".to_string(),
                hash('c'),
            );
        },
        "AI accounts cannot award, accept, refund or release funds",
    );

    // A coordinator with a steward role still cannot refund.
    set_ctx(OWNER, T0 + 270_000_000_000);
    contract.set_role(acct(COORDINATOR), ROLE_STEWARD.to_string(), true);
    set_ctx(COORDINATOR, T0 + 270_000_000_000);
    expect_rejected(
        || {
            contract.refund(WORK_ORDER.to_string());
        },
        "AI accounts cannot award, accept, refund or release funds",
    );

    // And a coordinator cannot submit work on behalf of a contractor.
    set_ctx(COORDINATOR, T0 + 270_000_000_000);
    expect_rejected(
        || {
            contract.submit_completion(
                WORK_ORDER.to_string(),
                "EV-AI".to_string(),
                hash('b'),
            );
        },
        "AI accounts cannot award, accept, refund or release funds",
    );
}

#[test]
fn warranty_reopening_creates_no_new_funds_and_releases_holdback_once() {
    let mut contract = setup();
    let due = prepare_durability_pending(&mut contract);

    set_ctx(INSPECTOR_2, due + 1);
    contract.inspect_durability(
        WORK_ORDER.to_string(),
        false,
        "INS-FAIL".to_string(),
        hash('f'),
    );

    let wo = contract.get_work_order(WORK_ORDER.to_string()).unwrap();
    assert_eq!(wo.status, WARRANTY_REOPENED);
    assert_eq!(wo.reopen_count, 1);
    assert_eq!(wo.awarded_bid_id.as_deref(), Some(BID_B), "same work order");
    assert_eq!(wo.awarded_contractor, Some(acct(CONTRACTOR_B)));

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.funding.0, 100_000_000, "no new funding on reopen");
    assert_eq!(escrow.completion_paid.0, 72_000_000);
    assert_eq!(escrow.holdback_held.0, 8_000_000);
    assert_eq!(escrow.holdback_released.0, 0);

    // Even a real token callback cannot add funds to a reopened order.
    set_ctx(TOKEN, due + 2);
    let returned = match contract.ft_on_transfer(
        acct(SPONSOR),
        U128(BUDGET),
        WORK_ORDER.to_string(),
    ) {
        PromiseOrValue::Value(value) => value,
        _ => panic!("value expected"),
    };
    assert_eq!(returned, U128(BUDGET));
    assert_eq!(
        contract.get_escrow(WORK_ORDER.to_string()).unwrap().funding.0,
        100_000_000
    );

    // Remediation on the same work order: no second completion payment.
    set_ctx(CONTRACTOR_B, due + 10);
    contract.start_work(WORK_ORDER.to_string());
    set_ctx(CONTRACTOR_B, due + 20);
    contract.submit_completion(WORK_ORDER.to_string(), "EV-0002".to_string(), hash('d'));
    set_ctx(INSPECTOR, due + 30);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-REM".to_string(), hash('e'));

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.completion_paid.0, 72_000_000, "no duplicate completion pay");
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
        "INS-REM-PASS".to_string(),
        hash('f'),
    );

    let escrow = contract.get_escrow(WORK_ORDER.to_string()).unwrap();
    assert_eq!(escrow.holdback_released.0, 8_000_000);
    assert_eq!(escrow.holdback_held.0, 0);
    assert_eq!(contract.get_payments(WORK_ORDER.to_string()).len(), 3);
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        CLOSED
    );
}

#[test]
fn pause_blocks_agent_actions_and_unpause_restores_the_same_state() {
    let mut contract = setup();
    prepare_scored(&mut contract);

    set_ctx(OWNER, T0 + 229_000_000_000);
    contract.pause(hash('6'));
    set_ctx(STEWARD, T0 + 230_000_000_000);
    expect_rejected(
        || {
            contract.award(WORK_ORDER.to_string(), BID_B.to_string());
        },
        "CONTRACT_PAUSED",
    );
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        SCORED
    );

    set_ctx(OWNER, T0 + 231_000_000_000);
    contract.unpause();
    set_ctx(STEWARD, T0 + 232_000_000_000);
    contract.award(WORK_ORDER.to_string(), BID_B.to_string());
    assert_eq!(
        contract.get_work_order(WORK_ORDER.to_string()).unwrap().status,
        AWARDED
    );

    // Pause also stops bids, and unpause restores the same bidding state.
    let mut bidding = setup();
    make_work_order(&mut bidding);
    assert_eq!(fund(&mut bidding, BUDGET), U128(0));
    set_ctx(STEWARD, T0 + 1_000_000_000);
    bidding.open_bidding(WORK_ORDER.to_string());
    set_ctx(OWNER, T0 + 1_500_000_000);
    bidding.pause(hash('5'));
    set_ctx(CONTRACTOR_B, T0 + 2_000_000_000);
    expect_rejected(
        || {
            bidding.commit_bid(
                WORK_ORDER.to_string(),
                BID_B.to_string(),
                commitment(BID_B, CONTRACTOR_B, PRICE_B, 10, 180, 80, "nonce-b-0002"),
            );
        },
        "CONTRACT_PAUSED",
    );
    set_ctx(OWNER, T0 + 2_500_000_000);
    bidding.unpause();
    set_ctx(CONTRACTOR_B, T0 + 2_500_000_000);
    bidding.commit_bid(
        WORK_ORDER.to_string(),
        BID_B.to_string(),
        commitment(BID_B, CONTRACTOR_B, PRICE_B, 10, 180, 80, "nonce-b-0002"),
    );
}

#[test]
fn public_state_rejects_urls_and_exposes_only_ids_and_hashes() {
    let mut url_contract = setup();
    create_asset(&mut url_contract);

    // Evidence/location hashes must be hashes, never URLs.
    set_ctx(STEWARD, T0);
    expect_rejected(
        || {
            url_contract.create_asset(
                "RACK-002".to_string(),
                "https://private-bucket.example/raw-media.jpg".to_string(),
                hash('e'),
            );
        },
        "EVIDENCE_PRIVATE_URL",
    );

    let mut contract = setup();
    prepare_awarded(&mut contract);
    set_ctx(CONTRACTOR_B, T0 + 240_000_000_000);
    contract.start_work(WORK_ORDER.to_string());
    set_ctx(CONTRACTOR_B, T0 + 250_000_000_000);
    contract.submit_completion(WORK_ORDER.to_string(), "EV-0001".to_string(), hash('b'));
    set_ctx(INSPECTOR, T0 + 260_000_000_000);
    contract.accept_completion(WORK_ORDER.to_string(), "INS-0001".to_string(), hash('c'));

    let views = [
        serde_json::to_string(&contract.get_asset(ASSET.to_string()).unwrap()).unwrap(),
        serde_json::to_string(&contract.get_work_order(WORK_ORDER.to_string()).unwrap()).unwrap(),
        serde_json::to_string(&contract.get_score(WORK_ORDER.to_string()).unwrap()).unwrap(),
        serde_json::to_string(&contract.get_payments(WORK_ORDER.to_string())).unwrap(),
        serde_json::to_string(&contract.get_history(ASSET.to_string())).unwrap(),
    ];
    for view in views {
        let lower = view.to_lowercase();
        for forbidden in [
            "http://",
            "https://",
            "preciselat",
            "preciselng",
            "rawmedia",
            "evidenceurl",
            "depositaddress",
            "api_key",
            "private_key",
        ] {
            assert!(
                !lower.contains(forbidden),
                "public contract view leaked {forbidden:?}: {view}"
            );
        }
    }
}

#[test]
fn only_relayable_methods_exist_for_the_relayer_allowlist() {
    // The contract does not itself expose a generic forwarding method; the
    // relayer allowlist lives in the protocol package. This test proves that
    // the hub has no arbitrary-target call entry point named by an attacker.
    let mut contract = setup();
    prepare_scored(&mut contract);
    set_ctx(RELAYER, T0 + 230_000_000_000);
    expect_rejected(
        || {
            contract.award(WORK_ORDER.to_string(), BID_B.to_string());
        },
        "steward role required",
    );
    set_ctx(RELAYER, T0 + 230_000_000_000);
    expect_rejected(
        || {
            contract.refund(WORK_ORDER.to_string());
        },
        "UNAUTHORIZED",
    );
}

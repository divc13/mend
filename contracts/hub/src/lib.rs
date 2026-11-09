#![allow(clippy::too_many_arguments)]
#![doc = "MEND hub contract.

Authoritative on-chain state for asset maintenance passports, work orders, sealed
commit/reveal bidding, deterministic score binding, stablecoin escrow and the
durability warranty lifecycle.

Method names, roles and accounting follow `orchestration/decisions/HUB-INTERFACE.md`.
All amounts are integer micro-units of the configured NEP-141 settlement token.
"]

use near_contract_standards::fungible_token::core::ext_ft_core;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::borsh::BorshSerialize;
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::{json, Value};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue, PromiseResult,
};
use std::collections::BTreeMap;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

pub const EVENT_STANDARD: &str = "mend";
pub const EVENT_VERSION: &str = "1.0.0";

pub const COMPLETION_BPS: u128 = 9_000;
pub const HOLDBACK_BPS: u128 = 1_000;
pub const BPS_DENOMINATOR: u128 = 10_000;

/// RULES.md v1 weights. These are also encoded in the policy hash preimage.
pub const POLICY_VERSION: &str = "mend-bid-policy-v1";
pub const PRICE_WEIGHT_BPS: u32 = 4_500;
pub const WARRANTY_WEIGHT_BPS: u32 = 2_500;
pub const DURATION_WEIGHT_BPS: u32 = 2_000;
pub const MATERIALS_WEIGHT_BPS: u32 = 1_000;

/// R0-B §9.8: attach 0.003 NEAR to a score request. The whole deposit is
/// forwarded to OutLayer; unused funds are refunded by OutLayer to the payer.
pub const MIN_OUTLAYER_DEPOSIT_YOCTO: u128 = 3_000_000_000_000_000_000_000;
pub const MAX_SCORE_BIDS: usize = 16;
pub const MAX_SCORE_INPUT_BYTES: usize = 16 * 1024;

pub const DRAFT: &str = "DRAFT";
pub const POLICY_APPROVED: &str = "POLICY_APPROVED";
pub const FUNDED: &str = "FUNDED";
pub const BIDDING_OPEN: &str = "BIDDING_OPEN";
pub const BIDDING_REVEAL: &str = "BIDDING_REVEAL";
pub const SCORED: &str = "SCORED";
pub const AWARDED: &str = "AWARDED";
pub const IN_PROGRESS: &str = "IN_PROGRESS";
pub const COMPLETION_SUBMITTED: &str = "COMPLETION_SUBMITTED";
pub const COMPLETION_ACCEPTED: &str = "COMPLETION_ACCEPTED";
pub const DURABILITY_PENDING: &str = "DURABILITY_PENDING";
pub const CLOSED: &str = "CLOSED";
pub const WARRANTY_REOPENED: &str = "WARRANTY_REOPENED";
pub const DISPUTED: &str = "DISPUTED";
pub const CANCELLED: &str = "CANCELLED";
pub const REFUNDED: &str = "REFUNDED";

pub const ROLE_STEWARD: &str = "STEWARD";
pub const ROLE_CONTRACTOR: &str = "CONTRACTOR";
pub const ROLE_INSPECTOR: &str = "INSPECTOR";
pub const ROLE_DAO: &str = "DAO";
pub const ROLE_COORDINATOR_AI: &str = "COORDINATOR_AI";
pub const ROLE_REVIEWER_AI: &str = "REVIEWER_AI";
pub const ROLE_ORACLE: &str = "ORACLE";
pub const ROLE_ADMIN: &str = "ADMIN";
pub const ROLE_RELAYER: &str = "RELAYER";
pub const ROLE_SPONSOR: &str = "SPONSOR";
pub const ROLE_REPORTER: &str = "REPORTER";

pub const VALID_ROLES: [&str; 11] = [
    ROLE_REPORTER,
    ROLE_STEWARD,
    ROLE_SPONSOR,
    ROLE_CONTRACTOR,
    ROLE_INSPECTOR,
    ROLE_DAO,
    ROLE_COORDINATOR_AI,
    ROLE_REVIEWER_AI,
    ROLE_RELAYER,
    ROLE_ADMIN,
    ROLE_ORACLE,
];

pub const AI_ROLES: [&str; 2] = [ROLE_COORDINATOR_AI, ROLE_REVIEWER_AI];

pub const DISPUTABLE_STATES: [&str; 6] = [
    AWARDED,
    IN_PROGRESS,
    COMPLETION_SUBMITTED,
    COMPLETION_ACCEPTED,
    DURABILITY_PENDING,
    WARRANTY_REOPENED,
];

pub const DISPUTE_TARGETS: [&str; 8] = [
    AWARDED,
    IN_PROGRESS,
    COMPLETION_SUBMITTED,
    COMPLETION_ACCEPTED,
    DURABILITY_PENDING,
    WARRANTY_REOPENED,
    CLOSED,
    REFUNDED,
];

// ---------------------------------------------------------------------------
// Persisted types
// ---------------------------------------------------------------------------

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Roles,
    Assets,
    WorkOrders,
    Scores,
    Executions,
    PassportOwnerById,
    PassportMetadata,
    PassportTokensPerOwner,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Config {
    pub owner: AccountId,
    pub token: AccountId,
    pub dao: AccountId,
    /// Policy hash pinned at init; work orders must be authorized with this or
    /// an explicitly DAO-authorized replacement.
    pub policy_hash: String,
    /// Demo durability interval in minutes; explicitly configured.
    pub durability_minutes: u32,
    pub outlayer_account: AccountId,
    pub outlayer_project_id: String,
    pub scoring_wasm_hash: String,
    pub scoring_enabled: bool,
}

#[near(serializers = [borsh])]
#[derive(Clone, Default)]
pub struct Escrow {
    pub funding: u128,
    pub refunded: u128,
    /// Award still held but not yet paid or classified as holdback.
    pub escrowed: u128,
    pub completion_paid: u128,
    pub holdback_held: u128,
    pub holdback_released: u128,
}

impl Escrow {
    pub fn assert_balanced(&self) {
        let accounted = checked_add(self.refunded, self.escrowed);
        let accounted = checked_add(accounted, self.completion_paid);
        let accounted = checked_add(accounted, self.holdback_held);
        let accounted = checked_add(accounted, self.holdback_released);
        if accounted != self.funding {
            fail(
                "ESCROW_MISMATCH",
                format!("funding={} accounted={}", self.funding, accounted),
            );
        }
    }
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Asset {
    pub id: String,
    pub description_hash: String,
    pub location_hash: String,
    pub created_at: u64,
    pub created_by: AccountId,
    pub passport_token_id: Option<String>,
    pub work_order_ids: Vec<String>,
    pub history: Vec<HistoryEntry>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct HistoryEntry {
    pub work_order_id: String,
    pub action: String,
    pub actor: AccountId,
    pub at: u64,
    pub detail_hash: Option<String>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct BidCommitment {
    pub bid_id: String,
    pub contractor_id: AccountId,
    pub commitment_hash: String,
    pub committed_at: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct BidReveal {
    pub bid_id: String,
    pub contractor_id: AccountId,
    pub price: u128,
    pub duration_days: u32,
    pub warranty_days: u32,
    pub materials_score: u32,
    pub checklist_accepted: bool,
    pub nonce: String,
    pub commitment_hash: String,
    pub revealed_at: u64,
}

#[near(serializers = [borsh, json])]
#[serde(rename_all = "camelCase")]
#[derive(Clone)]
pub struct ScoredRank {
    pub rank: u32,
    pub bid_id: String,
    pub contractor_id: AccountId,
    pub score_bps: u32,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct ScoreExecution {
    pub execution_id: String,
    pub policy_hash: String,
    pub wasm_hash: String,
    pub input_hash: String,
    pub output_hash: String,
    /// Canonical hash of the revealed bid set that was scored. Used to reject
    /// a stale score even if the external `input_hash` came from a different
    /// canonicalization (for example RULES.md's commitment-hash formula).
    pub bid_set_hash: String,
    pub ranking: Vec<ScoredRank>,
    pub mode: String,
    pub created_at: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct PendingScore {
    pub execution_key: String,
    pub input_hash: String,
    pub policy_hash: String,
    pub wasm_hash: String,
    pub requested_at: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct EvidenceRecord {
    pub evidence_id: String,
    pub evidence_hash: String,
    pub kind: String,
    pub submitted_by: AccountId,
    pub submitted_at: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct InspectionRecord {
    pub inspection_id: String,
    pub kind: String,
    pub inspector_id: AccountId,
    pub decision: String,
    pub notes_hash: String,
    pub evidence_id: Option<String>,
    pub inspected_at: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct PaymentRecord {
    pub id: String,
    pub kind: String,
    pub amount: u128,
    pub recipient: AccountId,
    /// PENDING means the token transfer receipt was issued in this transaction.
    /// This contract cannot observe the token contract result synchronously.
    pub status: String,
    pub created_at: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct WarrantyCase {
    pub id: String,
    pub failed_inspection_id: String,
    /// OPEN, REMEDIATING, CLOSED
    pub state: String,
    pub opened_at: u64,
    pub closed_at: Option<u64>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct DisputeRecord {
    pub reason_hash: String,
    pub opened_by: AccountId,
    pub opened_at: u64,
    pub resolved_to: Option<String>,
    pub resolution_hash: Option<String>,
    pub resolved_at: Option<u64>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct WorkOrder {
    pub id: String,
    pub asset_id: String,
    pub cluster_hash: String,
    pub scope_hash: String,
    pub dao_proposal_id: String,
    pub policy_hash: String,
    pub budget: u128,
    pub sponsor: AccountId,
    pub contractor_roster: Vec<AccountId>,
    pub inspector_roster: Vec<AccountId>,
    pub commit_deadline: u64,
    pub reveal_deadline: u64,
    pub status: String,
    pub proposed_by: AccountId,
    pub created_at: u64,
    pub updated_at: u64,
    pub approved_at: Option<u64>,
    pub approved_proposal_id: Option<String>,
    pub bids: Vec<BidCommitment>,
    pub reveals: Vec<BidReveal>,
    pub score: Option<ScoreExecution>,
    pub pending_score: Option<PendingScore>,
    pub awarded_bid_id: Option<String>,
    pub awarded_contractor: Option<AccountId>,
    pub inspector: Option<AccountId>,
    pub escrow: Escrow,
    pub evidence: Vec<EvidenceRecord>,
    pub used_evidence_ids: Vec<String>,
    pub used_evidence_hashes: Vec<String>,
    pub inspections: Vec<InspectionRecord>,
    pub payments: Vec<PaymentRecord>,
    pub durability_due_at: Option<u64>,
    pub reopen_count: u32,
    pub warranty: Option<WarrantyCase>,
    pub completion_paid: bool,
    pub holdback_released: bool,
    pub cancelled_reason: Option<String>,
    pub dispute: Option<DisputeRecord>,
}

impl WorkOrder {
    fn assert_balanced(&self) {
        self.escrow.assert_balanced();
    }

    fn reveal_for(&self, bid_id: &str) -> Option<&BidReveal> {
        self.reveals.iter().find(|r| r.bid_id == bid_id)
    }

    fn commitment_for(&self, bid_id: &str) -> Option<&BidCommitment> {
        self.bids.iter().find(|b| b.bid_id == bid_id)
    }

    fn is_reveal_phase(&self, now: u64) -> bool {
        now >= self.commit_deadline
    }
}

// ---------------------------------------------------------------------------
// View types (public JSON)
// ---------------------------------------------------------------------------

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct ConfigView {
    pub owner: AccountId,
    pub token: AccountId,
    pub dao: AccountId,
    pub policy_hash: String,
    pub durability_minutes: u32,
    pub paused: bool,
    pub scoring_enabled: bool,
    pub outlayer_account: AccountId,
    pub outlayer_project_id: String,
    pub scoring_wasm_hash: String,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct AssetView {
    pub id: String,
    pub description_hash: String,
    pub location_hash: String,
    pub created_at: u64,
    pub created_by: AccountId,
    pub passport_token_id: Option<String>,
    pub work_order_ids: Vec<String>,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntryView {
    pub work_order_id: String,
    pub action: String,
    pub actor: AccountId,
    pub at: u64,
    pub detail_hash: Option<String>,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct WorkOrderView {
    pub id: String,
    pub asset_id: String,
    pub cluster_hash: String,
    pub scope_hash: String,
    pub dao_proposal_id: String,
    pub policy_hash: String,
    pub budget: U128,
    pub sponsor: AccountId,
    pub contractor_roster: Vec<AccountId>,
    pub inspector_roster: Vec<AccountId>,
    pub commit_deadline: u64,
    pub reveal_deadline: u64,
    pub status: String,
    pub proposed_by: AccountId,
    pub created_at: u64,
    pub updated_at: u64,
    pub approved_at: Option<u64>,
    pub approved_proposal_id: Option<String>,
    pub awarded_bid_id: Option<String>,
    pub awarded_contractor: Option<AccountId>,
    pub inspector: Option<AccountId>,
    pub durability_due_at: Option<u64>,
    pub reopen_count: u32,
    pub completion_paid: bool,
    pub holdback_released: bool,
    pub funded: U128,
    pub dispute_open: bool,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct BidCommitmentView {
    pub bid_id: String,
    pub contractor_id: AccountId,
    pub commitment_hash: String,
    pub committed_at: u64,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct BidRevealView {
    pub bid_id: String,
    pub contractor_id: AccountId,
    pub price: U128,
    pub duration_days: u32,
    pub warranty_days: u32,
    pub materials_score: u32,
    pub checklist_accepted: bool,
    pub nonce: String,
    pub commitment_hash: String,
    pub revealed_at: u64,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct BidsView {
    pub commitments: Vec<BidCommitmentView>,
    /// Hidden until the reveal phase begins. Never leaks competing prices early.
    pub reveals: Option<Vec<BidRevealView>>,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct ScoredRankView {
    pub rank: u32,
    pub bid_id: String,
    pub contractor_id: AccountId,
    pub score_bps: u32,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct ScoreExecutionView {
    pub execution_id: String,
    pub policy_hash: String,
    pub wasm_hash: String,
    pub input_hash: String,
    pub output_hash: String,
    pub ranking: Vec<ScoredRankView>,
    pub mode: String,
    pub created_at: u64,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct EscrowView {
    pub funding: U128,
    pub refunded: U128,
    pub escrowed: U128,
    pub completion_paid: U128,
    pub holdback_held: U128,
    pub holdback_released: U128,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct PaymentView {
    pub id: String,
    pub kind: String,
    pub amount: U128,
    pub recipient: AccountId,
    pub status: String,
    pub created_at: u64,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct WarrantyView {
    pub work_order_id: String,
    /// Warranty case state: NONE, OPEN, REMEDIATING, CLOSED.
    pub state: String,
    pub work_order_state: String,
    pub reopen_count: u32,
    pub durability_due_at: Option<u64>,
    pub completion_paid: bool,
    pub holdback_released: bool,
    pub holdback_held: U128,
    pub holdback_released_amount: U128,
    pub failed_inspection_id: Option<String>,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct ScoreInputView {
    pub input: String,
    pub input_hash: String,
    pub bid_count: u32,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationView {
    pub total_funding: U128,
    pub total_refunded: U128,
    pub total_completion_paid: U128,
    pub total_holdback_released: U128,
}

// ---------------------------------------------------------------------------
// Canonical score input (R0-B §9.2 / §9.4)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct CanonicalPolicy {
    version: &'static str,
    price_weight_bp: u32,
    warranty_weight_bp: u32,
    duration_weight_bp: u32,
    materials_weight_bp: u32,
}

#[derive(Serialize)]
struct CanonicalBid<'a> {
    bid_id: &'a str,
    contractor: &'a str,
    price_micro: String,
    duration_days: u32,
    warranty_days: u32,
    materials_score: u32,
    eligible: bool,
    commitment_hash: &'a str,
}

#[derive(Serialize)]
struct CanonicalInput<'a> {
    schema: &'static str,
    work_order_id: &'a str,
    policy_hash: &'a str,
    policy: CanonicalPolicy,
    bids: Vec<CanonicalBid<'a>>,
    tie_break: &'static str,
}

#[derive(Deserialize)]
struct ScoreOutput {
    schema: String,
    winner_bid_id: String,
    scores: BTreeMap<String, u32>,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub config: Config,
    pub roles: LookupMap<AccountId, Vec<String>>,
    pub paused: bool,
    pub pause_reason_hash: Option<String>,
    pub assets: LookupMap<String, Asset>,
    pub work_orders: LookupMap<String, WorkOrder>,
    pub scores: LookupMap<String, ScoreExecution>,
    pub executions: LookupMap<String, String>,
    pub tokens: NonFungibleToken,
    pub total_funding: u128,
    pub total_refunded: u128,
    pub total_completion_paid: u128,
    pub total_holdback_released: u128,
}

#[near]
impl Contract {
    #[init]
    pub fn new(
        owner: AccountId,
        token: AccountId,
        dao: AccountId,
        policy_hash: String,
        durability_minutes: u32,
    ) -> Self {
        assert_hash(&policy_hash, "policy_hash");
        if durability_minutes == 0 {
            fail("VALIDATION_ERROR", "durability_minutes must be > 0");
        }
        let tokens = NonFungibleToken::new(
            StorageKey::PassportOwnerById,
            env::current_account_id(),
            Some(StorageKey::PassportMetadata),
            Some(StorageKey::PassportTokensPerOwner),
            None::<StorageKey>,
        );
        let mut this = Self {
            config: Config {
                owner,
                token,
                dao,
                policy_hash,
                durability_minutes,
                outlayer_account: "outlayer.testnet".parse().unwrap(),
                outlayer_project_id: "mend.testnet/bid-rules".to_string(),
                scoring_wasm_hash: String::new(),
                scoring_enabled: false,
            },
            roles: LookupMap::new(StorageKey::Roles),
            paused: false,
            pause_reason_hash: None,
            assets: LookupMap::new(StorageKey::Assets),
            work_orders: LookupMap::new(StorageKey::WorkOrders),
            scores: LookupMap::new(StorageKey::Scores),
            executions: LookupMap::new(StorageKey::Executions),
            tokens,
            total_funding: 0,
            total_refunded: 0,
            total_completion_paid: 0,
            total_holdback_released: 0,
        };
        this.set_role_internal(this.config.owner.clone(), ROLE_ADMIN.to_string(), true);
        this
    }

    // -- configuration and roles --------------------------------------------

    #[payable]
    pub fn set_role(&mut self, account: AccountId, role: String, enabled: bool) {
        self.assert_not_paused();
        self.assert_owner_or_dao();
        require!(
            VALID_ROLES.contains(&role.as_str()),
            "VALIDATION_ERROR: unknown role"
        );
        self.set_role_internal(account, role, enabled);
    }

    fn set_role_internal(&mut self, account: AccountId, role: String, enabled: bool) {
        let mut roles = self.roles.get(&account).unwrap_or_default();
        if enabled {
            if !roles.contains(&role) {
                roles.push(role);
                roles.sort();
            }
        } else {
            roles.retain(|r| r != &role);
        }
        self.roles.insert(&account, &roles);
    }

    pub fn pause(&mut self, reason_hash: String) {
        self.assert_not_paused();
        self.assert_owner_or_dao();
        assert_hash(&reason_hash, "reason_hash");
        self.paused = true;
        self.pause_reason_hash = Some(reason_hash.clone());
        emit_event(
            "contract_paused",
            None,
            None,
            &env::predecessor_account_id(),
            json!({ "reason_hash": reason_hash }),
        );
    }

    pub fn unpause(&mut self) {
        self.assert_owner_or_dao();
        if !self.paused {
            fail("INVALID_STATE", "contract is not paused");
        }
        self.paused = false;
        self.pause_reason_hash = None;
        emit_event(
            "contract_unpaused",
            None,
            None,
            &env::predecessor_account_id(),
            json!({}),
        );
    }

    /// Owner/DAO-only OutLayer configuration. OutLayer is never faked: scoring
    /// stays disabled until a hash-pinned WASM is explicitly configured.
    pub fn set_outlayer_config(
        &mut self,
        outlayer_account: AccountId,
        project_id: String,
        wasm_hash: String,
        enabled: bool,
    ) {
        self.assert_not_paused();
        self.assert_owner_or_dao();
        assert_project_id(&project_id, "project_id");
        if enabled || !wasm_hash.is_empty() {
            assert_hash(&wasm_hash, "wasm_hash");
        }
        self.config.outlayer_account = outlayer_account;
        self.config.outlayer_project_id = project_id;
        self.config.scoring_wasm_hash = wasm_hash;
        self.config.scoring_enabled = enabled;
    }

    // -- assets and passport -------------------------------------------------

    pub fn create_asset(
        &mut self,
        asset_id: String,
        description_hash: String,
        location_hash: String,
    ) {
        self.assert_not_paused();
        self.assert_steward_or_coordinator();
        assert_id(&asset_id, "asset_id");
        assert_hash(&description_hash, "description_hash");
        assert_hash(&location_hash, "location_hash");
        if self.assets.contains_key(&asset_id) {
            fail("VALIDATION_ERROR", "asset already exists");
        }
        let asset = Asset {
            id: asset_id.clone(),
            description_hash,
            location_hash,
            created_at: now(),
            created_by: env::predecessor_account_id(),
            passport_token_id: None,
            work_order_ids: Vec::new(),
            history: Vec::new(),
        };
        self.assets.insert(&asset_id, &asset);
    }

    pub fn mint_passport(&mut self, asset_id: String) {
        self.assert_not_paused();
        self.assert_steward();
        let mut asset = match self.assets.get(&asset_id) {
            Some(asset) => asset,
            None => fail("NOT_FOUND", "asset does not exist"),
        };
        if asset.passport_token_id.is_some() {
            fail("VALIDATION_ERROR", "passport already minted");
        }
        let extra = json!({
            "schema": "mend.passport.v1",
            "transferable": false,
            "legal_ownership": false,
            "asset_id": &asset_id,
        })
        .to_string();
        let metadata = TokenMetadata {
            title: Some(asset_id.clone()),
            description: Some(
                "MEND maintenance passport; not a title deed or legal ownership record."
                    .to_string(),
            ),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: None,
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: Some(extra),
            reference: None,
            reference_hash: None,
        };
        // The passport holder is the hub/registry account, never a user.
        let token = self.tokens.internal_mint_with_refund(
            asset_id.clone(),
            env::current_account_id(),
            Some(metadata),
            None,
        );
        NftMint {
            owner_id: &token.owner_id,
            token_ids: &[token.token_id.as_str()],
            memo: Some("MEND maintenance passport"),
        }
        .emit();
        asset.passport_token_id = Some(asset_id.clone());
        self.assets.insert(&asset_id, &asset);
        self.record_history(
            &asset_id,
            "",
            "passport_minted",
            &env::predecessor_account_id(),
            None,
        );
        emit_event(
            "passport_minted",
            None,
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({ "token_id": &asset_id, "holder": env::current_account_id(), "transferable": false }),
        );
    }

    /// Advisory only; transferability is enforced by panicking methods.
    pub fn passport_policy(&self) -> Value {
        json!({
            "transferable": false,
            "legal_ownership": false,
            "holder_role": "registry",
            "holder": env::current_account_id(),
        })
    }

    // -- work-order creation and DAO authorization ---------------------------

    #[allow(clippy::too_many_arguments)]
    pub fn create_work_order(
        &mut self,
        work_order_id: String,
        asset_id: String,
        cluster_hash: String,
        scope_hash: String,
        dao_proposal_id: String,
        policy_hash: String,
        budget: U128,
        sponsor: AccountId,
        contractor_roster: Vec<AccountId>,
        inspector_roster: Vec<AccountId>,
        commit_deadline: u64,
        reveal_deadline: u64,
    ) {
        self.assert_not_paused();
        self.assert_steward_or_coordinator();
        assert_id(&work_order_id, "work_order_id");
        assert_id(&asset_id, "asset_id");
        assert_hash(&cluster_hash, "cluster_hash");
        assert_hash(&scope_hash, "scope_hash");
        assert_id(&dao_proposal_id, "dao_proposal_id");
        assert_hash(&policy_hash, "policy_hash");
        if budget.0 == 0 {
            fail("VALIDATION_ERROR", "budget must be > 0");
        }
        validate_rosters(&contractor_roster, &inspector_roster);
        if commit_deadline >= reveal_deadline {
            fail(
                "VALIDATION_ERROR",
                "commit_deadline must be before reveal_deadline",
            );
        }
        if commit_deadline <= now() {
            fail("VALIDATION_ERROR", "commit_deadline must be in the future");
        }
        if !self.assets.contains_key(&asset_id) {
            fail("NOT_FOUND", "asset does not exist");
        }
        if self.work_orders.contains_key(&work_order_id) {
            fail("VALIDATION_ERROR", "work order already exists");
        }
        let ts = now();
        let work_order = WorkOrder {
            id: work_order_id.clone(),
            asset_id: asset_id.clone(),
            cluster_hash,
            scope_hash,
            dao_proposal_id,
            policy_hash,
            budget: budget.0,
            sponsor,
            contractor_roster,
            inspector_roster,
            commit_deadline,
            reveal_deadline,
            status: DRAFT.to_string(),
            proposed_by: env::predecessor_account_id(),
            created_at: ts,
            updated_at: ts,
            approved_at: None,
            approved_proposal_id: None,
            bids: Vec::new(),
            reveals: Vec::new(),
            score: None,
            pending_score: None,
            awarded_bid_id: None,
            awarded_contractor: None,
            inspector: None,
            escrow: Escrow::default(),
            evidence: Vec::new(),
            used_evidence_ids: Vec::new(),
            used_evidence_hashes: Vec::new(),
            inspections: Vec::new(),
            payments: Vec::new(),
            durability_due_at: None,
            reopen_count: 0,
            warranty: None,
            completion_paid: false,
            holdback_released: false,
            cancelled_reason: None,
            dispute: None,
        };
        work_order.assert_balanced();
        self.work_orders.insert(&work_order_id, &work_order);
        self.attach_work_order_to_asset(&asset_id, &work_order_id);
        self.record_history(
            &asset_id,
            &work_order_id,
            "work_order_created",
            &env::predecessor_account_id(),
            Some(work_order.scope_hash.clone()),
        );
        emit_event(
            "work_order_created",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({
                "scope_hash": &work_order.scope_hash,
                "policy_hash": &work_order.policy_hash,
                "budget": work_order.budget.to_string(),
                "sponsor": &work_order.sponsor,
                "dao_proposal_id": &work_order.dao_proposal_id,
            }),
        );
    }

    #[allow(clippy::too_many_arguments)]
    pub fn dao_authorize(
        &mut self,
        work_order_id: String,
        proposal_id: String,
        scope_hash: String,
        policy_hash: String,
        budget: U128,
        contractor_roster: Vec<AccountId>,
        inspector_roster: Vec<AccountId>,
        commit_deadline: u64,
        reveal_deadline: u64,
    ) {
        self.assert_not_paused();
        self.assert_dao();
        assert_id(&proposal_id, "proposal_id");
        assert_hash(&scope_hash, "scope_hash");
        assert_hash(&policy_hash, "policy_hash");
        if budget.0 == 0 {
            fail("VALIDATION_ERROR", "budget must be > 0");
        }
        validate_rosters(&contractor_roster, &inspector_roster);
        if commit_deadline >= reveal_deadline {
            fail(
                "VALIDATION_ERROR",
                "commit_deadline must be before reveal_deadline",
            );
        }
        if commit_deadline <= now() {
            fail("VALIDATION_ERROR", "commit_deadline must be in the future");
        }
        let mut work_order = match self.work_orders.get(&work_order_id) {
            Some(work_order) => work_order,
            None => fail("NOT_FOUND", "work order does not exist"),
        };
        if work_order.status != DRAFT {
            fail("INVALID_TRANSITION", "only DRAFT can be DAO-authorized");
        }
        if proposal_id != work_order.dao_proposal_id {
            fail(
                "DAO_APPROVAL_MISMATCH",
                "proposal id does not match the work order",
            );
        }
        let ts = now();
        work_order.scope_hash = scope_hash.clone();
        work_order.policy_hash = policy_hash.clone();
        work_order.budget = budget.0;
        work_order.contractor_roster = contractor_roster;
        work_order.inspector_roster = inspector_roster;
        work_order.commit_deadline = commit_deadline;
        work_order.reveal_deadline = reveal_deadline;
        work_order.approved_proposal_id = Some(proposal_id.clone());
        work_order.approved_at = Some(ts);
        transition(&mut work_order, POLICY_APPROVED);
        work_order.assert_balanced();
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "policy_approved",
            &env::predecessor_account_id(),
            Some(policy_hash.clone()),
        );
        emit_event(
            "policy_approved",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({
                "proposal_id": &proposal_id,
                "scope_hash": &scope_hash,
                "policy_hash": &policy_hash,
                "budget": budget.0.to_string(),
                "contractor_roster": &work_order.contractor_roster,
                "inspector_roster": &work_order.inspector_roster,
            }),
        );
    }

    // -- NEP-141 escrow funding ---------------------------------------------

    /// NEP-141 receiver. The caller is the token contract; `sender_id` is the
    /// sponsor. Every rejection returns the full amount, which the token's
    /// standard resolver refunds.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        // Accepted-token allowlist: any other token gets a full refund.
        if env::predecessor_account_id() != self.config.token {
            return PromiseOrValue::Value(amount);
        }
        if self.paused {
            return PromiseOrValue::Value(amount);
        }
        let amount = amount.0;
        if amount == 0 {
            return PromiseOrValue::Value(U128(0));
        }
        // Strict msg schema: the message is exactly the work-order ID.
        let mut work_order = match self.work_orders.get(&msg) {
            Some(work_order) => work_order,
            None => return PromiseOrValue::Value(U128(amount)),
        };
        if work_order.status != POLICY_APPROVED {
            self.emit_funding_failed(
                &work_order,
                &sender_id,
                "FUNDING_DUPLICATE",
                "work order is not awaiting funding",
                amount,
            );
            return PromiseOrValue::Value(U128(amount));
        }
        if sender_id != work_order.sponsor {
            self.emit_funding_failed(
                &work_order,
                &sender_id,
                "UNAUTHORIZED",
                "only the sponsor may fund this work order",
                amount,
            );
            return PromiseOrValue::Value(U128(amount));
        }
        if work_order.escrow.funding != 0 {
            self.emit_funding_failed(
                &work_order,
                &sender_id,
                "FUNDING_DUPLICATE",
                "work order is already funded",
                amount,
            );
            return PromiseOrValue::Value(U128(amount));
        }
        let expected = work_order.budget;
        if amount < expected {
            self.emit_funding_failed(
                &work_order,
                &sender_id,
                "FUNDING_WRONG_AMOUNT",
                "underfunded; the full amount is refunded",
                amount,
            );
            return PromiseOrValue::Value(U128(amount));
        }
        let accepted = expected;
        work_order.escrow.funding = checked_add(work_order.escrow.funding, accepted);
        work_order.escrow.escrowed = checked_add(work_order.escrow.escrowed, accepted);
        work_order.assert_balanced();
        transition(&mut work_order, FUNDED);
        let asset_id = work_order.asset_id.clone();
        let work_order_id = work_order.id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.total_funding = checked_add(self.total_funding, accepted);
        self.record_history(
            &asset_id,
            &work_order_id,
            "work_order_funded",
            &sender_id,
            None,
        );
        emit_event(
            "work_order_funded",
            Some(&work_order_id),
            Some(&asset_id),
            &sender_id,
            json!({
                "amount": accepted.to_string(),
                "token": &self.config.token,
                "overfund_refunded": (amount - accepted).to_string(),
            }),
        );
        PromiseOrValue::Value(U128(amount - accepted))
    }

    // -- sealed commit / reveal ---------------------------------------------

    pub fn open_bidding(&mut self, work_order_id: String) {
        self.assert_not_paused();
        self.assert_steward();
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != FUNDED {
            fail(
                "INVALID_TRANSITION",
                "only FUNDED work orders can open bidding",
            );
        }
        if now() >= work_order.commit_deadline {
            fail("BID_LATE", "commit deadline has passed");
        }
        transition(&mut work_order, BIDDING_OPEN);
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "bidding_opened",
            &env::predecessor_account_id(),
            None,
        );
        emit_event(
            "bidding_opened",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({
                "commit_deadline": work_order.commit_deadline.to_string(),
                "reveal_deadline": work_order.reveal_deadline.to_string(),
            }),
        );
    }

    pub fn commit_bid(&mut self, work_order_id: String, bid_id: String, commitment_hash: String) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        assert_id(&bid_id, "bid_id");
        assert_hash(&commitment_hash, "commitment_hash");
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != BIDDING_OPEN {
            fail("BIDDING_NOT_OPEN", "bidding is not open");
        }
        if now() >= work_order.commit_deadline {
            fail("BID_LATE", "commit deadline has passed");
        }
        if !work_order.contractor_roster.contains(&caller) {
            fail("NOT_ROSTERED", "caller is not on the contractor roster");
        }
        if work_order.commitment_for(&bid_id).is_some()
            || work_order.bids.iter().any(|b| b.contractor_id == caller)
        {
            fail("BID_DUPLICATE", "duplicate bid id or contractor");
        }
        let asset_id = work_order.asset_id.clone();
        work_order.bids.push(BidCommitment {
            bid_id: bid_id.clone(),
            contractor_id: caller.clone(),
            commitment_hash: commitment_hash.clone(),
            committed_at: now(),
        });
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "bid_committed",
            &caller,
            Some(commitment_hash.clone()),
        );
        emit_event(
            "bid_committed",
            Some(&work_order_id),
            Some(&asset_id),
            &caller,
            json!({ "bid_id": bid_id, "commitment_hash": commitment_hash }),
        );
    }

    #[allow(clippy::too_many_arguments)]
    pub fn reveal_bid(
        &mut self,
        work_order_id: String,
        bid_id: String,
        price: U128,
        duration_days: u32,
        warranty_days: u32,
        materials_score: u32,
        checklist_accepted: bool,
        nonce: String,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        assert_id(&bid_id, "bid_id");
        if nonce.len() < 8 || nonce.len() > 128 {
            fail("VALIDATION_ERROR", "nonce must be 8..128 characters");
        }
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != BIDDING_OPEN {
            fail("BIDDING_NOT_OPEN", "bidding is not open");
        }
        if now() < work_order.commit_deadline {
            fail("BID_EARLY_REVEAL", "reveal phase has not started");
        }
        if now() >= work_order.reveal_deadline {
            fail("BID_LATE", "reveal deadline has passed");
        }
        let commitment = match work_order.commitment_for(&bid_id) {
            Some(commitment) => commitment.clone(),
            None => fail("NOT_FOUND", "no commitment for this bid"),
        };
        if commitment.contractor_id != caller {
            fail("FORBIDDEN_ROLE", "caller did not commit this bid");
        }
        if work_order.reveals.iter().any(|r| r.bid_id == bid_id) {
            fail("BID_DUPLICATE", "bid already revealed");
        }
        if price.0 == 0 || duration_days == 0 || materials_score > 100 {
            fail("VALIDATION_ERROR", "invalid revealed bid values");
        }
        let payload = bid_commitment_payload(
            &bid_id,
            &caller,
            price.0,
            duration_days,
            warranty_days,
            materials_score,
            checklist_accepted,
            &nonce,
        );
        let computed = sha256_hex(payload.as_bytes());
        if computed != commitment.commitment_hash {
            fail(
                "BID_HASH_MISMATCH",
                "revealed values do not match commitment",
            );
        }
        let asset_id = work_order.asset_id.clone();
        work_order.reveals.push(BidReveal {
            bid_id: bid_id.clone(),
            contractor_id: caller.clone(),
            price: price.0,
            duration_days,
            warranty_days,
            materials_score,
            checklist_accepted,
            nonce: nonce.clone(),
            commitment_hash: commitment.commitment_hash.clone(),
            revealed_at: now(),
        });
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "bid_revealed",
            &caller,
            Some(commitment.commitment_hash),
        );
        emit_event(
            "bid_revealed",
            Some(&work_order_id),
            Some(&asset_id),
            &caller,
            json!({
                "bid_id": bid_id,
                "price": price.0.to_string(),
                "duration_days": duration_days,
                "warranty_days": warranty_days,
                "materials_score": materials_score,
                "checklist_accepted": checklist_accepted,
            }),
        );
    }

    pub fn close_bidding(&mut self, work_order_id: String) {
        self.assert_not_paused();
        self.assert_steward();
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != BIDDING_OPEN {
            fail("INVALID_TRANSITION", "only BIDDING_OPEN can be closed");
        }
        if now() < work_order.reveal_deadline {
            fail("BID_LATE", "reveal deadline has not passed");
        }
        transition(&mut work_order, BIDDING_REVEAL);
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "bidding_closed",
            &env::predecessor_account_id(),
            None,
        );
        emit_event(
            "bidding_closed",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({ "revealed_bids": work_order.reveals.len() as u64 }),
        );
    }

    // -- deterministic scoring ----------------------------------------------

    #[allow(clippy::too_many_arguments)]
    pub fn record_score(
        &mut self,
        work_order_id: String,
        execution_id: String,
        policy_hash: String,
        wasm_hash: String,
        input_hash: String,
        output_hash: String,
        ranking: Vec<ScoredRank>,
    ) {
        self.assert_not_paused();
        self.assert_steward_or_oracle();
        self.assert_not_ai(&env::predecessor_account_id());
        assert_id(&execution_id, "execution_id");
        assert_hash(&policy_hash, "policy_hash");
        assert_hash(&wasm_hash, "wasm_hash");
        assert_hash(&input_hash, "input_hash");
        assert_hash(&output_hash, "output_hash");
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != BIDDING_REVEAL {
            fail("INVALID_TRANSITION", "scoring requires BIDDING_REVEAL");
        }
        if policy_hash != work_order.policy_hash {
            fail(
                "SCORE_POLICY_MISMATCH",
                "score policy does not match work order",
            );
        }
        if !self.config.scoring_wasm_hash.is_empty() && wasm_hash != self.config.scoring_wasm_hash {
            fail(
                "SCORE_INVALID",
                "WASM hash is not the configured scoring code",
            );
        }
        let (_, bid_set_hash) = self
            .canonical_input(&work_order)
            .unwrap_or_else(|| fail("SCORE_INVALID", "no revealed bids to score"));
        validate_ranking(&work_order, &ranking);
        if self.executions.contains_key(&execution_id) {
            fail("SCORE_STALE", "execution id already recorded");
        }
        let asset_id = work_order.asset_id.clone();
        let score = ScoreExecution {
            execution_id: execution_id.clone(),
            policy_hash,
            wasm_hash,
            input_hash,
            output_hash,
            bid_set_hash,
            ranking,
            mode: "recorded".to_string(),
            created_at: now(),
        };
        work_order.score = Some(score.clone());
        work_order.pending_score = None;
        transition(&mut work_order, SCORED);
        self.work_orders.insert(&work_order_id, &work_order);
        self.scores.insert(&work_order_id, &score);
        self.executions
            .insert(&execution_id, &work_order_id.clone());
        self.record_history(
            &asset_id,
            &work_order_id,
            "score_recorded",
            &env::predecessor_account_id(),
            Some(score.output_hash.clone()),
        );
        emit_event(
            "score_recorded",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({
                "execution_id": &execution_id,
                "policy_hash": &work_order.policy_hash,
                "wasm_hash": work_order.score.as_ref().map(|s| s.wasm_hash.clone()),
                "input_hash": work_order.score.as_ref().map(|s| s.input_hash.clone()),
                "output_hash": work_order.score.as_ref().map(|s| s.output_hash.clone()),
                "winner_bid_id": work_order.score.as_ref().and_then(|s| s.ranking.first().map(|r| r.bid_id.clone())),
                "mode": "recorded",
            }),
        );
    }

    /// Payable request to OutLayer. In unit tests the promise is constructed and
    /// settled through `on_score_result`; no fake OutLayer execution is recorded.
    #[payable]
    pub fn request_score(&mut self, work_order_id: String) -> Promise {
        self.assert_not_paused();
        self.assert_steward();
        self.assert_not_ai(&env::predecessor_account_id());
        if !self.config.scoring_enabled {
            fail(
                "SCORING_UNAVAILABLE",
                "OutLayer scoring is not configured; do not fake an execution",
            );
        }
        let attached = env::attached_deposit();
        if attached < NearToken::from_yoctonear(MIN_OUTLAYER_DEPOSIT_YOCTO) {
            fail(
                "VALIDATION_ERROR",
                "attach at least 0.003 NEAR for OutLayer execution",
            );
        }
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != BIDDING_REVEAL {
            fail("INVALID_TRANSITION", "scoring requires BIDDING_REVEAL");
        }
        if work_order.pending_score.is_some() {
            fail("SCORE_STALE", "a score request is already pending");
        }
        let (input, input_hash) = self
            .canonical_input(&work_order)
            .unwrap_or_else(|| fail("SCORE_INVALID", "no revealed bids to score"));
        if input.len() > MAX_SCORE_INPUT_BYTES {
            fail("SCORE_INVALID", "canonical input exceeds 16 KB");
        }
        let wasm_hash = self.config.scoring_wasm_hash.clone();
        assert_hash(&wasm_hash, "scoring_wasm_hash");
        let policy_hash = work_order.policy_hash.clone();
        let execution_key = sha256_hex(
            format!(
                "MEND_EXECUTION_V1|{}|{}|{}|{}",
                work_order_id, input_hash, wasm_hash, policy_hash
            )
            .as_bytes(),
        );
        if self.executions.contains_key(&execution_key) {
            fail("SCORE_STALE", "this execution key was already settled");
        }
        work_order.pending_score = Some(PendingScore {
            execution_key,
            input_hash: input_hash.clone(),
            policy_hash: policy_hash.clone(),
            wasm_hash: wasm_hash.clone(),
            requested_at: now(),
        });
        self.work_orders.insert(&work_order_id, &work_order);

        let source = json!({
            "Project": {
                "project_id": self.config.outlayer_project_id,
                "version_key": wasm_hash,
            }
        });
        let limits = json!({
            "max_instructions": 5_000_000_000u64,
            "max_memory_mb": 128u64,
            "max_execution_seconds": 10u64,
        });
        let payer = env::predecessor_account_id();
        ext_outlayer::ext(self.config.outlayer_account.clone())
            .with_attached_deposit(attached)
            .with_unused_gas_weight(1)
            .request_execution(
                source,
                Some(limits),
                Some(input),
                None,
                Some("Json".to_string()),
                Some(payer),
                None,
            )
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(25))
                    .on_score_result(work_order_id, input_hash, policy_hash),
            )
    }

    /// Private self-callback. The only trusted output is `promise_result(0)`;
    /// there is deliberately no caller-supplied output argument.
    #[private]
    pub fn on_score_result(
        &mut self,
        work_order_id: String,
        expected_input_hash: String,
        expected_policy_hash: String,
    ) {
        let mut work_order = match self.work_orders.get(&work_order_id) {
            Some(work_order) => work_order,
            None => return,
        };
        // Duplicate callback: already settled or no request is pending.
        if work_order.status != BIDDING_REVEAL {
            return;
        }
        let pending = match work_order.pending_score.clone() {
            Some(pending) => pending,
            None => return,
        };
        if expected_input_hash != pending.input_hash {
            fail(
                "SCORE_STALE",
                "callback input hash does not match the request",
            );
        }
        if expected_policy_hash != work_order.policy_hash
            || expected_policy_hash != pending.policy_hash
        {
            fail("SCORE_POLICY_MISMATCH", "callback policy hash mismatch");
        }
        #[allow(deprecated)]
        let bytes = match env::promise_result(0) {
            PromiseResult::Successful(bytes) => bytes,
            PromiseResult::Failed => {
                work_order.pending_score = None;
                self.work_orders.insert(&work_order_id, &work_order);
                return;
            }
        };
        if bytes.is_empty() || bytes == b"null" {
            work_order.pending_score = None;
            self.work_orders.insert(&work_order_id, &work_order);
            return;
        }
        let output_hash = sha256_hex(&bytes);
        let output: ScoreOutput = match near_sdk::serde_json::from_slice(&bytes) {
            Ok(output) => output,
            Err(_) => {
                work_order.pending_score = None;
                self.work_orders.insert(&work_order_id, &work_order);
                return;
            }
        };
        let ranking = match validate_score_output(&work_order, &output) {
            Some(ranking) => ranking,
            None => {
                work_order.pending_score = None;
                self.work_orders.insert(&work_order_id, &work_order);
                return;
            }
        };
        let asset_id = work_order.asset_id.clone();
        let score = ScoreExecution {
            execution_id: format!("outlayer:{}", pending.execution_key),
            policy_hash: pending.policy_hash,
            wasm_hash: pending.wasm_hash,
            input_hash: pending.input_hash,
            output_hash,
            bid_set_hash: self
                .canonical_input(&work_order)
                .map(|(_, hash)| hash)
                .unwrap_or_else(|| fail("SCORE_INVALID", "no revealed bids")),
            ranking,
            mode: "outlayer".to_string(),
            created_at: now(),
        };
        work_order.score = Some(score.clone());
        work_order.pending_score = None;
        transition(&mut work_order, SCORED);
        self.work_orders.insert(&work_order_id, &work_order);
        self.scores.insert(&work_order_id, &score);
        self.executions
            .insert(&score.execution_id, &work_order_id.clone());
        self.record_history(
            &asset_id,
            &work_order_id,
            "score_recorded",
            &env::current_account_id(),
            Some(score.output_hash.clone()),
        );
        emit_event(
            "score_recorded",
            Some(&work_order_id),
            Some(&asset_id),
            &env::current_account_id(),
            json!({
                "execution_id": &score.execution_id,
                "policy_hash": &score.policy_hash,
                "wasm_hash": &score.wasm_hash,
                "input_hash": &score.input_hash,
                "output_hash": &score.output_hash,
                "winner_bid_id": score.ranking.first().map(|r| r.bid_id.clone()),
                "mode": "outlayer",
            }),
        );
    }

    // -- award ---------------------------------------------------------------

    pub fn award(&mut self, work_order_id: String, bid_id: String) {
        self.assert_not_paused();
        self.assert_steward();
        self.assert_not_ai(&env::predecessor_account_id());
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != SCORED {
            fail(
                "INVALID_TRANSITION",
                "only SCORED work orders can be awarded",
            );
        }
        let score = match work_order.score.clone() {
            Some(score) => score,
            None => fail("SCORE_INVALID", "score is missing"),
        };
        if score.policy_hash != work_order.policy_hash {
            fail("SCORE_POLICY_MISMATCH", "score policy is stale");
        }
        let (_, canonical_hash) = self
            .canonical_input(&work_order)
            .unwrap_or_else(|| fail("SCORE_INVALID", "no revealed bids"));
        if score.input_hash != canonical_hash && score.bid_set_hash != canonical_hash {
            fail("SCORE_STALE", "score input no longer matches the bid set");
        }
        let rank_one = match score.ranking.first() {
            Some(rank) => rank,
            None => fail("SCORE_INVALID", "empty ranking"),
        };
        if rank_one.bid_id != bid_id {
            fail("INELIGIBLE_WINNER", "only the rank 1 eligible bid can win");
        }
        let reveal = match work_order.reveal_for(&bid_id) {
            Some(reveal) => reveal.clone(),
            None => fail("INELIGIBLE_WINNER", "winning bid was not revealed"),
        };
        if reveal.contractor_id != rank_one.contractor_id {
            fail("INELIGIBLE_WINNER", "ranking contractor mismatch");
        }
        if !work_order.contractor_roster.contains(&reveal.contractor_id) {
            fail("INELIGIBLE_WINNER", "winner is not on the roster");
        }
        if self.has_ai_role(&reveal.contractor_id) {
            fail("INELIGIBLE_WINNER", "AI accounts cannot be awarded");
        }
        if reveal.price > work_order.budget {
            fail("INELIGIBLE_WINNER", "bid exceeds the funded budget");
        }
        if work_order.inspector_roster.contains(&reveal.contractor_id) {
            fail(
                "INELIGIBLE_WINNER",
                "contractor cannot inspect their own work",
            );
        }
        let refund = checked_sub(work_order.budget, reveal.price);
        work_order.escrow.refunded = checked_add(work_order.escrow.refunded, refund);
        work_order.escrow.escrowed = reveal.price;
        work_order.assert_balanced();
        work_order.awarded_bid_id = Some(bid_id.clone());
        work_order.awarded_contractor = Some(reveal.contractor_id.clone());
        transition(&mut work_order, AWARDED);
        let asset_id = work_order.asset_id.clone();
        if refund > 0 {
            work_order.payments.push(PaymentRecord {
                id: format!("{}-refund-award", work_order_id),
                kind: "REFUND".to_string(),
                amount: refund,
                recipient: work_order.sponsor.clone(),
                status: "PENDING".to_string(),
                created_at: now(),
            });
        }
        self.work_orders.insert(&work_order_id, &work_order);
        self.total_refunded = checked_add(self.total_refunded, refund);
        if refund > 0 {
            self.ft_transfer(
                work_order.sponsor.clone(),
                refund,
                "MEND unawarded budget refund",
            );
            self.record_history(
                &asset_id,
                &work_order_id,
                "payment_released",
                &env::predecessor_account_id(),
                None,
            );
            emit_event(
                "payment_released",
                Some(&work_order_id),
                Some(&asset_id),
                &env::predecessor_account_id(),
                json!({ "kind": "REFUND", "recipient": &work_order.sponsor, "amount": refund.to_string() }),
            );
        }
        self.record_history(
            &asset_id,
            &work_order_id,
            "work_order_awarded",
            &env::predecessor_account_id(),
            Some(bid_id.clone()),
        );
        emit_event(
            "work_order_awarded",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({
                "bid_id": bid_id,
                "contractor": &reveal.contractor_id,
                "price": reveal.price.to_string(),
                "sponsor_refund": refund.to_string(),
                "escrowed": reveal.price.to_string(),
            }),
        );
    }

    // -- completion and durability ------------------------------------------

    pub fn start_work(&mut self, work_order_id: String) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        self.assert_not_ai(&caller);
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != AWARDED && work_order.status != WARRANTY_REOPENED {
            fail("INVALID_TRANSITION", "work cannot start in this state");
        }
        let contractor = match work_order.awarded_contractor.clone() {
            Some(contractor) => contractor,
            None => fail("INVALID_STATE", "no awarded contractor"),
        };
        if caller != contractor {
            fail(
                "FORBIDDEN_ROLE",
                "only the awarded contractor can start work",
            );
        }
        if let Some(warranty) = &mut work_order.warranty {
            if warranty.state == "OPEN" {
                warranty.state = "REMEDIATING".to_string();
            }
        }
        transition(&mut work_order, IN_PROGRESS);
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(&asset_id, &work_order_id, "work_started", &caller, None);
        emit_event(
            "work_started",
            Some(&work_order_id),
            Some(&asset_id),
            &caller,
            json!({ "contractor": &contractor, "reopened": work_order.reopen_count > 0 }),
        );
    }

    pub fn submit_completion(
        &mut self,
        work_order_id: String,
        evidence_id: String,
        evidence_hash: String,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        self.assert_not_ai(&caller);
        assert_id(&evidence_id, "evidence_id");
        assert_hash(&evidence_hash, "evidence_hash");
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != IN_PROGRESS {
            fail("INVALID_TRANSITION", "completion requires IN_PROGRESS");
        }
        let contractor = match work_order.awarded_contractor.clone() {
            Some(contractor) => contractor,
            None => fail("INVALID_STATE", "no awarded contractor"),
        };
        if caller != contractor {
            fail(
                "FORBIDDEN_ROLE",
                "only the awarded contractor can submit completion",
            );
        }
        if work_order.used_evidence_ids.contains(&evidence_id)
            || work_order.used_evidence_hashes.contains(&evidence_hash)
        {
            fail(
                "EVIDENCE_REPLAY",
                "evidence already used on this work order",
            );
        }
        let kind = if work_order.reopen_count > 0 {
            "REMEDIATION"
        } else {
            "COMPLETION"
        };
        work_order.used_evidence_ids.push(evidence_id.clone());
        work_order.used_evidence_hashes.push(evidence_hash.clone());
        work_order.evidence.push(EvidenceRecord {
            evidence_id: evidence_id.clone(),
            evidence_hash: evidence_hash.clone(),
            kind: kind.to_string(),
            submitted_by: caller.clone(),
            submitted_at: now(),
        });
        transition(&mut work_order, COMPLETION_SUBMITTED);
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "completion_submitted",
            &caller,
            Some(evidence_hash.clone()),
        );
        emit_event(
            "completion_submitted",
            Some(&work_order_id),
            Some(&asset_id),
            &caller,
            json!({ "evidence_id": &evidence_id, "evidence_hash": &evidence_hash, "kind": kind }),
        );
    }

    pub fn accept_completion(
        &mut self,
        work_order_id: String,
        inspection_id: String,
        notes_hash: String,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        self.assert_not_ai(&caller);
        assert_id(&inspection_id, "inspection_id");
        assert_hash(&notes_hash, "notes_hash");
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != COMPLETION_SUBMITTED {
            fail(
                "INVALID_TRANSITION",
                "completion is not awaiting acceptance",
            );
        }
        let contractor = match work_order.awarded_contractor.clone() {
            Some(contractor) => contractor,
            None => fail("INVALID_STATE", "no awarded contractor"),
        };
        if caller == contractor {
            fail(
                "CONTRACTOR_SELF_INSPECTION",
                "contractor cannot inspect their own work",
            );
        }
        if !work_order.inspector_roster.contains(&caller) {
            fail("FORBIDDEN_ROLE", "inspector is not on the approved roster");
        }
        if work_order
            .inspections
            .iter()
            .any(|inspection| inspection.inspection_id == inspection_id)
        {
            fail("EVIDENCE_REPLAY", "inspection id already used");
        }
        let kind = if work_order.completion_paid {
            "REMEDIATION"
        } else {
            "COMPLETION"
        };
        work_order.inspections.push(InspectionRecord {
            inspection_id: inspection_id.clone(),
            kind: kind.to_string(),
            inspector_id: caller.clone(),
            decision: "APPROVED".to_string(),
            notes_hash: notes_hash.clone(),
            evidence_id: work_order.evidence.last().map(|e| e.evidence_id.clone()),
            inspected_at: now(),
        });
        let mut completion_payment = 0u128;
        let mut holdback_payment = 0u128;

        if !work_order.completion_paid {
            // First acceptance pays exactly 90%; the remainder becomes the
            // durability holdback. The escrow ledger changes atomically.
            let award_held = work_order.escrow.escrowed;
            if award_held == 0 {
                fail("ESCROW_MISMATCH", "no award escrow to pay out");
            }
            let split = compute_split(award_held);
            completion_payment = split.0;
            holdback_payment = split.1;
            work_order.escrow.escrowed = 0;
            work_order.escrow.completion_paid =
                checked_add(work_order.escrow.completion_paid, completion_payment);
            work_order.escrow.holdback_held =
                checked_add(work_order.escrow.holdback_held, holdback_payment);
            work_order.completion_paid = true;
        } else {
            // Remediation acceptance pays nothing again.
            if work_order.escrow.escrowed != 0 {
                fail("ESCROW_MISMATCH", "remediation escrow must be zero");
            }
        }
        work_order.assert_balanced();
        work_order.inspector = Some(caller.clone());
        let durability_ns = (self.config.durability_minutes as u64)
            .checked_mul(60)
            .and_then(|v| v.checked_mul(1_000_000_000))
            .unwrap_or_else(|| fail("VALIDATION_ERROR", "durability interval overflow"));
        work_order.durability_due_at = Some(
            now()
                .checked_add(durability_ns)
                .unwrap_or_else(|| fail("VALIDATION_ERROR", "durability deadline overflow")),
        );
        transition(&mut work_order, COMPLETION_ACCEPTED);
        transition(&mut work_order, DURABILITY_PENDING);
        let asset_id = work_order.asset_id.clone();
        if completion_payment > 0 {
            work_order.payments.push(PaymentRecord {
                id: format!("{}-completion", work_order_id),
                kind: "COMPLETION".to_string(),
                amount: completion_payment,
                recipient: contractor.clone(),
                status: "PENDING".to_string(),
                created_at: now(),
            });
        }
        self.work_orders.insert(&work_order_id, &work_order);
        if completion_payment > 0 {
            self.total_completion_paid =
                checked_add(self.total_completion_paid, completion_payment);
            self.ft_transfer(
                contractor.clone(),
                completion_payment,
                "MEND completion payment (90%)",
            );
            self.record_history(&asset_id, &work_order_id, "payment_released", &caller, None);
            emit_event(
                "payment_released",
                Some(&work_order_id),
                Some(&asset_id),
                &caller,
                json!({ "kind": "COMPLETION", "recipient": &contractor, "amount": completion_payment.to_string() }),
            );
        }
        self.record_history(
            &asset_id,
            &work_order_id,
            "completion_accepted",
            &caller,
            Some(notes_hash.clone()),
        );
        emit_event(
            "completion_accepted",
            Some(&work_order_id),
            Some(&asset_id),
            &caller,
            json!({
                "inspection_id": &inspection_id,
                "kind": kind,
                "notes_hash": &notes_hash,
                "completion_paid": completion_payment.to_string(),
                "holdback_held": holdback_payment.to_string(),
                "durability_due_at": work_order.durability_due_at.map(|v| v.to_string()),
                "remediation": kind == "REMEDIATION",
            }),
        );
    }

    pub fn inspect_durability(
        &mut self,
        work_order_id: String,
        passed: bool,
        inspection_id: String,
        notes_hash: String,
    ) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        self.assert_not_ai(&caller);
        assert_id(&inspection_id, "inspection_id");
        assert_hash(&notes_hash, "notes_hash");
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != DURABILITY_PENDING {
            fail("INVALID_TRANSITION", "durability is not pending");
        }
        if now() < work_order.durability_due_at.unwrap_or(0) {
            fail(
                "INVALID_STATE",
                "durability inspection is not due; early inspection is not allowed",
            );
        }
        let contractor = match work_order.awarded_contractor.clone() {
            Some(contractor) => contractor,
            None => fail("INVALID_STATE", "no awarded contractor"),
        };
        if caller == contractor {
            fail(
                "CONTRACTOR_SELF_INSPECTION",
                "contractor cannot inspect their own work",
            );
        }
        if !work_order.inspector_roster.contains(&caller) {
            fail("FORBIDDEN_ROLE", "inspector is not on the approved roster");
        }
        if work_order
            .inspections
            .iter()
            .any(|inspection| inspection.inspection_id == inspection_id)
        {
            fail("EVIDENCE_REPLAY", "inspection id already used");
        }
        work_order.inspections.push(InspectionRecord {
            inspection_id: inspection_id.clone(),
            kind: "DURABILITY".to_string(),
            inspector_id: caller.clone(),
            decision: if passed { "APPROVED" } else { "REJECTED" }.to_string(),
            notes_hash: notes_hash.clone(),
            evidence_id: None,
            inspected_at: now(),
        });
        let asset_id = work_order.asset_id.clone();
        emit_event(
            "durability_inspection_recorded",
            Some(&work_order_id),
            Some(&asset_id),
            &caller,
            json!({ "inspection_id": &inspection_id, "passed": passed, "notes_hash": &notes_hash }),
        );

        if passed {
            if work_order.holdback_released {
                fail("DOUBLE_PAYMENT", "holdback already released");
            }
            if work_order.escrow.holdback_held == 0 {
                fail("ESCROW_MISMATCH", "no holdback is held");
            }
            let holdback = work_order.escrow.holdback_held;
            work_order.escrow.holdback_held = 0;
            work_order.escrow.holdback_released =
                checked_add(work_order.escrow.holdback_released, holdback);
            work_order.holdback_released = true;
            work_order.assert_balanced();
            if let Some(warranty) = &mut work_order.warranty {
                warranty.state = "CLOSED".to_string();
                warranty.closed_at = Some(now());
            }
            transition(&mut work_order, CLOSED);
            work_order.payments.push(PaymentRecord {
                id: format!("{}-holdback", work_order_id),
                kind: "HOLDBACK".to_string(),
                amount: holdback,
                recipient: contractor.clone(),
                status: "PENDING".to_string(),
                created_at: now(),
            });
            self.work_orders.insert(&work_order_id, &work_order);
            self.total_holdback_released = checked_add(self.total_holdback_released, holdback);
            self.ft_transfer(
                contractor.clone(),
                holdback,
                "MEND durability holdback (10%)",
            );
            self.record_history(
                &asset_id,
                &work_order_id,
                "durability_passed",
                &caller,
                Some(notes_hash.clone()),
            );
            emit_event(
                "durability_passed",
                Some(&work_order_id),
                Some(&asset_id),
                &caller,
                json!({ "holdback_released": holdback.to_string(), "contractor": &contractor }),
            );
            emit_event(
                "payment_released",
                Some(&work_order_id),
                Some(&asset_id),
                &caller,
                json!({ "kind": "HOLDBACK", "recipient": &contractor, "amount": holdback.to_string() }),
            );
        } else {
            // Failed durability reopens the SAME work order. No new escrow.
            work_order.reopen_count = work_order.reopen_count.saturating_add(1);
            work_order.warranty = Some(WarrantyCase {
                id: format!("{}-warranty-{}", work_order_id, work_order.reopen_count),
                failed_inspection_id: inspection_id.clone(),
                state: "OPEN".to_string(),
                opened_at: now(),
                closed_at: None,
            });
            transition(&mut work_order, WARRANTY_REOPENED);
            self.work_orders.insert(&work_order_id, &work_order);
            self.record_history(
                &asset_id,
                &work_order_id,
                "warranty_reopened",
                &caller,
                Some(notes_hash.clone()),
            );
            emit_event(
                "warranty_reopened",
                Some(&work_order_id),
                Some(&asset_id),
                &caller,
                json!({
                    "inspection_id": &inspection_id,
                    "reopen_count": work_order.reopen_count,
                    "escrowed": work_order.escrow.escrowed.to_string(),
                    "holdback_held": work_order.escrow.holdback_held.to_string(),
                    "new_funds": "0",
                }),
            );
        }
    }

    // -- disputes, cancellation and refunds ---------------------------------

    pub fn open_dispute(&mut self, work_order_id: String, reason_hash: String) {
        self.assert_not_paused();
        let caller = env::predecessor_account_id();
        self.assert_not_ai(&caller);
        assert_hash(&reason_hash, "reason_hash");
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status == DISPUTED {
            fail("DISPUTE_ALREADY_OPEN", "dispute is already open");
        }
        if !DISPUTABLE_STATES.contains(&work_order.status.as_str()) {
            fail("INVALID_TRANSITION", "state is not disputable");
        }
        let is_steward = self.has_role(&caller, ROLE_STEWARD);
        let is_inspector = work_order.inspector_roster.contains(&caller);
        let is_contractor = work_order.awarded_contractor.as_ref() == Some(&caller);
        if !is_steward && !is_inspector && !is_contractor {
            fail("FORBIDDEN_ROLE", "not a dispute participant");
        }
        work_order.dispute = Some(DisputeRecord {
            reason_hash: reason_hash.clone(),
            opened_by: caller.clone(),
            opened_at: now(),
            resolved_to: None,
            resolution_hash: None,
            resolved_at: None,
        });
        work_order.status = DISPUTED.to_string();
        work_order.updated_at = now();
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "dispute_opened",
            &caller,
            Some(reason_hash.clone()),
        );
        emit_event(
            "dispute_opened",
            Some(&work_order_id),
            Some(&asset_id),
            &caller,
            json!({ "reason_hash": &reason_hash, "payouts_frozen": true }),
        );
    }

    pub fn resolve_dispute(
        &mut self,
        work_order_id: String,
        target_state: String,
        resolution_hash: String,
    ) {
        self.assert_not_paused();
        self.assert_dao();
        self.assert_not_ai(&env::predecessor_account_id());
        assert_hash(&resolution_hash, "resolution_hash");
        if !DISPUTE_TARGETS.contains(&target_state.as_str()) {
            fail("INVALID_TRANSITION", "target state is not allowed");
        }
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status != DISPUTED {
            fail("INVALID_TRANSITION", "work order is not disputed");
        }
        let asset_id = work_order.asset_id.clone();
        if target_state == REFUNDED {
            let refund = checked_add(work_order.escrow.escrowed, work_order.escrow.holdback_held);
            work_order.escrow.refunded = checked_add(work_order.escrow.refunded, refund);
            work_order.escrow.escrowed = 0;
            work_order.escrow.holdback_held = 0;
            work_order.assert_balanced();
            if refund > 0 {
                work_order.payments.push(PaymentRecord {
                    id: format!("{}-refund-dispute", work_order_id),
                    kind: "REFUND".to_string(),
                    amount: refund,
                    recipient: work_order.sponsor.clone(),
                    status: "PENDING".to_string(),
                    created_at: now(),
                });
            }
            work_order.status = REFUNDED.to_string();
            work_order.updated_at = now();
            if let Some(warranty) = &mut work_order.warranty {
                warranty.state = "CLOSED".to_string();
                warranty.closed_at = Some(now());
            }
            self.work_orders.insert(&work_order_id, &work_order);
            self.total_refunded = checked_add(self.total_refunded, refund);
            if refund > 0 {
                self.ft_transfer(work_order.sponsor.clone(), refund, "MEND dispute refund");
            }
            self.record_history(
                &asset_id,
                &work_order_id,
                "work_order_refunded",
                &env::predecessor_account_id(),
                Some(resolution_hash.clone()),
            );
            emit_event(
                "work_order_refunded",
                Some(&work_order_id),
                Some(&asset_id),
                &env::predecessor_account_id(),
                json!({ "amount": refund.to_string(), "recipient": &work_order.sponsor, "source": "dispute_resolution" }),
            );
        } else if target_state == CLOSED {
            if work_order.escrow.escrowed != 0 {
                fail(
                    "ESCROW_MISMATCH",
                    "cannot close a disputed order with award escrow still held",
                );
            }
            if work_order.escrow.holdback_held > 0 {
                if work_order.holdback_released {
                    fail("DOUBLE_PAYMENT", "holdback already released");
                }
                let contractor = match work_order.awarded_contractor.clone() {
                    Some(contractor) => contractor,
                    None => fail("INVALID_STATE", "no awarded contractor"),
                };
                let holdback = work_order.escrow.holdback_held;
                work_order.escrow.holdback_held = 0;
                work_order.escrow.holdback_released =
                    checked_add(work_order.escrow.holdback_released, holdback);
                work_order.holdback_released = true;
                work_order.assert_balanced();
                work_order.payments.push(PaymentRecord {
                    id: format!("{}-holdback", work_order_id),
                    kind: "HOLDBACK".to_string(),
                    amount: holdback,
                    recipient: contractor.clone(),
                    status: "PENDING".to_string(),
                    created_at: now(),
                });
                self.total_holdback_released = checked_add(self.total_holdback_released, holdback);
                self.ft_transfer(
                    contractor.clone(),
                    holdback,
                    "MEND DAO dispute closure holdback",
                );
                emit_event(
                    "payment_released",
                    Some(&work_order_id),
                    Some(&asset_id),
                    &env::predecessor_account_id(),
                    json!({ "kind": "HOLDBACK", "recipient": &contractor, "amount": holdback.to_string(), "source": "dispute_resolution" }),
                );
            }
            if let Some(warranty) = &mut work_order.warranty {
                warranty.state = "CLOSED".to_string();
                warranty.closed_at = Some(now());
            }
            work_order.status = CLOSED.to_string();
            work_order.updated_at = now();
            self.work_orders.insert(&work_order_id, &work_order);
            self.record_history(
                &asset_id,
                &work_order_id,
                "dispute_resolved",
                &env::predecessor_account_id(),
                Some(resolution_hash.clone()),
            );
        } else {
            work_order.status = target_state.clone();
            work_order.updated_at = now();
            self.work_orders.insert(&work_order_id, &work_order);
            self.record_history(
                &asset_id,
                &work_order_id,
                "dispute_resolved",
                &env::predecessor_account_id(),
                Some(resolution_hash.clone()),
            );
        }
        if let Some(dispute) = &mut work_order.dispute {
            dispute.resolved_to = Some(target_state.clone());
            dispute.resolution_hash = Some(resolution_hash.clone());
            dispute.resolved_at = Some(now());
        }
        // Persist the dispute resolution metadata after the branch above.
        self.work_orders.insert(&work_order_id, &work_order);
        emit_event(
            "dispute_resolved",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({ "target_state": &target_state, "resolution_hash": &resolution_hash }),
        );
    }

    pub fn cancel_work_order(&mut self, work_order_id: String, reason_hash: String) {
        self.assert_not_paused();
        self.assert_steward();
        assert_hash(&reason_hash, "reason_hash");
        let mut work_order = self.load_work_order(&work_order_id);
        let pre_award = [
            DRAFT,
            POLICY_APPROVED,
            FUNDED,
            BIDDING_OPEN,
            BIDDING_REVEAL,
            SCORED,
        ]
        .contains(&work_order.status.as_str());
        if !pre_award {
            fail(
                "INVALID_TRANSITION",
                "only pre-award work orders can be cancelled",
            );
        }
        work_order.cancelled_reason = Some(reason_hash.clone());
        transition(&mut work_order, CANCELLED);
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.record_history(
            &asset_id,
            &work_order_id,
            "work_order_cancelled",
            &env::predecessor_account_id(),
            Some(reason_hash.clone()),
        );
        emit_event(
            "work_order_cancelled",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({ "reason_hash": &reason_hash }),
        );
    }

    pub fn refund(&mut self, work_order_id: String) {
        self.assert_not_paused();
        if !self.has_role(&env::predecessor_account_id(), ROLE_STEWARD) {
            self.assert_dao();
        }
        self.assert_not_ai(&env::predecessor_account_id());
        let mut work_order = self.load_work_order(&work_order_id);
        if work_order.status == REFUNDED {
            fail("DOUBLE_PAYMENT", "work order is already refunded");
        }
        let refundable = [CANCELLED, FUNDED, SCORED].contains(&work_order.status.as_str());
        if !refundable {
            fail(
                "INVALID_TRANSITION",
                "refund requires CANCELLED or a pre-award funded/scored state",
            );
        }
        let refund = work_order.escrow.escrowed;
        work_order.escrow.refunded = checked_add(work_order.escrow.refunded, refund);
        work_order.escrow.escrowed = 0;
        work_order.assert_balanced();
        if refund > 0 {
            work_order.payments.push(PaymentRecord {
                id: format!("{}-refund", work_order_id),
                kind: "REFUND".to_string(),
                amount: refund,
                recipient: work_order.sponsor.clone(),
                status: "PENDING".to_string(),
                created_at: now(),
            });
        }
        transition(&mut work_order, REFUNDED);
        let asset_id = work_order.asset_id.clone();
        self.work_orders.insert(&work_order_id, &work_order);
        self.total_refunded = checked_add(self.total_refunded, refund);
        if refund > 0 {
            self.ft_transfer(work_order.sponsor.clone(), refund, "MEND work order refund");
        }
        self.record_history(
            &asset_id,
            &work_order_id,
            "work_order_refunded",
            &env::predecessor_account_id(),
            None,
        );
        emit_event(
            "work_order_refunded",
            Some(&work_order_id),
            Some(&asset_id),
            &env::predecessor_account_id(),
            json!({ "amount": refund.to_string(), "recipient": &work_order.sponsor }),
        );
    }

    // -- views ---------------------------------------------------------------

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            owner: self.config.owner.clone(),
            token: self.config.token.clone(),
            dao: self.config.dao.clone(),
            policy_hash: self.config.policy_hash.clone(),
            durability_minutes: self.config.durability_minutes,
            paused: self.paused,
            scoring_enabled: self.config.scoring_enabled,
            outlayer_account: self.config.outlayer_account.clone(),
            outlayer_project_id: self.config.outlayer_project_id.clone(),
            scoring_wasm_hash: self.config.scoring_wasm_hash.clone(),
        }
    }

    pub fn get_role(&self, account: AccountId) -> Vec<String> {
        self.roles.get(&account).unwrap_or_default()
    }

    pub fn is_paused(&self) -> bool {
        self.paused
    }

    pub fn get_asset(&self, asset_id: String) -> Option<AssetView> {
        self.assets.get(&asset_id).map(|asset| AssetView {
            id: asset.id,
            description_hash: asset.description_hash,
            location_hash: asset.location_hash,
            created_at: asset.created_at,
            created_by: asset.created_by,
            passport_token_id: asset.passport_token_id,
            work_order_ids: asset.work_order_ids,
        })
    }

    pub fn get_work_order(&self, work_order_id: String) -> Option<WorkOrderView> {
        self.work_orders.get(&work_order_id).map(|wo| {
            let dispute_open = wo.status == DISPUTED;
            WorkOrderView {
                id: wo.id,
                asset_id: wo.asset_id,
                cluster_hash: wo.cluster_hash,
                scope_hash: wo.scope_hash,
                dao_proposal_id: wo.dao_proposal_id,
                policy_hash: wo.policy_hash,
                budget: U128(wo.budget),
                sponsor: wo.sponsor,
                contractor_roster: wo.contractor_roster,
                inspector_roster: wo.inspector_roster,
                commit_deadline: wo.commit_deadline,
                reveal_deadline: wo.reveal_deadline,
                status: wo.status,
                proposed_by: wo.proposed_by,
                created_at: wo.created_at,
                updated_at: wo.updated_at,
                approved_at: wo.approved_at,
                approved_proposal_id: wo.approved_proposal_id,
                awarded_bid_id: wo.awarded_bid_id,
                awarded_contractor: wo.awarded_contractor,
                inspector: wo.inspector,
                durability_due_at: wo.durability_due_at,
                reopen_count: wo.reopen_count,
                completion_paid: wo.completion_paid,
                holdback_released: wo.holdback_released,
                funded: U128(wo.escrow.funding),
                dispute_open,
            }
        })
    }

    pub fn get_bids(&self, work_order_id: String) -> Option<BidsView> {
        self.work_orders.get(&work_order_id).map(|wo| {
            let reveal_visible = wo.is_reveal_phase(now());
            BidsView {
                commitments: wo
                    .bids
                    .iter()
                    .map(|bid| BidCommitmentView {
                        bid_id: bid.bid_id.clone(),
                        contractor_id: bid.contractor_id.clone(),
                        commitment_hash: bid.commitment_hash.clone(),
                        committed_at: bid.committed_at,
                    })
                    .collect(),
                reveals: if reveal_visible {
                    Some(wo.reveals.iter().map(reveal_view).collect())
                } else {
                    None
                },
            }
        })
    }

    pub fn get_revealed_bid(&self, work_order_id: String, bid_id: String) -> Option<BidRevealView> {
        let wo = self.work_orders.get(&work_order_id)?;
        if !wo.is_reveal_phase(now()) {
            return None;
        }
        wo.reveal_for(&bid_id).map(reveal_view)
    }

    pub fn get_score(&self, work_order_id: String) -> Option<ScoreExecutionView> {
        self.work_orders.get(&work_order_id).and_then(|wo| {
            wo.score.map(|score| ScoreExecutionView {
                execution_id: score.execution_id,
                policy_hash: score.policy_hash,
                wasm_hash: score.wasm_hash,
                input_hash: score.input_hash,
                output_hash: score.output_hash,
                ranking: score
                    .ranking
                    .into_iter()
                    .map(|rank| ScoredRankView {
                        rank: rank.rank,
                        bid_id: rank.bid_id,
                        contractor_id: rank.contractor_id,
                        score_bps: rank.score_bps,
                    })
                    .collect(),
                mode: score.mode,
                created_at: score.created_at,
            })
        })
    }

    pub fn get_escrow(&self, work_order_id: String) -> Option<EscrowView> {
        self.work_orders.get(&work_order_id).map(|wo| EscrowView {
            funding: U128(wo.escrow.funding),
            refunded: U128(wo.escrow.refunded),
            escrowed: U128(wo.escrow.escrowed),
            completion_paid: U128(wo.escrow.completion_paid),
            holdback_held: U128(wo.escrow.holdback_held),
            holdback_released: U128(wo.escrow.holdback_released),
        })
    }

    pub fn get_payments(&self, work_order_id: String) -> Vec<PaymentView> {
        self.work_orders
            .get(&work_order_id)
            .map(|wo| {
                wo.payments
                    .into_iter()
                    .map(|payment| PaymentView {
                        id: payment.id,
                        kind: payment.kind,
                        amount: U128(payment.amount),
                        recipient: payment.recipient,
                        status: payment.status,
                        created_at: payment.created_at,
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_warranty(&self, work_order_id: String) -> Option<WarrantyView> {
        self.work_orders.get(&work_order_id).map(|wo| WarrantyView {
            work_order_id: wo.id,
            state: wo
                .warranty
                .as_ref()
                .map(|warranty| warranty.state.clone())
                .unwrap_or_else(|| "NONE".to_string()),
            work_order_state: wo.status,
            reopen_count: wo.reopen_count,
            durability_due_at: wo.durability_due_at,
            completion_paid: wo.completion_paid,
            holdback_released: wo.holdback_released,
            holdback_held: U128(wo.escrow.holdback_held),
            holdback_released_amount: U128(wo.escrow.holdback_released),
            failed_inspection_id: wo
                .warranty
                .as_ref()
                .map(|warranty| warranty.failed_inspection_id.clone()),
        })
    }

    pub fn get_history(&self, asset_id: String) -> Vec<HistoryEntryView> {
        self.assets
            .get(&asset_id)
            .map(|asset| {
                asset
                    .history
                    .into_iter()
                    .map(|entry| HistoryEntryView {
                        work_order_id: entry.work_order_id,
                        action: entry.action,
                        actor: entry.actor,
                        at: entry.at,
                        detail_hash: entry.detail_hash,
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_work_orders_by_asset(&self, asset_id: String) -> Vec<String> {
        self.assets
            .get(&asset_id)
            .map(|asset| asset.work_order_ids)
            .unwrap_or_default()
    }

    pub fn get_score_input(&self, work_order_id: String) -> Option<ScoreInputView> {
        let wo = self.work_orders.get(&work_order_id)?;
        self.canonical_input(&wo).map(|(input, input_hash)| {
            let bid_count = wo.reveals.len() as u32;
            ScoreInputView {
                input,
                input_hash,
                bid_count,
            }
        })
    }

    pub fn get_reconciliation(&self) -> ReconciliationView {
        ReconciliationView {
            total_funding: U128(self.total_funding),
            total_refunded: U128(self.total_refunded),
            total_completion_paid: U128(self.total_completion_paid),
            total_holdback_released: U128(self.total_holdback_released),
        }
    }

    // -- internals -----------------------------------------------------------

    fn load_work_order(&self, work_order_id: &str) -> WorkOrder {
        match self.work_orders.get(&work_order_id.to_string()) {
            Some(work_order) => work_order,
            None => fail("NOT_FOUND", "work order does not exist"),
        }
    }

    fn emit_funding_failed(
        &self,
        work_order: &WorkOrder,
        sender: &AccountId,
        code: &str,
        message: &str,
        amount: u128,
    ) {
        emit_event(
            "funding_failed",
            Some(&work_order.id),
            Some(&work_order.asset_id),
            sender,
            json!({ "reason": code, "message": message, "amount": amount.to_string() }),
        );
    }

    fn attach_work_order_to_asset(&mut self, asset_id: &str, work_order_id: &str) {
        if let Some(mut asset) = self.assets.get(&asset_id.to_string()) {
            if !asset.work_order_ids.iter().any(|id| id == work_order_id) {
                asset.work_order_ids.push(work_order_id.to_string());
            }
            self.assets.insert(&asset_id.to_string(), &asset);
        }
    }

    fn record_history(
        &mut self,
        asset_id: &str,
        work_order_id: &str,
        action: &str,
        actor: &AccountId,
        detail_hash: Option<String>,
    ) {
        if let Some(mut asset) = self.assets.get(&asset_id.to_string()) {
            asset.history.push(HistoryEntry {
                work_order_id: work_order_id.to_string(),
                action: action.to_string(),
                actor: actor.clone(),
                at: now(),
                detail_hash,
            });
            self.assets.insert(&asset_id.to_string(), &asset);
        }
    }

    fn canonical_input(&self, wo: &WorkOrder) -> Option<(String, String)> {
        if wo.reveals.is_empty() {
            return None;
        }
        let mut reveals: Vec<&BidReveal> = wo.reveals.iter().collect();
        reveals.sort_by(|a, b| a.bid_id.cmp(&b.bid_id));
        let bids: Vec<CanonicalBid> = reveals
            .iter()
            .map(|reveal| CanonicalBid {
                bid_id: &reveal.bid_id,
                contractor: reveal.contractor_id.as_str(),
                price_micro: reveal.price.to_string(),
                duration_days: reveal.duration_days,
                warranty_days: reveal.warranty_days,
                materials_score: reveal.materials_score,
                eligible: true,
                commitment_hash: &reveal.commitment_hash,
            })
            .collect();
        let canonical = CanonicalInput {
            schema: "mend.bid-rules.v1",
            work_order_id: &wo.id,
            policy_hash: &wo.policy_hash,
            policy: CanonicalPolicy {
                version: POLICY_VERSION,
                price_weight_bp: PRICE_WEIGHT_BPS,
                warranty_weight_bp: WARRANTY_WEIGHT_BPS,
                duration_weight_bp: DURATION_WEIGHT_BPS,
                materials_weight_bp: MATERIALS_WEIGHT_BPS,
            },
            bids,
            tie_break: "score_desc_price_asc_warranty_desc_duration_asc_bid_id_asc",
        };
        let input = near_sdk::serde_json::to_string(&canonical)
            .unwrap_or_else(|_| fail("SCORE_INVALID", "canonical input serialization failed"));
        let input_hash = sha256_hex(input.as_bytes());
        Some((input, input_hash))
    }

    fn has_role(&self, account: &AccountId, role: &str) -> bool {
        self.roles
            .get(account)
            .map(|roles| roles.iter().any(|r| r == role))
            .unwrap_or(false)
    }

    fn has_ai_role(&self, account: &AccountId) -> bool {
        AI_ROLES.iter().any(|role| self.has_role(account, role))
    }

    fn assert_not_ai(&self, account: &AccountId) {
        if self.has_ai_role(account) {
            fail(
                "FORBIDDEN_ROLE",
                "AI accounts cannot award, accept, refund or release funds",
            );
        }
    }

    fn assert_not_paused(&self) {
        if self.paused {
            fail("CONTRACT_PAUSED", "contract is paused");
        }
    }

    fn assert_owner_or_dao(&self) {
        let caller = env::predecessor_account_id();
        if caller != self.config.owner && caller != self.config.dao {
            fail("UNAUTHORIZED", "owner or DAO only");
        }
    }

    fn assert_dao(&self) {
        if env::predecessor_account_id() != self.config.dao {
            fail("UNAUTHORIZED", "DAO only");
        }
    }

    fn assert_steward(&self) {
        if !self.has_role(&env::predecessor_account_id(), ROLE_STEWARD) {
            fail("FORBIDDEN_ROLE", "steward role required");
        }
    }

    fn assert_steward_or_coordinator(&self) {
        let caller = env::predecessor_account_id();
        if !self.has_role(&caller, ROLE_STEWARD) && !self.has_role(&caller, ROLE_COORDINATOR_AI) {
            fail("FORBIDDEN_ROLE", "steward or coordinator role required");
        }
    }

    fn assert_steward_or_oracle(&self) {
        let caller = env::predecessor_account_id();
        if !self.has_role(&caller, ROLE_STEWARD) && !self.has_role(&caller, ROLE_ORACLE) {
            fail("FORBIDDEN_ROLE", "steward or oracle role required");
        }
    }

    fn ft_transfer(&self, recipient: AccountId, amount: u128, memo: &str) {
        if amount == 0 {
            return;
        }
        ext_ft_core::ext(self.config.token.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(Gas::from_tgas(20))
            .ft_transfer(recipient, U128(amount), Some(memo.to_string()))
            .detach();
    }
}

// ---------------------------------------------------------------------------
// NEP-171 passport (holder is the hub; transfers and approvals always fail)
// ---------------------------------------------------------------------------

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
        fail("TRANSFER_DISABLED", "MEND passports are non-transferable");
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
        fail("TRANSFER_DISABLED", "MEND passports are non-transferable");
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "MEND Maintenance Passport".to_string(),
            symbol: "MEND".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}

#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl Contract {
    #[payable]
    pub fn nft_approve(
        &mut self,
        _token_id: TokenId,
        _account_id: AccountId,
        _msg: Option<String>,
    ) -> Option<Promise> {
        fail("TRANSFER_DISABLED", "passport approvals are disabled");
    }

    #[payable]
    pub fn nft_revoke(&mut self, _token_id: TokenId, _account_id: AccountId) {
        fail("TRANSFER_DISABLED", "passport approvals are disabled");
    }

    #[payable]
    pub fn nft_revoke_all(&mut self, _token_id: TokenId) {
        fail("TRANSFER_DISABLED", "passport approvals are disabled");
    }

    pub fn nft_is_approved(
        &self,
        _token_id: TokenId,
        _approved_account_id: AccountId,
        _approval_id: Option<u64>,
    ) -> bool {
        false
    }
}

// ---------------------------------------------------------------------------
// OutLayer external interfaces
// ---------------------------------------------------------------------------

#[near_sdk::ext_contract(ext_outlayer)]
#[allow(dead_code, clippy::too_many_arguments)]
trait OutLayer {
    fn request_execution(
        &mut self,
        source: Value,
        resource_limits: Option<Value>,
        input_data: Option<String>,
        secrets_ref: Option<Value>,
        response_format: Option<String>,
        payer_account_id: Option<AccountId>,
        params: Option<Value>,
    );
}

#[near_sdk::ext_contract(ext_self)]
#[allow(dead_code)]
trait SelfCallback {
    fn on_score_result(
        &mut self,
        work_order_id: String,
        expected_input_hash: String,
        expected_policy_hash: String,
    );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

fn now() -> u64 {
    env::block_timestamp()
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = env::sha256(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{:02x}", byte));
    }
    out
}

#[allow(clippy::too_many_arguments)]
pub fn bid_commitment_payload(
    bid_id: &str,
    contractor_id: &AccountId,
    price: u128,
    duration_days: u32,
    warranty_days: u32,
    materials_score: u32,
    checklist_accepted: bool,
    nonce: &str,
) -> String {
    format!(
        "MEND_BID_V1|{}|{}|{}|{}|{}|{}|{}|{}",
        bid_id,
        contractor_id,
        price,
        duration_days,
        warranty_days,
        materials_score,
        if checklist_accepted { "1" } else { "0" },
        nonce
    )
}

pub fn compute_split(amount: u128) -> (u128, u128) {
    let completion = amount
        .checked_mul(COMPLETION_BPS)
        .unwrap_or_else(|| fail("OVERPAYMENT", "split overflow"))
        / BPS_DENOMINATOR;
    let holdback = amount - completion;
    (completion, holdback)
}

fn is_lower_hex_64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn assert_hash(value: &str, label: &str) {
    if is_lower_hex_64(value) {
        return;
    }
    if value.contains("http://") || value.contains("https://") {
        fail(
            "EVIDENCE_PRIVATE_URL",
            format!("{} must be a sha256 hash, not a URL", label),
        );
    }
    fail(
        "VALIDATION_ERROR",
        format!("{} must be 64 lowercase hex characters", label),
    );
}

fn assert_id(value: &str, label: &str) {
    let valid = !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
    if !valid {
        fail("VALIDATION_ERROR", format!("invalid {}", label));
    }
}

/// OutLayer project IDs use `owner/project`, exactly one slash.
fn assert_project_id(value: &str, label: &str) {
    let parts: Vec<&str> = value.split('/').collect();
    let valid = parts.len() == 2
        && !parts[0].is_empty()
        && !parts[1].is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '/');
    if !valid {
        fail("VALIDATION_ERROR", format!("invalid {}", label));
    }
}

fn validate_rosters(contractors: &[AccountId], inspectors: &[AccountId]) {
    if contractors.is_empty() {
        fail("VALIDATION_ERROR", "contractor roster cannot be empty");
    }
    if inspectors.is_empty() {
        fail("VALIDATION_ERROR", "inspector roster cannot be empty");
    }
    let mut seen_contractors: Vec<&AccountId> = Vec::new();
    for contractor in contractors {
        if seen_contractors.contains(&contractor) {
            fail("VALIDATION_ERROR", "duplicate contractor roster entry");
        }
        seen_contractors.push(contractor);
        if inspectors.contains(contractor) {
            fail(
                "VALIDATION_ERROR",
                "contractor and inspector rosters must be disjoint",
            );
        }
    }
    let mut seen_inspectors: Vec<&AccountId> = Vec::new();
    for inspector in inspectors {
        if seen_inspectors.contains(&inspector) {
            fail("VALIDATION_ERROR", "duplicate inspector roster entry");
        }
        seen_inspectors.push(inspector);
    }
}

fn allowed_transition(from: &str, to: &str) -> bool {
    let allowed: &[&str] = match from {
        DRAFT => &[POLICY_APPROVED, CANCELLED],
        POLICY_APPROVED => &[FUNDED, CANCELLED],
        FUNDED => &[BIDDING_OPEN, CANCELLED, REFUNDED],
        BIDDING_OPEN => &[BIDDING_REVEAL, CANCELLED],
        BIDDING_REVEAL => &[SCORED, CANCELLED],
        SCORED => &[AWARDED, CANCELLED, REFUNDED],
        AWARDED => &[IN_PROGRESS, DISPUTED],
        IN_PROGRESS => &[COMPLETION_SUBMITTED, DISPUTED],
        COMPLETION_SUBMITTED => &[COMPLETION_ACCEPTED, DISPUTED],
        COMPLETION_ACCEPTED => &[DURABILITY_PENDING, DISPUTED],
        DURABILITY_PENDING => &[CLOSED, WARRANTY_REOPENED, DISPUTED],
        WARRANTY_REOPENED => &[IN_PROGRESS, DISPUTED],
        CANCELLED => &[REFUNDED],
        _ => &[],
    };
    allowed.contains(&to)
}

fn transition(work_order: &mut WorkOrder, to: &str) {
    if !allowed_transition(&work_order.status, to) {
        fail(
            "INVALID_TRANSITION",
            format!("{} -> {}", work_order.status, to),
        );
    }
    work_order.status = to.to_string();
    work_order.updated_at = now();
}

fn validate_ranking(work_order: &WorkOrder, ranking: &[ScoredRank]) {
    if work_order.reveals.is_empty() {
        fail("SCORE_INVALID", "no revealed bids");
    }
    if ranking.len() != work_order.reveals.len() {
        fail(
            "SCORE_INVALID",
            "ranking must contain every revealed bid exactly once",
        );
    }
    let mut seen: Vec<&str> = Vec::new();
    for (index, rank) in ranking.iter().enumerate() {
        if rank.rank != (index as u32 + 1) {
            fail("SCORE_INVALID", "ranks must be 1..n in order");
        }
        if rank.score_bps > 10_000 {
            fail("SCORE_INVALID", "score out of range");
        }
        if seen.contains(&rank.bid_id.as_str()) {
            fail("SCORE_INVALID", "duplicate bid in ranking");
        }
        seen.push(&rank.bid_id);
        let reveal = match work_order.reveal_for(&rank.bid_id) {
            Some(reveal) => reveal,
            None => fail("SCORE_INVALID", "ranking contains an unrevealed bid"),
        };
        if reveal.contractor_id != rank.contractor_id {
            fail("SCORE_INVALID", "ranking contractor mismatch");
        }
    }
    for reveal in &work_order.reveals {
        if !seen.contains(&reveal.bid_id.as_str()) {
            fail("SCORE_INVALID", "ranking is missing a revealed bid");
        }
    }
    for pair in ranking.windows(2) {
        let first = &pair[0];
        let second = &pair[1];
        let first_reveal = work_order.reveal_for(&first.bid_id).unwrap();
        let second_reveal = work_order.reveal_for(&second.bid_id).unwrap();
        if !rank_better(
            first.score_bps,
            first_reveal,
            second.score_bps,
            second_reveal,
        ) {
            fail("SCORE_INVALID", "ranking is not in deterministic order");
        }
    }
}

/// True if `a` ranks ahead of `b` under RULES.md §5.
fn rank_better(a_score: u32, a: &BidReveal, b_score: u32, b: &BidReveal) -> bool {
    if a_score != b_score {
        return a_score > b_score;
    }
    if a.price != b.price {
        return a.price < b.price;
    }
    if a.warranty_days != b.warranty_days {
        return a.warranty_days > b.warranty_days;
    }
    if a.duration_days != b.duration_days {
        return a.duration_days < b.duration_days;
    }
    a.bid_id < b.bid_id
}

fn validate_score_output(work_order: &WorkOrder, output: &ScoreOutput) -> Option<Vec<ScoredRank>> {
    if output.schema != "mend.score.v1" {
        return None;
    }
    if output.scores.len() != work_order.reveals.len() {
        return None;
    }
    let mut scored: Vec<(u32, &BidReveal)> = Vec::new();
    for reveal in &work_order.reveals {
        let score = *output.scores.get(&reveal.bid_id)?;
        if score > 10_000 {
            return None;
        }
        scored.push((score, reveal));
    }
    for bid_id in output.scores.keys() {
        work_order.reveal_for(bid_id)?;
    }
    let winner = work_order.reveal_for(&output.winner_bid_id)?;
    let winner_score = *output.scores.get(&output.winner_bid_id)?;
    let max_score = scored.iter().map(|(score, _)| *score).max()?;
    if winner_score != max_score {
        return None;
    }
    for (score, reveal) in &scored {
        if *score == max_score && reveal.bid_id != winner.bid_id {
            // The winner must win the deterministic tie-break too.
            if !rank_better(winner_score, winner, *score, reveal) {
                return None;
            }
        }
    }
    scored.sort_by(|(a_score, a), (b_score, b)| {
        if a_score != b_score {
            return b_score.cmp(a_score);
        }
        if a.price != b.price {
            return a.price.cmp(&b.price);
        }
        if a.warranty_days != b.warranty_days {
            return b.warranty_days.cmp(&a.warranty_days);
        }
        if a.duration_days != b.duration_days {
            return a.duration_days.cmp(&b.duration_days);
        }
        a.bid_id.cmp(&b.bid_id)
    });
    if scored.first()?.1.bid_id != output.winner_bid_id {
        return None;
    }
    Some(
        scored
            .into_iter()
            .enumerate()
            .map(|(index, (score, reveal))| ScoredRank {
                rank: index as u32 + 1,
                bid_id: reveal.bid_id.clone(),
                contractor_id: reveal.contractor_id.clone(),
                score_bps: score,
            })
            .collect(),
    )
}

fn reveal_view(reveal: &BidReveal) -> BidRevealView {
    BidRevealView {
        bid_id: reveal.bid_id.clone(),
        contractor_id: reveal.contractor_id.clone(),
        price: U128(reveal.price),
        duration_days: reveal.duration_days,
        warranty_days: reveal.warranty_days,
        materials_score: reveal.materials_score,
        checklist_accepted: reveal.checklist_accepted,
        nonce: reveal.nonce.clone(),
        commitment_hash: reveal.commitment_hash.clone(),
        revealed_at: reveal.revealed_at,
    }
}

fn checked_add(a: u128, b: u128) -> u128 {
    a.checked_add(b)
        .unwrap_or_else(|| fail("OVERPAYMENT", "amount overflow"))
}

fn checked_sub(a: u128, b: u128) -> u128 {
    a.checked_sub(b)
        .unwrap_or_else(|| fail("ESCROW_MISMATCH", "amount underflow"))
}

fn fail(code: &str, message: impl AsRef<str>) -> ! {
    env::panic_str(&format!("{}: {}", code, message.as_ref()))
}

fn emit_event(
    event: &str,
    work_order_id: Option<&str>,
    asset_id: Option<&str>,
    actor: &AccountId,
    extra: Value,
) {
    let mut data = match extra {
        Value::Object(map) => map,
        _ => near_sdk::serde_json::Map::new(),
    };
    if let Some(work_order_id) = work_order_id {
        data.insert("work_order_id".to_string(), json!(work_order_id));
    }
    if let Some(asset_id) = asset_id {
        data.insert("asset_id".to_string(), json!(asset_id));
    }
    data.insert("actor".to_string(), json!(actor));
    data.insert(
        "timestamp_ns".to_string(),
        json!(env::block_timestamp().to_string()),
    );
    let payload = json!({
        "standard": EVENT_STANDARD,
        "version": EVENT_VERSION,
        "event": event,
        "data": Value::Object(data),
    });
    env::log_str(&format!("EVENT_JSON:{}", payload));
}

#[cfg(test)]
mod tests;

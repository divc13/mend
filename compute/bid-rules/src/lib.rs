//! MEND deterministic bid evaluation (`mend-bid-policy-v1`).
//!
//! The entire implementation is integer-only. There is no clock, no network,
//! no randomness, no floating point and no LLM. The same input bytes always
//! produce the same output bytes.
//!
//! Public entry point: [`evaluate_json`].
//!
//! Input (JSON):
//! ```json
//! {
//!   "schema": "mend.bid-rules.v1",
//!   "policyHash": "<sha256 of MEND_POLICY_V1|version|weights>",
//!   "policyVersion": "mend-bid-policy-v1",
//!   "weightsBps": {"price": 4500, "warranty": 2500, "duration": 2000, "materials": 1000},
//!   "bids": [
//!     {
//!       "bidId": "BID-B-BENCH-001",
//!       "contractorId": "contractor-b.mend.testnet",
//!       "priceMicro": "80000000",
//!       "durationDays": 10,
//!       "warrantyDays": 180,
//!       "materialsScore": 80,
//!       "eligible": true,
//!       "evidenceChecklistAccepted": true,
//!       "nonce": "nonce-b-0002"
//!     }
//!   ]
//! }
//! ```
//!
//! `commitmentHash` may be supplied per bid instead of `nonce`. When neither is
//! present the input hash falls back to a hash of the canonical bid list. The
//! canonical on-chain form is the commitment-hash form used by
//! `@mend/protocol` (`scoreInputHash`).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const SCHEMA_ID: &str = "mend.bid-rules.v1";
pub const POLICY_VERSION: &str = "mend-bid-policy-v1";
pub const BPS_DENOMINATOR: u128 = 10_000;

pub const PRICE_BPS: u32 = 4_500;
pub const WARRANTY_BPS: u32 = 2_500;
pub const DURATION_BPS: u32 = 2_000;
pub const MATERIALS_BPS: u32 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeightsBps {
    pub price: u32,
    pub warranty: u32,
    pub duration: u32,
    pub materials: u32,
}

pub const DEFAULT_WEIGHTS: WeightsBps = WeightsBps {
    price: PRICE_BPS,
    warranty: WARRANTY_BPS,
    duration: DURATION_BPS,
    materials: MATERIALS_BPS,
};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BidInput {
    pub bid_id: String,
    pub contractor_id: String,
    pub price_micro: String,
    pub duration_days: i64,
    pub warranty_days: i64,
    pub materials_score: i64,
    /// Missing is treated as false: an omitted eligibility flag can never win.
    #[serde(default)]
    pub eligible: bool,
    #[serde(default)]
    pub evidence_checklist_accepted: Option<bool>,
    #[serde(default)]
    pub nonce: Option<String>,
    #[serde(default)]
    pub commitment_hash: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreInput {
    #[serde(default)]
    pub schema: Option<String>,
    #[serde(default)]
    pub policy_hash: Option<String>,
    #[serde(default)]
    pub policy_version: Option<String>,
    #[serde(default)]
    pub weights_bps: Option<WeightsBps>,
    #[serde(default)]
    pub bids: Vec<BidInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DimensionScoresBps {
    pub price: u32,
    pub warranty: u32,
    pub duration: u32,
    pub materials: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScoredBid {
    pub rank: u32,
    pub bid_id: String,
    pub contractor_id: String,
    pub score_bps: u32,
    pub dimensions_bps: DimensionScoresBps,
    pub price_micro: String,
    pub duration_days: i64,
    pub warranty_days: i64,
    pub materials_score: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExcludedBid {
    pub bid_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScoreOutput {
    pub schema: String,
    pub policy_version: String,
    pub policy_hash: String,
    pub weights_bps: WeightsBps,
    pub ranking: Vec<ScoredBid>,
    pub excluded: Vec<ExcludedBid>,
    pub winner_bid_id: String,
    pub input_hash: String,
    pub output_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ErrorOutput {
    pub schema: String,
    pub error: ErrorBody,
}

#[derive(Debug, Clone)]
struct EvalError {
    code: &'static str,
    message: String,
}

impl EvalError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

fn validate_policy_version(version: &str) -> Result<(), EvalError> {
    if version != POLICY_VERSION {
        return Err(EvalError::new(
            "SCORE_POLICY_MISMATCH",
            format!("unsupported policy version: {version}"),
        ));
    }
    Ok(())
}

/// Policy hash exactly as `@mend/protocol` computes it.
pub fn policy_hash(weights: &WeightsBps) -> String {
    sha256_hex(
        format!(
            "MEND_POLICY_V1|{}|{}|{}|{}|{}",
            POLICY_VERSION, weights.price, weights.warranty, weights.duration, weights.materials
        )
        .as_bytes(),
    )
}

/// Commitment payload exactly as `@mend/protocol` and the hub compute it.
pub fn bid_commitment_payload(bid: &BidInput) -> Option<String> {
    let nonce = bid.nonce.as_ref()?;
    Some(format!(
        "MEND_BID_V1|{}|{}|{}|{}|{}|{}|{}|{}",
        bid.bid_id,
        bid.contractor_id,
        bid.price_micro,
        bid.duration_days,
        bid.warranty_days,
        bid.materials_score,
        if bid.evidence_checklist_accepted.unwrap_or(false) {
            "1"
        } else {
            "0"
        },
        nonce
    ))
}

pub fn bid_commitment_hash(bid: &BidInput) -> Option<String> {
    bid_commitment_payload(bid).map(|payload| sha256_hex(payload.as_bytes()))
}

fn normalize(value: u128, min: u128, max: u128, lower_is_better: bool) -> Result<u128, EvalError> {
    if max == min {
        return Ok(BPS_DENOMINATOR);
    }
    let raw = if lower_is_better {
        max - value
    } else {
        value - min
    };
    raw.checked_mul(BPS_DENOMINATOR)
        .map(|scaled| scaled / (max - min))
        .ok_or_else(|| EvalError::new("SCORE_INVALID", "normalization arithmetic overflow"))
}

fn parse_eligible_bid(bid: &BidInput) -> Result<(u128, u128, u128), EvalError> {
    let price: u128 = bid.price_micro.parse().map_err(|_| {
        EvalError::new("SCORE_INVALID", format!("invalid price for {}", bid.bid_id))
    })?;
    if price == 0 {
        return Err(EvalError::new(
            "SCORE_INVALID",
            format!("price must be > 0 for {}", bid.bid_id),
        ));
    }
    if bid.duration_days <= 0 {
        return Err(EvalError::new(
            "SCORE_INVALID",
            format!("durationDays must be > 0 for {}", bid.bid_id),
        ));
    }
    if bid.warranty_days < 0 {
        return Err(EvalError::new(
            "SCORE_INVALID",
            format!("warrantyDays must be >= 0 for {}", bid.bid_id),
        ));
    }
    if bid.materials_score < 0 || bid.materials_score > 100 {
        return Err(EvalError::new(
            "SCORE_INVALID",
            format!("materialsScore must be 0..=100 for {}", bid.bid_id),
        ));
    }
    Ok((price, bid.duration_days as u128, bid.warranty_days as u128))
}

/// Evaluate a JSON score request. Always returns a JSON string; malformed input
/// returns a structured error instead of panicking.
pub fn evaluate_json(input: &str) -> String {
    match evaluate(input) {
        Ok(output) => serde_json::to_string(&output).unwrap_or_else(|_| {
            error_json(
                "SCORE_INVALID",
                "failed to serialize score output".to_string(),
            )
        }),
        Err(error) => error_json(error.code, error.message),
    }
}

fn error_json(code: &str, message: String) -> String {
    serde_json::to_string(&ErrorOutput {
        schema: SCHEMA_ID.to_string(),
        error: ErrorBody {
            code: code.to_string(),
            message,
        },
    })
    .unwrap_or_else(|_| {
        format!(
            "{{\"schema\":\"{SCHEMA_ID}\",\"error\":{{\"code\":\"SCORE_INVALID\",\"message\":\"unserializable error\"}}}}"
        )
    })
}

fn evaluate(input: &str) -> Result<ScoreOutput, EvalError> {
    let request: ScoreInput = serde_json::from_str(input).map_err(|error| {
        EvalError::new(
            "SCORE_INVALID",
            format!("invalid score input JSON: {error}"),
        )
    })?;

    if let Some(schema) = request.schema.as_deref() {
        if schema != SCHEMA_ID {
            return Err(EvalError::new(
                "SCORE_INVALID",
                format!("unsupported schema: {schema}"),
            ));
        }
    }

    let weights = request.weights_bps.unwrap_or(DEFAULT_WEIGHTS);
    if weights != DEFAULT_WEIGHTS {
        return Err(EvalError::new(
            "SCORE_POLICY_MISMATCH",
            "weights must be exactly 4500/2500/2000/1000 bps",
        ));
    }

    if let Some(version) = request.policy_version.as_deref() {
        validate_policy_version(version)?;
    }

    let computed_policy_hash = policy_hash(&weights);
    if let Some(supplied) = request.policy_hash.as_deref() {
        if supplied != computed_policy_hash {
            return Err(EvalError::new(
                "SCORE_POLICY_MISMATCH",
                "policyHash does not match mend-bid-policy-v1",
            ));
        }
    }

    let mut excluded: Vec<ExcludedBid> = Vec::new();
    let mut eligible: Vec<(&BidInput, u128, u128, u128)> = Vec::new();

    for bid in &request.bids {
        if !bid.eligible {
            excluded.push(ExcludedBid {
                bid_id: bid.bid_id.clone(),
                reason: "ineligible".to_string(),
            });
            continue;
        }
        let (price, duration, warranty) = parse_eligible_bid(bid)?;
        eligible.push((bid, price, duration, warranty));
    }

    if eligible.is_empty() {
        return Err(EvalError::new("SCORE_INVALID", "no eligible bids to score"));
    }

    let min_price = eligible.iter().map(|(_, p, _, _)| *p).min().unwrap();
    let max_price = eligible.iter().map(|(_, p, _, _)| *p).max().unwrap();
    let min_duration = eligible.iter().map(|(_, _, d, _)| *d).min().unwrap();
    let max_duration = eligible.iter().map(|(_, _, d, _)| *d).max().unwrap();
    let min_warranty = eligible.iter().map(|(_, _, _, w)| *w).min().unwrap();
    let max_warranty = eligible.iter().map(|(_, _, _, w)| *w).max().unwrap();

    struct Intermediate {
        bid_id: String,
        contractor_id: String,
        price: u128,
        duration: i64,
        warranty: i64,
        materials: i64,
        score: u32,
        dimensions: DimensionScoresBps,
    }

    let mut scored: Vec<Intermediate> = Vec::with_capacity(eligible.len());
    for (bid, price, duration, warranty) in eligible {
        let price_bps = normalize(price, min_price, max_price, true)?;
        let warranty_bps = normalize(warranty, min_warranty, max_warranty, false)?;
        let duration_bps = normalize(duration, min_duration, max_duration, true)?;
        let materials_bps = (bid.materials_score as u128)
            .checked_mul(100)
            .ok_or_else(|| EvalError::new("SCORE_INVALID", "materials score overflow"))?;

        let weighted = (PRICE_BPS as u128)
            .checked_mul(price_bps)
            .and_then(|v| {
                (WARRANTY_BPS as u128)
                    .checked_mul(warranty_bps)
                    .and_then(|w| v.checked_add(w))
            })
            .and_then(|v| {
                (DURATION_BPS as u128)
                    .checked_mul(duration_bps)
                    .and_then(|d| v.checked_add(d))
            })
            .and_then(|v| {
                (MATERIALS_BPS as u128)
                    .checked_mul(materials_bps)
                    .and_then(|m| v.checked_add(m))
            })
            .ok_or_else(|| EvalError::new("SCORE_INVALID", "score arithmetic overflow"))?;

        let score_u128 = (weighted + (BPS_DENOMINATOR / 2)) / BPS_DENOMINATOR;
        let score = u32::try_from(score_u128)
            .map_err(|_| EvalError::new("SCORE_INVALID", "score out of range"))?;

        scored.push(Intermediate {
            bid_id: bid.bid_id.clone(),
            contractor_id: bid.contractor_id.clone(),
            price,
            duration: bid.duration_days,
            warranty: bid.warranty_days,
            materials: bid.materials_score,
            score,
            dimensions: DimensionScoresBps {
                price: u32::try_from(price_bps).unwrap_or(10_000),
                warranty: u32::try_from(warranty_bps).unwrap_or(10_000),
                duration: u32::try_from(duration_bps).unwrap_or(10_000),
                materials: u32::try_from(materials_bps).unwrap_or(10_000),
            },
        });
    }

    // Total order: score desc, price asc, warranty desc, duration asc, bidId asc.
    scored.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then(a.price.cmp(&b.price))
            .then(b.warranty.cmp(&a.warranty))
            .then(a.duration.cmp(&b.duration))
            .then(a.bid_id.cmp(&b.bid_id))
    });

    let ranking: Vec<ScoredBid> = scored
        .into_iter()
        .enumerate()
        .map(|(index, bid)| ScoredBid {
            rank: (index as u32) + 1,
            bid_id: bid.bid_id,
            contractor_id: bid.contractor_id,
            score_bps: bid.score,
            dimensions_bps: bid.dimensions,
            price_micro: bid.price.to_string(),
            duration_days: bid.duration,
            warranty_days: bid.warranty,
            materials_score: bid.materials,
        })
        .collect();

    let winner_bid_id = ranking
        .first()
        .map(|bid| bid.bid_id.clone())
        .ok_or_else(|| EvalError::new("SCORE_INVALID", "no winner"))?;

    let mut commitment_hashes: Vec<String> = request
        .bids
        .iter()
        .filter_map(|bid| {
            bid.commitment_hash
                .clone()
                .or_else(|| bid_commitment_hash(bid))
        })
        .collect();
    commitment_hashes.sort();

    let input_hash = if commitment_hashes.is_empty() {
        let canonical_bids = serde_json::to_string(&request.bids)
            .map_err(|error| EvalError::new("SCORE_INVALID", error.to_string()))?;
        sha256_hex(
            format!("MEND_SCORE_INPUT_V1|{computed_policy_hash}|{canonical_bids}").as_bytes(),
        )
    } else {
        sha256_hex(
            format!(
                "MEND_SCORE_INPUT_V1|{}|{}",
                computed_policy_hash,
                commitment_hashes.join("|")
            )
            .as_bytes(),
        )
    };

    // Canonical ranking JSON is the serialization of the ranking array with the
    // documented field order. `@mend/protocol` mirrors this in
    // `canonicalRankingJson`.
    let canonical_ranking_json = serde_json::to_string(&ranking)
        .map_err(|error| EvalError::new("SCORE_INVALID", error.to_string()))?;
    let output_hash =
        sha256_hex(format!("MEND_SCORE_OUTPUT_V1|{canonical_ranking_json}").as_bytes());

    Ok(ScoreOutput {
        schema: SCHEMA_ID.to_string(),
        policy_version: POLICY_VERSION.to_string(),
        policy_hash: computed_policy_hash,
        weights_bps: weights,
        ranking,
        excluded,
        winner_bid_id,
        input_hash,
        output_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_hash_is_stable() {
        let digest = policy_hash(&DEFAULT_WEIGHTS);
        assert_eq!(digest.len(), 64);
        assert!(digest.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn commitment_payload_is_deterministic() {
        let bid = BidInput {
            bid_id: "BID-B-BENCH-001".into(),
            contractor_id: "contractor-b.mend.testnet".into(),
            price_micro: "80000000".into(),
            duration_days: 10,
            warranty_days: 180,
            materials_score: 80,
            eligible: true,
            evidence_checklist_accepted: Some(true),
            nonce: Some("nonce-b-0002".into()),
            commitment_hash: None,
        };
        assert_eq!(
            bid_commitment_payload(&bid).unwrap(),
            "MEND_BID_V1|BID-B-BENCH-001|contractor-b.mend.testnet|80000000|10|180|80|1|nonce-b-0002"
        );
    }
}

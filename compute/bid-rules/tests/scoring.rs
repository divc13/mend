use std::fs;
use std::path::{Path, PathBuf};

use mend_bid_rules::{evaluate_json, ErrorOutput, ScoreOutput};
use serde_json::Value;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/recorded-responses/bid-rules")
        .canonicalize()
        .expect("fixture directory exists")
}

fn evaluate_value(input: &str) -> Value {
    serde_json::from_str(&evaluate_json(input)).expect("evaluate_json returns valid JSON")
}

fn evaluate_ok(input: &str) -> ScoreOutput {
    let value = evaluate_value(input);
    if value.get("error").is_some() {
        panic!("expected success, got {value}");
    }
    serde_json::from_value(value).expect("valid score output")
}

fn evaluate_err(input: &str) -> ErrorOutput {
    serde_json::from_value(evaluate_value(input)).expect("valid error output")
}

const POLICY_HASH: &str = "1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d";

fn input_with_bids(bids: &str) -> String {
    format!(
        r#"{{"schema":"mend.bid-rules.v1","policyHash":"{POLICY_HASH}","policyVersion":"mend-bid-policy-v1","weightsBps":{{"price":4500,"warranty":2500,"duration":2000,"materials":1000}},"bids":[{bids}]}}"#
    )
}

fn bid(
    id: &str,
    price: &str,
    duration: i64,
    warranty: i64,
    materials: i64,
    eligible: bool,
) -> String {
    format!(
        r#"{{"bidId":"{id}","contractorId":"{id}.mend.testnet","priceMicro":"{price}","durationDays":{duration},"warrantyDays":{warranty},"materialsScore":{materials},"eligible":{eligible}}}"#
    )
}

#[test]
fn canonical_fixture_ranks_b_c_a_with_frozen_scores() {
    let input =
        fs::read_to_string(fixture_dir().join("canonical-input.json")).expect("input fixture");
    let output = evaluate_ok(&input);

    assert_eq!(output.policy_hash, POLICY_HASH);
    assert_eq!(output.winner_bid_id, "BID-B-BENCH-001");
    assert!(output.excluded.is_empty());
    assert_eq!(output.ranking.len(), 3);

    let summary: Vec<(&str, u32)> = output
        .ranking
        .iter()
        .map(|bid| (bid.bid_id.as_str(), bid.score_bps))
        .collect();
    assert_eq!(
        summary,
        vec![
            ("BID-B-BENCH-001", 9270),
            ("BID-C-BENCH-001", 5200),
            ("BID-A-BENCH-001", 2873),
        ]
    );

    assert_eq!(output.ranking[0].dimensions_bps.price, 8823);
    assert_eq!(output.ranking[0].dimensions_bps.warranty, 10000);
    assert_eq!(output.ranking[0].dimensions_bps.duration, 10000);
    assert_eq!(output.ranking[0].dimensions_bps.materials, 8000);
    assert_eq!(output.ranking[1].dimensions_bps.price, 10000);
    assert_eq!(output.ranking[1].dimensions_bps.warranty, 0);
    assert_eq!(output.ranking[1].dimensions_bps.duration, 0);
    assert_eq!(output.ranking[1].dimensions_bps.materials, 7000);
    assert_eq!(output.ranking[2].dimensions_bps.price, 0);
    assert_eq!(output.ranking[2].dimensions_bps.warranty, 4000);
    assert_eq!(output.ranking[2].dimensions_bps.duration, 6363);
    assert_eq!(output.ranking[2].dimensions_bps.materials, 6000);

    // Committed output fixture is the parity artifact consumed by
    // packages/ai-client/test/parity.test.ts.
    let expected_path = fixture_dir().join("canonical-output.json");
    if std::env::var("REGENERATE_BID_FIXTURES").as_deref() == Ok("1") {
        fs::write(
            &expected_path,
            format!("{}\n", serde_json::to_string_pretty(&output).unwrap()),
        )
        .expect("write output fixture");
    }
    let expected: Value =
        serde_json::from_str(&fs::read_to_string(&expected_path).expect("output fixture"))
            .expect("output fixture is JSON");
    let actual = serde_json::to_value(&output).expect("serialize output");
    assert_eq!(actual, expected, "canonical output fixture drifted");
}

#[test]
fn evaluation_is_byte_for_byte_deterministic() {
    let input =
        fs::read_to_string(fixture_dir().join("canonical-input.json")).expect("input fixture");
    assert_eq!(evaluate_json(&input), evaluate_json(&input));
}

#[test]
fn identical_scores_break_ties_by_bid_id() {
    let bids = [
        bid("BID-Z-TIE", "80000000", 10, 180, 80, true),
        bid("BID-A-TIE", "80000000", 10, 180, 80, true),
    ]
    .join(",");
    let output = evaluate_ok(&input_with_bids(&bids));
    assert_eq!(output.ranking[0].bid_id, "BID-A-TIE");
    assert_eq!(output.ranking[1].bid_id, "BID-Z-TIE");
    assert_eq!(output.ranking[0].score_bps, output.ranking[1].score_bps);
    assert_eq!(output.ranking[0].rank, 1);
    assert_eq!(output.ranking[1].rank, 2);
}

#[test]
fn equal_scores_break_ties_by_lower_price() {
    let bids = [
        bid("BID-TIE-LOWPRICE", "2", 10, 3, 30, true),
        bid("BID-TIE-HIGHPRICE", "5", 8, 8, 30, true),
        bid("BID-ANCHOR", "2", 10, 5, 91, true),
    ]
    .join(",");
    let output = evaluate_ok(&input_with_bids(&bids));
    assert_eq!(output.ranking[0].bid_id, "BID-ANCHOR");
    assert_eq!(output.ranking[1].bid_id, "BID-TIE-LOWPRICE");
    assert_eq!(output.ranking[2].bid_id, "BID-TIE-HIGHPRICE");
    assert_eq!(output.ranking[1].score_bps, output.ranking[2].score_bps);
    assert_eq!(output.ranking[1].price_micro, "2");
    assert_eq!(output.ranking[2].price_micro, "5");
}

#[test]
fn single_bid_receives_full_range_normalization() {
    let output = evaluate_ok(&input_with_bids(&bid(
        "BID-ONLY", "1000000", 5, 30, 80, true,
    )));
    assert_eq!(output.ranking.len(), 1);
    assert_eq!(output.ranking[0].dimensions_bps.price, 10000);
    assert_eq!(output.ranking[0].dimensions_bps.warranty, 10000);
    assert_eq!(output.ranking[0].dimensions_bps.duration, 10000);
    assert_eq!(output.ranking[0].dimensions_bps.materials, 8000);
    assert_eq!(output.ranking[0].score_bps, 9800);
}

#[test]
fn ineligible_bids_are_excluded_and_cannot_win() {
    let bids = [
        bid("BID-CHEAP", "1", 1, 1000, 100, false),
        bid("BID-VALID", "80000000", 10, 180, 80, true),
    ]
    .join(",");
    let output = evaluate_ok(&input_with_bids(&bids));
    assert_eq!(output.ranking.len(), 1);
    assert_eq!(output.ranking[0].bid_id, "BID-VALID");
    assert_eq!(output.excluded.len(), 1);
    assert_eq!(output.excluded[0].bid_id, "BID-CHEAP");
    assert_eq!(output.excluded[0].reason, "ineligible");
    assert_eq!(output.winner_bid_id, "BID-VALID");
}

#[test]
fn no_eligible_bids_is_an_error_not_an_invented_winner() {
    let output = evaluate_err(&input_with_bids(&bid(
        "BID-NOPE", "80000000", 10, 180, 80, false,
    )));
    assert_eq!(output.error.code, "SCORE_INVALID");
    assert!(output.error.message.contains("no eligible bids"));
}

#[test]
fn wrong_policy_hash_is_rejected() {
    let input = format!(
        r#"{{"schema":"mend.bid-rules.v1","policyHash":"{}","bids":[{}]}}"#,
        "0".repeat(64),
        bid("BID-A", "80000000", 10, 180, 80, true)
    );
    let output = evaluate_err(&input);
    assert_eq!(output.error.code, "SCORE_POLICY_MISMATCH");
}

#[test]
fn wrong_weights_are_rejected() {
    let input = format!(
        r#"{{"schema":"mend.bid-rules.v1","policyHash":"{POLICY_HASH}","weightsBps":{{"price":1,"warranty":1,"duration":1,"materials":1}},"bids":[{}]}}"#,
        bid("BID-A", "80000000", 10, 180, 80, true)
    );
    let output = evaluate_err(&input);
    assert_eq!(output.error.code, "SCORE_POLICY_MISMATCH");
}

#[test]
fn malformed_json_is_rejected_without_panicking() {
    let output = evaluate_err("{not-json");
    assert_eq!(output.error.code, "SCORE_INVALID");
    assert!(output.error.message.contains("invalid score input JSON"));
}

#[test]
fn invalid_eligible_numeric_values_are_rejected() {
    for bad in [
        bid("BID-PRICE", "0", 10, 180, 80, true),
        bid("BID-DURATION", "80000000", 0, 180, 80, true),
        bid("BID-WARRANTY", "80000000", 10, -1, 80, true),
        bid("BID-MATERIALS", "80000000", 10, 180, 101, true),
        bid("BID-NOT-NUMBER", "abc", 10, 180, 80, true),
    ] {
        let output = evaluate_err(&input_with_bids(&bad));
        assert_eq!(
            output.error.code, "SCORE_INVALID",
            "expected rejection for {bad}"
        );
    }
}

#[test]
fn commitment_hashes_drive_the_protocol_compatible_input_hash() {
    let input =
        fs::read_to_string(fixture_dir().join("canonical-input.json")).expect("input fixture");
    let output = evaluate_ok(&input);
    assert_eq!(
        output.input_hash,
        "7955aa55803ed501b00dcf95f1559a90fc4403fd859264b1029aa3cdcaa8d6c8"
    );
    assert_eq!(
        output.output_hash,
        "905950627b0c7b870fdfc96034f1168bd4654cd6497d443debe6162e6efef134"
    );
}

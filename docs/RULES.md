# MEND Bid Evaluation Rules (RULES.md)

Version: `mend-bid-policy-v1`
Executed by: OutLayer deterministic Rust/WASM (fallback: local deterministic WASM runner, clearly labeled)
Winner chosen by: code only. **No LLM chooses the winner.**

## 1. Eligibility

A bid is eligible only if all are true:

1. Bidder is on the DAO-approved contractor roster for the work order.
2. The commitment was submitted inside the bidding window.
3. The reveal happened inside the reveal window, before the reveal deadline.
4. `sha256(commitment_payload) == commitment_hash` recorded at commit time.
5. The bid was not already revealed or awarded.
6. `priceMicro > 0`, `durationDays > 0`, `0 <= warrantyDays`, `0 <= materialsScore <= 100`.

Ineligible or late bids are excluded and can never win. If no eligible bids remain, scoring fails (`SCORE_INVALID`); it never invents a winner.

## 2. Weights

| Dimension | Weight |
|---|---|
| Price | 45% (4500 bps) |
| Warranty | 25% (2500 bps) |
| Completion duration | 20% (2000 bps) |
| Materials quality | 10% (1000 bps) |

Weights must total exactly 10,000 bps.

## 3. Exact normalization (integer math only)

All values are integers. `floor` means integer division truncation.

- Price (lower is better), computed across eligible bids:
  `priceBps = (maxPrice - price) * 10000 / (maxPrice - minPrice)`
- Warranty (higher is better):
  `warrantyBps = (warranty - minWarranty) * 10000 / (maxWarranty - minWarranty)`
- Duration (lower is better):
  `durationBps = (maxDuration - duration) * 10000 / (maxDuration - minDuration)`
- Materials: the revealed bid carries an absolute quality score 0–100:
  `materialsBps = materialsScore * 100`
- If `max == min` for price, warranty or duration, every eligible bid receives `10000` for that dimension.

## 4. Score and rounding

`weighted = 4500*priceBps + 2500*warrantyBps + 2000*durationBps + 1000*materialsBps`

`scoreBps = floor((weighted + 5000) / 10000)` (round half up, integer only)

Higher `scoreBps` wins.

## 5. Tie-breaking

If scores are equal, compare in this order:

1. Lower `priceMicro`
2. Longer `warrantyDays`
3. Shorter `durationDays`
4. Lexicographically smaller `bidId`

This order is total. Two different bids can never tie.

## 6. Worked canonical example (frozen fixture)

Bids (micro-USDC, days, 0–100):

| Bid | Price | Duration | Warranty | Materials |
|---|---|---|---|---|
| A | 95.000000 | 14 | 90 | 60 |
| B | 80.000000 | 10 | 180 | 80 |
| C | 78.000000 | 21 | 30 | 70 |

Normalized:

| Bid | Price | Warranty | Duration | Materials |
|---|---|---|---|---|
| A | 0 | 4000 | 6363 | 6000 |
| B | 8823 | 10000 | 10000 | 8000 |
| C | 10000 | 0 | 0 | 7000 |

Weighted and rounded:

| Bid | Weighted numerator | Score |
|---|---|---|
| A | 28,726,000 | 2873 |
| B | 92,703,500 | 9270 |
| C | 52,000,000 | 5200 |

Ranking: **B (9270) > C (5200) > A (2873)**. B wins even though C is cheaper, because warranty, duration and materials matter.

## 7. Hash binding

- Policy hash: `sha256("MEND_POLICY_V1|version|price|warranty|duration|materials")`
- Commitment hash: `sha256("MEND_BID_V1|bidId|contractorId|priceMicro|durationDays|warrantyDays|materialsScore|checklistAccepted?1:0|nonce")`
- Score input hash: `sha256("MEND_SCORE_INPUT_V1|policyHash|sortedBidCommitmentHashes...")`
- Score output hash: `sha256("MEND_SCORE_OUTPUT_V1|canonicalRankingJson")`

The hub stores policy hash, WASM hash, input hash and output hash. A score with the wrong policy, wrong WASM, modified input or stale work-order state is rejected.

## 8. Human role

The steward confirms the deterministic top-ranked eligible bid. The steward cannot pick a different bid. AI agents may explain the result using only the structured values above; they cannot change it.

## 9. Related documents

- [Docs index](./README.md)
- [Architecture](./03-architecture.md)
- [State machine](./04-state-machine.md)
- [Payment accounting](./05-payment-accounting.md)
- [Oracle and human trust](./08-oracle-and-human-trust.md)
- [Integration evidence](./16-integration-evidence.md)
- [Root README](../README.md)

---

[Docs index](./README.md) · [Root README](../README.md)

# Live Agent Market evidence

**Marketplace:** `https://market.near.ai` (production, real money; no testnet/sandbox)
**Listing:** `https://market.near.ai/a/mend-evidence-review`
**Date:** 2026-11-13

## Listing

`GET /v1/agents/mend-evidence-review` returned `200` and:

- `listing_status: "live"`
- `delivered_jobs: 1`
- `success_rate: 100`
- `payable_with: ["USDC"]`
- `availability: "available"`
- `funding_paused: false`

The raw public listing is in `listing.json`.

## Paid hire — VERIFIED

- Job: `1b3bc0cc-9cff-4419-ba11-1c91d2f1b10a` — `Hire: MEND Evidence Review`
- Assignment: `76ef7a92-b654-46cc-87d9-dc032c3a8500`
- `isTestRun: false`
- `budgetAmount: "0.0100"` USDC
- `escrowAmount: "0.0100"` USDC
- Worker started: `2026-11-13T11:42:48Z`
- Worker submitted: `2026-11-13T11:42:49Z`
- Deliverable hash: `6bd038919d614ef015155c68e7e4012db936aa125a3b59b7d7c0790324a19a7e`
- Human accepted / finalized: `2026-11-13T11:50:00Z`
- Final assignment status: `accepted`
- Final job status: `completed`

The raw accepted-assignment response is in `accepted-assignments.json`.

## Free test run — separate, not a paid job

- Job: `dbe53435-930d-4197-b13b-2f3a90b3a2be` — `Test run: MEND Evidence Review`
- Assignment: `6f253648-2358-4847-8a24-6581f6d75ae1`
- `isTestRun: true`
- `budgetAmount: "0"`
- `escrowAmount: "0"`
- Final assignment status: `accepted`
- Final job status: `completed`

This test run is not counted as a paid job or market reputation.

## Fee / payout

The platform config reports `platform_fee_bps: 500` (5%). For the `0.0100 USDC`
paid hire, the expected seller payout is `0.0095 USDC` and the expected platform
fee is `0.0005 USDC`.

The worker `aat_` token cannot read `/v1/wallet/ledger` or `/v1/wallet/balance`
(both returned `401`), so the actual payout row is **NOT_COLLECTED** here. The
escrow amount and human acceptance are verified; the exact seller ledger entry
must be read from the owner session. Do not claim the payout was observed until
that ledger row is captured.

## Disclosure

The job brief states: “Disclosed self-hire test.” The review is advisory only:
it identifies missing evidence and does not certify safety, approve payment, or
claim a physical inspection. The human buyer accepted the deliverable.

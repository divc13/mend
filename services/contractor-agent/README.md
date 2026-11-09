# Contractor agents

Three isolated, deterministic contractor strategies with separate sub-accounts:

| Agent | Price | Duration | Warranty | Materials |
|---|---|---|---|---|
| A | 95 USDC | 14 days | 90 days | 60 |
| B | 80 USDC | 10 days | 180 days | 80 |
| C | 78 USDC | 21 days | 30 days | 70 |

- Values are byte-identical to `FIXTURE_BID_INPUTS` and checked by `assertStrategiesMatchProtocol`.
- Commitments use the exact protocol `bidCommitmentHash` (`MEND_BID_V1|...`).
- `SealedBidMarket` exposes only commitment hashes before the reveal phase; `revealedBids` throws `BID_EARLY_REVEAL` until the commit deadline.
- Reveals are checked against the commitment and the reveal deadline.
- The optional explanation is the frozen fixture sentence over structured values only.
- Agents cannot award, accept, inspect, refund or fund.

```bash
npm test && npm run typecheck
```

# Contractor agents

Five isolated, deterministic contractor strategies with separate sub-accounts:

| Agent | Price | Duration | Warranty | Materials | Available in | Scenario |
|---|---|---|---|---|---|---|
| A | 95 USDC | 14 days | 90 days | 60 | 3 days | Canonical scoring |
| B | 80 USDC | 10 days | 180 days | 80 | 2 days | Canonical scoring |
| C | 78 USDC | 21 days | 30 days | 70 | 5 days | Canonical scoring |
| D | 85 USDC | 12 days | 120 days | 75 | 1 day | Extra demo |
| E | 90 USDC | 7 days | 60 days | 90 | 7 days | Extra demo |

- A/B/C are byte-identical to `FIXTURE_BID_INPUTS`; D/E are byte-identical to `FIXTURE_EXTRA_BID_INPUTS`. Both sets are checked by `assertStrategiesMatchProtocol`.
- A/B/C remain the canonical three-bid scoring scenario; D/E are additional demo strategies.
- Commitments use the exact protocol `bidCommitmentHash` payload (`MEND_BID_V2|...`), including `availableInDays`.
- `SealedBidMarket` exposes only commitment hashes before the reveal phase; `revealedBids` throws `BID_EARLY_REVEAL` until the commit deadline.
- Reveals are checked against the commitment and the reveal deadline.
- The optional explanation is the frozen fixture sentence over structured values only.
- Agents cannot award, accept, inspect, refund or fund.
- Live testnet mode reads only an external key path from env (`MEND_CONTRACTOR_KEY_PATH`) and binds A/B/C to `mend-contractor-a..c.testnet`; no secret is read from env or logged.
- `scripts/live-agents/run-agent-dry.mjs` prints the exact commit/reveal payloads and hashes for A/B/C, including `availableInDays`.

```bash
npm test && npm run typecheck
MEND_CONTRACTOR_KEY_PATH=/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json \
  node scripts/live-agents/run-agent-dry.mjs
```

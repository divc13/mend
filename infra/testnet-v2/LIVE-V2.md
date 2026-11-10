# MEND Testnet V2 — fresh hub and real Sputnik DAO

Generated: 2026-11-10T09:43:46.124Z

**Network:** NEAR testnet only. Test mUSDC and testnet NEAR have no real value.

## Deployed contracts

| Role | Account / contract | Explorer |
|---|---|---|
| Hub V2 | `mend-hub-v2.testnet` | https://explorer.testnet.near.org/accounts/mend-hub-v2.testnet |
| Settlement token | `mend-usdc.testnet` | https://explorer.testnet.near.org/accounts/mend-usdc.testnet |
| Sputnik DAO | `mend-dao.sputnikv2.testnet` (sputnik-v2) | https://explorer.testnet.near.org/accounts/mend-dao.sputnikv2.testnet |
| Sputnik factory | `sputnikv2.testnet` | https://explorer.testnet.near.org/accounts/sputnikv2.testnet |

Hub WASM sha256: `aebaf90e15dbfcac42cb64427eda70dd24067a4bbdb4882678beb28cd27b5e61`

Hub config: owner `mend-deployer.testnet`, token `mend-usdc.testnet`, DAO `mend-dao.sputnikv2.testnet`, policy hash `b35cff385a1f5e014c9de48dac0f79d77a103c57a81caeaface3ae12a60ce19f`, durability 2 minutes.

Verification: `node deploy-v2.mjs --check` → **PASS**. All 42 recorded transactions resolve and none has a failed receipt; the failed factory attempt is also resolved and explicitly recorded below.

## Sputnik DAO

- Factory create: [`EsdxwBefVpjNPVdEUnWSJ425zSEy3imYtLCKRYW55vMM`](https://explorer.testnet.near.org/transactions/EsdxwBefVpjNPVdEUnWSJ425zSEy3imYtLCKRYW55vMM)
- Council: `mend-deployer.testnet`, `mend-steward.testnet`, `mend-inspector.testnet`
- Proposal bond: `1000000000000000000000000` yoctoNEAR
- Proposal ID: `1` (Approved)
- Proposal kind: `FunctionCall` → `mend-hub-v2.testnet.dao_authorize`
- Authorization execution tx: [`8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h`](https://explorer.testnet.near.org/transactions/8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h)

| Council vote | Transaction |
|---|---|
| `mend-steward.testnet` | [`8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h`](https://explorer.testnet.near.org/transactions/8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h) |
| `mend-deployer.testnet` | [`JBykTj6feW8LyZTJw7baM31w194HhAwRh2moRaQres9Q`](https://explorer.testnet.near.org/transactions/JBykTj6feW8LyZTJw7baM31w194HhAwRh2moRaQres9Q) |

## Lifecycle

Asset: `BENCH-V2-001`; passport token `BENCH-V2-001`, owner `mend-hub-v2.testnet` (non-transferable, not legal ownership).

Work order: `WO-BENCH-V2-001-0002` — final status **CLOSED**.

DAO proposal recorded on the work order: `1`; authorization tx: [`8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h`](https://explorer.testnet.near.org/transactions/8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h).

### Accounting

| Item | micro-mUSDC |
|---|---:|
| Funded | 100000000 |
| Refund at award | 20000000 |
| Completion paid (90%) | 72000000 |
| Holdback released (10%) | 8000000 |
| Remaining escrow | 0 |

Exact split: **100 funded / 20 refunded / 72 completion / 8 holdback**, escrow 0.

### Bids and deterministic score

| Bid | Contractor | Price | Duration | Warranty | Materials | Available in | Score bps | Rank |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `BID-B-BENCH-V2-001` | `mend-contractor-b.testnet` | 80000000 | 10d | 180d | 80 | 2d | 9270 | 1 |
| `BID-C-BENCH-V2-001` | `mend-contractor-c.testnet` | 78000000 | 21d | 30d | 70 | 5d | 5200 | 2 |
| `BID-A-BENCH-V2-001` | `mend-contractor-a.testnet` | 95000000 | 14d | 90d | 60 | 3d | 2873 | 3 |

Score mode: **LOCAL_DETERMINISTIC** (on-chain `mode = "recorded"`). Availability is stored on-chain in each `reveal_bid` call even though it is not a score weight. OutLayer live execution was **not** used and no TEE attestation is claimed.

## Attempts and operational caveats

- Hub mUSDC balance after settlement: **0** (the per-work-order escrow is fully settled).

The first Sputnik factory attempt used 100 Tgas and failed with `Exceeded the prepaid gas`. It was retried with 250 Tgas and succeeded. The failed attempt is listed verbatim:

| At | Failed factory tx | Gas | Error |
|---|---|---|---|
| 2026-11-10T09:12:26.727Z | [`9ig3dNU2dBufCV99TDBXCQJ4ta3NYCPq8sFDqTSdtLZU`](https://explorer.testnet.near.org/transactions/9ig3dNU2dBufCV99TDBXCQJ4ta3NYCPq8sFDqTSdtLZU) | `100000000000000` gas | Exceeded the prepaid gas. |

The recreated hub account inherited **100000000 micro-mUSDC** from the aborted first hub attempt (NEP-141 balances are keyed by account ID and survive account deletion). It was swept back to `mend-sponsor.testnet` in [`51tfEPfyWQynWUQQWF7UQSFAyw9HPovG2m7cJrSYb7PF`](https://explorer.testnet.near.org/transactions/51tfEPfyWQynWUQQWF7UQSFAyw9HPovG2m7cJrSYb7PF). It is **not** part of the final work-order accounting.

A pre-award work order expired its commitment window during driver retries. It was never bid on; it is cancelled and refunded, and kept on-chain for audit:

| Work order | Final status | Funded micro-mUSDC | Cancel tx | Refund tx |
|---|---|---:|---|---|
| `WO-BENCH-V2-001-0001` | REFUNDED | 100000000 | [`6yfSvnox1PAsevEZwx39DLTMMWNSqJgwFGYFz22UzGVa`](https://explorer.testnet.near.org/transactions/6yfSvnox1PAsevEZwx39DLTMMWNSqJgwFGYFz22UzGVa) | [`2LJXsoqzPmxXhnTfyXfKk2PFbrn6RhmvgJRFcxYBQZ9C`](https://explorer.testnet.near.org/transactions/2LJXsoqzPmxXhnTfyXfKk2PFbrn6RhmvgJRFcxYBQZ9C) |

Sputnik proposals: `0` authorized the aborted work order and was executed against this hub before that work order was refunded; `1` is the proposal for the final `WO-BENCH-V2-001-0002` lifecycle.

## Transactions

| Step | Signer | Receiver | Method | Hash |
|---|---|---|---|---|
| `dao_factory_create_6_near` | `mend-deployer.testnet` | `sputnikv2.testnet` | `create` | [`EsdxwBefVpjNPVdEUnWSJ425zSEy3imYtLCKRYW55vMM`](https://explorer.testnet.near.org/transactions/EsdxwBefVpjNPVdEUnWSJ425zSEy3imYtLCKRYW55vMM) |
| `hub_v2_deploy` | `mend-hub-v2.testnet` | `mend-hub-v2.testnet` | `deploy_contract` | [`kXppa2AtDQAaDvermrJbei9iviEV1f246fosXoQb1qx`](https://explorer.testnet.near.org/transactions/kXppa2AtDQAaDvermrJbei9iviEV1f246fosXoQb1qx) |
| `hub_v2_init` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `new` | [`HDT8TbzXkYm7cT18o1RKGn6dKjEa54FfeVh3vHh48XWA`](https://explorer.testnet.near.org/transactions/HDT8TbzXkYm7cT18o1RKGn6dKjEa54FfeVh3vHh48XWA) |
| `token_storage_deposit:mend-dao.sputnikv2.testnet` | `mend-deployer.testnet` | `mend-usdc.testnet` | `storage_deposit` | [`741YQV3SmeeL5wEFjDam75ksrd9YarRrsh5J9qb35df`](https://explorer.testnet.near.org/transactions/741YQV3SmeeL5wEFjDam75ksrd9YarRrsh5J9qb35df) |
| `hub_set_role:mend-steward.testnet:STEWARD` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`98VkPULR6YaNaGUgEBtgfu1CgisWgJuJFqSS7pEZQ8WC`](https://explorer.testnet.near.org/transactions/98VkPULR6YaNaGUgEBtgfu1CgisWgJuJFqSS7pEZQ8WC) |
| `hub_set_role:mend-sponsor.testnet:SPONSOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`9HVD4fRCd2E91WntNvJ6H15HYnJ25ZDRMjVsBpkX9zFC`](https://explorer.testnet.near.org/transactions/9HVD4fRCd2E91WntNvJ6H15HYnJ25ZDRMjVsBpkX9zFC) |
| `hub_set_role:mend-coordinator-ai.testnet:COORDINATOR_AI` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`BLUPwUA8RvgCDFyXambFmTv9iAQQmAY8CGtUaMk4CmBi`](https://explorer.testnet.near.org/transactions/BLUPwUA8RvgCDFyXambFmTv9iAQQmAY8CGtUaMk4CmBi) |
| `hub_set_role:mend-reviewer-ai.testnet:REVIEWER_AI` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`6u6CFSj1Pj5g2joisp2tebHfaa3ghjR8wT4NAA2jmg6D`](https://explorer.testnet.near.org/transactions/6u6CFSj1Pj5g2joisp2tebHfaa3ghjR8wT4NAA2jmg6D) |
| `hub_set_role:mend-relayer.testnet:RELAYER` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`4DTFvTXX3oRgGULvRohZxvacqYDe4MBuD3aKk39HempU`](https://explorer.testnet.near.org/transactions/4DTFvTXX3oRgGULvRohZxvacqYDe4MBuD3aKk39HempU) |
| `hub_set_role:mend-contractor-a.testnet:CONTRACTOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`3qeb6nZamra4L6DFSKcBdP6L8nkwogwZcugUjJoFPNDR`](https://explorer.testnet.near.org/transactions/3qeb6nZamra4L6DFSKcBdP6L8nkwogwZcugUjJoFPNDR) |
| `hub_set_role:mend-contractor-b.testnet:CONTRACTOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`6yvFWCqzgPHeUcCysRv2icg1YyFrwDtXDkkqxjDhTB22`](https://explorer.testnet.near.org/transactions/6yvFWCqzgPHeUcCysRv2icg1YyFrwDtXDkkqxjDhTB22) |
| `hub_set_role:mend-contractor-c.testnet:CONTRACTOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`AFhGdh7yVr2XJ3AUoXou5FEPpbwyq2yYfDwoLnyR6hwL`](https://explorer.testnet.near.org/transactions/AFhGdh7yVr2XJ3AUoXou5FEPpbwyq2yYfDwoLnyR6hwL) |
| `hub_set_role:mend-contractor-d.testnet:CONTRACTOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`2m3YqZ87caweRbMwX8Ji4F9oJrvivtNTy8noGJnUQy2B`](https://explorer.testnet.near.org/transactions/2m3YqZ87caweRbMwX8Ji4F9oJrvivtNTy8noGJnUQy2B) |
| `hub_set_role:mend-contractor-e.testnet:CONTRACTOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`EUsUBoCRvv7F1MpQWbQ2ccy8HQLMUGXkwLx8KREmKeuq`](https://explorer.testnet.near.org/transactions/EUsUBoCRvv7F1MpQWbQ2ccy8HQLMUGXkwLx8KREmKeuq) |
| `hub_set_role:mend-inspector.testnet:INSPECTOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`ERgRk5iPnGxpxDYNGEnAPpz6Exj9ipuoxZKTzKpnTHy7`](https://explorer.testnet.near.org/transactions/ERgRk5iPnGxpxDYNGEnAPpz6Exj9ipuoxZKTzKpnTHy7) |
| `hub_set_role:mend-inspector-2.testnet:INSPECTOR` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`EwbFtAjqiwJyMnTzhmBnKNDne8V41eCg8hk6DrVX9oS`](https://explorer.testnet.near.org/transactions/EwbFtAjqiwJyMnTzhmBnKNDne8V41eCg8hk6DrVX9oS) |
| `hub_set_role:mend-dao.sputnikv2.testnet:DAO` | `mend-deployer.testnet` | `mend-hub-v2.testnet` | `set_role` | [`HyBK8aRB5bahuVehzaMMCwHUKdVCAo1HteAhtnBovCnD`](https://explorer.testnet.near.org/transactions/HyBK8aRB5bahuVehzaMMCwHUKdVCAo1HteAhtnBovCnD) |
| `sponsor_grant_to_500_musdc` | `mend-deployer.testnet` | `mend-usdc.testnet` | `ft_transfer` | [`fj3WnMRhbGa2QDTrtj112vtwNu3BFKN1NUyJF9P3X4q`](https://explorer.testnet.near.org/transactions/fj3WnMRhbGa2QDTrtj112vtwNu3BFKN1NUyJF9P3X4q) |
| `asset_create_BENCH-V2-001` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `create_asset` | [`7cXA2e9JZoeCaKa439gaa9B5xa2m9PVz7RvQjgC5vv2q`](https://explorer.testnet.near.org/transactions/7cXA2e9JZoeCaKa439gaa9B5xa2m9PVz7RvQjgC5vv2q) |
| `passport_mint_BENCH-V2-001` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `mint_passport` | [`sQZKEiRKG7aTs8QN6K55ztEjLEGXCyoPCEt4hXu7nq9`](https://explorer.testnet.near.org/transactions/sQZKEiRKG7aTs8QN6K55ztEjLEGXCyoPCEt4hXu7nq9) |
| `work_order_create` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `create_work_order` | [`8k2HYnEk3Bq315pruGiidmeMCoTsPkdywnN7AknH1FKv`](https://explorer.testnet.near.org/transactions/8k2HYnEk3Bq315pruGiidmeMCoTsPkdywnN7AknH1FKv) |
| `dao_add_proposal_authorize` | `mend-deployer.testnet` | `mend-dao.sputnikv2.testnet` | `add_proposal` | [`2xqNUebBxAd4cJw1yuGB3iKjFpTP9QjPRqWfTaQELkHc`](https://explorer.testnet.near.org/transactions/2xqNUebBxAd4cJw1yuGB3iKjFpTP9QjPRqWfTaQELkHc) |
| `dao_vote_1_mend-deployer` | `mend-deployer.testnet` | `mend-dao.sputnikv2.testnet` | `act_proposal` | [`JBykTj6feW8LyZTJw7baM31w194HhAwRh2moRaQres9Q`](https://explorer.testnet.near.org/transactions/JBykTj6feW8LyZTJw7baM31w194HhAwRh2moRaQres9Q) |
| `dao_vote_2_mend-steward` | `mend-steward.testnet` | `mend-dao.sputnikv2.testnet` | `act_proposal` | [`8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h`](https://explorer.testnet.near.org/transactions/8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h) |
| `cleanup_cancel:WO-BENCH-V2-001-0001` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `cancel_work_order` | [`6yfSvnox1PAsevEZwx39DLTMMWNSqJgwFGYFz22UzGVa`](https://explorer.testnet.near.org/transactions/6yfSvnox1PAsevEZwx39DLTMMWNSqJgwFGYFz22UzGVa) |
| `cleanup_refund:WO-BENCH-V2-001-0001` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `refund` | [`2LJXsoqzPmxXhnTfyXfKk2PFbrn6RhmvgJRFcxYBQZ9C`](https://explorer.testnet.near.org/transactions/2LJXsoqzPmxXhnTfyXfKk2PFbrn6RhmvgJRFcxYBQZ9C) |
| `work_order_fund_100_musdc` | `mend-sponsor.testnet` | `mend-usdc.testnet` | `ft_transfer_call` | [`3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2`](https://explorer.testnet.near.org/transactions/3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2) |
| `work_order_open_bidding` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `open_bidding` | [`7ZMzR6Ry1TUVyN6gh2SCkLJyzogQEtwPA8o1Ynuz7WJw`](https://explorer.testnet.near.org/transactions/7ZMzR6Ry1TUVyN6gh2SCkLJyzogQEtwPA8o1Ynuz7WJw) |
| `bid_commit_A` | `mend-contractor-a.testnet` | `mend-hub-v2.testnet` | `commit_bid` | [`EQ8PUC48ixypkJahnem2QJdfQnwYUMywAasyCtcRLfWs`](https://explorer.testnet.near.org/transactions/EQ8PUC48ixypkJahnem2QJdfQnwYUMywAasyCtcRLfWs) |
| `bid_commit_B` | `mend-contractor-b.testnet` | `mend-hub-v2.testnet` | `commit_bid` | [`4JMa1WgoACS98m2x8ccWYUALTMcFugn7C7nz71N22pcs`](https://explorer.testnet.near.org/transactions/4JMa1WgoACS98m2x8ccWYUALTMcFugn7C7nz71N22pcs) |
| `bid_commit_C` | `mend-contractor-c.testnet` | `mend-hub-v2.testnet` | `commit_bid` | [`FeArm2wQmw2qGnxtwdTDNFPJJtEf5XKH8jpoZkdABBFY`](https://explorer.testnet.near.org/transactions/FeArm2wQmw2qGnxtwdTDNFPJJtEf5XKH8jpoZkdABBFY) |
| `bid_reveal_A` | `mend-contractor-a.testnet` | `mend-hub-v2.testnet` | `reveal_bid` | [`AaJZiC23jYcHXcuS2B79LJZFfxxSuq1hQ5tLJD2cRThk`](https://explorer.testnet.near.org/transactions/AaJZiC23jYcHXcuS2B79LJZFfxxSuq1hQ5tLJD2cRThk) |
| `bid_reveal_B` | `mend-contractor-b.testnet` | `mend-hub-v2.testnet` | `reveal_bid` | [`4y2A1bDomrnT5kwHfCzHYqzhLr9Hctfc6QDtg2voubKH`](https://explorer.testnet.near.org/transactions/4y2A1bDomrnT5kwHfCzHYqzhLr9Hctfc6QDtg2voubKH) |
| `bid_reveal_C` | `mend-contractor-c.testnet` | `mend-hub-v2.testnet` | `reveal_bid` | [`5qY5kuZeKomB5Ct9m7TN229qdStJXAVamujDHJhmUCax`](https://explorer.testnet.near.org/transactions/5qY5kuZeKomB5Ct9m7TN229qdStJXAVamujDHJhmUCax) |
| `bidding_close` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `close_bidding` | [`3QqasZTuUtrrLiMFBfMxqJSPjtwwpbu9vB8EykrKvnH4`](https://explorer.testnet.near.org/transactions/3QqasZTuUtrrLiMFBfMxqJSPjtwwpbu9vB8EykrKvnH4) |
| `score_record_LOCAL_DETERMINISTIC` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `record_score` | [`8VXMqbjCboH8x39VUcsY5ZBLqWJUSpc1NFTXLWRhecSL`](https://explorer.testnet.near.org/transactions/8VXMqbjCboH8x39VUcsY5ZBLqWJUSpc1NFTXLWRhecSL) |
| `award_winner` | `mend-steward.testnet` | `mend-hub-v2.testnet` | `award` | [`BWj8ACjYdK6rszE52LU22HudecFXBhQxmVFBtQ8JWhZX`](https://explorer.testnet.near.org/transactions/BWj8ACjYdK6rszE52LU22HudecFXBhQxmVFBtQ8JWhZX) |
| `work_start` | `mend-contractor-b.testnet` | `mend-hub-v2.testnet` | `start_work` | [`8sqrYZt2xDDtfJ3ZkCkoPMKUUhTqmp3JD9z4xhCDNaBg`](https://explorer.testnet.near.org/transactions/8sqrYZt2xDDtfJ3ZkCkoPMKUUhTqmp3JD9z4xhCDNaBg) |
| `completion_submit_EV-V2-0001` | `mend-contractor-b.testnet` | `mend-hub-v2.testnet` | `submit_completion` | [`89p8uKnj3iuhAeNeadrKUHnzrss2GigzNpwrgqra5WHr`](https://explorer.testnet.near.org/transactions/89p8uKnj3iuhAeNeadrKUHnzrss2GigzNpwrgqra5WHr) |
| `completion_accept_INS-V2-0001` | `mend-inspector.testnet` | `mend-hub-v2.testnet` | `accept_completion` | [`EQ8HoNvDazagbM5zdUq38EK7cyhgi8hqPXJkDhzdxN2o`](https://explorer.testnet.near.org/transactions/EQ8HoNvDazagbM5zdUq38EK7cyhgi8hqPXJkDhzdxN2o) |
| `durability_pass_INS-V2-0002` | `mend-inspector-2.testnet` | `mend-hub-v2.testnet` | `inspect_durability` | [`CmmAPvfonQa7Y9CEXpcnWQhbUVcRK3nWXAADH84kJS4g`](https://explorer.testnet.near.org/transactions/CmmAPvfonQa7Y9CEXpcnWQhbUVcRK3nWXAADH84kJS4g) |
| `orphan_hub_balance_sweep` | `mend-hub-v2.testnet` | `mend-usdc.testnet` | `ft_transfer` | [`51tfEPfyWQynWUQQWF7UQSFAyw9HPovG2m7cJrSYb7PF`](https://explorer.testnet.near.org/transactions/51tfEPfyWQynWUQQWF7UQSFAyw9HPovG2m7cJrSYb7PF) |

## Honest caveats

- NEAR testnet only. Test mUSDC and testnet NEAR have no real value.
- OutLayer live execution was not used; the score is LOCAL_DETERMINISTIC and is not a TEE attestation.
- The passport NFT is non-transferable and held by the hub registry account; it is not a title deed or legal ownership record.
- The Sputnik DAO is a real testnet DAO created by the sputnikv2.testnet factory; it has no mainnet authority.
- The score was computed locally with the hash-pinned policy `b35cff385a1f5e014c9de48dac0f79d77a103c57a81caeaface3ae12a60ce19f`; it is not proof of optimal real-world repair quality.
- No mainnet deployment, no real funds, no legal ownership or payment claim.

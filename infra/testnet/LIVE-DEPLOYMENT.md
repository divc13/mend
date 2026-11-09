# MEND — Live NEAR Testnet Deployment and Lifecycle Evidence

Status: **LIVE TESTNET, COMPLETE LIFECYCLE** — test value only, no mainnet, no production funds.

Generated from `infra/testnet/live-state.json` (updated 2026-11-09T17:27:49.819Z).

## Network and accounts

- Network: **testnet**
- RPC used for the final deployment/lifecycle/check: `https://rpc.testnet.fastnear.com`
- Explorer: <https://explorer.testnet.near.org>
- Hub contract: `mend-hub.testnet` (<https://explorer.testnet.near.org/accounts/mend-hub.testnet>)
- Token contract: `mend-usdc.testnet` (<https://explorer.testnet.near.org/accounts/mend-usdc.testnet>)
- DAO account: `mend-dao.testnet` (plain-account-fallback)
- Asset: `BENCH-001`
- Final work order: `WO-BENCH-001-0003`
- Requested work order (preserved on-chain): `WO-BENCH-001-0001`

## Exact commands used

```bash
cd /Volumes/sandisk/Users/dc/mend-wt/testnet
npm install --prefix infra/testnet

export MEND_TESTNET_KEYS_FILE=/Volumes/sandisk/Users/dc/.mend/testnet/keys.json
export MEND_HUB_WASM=/Volumes/sandisk/Users/dc/mend/contracts/target/wasm32-unknown-unknown/release/mend_hub.wasm
export MEND_TOKEN_WASM=/Volumes/sandisk/Users/dc/mend/contracts/target/wasm32-unknown-unknown/release/mend_test_token.wasm

# Final replacement work order used for the completed lifecycle:
export MEND_WORK_ORDER_ID=WO-BENCH-001-0003
node infra/testnet/deploy-live.mjs --deploy
node infra/testnet/deploy-live.mjs --lifecycle

# Acceptance check (reads the active work order from live-state.json):
node infra/testnet/deploy-live.mjs --check
```

`--deploy` is idempotent: it verifies accounts/contracts, registers token storage, sets missing roles, and only creates/authorizes/funds/opens the work order when it is missing or in an earlier state. `--lifecycle` resumes from the current on-chain work-order state, so a rerun does not restart from scratch. The script refuses mainnet, only signs as testnet accounts, and never prints secret keys.

## Token verification

- Symbol: `mUSDC`, decimals: `6`, name: `MEND Test USDC (test value only)`
- Total supply: `1000000000000` micro-units = 1,000,000 mUSDC (6 decimals)
- The token is a test-only mock. It is not real USDC and has no value.
- Token storage was registered for hub, DAO, sponsor, all five contractors and both inspectors.
- Sponsor grant: `500,000,000` micro-mUSDC from `mend-deployer.testnet` to `mend-sponsor.testnet` — tx [`Edt1Ek5sTndMjQic2hFBn2fS5rocGXSChmvyPqJmuDFg`](https://explorer.testnet.near.org/transactions/Edt1Ek5sTndMjQic2hFBn2fS5rocGXSChmvyPqJmuDFg)

Live balances are shared and informational (other concurrent testnet work orders used the same hub/sponsor accounts). Per-work-order escrow and NEP-141 transfer events are asserted instead.

## Hub configuration and roles

```json
{
  "owner": "mend-deployer.testnet",
  "token": "mend-usdc.testnet",
  "dao": "mend-dao.testnet",
  "policyHash": "1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d",
  "durabilityMinutes": 2,
  "paused": false,
  "scoringEnabled": false,
  "outlayerAccount": "outlayer.testnet",
  "outlayerProjectId": "mend.testnet/bid-rules",
  "scoringWasmHash": ""
}
```

- On-chain WASM sha256: `0ae083b03c8ff6646b9e429af41666469e103d266f46484c6f004f83d77986e0`
- On-chain code hash (base58): `jTe3SrzYFzhW2KJ7MVhsyrkacLc7fPUoAhiaFTENfF5`
- Bid commitment format detected from the deployed WASM: **V1** (`MEND_BID_V1`, no on-chain availability field).
- Roles set by owner `mend-deployer.testnet`: `STEWARD`, `SPONSOR`, `COORDINATOR_AI`, `REVIEWER_AI`, `RELAYER`, `CONTRACTOR` (A–E), `INSPECTOR` (1–2), and `DAO` for `mend-dao.testnet`.
- The hub has no production state and no mainnet deployment.

## DAO outcome (honest)

- Attempted Sputnik DAO v2 factory `sputnikv2.testnet` with name `mend-dao.sputnikv2.testnet`.
- The factory create transaction was **not submitted**. The first attempt used `https://rpc.testnet.near.org`; that endpoint returned HTTP 429 with a deprecation warning before the transaction was accepted. No Sputnik DAO exists and none is claimed. All later operations use `https://rpc.testnet.fastnear.com`.
- Fallback used: plain testnet account `mend-dao.testnet` signs `dao_authorize` directly. This is a documented fallback, not a Sputnik DAO.
- Authorization tx: [`51E4s7s7zyqrCNgEKtNM1g8YGufm9SpJP6e4BQvWKU1z`](https://explorer.testnet.near.org/transactions/51E4s7s7zyqrCNgEKtNM1g8YGufm9SpJP6e4BQvWKU1z)
- The deployed hub is bound to `mend-dao.testnet`; no attempt was made to fake a Sputnik proposal or a Sputnik address.

## Asset and passport

- Asset `BENCH-001` created by steward `mend-steward.testnet`.
- Description hash: `7325a1adb2fe9ab9a503f758ab25d26f5cc5c7388b82904b1a8a238a6fb9133c`
- Location hash: `9e21d8a75e911f492f90e092cc4236dfc4055a189fa5a8c0f8e5e7cef9aeb370`
- Passport token `BENCH-001` is held by the hub registry `mend-hub.testnet`.
- Passport metadata extra: `transferable=false`, `legal_ownership=false`. It is not a title deed or legal ownership record.
- Asset/passport transactions: create [`ChhVakDg91jgKq2RXNYYREVVsrNogBXkvCFGmy2wqHuN`](https://explorer.testnet.near.org/transactions/ChhVakDg91jgKq2RXNYYREVVsrNogBXkvCFGmy2wqHuN), mint [`GVCdWQ69Rp8XCKVkXTFoMkxXKUVyTzD3SxNSZiMyVkvc`](https://explorer.testnet.near.org/transactions/GVCdWQ69Rp8XCKVkXTFoMkxXKUVyTzD3SxNSZiMyVkvc).

## Work orders and replacement history

The requested work order `WO-BENCH-001-0001` was created and funded, but its first commit window expired during deployment debugging before any commitment could be accepted. It was cancelled and refunded. A second attempt (`WO-BENCH-001-0002`) used the newer V2 commitment format, while the already-deployed hub WASM uses V1; no commitment could be revealed against it. It was also cancelled and refunded. The completed lifecycle is the replacement **`WO-BENCH-001-0003`** on the same asset. All three IDs remain queryable on-chain; none was deleted or faked.

| Work order | Status | Notes |
|---|---|---|
| `WO-BENCH-001-0001` | REFUNDED | Replaced;   |
| `WO-BENCH-001-0002` | REFUNDED | Replaced; cancel [`H1e2UV4aHtZHn7Wgjrd3ey9izK6fFBw37qLeiNwaci3C`](https://explorer.testnet.near.org/transactions/H1e2UV4aHtZHn7Wgjrd3ey9izK6fFBw37qLeiNwaci3C) refund [`B2otm231ZKj4WLT4HoQCN5FGS4rLQJzS8xCx831SXNtC`](https://explorer.testnet.near.org/transactions/B2otm231ZKj4WLT4HoQCN5FGS4rLQJzS8xCx831SXNtC) |
| **`WO-BENCH-001-0003`** | **CLOSED** | Completed lifecycle; see below |

## Final work order

- Work order: `WO-BENCH-001-0003` on `BENCH-001`
- Policy hash: `1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d` (`mend-bid-policy-v1`)
- Scope hash: `4c211a017e14749ed4bb8b5966381101b6c3cdf5f24965f58b2cdec847a4ed5e` — source: `infra/testnet/scope/WO-BENCH-001-0003.scope.json`
- Budget: `100000000` micro-mUSDC = 100 mUSDC
- Sponsor: `mend-sponsor.testnet`
- Contractor roster: `mend-contractor-a.testnet`, `mend-contractor-b.testnet`, `mend-contractor-c.testnet`
- Inspector roster: `mend-inspector.testnet`, `mend-inspector-2.testnet`
- Commit deadline: 2026-11-09T17:13:33.824Z (ns `1794244413824000000`)
- Reveal deadline: 2026-11-09T17:16:33.824Z (ns `1794244593824000000`)
- Durability due: 2026-11-09T17:20:08.963Z (ns `1794244808963852500`)
- Final status: **CLOSED**
- Awarded bid: `BID-B-BENCH-001` to `mend-contractor-b.testnet`
- Inspector: `mend-inspector.testnet`

### Bids (canonical A/B/C)

| Bid | Contractor | Price (micro) | Duration | Warranty | Materials | Availability (off-chain) | Commit tx | Reveal tx |
|---|---|---:|---:|---:|---:|---:|---|---|
| `BID-A-BENCH-001` | `mend-contractor-a.testnet` | 95000000 | 14 | 90 | 60 | 3 days | [`E4rp6A1fehEHzBkeegyXtQK9MMfPEdqfF5Dmo9y2PTY6`](https://explorer.testnet.near.org/transactions/E4rp6A1fehEHzBkeegyXtQK9MMfPEdqfF5Dmo9y2PTY6) | [`8BPecP1tgjk2bXWxKy2eQVe92k2agZXeqmGHRuKZtSiC`](https://explorer.testnet.near.org/transactions/8BPecP1tgjk2bXWxKy2eQVe92k2agZXeqmGHRuKZtSiC) |
| `BID-B-BENCH-001` | `mend-contractor-b.testnet` | 80000000 | 10 | 180 | 80 | 2 days | [`LvGB9VTCfwSpEN37FmqQraHymxa89EZEH2aRDsw6Whx`](https://explorer.testnet.near.org/transactions/LvGB9VTCfwSpEN37FmqQraHymxa89EZEH2aRDsw6Whx) | [`4eD3bQoLDdrzDPCYzAsgfAXRKQ4VZfLdspE4ZekXNf3N`](https://explorer.testnet.near.org/transactions/4eD3bQoLDdrzDPCYzAsgfAXRKQ4VZfLdspE4ZekXNf3N) |
| `BID-C-BENCH-001` | `mend-contractor-c.testnet` | 78000000 | 21 | 30 | 70 | 5 days | [`2Q52fAgmdahvafhD5nwSBeSene8QrRjZAi42i8FzBddy`](https://explorer.testnet.near.org/transactions/2Q52fAgmdahvafhD5nwSBeSene8QrRjZAi42i8FzBddy) | [`7TKU7tjbmddAJwWmdNbMDjV8AZDA5vnvTLRczocEiyAL`](https://explorer.testnet.near.org/transactions/7TKU7tjbmddAJwWmdNbMDjV8AZDA5vnvTLRczocEiyAL) |

The deployed hub is V1 and does not accept `available_in_days`; availability is recorded in this report and `live-state.json` but is not in the on-chain reveal. This is a real limitation of the already-deployed WASM, not a fabricated value.

### Deterministic local score

- Mode: **LOCAL_DETERMINISTIC** (`OutLayer used: false`).
- Execution id: `SX-LIVE-0001`
- Policy: `1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d` / `mend-bid-policy-v1` weights {"price": 4500, "warranty": 2500, "duration": 2000, "materials": 1000}
- Canonical input hash: `2de5d992808f5f6fdf69608fdd4a360d6566e0d2c3d9c2618b82d2b857a70f9f`
- Canonical output hash: `031421ab242b475579e45e4c3140ee6a9b93d289668f5942aadb03f3e89f9fb6`
- Local scoring code label (WASM hash field): `b926ea28934014ab0cbf55ff0090466274c64cf608fdac5a98521ae01eac0db7`
- Input file: `infra/testnet/score/WO-BENCH-001-0003.canonical-input.json`; output file: `infra/testnet/score/WO-BENCH-001-0003.score.json`
- Record tx: [`9QnV14jDwfTXFdy56PJQ4N63QAF7xQcDR4nDVUguGiqd`](https://explorer.testnet.near.org/transactions/9QnV14jDwfTXFdy56PJQ4N63QAF7xQcDR4nDVUguGiqd)
- Ranking:
  - 1. `BID-B-BENCH-001` / `mend-contractor-b.testnet` — **9270 bps**
  - 2. `BID-C-BENCH-001` / `mend-contractor-c.testnet` — **5200 bps**
  - 3. `BID-A-BENCH-001` / `mend-contractor-a.testnet` — **2873 bps**

OutLayer live publish was not funded/configured. No OutLayer execution is claimed; the on-chain score mode is `recorded`.

### Escrow and payments

| Field | micro-mUSDC |
|---|---:|
| `funding` | 100000000 |
| `refunded` | 20000000 |
| `escrowed` | 0 |
| `completionPaid` | 72000000 |
| `holdbackHeld` | 0 |
| `holdbackReleased` | 8000000 |

Payment rows (contract status is `PENDING` by design because the hub cannot observe the token receipt synchronously):

| Kind | Amount | Recipient |
|---|---:|---|
| REFUND | 20000000 | `mend-sponsor.testnet` |
| COMPLETION | 72000000 | `mend-contractor-b.testnet` |
| HOLDBACK | 8000000 | `mend-contractor-b.testnet` |

The corresponding NEP-141 `ft_transfer` events are verified from transaction receipts by `--check`:

- sponsor → hub 100 mUSDC: [`8qUzjZs3UNzGtGUptRfTRWPpgjdDvV6MREcGeJMDfbGx`](https://explorer.testnet.near.org/transactions/8qUzjZs3UNzGtGUptRfTRWPpgjdDvV6MREcGeJMDfbGx)
- hub → sponsor 20 mUSDC refund: [`4bDqwmwW67iBq6Sx7NDM2hcf7LPZQrMGxEBQrv5paJb6`](https://explorer.testnet.near.org/transactions/4bDqwmwW67iBq6Sx7NDM2hcf7LPZQrMGxEBQrv5paJb6)
- hub → contractor B 72 mUSDC: [`45gE2NTM2fvi9bPpbSyKqiU9EbBa4CeHyLZdiqNosryL`](https://explorer.testnet.near.org/transactions/45gE2NTM2fvi9bPpbSyKqiU9EbBa4CeHyLZdiqNosryL)
- hub → contractor B 8 mUSDC: [`Cf4Z3jaGbgVjx8jzfE13gPFRkzJAPwY4fkpz4wFzhBWz`](https://explorer.testnet.near.org/transactions/Cf4Z3jaGbgVjx8jzfE13gPFRkzJAPwY4fkpz4wFzhBWz)

## Lifecycle transactions

| Step | Transaction | Explorer |
|---|---|---|
| `bid_commit_A` | `E4rp6A1fehEHzBkeegyXtQK9MMfPEdqfF5Dmo9y2PTY6` | https://explorer.testnet.near.org/transactions/E4rp6A1fehEHzBkeegyXtQK9MMfPEdqfF5Dmo9y2PTY6 |
| `bid_commit_B` | `LvGB9VTCfwSpEN37FmqQraHymxa89EZEH2aRDsw6Whx` | https://explorer.testnet.near.org/transactions/LvGB9VTCfwSpEN37FmqQraHymxa89EZEH2aRDsw6Whx |
| `bid_commit_C` | `2Q52fAgmdahvafhD5nwSBeSene8QrRjZAi42i8FzBddy` | https://explorer.testnet.near.org/transactions/2Q52fAgmdahvafhD5nwSBeSene8QrRjZAi42i8FzBddy |
| `bid_reveal_A` | `8BPecP1tgjk2bXWxKy2eQVe92k2agZXeqmGHRuKZtSiC` | https://explorer.testnet.near.org/transactions/8BPecP1tgjk2bXWxKy2eQVe92k2agZXeqmGHRuKZtSiC |
| `bid_reveal_B` | `4eD3bQoLDdrzDPCYzAsgfAXRKQ4VZfLdspE4ZekXNf3N` | https://explorer.testnet.near.org/transactions/4eD3bQoLDdrzDPCYzAsgfAXRKQ4VZfLdspE4ZekXNf3N |
| `bid_reveal_C` | `7TKU7tjbmddAJwWmdNbMDjV8AZDA5vnvTLRczocEiyAL` | https://explorer.testnet.near.org/transactions/7TKU7tjbmddAJwWmdNbMDjV8AZDA5vnvTLRczocEiyAL |
| `bidding_close` | `4vqBBDcfaxwR3tj9gz2puViq6LPsP2J6kSg8VhqPQHjH` | https://explorer.testnet.near.org/transactions/4vqBBDcfaxwR3tj9gz2puViq6LPsP2J6kSg8VhqPQHjH |
| `score_record_LOCAL_DETERMINISTIC` | `9QnV14jDwfTXFdy56PJQ4N63QAF7xQcDR4nDVUguGiqd` | https://explorer.testnet.near.org/transactions/9QnV14jDwfTXFdy56PJQ4N63QAF7xQcDR4nDVUguGiqd |
| `award_winner_B` | `4bDqwmwW67iBq6Sx7NDM2hcf7LPZQrMGxEBQrv5paJb6` | https://explorer.testnet.near.org/transactions/4bDqwmwW67iBq6Sx7NDM2hcf7LPZQrMGxEBQrv5paJb6 |
| `work_start_B` | `4SAghtUqHMjCMbqgUdckMcbPM7w3qeE6KjqhiKvH6Vk4` | https://explorer.testnet.near.org/transactions/4SAghtUqHMjCMbqgUdckMcbPM7w3qeE6KjqhiKvH6Vk4 |
| `completion_submit_EV-LIVE-0001` | `2HQ2DLMiz2rtM4QtupZCzCeQxhUXvrqcqYfEVYzYub4K` | https://explorer.testnet.near.org/transactions/2HQ2DLMiz2rtM4QtupZCzCeQxhUXvrqcqYfEVYzYub4K |
| `completion_accept_INS-LIVE-0001` | `45gE2NTM2fvi9bPpbSyKqiU9EbBa4CeHyLZdiqNosryL` | https://explorer.testnet.near.org/transactions/45gE2NTM2fvi9bPpbSyKqiU9EbBa4CeHyLZdiqNosryL |
| `durability_pass_INS-LIVE-0002` | `Cf4Z3jaGbgVjx8jzfE13gPFRkzJAPwY4fkpz4wFzhBWz` | https://explorer.testnet.near.org/transactions/Cf4Z3jaGbgVjx8jzfE13gPFRkzJAPwY4fkpz4wFzhBWz |

## All recorded transaction hashes

`infra/testnet/live-state.json` contains all **57** submitted transactions with `step`, `hash`, `explorerUrl`, signer, receiver, method and final status. The table below is the same list for quick inspection.

| # | Step | Work order | Hash | Explorer |
|---:|---|---|---|---|
| 1 | `hub_set_role:mend-steward.testnet:STEWARD` |  | `8k5pyuJr7XhjJcUbiLbKqUAhRnqkoDbMENj3YnbQK4uc` | https://explorer.testnet.near.org/transactions/8k5pyuJr7XhjJcUbiLbKqUAhRnqkoDbMENj3YnbQK4uc |
| 2 | `hub_set_role:mend-sponsor.testnet:SPONSOR` |  | `5Jh7JnYKvsQfBUoxN3ETYLAdLKPymFJ7g4GWHcbBiMM` | https://explorer.testnet.near.org/transactions/5Jh7JnYKvsQfBUoxN3ETYLAdLKPymFJ7g4GWHcbBiMM |
| 3 | `hub_set_role:mend-coordinator-ai.testnet:COORDINATOR_AI` |  | `CfNyvjTjjKZviRsKnTnWjuv2Bki15osLRR6J3pNSFWgQ` | https://explorer.testnet.near.org/transactions/CfNyvjTjjKZviRsKnTnWjuv2Bki15osLRR6J3pNSFWgQ |
| 4 | `hub_set_role:mend-reviewer-ai.testnet:REVIEWER_AI` |  | `6eBkuJRPo6M2bZME8gLtTqbxfSD8oWX9mtXhB2x9pojN` | https://explorer.testnet.near.org/transactions/6eBkuJRPo6M2bZME8gLtTqbxfSD8oWX9mtXhB2x9pojN |
| 5 | `hub_set_role:mend-relayer.testnet:RELAYER` |  | `8iuQVWJnzCF2D4c9apdjMHDF3P5oLNNioxAsUwNM6QWM` | https://explorer.testnet.near.org/transactions/8iuQVWJnzCF2D4c9apdjMHDF3P5oLNNioxAsUwNM6QWM |
| 6 | `hub_set_role:mend-contractor-a.testnet:CONTRACTOR` |  | `9Dg7wFo6MKntqF57UFuWkVZgYy9LPqy7iDwgZF5UdWnS` | https://explorer.testnet.near.org/transactions/9Dg7wFo6MKntqF57UFuWkVZgYy9LPqy7iDwgZF5UdWnS |
| 7 | `hub_set_role:mend-contractor-b.testnet:CONTRACTOR` |  | `FfRfQ6ZRG3WbPNtsJeAFZV73YUR3ZBfYpkKTm7Xo1svw` | https://explorer.testnet.near.org/transactions/FfRfQ6ZRG3WbPNtsJeAFZV73YUR3ZBfYpkKTm7Xo1svw |
| 8 | `hub_set_role:mend-contractor-c.testnet:CONTRACTOR` |  | `EVeZ5ia8GMjrXgZqBz9JgDPgwWbAUaTbHWEsvXPhZsFz` | https://explorer.testnet.near.org/transactions/EVeZ5ia8GMjrXgZqBz9JgDPgwWbAUaTbHWEsvXPhZsFz |
| 9 | `hub_set_role:mend-contractor-d.testnet:CONTRACTOR` |  | `GzSgcEfqMrxfwhEcHZiSuXnurfEMfDhMHpDotc6vkVLp` | https://explorer.testnet.near.org/transactions/GzSgcEfqMrxfwhEcHZiSuXnurfEMfDhMHpDotc6vkVLp |
| 10 | `hub_set_role:mend-contractor-e.testnet:CONTRACTOR` |  | `6gKWrQ4h4ERWFKZTpFT8TPCkLpBZnhXJjMSusjQffz7w` | https://explorer.testnet.near.org/transactions/6gKWrQ4h4ERWFKZTpFT8TPCkLpBZnhXJjMSusjQffz7w |
| 11 | `hub_set_role:mend-inspector.testnet:INSPECTOR` |  | `GH2oZjuxoAPxTfSQakjymVt9iXdAv62QNCzhyLBo4ry9` | https://explorer.testnet.near.org/transactions/GH2oZjuxoAPxTfSQakjymVt9iXdAv62QNCzhyLBo4ry9 |
| 12 | `hub_set_role:mend-inspector-2.testnet:INSPECTOR` |  | `9J7HPcLMiPjVbxkAxGnYWixpXTeGs4vigyi6hKqW2RQN` | https://explorer.testnet.near.org/transactions/9J7HPcLMiPjVbxkAxGnYWixpXTeGs4vigyi6hKqW2RQN |
| 13 | `hub_set_role:mend-dao.testnet:DAO` |  | `FfqKxUaG85qRC1fkawKzQ4ZW171jjwKACrusJFo3KodC` | https://explorer.testnet.near.org/transactions/FfqKxUaG85qRC1fkawKzQ4ZW171jjwKACrusJFo3KodC |
| 14 | `token_storage_deposit:mend-dao.testnet` |  | `6tZR4v5DeyvvMJkWdvvApdvmnySJGtAS7Jd7JW5K6eTV` | https://explorer.testnet.near.org/transactions/6tZR4v5DeyvvMJkWdvvApdvmnySJGtAS7Jd7JW5K6eTV |
| 15 | `token_storage_deposit:mend-sponsor.testnet` |  | `FsQLeRZCisXcQGaQKd8BFZnyJGCWBA6qXud5MfE499Px` | https://explorer.testnet.near.org/transactions/FsQLeRZCisXcQGaQKd8BFZnyJGCWBA6qXud5MfE499Px |
| 16 | `token_storage_deposit:mend-contractor-a.testnet` |  | `6rxncx2fE15ea1WP6R1SvdcxoB84ejP1TfLnqCLKStUK` | https://explorer.testnet.near.org/transactions/6rxncx2fE15ea1WP6R1SvdcxoB84ejP1TfLnqCLKStUK |
| 17 | `token_storage_deposit:mend-contractor-b.testnet` |  | `H2Hy4yPQx2HqEs7Gv9wJW7dCsB2ypSN9gSx7yVbQEAzz` | https://explorer.testnet.near.org/transactions/H2Hy4yPQx2HqEs7Gv9wJW7dCsB2ypSN9gSx7yVbQEAzz |
| 18 | `token_storage_deposit:mend-contractor-c.testnet` |  | `7etdTSYM6fZRD73vKKo3B7EZ7Pn4RTP75xyc6fHqBHe6` | https://explorer.testnet.near.org/transactions/7etdTSYM6fZRD73vKKo3B7EZ7Pn4RTP75xyc6fHqBHe6 |
| 19 | `token_storage_deposit:mend-contractor-d.testnet` |  | `4793G4mR3qwqdXfgwYcTzqroBDS9Z7eWp9sy1HJce7u4` | https://explorer.testnet.near.org/transactions/4793G4mR3qwqdXfgwYcTzqroBDS9Z7eWp9sy1HJce7u4 |
| 20 | `token_storage_deposit:mend-contractor-e.testnet` |  | `3hGAubmWR8BjLcXg2kaVCBRHimDTeK3mhwKhNhKxycdp` | https://explorer.testnet.near.org/transactions/3hGAubmWR8BjLcXg2kaVCBRHimDTeK3mhwKhNhKxycdp |
| 21 | `token_storage_deposit:mend-inspector.testnet` |  | `BTJ9zxdRB94LJjfdnmwzqWnMer3mNeGEXhcWvJUrbjT5` | https://explorer.testnet.near.org/transactions/BTJ9zxdRB94LJjfdnmwzqWnMer3mNeGEXhcWvJUrbjT5 |
| 22 | `token_storage_deposit:mend-inspector-2.testnet` |  | `36LaBfvPPiVMKAjqrTbjSysxgzggqdxArktqs1D4M2of` | https://explorer.testnet.near.org/transactions/36LaBfvPPiVMKAjqrTbjSysxgzggqdxArktqs1D4M2of |
| 23 | `sponsor_grant_500_musdc` |  | `Edt1Ek5sTndMjQic2hFBn2fS5rocGXSChmvyPqJmuDFg` | https://explorer.testnet.near.org/transactions/Edt1Ek5sTndMjQic2hFBn2fS5rocGXSChmvyPqJmuDFg |
| 24 | `asset_create_BENCH-001` |  | `ChhVakDg91jgKq2RXNYYREVVsrNogBXkvCFGmy2wqHuN` | https://explorer.testnet.near.org/transactions/ChhVakDg91jgKq2RXNYYREVVsrNogBXkvCFGmy2wqHuN |
| 25 | `passport_mint_BENCH-001` |  | `GVCdWQ69Rp8XCKVkXTFoMkxXKUVyTzD3SxNSZiMyVkvc` | https://explorer.testnet.near.org/transactions/GVCdWQ69Rp8XCKVkXTFoMkxXKUVyTzD3SxNSZiMyVkvc |
| 26 | `work_order_create` | WO-BENCH-001-0001 | `6mcB9XihVViUuUCm7Zu6dDrbALSJ6Mv4GwbB9kQgPW6W` | https://explorer.testnet.near.org/transactions/6mcB9XihVViUuUCm7Zu6dDrbALSJ6Mv4GwbB9kQgPW6W |
| 27 | `dao_authorize_fallback` |  | `HqEhrGUPy2zUcvKWjxMTE2jDcZB2FG2DLZ3hkuxw4yBt` | https://explorer.testnet.near.org/transactions/HqEhrGUPy2zUcvKWjxMTE2jDcZB2FG2DLZ3hkuxw4yBt |
| 28 | `work_order_fund_100_musdc` | WO-BENCH-001-0001 | `61scdMHeMWgLJNb7WRaeYFjWURQ7urnpFr1sjBmXKPEV` | https://explorer.testnet.near.org/transactions/61scdMHeMWgLJNb7WRaeYFjWURQ7urnpFr1sjBmXKPEV |
| 29 | `work_order_open_bidding` |  | `5F9xfoZADQQ3tAEhhQ5tWcg9Ym4dXgiyAsd9WMMNy2KA` | https://explorer.testnet.near.org/transactions/5F9xfoZADQQ3tAEhhQ5tWcg9Ym4dXgiyAsd9WMMNy2KA |
| 30 | `old_work_order_cancel` | WO-BENCH-001-0001 | `BdCkNAXM8ZmCL6yRmBJ6zcksbgweg2hTecJiapoESmJt` | https://explorer.testnet.near.org/transactions/BdCkNAXM8ZmCL6yRmBJ6zcksbgweg2hTecJiapoESmJt |
| 31 | `old_work_order_refund` | WO-BENCH-001-0001 | `4gjqPkW7HNqHCPiijk2tk2RCjXhMKySq6zJqhbgGayh8` | https://explorer.testnet.near.org/transactions/4gjqPkW7HNqHCPiijk2tk2RCjXhMKySq6zJqhbgGayh8 |
| 32 | `work_order_create` | WO-BENCH-001-0002 | `CxWWR9k3ZbArwrNV42w6Kr9c8vncHrYLmNVDQ5mhEpvi` | https://explorer.testnet.near.org/transactions/CxWWR9k3ZbArwrNV42w6Kr9c8vncHrYLmNVDQ5mhEpvi |
| 33 | `dao_authorize_fallback` |  | `2ZFPesWgL9ecoyNv5WHdCc1jZVumKLo6uzzByoDWSmTS` | https://explorer.testnet.near.org/transactions/2ZFPesWgL9ecoyNv5WHdCc1jZVumKLo6uzzByoDWSmTS |
| 34 | `work_order_fund_100_musdc` | WO-BENCH-001-0002 | `J1X2m6oSbTwmXYrzi4FRPsYKcndoQuc5dfxbHzjgunTy` | https://explorer.testnet.near.org/transactions/J1X2m6oSbTwmXYrzi4FRPsYKcndoQuc5dfxbHzjgunTy |
| 35 | `work_order_open_bidding` |  | `DXP4bXzZL2i8D8KKASpEotb7zu3xL2xcT874iuRXaW3Y` | https://explorer.testnet.near.org/transactions/DXP4bXzZL2i8D8KKASpEotb7zu3xL2xcT874iuRXaW3Y |
| 36 | `bid_commit_A` |  | `2ED6zEmTHLc7TPjR5F7DACv29wz9aLtgoBaBNk6cQJBR` | https://explorer.testnet.near.org/transactions/2ED6zEmTHLc7TPjR5F7DACv29wz9aLtgoBaBNk6cQJBR |
| 37 | `bid_commit_B` |  | `76hTfN8oZm1UjMV8A4sMet54eegVXVk2p7xAxXvpy7Jg` | https://explorer.testnet.near.org/transactions/76hTfN8oZm1UjMV8A4sMet54eegVXVk2p7xAxXvpy7Jg |
| 38 | `bid_commit_C` |  | `HRHQS3TPmoszzvEViz4oqqPDZUSeZpWUgTJrjGQRcXo2` | https://explorer.testnet.near.org/transactions/HRHQS3TPmoszzvEViz4oqqPDZUSeZpWUgTJrjGQRcXo2 |
| 39 | `cleanup_cancel:WO-BENCH-001-0002` | WO-BENCH-001-0002 | `H1e2UV4aHtZHn7Wgjrd3ey9izK6fFBw37qLeiNwaci3C` | https://explorer.testnet.near.org/transactions/H1e2UV4aHtZHn7Wgjrd3ey9izK6fFBw37qLeiNwaci3C |
| 40 | `cleanup_refund:WO-BENCH-001-0002` | WO-BENCH-001-0002 | `B2otm231ZKj4WLT4HoQCN5FGS4rLQJzS8xCx831SXNtC` | https://explorer.testnet.near.org/transactions/B2otm231ZKj4WLT4HoQCN5FGS4rLQJzS8xCx831SXNtC |
| 41 | `work_order_create` | WO-BENCH-001-0003 | `DtjFvAUg9UJmozU5UbEviQzoYYXsVucozJkD61LhtHqe` | https://explorer.testnet.near.org/transactions/DtjFvAUg9UJmozU5UbEviQzoYYXsVucozJkD61LhtHqe |
| 42 | `dao_authorize_fallback` |  | `51E4s7s7zyqrCNgEKtNM1g8YGufm9SpJP6e4BQvWKU1z` | https://explorer.testnet.near.org/transactions/51E4s7s7zyqrCNgEKtNM1g8YGufm9SpJP6e4BQvWKU1z |
| 43 | `work_order_fund_100_musdc` | WO-BENCH-001-0003 | `8qUzjZs3UNzGtGUptRfTRWPpgjdDvV6MREcGeJMDfbGx` | https://explorer.testnet.near.org/transactions/8qUzjZs3UNzGtGUptRfTRWPpgjdDvV6MREcGeJMDfbGx |
| 44 | `work_order_open_bidding` | WO-BENCH-001-0003 | `FG6hgssGsKqLiE8Fu9qeTF1ikR4rWk5YM2nGNvh4N8jQ` | https://explorer.testnet.near.org/transactions/FG6hgssGsKqLiE8Fu9qeTF1ikR4rWk5YM2nGNvh4N8jQ |
| 45 | `bid_commit_A` | WO-BENCH-001-0003 | `E4rp6A1fehEHzBkeegyXtQK9MMfPEdqfF5Dmo9y2PTY6` | https://explorer.testnet.near.org/transactions/E4rp6A1fehEHzBkeegyXtQK9MMfPEdqfF5Dmo9y2PTY6 |
| 46 | `bid_commit_B` | WO-BENCH-001-0003 | `LvGB9VTCfwSpEN37FmqQraHymxa89EZEH2aRDsw6Whx` | https://explorer.testnet.near.org/transactions/LvGB9VTCfwSpEN37FmqQraHymxa89EZEH2aRDsw6Whx |
| 47 | `bid_commit_C` | WO-BENCH-001-0003 | `2Q52fAgmdahvafhD5nwSBeSene8QrRjZAi42i8FzBddy` | https://explorer.testnet.near.org/transactions/2Q52fAgmdahvafhD5nwSBeSene8QrRjZAi42i8FzBddy |
| 48 | `bid_reveal_A` | WO-BENCH-001-0003 | `8BPecP1tgjk2bXWxKy2eQVe92k2agZXeqmGHRuKZtSiC` | https://explorer.testnet.near.org/transactions/8BPecP1tgjk2bXWxKy2eQVe92k2agZXeqmGHRuKZtSiC |
| 49 | `bid_reveal_B` | WO-BENCH-001-0003 | `4eD3bQoLDdrzDPCYzAsgfAXRKQ4VZfLdspE4ZekXNf3N` | https://explorer.testnet.near.org/transactions/4eD3bQoLDdrzDPCYzAsgfAXRKQ4VZfLdspE4ZekXNf3N |
| 50 | `bid_reveal_C` | WO-BENCH-001-0003 | `7TKU7tjbmddAJwWmdNbMDjV8AZDA5vnvTLRczocEiyAL` | https://explorer.testnet.near.org/transactions/7TKU7tjbmddAJwWmdNbMDjV8AZDA5vnvTLRczocEiyAL |
| 51 | `bidding_close` | WO-BENCH-001-0003 | `4vqBBDcfaxwR3tj9gz2puViq6LPsP2J6kSg8VhqPQHjH` | https://explorer.testnet.near.org/transactions/4vqBBDcfaxwR3tj9gz2puViq6LPsP2J6kSg8VhqPQHjH |
| 52 | `score_record_LOCAL_DETERMINISTIC` | WO-BENCH-001-0003 | `9QnV14jDwfTXFdy56PJQ4N63QAF7xQcDR4nDVUguGiqd` | https://explorer.testnet.near.org/transactions/9QnV14jDwfTXFdy56PJQ4N63QAF7xQcDR4nDVUguGiqd |
| 53 | `award_winner_B` | WO-BENCH-001-0003 | `4bDqwmwW67iBq6Sx7NDM2hcf7LPZQrMGxEBQrv5paJb6` | https://explorer.testnet.near.org/transactions/4bDqwmwW67iBq6Sx7NDM2hcf7LPZQrMGxEBQrv5paJb6 |
| 54 | `work_start_B` | WO-BENCH-001-0003 | `4SAghtUqHMjCMbqgUdckMcbPM7w3qeE6KjqhiKvH6Vk4` | https://explorer.testnet.near.org/transactions/4SAghtUqHMjCMbqgUdckMcbPM7w3qeE6KjqhiKvH6Vk4 |
| 55 | `completion_submit_EV-LIVE-0001` | WO-BENCH-001-0003 | `2HQ2DLMiz2rtM4QtupZCzCeQxhUXvrqcqYfEVYzYub4K` | https://explorer.testnet.near.org/transactions/2HQ2DLMiz2rtM4QtupZCzCeQxhUXvrqcqYfEVYzYub4K |
| 56 | `completion_accept_INS-LIVE-0001` | WO-BENCH-001-0003 | `45gE2NTM2fvi9bPpbSyKqiU9EbBa4CeHyLZdiqNosryL` | https://explorer.testnet.near.org/transactions/45gE2NTM2fvi9bPpbSyKqiU9EbBa4CeHyLZdiqNosryL |
| 57 | `durability_pass_INS-LIVE-0002` | WO-BENCH-001-0003 | `Cf4Z3jaGbgVjx8jzfE13gPFRkzJAPwY4fkpz4wFzhBWz` | https://explorer.testnet.near.org/transactions/Cf4Z3jaGbgVjx8jzfE13gPFRkzJAPwY4fkpz4wFzhBWz |

## Acceptance check

Command:

```bash
node infra/testnet/deploy-live.mjs --check
```

Result: `check: PASS`. It verifies token metadata/supply, hub config, all role grants, asset/passport, the final work order state `CLOSED`, the 100/20/72/8 escrow ledger, payment rows, and the four NEP-141 transfer events, then queries every recorded transaction hash for a successful final status. It reads the active work order from `live-state.json`, so it does not require `MEND_WORK_ORDER_ID`.

## Honest limitations and risks

- NEAR testnet only. Test mUSDC and testnet NEAR have no real value. No mainnet deployment was attempted.
- The hub signing key in MEND_TESTNET_KEYS_FILE is not an on-chain access key. The hub remains deployed and usable through owner/role accounts, but it cannot be deleted, redeployed or re-initialised without the original hub key. No destructive hub call was made.
- Sputnik DAO v2 factory creation was not submitted: the configured RPC endpoint returned HTTP 429 (deprecated endpoint). No Sputnik DAO exists; mend-dao.testnet is a documented plain-account fallback, not a Sputnik DAO.
- The deployed hub WASM is the older MEND_BID_V1 commitment format: the contract does not accept available_in_days. Availability values are recorded off-chain in this file and the bid manifest, but not in the on-chain reveal. A hub redeploy was explicitly not performed.
- OutLayer live execution was not used: it is not funded/configured on this deployment. The score was computed by the steward with the deterministic local algorithm and recorded on-chain with mode "recorded"; the deployment labels it LOCAL_DETERMINISTIC.
- The passport NFT is non-transferable and held by the hub registry account; it is not a title deed, legal ownership record, or evidence of a real repair.
- The hub, sponsor and some contractor accounts are shared with concurrent testnet work orders. Absolute token balances include that activity; per-work-order escrow, payment rows and NEP-141 transfer events are the authoritative evidence for this work order.
- The requested `WO-BENCH-001-0001` and intermediate `WO-BENCH-001-0002` are cancelled/refunded; the completed lifecycle is `WO-BENCH-001-0003`. This is a deviation from the original single-attempt plan and is recorded on-chain.
- The hub account key in the keys file is not an on-chain key. No destructive hub call was made; the hub remains owned by `mend-deployer.testnet` and is usable through owner/role calls.
- Testnet accounts are shared with other concurrent workers. Absolute token balances and the hub-wide reconciliation totals include their work orders; use the per-work-order escrow/payment/event evidence above.
- No mainnet deployment, no real funds, no real repair, no legal ownership. No secrets are included in this report or in `live-state.json`.

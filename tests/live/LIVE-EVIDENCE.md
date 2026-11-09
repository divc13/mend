# LIVE_TESTNET quality evidence

Independent verification of the real NEAR testnet deployment and the live
wallet/API/UI surfaces. No mainnet, no deploy, no repository secret was read or
printed.

- **Date:** 2026-11-09
- **Branch:** `track/live-quality`
- **Network:** NEAR testnet only (`https://rpc.testnet.fastnear.com`)
- **Hub:** `mend-hub.testnet`
- **Token:** `mend-usdc.testnet` (mUSDC, 6 decimals, test value only)
- **Explorer:** `https://explorer.testnet.near.org`
- **Final work order:** `WO-BENCH-001-0003`
- **Asset / passport:** `BENCH-001`
- **Deployment state:** `../testnet/infra/testnet/live-state.json` (read-only reference)
- **Key file:** path only, outside the repository (`~/.mend/testnet/keys.json`); contents were never read by the test code.

## Commands and results

```bash
npm install
npm install --prefix tests

# Full live suite (RPC + API + headless UI)
npm --prefix tests/live run test:live
```

Observed tail of the full run:

```text
▶ LIVE_TESTNET API checks against the real testnet deployment
  ✔ GET /health reports LIVE_TESTNET, live chain and no secrets
  ✔ GET /v1/testnet/wallet/:accountId returns balance and storage without secrets
  ✔ wallet and faucet endpoints reject invalid or non-testnet account ids
  ✔ faucet sends a real testnet transfer and the next request is 429
  ℹ faucet tx: BbRhpPTjGJX27tcHhkz1WyfxBkuzPJNuzE1QF1ou5tvC
  ℹ faucet amount: 100000000 micro mUSDC to mend-contractor-c.testnet
  ℹ faucet rate limit: HTTP 429 {"code":"RELAYER_RATE_LIMITED","message":"Too many faucet requests from this IP","details":{"retryAfterSeconds":3595,...}}
  ✔ wallet creation returns a one-time secret or BLOCKED; the next request is 429
  ℹ BLOCKED: NEAR faucet did not create a wallet: {"error":{"code":"RELAYER_RATE_LIMITED",...}}
  ℹ wallet creation rate limit: HTTP 429 {"code":"RELAYER_RATE_LIMITED","message":"Too many testnet wallet creations from this IP",...}
  ✔ POST /v1/live/run-scenario refuses to run when the runner is disabled
✔ LIVE_TESTNET API checks against the real testnet deployment

▶ NEAR testnet RPC verification of the deployed MEND lifecycle
  ✔ hub views match live-state.json and report CLOSED with exact escrow amounts
  ✔ every recorded transaction hash resolves successfully on testnet RPC
  ✔ payment transactions emit the exact NEP-141 ft_transfer amounts
  ✔ the passport is owned by the hub and nft_transfer is rejected
✔ NEAR testnet RPC verification of the deployed MEND lifecycle
ℹ tests 10
ℹ suites 2
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

Running 2 tests using 1 worker
  ✓ 1 [live-chromium] › live/wallet-live.spec.ts:19:3 › LIVE_TESTNET wallet and live console › wallet renders create/faucet controls, the testnet warning and a real balance (2.8s)
  ✓ 2 [live-chromium] › live/wallet-live.spec.ts:56:3 › LIVE_TESTNET wallet and live console › live console renders the run control and an honest unavailable state (547ms)
  2 passed (5.2s)
```

```bash
# Exact working list command. From the repository root, `npx playwright`
# resolves a different Playwright copy than the spec in tests/live, so the
# command is run from tests/ (or via the package script below).
cd tests && npx playwright test --config ../playwright.live.config.ts --list
```

```text
Listing tests:
  [live-chromium] › wallet-live.spec.ts:19:3 › LIVE_TESTNET wallet and live console › wallet renders create/faucet controls, the testnet warning and a real balance
  [live-chromium] › wallet-live.spec.ts:56:3 › LIVE_TESTNET wallet and live console › live console renders the run control and an honest unavailable state
Total: 2 tests in 1 file
```

```bash
npm --prefix tests/live run test:live:list
```

Produces the same 2 listed tests.

## Test counts

| Suite | Passed | Failed | Skipped | Notes |
|---|---:|---:|---:|---|
| RPC verification (`rpc-verification.test.mjs`) | 4 | 0 | 0 | 57/57 transaction hashes resolved |
| Live API (`api-checks.test.mjs`) | 6 | 0 | 0 | 1 sub-check BLOCKED (see below) |
| Headless UI (`wallet-live.spec.ts`) | 2 | 0 | 0 | Chromium, LIVE_TESTNET |
| **Total** | **12** | **0** | **0** | |

**Blocked sub-check:** real wallet creation via the public NEAR faucet. The API
returned HTTP 429 from the external NEAR faucet
(`The NEAR testnet faucet rate-limited this wallet creation request`), so no
account or secret was created. This is marked BLOCKED, not failed. The MEND
rate-limit path was still verified: the second request returned
`HTTP 429 RELAYER_RATE_LIMITED` from the API's own limiter.

## RPC verification (hub + passport)

All values below were read from `mend-hub.testnet` with `finality: final` and
compared to `live-state.json`.

| Check | Expected | Observed | Result |
|---|---|---|---|
| `get_work_order.status` | `CLOSED` | `CLOSED` | PASS |
| `get_work_order.funded` | `100000000` | `100000000` | PASS |
| `get_escrow.funding` | `100000000` | `100000000` | PASS |
| `get_escrow.refunded` | `20000000` | `20000000` | PASS |
| `get_escrow.completionPaid` | `72000000` | `72000000` | PASS |
| `get_escrow.holdbackReleased` | `8000000` | `8000000` | PASS |
| `get_escrow.escrowed` / `holdbackHeld` | `0` / `0` | `0` / `0` | PASS |
| `get_payments` | 3 rows: refund `20000000`, completion `72000000`, holdback `8000000` | exactly those rows/amounts | PASS |
| `get_warranty.state` / `workOrderState` | `NONE` / `CLOSED` | `NONE` / `CLOSED` | PASS |
| `get_warranty.holdbackReleasedAmount` | `8000000` | `8000000` | PASS |
| `get_asset` | `BENCH-001`, passport `BENCH-001`, includes `WO-BENCH-001-0003` | matches | PASS |
| `nft_token(BENCH-001).owner_id` | `mend-hub.testnet` | `mend-hub.testnet` | PASS |
| `nft_transfer` | rejected | RPC contract error (`WasmTrap` / `wasm execution failed`) | PASS |
| All `transactions[]` hashes | resolve successfully | 57/57 `FINAL`, success status | PASS |
| NEP-141 payment events | refund `20000000`, completion `72000000`, holdback `8000000` | exact `ft_transfer` events from hub to sponsor/contractor | PASS |

Payment rows remain `PENDING` on-chain by contract design: the hub cannot
observe the asynchronous NEP-141 receipt. The three `ft_transfer` events above
are the payment proof.

## Live API checks

The API was started with:

```bash
MEND_MODE=LIVE_TESTNET \
CHAIN_ADAPTER=live \
MEND_TESTNET_KEYS_FILE=/absolute/path/outside/repo/keys.json \
MEND_RPC_URL=https://rpc.testnet.fastnear.com \
MEND_HUB_ACCOUNT=mend-hub.testnet \
MEND_TOKEN_ACCOUNT=mend-usdc.testnet \
MEND_TESTNET_WALLET_CREATES_PER_IP_HOUR=1 \
MEND_TESTNET_FAUCETS_PER_IP_HOUR=1 \
MEND_TESTNET_FAUCET_COOLDOWN_SECONDS=0 \
MEND_LIVE_SCENARIO_ENABLED=false \
npm --prefix apps/api run start
```

| Check | Observed | Result |
|---|---|---|
| `GET /health` | `mode: LIVE_TESTNET`, `chainAdapter.kind: live`, `available: true`, `mainnetRefused: true`, wallet/faucet enabled, no secrets | PASS |
| `GET /v1/testnet/wallet/mend-contractor-b.testnet` | `balanceMicro: 80000000`, `storageRegistered: true`, `secretStored: false`, no secret fields | PASS |
| Invalid wallet account | `HTTP 400 VALIDATION_ERROR` | PASS |
| Non-testnet faucet account | `HTTP 400 VALIDATION_ERROR` | PASS |
| Faucet real transfer | `HTTP 200`, `amountMicro: 100000000`, tx `BbRhpPTjGJX27tcHhkz1WyfxBkuzPJNuzE1QF1ou5tvC`, RPC success | PASS |
| Faucet rate limit | second request `HTTP 429 RELAYER_RATE_LIMITED` ("Too many faucet requests from this IP") | PASS |
| Wallet creation | external NEAR faucet returned `HTTP 429`; no account/secret created | BLOCKED |
| Wallet creation rate limit | second request `HTTP 429 RELAYER_RATE_LIMITED` ("Too many testnet wallet creations from this IP") | PASS |
| `POST /v1/live/run-scenario` with runner disabled | `HTTP 404 NOT_FOUND` ("Live scenario runner is disabled") | PASS |

Faucet transaction created by this suite:
`BbRhpPTjGJX27tcHhkz1WyfxBkuzPJNuzE1QF1ou5tvC`
([testnet explorer](https://explorer.testnet.near.org/transactions/BbRhpPTjGJX27tcHhkz1WyfxBkuzPJNuzE1QF1ou5tvC)).

## Headless UI checks

The web app was started with `MEND_MODE=LIVE_TESTNET` and
`MEND_API_BASE_URL=http://127.0.0.1:4311`; Playwright used
`http://localhost:3101` so Next.js 16 dev hydration is not blocked by its
cross-origin dev-resource guard.

| Check | Observed | Result |
|---|---|---|
| `/wallet` warning | `LIVE TESTNET — TEST VALUE ONLY`, `No mainnet. No real funds. No deploy.` | PASS |
| `/wallet` controls | Create-wallet and faucet controls render; faucet disabled until a wallet is loaded | PASS |
| `/wallet` live data | Loading `mend-contractor-b.testnet` through the web proxy showed `80.00 mUSDC` | PASS |
| `/live` control | `Run live testnet scenario` enabled in LIVE_TESTNET | PASS |
| `/live` honest unavailable | With the runner disabled, UI shows `The live run was not confirmed.` and `Live scenario runner is disabled` | PASS |
| Active mode | Environment banner is `LIVE TESTNET — TEST VALUE ONLY`; MAINNET is only the locked footer label | PASS |
| Secrets | No `ed25519:` key material in page HTML, `localStorage` or `sessionStorage`; only the public account ID is remembered | PASS |

## Transaction hashes verified

Every hash below resolved on the testnet RPC with a success status. This is the
full `transactions[]` list from `live-state.json` at verification time.

| # | Step | Signer | Hash |
|---|---|---|---|
| 1 | `hub_set_role:mend-steward.testnet:STEWARD` | `mend-deployer.testnet` | `8k5pyuJr7XhjJcUbiLbKqUAhRnqkoDbMENj3YnbQK4uc` |
| 2 | `hub_set_role:mend-sponsor.testnet:SPONSOR` | `mend-deployer.testnet` | `5Jh7JnYKvsQfBUoxN3ETYLAdLKPymFJ7g4GWHcbBiMM` |
| 3 | `hub_set_role:mend-coordinator-ai.testnet:COORDINATOR_AI` | `mend-deployer.testnet` | `CfNyvjTjjKZviRsKnTnWjuv2Bki15osLRR6J3pNSFWgQ` |
| 4 | `hub_set_role:mend-reviewer-ai.testnet:REVIEWER_AI` | `mend-deployer.testnet` | `6eBkuJRPo6M2bZME8gLtTqbxfSD8oWX9mtXhB2x9pojN` |
| 5 | `hub_set_role:mend-relayer.testnet:RELAYER` | `mend-deployer.testnet` | `8iuQVWJnzCF2D4c9apdjMHDF3P5oLNNioxAsUwNM6QWM` |
| 6 | `hub_set_role:mend-contractor-a.testnet:CONTRACTOR` | `mend-deployer.testnet` | `9Dg7wFo6MKntqF57UFuWkVZgYy9LPqy7iDwgZF5UdWnS` |
| 7 | `hub_set_role:mend-contractor-b.testnet:CONTRACTOR` | `mend-deployer.testnet` | `FfRfQ6ZRG3WbPNtsJeAFZV73YUR3ZBfYpkKTm7Xo1svw` |
| 8 | `hub_set_role:mend-contractor-c.testnet:CONTRACTOR` | `mend-deployer.testnet` | `EVeZ5ia8GMjrXgZqBz9JgDPgwWbAUaTbHWEsvXPhZsFz` |
| 9 | `hub_set_role:mend-contractor-d.testnet:CONTRACTOR` | `mend-deployer.testnet` | `GzSgcEfqMrxfwhEcHZiSuXnurfEMfDhMHpDotc6vkVLp` |
| 10 | `hub_set_role:mend-contractor-e.testnet:CONTRACTOR` | `mend-deployer.testnet` | `6gKWrQ4h4ERWFKZTpFT8TPCkLpBZnhXJjMSusjQffz7w` |
| 11 | `hub_set_role:mend-inspector.testnet:INSPECTOR` | `mend-deployer.testnet` | `GH2oZjuxoAPxTfSQakjymVt9iXdAv62QNCzhyLBo4ry9` |
| 12 | `hub_set_role:mend-inspector-2.testnet:INSPECTOR` | `mend-deployer.testnet` | `9J7HPcLMiPjVbxkAxGnYWixpXTeGs4vigyi6hKqW2RQN` |
| 13 | `hub_set_role:mend-dao.testnet:DAO` | `mend-deployer.testnet` | `FfqKxUaG85qRC1fkawKzQ4ZW171jjwKACrusJFo3KodC` |
| 14 | `token_storage_deposit:mend-dao.testnet` | `mend-deployer.testnet` | `6tZR4v5DeyvvMJkWdvvApdvmnySJGtAS7Jd7JW5K6eTV` |
| 15 | `token_storage_deposit:mend-sponsor.testnet` | `mend-deployer.testnet` | `FsQLeRZCisXcQGaQKd8BFZnyJGCWBA6qXud5MfE499Px` |
| 16 | `token_storage_deposit:mend-contractor-a.testnet` | `mend-deployer.testnet` | `6rxncx2fE15ea1WP6R1SvdcxoB84ejP1TfLnqCLKStUK` |
| 17 | `token_storage_deposit:mend-contractor-b.testnet` | `mend-deployer.testnet` | `H2Hy4yPQx2HqEs7Gv9wJW7dCsB2ypSN9gSx7yVbQEAzz` |
| 18 | `token_storage_deposit:mend-contractor-c.testnet` | `mend-deployer.testnet` | `7etdTSYM6fZRD73vKKo3B7EZ7Pn4RTP75xyc6fHqBHe6` |
| 19 | `token_storage_deposit:mend-contractor-d.testnet` | `mend-deployer.testnet` | `4793G4mR3qwqdXfgwYcTzqroBDS9Z7eWp9sy1HJce7u4` |
| 20 | `token_storage_deposit:mend-contractor-e.testnet` | `mend-deployer.testnet` | `3hGAubmWR8BjLcXg2kaVCBRHimDTeK3mhwKhNhKxycdp` |
| 21 | `token_storage_deposit:mend-inspector.testnet` | `mend-deployer.testnet` | `BTJ9zxdRB94LJjfdnmwzqWnMer3mNeGEXhcWvJUrbjT5` |
| 22 | `token_storage_deposit:mend-inspector-2.testnet` | `mend-deployer.testnet` | `36LaBfvPPiVMKAjqrTbjSysxgzggqdxArktqs1D4M2of` |
| 23 | `sponsor_grant_500_musdc` | `mend-deployer.testnet` | `Edt1Ek5sTndMjQic2hFBn2fS5rocGXSChmvyPqJmuDFg` |
| 24 | `asset_create_BENCH-001` | `mend-steward.testnet` | `ChhVakDg91jgKq2RXNYYREVVsrNogBXkvCFGmy2wqHuN` |
| 25 | `passport_mint_BENCH-001` | `mend-steward.testnet` | `GVCdWQ69Rp8XCKVkXTFoMkxXKUVyTzD3SxNSZiMyVkvc` |
| 26 | `work_order_create` | `mend-steward.testnet` | `6mcB9XihVViUuUCm7Zu6dDrbALSJ6Mv4GwbB9kQgPW6W` |
| 27 | `dao_authorize_fallback` | `mend-dao.testnet` | `HqEhrGUPy2zUcvKWjxMTE2jDcZB2FG2DLZ3hkuxw4yBt` |
| 28 | `work_order_fund_100_musdc` | `mend-sponsor.testnet` | `61scdMHeMWgLJNb7WRaeYFjWURQ7urnpFr1sjBmXKPEV` |
| 29 | `work_order_open_bidding` | `mend-steward.testnet` | `5F9xfoZADQQ3tAEhhQ5tWcg9Ym4dXgiyAsd9WMMNy2KA` |
| 30 | `old_work_order_cancel` | `mend-steward.testnet` | `BdCkNAXM8ZmCL6yRmBJ6zcksbgweg2hTecJiapoESmJt` |
| 31 | `old_work_order_refund` | `mend-steward.testnet` | `4gjqPkW7HNqHCPiijk2tk2RCjXhMKySq6zJqhbgGayh8` |
| 32 | `work_order_create` | `mend-steward.testnet` | `CxWWR9k3ZbArwrNV42w6Kr9c8vncHrYLmNVDQ5mhEpvi` |
| 33 | `dao_authorize_fallback` | `mend-dao.testnet` | `2ZFPesWgL9ecoyNv5WHdCc1jZVumKLo6uzzByoDWSmTS` |
| 34 | `work_order_fund_100_musdc` | `mend-sponsor.testnet` | `J1X2m6oSbTwmXYrzi4FRPsYKcndoQuc5dfxbHzjgunTy` |
| 35 | `work_order_open_bidding` | `mend-steward.testnet` | `DXP4bXzZL2i8D8KKASpEotb7zu3xL2xcT874iuRXaW3Y` |
| 36 | `bid_commit_A` | `mend-contractor-a.testnet` | `2ED6zEmTHLc7TPjR5F7DACv29wz9aLtgoBaBNk6cQJBR` |
| 37 | `bid_commit_B` | `mend-contractor-b.testnet` | `76hTfN8oZm1UjMV8A4sMet54eegVXVk2p7xAxXvpy7Jg` |
| 38 | `bid_commit_C` | `mend-contractor-c.testnet` | `HRHQS3TPmoszzvEViz4oqqPDZUSeZpWUgTJrjGQRcXo2` |
| 39 | `cleanup_cancel:WO-BENCH-001-0002` | `mend-steward.testnet` | `H1e2UV4aHtZHn7Wgjrd3ey9izK6fFBw37qLeiNwaci3C` |
| 40 | `cleanup_refund:WO-BENCH-001-0002` | `mend-steward.testnet` | `B2otm231ZKj4WLT4HoQCN5FGS4rLQJzS8xCx831SXNtC` |
| 41 | `work_order_create` | `mend-steward.testnet` | `DtjFvAUg9UJmozU5UbEviQzoYYXsVucozJkD61LhtHqe` |
| 42 | `dao_authorize_fallback` | `mend-dao.testnet` | `51E4s7s7zyqrCNgEKtNM1g8YGufm9SpJP6e4BQvWKU1z` |
| 43 | `work_order_fund_100_musdc` | `mend-sponsor.testnet` | `8qUzjZs3UNzGtGUptRfTRWPpgjdDvV6MREcGeJMDfbGx` |
| 44 | `work_order_open_bidding` | `mend-steward.testnet` | `FG6hgssGsKqLiE8Fu9qeTF1ikR4rWk5YM2nGNvh4N8jQ` |
| 45 | `bid_commit_A` | `mend-contractor-a.testnet` | `E4rp6A1fehEHzBkeegyXtQK9MMfPEdqfF5Dmo9y2PTY6` |
| 46 | `bid_commit_B` | `mend-contractor-b.testnet` | `LvGB9VTCfwSpEN37FmqQraHymxa89EZEH2aRDsw6Whx` |
| 47 | `bid_commit_C` | `mend-contractor-c.testnet` | `2Q52fAgmdahvafhD5nwSBeSene8QrRjZAi42i8FzBddy` |
| 48 | `bid_reveal_A` | `mend-contractor-a.testnet` | `8BPecP1tgjk2bXWxKy2eQVe92k2agZXeqmGHRuKZtSiC` |
| 49 | `bid_reveal_B` | `mend-contractor-b.testnet` | `4eD3bQoLDdrzDPCYzAsgfAXRKQ4VZfLdspE4ZekXNf3N` |
| 50 | `bid_reveal_C` | `mend-contractor-c.testnet` | `7TKU7tjbmddAJwWmdNbMDjV8AZDA5vnvTLRczocEiyAL` |
| 51 | `bidding_close` | `mend-steward.testnet` | `4vqBBDcfaxwR3tj9gz2puViq6LPsP2J6kSg8VhqPQHjH` |
| 52 | `score_record_LOCAL_DETERMINISTIC` | `mend-steward.testnet` | `9QnV14jDwfTXFdy56PJQ4N63QAF7xQcDR4nDVUguGiqd` |
| 53 | `award_winner_B` | `mend-steward.testnet` | `4bDqwmwW67iBq6Sx7NDM2hcf7LPZQrMGxEBQrv5paJb6` |
| 54 | `work_start_B` | `mend-contractor-b.testnet` | `4SAghtUqHMjCMbqgUdckMcbPM7w3qeE6KjqhiKvH6Vk4` |
| 55 | `completion_submit_EV-LIVE-0001` | `mend-contractor-b.testnet` | `2HQ2DLMiz2rtM4QtupZCzCeQxhUXvrqcqYfEVYzYub4K` |
| 56 | `completion_accept_INS-LIVE-0001` | `mend-inspector.testnet` | `45gE2NTM2fvi9bPpbSyKqiU9EbBa4CeHyLZdiqNosryL` |
| 57 | `durability_pass_INS-LIVE-0002` | `mend-inspector-2.testnet` | `Cf4Z3jaGbgVjx8jzfE13gPFRkzJAPwY4fkpz4wFzhBWz` |

## Limitations and honest notes

- NEAR testnet only. mUSDC and testnet NEAR have no real value. No mainnet deployment, transfer or key exists in this suite.
- `live-state.json` is owned by the testnet deployment worker. These tests read it as a reference and independently compare every value to the chain; they do not modify it.
- Wallet creation is BLOCKED because the external NEAR faucet returned HTTP 429. No account was created and no secret was returned. The MEND-side rate limiter was verified separately.
- The faucet transfer is a real testnet transaction. Re-running the suite creates a new faucet transaction; the hash above records this run.
- The live scenario runner was intentionally disabled (`MEND_LIVE_SCENARIO_ENABLED=false`) for the UI check so the suite would not start a multi-minute lifecycle. The UI's honest "runner is disabled" state is verified; the real lifecycle itself is proven by the RPC checks above.
- Payment rows are `PENDING` on-chain by contract design. The NEP-141 `ft_transfer` receipt events are the authoritative payment evidence.
- The API test uses an in-memory repository; it does not persist wallet records to Postgres. The rate limits were set to 1/IP/hour to make the 429 paths deterministic.
- `npx playwright` from the repository root resolves a different Playwright copy than the spec under `tests/live`; the reproducible command is `cd tests && npx playwright test --config ../playwright.live.config.ts ...` or `npm --prefix tests/live run test:live:list`.
- Next.js 16 dev server blocks cross-origin dev resources when the browser origin is `127.0.0.1` while the server advertises `localhost`; the UI suite uses `localhost` for the web origin. This is test-harness configuration only and does not change app code.
- No secret, seed phrase or key file content was printed, stored, committed or placed in an artifact.

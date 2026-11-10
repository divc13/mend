# G3 — Real NEAR testnet lifecycle evidence

Date: 2026-11-09 · V2 update: 2026-11-10
Status: **PASS with documented caveats** (testnet only; no mainnet)
Network: `testnet` · V2 hub `mend-hub-v2.testnet` · Token `mend-usdc.testnet` (mUSDC, 6 decimals, test value only)
Explorer: `https://explorer.testnet.near.org`

## V2 update (2026-11-10) — real Sputnik DAO

The current authoritative run is `infra/testnet-v2/LIVE-V2.md` /
`infra/testnet-v2/live-state.json`:

- Fresh hub account `mend-hub-v2.testnet` deployed from the current WASM
  (`sha256 aebaf90e…5e61`) and initialized with owner `mend-deployer.testnet`,
  token `mend-usdc.testnet`, DAO `mend-dao.sputnikv2.testnet`, policy hash
  `b35cff38…e19f`, durability 2 minutes.
- **Real Sputnik DAO v2** created through `sputnikv2.testnet` with exactly
  6 NEAR attached. Council: `mend-deployer.testnet`, `mend-steward.testnet`,
  `mend-inspector.testnet`; proposal bond 1 NEAR.
- `WO-BENCH-V2-001-0002` authorized by Sputnik proposal **1**
  (`FunctionCall` → `mend-hub-v2.testnet.dao_authorize`), approved by 2 of 3
  council votes. Execution tx
  `8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h` contains the hub's
  `policy_approved` event.
- Three contractor commits/reveals with on-chain `available_in_days`; local
  deterministic ranking B 9270 > C 5200 > A 2873; contractor B awarded.
- Completion, human inspection, durability interval and final `CLOSED` with the
  exact `100 / 20 / 72 / 8` split and escrow 0. 42/42 recorded V2 hashes resolve.
- Honest operational caveats: the first factory attempt used 100 Tgas and failed
  (`Exceeded the prepaid gas`); it was retried with 250 Tgas. One aborted
  pre-award work order (`WO-BENCH-V2-001-0001`) was cancelled/refunded, and
  100 orphaned mUSDC from the aborted first hub attempt was swept back to the
  sponsor. Both are recorded verbatim in `infra/testnet-v2/LIVE-V2.md`.

The original 2026-11-09 evidence below is retained as history; it used the
documented `mend-dao.testnet` fallback because the Sputnik factory call failed
against the deprecated RPC at that time.


## Deployment

- Hub contract deployed and initialized (owner `mend-deployer.testnet`, token `mend-usdc.testnet`, DAO `mend-dao.testnet`, policy hash `1a8a9858…357d`, durability 2 minutes).
- Test token deployed with 1,000,000 mUSDC supply; hub/sponsor/role accounts registered.
- Asset `BENCH-001` created; non-transferable passport minted and owned by the hub.
- Work order `WO-BENCH-001-0003` funded with 100 mUSDC by `mend-sponsor.testnet`.
- Three contractor commitments/reveals; deterministic local score recorded; contractor B awarded.
- Completion evidence + human inspector acceptance; 72 mUSDC paid; durability pass; 8 mUSDC holdback released; final `CLOSED`.
- **57 real testnet transactions** recorded with explorer links in `infra/testnet/live-state.json`.

## On-chain final accounting (verified by independent RPC tests)

| Field | Value |
|---|---|
| funding | `100000000` |
| refunded | `20000000` |
| completionPaid | `72000000` |
| holdbackReleased | `8000000` |
| escrowed / holdbackHeld | `0` / `0` |
| final status | `CLOSED` |

Passport owner is the hub; `nft_transfer` is rejected. Payment receipts emit exact NEP-141 transfers.

## Independent verification

- `tests/live/rpc-verification.test.mjs` — 5 checks: hub views, all tx hashes resolve, exact payment amounts, passport ownership/transfer rejection. **PASS**
- `tests/live/api-checks.test.mjs` — 5 checks: LIVE_TESTNET health, wallet balance/storage, invalid account rejection, real faucet transfer, live-scenario guard. **PASS**
- `tests/live/wallet-live.spec.ts` — 2 Playwright checks: wallet page controls/testnet warning/real balance; live console honest unavailable state. **PASS**
- Faucet real transfer: `100000000` micro mUSDC to `mend-contractor-c.testnet`, tx `BbRhpPTjGJX27tcHhkz1WyfxBkuzPJNuzE1QF1ou5tvC`.
- Full evidence: `tests/live/LIVE-EVIDENCE.md`; deployment state: `infra/testnet/live-state.json`.

## Caveats (honest)

1. **Sputnik DAO factory (original run only)**: in the 2026-11-09 run the factory call failed against the deprecated public testnet RPC, so the hub used the existing `mend-dao.testnet` account as a documented fallback; no Sputnik proposal was claimed *for that run*. This is superseded by the V2 update above: `mend-dao.sputnikv2.testnet` is a real Sputnik DAO and proposal `1` executed `dao_authorize` on `mend-hub-v2.testnet`.
2. **Hub signing key (original run)**: in the 2026-11-09 run the hub was already deployed/initialized and its signing key was unavailable, so lifecycle calls used owner/role keys and did not require redeploying it. In V2 the hub key is an on-chain access key and `mend-hub-v2.testnet` was deployed by this driver.
3. **OutLayer live execution not funded**: the canonical score was computed locally with the hash-pinned algorithm and recorded as `LOCAL_DETERMINISTIC`; no TEE attestation is claimed.
4. **Wallet creation rate-limited**: the NEAR faucet returned 429 for new wallet creation during verification; the API returns the exact retry guidance. The mUSDC faucet transfer itself succeeded.
5. **Hosted demo**: the web app runs locally against the live testnet API; no public hosting credentials were supplied.

**G3: PASS** — a complete repair lifecycle executed on NEAR testnet with real transaction links and exact 100/20/72/8 accounting, with the caveats above. The V2 update additionally proves a real Sputnik DAO authorization path.

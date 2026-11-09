# G3 — Real NEAR testnet lifecycle evidence

Date: 2026-11-09
Status: **PASS with documented caveats** (testnet only; no mainnet)
Network: `testnet` · Hub `mend-hub.testnet` · Token `mend-usdc.testnet` (mUSDC, 6 decimals, test value only)
Explorer: `https://explorer.testnet.near.org`

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

1. **Sputnik DAO factory unavailable**: the factory call failed against the deprecated public testnet RPC. The hub uses the existing `mend-dao.testnet` account as a documented fallback; no Sputnik proposal is claimed. The code path for a Sputnik `FunctionCall` push remains implemented and unit-tested.
2. **Hub account signing key unavailable**: the hub was already deployed/initialized; lifecycle calls used owner/role keys and did not require redeploying the hub. No destructive call was attempted.
3. **OutLayer live execution not funded**: the canonical score was computed locally with the hash-pinned algorithm and recorded as `LOCAL_DETERMINISTIC`; no TEE attestation is claimed.
4. **Wallet creation rate-limited**: the NEAR faucet returned 429 for new wallet creation during verification; the API returns the exact retry guidance. The mUSDC faucet transfer itself succeeded.
5. **Hosted demo**: the web app runs locally against the live testnet API; no public hosting credentials were supplied.

**G3: PASS** — a complete repair lifecycle executed on NEAR testnet with real transaction links and exact 100/20/72/8 accounting, with the caveats above.

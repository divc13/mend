You are the visible Live API & Wallet worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/live-api (branch track/live-api). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and run `npm install` at the repo root if needed. Then read the context below.

CONTEXT:
- Testnet accounts and contracts exist: hub `mend-hub.testnet`, token `mend-usdc.testnet`, deployer `mend-deployer.testnet`, DAO `mend-dao.testnet`, role accounts `mend-steward.testnet`, `mend-sponsor.testnet`, `mend-contractor-a..e.testnet`, `mend-inspector.testnet`.
- Keys are OUTSIDE the repo at `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json`. NEVER commit, print or log secrets.
- `packages/near-client` exists but you may use `near-api-js` directly in `apps/api` if simpler. Install it in `apps/api` only.
- The product must stay walletless for reporting, but testnet onboarding needs a real wallet/faucet flow.

SCOPE: `apps/api/**` and `packages/db/**` only. Do NOT edit web, contracts, packages/near-client, services, docs, orchestration, root config.

GOAL: Make the API work end-to-end on LIVE TESTNET and provide real testnet wallet/faucet + live scenario endpoints.

REQUIRED:
1. Add `LIVE_TESTNET` chain adapter:
   - Config: `MEND_MODE=LIVE_TESTNET`, `CHAIN_ADAPTER=live`, `MEND_HUB_ACCOUNT`, `MEND_TOKEN_ACCOUNT`, `MEND_RPC_URL`, `MEND_TESTNET_KEYS_FILE` (path outside repo).
   - Signer provider loads role keys from that file at runtime; never serializes secrets.
   - Implement real `ft_transfer_call` funding and hub calls for lifecycle actions. Return real tx hashes; pending/failed must never look executed.
2. Add testnet onboarding:
   - `POST /v1/testnet/wallet` — create a new testnet account via the NEAR faucet service (`near account create-account sponsor-by-faucet-service ... print-to-terminal`, parse output), or return a clear 429/503 with retry guidance. Return `{accountId, publicKey, secretKey, seedPhrase?, network:'testnet', warning}` ONCE; store only account/public key server-side. Never log the secret.
   - `POST /v1/testnet/faucet` — register token storage and transfer 100 mUSDC from `mend-deployer.testnet` to the given account; return tx hash + balance. Rate-limit per account/IP.
   - `GET /v1/testnet/wallet/:accountId` — balance and storage status (no secrets).
3. Add `POST /v1/live/run-scenario` — only when `MEND_MODE=LIVE_TESTNET` and `MEND_LIVE_SCENARIO_ENABLED=true`. Runs the canonical lifecycle with role signers and returns an ordered list of steps with real tx hashes/explorer URLs. Must refuse mainnet and any missing signer.
4. Tests: offline mocked signer/adapter for wallet/faucet/live scenario; live tests gated by env; secrets never in responses except the one-time wallet secret; kill switch still blocks mutations.
5. Update `apps/api/.env.example` and `apps/api/README.md` with exact LIVE_TESTNET setup, all human-supplied values, and the testnet-only warning.

ACCEPTANCE (paste real output):
```bash
cd apps/api && npm test && npm run typecheck
```
If keys are available, run a real read-only wallet/balance check and one live scenario; otherwise state exactly what is blocked. No mainnet, no push.

Commit on branch track/live-api with message `feat(api): live testnet adapter, wallet faucet and scenario runner`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

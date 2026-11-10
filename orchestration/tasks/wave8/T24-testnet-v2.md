You are the visible Testnet V2 / Sputnik DAO worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/testnet-v2 (new branch track/testnet-v2 from main). Do not ask questions; proceed.

CONTEXT:
- Main is pushed and CI-green. Existing testnet deployment uses an older hub and a plain DAO fallback.
- Testnet accounts/keys are outside the repo at `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json` (chmod 600). NEVER print, copy or commit secrets.
- You may create new testnet accounts via the public NEAR faucet (near-cli `sponsor-by-faucet-service` or `helper.testnet.near.org/account`) and fund them from existing testnet accounts.
- Use FastNear RPC `https://rpc.testnet.fastnear.com` if the deprecated `rpc.testnet.near.org` returns 429.
- Sputnik factory: `sputnikv2.testnet`; create call shape is in `orchestration/research/R0-D-dao-agent-market.md` §3.2. Attach the required 6 NEAR; council can be `mend-deployer.testnet`, `mend-steward.testnet`, `mend-inspector.testnet`.

SCOPE: `infra/testnet-v2/**` and `scripts/testnet-v2/**` only.

GOAL: Deploy a fresh final hub (current V2 WASM with bid availability) and a real Sputnik DAO, then run a complete lifecycle authorized through a real DAO proposal.

REQUIRED:
1. Create a new hub account (e.g. `mend-hub-v2.testnet`) and keys; save keys outside the repo. Deploy `contracts/target/wasm32-unknown-unknown/release/mend_hub.wasm` (rebuild from current source first) and initialize with owner `mend-deployer.testnet`, token `mend-usdc.testnet`, DAO = the real Sputnik DAO if created.
2. Create a real Sputnik DAO via `sputnikv2.testnet` using FastNear RPC. If creation succeeds, record the DAO account, factory tx, policy, proposal bond and council. If it fails, record the exact error and use a documented fallback — do not fake a DAO.
3. Create asset `BENCH-V2-001` (or reuse BENCH-001 if allowed), mint passport, create a work order, and authorize it through a real Sputnik `FunctionCall` proposal calling `dao_authorize` (council votes approve; record proposal ID and execution tx). If Sputnik fails, use the DAO account fallback and document it.
4. Fund 100 mUSDC, run 3 contractor commits/reveals (with availability), record deterministic score (LOCAL_DETERMINISTIC unless OutLayer is live), award, completion, inspection, durability, final CLOSED.
5. Write `infra/testnet-v2/live-state.json` and `infra/testnet-v2/LIVE-V2.md` with account IDs, contract IDs, DAO proposal ID/tx, all tx hashes, final accounting and honest caveats. Add `infra/testnet-v2/deploy-v2.mjs` (idempotent, refuses mainnet, never prints secrets).
6. Update `STATUS.md` and `orchestration/reports/G3-evidence.md` only if your evidence changes their claims (Sputnik DAO now real, new hub V2). Do not inflate.

ACCEPTANCE: script `--check` passes; all tx hashes resolve; exact 100/20/72/8; final CLOSED. No mainnet, no push.

Commit on branch track/testnet-v2 with message `feat(testnet): fresh V2 hub and real Sputnik DAO lifecycle`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, DAO PROPOSAL/TX, TX HASHES, TESTS, BLOCKERS, RISKS, COMMIT.

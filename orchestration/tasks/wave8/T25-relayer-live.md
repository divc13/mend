You are the visible Live NEP-366 Relayer worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/relayer-live (new branch track/relayer-live from main). Do not ask questions; proceed.

CONTEXT:
- `services/relayer` implements NEP-366 `Delegate` validation/gating and tests, but no live delegate transaction has been executed.
- Testnet keys are outside the repo at `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json`. NEVER print, copy or commit secrets.
- Hub `mend-hub.testnet`; a real work order exists. A safe live proof can be a read-only/allowlisted action that does not move funds (e.g. `commit_bid` on an open work order, or a paused/no-op call). Prefer the smallest safe action.

SCOPE: `services/relayer/**`, `scripts/relayer-live/**`.

GOAL: Execute and verify one real NEP-366 delegate transaction on NEAR testnet.

REQUIRED:
1. Build a signed `Delegate` for a testnet sender with a function-call key scoped to the hub, action restricted to an allowlisted MEND method. Relayer submits it.
2. Prove: valid delegate executes; replayed delegate is rejected; wrong receiver/method is rejected; expired delegate is rejected. Record real tx hashes and rejection errors.
3. If no safe method can be executed without moving funds, use a read-only/no-op allowlisted method or a dedicated test work order created for this proof; do not move user funds.
4. Save any new keys outside the repo. Add `scripts/relayer-live/run-live.mjs` (idempotent, refuses mainnet, never prints secrets) and `scripts/relayer-live/LIVE-RELAYER.md` with exact commands/results.
5. Update `STATUS.md` F09 only if the live relayer proof changes its claim.

ACCEPTANCE: `node scripts/relayer-live/run-live.mjs --check` passes; real tx hashes; tests pass. No mainnet, no push.

Commit on branch track/relayer-live with message `feat(relayer): live NEP-366 delegate proof`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TX HASHES, TESTS, BLOCKERS, RISKS, COMMIT.

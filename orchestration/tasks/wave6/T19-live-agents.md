You are the visible Live Agents & Keys worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/live-agents (branch track/live-agents). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and `npm install` at the repo root if needed.

CONTEXT:
- Testnet accounts and contracts exist: hub `mend-hub.testnet`, token `mend-usdc.testnet`.
- Keys are OUTSIDE the repo at `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json` (chmod 600). NEVER print, copy or commit secrets.
- Accounts: mend-coordinator-ai.testnet, mend-contractor-a..e.testnet, mend-inspector.testnet, mend-inspector-2.testnet, mend-relayer.testnet.
- The hub enforces roles and work-order rosters; scoped function-call keys are an additional boundary.

SCOPE: `services/coordinator-agent/**`, `services/contractor-agent/**`, `services/inspector-agent/**`, `packages/near-client/**`, `scripts/live-agents/**`.

GOAL: Provision real scoped testnet keys and prove the agent permission boundaries against the live hub.

REQUIRED:
1. Add a provisioning script `scripts/live-agents/provision-scoped-keys.mjs` that, using the keys file:
   - adds a function-call key for each contractor restricted to `mend-hub.testnet` and methods `commit_bid`, `reveal_bid`, `submit_completion` with a small allowance;
   - adds an inspector key restricted to `accept_completion`, `inspect_durability`;
   - adds a coordinator key restricted to `create_asset`, `create_work_order` (and no award/payment methods);
   - saves the new key pairs OUTSIDE the repo in `/Volumes/sandisk/Users/dc/.mend/testnet/scoped-keys.json`, chmod 600;
   - never prints secrets.
2. Verify via RPC `view_access_key` that the restrictions are real (receiver/methods/allowance).
3. Prove boundaries:
   - contractor key cannot call `accept_completion`/`inspect_durability`/`refund`;
   - inspector key cannot call `award`/`commit_bid`;
   - coordinator key cannot call `award`/`accept_completion`/`refund`.
   Use near-api-js or near-cli; a rejected transaction is evidence, not a failure.
4. Configure the contractor-agent to load a live account/key path from env and produce the canonical A/B/C bids with `availableInDays`; add a script `scripts/live-agents/run-agent-dry.mjs` that prints the exact commit/reveal payloads and hashes without sending (or sends if a work order is open).
5. Write `scripts/live-agents/LIVE-KEYS.md` with account IDs, key restrictions, verification commands/results and no secrets.

ACCEPTANCE (paste real output):
```bash
node scripts/live-agents/provision-scoped-keys.mjs --check
cd services/contractor-agent && npm test && npm run typecheck
cd packages/near-client && npm test && npm run typecheck
```
No mainnet, no push. Commit on branch track/live-agents with message `feat(agents): live scoped keys and permission boundaries`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

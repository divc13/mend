You are the visible Mainnet Profile worker for MEND (product completion). Working directory: /Volumes/sandisk/Users/dc/mend-wt/config-testkit (branch track/config-testkit). Do not ask questions; proceed.

FIRST: `git merge main --no-edit`.

SCOPE: only `packages/config/**`.

REQUIRED:
1. Add a mainnet profile module with:
   - Verified NEAR USDC token account: `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`, symbol `USDC`, decimals `6`, source URL `https://rpc.mainnet.near.org` (`ft_metadata` verified 2026-11-09).
   - Mainnet hub account, sponsor account and RPC URL as `HUMAN_SUPPLIED` placeholders (must not be invented).
   - `assertMainnetProfileReady(profile)` that fails closed until the hub account and explicit human approval are present.
   - Explorer URL builders for account/tx (NEAR mainnet explorer).
2. Keep testnet/replay profiles separate; no accidental mainnet selection.
3. Tests: token metadata frozen; missing hub/approval fails; explorer URLs correct; no secret fields; mainnet guard integration.
4. Update `packages/config/README.md` with the verified token source and human-supplied fields.

ACCEPTANCE (paste real output):
```bash
cd packages/config && npm test && npm run typecheck
```
No mainnet transactions, no deploy, no push.

Commit on branch track/config-testkit with message `feat(config): verified mainnet USDC profile and readiness guard`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

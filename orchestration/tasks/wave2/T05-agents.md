You are the visible Agents, Governance & Relayer worker for MEND (Wave 2). Working directory: /Volumes/sandisk/Users/dc/mend-wt/agents (git branch track/agents). Do not ask questions; proceed.

FIRST STEP — sync your worktree to the merged foundation:
```bash
git merge main --no-edit   # worktrees share the repo; main now has contracts/, compute/, packages/, infra/, docs/RULES.md
```
Then read the files below. Do not edit anything outside your scope.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (F04, F06, F08, F10, T05, scenarios C)
- /Volumes/sandisk/Users/dc/mend/orchestration/decisions/HUB-INTERFACE.md
- /Volumes/sandisk/Users/dc/mend/orchestration/research/R0-D-dao-agent-market.md and R0-E-near-platform.md (full)
- /Volumes/sandisk/Users/dc/mend/packages/protocol/src/{fixtures,hashing,scoring,constants}.ts

SCOPE (only these paths):
- packages/near-client/** — RPC, contract calls, event parsing, scoped-key provisioning helpers
- services/coordinator-agent/**
- services/contractor-agent/**
- services/inspector-agent/**
- services/agent-market-worker/**
- services/dao-watcher/**
- services/relayer/**
- fixtures/agents/** (agent/DAO/relayer fixtures only)
Do NOT edit contracts, apps, other packages/services, orchestration, docs, root config.

CRITICAL VERIFIED FACTS:
- Sputnik testnet factory `sputnikv2.testnet`; DAO `<name>.sputnikv2.testnet`. Authorization is a push path: an approved FunctionCall proposal calls hub `dao_authorize(...)`; the hub checks `predecessor == config.dao`. Do not build a second multisig and do not trust proposal text in the hub.
- Agent Market `https://market.near.ai`, API v2.0.0, worker auth `Authorization: Bearer aat_<32 hex>`; worker endpoints poll/start/submit/message/decline/progress; **there is no worker accept endpoint** — human/buyer accepts; production marketplace, not testnet.
- NEP-366 `Delegate` (not DelegateV2), zero-deposit single FunctionCall; relayer gates sender, receiver, method, args, gas, TTL, quota, replay cache. Contract authorizes by `predecessor_account_id`, never `signer_account_id`. Gasless escrow funding is impossible with a function-call key (deposit rejected) — document honestly.
- Function-call keys: separate sub-accounts, explicit receiver, non-empty method list, capped allowance; never a plaintext full-access key.

REQUIREMENTS:
1. `packages/near-client`: typed config, RPC provider, view/call helpers, event parser, function-call-key provisioning plan (commands/JSON, no secrets committed), role/permission verifier that can assert a key cannot release escrow or call non-allowlisted methods.
2. `coordinator-agent`: typed job intake, deterministic scope/work-order proposal output validated by protocol schemas, audit log; role can only create draft assets/work orders. Tests prove it cannot award/accept/pay.
3. `contractor-agent`: three deterministic strategies exactly matching fixtures:
   A 95 USDC / 14d / 90d warranty / materials 60;
   B 80 USDC / 10d / 180d / 80;
   C 78 USDC / 21d / 30d / 70.
   Separate account per agent, commit/reveal with the exact protocol commitment hash, no bid visibility before reveal. Optional model explanation must use only structured values (fixture explanations).
4. `inspector-agent`: redacted evidence checklist, returns missing items only, never "safe/approved/structurally sound", cannot submit final acceptance.
5. `agent-market-worker`: publish/register agent metadata, poll/start/submit jobs, redacted brief only (hashes/manifest, no private media or precise location), recorded API fixtures, disclose "self-hire test; not independent market reputation"; never call accept.
6. `dao-watcher`: read-only Sputnik proposal/policy checks; produce the exact FunctionCall proposal payload for `dao_authorize`; reject wrong proposal/roster/policy; no keys, no voting.
7. `relayer`: NEP-366 delegate validation, allowlisted hub methods only (`create_work_order`, `commit_bid`, `reveal_bid`, `submit_completion`), reject arbitrary contracts, replay protection, per-sender rate limits, daily and per-work-order caps, kill switch; tests for each rejection.
8. Prompt-injection regression: malicious text in reports/bids/briefs cannot change recipient, role, scope, payment rule or trigger a signature. Log the block.
9. All default tests offline with fixtures; live calls only behind explicit env flags and clearly labeled. No keys, no mainnet, no deploy, no push.

ACCEPTANCE (run and paste real output):
```bash
cd packages/near-client && npm test && npm run typecheck
cd services/coordinator-agent && npm test && npm run typecheck
cd services/contractor-agent && npm test && npm run typecheck
cd services/inspector-agent && npm test && npm run typecheck
cd services/agent-market-worker && npm test && npm run typecheck
cd services/dao-watcher && npm test && npm run typecheck
cd services/relayer && npm test && npm run typecheck
```
All must pass. If a service cannot be fully tested without a live account, the offline tests must still prove its policy logic; state the live blocker honestly.

Commit on branch track/agents with message `feat(agents): coordinator, contractors, inspector, DAO watcher, relayer and market worker`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

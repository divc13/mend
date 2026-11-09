# 10 — Deployment guide

This guide separates what can be run **today** from what is **pending integration**
and what is **blocked on a human**. It never presents a pending path as working.

## Status at a glance

| Environment | Status on 2026-11-09 | What exists |
|---|---|---|
| Docs/protocol checks | **VERIFIED NOW** | `npm ci`, protocol tests, typecheck, docs checker |
| Local web/API/workers stack | `PENDING INTEGRATION` | Paths agreed; compose file and apps not on this branch |
| REPLAY mode | `PENDING INTEGRATION` | Fixtures and design exist; UI/API not on this branch |
| NEAR testnet deployment | `BLOCKED_ON_HUMAN` | No accounts, faucet funds, token or hub deployed |
| OutLayer execution | `BLOCKED_ON_HUMAN` | No funded testnet execution or published MEND WASM |
| Sputnik DAO | `BLOCKED_ON_HUMAN` | No DAO, proposal or council |
| Agent Market job | `BLOCKED_ON_HUMAN` | No account, worker token or balance |
| 1Click live deposit | `BLOCKED_ON_HUMAN` | Mainnet only; no funds and no human approval |
| Hosted demo | `BLOCKED_ON_HUMAN` | No deployment credentials |

## Prerequisites

| Tool | Version / note |
|---|---|
| Node.js | `package.json` declares `>=22`; the current environment used Node 26. The NEAR AI verifier SDK requires `>=24.22.1`; bump the runtime or hand-roll verification. |
| npm | Workspaces; `npm ci` from the repository root |
| Docker (optional) | Only for the pending local stack |
| NEAR CLI | Use the syntax recorded in R0-D/R0-E for the current `near-cli-rs`; those commands were not executed |
| OutLayer CLI | See R0-B for publish/version flow; not executed |
| Playwright | Not resolvable in this worktree; see [15 — Capture plan](./15-demo-capture-plan.md) |
| ffmpeg | Not installed in this environment; see [15 — Capture plan](./15-demo-capture-plan.md) |

## Today: run the checks that exist

```bash
# 1. Install the frozen protocol workspace
npm ci

# 2. Run protocol tests → 4 files, 26 tests pass
npm test -w @mend/protocol

# 3. Typecheck the protocol
npm run typecheck -w @mend/protocol

# 4. Check documentation and relative links
node scripts/demo/check-docs.mjs

# 5. Check the REPLAY capture harness status (recording is pending)
node scripts/demo/capture-replay-demo.mjs
```

Expected results are recorded in the [root README](../README.md#do-x--see-y)
and in [16 — Integration evidence](./16-integration-evidence.md).

## Local stack (pending integration)

The intended one-command stack is:

```bash
# PENDING INTEGRATION — file does not exist on this branch yet
docker compose -f infra/docker-compose.yml up -d
```

It is expected to start Postgres, private object storage, the API, workers and the
web app. The compose file, environment example and service code are owned by the
Infrastructure, Backend, Frontend and Agents tracks. Do not claim this command
works until the orchestrator has merged those tracks and the clean-room test
passes.

Intended local URLs (verify against the integrated stack before publishing):

| Service | Intended URL |
|---|---|
| Web | `http://localhost:3000` |
| API health | `http://localhost:3001/health` |
| Postgres | local only, not exposed publicly |
| Object storage | local only, private bucket |

## Environment variables

Use server-only secrets. Never expose these in a browser bundle or commit them.
Names may change when `packages/config` lands; verify against the merged code.

| Variable | Purpose | Secret? | Notes |
|---|---|---|---|
| `MEND_MODE` | `REPLAY`, `LIVE_TESTNET` or `MAINNET` | No | Mainnet must never be the default |
| `NEAR_RPC_URL` | RPC endpoint | No | Separate testnet/mainnet values |
| `HUB_ACCOUNT_ID` | Deployed hub account | No | For example `mend-hub.testnet` in fixtures |
| `TOKEN_ACCOUNT_ID` | Settlement NEP-141 token | No | Testnet mock vs verified mainnet token |
| `DAO_ACCOUNT_ID` | Sputnik DAO account | No | Hub checks this exact account |
| `DATABASE_URL` | Postgres connection | **Yes** | Server only |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Private evidence storage | **Yes** | Private bucket; signed access |
| `NEARAI_API_KEY` | NEAR AI inference/signature | **Yes** | Server only; absent means `BLOCKED_ON_HUMAN` |
| `OUTLAYER_*` | OutLayer project/payment config | **Yes** | Only if the funded path is approved |
| `INTENTS_API_KEY` / partner JWT | 1Click authenticated quotes | **Yes** | Optional; disclose no-JWT fee if absent |
| `AGENT_MARKET_TOKEN` | `aat_...` worker token | **Yes** | Production marketplace, not testnet |
| `RELAYER_ACCOUNT_ID`, `RELAYER_PRIVATE_KEY` | NEP-366 relayer | **Yes** | Hot wallet; isolate and limit |
| `DEMO_DURABILITY_MINUTES` | Demo durability interval | No | Explicit configuration, not a hidden backdoor |
| `DEMO_RESET_TOKEN` | Reset only demo data | **Yes** | No production reset route |

## REPLAY mode

REPLAY exists so a judge can run every scenario with **no credentials**:

1. Start the integrated local stack (pending).
2. Select `REPLAY / SIMULATION`.
3. Choose scenario A–E: successful repair, failed durability, prompt injection,
   sponsorship uncertainty, judge replay.
4. All state comes from recorded artifacts.
5. Available signatures and hashes can be verified independently.
6. Every screen and capture shows `REPLAY / SIMULATION`.

REPLAY is an additional judging tool, not a substitute for the implemented
testnet/live integrations. See [13 — Demo script](./13-demo-script.md) and
[15 — Capture plan](./15-demo-capture-plan.md).

## Testnet deployment (blocked on human)

These steps require human-created accounts, faucet funds and explicit approval.
They have **not** been executed.

1. **Create accounts** for hub, test token, steward, sponsor, coordinator AI,
   reviewer AI, relayer, contractors A/B/C, inspectors 1/2. Keep human and agent
   accounts separate.
2. **Deploy the test token** (`contracts/test-token`) and label it
   `TEST VALUE ONLY`. Do not use a real stablecoin address on testnet.
3. **Deploy the hub** (`contracts/hub`) with
   `init(owner, token, dao, policy_hash, durability_minutes)`.
4. **Register storage**: the hub must be registered with the settlement token
   before any `ft_transfer_call`.
5. **Set roles**: steward, coordinator AI, reviewer AI, relayer; verify AI roles
   cannot award, accept, refund or release funds.
6. **Provision contractor/inspector sub-accounts** with function-call keys:
   explicit receiver, non-empty method list, finite allowance.
7. **Create/configure the Sputnik DAO** (`sputnikv2.testnet`) and record the
   council/threshold. Use a proposal that calls `dao_authorize` with the exact
   canonical JSON; the hub checks `predecessor == config.dao`.
8. **Publish the bid-rules WASM** to OutLayer as `mend.testnet/bid-rules`
   (`wasm32-wasip1`), pin the SHA-256, and record the version.
9. **Configure the indexer** and verify a rebuild from an empty database.
10. **Run the smoke lifecycle** with test value: report → cluster → policy →
    funding → bids → score → award → completion → 72/8 → durability.
11. **Record real transaction links** in `fixtures/demo/transactions.template.json`
    (copy the template; do not fabricate hashes).
12. **Run the adversarial suite** before any public demo.

Do not claim any step is complete until the transaction or contract state can be
inspected independently.

## Sputnik DAO notes

- Testnet factory: `sputnikv2.testnet`; DAO accounts are
  `<name>.sputnikv2.testnet`.
- Mainnet factory: `sputnik-dao.near`.
- `sputnik-dao.testnet` has no contract code; do not use it.
- Proposal IDs are decimal `u64`. `get_last_proposal_id()` is the next ID.
- Vote calls must echo the exact proposal kind; fetch it first.
- The bond must equal the policy bond exactly, not “at least 1 NEAR”.
- The hub trusts only `config.dao` as `predecessor`, not a view call.

## OutLayer notes

- Testnet contract: `outlayer.testnet`.
- Publish a hash-pinned `wasm32-wasip1` project and record the version hash.
- `request_execution` attaches NEAR; the callback is a private promise callback.
- The callback does not contain the TEE attestation. Fetch and verify it
  off-chain by transaction/request ID.
- Keep the JSON output under 900 bytes to avoid the large-output path.
- If OutLayer is unavailable, run the same WASM locally and label
  `LOCAL DETERMINISTIC — OUTLAYER UNAVAILABLE`.
- No funded execution exists yet: `BLOCKED_ON_HUMAN`.

## 1Click / Intents notes

- Base: `https://1click.chaindefuser.com`, API v0, **mainnet only**.
- There is no testnet. Do not pretend testnet sponsorship is Intents.
- Default to `dry: true`. A dry quote has no deposit address and is not a payment.
- Quote success does not prove the recipient has NEP-141 storage; check the
  account and `storage_balance_of` first.
- Statuses: `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`, `SUCCESS`,
  `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED`. There is no API `EXPIRED` status;
  expiry is client-side.
- Reconcile by `depositAddress`; build explorer links yourself because live
  `explorerUrl` values were empty.
- Verify quote signatures and reject a tampered recipient.
- A real deposit requires explicit human approval, a tiny amount and a recorded
  transaction link. Agents must never initiate it.

## Agent Market notes

- Base: `https://market.near.ai`, API `2.0.0`; worker token `aat_...`.
- It is a production marketplace, not testnet. 5% platform fee; USD/USDC balances.
- Worker API has no accept endpoint. A human/buyer accepts; auto-accept may occur
  after 3–7 days.
- Use redacted briefs only. Never send raw media or precise location.
- A live MEND job is `BLOCKED_ON_HUMAN` until an account, token and balance exist.
- Disclose any self-hire test; do not present it as independent reputation.

## Mainnet (real funds)

Mainnet is a separate profile, not a toggle:

- separate account, token, hub and web configuration;
- `MAINNET — REAL FUNDS` banner on every screen;
- no default selection, no silent fallback from testnet/replay;
- dry Intents quotes by default;
- a human reviews source asset, amount, fees, recipient and expected result
  before **every** transaction;
- tiny amount only; record the explorer link;
- agents never sign, deposit, deploy or post autonomously.

## Hosted deployment (blocked on human)

The Infrastructure track owns the deployment. Requirements:

- separate web/api/worker processes and managed Postgres;
- private object storage with signed access;
- secrets in a secret manager, not environment files in the image;
- TLS, security headers, rate limits and health checks;
- environment separation for replay/testnet/mainnet;
- indexer lag and transaction reconciliation alerts;
- no production reset route;
- accessibility and performance checks before public launch.

## Verification checklist after deployment

- [ ] `GET /health` returns healthy.
- [ ] The mode badge matches the configured mode.
- [ ] A replay screen cannot show a live transaction link.
- [ ] A dry quote is labelled `DRY QUOTE — NOT A PAYMENT`.
- [ ] The hub address and token address match the intended network.
- [ ] Agent keys have receiver, methods and allowance; no full-access key.
- [ ] The hub is registered with the token.
- [ ] The DAO account in the hub equals the DAO that will authorize.
- [ ] The indexer can rebuild from empty and produce the same public state.
- [ ] Evidence buckets are private; an unauthenticated request fails.
- [ ] No secret or private media appears in the browser bundle or logs.
- [ ] The canonical 100/80/72/8 lifecycle passes end-to-end.
- [ ] A failed durability inspection reopens the same work order with no new funds.
- [ ] The passport transfer attempt fails.

## Human gates

The following are not engineering tasks that an agent can complete alone:

- NEAR AI key and credits;
- OutLayer publication/funding;
- Agent Market account, email verification and token;
- Sputnik DAO accounts, council and permissions;
- testnet accounts and faucet funds;
- Intents partner JWT (optional) or no-JWT fee disclosure;
- mainnet account, tiny funds and per-transaction approval;
- deployment credentials and private object storage;
- real or transparently staged repair location, steward, repairer, inspector;
- media consent;
- public repository approval;
- human-published demo post;
- final submission fields and confirmation.

No agent may work around a missing item with fabricated evidence. Mark it
`BLOCKED_ON_HUMAN` and continue unrelated work.

---

[Docs index](./README.md) · [← Failure cases](./09-failure-cases.md) · [Next: limitations →](./11-limitations.md)

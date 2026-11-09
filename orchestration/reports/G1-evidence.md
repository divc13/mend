# G1 — Foundation verification evidence

Date: 2026-11-09
Orchestrator runs every command independently; worker text is not evidence.

## Infra — `track/infra` @ `5c2c3a3` (merged `79c87ec`)

Scope check: only `infra/`, `.github/`, `scripts/` changed. PASS.
`docker compose -f infra/docker-compose.yml config` → COMPOSE_OK.
`bash -n scripts/{dev,verify,deploy-testnet}.sh` → SCRIPTS_OK.
CI YAML parsed → CI_YAML_OK. No secrets found.

## Contracts — `track/contracts` @ `1187908` (merged `d619178`)

Scope check: only `contracts/` changed. PASS.
`cargo test --manifest-path contracts/Cargo.toml` → **hub 30 passed, test-token 5 passed, 0 failed**.
WASM: `mend_hub.wasm` 820,715 bytes; `mend_test_token.wasm` 303,029 bytes.
Invariant tests observed: failed durability reopens same WO; pause/unpause; OutLayer callback wrong winner/failed promise/wrong hash; reveal invisibility; score validation; DAO/role boundaries; premature acceptance; passport transfer disabled; no private URLs in public state.

## Payments — `track/payments` @ `ab784a2` (merged `7884d45`)

Scope check: only `packages/intents-client/` + `fixtures/payments/` (+ lockfile). PASS.
`npm test` → **99 passed (8 files)**; typecheck PASS.
Live read-only smoke: 216 tokens; dry quote 0.15 USDC → 0.149968; signature verified; no deposit address for dry; status SUCCESS; **no funds moved, nothing signed**.

## AI & Compute — `track/ai-compute` @ `b7546e6` (merged `7b54039`)

Scope check: only `compute/`, `packages/ai-client/`, `fixtures/` changed. PASS.
Rust: **12 passed**; WASM unknown + WASI builds PASS.
WASI sha256: `2d8e5adb069e19d46864dea6d5a1a2988e528df45828ac884856b5d1be44a3e3`
Unknown sha256: `4a38a7c13d3c1c1fbec30516ac76da423ce63502ed4f535097cf8e3b48c0f214`
TS: **41 passed, 1 skipped (live key)**; typecheck PASS; parity (B 9270, C 5200, A 2873) PASS; prompt-injection and privacy PASS.

## Docs & Demo — `track/docs-demo` @ `12053c5` (merged `a143142`)

Scope check: only `docs/`, `README.md`, `scripts/demo/`, `fixtures/demo/`. PASS.
`node scripts/demo/check-docs.mjs` → **PASS**, 25 files, 278 links, 29 anchors, submission description 1,049 chars, 119 HUMAN SUPPLIED placeholders. No fabricated city/partnership/safety claims.

## Backend — `track/backend` @ `5d2fcf2` (merged `fb8e36f`)

Scope check: only `apps/api/`, `packages/db/`, `services/indexer/` (+ lockfile). PASS.
Offline: API **24 passed, 1 skipped (Postgres)**; DB **9 passed, 5 skipped**; indexer **4 passed, 1 skipped**.
With real Postgres 16 (`DATABASE_URL`): migrations applied `001_init.sql`; DB **14 passed**; API **25 passed**. PASS.
Typecheck PASS.

## Agents & Governance — `track/agents` @ `429943d` (merged `79b1707`)

Scope check: only `packages/near-client/`, `services/{coordinator,contractor,inspector,agent-market-worker,dao-watcher,relayer}/`, `fixtures/agents/` (+ lockfile). PASS.
Tests: near-client **31**, coordinator **7**, contractor **8**, inspector **9**, agent-market **11**, dao-watcher **10**, relayer **14** → **90 passed, 0 failed**.

## Frontend — `track/frontend` @ `0a18915` (merged `5bc8671`)

Scope check: only `apps/web/`. PASS.
`npm run build` → **PASS**, all routes prerendered (home, cases, bids, inspector, sponsor, steward, dashboard, demo, trust, report). No browser secrets found.

## Main integration

`npm install` clean; protocol 26, AI 41 (+1 skip), Intents 99, API 25, DB 14, indexer 4, agents 90, web build PASS.
**G1: PASS.** Remaining: Quality suite (running), G2 vertical slice.

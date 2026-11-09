# R0-B — OutLayer validation (NEAR verifiable compute)

**Status:** COMPLETE for documentation, source, and read-only live testnet checks. No paid execution was performed.
**Access date:** 2026-11-09 (UTC)
**Scope:** OutLayer testnet/mainnet execution contracts, WASM publishing, request/callback ABI, payment, limits, TEE attestation, SDK/crates.
**Repo constraint:** This file is the only repo file created or modified.

**Confidence labels used below**

| Label | Meaning |
|---|---|
| **VERIFIED-LIVE** | Observed directly from a live endpoint or NEAR RPC on 2026-11-09. |
| **VERIFIED-SOURCE** | Read from the current canonical source/docs at the pinned commit listed in §13. |
| **UNVERIFIED** | Not empirically tested here, or sources disagree. Treat as an assumption to test. |
| **BLOCKED** | Requires funds, credentials, or a human approval. |

---

## 0. Decision summary

MEND can use OutLayer on NEAR testnet without an API key: a contract attaches NEAR to `request_execution` on `outlayer.testnet`, OutLayer executes a hash-pinned WASI binary in an Intel TDX worker, and **the caller's own NEAR promise callback receives the module's stdout as its return value**. There is no separate callback method to register and no OutLayer-specific `near-sdk` crate.

The exact integration is a **yield/resume promise chain**, not a webhook:

```text
MEND contract
  -> outlayer.testnet::request_execution(source, limits, input_data, ...)
       [attached NEAR deposit]
  -> OutLayer contract creates a yield and emits execution_requested
  -> TEE worker executes the WASM, stdout = output
  -> worker calls outlayer.testnet::resolve_execution(request_id, response)
  -> OutLayer resumes the yield; MEND's .then(...) callback runs
  -> MEND callback reads env::promise_result(0): JSON output, or b"null"
```

For MEND's bid scoring this is sufficient to bind **code hash + input hash + output hash + policy hash** on-chain. The TEE attestation is **not** in the on-chain callback; it must be fetched off-chain by transaction hash/request id and verified separately. That is the main design consequence.

**Recommended MEND path:** publish `mend.testnet/bid-rules` as a `wasm32-wasip1` project, pin every request to the version's SHA-256, use `response_format: "Json"`, keep output under 900 bytes (single-resume path), attach 0.003 NEAR for 5B instructions / 10 s, and reserve 25 Tgas for the MEND callback. Verify the TDX attestation off-chain before marking a score "TEE-attested".

---

## 1. Identity, networks, and exact URLs

| Role | Exact value | Status |
|---|---|---|
| Official website | `https://outlayer.ai` | VERIFIED-LIVE (search result + site) |
| Dashboard / docs | `https://app.outlayer.ai` | VERIFIED-LIVE |
| Docs path | `https://app.outlayer.ai/docs/...` | VERIFIED-LIVE |
| Mainnet HTTPS API | `https://api.outlayer.ai` | VERIFIED-LIVE |
| Testnet HTTPS API | `https://testnet-api.outlayer.ai` | VERIFIED-LIVE |
| OpenAPI spec | `https://api.outlayer.ai/openapi.json` (testnet mirror fetched: `https://testnet-api.outlayer.ai/openapi.json`) | VERIFIED-LIVE (testnet); mainnet path VERIFIED-SOURCE |
| NEAR mainnet contract | `outlayer.near` | VERIFIED-LIVE (RPC) |
| NEAR testnet contract | `outlayer.testnet` | VERIFIED-LIVE (RPC) |
| Mainnet worker/operator account | `worker.outlayer.near` | VERIFIED-LIVE (mainnet `get_config`) |
| Testnet worker/operator account | `worker.outlayer.testnet` | VERIFIED-LIVE (`get_config`) |
| Mainnet register contract | `worker.outlayer.near` | VERIFIED-SOURCE |
| Testnet register contract | `worker.outlayer.testnet` | VERIFIED-LIVE (`get_approved_measurements`) |
| Legacy site referenced by NEAR docs | `https://outlayer.fastnear.com` | VERIFIED-SOURCE (NEAR docs) |
| Canonical GitHub repo | `https://github.com/out-layer/outlayer` | VERIFIED-LIVE (HEAD `3079d756a0be19e09d1c81f52336528d2603c11b`, 2026-11-08) |
| Legacy GitHub path | `https://github.com/fastnear/near-outlayer` redirects to `out-layer/outlayer` | VERIFIED-LIVE (HTTP 301) |
| `outlayer.tech` | Not an OutLayer property. It returned HTTP 200 with a GoDaddy parking/forwarding CSP and is **not used**. | VERIFIED-LIVE (header check); do not use |

**Networks:** both mainnet and testnet are live. MEND should use **testnet only** for Wave 0–5 and for the demo.

| Network | Contract | API | Stablecoin token |
|---|---|---|---|
| Testnet | `outlayer.testnet` | `https://testnet-api.outlayer.ai` | `usdc.fakes.testnet` (VERIFIED-LIVE via `get_payment_token_contract`) |
| Mainnet | `outlayer.near` | `https://api.outlayer.ai` | stablecoin configured on mainnet contract (UNVERIFIED exact account here) |

**Auth/payment models (two separate products):**

1. **NEAR contract path (MEND uses this):** no API key. Authentication is the NEAR transaction signature. Payment is an attached NEAR deposit on `request_execution`; unused funds are refunded to `payer_account_id`.
2. **HTTPS API path:** `POST /call/{owner}/{project}` with `X-Payment-Key: owner:nonce:secret` and a prepaid stablecoin balance. Optional `X-Compute-Limit`, `X-Attached-Deposit`. This path is for web/mobile/backends, not for MEND's on-chain callback flow.

---

## 2. Live read-only evidence (2026-11-09)

No credentials, no payment key, no deposit, and no transaction were used.

### 2.1 Testnet API health

```bash
curl -sS https://testnet-api.outlayer.ai/health
# HTTP 200
{"status":"ok","version":"0.1.0","git_sha":"c73f3fea768b","built_at":1794150883}
```

`built_at` 1794150883 = `2026-11-08T15:14:43Z`. **VERIFIED-LIVE.**

Mainnet health for comparison:

```bash
curl -sS https://api.outlayer.ai/health
# HTTP 200
{"status":"ok","version":"0.1.0","git_sha":"451b270a070f","built_at":1792687231}
```

### 2.2 Public pricing (testnet)

```bash
curl -sS https://testnet-api.outlayer.ai/public/pricing
# HTTP 200
{
  "base_fee":"1000000000000000000000",
  "per_instruction_fee":"100000000000000",
  "per_ms_fee":"100000000000000000",
  "per_compile_ms_fee":"100000000000000000",
  "base_fee_usd":"1000",
  "per_instruction_fee_usd":"1",
  "per_sec_fee_usd":"1",
  "per_compile_ms_fee_usd":"10",
  "max_compilation_seconds":300,
  "max_instructions":500000000000,
  "max_execution_seconds":180
}
```

Note: the public field is `per_instruction_fee`, while the contract view returns `per_million_instructions_fee`. The contract value is the per-million rate; do not multiply twice. **VERIFIED-LIVE + VERIFIED-SOURCE.**

### 2.3 Testnet contract state

Queried with NEAR JSON-RPC `query` → `request_type: "call_function"`, `account_id: "outlayer.testnet"`, `finality: "final"`.

| View | Live result (2026-11-09) | Status |
|---|---|---|
| `is_paused` | `false` | VERIFIED-LIVE |
| `get_config` | `["owner.outlayer.testnet","worker.outlayer.testnet"]` | VERIFIED-LIVE |
| `get_max_limits` | `[500000000000, 180, 300]` = 500B instructions, 180 s execution, 300 s compilation | VERIFIED-LIVE |
| `get_event_metadata` | `["near-outlayer","1.0.0"]` | VERIFIED-LIVE |
| `get_payment_token_contract` | `"usdc.fakes.testnet"` | VERIFIED-LIVE |
| `get_pricing_full` | `base_fee=1000000000000000000000`, `per_million_instructions_fee=100000000000000`, `per_ms_fee=100000000000000000`, `per_compile_ms_fee=100000000000000000`, USD `1000 / 1 / 1 / 10` | VERIFIED-LIVE |
| `get_stats` | `[14569, "18352900755000000000000000"]` (contract counters: total executions, total fees; NEAR path only) | VERIFIED-LIVE |
| `estimate_execution_cost(1B, 128MB, 60s, input_len=0)` | `"7000100000000000000000"` = 0.0070001 NEAR | VERIFIED-LIVE |
| `estimate_execution_cost(5B, 128MB, 10s, input_len=8192)` | `"2000500000000000000000"` = 0.0020005 NEAR | VERIFIED-LIVE |
| `estimate_execution_cost(10B, 128MB, 15s, input_len=16384)` | `"2501000000000000000000"` = 0.002501 NEAR | VERIFIED-LIVE |
| account `outlayer.testnet` | `code_hash=8rRYysyHSZYxef6ke6XPe6yvGCLyGSsrqn8R8wzfeULn`, block 276903118 | VERIFIED-LIVE |
| account `outlayer.near` | `code_hash=5waWVnt6g3FZfjR6vfYXZzpAi3sZdFy8cK2sLz4EJQDt`, block 223749512 | VERIFIED-LIVE |

### 2.4 Live attestation schema (testnet, request 1)

```bash
curl -sS https://testnet-api.outlayer.ai/attestations/by-request/1
# HTTP 200
```

Field set observed (large `tdx_quote` abbreviated):

```json
{
  "id": 212,
  "task_id": 772,
  "task_type": "execute",
  "tdx_quote": "<base64 Intel TDX quote>",
  "worker_measurement": "7b5002bd...<96 hex chars>",
  "request_id": 1,
  "caller_account_id": "zavodil2.testnet",
  "transaction_hash": "66b7Nts4eRr1CUHSrimf1Vs54J1rTRQdTziFNgG8Y86U",
  "block_height": 231589909,
  "repo_url": "https://github.com/zavodil/oracle-ark",
  "commit_hash": "88b72003a06dc8d1972b39240e01aa9c0c7bbe24",
  "build_target": "wasm32-wasip2",
  "wasm_hash": "fbcf79fa87a363dabede6d6b139c20388d69719a605a999ad83ef0c26108e426",
  "input_hash": "dbada05d8af8dffa651506dc2feca5273fa9fc2de0808815644e9c05361af8ab",
  "output_hash": "04954b9bb406c5a6bca2c001dec4d12a4415409f75436ff3aa2fe6fbd0fc4dc5",
  "timestamp": 1768057938
}
```

Also verified:

- `GET /attestations/by-tx/66b7Nts4eRr1CUHSrimf1Vs54J1rTRQdTziFNgG8Y86U` returns the same record. **VERIFIED-LIVE.**
- `GET /public/stats` returned `total_executions=28854`, `active_workers=4`, `average_execution_time_ms=2899`. **VERIFIED-LIVE.**
- `worker.outlayer.testnet.get_approved_measurements` returned **121** approved 5-measurement sets. **VERIFIED-LIVE.**
- The historical sample's `worker_measurement` did **not** equal any `rtmr3` in the current 121-set list. This is consistent with measurement rotation/removal, but the exact reason is **UNVERIFIED**. Consequence: verify attestations promptly and store the verified result; a later viewer may not be able to re-verify an old execution against the current allowlist.

### 2.5 What was not tested

- No `request_execution` transaction was sent (would require a funded testnet account and spend).
- No WASM was published/deployed.
- No paid HTTPS `/call` was made.
- No `outlayer-verify` binary was installed/run.

So the **ABI and docs are verified; a real MEND-shaped execution is not yet empirically verified.** That is the one BLOCKED item.

---

## 3. Publishing and versioning a WASM function

### 3.1 Build target and shape

**VERIFIED-SOURCE** (`docs/wasi`, executor README, `contract/src/projects.rs`):

- Supported targets: `wasm32-wasip1` and `wasm32-wasip2`.
- P1 is a core module, entry `_start`, produced by a normal `fn main()`. It has stdin/stdout/stderr, env, clock, random; **no network and no OutLayer host interfaces**.
- P2 is a component, entry `wasi:cli/run`; supports `wasi:http` and OutLayer host interfaces (storage, RPC, VRF, etc.), **no files and no raw sockets**.
- The crate must be a binary: `[[bin]]` with `fn main()`, not `[lib]`.
- Input is read from **stdin**; output is written to **stdout**; stderr is for logs.
- Call `stdout().flush()` after writing.
- Output is JSON/UTF-8 for `response_format: "Json"`; text for `"Text"`; bytes/base64 for `"Bytes"`.

For MEND's pure scoring function, **P1 is the better choice**: no network, no secrets, smaller binary, simpler supply chain.

### 3.2 CLI publishing flow

**VERIFIED-SOURCE** (`docs/near-integration`, `docs/dev-guide`, FastFS workflow):

```bash
cargo build --target wasm32-wasip1 --release

# uploads the bytes, prints SHA256 and a FastFS URL:
# https://test.fastfs.io/<owner>/outlayer.testnet/<sha256>.wasm
outlayer upload target/wasm32-wasip1/release/mend_bid_rules.wasm

# creates the project or adds a version, activates it
outlayer deploy bid-rules https://test.fastfs.io/<owner>/outlayer.testnet/<sha256>.wasm
```

Testnet FastFS base observed in docs: `https://test.fastfs.io`; mainnet: `https://main.fastfs.io`. Any `https://` URL is accepted by `outlayer deploy`; FastFS is the default. **VERIFIED-SOURCE**, not re-tested by us.

### 3.3 On-chain project creation (exact contract methods)

**VERIFIED-SOURCE** (`contract/src/projects.rs`):

```rust
#[payable]
pub fn create_project(name: String, source: CodeSource);

#[payable]
pub fn add_version(project_name: String, source: CodeSource, set_active: bool);

pub fn set_active_version(project_name: String, version_key: String);

pub fn get_project(project_id: String) -> Option<ProjectView>;
pub fn get_version(project_id: String, version_key: String) -> Option<VersionView>;
pub fn list_versions(project_id: String, from_index: Option<u64>, limit: Option<u64>) -> Vec<VersionView>;
```

`CodeSource` JSON shapes:

```json
{"WasmUrl":{"url":"https://test.fastfs.io/mend.testnet/outlayer.testnet/<sha256>.wasm","hash":"<64 lowercase hex>","build_target":"wasm32-wasip1"}}
```

```json
{"GitHub":{"repo":"https://github.com/mend/...","commit":"<commit>","build_target":"wasm32-wasip1"}}
```

Rules verified in `assert_code_source()`:

- `hash` must be exactly 64 lowercase hex characters (SHA-256 of the exact WASM bytes).
- `url` must start with `https://`, be ≤2048 bytes, and contain no whitespace/control characters.
- `build_target` ≤64 bytes, `[A-Za-z0-9._-]`.
- Project ID is `"{predecessor_account_id}/{name}"`; name is 1–64 bytes of ASCII letters, digits, `-`, `_`.
- `create_project` and `add_version` are payable: attach the storage deposit; excess is refunded. Exact required deposit is computed by the contract (storage-price per byte); query or attach a margin (e.g. 0.05 NEAR) and let it refund.
- A version key is the WASM SHA-256 for `WasmUrl` (or `repo@commit` for `GitHub`). `version_key: null` means the project's active version.
- The worker refuses a downloaded file whose bytes do not hash to the requested hash.

**Important:** `create_project` takes `CodeSource`, not `ExecutionSource`; it has no `Project` variant. A project version is always a concrete `WasmUrl`/`GitHub` source.

### 3.4 Version/hash semantics for MEND

- Pin **`version_key` = code hash** in every scoring request. Do not use `null`/active in production, because the active version can be changed by the project owner.
- Store the same hash in MEND's `ScorePolicy`/`ScoringCode` registry **before** enabling a work order.
- Publish a reproducible build path and a `wasm_sha256` artifact. The attestation proves *which binary ran*, not that the binary matches the published source; reproducible builds close that gap. **VERIFIED-SOURCE** (trust docs explicitly state this limitation).

---

## 4. Invocation: `request_execution` exact schema

### 4.1 Contract method

**VERIFIED-SOURCE** (`contract/src/execution.rs`, `PROJECT.md`):

```rust
#[payable]
pub fn request_execution(
    source: ExecutionSource,
    resource_limits: Option<ResourceLimits>,
    input_data: Option<String>,
    secrets_ref: Option<SecretsReference>,
    response_format: Option<ResponseFormat>,
    payer_account_id: Option<AccountId>,
    params: Option<RequestParams>,
);
```

`ExecutionSource` variants:

```rust
Project { project_id: String, version_key: Option<String> }
WasmUrl { url: String, hash: String, build_target: Option<String> }
GitHub  { repo: String, commit: String, build_target: Option<String> } // builds off by default
```

`ResourceLimits`:

```rust
struct ResourceLimits {
    max_instructions: Option<u64>,      // default 1_000_000_000
    max_memory_mb: Option<u32>,         // default 128
    max_execution_seconds: Option<u64>, // default 60
}
```

`ResponseFormat`: `"Text"` (default) | `"Json"` | `"Bytes"`.

`SecretsReference`: `{ "profile": "default", "account_id": "alice.testnet" }`.

`RequestParams` (all optional): `force_rebuild`, `store_on_fastfs`, `compile_only`, `project_uuid` (ignored if caller supplies; contract sets it), `attached_usd` (Project source only), `use_bound_identity`.

### 4.2 Minimal MEND request JSON

`input_data` is a **JSON-encoded string**, not an object. In the example below it is shown escaped; in Rust use `serde_json::to_string(&input)?.`.

```json
{
  "source": {
    "Project": {
      "project_id": "mend.testnet/bid-rules",
      "version_key": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  },
  "resource_limits": {
    "max_instructions": 5000000000,
    "max_memory_mb": 128,
    "max_execution_seconds": 10
  },
  "input_data": "{\"schema\":\"mend.bid-rules.v1\",\"work_order_id\":\"wo-17\",\"policy_hash\":\"...\",\"bids\":[{\"bid_id\":\"b-1\",\"price_yocto\":\"2500000000000000000000000\",\"eta_seconds\":86400,\"warranty_days\":90}]}",
  "secrets_ref": null,
  "response_format": "Json",
  "payer_account_id": "alice.testnet",
  "params": null
}
```

### 4.3 near-sdk external interface

**VERIFIED-SOURCE** (`wasi-examples/PROXY_CONTRACTS_TUTORIAL.md`):

```rust
use near_sdk::{ext_contract, AccountId};

#[ext_contract(ext_outlayer)]
#[allow(dead_code)]
trait OutLayer {
    fn request_execution(
        &mut self,
        source: near_sdk::serde_json::Value,
        resource_limits: Option<near_sdk::serde_json::Value>,
        input_data: Option<String>,
        secrets_ref: Option<near_sdk::serde_json::Value>,
        response_format: Option<String>,
        payer_account_id: Option<AccountId>,
        params: Option<near_sdk::serde_json::Value>,
    );
}
```

Call pattern:

```rust
ext_outlayer::ext(outlayer_account)
    .with_attached_deposit(deposit)
    .with_unused_gas_weight(1)              // OutLayer gets all gas not reserved below
    .request_execution(source, Some(limits), Some(input_json), None, Some("Json".into()), Some(user), None)
    .then(
        ext_self::ext(env::current_account_id())
            .with_static_gas(Gas::from_tgas(25))
            .on_score_result(work_order_id, input_hash_hex, policy_hash_hex),
    )
```

**VERIFIED-SOURCE:** reserve 300 Tgas on the user's call to MEND; OutLayer itself reserves 50 Tgas minimum for its settlement callback, plus 25 MGas per input byte above 32 KB. The MEND callback is a fixed static gas reservation.

### 4.4 Deposit and gas

- The deposit must be **at least** `estimate_execution_cost(resource_limits, input_len)` plus storage for input beyond 32 KB. A request below that panics and is refused. **VERIFIED-SOURCE + VERIFIED-LIVE.**
- `estimate_execution_cost` is a view method; call it immediately before the transaction. Price can change.
- Cost formula (contract):
  `base_fee + (instructions / 1_000_000) * per_million_instructions_fee + time_ms * per_ms_fee`.
- Live testnet numbers:
  - base fee = `1_000_000_000_000_000_000_000` yocto = **0.001 NEAR**
  - per million instructions = `100_000_000_000_000` yocto = **0.0000000001 NEAR**
  - per ms = `100_000_000_000_000_000` yocto = **0.0000001 NEAR/ms** = 0.0001 NEAR/s
- 5B instructions + 10 s + 8 KB input = **0.0020005 NEAR** (live).
- Unused deposit is refunded to `payer_account_id`. If `payer_account_id` is omitted it defaults to the **predecessor** (the MEND contract), not the end user. **MEND must pass the user explicitly if the user should receive the refund.**
- Failed execution: contract source charges resources used and refunds the rest; the pricing page says failed executions are not refunded. This is a documentation conflict. **Use the contract source** (`resolve_execution` failure branch) and still budget for the base fee. **VERIFIED-SOURCE; docs conflict noted.**
- Compile-only mode: omit `resource_limits` or set `params.compile_only=true`; only the base fee is required, and no execution occurs. **Do not omit `resource_limits` for a scoring run** — a request without it runs nothing.

### 4.5 Deadlines, timeout, idempotency

**VERIFIED-SOURCE** (`EXECUTION_TIMEOUT = 600 * 1_000_000_000` ns = 10 minutes):

- A request still pending after 10 minutes can be cancelled by the **sender** via `cancel_stale_execution(request_id)`. The contract owner can emergency-cancel any pending request.
- There is **no idempotency key** in `request_execution`. Every call increments `next_request_id` and creates a new request. Duplicate submissions create duplicate executions and duplicate charges.
- Request IDs are monotonic `u64`; the on-chain callback does **not** receive the request ID. MEND must index the `execution_requested` event (which contains `request_id`) or query pending IDs.
- MEND must implement its own idempotency key:
  `execution_key = sha256(work_order_id || round || input_hash || code_hash || policy_hash)`.
  Store state `Requested`; a second request for the same key is rejected. In the callback, only settle if state is `Requested`; a duplicate callback sees `Settled` and is ignored.

---

## 5. Callback flow and authentication

### 5.1 Who calls whom

```text
MEND contract (account: mend.testnet)
  │  request_execution(...) + deposit
  ▼
outlayer.testnet
  │  promise_yield_create("on_execution_response", ...)
  │  emits execution_requested (NEP-297, near-outlayer/1.0.0)
  ▼
TEE worker (operator key on worker.outlayer.testnet)
  │  executes WASM, reads stdout
  │  resolve_execution(request_id, ExecutionResponse)
  ▼
outlayer.testnet::on_execution_response  [private]
  │  charges/refunds, emits execution_completed
  │  promise_yield_resume(data_id, serialized response)
  ▼
MEND contract's .then(...) callback
  │  env::promise_result(0) = output JSON, or b"null"
  ▼
MEND stores ScoreExecution / rejects
```

**Key point:** OutLayer does **not** call an arbitrary method on MEND. NEAR's yield/resume resumes the promise that MEND created. The MEND callback is therefore invoked by **MEND itself** as the callback receipt, with `predecessor == env::current_account_id()`. `#[private]` is the correct guard. **VERIFIED-SOURCE** (`execution.rs`, `PROXY_CONTRACTS_TUTORIAL.md`).

### 5.2 Exact OutLayer callback (internal)

**VERIFIED-SOURCE** (`contract/src/execution.rs`):

```rust
#[private]
pub fn on_execution_response(
    &mut self,
    request_id: u64,
    sender_id: AccountId,
    code_source: CodeSource,
    resource_limits: ResourceLimits,
    payment: U128,
    #[callback_result] response: Result<ExecutionResponse, PromiseError>,
) { ... }
```

It returns the output as **raw JSON bytes** via `env::value_return`:

- `Json` → the guest's JSON bytes, returned as-is.
- `Text` → that text as one JSON string.
- `Bytes` → base64 as one JSON string.
- No output / failed run / missing request → `null`.

For outputs over **1024 bytes**, the worker first calls `submit_execution_output` (or `submit_execution_output_and_resolve`) because `promise_yield_resume` has a 1024-byte payload limit; the callback then retrieves `pending_output` from contract state and still returns it to MEND. **VERIFIED-SOURCE** (`execution.rs` comments). MEND should stay under 900 bytes and avoid this path.

The worker→OutLayer `ExecutionResponse` (internal, not what MEND receives) is:

```json
{
  "success": true,
  "output": {"Json": {"schema": "mend.score.v1", "winner_bid_id": "b-003", "scores": [712, 690, 655]}},
  "error": null,
  "resources_used": {"instructions": 1234567, "time_ms": 45, "compile_time_ms": null},
  "compilation_note": null,
  "refund_usd": null
}
```

MEND receives only the inner output value (`{"schema":...}`), not this envelope. **VERIFIED-SOURCE** (`contract/src/lib.rs` `ExecutionResponse`/`ExecutionOutput`; `PROXY_CONTRACTS_TUTORIAL.md`).

### 5.3 MEND callback (recommended exact shape)

Do **not** accept the output as a function argument. Read the promise result and hash the exact bytes:

```rust
use near_sdk::{env, near, PromiseResult, Gas};
use near_sdk::serde_json;

#[near]
impl Contract {
    #[private]
    pub fn on_score_result(
        &mut self,
        work_order_id: u64,
        expected_input_hash: String, // 64 hex, computed before the call
        expected_policy_hash: String, // 64 hex, pinned at work-order creation
    ) {
        let bytes = match env::promise_result(0) {
            PromiseResult::Successful(b) => b,
            PromiseResult::Failed => {
                self.mark_score_failed(work_order_id, "outlayer_promise_failed");
                return;
            }
        };

        if bytes == b"null" {
            self.mark_score_failed(work_order_id, "outlayer_returned_null");
            return;
        }

        let output_hash = hex::encode(env::sha256(&bytes)); // bind exact bytes
        let output: ScoreOutput = match serde_json::from_slice(&bytes) {
            Ok(v) => v,
            Err(_) => { self.mark_score_failed(work_order_id, "bad_json"); return; }
        };

        // Re-check idempotency + eligibility + winner is max score.
        self.settle_score(work_order_id, output, output_hash, expected_input_hash, expected_policy_hash);
    }
}
```

`env::promise_result(0)` is the raw promise result. This is stronger than `#[callback_result]` for hash binding because it preserves the exact bytes that OutLayer returned. **VERIFIED-SOURCE** for the API; the exact MEND code is a design proposal (UNVERIFIED until compiled/tested).

### 5.4 NEP-297 events for the indexer

**VERIFIED-SOURCE** (`PROJECT.md`, `contract/src/events.rs`): the event standard is `near-outlayer`, version `1.0.0` (confirmed live via `get_event_metadata`). The request event looks like:

```json
{
  "standard": "near-outlayer",
  "version": "1.0.0",
  "event": "execution_requested",
  "data": [{
    "request_data": "{\"request_id\":12345,\"sender_id\":\"mend.testnet\",\"predecessor_id\":\"mend.testnet\",\"code_source\":{\"WasmUrl\":{\"url\":\"https://...\",\"hash\":\"...\",\"build_target\":\"wasm32-wasip1\"}},\"resource_limits\":{\"max_instructions\":5000000000,\"max_memory_mb\":128,\"max_execution_seconds\":10},\"input_data\":\"...\",\"input_data_in_state\":false,\"secrets_ref\":null,\"response_format\":\"Json\",\"payment\":\"2000500000000000000000\",\"attached_usd\":\"0\",\"timestamp\":1760000000000000000,\"compile_only\":false,\"force_rebuild\":false,\"store_on_fastfs\":false,\"use_bound_identity\":false,\"project_uuid\":\"p0000000000000001\",\"project_id\":\"mend.testnet/bid-rules\"}",
    "data_id": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "timestamp": 1760000000000000000
  }]
}
```

`request_data` is a **JSON string**, not a nested object; parse it twice. `request_id` is inside it. This is how MEND's indexer maps `tx_hash -> request_id` for `/attestations/by-request/{id}` and `cancel_stale_execution(request_id)`.

`execution_completed` is emitted on settlement with `sender_id`, `code_source`, `resources_used`, `success`, `error_message`, `payment_charged`, `payment_refunded`, `compilation_note`, `timestamp`. **VERIFIED-SOURCE.**

### 5.5 What is authenticated, and what is not

| Question | Answer | Status |
|---|---|---|
| Who can invoke MEND's callback? | Only MEND itself, via the promise chain; `#[private]` enforces `predecessor == current_account`. | VERIFIED-SOURCE |
| Can an external account forge the output argument? | No, if the callback takes no output argument and reads `env::promise_result(0)`. | VERIFIED-SOURCE / design |
| Who resolves the OutLayer yield? | `worker.outlayer.testnet` (operator), using a registered function-call key scoped to `resolve_execution`, `submit_execution_output_and_resolve`, `resume_topup`, `resume_delete_payment_key`. | VERIFIED-SOURCE |
| Does the callback prove TEE execution? | **No.** It proves OutLayer's contract returned these bytes. The TDX attestation is separate. | VERIFIED-SOURCE |
| Does the callback include request_id / attestation / resources? | **No.** Only the output (or null). | VERIFIED-SOURCE |
| How does MEND bind code/input/output/policy? | Code hash pinned in the request and registry; input hash computed by MEND; output hash computed from callback bytes; policy hash pinned at work-order creation. Attestation fetched off-chain by tx hash. | Design decision |

### 5.6 Operator trust boundary

`resolve_execution` asserts `predecessor == operator_id` (`worker.outlayer.testnet` on testnet). Registered TEE workers hold scoped function-call keys on that account. The contract does **not** independently verify a TDX quote per execution; the attestation is produced and published by the worker/coordinator, and verified off-chain. So the on-chain guarantee is "OutLayer's operator account resolved this request", not "Intel hardware proved it" unless MEND verifies the attestation. **VERIFIED-SOURCE** (`resolve_execution`, `WORKER_ATTESTATION.md`). This is the main trust assumption MEND must document.

---

## 6. Limits and WASM constraints

### 6.1 Contract-enforced request limits (authoritative)

**VERIFIED-LIVE + VERIFIED-SOURCE:**

| Limit | Value | Notes |
|---|---|---|
| `MAX_INSTRUCTIONS` | 500,000,000,000 (500B) | Request above it panics. |
| `MAX_EXECUTION_SECONDS` | 180 s | Request above it panics. |
| `MAX_MEMORY_MB` | 4096 MB | Wasm32 bound. |
| `MAX_COMPILATION_SECONDS` | 300 s | Builds only. |
| Default instructions | 1B | If omitted. |
| Default memory | 128 MB | If omitted; worker source clamps actual runtime to **1024–4096 MB** (see below). |
| Default execution | 60 s | If omitted. |
| Input free storage | 32 KB | Above that, 0.00001 NEAR/byte held while pending, returned at settlement. |
| Input event threshold | 10 KB | Above that, input is stored in contract state, not the event log. |

### 6.2 WASM artifact constraints

| Constraint | Value / rule | Status |
|---|---|---|
| Targets | `wasm32-wasip1` (core module, `_start`) or `wasm32-wasip2` (component, `wasi:cli/run`) | VERIFIED-SOURCE |
| Crate shape | `[[bin]]`, `fn main()`, not `[lib]` | VERIFIED-SOURCE |
| I/O | JSON on stdin; result on stdout; flush stdout; stderr for logs | VERIFIED-SOURCE |
| Max WASM size | 10 MiB (`MAX_WASM_SIZE_BYTES = 10 * 1024 * 1024` in the worker compiler/download path; no separate per-file cap found for direct `WasmUrl` downloads) | VERIFIED-SOURCE; deployed parity UNVERIFIED |
| Stdout capacity | 10 MiB (`DEFAULT_MAX_OUTPUT_BYTES`) | VERIFIED-SOURCE |
| Single-resume output | ≤1024 bytes; above that worker uses the 2-call storage flow | VERIFIED-SOURCE |
| Docs recommendation | ≤900 bytes, to stay safely under the callback/explorer limit | VERIFIED-SOURCE (docs); not a contract assertion |
| Runtime | wasmtime 28 (`worker/Cargo.toml`), component model for P2 | VERIFIED-SOURCE |
| P1 network/files | No network, no host interfaces, no preopened files | VERIFIED-SOURCE |
| P2 network/files | HTTP only via `wasi:http` with outbound allowlist and egress audit; no raw TCP/UDP/DNS; no files | VERIFIED-SOURCE |
| Memory floor | Worker clamps requested `max_memory_mb` to `[1024, 4096]` MB | VERIFIED-SOURCE; live/deployed parity UNVERIFIED |
| Determinism | OutLayer does not make the code deterministic; the WASM must avoid randomness/time/network/env for MEND scoring. | Design requirement |

**Docs conflict:** `app.outlayer.ai/docs/wasi` still says "Max Instructions: 100 billion" and "Max Execution Time: 60 seconds". The live contract and the newer pricing page say 500B / 180 s. **Use the live contract values (500B / 180 s).**

**Docs conflict:** `docs/wasi` says output must be ≤900 bytes "(NEAR Protocol limit)". The contract supports larger outputs via the 2-call flow and a 10 MiB stdout cap. The 1024-byte resume payload is the real single-call boundary. **Use <900 bytes as MEND's engineering budget; it is the safe recommendation.**

**Memory note:** requesting `max_memory_mb: 128` does not mean the guest is capped at 128 MB in the current worker source; it is clamped **up** to 1024 MB. Do not rely on 128 MB as a security boundary. For MEND this only affects resource accounting, not correctness.

---

## 7. TEE attestation: what it proves and how MEND verifies it

### 7.1 Record

**VERIFIED-LIVE schema** (see §2.4). The record contains:

`id`, `task_id`, `task_type`, `tdx_quote`, `worker_measurement`, `request_id`, `caller_account_id`, `transaction_hash`, `block_height`, `repo_url`, `commit_hash`, `build_target`, `wasm_hash`, `input_hash`, `output_hash`, `timestamp`.

It does **not** contain `policy_hash`, the raw input/output, or MEND's work-order id. MEND must bind those itself.

### 7.2 Task hash

**VERIFIED-SOURCE** (`WORKER_ATTESTATION.md`):

```text
report_data[0..32] = SHA-256(
  task_type || task_id || repo || commit || build_target || wasm_hash ||
  input_hash || output_hash || block_height || caller_account_id ||
  project_id || secrets_ref || timestamp || attached_usd
)
report_data[32..64] = 0
```

Absent optional fields are skipped; integers are little-endian. This is what prevents an Intel-signed quote from being reused for a different run.

### 7.3 Verification options

1. **`outlayer-verify` (recommended, open source, Apache-2.0):**
   ```bash
   cargo install --git https://github.com/out-layer/outlayer-verify outlayer-verify
   outlayer-verify tx <near-tx-hash>
   # request-id form (docs example): outlayer-verify job <request_id> --network testnet
   outlayer-verify bundle proof.json --offline
   ```
   It checks the Intel DCAP signature chain, all 5 measurements against the on-chain allowlist, and recomputes the task hash from the on-chain request/response. It needs no account, API key, or payment. **VERIFIED-SOURCE (docs); not installed/run here.**

2. **Manual/API checks:**
   - `GET /attestations/by-tx/{tx_hash}` (or `/by-request/{request_id}`, `/by-call/{call_id}`).
   - `GET /public/collateral?fmspc=<fmspc>&at=<time>` for archived Intel collateral.
   - `worker.outlayer.testnet.is_measurements_approved({mrtd,rtmr0,rtmr1,rtmr2,rtmr3})`.
   - Verify the quote signature chain with Intel DCAP; recompute the task hash.

### 7.4 Limits of the proof (must be shown in MEND UI)

**VERIFIED-SOURCE** (trust docs):

- It proves **which binary ran with which input/output**, not that the binary's logic is correct or honest.
- It does **not** prove the binary was built from the published source; that needs a reproducible build and a published digest-to-commit map.
- The coordinator is closed source; it is trusted for task routing/payment accounting but cannot forge a TDX quote.
- Operator governance can approve measurements, upgrade contracts, and censor execution at this stage.
- Historical attestations may become unverifiable if the approved measurement set is later removed; verify promptly and store the verified artifact.

---

## 8. SDKs, crates, and examples

| Artifact | Version / ref | Status |
|---|---|---|
| OutLayer contract crate | `near-sdk = 5.9.0` (`contract/Cargo.toml`) | VERIFIED-SOURCE |
| Proxy contract example | `near-sdk = 5.9.0`, Rust 1.85.0, `cargo near build` | VERIFIED-SOURCE (`PROXY_CONTRACTS_TUTORIAL.md`) |
| Guest SDK crate `outlayer` | **0.2.1** on crates.io (published 2026-10-16); repo `sdk/outlayer/Cargo.toml` is **0.2.2** | VERIFIED-LIVE (crates.io) + VERIFIED-SOURCE |
| CLI `outlayer-cli` | **0.2.2** on crates.io (published 2026-11-07) | VERIFIED-LIVE |
| TypeScript SDK `@outlayer/sdk` | **0.1.0-alpha.4** on npm (last modified 2026-06-02) | VERIFIED-LIVE |
| `outlayer-verify` | `github.com/out-layer/outlayer-verify`, Apache-2.0 | VERIFIED-SOURCE; not run |
| Guest runtime | wasmtime **28** | VERIFIED-SOURCE |
| Repo HEAD | `3079d756a0be19e09d1c81f52336528d2603c11b` (2026-11-08) | VERIFIED-LIVE |

**Is there a `near-sdk` integration crate?** No dedicated one. The integration is plain `near-sdk` `Promise`/`ext_contract` plus a `#[private]` callback. The `outlayer` crate is for the **guest WASI module**, not for the NEAR calling contract. **VERIFIED-SOURCE.**

Useful examples in the repo:

- `wasi-examples/PROXY_CONTRACTS_TUTORIAL.md` — complete coin-flip proxy; exact `ext_contract`, gas/deposit, callback typing, error handling.
- `wasi-examples/random-example/` — guest module (submodule contents may not be in a shallow clone; tutorial contains the code).
- `wasi-examples/private-dao-example/` — advanced P1 privacy/voting.
- `wasi-examples/test-storage-ark/relay-contract/` — relay that returns a refused deposit.

---

## 9. Concrete MEND implementation decisions

### 9.1 Network, project, and code pinning

- Use **testnet only** for now: `outlayer.testnet`, API `https://testnet-api.outlayer.ai`.
- Publish project `mend.testnet/bid-rules` with a concrete `WasmUrl` source on FastFS.
- Build target: **`wasm32-wasip1`** (no network, no secrets, smaller artifact).
- Pin `version_key` to the **SHA-256 code hash** on every request. Store that hash in the MEND `ScoringCode` registry and in every `ScoreExecution`.
- Do not use the active-version shortcut (`version_key: null`) in production; it can change under a work order.
- Publish a reproducible build script and record the toolchain image + `wasm_sha256`. Treat "attestation proves the binary" and "binary matches source" as two separate claims.

### 9.2 Canonical scoring input (must be byte-stable)

Proposed schema (all integers as decimal strings; no floats; keys sorted; UTF-8; no whitespace):

```json
{
  "schema": "mend.bid-rules.v1",
  "work_order_id": "wo-17",
  "policy_hash": "<64 hex>",
  "policy": {
    "price_weight_bp": 5000,
    "eta_weight_bp": 3000,
    "warranty_weight_bp": 2000,
    "max_eta_seconds": 604800,
    "min_warranty_days": 30
  },
  "bids": [
    {
      "bid_id": "b-001",
      "contractor": "alice.testnet",
      "price_yocto": "2500000000000000000000000",
      "eta_seconds": 86400,
      "warranty_days": 90,
      "eligible": true
    }
  ],
  "tie_break": "lowest_bid_id_lexicographic"
}
```

Rules:

- Sort bids by `bid_id` ascending before serialization; the same bid set must always produce the same bytes.
- Cap eligible bids at **16** and input at **16 KB** (well under the 32 KB free storage limit). Reject larger work orders or paginate/score in rounds.
- Hash the **exact bytes** passed as `input_data`: `sha256(canonical_json_utf8)`.
- Store `input_hash`, `input_len`, and a pointer to the on-chain bid snapshot. Do not rely on an off-chain JSON re-serialization at verification time.

### 9.3 Canonical scoring output (keep under 900 bytes)

```json
{
  "schema": "mend.score.v1",
  "winner_bid_id": "b-003",
  "scores": [712, 690, 655, 640],
  "ranking_hash": "<optional 64 hex>"
}
```

- `scores` are in the canonical bid order (same order as input), as integers.
- Include `winner_bid_id` so the contract can check eligibility without trusting an index.
- If 16 scores would exceed 900 bytes, emit only the top 5 plus `ranking_hash`; alternatively cap at 16 with compact integer arrays. **Design target: <900 bytes, <1024 bytes hard single-resume limit.**
- The contract must verify: winner is in the input bid set; winner is eligible; winner's score is the maximum; no duplicate `bid_id`.
- If the output is malformed or the winner check fails, mark the score failed; do **not** award.

### 9.4 Request flow in the MEND hub contract

```text
request_score(work_order_id):
  1. require work order is in BiddingClosed/Scoring state and caller is authorized
  2. load frozen revealed bids + policy hash + code hash
  3. build canonical input bytes; assert len <= 16 KB and bids <= 16
  4. input_hash = sha256(input_bytes); execution_key = sha256(wo || round || input_hash || code_hash || policy_hash)
  5. require ScoreState[execution_key] does not exist; set Requested
  6. deposit = outlayer.estimate_execution_cost(limits, input_len) + margin
     (live testnet: 0.0020005 NEAR for 5B/10s/8KB; attach 0.003 NEAR)
  7. ext_outlayer.request_execution(
       source = Project { project_id: "mend.testnet/bid-rules", version_key: code_hash },
       resource_limits = { max_instructions: 5_000_000_000, max_memory_mb: 128, max_execution_seconds: 10 },
       input_data = input_bytes_as_string,
       secrets_ref = None,
       response_format = "Json",
       payer_account_id = user_who_paid,
       params = None
     ).with_attached_deposit(deposit).with_unused_gas_weight(1)
      .then(on_score_result(work_order_id, input_hash, policy_hash))
  8. emit ScoreRequested(execution_key, input_hash, code_hash, policy_hash, tx context)
```

Gas: user attaches **300 Tgas** to `request_score`; MEND reserves **25 Tgas** for `on_score_result`; `.with_unused_gas_weight(1)` gives OutLayer the rest. OutLayer reserves its own 50 Tgas settlement callback.

### 9.5 Callback flow in the MEND hub contract

```text
on_score_result(work_order_id, expected_input_hash, expected_policy_hash):
  1. #[private] — only self-call
  2. bytes = env::promise_result(0); Failed -> mark failed
  3. bytes == b"null" -> mark failed (OutLayer run failed/produced nothing)
  4. output_hash = sha256(bytes); parse ScoreOutput
  5. load ScoreState by execution_key; require Requested (idempotency)
  6. verify winner_bid_id exists, is eligible, and has max score
  7. store ScoreExecution {
       work_order_id, round,
       code_hash, input_hash, output_hash, policy_hash,
       output_bytes_hash = output_hash,
       execution_mode = "outlayer",
       attestation_status = "pending",
       created_at
     }
  8. state = Settled; emit ScoreSettled
```

Do **not** put the output JSON in a function argument. Do **not** trust a relayer-supplied output. The only trusted output is `promise_result(0)`.

### 9.6 Indexer and attestation verifier

- Subscribe to OutLayer `execution_requested` / `execution_completed` events (NEP-297 standard `near-outlayer`, version `1.0.0`).
- From the request event, parse `request_data.request_id` and store `tx_hash -> request_id`, `execution_key -> request_id`, `code_hash`, `input_hash`.
- After settlement, the verifier calls `GET /attestations/by-tx/{tx_hash}` or `/by-request/{request_id}`.
- Compare **exactly**:
  - `wasm_hash == ScoreExecution.code_hash`
  - `input_hash == ScoreExecution.input_hash`
  - `output_hash == ScoreExecution.output_hash`
  - `build_target == "wasm32-wasip1"`
- Verify the TDX quote with `outlayer-verify tx <tx_hash>` (or `outlayer-verify job <request_id> --network testnet`), or implement DCAP verification; check `worker_measurement`/5 measurements against `worker.outlayer.testnet.is_measurements_approved`.
- Store on-chain: `attestation_verified = true`, `attestation_hash = sha256(canonical attestation record)`, `tdx_quote_hash`, `worker_measurement`, `verified_at`, `verifier`. Keep the full `proof.json` in the evidence package.
- Until this succeeds, UI label is **"Score computed; TEE attestation pending"**, not "verified".

### 9.7 Timeout / cancellation

- MEND stores `requested_at`. If no callback after the user-configured deadline (e.g. 120 s), mark `ScoringTimedOut` but **do not award**.
- After OutLayer's 10-minute `EXECUTION_TIMEOUT`, MEND (the sender) can call `cancel_stale_execution(request_id)`. This requires the indexed `request_id`; the contract cannot derive it from the callback.
- If cancellation succeeds, the deposit is refunded per OutLayer's rules. Then MEND may enter the fallback path **only via an explicit governance/feature flag** (see §10). Never silently substitute an unattested result.

### 9.8 MEND limits to configure

| Setting | MEND value | Reason |
|---|---|---|
| Eligible bids per work order | 16 | Keeps canonical input <16 KB and output <900 bytes. |
| Input size | ≤16 KB | Below OutLayer's 32 KB free-storage threshold. |
| `max_instructions` | 5,000,000,000 | Far above a 16-bid integer sort; required deposit 0.0020005 NEAR at 10 s. |
| `max_memory_mb` | 128 (actual runtime floor 1024) | No cost impact; note the floor. |
| `max_execution_seconds` | 10 | Scoring should run in <1 s; 10 s is ample and keeps deposit low. |
| Attached deposit | 0.003 NEAR | Estimate 0.0020005 + margin; excess refunded. |
| Callback gas | 25 Tgas | Hash + parse + storage writes. |
| User gas | 300 Tgas | Docs/proxy recommendation. |
| Output size | <900 bytes | Avoid 2-call large-output path. |
| Secrets | none | Scoring must not depend on secrets. |
| `attached_usd` | none | MEND's own project is unpriced; omit. |
| `response_format` | `"Json"` | Contract parses structured output. |

### 9.9 Tests required before calling this done

1. **Golden vectors:** same canonical input → same bytes → same score/winner, 100+ cases, including ties and ineligible bids.
2. **Hash mismatch:** wrong `code_hash` in the request → OutLayer refuses; MEND marks failed.
3. **Modified input:** change one byte of `input_data` → `input_hash` mismatch vs attestation; MEND rejects.
4. **Modified output:** change one byte of output → `output_hash` mismatch; MEND rejects.
5. **Stale execution:** no callback, cancel after 10 min, no award.
6. **Duplicate callback:** second callback ignored; one `ScoreExecution`.
7. **Attestation:** live testnet execution, fetch by-tx, verify hashes/quote, record verified.
8. **Fallback:** force OutLayer disabled, run on-chain native or quorum path, label correctly, same winner on the golden vectors.
9. **UI:** show execution mode and attestation status; never show "TEE verified" for an unattested run.

---

## 10. Fallback plan if OutLayer is unavailable

OutLayer is a third-party dependency. MEND must still produce a deterministic, auditable winner when OutLayer is down, paused, censoring, or refusing a request. The fallback must be **explicitly labeled** and must never be silently substituted.

### 10.1 Mode A (preferred fallback): on-chain native scoring

- Implement the same `bid-rules` algorithm as a pure Rust function inside `contracts/hub` (near-sdk), compiled into the hub contract.
- Constraints: ≤16 eligible bids, integer-only arithmetic, no floats, no external calls, bounded loops. A 16-element sort/score is expected to fit in 300 Tgas, but this must be measured with a 16-bid fixture before relying on it.
- The contract computes `input_hash` and `output_hash` itself; anyone can replay from on-chain bids/policy.
- Store `execution_mode = "onchain_native"`, `outlayer_attestation = null`.
- This is deterministic and verifiable (source + on-chain state), but it is **not TEE-attested** and not an OutLayer execution.
- UI label: **"On-chain native scoring (no TEE attestation)"**.

### 10.2 Mode B: off-chain reproducible runner + quorum

Use only if on-chain native scoring is not feasible (e.g. larger bid sets):

- Run the **same WASM** in a pinned Docker image / local wasmtime, not an LLM.
- Three independent operators (MEND relayer + two verifiers, or DAO-appointed) each publish `sha256(output)`.
- Contract accepts only **2-of-3 matching output hashes**; mismatches open a dispute and no award.
- Store `execution_mode = "offchain_quorum"`, `attestation_status = "unattested"`, the three signer accounts, and the output hash.
- UI label: **"Off-chain quorum (unattested)"** with a warning that this is weaker than a TEE proof.
- This is deterministic if the runner/inputs are pinned, but it relies on operator honesty/collusion resistance, not hardware.

### 10.3 Mode C: recorded replay (demo only)

- For fixtures and clean-room demos, replay a recorded OutLayer response from `fixtures/recorded-responses/`.
- Store `execution_mode = "replay"`, `source = "fixture:<id>"`, and the original attestation hash if available.
- UI label: **"Replay fixture — not a live execution"**.
- Never allow replay mode to settle real escrow or award a live work order.

### 10.4 Switching rules

- `scoring_mode` is a contract config: `Outlayer | OnchainNative | OffchainQuorum | Replay`.
- Only the owner/DAO can change it; emit `ScoringModeChanged(old, new, reason, evidence_hash)`.
- Automatic fallback is **not** allowed. A timeout marks the work order `ScoringUnavailable`; a human/DAO action selects the fallback and records why.
- Every `ScoreExecution` stores `execution_mode` and `attestation_status`, so the UI and audit trail can distinguish:
  - `outlayer` + `verified` → strongest
  - `outlayer` + `pending` → computed, not yet proven
  - `onchain_native` → deterministic, no TEE
  - `offchain_quorum` → deterministic under quorum assumptions
  - `replay` → demo only

---

## 11. Risks and blockers

### Blockers

1. **No funded testnet execution was performed.** Full end-to-end verification (publish WASM, call `request_execution`, receive callback, fetch attestation) is **BLOCKED** on a funded `mend.testnet` account and a small NEAR deposit. This agent used no funds.
2. **No OutLayer credentials/payment key** were used or created (correctly, per constraints). The HTTPS `/call` path remains untested.
3. **Reproducible build not yet produced.** Need a pinned toolchain/Docker build and a published `wasm_sha256` before MEND can claim "this binary is my source".

### Risks

1. **Third-party availability/censorship.** OutLayer can pause, refuse, or disappear. The fallback plan is mandatory, and the UI must show which mode ran.
2. **On-chain callback does not carry the attestation or request_id.** MEND needs an indexer + verifier; a callback alone is not proof of TEE execution. Delaying verification risks measurement rotation.
3. **Measurement rotation.** The live testnet allowlist had 121 sets; a historical sample's `worker_measurement` did not match the current list. Verify promptly and pin the verified artifact.
4. **Docs drift.** Docs disagree on 100B vs 500B instructions, 60 s vs 180 s, and refunds for failed runs. The contract is the source of truth; re-query `get_max_limits`/`get_pricing_full` before launch.
5. **Memory floor surprise.** The worker source clamps `max_memory_mb` up to 1024 MB. Do not treat 128 MB as a hard isolation boundary. Deployed parity is UNVERIFIED.
6. **Output size.** >1024 bytes takes the 2-call large-output path; >900 bytes is documented as risky/truncated in explorers. Keep MEND output compact and test the exact size.
7. **Idempotency is MEND's job.** OutLayer has no idempotency key; duplicate calls cost money. The contract must enforce a local `execution_key`.
8. **Operator account trust.** `resolve_execution` trusts `worker.outlayer.testnet` and its scoped keys. The TEE attestation is the only hardware proof; verify it or label the result unattested.
9. **Mainnet governance.** At this stage OutLayer's owner can approve measurements/upgrade contracts by key. This is documented by OutLayer; MEND should not treat testnet behavior as a mainnet security guarantee without review.
10. **Testnet stability.** Public stats showed 4 active workers and ~2.9 s average execution; testnet availability is not an SLA. Add retries/timeouts and the fallback.

---

## 12. Open questions / UNVERIFIED items

- Does the deployed testnet worker enforce the same 1024 MB memory floor and 10 MiB WASM cap as the current `main` source? **UNVERIFIED.**
- Is `worker_measurement` exactly RTMR3, or a composite? The docs call it RTMR3; the historical sample did not match current RTMR3 sets. **UNVERIFIED interpretation.**
- What is the exact `output_hash` preimage for `Text`/`Bytes` vs `Json`? For `Json` it is the exact stdout bytes; docs say SHA-256 of output. MEND only uses `Json` and hashes the returned bytes. **VERIFIED-SOURCE for Json; not independently recomputed for Text/Bytes.**
- Does the 2-call large-output path change the `output_hash` or callback bytes? It should return the same output; not tested. MEND avoids it.
- Mainnet stablecoin contract address. **UNVERIFIED** (not needed for testnet).
- Exact `outlayer-verify` release version/compatibility. **UNVERIFIED**; pin a commit/tag when adopting.
- Whether `get_version`/`list_versions` expose the full source URL and hash as expected on testnet for a MEND-owned project. **UNVERIFIED** until MEND publishes.

---

## 13. Sources (accessed 2026-11-09 UTC)

| ID | Source | What it was used for |
|---|---|---|
| S1 | https://docs.near.org/primitives/off-chain-compute/outlayer | Official NEAR docs pointer; confirms OutLayer is FastNEAR-built, TDX, WASI P1/P2, repo link. |
| S2 | https://app.outlayer.ai/docs/near-integration | `request_execution` parameters, source variants, resource limits, callback semantics, FastFS workflow, pricing/refund summary. |
| S3 | https://app.outlayer.ai/docs/wasi | WASI P1/P2, critical requirements, 900-byte output recommendation, stale 100B/60s claims. |
| S4 | https://app.outlayer.ai/docs/pricing | Pricing formula, 500B/180s limits, refund wording conflict. |
| S5 | https://app.outlayer.ai/docs/trust-verification | Attestation verification workflow, 5 measurements, `outlayer-verify`, proof limits. |
| S6 | https://app.outlayer.ai/docs/dev-guide and /docs/https-api | Publish/run flow; HTTP API base URLs, payment keys, sync/async. |
| S7 | https://github.com/out-layer/outlayer (HEAD `3079d756a0be19e09d1c81f52336528d2603c11b`, 2026-11-08) | Canonical repo; all contract/worker source below. |
| S8 | `contract/src/execution.rs` | `request_execution`, yield/resume, `on_execution_response`, operator-only `resolve_execution`, refunds, 1024-byte output comments. |
| S9 | `contract/src/lib.rs` | `ExecutionSource`, `ResourceLimits`, `ExecutionResponse`, hard caps, cost formula, 50 Tgas / 25 MGas per input byte. |
| S10 | `contract/src/projects.rs` | `create_project`, `add_version`, version key = hash, source validation, storage deposits. |
| S11 | `contract/src/views.rs` | `estimate_execution_cost`, `get_pricing_full`, `get_max_limits`, `is_paused`, `get_config`. |
| S12 | `worker/src/executor/mod.rs` and `worker/src/executor/README.md` | wasmtime 28, P1/P2 behavior, 1024 MB memory floor, 10 MiB stdout cap. |
| S13 | `worker/src/compiler/mod.rs` | 10 MiB max WASM size. |
| S14 | `WORKER_ATTESTATION.md` | Task-hash preimage, worker registration, scoped keys, attestation limits. |
| S15 | `wasi-examples/PROXY_CONTRACTS_TUTORIAL.md` | Exact near-sdk `ext_contract`, callback typing, gas/deposit, error handling. |
| S16 | `API.md` | API base URLs, auth headers, public read endpoints, OpenAPI/TypeScript SDK links. |
| S17 | https://testnet-api.outlayer.ai/health | Live testnet health: 200, version `0.1.0`, git `c73f3fea768b`. |
| S18 | https://testnet-api.outlayer.ai/public/pricing | Live testnet pricing/limits. |
| S19 | https://testnet-api.outlayer.ai/public/stats | Live testnet total executions/active workers. |
| S20 | https://testnet-api.outlayer.ai/attestations/by-request/1 and /by-tx/66b7... | Live attestation schema and by-tx parity. |
| S21 | NEAR RPC `https://rpc.testnet.near.org` | Live `outlayer.testnet` views: pricing, limits, pause, config, event metadata, payment token, estimates, code hash. |
| S22 | NEAR RPC `https://rpc.mainnet.near.org` | Mainnet parity check: pricing/limits/config/code hash. |
| S23 | `worker.outlayer.testnet::get_approved_measurements` (RPC view) | 121 approved measurement sets. |
| S24 | https://crates.io/api/v1/crates/outlayer and /outlayer-cli | Crate versions 0.2.1 / 0.2.2. |
| S25 | https://registry.npmjs.org/@outlayer/sdk | TypeScript SDK `0.1.0-alpha.4`. |
| S26 | https://github.com/out-layer/outlayer-verify (via S5) | Independent verification tool, Apache-2.0. |

**No endpoint or SDK method in this document was invented. Every URL above was fetched or returned by a live query; anything not fetched is labeled VERIFIED-SOURCE or UNVERIFIED.**

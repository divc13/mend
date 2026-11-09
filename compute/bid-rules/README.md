# MEND deterministic bid rules (`compute/bid-rules`)

Integer-only Rust implementation of `docs/RULES.md` (`mend-bid-policy-v1`).
No LLM. No clock. No randomness. No network. No floating point.

- Library entry point: `mend_bid_rules::evaluate_json(input: &str) -> String`
- CLI/WASI entry point: read stdin, write one JSON object to stdout, flush
- Canonical fixtures: `fixtures/recorded-responses/bid-rules/`
- Build record: `artifacts/build.txt`

## 1. Exact algorithm

Weights are fixed and must total 10,000 bps:

| Dimension | Weight |
|---|---|
| Price (lower is better) | 4500 |
| Warranty (higher is better) | 2500 |
| Duration (lower is better) | 2000 |
| Materials (absolute 0–100) | 1000 |

Eligible bids only. For each dimension, `min`/`max` are computed **across
eligible bids**:

```text
priceBps    = maxPrice == minPrice    ? 10000 : (maxPrice - price) * 10000 / (maxPrice - minPrice)
warrantyBps = maxWarranty == minWarranty ? 10000 : (warranty - minWarranty) * 10000 / (maxWarranty - minWarranty)
durationBps = maxDuration == minDuration ? 10000 : (maxDuration - duration) * 10000 / (maxDuration - minDuration)
materialsBps = materialsScore * 100
```

All division is integer truncation (floor). Then:

```text
weighted = 4500*priceBps + 2500*warrantyBps + 2000*durationBps + 1000*materialsBps
scoreBps = (weighted + 5000) / 10000        // integer round-half-up
```

Ranking is a total order:

1. `scoreBps` descending
2. `priceMicro` ascending
3. `warrantyDays` descending
4. `durationDays` ascending
5. `bidId` ascending (byte-lexicographic)

Ineligible bids (`eligible: false`) are returned in `excluded` with reason
`ineligible` and can never win. If no eligible bid remains the library returns
`SCORE_INVALID`; it never invents a winner. Invalid numeric values on an
eligible bid are also `SCORE_INVALID` (matching `@mend/protocol`), not silently
dropped.

## 2. JSON input

```json
{
  "schema": "mend.bid-rules.v1",
  "policyHash": "1a8a985878ebb09ebbad817ecd17ad93b3ff1d8b421a830fb3342c15c942357d",
  "policyVersion": "mend-bid-policy-v1",
  "weightsBps": { "price": 4500, "warranty": 2500, "duration": 2000, "materials": 1000 },
  "bids": [
    {
      "bidId": "BID-B-BENCH-001",
      "contractorId": "contractor-b.mend.testnet",
      "priceMicro": "80000000",
      "durationDays": 10,
      "warrantyDays": 180,
      "materialsScore": 80,
      "availableInDays": 2,
      "eligible": true,
      "evidenceChecklistAccepted": true,
      "nonce": "nonce-b-0002",
      "commitmentHash": "fcb0780b0d1f1dbccd9fdcefa5627c24b227636ee414a8c618077f0df079d968"
    }
  ]
}
```

- `policyHash`, `policyVersion` and `weightsBps` are optional but if supplied
  must match `mend-bid-policy-v1` exactly, otherwise `SCORE_POLICY_MISMATCH`.
- `eligible` defaults to `false`; an omitted eligibility flag cannot win.
- `availableInDays` (whole days until the contractor can start after award) is
  committed with the bid. It defaults to `0` when omitted, for
  `MEND_BID_V1`-era inputs; the canonical fixtures carry real values.
- `commitmentHash` may be supplied, or computed from `nonce` +
  `evidenceChecklistAccepted` using the protocol payload:
  `MEND_BID_V2|bidId|contractorId|priceMicro|durationDays|warrantyDays|materialsScore|availableInDays|checklist?1:0|nonce`.
- If neither is present, `inputHash` falls back to a hash of the canonical bid
  list. The on-chain canonical form is the commitment-hash form used by
  `@mend/protocol` `scoreInputHash`.

## 3. JSON output

```json
{
  "schema": "mend.bid-rules.v1",
  "policyVersion": "mend-bid-policy-v1",
  "policyHash": "<64 hex>",
  "weightsBps": { "price": 4500, "warranty": 2500, "duration": 2000, "materials": 1000 },
  "ranking": [
    {
      "rank": 1,
      "bidId": "BID-B-BENCH-001",
      "contractorId": "contractor-b.mend.testnet",
      "scoreBps": 9270,
      "dimensionsBps": { "price": 8823, "warranty": 10000, "duration": 10000, "materials": 8000 },
      "priceMicro": "80000000",
      "durationDays": 10,
      "warrantyDays": 180,
      "materialsScore": 80
    }
  ],
  "excluded": [],
  "winnerBidId": "BID-B-BENCH-001",
  "inputHash": "b06906891107bc8171b2a99c6b561fd31e917cf54368e8ac5363028d4c583244",
  "outputHash": "905950627b0c7b870fdfc96034f1168bd4654cd6497d443debe6162e6efef134"
}
```

Hashes are `@mend/protocol` compatible:

- `inputHash = sha256("MEND_SCORE_INPUT_V1|policyHash|" + sortedCommitmentHashes.join("|"))`
- `outputHash = sha256("MEND_SCORE_OUTPUT_V1|" + canonicalRankingJson)`
- `canonicalRankingJson` is the JSON serialization of the `ranking` array with
  the field order shown above and no whitespace. `@mend/protocol`
  `canonicalRankingJson()` mirrors it; `packages/ai-client/test/parity.test.ts`
  verifies the committed fixture.

Errors are still valid JSON and never a panic:

```json
{ "schema": "mend.bid-rules.v1", "error": { "code": "SCORE_INVALID", "message": "..." } }
```

## 4. Build and test

```bash
cargo test --manifest-path compute/bid-rules/Cargo.toml
cargo build --manifest-path compute/bid-rules/Cargo.toml --target wasm32-unknown-unknown --release
cargo build --manifest-path compute/bid-rules/Cargo.toml --target wasm32-wasip1 --release
```

`wasm32-wasip1` is the OutLayer target (binary `_start`, stdin/stdout). The
`wasm32-unknown-unknown` build is a portable build/CI artifact; it has no WASI
stdio and is not the OutLayer artifact. The WASI artifact was executed locally
through Node's `WASI` preview1 shim against the canonical fixture and produced
the same 9270/5200/2873 ranking.

## 5. OutLayer registration and invocation shape

Verified against `orchestration/research/R0-B-outlayer.md` (2026-11-09). Items
marked **[UNVERIFIED]** were not executed by this worker: no OutLayer
credentials, funded account or deployment was used.

### 5.1 Register a hash-pinned version

```text
outlayer upload target/wasm32-wasip1/release/mend-bid-rules.wasm
  -> https://test.fastfs.io/<owner>/outlayer.testnet/<sha256>.wasm

outlayer deploy bid-rules https://test.fastfs.io/<owner>/outlayer.testnet/<sha256>.wasm
```

On-chain equivalent (testnet `outlayer.testnet`) **[VERIFIED-SOURCE in R0-B,
UNVERIFIED by this worker]**:

```json
{"WasmUrl":{
  "url":"https://test.fastfs.io/<owner>/outlayer.testnet/<sha256>.wasm",
  "hash":"<64 lowercase hex sha256 of exact wasm bytes>",
  "build_target":"wasm32-wasip1"
}}
```

`create_project(name, source)` / `add_version(project_name, source, set_active)`.
Pin `version_key` to the code hash in every request; never use the mutable
active version for production scoring.

### 5.2 Invoke from the MEND hub

```rust
ext_outlayer::ext(outlayer_account)         // outlayer.testnet
    .with_attached_deposit(deposit)
    .with_unused_gas_weight(1)
    .request_execution(
        source,                              // Project{MEND/bid-rules, version_key=code hash}
        Some(limits),                        // max_instructions, max_memory_mb, max_execution_seconds
        Some(serde_json::to_string(&input)?),// the JSON in section 2
        None,
        Some("Json".into()),
        Some(payer_account_id),
        None,
    )
    .then(ext_self::ext(env::current_account_id())
        .with_static_gas(Gas::from_tgas(25))
        .on_score_result(work_order_id, input_hash, policy_hash));
```

- `input_data` is a **JSON-encoded string**, not an object.
- `response_format` must be `"Json"`.
- Suggested limits in R0-B: `max_instructions: 5_000_000_000`,
  `max_memory_mb: 128`, `max_execution_seconds: 10`; attach at least
  `estimate_execution_cost(...)` (R0-B example: 0.003 NEAR). Call the view
  method immediately before sending. **[UNVERIFIED live]**
- The hub callback reads `env::promise_result(0)` and must be `#[private]`.
  OutLayer does not call an arbitrary MEND method; it resumes the promise.
- The callback does **not** contain a request id or TEE attestation. Index the
  `execution_requested` event to map `tx_hash -> request_id` for off-chain
  attestation lookup.
- Canonical 3-bid output is 1,204 bytes, which is above the 1,024-byte
  single-resume payload limit. OutLayer's large-output path
  (`submit_execution_output_and_resolve`) is therefore required unless the
  caller requests a compact projection and verifies it against `outputHash`.
  **[VERIFIED-SOURCE; path not exercised here]**

### 5.3 Integrity binding

The hub must store and compare:

1. policy hash approved by the DAO,
2. WASM SHA-256 pinned at registration,
3. `inputHash` computed by MEND from revealed commitment hashes,
4. `outputHash` computed from the callback bytes,
5. work-order state/reveal deadline.

`outputHash` in the returned JSON is a convenience for the indexer; the hub
must recompute the output hash from the raw callback bytes rather than trust a
field inside the output. A wrong policy, wrong WASM, modified bid input or
stale work order is rejected.

### 5.4 Honest limitations

- No OutLayer registration, deployment, `request_execution`, callback or
  attestation was executed. Those steps are **[UNVERIFIED]** and require a
  funded testnet account and human authorization.
- OutLayer's on-chain callback proves "the OutLayer operator returned these
  bytes", not "Intel TDX executed this exact code". TDX attestation must be
  fetched and verified off-chain (`/attestations/by-request/{id}`).
- Reproducible-build equality between this source tree and the deployed WASM
  must be checked at registration time; this worker recorded the local SHA-256
  only.

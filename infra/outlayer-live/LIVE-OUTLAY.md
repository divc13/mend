# MEND × OutLayer — live testnet publish/execute evidence

Status: **PASS** — generated 2026-11-10T09:35:10.143Z by `scripts/outlayer-live/run-live.mjs --doc`.

This document is generated from `infra/outlayer-live/live-state.json` and the
captured evidence files. It reports exactly what happened: a real testnet
publication and execution, or the precise blocker that stopped one.

## 1. Scope and network

| Item | Value |
|---|---|
| Network | **testnet** (mainnet refused by the script) |
| OutLayer contract | `outlayer.testnet` |
| OutLayer API | https://testnet-api.outlayer.ai |
| Worker/operator account | `worker.outlayer.testnet` |
| Publisher / caller | `mend-deployer.testnet` |
| Project id requested by the task | `mend.testnet/bid-rules` |
| Project id actually used | `mend-deployer.testnet/bid-rules` |

> **Canonical id note.** account mend.testnet does not exist on testnet (NEAR RPC: UNKNOWN_ACCOUNT), so the outlayer.testnet-derived project id mend.testnet/bid-rules cannot be created; publishing under the controlled owner mend-deployer.testnet instead

## 2. WASM artifact

```bash
cargo build --manifest-path compute/bid-rules/Cargo.toml --target wasm32-wasip1 --release
shasum -a 256 compute/bid-rules/target/wasm32-wasip1/release/mend-bid-rules.wasm
```

| Field | Value |
|---|---|
| Target | `wasm32-wasip1` |
| Toolchain | `rustc 1.99.1 (58cf8f9c3 2026-10-13)` |
| Size | 131506 bytes |
| SHA-256 | `640589102f5c259b849c9b1c4b4242b56459dee1f52659700011611fbe41bf55` |
| Hash record | `compute/bid-rules/artifacts/wasm-sha256.json` |

## 3. Canonical input/output

| Field | Value |
|---|---|
| Input file | `fixtures/recorded-responses/bid-rules/canonical-input.json` |
| Input bytes | 1561 |
| Input SHA-256 | `63c8af41d052aac9a3caca4ac42efc23050e4128a1709af240c4c85c7375b691` |
| Output (worker stdout) bytes | 1204 |
| Output SHA-256 (stdout) | `c584f884925df3a398ebd0b546483b9cdcf2eb873416d5e7a91883b834faa801` |
| Output SHA-256 (OutLayer canonical) | `7dc310db71ce0d2b43863880acbf254c89033ebfc0ee65edf8e361b7248e7c41` |
| Output file (pretty-printed) SHA-256 | `26c77a3bd9847c9ff059ef1987bc2ffb54b88da906fad7996c7174e752fa9f4a` |
| Protocol `inputHash` | `b06906891107bc8171b2a99c6b561fd31e917cf54368e8ac5363028d4c583244` |
| Protocol `outputHash` | `905950627b0c7b870fdfc96034f1168bd4654cd6497d443debe6162e6efef134` |
| Winner | `BID-B-BENCH-001` |
| stdout > 1024-byte single-resume limit | true |

## 4. Publication

```text
node scripts/outlayer-live/run-live.mjs --publish
  -> FastFS upload: outlayer.testnet::__fastdata_fastfs (gas = 1, fails by design)
  -> outlayer.testnet::create_project(name, {WasmUrl:{url,hash,build_target}})
```

| Field | Value |
|---|---|
| Wasm URL | <https://test.fastfs.io/mend-deployer.testnet/outlayer.testnet/640589102f5c259b849c9b1c4b4242b56459dee1f52659700011611fbe41bf55.wasm> |
| FastFS upload tx | [`FrnTW8dz2374L81Dc1wio6sWwniqoQqnYifV4hTMLYg7`](https://explorer.testnet.near.org/transactions/FrnTW8dz2374L81Dc1wio6sWwniqoQqnYifV4hTMLYg7) |
| FastFS served exact bytes | true |
| create_project tx | [`FTiMXNiGWte7s4ju6x8L3Zwrf9DMnwtGYqB2y3LRP1Dv`](https://explorer.testnet.near.org/transactions/FTiMXNiGWte7s4ju6x8L3Zwrf9DMnwtGYqB2y3LRP1Dv) |
| tx verification | `infra/outlayer-live/evidence/publish-txs.json` |
| Pinned version key | `640589102f5c259b849c9b1c4b4242b56459dee1f52659700011611fbe41bf55` |
| Build target | `wasm32-wasip1` |

## 5. Execution

```text
node scripts/outlayer-live/run-live.mjs --execute
  -> outlayer.testnet::estimate_execution_cost(resource_limits, input_len)
  -> outlayer.testnet::request_execution(source=Project{project_id, version_key}, Json)
```

| Field | Value |
|---|---|
| request_execution tx | [`4nAFPtVQUmuimrzFN55uB4B8wZzCWgBuXZW5hAXrsqoP`](https://explorer.testnet.near.org/transactions/4nAFPtVQUmuimrzFN55uB4B8wZzCWgBuXZW5hAXrsqoP) |
| worker settlement tx | [`HHBDS4ymrGbUisX9NvfZJ6XTaC24aTShmomroX5XJYAQ`](https://explorer.testnet.near.org/transactions/HHBDS4ymrGbUisX9NvfZJ6XTaC24aTShmomroX5XJYAQ) (`submit_execution_output_and_resolve` by `worker.outlayer.testnet` at block 277047998) |
| request_id | 15579 |
| resource limits | `{"max_instructions":5000000000,"max_memory_mb":128,"max_execution_seconds":10}` |
| estimated cost (yocto) | 2000500000000000000000 |
| attached deposit (yocto) | 4000000000000000000000 |
| payer_account_id | `mend-deployer.testnet` |
| response_format | `Json` |
| execution success | true |
| instructions / time_ms | 423356 / 382 |
| compile time / note | 589 ms / Freshly compiled |
| payment charged / refunded (yocto) | 1097100000000000000000 / 2902900000000000000000 |

## 6. Attestation

| Field | Value |
|---|---|
| attestation id | 28487 |
| task id / type | 32954 / execute |
| request_id | 15579 |
| transaction_hash | [`4nAFPtVQUmuimrzFN55uB4B8wZzCWgBuXZW5hAXrsqoP`](https://explorer.testnet.near.org/transactions/4nAFPtVQUmuimrzFN55uB4B8wZzCWgBuXZW5hAXrsqoP) |
| caller_account_id | `mend-deployer.testnet` |
| build_target | `wasm32-wasip1` |
| wasm_hash | `640589102f5c259b849c9b1c4b4242b56459dee1f52659700011611fbe41bf55` |
| input_hash | `63c8af41d052aac9a3caca4ac42efc23050e4128a1709af240c4c85c7375b691` |
| output_hash | `7dc310db71ce0d2b43863880acbf254c89033ebfc0ee65edf8e361b7248e7c41` |
| worker_measurement (RTMR3) | `b1773e4dd9db7e54c2564f15913872cb6a8acd6ce6d4e28dc4008c6b90f6dfec43eae5021d3055a1917fe7360d73dcc9` |
| TDX quote sha256 | `c53bcd829bc0e8d77842f1cd128d11e68805663f44f58a189622ef653c621321` (5006 bytes) |
| quote measurements in allowlist | **true** (121 sets) |
| recomputed task hash == report_data | **true** |
| evidence snapshot | `infra/outlayer-live/evidence/attestation-request-15579.json` |

Verified: the attestation binds the exact code hash, exact input bytes and
exact output bytes to a TDX quote whose five measurements are on the
`worker.outlayer.testnet` allowlist, and the recomputed task hash appears in
`report_data[0..32]`.

**Not** verified here: the Intel DCAP signature chain. `outlayer-verify`
(or a DCAP implementation) must be run against the raw quote for that; the
raw quote is stored in the evidence snapshot.

## 7. Findings from the live run

1. **Code hash is reproducible.** Two independent builds with the recorded
   toolchain produced `640589102f5c259b849c9b1c4b4242b56459dee1f52659700011611fbe41bf55`, the value pinned on chain and in the attestation.
2. **Input hash is the exact input bytes.** `sha256(canonical-input.json)` =
   `63c8af41d052aac9a3caca4ac42efc23050e4128a1709af240c4c85c7375b691` = attestation `input_hash`. The fixture file is passed verbatim as `input_data`.
3. **`output_hash` is not `sha256(stdout)` for `Json`.** The worker parses stdout
   into `serde_json::Value` and hashes `Value::to_string()`
   (`worker/src/main.rs`), i.e. compact JSON with lexicographically sorted keys.
   stdout sha256 = `c584f884925df3a398ebd0b546483b9cdcf2eb873416d5e7a91883b834faa801`;
   canonical/sorted-key sha256 = `7dc310db71ce0d2b43863880acbf254c89033ebfc0ee65edf8e361b7248e7c41`; the attestation reports the latter.
4. **The 1024-byte single-resume limit was hit.** The canonical output is 1204 bytes,
   so OutLayer used the two-call flow: the settlement transaction is
   `submit_execution_output_and_resolve`, and its log says "Retrieving large output
   from storage". A MEND caller must keep this in mind: the value returned to the
   callback is the re-serialized JSON, not the raw stdout bytes.
5. **Publication needs an owner account, not an API key.** `create_project` derives
   the project id from `predecessor_account_id`; the publish path used the funded
   `mend-deployer.testnet` key and attached a storage deposit (excess refunded).

## 8. Result and blockers

**PASS**

Notes:
- get_request returned null (request state archived or pruned)
- attestation still served live via by-request

## 9. What this does not prove

- It does not prove the WASM logic is correct, only which bytes ran.
- It does not prove the binary matches this source tree repo-wide; the
  reproducible-build claim is limited to the recorded toolchain and command.
- Intel DCAP quote verification is out of scope for this script.
- Testnet only. No mainnet claim, no production value.


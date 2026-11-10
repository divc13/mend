# Live OutLayer testnet (MEND bid-rules)

Evidence package for a real OutLayer **testnet** publication and execution of
`compute/bid-rules`, plus the checker that keeps the claim honest.

- Status and exact hashes: [`LIVE-OUTLAY.md`](./LIVE-OUTLAY.md)
- Machine state: [`live-state.json`](./live-state.json)
- Raw evidence: [`evidence/`](./evidence)
- Driver: [`../../scripts/outlayer-live/run-live.mjs`](../../scripts/outlayer-live/run-live.mjs)

Nothing here is mainnet. No TEE execution is claimed unless `--check` says
`PASS` and the attestation snapshot backs it.

## What ran

| Step | Contract call | Result |
|---|---|---|
| Build | `cargo build --target wasm32-wasip1 --release` | deterministic SHA-256 `64058910…1fbe41bf55` |
| Upload | `outlayer.testnet::__fastdata_fastfs` (gas = 1, fails by design) | FastFS serves the exact bytes |
| Publish | `outlayer.testnet::create_project(name, WasmUrl)` | version key = WASM SHA-256 |
| Execute | `outlayer.testnet::request_execution(Project{project_id, version_key}, Json)` | `success: true`, 423,356 instructions, 382 ms |
| Settle | `worker.outlayer.testnet::submit_execution_output_and_resolve` | two-call large-output flow (1204-byte output) |
| Attest | `GET /attestations/by-request/{id}` | `wasm_hash`, `input_hash`, `output_hash` match; TDX quote measurements approved |

## Commands

```bash
# everything: build, publish, execute, verify, then PASS/BLOCKED
MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node scripts/outlayer-live/run-live.mjs --all

# individual steps (idempotent: existing FastFS object / project version are reused)
node scripts/outlayer-live/run-live.mjs --build
MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node scripts/outlayer-live/run-live.mjs --publish
MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node scripts/outlayer-live/run-live.mjs --execute
MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node scripts/outlayer-live/run-live.mjs --verify

# acceptance: no keys needed, reads chain + API, exits 0 = PASS / 2 = BLOCKED
node scripts/outlayer-live/run-live.mjs --check

# regenerate LIVE-OUTLAY.md from live-state.json
node scripts/outlayer-live/run-live.mjs --doc
```

`npm install --prefix scripts/outlayer-live` provides `near-api-js`. The script
also needs `cargo` with the `wasm32-wasip1` target.

## What `--check` asserts

1. `compute/bid-rules/artifacts/wasm-sha256.json` matches the recorded build hash
   (and the rebuilt WASM, when present).
2. `canonical-input.json` hashes to the recorded input hash, and
   `canonical-output.json` canonicalizes to the recorded output hash.
3. The version key on `outlayer.testnet` is the built WASM SHA-256.
4. The request tx succeeded and the attestation record binds
   `wasm_hash` / `input_hash` / `output_hash` / `build_target` / `caller` /
   `request_id` / `transaction_hash`.
5. The TDX quote's five measurements are in the
   `worker.outlayer.testnet` allowlist and the recomputed task hash equals
   `report_data[0..32]`.

It prints `RESULT: PASS` or `RESULT: BLOCKED` with the exact reasons.

## Honest limits

- **Only testnet.** Test value only; no production or mainnet claim.
- **Canonical project id blocked.** The research doc names
  `mend.testnet/bid-rules`, but OutLayer derives the project id from the
  predecessor account and no `mend.testnet` account exists or is controlled by
  MEND. The live project is `mend-deployer.testnet/bid-rules`, which is the same
  code and the same call shape. See `live-state.json → project.canonicalIdBlocker`.
- **No Intel DCAP signature-chain verification.** The raw quote is stored in
  `evidence/attestation-request-*.json`; `outlayer-verify` (or a DCAP
  implementation) still has to check the signature chain against Intel
  collateral. Everything short of that is verified here.
- **`output_hash` is not `sha256(stdout)`.** For `response_format: "Json"` the
  worker hashes `serde_json::Value::to_string()` of the parsed stdout:
  compact JSON with sorted keys. The attestation matches that, not the raw WASI
  stdout bytes. The MEND hub must hash the bytes it actually receives from the
  promise callback, not an off-chain re-run.
- **Local fallback stays separate.** `compute/bid-rules` + the canonical
  fixtures remain the deterministic, un-attested reference; they are not
  evidence of a TEE run on their own.

## Secrets

The script reads signing keys only from `MEND_TESTNET_KEYS_FILE`, refuses any
account that does not end in `.testnet`, and never writes a key, seed phrase or
private key into `live-state.json`, the evidence files or `LIVE-OUTLAY.md`.

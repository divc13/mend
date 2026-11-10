You are the visible Live OutLayer worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/outlayer-live (new branch track/outlayer-live from main). Do not ask questions; proceed.

CONTEXT:
- `compute/bid-rules` is a deterministic WASI scorer; `docs/RULES.md` is the policy.
- OutLayer testnet: contract `outlayer.testnet`, API `https://testnet-api.outlayer.ai`; research is in `orchestration/research/R0-B-outlayer.md`.
- The current hub has `scoringEnabled:false` and an empty WASM hash. A fresh V2 hub may be deployed by another worker.
- Testnet funds are available in existing accounts; keys are outside the repo at `/Volumes/sandisk/Users/dc/.mend/testnet/keys.json`. NEVER print or commit secrets.

SCOPE: `infra/outlayer-live/**`, `scripts/outlayer-live/**`, and `compute/bid-rules/artifacts/**` (only build/hash artifacts).

GOAL: Attempt a real OutLayer testnet publish/execute and record the exact result. If blocked, document the precise blocker and leave the local deterministic fallback honest.

REQUIRED:
1. Build `wasm32-wasip1`, compute sha256, and try to publish `mend.testnet/bid-rules` via the OutLayer testnet API/dashboard or contract. If an API key/account/payment is required and unavailable, record the exact response and mark BLOCKED.
2. If publish succeeds, execute the canonical scoring input through `outlayer.testnet::request_execution` from a testnet account/contract, capture request/callback tx hashes, output hash and attestation reference.
3. Verify code/input/output hashes against `fixtures/recorded-responses/bid-rules/canonical-*`.
4. Write `infra/outlayer-live/LIVE-OUTLAY.md` with exact commands, hashes, tx links, and either success or the precise blocker. Do not claim a TEE execution that did not happen.
5. Do not modify protocol/contracts/apps.

ACCEPTANCE: `node scripts/outlayer-live/run-live.mjs --check` exits with a clear PASS or BLOCKED result; no secrets; no fake attestation.

Commit on branch track/outlayer-live with message `feat(outlayer): live testnet publish/execute attempt and evidence`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TX/HASHES, TESTS, BLOCKERS, RISKS, COMMIT.

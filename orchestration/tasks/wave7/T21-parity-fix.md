You are the visible Parity Fix worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/ai-compute (branch track/ai-compute). Do not ask questions; proceed.

FIRST: `git merge main --no-edit` and `npm install` at the repo root if needed.

PROBLEM: The protocol commitment hash changed to `MEND_BID_V2` with `availableInDays`, but `compute/bid-rules` and the canonical parity fixtures still use `MEND_BID_V1`. This breaks `npm run typecheck` in `packages/ai-client` and parity evidence.

SCOPE: `compute/bid-rules/**`, `packages/ai-client/test/parity.test.ts`, `fixtures/recorded-responses/bid-rules/**`. Do NOT edit protocol source, contracts, apps, services, docs.

REQUIRED:
1. Update the Rust commitment payload to exactly:
   `MEND_BID_V2|bidId|contractorId|priceMicro|durationDays|warrantyDays|materialsScore|availableInDays|checklistAccepted?1:0|nonce`
   and add `availableInDays` to the Rust `BidInput` (optional with default 0 for backward compatibility, but canonical fixtures use real values).
2. Update `fixtures/recorded-responses/bid-rules/canonical-input.json` to include `availableInDays` (A 3, B 2, C 5) and recompute every `commitmentHash`, `inputHash` and `outputHash` from the new canonical algorithm.
3. Update Rust tests and `packages/ai-client/test/parity.test.ts` to use the new field and fixtures.
4. Run and paste:
```bash
cargo test --manifest-path compute/bid-rules/Cargo.toml
cargo build --manifest-path compute/bid-rules/Cargo.toml --target wasm32-unknown-unknown --release
cd packages/ai-client && npm test && npm run typecheck
```
All must pass. Do not weaken tests. No mainnet/deploy/push.

Commit on branch track/ai-compute with message `fix(compute): MEND_BID_V2 availability parity`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

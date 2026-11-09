You are the visible Contracts worker for MEND (product completion). Working directory: /Volumes/sandisk/Users/dc/mend-wt/contracts (branch track/contracts). Do not ask questions; proceed.

FIRST: `git merge main --no-edit`. Main now has protocol commit `f2677db` with bid availability (`MEND_BID_V2`).

SCOPE: only `contracts/**`.

GOAL: Add the committed bid availability field end-to-end in the hub contract.

REQUIRED:
1. `BidReveal` gains `available_in_days: u32`; `reveal_bid` accepts it; `BidRevealView` exposes it.
2. Commitment hash must match `packages/protocol/src/hashing.ts` exactly:
   `MEND_BID_V2|bidId|contractorId|priceMicro|durationDays|warrantyDays|materialsScore|availableInDays|checklistAccepted?1:0|nonce`
   (sha256 hex). Update all tests/helpers that build commitments.
3. Validate `available_in_days` is an integer; reject absurd values (> 365) with a clear error.
4. Update the reveal event and any bid JSON views/serializers.
5. Add tests: valid availability stored/exposed; changing availability after commit fails hash; availability is invisible before reveal.
6. Keep all existing tests passing; do not weaken them.

ACCEPTANCE (paste real output):
```bash
cargo test --manifest-path contracts/Cargo.toml
cargo build --manifest-path contracts/hub/Cargo.toml --target wasm32-unknown-unknown --release
cargo build --manifest-path contracts/test-token/Cargo.toml --target wasm32-unknown-unknown --release
```
No mainnet/deploy/push.

Commit on branch track/contracts with message `feat(contracts): commit and expose bid availability`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

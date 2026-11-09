You are the visible Contracts worker for MEND. Working directory: /Volumes/sandisk/Users/dc/mend-wt/contracts (git branch track/contracts). Do not ask questions; proceed.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (authoritative scope; sections 2 F01–F14, 3 invariants, T01)
- /Volumes/sandisk/Users/dc/mend/orchestration/decisions/HUB-INTERFACE.md (frozen interface — implement exactly)
- /Volumes/sandisk/Users/dc/mend/docs/RULES.md
- /Volumes/sandisk/Users/dc/mend/packages/protocol/src/{fixtures,state-machine,accounting,scoring,events,errors}.ts
- /Volumes/sandisk/Users/dc/mend/orchestration/research/R0-E-near-platform.md and R0-B-outlayer.md (must exist; if a file is missing, note it and continue with near-sdk 5.30 docs)

GOAL: Implement the complete MEND NEAR contracts with passing unit tests and WASM builds.

SCOPE (only these paths):
- contracts/hub/** — hub contract (Rust, near-sdk 5.30.1, near-contract-standards 5.30.1)
- contracts/test-token/** — testnet-only NEP-141 mock USDC with metadata + ft_transfer_call support
- contracts/Cargo.toml, contracts/README.md, contracts/rust-toolchain.toml
Do NOT edit packages/, apps/, services/, orchestration/, docs/, root package.json, or the main worktree.

REQUIREMENTS:
1. Implement every method, state, error and invariant in HUB-INTERFACE.md, HUB-INTERFACE events, and PLAN.md §3. Use exact method names/args.
2. Non-transferable NEP-171 passport: mint, metadata, token = asset_id, owner = the hub account (never a user); `nft_transfer`, `nft_transfer_call` and approvals must always fail with `TRANSFER_DISABLED`; no burn and no admin transfer. Passport views: nft_token, nft_metadata, nft_total_supply, nft_tokens_for_owner.
3. NEP-141 escrow via `ft_on_transfer` with exact accounting, accepted-token allowlist, sponsor-only funding, strict `msg` schema, wrong-token rejection, underfund full refund, overfund excess refund, duplicate-fund prevention, callback failure handling. Internal escrow ledger must satisfy funding = refunded + escrowed + completionPaid + holdbackHeld + holdbackReleased at all times.
4. Sealed commit/reveal: commitment hash formula matches packages/protocol/src/hashing.ts exactly (MEND_BID_V1 string, sha256 hex). Early/late/mismatch/duplicate/non-roster fail. Reveals are invisible before reveal phase.
5. Scoring: `record_score` validates policy hash, all revealed eligible bids exactly once, wasm/input/output hashes; `request_score` follows R0-B §9.4 (canonical input, hash-pinned WASM, attached deposit, `.then(on_score_result)`) and `on_score_result` is a `#[private]` self-callback that reads `promise_result(0)` only (never a caller-supplied output), checks winner eligibility/max score, and ignores duplicate callbacks; `award` only rank 1, refunds budget − price to sponsor in the same transaction, stores payment records. If OutLayer cannot be exercised in unit tests, implement it behind config and add negative tests; do not fake an OutLayer execution.
6. Completion/durability: contractor cannot accept own work; inspector must be rostered and different from contractor; first completion acceptance pays 90% once; durability pass releases 10% once; durability fail reopens the SAME work order with no new escrow; remediation acceptance pays nothing again. Durability interval is init-configured minutes (demo).
7. Disputes freeze payouts; only DAO resolves; refunds cannot double-pay; pause blocks mutations and unpause restores exact prior state. `dao_authorize` is DAO-only and is the only path from DRAFT to POLICY_APPROVED; steward proposes scope/budget, DAO authorizes envelope/rosters/policy via a Sputnik FunctionCall proposal.
8. Every state change emits `EVENT_JSON` with standard "mend", version "1.0.0", event names matching protocol events.
9. No raw evidence URL, precise location or private media in public state; only hashes/IDs.
10. Access control: method-scoped roles; AI roles cannot award/accept/refund; recipient allowlist for payouts (sponsor refund, awarded contractor, inspector cannot redirect funds).
11. Unit tests (near-sdk test utils) covering every invariant and every invalid transition in the plan. Include a full happy-path test with 100 funded → 80 awarded → 20 refund → 72 paid → 8 held → 8 released, and a failed-durability remediation test. Include transfer-rejection, self-inspection, self-award, stale-score, wrong-policy, early/late reveal, hash mismatch, duplicate payment, pause, dispute, overfund and wrong-token tests.

ACCEPTANCE (run and paste real output):
```bash
cargo test --manifest-path contracts/Cargo.toml
cargo build --manifest-path contracts/hub/Cargo.toml --target wasm32-unknown-unknown --release
cargo build --manifest-path contracts/test-token/Cargo.toml --target wasm32-unknown-unknown --release
```
All tests must pass and both WASM files must exist. Report exact test counts, wasm paths, sizes and any warnings.

RULES:
- Never weaken a test to make it pass. If something cannot work, report BLOCKED with the exact error.
- No mainnet, no deployment, no push.
- Commit your work on branch track/contracts with message `feat(contracts): hub, passport, escrow, bidding, warranty` and report the commit hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

You are a visible Wave 0 research agent for the MEND project (NEAR community repair marketplace). Working directory: /Volumes/sandisk/Users/dc/mend. Do not ask questions; proceed.

GOAL: Validate OutLayer (NEAR verifiable compute) testnet execution and callback flow against current live documentation.

CONTEXT:
- MEND uses OutLayer to run a deterministic Rust/WASM bid-scoring function and bind code/input/output/policy hashes on-chain.
- No LLM may choose the winner. We need exact request/callback schemas and limits.

TASKS:
1. Find current OutLayer docs/site/repo (outlayer.tech? outlayer.near? github). Record exact base URL, network (testnet/mainnet), auth/payment mechanism.
2. Document how to register/publish a WASM function, version/hash it, invoke it with JSON input, and receive output: sync response vs callback, exact fields, gas/attached deposit, deadlines, idempotency.
3. Document how NEAR contracts request execution and how the callback is authenticated (who calls back, how to verify source and payload hash).
4. Check if a public testnet endpoint exists that can be called without payment; if yes, make one minimal real request and record status/body. Do NOT spend funds or use credentials.
5. Note exact WASM constraints (size, imports, wasm32 target, supported runtimes).
6. Check whether near-sdk integration crates/examples exist; record package/repo versions.

CONSTRAINTS:
- READ-ONLY on the repo: you may ONLY create/overwrite orchestration/research/R0-B-outlayer.md. Do not modify code or any other file.
- No installs, no transactions, no spending.
- Mark claims VERIFIED or UNVERIFIED. Never invent endpoints or SDK methods.

DELIVERABLE FILE: orchestration/research/R0-B-outlayer.md with exact endpoints, schemas, examples, auth/callback security, limits, sources (access date 2026-11-09), and concrete MEND implementation decisions plus a fallback plan if OutLayer is unavailable (still deterministic, verifiable, and clearly labeled).

REPLY WITH: STATUS, file path, key verified facts (max 10 bullets), blockers, risks.

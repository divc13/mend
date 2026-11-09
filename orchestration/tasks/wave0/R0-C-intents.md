You are a visible Wave 0 research agent for the MEND project (NEAR community repair marketplace). Working directory: /Volumes/sandisk/Users/dc/mend. Do not ask questions; proceed.

GOAL: Validate NEAR Intents / 1Click cross-chain swap API (quote, dry quote, deposit, status, refund) against current live documentation and public endpoints.

CONTEXT:
- MEND sponsors repairs cross-chain: sponsor sends an asset on another chain, USDC arrives to the MEND hub on NEAR.
- We need real quotes, `dry: true` preview, deposit instructions, status polling, SUCCESS/PENDING/FAILED/REFUNDED handling, explorer links, and clear mainnet-only labeling.
- Intents operates on mainnet only; no agent may initiate a real transaction.

TASKS:
1. Find the current 1Click/Intents API docs and base URL (e.g., 1click.chaindefuser.com). Record API version.
2. Document `GET /v0/tokens`, `POST /v0/quote` (including dry), `GET /v0/status`, exact request/response JSON fields, required headers, auth/JWT vs no-JWT fee.
3. Make real read-only calls: token list, a dry quote from a common asset/chain to NEAR USDC with a tiny amount, and a status lookup for a fake/known deposit address if safe. Record exact bodies and status codes.
4. Document deposit flow: returned deposit address/memo, deposit types, deadlines, refund address, recipient binding, and how completion is proven.
5. Document all statuses and sub-statuses with exact strings, including expiration/incomplete, and explorer link formats per chain.
6. Record fees, slippage settings, amount precision/minimums, and constraints for NEAR destination + recipient account.

CONSTRAINTS:
- READ-ONLY on the repo: you may ONLY create/overwrite orchestration/research/R0-C-intents.md. Do not modify code or any other file.
- NEVER initiate a real transfer, never sign, never spend funds. Only quote/dry/token/status reads.
- Mark claims VERIFIED or UNVERIFIED. Never invent fields.

DELIVERABLE FILE: orchestration/research/R0-C-intents.md with exact endpoints, schemas, working curl examples (real outputs), status matrix, explorer formats, sources (access date 2026-11-09), and concrete MEND client decisions. Explicitly label "MAINNET ONLY".

REPLY WITH: STATUS, file path, key verified facts (max 10 bullets), blockers, risks.

You are a visible Wave 0 research agent for the MEND project (NEAR community repair marketplace). Working directory: /Volumes/sandisk/Users/dc/mend. Do not ask questions; proceed.

GOAL: Validate NEAR AI Cloud inference + AI verification/attestation APIs against current live documentation and public endpoints.

CONTEXT:
- MEND needs private AI triage (report classification, duplicate suggestions, repair scope) and verifiable AI attestation.
- The implementation will be a server-side TypeScript client; no key may reach the browser.
- We need exact, current facts, not assumptions.

TASKS:
1. Research NEAR AI Cloud (near.ai / cloud.near.ai / docs.near.ai): current OpenAI-compatible base URL, auth header format, model IDs available for private inference, streaming support, structured output/JSON mode support, pricing/credits model.
2. Research the verification story: TEE attestation, response signatures, how a client verifies a response, exact endpoints/headers/formats, what is currently available vs announced only.
3. If any endpoint is public without credentials, make a real minimal request with curl (e.g., models list) and record the raw status/body. If credentials are required, say so; do NOT invent keys.
4. Check whether there is an official JS/TS SDK; record exact package name/version if any.
5. Note contradictions between docs and real responses.

CONSTRAINTS:
- READ-ONLY on the repo: you may ONLY create/overwrite orchestration/research/R0-A-near-ai.md. Do not modify code, package.json, or any other file.
- Do not install packages. curl/webfetch only.
- Do not invent endpoints, model IDs, headers or SDK methods.
- Mark every claim as VERIFIED (tested or directly quoted from live docs) or UNVERIFIED/ANNOUNCED.

DELIVERABLE FILE: orchestration/research/R0-A-near-ai.md containing:
- Base URLs + auth
- Models
- Request/response examples (working curl if tested)
- Attestation/signature verification flow with exact field names
- SDK info
- Limitations and failure modes
- Source URLs with access date 2026-11-09
- "Implementation decisions for MEND" (short, concrete)

REPLY WITH: STATUS, file path, key verified facts (max 10 bullets), blockers, risks.

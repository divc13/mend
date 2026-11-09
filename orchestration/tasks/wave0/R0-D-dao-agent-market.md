You are a visible Wave 0 research agent for the MEND project (NEAR community repair marketplace). Working directory: /Volumes/sandisk/Users/dc/mend. Do not ask questions; proceed.

GOAL: Validate Sputnik DAO (v2) proposal/policy APIs and the NEAR Agent Market worker API against current live documentation.

CONTEXT:
- MEND uses a Sputnik DAO to approve the budget envelope, contractor roster, inspector roster and bid-scoring policy. MEND must not implement a new multisig.
- MEND lists an evidence-completeness review agent on NEAR Agent Market (jobs: poll/start/submit/accept).

TASKS:
- Sputnik DAO:
1. Find current Sputnik DAO v2 contract(s) for testnet (factory, policy, proposal flows). Record exact contract IDs/versions.
2. Document proposal types (policy, add/remove member, transfer, function call), creation call args, voting, deadline, quorum, bonds, and how to read proposal status.
3. Check whether `sputnikdao2` contract source and near-cli-rs examples exist; record commands that would create/approve a proposal without executing them.
4. Identify how MEND attaches a DAO proposal reference to a work order (proposal ID format) and how the contract can verify approval if needed (view call? oracle? human attestation?). Recommend the least-trust path that works with the existing DAO.

- Agent Market:
5. Find the current NEAR Agent Market docs/base URL and worker API: register/publish an agent, poll jobs, start job, submit result, acceptance, auth token format, request/response schemas, statuses.
6. If a public endpoint is available without an account, make a read-only request and record output; otherwise say credentials are required and list exactly which.

CONSTRAINTS:
- READ-ONLY on the repo: you may ONLY create/overwrite orchestration/research/R0-D-dao-agent-market.md. Do not modify code or any other file.
- No transactions, no proposal creation, no spending, no account creation.
- Mark claims VERIFIED or UNVERIFIED. Never invent endpoints or contract IDs.

DELIVERABLE FILE: orchestration/research/R0-D-dao-agent-market.md with exact contracts/endpoints/schemas, commands (not executed), verification recommendations, sources (access date 2026-11-09), and concrete MEND decisions plus blockers.

REPLY WITH: STATUS, file path, key verified facts (max 10 bullets), blockers, risks.

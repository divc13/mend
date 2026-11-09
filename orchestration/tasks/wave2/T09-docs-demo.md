You are the visible Docs & Demo worker for MEND (Wave 2/5). Working directory: /Volumes/sandisk/Users/dc/mend-wt/docs-demo (git branch track/docs-demo). Do not ask questions; proceed.

READ FIRST:
- /Volumes/sandisk/Users/dc/mend/PLAN.md (F12–F14, §7 scenarios, §8 human dependencies, §9 demo script, T09)
- /Volumes/sandisk/Users/dc/mend/docs/RULES.md
- /Volumes/sandisk/Users/dc/mend/orchestration/decisions/{ADR-001-architecture,G0-freeze,HUB-INTERFACE}.md
- /Volumes/sandisk/Users/dc/mend/orchestration/research/R0-A..R0-E
- /Volumes/sandisk/Users/dc/mend/packages/protocol/src/fixtures.ts

SCOPE (only these paths):
- docs/**
- README.md
- scripts/demo/** and fixtures/demo/** (demo artifacts only)
Do NOT edit apps, contracts, packages, services, orchestration, root config.

REQUIREMENTS:
1. Product documentation: problem and product, user roles, architecture (with the real repo paths), state machine, payment accounting (100/80/72/8), privacy model, threat model, oracle/human trust assumptions, failure cases, deployment guide, and a limitations page. Every external integration claim must match the research docs and label VERIFIED / UNAVAILABLE / BLOCKED_ON_HUMAN honestly.
2. README with exact `Do X → See Y` instructions for every major flow, including REPLAY mode with no credentials, local stack, tests, and mode labels.
3. Real-world evidence package template: before/repair/after/durability media checklist, consent record, and a transparent "what was real vs staged" section. Do not fabricate media or claim physical verification that did not happen.
4. 90-second demo script with timestamps matching PLAN §9, narration, captions, and placeholders for real transaction links (only insert real links later).
5. Submission package draft: repository description, NEAR integration explanation, track justification, demo-post draft with required tags, 20–2,000 character submission description, baseline/library disclosures, license reference. Mark identity/wallet/repo URL/demo link as **HUMAN SUPPLIED — DO NOT INVENT**.
6. Demo capture plan: use Playwright (installed in repo) to record the REPLAY scenario once the web app is available; if the app is not merged into this worktree yet, produce the script + capture harness and state that the recording is pending. Include ffmpeg commands only if ffmpeg is available; otherwise document the dependency.
7. Cross-link every doc; no dead relative links. Include a `docs/README.md` index.
8. Accessibility/trust copy: no "AI approved", no "structurally safe", no "guaranteed", no fake city adoption, no invented partnerships.

ACCEPTANCE (run and paste real output):
```bash
# markdown/link sanity you can implement with a small node script under scripts/demo/
node scripts/demo/check-docs.mjs
```
Report exact file list and any HUMAN SUPPLIED placeholders. No deploy, no public post, no push.

Commit on branch track/docs-demo with message `docs: product, privacy, threat model, demo script and submission pack`; report hash.

REPORT: STATUS, CHANGES, FILES, COMMANDS+RESULTS, TESTS, BLOCKERS, RISKS, COMMIT.

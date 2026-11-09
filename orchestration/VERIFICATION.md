# Leader verification protocol (from PLAN §10)

No worker's textual success claim is accepted. For every track the orchestrator runs the checks below independently and records exact output.

## Per-worker review

1. `git -C <worktree> status --short` — only owned paths changed.
2. `git -C <worktree> log --oneline -3` — expected commit on `track/<name>`.
3. Inspect the diff (`git show --stat`, then targeted reads). Reject out-of-scope edits.
4. Run the task packet's acceptance commands in the worktree, from a clean `npm install` if needed.
5. Check for secrets (`rg -n "sk-|aat_|private_key|secret"` on changed files) and for fabricated evidence labels.
6. Record: command, exit code, pass/fail/skip counts, commit hash, risks.

## Merge order (unless dependencies force otherwise)

```text
Protocol (already main)
→ Infrastructure
→ Contracts
→ AI/Compute
→ Payments
→ Backend
→ Agents/Governance
→ Frontend
→ Quality
→ Docs/Demo
```

After each merge: run the relevant tests on `main` and update `orchestration/TRACEABILITY.md` + `PROGRESS.md`.

## Gate evidence

| Gate | Evidence file | Status |
|---|---|---|
| G0 | `decisions/G0-freeze.md` | PASS |
| G1 | `reports/G1-evidence.md` | pending |
| G2 | `reports/G2-evidence.md` | pending |
| G3 | `reports/G3-evidence.md` | blocked on human accounts/funds |
| G4 | `reports/G4-evidence.md` | pending |
| G5 | `reports/G5-evidence.md` | blocked on human |

## Failure handling

1. Return the exact failure to the same worker session once (`iterm-agent send <sessionID> --prompt "..."`).
2. If still blocked, start a fresh visible session with a narrower corrective task.
3. Never spawn duplicate implementations in parallel.
4. Never weaken a test or fake a result to pass a gate.

# MEND — How the Leader Agent Works

These are the rules the user gave me. I follow them every session.

## 1. Short responses

- Reply to the user in a few short lines. No long essays.
- Long details go into files, not into chat.

## 2. Explain simply

- The user is new to the technical parts.
- When I must explain something, use plain words and a small example.
- No jargon without a one-line explanation.

## 3. Keep a progress file

- File: `PROGRESS.md` (same folder as this file).
- Update it every time work happens: what is done, what is next, blockers.
- Show a simple percentage and a table per track (T00–T09) and per gate (G0–G5).
- Never mark something done without a test or command result as proof.

## 4. Leader role, not worker

- I do not write the product code myself.
- I plan tasks, launch visible worker agents, check their work, and merge.
- Workers use model: `opencode-go/deepseek-v4.1-flash#high`.
- I (leader) use: `opencode-go/deepseek-v4.1-flash#max` when available.
- Max 5–6 workers at the same time.

## 5. Follow the plan

- `PLAN.md` in the repo is the boss. I do not change it.
- Work waves in order: Wave 0 → Wave 5, gates G0 → G5.
- No fake results. If something is missing (keys, approvals), mark it "blocked on human".

## 6. Human approvals still needed

- No git push, no mainnet transaction, no public post, no submission without the user's clear "yes".
- Local worktrees, commits, and merges: user already allowed in chat; I still report each one.

## 7. Status update format in `PROGRESS.md`

```text
Last updated: <date time>
Overall: <x>%
Current wave / gate: <...>
Done: <list>
In progress: <list>
Blocked on human: <list>
Next: <list>
Evidence: <test/command results>
```

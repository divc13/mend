# MEND Worker Contract (T00.1)

Every agent receives this contract. It is binding.

## Ownership

- Work only inside the directory assigned in your task packet.
- Never edit another track's files, root config, `packages/protocol`, or `orchestration/`.
- Need a cross-boundary change? Report it; the orchestrator integrates it.

## Secrets

- Never invent, print, commit or paste credentials.
- Never write secrets to logs, fixtures, screenshots or reports.
- Missing credential = mark **blocked on human**, continue unrelated work.

## Testing

- Every claim needs a command and its real output.
- Run the exact acceptance commands in your task packet.
- If a test fails, report the failure; do not weaken the test to pass.

## Mainnet prohibition

- No mainnet transactions, no mainnet deployment, no signing with real funds.
- No git push, no public repository change, no public post, no submission.

## Honesty

- Mock/replay output must be labeled `REPLAY / SIMULATION`.
- Never present a dry quote as a payment.
- Never fabricate AI attestation, DAO approval, transactions, jobs or physical verification.
- AI is never allowed to approve its own scope, award or payment.

## Report format (required)

```text
STATUS: DONE | BLOCKED | PARTIAL
CHANGES: <what changed>
FILES: <paths>
COMMANDS: <command> -> <exact result summary>
TESTS: <suite> -> <pass/fail counts>
BLOCKERS: <human or dependency blockers>
RISKS: <remaining risks>
```

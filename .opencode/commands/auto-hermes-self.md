# OpenCode `/auto-hermes-self`

Use the Ralph self-loop owner for OpenCode:

```powershell
node .tools/auto-hermes-self-loop.mjs --write --json --runtime opencode
```

## Ralph Contract

- The helper must run through `.tools/auto-hermes-self-loop.mjs`.
- Use `--runtime opencode`.
- Same-work-unit no-progress limit must be enforced.
- Executor retries and retry backoff must be configured by the loop owner.
- Every successful round needs fresh verification, architect approval, deslop or explicit skip, regression re-verification, and round-close writeback.
- Stop only on a real gate: human pause/stop/must-ask, repeated website-audit exhaustion, same-task no-progress loop, executor unavailable after retries, or unsafe recovery needing human input.

## Continuity

- Empty queue does not immediately stop.
- Re-enter after each bounded round until a true stop gate fires.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.

# OpenCode `/auto-hermes-max`

Use this command as the OpenCode runtime note for adaptive Hermes max execution.

## Continuity

- Empty queue does not immediately stop.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.
- Max execution is fully routed through the supervisor when the supervisor owns live continuity.

## Trace-To-Skill

- Read `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md` or `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json`.
- Treat trace-to-skill output as a `soft-signal`: advisory workflow evidence, not an ordinary product-work blocker.

## Docker/Main-Repository Gate

- Main-repository submission requires a fresh passing Docker gate:
  `node .tools/auto-hermes-docker-gate.mjs --write`
- The Docker gate blocks publish paths only.
- It does not block normal local auto-commit.

## Execution

- Split work into bounded, disjoint lanes when possible.
- If OpenCode cannot run true parallel lanes, execute lanes sequentially while preserving lane ownership and merge-gate evidence.
- Reassess after each merge; do not stop after one successful lane if promotable work remains.

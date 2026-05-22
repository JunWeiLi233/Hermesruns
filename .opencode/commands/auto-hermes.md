# OpenCode `/auto-hermes`

Use this command as the OpenCode runtime note for the bounded Hermes `/auto-hermes` workflow.

## Continuity

- Empty queue does not immediately stop.
- `## Active Tasks` being empty is NOT a stop condition.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Promote queue candidates first; if none exist, seed suggestions; if still none, run website-audit fallback before stopping.

## Trace-To-Skill

- Read `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md` or `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json`.
- Treat trace-to-skill output as a `soft-signal`: evidence-backed guidance for workflow evolution, not a hard stop for normal product work.

## Docker/Main-Repository Gate

- Main-repository submission requires a fresh passing Docker gate:
  `node .tools/auto-hermes-docker-gate.mjs --write`
- The Docker gate blocks publish paths only.
- It does not block normal local auto-commit.

## Execution

- OpenCode has no native parallel subagent loop by default; execute bounded work directly or through the configured plugin helper.
- Preserve Hermes verification contracts from `AGENTS.md`.
- Do not claim live frontend/backend runtime changes without the relevant runtime proof gate.

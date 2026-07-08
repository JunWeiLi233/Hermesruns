# Hermes Self-Evolving Engine

This file is the promotion-plane note for the current Codex worktree.

## Continuity Rules

- Empty queue does not immediately stop.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.

## Control Plane

- `.tools/auto-hermes-supervisor.mjs` is the live continuity owner for repeated website-audit exhaustion decisions.
- The supervisor now drives the true stop contract for both `/auto-hermes` and `/auto-hermes-max`.
- The loop/coordinator helpers still own execution, but they now route continuity state and true-stop decisions through the supervisor instead of documenting it as a future integration.
- Queue exhaustion should be treated as a handoff into website-audit exploration before any final stop decision is made.
- Trace-to-skill is now the live repo-side workflow-learning layer: `.tools/auto-hermes-trace-to-skill.mjs` refreshes `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.{json,md}` plus the advisory repo-local skill `.codex/skills/auto-hermes-evolved/SKILL.md`.
- The evolved trace skill is automatic and repo-side only. It is advisory execution context for future rounds, not permission to mutate `AGENTS.md` or bypass runtime-proof gates.

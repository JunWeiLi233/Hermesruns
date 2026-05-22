---
name: auto-hermes-max
---

# Auto-Hermes Max

Codex command note for the bounded parent coordinator path.

## Continuity Rules

- Empty queue does not immediately stop.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.

## Command Notes

- Parent reassessment should treat website-audit as the first fallback when queue promotion runs dry.
- A single empty queue observation is not enough to stop the parent loop.
- `.tools/auto-hermes-supervisor.mjs` now owns the live continuity and repeated no-candidate stop contract for the parent loop.
- `/auto-hermes-max` remains coordinator-driven, but its true-stop decision is now fully routed through the supervisor instead of a modeled-only caveat.
- On a true clean parent stop, finish behavior now also routes through `.tools/auto-hermes-finish.mjs`: auto-commit only when needed, and auto-push is now also allowed when the stop leaves unpublished local commits on the current branch and `origin` still equals `https://github.com/520HXC/run.git`.

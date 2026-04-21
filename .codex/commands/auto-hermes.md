---
name: auto-hermes
---

# Auto-Hermes

Codex command note for the bounded auto-hermes control plane.

## Continuity Rules

- Empty queue does not immediately stop.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.

## Command Notes

- Use `.tools/auto-hermes-loop.mjs` for the current bounded loop owner behavior.
- `.tools/auto-hermes-supervisor.mjs` now owns the live continuity decision for repeated website-audit exhaustion inside the loop helper.
- `/auto-hermes` persists Ralph grounding artifacts and supervisor state in `.ai-sync` so the loop owner remains a real repo-backed execution surface rather than a prompt-only brief writer.
- Finish behavior now routes through `.tools/auto-hermes-finish.mjs`: auto-commit only when needed on a true clean stop with publishable product files, and auto-push is now also allowed when a clean stop leaves unpublished local commits on the current branch and `origin` still equals `https://github.com/520HXC/run.git`.

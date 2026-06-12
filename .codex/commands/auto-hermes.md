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
- Default executor-backed Codex/OMX worker rounds run in YOLO/full-permission mode: OMX Ralph uses `--madmax`, and the bundled Codex fallback uses `--dangerously-bypass-approvals-and-sandbox`.
- Planned Codex subagent lanes inherit that active executor permission context; do not silently downgrade agents to sandboxed `--full-auto` unless an explicit executor command/config overrides the default.
- Finish behavior now routes through `.tools/auto-hermes-finish.mjs`: auto-commit only when needed on a true clean stop with publishable product files, and auto-push is now also allowed when a clean stop leaves unpublished local commits on the current branch and `origin` still equals `https://github.com/520HXC/run.git`.

## Frontend Design Notes

- For non-trivial frontend rounds, read `design.md` before implementation and treat it as the final Hermes visual authority.
- Use `node .tools/auto-hermes-skills.mjs --json` as the frontend design skill manifest for `/auto-hermes` design-review rounds.
- The default frontend design stack is `hermes-dev`, `design-taste-frontend`, `frontend-design`, `ui-ux-pro-max` as supplemental research, Browser/browser-harness proof, and translation/accessibility skills when triggered.
- If the controller emits `designContext.frontendSkillStack`, carry those skills into the worker prompt and report missing required skills plainly instead of treating them as executed.

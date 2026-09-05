<!-- GENERATED FILE: edit .codex/commands and run node tools/generate-runtime-commands.mjs. -->
<!-- Runtime: opencode; command: /auto-hermes; contract: docs/ai/EDITING_CONTRACT.md -->

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

- Use `tools/auto-hermes-loop.mjs` for the current bounded loop owner behavior.
- `tools/auto-hermes-supervisor.mjs` now owns the live continuity decision for repeated website-audit exhaustion inside the loop helper.
- `/auto-hermes` persists Ralph grounding artifacts and supervisor state in `.workspace/state` so the loop owner remains a real repo-backed execution surface rather than a prompt-only brief writer.
- Default executor-backed Codex/OMX worker rounds run in YOLO/full-permission mode: OMX Ralph uses `--madmax`, and the Codex fallback prefers the installed `codex` CLI with `--dangerously-bypass-approvals-and-sandbox --dangerously-bypass-hook-trust` when supported, then falls back to bundled `codex-local`.
- Planned Codex subagent lanes inherit that active executor permission context; do not silently downgrade agents to sandboxed `--full-auto` unless an explicit executor command/config overrides the default.
- Finish behavior now routes through `tools/auto-hermes-finish.mjs`: auto-commit only when needed on a true clean stop with publishable product files, and auto-push is now also allowed when a clean stop leaves unpublished local commits on the current branch and `origin` still equals `https://github.com/JunWeiLi233/Hermesruns.git`.

## Shared Evidence And Publish Gates

- Read `.workspace/state/AUTO_HERMES_TRACE_TO_SKILL.md` or `.workspace/state/AUTO_HERMES_TRACE_TO_SKILL.json` when selecting workflow improvements. Treat repeated trace evidence as a `soft-signal`: it can guide process changes, but cannot block ordinary product work or replace fresh task verification, runtime proof, or reviewer approval.
- Before push or main-repository submission, run `node tools/auto-hermes-docker-gate.mjs --write` and require a fresh passing artifact for the current working tree. A stale or failed Docker result blocks publish paths only; it does not block normal local auto-commit when the local commit gates pass.
- A passing Docker gate does not authorize publication by itself. Preserve the shared finish contract, privacy checks, user authorization, and unrelated dirty work.

## Frontend Design Notes

- For non-trivial frontend rounds, read `design.md` before implementation and treat it as the final Hermes visual authority.
- Use `node tools/auto-hermes-skills.mjs --json` as the frontend design skill manifest for `/auto-hermes` design-review rounds.
- The default frontend design stack is `hermes-dev`, `design-taste-frontend`, `frontend-design`, `ui-ux-pro-max` as supplemental research, Browser/browser-harness proof, and translation/accessibility skills when triggered.
- If the controller emits `designContext.frontendSkillStack`, carry those skills into the worker prompt and report missing required skills plainly instead of treating them as executed.

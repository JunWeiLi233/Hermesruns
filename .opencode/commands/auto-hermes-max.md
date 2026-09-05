<!-- GENERATED FILE: edit .codex/commands and run node tools/generate-runtime-commands.mjs. -->
<!-- Runtime: opencode; command: /auto-hermes-max; contract: docs/ai/EDITING_CONTRACT.md -->

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
- `tools/auto-hermes-supervisor.mjs` now owns the live continuity and repeated no-candidate stop contract for the parent loop.
- `/auto-hermes-max` remains coordinator-driven, but its true-stop decision is now fully routed through the supervisor instead of a modeled-only caveat.
- On a true clean parent stop, finish behavior now also routes through `tools/auto-hermes-finish.mjs`: auto-commit only when needed, and auto-push is now also allowed when the stop leaves unpublished local commits on the current branch and `origin` still equals `https://github.com/JunWeiLi233/Hermesruns.git`.

## Shared Evidence And Publish Gates

- Read `.workspace/state/AUTO_HERMES_TRACE_TO_SKILL.md` or `.workspace/state/AUTO_HERMES_TRACE_TO_SKILL.json` during parent reassessment. This is a `soft-signal` for evidence-backed workflow improvements, not a hard stop or a substitute for lane verification, runtime proof, or the parent merge/review gate.
- Before push or main-repository submission, run `node tools/auto-hermes-docker-gate.mjs --write` and require a fresh passing artifact for the current working tree. The Docker gate blocks publish paths only and does not block normal local auto-commit after the local commit gates pass.
- Preserve the shared finish contract, privacy checks, user authorization, and unrelated dirty work. Neither an approved merge gate nor a Docker pass grants publication authority by itself.

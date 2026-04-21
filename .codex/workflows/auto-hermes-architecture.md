# Auto-Hermes Architecture

This file is the Codex-side control-plane summary for `/auto-hermes` and `/auto-hermes-max`.

## Continuity Rules

- Empty queue does not immediately stop.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.

## Ownership

- `.tools/auto-hermes-loop.mjs` and `.tools/auto-hermes-max-loop.mjs` remain the active loop owners.
- `.tools/auto-hermes-supervisor.mjs` is the active continuity owner for long-running runs because it carries the bounded exhaustion contract for both standard and max loop ownership.
- `/auto-hermes` and `/auto-hermes-max` now route repeated no-candidate exhaustion decisions through the supervisor instead of treating it as modeled-only intent.
- `.tools/auto-hermes-trace-to-skill.mjs` is the active repo-side learning owner: it turns repeated round evidence into soft workflow candidates and refreshes the advisory evolved skill at `.codex/skills/auto-hermes-evolved/SKILL.md`.

## Exhaustion Flow

1. The controller or parent loop can exhaust promotable queue work.
2. Exhaustion hands off to the website-audit explorer first.
3. A bounded audit candidate resets continuity and keeps the run alive.
4. Only repeated no-candidate audit rounds allow the live supervisor path to emit a true stop.

## Trace Skill Feedback

1. Round-close writes compact evidence packets into `.ai-sync/trace-to-skill/rounds/`.
2. The trace helper merges repeated success/failure/structure/edge evidence into soft workflow candidates.
3. The same helper refreshes the repo-local evolved trace skill.
4. Controller, worker prompt, and coordinator brief may use that evolved skill as advisory execution context only.

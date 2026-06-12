# Auto-Hermes Architecture

This file is the Codex-side control-plane summary for `/auto-hermes` and `/auto-hermes-max`.

## Continuity Rules

- Empty queue does not immediately stop.
- Website-audit explorer is the first exhaustion fallback.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.

## Ownership

- `.tools/auto-hermes-loop.mjs` and `.tools/auto-hermes-max-loop.mjs` remain the active loop owners.
- `.tools/auto-hermes-loop.mjs` owns the compact worker prompt profile: the live worker brief should keep selected task details, gate requirements, and artifact paths inline while leaving expanded routing, catalogs, and workflow detail in the controller/coordinator JSON.
- `.tools/auto-hermes-max.mjs` owns the compact lane prompt profile for `/auto-hermes-max`: each lane brief should keep ownership, dependency, verification, and result-packet requirements inline while deferring parent writeback and expanded merge state to durable artifacts.
- `.tools/auto-hermes-self-loop.mjs` is the Ralph-native indefinite self-loop owner for `/auto-hermes-self`; it reuses the Hermes controller/supervisor path but does not treat a single bounded round as the finish state.
- `.tools/auto-hermes-loop.mjs` owns the Codex executor permission default for `/auto-hermes` and `/auto-hermes-self`: OMX Ralph launches with `--madmax`, and bundled `codex-local` launches with `--dangerously-bypass-approvals-and-sandbox` so spawned worker/subagent lanes run in YOLO/full-permission mode unless explicitly overridden.
- `.tools/auto-hermes-supervisor.mjs` is the active continuity owner for long-running runs because it carries the bounded exhaustion contract for both standard and max loop ownership.
- `/auto-hermes` and `/auto-hermes-max` now route repeated no-candidate exhaustion decisions through the supervisor instead of treating it as modeled-only intent.
- `.tools/auto-hermes-structure-update.mjs` is the active structure-steering owner: it writes bounded control-plane repair suggestions into `TASKS.md` plus the advisory steering brief at `.ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.*`.
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

## Structure Update Steering

1. `/auto-hermes-structure-update` writes a ranked shortlist into `## Suggested Next Tasks` under `### Structure Update Recommendations`.
2. The same command writes `.ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.*` with one recommended default for the next eligible round.
3. The controller may prefer that recommended default only when it is still concrete, present, fresh, and no higher-priority active work already exists.
4. Structure steering is advisory; it does not override human-loop brakes or existing active must-fix work.

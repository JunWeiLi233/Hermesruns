# Hermes Agent Map

Use this file as the short entrypoint for work in this repository.

## Read Order

1. `AGENTS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/auto-hermes/index.md`
4. `docs/repo-rules/index.md`
5. `.ai-codex/optimized-codex.md`
6. `.ai-sync/CONTEXT_LEDGER.md`
7. `.ai-sync/AGENT_SYNC.md`
8. Read deeper owners only when needed.

## Core Policy

- Use the Hermes Codex skill at `.codex/skills/hermes-dev/SKILL.md` whenever working in this repo.
- Treat `/auto-hermes` as the official repo shortcut for the bounded autonomous Hermes workflow.
- Treat `/auto-hermes-max` as the repo-local parallel extension for one bounded parent round with a merge gate.
- Older `hermes-auto:` or `/hermes-auto` wording is deprecated; prefer `/auto-hermes`.
- `AGENTS.md` owns policy. `docs/PROJECT_MAP.md` owns the durable project architecture map. `docs/` and workflow files own deeper durable detail.

## Skill And Runtime Map

- Prefer installed `superpowers` skills as workflow helpers when they match the task.
- Prefer OMX workflow surfaces when available for broad clarification, planning, looping, or bounded parallel execution.
- Hermes-specific truth gates, runtime proof gates, design-review gates, and task discipline always outrank helper workflows.
- Repo-local Codex role briefs live in `.codex/agents/`.
- Repo-local external VoltAgent Codex agents live in `.codex/agents/voltagent-*.toml` and are optional support specialists, not replacements for Hermes-owned roles.

## Truth Rules

- Do not claim a tool, command, slash command, memory fact, or runtime state unless it was verified in this session or is explicitly documented as a repo convention.
- Do not claim a website/runtime change is live without passing the relevant runtime proof gate.
- Do not describe helper state as proof of live execution. Use wording like `self-loop armed in state` unless the coordinator is actually still running.
- If a capability is expected but unavailable, say so plainly and use the nearest verified fallback.

When facts conflict, prefer:

1. current tool output and command results
2. verified runtime checks and current filesystem state
3. installed skill/config files actually used by the running client
4. `AGENTS.md`
5. repo-local workflow docs and helper guides
6. MemPalace retrieval
7. older chat claims

If still uncertain, say `unverified` or `not confirmed here`.

## Session Start

Before broad work or implementation, run:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/generate-codex.js
& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent codex --tasks TASKS.md --guide AGENTS.md --queue-mode first --write
powershell -ExecutionPolicy Bypass -File .tools/mempalace/auto-session-sync.ps1 -Quiet
& 'C:\Program Files\nodejs\node.exe' .tools/omx-auto-hermes-bridge.mjs
```

Exception: for `/auto-hermes-self`, skip `.tools/generate-codex.js`; the self command/skill must run through the parent Codex session and spawn native subagents with `multi_agent_v1.spawn_agent` when delegation is needed.

Then read:

- `docs/PROJECT_MAP.md`
- `.ai-codex/optimized-codex.md`
- `.ai-sync/OMX_AUTO_HERMES_BRIDGE.md`
- `.ai-sync/CONTEXT_LEDGER.md`
- `.ai-sync/AGENT_SYNC.md`

Use RTK-wrapped shell reads/searches/status commands when RTK is available, but never treat RTK as proof of success.

## Task Execution

- Read `TASKS.md` before implementation when it exists.
- Unless the user says otherwise, work on the first unchecked task only.
- Extract only the active task, nearby note lines, and its `Verify:` step instead of rereading the whole file repeatedly.
- Use this order: active task -> relevant files -> focused search -> edit -> targeted verification -> update `TASKS.md`.
- If blocked, leave the task unchecked and add a short `Blocker:` line directly below it.
- Prefer small, verifiable changes and focused checks.

## Runtime Proof

For website-facing frontend changes:

- build with `cd frontend && node scripts/run-vite-build.mjs`
- verify with `.tools/verify-frontend-runtime-sync.mjs`

For backend/runtime changes:

- compile with `cd backend && ./mvnw -q -DskipTests compile`
- verify with `.tools/verify-backend-runtime-sync.mjs`
- require `http://localhost:8080` to return `200` before claiming the local runtime changed

If source changed but sync did not run, report:

- `source changed, live website not synced yet`

## Design Authority

- `design.md` is the default visual source of truth for meaningful Hermes UI work.
- Preserve product behavior, routing, auth, and real data wiring unless the task explicitly changes them.
- For non-trivial UI work, lock the surface, visual goal, preserve list, round type, and reference source before editing.
- Any changed user-facing copy must be updated in both locales.
- For meaningful UI/design changes, append a new entry to `DESIGN_VERSIONS.md`.

## Memory

- Prefer MemPalace for prior decisions, old regressions, and unfinished historical work when available.
- Use `memory.md` only as a tiny fallback for stable preferences or workflow invariants.
- Use `.ai-codex/CODEX_CHECKPOINT.md` as the active resume file for long-running work.

## Git And Publish

- Prefer a local commit as the normal finish state.
- Do not push by default.
- Before any commit or push, run the privacy/repo-hygiene pass and the required frontend/backend checks.
- Treat workflow files, screenshots, local exports, and machine-specific artifacts as local-only by default unless the user explicitly asks to publish them.

## Stack And Commands

Use `docs/repo-rules/stack-and-commands.md` for:

- stack facts
- core backend/frontend commands
- key env vars
- coding conventions
- terminal permission strategy

## `/auto-hermes` Owners

Use these authority boundaries:

- `AGENTS.md` = policy plane
- `docs/auto-hermes/index.md` = record-system map
- `.codex/workflows/auto-hermes-architecture.md` = control plane
- `.codex/workflows/hermes-multi-agent.md` = delegation plane
- `HERMES_SELF_EVOLVING_ENGINE.md` = promotion plane
- `TASKS.md` plus `.ai-sync/*` = state plane
- `.tools/auto-hermes-controller.mjs` = deterministic routing brief
- `.tools/auto-hermes-loop.mjs` = loop owner / worker-coordinator prompt truth
- `.tools/auto-hermes-round-close.mjs` = round writeback and promotion refresh

If a rule changes enduring `/auto-hermes` behavior, update the smallest owning file instead of growing `AGENTS.md`.

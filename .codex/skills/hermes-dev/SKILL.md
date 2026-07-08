---
name: hermes-dev
description: Hermes repository workflow and conventions for Codex. Use when working in C:\Users\Junwei\Downloads\Hermes or on the Hermes app, especially for Spring Boot backend, React frontend, H2/Postgres data flows, Google or Strava OAuth, Stripe billing, admin tooling, runner analytics, coach scheduling, and shoe import features.
---

Use this skill whenever the task is in the Hermes repository or clearly about Hermes product behavior.

Core workflow
- Read `AGENTS.md` first and only read `CLAUDE.md` when stack, command, or environment details are needed.
- Exception for `/auto-hermes-self`: do not run `.tools/generate-codex.js`; execute through the command's parent-Codex workflow and spawn Codex-native subagents with `multi_agent_v1.spawn_agent` from the active session when delegation is needed.
- At session start, before broad queued work or implementation, run:
  - `& 'C:\Program Files\nodejs\node.exe' .tools/generate-codex.js`
  - `& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent codex --tasks TASKS.md --guide AGENTS.md --queue-mode first --write`
  - `powershell -ExecutionPolicy Bypass -File .tools/mempalace/auto-session-sync.ps1 -Quiet`
- Read `.ai-sync/AGENT_SYNC.md` before reclaiming queue work or a user-visible surface.
- Read `.ai-codex/optimized-codex.md` before broad scanning.
- If `TASKS.md` exists and the user is asking for execution, read only the first unchecked task plus its nearby note lines.
- Match existing patterns before introducing new abstractions.
- Keep frontend and backend contracts in sync in the same task.
- Prefer minimal end-to-end fixes over broad rewrites.
- Start with the narrowest relevant files before doing wider discovery.

Truthfulness rules
- Do not claim a shortcut, tool, or runtime state unless it was verified from current tools, config, repo files, runtime checks, or retrieval.
- Treat `/auto-hermes*` as a native Codex command only after verifying the matching file exists under the active `$CODEX_HOME\prompts` or `$CODEX_HOME\commands`; otherwise treat it as a repo shortcut backed by `.codex/commands/`.
- Use MemPalace retrieval or cited files before claiming prior decisions or past fixes.

Project map
- Frontend: `frontend/src` with page components, shared UI, contexts, and data utilities.
- Backend: `backend/src/main/java/com/hermes/backend` with controllers, services, repositories, filters, and schedulers.
- Static frontend build output is served by the backend.

Verification
- Frontend checks: `cd frontend && npm run lint`, `cd frontend && npm run build` when UI or bundling changes.
- Backend checks: `cd backend && ./mvnw test` when coverage exists, otherwise `cd backend && ./mvnw -DskipTests compile`.
- Prefer targeted verification tied to the files changed.
- Avoid expensive verification that is unrelated to the edited code.

Risk areas
- OAuth, Stripe, admin endpoints, file uploads, Strava or Garmin sync, and scheduled jobs need extra care.
- Preserve H2 development compatibility unless the task explicitly targets PostgreSQL behavior.
- Never hardcode secrets; rely on env-var-driven configuration.

Read `references/repo-notes.md` if you need a compact summary of repository-specific architecture and conventions.

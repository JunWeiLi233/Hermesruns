# Compact Agent Context

This is the bounded bootstrap for an AI-assisted Hermes task. Read it with
`AGENTS.md` and `EDITING_CONTRACT.md`; do not preload project histories.

## Product and stack

Hermes is a local-first running coach. The React 19/Vite frontend lives in
`frontend/`; the Spring Boot/Java backend lives in `backend/`. The backend
serves the built SPA and API routes use `/api`.

## Start a task

1. Inspect `git status` and preserve unrelated work.
2. For implementation work, read only the relevant `TASKS.md` item and its
   nearby verification note.
3. Locate the owning route, component, controller, service, or test with
   `rg`, then read the corresponding section of `docs/PROJECT_MAP.md` only if
   the local code does not establish the boundary.
4. Use the smallest relevant lint, test, build, or runtime proof command.

## Where to look next

- Frontend routes and providers: `frontend/src/App.jsx`; API client:
  `frontend/src/api.js`; runtime stylesheet entrypoint: `frontend/src/index.css`.
- Backend entrypoint: `backend/src/main/java/com/hermes/backend/BackendApplication.java`.
- User-facing copy: `frontend/src/i18n/translations.js` and localized modules.
- Visual work: `design.md`; current design history is searchable in
  `DESIGN_VERSIONS.md`.

## Historical and coordinated work

`README.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`, and
`DESIGN_VERSIONS.md` are searchable archives, not bootstrap context. Consult a
specific matching section only when a task needs its prior decision, handoff,
or visual history. Prefer `rg -n -C 3 '<surface or task key>' <file>` over
reading an entire archive.

Current filesystem state, command output, and the active user request outrank
these archives. If an archive conflicts with them, report it as stale rather
than following it.

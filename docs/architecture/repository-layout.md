# Repository Layout

This repository contains the Hermes web application. The unrelated native iOS
project, its dedicated planning documents and its validation command are removed.

## Start Here

| Directory | What belongs here |
| --- | --- |
| `frontend/` | Browser pages, UI components, styles and frontend tests |
| `backend/` | Spring application, domain packages and backend tests |
| `docs/` | Setup, architecture, product and workflow documentation |
| `tools/` | Repository checks, build helpers, imports and automation scripts |
| `.workspace/` | Coordination state, checkpoints, disposable caches and scratch files |

Open `Hermes.code-workspace` in VS Code or another compatible editor. Frontend
and Backend are the first two roots; Documentation and Repository Tools follow.
The final Repository & Integrations section contains root setup and tool adapters
without repeating the application directories. This affects navigation only.

For a URL-to-code map, open `frontend/src/pages/README.md`.

## Root Files

These files have distinct roles and should not be deleted just to shorten the root:

| Files | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | Repository commands and reproducible tooling dependencies |
| `Dockerfile`, `.dockerignore` | Production container build and context exclusions |
| `.git`, `.gitignore`, `.gitattributes` | Worktree linkage, local-file exclusions and line-ending policy |
| `.coderabbit.yaml`, `.trivyignore`, `SECURITY.md` | Review integration, security scan policy and reporting guidance |
| `.env.example`, `Hermes.local.env.example.ps1` | Shell-specific setup examples without local secrets |
| `AGENTS.md`, `GEMINI.md`, `TASKS.md`, `HERMES_SELF_EVOLVING_ENGINE.md` | Active agent/workflow entry points and work queue |
| `design.md`, `DESIGN_VERSIONS.md` | Visual authority and design history |
| `README.md`, `README.zh-CN.md`, `Hermes.code-workspace` | Human project entry points |
| `start_hermes.bat`, `start_hermes.sh` | Main Windows and POSIX launchers |
| `stop_hermes.cmd`, `stop_hermes.ps1`, `stop_hermes.sh` | Windows wrapper/implementation and POSIX stop entry point |
| `start_hermes_postgres.ps1` | Optional bundled PostgreSQL startup, distinct from the main launcher |
| `migrate_h2_to_postgres.bat`, `migrate_h2_to_postgres.sh` | Explicit, data-changing H2-to-PostgreSQL maintenance commands |

The obsolete `stop_hermes.bat` (blanket Java/Python termination), unreferenced
`start_hermes_local.ps1` wrapper and stale April sprint ticket were removed.
Claude's PM integration can still generate a new `TICKET.md` when a handoff needs
one; only the old artifact was deleted. The useful glossary formerly named
`CONTEXT.md` now lives at `docs/domain-glossary.md`.

The main Windows launcher already loads `Hermes.local.env.ps1`; it does not need
the removed local-start wrapper. Startup/shutdown and migration scripts were not
executed during cleanup. Database, environment and process-control behavior of
the retained scripts was not otherwise changed.

## Integrations Stay Discoverable

`.agents`, `.codex`, `.claude`, `.gemini`, `.opencode`, `.omx`, `.codeant`,
`.github` and `.railway` stay at the root. Their tools discover configuration at
those locations; moving them into a generic directory would disable discovery.
Claude, Gemini, OpenCode, OMX, Codex, CI, code analysis and Railway are retained.
Permission/security settings are not rewritten by this reorganization.

In this Windows checkout, integration dotfolders and `.workspace` are marked
Hidden to keep ordinary Explorer navigation focused on the web application.
Explorer's View > Show > Hidden items reveals them. Hidden attributes are local
filesystem metadata, not a Git setting or a security boundary.

## Workspace State

- `.workspace/state/`: shared automation coordination and existing records.
- `.workspace/codex/`: local Codex checkpoint and generated context.
- `.workspace/cache/`: disposable Vite staging, fingerprints and local tool cache.
- `.workspace/tmp/`: scratch work and retained verification evidence.

The old `.tools`, `.ai-sync`, `.ai-codex`, `tmp` and `.tmp` root directories have
no forwarding aliases. Repository commands, scripts and adapter documentation use
the new paths. An externally saved command with an old path must be updated.
Root npm commands such as `npm run test:tooling` remain the stable entry points.

Workspace caches, checkpoints and scratch files are ignored by Git. Historical
coordination records are preserved locally, not republished. Docker excludes the entire
workspace container. Do not put application source or secrets in workspace state.

## Verification

The migration passes the root-layout check, architecture and feature-owner checks,
frontend typecheck, 80 unit tests, 330 contracts, lint and production build.
Ten targeted Garmin/console backend tests pass. Tooling passes 26 of 27 files;
the remaining file has the same three pre-existing adapter-documentation failures.
The new cache and scratch paths retain local-only publication classification.
No deployment or live-site verification is claimed.

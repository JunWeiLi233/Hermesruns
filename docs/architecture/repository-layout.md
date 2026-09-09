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
| `.trivyignore`, `SECURITY.md` | Security scan policy and reporting guidance |
| `.env.example`, `Hermes.local.env.example.ps1` | Shell-specific setup examples without local secrets |
| `README.md`, `README.zh-CN.md`, `Hermes.code-workspace` | Human project entry points |
| `start_hermes.bat`, `start_hermes.sh` | Main Windows and POSIX launchers |
| `stop_hermes.cmd`, `stop_hermes.ps1`, `stop_hermes.sh` | Windows wrapper/implementation and POSIX stop entry point |
| `start_hermes_postgres.ps1` | Optional bundled PostgreSQL startup, distinct from the main launcher |
| `migrate_h2_to_postgres.bat`, `migrate_h2_to_postgres.sh` | Explicit, data-changing H2-to-PostgreSQL maintenance commands |

The obsolete `stop_hermes.bat` (blanket Java/Python termination), unreferenced
`start_hermes_local.ps1` wrapper and stale April sprint ticket were removed.
The useful glossary formerly named `CONTEXT.md` now lives at `docs/domain-glossary.md`.

The main Windows launcher already loads `Hermes.local.env.ps1`; it does not need
the removed local-start wrapper. Startup/shutdown and migration scripts were not
executed during cleanup. Database, environment and process-control behavior of
the retained scripts was not otherwise changed.

## Integrations Stay Discoverable

`.github` contains CI configuration. Railway uses the root `Dockerfile` and
the deployment settings described in [the setup guide](../setup.md).
Machine-specific service links and credentials remain local.

## Workspace State

Disposable build caches and scratch files live under `.workspace/`, which is
ignored by Git and excluded from Docker. Keep application source in `frontend/`
or `backend/` and public documentation in `docs/`.

## Verification

Use the commands in [the frontend guide](../../frontend/README.md) and
[the backend guide](../../backend/README.md). A successful build verifies source
and packaging; check the running page separately before claiming a live change.

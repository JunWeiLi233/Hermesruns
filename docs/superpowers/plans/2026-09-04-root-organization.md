# Repository Root Organization Implementation Plan

> **For agentic workers:** Use subagent-driven development for the independent iOS removal; retain a single owner for the root path migration.

**Goal:** Make web application code, repository tools, and workspace state easy to distinguish; remove the unrelated native iOS project.

**Architecture:** Keep frontend, backend and docs at the root. Promote the hidden script directory to tools without changing script depth, and consolidate coordination state, checkpoints and temporary output under .workspace. Preserve fixed-location third-party integrations and keep them out of ordinary navigation using the app-first editor workspace and Windows Hidden attributes.

**Tech Stack:** React/Vite, Spring/Maven, Node tooling and PowerShell launchers.

## Work

- [x] Remove ios, its dedicated plans, npm validation command and CI references; retain web/backend behavior.
- [x] Capture the current tooling baseline and add a root-layout regression check.
- [x] Move repository-owned folders and update executable paths, imports, launchers, ignore rules, documentation and tool adapters. Do not alter permissions or secret settings.
- [x] Add a concise root/workspace ownership guide and update project navigation.
- [x] Run tooling, frontend contracts/typecheck, architecture and context checks; distinguish existing failures from regressions. Verify iOS and old directories are absent.

## Preserve

- Existing source changes and Git history; no commit or push in this task.
- Fixed-location tool discovery and permission/security configuration.
- Local data, workflow records, package dependencies and required runtime assets.
- Historical verification reports; moving their storage does not rerun their checks.

---
agent: 'agent'
description: 'Back up the current main repo state onto the current repo save-old-version branch, then cherry-pick a source repo ref into the current repo'
---

Use the Hermes `/auto-hermes-submit-main` workflow for this repository.

Before doing anything substantial:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Codex command note](../../.codex/commands/auto-hermes-submit-main.md).
3. Read [Git and publish rules](../../docs/repo-rules/git-and-publish.md).

Then execute the workflow with these rules:

- Always use the current repo's `save-old-version` branch as the backup target.
- If `save-old-version` is missing locally but exists on `origin`, create or switch the local branch to track it before backing up.
- If `save-old-version` is missing locally and on `origin`, stop and report it clearly.
- Back up the current main-repo state onto `save-old-version` before any cherry-pick happens.
- If the backup commit fails, stop and do not cherry-pick anything.
- Prefer cherry-pick over merge.
- Never push automatically.
- Never rewrite history, reset, or silently resolve conflicts.
- If a source repo path is provided, use a temporary local remote/fetch flow instead of ad hoc file copying.

Optional source repository path:
${input:source_repo_path:What source repo path should the cherry-pick come from? Leave blank to use the current repo.}

Optional source ref:
${input:ref:Which commit or ref should be cherry-picked? Default: HEAD}

---
agent: 'agent'
description: 'Back up the current main repo state into a user-supplied backup repo, then cherry-pick a source repo ref into the current repo'
---

Use the Hermes `/auto-hermes-submit-main` workflow for this repository.

Before doing anything substantial:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Codex command note](../../.codex/commands/auto-hermes-submit-main.md).
3. Read [Git and publish rules](../../docs/repo-rules/git-and-publish.md).

Then execute the workflow with these rules:

- Require `backup_repo_path` every time. Do not proceed without it.
- Verify both the current repo and the backup repo are valid Git repositories.
- Back up the current main-repo state into the backup repo before any cherry-pick happens.
- If the backup commit fails, stop and do not cherry-pick anything.
- Prefer cherry-pick over merge.
- Never push automatically.
- Never rewrite history, reset, or silently resolve conflicts.
- If a source repo path is provided, use a temporary local remote/fetch flow instead of ad hoc file copying.

Required backup repository path:
${input:backup_repo_path:What backup repo path should receive the pre-cherry-pick backup commit?}

Optional source repository path:
${input:source_repo_path:What source repo path should the cherry-pick come from? Leave blank to use the current repo.}

Optional source ref:
${input:ref:Which commit or ref should be cherry-picked? Default: HEAD}

Optional backup branch name:
${input:backup_branch:What backup branch should be used in the backup repo? Leave blank to use a timestamped default.}

---
agent: 'agent'
description: 'Guarded publish workflow: refresh README diagrams, scan for personal/API leaks, push the current branch, and open a PR into main on 520HXC/run'
---

Use the Hermes `/auto-hermes-push-main` workflow for this repository.

Before doing anything substantial:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Codex command note](../../.codex/commands/auto-hermes-push-main.md).
3. Read [Git and publish rules](../../docs/repo-rules/git-and-publish.md).

Then run the helper in dry-run mode first:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-push-main.mjs --write --message "${input:message:Publish message}"
```

If the dry-run plan is correct and the user explicitly wants publication, execute:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-push-main.mjs --execute --write --message "${input:message:Publish message}"
```

Rules:

- Publish only to `origin = https://github.com/520HXC/run.git`.
- Do not push to any other remote.
- Create a pull request into `main`; never push directly to `main`.
- Push only the current source branch to `origin` before opening the PR.
- Never cherry-pick, rebase, merge, reset, or rewrite history as part of this workflow.
- Always refresh README architecture docs with `/auto-hermes`, SaaS, and AI agents diagrams.
- Always run the repo security/leak scan and block on suspected personal data, API keys, tokens, secrets, passwords, or config leaks.
- Stop if the current branch is `main` or detached.
- Report the source branch, source commit, and PR URL on success.

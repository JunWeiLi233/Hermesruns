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

- This is the **only supported** way to submit a PR into the Hermes main repo. Do not push directly, do not `gh pr create` manually, do not cherry-pick, rebase, merge, reset, or rewrite history as part of this workflow.
- Publish only to `origin = https://github.com/520HXC/run.git`. Do not push to any other remote.
- Create a pull request into `main`; never push directly to `main`.
- Push only the current source branch to `origin` before opening the PR.
- Always refresh README architecture docs with `/auto-hermes`, SaaS, and AI agents diagrams.
- Always run the repo security/leak scan and block on suspected personal data, API keys, tokens, secrets, passwords, or config leaks. Do not pass `--skip-checks` unless the user explicitly authorizes bypassing a verified false positive and the PR body documents which gate was bypassed and why.
- Stop if the current branch is `main` or detached.
- Report the source branch, source commit, and PR URL on success.

Commit & PR citation rules (mandatory — full spec in [`.codex/commands/auto-hermes-push-main.md`](../../.codex/commands/auto-hermes-push-main.md#commit--pr-citation-rules)):

- Commit title: `<type>: <imperative summary ≤ 70 chars>` with `<type>` ∈ {`feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `revert`}. Name a concrete artifact. Reject `update`, `fix bug`, `wip`, `auto-hermes: round complete`.
- Commit body: one paragraph per touched surface, cite file paths inline, explain *why* (the diff already shows *how*). Trailers: `Closes #N` then `Co-Authored-By:` per collaborator with AI agents last.
- PR body requires three sections: `## Summary` (one bullet per surface), `## Test plan` (checklist of verification commands you actually ran), `## Files of interest` (≤ 5 hotspots with one-line reasons).
- Cite runtime proof for runtime claims (browser screenshot path, `verify-frontend-runtime-sync.mjs` output). For "tests pass", name the test class. For concurrent-agent bundling, list each non-self-authored surface in a `## Concurrent-agent bundling` section so the reviewer knows what you cannot speak to.
- Never claim ownership of code you didn't write. Never use the auto-generated PR title — override with `--pr-title`.

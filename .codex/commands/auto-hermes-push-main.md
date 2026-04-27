---
name: auto-hermes-push-main
description: Guarded publish workflow — runs all gates, pushes the current branch, and opens a PR into main on https://github.com/520HXC/run.
---

# Auto-Hermes Push Main

Codex command for the guarded Hermes publish workflow. Creates a **pull request** into `main` — no direct pushes, no cherry-picks.

## Purpose

Use `/auto-hermes-push-main` when the current branch is ready for review and merge into `main` at `https://github.com/520HXC/run`.

The workflow:
- Always verifies `origin` is `https://github.com/520HXC/run.git`
- Always verifies git identity is `JunWeiLi233 / mcpejunwei@gmail.com`
- Always refreshes `README.md` and architecture diagrams before publishing
- Always scans for secrets, PII, API keys, config leaks, and sensitive endpoint leaks
- Pushes the current branch to remote
- Opens a PR from the current branch into `main` via `gh pr create`
- **Never** pushes directly to `main`, **never** cherry-picks, **never** rewrites history

## Execution

Dry-run (validates gates without pushing or creating PR):
```bash
node .tools/auto-hermes-push-main.mjs --write
```

Execute (pushes branch and creates PR):
```bash
node .tools/auto-hermes-push-main.mjs --execute --write --message "publish: <summary>"
```

Custom PR title and body:
```bash
node .tools/auto-hermes-push-main.mjs --execute --write \
  --message "publish: fix session expiry redirect" \
  --pr-title "fix: session expiry redirects to login with return path" \
  --pr-body "Closes #123. Gates passed: security, lint, compile."
```

## Required Gates

The helper stops before creating the PR when any gate fails:
- Wrong or missing `origin`
- Wrong git identity
- Publish-blocking secret/PII/API/config leak finding
- Frontend lint failure
- Backend compile failure
- Docker/main-repository gate failure
- Auto-commit guard failure
- Attempting to create a PR from `main` into itself

## Branch Semantics

- Source: current branch (`HEAD`)
- Target: `main`
- The branch is pushed to `origin` before the PR is created
- Requires `gh` CLI installed and authenticated (`gh auth login`)
- No merge commits, rebases, cherry-picks, or history rewrites

## Outputs

- `.ai-sync/AUTO_HERMES_PUSH_MAIN.json`
- `.ai-sync/AUTO_HERMES_PUSH_MAIN.md`
- `.ai-sync/security-reports/*` from the security scan
- Updated `README.md`
- Updated `docs/architecture/*.svg` / `*.html`
- PR URL printed to stdout

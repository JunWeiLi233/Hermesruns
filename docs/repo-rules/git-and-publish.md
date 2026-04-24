# Git And Publish

This file owns commit, push, privacy, and pre-publish rules.

## Default Posture

- Prefer a local commit as the normal finish state.
- Do not push by default.
- Push only when the user explicitly wants publication or there is a real agreed publish need.
- The only approved auto-push target is `origin = https://github.com/520HXC/run.git`.

## Never Push When

- any active task is still unfinished
- the backend fails to compile
- the change is a partial implementation
- only local workflow files changed
- the only reason is “the loop finished”

## Required Pre-Push Safety Pass

Before any commit or push:

1. run `git status --short`
2. ensure git identity is `JunWeiLi233 / mcpejunwei@gmail.com`
3. check for local-only workflow files, screenshots, exports, secrets, and machine-specific artifacts
4. review `README.md` if the change is user-visible
5. update `.gitignore` first when local-only artifacts need to stay out of Git

Treat these as local-only by default unless the user explicitly asks to publish them:

- `.claude/`, `.codex/`, `.agents/`, `.ai/`
- `AGENTS.md`, `CLAUDE.md`, `TASKS.md`
- task screenshots and local exports
- local env/config/log files

## Main Repository Docker Gate

Before any push or “submit to main repository” action:

1. run the Docker publish gate helper:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-docker-gate.mjs --write
```

2. require a fresh passing `.ai-sync/AUTO_HERMES_DOCKER_GATE.json`
3. if the working tree changes after the Docker gate runs, rerun the helper before pushing

This gate does **not** block normal local auto-commit. It blocks only push/mainline submission.

## Required Checks

After frontend code edits:

```bash
cd frontend && npm run lint
```

Before every commit:

```bash
cd frontend && npm run lint
cd backend && ./mvnw -q -DskipTests compile
```

Do not commit if the backend compile fails.

Before every push/main-repository submission:

```bash
cd frontend && npm run lint
cd backend && ./mvnw -q -DskipTests compile
node .tools/auto-hermes-docker-gate.mjs --write
```

## Auto-Commit

For `/auto-hermes` finish behavior, the canonical helper is:

- `.tools/auto-commit.ps1`
- `.tools/auto-hermes-finish.mjs`

`needed` means the run hit a true clean stop and there are publishable product files left after policy filtering.
For `/auto-hermes` and `/auto-hermes-max`, `needed` for auto-push means the run reached a true clean stop and is already producing a publishable product commit.

Not `needed`:
- the loop only refreshed workflow or memory artifacts
- the stop happened because of a blocker, executor failure, or max-iteration cap
- no publishable product files changed

Only commit publishable product files. Do not blindly stage workflow or local-only files.
When `-Push` is requested, the auto-commit path also requires a fresh passing Docker gate artifact that matches the current working tree.

# Git And Publish

This file owns commit, push, privacy, and pre-publish rules.

## Default Posture

- Prefer a local commit as the normal finish state.
- Do not push by default.
- Push only when the user explicitly wants publication or there is a real agreed publish need.
- The only approved auto-push target is `origin = https://github.com/520HXC/run.git`.
- **The only supported path to open a PR into `main` is `/auto-hermes-push-main`** (driver: `.tools/auto-hermes-push-main.mjs`). Direct `git push origin main`, manual `gh pr create`, cherry-picks, rebases onto main, force-pushes, and history rewrites are forbidden. The helper enforces every required gate (security scan, lint, compile, Docker, identity) and writes an auditable artifact at `.ai-sync/AUTO_HERMES_PUSH_MAIN.{md,json}`. See the full spec and citation rules in [`.codex/commands/auto-hermes-push-main.md`](../../.codex/commands/auto-hermes-push-main.md).

## Never Push When

- any active task is still unfinished
- the backend fails to compile
- the change is a partial implementation
- only local workflow files changed
- the only reason is “the loop finished”

## Required Pre-Push Safety Pass

Before any commit or push:

1. run `git status --short`
2. ensure git identity matches the project-approved publish identity, preferably using a GitHub noreply address
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

## Commit Message and PR Body Citation

Every commit that lands via `/auto-hermes-push-main` must follow the citation rules in [`.codex/commands/auto-hermes-push-main.md`](../../.codex/commands/auto-hermes-push-main.md#commit--pr-citation-rules). Short version:

- **Commit title**: `<type>: <imperative summary ≤ 70 chars>`. `<type>` ∈ {`feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `revert`}. Name a concrete artifact. Reject vague verbs (`update`, `fix bug`, `wip`).
- **Commit body**: one paragraph per touched surface, cite file paths inline, explain WHY not HOW. Trailers: `Closes #N`, then `Co-Authored-By:` per collaborator with AI agents last.
- **PR body**: required sections `## Summary` (one bullet per surface), `## Test plan` (checklist of verification commands actually run), `## Files of interest` (≤ 5 hotspots). Add `## Concurrent-agent bundling` when the PR includes another agent's uncommitted work.
- Cite runtime proof for runtime claims (browser screenshot, runtime-sync artifact). For "tests pass", name the test class. Never claim ownership of code you didn't write.

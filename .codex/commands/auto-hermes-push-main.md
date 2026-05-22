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
- Verifies git identity when `AUTO_HERMES_EXPECTED_USER_NAME` or `AUTO_HERMES_EXPECTED_USER_EMAIL` is configured
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
- Wrong git identity when an expected publish identity is configured
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

## Commit & PR Citation Rules

The README directs every contributor — human or AI agent — to use this command as the **only** path that opens a PR into `main`. The reviewer's first read is the commit title and the PR body, so the citation in those two surfaces has to carry the change. These rules are mandatory for AI agents driving the command and strongly recommended for humans.

### Commit title

- Shape: `<type>: <imperative summary>` — e.g. `fix: scale paintRoutePoint brush with adaptive cellMeters`.
- `<type>` is one of `feat` (new user-visible capability), `fix` (bug repair), `perf` (no behavior change, faster), `refactor` (no behavior change, restructure), `docs`, `test`, `chore`, `revert`.
- Imperative mood, present tense ("add" not "added").
- ≤ 70 characters.
- No issue numbers or emoji in the title.
- Name a concrete artifact when possible — file, function, route, surface. "fix bug" is rejected; "fix(territory): seal sub-pixel wall gaps on adaptive grid" is accepted.

### Commit body

- One blank line after the title.
- One paragraph per touched surface — what changed, then why. Cite the file path inline (`backend/src/.../TerritoryPolygonComputer.java`), not in a separate "Files" list.
- Explain WHY, not HOW. The diff already shows how.
- Hard-wrap at ~80 chars; do not collapse multi-paragraph content to one long line.
- End with trailer lines: `Co-Authored-By: <name> <email>` for every collaborator (humans first, AI agents last). AI co-author lines use `Claude Opus 4.7 <noreply@anthropic.com>` / `Gemini 2.5 Flash <noreply@google.com>` / equivalent.
- When the commit closes an issue, add `Closes #N` as a trailer below the body and above co-authors.
- Never collapse multiple unrelated changes into one commit message. If the diff spans Territory + Rewards + auth, the title leads with the primary surface and the body names the others; if they're truly unrelated, split into separate commits *before* running this command.

### PR title

- Mirror the commit title verbatim when the PR is one commit.
- For multi-commit PRs, use the same `<type>: …` shape but summarize the bundle (`feat: territory polygon fix + rewards ledger redesign`).
- Never use the auto-generated "Auto-generated PR from Hermes auto-hermes-push-main workflow" title — the agent must replace it via `--pr-title` or by editing the PR after creation.

### PR body — required sections

```markdown
## Summary

- <surface 1>: one-bullet what changed and why. Cite file paths inline.
- <surface 2>: …
- <surface 3>: …

## Test plan

- [x] <verification command actually run, e.g. `cd backend && ./mvnw test -Dtest=TerritoryPolygonComputerTests`>
- [x] <frontend gate, e.g. `cd frontend && npm run lint` (0 errors)>
- [x] Browser proof: <route> at <viewport> → `task-images/<path>.jpg`
- [ ] <anything intentionally skipped, with reason>

## Files of interest

- `<path>:<line-range>` — one-line reason a reviewer should read this region first
- …

(Optional sections)
## Risk and rollback
## Concurrent-agent bundling
## Closes / Refs
```

### Citation requirements

- **Cite the touched files, not the categories.** "Updated CSS" is rejected; "added `.rewards-ledger-page` block in `frontend/src/styles/style.css:79580+`" is accepted.
- **Cite runtime proof for runtime claims.** If you claim "fixes the territory disappearance", paste the path to the verifying screenshot or `verify-frontend-runtime-sync.mjs` output. Without proof, downgrade the claim to "expected to fix" in the body.
- **Cite the gates you actually ran.** Don't say "all tests pass"; say which test class or which lint scope you actually ran. The PR template's Test plan is a *checklist of what you did*, not a wish list.
- **Cite concurrent-agent bundling.** When the working tree includes uncommitted work from another agent and you choose to push it together, add `## Concurrent-agent bundling` listing each non-self-authored surface and the agent name (e.g. `Territory page redesign in Territory.jsx — by codex-runner`). The reviewer needs to know which sections you can't speak to.
- **Cite the security scan result.** Reference the `.ai-sync/security-reports/*` artifact the command produced. If you sanitized a finding (deleted a local file, added a gitignore rule), say what you did and why it was legitimate — never just "false positive".
- **Never claim ownership of code you didn't touch.** If the diff includes a file you didn't write, the Summary bullet says so ("Bundled from working tree: …").

### Anti-patterns the command and reviewers reject

- Title: `update`, `fix bug`, `cleanup`, `wip`, `misc`, or `auto-hermes: round complete` — too vague to cite.
- Body: empty, or `(see diff)`, or marketing copy ("polish the experience", "make it pop").
- Bypass: `--skip-checks` without an explicit user authorization message in the PR body explaining which gate is being bypassed and why.
- Co-author hallucination: listing an AI agent that didn't write code in this commit.
- "Tests pass" without naming which tests. "Lint passes" without naming the file scope. "Build succeeds" without the build command.
- Force-push, cherry-pick, rebase-onto-main, or any history rewrite as part of the publish flow — the command refuses these by design; the contributor must not work around it.

### Minimal good example

```
fix(territory): seal sub-pixel wall gaps on adaptive grid

paintRoutePoint in TerritoryPolygonComputer.java used a fixed 6 m brush
regardless of cellMeters. When the adaptive grid grew cellMeters past
~10 m for large routes, the brush no longer covered the cell containing
the route point and adjacent walls developed 1-cell gaps. Flood-fill
leaked into the interior, producing broken-dotted-line route renders.

Fix scales the brush radius with `Math.max(6, cellMeters * 0.75)` and
always marks the containing cell. Bumps LAND_MASK_PREFIX v5 -> v6 so
stale polygon rows recompute on next read.

Test: cd backend && ./mvnw test -Dtest=TerritoryPolygonComputerTests → 23/23 pass
Browser: task-images/territory-zoomfix-default.jpg

Closes #41

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

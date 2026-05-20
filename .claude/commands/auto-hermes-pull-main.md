# Auto-Hermes Pull Main

Safely sync the local Hermes repo with the latest commits on GitHub
(`https://github.com/520HXC/run.git`). Counterpart to `/auto-hermes-push-main`.

## When to use it

Run when another contributor (or your own laptop on another machine) has
pushed to `main` — or to your current feature branch's upstream — and you
want those changes locally without losing your uncommitted work.

Refuses to run when:
- the working directory is not a git repo,
- HEAD is detached,
- the remote `origin` does not point at `https://github.com/520HXC/run.git`,
- the working tree is dirty AND `--no-stash` is passed.

## How to invoke

Slash command in Claude Code / Codex:

```
/auto-hermes-pull-main
```

Direct CLI from repo root:

```bash
# Dry-run — shows what would be pulled, never touches the tree.
node .tools/auto-hermes-pull-main.mjs

# Execute — actually pulls, auto-stashing dirty work first.
node .tools/auto-hermes-pull-main.mjs --execute --write

# Rebase your feature branch on top of main (vs. the default merge).
node .tools/auto-hermes-pull-main.mjs --execute --write --strategy rebase

# Pull a non-default target branch.
node .tools/auto-hermes-pull-main.mjs --execute --write --target-branch main
```

## What the command runs, in order

1. **Sanity checks** — confirm `.git/` exists, `origin` matches the expected
   GitHub URL, HEAD is on a real branch (not detached).
2. **Fetch** — `git fetch origin --prune` to learn the latest remote refs
   without touching the working tree.
3. **Inspect** — compute `git rev-list --left-right --count HEAD...<target>`
   to report how many commits each side is ahead/behind. Lists the commits and
   files about to be applied.
4. **Strategy resolution** — if `--strategy` isn't passed:
   - `main` branch → `ff-only` (refuses to create a merge commit on `main`),
   - any other branch → `merge` (default), or `rebase` with `--strategy rebase`.
5. **Auto-stash** — if the tree is dirty and `--no-stash` isn't set, the
   command runs `git stash push -u -m "auto-hermes-pull-main <ISO timestamp>"`
   so your unfinished work is preserved.
6. **Pull** — `git merge --ff-only`, `git rebase`, or `git merge --no-edit`
   depending on the strategy.
7. **Conflict handling** — by default, if the merge/rebase hits any conflict,
   the command **aborts the operation** (`git merge --abort` /
   `git rebase --abort`), restores your stash, and exits with code 8. Your
   working tree is left exactly as it was before invocation. Pass
   `--allow-conflicts` to instead leave the tree in the conflicted state for
   manual resolution.
8. **Stash restore** — on a clean pull, the command immediately `git stash pop`s
   your stash entry. If `pop` hits a conflict (your edits overlap incoming
   changes), the command exits with code 11 and leaves the stash on the
   stack for manual resolution.
9. **Artifact write** — when `--write` is set, writes a JSON + Markdown
   audit log to `.ai-sync/AUTO_HERMES_PULL_MAIN.{json,md}` capturing:
   before/after SHAs, commits pulled, files changed, conflict list (if any),
   strategy used, and whether the stash dance happened.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Pulled cleanly, or already up to date |
| 2 | Not a git repository |
| 3 | Remote URL doesn't match `https://github.com/520HXC/run.git` |
| 4 | Detached HEAD |
| 5 | `git fetch` failed |
| 6 | Dirty tree and `--no-stash` was passed |
| 7 | `git stash push` failed |
| 8 | Conflict — operation aborted, tree restored to pre-pull state |
| 9 | Conflict — `--allow-conflicts` was set, tree left conflicted |
| 10 | Merge / rebase failed for non-conflict reason |
| 11 | Pull succeeded but `git stash pop` hit a conflict — stash kept on stack |
| 99 | Internal error |

## Behavior contract

- **Non-destructive by default.** Dry-run is the default; nothing changes
  on disk until `--execute` is passed.
- **Never force-pulls.** No `git reset --hard`, no `--force` flags ever.
- **Never auto-resolves conflicts.** Conflicts are surfaced to the user.
- **Always preserves uncommitted work.** Either via auto-stash + pop, or by
  aborting the pull and leaving the tree exactly as found.
- **Pair with `/auto-hermes-push-main`.** Pull first, work, then push — the
  two commands form a complete sync loop.

# Auto-Hermes Pull Main

Safely sync the local Hermes repo with the latest commits on
`https://github.com/520HXC/run.git`. Counterpart to `/auto-hermes-push-main`.

## When to use

Run when another contributor has pushed to `main` (or your feature branch's
upstream) and you want those changes locally without losing your in-progress
edits.

Refuses to run when:
- the working directory is not a git repo,
- HEAD is detached,
- `origin` does not point at `https://github.com/520HXC/run.git`,
- the working tree is dirty AND `--no-stash` is passed.

## How to invoke

```
/auto-hermes-pull-main
```

Or from CLI:

```bash
# Dry-run (default): inspect, never touch the tree.
node .tools/auto-hermes-pull-main.mjs

# Execute: pull, auto-stashing dirty work first.
node .tools/auto-hermes-pull-main.mjs --execute --write

# Rebase your feature branch on top of main instead of merging.
node .tools/auto-hermes-pull-main.mjs --execute --write --strategy rebase

# Pull a non-default target branch.
node .tools/auto-hermes-pull-main.mjs --execute --write --target-branch main

# Refuse to run if tree is dirty (instead of auto-stashing).
node .tools/auto-hermes-pull-main.mjs --execute --write --no-stash
```

## What it runs, in order

1. `git remote get-url origin` — verify it matches the expected Hermes repo.
2. `git rev-parse --abbrev-ref HEAD` — verify branch is real (not detached).
3. `git fetch origin --prune` — learn the latest remote refs (read-only).
4. `git rev-list --left-right --count HEAD...<target>` — compute ahead / behind.
5. Resolve strategy:
   - `main` branch → `ff-only` (no merge commits on `main`),
   - feature branch → `merge` (default), or `rebase` with `--strategy rebase`.
6. If dirty + auto-stash enabled (default) → `git stash push -u`.
7. Apply pull: `git merge --ff-only`, `git rebase`, or `git merge --no-edit`.
8. Conflict path: abort the merge/rebase, restore the stash, exit non-zero with
   the conflict list. Pass `--allow-conflicts` to instead leave the tree
   conflicted for manual resolution.
9. Clean path: `git stash pop` (if stash was used). If `pop` itself conflicts,
   leave the stash on the stack and exit non-zero with that conflict list.
10. With `--write`: emit `.ai-sync/AUTO_HERMES_PULL_MAIN.{json,md}` with
    before/after SHAs, commits pulled, files changed, conflict list, strategy
    used, and whether the stash dance happened.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Pulled cleanly, or already up to date |
| 2 | Not a git repository |
| 3 | Remote URL mismatch |
| 4 | Detached HEAD |
| 5 | `git fetch` failed |
| 6 | Dirty tree + `--no-stash` |
| 7 | `git stash push` failed |
| 8 | Conflict — aborted, tree restored |
| 9 | Conflict — `--allow-conflicts`, tree left conflicted |
| 10 | Merge/rebase failed for non-conflict reason |
| 11 | Pull OK but `git stash pop` conflicted — stash kept on stack |
| 99 | Internal error |

## Behavior contract

- Non-destructive by default — dry-run unless `--execute`.
- No force-pulls, no `git reset --hard`, no `--force`.
- Never auto-resolves conflicts.
- Always preserves uncommitted work (stash + pop, or abort + restore).
- Pair with `/auto-hermes-push-main` to form a complete sync loop.

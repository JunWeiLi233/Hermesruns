# Hermes Repo Rules

Use this directory as the durable record system for repository rules that are too detailed for `AGENTS.md`.

`AGENTS.md` should stay short and point here.

## Read Order

1. `AGENTS.md`
   Top-level policy, trust rules, session start, and owner map.
2. `docs/auto-hermes/index.md`
   `/auto-hermes` record-system map and owning workflow files.
3. The smallest relevant owner doc in this folder.
4. The owning workflow/helper file if the question is still unresolved.

## Owner Map

| Concern | Owner |
| --- | --- |
| Truth, evidence, memory, and source priority | `truth-and-memory.md` |
| UI/design authority, translation, mimic, and design logs | `design-and-ui.md` |
| Session setup, task execution, runtime proof, loop behavior, checkpoints, and agent sync | `runtime-and-workflow.md` |
| Commit, push, privacy, and required pre-publish checks | `git-and-publish.md` |
| Stack, commands, env vars, coding conventions, and terminal strategy | `stack-and-commands.md` |

## Rules For Maintaining This Record System

- Keep `AGENTS.md` as the map, not the manual.
- Put durable detail in the smallest owner file that matches the concern.
- Prefer updating one owner doc over duplicating the same rule in multiple places.
- If a helper script is the real authority, document the boundary here and link to the script instead of copying its full behavior.
- If a rule is obsolete, delete it from the owner doc instead of leaving it in `AGENTS.md` as stale baggage.

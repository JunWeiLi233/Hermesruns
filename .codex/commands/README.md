# Codex Commands

`commands/` holds slash-style entrypoints and high-level operator flows.

## Current Commands

- `/auto-hermes` -> `auto-hermes.md`
- `/auto-hermes-max` -> `auto-hermes-max.md`
- `/auto-hermes-tech-debt` -> `auto-hermes-tech-debt.md`

### Autoresearch

- `/autoresearch` -> `autoresearch.md`
- `/autoresearch:plan` -> `autoresearch/plan.md`
- `/autoresearch:debug` -> `autoresearch/debug.md`
- `/autoresearch:fix` -> `autoresearch/fix.md`
- `/autoresearch:security` -> `autoresearch/security.md`
- `/autoresearch:ship` -> `autoresearch/ship.md`
- `/autoresearch:scenario` -> `autoresearch/scenario.md`
- `/autoresearch:predict` -> `autoresearch/predict.md`
- `/autoresearch:learn` -> `autoresearch/learn.md`
- `/autoresearch:reason` -> `autoresearch/reason.md`
- `/autoresearch:probe` -> `autoresearch/probe.md`
- `/autoresearch:improve` -> `autoresearch/improve.md`
- `/autoresearch:evals` -> `autoresearch/evals.md`

## What Belongs Here

- command arguments
- command lifecycle
- orchestration behavior
- references to lower-level skills, hooks, agents, and workflows

## What Does Not

- reusable playbook logic
- hook implementation
- raw role prompts

Use `skills/`, `hooks/`, and `agents/` for those.

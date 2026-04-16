# Codex Agents

`agents/` defines role cards and subagent ownership surfaces for Codex work.

## Current Agent Types

- markdown role prompts
  - `frontend-agent.md`
  - `backend-agent.md`
  - `planning-agent.md`
  - `reviewer-agent.md`
  - `debugger-agent.md`

- toml-configured Codex agents
  - `analyst.toml`
  - `architect.toml`
  - `planner.toml`
  - `executor.toml`
  - `verifier.toml`
  - and related specialist cards

## What Belongs Here

- role ownership
- subagent intent
- parallel-work specialization
- execution boundaries

## Rule

If something is only a checklist or review lens, keep it in `skills/` or `review-lenses/` instead of inventing another agent.

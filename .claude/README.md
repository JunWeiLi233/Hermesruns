# Claude Workspace

This `.claude/` directory is the Claude-side operating surface for Hermes.

Use it as a layered workspace instead of a loose pile of prompts and scripts.

## Structure

- `hooks/`
  - Automate work on Claude lifecycle and tool events.
  - Current live events are wired from `.claude/settings.json`.
  - Good for session bootstrap, logging, pre-tool checks, post-edit checks, and guardrails.

- `skills/`
  - Teach Claude new repo-local behaviors.
  - Each skill should live in its own folder with a `SKILL.md`.
  - Good for repeatable workflows, design systems, review lenses, and repair playbooks.

- `plugins/`
  - Bundle related hooks, skills, commands, and agent conventions so the team can reuse them.
  - Use this layer when a capability is bigger than one skill but smaller than a whole repo.

- `agents/`
  - Define subagents for parallel or role-based work.
  - Good for planner/reviewer/frontend/backend/debugger personas with bounded ownership.

- `commands/`
  - Slash-command shortcuts and operational entrypoints.
  - Good for `/auto-hermes`, deploy flows, review flows, and task-specific launchers.

- `mcp/`
  - External tool and data source registry for Claude-side MCP server usage.
  - Use for server manifests, environment notes, and connector conventions.

## Current Reality

Live today:
- `hooks/`
- `skills/`
- `agents/`
- `commands/`

Added in this structure pass:
- `plugins/`
- `mcp/`

## Rules

- Put automation logic in `hooks/`, not inside command prose.
- Put reusable behavior in `skills/`, not in copied prompt blocks.
- Put role definitions in `agents/`, not inside workflow docs.
- Put entrypoint UX in `commands/`, not inside random notes.
- Put cross-team packaged capability in `plugins/`.
- Put external tool/server definitions in `mcp/`.

## Starter Flow

1. Add or update a slash workflow in `commands/`.
2. Move repeated logic into `skills/`.
3. If a role needs its own long-lived prompt, put it in `agents/`.
4. If execution should happen automatically on lifecycle/tool events, wire it in `hooks/`.
5. If the capability depends on external data/tools, document the MCP side in `mcp/`.
6. If the whole thing should be portable for the team, package it in `plugins/`.

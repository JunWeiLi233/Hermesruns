# Codex Workspace

This `.codex/` directory is the Codex-side operating surface for Hermes.

Use it as a layered workspace instead of a loose collection of commands and prompts.

## Core Structure

- `hooks/`
  - Codex runtime hook configuration and hook-oriented automation.
  - In this repo, hook registration is currently anchored by `.codex/hooks.json`.

- `skills/`
  - Teach Codex new repo-local tricks.
  - Each skill should live in its own folder with a `SKILL.md`.

- `plugins/`
  - Bundle related hooks, skills, commands, agents, and MCP conventions for team reuse.

- `agents/`
  - Subagent prompts and role definitions for parallel or specialist work.

- `commands/`
  - Slash-style entrypoints such as `/auto-hermes` and `/auto-hermes-max`.

- `mcp/`
  - External tool and data-source registry for Codex-side MCP usage.

## Codex-Specific Layers

- `prompts/`
  - Prompt bodies for Codex agent cards and runtime roles.

- `review-lenses/`
  - Specialized review lenses used by Hermes reviewer flows.

- `workflows/`
  - Control-plane and delegation-plane docs for Hermes autonomous execution.

## Current Reality

Already present before this structure pass:
- `agents/`
- `commands/`
- `skills/`
- `prompts/`
- `review-lenses/`
- `workflows/`
- `.codex/config.toml`
- `.codex/hooks.json`

Added in this structure pass:
- `plugins/`
- `mcp/`
- this top-level map

## Rules

- Put repeatable behavior in `skills/`, not in copied command prose.
- Put role definitions in `agents/`, not in workflow docs.
- Put slash entrypoints in `commands/`.
- Put external tool/server conventions in `mcp/`.
- Put team-shareable bundles in `plugins/`.
- Put Codex runtime role prompts in `prompts/`.
- Put review-specific heuristics in `review-lenses/`.
- Put lifecycle/control-plane explanation in `workflows/`.

## Starter Flow

1. Add or update an entrypoint in `commands/`.
2. Move repeated logic into `skills/`.
3. If a role needs a dedicated runtime card, define it in `agents/` and `prompts/`.
4. If the capability depends on external tools or servers, document it in `mcp/`.
5. If the whole bundle should be portable for teammates, package it in `plugins/`.

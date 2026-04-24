# Codex Skills

`skills/` teaches Codex new repo-local behaviors.

## Layout

Each skill should live in its own folder with a `SKILL.md`.

```text
skills/
  my-skill/
    SKILL.md
    scripts/
    data/
```

## Current Skill Families

- workflow / autonomy
  - `autopilot`
  - `plan`
  - `ralph`
  - `ralplan`
  - `team`
  - `ultrawork`

- review / quality
  - `code-review`
  - `security-review`
  - `visual-verdict`

- operator / support
  - `doctor`
  - `trace`
  - `note`
  - `cancel`
  - `configure-notifications`

- design / implementation helpers
  - `ui-ux-pro-max`
  - `web-clone`
  - `worker`

## What Does Not

- slash entrypoints
- agent role cards
- team-shareable packaged bundles
- MCP registry notes

Use `commands/`, `agents/`, `plugins/`, and `mcp/` for those.

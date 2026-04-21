# Claude Skills

`skills/` teaches Claude new repo-local tricks.

## Layout

Each skill should live in its own folder:

```text
skills/
  my-skill/
    SKILL.md
    scripts/
    data/
```

## Current Skill Types In This Repo

- workflow helpers
  - `loop-mode`
  - `handoff-state`
  - `translation-sync`

- design helpers
  - `frontend-design`
  - `ui-ux-pro-max`

- meta / operator helpers
  - `caveman`
  - `plays-role-senior-engineer`
  - `define-problem-fix-auto`

## What Belongs Here

- Repeatable playbooks
- Review lenses
- Design systems
- Translation rules
- Repo-specific automation habits

## What Does Not

- Slash entrypoints
- Agent roles
- Team bundles
- External server manifests

Use `commands/`, `agents/`, `plugins/`, and `mcp/` for those.

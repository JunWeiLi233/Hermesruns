# Claude Hooks

`hooks/` is for automation triggered by Claude lifecycle or tool events.

## Current Live Hooks

From `.claude/settings.json`:

- `SessionStart`
  - `node .claude/hooks/session-start.js`
  - Purpose: refresh local context before work starts

- `PreToolUse` for `Bash`
  - `.claude/hooks/pre-commit.sh`
  - Purpose: cheap command guard before shell use

- `UserPromptSubmit`
  - `node .claude/hooks/prompt-log.js`
  - Purpose: append prompt telemetry

- `PostToolUse` for `Edit|Write`
  - `.claude/hooks/lint-on-save.sh`
  - Purpose: quick feedback after local edits

## What Belongs Here

- Tool-event automation
- Session bootstrap
- Safety and hygiene checks
- Logging and observability
- Cheap post-edit verification

## What Does Not

- Long design guidance
- Feature specs
- Agent-role prompts
- Repo architecture notes

Those belong in `skills/`, `agents/`, or `commands/`.

## Naming

- Prefer one file per hook behavior.
- Name by trigger and intent:
  - `session-start.js`
  - `pre-tool-guard.sh`
  - `post-edit-lint.sh`

## Team Note

If a hook becomes reusable across repos, move the shared packaging story into `../plugins/`.

# Claude Commands

`commands/` holds slash-style operator shortcuts.

## Current Command Families

- Hermes autonomy
  - `auto-hermes.md`
  - `auto-hermes-max.md`
  - `auto-hermes-tech-debt.md`

- shipping / deployment
  - `auto-ship.md`
  - `deploy.md`

- review / issue work
  - `fix-issue.md`
  - `pr-review.md`

- workflow helpers
  - `frontend-design.md`
  - `optimize-context.md`
  - `caveman.md`

## What Belongs Here

- Entry-point UX
- Command arguments
- High-level lifecycle
- Cross-skill orchestration

## What Does Not

- Low-level reusable logic
- Agent prompts
- Hook automation

Move those into `skills/`, `agents/`, or `hooks/`.

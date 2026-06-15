# Cross-Agent Sync

Updated: 2026-06-15T13:32:34.761Z

Use this file as the shared cross-platform coordination layer for Codex, Claude, and other Hermes-capable agents.

## Rules
- Read this file before starting queue work, resuming a checkpoint, or reclaiming a user-visible task.
- Claim a task before implementation when the work unit is not trivially local.
- Do not re-pick recently completed work unless there is a recorded must-fix, regression, or explicit user request.
- Reviewer must-fix items outrank fresh speculative ideas.
- Before self-generated follow-up rounds, also read `.ai-sync/HUMAN_LOOP.md` for human steering, pause, or reversal requests.
- Keep entries short and overwrite stale claims instead of appending long history.

## Active Claims
- none

## Recently Completed
- Key: public-landing-race-map-fix-landing-race-map-point-projection
  Task: Fix landing race map point projection
  Surface: Public landing race map
  Agent: codex
  Status: completed
  Completed: 2026-06-15T13:32:34.761Z
  Verify: landing editorial smoke PASS, lint PASS with existing Territory warnings, frontend build PASS after sandbox EPERM elevated rerun, runtime sync PASS, in-app browser #races proof PASS
  Files: frontend/src/pages/Landing.jsx | frontend/src/pages/landingCommandEditorial.smoke.test.js | DESIGN_VERSIONS.md | .ai-sync/CONTEXT_LEDGER.md
  Review: approve-next-round

- Key: public-landing-race-map-add-famous-marathons-to-landing-race-map
  Task: Add famous marathons to landing race map
  Surface: Public landing race map
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-06-15T13:17:38.417Z
  Verify: landing editorial smoke PASS, hero background smoke PASS, translation parity PASS, eslint PASS with existing Territory warnings, frontend build PASS after sandbox EPERM elevated rerun, runtime sync PASS, in-app browser #races proof PASS
  Files: frontend/src/pages/Landing.jsx | frontend/src/i18n/locales/en/pages.js | frontend/src/i18n/locales/zh-CN/pages.js | frontend/src/styles/_split/landing.css | frontend/src/styles/style.css | frontend/src/pages/landingCommandEditorial.smoke.test.js | DESIGN_VERSIONS.md | .ai-sync/CONTEXT_LEDGER.md
  Review: approve-next-round

## Must-Fix Queue
- Key: profile-fix-profile-empty-state
  Task: Fix Profile empty state
  Surface: Profile
  Agent: codex
  Status: must-fix
  Started: 2026-06-15T11:39:21.377Z
  Verify: `cd frontend && npm run lint && npm run build`
  Files: frontend/src/pages/Profile.jsx
  Review: ralph-gate-must-fix

## Human Inbox
- none

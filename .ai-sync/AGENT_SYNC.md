# Cross-Agent Sync

Updated: 2026-06-03T17:14:27.204Z

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
- none

## Must-Fix Queue
- Key: runner-shell-sidebar-fix-squeezed-left-sidebar-collapsed-state
  Task: Fix squeezed left sidebar collapsed state
  Surface: runner shell sidebar
  Agent: codex
  Owner: codex
  Status: must-fix
  Started: 2026-06-03T17:14:27.204Z
  Verify: node frontend/src/components/runnerShellSidebarRedesign.smoke.test.js; cd frontend; node scripts/run-vite-build.mjs; node .tools/verify-frontend-runtime-sync.mjs --files frontend/src/styles/_split/profile.css,frontend/src/styles/style.css,frontend/src/components/runnerShellSidebarRedesign.smoke.test.js; localhost CSS asset signature check for 96px rail, icon-only brand, hidden counters, bounded 52x60 squeeze button
  Files: frontend/src/styles/_split/profile.css | frontend/src/styles/style.css | frontend/src/components/runnerShellSidebarRedesign.smoke.test.js
  Review: ralph-gate-must-fix

- Key: profile-fix-profile-empty-state
  Task: Fix Profile empty state
  Surface: Profile
  Agent: codex
  Status: must-fix
  Started: 2026-05-31T21:24:38.122Z
  Verify: `cd frontend && npm run lint && npm run build`
  Files: frontend/src/pages/Profile.jsx
  Review: ralph-gate-must-fix

## Human Inbox
- none

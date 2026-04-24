# Auto-Hermes Max Lane

Lane: lane-2-signup
Parent Goal: Refresh all public auth pages
Goal: Align /signup panel and confirmation states

Contract:
- This lane is one bounded `/auto-hermes` worker round.
- Do not self-loop inside the child lane.
- Do not edit files outside owned ownership.
- Return a compact lane result packet for merge.

Owned Files: frontend/src/pages/Signup.jsx
Must Preserve: email signup flow | verification flow
Verify: cd frontend && npm run lint
Merge Notes: none

Launch Command: /auto-hermes scope="Align /signup panel and confirmation states" mode=single-round

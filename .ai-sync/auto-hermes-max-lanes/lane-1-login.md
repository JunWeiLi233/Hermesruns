# Auto-Hermes Max Lane

Lane: lane-1-login
Parent Goal: Refresh all public auth pages
Goal: Refine /login hero and CTA hierarchy

Contract:
- This lane is one bounded `/auto-hermes` worker round.
- Do not self-loop inside the child lane.
- Do not edit files outside owned ownership.
- Return a compact lane result packet for merge.

Owned Files: frontend/src/pages/Login.jsx | frontend/src/styles/style.css
Must Preserve: Strava-first auth flow | existing legal links
Verify: cd frontend && npm run lint
Merge Notes: none

Launch Command: /auto-hermes scope="Refine /login hero and CTA hierarchy" mode=single-round

# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-schedule-route-grid-frontend
Parent Run Id: ahm-20260416185030
Correlation Id: ahm-20260416185030:lane-schedule-route-grid-frontend
Parent Goal: Fix the broken planned-route grid card on `/schedule` so the empty/no-route state reads like an intentional Hermes fallback instead of a collapsed blank map block.
Goal: Fix the broken planned-route card on `/schedule` so the no-route state becomes a deliberate coach-style fallback while the preview state still renders normally.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: frontend/src/pages/Schedule.jsx | frontend/src/styles/style.css
Stop Condition: owned-scope-exhausted
Priority: 2
Effort: small
Depends On: none
Dependency State: parallel-ready
Must Preserve: Preserve the existing routeRecommendation data contract and preview rendering when preview data exists. | Keep the shared schedule shell, coach rail, and gear panel intact. | Stay dual-mode safe and aligned with Hermes Kinetic Editorial styling.
Verify: cd frontend && npm run lint,cd frontend && node scripts/run-vite-build.mjs
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-schedule-route-grid-frontend.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-schedule-route-grid-frontend-activity.json

Launch Command: /auto-hermes scope="Fix the broken planned-route card on `/schedule` so the no-route state becomes a deliberate coach-style fallback while the preview state still renders normally." mode=loop owned="frontend/src/pages/Schedule.jsx|frontend/src/styles/style.css"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

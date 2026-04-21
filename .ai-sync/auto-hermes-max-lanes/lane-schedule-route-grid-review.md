# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-schedule-route-grid-review
Parent Run Id: ahm-20260416185030
Correlation Id: ahm-20260416185030:lane-schedule-route-grid-review
Parent Goal: Fix the broken planned-route grid card on `/schedule` so the empty/no-route state reads like an intentional Hermes fallback instead of a collapsed blank map block.
Goal: Review the broken `/schedule` planned-route card against the screenshot and current Schedule surface, then extract the exact visual failure, preserve set, and empty-state direction without editing app code.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: .ai-sync/auto-hermes-max-results/lane-schedule-route-grid-review.json
Stop Condition: owned-scope-exhausted
Priority: 1
Effort: small
Depends On: none
Dependency State: parallel-ready
Must Preserve: Review only; do not edit source files. | Ground the verdict in the screenshot, design.md, and the current Schedule capsule. | Keep runner trust and coach-owned route logic ahead of decorative polish.
Verify: Read frontend/src/pages/Schedule.jsx and the schedule-plan-route CSS blocks in frontend/src/styles/style.css.
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-schedule-route-grid-review.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-schedule-route-grid-review-activity.json

Launch Command: /auto-hermes scope="Review the broken `/schedule` planned-route card against the screenshot and current Schedule surface, then extract the exact visual failure, preserve set, and empty-state direction without editing app code." mode=loop owned=".ai-sync/auto-hermes-max-results/lane-schedule-route-grid-review.json"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

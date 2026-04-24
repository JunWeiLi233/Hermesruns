# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-races-saved-status-frontend
Parent Run Id: ahm-20260416112154
Correlation Id: ahm-20260416112154:lane-races-saved-status-frontend
Parent Goal: Add a race-detail saved-status summary path so `/races/details/:raceId` does not hydrate checklist state from the full decorated `/api/races` payload.
Goal: Switch `RacesDetail.jsx` to the new saved-status summary path so the checklist/CTA no longer hydrate from the full `/api/races` response.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: frontend/src/pages/RacesDetail.jsx
Stop Condition: owned-scope-exhausted
Priority: 2
Effort: small
Depends On: none
Dependency State: parallel-ready
Must Preserve: Preserve the current race-detail layout, checklist copy, and CTA behavior. | Keep the nonblocking hydration pattern intact. | Consume only the minimal saved-status contract instead of the decorated race list.
Verify: cd frontend && npm run lint
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-races-saved-status-frontend.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-races-saved-status-frontend-activity.json

Launch Command: /auto-hermes scope="Switch `RacesDetail.jsx` to the new saved-status summary path so the checklist/CTA no longer hydrate from the full `/api/races` response." mode=loop owned="frontend/src/pages/RacesDetail.jsx"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

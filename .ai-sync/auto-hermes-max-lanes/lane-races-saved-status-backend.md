# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-races-saved-status-backend
Parent Run Id: ahm-20260416112154
Correlation Id: ahm-20260416112154:lane-races-saved-status-backend
Parent Goal: Add a race-detail saved-status summary path so `/races/details/:raceId` does not hydrate checklist state from the full decorated `/api/races` payload.
Goal: Add the smallest backend saved-status summary path for race detail so the client can ask whether the viewed race is already saved without hydrating the full decorated `/api/races` list.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: backend/src/main/java/com/hermes/backend/RaceController.java | backend/src/main/java/com/hermes/backend/RaceEventRepository.java | backend/src/test/java/com/hermes/backend/RaceControllerTests.java
Stop Condition: owned-scope-exhausted
Priority: 1
Effort: small
Depends On: none
Dependency State: parallel-ready
Must Preserve: Preserve existing `/api/races` list/create/update/delete contracts. | Keep the new endpoint auth-protected and lightweight. | Return a stable minimal JSON shape the frontend can consume safely.
Verify: cd backend && ./mvnw test -Dtest=RaceControllerTests,cd backend && ./mvnw -q -DskipTests compile
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-races-saved-status-backend.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-races-saved-status-backend-activity.json

Launch Command: /auto-hermes scope="Add the smallest backend saved-status summary path for race detail so the client can ask whether the viewed race is already saved without hydrating the full decorated `/api/races` list." mode=loop owned="backend/src/main/java/com/hermes/backend/RaceController.java|backend/src/main/java/com/hermes/backend/RaceEventRepository.java|backend/src/test/java/com/hermes/backend/RaceControllerTests.java"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

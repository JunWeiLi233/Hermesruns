# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-1-race-controller-tests
Parent Run Id: ahm-20260415233305
Correlation Id: ahm-20260415233305:lane-1-race-controller-tests
Parent Goal: Add focused RaceController auth and validation coverage as the next Tier 2 trust round after the races localization explorer pass
Goal: Add focused RaceController unit coverage for auth and validation edge cases without changing unrelated races behavior

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: backend/src/test/java/com/hermes/backend/RaceControllerTests.java | backend/src/main/java/com/hermes/backend/RaceController.java
Stop Condition: owned-scope-exhausted
Priority: 1
Effort: medium
Depends On: none
Dependency State: parallel-ready
Must Preserve: Current /api/races request/response contract | Existing race-localization and discovery flow
Verify: cd backend && ./mvnw test -Dtest=RaceControllerTests
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-1-race-controller-tests.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-1-race-controller-tests-activity.json

Launch Command: /auto-hermes scope="Add focused RaceController unit coverage for auth and validation edge cases without changing unrelated races behavior" mode=loop owned="backend/src/test/java/com/hermes/backend/RaceControllerTests.java|backend/src/main/java/com/hermes/backend/RaceController.java"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

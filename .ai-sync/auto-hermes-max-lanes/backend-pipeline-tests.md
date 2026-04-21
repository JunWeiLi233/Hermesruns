# Auto-Hermes Max Lane (Loop Mode)

Lane: backend-pipeline-tests
Parent Run Id: ahm-20260418052036
Correlation Id: ahm-20260418052036:backend-pipeline-tests
Parent Goal: Finalize and expose the Marathon Route Extraction Pipeline with UI, translations, and integration tests.
Goal: Add integration tests for MarathonRoutePipelineService and AdminRouteExtractionController.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: backend/src/test/java/com/hermes/backend/MarathonRoutePipelineServiceTests.java | backend/src/test/java/com/hermes/backend/AdminRouteExtractionControllerTests.java
Stop Condition: owned-scope-exhausted
Priority: 3
Effort: medium
Depends On: none
Dependency State: parallel-ready
Must Preserve: none
Verify: none
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\backend-pipeline-tests.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\backend-pipeline-tests-activity.json

Launch Command: /auto-hermes scope="Add integration tests for MarathonRoutePipelineService and AdminRouteExtractionController." mode=loop owned="backend/src/test/java/com/hermes/backend/MarathonRoutePipelineServiceTests.java|backend/src/test/java/com/hermes/backend/AdminRouteExtractionControllerTests.java"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

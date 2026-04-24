# Auto-Hermes Max Lane (Loop Mode)

Lane: be-elevation-algo
Parent Run Id: ahm-20260416203624
Correlation Id: ahm-20260416203624:be-elevation-algo
Parent Goal: improves algorithm in races/detail/:raceId, make sure there's a real map and correct calculation of elevation map
Goal: Improve backend elevation correctness in RaceCourseMapService: (1) compute totalClimbMeters with a small delta threshold (~1m) to drop jitter noise from open-meteo samples, (2) smooth the raw sample sequence (window=3 moving average) before both the profile chart and the climb sum, (3) tighten isAlignmentPlausible distance window for marathon-class races, (4) keep the /api/races/course-map response shape backward-compatible — only improve or add fields, do not rename or remove existing ones.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: backend/src/main/java/com/hermes/backend/RaceCourseMapService.java
Stop Condition: owned-scope-exhausted
Priority: 2
Effort: medium
Depends On: none
Dependency State: parallel-ready
Must Preserve: none
Verify: none
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\be-elevation-algo.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\be-elevation-algo-activity.json

Launch Command: /auto-hermes scope="Improve backend elevation correctness in RaceCourseMapService: (1) compute totalClimbMeters with a small delta threshold (~1m) to drop jitter noise from open-meteo samples, (2) smooth the raw sample sequence (window=3 moving average) before both the profile chart and the climb sum, (3) tighten isAlignmentPlausible distance window for marathon-class races, (4) keep the /api/races/course-map response shape backward-compatible — only improve or add fields, do not rename or remove existing ones." mode=loop owned="backend/src/main/java/com/hermes/backend/RaceCourseMapService.java"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

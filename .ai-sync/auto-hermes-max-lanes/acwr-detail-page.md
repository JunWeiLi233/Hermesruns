# Auto-Hermes Max Lane (Loop Mode)

Lane: acwr-detail-page
Parent Run Id: ahm-20260418053508
Correlation Id: ahm-20260418053508:acwr-detail-page
Parent Goal: Enhance Today's Run recommendation with race-aware coaching and add Tier 1/2 feature gaps (ACWR detail, Runs search).
Goal: Add Acute:Chronic Workload Ratio (ACWR) detail page.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: frontend/src/pages/AnalysisInsightDetail.jsx | frontend/src/utils/analysisInsights.js
Stop Condition: owned-scope-exhausted
Priority: 2
Effort: medium
Depends On: none
Dependency State: parallel-ready
Must Preserve: none
Verify: none
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\acwr-detail-page.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\acwr-detail-page-activity.json

Launch Command: /auto-hermes scope="Add Acute:Chronic Workload Ratio (ACWR) detail page." mode=loop owned="frontend/src/pages/AnalysisInsightDetail.jsx|frontend/src/utils/analysisInsights.js"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

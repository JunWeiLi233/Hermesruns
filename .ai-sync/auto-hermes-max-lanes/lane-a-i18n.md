# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-a-i18n
Parent Run Id: ahm-20260416031935
Correlation Id: ahm-20260416031935:lane-a-i18n
Parent Goal: Extend VDOT trend signal into confidence model and fix pre-existing i18n parity gaps
Goal: Fix pre-existing translation parity gaps (analysis.vo2_chart_y_title + landing.stitch_footer_copy) so check-translations.mjs exits 0

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: frontend/src/i18n/translations.js
Stop Condition: owned-scope-exhausted
Priority: 1
Effort: small
Depends On: none
Dependency State: parallel-ready
Must Preserve: none
Verify: none
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-a-i18n.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-a-i18n-activity.json

Launch Command: /auto-hermes scope="Fix pre-existing translation parity gaps (analysis.vo2_chart_y_title + landing.stitch_footer_copy) so check-translations.mjs exits 0" mode=loop owned="frontend/src/i18n/translations.js"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

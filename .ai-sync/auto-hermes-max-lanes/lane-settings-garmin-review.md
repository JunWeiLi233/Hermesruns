# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-settings-garmin-review
Parent Run Id: ahm-20260416150646
Correlation Id: ahm-20260416150646:lane-settings-garmin-review
Parent Goal: Redesign Garmin Connect in the Settings page so it feels like a premium Hermes import lane instead of a generic service row.
Goal: Review the current Garmin Connect surface on /settings and extract the strongest design issues, preserve set, and implementation guidance for a premium Hermes redesign without editing app code.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: .ai-sync/auto-hermes-max-results/lane-settings-garmin-review.json
Stop Condition: owned-scope-exhausted
Priority: 1
Effort: small
Depends On: none
Dependency State: parallel-ready
Must Preserve: Review only; do not edit source files. | Ground recommendations in design.md and the existing Settings command-center hierarchy. | Keep runner trust and import clarity ahead of decorative novelty.
Verify: Read frontend/src/components/SettingsAtlasLayout.jsx, frontend/src/pages/Settings.jsx, and relevant settings/garmin style blocks.
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-settings-garmin-review.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-settings-garmin-review-activity.json

Launch Command: /auto-hermes scope="Review the current Garmin Connect surface on /settings and extract the strongest design issues, preserve set, and implementation guidance for a premium Hermes redesign without editing app code." mode=loop owned=".ai-sync/auto-hermes-max-results/lane-settings-garmin-review.json"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

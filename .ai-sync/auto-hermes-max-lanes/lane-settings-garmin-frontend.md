# Auto-Hermes Max Lane (Loop Mode)

Lane: lane-settings-garmin-frontend
Parent Run Id: ahm-20260416150646
Correlation Id: ahm-20260416150646:lane-settings-garmin-frontend
Parent Goal: Redesign Garmin Connect in the Settings page so it feels like a premium Hermes import lane instead of a generic service row.
Goal: Implement a dual-mode Garmin Connect redesign on the Settings page and Garmin import modal so the import lane feels premium, trustworthy, and more actionable.

## Lane Contract
- This lane runs a full /auto-hermes loop — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- ONLY pick tasks that touch your owned files. Before selecting any task, verify it falls inside your scope.
- Do NOT touch files owned by another lane. Check ownedFiles before every edit.
- Log each completed round to the activity log file (append a round summary object).
- Do NOT declare the parent /auto-hermes-max round complete — only report your lane result.
- Write the final lane result packet to the result file when your loop stops.

Owned Files: frontend/src/components/SettingsAtlasLayout.jsx | frontend/src/pages/Settings.jsx | frontend/src/styles/style.css
Stop Condition: owned-scope-exhausted
Priority: 2
Effort: medium
Depends On: none
Dependency State: parallel-ready
Must Preserve: Preserve the real Garmin import behavior, status flow, and manual-import escape hatch. | Keep the surrounding Settings command-center structure intact. | Stay dual-mode safe and inside Hermes Kinetic Editorial design language.
Verify: cd frontend && npm run lint,cd frontend && node scripts/run-vite-build.mjs
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-settings-garmin-frontend.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-settings-garmin-frontend-activity.json

Launch Command: /auto-hermes scope="Implement a dual-mode Garmin Connect redesign on the Settings page and Garmin import modal so the import lane feels premium, trustworthy, and more actionable." mode=loop owned="frontend/src/components/SettingsAtlasLayout.jsx|frontend/src/pages/Settings.jsx|frontend/src/styles/style.css"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

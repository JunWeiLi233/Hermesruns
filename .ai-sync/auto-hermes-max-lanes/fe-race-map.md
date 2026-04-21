# Auto-Hermes Max Lane (Loop Mode)

Lane: fe-race-map
Parent Run Id: ahm-20260416203624
Correlation Id: ahm-20260416203624:fe-race-map
Parent Goal: improves algorithm in races/detail/:raceId, make sure there's a real map and correct calculation of elevation map
Goal: Guarantee a real Leaflet map always renders on /races/detail/:raceId (OSM tiles + correct fallback chain when no aligned overlay/route) and make the elevation chart source-truthful: do not fall back to synthetic hardcoded per-course elevation arrays when real samples are absent — show an explicit empty state instead, and only plot real points from courseMapData.elevationSamples or elevationProfileSamples. Also fix the pointer tooltip km math to respect the race's real distanceKm instead of hardcoded 42.195.

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
Priority: 1
Effort: medium
Depends On: none
Dependency State: parallel-ready
Must Preserve: none
Verify: none
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\fe-race-map.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\fe-race-map-activity.json

Launch Command: /auto-hermes scope="Guarantee a real Leaflet map always renders on /races/detail/:raceId (OSM tiles + correct fallback chain when no aligned overlay/route) and make the elevation chart source-truthful: do not fall back to synthetic hardcoded per-course elevation arrays when real samples are absent — show an explicit empty state instead, and only plot real points from courseMapData.elevationSamples or elevationProfileSamples. Also fix the pointer tooltip km math to respect the race's real distanceKm instead of hardcoded 42.195." mode=loop owned="frontend/src/pages/RacesDetail.jsx"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked

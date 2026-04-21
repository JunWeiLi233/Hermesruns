# Auto-Hermes Max Lane (Ralph-Style Loop Mode)

Lane: lane-frontend
Parent Run Id: ahm-20260420041238
Correlation Id: ahm-20260420041238:lane-frontend
Parent Goal: [Market Opportunity] Smart Shoe Rotation Tracker on Shoe Tracker
Goal: Frontend slice: [Market Opportunity] Smart Shoe Rotation Tracker on Shoe Tracker

## Ralph Loop Contract (Anti-Hallucination)
- This lane runs a FULL /auto-hermes loop with mandatory verification — NOT single-round.
- Loop until no promotable task remains within your owned scope, then stop.
- BEFORE any edit: verify the task falls inside your ownedFiles scope.
- NEVER touch files owned by another lane. Check ownedFiles before EVERY edit.
- FRESH EVIDENCE REQUIRED: Every claim of completion must have fresh test/build output.
- NO 'should work' claims — only 'tests pass: 42 passed, 0 failed' is valid evidence.

## Mandatory Ralph Gates (All Must Pass)
1. [ ] Implementation complete within owned scope
2. [ ] Fresh verification run (test/build/lint) with output captured
3. [ ] Architect verification (STANDARD tier minimum) — APPROVED
4. [ ] Deslop pass on all changed files (ai-slop-cleaner)
5. [ ] Post-deslop regression verification (tests still pass)
6. [ ] Zero pending TODO items in scope
7. [ ] Activity log written (append round summaries)
8. [ ] Lane result packet written to result file

## Anti-Hallucination Rules
- NEVER claim a tool/runtime/memory fact unless verified in this session or documented.
- NEVER claim website/runtime is live without passing runtime proof gate.
- If uncertain, say 'unverified' — do not make up information.
- Do not treat lane launcher state as proof of live execution.

Context Snapshot: .ai-sync/context-snapshots/ahm-20260420041238.json
- Read the context snapshot FIRST before broad repo exploration.
- The snapshot contains: task statement, desired outcome, known facts, constraints.
- If the snapshot contradicts local assumptions, the snapshot wins.

Owned Files: frontend/src/components/ShoeRecommendation.vue
Stop Condition: owned-scope-exhausted
Priority: 1
Effort: small
Depends On: none
Dependency State: parallel-ready
Isolation: direct
Must Preserve: none
Verify: E2E: add shoe, log runs, see mileage accumulate, see recommendation
Merge Notes: none
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-frontend.json
Activity Log File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-frontend-activity.json

Launch Command: /auto-hermes scope="Frontend slice: [Market Opportunity] Smart Shoe Rotation Tracker on Shoe Tracker" mode=loop owned="frontend/src/components/ShoeRecommendation.vue" isolation="direct"

## Required Lane Result Packet (write to result file on loop stop)
Fields: laneId, goal, ownedFiles, changedFiles, completedRounds (array of round summaries),
        verification, runtimeProof, architectVerdict, deslopPass, regressionPass,
        risks, mustPreserve, mergeNotes, status, parentRunId, correlationId
Allowed status: approved | must-fix | blocked
TASKS.md writes are deferred to the parent coordinator; record follow-ups in mergeNotes and risks instead.
CONTEXT_LEDGER.md writes are deferred to the parent coordinator; do not update it directly from a child lane.

## Final Checklist Before Writing Result
- [ ] All requirements met (no scope reduction)
- [ ] Zero pending/in_progress TODO items
- [ ] Fresh test run shows all pass
- [ ] Fresh build shows success
- [ ] LSP diagnostics show 0 errors
- [ ] Architect verification: APPROVED
- [ ] Deslop pass completed on changed files
- [ ] Post-deslop regression tests pass
- [ ] Activity log complete

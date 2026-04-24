# Auto-Hermes Max Coordinator (Ralph-Style)

Generated: 2026-04-20T04:35:34.698Z
Runtime: gemini
Status: ready-to-launch
Next Action: gemini-launch-single-lane
Must Not Reply Yet: yes
Current Phase: executing
Iteration: 1/10
Selection Strategy: auto
Plan Source: controller-derived
Candidate Lane Count: 1
Parallel-Ready Candidate Lane Count: 1
Selected Lane Count: 1
Coordination Cost: medium
Merge Complexity: medium

Parent Goal: [security] Billing config endpoint leaks sensitive configuration data without authentication. on [security] Billing config endpoint leaks sensitive configuration data without authentication.
Parent Run Id: ahm-20260420043534
Correlation Id: ahm-20260420043534:parent
Selection Rationale: Auto-selected 1 lane(s) from 1 parallel-ready candidate lane(s) using effort, coordination cost, and merge complexity.

## Context Snapshot (Grounding)
Path: .ai-sync/context-snapshots/ahm-20260420043534.json
- Read this FIRST before any lane execution.
- Contains: task statement, desired outcome, known facts, constraints.

## Progress Ledger (State)
Path: .ai-sync/auto-hermes-max-state/ahm-20260420043534-progress.json
- Tracks: iteration, phase, lane statuses, gate states.
- Updated after each verification/fix cycle.

## Launched Lanes
- lane-1: [security] Billing config endpoint leaks sensitive configuration data without authentication. on [security] Billing config endpoint leaks sensitive configuration data without authentication. :: /api/billing/config :: parallel-ready :: result C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-1.json

## Ralph Loop Requirements
Each lane MUST provide before completion:
- Fresh verification evidence (test/build output)
- Architect verification verdict: APPROVED
- Deslop pass completed on changed files
- Post-deslop regression verification (tests still pass)
- Zero pending TODO items

## Launch Decision Card
- lane-1: launched :: parallel-ready :: launched: priority 1, effort small, dependency parallel-ready

## Coordinator Contract (Ralph-Style)
- Launch all approved lanes in parallel as child `/auto-hermes` loop workers.
- Keep ownership disjoint — no lane may edit another lane's files.
- Wait for every lane loop to stop and write its result packet.
- REQUIRE fresh verification evidence — no 'should work' claims allowed.
- REQUIRE architect verification (STANDARD tier minimum) for each lane.
- REQUIRE deslop pass on all changed files.
- REQUIRE post-deslop regression verification.
- Run the merge gate and arbitrate every conflict before any combined live claim.
- If merge gate fails or arbitration is pending, do NOT declare parent round complete.
- After approve-merge, update CONTEXT_LEDGER and TASKS.md, then re-enter self-loop cascade.

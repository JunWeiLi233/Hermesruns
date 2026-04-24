# Auto-Hermes Max Worker Iteration

Iteration: 1
Parent Goal: ShoeQueryNormalizationController backend logic has no focused test file - auth, validation, and response-contract behavior can drift unnoticed on Shoe Query Normalization
Parent Run Id: ahm-20260418131714
Plan Source: controller-derived
Selection Rationale: Auto-selected 1 lane(s) from 1 parallel-ready candidate lane(s) using effort, coordination cost, and merge complexity.

## Parent Contract
- Execute exactly one /auto-hermes-max parent iteration, then stop.
- Treat `.ai-sync/AUTO_HERMES_MAX_COORDINATOR.json` and `.ai-sync/AUTO_HERMES_MAX_COORDINATOR.md` as the authoritative parent coordinator state.
- Use the launch decision card from the coordinator brief to decide which lanes actually run this iteration.
- Treat audit-generated fallback work exactly like a normal first parent goal when it appears in the coordinator brief.
- Every launched child lane must run a full /auto-hermes loop within its owned files until that owned scope is exhausted.
- Prefer the Ralph-backed /auto-hermes loop owner for child lanes when the OMX bridge maps loop -> $ralph; otherwise use the emitted /auto-hermes loop owner for this repo.
- If multiple lanes are selected and real parallel child execution is available, use it. If not, run the selected lanes sequentially without widening ownership.
- Each child lane must write its final result packet to the lane result file named in its lane brief before the parent continues.
- After all launched lanes finish, run `node .tools/auto-hermes-max-merge.mjs --write`.
- If the merge verdict is `arbitration-required-before-merge`, resolve every conflict autonomously, rerun the merge helper, and do not stop until the merge brief is no longer waiting on pending coordinator decisions.
- If the merged verdict is `must-fix-before-merge-complete` or `blocked`, leave the next unresolved work in TASKS.md/.ai-sync state, then stop this parent iteration. The outer max loop owner will reassess.
- If the merged verdict is `approve-merge`, refresh the queue/context writeback through the existing lane and merge helpers, then stop this parent iteration cleanly.

## Inputs
- Parent coordinator brief: C:\Users\Junwei\Downloads\Hermes\.ai-sync\AUTO_HERMES_MAX_COORDINATOR.md
- Parent coordinator JSON: C:\Users\Junwei\Downloads\Hermes\.ai-sync\AUTO_HERMES_MAX_COORDINATOR.json
- Lane briefs directory: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-lanes
- Merge brief: C:\Users\Junwei\Downloads\Hermes\.ai-sync\AUTO_HERMES_MAX_MERGE.md
- Merge JSON: C:\Users\Junwei\Downloads\Hermes\.ai-sync\AUTO_HERMES_MAX_MERGE.json

## Stop Condition
- Stop after one parent iteration only. Do not reply to the user. The outer max loop owner decides whether another parent iteration is needed.

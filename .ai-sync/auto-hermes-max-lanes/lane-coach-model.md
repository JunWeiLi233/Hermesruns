# Auto-Hermes Max Lane

Lane: lane-coach-model
Parent Run Id: ahm-20260413033722
Correlation Id: ahm-20260413033722:lane-coach-model
Parent Goal: Redesign /analysis/coach-insight into a Garmin Coach-style running coach system based on the runner's recent performance, with bounded parallel lanes that preserve Hermes data wiring and shared analysis shell behavior.
Goal: Add a coach-planning helper derived from recent Hermes performance data so the coach-insight page can present Garmin Coach-style training system sections without inventing fake metrics.

Contract:
- This lane is one bounded `/auto-hermes` worker round.
- Do not self-loop inside the child lane.
- Do not edit files outside owned ownership.
- Return a compact lane result packet for merge.
- Write or report the lane result packet against the provided result file path so the parent merge gate can correlate long-running child rounds later.

Owned Files: frontend/src/utils/analysisInsights.js
Must Preserve: Existing buildAnalysisSnapshot and buildRunInsightRows behavior for other analysis surfaces | No backend/API changes
Verify: Ensure the helper exports cleanly and existing imports remain valid.
Merge Notes: Keep the helper output shape compact and stable so the page lane can consume it without widening scope.
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-coach-model.json

Launch Command: /auto-hermes scope="Add a coach-planning helper derived from recent Hermes performance data so the coach-insight page can present Garmin Coach-style training system sections without inventing fake metrics." mode=single-round

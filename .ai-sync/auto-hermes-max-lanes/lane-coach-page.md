# Auto-Hermes Max Lane

Lane: lane-coach-page
Parent Run Id: ahm-20260413033722
Correlation Id: ahm-20260413033722:lane-coach-page
Parent Goal: Redesign /analysis/coach-insight into a Garmin Coach-style running coach system based on the runner's recent performance, with bounded parallel lanes that preserve Hermes data wiring and shared analysis shell behavior.
Goal: Rework the coach-insight branch in AnalysisInsightDetail.jsx into a Garmin Coach-style coach system that helps runners plan training based on recent performance while preserving the surrounding analysis route shell.

Contract:
- This lane is one bounded `/auto-hermes` worker round.
- Do not self-loop inside the child lane.
- Do not edit files outside owned ownership.
- Return a compact lane result packet for merge.
- Write or report the lane result packet against the provided result file path so the parent merge gate can correlate long-running child rounds later.

Owned Files: frontend/src/pages/AnalysisInsightDetail.jsx
Must Preserve: Shared signed-in analysis shell | Navigation to /analysis and /run/:id | Other insight detail branches
Verify: Keep JSX parse-safe and preserve the existing route contract for non-coach insight keys.
Merge Notes: Expect the coach-page lane to consume the helper added by lane-coach-model but not edit that helper file directly.
Result File: C:\Users\Junwei\Downloads\Hermes\.ai-sync\auto-hermes-max-results\lane-coach-page.json

Launch Command: /auto-hermes scope="Rework the coach-insight branch in AnalysisInsightDetail.jsx into a Garmin Coach-style coach system that helps runners plan training based on recent performance while preserving the surrounding analysis route shell." mode=single-round

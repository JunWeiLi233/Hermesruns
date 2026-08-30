# Hermes Tasks

Use this file as the working queue for AI agents.

**Before choosing any task, read `PRODUCT.md` and ask:**
1. Does this serve The Competitor, The Builder, or The Enthusiast runner persona?
2. Does this move a screen closer to its Product Intent (see `PRODUCT.md` Screen table)?
3. Is this Tier 1 (Daily Coach Value) or Tier 2 (Data Trust) priority? If not, is there a Tier 1/2 gap that should be addressed first?

## Rules
- Keep tasks in priority order, top to bottom.
- Unless explicitly told otherwise, work through `## Active Tasks` first.
- Each checkbox is a separate required deliverable.
- Treat `Files:`, `Context:`, `Done when:`, `Verify:`, `Note:`, and `Blocker:` as hard execution hints.
- After completing a task, add a short `Note:` line, then delete the entire completed task block from `## Active Tasks` and append one short line to `## Daily Log`.
- Keep `## Daily Log` day-scoped. When adding the first entry for a new date, delete older-date entries first.

## Daily Log
- 2026-08-29: Made auto-coach readiness dynamic when HRV/sleep data is missing (user request, research-backed): ReadinessService now aggregates five availability-weighted components (sleep .28 / HRV .24 / RHR .14 / stress .14 / training-load .20) with shrinkage toward neutral 75 in proportion to missing evidence, so partial data moves the score instead of freezing it; a new training-load proxy (EWMA ACWR mapped to the Gabbett 0.8–1.3 sweet spot, Foster 7-day monotony, hard-session spacing) keeps readiness reactive for runners with no wearable data; HRV is scored against the runner's own 28-day baseline (SWC = 0.5×SD, Plews/Buchheit) instead of absolute ms bands; confidence 0–100 is exposed via /api/coach/state (readinessConfidence, readinessLoad) and low-confidence gate notes name the load proxy; InjuryRiskService acwrTrend is computed (rising/falling/flat) instead of hardcoded "flat" via the new shared TrainingLoadAnalyzer. Full backend suite 1247/1247 (1 pre-existing skip); backend restarted via start_hermes.bat, localhost:8080 returns 200.


## Active Tasks
- [x] Improve Analysis page
  Files: `frontend/src/pages/Analysis.jsx`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Pages index resolves Analysis to an existing frontend page (Quality Score: 1400).
  Done when: the website-audit fallback candidate is investigated and the bounded surface issue is resolved with targeted verification.
  Verify: cd frontend && npm run lint && npm run build
  Surface: Analysis
  Website Audit: fallback-selected
  Website Audit Summary: Controller reported no promotable work; website audit selected Analysis as the bounded fallback candidate (frontend/src/pages/Analysis.jsx).
  Result: Integrated the existing heat-adaptation context into Analysis with six live engine metrics, historical per-run correction coverage, an exposure-day track, bilingual interpretation, and responsive/dark presentation without changing VDOT, zone, or prediction methodology.
  Verified: focused heat-adaptation, VDOT, and Weather smoke tests; frontend lint; production Vite build/static sync; authenticated desktop and mobile browser checks with no horizontal overflow or console errors.

## Tech Debt Tasks

### Territory Map Debt
### Backend Debt

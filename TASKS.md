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
- 2026-08-09: Rebalanced the desktop login hierarchy so the credential panel sits in the optical center with a restrained focal rail and halo; signup/mobile remain unchanged. Auth guards, lint, build/static sync, and desktop/mobile visual checks PASS.
- 2026-06-15: Reworked the landing race-map animation so each race slot now selects a projected pin, draws an insight line into the metric card, reads date/countdown/goal in order, and then highlights the matching table row. Landing smoke tests PASS.
- 2026-06-15: Completed `Improve Profile page` by rebuilding the no-run Profile empty state into an import-first onboarding panel with Strava/file import actions, a three-step unlock path, bilingual copy, light/dark styling, and a focused smoke guard. Profile smoke tests, translation parity, lint, frontend build, runtime sync, and browser route check PASS.
- 2026-06-15: Completed `TerritoryService.java` map-builder extraction by moving territory map response/cache/signature assembly into `TerritoryMapBuilderService`. `TerritoryService.java` reduced from 2063 to 1406 lines. Territory tests and backend compile PASS.
- 2026-06-15: Completed `RaceCourseMapService.java` known-course catalog extraction by moving ordered marathon course lookup, upload shortcut eligibility, and known-course route verdict logic into `RaceKnownOrderedCourseCatalog`. `RaceCourseMapService.java` reduced from 3254 to 2767 lines. RaceCourseMap tests and backend compile PASS.
- 2026-06-15: Completed `ShoeImageController.java` split by moving admin shoe-image routes into `AdminShoeImageController`, remote image proxying into `ShoeRenderSourceService`, scan usage shaping into `ShoeScanUsageStatusService`, and magic-byte validation into `ShoeScanImageValidator`. `ShoeImageController.java` is now 359 lines. Shoe image tests and backend compile PASS.
- 2026-06-15: Completed `ActivityController.java` class-scope reduction by extracting route preview shaping into `ActivityRoutePreviewHelper` and telemetry/debrief assembly into `ActivityTelemetryResponseBuilder`. Reflection guard confirms declared methods stay below 15. ActivityController tests and backend compile PASS.
- 2026-06-15: Completed `ActivityController.java` dependency reduction by grouping activity repositories behind `ActivityDataAccess` and Strava stream hydration behind `ActivityStravaStreamService`. The autowired controller constructor now has 7 dependencies. ActivityController tests and backend compile PASS.
- 2026-06-15: Completed `Activity.java` scope reduction by moving core persisted fields, metric delegates, and relationships into mapped-superclass helpers. `Activity.java` now declares 4 local methods. Activity tests, ActivityPoint tests, Spring context, and backend compile PASS.
- 2026-06-15: Closed stale Territory permanent-label task by verifying the overlap-prone `terr-zone-label`/`bindTooltip(... permanent: true ...)` path is gone, preserving clickable/keyboard owner inspection, and adding a regression guard. Territory smoke tests, frontend build, runtime sync, and browser proof PASS.

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

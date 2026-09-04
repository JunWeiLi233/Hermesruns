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
- 2026-09-04: Verified opt-in Railway sleep mode and fixed review findings: sequential provider completion, successful-only Garmin watermark updates, conservative multiweek coach recovery, busy/failed-provider audit deferral, and Windows-safe frontend contract matching. Backend: 1337 tests, zero failures/errors, one skip. Frontend: 59 unit tests and 330 contracts passed; build passed, lint zero errors/two existing warnings. Offline Garmin downloader: 12 tests passed. Docker build and isolated HTTP 200/auth 401 passed. Draft PR and exact-revision Railway deployment remain pending.


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

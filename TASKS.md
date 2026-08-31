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
- 2026-08-31: Cut PostgreSQL + Spring Boot memory/CPU footprint further (user request, branch perf/app-db-footprint off 7437d6c, subagent-driven workflow with per-task spec+quality review loops, 13 commits, backend only): bounded the previously default-sized runtime — Hikari 6/2 with maxLifetime/keepalive (10 permanently-held PG connections before), Tomcat 24/4 threads (200 before), scheduler pool 2 (1 before; live Railway log showed one 5-min Strava tick starving all 6 jobs), Hibernate jdbc.batch_size=50 + order_updates + default_batch_fetch_size=16, Redis repository scanning off, PG-only reWriteBatchedInserts for the raw-JdbcTemplate point-insert path, BufferingApplicationStartup gated off in production; bounded the last unbounded stores — ElevationCorrectionService.statusCache (256-LRU), LoginAttemptStore 5-min sweep (Redis-aligned count expiry, strictly stronger), TrafficAnomalyStore 50k cap, AdminRouteExtractionController fixed(2) daemon pool + terminal-job pruning (50); TtlCacheStore now skips local retention for values over app.cache.local-max-value-bytes (1MB default; multi-MB 12h Overpass entries were the largest retained objects; Redis path unaffected, stale same-key entry evicted); TTL-cached the hot uncached reads (activity heatmap 10min year-scoped, telemetry + hr-samples 10min auth-before-cache and empty-not-cached, route anchor 15min; recalibrate now evicts telemetry+analytics both locales); batched the hot writes (Garmin points via ActivityDataAccess.savePoints, recalibrate elevation updates via one JDBC batch + EntityManager detach, course-map scan poll 250→1500ms); pushed list limits into SQL (/api/activities limit → repository Limit overload with identical [1,500] clamp, race-course-map admin list → 24-column JPQL projection replacing 13-text-column findAll). Full backend suite 1313/1314 — same 1 pre-existing failure (MuscleTrainingControllerTests.planAvoidsKeyRunAndLongRunAdjacency, documented failing on clean tree at 35c382e, untouched by this branch); boot-verified via run-backend.cmd with localhost:8080 returning 200 (Started in 5.8s), then stopped; .tools/verify-backend-runtime-sync.mjs absent on this host (unverified). Railway memory/CPU drop not confirmed until the image is redeployed.


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

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
- 2026-08-30: Cut hermes-web memory footprint for Railway (user request; Railway reported 1.60 GB vs Postgres 425 MB): Dockerfile ENTRYPOINT now runs `java $JAVA_OPTS` with a lean container profile (-Xms128m/-Xmx768m, SerialGC, MaxMetaspaceSize=256m, Min/MaxHeapFreeRatio 20/40 so heap is uncommitted after spikes, ExitOnOutOfMemoryError), overridable per deployment via JAVA_OPTS — previously the image shipped no JVM flags at all and the heap grew toward the ergonomics ceiling without returning RSS; TtlCacheStore's local fallback is now a bounded LRU (app.cache.local-max-entries, default 1024) plus a 5-min scheduled sweep of expired entries — it previously retained every key ever written forever (expired entries were only dropped if that exact key was re-read); MapTileController's raw tile cache is now byte-weight-bounded (64 MB LRU, expired tiles still serve stale on refresh failure) and tiles are no longer double-stored as Base64 JSON in the TTL store when Redis is inactive (new TtlCacheStore.hasDurableBacking). Focused tests 20/20 (new: LRU cap, sweep, tile weight eviction, JSON-copy skip); full backend suite 1265/1266 — 1 pre-existing failure (MuscleTrainingControllerTests.planAvoidsKeyRunAndLongRunAdjacency, fails on clean tree at 35c382e, unrelated); backend compiled and boot-verified via run-backend.cmd with localhost:8080 returning 200, then stopped. Railway memory drop not confirmed until the image is redeployed.



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

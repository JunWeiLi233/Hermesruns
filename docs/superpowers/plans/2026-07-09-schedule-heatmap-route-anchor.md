# Schedule Heatmap Route Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate Schedule's recommended route around the authenticated runner's all-time hottest heatmap area instead of a single latest-run coordinate.

**Architecture:** `RouteHeatmapAnchorService` groups authenticated runner GPS points into small cells and selects the cell used by the most distinct runs. `RoutePlannerController` exposes that anchor and persists its source with each generated route. Schedule requests the anchor only while auto-planning, falls back to the latest GPS run when heatmap data is unavailable, and accepts only newly anchored runnable plans.

**Tech Stack:** Java 17, Spring MVC, Spring Data JPA, React 19, Vite, Node smoke tests, JUnit 5 and AssertJ.

---

### Task 1: Heatmap Hotspot Selector

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/routing/RouteHeatmapAnchorService.java`
- Create: `backend/src/test/java/com/hermes/backend/routing/RouteHeatmapAnchorServiceTests.java`

- [ ] **Step 1: Write the failing selector tests**

```java
@Test
void selectAnchorPrefersTheCellVisitedByMoreDistinctRuns() {
    var anchor = RouteHeatmapAnchorService.selectAnchor(List.of(
        point(1L, 40.71281, -74.00602), point(1L, 40.71282, -74.00601),
        point(2L, 40.71280, -74.00600), point(3L, 40.71279, -74.00603),
        point(9L, 40.73001, -73.99001), point(9L, 40.73002, -73.99002), point(9L, 40.73003, -73.99003)
    ));
    assertThat(anchor.activityCount()).isEqualTo(3);
    assertThat(anchor.startLat()).isCloseTo(40.7128, within(0.001));
}
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `cd backend && ./mvnw -q -Dtest=RouteHeatmapAnchorServiceTests test`

Expected: compilation failure because `RouteHeatmapAnchorService` does not exist.

- [ ] **Step 3: Implement the selector and runner-owned lookup**

```java
@Service
public class RouteHeatmapAnchorService {
    static final double CELL_DEGREES = 0.001;

    public record RouteAnchor(double startLat, double startLng, int activityCount, int pointCount) {}

    public RouteAnchor findAnchor(Runner runner) {
        return selectAnchor(activityPointRepository.findAllHeatmapPointsByRunnerAndType(
            runner.getId(), ActivityType.RUN.name()));
    }
}
```

Each cell stores a set of activity IDs, valid point count, and coordinate sums. Select by distinct activity count, then raw point count, then a stable cell key. Ignore invalid rows and return `null` for no usable data.

- [ ] **Step 4: Run the selector tests to verify they pass**

Run: `cd backend && ./mvnw -q -Dtest=RouteHeatmapAnchorServiceTests test`

Expected: PASS.

### Task 2: Route API And Persistence Contract

**Files:**
- Modify: `backend/src/main/java/com/hermes/backend/routing/RoutePlannerController.java`
- Modify: `backend/src/main/java/com/hermes/backend/routing/PlannedRoute.java`

- [ ] **Step 1: Add failing API contract coverage**

Add a controller-facing test or source guard that requires authenticated `GET /api/route/plan/anchor` and verifies its response uses `startLat`, `startLng`, `activityCount`, and `source: "heatmap-hotspot"`.

- [ ] **Step 2: Implement the API and source persistence**

```java
@GetMapping("/plan/anchor")
public ResponseEntity<?> routeAnchor(@RequestHeader(value = "Authorization", required = false) String auth) {
    Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
    if (runner.isEmpty()) return unauthorized();
    RouteHeatmapAnchorService.RouteAnchor anchor = routeHeatmapAnchorService.findAnchor(runner.get());
    if (anchor == null) return ResponseEntity.ok(Map.of());
    return ResponseEntity.ok(Map.of(
        "startLat", anchor.startLat(), "startLng", anchor.startLng(),
        "activityCount", anchor.activityCount(), "pointCount", anchor.pointCount(),
        "source", "heatmap-hotspot"));
}
```

Extend `RoutePlanRequest`, `PlannedRoute`, the plan response, and `/plan/recent` with nullable `anchorSource`. Persist `heatmap-hotspot` for the new route path and `recent-run` only when Schedule cannot resolve a heatmap anchor.

- [ ] **Step 3: Run targeted backend coverage**

Run: `cd backend && ./mvnw -q -Dtest=RouteHeatmapAnchorServiceTests test`

Expected: PASS.

### Task 3: Schedule Anchor Resolution

**Files:**
- Modify: `frontend/src/pages/schedule/Schedule.jsx`
- Modify: `frontend/src/pages/schedule/__tests__/scheduleRoutePlanner.smoke.test.js`
- Modify: `frontend/src/i18n/locales/en/pages.js`
- Modify: `frontend/src/i18n/locales/zh-CN/pages.js`

- [ ] **Step 1: Extend the failing Schedule smoke test**

```js
assert.match(scheduleSource, /apiJson\('\\/api\\/route\\/plan\\/anchor'\)/);
assert.match(scheduleSource, /source: 'heatmap-hotspot'/);
assert.match(scheduleSource, /source: 'recent-run'/);
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `node frontend/src/pages/schedule/__tests__/scheduleRoutePlanner.smoke.test.js`

Expected: assertion failure because Schedule has no heatmap-anchor request.

- [ ] **Step 3: Resolve a heatmap anchor before the current recent-run fallback**

```js
const resolveStartPoint = () => apiJson('/api/route/plan/anchor')
  .then((anchor) => isValidRouteAnchor(anchor)
    ? { lat: Number(anchor.startLat), lng: Number(anchor.startLng), source: 'heatmap-hotspot' }
    : resolveRecentRunStart())
  .catch(resolveRecentRunStart);
```

Persist `anchorSource: pt.source` in the generated route state. Require `heatmap-hotspot` or `recent-run` in the runnable-route predicate so legacy single-run plans are regenerated. Update the planned-route source label in both locales to identify the heatmap-based plan.

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `node frontend/src/pages/schedule/__tests__/scheduleRoutePlanner.smoke.test.js`

Expected: PASS.

### Task 4: End-To-End Verification

**Files:**
- Verify only

- [ ] **Step 1: Run backend compile and targeted tests**

Run: `cd backend && ./mvnw -q -Dtest=RouteHeatmapAnchorServiceTests test` and `cd backend && ./mvnw -q -DskipTests compile`

Expected: both commands exit 0.

- [ ] **Step 2: Run frontend checks**

Run: `node frontend/src/pages/schedule/__tests__/scheduleRoutePlanner.smoke.test.js`, `cd frontend && npm run lint`, and `cd frontend && node scripts/run-vite-build.mjs`

Expected: all commands exit 0.

- [ ] **Step 3: Verify the served frontend bundle**

Run: `node tools/verify-frontend-runtime-sync.mjs --files frontend/src/pages/schedule/Schedule.jsx frontend/src/pages/schedule/__tests__/scheduleRoutePlanner.smoke.test.js frontend/src/i18n/locales/en/pages.js frontend/src/i18n/locales/zh-CN/pages.js`

Expected: `PASS` and the local backend serves the current frontend static assets.

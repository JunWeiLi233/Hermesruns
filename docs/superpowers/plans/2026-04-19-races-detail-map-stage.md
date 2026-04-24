# Races Detail Map Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/races/details/:raceId` so the lower content area becomes a dominant full-width Leaflet world-map stage that shows only the AI-georeferenced route line, with readiness content moved below it.

**Architecture:** Keep the existing race-detail data flow and trust gate, but simplify the runner-facing map stage so one Leaflet surface owns the entire lower block. The lower section becomes a stacked map-stage-plus-readiness structure, and the map lifecycle continues to frame the route once and then preserve user pan/zoom while falling back to a real city-context Leaflet map when route data is unavailable.

**Tech Stack:** React 19, React Router, Leaflet, repo-local smoke tests with Node `assert`, Hermes Vite frontend build, CSS in `frontend/src/styles/style.css`

---

### Task 1: Lock The New DOM And Layout Contract In Tests

**Files:**
- Modify: `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`
- Test: `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`

- [ ] **Step 1: Write the failing test**

```js
assert.match(
  racesDetailSource,
  /className="race-detail-map-stage"/,
  'RacesDetail should render a dedicated full-width map-stage wrapper for the lower race-detail map block.',
);

assert.match(
  racesDetailSource,
  /className="race-detail-lower-stack"/,
  'RacesDetail should replace the side-by-side lower grid with a stacked map-first layout.',
);

assert.doesNotMatch(
  racesDetailSource,
  /L\.imageOverlay\(/,
  'RacesDetail should not paint the scanned course-map image over the runner-facing Leaflet stage in the route-only redesign.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-static-fallback"/,
  'RacesDetail should not render a DOM static-map fallback layer in the route-only map-stage redesign.',
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`
Expected: FAIL with a message about the missing `race-detail-map-stage` or `race-detail-lower-stack` structure.

- [ ] **Step 3: Write minimal implementation**

```jsx
<section className="race-detail-lower-stack">
  <article className="race-detail-map-stage">
    <div className="race-detail-map-canvas">
      <div ref={routeMapRef} className={`race-detail-map-leaflet...`} />
    </div>
  </article>

  <article className="race-detail-readiness-card">
    ...
  </article>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js frontend/src/pages/RacesDetail.jsx
git commit -m "test: lock race detail map stage contract"
```

### Task 2: Rewrite The Lower Race Map Block Into A Full-Width Leaflet Stage

**Files:**
- Modify: `frontend/src/pages/RacesDetail.jsx`
- Test: `frontend/src/utils/raceDetailMapLifecycle.smoke.test.js`

- [ ] **Step 1: Write the failing test**

```js
assert.match(
  racesDetailSource,
  /let hasAppliedInitialViewport = false;/,
  'RacesDetail should still track one-time route framing in the redesigned map stage.',
);

assert.match(
  racesDetailSource,
  /L\.polyline\(routeMapPoints,\s*\{/,
  'RacesDetail should render the AI-georeferenced route line directly onto the Leaflet stage.',
);

assert.doesNotMatch(
  racesDetailSource,
  /race-detail-map-card\$\{hasAlignedOverlay/,
  'RacesDetail should stop expressing the lower block as the older overlay-centric map card contract.',
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/utils/raceDetailMapLifecycle.smoke.test.js`
Expected: Either PASS already on lifecycle plus FAIL on the new map-stage structure test, or a FAIL if the lifecycle contract was broken while restructuring.

- [ ] **Step 3: Write minimal implementation**

```jsx
<section className="race-detail-lower-stack">
  <article className="race-detail-map-stage">
    <div className="race-detail-map-canvas" role="img" aria-label={mapCardCopy.title} aria-describedby="race-detail-map-access-copy">
      <div
        ref={routeMapRef}
        className={`race-detail-map-leaflet${routeMapReady ? ' is-mounted' : ''}${routeMapPainted ? ' is-ready' : ''}`}
      />
    </div>
    <div className="race-detail-map-hud">
      <span className="race-detail-map-pill">{t('races.detail_course_route_source')}</span>
      <strong>{mapCardCopy.title}</strong>
      <span>{mapCardCopy.source}</span>
      <span>{t('races.detail_course_hover_hint_aligned')}</span>
    </div>
  </article>

  <article className="race-detail-readiness-card">...</article>
</section>
```

```js
if (hasAlignedRoute) {
  polyline = L.polyline(routeMapPoints, {
    color: '#f07561',
    weight: 5,
    opacity: 0.92,
  }).addTo(map);
}

applyRouteMapViewport({ force: true });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`
Expected: PASS

Run: `node frontend/src/utils/raceDetailMapLifecycle.smoke.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RacesDetail.jsx frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js frontend/src/utils/raceDetailMapLifecycle.smoke.test.js
git commit -m "feat: redesign races detail map stage"
```

### Task 3: Make The New Map Stage Read Correctly In Both Modes

**Files:**
- Modify: `frontend/src/styles/style.css`
- Test: `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`

- [ ] **Step 1: Write the failing test**

```js
assert.match(
  racesDetailStyles,
  /\.race-detail-map-stage\s*\{/,
  'Race detail styles should define a dedicated full-width map-stage block.',
);

assert.match(
  racesDetailStyles,
  /\.race-detail-lower-stack\s*\{/,
  'Race detail styles should define the stacked lower layout that places readiness below the map.',
);

assert.match(
  racesDetailStyles,
  /\.race-detail-map-hud\s*\{/,
  'Race detail styles should define the lightweight floating HUD for the new map stage.',
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`
Expected: FAIL with a message about missing `.race-detail-map-stage`, `.race-detail-lower-stack`, or `.race-detail-map-hud` styles.

- [ ] **Step 3: Write minimal implementation**

```css
.race-detail-lower-stack {
  display: grid;
  gap: 18px;
}

.race-detail-map-stage {
  position: relative;
  min-height: 420px;
  overflow: hidden;
  border-radius: 24px;
}

.race-detail-map-canvas {
  position: absolute;
  inset: 0;
  isolation: isolate;
}

.race-detail-map-hud {
  position: relative;
  z-index: 2;
  display: grid;
  gap: 10px;
  align-content: start;
  max-width: min(320px, 42%);
  margin: 18px;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(10, 14, 17, 0.58);
  backdrop-filter: blur(16px);
}
```

```css
@media (max-width: 1080px) {
  .race-detail-map-stage {
    min-height: 360px;
  }

  .race-detail-map-hud {
    max-width: min(100%, 280px);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`
Expected: PASS

Run: `cmd /c "cd /d frontend && npm run lint"`
Expected: PASS

Run: `cmd /c "cd /d frontend && node scripts/run-vite-build.mjs"`
Expected: PASS

Run: `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/RacesDetail.jsx||frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js||frontend/src/styles/style.css"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/style.css frontend/src/pages/RacesDetail.jsx frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js
git commit -m "style: finalize races detail map stage"
```

### Task 4: Refresh Durable Frontend Design Records

**Files:**
- Modify: `DESIGN_VERSIONS.md`
- Modify: `.ai-sync/CONTEXT_LEDGER.md`
- Modify: `.ai-sync/AGENT_SYNC.md`

- [ ] **Step 1: Write the failing test**

```text
No executable test file is required for this documentation task, but the task should fail review if it omits the new full-width map-stage baseline or still describes the runner-facing map card as an overlay-image surface.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `Select-String -Path DESIGN_VERSIONS.md,.ai-sync/CONTEXT_LEDGER.md,.ai-sync/AGENT_SYNC.md -Pattern "static tile fallback|image overlay|side-by-side lower grid"`
Expected: Existing stale references still appear and must be updated.

- [ ] **Step 3: Write minimal implementation**

```md
### Version: DV-2026-04-19-02
Date: 2026-04-19
Surface: Race Detail map stage on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the lower race-detail map area into a single dominant full-width Leaflet world-map stage and reduced the AI rendering to the georeferenced route line plus lightweight HUD, with readiness content moved below.
Why: The previous lower block no longer read as a reliably interactive map surface.
Rollback target: `DV-2026-04-19-01`
Notes: The runner-facing map stage is route-only and does not paint the scanned course-map image overlay.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `Select-String -Path DESIGN_VERSIONS.md,.ai-sync/CONTEXT_LEDGER.md,.ai-sync/AGENT_SYNC.md -Pattern "dominant full-width|route-only|Leaflet"`
Expected: Updated records describe the new baseline.

- [ ] **Step 5: Commit**

```bash
git add DESIGN_VERSIONS.md .ai-sync/CONTEXT_LEDGER.md .ai-sync/AGENT_SYNC.md
git commit -m "docs: record races detail map stage redesign"
```

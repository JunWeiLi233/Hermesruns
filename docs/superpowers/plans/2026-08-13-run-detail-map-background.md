# Run Detail Map Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/run/:runId` Leaflet route map into an interactive background for the authenticated main column without allowing it beneath the Runs navigation rail.

**Architecture:** Keep one Leaflet mount and switch its parent with `matchMedia`: direct child of `.runner-shell-main` on desktop, or between the activity header and evidence shell on compact screens. The desktop fixed layer inherits the main column's computed margin, so every expanded, collapsed, and intermediate shell width remains authoritative; at the shared `860px` breakpoint the same map returns to normal flow as a contained panel. Existing evidence remains in a centered, higher stacking layer with opaque Profile-derived surfaces.

**Tech Stack:** React 19, Leaflet, CSS, Node.js source smoke tests, Vite

---

### Task 1: Lock the map-background contract

**Files:**
- Modify: `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`
- Test: `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`

- [x] **Step 1: Add failing source and CSS assertions**

Add assertions after the existing Profile-minimal map assertion:

```js
assert(
  runDetailSource.includes("${points.length > 0 ? ' has-route-map-background' : ''}")
    && runDetailSource.includes('className="run-detail-map-background"')
    && runDetailSource.includes('mapBackground = null')
    && runDetailSource.includes('{mapBackground}')
    && runDetailSource.includes('mapBackground: isCompactMapLayout ? null : routeMapBackground')
    && runDetailSource.includes('{isCompactMapLayout && routeMapBackground}')
    && runDetailSource.includes('points.length === 0 && ('),
  'Loaded routes should mount one Leaflet map directly in the desktop main shell or after the activity header on mobile while retaining the no-route fallback.',
);

assert(
  /\.run-detail-runner-page\s+\.runner-shell-main\s*>\s*\.run-detail-map-background\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*margin-left:\s*inherit;[\s\S]*z-index:\s*0;/.test(minimalStyleSource)
    && /\.run-detail-map-background\s+\.leaflet-top\s*\{[\s\S]*top:\s*94px;/.test(minimalStyleSource)
    && /\.has-route-map-background\s+\.run-detail-profile-hero\s*\{[\s\S]*min-height:\s*clamp\(360px,\s*52vh,\s*620px\);/.test(minimalStyleSource),
  'Desktop route maps should inherit the shell main-column boundary and leave a deliberate map window behind the metric rail.',
);

assert(
  /@media\s*\(max-width:\s*860px\)\s*\{[\s\S]*\.run-detail-runner-page\s+\.run-detail-profile-minimal\s+\.run-detail-map-background[\s\S]*position:\s*relative;[\s\S]*height:\s*clamp\(300px,\s*82vw,\s*430px\);/.test(minimalStyleSource)
    && runDetailSource.includes("window.matchMedia('(max-width: 860px)')")
    && runDetailSource.includes('map.invalidateSize({ pan: false })'),
  'Mobile should restore a contained map and Leaflet should invalidate its size after shell geometry changes.',
);
```

- [x] **Step 2: Run the smoke test and confirm RED**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' frontend/src/pages/runDetailProfileCockpit.smoke.test.js
```

Expected: FAIL on the first new map-background assertion because `RunDetail.jsx` still renders `#route-map` inside `.run-detail-profile-map`.

### Task 2: Move the existing Leaflet mount into the background plane

**Files:**
- Modify: `frontend/src/pages/RunDetail.jsx`
- Test: `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`

- [x] **Step 1: Add route-state geometry and resize handling**

Change the loaded page class and create one reusable map element:

```jsx
<div className={`run-detail-page run-detail-profile-cockpit run-detail-profile-minimal${points.length > 0 ? ' has-route-map-background' : ''}`}>
```

```jsx
const routeMapBackground = points.length > 0 ? (
  <div className="run-detail-map-background">
    <div ref={mapRef} id="route-map" style={{ width: '100%', height: '100%' }} />
  </div>
) : null;
```

Add `mapBackground = null` to `renderRunnerShell`, render `{mapBackground}` as the first child of `.runner-shell-main`, render `{isCompactMapLayout && routeMapBackground}` after the activity header, and pass `mapBackground: isCompactMapLayout ? null : routeMapBackground` in the loaded shell options.

Retain the no-route fallback in the overview rather than creating a second Leaflet mount:

```jsx
{points.length === 0 && (
  <div className="run-detail-map-card run-detail-profile-map">
    <div className="run-detail-no-map">{t('run_detail.no_map')}</div>
  </div>
)}
```

Extend the Leaflet initialization effect with a `ResizeObserver` so sidebar transitions and mobile/desktop resizing repair map dimensions without creating a second map instance:

```jsx
let resizeObserver = null;
let resizeTimeoutId = null;

import('leaflet').then((L) => {
  // Keep the existing tile, polyline, markers, and fitBounds setup.
  const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true, dragging: true });
  const resizeMap = () => map.invalidateSize({ pan: false });

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(mapRef.current);
  }
  resizeTimeoutId = window.setTimeout(resizeMap, 0);
  mapInstanceRef.current = map;
});

return () => {
  resizeObserver?.disconnect();
  if (resizeTimeoutId != null) window.clearTimeout(resizeTimeoutId);
  if (mapInstanceRef.current) {
    mapInstanceRef.current.remove();
    mapInstanceRef.current = null;
  }
};
```

- [x] **Step 2: Run the smoke test**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' frontend/src/pages/runDetailProfileCockpit.smoke.test.js
```

Expected: the source-structure assertions pass; CSS assertions remain RED until Task 3.

### Task 3: Build the main-column background and readable foreground

**Files:**
- Modify: `frontend/src/styles/run-detail-profile-minimal.css`
- Test: `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`

- [x] **Step 1: Add desktop map and foreground layering**

Add route-scoped rules after the base `.run-detail-profile-minimal` tokens:

```css
.run-detail-runner-page .runner-shell-main > .run-detail-map-background {
  position: fixed;
  inset: 0;
  margin-left: inherit;
  z-index: 0;
  overflow: hidden;
  background: #d9d3c9;
  transition: margin-left var(--transition);
}

.run-detail-map-background .leaflet-top {
  top: 94px;
}

.run-detail-map-background::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 500;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(247, 239, 227, 0.22), rgba(247, 239, 227, 0.48)),
    linear-gradient(90deg, rgba(247, 239, 227, 0.16), transparent 30%, rgba(247, 239, 227, 0.18));
}

.run-detail-profile-minimal.has-route-map-background {
  position: relative;
  z-index: 1;
  pointer-events: none;
}

.run-detail-profile-minimal.has-route-map-background > :is(.run-detail-topbar, .run-detail-shell),
.run-detail-profile-minimal.has-route-map-background .run-detail-map-background {
  pointer-events: auto;
}

.run-detail-profile-minimal.has-route-map-background .run-detail-topbar {
  padding: 18px 20px !important;
  border-radius: var(--run-detail-radius-xl) !important;
  background: rgba(255, 252, 246, 0.9) !important;
  box-shadow: var(--run-detail-shadow) !important;
  backdrop-filter: blur(18px) saturate(118%);
}

.run-detail-runner-page .run-detail-profile-minimal.has-route-map-background .run-detail-profile-hero {
  min-height: clamp(360px, 52vh, 620px);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

.run-detail-runner-page .run-detail-profile-minimal.has-route-map-background .run-detail-profile-stat-rail {
  width: min(100%, 720px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.run-detail-runner-page .run-detail-profile-minimal.has-route-map-background :is(.run-detail-panel, .run-detail-stat-card:not(.is-accent)),
.run-detail-profile-minimal.has-route-map-background .run-detail-section > h2 {
  background: rgba(255, 252, 246, 0.94) !important;
}

.run-detail-profile-minimal.has-route-map-background .run-detail-section > h2 {
  display: table;
  padding: 7px 11px;
  border-radius: 999px;
}

body:is(.theme-midnight, .theme-high-contrast) .run-detail-map-background::after {
  background:
    linear-gradient(180deg, rgba(18, 16, 14, 0.42), rgba(18, 16, 14, 0.68)),
    linear-gradient(90deg, rgba(18, 16, 14, 0.28), transparent 30%, rgba(18, 16, 14, 0.32));
}

body:is(.theme-midnight, .theme-high-contrast) .run-detail-profile-minimal.has-route-map-background .run-detail-topbar,
body:is(.theme-midnight, .theme-high-contrast) .run-detail-runner-page .run-detail-profile-minimal.has-route-map-background :is(.run-detail-panel, .run-detail-stat-card:not(.is-accent)),
body:is(.theme-midnight, .theme-high-contrast) .run-detail-profile-minimal.has-route-map-background .run-detail-section > h2 {
  background: rgba(30, 27, 23, 0.94) !important;
}
```

- [x] **Step 2: Add the mobile contained-map fallback**

Add the shared shell-breakpoint override:

```css
@media (max-width: 860px) {
  .run-detail-runner-page .run-detail-map-background,
  .run-detail-runner-page.is-sidebar-collapsed .run-detail-map-background {
    position: relative;
    inset: auto;
    width: 100%;
    height: clamp(300px, 82vw, 430px);
    margin-bottom: 16px;
    border-radius: var(--run-detail-radius-xl);
    box-shadow: var(--run-detail-shadow);
  }

  .run-detail-map-background .leaflet-top {
    top: 0;
  }

  .run-detail-profile-minimal.has-route-map-background {
    pointer-events: auto;
  }

  .run-detail-runner-page .run-detail-profile-minimal.has-route-map-background .run-detail-profile-hero {
    min-height: 0;
  }
}
```

- [x] **Step 3: Run targeted tests and confirm GREEN**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' frontend/src/pages/runDetailProfileCockpit.smoke.test.js
& 'C:\Program Files\nodejs\node.exe' frontend/src/pages/runnerShellSidebarRedesign.smoke.test.js
```

Expected: both commands print `[PASS]` and exit 0.

### Task 4: Record and verify the design round

**Files:**
- Modify: `DESIGN_VERSIONS.md`
- Verify: `frontend/src/pages/RunDetail.jsx`
- Verify: `frontend/src/styles/run-detail-profile-minimal.css`

- [x] **Step 1: Append the design-version entry**

Record the full-main-column map background, fixed expanded/collapsed rail boundary, mobile contained fallback, preserved Leaflet behavior, and proof commands.

- [x] **Step 2: Build the frontend**

Run:

```powershell
Set-Location frontend
& 'C:\Program Files\nodejs\node.exe' scripts/run-vite-build.mjs
Set-Location ..
```

Expected: Vite exits 0 and copies the built frontend into backend static resources.

- [x] **Step 3: Verify runtime synchronization**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/verify-frontend-runtime-sync.mjs --files frontend/src/pages/RunDetail.jsx frontend/src/styles/run-detail-profile-minimal.css frontend/src/pages/runDetailProfileCockpit.smoke.test.js
```

Expected: runtime sync reports the changed source represented in built static state.

- [x] **Step 4: Inspect desktop and mobile geometry in the browser**

At an authenticated `/run/:runId`, verify the map starts at the computed right edge of the expanded Runs rail, follows the collapsed rail after toggling, never covers navigation, remains interactive in exposed gutters, preserves readable foreground cards, and becomes a contained map below the activity header at `860px` and below.

# Analysis Load Balance Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/analysis/load-balance` into a Profile-aligned, decision-first dashboard while preserving every ACWR calculation, chart interaction, route action, theme, and responsive contract.

**Architecture:** Keep `buildLoadBalanceDashboardModel` and the existing SVG geometry/event handlers as the data and interaction layer. Recompose only the Load Balance JSX branch with route-scoped `analysis-load-profile-*` classes, then add a late-imported alignment stylesheet that owns this route's visual cascade without changing shared Profile or Analysis components.

**Tech Stack:** React 19, React Router v7, SVG, CSS custom properties/media queries, Node smoke tests, Vite build, Hermes runtime-sync verifier, in-app Browser.

---

## File Map

- Modify `frontend/src/pages/analysis/AnalysisInsightDetail.jsx`: reorder the existing Load Balance content into header, decision, evidence, metrics, ledger, and methodology sections.
- Create `frontend/src/styles/analysis-load-balance-profile-alignment.css`: own all route-scoped Profile-aligned presentation, themes, focus, motion, and responsive behavior.
- Modify `frontend/src/index.css`: import the new route stylesheet after current Analysis alignment styles.
- Modify `frontend/src/pages/analysis/__tests__/analysisSubpageNav.smoke.test.js`: guard section order, chart interaction, routes, and stylesheet registration.
- Modify `DESIGN_VERSIONS.md`: record the meaningful UI revision and proof gates.

### Task 1: Add The Decision-First Contract Guard

**Files:**
- Modify: `frontend/src/pages/analysis/__tests__/analysisSubpageNav.smoke.test.js`

- [ ] **Step 1: Write assertions that initially fail**

Add source reads for `index.css` and the dedicated alignment stylesheet, then assert the following stable markers and ordering:

```js
const indexCss = read('index.css');
const loadBalanceCss = read('styles/analysis-load-balance-profile-alignment.css');

for (const marker of [
  'analysis-load-profile-header',
  'analysis-load-profile-decision',
  'analysis-load-profile-evidence',
  'analysis-load-profile-metrics',
  'analysis-load-profile-ledger',
  'analysis-load-profile-methodology',
]) {
  assert.ok(insightSource.includes(marker), `Load Balance is missing ${marker}.`);
}

assert.ok(
  insightSource.indexOf('analysis-load-profile-decision') < insightSource.indexOf('analysis-load-profile-evidence'),
  'The coaching decision must precede analytical evidence.',
);
assert.ok(
  insightSource.indexOf('analysis-load-profile-ledger') < insightSource.indexOf('analysis-load-profile-methodology'),
  'Methodology must remain supporting content after recent training.',
);
assert.match(insightSource, /onPointerMove=\{handleLoadPointerMove\}/);
assert.match(insightSource, /onPointerLeave=\{handleLoadPointerLeave\}/);
assert.match(insightSource, /navigate\('\/today-run'\)/);
assert.match(insightSource, /navigate\(`\/run\/\$\{row\.id\}`\)/);
assert.match(indexCss, /analysis-load-balance-profile-alignment\.css/);
assert.match(loadBalanceCss, /prefers-reduced-motion/);
assert.match(loadBalanceCss, /theme-midnight/);
```

- [ ] **Step 2: Run the guard and verify failure**

Run: `node frontend/src/pages/analysis/__tests__/analysisSubpageNav.smoke.test.js`

Expected: FAIL because the new stylesheet and `analysis-load-profile-*` structure do not exist.

### Task 2: Recompose Load Balance Around The Coaching Decision

**Files:**
- Modify: `frontend/src/pages/analysis/AnalysisInsightDetail.jsx:1849-2095`

- [ ] **Step 1: Replace the oversized hero with a compact Profile-style header**

Use the existing model fields and render the back control, page label/title, ratio ring, and zone in one section:

```jsx
<section className="analysis-load-profile-header">
  <div className="analysis-load-profile-heading">
    <button type="button" className="analysis-load-profile-back" onClick={() => navigate('/analysis')}>
      <AppIcon name="arrow_back" />
      <span>{t('analysis.detail_back')}</span>
    </button>
    <span className="analysis-load-profile-kicker">{loadDashboard.heroEyebrow}</span>
    <h1>{loadDashboard.heroTitle} <strong>{loadDashboard.heroAccent}</strong></h1>
  </div>
  <div className="analysis-load-profile-readiness">
    <div className="analysis-load-profile-ring" style={{ '--load-progress': `${loadDashboard.ratioProgress}%` }}>
      <strong>{loadDashboard.ratioValue}</strong>
    </div>
    <div>
      <span>{loadDashboard.statusLabel}</span>
      <strong className={`is-${loadDashboard.statusTone}`}>{loadDashboard.statusValue}</strong>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Move coaching judgment into the dominant action card**

Render the existing coach identity, judgment copy, training-window value, and Today Run CTA in `analysis-load-profile-decision` before any chart or methodology content.

- [ ] **Step 3: Preserve the SVG chart inside the asymmetric evidence workbench**

Move the current `analysis-load-command-chart-card` and ratio track into `analysis-load-profile-evidence`, keeping `loadChartGeometry`, tooltip/badge conditions, pointer handlers, gradient, paths, scrubber, and axis labels unchanged.

- [ ] **Step 4: Render metrics, recent-run ledger, then methodology**

Keep all existing model fields and click handlers, but order sections as:

```jsx
<section className="analysis-load-profile-metrics">...</section>
<section className="analysis-load-profile-ledger">...</section>
<section className="analysis-load-profile-methodology">...</section>
```

- [ ] **Step 5: Run the smoke guard**

Run: `node frontend/src/pages/analysis/__tests__/analysisSubpageNav.smoke.test.js`

Expected: still FAIL only for the missing stylesheet/import.

### Task 3: Add Isolated Profile-Aligned Styling

**Files:**
- Create: `frontend/src/styles/analysis-load-balance-profile-alignment.css`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Define route-scoped design tokens and canvas**

Create variables under `.analysis-insight-detail-page.is-load-balance .analysis-load-profile` for warm paper/card/ink/muted/accent/line/shadow values. Set the Load Balance canvas to Profile's full-width padding and vertical rhythm without touching shared shell selectors.

- [ ] **Step 2: Style the decision-first hierarchy**

Implement a compact header, ACWR conic-gradient ring, dark warm decision card, asymmetric chart/ratio workbench, compact metric strip, recent-run ledger, and quiet methodology card. Use tonal separation rather than hard borders.

- [ ] **Step 3: Add theme and accessibility states**

Add `body:is(.theme-midnight, .theme-high-contrast)` token overrides, `:focus-visible` outlines for every interactive element, pointer-safe chart overlays, and `@media (prefers-reduced-motion: reduce)` animation removal.

- [ ] **Step 4: Add tablet and mobile collapse**

At `1180px`, stack the evidence workbench and use two metric columns. At `760px`, stack all content, reduce padding, retain at least a 220px chart height, and wrap ledger metrics without horizontal overflow.

- [ ] **Step 5: Register the stylesheet last in the Analysis alignment group**

Add to `frontend/src/index.css`:

```css
@import './styles/analysis-load-balance-profile-alignment.css';
```

- [ ] **Step 6: Run the smoke guard**

Run: `node frontend/src/pages/analysis/__tests__/analysisSubpageNav.smoke.test.js`

Expected: `[PASS] Analysis subpage navigation guard passed.`

### Task 4: Record And Verify The Redesign

**Files:**
- Modify: `DESIGN_VERSIONS.md`

- [ ] **Step 1: Append the design revision**

Record the route, Profile reference, decision-first hierarchy, preserve list, files, and verification commands in the next `DV-2026-08-13-*` entry.

- [ ] **Step 2: Build the frontend**

Run: `cd frontend; node scripts/run-vite-build.mjs`

Expected: successful Vite build copied into backend static resources.

- [ ] **Step 3: Verify runtime synchronization**

Run: `node tools/verify-frontend-runtime-sync.mjs`

Expected: source, built static state, and live runtime report synchronized.

- [ ] **Step 4: Verify desktop in the in-app Browser**

Open authenticated `http://localhost:8080/analysis/load-balance` at approximately `1265x710`. Confirm the Analysis rail remains visible, the recommendation is the dominant surface, the chart scrubber responds, route buttons work, and the console has no new errors.

- [ ] **Step 5: Verify mobile in the in-app Browser**

Resize to approximately `390x844`. Confirm the content stacks, no horizontal overflow exists, the chart remains readable, controls remain reachable, and the console has no new errors.

- [ ] **Step 6: Inspect the final diff**

Run: `git diff --check -- frontend/src/pages/analysis/AnalysisInsightDetail.jsx frontend/src/styles/analysis-load-balance-profile-alignment.css frontend/src/index.css frontend/src/pages/analysis/__tests__/analysisSubpageNav.smoke.test.js DESIGN_VERSIONS.md`

Expected: no whitespace errors. Verify unrelated staged or working-tree changes remain untouched.

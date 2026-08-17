# Analysis Subnav Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Analysis rail collapse toggle fully contained and deliberately aligned in both expanded and collapsed desktop states.

**Architecture:** Preserve `AnalysisSubpageNav.jsx` and its state wiring. Add Analysis-specific layout and control-surface overrides in `analysis-subnav.css`, protected by source-level smoke assertions so shared Profile navigation styles cannot silently reintroduce edge crowding.

**Tech Stack:** React 19, CSS, Node.js smoke tests, Vite

---

### Task 1: Lock the placement contract

**Files:**
- Modify: `frontend/src/pages/analysisSubpageNav.smoke.test.js`
- Test: `frontend/src/pages/analysisSubpageNav.smoke.test.js`

- [ ] **Step 1: Write the failing source-level assertions**

Add these assertions after the existing active-link style assertion:

```js
assert.match(
  styleSource,
  /\.analysis-subnav-header\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+40px;/,
  'The expanded Analysis header should reserve an inset column for the toggle.',
);
assert.match(
  styleSource,
  /\.analysis-subnav \.runner-dashboard-sidebar-toggle\s*\{[\s\S]*?width:\s*40px;[\s\S]*?height:\s*40px;/,
  'The Analysis toggle should keep a fixed contained hit target.',
);
assert.match(
  styleSource,
  /\.analysis-subnav \.runner-dashboard-toggle-glyph\s*\{[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px;[\s\S]*?border-radius:\s*999px;/,
  'The visible toggle surface should remain centered inside its hit target.',
);
assert.match(
  styleSource,
  /\.runner-dashboard-page\.is-sidebar-collapsed \.analysis-subnav-header\s*\{[\s\S]*?grid-template-columns:\s*1fr;[\s\S]*?justify-items:\s*center;/,
  'The collapsed Analysis header should center its compact controls.',
);
```

- [ ] **Step 2: Run the smoke test and confirm RED**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' frontend/src/pages/analysisSubpageNav.smoke.test.js
```

Expected: FAIL on the first new header-grid assertion because the Analysis header does not yet define a fixed toggle column.

### Task 2: Implement the inset header control

**Files:**
- Modify: `frontend/src/styles/analysis-subnav.css`
- Test: `frontend/src/pages/analysisSubpageNav.smoke.test.js`

- [ ] **Step 1: Add the expanded and collapsed control styles**

Extend the header styles with the following focused rules:

```css
.analysis-subnav-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  align-items: start;
  column-gap: 8px;
}

.analysis-subnav-header .runner-dashboard-brand-copy {
  min-width: 0;
}

.analysis-subnav .runner-dashboard-sidebar-toggle {
  width: 40px;
  height: 40px;
  padding: 4px;
  border: 0;
  background: transparent;
  box-shadow: none;
  transform: none;
}

.analysis-subnav .runner-dashboard-toggle-glyph {
  width: 32px;
  height: 32px;
  border: 1px solid var(--analysis-subnav-line);
  border-radius: 999px;
  background: var(--analysis-subnav-surface-strong);
  color: var(--analysis-subnav-ink);
  box-shadow: 0 8px 18px rgba(81, 50, 33, 0.12);
}

.analysis-subnav .runner-dashboard-sidebar-toggle:hover,
.analysis-subnav .runner-dashboard-sidebar-toggle:focus-visible {
  background: transparent;
  outline: none;
  transform: none;
}

.analysis-subnav .runner-dashboard-sidebar-toggle:hover .runner-dashboard-toggle-glyph,
.analysis-subnav .runner-dashboard-sidebar-toggle:focus-visible .runner-dashboard-toggle-glyph {
  border-color: color-mix(in srgb, var(--analysis-subnav-active) 34%, transparent);
  background: color-mix(in srgb, var(--analysis-subnav-active-soft) 54%, var(--analysis-subnav-surface-strong));
  color: var(--analysis-subnav-active);
}

.runner-dashboard-page.is-sidebar-collapsed .analysis-subnav-header {
  grid-template-columns: 1fr;
  justify-items: center;
  row-gap: 8px;
  min-height: 100px !important;
}

.runner-dashboard-page.is-sidebar-collapsed .analysis-subnav .runner-dashboard-sidebar-toggle {
  width: 40px;
  height: 40px;
}
```

- [ ] **Step 2: Run targeted tests and confirm GREEN**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' frontend/src/pages/analysisSubpageNav.smoke.test.js
& 'C:\Program Files\nodejs\node.exe' frontend/src/pages/predictionProfileAlignment.smoke.test.js
```

Expected: both commands print `[PASS]` and exit 0.

- [ ] **Step 3: Build and verify runtime synchronization**

Run:

```powershell
Set-Location frontend
& 'C:\Program Files\nodejs\node.exe' scripts/run-vite-build.mjs
Set-Location ..
& 'C:\Program Files\nodejs\node.exe' .tools/verify-frontend-runtime-sync.mjs --changed-file frontend/src/styles/analysis-subnav.css --changed-file frontend/src/pages/analysisSubpageNav.smoke.test.js
```

Expected: Vite build exits 0 and runtime sync reports the changed frontend source is represented in the built static state.

- [ ] **Step 4: Inspect the live control**

Open an authenticated `/prediction/5k` page at desktop width in the in-app browser. Confirm the expanded toggle sits inside the header's right column, the collapsed toggle is centered beneath the compact brand, the control does not translate toward an edge on hover or focus, and the toggle remains hidden at 860px and below.

- [ ] **Step 5: Record the design version**

Append a concise entry to `DESIGN_VERSIONS.md` describing the inset Analysis toggle, the preserved behavior, and the verification evidence.

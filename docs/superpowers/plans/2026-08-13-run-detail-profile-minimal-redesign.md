# Run Detail Profile Minimal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/run/:id` as a minimal Profile-aligned evidence page while preserving every existing run-data interaction.

**Architecture:** Add one route-specific stylesheet imported after shared treatments, opt the loaded Run Detail state into a dedicated class, and make only the small JSX hierarchy changes needed to remove duplicate information and align Coach/Gear sections. Keep all data fetching, calculations, chart behavior, and shell composition in place.

**Tech Stack:** React 19, React Router, Chart.js, Leaflet, CSS, Node smoke tests, Vite.

---

### Task 1: Add the redesign contract

**Files:**
- Modify: `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`
- Test: `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`

- [x] **Step 1: Write the failing test**

Read `styles/run-detail-profile-minimal.css` and assert the new root hook, stylesheet import order, map-led grid, Profile token values, compact header, responsive breakpoints, focus treatment, and reduced-motion rule. Assert that the loaded JSX removes `run-detail-map-overlay` and gives Gear a real section heading.

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend; node src/pages/runDetailProfileCockpit.smoke.test.js`

Expected: FAIL because `styles/run-detail-profile-minimal.css` and `run-detail-profile-minimal` do not exist.

### Task 2: Implement the Profile-aligned structure

**Files:**
- Modify: `frontend/src/pages/RunDetail.jsx`

- [x] **Step 1: Add the minimal loaded-state hook**

Change the loaded root to `run-detail-page run-detail-profile-cockpit run-detail-profile-minimal` while keeping loading and empty states on the base cockpit class.

- [x] **Step 2: Simplify duplicate and misaligned content**

Add the existing `run_detail.hero_eyebrow` above the activity title, remove the duplicate map distance overlay, and convert Gear into a standard `run-detail-section` with an `h2` plus nested panel.

### Task 3: Implement the route-specific visual system

**Files:**
- Create: `frontend/src/styles/run-detail-profile-minimal.css`
- Modify: `frontend/src/index.css`

- [x] **Step 1: Define scoped tokens and page rhythm**

Use Profile-derived paper/card/text/accent/radius tokens under `.run-detail-profile-minimal`, preserve the runner-shell canvas, and set a compact transparent header.

- [x] **Step 2: Build the responsive content hierarchy**

Implement the desktop map/rail and coach/gear grids, tablet stacks and three-card metric strip, mobile one-column layout, telemetry control treatment, table overflow, focus-visible states, and reduced-motion fallback.

- [x] **Step 3: Import the stylesheet last**

Add `@import './styles/run-detail-profile-minimal.css';` after shared page treatment imports in `frontend/src/index.css` so the route-specific design wins without broad selectors.

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend; node src/pages/runDetailProfileCockpit.smoke.test.js`

Expected: `[PASS] Run Detail profile cockpit guardrails passed.`

### Task 4: Document and verify

**Files:**
- Modify: `DESIGN_VERSIONS.md`

- [x] **Step 1: Record the design round**

Append the scope, Profile reference, preserve list, structural changes, and proof gates to `DESIGN_VERSIONS.md`.

- [x] **Step 2: Run focused and adjacent tests**

Run: `cd frontend; node src/pages/runDetailProfileCockpit.smoke.test.js; node src/pages/loadingSkeleton.smoke.test.js`

Expected: both tests pass.

- [x] **Step 3: Build and prove runtime state**

Run: `cd frontend; node scripts/run-vite-build.mjs`

Run: `node .tools/verify-frontend-runtime-sync.mjs --files frontend/src/pages/RunDetail.jsx frontend/src/pages/runDetailProfileCockpit.smoke.test.js frontend/src/styles/run-detail-profile-minimal.css frontend/src/index.css`

Run: `Invoke-WebRequest -UseBasicParsing http://localhost:8080/run/1680 | Select-Object StatusCode`

Expected: build exits `0`, runtime sync passes, and the route returns `200`.

## Self-Review

- Spec coverage: structure, modes, responsiveness, preservation, accessibility, tests, and runtime proof are each mapped to a task.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: this is a styling/markup-only change; existing state, API response fields, callbacks, and chart definitions remain unchanged.

## Verification Result

- Red/green proof: the new Run Detail guard failed on the missing hook/import, then passed after implementation.
- Focused tests: Run Detail and shared loading skeleton guards pass.
- Full frontend runner: 159 pass; four unrelated dirty-worktree redesign tests fail for Add Shoes, Login, Runs, and Shoes.
- Build/runtime: Vite build and frontend runtime sync pass; `/run/1680` returns `200`; served CSS/JS contain the minimal hook, Profile token layer, responsive rules, and Gear section while omitting the removed map overlay.
- Visual limitation: browser-harness times out and the embedded automated browser is unauthenticated at `/login`, so an authenticated screenshot comparison was not available in this session.

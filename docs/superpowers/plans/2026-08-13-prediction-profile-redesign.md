# Prediction Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe `/prediction/:distKey` with the Profile dashboard's compact editorial hierarchy while preserving every prediction and navigation contract.

**Architecture:** Keep `PredictionDetail.jsx` as the data owner and make presentation-only JSX ordering changes. Add a route-scoped stylesheet after the shared glass cascade so Profile parity is isolated from other Analysis surfaces, and lock the hierarchy with a source smoke test.

**Tech Stack:** React 19, React Router, Chart.js, Vite, CSS, Node smoke tests.

---

### Task 1: Lock The Profile Hierarchy

**Files:**
- Create: `frontend/src/pages/prediction/__tests__/predictionProfileAlignment.smoke.test.js`

- [ ] **Step 1: Write the failing smoke test**

Assert that `PredictionDetail.jsx` contains `prediction-profile-content`, `prediction-profile-metric-strip`, and `prediction-profile-training-grid`; assert that `index.css` imports the new stylesheet after `all-pages-liquid-glass.css`; assert dual-theme, tablet, mobile, focus-visible, reduced-motion, and matching skeleton rules exist. The existing `frontend/scripts/run-tests.mjs` already auto-discovers every `*.test.js` file under `src`, so no test-runner registration edit is needed.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node frontend/src/pages/prediction/__tests__/predictionProfileAlignment.smoke.test.js`

Expected: FAIL because the new wrapper, layout markers, and stylesheet do not exist yet.

### Task 2: Reorder Existing Prediction Content

**Files:**
- Modify: `frontend/src/pages/prediction/PredictionDetail.jsx`

- [ ] **Step 1: Add the route content boundary**

Replace the inner `prediction-forecast-cockpit` wrapper with `prediction-profile-content prediction-forecast-cockpit`.

- [ ] **Step 2: Create the Profile metric strip**

Move the existing `prediction-evidence-grid` immediately after the forecast hero and add `prediction-profile-metric-strip`; keep the same `evidenceTiles.map(...)` data rendering.

- [ ] **Step 3: Create the training grid**

Wrap the existing effort ladder and coach rail in `prediction-profile-training-grid`. Remove the obsolete `prediction-command-grid` wrapper without changing any labels, recommendation data, or navigation callbacks.

- [ ] **Step 4: Preserve the trend section**

Keep the existing chart data, options, fallback, window pills, and trend card after the training grid.

### Task 3: Add The Profile-Aligned Presentation Layer

**Files:**
- Create: `frontend/src/styles/prediction-profile-alignment.css`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Import the route stylesheet late**

Import `./styles/prediction-profile-alignment.css` after `./styles/all-pages-liquid-glass.css` so route-specific values win the shared cascade.

- [ ] **Step 2: Define scoped light and dark tokens**

Use Profile-compatible paper/card/ink/coral tokens under `.prediction-detail-page .prediction-profile-content`; add dark overrides under `body:is(.theme-midnight, .theme-high-contrast)`.

- [ ] **Step 3: Build the hierarchy**

Style a compact padded canvas, a bounded dark hero, a four-column metric strip, a `1.45fr / 0.75fr` training grid, compact effort rows, a dark coach card, and one tonal trend card. Use 20px/16px/12px radii and tonal separation instead of divider-heavy containment.

- [ ] **Step 4: Add interaction and responsive states**

Provide focus-visible states for actions, collapse hero/training layouts below 1080px, collapse metrics below 760px, stack actions and effort-row content below 560px, and disable entrance/transition motion for reduced-motion users.

### Task 4: Align The Loading State

**Files:**
- Modify: `frontend/src/components/PageSkeleton.jsx`
- Modify: `frontend/src/styles/loading-skeleton.css`

- [ ] **Step 1: Match the new geometry**

Keep the prediction skeleton inside the existing `RunnerFrame`, but reserve a compact focal card, a four-item metric strip, a two-column training row, and a full-width trend card in the same order as the loaded page.

- [ ] **Step 2: Add responsive skeleton rules**

Collapse the prediction metric and training grids at the same breakpoints as the live page.

### Task 5: Record And Verify The Redesign

**Files:**
- Modify: `DESIGN_VERSIONS.md`

- [ ] **Step 1: Run the focused smoke test**

Run: `node frontend/src/pages/prediction/__tests__/predictionProfileAlignment.smoke.test.js`

Expected: PASS with the Profile hierarchy message.

- [ ] **Step 2: Run the related navigation and skeleton tests**

Run: `node frontend/src/pages/analysis/__tests__/analysisSubpageNav.smoke.test.js`

Run: `node frontend/src/test/contracts/loadingSkeleton.smoke.test.js`

Expected: both PASS.

- [ ] **Step 3: Run production verification**

Run: `cd frontend; node scripts/run-vite-build.mjs`

Run: `node tools/verify-frontend-runtime-sync.mjs --files frontend/src/pages/prediction/PredictionDetail.jsx frontend/src/styles/prediction-profile-alignment.css frontend/src/components/PageSkeleton.jsx frontend/src/styles/loading-skeleton.css frontend/src/index.css`

Expected: build and runtime sync PASS.

- [ ] **Step 4: Record the design version**

Add a newest-first `DV-2026-08-13-02` entry describing the Profile-aligned prediction hierarchy, preserve list, and rollback target `working tree before this change`.

- [ ] **Step 5: Check the scoped diff**

Run: `git diff --check -- frontend/src/pages/prediction/PredictionDetail.jsx frontend/src/styles/prediction-profile-alignment.css frontend/src/components/PageSkeleton.jsx frontend/src/styles/loading-skeleton.css frontend/src/index.css frontend/src/pages/prediction/__tests__/predictionProfileAlignment.smoke.test.js DESIGN_VERSIONS.md`

Expected: no whitespace errors.

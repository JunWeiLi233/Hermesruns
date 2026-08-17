# Analysis Coach Insight Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax to track completion.

**Goal:** Redesign `/analysis/coach-insight` to use the Profile page's warm editorial hierarchy while preserving every existing coach datum and action.

**Architecture:** Keep `buildMergedCoachSystemModel` and all route behavior unchanged. Refactor only the `coach-insight` JSX branch into a route-specific `analysis-coach-profile-*` hierarchy, then add isolated responsive styling in the Analysis stylesheet. Guard the contract with a source-level smoke test that checks layout markers, data bindings, actions, and responsive rules.

**Tech Stack:** React 19, React Router, CSS, Node smoke tests, Vite

---

## Task 1: Add A Failing Redesign Contract

**Files:**
- Create: `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`
- Read: `frontend/src/pages/AnalysisInsightDetail.jsx`
- Read: `frontend/src/styles/_split/analysis.css`

- [x] Add a Node smoke test that isolates the `coach-insight` JSX branch.
- [x] Assert the branch contains the Profile-aligned hero, metric strip, workbench, blueprint, recent sessions, and evidence-grid class markers.
- [x] Assert the branch still binds readiness, forecast, key workout, performance, recent-run, phase, focus, and reason data.
- [x] Assert navigation to `/analysis`, `/run/${row.id}`, and `/today-run` remains present.
- [x] Assert the new CSS is route scoped and contains desktop, tablet, and mobile layout rules.
- [x] Run `node src/pages/analysisCoachInsightProfileRedesign.smoke.test.js` from `frontend` and confirm it fails because the new structure is not implemented yet.

## Task 2: Refactor The Coach Insight Markup

**Files:**
- Modify: `frontend/src/pages/AnalysisInsightDetail.jsx`
- Test: `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`

- [x] Replace only the `insightKey === 'coach-insight'` presentation branch with an `analysis-coach-profile` wrapper.
- [x] Build a dark editorial hero containing the back action, live-cycle context, coach identity, coaching judgment, narrative, and readiness score.
- [x] Move forecast, key workout, and training focus into a compact three-card metric strip.
- [x] Build an asymmetric workbench with performance and recent sessions on the left and the training blueprint plus Today Run CTA on the right.
- [x] Preserve the phase, focus, and reasoning cards in a bottom evidence grid.
- [x] Preserve the existing trend SVG, recent-run navigation, blueprint session details, and Today Run action without changing model construction or API behavior.

## Task 3: Add Profile-Aligned Route Styling

**Files:**
- Modify: `frontend/src/styles/_split/analysis.css`
- Test: `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`

- [x] Add locally scoped warm-paper, ink, coral, border, and shadow tokens under `.analysis-coach-profile`.
- [x] Style the hero as the single dark feature surface with editorial typography and a prominent readiness dial.
- [x] Style metric, workbench, recent-session, blueprint, CTA, and evidence cards using restrained borders and shadows rather than glass effects.
- [x] Add responsive behavior: stacked workbench at 1180px, one-column metric/evidence layouts at 760px, and compact actions/session rows at 640px.
- [x] Preserve focus-visible states, dark-theme readability, and reduced-motion behavior.
- [x] Run the focused smoke test and confirm it passes.

## Task 4: Verify The Surface

**Files:**
- Verify: `frontend/src/pages/AnalysisInsightDetail.jsx`
- Verify: `frontend/src/styles/_split/analysis.css`
- Verify: `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`

- [x] Run the focused redesign smoke test.
- [x] Run relevant Analysis navigation and visual contract smoke tests.
- [x] Run frontend lint and report any pre-existing warnings separately.
- [x] Run `node scripts/run-vite-build.mjs` from `frontend`.
- [x] Run `.tools/verify-frontend-runtime-sync.mjs` from the repository root.
- [x] Run `git diff --check` for the changed files.
- [x] Inspect the live route in a browser when the local runtime is available; otherwise report that visual runtime proof was unavailable.
- [x] Run the full frontend test command and distinguish known unrelated failures from redesign regressions.

## Execution Constraint

The checkout contains unrelated staged and unstaged work. Do not reset, restore, stage, or commit implementation files as part of this plan; limit edits to the three files listed above and preserve the existing index.

# Add Shoes Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/shoes/add` with the current Profile page's warm dossier, bento-grid, and decision-card language without changing the shoe intake workflow.

**Architecture:** Keep `AddShoes.jsx` state, API calls, catalog filtering, validation, navigation, and translations intact. Add one route hook and a late route-scoped stylesheet that maps the existing hero, status rail, brand browser, model browser, and setup form onto the shared Profile tokens and responsive geometry.

**Tech Stack:** React 19, React Router, CSS, Node smoke tests, Vite.

---

### Task 1: Lock the Profile-aligned visual contract

**Files:**
- Modify: `frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`
- Test: `frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`

- [ ] **Step 1: Write the failing guard**

Assert that `AddShoes.jsx` exposes `add-shoes-profile-redesign` and `data-design-reference="profile-dashboard"`, `index.css` imports `add-shoes-profile-alignment.css` after shared liquid-glass and dark-mode layers, and the stylesheet defines Profile tokens, 16-column hero/workbench grids, a dark selected-shoe panel, responsive collapse, and reduced-motion handling.

- [ ] **Step 2: Run the guard and confirm RED**

Run: `node frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`

Expected: FAIL because the Profile redesign hook and stylesheet import do not exist yet.

### Task 2: Implement the Profile-aligned route layer

**Files:**
- Modify: `frontend/src/pages/AddShoes.jsx`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/styles/add-shoes-profile-alignment.css`

- [ ] **Step 1: Add the route hook**

Add `add-shoes-profile-redesign` and `data-design-reference="profile-dashboard"` to the existing root element. Do not alter component state or event handlers.

- [ ] **Step 2: Add the late Profile stylesheet**

Define route-local Profile paper, ink, line, accent, and carbon tokens; a compact 10/6 hero; a three-cell status rail; a 16-column workbench; warm dossier cards; a dark featured-brand and selected-shoe decision panel; four-column model cards; Profile-style fields/actions; dual-theme rules; tablet/mobile collapse; and reduced-motion behavior.

- [ ] **Step 3: Import the stylesheet last**

Load `add-shoes-profile-alignment.css` after the existing shared and route layers so older Add Shoes rules cannot recreate the oversized standalone hero.

- [ ] **Step 4: Run the guard and confirm GREEN**

Run: `node frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`

Expected: `[PASS] Add Shoes profile redesign guardrails passed.`

### Task 3: Verify source, build, and runtime synchronization

**Files:**
- Modify: `DESIGN_VERSIONS.md`

- [ ] **Step 1: Record the design version**

Append a Profile-aligned Add Shoes entry with the preserve list covering catalog load, filters, selection, save behavior, localization, themes, keyboard focus, and responsive layout.

- [ ] **Step 2: Run targeted checks**

Run: `node frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`

Run: `node frontend/src/pages/addShoesKineticEditorial.smoke.test.js`

Run: `git diff --check -- frontend/src/pages/AddShoes.jsx frontend/src/index.css frontend/src/styles/add-shoes-profile-alignment.css frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js DESIGN_VERSIONS.md`

- [ ] **Step 3: Build and sync**

Run from `frontend`: `node scripts/run-vite-build.mjs`

Run from repository root: `node .tools/verify-frontend-runtime-sync.mjs --files frontend/src/pages/AddShoes.jsx frontend/src/index.css frontend/src/styles/add-shoes-profile-alignment.css frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`

Expected: production build and runtime sync both pass.

- [ ] **Step 4: Inspect the protected route when authentication permits**

Reload `/shoes/add` and verify desktop hierarchy, form focus, responsive collapse, and console errors. If the browser session redirects to `/login`, report visual verification as blocked by authentication rather than claiming it passed.

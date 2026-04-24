# Add Shoes Kinetic Editorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/shoes/add` into a kinetic-editorial footwear selection surface while preserving the live Hermes add-shoe workflow.

**Architecture:** Keep `AddShoes.jsx` as the workflow owner, but reshape the page into clearer editorial sections with a focused smoke test guarding the new hero, brand deck, model board, and setup payload panel. Reuse existing data and i18n contracts so the redesign is mostly structural and visual, not behavioral.

**Tech Stack:** React, shared global CSS in `frontend/src/styles/style.css`, Hermes i18n, existing smoke-test pattern using `node` + `assert`.

---

### Task 1: Add the Add Shoes smoke contract

**Files:**
- Create: `frontend/src/pages/addShoesKineticEditorial.smoke.test.js`
- Read: `frontend/src/pages/AddShoes.jsx`
- Read: `frontend/src/styles/style.css`

- [ ] **Step 1: Write the failing smoke test**

Assert that `AddShoes.jsx` contains:
- `add-shoes-editorial-hero`
- `add-shoes-brand-deck`
- `add-shoes-model-board`
- `add-shoes-setup-payload`

Assert that `style.css` contains matching class definitions.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node frontend/src/pages/addShoesKineticEditorial.smoke.test.js`

Expected: FAIL because the new class names do not exist yet.

### Task 2: Reshape the Add Shoes page structure

**Files:**
- Modify: `frontend/src/pages/AddShoes.jsx`

- [ ] **Step 1: Replace the current hero shell with the new editorial top fold**

Keep:
- current stats
- current shell/topbar/sidebar wiring

Change:
- hero structure
- section naming
- card hierarchy

- [ ] **Step 2: Rebuild brand selection into a visual deck**

Keep the same brand data and click behavior, but give the section a stronger premium-card composition.

- [ ] **Step 3: Rebuild the model stage into a premium board**

Keep:
- filter chips
- search
- selection logic

Change:
- stage composition
- model-card treatment
- section hierarchy

- [ ] **Step 4: Rebuild the setup form into a payload panel**

Keep:
- current form fields
- current submit logic

Change:
- selected-shoe summary presentation
- CTA hierarchy
- panel grouping

### Task 3: Rework the Add Shoes styling

**Files:**
- Modify: `frontend/src/styles/style.css`

- [ ] **Step 1: Add new Add Shoes section classes**

Create styles for:
- `add-shoes-editorial-hero`
- `add-shoes-brand-deck`
- `add-shoes-model-board`
- `add-shoes-setup-payload`

- [ ] **Step 2: Preserve mobile behavior**

Update responsive rules so the new sections still work down to mobile widths without collapsing into unreadable card walls.

- [ ] **Step 3: Keep light-mode compatibility**

Translate the new sections into the existing light-mode Add Shoes treatment rather than leaving them dark-only.

### Task 4: Update copy only if required

**Files:**
- Modify when needed: `frontend/src/i18n/translations.js`

- [ ] **Step 1: Reuse existing Add Shoes copy where possible**

Avoid gratuitous translation churn.

- [ ] **Step 2: If new user-facing copy is introduced, add both locales in the same pass**

### Task 5: Verification and versioning

**Files:**
- Modify: `DESIGN_VERSIONS.md`

- [ ] **Step 1: Re-run the focused Add Shoes smoke test**

Run: `node frontend/src/pages/addShoesKineticEditorial.smoke.test.js`

Expected: PASS.

- [ ] **Step 2: Run frontend verification**

Run:
- `cd frontend && npm run lint`
- `cd frontend && node scripts/run-vite-build.mjs`

- [ ] **Step 3: Append a new Add Shoes entry to `DESIGN_VERSIONS.md`**

Capture:
- surface
- files
- what changed
- why
- rollback target

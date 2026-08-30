# Add Shoes Step Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Add Shoes brand, model, and configuration stages as three separate full-width cards stacked vertically.

**Architecture:** Keep the existing Add Shoes state, handlers, forms, and catalog content. Flatten the current catalog-stage/setup-aside layout into one `add-shoes-catalog-workspace` flow with an unboxed stage heading followed by three sibling `add-shoes-step-card` sections. Route-local CSS will own the single-column card stack and remove the old shared stage surface.

**Tech Stack:** React 19, Vite, route-local CSS, Node smoke tests.

---

### Task 1: Add the structural regression guard

**Files:**
- Create: `frontend/src/pages/addShoesStepCards.smoke.test.js`
- Test: `frontend/src/pages/addShoesStepCards.smoke.test.js`

- [x] **Step 1: Add a failing assertion for three sibling cards**

Read `pages/AddShoes.jsx` and `styles/add-shoes-profile-alignment.css`, then assert that the source contains exactly three `add-shoes-step-card` sections, with the first two carrying `add-shoes-catalog-step` and the third carrying `add-shoes-setup-payload`. Also assert that the source no longer contains `add-shoes-setup-panel`, the workspace CSS uses one column, the legacy stage hook is non-painting, and the old step divider is absent.

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js
```

Expected: the new sibling-card assertion fails against the current shared-stage/aside structure.

### Task 2: Flatten the Add Shoes JSX structure

**Files:**
- Modify: `frontend/src/pages/AddShoes.jsx`

- [x] **Step 1: Move the stage heading to the workspace flow**

Keep the existing `add-shoes-stage-head` content, but remove the card-owning `add-shoes-browser-panel add-shoes-stage` wrapper. The heading becomes the first non-card child of `add-shoes-catalog-workspace`.

- [x] **Step 2: Make steps 1 and 2 independent cards**

Add `add-shoes-step-card` to both existing catalog step sections without changing their children, event handlers, or data expressions.

- [x] **Step 3: Move step 3 after step 2**

Remove the `add-shoes-setup-panel` aside and place the existing step 3 section directly after step 2 as the third sibling card. Preserve the selected summary, form, submit handler, cancel navigation, and disabled-state logic exactly.

### Task 3: Style the three-card vertical flow

**Files:**
- Modify: `frontend/src/styles/add-shoes-profile-alignment.css`

- [x] **Step 1: Make the workspace a full-width single-column stack**

Set `.add-shoes-catalog-workspace` to one column with the existing route width and a consistent gap. Remove its desktop two-column split and the breakpoint-specific one-column override that only existed for the catalog/setup pairing.

- [x] **Step 2: Remove the shared stage card paint**

Retain `.add-shoes-browser-panel.add-shoes-stage` and `.add-shoes-setup-panel` only as structural compatibility selectors, but make both non-painting with `display: contents` so stale markup cannot visually contain or column-split the steps. Apply the stage heading spacing directly in the workspace.

- [x] **Step 3: Give each step consistent card treatment**

Use the existing `.add-shoes-step-card` visual language for all three cards. Keep the model board, brand deck, setup payload shell, dark-theme selectors, mobile padding, and reduced-motion rules compatible with the flattened structure.

### Task 4: Verify and record the change

**Files:**
- Modify: `DESIGN_VERSIONS.md`

- [x] **Step 1: Run focused smoke tests**

Run:

```powershell
node frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js
node frontend/src/pages/addShoesKineticEditorial.smoke.test.js
node frontend/src/pages/addShoesStepCards.smoke.test.js
```

Expected: all three commands exit with code 0.

- [x] **Step 2: Run frontend lint and build**

Run:

```powershell
cd frontend
npm run lint
node scripts/run-vite-build.mjs
```

Expected: lint and build exit with code 0.

- [x] **Step 3: Run runtime proof when available**

Run:

```powershell
node .tools/verify-frontend-runtime-sync.mjs
```

If the helper is absent on this checkout, report runtime proof as unverified without fabricating a result.

- [x] **Step 4: Append the design version entry**

Add a new `DV-2026-08-29-003` entry to `DESIGN_VERSIONS.md` describing the three-card vertical Add Shoes workflow and preserving the existing workflow behavior.

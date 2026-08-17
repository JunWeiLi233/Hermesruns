# Run Detail Splits Icon Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ambiguous distance glyph beside the Run Detail "Splits / 分圈" navigation item with a dedicated running-track icon.

**Architecture:** Keep the existing navigation layout and shared SVG renderer. Add a new `splits` icon case to `AppIcon`, map only the split section to it, and lock both decisions with the existing source-contract smoke test.

**Tech Stack:** React 19 JSX, inline SVG, Node.js source-contract tests.

---

### Task 1: Guard the dedicated splits icon contract

**Files:**
- Modify: `frontend/src/pages/runsSubpageNav.smoke.test.js`

- [x] **Step 1: Write the failing test**

```js
const appIconSource = read('components/AppIcon.jsx');
assert.match(navSource, /run-detail-splits[^\n]+icon: 'splits'/);
assert.match(appIconSource, /case 'splits':[\s\S]*?<ellipse cx="12" cy="12" rx="8\.5" ry="5\.5" \/>/);
assert.match(appIconSource, /case 'splits':[\s\S]*?<ellipse cx="12" cy="12" rx="5\.2" ry="2\.6" \/>/);
```

- [x] **Step 2: Run the test and confirm it fails**

Run: `node frontend/src/pages/runsSubpageNav.smoke.test.js`

Expected: FAIL because `run-detail-splits` still uses `distance` and `AppIcon` has no `splits` case.

### Task 2: Implement the running-track glyph

**Files:**
- Modify: `frontend/src/components/AppIcon.jsx`
- Modify: `frontend/src/components/RunsSubpageNav.jsx`

- [x] **Step 1: Add the minimal icon geometry**

```jsx
case 'splits':
  return titled(
    <>
      <ellipse cx="12" cy="12" rx="8.5" ry="5.5" />
      <ellipse cx="12" cy="12" rx="5.2" ry="2.6" />
      <path d="M16.4 7.7v4.2" />
      <path d="M15 9.2h2.8" />
    </>
  );
```

- [x] **Step 2: Bind the split section to the dedicated glyph**

Change the `run-detail-splits` item from `icon: 'distance'` to `icon: 'splits'`.

- [x] **Step 3: Run targeted and build verification**

Run: `node frontend/src/pages/runsSubpageNav.smoke.test.js`

Expected: PASS with `[PASS] Runs subpage navigation guard passed.`

Run: `cd frontend; node scripts/run-vite-build.mjs`

Expected: production build completes and publishes the updated static assets.

**Verification note:** The targeted navigation and AppIcon coverage tests pass, the production build and runtime-sync proof pass, and `http://localhost:8080` serves the new bundle. The full frontend command completed with 172 contract tests passing and 9 unrelated existing contract failures outside this icon change.

# Shoe Scan Minimal Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered shoe-scan preview HUD with a minimal Profile-aligned upload panel without changing scan behavior.

**Architecture:** Keep the existing React state and file input. Remove decorative preview children from `Shoes.jsx`, then add a final component-scoped CSS contract in the active split stylesheet so late legacy and light-theme rules cannot restore the oversized presentation.

**Tech Stack:** React 19, vanilla CSS, Node smoke tests, Vite.

---

### Task 1: Guard The Minimal Preview Contract

**Files:**
- Modify: `frontend/src/pages/shoes/__tests__/shoeScanModalLayout.smoke.test.js`
- Test: `frontend/src/pages/shoes/__tests__/shoeScanModalLayout.smoke.test.js`

- [x] Add assertions rejecting `shoe-scan-modal-scan-line` and the `is-live` preview chip in `Shoes.jsx`.
- [x] Add an assertion requiring the `/* Minimal shoe scan preview */` CSS block, flat surface, compact heading scale, disabled overlay pseudo-elements, and rectangular preview action.
- [x] Run `node frontend/src/pages/shoes/__tests__/shoeScanModalLayout.smoke.test.js` and confirm it fails on the new minimal-preview assertion.

### Task 2: Implement The Minimal Preview

**Files:**
- Modify: `frontend/src/pages/shoes/Shoes.jsx`
- Modify: `frontend/src/styles/_split/shoes.css`

- [x] Remove the decorative scan line and duplicate live-status chip from the preview overlay while retaining the interactive file input and fallback count chip.
- [x] Add the final component-scoped minimal preview styles: flat paper background, 1px border, 16px radius, no shadow, compact icon/title/copy, no pseudo-element corners, and a bottom-right 8px-radius action.
- [x] Run the scan modal smoke test and confirm it passes.

### Task 3: Record And Verify

**Files:**
- Modify: `DESIGN_VERSIONS.md`

- [x] Add the next design version with the preview preserve list and rollback target.
- [x] Run the scan, edit-shoe, and Profile import modal smoke tests.
- [x] Run `cd frontend && npm run lint` and `cd frontend && node scripts/run-vite-build.mjs`.
- [x] Run `node tools/verify-frontend-runtime-sync.mjs --files frontend/src/pages/shoes/Shoes.jsx frontend/src/styles/_split/shoes.css frontend/src/pages/shoes/__tests__/shoeScanModalLayout.smoke.test.js` and confirm `/shoes` returns HTTP 200.

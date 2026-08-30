# Runner Strength Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import four research-backed runner-strength actions into the Muscle Training optional exercise library.

**Architecture:** Extend the existing `COMPOUND_TARGET_LIBRARY.legs` data rather than changing API or planner behavior. Keep every action complete across catalog content, reference image, privacy-enhanced video, and anatomy mapping so current UI consumers need no new rendering logic.

**Tech Stack:** React 19, JavaScript source-contract tests, Vite

---

### Task 1: Lock catalog coverage with a failing contract

**Files:**
- Modify: `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`
- Test: `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`

- [ ] **Step 1: Add expected researched keys**

Add an array containing `barbell-hip-thrust`, `single-leg-leg-press`, `glute-ham-raise`, and `squat-jump`, then assert each key exists in the compound library and raise the expected total from 24 to 28.

- [ ] **Step 2: Run the test and verify RED**

Run: `node frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`

Expected: FAIL because `barbell-hip-thrust` is not yet present.

### Task 2: Add complete optional-library records

**Files:**
- Modify: `frontend/src/pages/MuscleTraining.jsx`
- Test: `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`

- [ ] **Step 1: Add media mappings**

Add image and `youtube-nocookie.com` mappings for all four keys using the exact video IDs `NOnbakeElAQ`, `3aYsOsBA7ZE`, `Co7xAWe3hwo`, and `tZSYZdtbONc`.

- [ ] **Step 2: Add the four bilingual catalog records**

Append four `compoundLibraryExercise` records to `COMPOUND_TARGET_LIBRARY.legs`. Each record must supply equipment, sets, repetitions, RPE, English and Chinese muscles, intent, three steps, regression, and progression.

- [ ] **Step 3: Add anatomy mappings**

Map hip thrust and glute-ham raise to posterior-chain slugs, single-leg leg press to quadriceps/gluteal/hamstring/adductors/core, and squat jump to quadriceps/gluteal/hamstring/calves/core.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`

Expected: PASS with all 28 optional-library actions covered by media and anatomy contracts.

### Task 3: Verify the frontend artifact

**Files:**
- Verify: `frontend/src/pages/MuscleTraining.jsx`
- Verify: `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`

- [ ] **Step 1: Run adjacent video coverage**

Run: `node frontend/src/pages/muscleTrainingPlanVideoMapping.smoke.test.js`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `cd frontend; npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Build production assets**

Run: `cd frontend; node scripts/run-vite-build.mjs`

Expected: exit code 0 with a completed Vite production build.

- [ ] **Step 4: Check runtime-sync availability**

Run `.tools/verify-frontend-runtime-sync.mjs` only if it exists. If absent, report `source changed, live website not synced yet`.

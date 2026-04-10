# Sprint Ticket — 2026-04-10

## Sprint Goal
Overhaul the Races feature: translate the whole profile, fix the Add Race UI, and resolve the decimal input bug.

## Tasks

### Task 1 — Comprehensive Translations
- **Files**: `frontend/src/i18n/translations.js`
- **Context**: Ensure all labels and strings in the Races module are fully localized.
- **Done when**:
  - `zh-CN` and `en` blocks in `translations.js` contain all keys used in `Races.jsx`.
- **Verify**: Check `translations.js` for `races` keys.

### Task 2 — Races UI & Functional Fix
- **Files**: `frontend/src/pages/Races.jsx`, `frontend/src/styles/style.css`
- **Context**: Apply premium tokens to the Races page and fix the 42.195km input bug.
- **Done when**:
  - `step="0.001"` applied to distance input in `Races.jsx`.
  - `.history-hero`, `.race-row`, and `.modal-content` updated with premium tokens in `style.css`.
- **Verify**: Inspect `Races.jsx` and `style.css`.

### Task 3 — Queue Management
- **Files**: `TASKS.md`
- **Context**: Clean up the task queue.
- **Done when**:
  - Previous UI task and current 3 race tasks are checked off.
- **Verify**: Read `TASKS.md`.


## Runner Outcome
A more trustworthy and professional landing page that clearly communicates Hermes's coach-like intelligence.

## Product Outcome
Higher conversion from skeptical Strava users by projecting a "Pro" analytics vibe.

## Surface Outcome
`frontend/src/pages/Landing.jsx` transformed from generic to premium athletic tech.

# Admin contract completion — 2026-10-21

The admin frontend source contracts had retained selectors and layout assumptions from the earlier kinetic/profile design after the reference console redesign. The active UI is composed from imported sections and `admin-reference.css`.

The targeted baseline command was `node frontend/scripts/run-tests.mjs admin`, from the repository root. It reproduced **34 passing / 23 failing / 57 total contract files**. Evidence: `output/completion-admin-contracts-before.log`.

Only the 23 failing test files and a shared test helper in `frontend/src/pages/admin/__tests__/` were changed. The helper verifies that inspected sections are reachable from the actual Dashboard imports and that the reference stylesheet is actively imported. No admin application or stylesheet changes were made.

Updated contracts preserve the current equivalents of the original guardrails:

- Shared compact action pills, sidebar navigation/current-page state, desktop/mobile layout, theme tokens, keyboard focus and reduced motion.
- Priority attention queues with real counts and dispatch to their destination, selected users/shoes history charts, live KPI values, loading/error/empty states, and bounded trend fetching.
- Users search/filter resets, CSV export, page selection and mixed checkbox state, paging, saved-filter tools, and bulk operations that preview affected accounts before an explicit modal confirmation.
- The shoe review workspace, shared catalog loading, catalog-only legacy-grid gating, catalog identity deduplication, brand/series actions, modal geometry and catalog management tools.
- Course-map search/status controls and all-archive selection, bounded scroll rail and selected-row state, per-race pending/live preview selection, matching confidence/localized summary, source/alignment warnings, timeline loading/error/empty states, and disabled/busy review actions.
- Audit search/status filtering, per-record and bulk confirmation modals, destructive endpoint wiring, localized confirmation labels, and status-message dismissal.

Final command: `node frontend/scripts/run-tests.mjs admin`.

**57 passed / 0 failed / 57 total source-contract files.** Evidence: `output/completion-admin-contracts-after.log`. These are source-contract checks; the separate full frontend unit and browser checks are reported by the coordinating agent.

# Frontend test and pagination follow-up — 2026-10-21

This report covers the previously failing frontend suites and their verification alongside the activity-history pagination work. Existing unrelated working-tree edits were preserved. The original six unit suites required fixture/assertion updates. The later source-contract review also fixed a Node-compatible import in the weekly summary utility and Profile's cache quota recovery.

## Failure diagnosis and fixes

- Schedule's account-calendar and session-explanation tests mounted the page without `ThemeProvider`. The real application supplies this provider, and the integrated authoring tools require it. Tests now mount the real provider, preserving the timezone, training rationale, navigation, completion and localization assertions.
- Once Schedule could render, two stale expectations became visible. A selected rest day uses its calendar workout title. The next-session selection is constrained to the visible week, as required by the existing `weeklySessionSelection` tests. The session test now waits for initial selection to settle, verifies that the current rest day remains selected, navigates to next week, and verifies the future workout's date and expanded details.
- The team workspace test supplied only the workspace translation namespace and assumed an always-open creation form. It now supplies the current English dictionary and opens **Create a team** before entering the name. The POST payload, same-origin credentials and CSRF assertions remain.
- The native editor test expected retired copy and supplied an incomplete save response. The fixture now returns the saved title, source and sport along with its identifier/version, matching the editor's unchanged-version comparison. The test uses current save/schedule copy, still verifies version 2 in the event payload, and still holds the calendar refresh pending to prove the editor and name input survive. Its cache mock now supplies invalidation and asserts both activity/profile invalidation after scheduling, eliminating two previously hidden unhandled mock errors.
- The evidence calculation intentionally renders open; its supporting disclosure renders closed. The test now verifies those initial states and both independent toggles while preserving all authoritative budget, formula, recovery and unit assertions.
- The methods-document test assumed at least five inline `HowWorkedOut` sentences, while redesigned views use disclosure links. It now inventories both inline `textKey` values and direct methods translations, requires representative real keys to keep the check non-vacuous, and verifies every discovered key in English and Chinese. All document-anchor checks remain.

## Additional source contracts

The full source-contract baseline found **46 failing files out of 357**. The non-admin, non-Runs portion owned by this follow-up consisted of 14 files:

- `scheduleCoachSummary.js` imported `./timeZone` without its `.js` extension. Vite resolved it, but the plain Node contract runner could not. The import now works in both environments.
- Prediction guards now require the complete lightweight analysis history adapter and its typed `/api/activities/analysis` request. Analysis guards retain conditional localized injury advice and verify that Trends remains an anchored inline section supplied by the parent history.
- Profile guards require the current deferred goals card without duplicate evidence, the coach enrichment publisher for missing/deferred prescriptions, and its current shared goal dialog. Dialog cascade checks additionally verify the goal portal card, real target label/decimal input, validation/hint association and announced error.
- Heatmap guards account for the explicit simple mode while retaining auth hydration, stable map dependencies, bounds refs, capped drawing and zoom/cache assertions.
- Legal guards require the shared labelled legal-document main. Race and Shoes guards check the actual stylesheet/test-runner ordering while retaining field, layout and locale assertions. The Today palette guard recognizes its current route scope.
- The static-image guard permits only the already compressed `schedule-session.jpg`, verifies its real Schedule import and enforces a **64 KiB maximum**. All other PNG/JPEG assets remain prohibited by the existing contract; no asset was removed or changed.

Admin redesign contracts and Runs/cross-page pagination contracts are owned by the other coordinated workstreams.

The later complete contract rerun exposed one additional Profile quota guard after the Runs cache moved to v3. Investigation found that Profile's existing quota recovery evicted only v1 Runs caches. Current v3 and previous v2 siblings could therefore keep storage full and cause the slim Profile snapshot to be dropped. Recovery now evicts those versioned cache siblings as well. A behavioral contract executes the actual writer against simulated quota pressure, preserves authentication and unit preferences, and verifies successful recovery without a warning. It failed before the source change and passed afterward. The source contract also verifies complete v3 snapshots, matching source counts, paginated completion evidence and v1/v2 invalidation.

## Verification evidence

All commands ran from `frontend/` unless stated otherwise.

- Baseline rerun of the original six failing suites: **59 failed, 20 passed, 55 unhandled errors**, exit 1. Log: `output/frontend-followup-baseline.log`.
- Targeted non-pagination rerun, including the existing weekly selection contract: **6 files, 76 tests passed**, exit 0, no unhandled errors. Log: `output/frontend-followup-targeted-nonpaging.log`.
- Account-calendar Schedule cases: **4 tests passed, 1 Runs case excluded**, exit 0, no unhandled errors. Log: `output/frontend-followup-account-calendar.log`.
- All 14 assigned non-admin, non-Runs source-contract files: **14 passed, 0 failed**. Log: `output/frontend-followup-other-contracts.log`.
- Profile cache quota behavioral regression: failed before the fix, passed afterward. Logs: `output/frontend-profile-cache-quota-red.log`, `output/frontend-profile-cache-quota-green.log`.
- Frozen-source full `npm run test:unit -- --maxWorkers=2 --reporter=verbose`: **204 files, 2,621 tests passed**, exit 0, **0 unhandled errors**, 228.57 seconds. Log: `output/pagination-frontend-frozen-all-unit.log`.
- Frozen-source full `npm run test:contracts`: **357 contract files passed, 0 failed**, followed by **5 prerender tests passed**, exit 0. Log: `output/pagination-frontend-frozen-contracts.log`.
- ESLint over this workstream's 21 changed source/test files: exit 0, no diagnostics. Log: `output/frontend-followup-changed-lint.log`.
- Additional Profile quota writer/regression ESLint: exit 0. Log: `output/frontend-profile-cache-quota-lint.log`.
- Full final `npm run lint`: exit 0, no diagnostics. Log: `output/pagination-frontend-final-lint.log`.
- Full final `npm run typecheck`: exit 0. Log: `output/pagination-frontend-final-typecheck.log`.
- Repository `git diff --check`: exit 0; existing line-ending conversion notices only.

Only the completed frozen-source unit and contract runs above are final completion evidence. Existing React test-timing warnings remain, but there were no unit failures or unhandled errors. Root coordination owns the build; this test follow-up does not run it because that script swaps local backend static output.

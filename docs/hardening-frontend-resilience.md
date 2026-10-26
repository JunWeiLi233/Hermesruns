# Frontend resilience audit — 2026-10-21

Scope: the shared API/resource-cache path, Settings (especially the plan/payment card), and the critical list reads on Runs, Shoes, and Analysis. This was a targeted audit; it does not certify every page, form, or network failure mode. Existing unrelated working-tree changes were preserved.

This document records the initial hardening validation. The later [test and pagination completion report](test-pagination-completion-2026-10-21.md) supersedes its wider-suite status and pagination-adoption limitation.

## Existing safeguards verified

- `frontend/src/api.ts` adds the current bearer credential and language. Wake retries are limited to safe GET/HEAD/OPTIONS methods and transient network/502/503/504 failures; mutation requests are not blindly retried. Session handling prevents a late 401 for a retired credential from signing out its replacement, and expired admin MFA returns the portal to authentication.
- The resource cache already shared concurrent activity/profile reads, cached only successful results for a bounded freshness interval (activities: 120 seconds; profile: 15 seconds), cloned results for each consumer, and prevented invalidated in-flight results from restoring stale data.
- Settings already had an initial loading skeleton, a recoverable top-level load error, a 12-second initial-load abort, and separate loading/empty/unavailable activity-graph copy. Export errors and concurrent-export responses, failed account deletion, failed Strava disconnect, OAuth retry feedback, and navigation cleanup have existing UI handling. The related settings/API tests were rerun.
- Runs already distinguished cached populated history, genuinely empty account history, and filters with no matches, while retaining import/connect actions. Shoes already had an add-pair empty state, protected pending edit saves, retained failed drafts, and exposed retryable scan failures. Analysis detail views already used a shared strict history loader with loading/error/retry/empty states. Representative behavior tests for these safeguards passed.

## Fixes

- `frontend/src/api/resourceCache.ts`: cache identity now includes the account, credential, and effective language. Custom request options (including explicit authorization/language headers and `cache: 'no-store'`) bypass the default-response cache. Allowlisted resources match path boundaries, avoiding accidental caching of similarly named endpoints.
- Shared cached reads now give each subscriber its own cancellation. One page can abort without cancelling a surviving reader. Once every subscriber cancels, the transport is aborted and detached so a retry can start a new request. Already-aborted callers reject even on a cache hit.
- `frontend/src/components/SettingsPlanCard.jsx`: failed or empty/malformed quota/config responses show a localized error with Retry instead of claiming the runner is free and payments are closed. Pending requests announce loading without labelling an unknown account. The existing closed-payments state remains available for a valid `configured: false` response.
- Plan loading and checkout have 12-second deadlines. Checkout uses an immediate request guard, disables payment/month controls while pending, unlocks after failure, and ignores abandoned results after timeout, navigation, or unmount. A successful redirect keeps the control locked while navigation starts.
- English and Simplified Chinese share the new `settings.plan_load_error` key; Retry reuses existing localized copy. Settings integration fixtures now return valid quota/config payloads.
- `frontend/src/api/requestDeadline.ts` bounds critical page reads to 12 seconds and honors caller cancellation even when a transport fails to settle. Runs, Shoes, and Analysis cancel these reads on unmount and when superseded. Late results cannot overwrite a successful retry.
- All three main pages reject invalid list payloads and null/array rows before rendering; invalid cached activity payloads are evicted so Retry can recover. Runs and Shoes now offer a direct localized retry on load failure; Analysis reuses its existing generic retry copy instead of labelling this action as reconnecting Strava. Existing valid-empty states remain intact.
- Shoes now makes one initial inventory request instead of reloading on its first transition to ready. Its optional duplicate lookup is bounded and independent of the owned inventory, so a hanging suggestion request cannot block the page.

## Validation

Regression tests were written and run before production changes: the original code failed 17 relevant cases. An additional cancellation-recovery test reproduced a request that remained stuck after its only subscriber cancelled; that test then passed after transport detachment was added.

The core-page follow-up added 26 behavior cases. Tests reproduced missing retry/error handling, stuck skeletons, duplicate shoe reads, and crashes caused by null/array rows before their fixes. Two existing source-contract tests were updated for cancellable reads and the already-existing shared recommendation-revision hook.

All commands ran from `frontend/`:

- `npm run test:unit -- src/api/resourceCache.vitest.ts src/components/SettingsPlanCard.vitest.jsx src/apiWakeRetry.vitest.ts src/apiAdminSession.vitest.ts src/apiHeatmapSession.vitest.ts src/api/recommendationRefresh.vitest.js src/pages/settings/__tests__/settingsReference.vitest.jsx src/pages/settings/__tests__/settingsStravaFeedback.vitest.jsx` — **8 files, 93 tests passed**. Includes 29 cache/payment tests.
- `npm run test:unit -- --maxWorkers=2 src/pages/coreReadResilience.vitest.jsx src/pages/runs/__tests__/runsHistoryStatus.vitest.jsx src/pages/shoes/__tests__/shoesRotationShelf.vitest.jsx src/pages/shoes/__tests__/shoeScanModal.vitest.jsx src/pages/analysis/__tests__/analysisOverviewRisk.vitest.jsx src/pages/analysis/__tests__/metricTrendPage.vitest.jsx src/api/resourceCache.vitest.ts` — **7 files, 115 tests passed**, including all 26 new core-page cases. One earlier wider-concurrency run timed out awaiting the lazy Trends section; its isolated rerun and the full bounded-worker rerun passed.
- `node --test src/pages/runs/__tests__/runsRoutePreviewCache.smoke.test.js src/pages/runs/__tests__/runsGridHeaderBackground.smoke.test.js` — **2 tests passed**.
- The initial full `npm run test:unit -- --maxWorkers=2` run completed with **196 files passing, 6 failing; 2,523 tests passing, 59 failing, and 55 unhandled errors** (`output/hardening-frontend-all-unit.log`). All new/changed hardening suites passed. Failure review found unrelated existing issues: 55 Schedule cases mount authoring controls without `ThemeProvider`; one evidence-disclosure test expects a collapsed section that the component opens; the methods-document test requires five source usages but finds two; and two training-workspace/editor tests expect missing form/receipt content. Their API/cache paths are mocked or separate from the changed transports. These failures were subsequently repaired in the follow-up, whose final full suite passed **2,621 tests in 204 files** with no unhandled errors; see the [completion report](test-pagination-completion-2026-10-21.md).
- `npm run typecheck` — passed.
- `npm run lint` — passed, no diagnostics.
- `npm run build` — passed again after the complete core-page follow-up, as did full `npm run lint` and `npm run typecheck`. Public home/terms/privacy prerender completed. The repository's build script performed its configured local static-file swap into `backend/target/classes/static`; no service process was restarted and no production deployment was invoked. Final build log: `output/hardening-frontend-final-build.log`.
- Changed-file ESLint and `git diff --check` — passed (Git reported existing line-ending conversion notices only).

## Limits

No live payment, real account deletion, production outage, or browser-driven flow was exercised. API transports were substituted in UI tests so failures, hangs, retries, and late completions could be reproduced deterministically. The cache remains opt-in for the existing activity/profile endpoint families; billing responses and custom request variants are not cached. Deadlines cover the selected critical reads, not every optional card or mutation. No automatic mutation retry was introduced. Pages and forms outside this scope may still need independent review.

The later [pagination follow-up](test-pagination-ui-followup.md) completed the coordinated Runs UI and server browse metadata. Calendar ordering, global filter choices, full-history counts, aggregate statistics and cache completion are preserved without automatically traversing every page. The initial page contains 60 rows; the runner explicitly requests each continuation. Browse metadata currently reads narrow scalar history rows for the full account; this limitation and final verification are recorded in the completion report.

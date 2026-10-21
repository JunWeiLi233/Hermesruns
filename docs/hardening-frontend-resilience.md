# Frontend resilience audit — 2026-10-21

Scope: the shared API/resource-cache path and Settings, especially the plan/payment card. This was a targeted audit; it does not certify every page or every network failure mode. Existing unrelated working-tree changes were preserved.

## Existing safeguards verified

- `frontend/src/api.ts` adds the current bearer credential and language. Wake retries are limited to safe GET/HEAD/OPTIONS methods and transient network/502/503/504 failures; mutation requests are not blindly retried. Session handling prevents a late 401 for a retired credential from signing out its replacement, and expired admin MFA returns the portal to authentication.
- The resource cache already shared concurrent activity/profile reads, cached only successful results for a bounded freshness interval (activities: 120 seconds; profile: 15 seconds), cloned results for each consumer, and prevented invalidated in-flight results from restoring stale data.
- Settings already had an initial loading skeleton, a recoverable top-level load error, a 12-second initial-load abort, and separate loading/empty/unavailable activity-graph copy. Export errors and concurrent-export responses, failed account deletion, failed Strava disconnect, OAuth retry feedback, and navigation cleanup have existing UI handling. The related settings/API tests were rerun.

## Fixes

- `frontend/src/api/resourceCache.ts`: cache identity now includes the account, credential, and effective language. Custom request options (including explicit authorization/language headers and `cache: 'no-store'`) bypass the default-response cache. Allowlisted resources match path boundaries, avoiding accidental caching of similarly named endpoints.
- Shared cached reads now give each subscriber its own cancellation. One page can abort without cancelling a surviving reader. Once every subscriber cancels, the transport is aborted and detached so a retry can start a new request. Already-aborted callers reject even on a cache hit.
- `frontend/src/components/SettingsPlanCard.jsx`: failed or empty/malformed quota/config responses show a localized error with Retry instead of claiming the runner is free and payments are closed. Pending requests announce loading without labelling an unknown account. The existing closed-payments state remains available for a valid `configured: false` response.
- Plan loading and checkout have 12-second deadlines. Checkout uses an immediate request guard, disables payment/month controls while pending, unlocks after failure, and ignores abandoned results after timeout, navigation, or unmount. A successful redirect keeps the control locked while navigation starts.
- English and Simplified Chinese share the new `settings.plan_load_error` key; Retry reuses existing localized copy. Settings integration fixtures now return valid quota/config payloads.

## Validation

Regression tests were written and run before production changes: the original code failed 17 relevant cases. An additional cancellation-recovery test reproduced a request that remained stuck after its only subscriber cancelled; that test then passed after transport detachment was added.

All commands ran from `frontend/`:

- `npm run test:unit -- src/api/resourceCache.vitest.ts src/components/SettingsPlanCard.vitest.jsx src/apiWakeRetry.vitest.ts src/apiAdminSession.vitest.ts src/apiHeatmapSession.vitest.ts src/api/recommendationRefresh.vitest.js src/pages/settings/__tests__/settingsReference.vitest.jsx src/pages/settings/__tests__/settingsStravaFeedback.vitest.jsx` — **8 files, 93 tests passed**. Includes 29 cache/payment tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed, no diagnostics.
- `npm run build` — passed; public home/terms/privacy prerender completed. The repository's build script also performed its configured local static-file swap into `backend/target/classes/static`; no service process was restarted and no production deployment was invoked.
- Changed-file ESLint and `git diff --check` — passed (Git reported existing line-ending conversion notices only).

## Limits

No live payment, real account deletion, production outage, or browser-driven flow was exercised. API transports were substituted in UI tests so failures, hangs, retries, and late completions could be reproduced deterministically. The cache remains opt-in for the existing activity/profile endpoint families; billing responses and custom request variants are not cached. A global timeout or automatic mutation retry was not introduced. Pages and forms outside this scope may still need independent loading/error/empty-state and duplicate-submit review.

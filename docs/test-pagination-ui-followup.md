# Runs pagination UI follow-up

## Implemented behavior

Runs requests one 60-row page from `GET /api/activities/page?sort=date&limit=60` on mount. The `sort` parameter selects the browse contract; the existing `beforeId` endpoint remains a separate compatibility contract. The client sends the localized unnamed-run label as `defaultName` so name search is consistent in English and Chinese.

The runner explicitly requests each subsequent page with **Load More Runs**. The control remains available with or without `IntersectionObserver`. An observer can reveal additional already-cached rows, but does not initiate network continuation. Network continuation is guarded synchronously against duplicate clicks; its button is disabled and localized while pending.

Search, Recent/Longest/Fastest ordering, and account day/year/month criteria are applied by the server across the full history. A criterion change aborts the old request, starts at the first page, and discards the old cursor. Year/month choices use global server facets; the month view also exposes year choices so older months remain accessible before their activities have been loaded. Recent uses month sections. Longest/Fastest uses one ordered section in both list/grid layouts, preserving global order when results alternate between months or span multiple pages. Rows with overlapping IDs are deduplicated.

Summary counts, distance, moving time, active days, longest/fastest records, and month-header aggregates use complete matching-history metadata. The weekly chart uses the server's 12 global Monday-based account-calendar buckets. The loaded row count is displayed separately as **Showing N of M runs**. Initial failure, continuation failure/retry, cursor invalidation/refresh, pending, empty-match, and terminal states are localized and accessible. A filtered empty match does not trigger empty-account onboarding.

The current list stays visible after continuation failure. Retry uses the same cursor. A history revision conflict (`409`) offers **Refresh run history**, which restarts the current criteria at the first page. A 12-second deadline also aborts a hanging request. Generation and abort checks prevent late results from an old criterion, account, deleted-list generation, or unmounted component from updating rows or cache. Profile/Strava metadata is scoped to account identity before effects run and cleared on an account change; optional metadata failure cannot reuse another account's timezone or linked state. Shared recommendation revisions are consumed once, so later criterion changes do not trigger a second refresh or invalidate an existing complete cache.

Deletion preserves the loaded list and saved scroll position, refreshes complete aggregates with one first-page request, and requires an explicit refresh before continuing a cursor created before the deletion. A failed metadata refresh also leaves a refresh action available. This recovery remains visible when deletion removes the last loaded row while older history still exists, instead of displaying an empty-account claim.

## Cache contract

The slim cache now uses `hermes_runs_v3_<canonical-email>`. Earlier v1/v2 snapshots are ignored, since an old v2 `complete: true` claim could have originated from the capped feed. Invalidation and successful new writes remove all three cache generations.

A new complete snapshot is written only after an unfiltered history reaches its terminal page and the distinct accumulated row count matches the server's global count. Filtered results and partial pages are never saved as complete history. An existing verified v3 snapshot is retained during ordinary partial revalidation. Mutation-triggered refreshes invalidate it. Cache writes also work when optional profile metadata arrives after the final page. The existing 24-hour TTL and 750,000-character size limit remain; an oversized history is displayed normally without storing a truncated snapshot.

## Verification evidence

- A first failing UI regression reproduced the missing paged loading behavior before implementation.
- Final source-state combined targeted run: **6 suites, 104 tests passed** (`runsPagination`, `runsHistoryStatus`, `runsCache`, `activityHistoryApi`, `coreReadResilience`, and `accountCalendar`). The pagination UI suite contains 25 tests and the API suite contains 12 tests.
- Independent review identified four additional edge cases. Their nine focused regressions first failed, then passed after fixing cross-month metric order (both metric sorts and both layouts), duplicate refreshes after a recommendation revision (sort/year/search), account metadata isolation, and recovery after deleting the final loaded row.
- The 601-run UI fixture verifies eleven explicit page requests, cursor advancement beyond 500 rows, no duplicated rows, accurate full-history totals, an end state, and caching only after the final page.
- English and Chinese pending/end behavior, overlapping boundaries, duplicate clicks, retrying the same cursor, server-side older-year/month/search/order results, empty filtered results, no automatic continuation with an observer, request timeout, ignored late responses, unmount, account changes, cache migration, and deletion are covered.
- All Runs source-contract smoke tests and the related Profile/Analysis wake-fanout and heatmap memory contract checks passed after updating stale assertions to the bounded history contract. Existing display, route-preview, mobile, focus, list/grid, and collapse checks remain active.
- Frontend typecheck and targeted ESLint passed. Repository-wide unit/contracts/build and browser verification are coordinated by the parent task; their final results should be read from that task's report.

## Limits

The browser retains rows that the runner explicitly loads, so memory and mounted rows grow with successive clicks. It does not automatically traverse the complete history. Server metadata reads a narrow scalar history index to calculate full-history criteria and aggregates; only the selected page and summary extrema need feed-object hydration. The new UI requires the browse endpoint and its metadata contract to be deployed together. No live service was restarted or deployed for this UI work.

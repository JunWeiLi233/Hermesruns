# Test and pagination completion — 2026-10-21

Three coordinated subagents repaired the outstanding backend/frontend tests, completed Runs pagination, and reviewed the result. Existing unrelated working-tree changes were preserved. No commit, push, service restart, production migration or deployment was performed.

## Changes

Runs loads 60 activities initially and exposes explicit **Load more**. Search, account-calendar filters and date/distance/pace ordering operate across the entire history. Counts, month totals, summary records and weekly bars use server metadata rather than the currently loaded subset. Older year/month choices remain reachable before their rows are loaded. Pending, retry, invalidated-history recovery, empty-match and terminal states are localized in English and Chinese.

The authenticated browse route uses `/api/activities/page?sort=date&limit=60`; the earlier `beforeId` route remains compatible. Continuation cursors bind the account, calendar, criteria and history revision. Changed history returns `409 HISTORY_CHANGED` with a refresh action. Both projection and page hydration are owner scoped, and page reads do not hydrate GPS collections.

Only terminal, unfiltered, count-verified history can become a complete v3 Runs cache. Previous versions are invalidated. Account replacement and abandoned requests cannot restore old results. Review regressions also cover global metric order across months/pages in list/grid, revision-triggered duplicate requests, stale account metadata and refresh recovery after deleting every loaded row. Profile quota recovery now evicts v2/v3 Runs siblings while retaining authentication and preferences.

The existing test failures came primarily from stale ThemeProvider fixtures, saved-workout DTOs, intentional disclosure/team/admin redesigns, calendar-volume policy and platform-specific storage paths. Assertions were aligned with the implemented contracts while retaining persistence, concurrency, numerical, accessibility and security checks. A genuine Node ESM extension omission in `scheduleCoachSummary.js` was fixed. Tooling checks now inspect actual prerendered public HTML and allow ignored, untracked scratch output without deleting it.

## Full verification

All logs are relative to the repository root.

| Check | Result | Evidence |
| --- | --- | --- |
| Backend Maven suite | **2,501 passed, 33 conditional skips**, 0 failures/errors; 305 suites, 2,534 reported tests | `output/completion-backend-full.log` |
| Frontend unit suite | **2,621 tests in 204 files passed**, 0 failures/skips or unhandled errors | `output/pagination-frontend-frozen-all-unit.log` |
| Frontend source contracts and prerender | **357 source-contract files + 5 prerender tests passed** | `output/pagination-frontend-frozen-contracts.log` |
| Tooling suite | **20 files passed**, 0 failures/skips | `output/pagination-tooling-final.log` |
| Python wellness tests | **13 passed** | `output/pagination-python-final.log` |
| Public performance / geo | **7 / 5 passed**, respectively | `output/pagination-public-performance-final.log`, `output/pagination-public-geo-final.log` |
| ESLint / TypeScript / production build | **Passed** | `output/pagination-frontend-final-lint.log`, `output/pagination-frontend-final-typecheck.log`, `output/pagination-frontend-final-build.log` |
| Architecture | **0 source-graph violations** | `output/pagination-architecture-final.log` |

Backend coverage includes the new 7 service tests and 3 database/MVC integration tests. The final targeted frontend pagination group passed all 104 cases. No tests were newly disabled to obtain these results. The existing 33 backend skips and commands are listed in the [backend follow-up](test-pagination-backend-followup.md).

## Browser verification

A disposable loopback-only Spring Boot/H2 fixture contained 606 synthetic runs across 2025–2026. The actual frontend was used through a browser, with no substituted activity transport:

- Initial load showed 60 of 606 rows with complete-history totals of 5,745 km and 478:45:00.
- Ten explicit continuations reached **606 of 606** on the frozen final source, displayed the terminal state and removed Load more.
- Searching for `Fixture run 606` found the oldest run with a matching count of one. The global year/month choices exposed February 2025 and its six matching runs.
- Longest ordering remained nonincreasing across 120 loaded rows spanning months, including the page boundary from 14 km to 13 km.

Evidence: [all 606 loaded](../output/pagination-browser/history-all-606.png), [oldest-run search](../output/pagination-browser/history-search-606.png). The temporary browser tab, H2 process and Vite server were closed after verification; existing app services and live data were untouched by the fixture.

## Limits and activation

Browse metadata currently scans a narrow scalar index for the account on each page to preserve complete filtering, ordering, revision checks and aggregates. Feed-object hydration is limited to the page plus at most two summary records. This bounds response payloads and expensive entity loading, but is not constant-cost metadata aggregation or a production-scale benchmark. Client rows grow only as the runner requests more pages.

Deploy the coordinated backend and frontend together. The earlier [hardening deployment requirements](production-hardening-2026-10-21.md#deployment-requirements), including SQL migrations, provider-side spending controls and uptime configuration, still apply. The approved application budget remains **$5/day and $50/month**; this follow-up made no external provider billing change.

The production build performed the repository's configured local static-file swap into `backend/target/classes/static`. No existing backend process was restarted.

Detailed workstream reports: [pagination UI](test-pagination-ui-followup.md), [frontend tests](test-pagination-frontend-followup.md), [admin contracts](test-pagination-admin-followup.md), [backend tests](test-pagination-backend-followup.md).

# Hermes hardening review — 2026-10-21

Three subagents audited billing/API controls, frontend resilience and database performance. The parent handled operations and integrated verification. Existing uncommitted changes were preserved. These are local source changes; production activation is separate.

| Requested check | Result |
| --- | --- |
| 1. API limits | Added aggregate IP/account buckets, bounded path families and tight checkout limits; retains explicit 429 / Retry-After responses. Defaults: 600 requests/IP/minute, 900/account/minute, 5 checkout requests/IP/account/minute. Redis-backed storage supports shared limits when configured; local fallback is per process. |
| 3. Spending caps | User-approved $5/day and $50/month safety budget, backed by atomic durable database reservations across processes. Defaults reserve $0.10 per external AI attempt; configurable request-count caps also apply. UTC calendar windows; uncertain/failed attempts retain reservations. These are estimates, not the provider's actual bill or account-level cap. |
| 4. Error handling | Explicit HTTP failures retain their status/headers; oversized uploads return 413; server errors are logged without exposing internal reasons. |
| 5. Loading states | Billing has explicit pending/error/retry behavior and deadlines; core-page request-state review and fixes are recorded in the frontend report. |
| 6. Empty states | Billing no longer presents failed/malformed requests as a free account or closed checkout. Core pages distinguish unavailable or malformed data from a valid empty list. |
| 7. Failed requests | Shared reads isolate cancellation; billing retries recover after failure, with a 12-second deadline and protection against abandoned redirects. Existing automatic retries remain limited to safe reads. |
| 8. Duplicate subscriptions | Hermes sells prepaid Pro time through one-time payments. Durable per-account checkout attempts prevent parallel/retried requests from opening duplicate active purchases. |
| 9. Duplicate payments | Stripe idempotency keys survive retries/restarts. Signed webhooks deduplicate both event and checkout IDs, with entitlement updates and receipts in one locked transaction. No live charge was made. |
| 10. DB queries | Avoided activity/shoe lazy-fetch amplification and cold catalog query-per-brand/model loops. Verified one history-page statement and three cold catalog statements. |
| 12. DB indexes | Added owner/type/ID composite index and explicit PostgreSQL concurrent-index SQL; verified index validity and an index-only plan on a disposable fixture. |
| 13. Large results | Added owner-scoped ID-cursor activity pagination, maximum 500 items plus one continuation row. Existing feed consumers remain compatible; the new endpoint still requires UI adoption to expose older pages. |
| 14. Compression | Verified existing HTTP gzip on the wire, including decompression/content checks; preserved existing compressed image and import formats. |
| 15. Repeat requests | Fixed shared cache identity to include account/session/language, handled custom request variants safely and isolated subscriber cancellation. Existing server caches retained; repeated catalog read executes zero DB queries. |
| 16. Error logging | Preserved existing server-side 5xx logging and added logging for explicit 5xx HTTP exceptions. External log retention/aggregation was not provisioned. |
| 17. Uptime monitoring | Added database readiness, changed the Railway health-check source path, and prepared a five-minute GitHub uptime workflow. The repository's HERMES_UPTIME_URL variable must be configured after deployment to activate the schedule. |
| 18. Simultaneous users | Real embedded HTTP checks cover 12 independent signed-in accounts making 24 concurrent activity reads, plus 24 concurrent readiness checks. Billing tests cover quota/payment races. This is functional concurrency testing, not production capacity certification. |
| 20. Backup restore | Restored an existing 38 MB local PostgreSQL backup and verified a second dump/restore round trip: 95 tables, 1,812,472 rows and sequence values matched. The disposable cluster was stopped; live data was untouched. |

## Verification details

- Final combined backend regression: **280 tests in 25 suites passed**, covering billing, quotas, rate limits, concurrency, lifecycle purge, readiness, gzip, admin paths, account isolation and the affected integration fixtures. Focused database checks separately passed on H2 and PostgreSQL 17, including the index plan check.
- Frontend focused suites passed (93 cache/billing/settings tests and a 115-test core-page group; these groups overlap). Full frontend lint, TypeScript check and the final production build passed. Four selected tooling files passed, including probe behavior and deployment/workflow guards.
- **The wider suites are not green.** The initial full backend run executed 2,510 tests and reported 42 failures, 2 errors and 33 skips. Subsequent fixes and the clean 280-test combined run resolved the admin dispatch bug and the throttle/persistence/lifecycle integration issues. Remaining observed failures are seven coaching boundary assertions, one training first-use expectation, and two Windows-versus-POSIX production-storage checks; these concern existing code outside this hardening work. The full backend suite was not rerun after the focused fixes.
- Full frontend run: **2,523 passed / 59 failed**, across 196 passing and 6 failing files, plus 55 unhandled errors. The latter match 55 Schedule cases lacking ThemeProvider fixtures. The other four failures concern existing evidence-panel expectations, a methods-document source-count assertion, team-management UI, and a pinned-workout receipt. The new and changed hardening suites passed in that full run. Details and evidence are in the frontend report.
- The restore drill passed across 95 tables / 1,812,472 rows and sequence values. Its restored databases were isolated from live storage. This is local archive validation, not a claim about cloud backup schedules or production recovery objectives.

The combined regression also exposed an existing admin request-path fallback bug: a legitimate servlet-path-empty dispatch appended its pathInfo twice and rejected admin requests. The targeted fix preserves encoded-path rejection and passed 23 focused security-filter tests before the affected admin/MVC suites passed in the combined run.

- [Billing/API changes and tests](hardening-billing-api.md)
- [Frontend states, caching and validation](hardening-frontend-resilience.md)
- [Database tests, query counts and PostgreSQL plan evidence](hardening-database-performance.md)
- [Readiness, monitoring, compression, concurrency and restore drill](hardening-operations.md)

## Deployment requirements

1. Apply `docs/deployment/2026-10-21-billing-budget.sql` before deploying the new billing code with production `ddl-auto=validate`.
2. Apply `backend/src/main/resources/db/performance/V001__activity_history_index.sql` using PostgreSQL autocommit, outside a transaction. Confirm the index is valid after a concurrent build.
3. Deploy the backend/frontend and Railway definition together, preserving the env-backed settings in `.env.example`. Configure shared Redis limits if multiple app instances are used.
4. Set the GitHub repository variable `HERMES_UPTIME_URL` to the deployed HTTPS `/internal/ready` URL and configure the desired Actions failure notifications or monitoring provider.
5. Set independent provider account caps/alerts and adjust the per-request reservation to a conservative upper cost for the chosen model/workload. The code budget covers the direct shoe scan and normalization provider boundaries; it does not control unrelated account usage or arbitrary subprocess/API costs.

No production migration, deployment, provider billing change, external uptime activation or cloud backup-policy change was performed. No commit or push was made.

# Database read performance hardening

Implemented and verified on 2026-10-21. Existing uncommitted work was preserved. No production data or schema was changed.

## Changes

- Added `GET /api/activities/page?limit=100&beforeId=<id>` in `ActivityHistoryController`. It returns `{items, nextBeforeId, hasMore}` using the existing feed item fields and descending activity IDs. `limit` is clamped to 1–500; the database reads at most 501 rows, including one continuation row. Invalid nonpositive cursors return 400; authentication, ownership and run-only filtering remain mandatory. ID keyset pagination avoids OFFSET scans and full-history COUNT queries, and newer inserts do not duplicate rows on subsequent pages.
- Added a fetch graph to the limited activity feed and cursor query in `ActivityRepository`. Different shoes and their owning runner are fetched with the page, avoiding per-shoe secondary queries. GPS point collections are not fetched. `ActivityDataAccess` exposes the owner-scoped cursor query.
- Added the `(runner_id, activity_type, id)` index to the `Activity` mapping. `backend/src/main/resources/db/performance/V001__activity_history_index.sql` contains the matching additive PostgreSQL migration.
- Replaced the cold shoe catalog's query-per-brand and query-per-model-image loops with a joined model/brand read and scalar live-image batches of at most 500 identities. Files: `ShoeCatalogController`, `ShoeCatalogModelRepository`, `ShoeImageAssetService`, `ShoeImageAssetRepository`. The image projection excludes pending images and asset metadata. Brand/model ordering, empty brands, optional image fields and localization fields are preserved.

The catalog previously needed approximately `1 + brand count + model count` queries on a cold cache. It now needs `2 + ceil(distinct model identities / 500)` for a nonempty catalog, independent of brand count. The existing 30-minute catalog TTL and mutation invalidations remain in use. A repeated catalog request executes zero repository queries.

## Existing protections verified

The normal activity feed already pushes its configured maximum (500 by default) into the database query. Analysis summaries already use scalar projections instead of hydrating activities and their points. Heatmap, analytics, telemetry, HR samples, personal records and the shoe catalog already have TTL caching. These were existing protections, not newly introduced caching features.

## Validation

- 64 focused unit tests passed, covering the existing activity controller/data access and catalog/image behavior, cursor bounds/authentication/continuation, image batching and warm-cache query avoidance.
- All 13 `AnalysisActivitySummaryTimeTests` integration tests passed against both H2 2.4 in PostgreSQL compatibility mode and a separate disposable PostgreSQL 17 cluster. The PostgreSQL cluster listened only on loopback on an ephemeral port and was stopped after testing.
- Hibernate statistics assert one SQL statement for a cursor page containing distinct shoes, zero GPS collection fetches, three statements for a cold catalog with live images, and zero statements for its repeated read. Existing analysis scalar query and time/provenance contracts continue to pass.
- PostgreSQL migration applied twice successfully to a disposable 10,000-row fixture; the index was valid and ready. `EXPLAIN (ANALYZE, BUFFERS)` used `Index Only Scan Backward using idx_activity_runner_type_id` for an owner/type/ID cursor query. This synthetic plan check is not a production latency benchmark.
- `git diff --check` passed for the affected activity/shoe sources and tests.

Focused verification command, run from `backend`:

```powershell
.\mvnw.cmd -q '-Dhermes.build.directory=target-hardening-db' '-Dtest=ActivityHistoryControllerTests,ShoeCatalogPerformanceTests,ShoeCatalogControllerTests,ShoeImageAssetServiceTests,ActivityControllerTests,ActivityDataAccessTests,AnalysisActivitySummaryTimeTests' test
```

The integration suite also accepts `hermes.performance.datasource.url`, `hermes.performance.datasource.driver`, and `hermes.performance.datasource.username` system properties for an explicitly provisioned disposable PostgreSQL database. It uses `create-drop`; never point it at a database containing wanted data. Validation logs are under `backend/target-hardening-db/`.

## Deployment and limits

- Production defaults to `ddl-auto=validate`; Hibernate annotations do not install the index there. Apply the SQL migration separately with `psql` autocommit enabled, outside a transaction, because it uses `CREATE INDEX CONCURRENTLY`. Inspect `pg_index.indisvalid` after deployment; the script documents recovery after an interrupted build. No production migration was run during this work.
- The cursor endpoint is additive. Existing `/api/activities` array responses and `/api/activities/analysis` contracts remain compatible. A frontend consumer must adopt the page API to expose older history progressively.
- Legacy analysis/export/aggregate paths and the complete public catalog still return the history/catalog required by their existing consumers. This change does not silently truncate those contracts. Full-history analysis and raw heatmap cold reads can still be expensive for very large accounts.
- Page results reflect current data, rather than a frozen snapshot: deletion or edits between requests can change later results. TTL cache freshness and invalidation behavior otherwise remain as before. No production-scale load test or production query-plan measurement was performed.

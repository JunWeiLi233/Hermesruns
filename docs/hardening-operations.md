# Operational checks — 2026-10-21

Changes are local source changes. No production process, account billing setting, production schema, or live database was changed.

## Readiness and monitoring

`GET /internal/health` remains a cheap process liveness check. New `GET /internal/ready` obtains a database connection, validates it with a two-second JDBC validation timeout, closes it, and returns only `{"status":"UP"}` (200) or `{"status":"DOWN"}` (503). Responses are not cached and never expose connection strings or credentials. Database acquisition is bounded by the configurable `APP_DB_CONNECTION_TIMEOUT_MS` (5,000 ms default). GET/HEAD readiness probes pass through HTTPS enforcement to the actual controller; they do not receive a fabricated success.

The Railway source definition now uses `/internal/ready` as its deployment health check. It takes effect when that definition and the new backend are deployed together.

`.github/workflows/uptime.yml` prepares a five-minute external probe, activated by the GitHub repository variable `HERMES_UPTIME_URL` pointing at the deployed HTTPS `/internal/ready` endpoint. Without this variable, the job is skipped. No remote variable or alert destination was configured in this session. Scheduled GitHub Actions can be delayed; use a dedicated monitoring provider if the service needs a monitoring SLA. Failure notifications depend on the repository/account's Actions notification settings.

Run the same read-only probe manually:

```powershell
node tools/service-probe.mjs --url https://YOUR_HOST/internal/ready
node tools/service-probe.mjs --url http://127.0.0.1:8080/api/activities?limit=10 --users 12 --requests-per-user 5
```

For authenticated reads, set `HERMES_PROBE_TOKEN` in the environment. The tool never accepts credentials in the URL or prints tokens/response bodies. Each request has a deadline, redirects fail instead of masking a login redirect, readiness requires a valid UP response, and results include successes/failures and p50/p95/max latency. It is read-only and bounded to 500 workers/10,000 total requests. Run capacity tests on an isolated deployment with an explicit workload; arbitrary production load was not generated.

## Error handling and logging

Existing SLF4J server-side logging records unhandled 5xx exceptions with method, URI and client IP, while clients receive a generic server error. Explicit `ResponseStatusException` responses now retain their intended HTTP status and headers instead of becoming 500. 5xx reasons remain hidden from clients and are logged server-side. Oversized multipart uploads now return 413. Existing malformed-body, missing-parameter, type mismatch, unsupported-method and missing-resource mappings remain in place.

No external logging service or retention policy was configured. Runtime stdout collection remains the hosting platform's responsibility.

## Compression

HTTP gzip was already enabled for HTML, JSON, CSS, JavaScript and SVG responses of at least 1,024 bytes. Embedded-server HTTP validation exercises a larger test-only static asset, confirms `Content-Encoding: gzip`, decompresses the received bytes and checks the content. Existing image/asset formats and gzip activity import handling were retained; no user uploads were recompressed or replaced.

## Concurrent users

`OperationalHttpTests` boots the real application on a random loopback port with its own in-memory H2 database. It prepares 12 independent signed-in accounts, then issues 24 concurrent activity reads, checking that each account receives only its own activity. A separate check issues 24 concurrent database-readiness requests. This verifies bounded concurrent operation and account isolation for these paths; it is not a production throughput or capacity certification. Billing workstream concurrency tests separately cover monetary/quota races.

## Backup restoration

`tools/test-backup-restore.ps1 -BackupFile <archive.dump>` accepts a PostgreSQL archive and always initializes a new private loopback cluster on an ephemeral port. There is no destination connection argument, so it cannot restore over the live database. It validates the archive, restores with `--exit-on-error --no-owner --no-privileges`, computes fingerprints over all user-table contents and sequences, creates a second compressed archive, restores that into a second new database, and compares the fingerprints. It also requires the Hermes `public.runner` and `public.activities` tables and stops its own cluster in `finally`, including after partial startup failures. Private archives and logs stay under `.private-backups/`.

The completed drill used an existing 38,235,299-byte local backup. Both restores succeeded and matched across **95 tables / 1,812,472 rows**, plus sequence values, in **61.88 seconds**. Source archive SHA-256: `9B8550AF31973D02D88470B21D8A52AE641469F93254C13B4312EAA77C20C016`. No live database was touched. This proves that particular local archive is restorable and survives a content-preserving round trip; it does not verify a cloud backup schedule, retention, point-in-time recovery or a cloud recovery-time objective.

## References

- [PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) documents custom archives and their default compression.
- [PostgreSQL 17 pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) documents restore error handling and ownership options.

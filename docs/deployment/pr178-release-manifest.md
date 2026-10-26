# PR178 production release gates

This is the authoritative release checklist for the reconciled branch. A passing
build does not replace these checks. Do not merge into an automatically deployed
branch or replace the running container before the backup and storage gates pass.

## Capture and rehearse

1. Record the exact candidate commit, current Railway deployment/image, service
   source branch and auto-deploy settings. Wait for Railway's active incident to
   be resolved and authenticated instance/volume access to work.
2. Take a consistent PostgreSQL backup using a client at least as new as the
   server (current production is PostgreSQL 18). Restore into an isolated database;
   never run development fixtures against production. Record backup checksums and
   prove the restore boots the previous application before altering the clone.
3. Export and hash the running service's course image/source and `routes/` files
   before replacing it. Record every live route column, artifact reference, file
   checksum and missing reference. A newly attached volume cannot recover files
   lost with the previous container. Suspend administrative publishing while
   capturing and verifying this snapshot.
4. Inspect `tw_job` for queued/running/retry imports and the corresponding files in
   `app.training-workspace.private-directory` / `APP_TRAININGWORKSPACE_PRIVATEDIRECTORY`
   (default `./.training-private`). Drain or
   preserve these files and their configured location before replacement.

## Schema manifest

Inventory the actual schema first. Apply only absent/reviewed changes against the
restored clone, then production after the rehearsal succeeds. Keep production
`ddl-auto=validate`, workspace migration disabled and compatibility DDL disabled.
Use `psql -v ON_ERROR_STOP=1` for every release script (training, analysis,
community, billing, compatibility and indexes); a SQL error must fail the release
process. Community, billing and compatibility scripts contain their own transactions.

| Order | Source | Release handling |
| --- | --- | --- |
| 1 | `backend/src/main/resources/db/training/V001__workspace.sql` through `V005__generated_plan_guards.sql` | Use the same ordered resources and exact UTF-8 checksums as `TrainingStore.migrate()` / `validateMigrations()`. Do not invent marker values or overwrite an existing checksum mismatch. Preserve applied versions; add each successful version and its checksum to `tw_migration` in its transaction. |
| 2 | `backend/src/main/resources/db/analysis/V001__run_records.sql`, `V002__goals.sql` | Check current tables, columns and indexes before applying in order. |
| 3 | `backend/src/main/resources/db/community/V001__entertainment_and_story.sql` | Ten additive entity tables, owner FKs, unique constraints and indexes. Contains its own release transaction. `IF NOT EXISTS` does not repair an incompatible existing table. |
| 4 | `docs/deployment/2026-10-21-billing-budget.sql` | Add billing checkout attempts and AI budget windows; preserve balances and receipts. |
| 5 | `docs/deployment/2026-10-21-compatibility.sql` | Runs compatibility V001 then V002: three course artifact columns and canonical eight-provider checks on five wellness/body tables. Each resource has its own transaction and a short lock timeout; failure must stop release. Unexpected names or provider values abort V002. No rows or route bytes are updated. |
| 6 | `backend/src/main/resources/db/performance/V001__activity_history_index.sql` | Run with autocommit **outside** a transaction, then verify `pg_index.indisvalid`. |
| Conditional | `backend/src/main/resources/explorer-migrations/V001__explorer_r0_r1.sql` | Only if intentionally enabling Explorer; confirm the intended profile before execution. |

`docs/deployment/versioned-run-plans.sql` is retired and aborts if executed. Its
historical CHECK constraints reject current `EXTERNAL`, `BASE`, `AUTHORED` and
`CUSTOM` values. If a database already contains those legacy constraints, stop and
review their exact definitions before a compatibility migration; marking V003
applied does not repair them. Do not edit previously applied migration resources.

Migration markers must match the **bundled artifact bytes**, including line
endings. Windows working copies can contain CRLF while the Linux deployment uses
Git's LF resources. Compute/check markers from the canonical release export or
the actual candidate JAR; do not copy a working-directory checksum into production.

Boot the immutable candidate against the migrated restore with the production
profile and validation enabled. Validate every entity, all five training markers,
analysis queries, authored calendars, billing tables and valid history index.
Rehearse application rollback against the same additive schema.

## Persistent storage and rollout

Attach a persistent web volume, restore all referenced course bytes and verify
ownership for the Docker `hermes` user. Configure `HERMES_COURSE_MAP_UPLOAD_DIR`
inside `RAILWAY_VOLUME_MOUNT_PATH`; the production guard rejects missing mounts.
The runtime image pins that identity to UID 100 / GID 101, matching the original
deployment. Verify it in the exact candidate image before changing volume ownership.
Persist the private import directory too when retained jobs depend on it. Verify
source downloads and route rendering before changing traffic. Source images are
retained as evidence; runner routes render as geometry on OpenStreetMap.

Set Railway's health path to `/internal/ready` (the observed service still used
`/`). Keep official startup seeding and both one-shot bulk seed/scan commands off;
production rejects enabling any of them before startup writers are constructed.
Validate Cloudflare Access on the admin hostname,
the exact owner allowlist, passkey/MFA, admin redirects and logout. Account for
Railway's October 21 security disclosure: review affected secrets and arrange
rotation without blindly replacing the data encryption key or invalidating stored
provider tokens. Reconnect the GitHub source only through the authenticated flow.

Only release the exact reviewed commit after all gates pass. Probe readiness,
public pages, protected admin routes, source downloads and representative maps;
compare every verified live-route column and artifact checksum with the snapshot.
Do not run bulk seeding, publish previews or rewrite live courses as a smoke test.
Keep backup identifiers and rollback instructions outside the repository.

## Observed gate state (2026-10-21)

Production inventory showed `ddl-auto=validate`, startup seeding and workspace
migration disabled, no persistent web volume, health path `/`, and no pre-deploy
command. The service auto-deploys `master` and its Wait for CI switch is off.
Railway reported builds/deployments paused; the console had no accessible
instance and SFTP timed out. No production schema change, volume change, merge or
deployment was performed. Live schema, file export and restore rehearsal remain
required before rollout.

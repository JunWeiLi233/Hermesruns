-- Explicit PostgreSQL migration: production uses ddl-auto=validate and does not run this automatically.
-- Run with psql autocommit enabled, outside a transaction, to permit CONCURRENTLY.
-- This is non-unique and additive: existing activity data is unchanged.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_runner_type_id
    ON activities (runner_id, activity_type, id);
-- If an interrupted concurrent build leaves this index INVALID, drop that invalid index
-- with DROP INDEX CONCURRENTLY and rerun. Check pg_index.indisvalid before rollout.

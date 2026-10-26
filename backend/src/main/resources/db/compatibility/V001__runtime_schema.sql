-- Explicit PostgreSQL release step; application startup no longer executes these DDL hooks.
-- Back up and rehearse against an isolated restore before applying.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE race_course_map_asset ADD COLUMN IF NOT EXISTS local_route_artifact_ref text;
ALTER TABLE race_course_map_asset ADD COLUMN IF NOT EXISTS local_route_updated_at timestamp;
ALTER TABLE race_course_map_asset ADD COLUMN IF NOT EXISTS local_route_updated_by_email varchar(255);

-- Preserve each legacy provider predicate and every other constraint. Accept only
-- the additional MANUAL provider, matching WellnessProviderSchemaInitializer.
DO $$
DECLARE legacy record;
BEGIN
    FOR legacy IN
        SELECT n.nspname, t.relname, c.conname, pg_get_expr(c.conbin, c.conrelid) AS predicate
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'provider'
        WHERE n.nspname = current_schema() AND c.contype = 'c'
          AND t.relname IN ('daily_sleep_data', 'daily_hrv_data', 'daily_wellness_summary', 'daily_stress_data')
          AND c.conkey = ARRAY[a.attnum]
    LOOP
        IF position('''MANUAL''' in legacy.predicate) = 0
           AND position('''GARMIN''' in legacy.predicate) > 0
           AND position('''STRAVA''' in legacy.predicate) > 0 THEN
            EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I CHECK ((%s) OR provider = ''MANUAL'')',
                legacy.nspname, legacy.relname, legacy.conname, legacy.conname, legacy.predicate);
        END IF;
    END LOOP;
END $$;
COMMIT;

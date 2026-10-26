-- Match ImportProvider without changing rows, nullability or unrelated checks.
-- Explicit PostgreSQL release step; apply after V001 and rehearse first.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';
DO $$
DECLARE
    target text;
    schema_name text := current_schema();
    provider_check text;
    invalid_values boolean;
    provider_check_count integer;
    expected_check_count integer;
    allowed text := '''STRAVA'',''GARMIN'',''OURA'',''COROS'',''HUAWEI'',''APPLE_HEALTH'',''GOOGLE_HEALTH'',''MANUAL''';
    targets text[] := ARRAY['body_composition_data','daily_sleep_data','daily_hrv_data',
                            'daily_wellness_summary','daily_stress_data'];
BEGIN
    -- Inspect the complete set before altering any constraint. An unexpected
    -- schema or value stops the release instead of silently dropping evidence.
    FOREACH target IN ARRAY targets LOOP
        provider_check := target || '_provider_check';
        SELECT count(*), count(*) FILTER (WHERE c.conname = provider_check)
            INTO provider_check_count, expected_check_count
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'provider'
            WHERE n.nspname = schema_name AND t.relname = target
              AND c.contype = 'c' AND c.conkey = ARRAY[a.attnum];
        IF provider_check_count <> 1 OR expected_check_count <> 1 THEN
            RAISE EXCEPTION 'Missing or unexpected provider constraint %.%', target, provider_check;
        END IF;
        EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE provider IS NULL OR provider NOT IN (%s))',
                       schema_name, target, allowed) INTO invalid_values;
        IF invalid_values THEN
            RAISE EXCEPTION 'Unexpected provider values in %.%; no rows were changed', schema_name, target;
        END IF;
    END LOOP;
    FOREACH target IN ARRAY targets LOOP
        provider_check := target || '_provider_check';
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I CHECK (provider IN (%s)) NOT VALID',
                       schema_name, target, provider_check, provider_check, allowed);
        EXECUTE format('ALTER TABLE %I.%I VALIDATE CONSTRAINT %I', schema_name, target, provider_check);
    END LOOP;
END $$;
COMMIT;

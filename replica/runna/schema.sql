-- Proposed additive schema for the Runna-inspired Hermes mobile experience.
-- PostgreSQL 17+; this is a design artifact, NOT an applied production migration.
-- Existing prerequisites: runner(id bigint), activities(id bigint, runner_id bigint).
-- New rows use UUIDs; references to Hermes identity/activity keep their existing bigint types.
-- No existing activity/session/planner columns are rewritten by this script.
-- H2: map JSON with the supported Hibernate JSON type and translate PostgreSQL-specific
-- partial indexes / column-targeted SET NULL / triggers into explicit migration equivalents.
-- Validate on both databases before implementation delivery; ddl-auto is not a migration plan.
-- Timestamps are instants (timestamptz); calendar dates deliberately remain date.
BEGIN;

CREATE UNIQUE INDEX runplan_activity_owner_key ON activities (id, runner_id);

CREATE TABLE runner_plan_profile (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    ability varchar(16) NOT NULL CHECK (ability IN ('BEGINNER','INTERMEDIATE','ADVANCED')),
    weekly_distance_m integer NOT NULL CHECK (weekly_distance_m >= 0),
    longest_run_m integer NOT NULL CHECK (longest_run_m >= 0),
    result_distance_m integer CHECK (result_distance_m > 0),
    result_seconds integer CHECK (result_seconds > 0),
    result_date date,
    units varchar(8) NOT NULL CHECK (units IN ('KM','MI')),
    time_zone varchar(64) NOT NULL,
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (runner_id),
    CHECK ((result_distance_m IS NULL AND result_seconds IS NULL AND result_date IS NULL)
        OR (result_distance_m IS NOT NULL AND result_seconds IS NOT NULL AND result_date IS NOT NULL))
);

CREATE TABLE training_plan (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    title varchar(120) NOT NULL,
    goal_kind varchar(16) NOT NULL CHECK (goal_kind IN ('DISTANCE','RACE')),
    target_distance_m integer NOT NULL CHECK (target_distance_m IN (5000,10000)),
    state varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','ACTIVE','ARCHIVED')),
    input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, runner_id)
);
CREATE UNIQUE INDEX runplan_one_active_plan ON training_plan(runner_id) WHERE state = 'ACTIVE';
CREATE INDEX runplan_plan_list ON training_plan(runner_id, state, created_at DESC, id);

CREATE TABLE training_plan_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL,
    ordinal integer NOT NULL CHECK (ordinal > 0),
    base_revision bigint NOT NULL CHECK (base_revision >= 0),
    state varchar(16) NOT NULL DEFAULT 'READY' CHECK (state IN ('READY','ACTIVE','HISTORICAL')),
    generator_version varchar(80) NOT NULL,
    mode varchar(16) NOT NULL CHECK (mode IN ('DEMO','REVIEWED')),
    input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
    workout_snapshot jsonb NOT NULL CHECK (jsonb_typeof(workout_snapshot) = 'array'),
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(warnings) = 'array'),
    start_date date NOT NULL,
    end_date date NOT NULL,
    time_zone varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (plan_id, runner_id) REFERENCES training_plan(id, runner_id) ON DELETE CASCADE,
    UNIQUE (plan_id, ordinal),
    UNIQUE (id, plan_id, runner_id),
    CHECK (end_date >= start_date AND end_date - start_date < 182)
);
CREATE UNIQUE INDEX runplan_one_active_version ON training_plan_version(plan_id) WHERE state = 'ACTIVE';
CREATE INDEX runplan_versions_owner ON training_plan_version(runner_id, plan_id, created_at DESC, id);

CREATE TABLE training_workout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL,
    version_id uuid NOT NULL,
    local_date date NOT NULL,
    workout_type varchar(16) NOT NULL CHECK (workout_type IN ('EASY','LONG','INTERVAL','TEMPO','REST')),
    state varchar(16) NOT NULL DEFAULT 'PLANNED'
        CHECK (state IN ('PLANNED','PARTIAL','COMPLETED','SKIPPED','RETIRED')),
    target_distance_m integer CHECK (target_distance_m > 0),
    target_duration_s integer CHECK (target_duration_s > 0),
    explanation text NOT NULL,
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (plan_id, runner_id) REFERENCES training_plan(id, runner_id) ON DELETE CASCADE,
    FOREIGN KEY (version_id, plan_id, runner_id)
        REFERENCES training_plan_version(id, plan_id, runner_id) ON DELETE CASCADE,
    UNIQUE (id, runner_id),
    CHECK (workout_type <> 'REST' OR (target_distance_m IS NULL AND target_duration_s IS NULL))
);
CREATE INDEX runplan_calendar ON training_workout(runner_id, plan_id, local_date, id);
CREATE INDEX runplan_workout_version ON training_workout(version_id, plan_id, runner_id);
CREATE UNIQUE INDEX runplan_daily_workout ON training_workout(plan_id, local_date) WHERE state <> 'RETIRED';

CREATE TABLE training_workout_step (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    workout_id uuid NOT NULL,
    sequence integer NOT NULL CHECK (sequence >= 0),
    step_type varchar(16) NOT NULL CHECK (step_type IN ('WARMUP','RUN','WALK','RECOVERY','COOLDOWN')),
    distance_m integer CHECK (distance_m > 0),
    duration_s integer CHECK (duration_s > 0),
    repetitions integer NOT NULL DEFAULT 1 CHECK (repetitions BETWEEN 1 AND 100),
    pace_min_s_per_km integer CHECK (pace_min_s_per_km > 0),
    pace_max_s_per_km integer CHECK (pace_max_s_per_km > 0),
    effort_text varchar(280),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workout_id, runner_id) REFERENCES training_workout(id, runner_id) ON DELETE CASCADE,
    UNIQUE (workout_id, sequence),
    CHECK ((distance_m IS NOT NULL)::integer + (duration_s IS NOT NULL)::integer = 1),
    CHECK ((pace_min_s_per_km IS NULL AND pace_max_s_per_km IS NULL AND effort_text IS NOT NULL)
        OR (pace_min_s_per_km IS NOT NULL AND pace_max_s_per_km IS NOT NULL
            AND pace_min_s_per_km <= pace_max_s_per_km))
);
CREATE INDEX runplan_step_owner ON training_workout_step(runner_id, workout_id);

CREATE TABLE training_activity_receipt (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    activity_id bigint,
    client_key uuid NOT NULL,
    request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    source varchar(16) NOT NULL CHECK (source IN ('MANUAL','PHONE')),
    state varchar(16) NOT NULL DEFAULT 'SAVED' CHECK (state IN ('SAVED','DELETED')),
    started_at timestamptz NOT NULL,
    local_date date NOT NULL,
    time_zone varchar(64) NOT NULL,
    elapsed_s integer NOT NULL CHECK (elapsed_s > 0),
    distance_m integer NOT NULL CHECK (distance_m > 0),
    notes varchar(2000),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (activity_id, runner_id) REFERENCES activities(id, runner_id)
        ON DELETE SET NULL (activity_id),
    UNIQUE (runner_id, client_key),
    UNIQUE (activity_id),
    UNIQUE (id, runner_id)
);
CREATE INDEX runplan_activity_receipt_list ON training_activity_receipt(runner_id, local_date DESC, id);

CREATE TABLE training_activity_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    workout_id uuid NOT NULL,
    activity_id bigint NOT NULL,
    decision varchar(16) NOT NULL CHECK (decision IN ('PARTIAL','COMPLETE')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workout_id, runner_id) REFERENCES training_workout(id, runner_id) ON DELETE CASCADE,
    FOREIGN KEY (activity_id, runner_id) REFERENCES activities(id, runner_id) ON DELETE CASCADE,
    UNIQUE (activity_id),
    UNIQUE (workout_id)
);
CREATE INDEX runplan_link_owner ON training_activity_link(runner_id, workout_id);

CREATE TABLE training_command_receipt (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    operation varchar(40) NOT NULL CHECK (operation IN ('CREATE_PLAN','GENERATE','ACTIVATE','ARCHIVE',
        'LINK','UNLINK','SET_STATUS','MOVE_WORKOUT','FINISH_RECORDING','CREATE_RECORDING')),
    client_key uuid NOT NULL,
    request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (runner_id, operation, client_key),
    CHECK (expires_at > created_at)
);
CREATE INDEX runplan_command_expiry ON training_command_receipt(expires_at);

-- Second-stage server metadata only: GPS checkpoint samples live on the phone.
CREATE TABLE training_recording_session (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    workout_id uuid,
    client_key uuid NOT NULL,
    state varchar(16) NOT NULL CHECK (state IN ('STARTED','FINISHED','DISCARDED')),
    started_at timestamptz NOT NULL,
    activity_receipt_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workout_id, runner_id) REFERENCES training_workout(id, runner_id)
        ON DELETE SET NULL (workout_id),
    FOREIGN KEY (activity_receipt_id, runner_id) REFERENCES training_activity_receipt(id, runner_id)
        ON DELETE SET NULL (activity_receipt_id),
    UNIQUE (runner_id, client_key)
);
CREATE INDEX runplan_recording_owner ON training_recording_session(runner_id, state, created_at);
CREATE INDEX runplan_recording_workout ON training_recording_session(workout_id, runner_id);
CREATE INDEX runplan_recording_receipt ON training_recording_session(activity_receipt_id, runner_id);

CREATE FUNCTION runplan_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
CREATE TRIGGER runplan_profile_touch BEFORE UPDATE ON runner_plan_profile
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_plan_touch BEFORE UPDATE ON training_plan
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_version_touch BEFORE UPDATE ON training_plan_version
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_workout_touch BEFORE UPDATE ON training_workout
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_step_touch BEFORE UPDATE ON training_workout_step
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_receipt_touch BEFORE UPDATE ON training_activity_receipt
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_link_touch BEFORE UPDATE ON training_activity_link
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_command_touch BEFORE UPDATE ON training_command_receipt
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_recording_touch BEFORE UPDATE ON training_recording_session
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();

COMMIT;

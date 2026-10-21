-- Hermes website versioned training plans; seven new tables.
-- PostgreSQL 17+. Apply once after backup, before deploying with ddl-auto=validate.
-- Requires manual_run_receipt from manual-run-receipts.sql. Do not enable activation until coaching review.
-- Prerequisites: runner(id bigint), activities(id bigint, runner_id bigint).
-- Reuse delivered manual_run_receipt; no second manual receipt or activity table.
-- Earlier nine-table mobile proposal was unapplied; this is not its upgrade script.
-- H2 needs equivalent JSON mappings, partial uniqueness, and immutable-payload enforcement.
-- Calendar dates are date; creation/update/generation timestamps are UTC instants.
BEGIN;

CREATE UNIQUE INDEX runplan_activity_owner_key ON activities(id, runner_id);

CREATE TABLE runner_plan_profile (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    ability varchar(16) NOT NULL CHECK (ability IN ('BEGINNER','INTERMEDIATE','ADVANCED')),
    weekly_distance_m integer NOT NULL CHECK (weekly_distance_m BETWEEN 0 AND 200000),
    baseline_runs_per_week integer NOT NULL CHECK (baseline_runs_per_week BETWEEN 0 AND 7),
    longest_run_m integer NOT NULL CHECK (longest_run_m BETWEEN 0 AND 100000),
    can_walk_20_minutes boolean NOT NULL,
    result_distance_m integer CHECK (result_distance_m IN (5000,10000)),
    result_seconds integer CHECK (result_seconds BETWEEN 1 AND 86400),
    result_date date,
    units varchar(8) NOT NULL CHECK (units IN ('KM','MI')),
    time_zone varchar(64) NOT NULL CHECK (length(time_zone)>0),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (runner_id),
    CHECK (longest_run_m<=weekly_distance_m),
    CHECK ((weekly_distance_m=0 AND longest_run_m=0)
        OR (weekly_distance_m>0 AND longest_run_m>0)),
    CHECK ((result_distance_m IS NULL AND result_seconds IS NULL AND result_date IS NULL)
        OR (result_distance_m IS NOT NULL AND result_seconds IS NOT NULL AND result_date IS NOT NULL))
);

CREATE TABLE training_plan (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    title varchar(120) NOT NULL CHECK (length(title)>0),
    goal_kind varchar(16) NOT NULL CHECK (goal_kind IN ('DISTANCE','RACE')),
    target_distance_m integer NOT NULL CHECK (target_distance_m IN (5000,10000)),
    state varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','ACTIVE','ARCHIVED')),
    input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot)='object'),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id,runner_id)
);
CREATE UNIQUE INDEX runplan_one_active_plan ON training_plan(runner_id) WHERE state='ACTIVE';
CREATE INDEX runplan_plan_list ON training_plan(runner_id,state,created_at DESC,id);

CREATE TABLE training_plan_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL,
    ordinal integer NOT NULL CHECK (ordinal>0),
    base_revision bigint NOT NULL CHECK (base_revision>=0),
    state varchar(16) NOT NULL DEFAULT 'READY' CHECK (state IN ('READY','ACTIVE','HISTORICAL')),
    generator_version varchar(80) NOT NULL,
    mode varchar(16) NOT NULL CHECK (mode IN ('DEMO','ORIGINAL')),
    schema_version integer NOT NULL CHECK (schema_version=1),
    input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot)='object'),
    workout_snapshot jsonb NOT NULL CHECK (jsonb_typeof(workout_snapshot)='array'),
    input_hash char(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
    content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    retained_hash char(64) NOT NULL CHECK (retained_hash ~ '^[0-9a-f]{64}$'),
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(warnings)='array'),
    generation_local_date date NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    time_zone varchar(64) NOT NULL CHECK (length(time_zone)>0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (plan_id,runner_id) REFERENCES training_plan(id,runner_id) ON DELETE CASCADE,
    UNIQUE (plan_id,ordinal),
    UNIQUE (id,plan_id,runner_id),
    CHECK (end_date>=start_date AND end_date-start_date<182),
    CHECK (mode<>'DEMO' OR state<>'ACTIVE')
);
CREATE UNIQUE INDEX runplan_one_active_version ON training_plan_version(plan_id) WHERE state='ACTIVE';
CREATE INDEX runplan_versions_owner ON training_plan_version(runner_id,plan_id,created_at DESC,id);
CREATE INDEX runplan_versions_plan ON training_plan_version(plan_id,runner_id);

CREATE TABLE training_workout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL,
    version_id uuid NOT NULL,
    local_date date NOT NULL,
    workout_type varchar(16) NOT NULL
        CHECK (workout_type IN ('EASY','LONG','INTERVAL','STEADY','RUN_WALK','EVENT','REST')),
    phase varchar(16) NOT NULL CHECK (phase IN ('ADAPT','BUILD','RECOVERY','TAPER','GOAL')),
    state varchar(16) NOT NULL DEFAULT 'PLANNED'
        CHECK (state IN ('PLANNED','PARTIAL','COMPLETED','SKIPPED','RETIRED')),
    completion_source varchar(16) NOT NULL DEFAULT 'NONE'
        CHECK (completion_source IN ('NONE','ACTIVITY','UNLOGGED')),
    target_distance_m integer CHECK (target_distance_m>0),
    target_duration_s integer CHECK (target_duration_s>0),
    explanation jsonb NOT NULL CHECK (jsonb_typeof(explanation)='object'),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (plan_id,runner_id) REFERENCES training_plan(id,runner_id) ON DELETE CASCADE,
    FOREIGN KEY (version_id,plan_id,runner_id)
        REFERENCES training_plan_version(id,plan_id,runner_id) ON DELETE CASCADE,
    UNIQUE (id,runner_id),
    CHECK ((workout_type='REST' AND target_distance_m IS NULL AND target_duration_s IS NULL)
        OR (workout_type<>'REST' AND
            ((target_distance_m IS NOT NULL AND target_duration_s IS NULL)
                OR (target_distance_m IS NULL AND target_duration_s IS NOT NULL)))),
    CHECK ((state='PARTIAL' AND completion_source='ACTIVITY')
        OR (state='COMPLETED' AND completion_source IN ('ACTIVITY','UNLOGGED'))
        OR (state IN ('PLANNED','SKIPPED','RETIRED') AND completion_source='NONE')),
    CHECK (workout_type<>'REST' OR state IN ('PLANNED','RETIRED'))
);
CREATE INDEX runplan_calendar ON training_workout(runner_id,plan_id,local_date,id);
CREATE INDEX runplan_workout_plan ON training_workout(plan_id,runner_id);
CREATE INDEX runplan_workout_version ON training_workout(version_id,plan_id,runner_id);
CREATE UNIQUE INDEX runplan_daily_workout ON training_workout(plan_id,local_date) WHERE state<>'RETIRED';

CREATE TABLE training_workout_step (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    workout_id uuid NOT NULL,
    sequence integer NOT NULL CHECK (sequence BETWEEN 0 AND 31),
    step_type varchar(16) NOT NULL CHECK (step_type IN ('WARMUP','RUN','WALK','RECOVERY','COOLDOWN')),
    distance_m integer CHECK (distance_m>0),
    duration_s integer CHECK (duration_s>0),
    repetitions integer NOT NULL DEFAULT 1 CHECK (repetitions=1),
    pace_min_s_per_km integer CHECK (pace_min_s_per_km>0),
    pace_max_s_per_km integer CHECK (pace_max_s_per_km>0),
    effort_key varchar(80) NOT NULL CHECK (length(effort_key)>0),
    effort_params jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(effort_params)='object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workout_id,runner_id) REFERENCES training_workout(id,runner_id) ON DELETE CASCADE,
    UNIQUE (workout_id,sequence),
    CHECK ((distance_m IS NOT NULL AND duration_s IS NULL)
        OR (distance_m IS NULL AND duration_s IS NOT NULL)),
    CHECK ((pace_min_s_per_km IS NULL AND pace_max_s_per_km IS NULL)
        OR (pace_min_s_per_km IS NOT NULL AND pace_max_s_per_km IS NOT NULL
            AND pace_min_s_per_km<=pace_max_s_per_km))
);
CREATE INDEX runplan_step_owner ON training_workout_step(runner_id,workout_id);
CREATE INDEX runplan_step_workout_owner ON training_workout_step(workout_id,runner_id);

CREATE TABLE training_activity_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    workout_id uuid NOT NULL,
    activity_id bigint NOT NULL,
    decision varchar(16) NOT NULL CHECK (decision IN ('PARTIAL','COMPLETE')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workout_id,runner_id) REFERENCES training_workout(id,runner_id) ON DELETE CASCADE,
    FOREIGN KEY (activity_id,runner_id) REFERENCES activities(id,runner_id) ON DELETE CASCADE,
    UNIQUE (activity_id),
    UNIQUE (workout_id)
);
CREATE INDEX runplan_link_owner ON training_activity_link(runner_id,workout_id);
CREATE INDEX runplan_link_workout_owner ON training_activity_link(workout_id,runner_id);
CREATE INDEX runplan_link_activity_owner ON training_activity_link(activity_id,runner_id);

CREATE TABLE training_command_receipt (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE,
    operation varchar(40) NOT NULL CHECK (operation IN ('CREATE_PLAN','GENERATE','ACTIVATE','ARCHIVE',
        'LINK','UNLINK','SET_STATUS')),
    client_key uuid NOT NULL,
    request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    response_status integer NOT NULL CHECK (response_status BETWEEN 200 AND 299),
    result jsonb NOT NULL CHECK (jsonb_typeof(result)='object'),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (runner_id,operation,client_key),
    CHECK (expires_at>created_at)
);
CREATE INDEX runplan_command_expiry ON training_command_receipt(expires_at);

-- Allow lifecycle changes only; snapshots/hashes/basis never change after insert.
CREATE FUNCTION runplan_freeze_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW)-'state'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'updated_at') THEN
        RAISE EXCEPTION 'training version payload is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER runplan_version_freeze BEFORE UPDATE ON training_plan_version
    FOR EACH ROW EXECUTE FUNCTION runplan_freeze_version();

-- Published prescriptions are immutable; status/evidence/revision are mutable.
CREATE FUNCTION runplan_freeze_workout() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW)-'state'-'completion_source'-'revision'-'updated_at')
        IS DISTINCT FROM (to_jsonb(OLD)-'state'-'completion_source'-'revision'-'updated_at') THEN
        RAISE EXCEPTION 'published workout prescription is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER runplan_workout_freeze BEFORE UPDATE ON training_workout
    FOR EACH ROW EXECUTE FUNCTION runplan_freeze_workout();

CREATE FUNCTION runplan_freeze_step() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
        RAISE EXCEPTION 'published workout step is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER runplan_step_freeze BEFORE UPDATE ON training_workout_step
    FOR EACH ROW EXECUTE FUNCTION runplan_freeze_step();

CREATE FUNCTION runplan_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at=now();
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
CREATE TRIGGER runplan_link_touch BEFORE UPDATE ON training_activity_link
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();
CREATE TRIGGER runplan_command_touch BEFORE UPDATE ON training_command_receipt
    FOR EACH ROW EXECUTE FUNCTION runplan_touch_updated_at();

-- Service invariants: JSON schemas and hashes; all-day/step sums; rule approval;
-- ACTIVE plan/version agreement; REST has zero child steps; link decision matches
-- workout completion_source/state; run is eligible; deletes/edits bump revisions.
-- Cascades enforce referential cleanup but do not reconcile completion state.
COMMIT;

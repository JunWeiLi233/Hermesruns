-- Disposable database contract checks. NEVER run this fixture on the Hermes database.
-- psql resolves schema.sql beside this file via \ir.
\set ON_ERROR_STOP on
CREATE TABLE runner(id bigint PRIMARY KEY);
CREATE TABLE activities(id bigint PRIMARY KEY, runner_id bigint NOT NULL REFERENCES runner(id) ON DELETE CASCADE);
\ir schema.sql

DO $$
DECLARE
    p uuid := gen_random_uuid();
    replacement uuid := gen_random_uuid();
    v uuid := gen_random_uuid();
    w uuid := gen_random_uuid();
    receipt uuid := gen_random_uuid();
    save_key uuid := gen_random_uuid();
    actual_count integer;
BEGIN
    INSERT INTO runner VALUES (1),(2);
    INSERT INTO activities VALUES (101,1),(202,2);
    INSERT INTO training_plan(id,runner_id,title,goal_kind,target_distance_m,state,input_snapshot)
        VALUES (p,1,'Fixture','DISTANCE',5000,'ACTIVE','{}');
    INSERT INTO training_plan(id,runner_id,title,goal_kind,target_distance_m,state,input_snapshot)
        VALUES (replacement,1,'Replacement','DISTANCE',10000,'DRAFT','{}');
    BEGIN
        UPDATE training_plan SET state='ACTIVE' WHERE id=replacement;
        RAISE EXCEPTION 'FAIL: second active plan accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO training_plan_version(runner_id,plan_id,ordinal,base_revision,generator_version,
            mode,input_snapshot,workout_snapshot,start_date,end_date,time_zone)
            VALUES (2,p,1,0,'fixture-v1','DEMO','{}','[]','2026-10-13','2026-11-01','America/New_York');
        RAISE EXCEPTION 'FAIL: cross-owner version accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    INSERT INTO training_plan_version(id,runner_id,plan_id,ordinal,base_revision,state,generator_version,
        mode,input_snapshot,workout_snapshot,start_date,end_date,time_zone)
        VALUES (v,1,p,1,0,'ACTIVE','fixture-v1','DEMO','{}','[]','2026-10-13','2026-11-01','America/New_York');
    BEGIN
        INSERT INTO training_plan_version(runner_id,plan_id,ordinal,base_revision,state,generator_version,
            mode,input_snapshot,workout_snapshot,start_date,end_date,time_zone)
            VALUES (1,p,2,0,'ACTIVE','fixture-v1','DEMO','{}','[]','2026-10-13','2026-11-01','America/New_York');
        RAISE EXCEPTION 'FAIL: second active version accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO training_workout(id,runner_id,plan_id,version_id,local_date,workout_type,explanation)
        VALUES (w,1,p,v,'2026-10-13','EASY','Synthetic fixture');
    BEGIN
        INSERT INTO training_workout_step(runner_id,workout_id,sequence,step_type,distance_m,duration_s,effort_text)
            VALUES (1,w,0,'RUN',1000,600,'Fixture');
        RAISE EXCEPTION 'FAIL: ambiguous step target accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO training_workout_step(runner_id,workout_id,sequence,step_type,duration_s,effort_text)
        VALUES (1,w,0,'RUN',600,'Synthetic effort');
    BEGIN
        INSERT INTO training_activity_link(runner_id,workout_id,activity_id,decision) VALUES (1,w,202,'COMPLETE');
        RAISE EXCEPTION 'FAIL: cross-owner activity link accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    INSERT INTO training_activity_receipt(id,runner_id,activity_id,client_key,request_hash,source,
        started_at,local_date,time_zone,elapsed_s,distance_m)
        VALUES (receipt,1,101,save_key,repeat('a',64),'MANUAL',
            '2026-10-14T01:30:00Z','2026-10-13','America/New_York',600,1000);
    BEGIN
        INSERT INTO training_activity_receipt(runner_id,client_key,request_hash,source,
            started_at,local_date,time_zone,elapsed_s,distance_m)
            VALUES (1,save_key,repeat('a',64),'MANUAL',now(),'2026-10-13','UTC',600,1000);
        RAISE EXCEPTION 'FAIL: duplicate client save key accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    SELECT count(*) INTO actual_count FROM training_activity_receipt
        WHERE id=receipt AND (started_at AT TIME ZONE time_zone)::date=local_date;
    IF actual_count<>1 THEN RAISE EXCEPTION 'FAIL: captured-zone day changed'; END IF;
    INSERT INTO training_activity_link(runner_id,workout_id,activity_id,decision) VALUES (1,w,101,'COMPLETE');
    UPDATE training_activity_receipt SET state='DELETED' WHERE id=receipt;
    DELETE FROM activities WHERE id=101;
    IF EXISTS(SELECT 1 FROM training_activity_link WHERE activity_id=101) THEN
        RAISE EXCEPTION 'FAIL: deleted activity still linked';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM training_activity_receipt
        WHERE id=receipt AND runner_id=1 AND activity_id IS NULL AND state='DELETED') THEN
        RAISE EXCEPTION 'FAIL: deletion lost retry tombstone or owner';
    END IF;
    UPDATE training_plan_version SET state='HISTORICAL' WHERE id=v;
    UPDATE training_plan SET state='ARCHIVED' WHERE id=p;
    UPDATE training_plan SET state='ACTIVE' WHERE id=replacement;
    IF (SELECT count(*) FROM training_plan WHERE runner_id=1 AND state='ACTIVE')<>1 THEN
        RAISE EXCEPTION 'FAIL: replacement plan state invalid';
    END IF;
    DELETE FROM runner WHERE id=1;
    IF EXISTS(SELECT 1 FROM training_plan WHERE runner_id=1)
        OR EXISTS(SELECT 1 FROM training_activity_receipt WHERE runner_id=1)
        OR EXISTS(SELECT 1 FROM training_workout_step WHERE runner_id=1) THEN
        RAISE EXCEPTION 'FAIL: owner deletion did not cascade';
    END IF;
    RAISE NOTICE 'PASS: active plan/version uniqueness, owner FKs, step target, save key, captured date, deletion tombstone, replacement, owner cascade';
END;
$$;

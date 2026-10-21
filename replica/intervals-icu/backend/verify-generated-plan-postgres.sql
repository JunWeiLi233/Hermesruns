-- Run on the restored copy and again after migration. Every fixture write rolls back.
\set ON_ERROR_STOP on
begin;
do $$
declare owner_runner bigint; p uuid:=gen_random_uuid(); v uuid:=gen_random_uuid();
 w uuid:=gen_random_uuid(); step_id uuid:=gen_random_uuid();
begin
 if (select count(*) from pg_indexes where schemaname='public' and indexname in
  ('runplan_one_active_plan','runplan_one_active_version','runplan_daily_workout'))<>3
 or (select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and tgname in
  ('runplan_version_freeze','runplan_workout_freeze','runplan_step_freeze'))<>3 then
  raise exception 'Generated plan indexes or enabled triggers missing';
 end if;
 select min(r.id) into owner_runner from runner r where not exists(select 1 from training_plan p where p.runner_id=r.id and p.state='ACTIVE');
 if owner_runner is null then raise exception 'No isolated fixture owner available'; end if;
 insert into training_plan(id,runner_id,title,state,goal_kind,target_distance_m,input_snapshot,revision,created_at,updated_at)
 values(p,owner_runner,'Release invariant fixture','ACTIVE','DISTANCE',5000,'{}',0,now(),now());
 begin
  insert into training_plan(id,runner_id,title,state,goal_kind,target_distance_m,input_snapshot,revision,created_at,updated_at)
  values(gen_random_uuid(),owner_runner,'Duplicate fixture','ACTIVE','DISTANCE',5000,'{}',0,now(),now());
  raise exception 'Duplicate active plan accepted';
 exception when unique_violation then null; end;
 insert into training_plan_version(id,runner_id,plan_id,ordinal,base_revision,state,generator_version,mode,schema_version,
  input_snapshot,workout_snapshot,input_hash,content_hash,retained_hash,warnings,generation_local_date,start_date,end_date,time_zone,created_at,updated_at)
 values(v,owner_runner,p,1,0,'ACTIVE','hermes-road-v4','ORIGINAL',1,'{}','[]',repeat('a',64),repeat('a',64),repeat('a',64),'[]',current_date,current_date,current_date+56,'UTC',now(),now());
 begin
  insert into training_plan_version(end_date,generation_local_date,ordinal,schema_version,start_date,base_revision,created_at,runner_id,updated_at,
   id,mode,plan_id,state,content_hash,input_hash,retained_hash,time_zone,generator_version,input_snapshot,warnings,workout_snapshot)
  select end_date,generation_local_date,2,schema_version,start_date,base_revision,created_at,runner_id,updated_at,
   gen_random_uuid(),mode,plan_id,'ACTIVE',content_hash,input_hash,retained_hash,time_zone,generator_version,input_snapshot,warnings,workout_snapshot
  from training_plan_version where id=v;
  raise exception 'Duplicate active version accepted';
 exception when unique_violation then null; end;
 insert into training_workout(id,runner_id,plan_id,version_id,local_date,workout_type,phase,target_distance_m,state,completion_source,revision,explanation,created_at,updated_at)
 values(w,owner_runner,p,v,current_date,'EASY','BASE',2300,'PLANNED','NONE',0,'{}',now(),now());
 begin
  insert into training_workout(id,runner_id,plan_id,version_id,local_date,workout_type,phase,state,completion_source,revision,explanation,created_at,updated_at)
  values(gen_random_uuid(),owner_runner,p,v,current_date,'REST','BASE','PLANNED','NONE',0,'{}',now(),now());
  raise exception 'Duplicate generated day accepted';
 exception when unique_violation then null; end;
 insert into training_workout(id,runner_id,plan_id,version_id,local_date,workout_type,phase,state,completion_source,revision,explanation,created_at,updated_at)
 select gen_random_uuid(),owner_runner,p,v,current_date,'AUTHORED','CUSTOM','PLANNED','NONE',0,'{}'::jsonb,now(),now() from generate_series(1,2);
 insert into training_workout_step(id,runner_id,workout_id,sequence,step_type,duration_s,repetitions,effort_key,effort_params,created_at,updated_at)
 values(step_id,owner_runner,w,1,'RUN',600,1,'EASY','{}',now(),now());
 begin
  update training_plan_version set content_hash=repeat('b',64) where id=v;
  raise exception 'Version payload mutation accepted';
 exception when check_violation then null; end;
 begin
  update training_workout set target_distance_m=9999 where id=w;
  raise exception 'Workout payload mutation accepted';
 exception when check_violation then null; end;
 begin
  update training_workout_step set duration_s=9999 where id=step_id;
  raise exception 'Step payload mutation accepted';
 exception when check_violation then null; end;
 update training_workout set state='RETIRED',completion_source='NONE',revision=revision+1,updated_at=now() where id=w;
 update training_plan_version set state='HISTORICAL',updated_at=now() where id=v;
 insert into training_workout(id,runner_id,plan_id,version_id,local_date,workout_type,phase,state,completion_source,revision,explanation,created_at,updated_at)
 values(gen_random_uuid(),owner_runner,p,v,current_date,'EASY','BASE','PLANNED','NONE',0,'{}',now(),now());
end $$;
rollback;
select 'PASS: active plan/version uniqueness; generated-day uniqueness; same-day authored sessions; immutable version/workout/step; lifecycle retirement and replacement; all fixtures rolled back';

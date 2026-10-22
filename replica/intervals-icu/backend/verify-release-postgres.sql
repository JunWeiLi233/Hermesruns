-- Run on the restored copy first. All fixture writes roll back, including on failure.
\set ON_ERROR_STOP on
begin;
do $$
declare owner_runner bigint; other_runner bigint;
begin
 if (select count(*) from tw_migration where version in (1,2,3,4,5)) <> 5 then
  raise exception 'Release migration ledger incomplete';
 end if;
 if exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
  where c.relnamespace='public'::regnamespace and (c.relname like 'tw_%' or c.relname in ('manual_run_receipt','runner_plan_profile','training_activity_link','training_command_receipt','training_plan','training_plan_version','training_workout','training_workout_step','manual_run_receipt_id_seq')) and a.grantee=0) then
  raise exception 'Release tables expose PUBLIC privileges';
 end if;
 select min(id),max(id) into owner_runner,other_runner from runner r where not exists(select 1 from tw_profile p where p.runner_id=r.id);
 if owner_runner is null or owner_runner=other_runner then raise exception 'Rehearsal requires two existing identity rows'; end if;
 insert into tw_profile(id,runner_id,settings) values ('release-check-owner',owner_runner,'{}'),('release-check-other',other_runner,'{}');
 begin
  insert into tw_profile(id,runner_id,settings) values ('release-check-duplicate',owner_runner,'{}');
  raise exception 'Duplicate Runner mapping accepted';
 exception when unique_violation then null; end;
 begin
  insert into tw_access(id,subject_id,grantee_id,access_level,state,wellness) values ('release-check-grant','release-check-owner','release-check-owner','coach','accepted','[]');
  raise exception 'Self coaching grant accepted';
 exception when check_violation then null; end;
 insert into tw_team(id,name,slug,creator_id) values ('release-check-team','Release fixture','release-check-private','release-check-owner');
 begin
  insert into tw_member values ('release-check-team','release-check-owner','root','active');
  raise exception 'Invalid team role accepted';
 exception when check_violation then null; end;
 insert into tw_workout(id,owner_id) values ('release-check-workout','release-check-owner');
 insert into tw_workout_version values ('release-check-workout',1,'{}');
 begin
  update tw_workout_version set payload='{"minutes":999}' where workout_id='release-check-workout';
  raise exception 'Immutable workout update accepted';
 exception when check_violation then null; end;
 insert into tw_plan(id,owner_id,title,payload) values ('release-check-plan','release-check-owner','Release fixture','[]');
 begin
  update tw_plan set payload='[{}]' where id='release-check-plan';
  raise exception 'Immutable plan update accepted';
 exception when check_violation then null; end;
 insert into tw_assignment values ('release-check-assignment','release-check-owner','release-check-plan',1,'2026-10-19');
 begin
  insert into tw_assignment values ('release-check-duplicate','release-check-owner','release-check-plan',1,'2026-10-19');
  raise exception 'Duplicate plan assignment accepted';
 exception when unique_violation then null; end;
 delete from tw_workout where id='release-check-workout';
 if exists(select 1 from tw_workout_version where workout_id='release-check-workout') then raise exception 'Owner erasure did not remove versions'; end if;
end $$;
rollback;
select 'PASS: ledger, PUBLIC privileges, identity uniqueness, self-grant denial, team roles, immutable workout/plan versions, assignment uniqueness, owner erasure; fixtures rolled back';

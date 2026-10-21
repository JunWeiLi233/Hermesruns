-- psql --single-transaction --set=ON_ERROR_STOP=1 --set=runner_id=123 --file=seed-demo.sql
-- Supply an EXISTING disposable Runner ID. This never creates credentials or service accounts.
do $$ begin
 if current_database() not like '%training_demo%' then
  raise exception 'Seed only a disposable database whose name contains training_demo';
 end if;
end $$;
insert into tw_profile(id,runner_id,settings)
values('10000000-0000-4000-8000-000000000001',:runner_id,
'{"name":"Demo Athlete","zone":"America/New_York","units":"metric","maxHr":190,"ftp":240,"fitnessTau":42,"fatigueTau":7,"discoverable":false,"routePrivate":true,"notifications":false}')
on conflict(runner_id) do nothing;
insert into tw_folder(id,owner_id,name)
select '10000000-0000-4000-8000-000000000002',id,'Original base sessions' from tw_profile where runner_id=:runner_id
on conflict(id) do nothing;
insert into tw_workout(id,owner_id,folder_id)
select '10000000-0000-4000-8000-000000000003',id,'10000000-0000-4000-8000-000000000002' from tw_profile where runner_id=:runner_id
on conflict(id) do nothing;
insert into tw_workout_version(workout_id,ordinal,payload)
values('10000000-0000-4000-8000-000000000003',1,
'{"title":"Easy foundation","source":"20m @65% Easy","sport":"Running","minutes":20,"errors":[],"steps":[{"minutes":20,"target":65,"unit":"%","name":"Easy"}]}')
on conflict(workout_id,ordinal) do nothing;
-- Canonical activities, prescriptions, memberships and consent are seeded through the tested services
-- in TrainingCanonicalFlowTests/TrainingAccessTests, never by bypassing their authorities here.

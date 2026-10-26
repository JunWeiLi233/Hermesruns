-- Add the generated-plan release guards without changing existing plan data.
-- Canonical authored sessions share an EXTERNAL parent and may occur twice a day.
do $$
begin
 if exists(select 1 from training_plan where state='ACTIVE' group by runner_id having count(*)>1)
 or exists(select 1 from training_plan_version where state='ACTIVE' group by plan_id having count(*)>1)
 or exists(select 1 from training_workout where state<>'RETIRED' and workout_type<>'AUTHORED' group by plan_id,local_date having count(*)>1) then
  raise exception 'Generated plan guards require duplicate active plans/versions/days to be reviewed first';
 end if;
end $$;
create unique index if not exists runplan_one_active_plan on training_plan(runner_id) where state='ACTIVE';
create unique index if not exists runplan_one_active_version on training_plan_version(plan_id) where state='ACTIVE';
-- Replace the earlier standalone design's predicate if it was installed manually.
drop index if exists runplan_daily_workout;
create unique index runplan_daily_workout on training_workout(plan_id,local_date)
 where state<>'RETIRED' and workout_type<>'AUTHORED';

create or replace function runplan_freeze_version() returns trigger language plpgsql as $$
begin
 if (to_jsonb(NEW)-'state'-'updated_at') is distinct from (to_jsonb(OLD)-'state'-'updated_at') then
  raise exception 'training version payload is immutable' using errcode='23514';
 end if;
 return NEW;
end $$;
drop trigger if exists runplan_version_freeze on training_plan_version;
create trigger runplan_version_freeze before update on training_plan_version
 for each row execute function runplan_freeze_version();

create or replace function runplan_freeze_workout() returns trigger language plpgsql as $$
begin
 if (to_jsonb(NEW)-'state'-'completion_source'-'revision'-'updated_at') is distinct from
    (to_jsonb(OLD)-'state'-'completion_source'-'revision'-'updated_at') then
  raise exception 'published workout prescription is immutable' using errcode='23514';
 end if;
 return NEW;
end $$;
drop trigger if exists runplan_workout_freeze on training_workout;
create trigger runplan_workout_freeze before update on training_workout
 for each row execute function runplan_freeze_workout();

create or replace function runplan_freeze_step() returns trigger language plpgsql as $$
begin
 if (to_jsonb(NEW)-'updated_at') is distinct from (to_jsonb(OLD)-'updated_at') then
  raise exception 'published workout step is immutable' using errcode='23514';
 end if;
 return NEW;
end $$;
drop trigger if exists runplan_step_freeze on training_workout_step;
create trigger runplan_step_freeze before update on training_workout_step
 for each row execute function runplan_freeze_step();

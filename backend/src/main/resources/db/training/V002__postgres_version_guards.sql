-- PostgreSQL production guard. H2 retains service-level immutable publishing plus constraints.
create or replace function tw_reject_version_update() returns trigger language plpgsql as $$
begin
 raise exception 'IMMUTABLE_TRAINING_VERSION' using errcode='23514';
end;
$$;
drop trigger if exists tw_workout_version_immutable on tw_workout_version;
create trigger tw_workout_version_immutable before update on tw_workout_version
 for each row execute function tw_reject_version_update();
drop trigger if exists tw_plan_source_immutable on tw_plan;
create trigger tw_plan_source_immutable before update of payload,ordinal,owner_id on tw_plan
 for each row execute function tw_reject_version_update();
revoke all on tw_profile,tw_activity,tw_access,tw_team,tw_member,tw_consent,tw_folder,
 tw_workout,tw_workout_version,tw_plan,tw_share,tw_comparison,tw_season,tw_conversation,
 tw_participant,tw_message,tw_bulk,tw_bulk_target,tw_receipt,tw_job,tw_audit,
 tw_wellness_annotation,tw_assignment,tw_migration,tw_file_cleanup from public;
revoke all on function tw_reject_version_update() from public;

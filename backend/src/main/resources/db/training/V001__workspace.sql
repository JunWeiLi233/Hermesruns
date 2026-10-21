-- Additive mapping for the existing Runner/Activity authorities. H2 and PostgreSQL compatible.
-- Erasure tombstones deliberately have no account FK; retain until private object deletion succeeds.
create table if not exists tw_file_cleanup (id varchar(36) primary key);
create table if not exists tw_profile (
 id varchar(36) primary key, runner_id bigint not null unique references runner(id),
 revision bigint not null default 1, data_revision bigint not null default 1,
 settings text not null
);
create table if not exists tw_activity (
 id varchar(36) primary key, activity_id bigint not null unique references activities(id) on delete cascade,
 athlete_id varchar(36) not null references tw_profile(id), revision bigint not null default 1,
 civil_date date, sport varchar(40), intervals text not null default '[]'
);
create index if not exists tw_activity_owner on tw_activity(athlete_id);
create table if not exists tw_access (
 id varchar(36) primary key, subject_id varchar(36) not null references tw_profile(id),
 grantee_id varchar(36) not null references tw_profile(id),
 access_level varchar(8) not null check(access_level in ('read','coach')),
 state varchar(16) not null check(state in ('pending','accepted','declined','revoked')),
 wellness text not null, unique(subject_id,grantee_id,access_level), check(subject_id<>grantee_id)
);
create index if not exists tw_access_grantee on tw_access(grantee_id,state);
create table if not exists tw_team (
 id varchar(36) primary key, name varchar(160) not null, slug varchar(80) not null unique,
 creator_id varchar(36) not null references tw_profile(id), revision bigint not null default 1,
 scope_revision bigint not null default 1, coaching_enabled boolean not null default true,
 posting varchar(8) not null default 'members' check(posting in ('members','staff')),
 visibility varchar(8) not null default 'members' check(visibility in ('members','staff'))
);
create table if not exists tw_member (
 team_id varchar(36) not null references tw_team(id) on delete cascade,
 user_id varchar(36) not null references tw_profile(id), role varchar(8) not null check(role in ('member','follower','coach','admin')),
 state varchar(8) not null check(state in ('pending','active','removed')), primary key(team_id,user_id)
);
create index if not exists tw_member_user on tw_member(user_id,state);
create table if not exists tw_consent (
 team_id varchar(36) not null references tw_team(id) on delete cascade,
 user_id varchar(36) not null references tw_profile(id), scope_revision bigint not null,
 state varchar(8) not null check(state in ('granted','declined','revoked')),
 access_level varchar(8) not null check(access_level in ('read','coach')), wellness text not null,
 primary key(team_id,user_id)
);
create table if not exists tw_folder (
 id varchar(36) primary key, owner_id varchar(36) not null references tw_profile(id), name varchar(160) not null
);
create table if not exists tw_workout (
 id varchar(36) primary key, owner_id varchar(36) not null references tw_profile(id),
 folder_id varchar(36) references tw_folder(id), current_version integer not null default 1
);
create table if not exists tw_workout_version (
 workout_id varchar(36) not null references tw_workout(id) on delete cascade, ordinal integer not null,
 payload text not null, primary key(workout_id,ordinal)
);
create table if not exists tw_plan (
 id varchar(36) primary key, owner_id varchar(36) not null references tw_profile(id),
 title varchar(160) not null, ordinal integer not null default 1, payload text not null
);
create table if not exists tw_share (
 id varchar(36) primary key, resource_type varchar(8) not null check(resource_type in ('workout','plan')),
 resource_id varchar(36) not null, owner_id varchar(36) not null references tw_profile(id),
 grantee_id varchar(36) not null references tw_profile(id), unique(resource_type,resource_id,grantee_id)
);
create table if not exists tw_comparison (
 id varchar(36) primary key, owner_id varchar(36) not null references tw_profile(id), payload text not null
);
create table if not exists tw_season (
 id varchar(36) primary key, athlete_id varchar(36) not null references tw_profile(id), payload text not null
);
create table if not exists tw_conversation (
 id varchar(36) primary key, kind varchar(8) not null check(kind in ('direct','group','activity')),
 team_id varchar(36) references tw_team(id) on delete cascade,
 activity_id varchar(36) references tw_activity(id) on delete cascade
);
create table if not exists tw_participant (
 conversation_id varchar(36) not null references tw_conversation(id) on delete cascade,
 user_id varchar(36) not null references tw_profile(id), primary key(conversation_id,user_id)
);
create table if not exists tw_message (
 id varchar(36) primary key, conversation_id varchar(36) not null references tw_conversation(id) on delete cascade,
 sender_id varchar(36) not null references tw_profile(id), body varchar(4000) not null,
 workout_id varchar(36) references tw_workout(id), created_at bigint not null
);
create index if not exists tw_message_thread on tw_message(conversation_id,created_at,id);
create table if not exists tw_bulk (
 id varchar(36) primary key, actor_id varchar(36) not null references tw_profile(id),
 kind varchar(16) not null check(kind in ('plan','configuration')),
 request_hash varchar(64) not null, expires_at bigint not null, payload text not null
);
create table if not exists tw_bulk_target (
 operation_id varchar(36) not null references tw_bulk(id) on delete cascade,
 -- Denied or nonexistent targets remain opaque UUIDs; no identity-existence oracle via FK errors.
 athlete_id varchar(36) not null, expected_revision bigint not null,
 state varchar(24) not null, result text, primary key(operation_id,athlete_id)
);
create table if not exists tw_receipt (
 actor_id varchar(36) not null references tw_profile(id), operation varchar(120) not null,
 client_key varchar(80) not null, request_hash varchar(64) not null, result text not null,
 expires_at bigint not null, primary key(actor_id,operation,client_key)
);
create table if not exists tw_job (
 id varchar(36) primary key, actor_id varchar(36) not null references tw_profile(id),
 kind varchar(16) not null, state varchar(16) not null,
 attempts integer not null default 0, available_at bigint not null, lease_until bigint,
 payload text not null, result text, error_code varchar(80)
);
create index if not exists tw_job_claim on tw_job(state,available_at,lease_until);
create table if not exists tw_audit (
 id varchar(36) primary key, actor_id varchar(36) not null references tw_profile(id),
 subject_id varchar(36) references tw_profile(id), action varchar(64) not null, occurred_at bigint not null
);
create index if not exists tw_audit_actor on tw_audit(actor_id,occurred_at);
-- Subjective annotation/revision only. Sleep and resting HR stay in the existing wellness authorities.
create table if not exists tw_wellness_annotation (
 athlete_id varchar(36) not null references tw_profile(id), civil_date date not null,
 feeling integer check(feeling>=1 and feeling<=5), revision bigint not null default 1,
 primary key(athlete_id,civil_date)
);
create table if not exists tw_assignment (
 id varchar(36) primary key, athlete_id varchar(36) not null references tw_profile(id),
 source_plan_id varchar(36) not null, source_version integer not null, start_date date not null,
 unique(athlete_id,source_plan_id,source_version,start_date)
);

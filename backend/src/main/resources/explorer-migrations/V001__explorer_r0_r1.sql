-- Additive extension only. Apply deliberately after Hermes canonical tables exist.
CREATE SCHEMA statshunters;
REVOKE ALL ON SCHEMA statshunters FROM PUBLIC;
CREATE UNIQUE INDEX sh_activity_owner ON public.activities(runner_id,id);

CREATE TABLE statshunters.account_profiles (
 id uuid PRIMARY KEY,
 runner_id bigint NOT NULL UNIQUE REFERENCES public.runner(id) ON DELETE CASCADE,
 preferences jsonb NOT NULL DEFAULT '{}',
 filter_spec jsonb NOT NULL DEFAULT '{}',
 dataset_revision bigint NOT NULL DEFAULT 1 CHECK(dataset_revision>0),
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','deleting')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,runner_id)
);
CREATE TABLE statshunters.background_jobs (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES statshunters.account_profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('import','report_verification','report')),
 dedupe_key varchar(128) NOT NULL,
 request_hash char(64) NOT NULL,
 input jsonb NOT NULL DEFAULT '{}',
 result jsonb NOT NULL DEFAULT '{}',
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','retry','complete','failed','cancelled')),
 cancel_requested boolean NOT NULL DEFAULT false,
 attempts integer NOT NULL DEFAULT 0,
 run_after timestamptz NOT NULL DEFAULT now(),
 lease_expires_at timestamptz,
 lease_owner uuid,
 error_code varchar(64),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,dedupe_key), UNIQUE(user_id,id)
);
CREATE INDEX sh_job_dispatch ON statshunters.background_jobs(state,run_after,created_at);
CREATE TABLE statshunters.file_assets (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES statshunters.account_profiles(id) ON DELETE CASCADE,
 job_id uuid NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal>=0),
 filename varchar(180) NOT NULL,
 format varchar(3) NOT NULL CHECK(format IN ('GPX','TCX','FIT')),
 source_hash char(64) NOT NULL,
 classification text NOT NULL CHECK(classification='authorized_file'),
 attested_at timestamptz NOT NULL,
 bytes bytea NOT NULL CHECK(octet_length(bytes)>0 AND octet_length(bytes)<=52428800),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','complete','failed','duplicate','cancelled')),
 activity_id bigint,
 error_code varchar(64),
 UNIQUE(user_id,job_id,ordinal),
 FOREIGN KEY(user_id,job_id) REFERENCES statshunters.background_jobs(user_id,id) ON DELETE CASCADE
);
CREATE TABLE statshunters.activity_facts (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 runner_id bigint NOT NULL,
 legacy_activity_id bigint NOT NULL UNIQUE,
 source_hash char(64) NOT NULL,
 start_at timestamptz NOT NULL,
 name varchar(255) NOT NULL,
 sport varchar(16) NOT NULL CHECK(sport IN ('run','ride','walk','hike','swim','other')),
 subtype varchar(16) NOT NULL CHECK(subtype IN ('regular','workout','race','unknown')),
 commute boolean, trainer boolean, gear varchar(160),
 distance_m double precision CHECK(distance_m>=0 AND distance_m<'Infinity'::float8),
 moving_seconds bigint CHECK(moving_seconds>=0),
 elapsed_seconds bigint CHECK(elapsed_seconds>=0),
 ascent_m double precision CHECK(ascent_m>=0 AND ascent_m<'Infinity'::float8),
 point_count integer NOT NULL CHECK(point_count BETWEEN 0 AND 200000),
 metadata jsonb NOT NULL,
 FOREIGN KEY(user_id,runner_id) REFERENCES statshunters.account_profiles(id,runner_id) ON DELETE CASCADE,
 FOREIGN KEY(runner_id,legacy_activity_id) REFERENCES public.activities(runner_id,id) ON DELETE CASCADE,
 UNIQUE(user_id,source_hash), UNIQUE(user_id,id)
);
CREATE INDEX sh_activity_filter ON statshunters.activity_facts(user_id,start_at DESC,legacy_activity_id);
CREATE INDEX sh_activity_sport ON statshunters.activity_facts(user_id,sport,start_at);
CREATE TABLE statshunters.track_segments (
 user_id uuid NOT NULL,
 activity_id uuid PRIMARY KEY,
 segments jsonb NOT NULL,
 FOREIGN KEY(user_id,activity_id) REFERENCES statshunters.activity_facts(user_id,id) ON DELETE CASCADE
);
CREATE TABLE statshunters.activity_tiles (
 user_id uuid NOT NULL,
 activity_id uuid NOT NULL,
 x integer NOT NULL CHECK(x BETWEEN 0 AND 16383),
 y integer NOT NULL CHECK(y BETWEEN 0 AND 16383),
 PRIMARY KEY(user_id,activity_id,x,y),
 FOREIGN KEY(user_id,activity_id) REFERENCES statshunters.activity_facts(user_id,id) ON DELETE CASCADE
);
CREATE INDEX sh_tile_viewport ON statshunters.activity_tiles(user_id,x,y);
CREATE TABLE statshunters.email_preferences (
 user_id uuid PRIMARY KEY REFERENCES statshunters.account_profiles(id) ON DELETE CASCADE,
 address varchar(254), verified_at timestamptz,
 verification_hash char(64), verification_expires_at timestamptz,
 unsubscribe_hash char(64), unsubscribe_secret text, enabled boolean NOT NULL DEFAULT false,
 CHECK(NOT enabled OR (address IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE UNIQUE INDEX sh_email_verify ON statshunters.email_preferences(verification_hash) WHERE verification_hash IS NOT NULL;
CREATE UNIQUE INDEX sh_email_unsubscribe ON statshunters.email_preferences(unsubscribe_hash) WHERE unsubscribe_hash IS NOT NULL;
-- Receipts have no owner/PII; the random capability is returned once and only its hash stored.
CREATE TABLE statshunters.deletion_requests (
 id uuid PRIMARY KEY,
 runner_id bigint UNIQUE,
 receipt_hash char(64) NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','retry','complete','failed')),
 attempts integer NOT NULL DEFAULT 0,
 run_after timestamptz NOT NULL DEFAULT now(),
 lease_expires_at timestamptz,
 lease_owner uuid,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 error_code varchar(64)
);

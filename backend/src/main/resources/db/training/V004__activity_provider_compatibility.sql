-- Widen the legacy enum check to match the current ImportProvider authority.
-- Existing activities retain every value and identity. DDL runs in the release transaction.
alter table activities drop constraint if exists activities_provider_check;
alter table activities add constraint activities_provider_check check
 (provider in ('STRAVA','GARMIN','OURA','COROS','HUAWEI','APPLE_HEALTH','GOOGLE_HEALTH','MANUAL'));

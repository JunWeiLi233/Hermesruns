param([switch]$BackupAndStagingVerified)
$ErrorActionPreference = 'Stop'
if (-not $BackupAndStagingVerified) { throw 'First verify a recoverable backup and migration on a production-sized staging copy. Then pass -BackupAndStagingVerified.' }
if (-not $env:PGDATABASE) { throw 'Set PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD privately. Credentials are never command arguments.' }
Get-Command psql -ErrorAction Stop | Out-Null
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$migrations = Join-Path $workspace 'backend/src/main/resources/db/training'
$parts = [System.Collections.Generic.List[string]]::new()
$parts.Add("select pg_advisory_xact_lock(214151,1);`ncreate table if not exists tw_migration(version integer primary key,checksum varchar(64) not null);")
$version = 0
foreach ($name in @('V001__workspace.sql','V002__postgres_version_guards.sql','V003__canonical_training.sql','V004__activity_provider_compatibility.sql','V005__generated_plan_guards.sql')) {
    $version++
    $sql = [IO.File]::ReadAllText((Join-Path $migrations $name))
    $bytes = [Text.Encoding]::UTF8.GetBytes($sql)
    $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
    $parts.Add(@"
do `$verify`$ begin
 if exists(select 1 from tw_migration where version=$version and checksum<>'$digest') then
  raise exception 'MIGRATION_CHECKSUM_CHANGED';
 end if;
end `$verify`$;
select not exists(select 1 from tw_migration where version=$version) as apply_migration \gset
\if :apply_migration
$sql
insert into tw_migration(version,checksum) values($version,'$digest');
\endif
"@)
}
$temporarySql = Join-Path ([IO.Path]::GetTempPath()) ('training-migration-' + [Guid]::NewGuid().ToString('N') + '.sql')
try {
    [IO.File]::WriteAllText($temporarySql,($parts -join "`n"),[Text.UTF8Encoding]::new($false))
    & psql --no-psqlrc --single-transaction --set=ON_ERROR_STOP=1 --file=$temporarySql
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed; psql rolled back the transaction.' }
} finally { if (Test-Path -LiteralPath $temporarySql) { Remove-Item -LiteralPath $temporarySql } }

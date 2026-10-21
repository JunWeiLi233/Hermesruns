param(
    [Parameter(Mandatory)][ValidateSet('Backup','Rehearse','VerifyRehearsal','Migrate','StopRehearsal')][string]$Phase,
    [Parameter(Mandatory)][string]$RunDirectory,
    [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
    [int]$RehearsalPort = 55432,
    [switch]$ResumeRehearsal
)
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
. (Join-Path $PSScriptRoot 'release-evidence.ps1')
$privateRoot=[IO.Path]::GetFullPath((Join-Path $workspace '.private-backups'))
$run=[IO.Path]::GetFullPath($RunDirectory)
if(-not $run.StartsWith($privateRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Release data must stay in the private backup root.'}
$manifestFile=Join-Path $run 'manifest.json'
$archive=Join-Path $run 'hermes-before-training.dump'
$cluster=Join-Path $run 'rehearsal-cluster'
$env:PGCONNECT_TIMEOUT='10';$env:PGAPPNAME='hermes-training-release'
$env:PATH=$PgBin+[IO.Path]::PathSeparator+$env:PATH
function Use-Source {
    . (Join-Path $workspace 'Hermes.local.env.ps1') *> $null
    $uri=[Uri]($env:APP_DB_URL -replace '^jdbc:','')
    if($uri.Scheme -ne 'postgresql' -or -not $uri.IsLoopback){throw 'This release runner is restricted to the configured local PostgreSQL instance.'}
    $env:PGHOST=$uri.DnsSafeHost;$env:PGPORT=if($uri.Port -gt 0){[string]$uri.Port}else{'5432'}
    $env:PGDATABASE=[Uri]::UnescapeDataString($uri.AbsolutePath.Trim('/'));$env:PGUSER=$env:APP_DB_USERNAME;$env:PGPASSWORD=$env:APP_DB_PASSWORD
}
function Use-Rehearsal {
    $secret=Import-Clixml -LiteralPath (Join-Path $run 'rehearsal-password.clixml')
    $env:PGPASSWORD=[Net.NetworkCredential]::new('',$secret).Password
    $env:PGHOST='127.0.0.1';$env:PGPORT=[string]$RehearsalPort;$env:PGDATABASE='hermes';$env:PGUSER='hermes_release_check'
}
function Save-Manifest { [IO.File]::WriteAllText($manifestFile,($script:manifest|ConvertTo-Json -Depth 15),[Text.UTF8Encoding]::new($false)) }
function Sql([string]$Query,[string]$Name){
    $errorFile=Join-Path $run ($Name+'.error.log')
    $result=& (Join-Path $PgBin 'psql.exe') -X -t -A -v ON_ERROR_STOP=1 -c $Query 2>$errorFile
    if($LASTEXITCODE -ne 0){throw "Database check failed; see private log $errorFile"}
    return ($result -join "`n").Trim()
}
function Counts([string]$Name){
    $file=Join-Path $run 'count-public-tables.sql'
    [IO.File]::WriteAllText($file,@'
select format('select json_object_agg(name,total) from (%s) totals',string_agg(format('select %L::text as name,count(*)::bigint as total from %I.%I',schemaname||'.'||tablename,schemaname,tablename),' union all ' order by tablename)) from pg_tables where schemaname='public' \gexec
'@,[Text.UTF8Encoding]::new($false))
    $result=& (Join-Path $PgBin 'psql.exe') -X -t -A -v ON_ERROR_STOP=1 --file=$file 2>(Join-Path $run ($Name+'.error.log'))
    if($LASTEXITCODE -ne 0){throw 'Table-count verification failed.'}
    return (($result -join "`n")|ConvertFrom-Json -AsHashtable)
}
if($Phase -eq 'Backup'){
    if(Test-Path -LiteralPath $manifestFile){throw 'This release backup already exists. Reuse it for the remaining phases.'}
    New-Item -ItemType Directory -Force -Path $run | Out-Null
    $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetAccessRuleProtection($true,$false)
    foreach($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))){
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    }
    Set-Acl -LiteralPath $run -AclObject $acl
    Use-Source
    if((Sql "select count(*) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and backend_type='client backend'" 'backup-connections') -ne '0'){throw 'Stop verified Hermes database clients before taking the release backup.'}
    $script:manifest=@{createdUtc=[DateTime]::UtcNow.ToString('o');sourceDatabase=$env:PGDATABASE;backupVerified=$false;rehearsalVerified=$false;migrationApplied=$false}
    $manifest.sourceTarget=Get-ReleaseTarget $PgBin
    $manifest.artifacts=Get-ReleaseArtifacts $workspace
    $manifest.before=Counts 'source-before'
    & (Join-Path $PgBin 'pg_dump.exe') --format=custom --compress=6 --lock-wait-timeout=30s --file=$archive 2>(Join-Path $run 'backup.error.log')
    if($LASTEXITCODE -ne 0){throw 'Backup failed; source database was not modified.'}
    & (Join-Path $PgBin 'pg_restore.exe') --list $archive > (Join-Path $run 'backup-toc.txt') 2>(Join-Path $run 'backup-toc.error.log')
    if($LASTEXITCODE -ne 0){throw 'Backup archive could not be read.'}
    $manifest.archiveSha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
    $manifest.archiveBytes=(Get-Item -LiteralPath $archive).Length
    Save-Manifest
    [pscustomobject]@{phase='Backup';archive=$archive;bytes=$manifest.archiveBytes;sha256=$manifest.archiveSha256;tables=$manifest.before.Count}|ConvertTo-Json
    exit
}
if(-not(Test-Path -LiteralPath $manifestFile)){throw 'Run Backup first.'}
$script:manifest=Get-Content -LiteralPath $manifestFile -Raw|ConvertFrom-Json -AsHashtable
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $manifest.archiveSha256){throw 'Backup archive checksum changed.'}
if($Phase -eq 'Rehearse'){
    Assert-ReleaseArtifacts $workspace $manifest.artifacts
    if((Test-Path -LiteralPath $cluster) -and -not $ResumeRehearsal){throw 'Rehearsal cluster already exists; inspect its private logs before retrying.'}
    if(Get-NetTCPConnection -State Listen -LocalPort $RehearsalPort -ErrorAction SilentlyContinue){throw 'Rehearsal port is already occupied.'}
    if(-not $ResumeRehearsal){
    $password=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36))
    $password|ConvertTo-SecureString -AsPlainText -Force|Export-Clixml -LiteralPath (Join-Path $run 'rehearsal-password.clixml')
    $passwordFile=Join-Path $run 'initdb-password.tmp'
    [IO.File]::WriteAllText($passwordFile,$password,[Text.UTF8Encoding]::new($false))
    try { & (Join-Path $PgBin 'initdb.exe') -D $cluster --username=hermes_release_check --auth-host=scram-sha-256 --auth-local=scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C > (Join-Path $run 'initdb.log') 2>&1 }
    finally { Remove-Item -LiteralPath $passwordFile }
    if($LASTEXITCODE -ne 0){throw 'Private rehearsal PostgreSQL initialization failed.'}
    }
    # A separate hidden console avoids inheriting a PowerShell output pipe into the server.
    $start=Start-Process -FilePath (Join-Path $PgBin 'pg_ctl.exe') -ArgumentList @('-D',$cluster,'-l',(Join-Path $run 'rehearsal-postgres.log'),'-o',"`"-h 127.0.0.1 -p $RehearsalPort`"",'-w','-t','60','start') -WindowStyle Hidden -PassThru
    if(-not $start.WaitForExit(60000) -or $start.ExitCode -ne 0){throw 'Rehearsal PostgreSQL could not start.'}
    Use-Rehearsal;$env:PGDATABASE='postgres'
    Sql 'create database hermes' 'create-rehearsal'|Out-Null
    Sql 'revoke all on database hermes from public' 'restrict-rehearsal'|Out-Null
    $env:PGDATABASE='hermes'
    & (Join-Path $PgBin 'pg_restore.exe') --exit-on-error --single-transaction --no-owner --no-privileges --dbname=hermes $archive > (Join-Path $run 'restore.log') 2>&1
    if($LASTEXITCODE -ne 0){throw 'Full backup restore failed; source is unchanged.'}
    $restored=Counts 'restored'
    foreach($table in $manifest.before.Keys){if($restored[$table] -ne $manifest.before[$table]){throw "Restored count differs for $table"}}
    if($restored.Count -ne $manifest.before.Count){throw 'Restored table inventory differs.'}
    $manifest.backupVerified=$true;$manifest.restoredCounts=$restored
    & (Join-Path $PSScriptRoot 'migrate-postgres.ps1') -BackupAndStagingVerified
    if($LASTEXITCODE -ne 0){throw 'Rehearsal migration failed.'}
    $manifest.rehearsalMigrated=$true;$manifest.rehearsalPort=$RehearsalPort
    Save-Manifest
    [pscustomobject]@{phase='Rehearse';fullRestoreVerified=$true;verifiedTables=$restored.Count;releaseMigrationAppliedToCopy=$true;port=$RehearsalPort}|ConvertTo-Json
    exit
}
if($Phase -eq 'VerifyRehearsal'){
    Assert-ReleaseArtifacts $workspace $manifest.artifacts
    if(-not$manifest.backupVerified -or -not$manifest.rehearsalMigrated){throw 'Complete full restore and rehearsal migration first.'}
    $app=Get-Content (Join-Path $run 'Rehearsal.process.json') -Raw|ConvertFrom-Json -AsHashtable
    if(-not$app.healthy -or $app.jarSha256 -ne $manifest.artifacts['backend/target/backend-0.0.1-SNAPSHOT.jar']){throw 'Packaged rehearsal application was not verified.'}
    $listener=Get-NetTCPConnection -State Listen -LocalPort $app.port -ErrorAction Stop
    if($listener.OwningProcess -ne $app.pid){throw 'Rehearsal listener no longer matches verified process.'}
    $http=Get-Content (Join-Path $run 'rehearsal-http-verification.json') -Raw|ConvertFrom-Json -AsHashtable
    if($http.checks.Count -ne 8 -or $http.jarSha256 -ne $app.jarSha256){throw 'Verify all athlete, coaching and team HTTP workflows on this artifact first.'}
    Use-Rehearsal
    & (Join-Path $PgBin 'psql.exe') -X -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'verify-release-postgres.sql') > (Join-Path $run 'rehearsal-invariants.log') 2>&1
    if($LASTEXITCODE -ne 0){throw 'Rehearsal database invariant verification failed.'}
    $manifest.rehearsalVerified=$true;$manifest.rehearsalVerifiedUtc=[DateTime]::UtcNow.ToString('o');Save-Manifest
    'Full restore, packaged application, schema validation, database invariants and eight HTTP workflow checks verified.'
    exit
}
if($Phase -eq 'Migrate'){
    if(-not $manifest.backupVerified -or -not $manifest.rehearsalVerified){throw 'Verified full restore and application rehearsal are required before source migration.'}
    Use-Source
    Assert-ReleaseArtifacts $workspace $manifest.artifacts
    Assert-ReleaseTarget $PgBin $manifest.sourceTarget
    if((Sql "select count(*) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and backend_type='client backend'" 'migration-connections') -ne '0'){throw 'Database clients reconnected after backup; stop verified clients before release DDL.'}
    $now=Counts 'source-pre-migration'
    foreach($table in $manifest.before.Keys){if($now[$table] -ne $manifest.before[$table]){throw "Source changed after backup: $table. Take a new consistent backup."}}
    & (Join-Path $PSScriptRoot 'migrate-postgres.ps1') -BackupAndStagingVerified
    if($LASTEXITCODE -ne 0){throw 'Source release migration failed; its transaction was rolled back.'}
    $after=Counts 'source-after-migration'
    foreach($table in $manifest.before.Keys){if($after[$table] -ne $manifest.before[$table]){throw "Source row count changed unexpectedly: $table"}}
    $manifest.migrationApplied=$true;$manifest.migratedUtc=[DateTime]::UtcNow.ToString('o');Save-Manifest
    [pscustomobject]@{phase='Migrate';originalTableCountsPreserved=$true;migrationApplied=$true}|ConvertTo-Json
    exit
}
if($Phase -eq 'StopRehearsal'){
    & (Join-Path $PgBin 'pg_ctl.exe') -D $cluster -m fast -w stop > (Join-Path $run 'rehearsal-stop.log') 2>&1
    if($LASTEXITCODE -ne 0){throw 'Rehearsal server did not stop cleanly.'}
    $manifest.rehearsalStopped=$true;Save-Manifest
    'Rehearsal server stopped. Verified archive and private restored copy retained.'
}

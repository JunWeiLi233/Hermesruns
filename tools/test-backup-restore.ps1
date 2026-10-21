param(
    [Parameter(Mandatory=$true)][string]$BackupFile,
    [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin'
)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$backup = (Resolve-Path -LiteralPath $BackupFile).Path
if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw 'Backup must be a regular archive file.' }
foreach ($tool in @('pg_restore.exe','pg_dump.exe','initdb.exe','pg_ctl.exe','psql.exe','createdb.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PgBin $tool))) { throw "Missing PostgreSQL tool: $tool" }
}
# Always initialize a new private cluster. There is deliberately no destination connection argument.
$privateRoot = [IO.Path]::GetFullPath((Join-Path $workspace '.private-backups'))
$drillRoot = Join-Path $privateRoot ('restore-drill-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss') + '-' + [guid]::NewGuid().ToString('N'))
if (-not ([IO.Path]::GetFullPath($drillRoot)).StartsWith($privateRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid private drill path.' }
if (Test-Path -LiteralPath $drillRoot) { throw 'Drill directory must be new.' }
$null = New-Item -ItemType Directory -Path $drillRoot
$cluster = Join-Path $drillRoot 'cluster'
$probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$probe.Start(); $port = $probe.LocalEndpoint.Port; $probe.Stop()
$connection = @('-h','127.0.0.1','-p',[string]$port,'-U','hardening_restore')
$savedPassword = $env:PGPASSWORD
$started = $false
$startupAttempted = $false
$process = $null
$timer = [Diagnostics.Stopwatch]::StartNew()
function Invoke-DrillTool([string]$Name, [string[]]$Arguments, [string]$Log) {
    & (Join-Path $PgBin ($Name + '.exe')) @Arguments *> (Join-Path $drillRoot $Log)
    if ($LASTEXITCODE -ne 0) { throw "$Name failed; inspect the private drill logs." }
}
try {
    $env:PGPASSWORD = $null
    Invoke-DrillTool 'pg_restore' @('--list',$backup) 'archive-catalog.log'
    Invoke-DrillTool 'initdb' @('-D',$cluster,'-U','hardening_restore','--auth=trust','--encoding=UTF8','--no-locale') 'initdb.log'
    $startArgs = @('-D',('"'+$cluster+'"'),'-l',('"'+(Join-Path $drillRoot 'postgres.log')+'"'),'-o',('"-p '+$port+' -h 127.0.0.1 -c max_connections=10"'),'-w','start')
    $startupAttempted = $true
    $process = Start-Process -FilePath (Join-Path $PgBin 'pg_ctl.exe') -ArgumentList $startArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $drillRoot 'start.log') -RedirectStandardError (Join-Path $drillRoot 'start-error.log')
    # Start-Process -Wait waits for the entire Windows process tree, including the
    # long-lived database server. Wait only for pg_ctl's own startup confirmation.
    if (-not $process.WaitForExit(60000)) { throw 'Disposable PostgreSQL startup timed out.' }
    if ($process.ExitCode -ne 0) { throw 'Disposable PostgreSQL failed to start.' }
    $started = $true
    Invoke-DrillTool 'createdb' ($connection + @('restore_a')) 'createdb-a.log'
    Invoke-DrillTool 'createdb' ($connection + @('restore_b')) 'createdb-b.log'
    Invoke-DrillTool 'pg_restore' ($connection + @('-d','restore_a','--no-owner','--no-privileges','--exit-on-error',$backup)) 'restore-a.log'
    $fingerprintSql = @'
BEGIN READ ONLY;
SELECT format('SELECT %L, count(*), md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM %I.%I t;', schemaname||'.'||tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' ORDER BY schemaname, tablename
\gexec
SELECT 'sequence:'||schemaname||'.'||sequencename, COALESCE(last_value::text,'NULL') FROM pg_sequences WHERE schemaname NOT LIKE 'pg_%' ORDER BY schemaname, sequencename;
COMMIT;
'@
    $sqlPath = Join-Path $drillRoot 'fingerprint.sql'
    [IO.File]::WriteAllText($sqlPath, $fingerprintSql, [Text.UTF8Encoding]::new($false))
    Invoke-DrillTool 'psql' ($connection + @('-d','restore_a','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-f',$sqlPath)) 'fingerprint-a.txt'
    # A second archive and restore checks that table contents and sequence values survive a full round trip.
    $roundTrip = Join-Path $drillRoot 'round-trip.dump'
    Invoke-DrillTool 'pg_dump' ($connection + @('-d','restore_a','-Fc','-f',$roundTrip)) 'round-trip-dump.log'
    Invoke-DrillTool 'pg_restore' ($connection + @('-d','restore_b','--no-owner','--no-privileges','--exit-on-error',$roundTrip)) 'restore-b.log'
    Invoke-DrillTool 'psql' ($connection + @('-d','restore_b','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-f',$sqlPath)) 'fingerprint-b.txt'
    if ((Get-FileHash -LiteralPath (Join-Path $drillRoot 'fingerprint-a.txt')).Hash -ne (Get-FileHash -LiteralPath (Join-Path $drillRoot 'fingerprint-b.txt')).Hash) { throw 'Restored table or sequence fingerprint changed during round trip.' }
    $rows = @(Get-Content -LiteralPath (Join-Path $drillRoot 'fingerprint-a.txt') | Where-Object { $_ -match '^[^|]+\|\d+\|[0-9a-f]{32}$' })
    if ($rows.Count -eq 0) { throw 'Archive restored no user tables.' }
    foreach ($required in @('public.runner','public.activities')) {
        if (-not ($rows | Where-Object { $_.StartsWith($required + '|') })) { throw "Archive is missing required table $required" }
    }
    $report = [ordered]@{ passed=$true; atUtc=[DateTime]::UtcNow.ToString('o'); backupSha256=(Get-FileHash -LiteralPath $backup).Hash; backupBytes=(Get-Item -LiteralPath $backup).Length; tables=$rows.Count; rows=[long](($rows | ForEach-Object { [long]($_.Split('|')[1]) } | Measure-Object -Sum).Sum); tableAndSequenceRoundTripMatches=$true; durationSeconds=[Math]::Round($timer.Elapsed.TotalSeconds,2); liveDatabaseChanged=$false }
    $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $drillRoot 'result.json')
    $report | ConvertTo-Json
} finally {
    # Stop only our launcher and our freshly initialized private cluster, even if
    # startup timed out after the server had already been spawned.
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
    }
    if (($started -or $startupAttempted) -and (Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid'))) {
        & (Join-Path $PgBin 'pg_ctl.exe') -D $cluster -m fast -w stop *> (Join-Path $drillRoot 'stop.log')
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Disposable cluster could not stop; inspect its private logs.' }
    }
    $env:PGPASSWORD = $savedPassword
}

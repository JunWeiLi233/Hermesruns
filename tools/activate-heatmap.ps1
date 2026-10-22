param()
. (Join-Path $PSScriptRoot 'heatmap-release-common.ps1')
$candidate=Get-HeatmapCandidate
$root=$candidate.releaseRoot
$pinPath=Join-Path $HeatmapWorkspace 'backend/reviewed-release.json'
$current=Get-Content $pinPath -Raw | ConvertFrom-Json
$next=Get-Content $candidate.candidatePinPath -Raw | ConvertFrom-Json
$verification=Get-Content (Join-Path $root 'verification.json') -Raw | ConvertFrom-Json
if(-not$verification.passed -or $verification.jarSha256 -ne $candidate.jarSha256 -or $verification.previousJarSha256 -ne $current.jarSha256 -or -not$verification.restoredDataPreserved){throw 'This exact candidate must pass a full restored-data verification first'}
if((Get-FileHash (Join-Path $root 'verification-snapshot.dump')).Hash -ne $verification.backupSha256){throw 'Verified restore backup changed'}
& (Join-Path $PSScriptRoot 'assert-analysis-release.ps1') -JarPath $candidate.jarPath
$migration=Get-HeatmapMigration $candidate
$runtime=Assert-HeatmapRuntime $current
$connection=Get-HeatmapLiveConnection $current
$oldPgPassword=$env:PGPASSWORD
$backup=Join-Path $root 'before-activation.dump'
$previousPin=Join-Path $root 'before-activation-release.json'
$previousRuntime=Join-Path $root 'before-activation-runtime.json'
$stopped=$false;$activated=$false
try {
 $env:PGPASSWORD=$env:APP_DB_PASSWORD
 $permissionSql="SELECT has_database_privilege(current_user,current_database(),'CREATE') AND pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='public.activities'::regclass),'USAGE');"
 $permissions=& (Join-Path $HeatmapPgBin 'psql.exe') @connection -X -q -t -A -v ON_ERROR_STOP=1 -c $permissionSql 2> (Join-Path $root 'activation-permissions-error.log')
 if($LASTEXITCODE -or (($permissions | Out-String).Trim() -ne 't')){throw 'Reviewed database account cannot apply the additive migration'}
 Copy-Item -LiteralPath $pinPath -Destination $previousPin
 Copy-Item -LiteralPath (Join-Path $env:USERPROFILE '.hermes/runtime.json') -Destination $previousRuntime
 # Recheck immediately before stopping only the verified, owned Java process.
 $runtime=Assert-HeatmapRuntime $current
 Stop-Process -Id $runtime.pid -ErrorAction Stop
 $stopped=$true
 Wait-Process -Id $runtime.pid -Timeout 15 -ErrorAction SilentlyContinue
 if(@(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue).Count){throw 'Port 8080 did not become free'}
 Write-Output '[Hermes] Verified backend stopped; taking the final consistent backup.'
 & (Join-Path $HeatmapPgBin 'pg_dump.exe') @connection -Fc -f $backup *> (Join-Path $root 'activation-backup.log')
 if($LASTEXITCODE){throw 'Final backup failed; migration was not attempted'}
 & (Join-Path $HeatmapPgBin 'pg_restore.exe') --list $backup *> (Join-Path $root 'activation-backup-catalog.txt')
 if($LASTEXITCODE){throw 'Final backup catalog validation failed'}
 Write-HeatmapFingerprint $connection (Join-Path $root 'live-before.tsv')
 Invoke-HeatmapMigration $env:APP_DB_URL $env:APP_DB_USERNAME $env:APP_DB_PASSWORD (Join-Path $root 'activation-migration.log') $migration
 Write-HeatmapFingerprint $connection (Join-Path $root 'live-after.tsv')
 Assert-HeatmapFingerprint (Join-Path $root 'live-before.tsv') (Join-Path $root 'live-after.tsv')
 $tables=& (Join-Path $HeatmapPgBin 'psql.exe') @connection -X -q -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='statshunters' AND table_type='BASE TABLE';" 2> (Join-Path $root 'activation-schema-error.log')
 if($LASTEXITCODE -or (($tables | Out-String).Trim() -ne '8')){throw 'Heatmap schema is incomplete'}
 $next.backupSha256=(Get-FileHash $backup).Hash
 $next | ConvertTo-Json -Depth 12 | Set-Content $candidate.candidatePinPath
 Copy-Item -LiteralPath $candidate.candidatePinPath -Destination $pinPath
 Write-Output '[Hermes] Additive migration validated; all existing data fingerprints match. Starting the reviewed heatmap release.'
 & (Join-Path $PSScriptRoot 'run-reviewed-release.ps1')
 if($LASTEXITCODE){throw 'Reviewed heatmap launcher failed'}
 $live=Assert-HeatmapRuntime $next
 if(-not$live.healthy -or -not$live.heatmapEnabled){throw 'Heatmap activation is not reflected in the healthy runtime'}
 $routes=@()
 foreach($path in @('/heatmap','/heatmap/statistics','/heatmap/recorded','/heatmap/privacy','/runs','/analysis','/schedule')){
  $response=Invoke-WebRequest ('http://127.0.0.1:8080'+$path) -UseBasicParsing -TimeoutSec 15
  if($response.StatusCode -ne 200){throw ('Live SPA route failed: '+$path)}
  $routes+=@{path=$path;status=200}
 }
 $result=[ordered]@{status='activated';atUtc=[DateTime]::UtcNow.ToString('o');projectRoot=$HeatmapWorkspace;url='http://localhost:8080/heatmap';pid=$live.pid;jarSha256=$next.jarSha256;previousJarSha256=$current.jarSha256;backupPath=$backup;backupSha256=$next.backupSha256;restoredBackupVerified=$true;existingDataPreserved=$true;existingDataFingerprintSha256=(Get-FileHash (Join-Path $root 'live-before.tsv')).Hash;fingerprintEntries=@(Get-Content (Join-Path $root 'live-before.tsv')).Count;existingTableEntries=@(Get-Content (Join-Path $root 'live-before.tsv') | Where-Object{$_ -and $_ -notlike 'sequence:*'}).Count;heatmapTables=8;ddlMode='validate';routes=$routes;rollbackPin=$previousPin;databaseRollbackPolicy='Additive schema is retained; rollback uses the prior JAR and does not overwrite user data';browserVerification='pending'}
 $result | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root 'activation.json')
 $result | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $HeatmapWorkspace 'replica/statshunters/validation/heatmap-activation.json')
 $activated=$true
 $result | ConvertTo-Json -Depth 8
} catch {
 $failure=$_
 ($failure | Out-String) | Set-Content (Join-Path $root 'activation-failure.log')
 if($stopped -and -not$activated){
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue)
  foreach($listener in $listeners){
   $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess)
   if($process.Name -eq 'java.exe' -and $process.CommandLine.Contains([string]$next.jarPath)){Stop-Process -Id $listener.OwningProcess;Wait-Process -Id $listener.OwningProcess -Timeout 15 -ErrorAction SilentlyContinue}
   else {throw 'Port ownership changed during activation; preserved artifacts and logs require review'}
  }
  Copy-Item -LiteralPath $previousPin -Destination $pinPath
  & (Join-Path $PSScriptRoot 'run-reviewed-release.ps1')
  if($LASTEXITCODE){throw 'Activation failed and the prior release did not restart; inspect protected recovery logs'}
  throw 'Heatmap activation failed; the previous release was restarted. No backup was restored over user data. Inspect protected activation-failure.log.'
 }
 throw $failure
} finally {$env:PGPASSWORD=$oldPgPassword}

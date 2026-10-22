param()
. (Join-Path $PSScriptRoot 'heatmap-release-common.ps1')
$candidate=Get-HeatmapCandidate
$root=$candidate.releaseRoot
$migration=Get-HeatmapMigration $candidate
$pin=Get-Content (Join-Path $HeatmapWorkspace 'backend/reviewed-release.json') -Raw | ConvertFrom-Json
$null=Assert-HeatmapRuntime $pin
$live=Get-HeatmapLiveConnection $pin
$backup=Join-Path $root 'verification-snapshot.dump'
$oldPgPassword=$env:PGPASSWORD
$cluster=Join-Path $root ('verification-postgres-'+[guid]::NewGuid().ToString('N'))
$started=$false;$appProcess=$null
$probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$probe.Start();$pgPort=$probe.LocalEndpoint.Port;$probe.Stop()
$probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$probe.Start();$appPort=$probe.LocalEndpoint.Port;$probe.Stop()
try {
 $env:PGPASSWORD=$env:APP_DB_PASSWORD
 & (Join-Path $HeatmapPgBin 'pg_dump.exe') @live -Fc -f $backup *> (Join-Path $root 'verification-dump.log')
 if($LASTEXITCODE){throw 'Backup failed; live database and release were not changed'}
 & (Join-Path $HeatmapPgBin 'pg_restore.exe') --list $backup *> (Join-Path $root 'verification-backup-catalog.txt')
 if($LASTEXITCODE){throw 'Backup catalog validation failed'}
 $env:PGPASSWORD=$null
 & (Join-Path $HeatmapPgBin 'initdb.exe') -D $cluster -U heatmap_restore --auth=trust --encoding=UTF8 --no-locale *> (Join-Path $root 'verification-initdb.log')
 if($LASTEXITCODE){throw 'Disposable PostgreSQL initialization failed'}
 $pgArgs=@('-D',('"'+$cluster+'"'),'-l',('"'+(Join-Path $root 'verification-postgres.log')+'"'),'-o',('"-p '+$pgPort+' -h 127.0.0.1 -c max_connections=30"'),'-w','start')
 $pgProcess=Start-Process (Join-Path $HeatmapPgBin 'pg_ctl.exe') -ArgumentList $pgArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root 'verification-pg-start.log') -RedirectStandardError (Join-Path $root 'verification-pg-start-error.log')
 if(-not$pgProcess.WaitForExit(30000) -or $pgProcess.ExitCode){throw 'Disposable PostgreSQL did not start'}
 $started=$true
 & (Join-Path $HeatmapPgBin 'createdb.exe') -h 127.0.0.1 -p $pgPort -U heatmap_restore hermes_heatmap_verify
 if($LASTEXITCODE){throw 'Disposable database creation failed'}
 $testConnection=@('-h','127.0.0.1','-p',[string]$pgPort,'-U','heatmap_restore','-d','hermes_heatmap_verify')
 & (Join-Path $HeatmapPgBin 'pg_restore.exe') @testConnection --no-owner --no-acl --exit-on-error $backup *> (Join-Path $root 'verification-restore.log')
 if($LASTEXITCODE){throw 'Full backup restore failed; live database remains unchanged'}
 Write-HeatmapFingerprint $testConnection (Join-Path $root 'restored-before.tsv')
 $jdbc="jdbc:postgresql://127.0.0.1:$pgPort/hermes_heatmap_verify"
 Invoke-HeatmapMigration $jdbc 'heatmap_restore' '' (Join-Path $root 'verification-migrate.log') $migration
 Write-HeatmapFingerprint $testConnection (Join-Path $root 'restored-after.tsv')
 Assert-HeatmapFingerprint (Join-Path $root 'restored-before.tsv') (Join-Path $root 'restored-after.tsv')
 # Only the restored test database receives a disposable session for API checks.
 $testToken=[guid]::NewGuid().ToString()
 $digest=[Security.Cryptography.SHA256]::Create()
 try {$testTokenHash=([BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($testToken)))).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}
 $sessionSql="UPDATE public.runner SET session_token='$testTokenHash',token_issued_at=localtimestamp WHERE id=(SELECT id FROM public.runner WHERE deleted=false AND role='USER' ORDER BY id LIMIT 1);"
 & (Join-Path $HeatmapPgBin 'psql.exe') @testConnection -X -v ON_ERROR_STOP=1 -c $sessionSql *> (Join-Path $root 'verification-test-session.log')
 if($LASTEXITCODE){throw 'Restored-only API session setup failed'}
 $env:SPRING_APPLICATION_JSON=$null;$env:JAVA_TOOL_OPTIONS=$null;$env:JDK_JAVA_OPTIONS=$null;$env:_JAVA_OPTIONS=$null
 $env:SPRING_DATASOURCE_URL=$jdbc;$env:SPRING_DATASOURCE_USERNAME='heatmap_restore';$env:SPRING_DATASOURCE_PASSWORD='';$env:SPRING_DATASOURCE_DRIVER_CLASS_NAME='org.postgresql.Driver'
 $env:APP_BOOTSTRAP_ADMIN_EMAIL=$null;$env:APP_BOOTSTRAP_ADMIN_PASSWORD=$null
 $stdout=Join-Path $root 'verification-app.out.log';$stderr=Join-Path $root 'verification-app.error.log'
 $javaArgs=@('-Xmx768m','-Dspring.devtools.restart.enabled=false','-jar',$candidate.jarPath,'--server.address=127.0.0.1',('--server.port='+$appPort),'--spring.jpa.hibernate.ddl-auto=validate','--spring.profiles.include=explorer','--app.explorer.enabled=true','--app.explorer.cookie-secure=false','--app.explorer.public-url=http://localhost:8080/heatmap/','--app.explorer.worker-delay-ms=86400000','--app.training-workspace.enabled=true','--app.training-workspace.migrate=false','--app.training-workspace.jobs-enabled=false','--app.training.catchup-on-startup=false','--app.official-course.startup-seed.enabled=false','--app.local-shared-runner.enabled=false','--app.coach.nightly.enabled=false','--strava.sync.enabled=false','--garmin.wellness.sync.enabled=false','--app.mail.provider=disabled','--app.run-plans.experimental-ruleset=hermes-road-v4','--app.run-plans.approved-ruleset=')
 $appProcess=Start-Process (Get-Command java.exe).Source -ArgumentList $javaArgs -WorkingDirectory (Join-Path $HeatmapWorkspace 'backend') -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
 $healthy=$false;$deadline=[DateTime]::UtcNow.AddSeconds(55)
 while([DateTime]::UtcNow -lt $deadline){
  $appProcess.Refresh();if($appProcess.HasExited){throw 'Candidate exited on restored data; inspect protected logs'}
  if(Select-String -LiteralPath $stdout -Pattern 'Started BackendApplication' -SimpleMatch -Quiet){$healthy=$true;break}
  Start-Sleep -Milliseconds 400
 }
 if(-not$healthy){throw 'Candidate failed its startup deadline on restored data'}
 $origin='http://127.0.0.1:'+$appPort;$headers=@{Authorization='Bearer '+$testToken}
 $capability=Invoke-RestMethod ($origin+'/api/profile/heatmap/explorer') -Headers $headers -TimeoutSec 15
 if(-not$capability.available){throw 'Candidate heatmap is not ready'}
 $session=Invoke-RestMethod ($origin+'/api/explorer/session') -Headers $headers -TimeoutSec 15
 if(-not$session.opened){throw 'Candidate failed existing Hermes bearer authentication'}
 $checks=@()
 foreach($path in @('/heatmap','/heatmap/statistics','/heatmap/recorded','/api/explorer/activities','/api/explorer/map/summary','/api/explorer/statistics/all','/api/training/me','/api/activities/analysis','/api/activities/heatmap')){
  try {$response=Invoke-WebRequest ($origin+$path) -Headers $headers -UseBasicParsing -TimeoutSec 30}catch{throw ('Candidate route failed: '+$path+'; status '+[int]$_.Exception.Response.StatusCode)}
  if($response.StatusCode -ne 200){throw ('Candidate route failed: '+$path)}
  $checks+=@{path=$path;status=200}
 }
 $verification=[ordered]@{passed=$true;jarSha256=$candidate.jarSha256;previousJarSha256=$candidate.baseJarSha256;backupSha256=(Get-FileHash $backup).Hash;restoredDataPreserved=$true;existingFingerprintSha256=(Get-FileHash (Join-Path $root 'restored-before.tsv')).Hash;migrationApplyAndValidate='passed';checks=$checks;liveDatabaseChanged=$false;atUtc=[DateTime]::UtcNow.ToString('o')}
 $verification | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'verification.json')
 $verification | ConvertTo-Json -Depth 6
} finally {
 if($appProcess){$appProcess.Refresh();if(-not$appProcess.HasExited){Stop-Process -Id $appProcess.Id -ErrorAction SilentlyContinue}}
 if($started){
  & (Join-Path $HeatmapPgBin 'pg_ctl.exe') -D $cluster -m fast -w stop *> (Join-Path $root 'verification-pg-stop.log')
  if($LASTEXITCODE -eq 0){
   $resolvedCluster=[IO.Path]::GetFullPath($cluster)
   $resolvedRoot=[IO.Path]::GetFullPath($root).TrimEnd('\')+'\'
   if(-not$resolvedCluster.StartsWith($resolvedRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedCluster) -notmatch '^verification-postgres-[0-9a-f]{32}$'){throw 'Refusing cleanup outside the private verification directory'}
   Remove-Item -LiteralPath $resolvedCluster -Recurse -Force
  }
 }
 $env:PGPASSWORD=$oldPgPassword
}

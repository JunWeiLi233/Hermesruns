param([ValidateRange(0,20)][int]$GeometryZoom=14)
. (Join-Path $PSScriptRoot 'heatmap-release-common.ps1')
function Invoke-HeatmapVerificationRead {
 param([Parameter(Position=0)][string]$Uri,[hashtable]$Headers,[string]$Method='Get',[string]$ContentType,[string]$Body,[int]$TimeoutSec=30)
 # Match the client's bounded cooldown retry for read-only map requests.
 for($attempt=0;;$attempt++){
  try {return Invoke-RestMethod @PSBoundParameters} catch {
   if($attempt -ge 1 -or [int]$_.Exception.Response.StatusCode -ne 429){throw}
   Write-Output '[Hermes] Read cooldown; waiting for the server rate window.' | Out-Host
   Start-Sleep -Seconds 60
  }
 }
}
$candidate=Get-Content (Join-Path $HeatmapWorkspace 'replica/statshunters/validation/workout-map-candidate.json') -Raw | ConvertFrom-Json
if((Get-FileHash $candidate.jarPath).Hash -ne $candidate.jarSha256){throw 'Candidate changed'}
$root=$candidate.releaseRoot

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
  if((Test-Path $stdout) -and (Select-String -LiteralPath $stdout -Pattern 'Started BackendApplication' -SimpleMatch -Quiet)){$healthy=$true;break}
  Start-Sleep -Milliseconds 400
 }
 if(-not$healthy){throw 'Candidate failed its startup deadline on restored data'}
 $origin='http://127.0.0.1:'+$appPort;$headers=@{Authorization='Bearer '+$testToken}
 Write-HeatmapFingerprint $testConnection (Join-Path $root 'api-before.tsv')
 $watch=[Diagnostics.Stopwatch]::StartNew()
 $allGeometryWatch=[Diagnostics.Stopwatch]::StartNew()
 $queryBody=@{filter=@{sport='RUN'};zoom=$GeometryZoom}|ConvertTo-Json -Compress
 $first=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/query') -Method Post -Headers $headers -ContentType 'application/json' -Body $queryBody -TimeoutSec 90
 $coldMs=$watch.ElapsedMilliseconds
 if(-not $first.snapshot -or -not $first.summary -or $first.summary.activityCount -lt 1){throw 'Recorded map query did not return the existing history'}
 $ids=[Collections.Generic.HashSet[long]]::new();$page=$first;$pages=0;$maxBytes=0;$geometryVertices=0
 do {
  foreach($part in $page.segments){$null=$ids.Add([long]$part.activityId);$geometryVertices+=@($part.coordinates).Count}
  $bytes=[Text.Encoding]::UTF8.GetByteCount(($page | ConvertTo-Json -Depth 20 -Compress));$maxBytes=[Math]::Max($maxBytes,$bytes)
  if($bytes -gt 524288){throw 'Geometry response exceeded budget'}
  $pages++
  if(-not $page.nextCursor){break}
  if($pages -gt 250){throw 'Map pagination did not complete'}
  $body=@{filter=@{sport='RUN'};zoom=$GeometryZoom;snapshot=$first.snapshot;cursor=$page.nextCursor}|ConvertTo-Json -Compress
  $page=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/query') -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 45
 } while($true)
 if(-not $page.complete -or $ids.Count -ne $first.summary.gpsActivityCount){throw 'Complete GPS selection did not survive pagination'}
 $allGeometryMs=$allGeometryWatch.ElapsedMilliseconds
 Write-Output ('[Hermes] Full geometry: '+$ids.Count+' routes, '+$pages+' pages, '+$geometryVertices+' vertices, '+$allGeometryMs+' ms.')
 $list=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/query') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{filter=@{sport='RUN'};limit=100;snapshot=$first.snapshot}|ConvertTo-Json) -TimeoutSec 20
 $activity=$list.items[0].id
 $lookupBody=@{filter=@{sport='RUN'};snapshot=$first.snapshot;ids=@([string]$activity)}|ConvertTo-Json -Depth 5 -Compress
 $lookup=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/query') -Method Post -Headers $headers -ContentType 'application/json' -Body $lookupBody -TimeoutSec 20
 if(@($lookup.items).Count -ne 1 -or $lookup.items[0].id -ne $activity -or $lookup.snapshot -ne $first.snapshot -or -not($lookup.items[0].PSObject.Properties.Name -contains 'device')){throw 'Recorded source metadata lookup failed'}
 $metricBody=@{filter=@{sport='RUN';minAscentM=0;minHeartRate=0};zoom=$GeometryZoom;snapshot=$first.snapshot}|ConvertTo-Json -Depth 5 -Compress
 $metricQuery=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/query') -Method Post -Headers $headers -ContentType 'application/json' -Body $metricBody -TimeoutSec 30
 if($metricQuery.summary.activityCount -gt $first.summary.activityCount){throw 'Advanced metric selection exceeded owner scope'}
 $detail=Invoke-HeatmapVerificationRead ($origin+'/api/activities?id='+$activity) -Headers $headers -TimeoutSec 20
 if($detail.id -ne $activity){throw 'Wrong workout detail'}
 $track=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/'+$activity+'/track?snapshot='+[Uri]::EscapeDataString($first.snapshot)) -Headers $headers -TimeoutSec 30
 $watch.Restart()
 $coverage=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/'+$activity+'/tiles?snapshot='+[Uri]::EscapeDataString($first.snapshot)) -Headers $headers -TimeoutSec 90
 $coverageColdMs=$watch.ElapsedMilliseconds
 if($coverage.tileZoom -ne 14 -or $coverage.snapshot -ne $first.snapshot -or $coverage.quality.basis -ne 'retained-history'){throw 'Stored-route coverage contract failed'}
 $allWorkouts=@($list.items);$listPage=$list
 while($listPage.nextCursor){$listPage=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/query') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{filter=@{sport='RUN'};limit=100;snapshot=$first.snapshot;cursor=$listPage.nextCursor}|ConvertTo-Json) -TimeoutSec 20;$allWorkouts+=@($listPage.items)}
 $novel=$null;$novelWorkout=$null
 foreach($run in @($allWorkouts | Select-Object -Last 12 | Sort-Object startInstant,id)){
  $value=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/'+$run.id+'/tiles?snapshot='+[Uri]::EscapeDataString($first.snapshot)) -Headers $headers -TimeoutSec 30
  if($value.newTileCount -gt 0){$novel=$value;$novelWorkout=$run;break}
 }
 if(-not$novel){throw 'No retained first-visit workout was verified in the restored history'}
 $cellCount=@($novel.cells).Count;$tilePage=$novel
 while($tilePage.nextCursor){$tilePage=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/'+$novelWorkout.id+'/tiles?snapshot='+[Uri]::EscapeDataString($first.snapshot)+'&cursor='+[Uri]::EscapeDataString($tilePage.nextCursor)) -Headers $headers -TimeoutSec 30;$cellCount+=@($tilePage.cells).Count}
 if(-not$tilePage.complete -or $cellCount -ne $novel.newTileCount){throw 'New-coverage pagination is incomplete'}
 $sourceAudit=$null
 $auditMatches=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/query') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{filter=@{from='2026-10-08';to='2026-10-08';sport='RUN'};snapshot=$first.snapshot}|ConvertTo-Json) -TimeoutSec 20
 if(@($auditMatches.items).Count -eq 1){
  $auditId=[long]$auditMatches.items[0].id
  $auditCoverage=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/'+$auditId+'/tiles?snapshot='+[Uri]::EscapeDataString($first.snapshot)) -Headers $headers -TimeoutSec 30
  $rawFile=Join-Path $root 'retained-source-audit.json'
  $auditSql="BEGIN READ ONLY; SELECT json_build_object('points',(SELECT json_agg(json_build_array(latitude,longitude) ORDER BY sequence_index) FROM public.activity_points WHERE activity_id=$auditId),'distanceKm',distance_km,'distanceMeters',distance_meters) FROM public.activities WHERE id=$auditId; COMMIT;"
  [IO.File]::WriteAllText((Join-Path $root 'retained-source-audit.sql'),$auditSql,[Text.UTF8Encoding]::new($false))
  & (Join-Path $HeatmapPgBin 'psql.exe') @testConnection -X -q -t -A -v ON_ERROR_STOP=1 -f (Join-Path $root 'retained-source-audit.sql') 2> (Join-Path $root 'retained-source-audit.error.log') | Set-Content -LiteralPath $rawFile
  if($LASTEXITCODE){throw 'Read-only restored provenance audit failed'}
  $raw=Get-Content $rawFile -Raw | ConvertFrom-Json;$pointKeys=[Collections.Generic.HashSet[string]]::new()
  foreach($point in $raw.points){$null=$pointKeys.Add(([BitConverter]::DoubleToInt64Bits([double]$point[0])).ToString()+':'+([BitConverter]::DoubleToInt64Bits([double]$point[1])).ToString())}
  $auditTrack=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/'+$auditId+'/track?snapshot='+[Uri]::EscapeDataString($first.snapshot)) -Headers $headers -TimeoutSec 30
  $retainedVertices=0;$sourceMatch=$true
  do {
   foreach($part in $auditTrack.segments){foreach($point in $part.coordinates){$retainedVertices++;if(-not$pointKeys.Contains(([BitConverter]::DoubleToInt64Bits([double]$point[0])).ToString()+':'+([BitConverter]::DoubleToInt64Bits([double]$point[1])).ToString())){$sourceMatch=$false}}}
   if(-not$auditTrack.nextCursor){break};$auditTrack=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/workouts/'+$auditId+'/track?snapshot='+[Uri]::EscapeDataString($first.snapshot)+'&cursor='+[Uri]::EscapeDataString($auditTrack.nextCursor)) -Headers $headers -TimeoutSec 30
  }while($true)
  if($auditCoverage.quality.source -eq 'canonical-points' -and -not$sourceMatch){throw 'Displayed route introduced a vertex absent from canonical GPS'}
  $sourceAudit=@{date='2026-10-08';source=$auditCoverage.quality.source;canonicalPoints=@($raw.points).Count;displayedVertices=$retainedVertices;allDisplayedVerticesFromCanonicalSource=$sourceMatch;storedKilometres=$raw.distanceKm;storedMetres=$raw.distanceMeters;displayKilometres=$auditMatches.items[0].distanceKm;sourcePointCount=$auditCoverage.quality.sourcePointCount;segmentCount=$auditCoverage.quality.segmentCount}
 }
 $preferences=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/preferences') -Headers $headers -TimeoutSec 15
 $times=@()
 1..5|ForEach-Object {$watch.Restart();$null=Invoke-HeatmapVerificationRead ($origin+'/api/profile/heatmap/query') -Method Post -Headers $headers -ContentType 'application/json' -Body $queryBody -TimeoutSec 30;$times+=$watch.ElapsedMilliseconds}
 Write-HeatmapFingerprint $testConnection (Join-Path $root 'api-after.tsv')
 Assert-HeatmapFingerprint (Join-Path $root 'api-before.tsv') (Join-Path $root 'api-after.tsv')
 # Preference writes are tested only in the disposable restored copy.
 $null=Invoke-RestMethod ($origin+'/api/profile/heatmap/preferences') -Method Patch -SkipHeaderValidation -Headers (@{Authorization=$headers.Authorization;'If-Match'=[string]$preferences.revision}) -ContentType 'application/json' -Body '{"mode":"heat","weight":2.5}' -TimeoutSec 15
 $verification=[ordered]@{passed=$true;jarSha256=$candidate.jarSha256;previousJarSha256=$candidate.baseJarSha256;backupSha256=(Get-FileHash $backup).Hash;restoredDataPreserved=$true;schemaChanged=$false;existingFingerprintSha256=(Get-FileHash (Join-Path $root 'api-before.tsv')).Hash;activityCount=$first.summary.activityCount;gpsActivities=$ids.Count;geometryZoom=$GeometryZoom;geometryPages=$pages;geometryVertices=$geometryVertices;completeGeometryMs=$allGeometryMs;maximumResponseBytes=$maxBytes;coldQueryMs=$coldMs;warmQueryMs=$times;selectedWorkoutRead=$true;boundedSummaryLookup=$true;advancedMetricSelection=$true;coverageColdMs=$coverageColdMs;coverageVerified=$true;novelWorkoutDate=$novelWorkout.date;novelWorkoutTitle=$novelWorkout.name;novelTileCount=$novel.newTileCount;novelCoveragePagesComplete=$true;retainedSourceAudit=$sourceAudit;liveDatabaseChanged=$false;atUtc=[DateTime]::UtcNow.ToString('o')}
 $verification | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'verification.json')
 $verification | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $HeatmapWorkspace 'replica/statshunters/validation/workout-map-restored.json')
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

param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$pin=Get-Content -LiteralPath (Join-Path $workspace 'backend/reviewed-release.json') -Raw|ConvertFrom-Json
$privateRoot=[IO.Path]::GetFullPath((Join-Path $workspace '.private-backups'))+'\'
foreach($path in @($pin.jarPath,$pin.manifestPath)){
 if(-not[IO.Path]::GetFullPath($path).StartsWith($privateRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Reviewed artifacts must stay in the protected workspace directory'}
}
if($pin.projectRoot -ne $workspace -or $pin.mode -ne 'EXPERIMENTAL' -or $pin.rules -ne 'hermes-road-v4'){throw 'Unsupported reviewed release configuration'}
if((Get-FileHash -LiteralPath $pin.jarPath).Hash -ne $pin.jarSha256 -or (Get-FileHash -LiteralPath $pin.manifestPath).Hash -ne $pin.manifestSha256){throw 'Reviewed release artifact or manifest changed'}
& (Join-Path $PSScriptRoot 'assert-analysis-release.ps1') -JarPath $pin.jarPath
$manifest=Get-Content -LiteralPath $pin.manifestPath -Raw|ConvertFrom-Json
if($manifest.jarSha256 -ne $pin.jarSha256){throw 'Reviewed manifest does not identify this artifact'}
$heatmapEnabled=$pin.heatmap -and $pin.heatmap.enabled -eq $true
if($heatmapEnabled){
 $heatmapUrl=[Uri]$pin.heatmap.publicUrl
 if(-not$heatmapUrl.IsLoopback -or $heatmapUrl.AbsolutePath -ne '/heatmap/' -or $pin.heatmap.migration -ne 'V001__explorer_r0_r1.sql'){throw 'Unsupported reviewed local heatmap configuration'}
}
. (Join-Path $workspace 'Hermes.local.env.ps1') *> $null
$uri=[Uri]($env:APP_DB_URL -replace '^jdbc:','')
if($uri.Scheme -ne 'postgresql' -or -not$uri.IsLoopback){throw 'Reviewed local release requires local PostgreSQL'}
if($env:APP_RUN_PLANS_APPROVED_RULESET){throw 'Qualified approval setting changed; update the reviewed release deliberately'}
$databasePort=if($uri.Port -gt 0){$uri.Port}else{5432}
if($uri.DnsSafeHost -ne $pin.databaseHost -or $databasePort -ne $pin.databasePort -or $uri.AbsolutePath.Trim('/') -ne $pin.databaseName){throw 'Reviewed database target changed'}
Get-Command Get-NetTCPConnection,Get-CimInstance,Get-FileHash -ErrorAction Stop|Out-Null
$java=Get-Command java.exe -ErrorAction Stop
# Java writes its successful version output to stderr. Windows PowerShell 5.1
# otherwise treats that redirected output as a terminating error under Stop.
$previousErrorPreference=$ErrorActionPreference
try {
 $ErrorActionPreference='Continue'
 $javaVersion=(& $java.Source -version 2>&1|Out-String)
 $javaExitCode=$LASTEXITCODE
} finally {$ErrorActionPreference=$previousErrorPreference}
if($javaExitCode -ne 0 -or $javaVersion -notmatch 'version "(\d+)' -or [int]$Matches[1] -lt 17){throw 'Reviewed release requires Java 17 or newer'}
if($CheckOnly){Write-Output '[Hermes] Reviewed release, configuration and Java verified.';exit 0}
$marker=Join-Path $env:USERPROFILE '.hermes/runtime.json'
$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq 8080)
if($listeners.Count){
 $running=Get-Content -LiteralPath $marker -Raw|ConvertFrom-Json
 $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$running.pid)
 if($listeners.Count -eq 1 -and $listeners[0].OwningProcess -eq $running.pid -and $running.projectRoot -eq $workspace -and $running.jarSha256 -eq $pin.jarSha256 -and $process.Name -eq 'java.exe' -and $process.CommandLine.Contains([string]$pin.jarPath)){
  Write-Output '[Hermes] Reviewed release is already serving port 8080.';exit 0
 }
 throw 'Port 8080 belongs to another process or release; verify ownership before stopping it'
}
$env:SPRING_APPLICATION_JSON=$null;$env:JAVA_TOOL_OPTIONS=$null;$env:JDK_JAVA_OPTIONS=$null;$env:_JAVA_OPTIONS=$null
$env:SPRING_DATASOURCE_URL=$env:APP_DB_URL;$env:SPRING_DATASOURCE_USERNAME=$env:APP_DB_USERNAME;$env:SPRING_DATASOURCE_PASSWORD=$env:APP_DB_PASSWORD;$env:SPRING_DATASOURCE_DRIVER_CLASS_NAME='org.postgresql.Driver';$env:SPRING_JPA_HIBERNATE_DDL_AUTO='validate'
$directory=Split-Path -Parent $pin.jarPath;$name='restart-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$stdout=Join-Path $directory ($name+'.out.log');$stderr=Join-Path $directory ($name+'.error.log')
$arguments=@('-Xmx768m','-Dspring.devtools.restart.enabled=false','-jar',$pin.jarPath,'--server.address=127.0.0.1','--server.port=8080','--spring.jpa.hibernate.ddl-auto=validate','--app.training-workspace.enabled=true','--app.training-workspace.migrate=false','--app.training-workspace.jobs-enabled=true','--app.official-course.startup-seed.enabled=false','--app.local-shared-runner.enabled=false','--app.local-shared-runner.seed-mock-data=false','--app.training.catchup-on-startup=false','--app.run-plans.experimental-ruleset=hermes-road-v4','--app.run-plans.approved-ruleset=')
if($heatmapEnabled){
 $arguments+=@('--spring.profiles.include=explorer','--app.explorer.enabled=true',('--app.explorer.cookie-secure='+([string][bool]$pin.heatmap.cookieSecure).ToLowerInvariant()),('--app.explorer.public-url='+$pin.heatmap.publicUrl))
}
$process=Start-Process -FilePath (Get-Command java.exe).Source -ArgumentList $arguments -WorkingDirectory (Join-Path $workspace 'backend') -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$healthy=$false;$deadline=[DateTime]::UtcNow.AddSeconds(55)
while([DateTime]::UtcNow -lt $deadline){
 $process.Refresh();if($process.HasExited){throw 'Reviewed release exited; inspect its protected startup logs'}
 if(Select-String -LiteralPath $stdout -SimpleMatch 'Started BackendApplication' -Quiet){
  try{
   $response=Invoke-WebRequest http://127.0.0.1:8080/schedule -UseBasicParsing -TimeoutSec 3
   $privateStatus=0;try{Invoke-WebRequest http://127.0.0.1:8080/api/run-plans -UseBasicParsing -TimeoutSec 3|Out-Null}catch{if($_.Exception.Response){$privateStatus=[int]$_.Exception.Response.StatusCode}}
   if($response.StatusCode -eq 200 -and $privateStatus -eq 401 -and (Get-NetTCPConnection -State Listen -LocalPort 8080).OwningProcess -eq $process.Id){$healthy=$true;break}
  }catch{}
 }
 Start-Sleep -Milliseconds 400
}
if(-not$healthy){if(-not$process.HasExited){Stop-Process -Id $process.Id};throw 'Reviewed release did not become healthy'}
$record=@{projectRoot=$workspace;pid=$process.Id;port=8080;jarPath=$pin.jarPath;jarSha256=$pin.jarSha256;baseArtifactSha256=$manifest.baseArtifactSha256;backupSha256=$pin.backupSha256;databaseMigration='V001-V005 validated';activationMode=$pin.mode;rules=$pin.rules;qualifiedApprovalConfigured=$false;healthy=$true;startedAt=[DateTime]::UtcNow.ToString('o')}
if($heatmapEnabled){$record.heatmapEnabled=$true;$record.databaseMigration+='; heatmap V001 validated'}
[IO.File]::WriteAllText($marker,($record|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$record|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $directory ($name+'.json'))
Write-Output '[Hermes] Reviewed experimental release is healthy on port 8080.'

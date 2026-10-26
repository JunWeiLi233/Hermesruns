param(
 [Parameter(Mandatory)][ValidateSet('GenerateSchema','Rehearsal','Real')][string]$Mode,
 [Parameter(Mandatory)][string]$RunDirectory,
 [int]$RehearsalPort=55432
)
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
. (Join-Path $PSScriptRoot 'release-evidence.ps1')
$run=[IO.Path]::GetFullPath($RunDirectory)
if(-not $run.StartsWith((Join-Path $workspace '.private-backups')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Use the private release directory.'}
$manifest=Get-Content (Join-Path $run 'manifest.json') -Raw|ConvertFrom-Json -AsHashtable
if(-not $manifest.backupVerified){throw 'Verify the full backup restore first.'}
Assert-ReleaseArtifacts $workspace $manifest.artifacts
$port=if($Mode -eq 'Real'){8080}else{18081}
if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Port $port is occupied; do not replace an unidentified process."}
if($Mode -eq 'Real'){
 if(-not $manifest.migrationApplied){throw 'Apply the verified release migration before activation.'}
 . (Join-Path $workspace 'Hermes.local.env.ps1') *> $null
 $uri=[Uri]($env:APP_DB_URL -replace '^jdbc:','')
 if(-not $uri.IsLoopback -or $uri.Scheme -ne 'postgresql'){throw 'Unexpected configured database target.'}
 $env:PGHOST=$uri.DnsSafeHost;$env:PGPORT=if($uri.Port -gt 0){[string]$uri.Port}else{'5432'}
 $env:PGDATABASE=[Uri]::UnescapeDataString($uri.AbsolutePath.Trim('/'));$env:PGUSER=$env:APP_DB_USERNAME;$env:PGPASSWORD=$env:APP_DB_PASSWORD
 Assert-ReleaseTarget 'C:\Program Files\PostgreSQL\17\bin' $manifest.sourceTarget
}else{
 $secret=Import-Clixml (Join-Path $run 'rehearsal-password.clixml')
 $env:APP_DB_PASSWORD=[Net.NetworkCredential]::new('',$secret).Password
 $env:APP_DB_USERNAME='hermes_release_check';$env:APP_DB_URL="jdbc:postgresql://127.0.0.1:$RehearsalPort/hermes"
}
$env:APP_DB_DRIVER='org.postgresql.Driver';$env:APP_JPA_DDL_AUTO='validate'
$env:SPRING_APPLICATION_JSON=$null
$env:JAVA_TOOL_OPTIONS=$null;$env:JDK_JAVA_OPTIONS=$null;$env:_JAVA_OPTIONS=$null
$env:SPRING_DATASOURCE_URL=$env:APP_DB_URL;$env:SPRING_DATASOURCE_USERNAME=$env:APP_DB_USERNAME
$env:SPRING_DATASOURCE_PASSWORD=$env:APP_DB_PASSWORD;$env:SPRING_DATASOURCE_DRIVER_CLASS_NAME=$env:APP_DB_DRIVER
$env:SPRING_JPA_HIBERNATE_DDL_AUTO='validate'
$env:APP_TRAININGWORKSPACE_ENABLED='true';$env:APP_TRAININGWORKSPACE_MIGRATE='false';$env:APP_TRAININGWORKSPACE_JOBSENABLED=if($Mode -eq 'Real'){'true'}else{'false'}
$arguments=@('-Xmx768m','-Dspring.devtools.restart.enabled=false','-jar',(Join-Path $workspace 'backend/target/backend-0.0.1-SNAPSHOT.jar'),"--server.address=127.0.0.1","--server.port=$port",'--spring.jpa.hibernate.ddl-auto=validate','--app.training-workspace.enabled=true','--app.training-workspace.migrate=false',"--app.training-workspace.jobs-enabled=$($env:APP_TRAININGWORKSPACE_JOBSENABLED)",'--app.official-course.startup-seed.enabled=false','--app.local-shared-runner.enabled=false','--app.training.catchup-on-startup=false')
if($Mode -ne 'Real'){
 $arguments+=@('--spring.profiles.active=training-release-check','--app.coach.nightly.enabled=false','--strava.sync.enabled=false','--garmin.wellness.sync.enabled=false','--app.mail.provider=disabled',"--app.training-workspace.private-directory=$run/stage-private")
}
if($Mode -eq 'GenerateSchema'){
 $env:APP_JPA_DDL_AUTO='none'
 $arguments=$arguments|Where-Object {$_ -ne '--spring.jpa.hibernate.ddl-auto=validate'}
 $arguments+='--spring.jpa.hibernate.ddl-auto=none'
 $arguments+=@('--spring.jpa.properties.jakarta.persistence.schema-generation.scripts.action=create',"--spring.jpa.properties.jakarta.persistence.schema-generation.scripts.create-target=$run/hibernate-current-schema.sql")
}
$java=(Get-Command java.exe -ErrorAction Stop).Source
$process=Start-Process -FilePath $java -ArgumentList $arguments -WorkingDirectory (Join-Path $workspace 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $run ($Mode+'.out.log')) -RedirectStandardError (Join-Path $run ($Mode+'.error.log')) -PassThru
$record=@{mode=$Mode;pid=$process.Id;port=$port;projectRoot=$workspace;startedUtc=[DateTime]::UtcNow.ToString('o');jarSha256=$manifest.artifacts['backend/target/backend-0.0.1-SNAPSHOT.jar'];healthy=$false}
$deadline=[DateTime]::UtcNow.AddSeconds(60)
while([DateTime]::UtcNow -lt $deadline){
 $process.Refresh();if($process.HasExited){throw "Hermes exited during startup. Inspect private $Mode logs."}
 if(Select-String -LiteralPath (Join-Path $run ($Mode+'.out.log')) -SimpleMatch 'Started BackendApplication' -Quiet){
  try{
   $api=Invoke-WebRequest "http://127.0.0.1:$port/api/training/me" -SkipHttpErrorCheck -TimeoutSec 3
   $page=Invoke-WebRequest "http://127.0.0.1:$port/training/calendar" -SkipHttpErrorCheck -TimeoutSec 3
   $listener=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
   if($api.StatusCode -eq 401 -and $page.StatusCode -eq 200 -and $listener.OwningProcess -eq $process.Id){$record.healthy=$true;break}
  }catch{ }
 }
 Start-Sleep -Milliseconds 500
}
if(-not$record.healthy){throw "Hermes did not become healthy within 60 seconds. Inspect private $Mode logs."}
[IO.File]::WriteAllText((Join-Path $run ($Mode+'.process.json')),($record|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$record|ConvertTo-Json

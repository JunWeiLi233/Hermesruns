$ErrorActionPreference='Stop'
$HeatmapWorkspace=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$HeatmapPgBin='C:\Program Files\PostgreSQL\17\bin'

function Get-HeatmapCandidate {
 $candidate=Get-Content (Join-Path $HeatmapWorkspace 'replica/statshunters/validation/activation-candidate.json') -Raw | ConvertFrom-Json
 $private=[IO.Path]::GetFullPath((Join-Path $HeatmapWorkspace '.private-backups'))+'\'
 if(-not[IO.Path]::GetFullPath($candidate.releaseRoot).StartsWith($private,[StringComparison]::OrdinalIgnoreCase)){throw 'Candidate must stay in the private workspace directory'}
 $pin=Get-Content (Join-Path $HeatmapWorkspace 'backend/reviewed-release.json') -Raw | ConvertFrom-Json
 if($candidate.baseJarSha256 -ne $pin.jarSha256){throw 'Serving release changed since candidate preparation'}
 if((Get-FileHash $candidate.jarPath).Hash -ne $candidate.jarSha256){throw 'Candidate artifact changed'}
 return $candidate
}

function Get-HeatmapLiveConnection($pin) {
 . (Join-Path $HeatmapWorkspace 'Hermes.local.env.ps1') *> $null
 $target=[Uri]($env:APP_DB_URL -replace '^jdbc:','')
 if($target.Scheme -ne 'postgresql' -or -not$target.IsLoopback -or $target.DnsSafeHost -ne $pin.databaseHost -or $target.Port -ne $pin.databasePort -or $target.AbsolutePath.Trim('/') -ne $pin.databaseName){throw 'Database does not match the reviewed local target'}
 return @('-h',$target.DnsSafeHost,'-p',[string]$target.Port,'-U',$env:APP_DB_USERNAME,'-d',$target.AbsolutePath.Trim('/'))
}

function Write-HeatmapFingerprint($connection,[string]$path) {
 $sql=@'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT format('SELECT %L, count(*), md5(COALESCE(string_agg(md5(row_to_json(t)::text),'''' ORDER BY md5(row_to_json(t)::text)),'''')) FROM %I.%I t;',schemaname||'.'||tablename,schemaname,tablename)
FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname NOT IN ('information_schema','statshunters','statshunters_migrations') ORDER BY schemaname,tablename
\gexec
SELECT 'sequence:'||schemaname||'.'||sequencename,COALESCE(last_value::text,'NULL') FROM pg_sequences WHERE schemaname NOT LIKE 'pg_%' AND schemaname NOT IN ('statshunters','statshunters_migrations') ORDER BY schemaname,sequencename;
COMMIT;
'@
 $scriptPath=$path+'.sql'
 [IO.File]::WriteAllText($scriptPath,$sql,[Text.UTF8Encoding]::new($false))
 & (Join-Path $HeatmapPgBin 'psql.exe') @connection -X -q -t -A -v ON_ERROR_STOP=1 -f $scriptPath 2> ($path+'.error.log') | Set-Content -LiteralPath $path
 if($LASTEXITCODE){throw 'Data fingerprint query failed; inspect private logs'}
}

function Assert-HeatmapFingerprint([string]$before,[string]$after) {
 if((Get-FileHash $before).Hash -ne (Get-FileHash $after).Hash){throw 'Existing data fingerprint changed; activation stopped'}
}

function Get-HeatmapMigration($candidate) {
 $pin=Get-Content $candidate.candidatePinPath -Raw | ConvertFrom-Json
 if((Get-FileHash $pin.manifestPath).Hash -ne $pin.manifestSha256){throw 'Candidate manifest changed'}
 $manifest=Get-Content $pin.manifestPath -Raw | ConvertFrom-Json
 $entryName='BOOT-INF/classes/explorer-migrations/V001__explorer_r0_r1.sql'
 $expected=@($manifest.resources | Where-Object path -EQ $entryName)[0].sha256
 if(-not$expected){throw 'Reviewed migration hash is absent'}
 $directory=Join-Path $candidate.releaseRoot 'migration'
 New-Item -ItemType Directory -Path $directory -Force | Out-Null
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $archive=[IO.Compression.ZipFile]::OpenRead($candidate.jarPath)
 try {[IO.Compression.ZipFileExtensions]::ExtractToFile($archive.GetEntry($entryName),(Join-Path $directory 'V001__explorer_r0_r1.sql'),$true)}finally{$archive.Dispose()}
 if((Get-FileHash (Join-Path $directory 'V001__explorer_r0_r1.sql')).Hash -ne $expected){throw 'Reviewed migration content changed'}
 return $directory
}

function Invoke-HeatmapMigration([string]$jdbc,[string]$username,[string]$password,[string]$log,[string]$migrationPath) {
 $saved=@($env:APP_DB_URL,$env:APP_DB_USERNAME,$env:APP_DB_PASSWORD)
 try {
  $env:APP_DB_URL=$jdbc;$env:APP_DB_USERNAME=$username;$env:APP_DB_PASSWORD=$password
  & (Join-Path $HeatmapWorkspace 'replica/statshunters/migrate-backend.ps1') -MigrationPath $migrationPath -Apply *> $log
  & (Join-Path $HeatmapWorkspace 'replica/statshunters/migrate-backend.ps1') -MigrationPath $migrationPath *> ($log+'.validate.log')
 } finally {$env:APP_DB_URL=$saved[0];$env:APP_DB_USERNAME=$saved[1];$env:APP_DB_PASSWORD=$saved[2]}
}

function Assert-HeatmapRuntime($pin) {
 $marker=Join-Path $env:USERPROFILE '.hermes/runtime.json'
 $runtime=Get-Content $marker -Raw | ConvertFrom-Json
 $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction Stop)
 $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$runtime.pid)
 if($listeners.Count -ne 1 -or $listeners[0].OwningProcess -ne $runtime.pid -or $runtime.projectRoot -ne $HeatmapWorkspace -or $runtime.jarSha256 -ne $pin.jarSha256 -or $process.Name -ne 'java.exe' -or -not$process.CommandLine.Contains([string]$pin.jarPath) -or (Get-FileHash $pin.jarPath).Hash -ne $pin.jarSha256){throw 'Runtime ownership or reviewed version changed'}
 return $runtime
}

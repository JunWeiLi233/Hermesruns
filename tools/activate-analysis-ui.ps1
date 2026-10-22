param([Parameter(Mandatory)][string]$CandidatePinPath, [Parameter(Mandatory)][string]$VerificationPath)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$pinPath = Join-Path $workspace 'backend/reviewed-release.json'
$current = Get-Content -LiteralPath $pinPath -Raw | ConvertFrom-Json
$next = Get-Content -LiteralPath $CandidatePinPath -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath $next.manifestPath -Raw | ConvertFrom-Json
$verified = Get-Content -LiteralPath $VerificationPath -Raw | ConvertFrom-Json
if (-not $verified.passed -or $verified.jarSha256 -ne $next.jarSha256) { throw 'This exact candidate must pass verification before activation' }
if ($manifest.previousJarSha256 -ne $current.jarSha256) { throw 'Serving release changed during verification' }
if ((Get-FileHash -LiteralPath $next.jarPath).Hash -ne $next.jarSha256 -or (Get-FileHash -LiteralPath $next.manifestPath).Hash -ne $next.manifestSha256) { throw 'Verified candidate changed' }
$runtime = Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.hermes/runtime.json') -Raw | ConvertFrom-Json
if ($runtime.projectRoot -ne $workspace -or $runtime.jarSha256 -ne $current.jarSha256) { throw 'Runtime ownership or version changed' }
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$($runtime.pid)" -ErrorAction Stop
if (-not $process -or -not $process.CommandLine.Contains($current.jarPath)) { throw 'The recorded process is not the serving backend' }
& (Join-Path $PSScriptRoot 'assert-analysis-release.ps1') -JarPath $next.jarPath
. (Join-Path $workspace 'Hermes.local.env.ps1') *> $null
$target = [Uri]($env:APP_DB_URL -replace '^jdbc:', '')
if ($target.Scheme -ne 'postgresql' -or -not $target.IsLoopback -or $target.DnsSafeHost -ne $current.databaseHost -or $target.Port -ne $current.databasePort -or $target.AbsolutePath.Trim('/') -ne $current.databaseName) { throw 'Local database target changed' }
$connection = @('-h', $target.DnsSafeHost, '-p', $target.Port, '-U', $env:APP_DB_USERNAME, '-d', $target.AbsolutePath.Trim('/'))
$releaseRoot = Split-Path -Parent $CandidatePinPath
$schemaPath = Join-Path $releaseRoot 'verified-goals-schema.sql'
$schemaEntry = 'BOOT-INF/classes/db/analysis/V002__goals.sql'
$schemaHash = @($manifest.resources | Where-Object path -EQ $schemaEntry)[0].sha256
if (-not $schemaHash) { throw 'Verified candidate does not contain its Goals schema prerequisite' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($next.jarPath)
try {
    $entry = $archive.GetEntry($schemaEntry)
    if (-not $entry) { throw 'Candidate Goals schema is missing' }
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $schemaPath, $true)
} finally { $archive.Dispose() }
if ((Get-FileHash -LiteralPath $schemaPath).Hash -ne $schemaHash) { throw 'Candidate Goals schema hash changed' }
$backup = Join-Path $releaseRoot 'before-analysis-ui.dump'
$env:PGPASSWORD = $env:APP_DB_PASSWORD
try {
    & 'C:/Program Files/PostgreSQL/17/bin/pg_dump.exe' @connection -Fc -f $backup
    if ($LASTEXITCODE) { throw 'Fresh backup failed; the database and active release were not changed' }
    & 'C:/Program Files/PostgreSQL/17/bin/psql.exe' @connection -X -v ON_ERROR_STOP=1 -f $schemaPath
    if ($LASTEXITCODE) { throw 'Goals schema prerequisite failed' }
} finally { $env:PGPASSWORD = $null }
$next.backupSha256 = (Get-FileHash -LiteralPath $backup).Hash
$next | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $CandidatePinPath
$previousPin = Join-Path $releaseRoot 'before-activation-release.json'
Copy-Item -LiteralPath $pinPath -Destination $previousPin
Copy-Item -LiteralPath $CandidatePinPath -Destination $pinPath
$env:HERMES_NO_BROWSER = '1'; $env:HERMES_NO_PAUSE = '1'; $env:HERMES_SKIP_SYNC_WATCHER = '1'
Push-Location $workspace
try {
    & cmd /d /c start_hermes.bat
    if ($LASTEXITCODE) {
        Copy-Item -LiteralPath $previousPin -Destination $pinPath
        & cmd /d /c start_hermes.bat
        throw 'UI activation failed; the previous release pin was restored'
    }
} finally { Pop-Location }
$live = Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.hermes/runtime.json') -Raw | ConvertFrom-Json
if (-not $live.healthy -or $live.jarSha256 -ne $next.jarSha256) { throw 'Running artifact does not match the verified UI build' }
Write-Output 'Verified Analysis UI is healthy on the current worktree.'

param([switch]$IncludeAnalysisTotals, [switch]$AnalysisTotalsOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$workspace = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$pin = Get-Content -LiteralPath (Join-Path $workspace 'backend/reviewed-release.json') -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $pin.jarPath).Hash -ne $pin.jarSha256) { throw 'Pinned backend changed' }
$buildRoot = Join-Path $workspace ('.workspace/analysis-ui-prerequisites-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
$classes = Join-Path $buildRoot 'base'
$libraries = Join-Path $buildRoot 'lib'
$overlay = Join-Path $buildRoot 'overlay'
$emptySource = Join-Path $buildRoot 'empty-source'
foreach ($directory in @($classes, $libraries, $overlay, $emptySource)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
$archive = [IO.Compression.ZipFile]::OpenRead($pin.jarPath)
try {
    foreach ($entry in $archive.Entries) {
        $destination = $null
        if ($entry.FullName.StartsWith('BOOT-INF/classes/com/') -and $entry.FullName.EndsWith('.class')) { $destination = Join-Path $classes $entry.FullName.Substring('BOOT-INF/classes/'.Length) }
        elseif ($entry.FullName.StartsWith('BOOT-INF/lib/') -and $entry.FullName.EndsWith('.jar')) { $destination = Join-Path $libraries ([IO.Path]::GetFileName($entry.FullName)) }
        if ($destination) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination)
        }
    }
} finally { $archive.Dispose() }
# The current Training log includes Goals. Compile that existing module against the
# pinned runtime so its UI cannot be published with an absent or incompatible API.
$sources = @()
if (-not $AnalysisTotalsOnly) { $sources = @(Get-ChildItem -LiteralPath (Join-Path $workspace 'backend/src/main/java/com/hermes/backend/goals') -Filter '*.java' -File | Select-Object -ExpandProperty FullName) }
if ($IncludeAnalysisTotals -or $AnalysisTotalsOnly) { $sources += Join-Path $workspace 'backend/src/main/java/com/hermes/backend/training/TrainingTotalsController.java' }
& javac --release 17 -encoding UTF-8 -parameters -classpath "$classes;$libraries/*" -sourcepath $emptySource -d $overlay @sources
if ($LASTEXITCODE) { throw 'The existing Goals module is incompatible with the pinned backend' }
$result = @{ buildRoot = $buildRoot; overlay = $overlay; baseJarSha256 = $pin.jarSha256
    sources = @($sources | ForEach-Object { @{ path = [IO.Path]::GetRelativePath($workspace, $_); sha256 = (Get-FileHash -LiteralPath $_).Hash } })
    classes = @(Get-ChildItem -LiteralPath $overlay -Recurse -Filter '*.class' -File | ForEach-Object { @{ path = [IO.Path]::GetRelativePath($overlay, $_.FullName); sha256 = (Get-FileHash -LiteralPath $_.FullName).Hash } })
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $buildRoot 'build.json')
$result | Select-Object buildRoot, overlay | ConvertTo-Json

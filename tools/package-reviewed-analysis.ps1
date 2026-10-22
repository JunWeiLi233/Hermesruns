param([Parameter(Mandatory)][string]$BuiltJarPath, [string]$FrontendStaticPath, [string]$AdditionalClassesPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$workspace = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$pinPath = Join-Path $workspace 'backend/reviewed-release.json'
$pin = Get-Content -LiteralPath $pinPath -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $pin.jarPath).Hash -ne $pin.jarSha256) { throw 'Active artifact hash changed' }
if ($FrontendStaticPath) {
    if ((Get-FileHash -LiteralPath $BuiltJarPath).Hash -ne $pin.jarSha256) { throw 'A frontend refresh must use the current pinned backend' }
    if (-not (Test-Path -LiteralPath (Join-Path $FrontendStaticPath 'index.html'))) { throw 'Frontend build is missing index.html' }
}
$prerequisites = $null
if ($AdditionalClassesPath) {
    if (-not $FrontendStaticPath) { throw 'Additional UI prerequisites require a frontend refresh' }
    $prerequisites = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $AdditionalClassesPath) 'build.json') -Raw | ConvertFrom-Json
    if ([IO.Path]::GetFullPath($AdditionalClassesPath).TrimEnd('\', '/') -ne [IO.Path]::GetFullPath($prerequisites.overlay).TrimEnd('\', '/')) { throw 'UI prerequisite classes must come from the recorded compiler output' }
    if ($prerequisites.baseJarSha256 -ne $pin.jarSha256) { throw 'UI prerequisites were compiled against another backend' }
    foreach ($source in $prerequisites.sources) {
        if ((Get-FileHash -LiteralPath (Join-Path $workspace $source.path)).Hash -ne $source.sha256) { throw "UI prerequisite source changed after compilation: $($source.path)" }
    }
    $compiled = @(Get-ChildItem -LiteralPath $AdditionalClassesPath -Recurse -Filter '*.class' -File)
    if ($compiled.Count -eq 0 -or $compiled.Count -ne $prerequisites.classes.Count) { throw 'UI prerequisite class inventory is incomplete' }
    foreach ($entry in $prerequisites.classes) {
        if ($entry.path -notmatch '^com\\hermes\\backend\\goals\\[^\\]+\.class$|^com\\hermes\\backend\\training\\TrainingTotalsController\.class$') { throw 'Unexpected UI prerequisite class' }
    }
    foreach ($entry in $prerequisites.classes) {
        if ((Get-FileHash -LiteralPath (Join-Path $AdditionalClassesPath $entry.path)).Hash -ne $entry.sha256) { throw "UI prerequisite bytecode changed after compilation: $($entry.path)" }
    }
}
$previousManifest = Get-Content -LiteralPath $pin.manifestPath -Raw | ConvertFrom-Json
$releaseRoot = Join-Path $workspace ('.private-backups/analysis-release-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
New-Item -ItemType Directory -Path $releaseRoot | Out-Null
Copy-Item -LiteralPath $pinPath -Destination (Join-Path $releaseRoot 'previous-release.json')
$jarPath = Join-Path $releaseRoot 'backend.jar'
Copy-Item -LiteralPath ([IO.Path]::GetFullPath($BuiltJarPath)) -Destination $jarPath
# Preserve the activated plan and workspace implementation while replacing the complete analysis build.
$protectedPrefixes = @('BOOT-INF/classes/com/hermes/backend/coaching/plan/', 'BOOT-INF/classes/com/hermes/backend/training/')
$base = [IO.Compression.ZipFile]::OpenRead($pin.jarPath)
$staging = Join-Path $releaseRoot 'preserved'
$protectedHashes = @{}
try {
    foreach ($entry in $base.Entries) {
        $keep = $false
        if ($FrontendStaticPath -and $entry.FullName.StartsWith('BOOT-INF/classes/') -and -not $entry.FullName.StartsWith('BOOT-INF/classes/static/') -and -not $entry.FullName.EndsWith('/')) { $keep = $true }
        foreach ($prefix in $protectedPrefixes) { if ($entry.FullName.StartsWith($prefix) -and $entry.FullName.EndsWith('.class')) { $keep = $true } }
        if ($entry.FullName -match '^BOOT-INF/classes/application(?:-[^/]+)?\.properties$') { $keep = $true }
        if (-not $keep) { continue }
        $destination = Join-Path $staging $entry.FullName
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination)
        $stream = $entry.Open(); $digest = [Security.Cryptography.SHA256]::Create()
        try { $protectedHashes[$entry.FullName] = [Convert]::ToHexString($digest.ComputeHash($stream)) }
        finally { $stream.Dispose(); $digest.Dispose() }
    }
} finally { $base.Dispose() }
$analysisSchema = Join-Path $workspace 'backend/src/main/resources/db/analysis'
if (-not $FrontendStaticPath -and (Test-Path $analysisSchema)) {
    $schemaDestination = Join-Path $staging 'BOOT-INF/classes/db/analysis'
    New-Item -ItemType Directory -Path $schemaDestination -Force | Out-Null
    Get-ChildItem -LiteralPath $analysisSchema -File | Copy-Item -Destination $schemaDestination
}
if ($FrontendStaticPath) {
    $staticDestination = Join-Path $staging 'BOOT-INF/classes/static'
    New-Item -ItemType Directory -Path $staticDestination -Force | Out-Null
    Get-ChildItem -LiteralPath $FrontendStaticPath -Force | Copy-Item -Destination $staticDestination -Recurse -Force
}
if ($AdditionalClassesPath) {
    Get-ChildItem -LiteralPath $AdditionalClassesPath -Force | Copy-Item -Destination (Join-Path $staging 'BOOT-INF/classes') -Recurse -Force
    $schemaDestination = Join-Path $staging 'BOOT-INF/classes/db/analysis'
    New-Item -ItemType Directory -Path $schemaDestination -Force | Out-Null
    Get-ChildItem -LiteralPath $analysisSchema -File | Copy-Item -Destination $schemaDestination -Force
}
# The JDK archive writer preserves Spring Boot's nested-jar offsets and STORED library entries.
& jar --update --file $jarPath -C $staging .
if ($LASTEXITCODE) { throw 'Could not package the release' }
& (Join-Path $PSScriptRoot 'assert-analysis-release.ps1') -JarPath $jarPath
$entries = @()
$archive = [IO.Compression.ZipFile]::OpenRead($jarPath)
try {
    $entries = @($archive.Entries | Where-Object { $_.FullName.StartsWith('BOOT-INF/classes/') -and -not $_.FullName.EndsWith('/') } | ForEach-Object {
        $stream = $_.Open(); $digest = [Security.Cryptography.SHA256]::Create()
        try {
            $hash = [Convert]::ToHexString($digest.ComputeHash($stream))
            if ($protectedHashes.ContainsKey($_.FullName) -and $hash -ne $protectedHashes[$_.FullName]) { throw 'Protected release class changed' }
            @{ path = $_.FullName; sha256 = $hash }
        } finally { $stream.Dispose(); $digest.Dispose() }
    })
} finally { $archive.Dispose() }
$manifest = [ordered]@{
    jarPath = $jarPath; jarSha256 = (Get-FileHash -LiteralPath $jarPath).Hash
    baseArtifactSha256 = $previousManifest.baseArtifactSha256; previousJarSha256 = $pin.jarSha256
    builtAt = [DateTime]::UtcNow.ToString('o'); buildMode = $(if ($FrontendStaticPath) { 'frontend refresh; preserved every backend class and non-static resource from the previous release' } else { 'complete analysis backend and embedded frontend; preserved activated training code and configuration' })
    protectedEntries = $protectedHashes.Count
    uiPrerequisites = $prerequisites
    classes = @($entries | Where-Object path -Like '*.class')
    resources = @($entries | Where-Object path -NotLike '*.class')
    sources = $(if ($FrontendStaticPath) { @($previousManifest.sources) } else { @(Get-ChildItem (Join-Path $workspace 'backend/src/main/java') -Recurse -Filter '*.java' | ForEach-Object {
        @{ path = [IO.Path]::GetRelativePath($workspace, $_.FullName); sha256 = (Get-FileHash -LiteralPath $_.FullName).Hash }
    }) })
}
$manifestPath = Join-Path $releaseRoot 'release-manifest.json'
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath
$pin.jarPath = $jarPath; $pin.jarSha256 = $manifest.jarSha256
$pin.manifestPath = $manifestPath; $pin.manifestSha256 = (Get-FileHash -LiteralPath $manifestPath).Hash
$candidatePinPath = Join-Path $releaseRoot 'candidate-release.json'
$pin | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $candidatePinPath
$result = @{ releaseRoot=$releaseRoot; jarPath=$jarPath; candidatePinPath=$candidatePinPath; protectedEntries=$protectedHashes.Count }
$result | ConvertTo-Json | Set-Content (Join-Path $releaseRoot 'candidate.json')
$result | ConvertTo-Json

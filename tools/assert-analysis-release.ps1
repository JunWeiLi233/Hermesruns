param([Parameter(Mandatory)][string]$JarPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($JarPath))
try {
    $contract = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'analysis-release-contract.json') -Raw | ConvertFrom-Json
    $required = $contract.classes
    $missing = @($required | Where-Object {
        $null -eq $archive.GetEntry("BOOT-INF/classes/com/hermes/backend/$_.class")
    })
    if ($missing.Count) {
        throw ('Release is missing the merged analysis API implementation: ' +
            ($missing -join ', ') + '. Rebuild the release with its analysis backend before starting Hermes.')
    }
    $scripts = @($archive.Entries | Where-Object { $_.FullName.StartsWith('BOOT-INF/classes/static/assets/') -and $_.FullName.EndsWith('.js') })
    $remaining = [Collections.Generic.HashSet[string]]::new([string[]]$contract.frontendMarkers)
    foreach ($script in $scripts) {
        $reader = [IO.StreamReader]::new($script.Open())
        try { $source = $reader.ReadToEnd() } finally { $reader.Dispose() }
        foreach ($marker in @($remaining)) { if ($source.Contains($marker)) { $null = $remaining.Remove($marker) } }
        if ($remaining.Count -eq 0) { break }
    }
    if ($remaining.Count) { throw ('Release frontend is missing embedded analysis features: ' + ($remaining -join ', ')) }
} finally {
    $archive.Dispose()
}

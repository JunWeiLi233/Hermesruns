param(
    [string]$WindowsCodexHome = "$env:USERPROFILE\.codex",
    [string[]]$WslDistros = @(),
    [switch]$SkipWindows,
    [switch]$SkipWsl
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceCommandsDir = Join-Path $repoRoot ".codex\commands"
$commandFiles = @(
    Get-ChildItem -LiteralPath $sourceCommandsDir -Filter "auto-hermes*.md" |
        Sort-Object Name |
        Select-Object -ExpandProperty Name
)

if ($commandFiles.Count -eq 0) {
    throw "No Hermes command files found under $sourceCommandsDir"
}

foreach ($commandFile in $commandFiles) {
    $sourcePath = Join-Path $sourceCommandsDir $commandFile
    if (-not (Test-Path $sourcePath)) {
        throw "Missing source command file: $sourcePath"
    }
}

function Ensure-Directory {
    param([string]$Path)
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Remove-LegacyHermesPluginConfig {
    param([string]$CodexHome)

    $configPath = Join-Path $CodexHome "config.toml"
    if (-not (Test-Path $configPath)) {
        return
    }

    $raw = Get-Content -LiteralPath $configPath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return
    }

    $lines = $raw -split "`r?`n"
    $filtered = New-Object System.Collections.Generic.List[string]
    $skipping = $false
    $removedLegacyBlock = $false

    foreach ($line in $lines) {
        if ($line -match '^\[plugins\."hermes-workflows@local"\]$') {
            $skipping = $true
            $removedLegacyBlock = $true
            continue
        }

        if ($skipping -and $line -match '^\[') {
            $skipping = $false
        }

        if (-not $skipping) {
            $filtered.Add($line)
        }
    }

    if ($removedLegacyBlock) {
        while ($filtered.Count -gt 0 -and [string]::IsNullOrWhiteSpace($filtered[$filtered.Count - 1])) {
            $filtered.RemoveAt($filtered.Count - 1)
        }

        $normalized = if ($filtered.Count -eq 0) { "" } else { ($filtered -join "`r`n") + "`r`n" }
        Set-Content -LiteralPath $configPath -Value $normalized -Encoding UTF8
    }
}

function Remove-LegacyHermesPluginFromMarketplace {
    param([string]$CodexHome)

    $marketplacePath = Join-Path $CodexHome ".tmp\plugins\.agents\plugins\marketplace.json"
    if (-not (Test-Path $marketplacePath)) {
        return
    }

    $raw = Get-Content -LiteralPath $marketplacePath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return
    }

    $json = $raw | ConvertFrom-Json
    if (-not $json.plugins) {
        return
    }

    $existingCount = @($json.plugins).Count
    $json.plugins = @($json.plugins | Where-Object { $_.name -ne "hermes-workflows" })
    if (@($json.plugins).Count -ne $existingCount) {
        Set-Content -LiteralPath $marketplacePath -Value ($json | ConvertTo-Json -Depth 20) -Encoding UTF8
    }
}

function Remove-LegacyHermesPluginArtifacts {
    param([string]$CodexHome)

    $paths = @(
        (Join-Path $CodexHome "plugins\cache\local\hermes-workflows"),
        (Join-Path $CodexHome ".tmp\plugins\plugins\hermes-workflows")
    )

    foreach ($targetPath in $paths) {
        if (Test-Path $targetPath) {
            Remove-Item -LiteralPath $targetPath -Recurse -Force
        }
    }

    Remove-LegacyHermesPluginConfig -CodexHome $CodexHome
    Remove-LegacyHermesPluginFromMarketplace -CodexHome $CodexHome
}

function Install-Into-CodexHome {
    param(
        [string]$CodexHome,
        [string]$Label
    )

    $commandsDir = Join-Path $CodexHome "commands"
    $promptsDir = Join-Path $CodexHome "prompts"

    Ensure-Directory $CodexHome
    Ensure-Directory $commandsDir
    Ensure-Directory $promptsDir

    foreach ($commandFile in $commandFiles) {
        $sourcePath = Join-Path $sourceCommandsDir $commandFile
        Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $commandsDir $commandFile) -Force
        Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $promptsDir $commandFile) -Force
    }

    Remove-LegacyHermesPluginArtifacts -CodexHome $CodexHome

    [pscustomobject]@{
        Label = $Label
        CodexHome = $CodexHome
        CommandsDir = $commandsDir
        PromptsDir = $promptsDir
    }
}

function Get-WslDistroNames {
    $output = & wsl.exe -l -q 2>$null
    if ($LASTEXITCODE -ne 0) {
        return @()
    }
    return @(
        $output |
            ForEach-Object { ($_ -replace "`0", "").Trim() } |
            Where-Object { $_ }
    )
}

function Get-WslCodexHomeUnc {
    param([string]$Distro)

    $Distro = ($Distro -replace "`0", "").Trim()
    $homePath = (& wsl.exe -d $Distro sh -lc 'printf %s "$HOME"' 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($homePath)) {
        throw "Unable to determine WSL home for distro '$Distro'."
    }

    $codexHomeLinux = "$homePath/.codex"
    $uncSuffix = ($codexHomeLinux.TrimStart("/") -replace "/", "\")
    return "\\wsl.localhost\$Distro\$uncSuffix"
}

$results = @()

if (-not $SkipWindows) {
    $results += Install-Into-CodexHome -CodexHome $WindowsCodexHome -Label "windows"
}

if (-not $SkipWsl) {
    $distros = if ($WslDistros.Count -gt 0) { $WslDistros } else { Get-WslDistroNames }
    foreach ($distro in $distros) {
        $wslCodexHome = Get-WslCodexHomeUnc -Distro $distro
        $results += Install-Into-CodexHome -CodexHome $wslCodexHome -Label "wsl:$distro"
    }
}

$results | ForEach-Object {
    Write-Host "Installed Hermes Codex commands into $($_.Label): $($_.CodexHome)"
    Write-Host "  commands: $($_.CommandsDir)"
    Write-Host "  prompts:  $($_.PromptsDir)"
}

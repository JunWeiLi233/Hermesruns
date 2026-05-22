param(
  [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [switch]$NoBackup
)

$ErrorActionPreference = 'Stop'

$configDir = Join-Path $env:USERPROFILE '.mempalace'
$configFile = Join-Path $configDir 'config.json'
$workspaceDir = Join-Path $RepoRoot '.mempalace'
$workspacePalace = Join-Path $workspaceDir 'palace'
$backupRoot = Join-Path $workspaceDir 'migration-backups'

if (-not (Test-Path $configFile)) {
  throw "MemPalace config was not found at $configFile"
}

$config = Get-Content $configFile -Raw | ConvertFrom-Json
$currentPalace = $config.palace_path
if (-not $currentPalace) {
  throw "palace_path is missing from $configFile"
}

$currentPalaceResolved = [System.IO.Path]::GetFullPath($currentPalace)
$workspacePalaceResolved = [System.IO.Path]::GetFullPath($workspacePalace)

New-Item -ItemType Directory -Force -Path $workspaceDir | Out-Null

if (-not $NoBackup) {
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item -LiteralPath $configFile -Destination (Join-Path $backupRoot "config-$stamp.json") -Force
}

if ($currentPalaceResolved -ne $workspacePalaceResolved) {
  if (Test-Path $currentPalaceResolved) {
    if (Test-Path $workspacePalaceResolved) {
      Remove-Item -LiteralPath $workspacePalaceResolved -Recurse -Force
    }
    Copy-Item -LiteralPath $currentPalaceResolved -Destination $workspacePalaceResolved -Recurse -Force
  } elseif (-not (Test-Path $workspacePalaceResolved)) {
    New-Item -ItemType Directory -Force -Path $workspacePalaceResolved | Out-Null
  }
}

$config.palace_path = $workspacePalaceResolved
$json = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($configFile, $json, $utf8NoBom)

Write-Host "[mempalace] config updated to $workspacePalaceResolved"
if (Test-Path $workspacePalaceResolved) {
  Write-Host "[mempalace] workspace palace ready at $workspacePalaceResolved"
}

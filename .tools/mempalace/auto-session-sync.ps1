param(
  [switch]$Quiet,
  [int]$AutoSyncTimeoutSeconds = 5
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$configDir = Join-Path $env:USERPROFILE '.mempalace'
$configFile = Join-Path $configDir 'config.json'
$projectConfig = Join-Path $repoRoot 'mempalace.yaml'
$workspaceMemPalaceDir = Join-Path $repoRoot '.mempalace'
$workspacePalacePath = Join-Path $workspaceMemPalaceDir 'palace'
$workspaceKnowledgeGraph = Join-Path $workspaceMemPalaceDir 'knowledge_graph.sqlite3'
$autoSyncSourceDir = Join-Path $workspaceMemPalaceDir 'auto-sync-source'
$autoSyncLog = Join-Path $workspaceMemPalaceDir 'auto-session-sync.out.log'
$autoSyncErrorLog = Join-Path $workspaceMemPalaceDir 'auto-session-sync.err.log'

if ($env:HERMES_MEMPALACE_DISABLE -eq '1') {
  if (-not $Quiet) { Write-Host '[mempalace] auto-sync disabled by HERMES_MEMPALACE_DISABLE=1' }
  exit 0
}

if (-not (Test-Path $configFile) -or -not (Test-Path $projectConfig)) {
  if (-not $Quiet) { Write-Host '[mempalace] setup missing, skipping auto-sync' }
  exit 0
}

$pythonCheck = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCheck) {
  if (-not $Quiet) { Write-Host '[mempalace] python not found, skipping auto-sync' }
  exit 0
}

$env:PYTHONIOENCODING = 'utf-8'
$null = chcp 65001
$env:MEMPALACE_PALACE_PATH = $workspacePalacePath
# Some Windows shells expose both Path and PATH; Start-Process treats them as duplicate keys.
[System.Environment]::SetEnvironmentVariable('PATH', $null, 'Process')

New-Item -ItemType Directory -Force -Path $workspaceMemPalaceDir | Out-Null
New-Item -ItemType Directory -Force -Path $workspacePalacePath | Out-Null
New-Item -ItemType Directory -Force -Path $autoSyncSourceDir | Out-Null

Copy-Item -LiteralPath $projectConfig -Destination (Join-Path $autoSyncSourceDir 'mempalace.yaml') -Force

$snapshotFiles = @(
  'AGENTS.md',
  'TASKS.md',
  'docs/auto-hermes/index.md',
  'docs/repo-rules/index.md',
  '.ai-codex/optimized-codex.md',
  '.ai-sync/OMX_AUTO_HERMES_BRIDGE.md',
  '.ai-sync/CONTEXT_LEDGER.md',
  '.ai-sync/AGENT_SYNC.md'
)

foreach ($relativePath in $snapshotFiles) {
  $sourcePath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path $sourcePath)) { continue }

  $destinationPath = Join-Path $autoSyncSourceDir $relativePath
  $destinationDir = Split-Path -Parent $destinationPath
  New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

try {
  python -c "from mempalace.knowledge_graph import KnowledgeGraph; KnowledgeGraph(db_path=r'$workspaceKnowledgeGraph')" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'knowledge graph init failed' }

  $mineProcess = Start-Process `
    -FilePath $pythonCheck.Source `
    -ArgumentList @('-m', 'mempalace', 'mine', $autoSyncSourceDir, '--limit', '100') `
    -RedirectStandardOutput $autoSyncLog `
    -RedirectStandardError $autoSyncErrorLog `
    -NoNewWindow `
    -PassThru

  Wait-Process -Id $mineProcess.Id -Timeout $AutoSyncTimeoutSeconds -ErrorAction SilentlyContinue
  $mineProcess.Refresh()

  if (-not $mineProcess.HasExited) {
    Stop-Process -Id $mineProcess.Id -Force -ErrorAction SilentlyContinue
    if (-not $Quiet) { Write-Host "[mempalace] auto-sync skipped: mining timed out after $AutoSyncTimeoutSeconds seconds" }
    exit 0
  }

  if ($mineProcess.ExitCode -eq 0) {
    if (-not $Quiet) { Write-Host '[mempalace] auto-sync complete' }
  } elseif (-not $Quiet) {
    Write-Host '[mempalace] auto-sync skipped: palace is not writable in this environment'
  }
} catch {
  if (-not $Quiet) { Write-Host ('[mempalace] auto-sync skipped: ' + $_.Exception.Message) }
}

param(
  [switch]$Quiet
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

New-Item -ItemType Directory -Force -Path $workspaceMemPalaceDir | Out-Null
New-Item -ItemType Directory -Force -Path $workspacePalacePath | Out-Null

try {
  python -c "from mempalace.knowledge_graph import KnowledgeGraph; KnowledgeGraph(db_path=r'$workspaceKnowledgeGraph')" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'knowledge graph init failed' }

  python -m mempalace mine $repoRoot --limit 100 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    if (-not $Quiet) { Write-Host '[mempalace] auto-sync complete' }
  } elseif (-not $Quiet) {
    Write-Host '[mempalace] auto-sync skipped: palace is not writable in this environment'
  }
} catch {
  if (-not $Quiet) { Write-Host ('[mempalace] auto-sync skipped: ' + $_.Exception.Message) }
}

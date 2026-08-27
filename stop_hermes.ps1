# Stops everything Hermes leaves behind on this machine:
#   1. Spring Boot backend listening on :8080 (plus its Maven wrapper parent).
#   2. Python VDOT engine and auto-import watcher.
#   3. OMX MCP server sets spawned by Codex sessions in this repo
#      (.codex/runtime/omx-launcher.mjs + oh-my-codex dist mcp servers).
#   4. Orphaned (parent-dead) wmux mcp-bundle and Codex node_repl processes.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\stop_hermes.ps1
#   -SkipBackend  keep the Spring Boot backend running
#   -SkipMcp      keep OMX MCP processes running
param(
  [switch]$SkipBackend,
  [switch]$SkipMcp
)

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$killed = 0

function Stop-ProcessTreeSafe([int]$ProcId, [string]$Label) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcId" -ErrorAction SilentlyContinue
  if (-not $proc) { return }
  # Only kill processes we can positively identify as ours; never guess by bare PID.
  if ($proc.Name -in @('java.exe', 'python.exe', 'node.exe', 'node_repl.exe', 'cmd.exe')) {
    Stop-Process -Id $ProcId -Force -ErrorAction SilentlyContinue
    Write-Host "[Hermes] Stopped $Label (pid $ProcId, $($proc.Name))"
    script:killed++
  }
}

if (-not $SkipBackend) {
  # --- 1. Spring Boot backend on :8080 ---
  $listenerPids = netstat -ano |
    Select-String ':8080\s+.*LISTENING' |
    ForEach-Object { ($_ -replace '.*\s', '').Trim() } |
    Sort-Object -Unique
  foreach ($procId in $listenerPids) {
    if ($procId -match '^\d+$' -and $procId -ne '0') {
      $listener = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
      # Maven wrapper parents (cmd.exe running mvn/mvnw for this repo) exit on
      # their own once the JVM dies, but reap them if they linger.
      Stop-ProcessTreeSafe ([int]$procId) "backend on :8080"
      if ($listener -and $listener.ParentProcessId) {
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.ParentProcessId)"
        if ($parent -and $parent.Name -eq 'cmd.exe' -and $parent.CommandLine -match 'mvn|spring-boot') {
          Stop-ProcessTreeSafe ([int]$parent.ProcessId) "backend maven wrapper"
        }
      }
    }
  }

  # --- 2. Python engines for this repo ---
  $pythonEngines = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match [regex]::Escape($root) -and $_.CommandLine -match 'vdot_engine\.py|hermes_auto_sync\.py' }
  foreach ($proc in $pythonEngines) {
    Stop-ProcessTreeSafe ([int]$proc.ProcessId) "python engine"
  }
}

if (-not $SkipMcp) {
  $allProcs = Get-CimInstance Win32_Process
  $alive = $allProcs | ForEach-Object { $_.ProcessId }

  # --- 3. OMX MCP sets (launcher + oh-my-codex server) ---
  $omx = $allProcs | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -and
    ($_.CommandLine -match 'omx-launcher\.mjs' -or $_.CommandLine -match 'oh-my-codex\\dist\\mcp\\')
  }
  foreach ($proc in $omx) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "[Hermes] Stopped OMX MCP process (pid $($proc.ProcessId))"
    $killed++
  }

  # --- 4. Orphaned wmux / Codex helpers (parent already dead) ---
  $orphans = $allProcs | Where-Object {
    ($_.Name -in @('node.exe', 'node_repl.exe')) -and $_.CommandLine -and
    (($_.CommandLine -match 'wmux\\app-[\d.]+\\resources\\mcp-bundle') -or ($_.Name -eq 'node_repl.exe')) -and
    ($alive -notcontains $_.ParentProcessId)
  }
  foreach ($proc in $orphans) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "[Hermes] Stopped orphaned $($proc.Name) (pid $($proc.ProcessId))"
    $killed++
  }
}

Write-Host ""
if ($killed -eq 0) {
  Write-Host "[Hermes] Nothing left to stop; no Hermes background processes found."
} else {
  Write-Host "[Hermes] Stopped $killed background process(es)."
}

# --- 5. Runtime origin marker (cross-tree start guard) ---
# A stale marker after this stop would block the next cross-tree start
# (start_hermes.bat guard). This was a clean stop, so clear it.
$runtimeMarker = Join-Path $env:USERPROFILE '.hermes\runtime.json'
if (Test-Path $runtimeMarker) {
  Remove-Item $runtimeMarker -Force -ErrorAction SilentlyContinue
  Write-Host "[Hermes] Removed runtime origin marker ($runtimeMarker)."
}

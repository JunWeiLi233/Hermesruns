# ============================================
#  Hermes launcher (PostgreSQL) — safe template
#  Secrets live in Hermes.local.env.ps1 (gitignored).
#  Copy Hermes.local.env.example.ps1 -> Hermes.local.env.ps1
# ============================================

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

# ── Kill previous Hermes terminals ──
$hermesTitles = @("Hermes - Spring Boot Server", "Hermes - Python Engine", "Hermes - Auto Import Watcher")

foreach ($title in $hermesTitles) {
    $procs = Get-Process cmd -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq $title }
    foreach ($p in $procs) {
        try {
            $children = Get-CimInstance Win32_Process |
                Where-Object { $_.ParentProcessId -eq $p.Id }
            foreach ($child in $children) {
                Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
            }
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}

# Also kill any stale java on port 8080 (in case window was closed but process survived)
$portCheck = netstat -ano 2>$null | Select-String ":8080\s.*LISTENING"
if ($portCheck) {
    $pids = $portCheck | ForEach-Object {
        ($_ -replace '.*\s', '').Trim()
    } | Sort-Object -Unique
    foreach ($procId in $pids) {
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        }
    }
}

Start-Sleep -Seconds 1

# ── Load local secrets / config (never commit this file) ──
$localEnv = Join-Path $Root "Hermes.local.env.ps1"
if (-not (Test-Path -LiteralPath $localEnv)) {
    Write-Host ""
    Write-Host "[Hermes] Missing Hermes.local.env.ps1" -ForegroundColor Yellow
    Write-Host "  1. Copy:  Copy-Item Hermes.local.env.example.ps1 Hermes.local.env.ps1"
    Write-Host "  2. Edit Hermes.local.env.ps1 and set APP_DB_PASSWORD and any OAuth/API keys you need."
    Write-Host ""
    exit 1
}

. $localEnv

# ── Validate minimum DB settings for PostgreSQL ──
$required = @(
    @{ Name = "APP_DB_URL";      Value = $env:APP_DB_URL },
    @{ Name = "APP_DB_DRIVER";   Value = $env:APP_DB_DRIVER },
    @{ Name = "APP_DB_USERNAME"; Value = $env:APP_DB_USERNAME },
    @{ Name = "APP_DB_PASSWORD"; Value = $env:APP_DB_PASSWORD }
)
foreach ($r in $required) {
    if ([string]::IsNullOrWhiteSpace($r.Value)) {
        Write-Host "[Hermes] $($r.Name) is not set. Define it in Hermes.local.env.ps1" -ForegroundColor Red
        exit 1
    }
}

$weak = @("<set-a-strong-password>", "<set-me>", "password", "hermes123", "111111")
if ($weak -contains $env:APP_DB_PASSWORD.Trim()) {
    Write-Host "[Hermes] APP_DB_PASSWORD looks like a placeholder or weak default. Set a strong password in Hermes.local.env.ps1" -ForegroundColor Red
    exit 1
}

# ── Launch (env vars flow into start_hermes.bat -> run-backend.cmd) ──
Start-Process cmd -ArgumentList "/c `"$Root\start_hermes.bat`"" -WorkingDirectory $Root

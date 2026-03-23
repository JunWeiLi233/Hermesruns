# ============================================
#  Hermes Launcher (PostgreSQL) — TEMPLATE
#  Copy this file to start_hermes_postgres.ps1
#  and fill in your own credentials.
# ============================================

# ── Kill previous Hermes terminals ──
$hermesTitles = @("Hermes - Spring Boot Server", "Hermes - Python Engine", "Hermes - Auto Import Watcher")

foreach ($title in $hermesTitles) {
    # Find cmd.exe windows whose title matches
    $procs = Get-Process cmd -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq $title }
    foreach ($p in $procs) {
        # Kill the entire process tree (java/python children)
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
    foreach ($pid in $pids) {
        if ($pid -match '^\d+$' -and $pid -ne '0') {
            Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
        }
    }
}

# Brief pause to let ports release
Start-Sleep -Seconds 1

# ── Database (PostgreSQL) ──
$env:APP_DB_URL = "jdbc:postgresql://localhost:5432/hermes"
$env:APP_DB_DRIVER = "org.postgresql.Driver"
$env:APP_DB_USERNAME = "YOUR_DB_USERNAME"
$env:APP_DB_PASSWORD = "YOUR_DB_PASSWORD"

# ── Strava OAuth ──
# Register your app at https://www.strava.com/settings/api
$env:STRAVA_CLIENT_ID = "YOUR_STRAVA_CLIENT_ID"
$env:STRAVA_CLIENT_SECRET = "YOUR_STRAVA_CLIENT_SECRET"
$env:STRAVA_REDIRECT_URI = "http://localhost:8080/api/auth/strava/callback"
$env:APP_DATA_ENCRYPTION_KEY = "YOUR_ENCRYPTION_KEY"

# ── Google OAuth ──
# Create credentials at https://console.cloud.google.com/apis/credentials
$env:APP_GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"
$env:APP_GOOGLE_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET"
$env:APP_GOOGLE_REDIRECT_URI = "http://localhost:8080/api/auth/google/callback"

# ── AI Vision (shoe image scanning) ──
# Get your free API key from https://aistudio.google.com/apikey
$env:APP_AI_API_KEY = "YOUR_AI_API_KEY"
$env:APP_AI_MODEL = "gemini-2.5-flash"
$env:APP_AI_PROVIDER = "gemini"

# ── Admin bootstrap ──
$env:APP_BOOTSTRAP_ADMIN_EMAIL = "admin"
$env:APP_BOOTSTRAP_ADMIN_PASSWORD = "YOUR_ADMIN_PASSWORD"

# ── Launch (in its own window so this terminal stays clean) ──
Start-Process cmd -ArgumentList "/c `"$PSScriptRoot\start_hermes.bat`"" -WorkingDirectory $PSScriptRoot

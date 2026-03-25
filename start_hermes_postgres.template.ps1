# ============================================
#  Hermes Launcher (PostgreSQL) — TEMPLATE
#  Copy this file to start_hermes_postgres.ps1
#  and fill in your own credentials.
# ============================================

# ── Production hardening (public cloud) ──
# $env:HERMES_ENV = "production"
# $env:STRAVA_WEBHOOK_VERIFY_TOKEN = "<long-random-secret>"  # required if Strava enabled + HERMES_ENV=production
# $env:APP_ENABLE_HSTS = "true"   # only if site is always HTTPS
# $env:APP_CORS_ALLOWED_ORIGINS = "https://app.example.com"  # if SPA is on another host

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
    foreach ($procId in $pids) {
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
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
# Strava Webhook verify token (must match the value used when creating the push subscription)
# $env:STRAVA_WEBHOOK_VERIFY_TOKEN = "hermes-strava-webhook"

# ── Google OAuth ──
# Create credentials at https://console.cloud.google.com/apis/credentials
$env:APP_GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"
$env:APP_GOOGLE_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET"
$env:APP_GOOGLE_REDIRECT_URI = "http://localhost:8080/api/auth/google/callback"

# ── Garmin Connect Developer API ──
# Apply at https://developer.garmin.com/gc-developer-program/activity-api/
$env:GARMIN_CONSUMER_KEY = "YOUR_GARMIN_CONSUMER_KEY"
$env:GARMIN_CONSUMER_SECRET = "YOUR_GARMIN_CONSUMER_SECRET"
$env:GARMIN_REDIRECT_URI = "http://localhost:8080/api/auth/garmin/callback"
# Optional: Wellness API path from Garmin docs to resolve userId after OAuth (for activity webhooks).
# $env:GARMIN_USER_ID_URL = "https://apis.garmin.com/wellness-api/rest/user/id"

# ── AI Vision (shoe image scanning) ──
# Get your free API key from https://aistudio.google.com/apikey
$env:APP_AI_API_KEY = "YOUR_AI_API_KEY"
$env:APP_AI_MODEL = "gemini-2.5-flash"
$env:APP_AI_PROVIDER = "gemini"

# ── Stripe (Pro checkout — optional) ──
# One-time Price in Dashboard → STRIPE_PRICE_PRO_MONTHLY. Webhook URL: https://YOUR_HOST/api/billing/webhook
# $env:STRIPE_SECRET_KEY = "sk_live_..."
# $env:STRIPE_WEBHOOK_SECRET = "whsec_..."
# $env:STRIPE_PRICE_PRO_MONTHLY = "price_..."
# $env:APP_PUBLIC_BASE_URL = "http://localhost:8080"
# $env:APP_BILLING_PRICE_LABEL = "$9 / month"

# ── Email verification (password sign-up) — optional ──
# If SPRING_MAIL_HOST is empty, new accounts skip inbox verification (dev only).
# APP_PUBLIC_BASE_URL must be the URL users open in the browser (used inside the verification link).
$env:SPRING_MAIL_HOST = "smtp.gmail.com"
$env:SPRING_MAIL_PORT = "587"
$env:SPRING_MAIL_USERNAME = "your@gmail.com"
$env:SPRING_MAIL_PASSWORD = "<app-password>"
$env:APP_MAIL_FROM = "Hermes <your@gmail.com>"
$env:APP_PUBLIC_BASE_URL = "http://localhost:8080"

# ── Admin bootstrap ──
$env:APP_BOOTSTRAP_ADMIN_EMAIL = "admin"
$env:APP_BOOTSTRAP_ADMIN_PASSWORD = "YOUR_ADMIN_PASSWORD"

# ── Launch (in its own window so this terminal stays clean) ──
Start-Process cmd -ArgumentList "/c `"$PSScriptRoot\start_hermes.bat`"" -WorkingDirectory $PSScriptRoot

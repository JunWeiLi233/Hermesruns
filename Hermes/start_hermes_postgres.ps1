# ==========================================
#   Hermes - PostgreSQL + OAuth + Admin
#   Edit the values below, then run:
#   .\start_hermes_postgres.ps1
# ==========================================

# --- Database ---
$env:APP_DB_URL      = "jdbc:postgresql://localhost:5432/hermes"
$env:APP_DB_DRIVER   = "org.postgresql.Driver"
$env:APP_DB_USERNAME = "hermes"
$env:APP_DB_PASSWORD = "your-postgres-password"

# --- Admin Account (created on first startup) ---
$env:APP_BOOTSTRAP_ADMIN_EMAIL    = "admin@example.com"
$env:APP_BOOTSTRAP_ADMIN_PASSWORD = "change-me"

# --- Strava OAuth (optional) ---
# Get these from https://www.strava.com/settings/api
# Leave blank to disable Strava login
$env:STRAVA_CLIENT_ID         = ""
$env:STRAVA_CLIENT_SECRET     = ""
$env:STRAVA_REDIRECT_URI      = "http://localhost:8080/api/auth/strava/callback"
$env:APP_DATA_ENCRYPTION_KEY  = ""   # Required for Strava — use a long random string

# --- Google OAuth (optional) ---
# Get these from https://console.cloud.google.com/
# Leave blank to disable Google login
$env:APP_GOOGLE_CLIENT_ID     = ""
$env:APP_GOOGLE_CLIENT_SECRET = ""
$env:APP_GOOGLE_REDIRECT_URI  = "http://localhost:8080/api/auth/google/callback"

# --- AI Shoe Scanner (optional) ---
# Set APP_AI_API_KEY to enable AI-powered shoe mileage extraction
$env:APP_AI_API_KEY  = ""
$env:APP_AI_MODEL    = "gemini-2.5-flash"
$env:APP_AI_PROVIDER = "gemini"

# ==========================================
#   Start Hermes
# ==========================================
& "$PSScriptRoot\start_hermes.bat"

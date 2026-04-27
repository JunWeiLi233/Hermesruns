# Hermes Local Environment Variables - EXAMPLES
# Copy this file to Hermes.local.env.ps1 and fill in your own keys.
# DO NOT commit your actual Hermes.local.env.ps1 file.

# PostgreSQL
$env:APP_DB_URL = "jdbc:postgresql://localhost:5432/hermes"
$env:APP_DB_DRIVER = "org.postgresql.Driver"
$env:APP_DB_USERNAME = "hermes"
$env:APP_DB_PASSWORD = "set-a-strong-password"
$env:APP_JPA_DDL_AUTO = "update"

# Backend secrets / auth
$env:APP_DATA_ENCRYPTION_KEY = "generate-a-long-random-string-here"
$env:APP_BOOTSTRAP_ADMIN_EMAIL = "admin@local.hermes"
$env:APP_BOOTSTRAP_ADMIN_PASSWORD = "set-a-strong-admin-password"

# Integrations (optional unless you are working on these features)
$env:STRAVA_CLIENT_ID = "your-strava-id"
$env:STRAVA_CLIENT_SECRET = "your-strava-secret"
$env:STRAVA_WEBHOOK_VERIFY_TOKEN = "your-webhook-token"

$env:APP_GOOGLE_CLIENT_ID = "your-google-id"
$env:APP_GOOGLE_CLIENT_SECRET = "your-google-secret"
$env:APP_GOOGLE_REDIRECT_URI = "http://localhost:8080/api/auth/google/callback"

$env:STRIPE_SECRET_KEY = "your-stripe-secret"
$env:STRIPE_WEBHOOK_SECRET = "your-stripe-webhook-secret"

Write-Host "Hermes environment variables loaded from Hermes.local.env.ps1" -ForegroundColor Cyan

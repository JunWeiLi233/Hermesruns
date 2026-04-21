# Hermes Local Environment Variables - EXAMPLES
# Copy this file to Hermes.local.env.ps1 and fill in your own keys.
# DO NOT commit your actual Hermes.local.env.ps1 file.

$env:GEMINI_API_KEY = "your-gemini-api-key-here"
$env:ANTHROPIC_API_KEY = "your-anthropic-api-key-here"

# Backend Secrets
$env:SPRING_DATASOURCE_PASSWORD = "your-local-db-password"
$env:HERMES_JWT_SECRET = "generate-a-long-random-string-here"

# Integrations (Optional for local dev unless working on these features)
$env:STRAVA_CLIENT_ID = "your-strava-id"
$env:STRAVA_CLIENT_SECRET = "your-strava-secret"
$env:STRAVA_WEBHOOK_VERIFY_TOKEN = "your-webhook-token"

$env:GOOGLE_CLIENT_ID = "your-google-id"
$env:GOOGLE_CLIENT_SECRET = "your-google-secret"

$env:STRIPE_SECRET_KEY = "your-stripe-secret"
$env:STRIPE_WEBHOOK_SECRET = "your-stripe-webhook-secret"

Write-Host "Hermes environment variables loaded from Hermes.local.env.ps1" -ForegroundColor Cyan

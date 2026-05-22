# =============================================================================
# Hermes Local Environment Variables - EXAMPLES
# =============================================================================
# Copy this file to Hermes.local.env.ps1 and fill in your own keys.
# DO NOT commit your actual Hermes.local.env.ps1 file.
#
# Run: . .\Hermes.local.env.ps1
# =============================================================================

# -----------------------------------------------------------------------------
# Environment & Security
# -----------------------------------------------------------------------------
# Set to "production" for public-facing deployments (enforces stricter validation).
$env:HERMES_ENV = "development"

# Enforce HTTPS redirects at the app layer (safe behind reverse proxy with TLS).
$env:APP_FORCE_HTTPS = "false"

# Enable HTTP Strict Transport Security (safe behind reverse proxy with TLS).
$env:APP_ENABLE_HSTS = "true"

# Comma-separated CORS origins (e.g. "https://app.example.com"). Leave empty if SPA and API share the same origin.
$env:APP_CORS_ALLOWED_ORIGINS = ""

# Public base URL used for Stripe redirects and self-referencing links.
$env:APP_PUBLIC_BASE_URL = "http://localhost:8080"

# AES encryption key for storing OAuth tokens (Strava/Garmin) and other secrets at rest.
# Generate with: openssl rand -hex 32
$env:APP_DATA_ENCRYPTION_KEY = "generate-a-long-random-hex-string-here"

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
# Default is local H2. For PostgreSQL, provide all five variables.
$env:APP_DB_URL = "jdbc:h2:file:./hermes_db_v2;AUTO_SERVER=TRUE"
# $env:APP_DB_URL = "jdbc:postgresql://localhost:5432/hermes"

$env:APP_DB_DRIVER = "org.h2.Driver"
# $env:APP_DB_DRIVER = "org.postgresql.Driver"

$env:APP_DB_USERNAME = "sa"
$env:APP_DB_PASSWORD = ""

# Hibernate DDL mode: "update" for dev, "validate" for production.
$env:APP_JPA_DDL_AUTO = "update"

# -----------------------------------------------------------------------------
# Admin Bootstrap
# -----------------------------------------------------------------------------
# Creates the initial admin account on first startup. Both must be set to take effect.
$env:APP_BOOTSTRAP_ADMIN_EMAIL = "admin@local.hermes"
$env:APP_BOOTSTRAP_ADMIN_PASSWORD = "set-a-strong-admin-password"

# -----------------------------------------------------------------------------
# Google OAuth 2.0
# -----------------------------------------------------------------------------
# Obtain credentials from https://console.cloud.google.com/apis/credentials
# Fallback aliases also accepted: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
$env:APP_GOOGLE_CLIENT_ID = "your-google-client-id"
$env:APP_GOOGLE_CLIENT_SECRET = "your-google-client-secret"
$env:APP_GOOGLE_REDIRECT_URI = "http://localhost:8080/api/auth/google/callback"

# Google Geocoding API key for marathon route map georeferencing (optional).
# Obtain from https://console.cloud.google.com/apis/credentials
$env:APP_GOOGLE_GEOCODING_API_KEY = "your-google-geocoding-api-key"

# -----------------------------------------------------------------------------
# Strava OAuth 2.0
# -----------------------------------------------------------------------------
# Obtain credentials from https://www.strava.com/settings/api
# Fallback aliases also accepted: APP_STRAVA_CLIENT_ID, APP_STRAVA_CLIENT_SECRET, APP_STRAVA_REDIRECT_URI
$env:STRAVA_CLIENT_ID = "your-strava-client-id"
$env:STRAVA_CLIENT_SECRET = "your-strava-client-secret"
$env:STRAVA_REDIRECT_URI = "http://localhost:8080/api/auth/strava/callback"

# Strava webhook verification token (create via Strava API push_subscriptions).
# In production, must NOT use the default "hermes-strava-webhook".
$env:STRAVA_WEBHOOK_VERIFY_TOKEN = "your-strava-webhook-token"

# Background Strava sync interval in milliseconds (default: 600000 = 10 minutes).
$env:STRAVA_SYNC_INTERVAL_MS = "600000"

# -----------------------------------------------------------------------------
# Stripe Billing (Pro Subscription)
# -----------------------------------------------------------------------------
# Obtain from https://dashboard.stripe.com/apikeys
$env:STRIPE_SECRET_KEY = "your-stripe-secret-key"

# Webhook signing secret from Stripe Dashboard (for POST /api/billing/webhook).
$env:STRIPE_WEBHOOK_SECRET = "your-stripe-webhook-secret"

# One-time Price ID from Stripe Dashboard (e.g. "price_xxxxxxxxxxxxxxxxxxxxx").
$env:STRIPE_PRICE_PRO_MONTHLY = "price_xxxxxxxxxxxxxxxxxxxxx"

# Optional: display label shown in the Profile UI (e.g. "$9 / month" or "¥68/月").
$env:APP_BILLING_PRICE_LABEL = "$9 / month"

# -----------------------------------------------------------------------------
# Email (SMTP for Account Verification)
# -----------------------------------------------------------------------------
# If SPRING_MAIL_HOST is left empty, new password-signup accounts skip inbox verification (dev only).
$env:SPRING_MAIL_HOST = ""
# $env:SPRING_MAIL_HOST = "smtp.gmail.com"

$env:SPRING_MAIL_PORT = "587"
$env:SPRING_MAIL_USERNAME = ""
$env:SPRING_MAIL_PASSWORD = ""

# "From" address on outgoing verification emails.
$env:APP_MAIL_FROM = "noreply@localhost"

# -----------------------------------------------------------------------------
# Garmin Wellness Sync
# -----------------------------------------------------------------------------
# Polls Garmin for daily wellness data (sleep, HRV, stress, body battery).
$env:GARMIN_WELLNESS_SYNC_ENABLED = "true"

# Sync interval in milliseconds (default: 1800000 = 30 minutes).
$env:GARMIN_WELLNESS_SYNC_INTERVAL_MS = "1800000"

# Number of past days to pull on each sync cycle.
$env:GARMIN_WELLNESS_SYNC_DAYS_BACK = "30"

# Number of past days to pull on first-ever sync for a runner.
$env:GARMIN_WELLNESS_SYNC_INITIAL_DAYS_BACK = "90"

# -----------------------------------------------------------------------------
# AI / ML (Gemini Vision for Shoe Scanning & Course Map Analysis)
# -----------------------------------------------------------------------------
# Gemini AI API key for shoe image mileage extraction and cloud-backed course-map scans.
# Obtain from https://aistudio.google.com/apikey
$env:APP_AI_API_KEY = "your-gemini-api-key"

# AI model to use (default: gemini-2.5-flash).
$env:APP_AI_MODEL = "gemini-2.5-flash"

# AI provider (default: gemini).
$env:APP_AI_PROVIDER = "gemini"

# Course map AI provider: "qwen-local" (default, no API key needed) or "gemini" (requires APP_AI_API_KEY).
$env:APP_AI_COURSE_MAP_PROVIDER = "qwen-local"

# Max PDF pages rendered for course map AI scans.
$env:APP_AI_COURSE_MAP_PDF_RENDER_PAGE_LIMIT = "2"

# Free-tier AI usage limits.
$env:APP_AI_FREE_TIER_PER_RUNNER_DAILY_LIMIT = "5"
$env:APP_AI_FREE_TIER_PROJECT_DAILY_LIMIT = "200"
$env:APP_AI_FREE_TIER_PROJECT_DAILY_RESERVE = "20"

# -----------------------------------------------------------------------------
# Marathon Route Extraction (Python + Qwen Pipeline)
# -----------------------------------------------------------------------------
# Python command to invoke the route extraction worker scripts.
$env:APP_ROUTE_EXTRACTION_PYTHON_COMMAND = "python"

# Path to the main route extraction Python script (optional; defaults to internal script).
$env:APP_ROUTE_EXTRACTION_PYTHON_SCRIPT = ""

# Qwen model ID for local structured JSON route extraction.
$env:APP_ROUTE_EXTRACTION_QWEN_MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"

# Device map for Qwen model loading ("auto", "cuda:0", "cpu", etc.).
$env:APP_ROUTE_EXTRACTION_QWEN_DEVICE_MAP = "auto"

# Cache directory for Qwen model weights.
$env:APP_ROUTE_EXTRACTION_QWEN_CACHE_DIR = ""

# Timeout in seconds for Qwen route extraction.
$env:APP_ROUTE_EXTRACTION_QWEN_TIMEOUT_SECONDS = "300"

# Timeout in seconds for Qwen route alignment step.
$env:APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_TIMEOUT_SECONDS = "720"

# Optional: custom Python scripts for route extraction sub-steps.
$env:APP_ROUTE_EXTRACTION_QWEN_PARAMETERS_SCRIPT = ""
$env:APP_ROUTE_EXTRACTION_QWEN_ANCHOR_SCRIPT = ""
$env:APP_ROUTE_EXTRACTION_QWEN_ALIGNMENT_SCRIPT = ""

# -----------------------------------------------------------------------------
# OSRM Map Matching
# -----------------------------------------------------------------------------
# Base URL of the OSRM routing server (default: public Project OSRM instance).
$env:APP_ROUTE_MATCHING_OSRM_BASE_URL = "https://router.project-osrm.org"

# OSRM routing profile: "driving" = road-following, "foot" = footpaths, "bike" = bike paths.
$env:APP_ROUTE_MATCHING_OSRM_PROFILE = "driving"

# -----------------------------------------------------------------------------
# CDN / Digital Cosmetics
# -----------------------------------------------------------------------------
# Base URL for digital cosmetic assets (badge animations, textures).
# Default fallback: "https://cdn.hermes.app/cosmetics"
$env:APP_CDN_BASE_URL = "https://cdn.hermes.app/cosmetics"

# =============================================================================
Write-Host "Hermes environment variables loaded from Hermes.local.env.ps1" -ForegroundColor Cyan

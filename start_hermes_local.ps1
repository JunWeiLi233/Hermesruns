$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$localEnv = Join-Path $Root "Hermes.local.env.ps1"
$exampleEnv = Join-Path $Root "Hermes.local.env.example.ps1"

if (Test-Path -LiteralPath $localEnv) {
    . $localEnv
    Write-Host "[Hermes] Loaded local env from Hermes.local.env.ps1" -ForegroundColor Green
} else {
    Write-Host "[Hermes] Hermes.local.env.ps1 was not found." -ForegroundColor Yellow
    if (Test-Path -LiteralPath $exampleEnv) {
        Write-Host "         Copy Hermes.local.env.example.ps1 to Hermes.local.env.ps1 if you want local OAuth/API keys." -ForegroundColor Yellow
    }
}

if ([string]::IsNullOrWhiteSpace($env:STRAVA_REDIRECT_URI)) {
    $env:STRAVA_REDIRECT_URI = "http://localhost:8080/api/auth/strava/callback"
}

$stravaAnySet = @(
    $env:STRAVA_CLIENT_ID,
    $env:STRAVA_CLIENT_SECRET,
    $env:APP_DATA_ENCRYPTION_KEY
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

if ($stravaAnySet.Count -gt 0) {
    $missing = @()
    if ([string]::IsNullOrWhiteSpace($env:STRAVA_CLIENT_ID)) { $missing += "STRAVA_CLIENT_ID" }
    if ([string]::IsNullOrWhiteSpace($env:STRAVA_CLIENT_SECRET)) { $missing += "STRAVA_CLIENT_SECRET" }
    if ([string]::IsNullOrWhiteSpace($env:APP_DATA_ENCRYPTION_KEY)) { $missing += "APP_DATA_ENCRYPTION_KEY" }

    if ($missing.Count -gt 0) {
        Write-Host "[Hermes] Strava login still needs: $($missing -join ', ')" -ForegroundColor Yellow
    } else {
        Write-Host "[Hermes] Strava login env vars are loaded." -ForegroundColor Green
        Write-Host "[Hermes] Expected Strava redirect URI: $($env:STRAVA_REDIRECT_URI)" -ForegroundColor Green
    }
}

& (Join-Path $Root "start_hermes.bat")

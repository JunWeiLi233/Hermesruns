# Hermes iOS app

This directory contains the native SwiftUI client for Hermesruns.

## Open and run

1. Open `HermesRuns.xcodeproj` on macOS with Xcode 15 or newer.
2. Select the `HermesRuns` scheme and an iOS 16+ simulator.
3. Run the app. The sign-in screen defaults to `http://localhost:8080`, matching the local Hermes backend.
4. For a physical device, enter the HTTPS URL of a reachable Hermes deployment in the sign-in or Settings screen.

The app uses the existing Spring Boot API. Runner session tokens are stored in the iOS Keychain, and the API base URL is stored in `UserDefaults` so local development settings do not become source code.

## Current native surface

- Sign in and secure session restore
- Today Run readiness, workout blueprint, coach message, recommended shoe, and recent runs
- Read-only run history
- Run detail summaries with route maps, post-run debrief, lap, telemetry, and training-effect signals
- Shoe rotation and mileage with add, edit, and retire actions
- More tab with Analysis (using `/api/activities/analysis` when available), Schedule, Races with add/edit/delete actions plus verified course-map/elevation previews when available, Wellness injury-risk and soreness check-ins, Strava connection and sync, Weather, Rewards, Profile, and runner strength planning
- Native GPX, TCX, FIT, and ZIP workout import through the authenticated batch endpoint; files are read for upload only and are not persisted by the app
- Profile settings with authenticated display-name updates, a bounded training mantra, and weekly digest preference sync
- API connection settings and sign out

Admin operations, GPS heatmaps, race planning, elevation recalibration, and run deletion remain follow-up native surfaces; the web app remains the source of truth for those features.

# Hermesruns Native iOS Companion Design

## Goal

Create a native SwiftUI iOS client for the Hermesruns runner loop so a runner can sign in, see today's coached decision, review recent runs, inspect shoe rotation, and manage the API connection from an iPhone.

## Scope

The first native slice includes:

- email/password sign-in against the existing `POST /api/auth/login` endpoint;
- secure session persistence in iOS Keychain;
- Today dashboard backed by `GET /api/today/dashboard`;
- readiness, workout blueprint, coach message, recommended shoe, and recent run summaries;
- read-only Runs and Shoes tabs;
- a More tab with read-only Analysis, Schedule, Races, Weather, Rewards, and Profile views;
- connection settings, refresh, and sign-out.

Admin routes, OAuth flows, file imports, GPS heatmaps, race maps/planning, and editing shoe inventory remain follow-up slices. The iOS app does not reimplement Hermes analytics; it consumes the existing backend contracts and labels derived mobile summaries as read-only.

## Architecture

The app is an iOS 16 SwiftUI application with a small dependency graph: `SessionStore` owns authentication and dashboard state, `HermesAPIClient` owns HTTP and JSON decoding, and focused views render the state. Tokens live in Keychain; the editable API base URL lives in `UserDefaults` so local development can target a Mac-hosted Hermes backend. The client sends the current language through `Accept-Language` and treats loading, empty, unauthorized, and network-error states explicitly.

## Visual direction

Adapt Hermes's Kinetic Editorial system to mobile: warm paper background, charcoal text, coral for the primary coached decision, mint for healthy readiness, rounded tonal cards instead of divider-heavy containers, and a compact tab shell. The first focus is always today's decision, followed by supporting run and shoe context.

## Data flow

1. `LoginView` submits email/password to `HermesAPIClient.login`.
2. `SessionStore` stores the returned token in Keychain and loads the Today dashboard.
3. `MainTabView` renders the current snapshot; pull-to-refresh calls the aggregate endpoint, refreshes canonical analysis summaries, and refreshes the 14-day Coach schedule.
4. A 401 clears Keychain state and returns the app to login.
5. Settings can update the base URL, which clears cached dashboard state and reloads on the next authenticated request.

## Verification

- the Node scaffold contract test must pass;
- the Xcode project must contain all Swift sources and iOS 16 build settings, including the More-tab destinations;
- when XcodeBuildMCP or macOS is available, build and run on an iOS simulator and inspect the initial UI;
- on this Windows checkout, report that native compilation/simulator proof is unavailable if the required Apple toolchain is absent.

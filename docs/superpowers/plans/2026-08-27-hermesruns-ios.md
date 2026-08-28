# Hermesruns Native iOS Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a buildable iOS 16 SwiftUI companion for Hermesruns's authenticated runner workflow.

**Architecture:** A hand-authored Xcode application target contains a SwiftUI shell, a Keychain-backed `SessionStore`, a `HermesAPIClient` aligned to the existing Spring Boot JSON contracts, and focused Today/Runs/Shoes/More views with read-only runner-tool destinations. No backend analytics are duplicated.

**Tech Stack:** Swift 5.9+, SwiftUI, Foundation, Security, URLSession, Xcode project format, iOS 16 minimum.

---

### Task 1: Scaffold and project wiring

**Files:**
- Create: `ios/HermesRuns.xcodeproj/project.pbxproj`
- Create: `ios/HermesRuns/Resources/Info.plist`
- Create: `ios/HermesRuns/HermesRunsApp.swift`
- Test: `ios/validate-ios-scaffold.mjs`

- [x] Add the iOS application target with iOS 16 settings, bundle identifier `com.hermesruns.ios`, SwiftUI entry point, and local-network ATS allowance.
- [x] Run `node ios/validate-ios-scaffold.mjs` and confirm it is green.

### Task 2: Domain, networking, and secure session

**Files:**
- Create: `ios/HermesRuns/Models/HermesModels.swift`
- Create: `ios/HermesRuns/Networking/HermesAPIClient.swift`
- Create: `ios/HermesRuns/Storage/KeychainStore.swift`
- Create: `ios/HermesRuns/Stores/SessionStore.swift`

- [x] Decode the existing auth, Today dashboard, coach, activity, shoe, race, and weather fields as optional-safe Swift models.
- [x] Implement JSON HTTP requests with bearer auth, `Accept-Language`, 401 handling, and user-readable errors.
- [x] Persist only the session token and email in Keychain; persist the configurable API URL separately.
- [x] Re-run the scaffold contract after the sources are present.

### Task 3: Native runner shell and screens

**Files:**
- Create: `ios/HermesRuns/Theme/HermesTheme.swift`
- Create: `ios/HermesRuns/Views/RootView.swift`
- Create: `ios/HermesRuns/Views/LoginView.swift`
- Create: `ios/HermesRuns/Views/MainTabView.swift`
- Create: `ios/HermesRuns/Views/TodayView.swift`
- Create: `ios/HermesRuns/Views/RunsView.swift`
- Create: `ios/HermesRuns/Views/ShoesView.swift`
- Create: `ios/HermesRuns/Views/MoreView.swift`
- Create: `ios/HermesRuns/Views/AnalysisView.swift`
- Create: `ios/HermesRuns/Views/ScheduleView.swift`
- Create: `ios/HermesRuns/Views/RacesView.swift`
- Create: `ios/HermesRuns/Views/WeatherView.swift`
- Create: `ios/HermesRuns/Views/RewardsView.swift`
- Create: `ios/HermesRuns/Views/ProfileView.swift`
- Create: `ios/HermesRuns/Views/SettingsView.swift`

- [x] Wire loading, authenticated, empty, error, and sign-out states.
- [x] Make Today the first focus with readiness ring, plan, coach message, recommended shoe, and recent-run context.
- [x] Add accessible tab labels, refresh action, and API URL settings.
- [x] Add read-only runner-tool destinations for analysis, schedule, races, weather, rewards, and profile.
- [x] Use preview fixtures without mixing mock data into production network state.

### Task 4: Verification and handoff

- [x] Run the scaffold contract and inspect whitespace/Info.plist structure for the new files.
- [x] Check for `xcodebuild`/XcodeBuildMCP availability; the current Windows host has neither `xcodebuild` nor `xcrun`, so simulator build is pending on macOS/Xcode.
- [x] Report native build limitations honestly when running on Windows without Apple's toolchain.

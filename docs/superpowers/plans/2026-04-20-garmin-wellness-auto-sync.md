# Garmin Connect Wellness Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import full wellness data from Garmin Connect (sleep, HRV, stress, SpO2, body composition, steps, training readiness) and auto-sync daily, feeding the coaching engine.

**Architecture:** Extend the existing Python bridge pattern. New `.tools/garmin_wellness_download.py` uses garth's data modules to fetch daily wellness data. New `GarminWellnessImportService.java` calls it, persists to 5 new JPA entities, and updates `CoachRunnerState`. New `GarminWellnessSyncScheduler` runs periodic auto-sync. Runner entity stores encrypted Garmin credentials for scheduled sync. Frontend Settings page gets wellness sync controls.

**Tech Stack:** Java/Spring (JPA entities, services, scheduler), Python/garth (wellness fetch), React/i18n (frontend)

---

## File Structure

### New Files
- `.tools/garmin_wellness_download.py` — Python wellness data fetcher using garth
- `backend/src/main/java/com/hermes/backend/DailyWellnessSummary.java` — JPA entity
- `backend/src/main/java/com/hermes/backend/DailySleepData.java` — JPA entity
- `backend/src/main/java/com/hermes/backend/DailyHRVData.java` — JPA entity
- `backend/src/main/java/com/hermes/backend/DailyStressData.java` — JPA entity
- `backend/src/main/java/com/hermes/backend/BodyCompositionData.java` — JPA entity
- `backend/src/main/java/com/hermes/backend/DailyWellnessSummaryRepository.java`
- `backend/src/main/java/com/hermes/backend/DailySleepDataRepository.java`
- `backend/src/main/java/com/hermes/backend/DailyHRVDataRepository.java`
- `backend/src/main/java/com/hermes/backend/DailyStressDataRepository.java`
- `backend/src/main/java/com/hermes/backend/BodyCompositionDataRepository.java`
- `backend/src/main/java/com/hermes/backend/GarminWellnessImportService.java`
- `backend/src/main/java/com/hermes/backend/GarminWellnessSyncScheduler.java`

### Modified Files
- `backend/src/main/java/com/hermes/backend/Runner.java` — add Garmin credential fields
- `backend/src/main/java/com/hermes/backend/RunnerRepository.java` — add Garmin query methods
- `backend/src/main/java/com/hermes/backend/GarminConnectController.java` — add wellness endpoints
- `backend/src/main/resources/application.properties` — add Garmin wellness config
- `.tools/requirements-garmin.txt` — pin garth version
- `frontend/src/pages/Settings.jsx` — add wellness sync UI
- `frontend/src/i18n/translations.js` — add i18n keys
- `frontend/src/styles/style.css` — add wellness sync styles

---

## Task 1: Create JPA Entities and Repositories

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/DailyWellnessSummary.java`
- Create: `backend/src/main/java/com/hermes/backend/DailySleepData.java`
- Create: `backend/src/main/java/com/hermes/backend/DailyHRVData.java`
- Create: `backend/src/main/java/com/hermes/backend/DailyStressData.java`
- Create: `backend/src/main/java/com/hermes/backend/BodyCompositionData.java`
- Create: `backend/src/main/java/com/hermes/backend/DailyWellnessSummaryRepository.java`
- Create: `backend/src/main/java/com/hermes/backend/DailySleepDataRepository.java`
- Create: `backend/src/main/java/com/hermes/backend/DailyHRVDataRepository.java`
- Create: `backend/src/main/java/com/hermes/backend/DailyStressDataRepository.java`
- Create: `backend/src/main/java/com/hermes/backend/BodyCompositionDataRepository.java`

- [ ] **Step 1:** Create the 5 JPA entities following the project's entity patterns (see `Activity.java` for style). Each entity has: `id` (Long PK), `runner` (FK to Runner), `date` (LocalDate), `provider` (ImportProvider), `sourceChecksum` (String), plus the specific metric fields from the design. Each has a unique constraint on `(runner_id, provider, date)`. Use Jakarta persistence annotations. Follow the existing getter/setter pattern.

- [ ] **Step 2:** Create the 5 Spring Data JPA repository interfaces extending `JpaRepository`. Each repository needs a method: `Optional<T> findByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date)` and `boolean existsByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date)`. Also add date-range queries: `List<T> findByRunnerAndDateBetweenOrderByDateDesc(Runner runner, LocalDate start, LocalDate end)`.

- [ ] **Step 3:** Run `cd backend && ./mvnw -q -DskipTests compile` to verify entities and repositories compile.

---

## Task 2: Add Garmin Credential Fields to Runner Entity

**Files:**
- Modify: `backend/src/main/java/com/hermes/backend/Runner.java`
- Modify: `backend/src/main/java/com/hermes/backend/RunnerRepository.java`

- [ ] **Step 1:** Add to Runner.java: `garminConnectEmail` (String), `garminConnectPasswordEncrypted` (String, @JsonProperty WRITE_ONLY), `garminConnectTokenEncrypted` (String, @JsonProperty WRITE_ONLY), `garminWellnessSyncEnabled` (Boolean, @ColumnDefault("false")), `garminWellnessLastSyncedAt` (LocalDateTime). Add getters/setters. The `garminConnectPasswordEncrypted` stores the garth session token encrypted via SecretEncryptionService.

- [ ] **Step 2:** Add to RunnerRepository.java: `List<Runner> findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse()` for the scheduler.

- [ ] **Step 3:** Add to application.properties: `garmin.wellness.sync.enabled=${GARMIN_WELLNESS_SYNC_ENABLED:true}`, `garmin.wellness.sync.interval-ms=${GARMIN_WELLNESS_SYNC_INTERVAL_MS:1800000}`, `garmin.wellness.sync.days-back=${GARMIN_WELLNESS_SYNC_DAYS_BACK:30}`.

- [ ] **Step 4:** Run `cd backend && ./mvnw -q -DskipTests compile` to verify.

---

## Task 3: Create Python Wellness Download Script

**Files:**
- Create: `.tools/garmin_wellness_download.py`
- Modify: `.tools/requirements-garmin.txt`

- [ ] **Step 1:** Create `.tools/garmin_wellness_download.py` following the pattern of the existing `garmin_connect_download.py`. The script accepts JSON on stdin with `{email, password, start_date, end_date}`. Uses garth to authenticate, then fetches: daily summaries, sleep data, HRV data, stress data, and body composition data for each day in the date range. Returns JSON on stdout with `{success: true, days: [{date, wellness: {}, sleep: {}, hrv: {}, stress: {}, body: {}}, ...]}`. Use garth's `data` modules: `DailySummary`, `SleepData`/`DailySleepData`, `HRVData`/`DailyHRV`, stress via `DailySummary` stress fields, weight via `WeightData.list()`. Handle individual day failures gracefully (skip the day, continue).

- [ ] **Step 2:** Update `.tools/requirements-garmin.txt` to `garth>=0.6.0` (ensure the wellness data modules are available).

- [ ] **Step 3:** Test the Python script manually (or at least verify it imports and has correct structure): `cd .tools && python -c "import garmin_wellness_download"` to check for syntax errors.

---

## Task 4: Create GarminWellnessImportService

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/GarminWellnessImportService.java`

- [ ] **Step 1:** Create `GarminWellnessImportService.java` modeled on `GarminConnectImportService.java`. It should:
  - Accept `Runner`, `String email`, `String password`, `int daysBack` params
  - Use a per-runner `ConcurrentHashMap<Long, WellnessSyncTracker>` for status tracking (same pattern as `GarminSyncTracker`)
  - Call `.tools/garmin_wellness_download.py` via `callPythonWellnessDownloader(email, password, startDate, endDate)`
  - Parse the JSON response and upsert into the 5 wellness entities using the repository `findByRunnerAndProviderAndDate()` pattern (update if exists, create if not)
  - After persisting, call `updateCoachRunnerStateFromWellness(runner, latestDay)` to update `CoachRunnerState.lastNightRestingHr`, `lastSleepScore`, `lastHrvMs` from the most recent day's data
  - Use `SecretEncryptionService` to encrypt/decrypt the garth session token on the Runner entity
  - Reuse the same `resolveScript()` pattern from the activity import service
  - Include `@Scheduled cleanupStaleSyncTrackers()` (same 10-min/30-min pattern)
  - Include `WellnessSyncStatus` record and `WellnessSyncTracker` inner class

- [ ] **Step 2:** Run `cd backend && ./mvnw -q -DskipTests compile` to verify.

---

## Task 5: Create GarminWellnessSyncScheduler

**Files:**
- Create: `backend/src/main/java/com/hermes/backend/GarminWellnessSyncScheduler.java`

- [ ] **Step 1:** Create `GarminWellnessSyncScheduler.java` following `StravaAutoSyncScheduler.java`. It should:
  - Use `@Scheduled(fixedDelayString = "${garmin.wellness.sync.interval-ms:1800000}", initialDelay = 180_000)` — default 30 minutes, 3-minute startup delay
  - Check `garmin.wellness.sync.enabled` config before proceeding
  - Query `runnerRepository.findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse()`
  - For each runner: decrypt credentials, call `garminWellnessImportService.startWellnessImport(runner, email, decryptedPassword, daysBack)` where `daysBack` defaults to 7 (incremental) but 30 on first sync (when `garminWellnessLastSyncedAt` is null)
  - Use `AdminBackgroundJobService` for tracking (same pattern as Strava scheduler)
  - On success, update `runner.setGarminWellnessLastSyncedAt(LocalDateTime.now())`

- [ ] **Step 2:** Run `cd backend && ./mvnw -q -DskipTests compile` to verify.

---

## Task 6: Add Wellness Endpoints to GarminConnectController

**Files:**
- Modify: `backend/src/main/java/com/hermes/backend/GarminConnectController.java`

- [ ] **Step 1:** Add 3 endpoints to `GarminConnectController`:
  1. `POST /api/garmin/connect/wellness/import` — accepts `{daysBack: 7}` (default 7, max 365). Authenticates via Authorization header. Decrypts Runner's stored Garmin credentials. Starts async wellness import via `GarminWellnessImportService`. Returns 409 if import already running. Also stores/saves Garmin credentials if the request includes `garminEmail`/`garminPassword` (first-time setup or credential update).
  2. `GET /api/garmin/connect/wellness/status` — returns wellness import status for the authenticated runner.
  3. `POST /api/garmin/connect/wellness/toggle` — accepts `{enabled: true/false}` to toggle auto-sync. Updates `runner.garminWellnessSyncEnabled`. Encrypts and stores credentials when enabling.

  Also add a `PUT /api/garmin/connect/wellness/credentials` endpoint for updating stored Garmin Connect credentials (email + password, encrypted).

- [ ] **Step 2:** Inject `GarminWellnessImportService`, `SecretEncryptionService`, and `RunnerRepository` into the controller.

- [ ] **Step 3:** Run `cd backend && ./mvnw -q -DskipTests compile` to verify.

---

## Task 7: Frontend — Wellness Sync UI in Settings

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/i18n/translations.js`
- Modify: `frontend/src/styles/style.css`

- [ ] **Step 1:** Add i18n keys in both `en` and `zh-CN` sections of translations.js for the wellness sync UI: `garmin_wellness_title`, `garmin_wellness_desc`, `garmin_wellness_enable`, `garmin_wellness_disable`, `garmin_wellness_sync_now`, `garmin_wellness_syncing`, `garmin_wellness_last_synced`, `garmin_wellness_days_back`, `garmin_wellness_success`, `garmin_wellness_failed`, `garmin_wellness_no_data`, `garmin_wellness_already_running`.

- [ ] **Step 2:** Add a "Wellness Sync" section to the Garmin lane in Settings.jsx. It should show: a toggle for auto-sync (on/off), a "Sync Now" button that triggers `POST /api/garmin/connect/wellness/import` with `{daysBack: 30}`, and a status display that polls `GET /api/garmin/connect/wellness/status` during active imports. Show last synced time when idle. The wellness section should appear below the existing activity import section in the same Garmin lane.

- [ ] **Step 3:** Add CSS for the wellness sync controls (`.garmin-wellness-*` classes) following the existing `.garmin-import-*` pattern in style.css.

- [ ] **Step 4:** Run `cd frontend && npm run lint && npm run build` to verify.

---

## Verification

- [ ] Full backend compile: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Frontend build: `cd frontend && npm run lint && npm run build`
- [ ] Verify entities are auto-created by Hibernate ddl-auto
- [ ] Manual smoke: Start the app, check that the Settings page shows the wellness sync section beneath the existing Garmin activity import
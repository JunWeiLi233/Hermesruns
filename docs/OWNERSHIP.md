# Ownership map - where to change X

Human-readable map of Hermes surfaces → source files. Prefer this over archaeology in `git log`.

RFC-014. Keep sections short: **Change this → edit these files** + one-line why.

---

## Frontend

Paths are relative to the repo root. Feature pages live under `frontend/src/pages/<feature>/` (see also `frontend/src/pages/README.md` and `docs/architecture/frontend-route-structure.md`).

### App entry / router

| Change this | Edit these files | Why |
|---|---|---|
| Route table / lazy page mounts | `frontend/src/App.jsx`, `frontend/src/utils/routePreload.js` | `App.jsx` owns `<Routes>`; `routePreload.js` is the shared lazy/preload map so hover prefetch hits the same chunk loaders. |
| Boot / providers | `frontend/src/main.jsx`, `frontend/src/contexts/{Auth,I18n,Theme,Unit}Context.jsx` | Providers wrap the tree; keep auth/i18n/theme/units out of page components. |
| Route-loading skeleton gate | `frontend/src/App.jsx` (`RouteLoading`, `RouteStyleGate`), `frontend/src/components/PageSkeleton.jsx` | Suspense + style-gate show `PageSkeleton` before lazy CSS/JS settle. |

### Profile dashboard + wake fan-out / AbortController / cachedApiJson

| Change this | Edit these files | Why |
|---|---|---|
| Profile first-paint data fan-out | `frontend/src/pages/profile/ProfileDashboard.jsx` (re-exported by `Profile.jsx`) | Happy-path first paint goes through `/api/profile/dashboard` (+ TTL/`cachedApiJson`); idle hooks defer weekly-digest / full-history. |
| Shared AbortController on Profile batch | `frontend/src/pages/profile/ProfileDashboard.jsx` | Abort + timeout race is scoped to Profile dashboard first-paint - do not expand abort-sharing to other pages without an explicit RFC. |
| Cross-page GET dedupe / TTL | `frontend/src/api/resourceCache.ts` | `cachedApiJson` + prefix TTLs collapse remount stampedes for profile/activities hot reads. |
| Profile wake-fan-out smoke | `frontend/src/pages/profile/__tests__/profileWakeFanout.smoke.test.js` (+ `feWakeFanout2.smoke.test.js` when present) | Guards batch-first, idle deferrals, and `cachedApiJson` wiring. |

### Analysis page + deferred enrichment

| Change this | Edit these files | Why |
|---|---|---|
| Analysis first paint (profile + activities) | `frontend/src/pages/analysis/Analysis.jsx` | Hot path uses `cachedApiJson` for `/api/profile/me` + `/api/activities/analysis`. |
| Deferred coach / injury enrichment | `frontend/src/pages/analysis/Analysis.jsx` (`requestIdleCallback` / idle schedule) | Coach + injury-risk are wake-amplifying; idle them so first paint stays light. |
| Insight sub-routes | `frontend/src/pages/analysis/AnalysisInsightDetail.jsx`, route entries in `App.jsx` / `routePreload.js` | Per-insight deep links stay in the analysis feature folder. |

### Runs list + route-previews idle

| Change this | Edit these files | Why |
|---|---|---|
| Runs list fetch / sort / cards | `frontend/src/pages/runs/Runs.jsx` | List paint uses `cachedApiJson('/api/activities')` then normalizes to an array before sort/render. |
| Route-preview batch (idle) | `frontend/src/pages/runs/Runs.jsx` (`requestRoutePreviews` + idle effect) | `/api/activities/route-previews` is scheduled post-paint via `requestIdleCallback` so it does not contend with cold-wake list paint. |
| Runs helpers / cache helpers | `frontend/src/pages/runs/runsCache.ts`, `runsRequestCoordinator.ts`, `runsLoadMore.ts` | Keep list pagination/cache coordination out of the JSX monolith when possible. |
| Run detail | `frontend/src/pages/runs/RunDetail.jsx` | Per-activity surface (incl. Strava sync UX). |
| Run pace analysis (pace chart, grade-adjusted pace, time at each pace) | `frontend/src/pages/runs/RunPaceAnalysis.jsx` (the `#run-detail-pace` section), `PaceChart.jsx` (SVG chart), `PaceDistribution.jsx`, `usePaceProfile.js`, `usePaceZones.js`, `useRunResource.js`; pure helpers in `frontend/src/utils/paceAnalysis.js` | The card fetches `GET /api/activities/{id}/pace-profile` itself, and only once `RunDetail.jsx` has finished asking for the run's stream (`streamReady`), because for a Strava run that request is what fetches the stream. `RunDetail.jsx` owns just that flag and the refresh after an elevation recalibration. |
| Run effort score, rating and heart-rate zones | `frontend/src/pages/runs/RunTrainingCards.jsx` (the `#run-detail-effort` section), `RunEffortCard.jsx`, `RunZonesCard.jsx`, `useTrainingMetrics.js`; shared words in `frontend/src/components/heartRateZoneLabels.js`, math in `frontend/src/utils/heartRateZones.js` | The cards fetch `GET /api/activities/{id}/training-metrics` themselves, so `RunDetail.jsx` gains no request of its own; keep it that way. |
| Run best efforts (fastest stretch of each distance, place, chip time, hide) | `frontend/src/pages/runs/RunBestEfforts.jsx` (the `#run-detail-efforts` section), `useRunBestEfforts.js`, `useRunResource.js`; words in `frontend/src/components/bestEffortLabels.js`, helpers in `frontend/src/utils/bestEfforts.js` | Fetches `GET /api/activities/{id}/best-efforts` itself, once `RunDetail.jsx` has the run's stream (`streamReady`), and sends `PATCH /api/activities/{id}/best-efforts/{distanceKey}` for a chip time or hiding. `RunDetail.jsx` gains no request of its own; keep it that way. |
| Run same-route runs (pace over time against the runs over the same route) | `frontend/src/pages/runs/RunMatches.jsx` (the `#run-detail-matches` section), `useRunMatches.js`; chart geometry in `frontend/src/utils/matchesChart.js` | Fetches `GET /api/activities/{id}/matches` itself, once the stream is there. The section stays on the page, with its anchor, when the run is the only one of its route. |
| Profile best efforts analysis | `frontend/src/pages/profile/BestEffortsAnalysis.jsx`, `useBestEffortsAnalysis.js` (styles under `hd-records` in `_split/profile-dashboard-redesign.css`) | Makes no request until the runner opens it, so the Profile page's first paint (pinned by `profileWakeFanout.smoke.test.js`) is unchanged; then `GET /api/training/best-efforts[?distance=&year=]`. |
| Heart-rate zone settings | `frontend/src/components/SettingsTrainingZones.jsx` (the Settings "Training" tab, loaded when the tab first opens), tab list in `SettingsAtlasLayout.jsx`, `?section=training` in `pages/settings/Settings.jsx` | Talks to `GET`/`PUT /api/training/zones`; the run page's "Edit zones" link opens it. |
| Run type and tags (the run page's "Type and tags" card) | `frontend/src/pages/runs/RunLabelsCard.jsx` (one card in the run page's side column), `useRunLabels.js` (the read), `useRunLabelEditor.js` (every change saved at once, one request at a time and in order, shown before the server answers), the tag rules in `frontend/src/utils/runLabels.js`; styles in `frontend/src/styles/run-labels-v2.css` | The card fetches `GET /api/activities/{id}/labels` and saves with `PATCH /api/activities/{id}` itself, so `RunDetail.jsx` gains one line and no request; keep it that way. The limits (6 tags, 24 characters) come from the server's answer. |
| Training log (`/training-log`) | `frontend/src/pages/training-log/TrainingLog.jsx` (the page), `LogWeek.jsx`, `LogFilters.jsx`, `useTrainingLog.js` (twelve weeks at a time, earlier ones on request); helpers in `frontend/src/utils/trainingLog.js`; styles in `frontend/src/styles/training-log-v2.css`; it sits in the shared shell `components/AuthenticatedPageChrome.jsx` (given a title, a parent and a sidebar item to mark) | The filters live in the address (`?runType=RACE&tag=hills`). A new page also needs its route in `infrastructure/web/SpaForwardingController.java`, or a refresh on it gets the API's 401 (`SpaForwardingControllerTests`, `trainingLogWiring.smoke.test.js`). |
| Fitness, fatigue and form, and the weekly effort (Load balance page) | `frontend/src/pages/analysis/FitnessFormSection.jsx` (the `#load-fitness` card), `WeeklyEffortSection.jsx` (the `#load-weekly-effort` card), `useTrainingSeries.js`, `useWeeklyEffort.js`, `useScrubber.js` (pointer, touch and arrow keys); chart geometry in `frontend/src/utils/fitnessChart.js` and `weeklyEffortChart.js`; styles at the end of `frontend/src/styles/analysis-load-balance-v2.css` | The two cards fetch `GET /api/training/series` and `GET /api/training/weekly-effort` themselves, once the page has its runs, so `AnalysisInsightDetail.jsx` gains two lines (the cards) and no request; keep it that way. Not the acute and chronic chart above them: that is a different scale. |

### API client (`api.ts` / wake retry / resourceCache)

| Change this | Edit these files | Why |
|---|---|---|
| HTTP client, wake retry, `apiJson` / `apiFetch` | `frontend/src/api.ts` | Railway cold-start wake: safe-method retries, `subscribeWakeRetry`, `withWakeRetry` - never blindly retry POST/PUT/PATCH/DELETE. |
| TTL + inflight dedupe | `frontend/src/api/resourceCache.ts` | Layer on top of `apiJson`; prefix TTLs + inflight map. |
| Activity-specific API helpers | `frontend/src/api/activityApi.ts` | Typed activity helpers kept separate from the generic client. |
| Wake-retry unit tests | `frontend/src/apiWakeRetry.vitest.ts` | Covers status/network classification and retry delays. |

### PageSkeleton / waking note i18n

| Change this | Edit these files | Why |
|---|---|---|
| Skeleton variants / layout | `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css` | Route-shaped placeholders; CSS must load before lazy page styles. |
| “Waking the server...” note | `PageSkeleton.jsx` (`WakeRetryNote` + `subscribeWakeRetry`), `frontend/src/i18n/locales/en/common.js`, `frontend/src/i18n/locales/zh-CN/common.js` (`common.waking_server`) | Note tracks wake-retry depth from `api.ts`; copy is locale-keyed. |

### i18n locales (en / zh-CN)

| Change this | Edit these files | Why |
|---|---|---|
| User-visible copy | `frontend/src/i18n/locales/en/*.js` **and** `frontend/src/i18n/locales/zh-CN/*.js` (same key) | Edit both locales together; `en.js` / `zh-CN.js` are re-export shims. |
| Locale registry / runtime | `frontend/src/i18n/localeRegistry.js`, `frontend/src/i18n/translationRuntime.js`, `frontend/src/contexts/I18nContext.jsx` | Supported locales, lazy message loading, `t()`. |
| Translation check | `tools/check-translations.mjs` (repo root) | CI/full parity gate for en ↔ zh-CN. |

### Auth / shell chrome

| Change this | Edit these files | Why |
|---|---|---|
| Auth session / Strava sync poll | `frontend/src/contexts/AuthContext.jsx` | Token hydration, role, Strava sync completion events. |
| Login / signup / forgot-password | `frontend/src/pages/auth/{Login,Signup,ForgotPassword}.jsx`, `frontend/src/components/AuthPageLayout.jsx` | Auth-route pages + shared layout. |
| Runner shell chrome (sidebar / top nav / footer) | `frontend/src/components/AuthenticatedPageChrome.jsx`, `RunnerShellTopNav.jsx`, `MobileRunnerNavigation.jsx`, `FooterNavLinks.jsx` | Authenticated frame around runner pages; chrome may `cachedApiJson('/api/profile/me')`. |

### Key smokes

| Smoke | Path | Guards |
|---|---|---|
| `profileWakeFanout` | `frontend/src/pages/profile/__tests__/profileWakeFanout.smoke.test.js` | Profile batch-first + `cachedApiJson` / idle fan-out contracts. |
| `apiWakeRetry` | `frontend/src/apiWakeRetry.vitest.ts` | Wake retry helpers + safe-method / status classification. |
| `loadingSkeleton` | `frontend/src/test/contracts/loadingSkeleton.smoke.test.js` | `PageSkeleton` CSS import + route→variant mapping used by `App.jsx`. |

### Quick “I need to...” cheat sheet

- **Add a route** → page under `frontend/src/pages/<feature>/`, register in `App.jsx` + `utils/routePreload.js`.
- **Cut wake/first-paint API fan-out** → prefer `cachedApiJson` + idle deferral in the page; keep AbortController sharing on Profile dashboard unless a new RFC expands it.
- **Change a label** → `i18n/locales/en/` + `zh-CN/` same key.
- **Fix cold-start spinner copy** → `common.waking_server` + `PageSkeleton` `WakeRetryNote`.

---

## Backend

Java / Spring Boot under `backend/src/main/java/com/hermes/backend/`. Only `BackendApplication` and `StartupPhaseDiagnosticsLogger` sit at the package root; everything else is a domain (or `infrastructure/*`) package. Tests mirror the same tree under `backend/src/test/java/com/hermes/backend/`. See also `docs/architecture/backend-package-migration.md` and `docs/architecture/repository-layout.md`.

**Source for this map:** `com.hermes.backend` package tree as of GitHub `master` / local mirror (≈412 `.java` files). Sleep-profile knobs below also reflect the post-#111 `coach-enabled` wake gate when present on the working tree.

### Packages under `com.hermes.backend`

| Package | Role (one line) | Notable types |
|---|---|---|
| *(root)* | Boot + startup timeline | `BackendApplication`, `StartupPhaseDiagnosticsLogger` |
| `activity` | Activities API, telemetry, analytics, JDBC data access, deleted-run tombstones, deletion hooks, pace profile, best efforts and same-route runs | `ActivityController`, `ActivityRepository`, `ActivityDataAccess`, `DeletedActivityTombstone`, `ActivityDeletionHook`, `BestEffortService`, `RouteMatchService`, `RunRecordsController` |
| `admin` | Operator HTTP, audit, background jobs, portals | `AdminController`, `AdminPortalService`, `AdminBackgroundJobService`, `ConfigStatusController` |
| `auth` | Login, JWT, OAuth, filters, rate limits, encryption | `LoginController`, `OAuthController`, `SecurityConfig`, `AuthService`, `JwtAuthenticationFilter` |
| `auth.mfa` | Admin passkeys / MFA challenges / recovery | `AdminMfaController`, `AdminMfaService`, `AdminWebAuthnService` |
| `billing` | Stripe checkout/webhook, AI quotas | `BillingController`, `QuotaService`, `AiUsageService` |
| `coaching` | Plans, readiness, wellness, injury risk, nightly 80/20, per-run effort and heart-rate zone time | `CoachController`, `AutomatedCoachService`, `Coach8020NightlyScheduler`, `ReadinessService`, `WellnessController`, `TrainingMetricsService`, `EffortModel`, `HrZoneAnalysis` |
| `imports` | Strava/Garmin/health sync + FIT/GPX/TCX ingest | `StravaAutoSyncScheduler`, `GarminWellnessSyncScheduler`, `StravaWebhookController`, `ImportController`, `GarminConnectController` |
| `infrastructure.bootstrap` | Explicit local shared-runner seed | `LocalSharedRunnerBootstrapConfiguration` |
| `infrastructure.cache` | TTL / Redis / fixed-window stores | `TtlCacheStore`, `AppRedisProperties` |
| `infrastructure.config` | Jackson + configured-provider status | `JacksonConfig`, `SystemConfigService` |
| `infrastructure.diagnostics` | DB/security startup + local console errors | `DatabaseDiagnosticsInitializer`, `LocalConsoleErrorController` |
| `infrastructure.mail` | Transactional mail (Resend) | `ResendTransactionalMailSender` |
| `infrastructure.web` | CORS, SPA forward, sanitizers, safe URL exec | `AppCorsConfig`, `SpaForwardingController`, `SafeUrlExecutor` |
| `races` | Saved races, official courses, map extraction | `MarathonRoutePipelineService`, course catalogs, `OfficialCourseStartupSeedConfiguration` |
| `races.model` | Shared race/course DTOs (no orchestration deps) | `RaceEventRequest`, `CourseMapCandidate`, ... |
| `rewards` | Digital cosmetics | `DigitalCosmeticsController`, `DigitalCosmeticsService` |
| `routing` | Route planner + map-tile proxy/cache | `MapTileController`, `MapTileService`, `RoutePlannerController` |
| `runner` | Profile, avatar, heatmap, weekly digest, account export and deletion, heart-rate zones | `ProfileController`, `ProfileApplicationService`, `WeeklyDigestController`, `AccountController`, `AccountDeletionService`, `TrainingZonesService`, `HeartRateZones` |
| `runtime` | Railway **sleep** profile: wake catch-up only | `SleepModeConfiguration`, `SleepWakeCatchUp` |
| `shoes` | Inventory, catalog, AI scan, images | `ShoeController`, `ShoeCatalogController`, `AiShoeScanService` |
| `strength` | Muscle-training plans / check-ins | `MuscleTrainingController`, `PersonalizedStrengthPlanEngine` |
| `weather` | Forecast + weather-adjusted fitness | `WeatherContextController`, `WeatherForecastService` |

### Where to change X

| Change this | Edit these files | Props / env | Tests |
|---|---|---|---|
| **Sleep / wake catch-up** | `runtime/SleepWakeCatchUp.java`, `runtime/SleepModeConfiguration.java` (`@Profile("sleep")`) | `backend/src/main/resources/application-sleep.properties`: `app.sleep.wake-catchup.delay-ms` (default `90000`), `app.sleep.wake-catchup.coach-enabled` (when present; sleep profile sets `false`), `app.background.polling.enabled=false`, `app.coach.nightly.cron=-`, Hikari idle knobs. Activate with `SPRING_PROFILES_ACTIVE=...,sleep`. Narrative: `docs/deployment/railway-sleep.md`. | `runtime/SleepWakeCatchUpTests`, `SleepModeConfigurationTests`, `SleepProfileTests`, `SleepPollingTests` |
| **Strava sync scheduler** | `imports/StravaAutoSyncScheduler.java` (`@Scheduled` + `syncOnWake()`), work in `imports/StravaSyncService.java`, tokens in `imports/StravaTokenService.java` | `application.properties`: `strava.sync.enabled`, `strava.sync.interval-ms` (`STRAVA_SYNC_INTERVAL_MS`, default 10m), `strava.sync.max-pages-*`, `strava.sync.backoff-max-minutes`, `app.background.polling.enabled` | `imports/StravaAutoSyncSchedulerTests`, `StravaSyncServiceTests` |
| **Garmin wellness sync scheduler** | `imports/GarminWellnessSyncScheduler.java` (`@Scheduled` + `syncOnWake()`), `imports/GarminWellnessImportService.java` | `garmin.wellness.sync.enabled`, `garmin.wellness.sync.interval-ms` (default 30m), `garmin.wellness.sync.days-back`, `garmin.wellness.sync.initial-days-back` | `imports/GarminWellnessImportServiceTest`, `GarminWellnessCompletionTests`, `GarminWellnessWatermarkTests` (+ `backend/src/test/python/test_garmin_wellness_download.py`) |
| **Activities API / default limits** | `activity/ActivityController.java` (`/api/activities`) | `app.activities.default-limit` / `app.activities.max-limit` (`APP_ACTIVITIES_DEFAULT_LIMIT` / `APP_ACTIVITIES_MAX_LIMIT`, both default **500**) | `activity/ActivityControllerTests`, `ActivityDataAccessTests`, ... |
| **MapTile cache** | `routing/MapTileService.java` (in-process raw-byte cache), `routing/MapTileController.java` (`/api/maps/...`) | `app.map-tile.local-max-bytes` (`APP_MAP_TILE_LOCAL_MAX_BYTES`, default **24 MiB** / `25165824`) | `routing/MapTileServiceTests`, `MapTileControllerTests` |
| **Auth / OAuth** | `auth/OAuthController.java` (`/api/auth/...` Strava+Google), `auth/LoginController.java`, `auth/SecurityConfig.java`, `auth/AuthService.java`, `auth/JwtAuthenticationFilter.java` | `strava.client.id/secret`, `app.strava.redirect-uri`, JWT/session props in `application.properties` / `.env` | `auth/OAuthControllerTests`, `OAuthProviderClientTests` (+ other `auth/*Tests`) |
| **Strava webhook** | `imports/StravaWebhookController.java` (`/api/strava/webhook`), rate limit via `auth/WebhookRateLimitFilter.java` | `strava.webhook.verify-token` (`STRAVA_WEBHOOK_VERIFY_TOKEN`); prod hardening tied to `HERMES_ENV` / `hermes.environment` | `imports/StravaWebhookControllerTests` |
| **Disconnect Strava / Strava retention** | `imports/StravaAccountService.java` (unlink, deauthorization purge, retention), `imports/StravaRetentionJob.java`, `auth/OAuthController.java` (`DELETE /api/auth/strava/unlink`), `imports/StravaTokenService.java` (`revokeAtStrava`, `probeAuthorization`) | `app.strava.retention-days` (`APP_STRAVA_RETENTION_DAYS`, default `0` = off) | `imports/StravaAccountServiceIntegrationTests`, `StravaRetentionJobTests`, `StravaAuthorizationProbeTests`, `auth/OAuthControllerUnlinkTests` |
| **Account export / delete; what a deleted run takes with it** | `runner/AccountController.java` (`/api/account/export`, `DELETE /api/account`), `runner/AccountExportService.java`, `runner/AccountDeletionService.java`, one `*RunnerDataPurger` per domain package, `activity/ActivityDeletionHook.java` implementors | none | `runner/AccountEndpointsMvcTests`, `AccountDeletionIntegrationTests`, `AccountExportIntegrationTests`, `DataLifecycleCoverageTests`, `activity/ActivityDeletionIntegrationTests` |
| **Run effort score and time in heart-rate zones** | Maths: `coaching/EffortModel.java` (score and its source), `coaching/HrZoneAnalysis.java` (time in zone). Storage and staleness: `coaching/TrainingMetricsService.java`, `coaching/ActivityTrainingMetrics.java`. What triggers a recompute: `coaching/TrainingMetricsListener.java` (import, stream arrival, rating edit, zone change), `coaching/TrainingMetricsCatchUp.java` (startup), `coaching/TrainingMetricsRecomputeService.java` + `TrainingMetricsAdminController.java` (`POST /api/admin/jobs/training-metrics-recompute`). Read endpoint: `coaching/TrainingMetricsController.java`. Raising `TrainingMetricsService.MODEL_VERSION` makes every stored row recompute on next read. Formulas: `docs/README-ANALYSIS.md`. | `app.training.async`, `app.training.catchup-on-startup`, `app.training.catchup-max-runs`, `app.training.recompute-batch`, `app.training.hr-zone-percentages` | `coaching/EffortModelTests`, `HrZoneAnalysisTests`, `TrainingMetricsServiceIntegrationTests`, `TrainingMetricsImportFlowTests`, `TrainingEndpointsMvcTests` |
| **Heart-rate zones and max heart rate** | `runner/TrainingZonesController.java` (`GET`/`PUT /api/training/zones`), `runner/TrainingZonesService.java` (rules, suggestion, change event), `runner/HeartRateZones.java` (the zone model), `runner/RunnerTrainingZones.java` (own boundaries); max heart rate is `Runner.maxHeartRateBpm`, shared with `PATCH /api/coach/profile` | `app.training.hr-zone-percentages` | `runner/HeartRateZonesTests`, `TrainingZonesServiceTests`, `coaching/TrainingEndpointsMvcTests` |
| **Fitness, fatigue and form; weekly effort** | Maths: `coaching/FitnessModel.java` (the two averages and form, and the dotted rest projection), `coaching/WeeklyEffortModel.java` (ISO weeks, the usual range and the status). Reading and answers: `coaching/TrainingSeriesService.java`; routes: `coaching/TrainingSeriesController.java` (`GET /api/training/series`, `GET /api/training/weekly-effort`). Made from the effort rows of `activity_training_metrics` (queries in `ActivityTrainingMetricsRepository`, which also finds the race days the chart marks), with no table or cache of its own. Formulas: `docs/README-ANALYSIS.md`. | `app.training.fitness-days`, `app.training.fatigue-days`, `app.training.weekly-range-band`, `app.training.series-max-days` | `coaching/FitnessModelTests`, `WeeklyEffortModelTests`, `TrainingSeriesServiceIntegrationTests`, `TrainingSeriesMvcTests` |
| **Rating a run (perceived exertion), its run type and its tags** | `activity/ActivityEditController.java` (`PATCH /api/activities/{id}` for `perceivedExertion`, `runType` and `tags`, `GET /api/activities/{id}/labels`), `activity/ActivityEditedEvent.java`; `ActivityController` is kept small on purpose (`ActivityControllerTests` guard). Rules and storage of the labels: `activity/RunLabelService.java` (limits, tidying, the replace-the-set rule, usage), `activity/RunTypes.java`, `activity/ActivityTag.java` (table `activity_tag`) + `ActivityTagRepository.java`; `Activity.runType` lives in `ActivityRelationshipFields` (the `Activity` method cap). A deleted run or account takes its tags with it: `activity/ActivityTagCleanup.java`, `activity/ActivityTagRunnerDataPurger.java`; `runner/AccountExportService.java` writes `run_type` and `tags` into `runs.csv`. Production schema: `docs/deployment/m5-schema-upgrade.md`. | none | `activity/RunLabelRulesTests`, `RunLabelsMvcTests`, `coaching/TrainingEndpointsMvcTests`, `runner/AccountExportIntegrationTests` |
| **Training log** | `coaching/TrainingLogService.java` (weeks, days, totals, filters, whether older runs exist), `coaching/TrainingLogRepository.java` (the light run rows it reads; every method keyed by the runner), `coaching/TrainingLogController.java` (`GET /api/training/log`). Made from the runs and their effort rows, with no table or cache of its own. Rules: `docs/README-ANALYSIS.md` ("Training Log"). | none | `coaching/TrainingLogServiceIntegrationTests`, `TrainingLogMvcTests` |
| **Pace profile and grade-adjusted pace** | `activity/ActivityPaceProfileController.java` (`GET /api/activities/{id}/pace-profile`), `activity/PaceProfileCalculator.java` (tidying the stream, moving time, splits, the smoothed line, grade from elevation, the constants), `activity/GradeAdjustedPace.java` (the quadratic effort ratio that approximates Strava's GAP, and the grade limits), `activity/PaceProfileResponse.java`. Computed on every request from one run's points; nothing stored, no schema. Formulas: `docs/README-ANALYSIS.md` | none | `activity/GradeAdjustedPaceTests`, `PaceProfileCalculatorTests`, `ActivityPaceProfileMvcTests` |
| **Best efforts of a run (and the runner's records)** | Maths: `activity/BestEffortCalculator.java` (the exact search and its guards), `activity/BestEffortDistances.java` (the 15 distances; the six the Profile page has always had are `LEGACY_KEYS`), `activity/RunStream.java` (the tidied stream it shares with the pace profile). Storage, places, chip times, hiding, estimates and the analysis lists: `activity/BestEffortService.java`, `activity/ActivityBestEffort.java` (table `activity_best_effort`), `activity/ActivityBestEffortRepository.java`. Endpoints: `activity/RunRecordsController.java` (`GET /api/activities/{id}/best-efforts`, `PATCH /api/activities/{id}/best-efforts/{distanceKey}`, `GET /api/training/best-efforts`). What triggers an analysis: `activity/RunRecordsListener.java` (import, stream arrival), `activity/RunRecordsCoordinator.java` (one run, or the runner's pending runs within a budget), `activity/RunRecordsCatchUp.java` (startup), `activity/RunRecordsExecutors.java`. Raising `BestEffortService.MODEL_VERSION` analyses every run again. The Profile page's personal records read the table through `runner/PersonalRecordService.java`. A deleted run or account takes its efforts with it: `activity/ActivityBestEffortCleanup.java`, `activity/BestEffortRunnerDataPurger.java`; `runner/AccountExportService.java` writes `best-efforts.csv`. Formulas: `docs/README-ANALYSIS.md`. Production schema: `docs/deployment/m3-schema-upgrade.md`. | `app.records.async`, `app.records.catchup-on-startup`, `app.records.catchup-max-runs` | `activity/BestEffortCalculatorTests`, `BestEffortDistancesTests`, `RunStreamTests`, `RunRecordsIntegrationTests`, `RunRecordsMvcTests`, `runner/PersonalRecordServiceTest`, `PersonalRecordServiceIntegrationTests`, `AccountExportIntegrationTests` |
| **Same-route runs** | `activity/RouteMatcher.java` (what makes two runs the same route: start, finish, distance, direction), `activity/RouteMatchService.java` (a run joins the nearest group or starts one; reading a group back as the run page's list), `activity/RouteMatchGroup.java` (table `route_match_group`), `activity/RouteMatchGroupRepository.java`, `Activity.routeMatchGroupId` (column `activities.route_match_group_id`), `activity/RouteMatchRunnerDataPurger.java`. Endpoint: `GET /api/activities/{id}/matches` in `activity/RunRecordsController.java`. Analysed together with the best efforts by `activity/RunRecordsCoordinator.java`, which also removes groups no run belongs to any more at startup. | `app.records.match.endpoint-tolerance-m` (150), `app.records.match.distance-tolerance-pct` (5) | `activity/RouteMatcherTests`, `RunRecordsIntegrationTests`, `RunRecordsMvcTests` |
| **Garmin Connect HTTP** | `imports/GarminConnectController.java` | Garmin session / rate-limit helpers in same package | `imports/GarminConnectControllerTests`, `GarminConnectImportServiceTest` |
| **Coach** | `coaching/CoachController.java` (`/api/coach`), `coaching/AutomatedCoachService.java`, nightly `coaching/Coach8020NightlyScheduler.java`; readiness `ReadinessService`; wellness `WellnessController` | `app.coach.nightly.cron` (disabled under sleep profile) | `coaching/CoachControllerTests`, `AutomatedCoachServiceTests`, `CoachRouteServiceTests`, `CoachHrZoneClassifierTest` |
| **Billing** | `billing/BillingController.java` (`/api/billing`), `billing/QuotaService.java`, `billing/AiUsageService.java` | `app.billing.stripe.*`, `app.billing.public-base-url`, price display label | `billing/BillingControllerTests` |
| **Hikari / Tomcat / JVM** | Props: `backend/src/main/resources/application.properties`, sleep overlay `application-sleep.properties`, prod overlay `application-production.properties`. JVM flags: root `Dockerfile` `JAVA_OPTS`. Narrative: `docs/deployment/memory-budget.md`. | **Hikari:** `spring.datasource.hikari.maximumPoolSize` (`APP_DB_POOL_MAX`, default 4), `minimumIdle` (`APP_DB_POOL_MIN_IDLE`), `maxLifetime`, `keepaliveTime` (sleep profile forces `minimumIdle=0`, short `idleTimeout`, `keepaliveTime=0`). **Tomcat:** `server.tomcat.threads.max` (`APP_TOMCAT_MAX_THREADS`, default 16), `min-spare=4`. **JVM:** `JAVA_OPTS` default `-Xms64m -Xmx640m -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m ...` (override at deploy without rebuild). | Runtime footprint / sleep tests under `runtime/`; broader stress tests at `backend/src/test/java/com/hermes/backend/` root when present |

### Quick “I need to...” cheat sheet

- **Tune Railway sleep wake** → `application-sleep.properties` + `runtime/SleepWakeCatchUp` / `SleepModeConfiguration`; do not re-enable idle polling in sleep.
- **Change Strava pull cadence** → `strava.sync.interval-ms` / `StravaAutoSyncScheduler` (webhooks stay immediate).
- **Raise activities page size** → `APP_ACTIVITIES_*_LIMIT` (still clamped in `ActivityController` until cursor pagination).
- **Shrink map-tile RSS** → `APP_MAP_TILE_LOCAL_MAX_BYTES` (16-32 MiB guidance in props comments).
- **Add an API** → domain controller + service in the matching package; keep auth in `auth`, mail in `infrastructure.mail`.
- **Add a table that references a runner** → add a `RunnerDataPurger` in the owning package; `DataLifecycleCoverageTests` fails until you do. A table that references `activities` also needs an `ActivityDeletionHook`, or deleting a run fails on the foreign key.
- **Change how grade-adjusted pace is worked out** → `activity/GradeAdjustedPace.java` and the constants in `PaceProfileCalculator.java`; update the table in `docs/README-ANALYSIS.md`, which says what a grade does to a pace.
- **Change how a run's effort is worked out** → `coaching/EffortModel.java`; raise `TrainingMetricsService.MODEL_VERSION` so stored scores refresh, and update the formulas in `docs/README-ANALYSIS.md`.
- **Change the production schema** → there is no migration tool and production runs `validate`; write the SQL into a note under `docs/deployment/` (see `m0-schema-upgrade.md`) and run it before deploying.
- **Stripe / quotas** → `billing/*` only.

---

## Ops / deploy

Full runbook: [docs/OPS.md](./OPS.md) (Railway services, sleep, redeploy/rollback, metrics, CI). Summary:

| Change / question | Start here |
|---|---|
| Railway project / services | docs/OPS.md - Project layout (hermes-web, Postgres) |
| Enable / verify sleep | Railway sleepApplication on hermes-web + SPRING_PROFILES_ACTIVE includes sleep; props in application-sleep.properties; narrative docs/deployment/railway-sleep.md |
| Redeploy / rollback | docs/OPS.md - Redeploy / rollback |
| Memory bill / metrics | docs/OPS.md - Metrics and bill; sizing narrative docs/deployment/memory-budget.md |
| Edge / Cloudflare | **Cancelled** - see docs/OPS.md Edge / WAF (do not flip DNS without new auth) |
| Customer email / Resend | docs/deployment/customer-email.md |
| Local setup / env | docs/setup.md, .env.example, Hermes.local.env.example.ps1 |
| Container entry | root Dockerfile |
| Admin security deploy | docs/ADMIN_SECURITY_DEPLOYMENT.md |

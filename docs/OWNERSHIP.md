# Ownership map — where to change X

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
| Shared AbortController on Profile batch | `frontend/src/pages/profile/ProfileDashboard.jsx` | Abort + timeout race is scoped to Profile dashboard first-paint — do not expand abort-sharing to other pages without an explicit RFC. |
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

### API client (`api.ts` / wake retry / resourceCache)

| Change this | Edit these files | Why |
|---|---|---|
| HTTP client, wake retry, `apiJson` / `apiFetch` | `frontend/src/api.ts` | Railway cold-start wake: safe-method retries, `subscribeWakeRetry`, `withWakeRetry` — never blindly retry POST/PUT/PATCH/DELETE. |
| TTL + inflight dedupe | `frontend/src/api/resourceCache.ts` | Layer on top of `apiJson`; prefix TTLs + inflight map. |
| Activity-specific API helpers | `frontend/src/api/activityApi.ts` | Typed activity helpers kept separate from the generic client. |
| Wake-retry unit tests | `frontend/src/apiWakeRetry.vitest.ts` | Covers status/network classification and retry delays. |

### PageSkeleton / waking note i18n

| Change this | Edit these files | Why |
|---|---|---|
| Skeleton variants / layout | `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css` | Route-shaped placeholders; CSS must load before lazy page styles. |
| “Waking the server…” note | `PageSkeleton.jsx` (`WakeRetryNote` + `subscribeWakeRetry`), `frontend/src/i18n/locales/en/common.js`, `frontend/src/i18n/locales/zh-CN/common.js` (`common.waking_server`) | Note tracks wake-retry depth from `api.ts`; copy is locale-keyed. |

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

### Quick “I need to…” cheat sheet

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
| `activity` | Activities API, telemetry, analytics, JDBC data access | `ActivityController`, `ActivityRepository`, `ActivityDataAccess` |
| `admin` | Operator HTTP, audit, background jobs, portals | `AdminController`, `AdminPortalService`, `AdminBackgroundJobService`, `ConfigStatusController` |
| `auth` | Login, JWT, OAuth, filters, rate limits, encryption | `LoginController`, `OAuthController`, `SecurityConfig`, `AuthService`, `JwtAuthenticationFilter` |
| `auth.mfa` | Admin passkeys / MFA challenges / recovery | `AdminMfaController`, `AdminMfaService`, `AdminWebAuthnService` |
| `billing` | Stripe checkout/webhook, AI quotas | `BillingController`, `QuotaService`, `AiUsageService` |
| `coaching` | Plans, readiness, wellness, injury risk, nightly 80/20 | `CoachController`, `AutomatedCoachService`, `Coach8020NightlyScheduler`, `ReadinessService`, `WellnessController` |
| `imports` | Strava/Garmin/health sync + FIT/GPX/TCX ingest | `StravaAutoSyncScheduler`, `GarminWellnessSyncScheduler`, `StravaWebhookController`, `ImportController`, `GarminConnectController` |
| `infrastructure.bootstrap` | Explicit local shared-runner seed | `LocalSharedRunnerBootstrapConfiguration` |
| `infrastructure.cache` | TTL / Redis / fixed-window stores | `TtlCacheStore`, `AppRedisProperties` |
| `infrastructure.config` | Jackson + configured-provider status | `JacksonConfig`, `SystemConfigService` |
| `infrastructure.diagnostics` | DB/security startup + local console errors | `DatabaseDiagnosticsInitializer`, `LocalConsoleErrorController` |
| `infrastructure.mail` | Transactional mail (Resend) | `ResendTransactionalMailSender` |
| `infrastructure.web` | CORS, SPA forward, sanitizers, safe URL exec | `AppCorsConfig`, `SpaForwardingController`, `SafeUrlExecutor` |
| `races` | Saved races, official courses, map extraction | `MarathonRoutePipelineService`, course catalogs, `OfficialCourseStartupSeedConfiguration` |
| `races.model` | Shared race/course DTOs (no orchestration deps) | `RaceEventRequest`, `CourseMapCandidate`, … |
| `rewards` | Digital cosmetics | `DigitalCosmeticsController`, `DigitalCosmeticsService` |
| `routing` | Route planner + map-tile proxy/cache | `MapTileController`, `MapTileService`, `RoutePlannerController` |
| `runner` | Profile, avatar, heatmap, weekly digest | `ProfileController`, `ProfileApplicationService`, `WeeklyDigestController` |
| `runtime` | Railway **sleep** profile: wake catch-up only | `SleepModeConfiguration`, `SleepWakeCatchUp` |
| `shoes` | Inventory, catalog, AI scan, images | `ShoeController`, `ShoeCatalogController`, `AiShoeScanService` |
| `strength` | Muscle-training plans / check-ins | `MuscleTrainingController`, `PersonalizedStrengthPlanEngine` |
| `weather` | Forecast + weather-adjusted fitness | `WeatherContextController`, `WeatherForecastService` |

### Where to change X

| Change this | Edit these files | Props / env | Tests |
|---|---|---|---|
| **Sleep / wake catch-up** | `runtime/SleepWakeCatchUp.java`, `runtime/SleepModeConfiguration.java` (`@Profile("sleep")`) | `backend/src/main/resources/application-sleep.properties`: `app.sleep.wake-catchup.delay-ms` (default `90000`), `app.sleep.wake-catchup.coach-enabled` (when present; sleep profile sets `false`), `app.background.polling.enabled=false`, `app.coach.nightly.cron=-`, Hikari idle knobs. Activate with `SPRING_PROFILES_ACTIVE=…,sleep`. Narrative: `docs/deployment/railway-sleep.md`. | `runtime/SleepWakeCatchUpTests`, `SleepModeConfigurationTests`, `SleepProfileTests`, `SleepPollingTests` |
| **Strava sync scheduler** | `imports/StravaAutoSyncScheduler.java` (`@Scheduled` + `syncOnWake()`), work in `imports/StravaSyncService.java`, tokens in `imports/StravaTokenService.java` | `application.properties`: `strava.sync.enabled`, `strava.sync.interval-ms` (`STRAVA_SYNC_INTERVAL_MS`, default 10m), `strava.sync.max-pages-*`, `strava.sync.backoff-max-minutes`, `app.background.polling.enabled` | `imports/StravaAutoSyncSchedulerTests`, `StravaSyncServiceTests` |
| **Garmin wellness sync scheduler** | `imports/GarminWellnessSyncScheduler.java` (`@Scheduled` + `syncOnWake()`), `imports/GarminWellnessImportService.java` | `garmin.wellness.sync.enabled`, `garmin.wellness.sync.interval-ms` (default 30m), `garmin.wellness.sync.days-back`, `garmin.wellness.sync.initial-days-back` | `imports/GarminWellnessImportServiceTest`, `GarminWellnessCompletionTests`, `GarminWellnessWatermarkTests` (+ `backend/src/test/python/test_garmin_wellness_download.py`) |
| **Activities API / default limits** | `activity/ActivityController.java` (`/api/activities`) | `app.activities.default-limit` / `app.activities.max-limit` (`APP_ACTIVITIES_DEFAULT_LIMIT` / `APP_ACTIVITIES_MAX_LIMIT`, both default **500**) | `activity/ActivityControllerTests`, `ActivityDataAccessTests`, … |
| **MapTile cache** | `routing/MapTileService.java` (in-process raw-byte cache), `routing/MapTileController.java` (`/api/maps/...`) | `app.map-tile.local-max-bytes` (`APP_MAP_TILE_LOCAL_MAX_BYTES`, default **24 MiB** / `25165824`) | `routing/MapTileServiceTests`, `MapTileControllerTests` |
| **Auth / OAuth** | `auth/OAuthController.java` (`/api/auth/...` Strava+Google), `auth/LoginController.java`, `auth/SecurityConfig.java`, `auth/AuthService.java`, `auth/JwtAuthenticationFilter.java` | `strava.client.id/secret`, `app.strava.redirect-uri`, JWT/session props in `application.properties` / `.env` | `auth/OAuthControllerTests`, `OAuthProviderClientTests` (+ other `auth/*Tests`) |
| **Strava webhook** | `imports/StravaWebhookController.java` (`/api/strava/webhook`), rate limit via `auth/WebhookRateLimitFilter.java` | `strava.webhook.verify-token` (`STRAVA_WEBHOOK_VERIFY_TOKEN`); prod hardening tied to `HERMES_ENV` / `hermes.environment` | `imports/StravaWebhookControllerTests` |
| **Garmin Connect HTTP** | `imports/GarminConnectController.java` | Garmin session / rate-limit helpers in same package | `imports/GarminConnectControllerTests`, `GarminConnectImportServiceTest` |
| **Coach** | `coaching/CoachController.java` (`/api/coach`), `coaching/AutomatedCoachService.java`, nightly `coaching/Coach8020NightlyScheduler.java`; readiness `ReadinessService`; wellness `WellnessController` | `app.coach.nightly.cron` (disabled under sleep profile) | `coaching/CoachControllerTests`, `AutomatedCoachServiceTests`, `CoachRouteServiceTests`, `CoachHrZoneClassifierTest` |
| **Billing** | `billing/BillingController.java` (`/api/billing`), `billing/QuotaService.java`, `billing/AiUsageService.java` | `app.billing.stripe.*`, `app.billing.public-base-url`, price display label | `billing/BillingControllerTests` |
| **Hikari / Tomcat / JVM** | Props: `backend/src/main/resources/application.properties`, sleep overlay `application-sleep.properties`, prod overlay `application-production.properties`. JVM flags: root `Dockerfile` `JAVA_OPTS`. Narrative: `docs/deployment/memory-budget.md`. | **Hikari:** `spring.datasource.hikari.maximumPoolSize` (`APP_DB_POOL_MAX`, default 4), `minimumIdle` (`APP_DB_POOL_MIN_IDLE`), `maxLifetime`, `keepaliveTime` (sleep profile forces `minimumIdle=0`, short `idleTimeout`, `keepaliveTime=0`). **Tomcat:** `server.tomcat.threads.max` (`APP_TOMCAT_MAX_THREADS`, default 16), `min-spare=4`. **JVM:** `JAVA_OPTS` default `-Xms64m -Xmx640m -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m …` (override at deploy without rebuild). | Runtime footprint / sleep tests under `runtime/`; broader stress tests at `backend/src/test/java/com/hermes/backend/` root when present |

### Quick “I need to…” cheat sheet

- **Tune Railway sleep wake** → `application-sleep.properties` + `runtime/SleepWakeCatchUp` / `SleepModeConfiguration`; do not re-enable idle polling in sleep.
- **Change Strava pull cadence** → `strava.sync.interval-ms` / `StravaAutoSyncScheduler` (webhooks stay immediate).
- **Raise activities page size** → `APP_ACTIVITIES_*_LIMIT` (still clamped in `ActivityController` until cursor pagination).
- **Shrink map-tile RSS** → `APP_MAP_TILE_LOCAL_MAX_BYTES` (16–32 MiB guidance in props comments).
- **Add an API** → domain controller + service in the matching package; keep auth in `auth`, mail in `infrastructure.mail`.
- **Stripe / quotas** → `billing/*` only.

---

## Ops / deploy

*(Stub — ops owner fills RFC-014 OPS section.)* Prefer sibling docs until then:

| Topic | Start here |
|---|---|
| Railway sleep / wake | `docs/deployment/railway-sleep.md` |
| Memory / `JAVA_OPTS` / pool sizing | `docs/deployment/memory-budget.md` |
| Customer email / Resend | `docs/deployment/customer-email.md` |
| Setup / env | `docs/setup.md`, `.env.example`, `Hermes.local.env.example.ps1` |
| Container entry | root `Dockerfile` |
| Admin security deploy notes | `docs/ADMIN_SECURITY_DEPLOYMENT.md` |

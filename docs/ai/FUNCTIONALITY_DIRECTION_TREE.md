# Hermes Functionality Direction Tree

Use this index when the task starts with a broken behavior rather than a known file. It maps each product symptom to the smallest frontend/backend slice that owns it.

The machine-readable source is [`functionality-direction-tree.json`](functionality-direction-tree.json). Keep both files aligned and run:

```bash
node tools/check-functionality-direction-tree.mjs
node tools/check-functionality-direction-tree.test.mjs
```

## Agent routing algorithm

```text
Reported behavior
├─ Is it a specific page or product action?
│  ├─ Yes → match a Product branch below
│  │        → open page entrypoint
│  │        → identify its /api call
│  │        → open owning controller method
│  │        → follow only the injected service/repository used by that method
│  │        → update the nearest frontend + backend contract tests
│  └─ No  → match a Shared concern branch
├─ Does the symptom cross the browser/server boundary?
│  ├─ Wrong request before server → frontend API/page owner
│  ├─ Correct request, wrong response → controller/service/persistence owner
│  └─ Correct response, wrong display → page/helper/style owner
└─ Did source verification pass but the website still look old?
└─ Use Runtime publication; source, build, static sync, and live HTTP are separate gates.
```

Boundary rules for overlapping branches:

- `/profile`: identity/dashboard belongs to Runner profile; checkout, subscription state, and quota mutation belongs to Billing.
- `/runs` and `/analysis`: existing activity display/analytics belongs to Runs or Analysis; file upload, parsing, and normalization belongs to Activity import.
- `/settings`: generic preferences/avatar belongs to Settings; provider linking, credentials, and synchronization belongs to Integrations.
- `/api/activities`: activity retrieval/lifecycle belongs to Runs; post-activity reward calculation and inventory belongs to Rewards.

Rules:

1. Start with `entrypoints`; do not scan the full repository first.
2. Treat the endpoint and response shape as the frontend/backend seam.
3. If the task is visual only, preserve API and persistence behavior.
4. If the payload changes, update both sides and their contract tests together.
5. Never edit fingerprinted files under `backend/src/main/resources/static/assets/` directly.
6. Use the feature’s focused checks first; use the broader gates in `AGENTS.md` before a completion or runtime claim.

## Product branches

<!-- feature:authentication-access -->
### Authentication and account access
- Manifest evidence: Authentication and account access · `/login` · `/api/auth/**` · `frontend/src/pages/auth/Login.jsx` · `backend/src/main/java/com/hermes/backend/auth/LoginController.java`

Use for login, signup, password reset, email verification, provider login, or admin access.

- Frontend first: `pages/auth/Login.jsx`, `pages/auth/Signup.jsx`, `pages/auth/ForgotPassword.jsx`, then `utils/webauthn.ts`, `contexts/AuthContext.jsx`, and `api.ts`. Admin primary authentication and passkey/recovery verification share `Login.jsx`; no public admin-login page exists.
- API seam: `/api/auth/**`.
- Backend first: `LoginController.java` for password/admin flows; `OAuthController.java` for Google/Strava; then `AuthService.java`, verification/reset services, and `RunnerRepository.java`.
- Risk gate: preserve role hydration, enumeration resistance, captcha rules, rate limits, and JWT behavior.

<!-- feature:runner-profile -->
### Runner profile and dashboard
- Manifest evidence: Runner profile and dashboard · `/profile` · `/api/profile/**` · `frontend/src/pages/profile/Profile.jsx` · `backend/src/main/java/com/hermes/backend/runner/ProfileController.java`

Use for identity, dashboard cards, personal records, weekly digest, or quota display.

- Frontend first: `pages/profile/Profile.jsx` → `pages/profile/ProfileDashboard.jsx`.
- API seam: `/api/profile/**`, `/api/weekly-digest`.
- Backend first: `ProfileController.java` and `WeeklyDigestController.java`; then `PersonalRecordService.java`, `WeeklyDigestService.java`, or `QuotaService.java` according to the response field.
- Persistence: `Runner.java`, `RunnerRepository.java`, `ActivityRepository.java`.

<!-- feature:activities-runs -->
### Runs list and activity lifecycle
- Manifest evidence: Runs list and activity lifecycle · `/runs` · `/api/activities` · `frontend/src/pages/runs/Runs.jsx` · `backend/src/main/java/com/hermes/backend/activity/ActivityController.java`

Use for the runs ledger, activity summaries, route previews, refresh, or delete.

- Frontend first: `pages/runs/Runs.jsx` → `api/activityApi.ts` for typed activity summaries.
- API seam: `/api/activities`, `/api/activities/route-previews`, `/api/activities/{id}`.
- Backend first: `ActivityController.java` → `ActivityDataAccess.java` / `ActivityRoutePreviewHelper.java` → activity repositories.
- If only imported/Strava data is missing, route to Activity import or Integrations sync instead.

<!-- feature:run-detail -->
### Run detail, telemetry, and elevation
- Manifest evidence: Run detail, telemetry, and elevation · `/run/:id` · `/api/activities/{id}/**` · `frontend/src/pages/runs/RunDetail.jsx` · `backend/src/main/java/com/hermes/backend/activity/ActivityController.java`

Use for route points, charts, splits, heart rate, elevation, improvement, or shoe assignment on one activity.

- Frontend first: `pages/runs/RunDetail.jsx`.
- API seam: `/api/activities/{id}/points|analytics|telemetry|hr-samples|improvement|elevation/**` and the shoe assignment endpoint.
- Backend first: `ActivityController.java`; follow to `ActivityTelemetryResponseBuilder.java`, `ActivityAnalyticsHelper.java`, or `ElevationCorrectionService.java`.
- For shoe assignment only: also open `ShoeController.java`, `Shoe.java`, and `ShoeRepository.java`.

<!-- feature:analysis-predictions -->
### Analysis, insights, and predictions
- Manifest evidence: Analysis, insights, and predictions · `/analysis` · `/api/activities/analysis` · `frontend/src/pages/analysis/Analysis.jsx` · `backend/src/main/java/com/hermes/backend/activity/ActivityController.java`

Use for VDOT, ACWR, training zones, trend charts, prediction details, injury risk, or soreness.

- Frontend first: `pages/analysis/Analysis.jsx`, `pages/analysis/AnalysisInsightDetail.jsx`, `pages/prediction/PredictionDetail.jsx`; then `utils/analysisInsights.js`, `utils/vdot.js`, and `utils/predictionSelection.ts`.
- Profile-v2 and Analysis import-modal visual owners: `styles/analysis-profile-visual-alignment.css`, `styles/all-pages-liquid-glass.css`; focused guards live in `pages/analysis/__tests__/analysisInjuryProfileV2Ring.smoke.test.js` and `pages/profile/__tests__/profileImportModalDesign.smoke.test.js`.
- API seam: `/api/activities/analysis`, `/api/injury-risk/**`, `/api/profile/me`.
- Backend first: `ActivityController.java`, `InjuryRiskController.java`, `ProfileController.java`; then the exact calculation service used by the endpoint.
- Methodology gate: do not change VDOT, ACWR, recovery, or prediction formulas during a visual-only task.

<!-- feature:heatmap -->
### Activity heatmap
- Manifest evidence: Activity heatmap · `/heatmap` · `/api/profile/heatmap` · `frontend/src/pages/heatmap/Heatmap.jsx` · `backend/src/main/java/com/hermes/backend/runner/ProfileController.java`

Use for missing GPS points, coverage mode, paging, map rendering, or stale heatmap cache.

- Frontend first: `pages/heatmap/Heatmap.jsx` and `_split/heatmap.css`.
- API seam: `/api/profile/heatmap`, `/api/activities/heatmap`.
- Backend first: `ProfileController.java` / `ActivityController.java`; then `TtlCacheStore.java`, `ActivityDataAccess.java`, and point/activity repositories.
- Cache gate: test the real serialized cache round trip, not only a direct controller response.

<!-- feature:today-run-coaching -->
### Today Run and automated coaching
- Manifest evidence: Today Run and automated coaching · `/today-run` · `/api/today/dashboard` · `frontend/src/pages/today-run/TodayRun.jsx` · `backend/src/main/java/com/hermes/backend/runner/ProfileController.java`

Use for today’s recommendation, the personalized 14-day running plan, readiness, recovery, coach state, alerts, or training blocks. This branch also owns the shared plan shown on Profile, Schedule, and `analysis/coach-insight`.

- Frontend first: `pages/today-run/TodayRun.jsx`; then `utils/todayRun.js`, `utils/personalizedCoachPlan.js`, and `utils/todayRunAcwrInsight.js`. Cross-surface consumers are `pages/profile/ProfileDashboard.jsx`, `pages/schedule/Schedule.jsx`, and `pages/analysis/AnalysisInsightDetail.jsx`.
- API seam: `/api/today/dashboard`, `/api/coach/**`.
- Backend first: `ProfileController.java` for the batch payload and `CoachController.java` for coach actions; then `PersonalizedRunningPlanner.java`, `AutomatedCoachService.java`, `ReadinessService.java`, or `CoachRouteService.java`. Race-goal and soreness changes replan through `RaceController.java` and `InjuryRiskController.java`.
- Persistence: coach state, scheduled workout, and training block repositories.

<!-- feature:weather -->
### Weather engine and fitness interpretation
- Manifest evidence: Weather engine and fitness interpretation · `/weather` · `/api/v1/weather/**` · `frontend/src/pages/weather/WeatherEngine.jsx` · `backend/src/main/java/com/hermes/backend/weather/WeatherContextController.java`

Use for location, forecast, weather context, icons, heat adaptation, or weather-adjusted fitness.

- Frontend first: `pages/weather/WeatherEngine.jsx` → `utils/weatherLocation.js`.
- API seam: `/api/v1/weather/**`.
- Backend first: `WeatherContextController.java` → `WeatherForecastService.java` or `WeatherAdjustedFitnessService.java` → external forecast client.
- Separate upstream-provider failure from response interpretation and UI presentation.

<!-- feature:shoes-catalog-ai-scan -->
### Shoes, catalog, recommendations, and AI scan
- Manifest evidence: Shoes, catalog, recommendations, and AI scan · `/shoes` · `/api/shoes/**` · `frontend/src/pages/shoes/Shoes.jsx` · `backend/src/main/java/com/hermes/backend/shoes/ShoeController.java`

Use for shoe inventory, add/edit/retire, catalog models, recommendation, photo search, AI scan, quota, or run assignment.

- Frontend first: `pages/shoes/Shoes.jsx`, `pages/shoes/AddShoes.jsx`, `pages/shoes/ShoeCatalog.jsx`.
- API seam: `/api/shoes/**`, `/api/shoe-catalog/**`.
- Backend first: `ShoeController.java`, `ShoeImageController.java`, or `ShoeCatalogController.java`; follow to the matching tracker, identity, image, or AI-scan service.
- Persistence: shoe, catalog brand/model, and image asset repositories.

<!-- feature:races-course-maps -->
### Races, elevation, and course maps
- Manifest evidence: Races, elevation, and course maps · `/races` · `/api/races/**` · `frontend/src/pages/races/Races.jsx` · `backend/src/main/java/com/hermes/backend/races/RaceController.java`

Use for saved races, race detail, official image, course geometry, elevation profile, or map tiles.

- Frontend first: `pages/races/Races.jsx` / `pages/races/RacesDetail.jsx`; then race presentation and map-trust utilities.
- API seam: `/api/races/**`, `/api/maps/**`.
- Backend first: `RaceController.java` / `MapTileController.java`; then `RaceCourseMapService.java`, `RaceElevationProfileService.java`, or `RaceOfficialImageService.java`.
- Admin scanning/publishing belongs to Admin operations, even when the output appears on Race detail.

<!-- feature:schedule-route-planning -->
### Schedule and route planning
- Manifest evidence: Schedule and route planning · `/schedule` · `/api/coach/schedule` · `frontend/src/pages/schedule/Schedule.jsx` · `backend/src/main/java/com/hermes/backend/routing/RoutePlannerController.java`

Use for coach schedule, generated routes, start anchors, saved/recent routes, or waypoint validity.

- Frontend first: `pages/schedule/Schedule.jsx`; then `utils/scheduleCoachSummary.js` and `utils/routeRecommendation.js`.
- API seam: `/api/coach/schedule`, `/api/route/**`.
- Backend first: `RoutePlannerController.java` / `CoachController.java`; then `RoutePlannerService.java`, `CoachRouteService.java`, and `RouteHeatmapAnchorService.java`.
- Persistence: `PlannedRouteRepository.java` and `CoachScheduledWorkoutRepository.java`.

<!-- feature:muscle-training -->
### Muscle training plans and check-ins
- Manifest evidence: Muscle training plans and check-ins · `/muscle-training` · `/api/training/muscle/**` · `frontend/src/pages/muscle-training/MuscleTraining.jsx` · `backend/src/main/java/com/hermes/backend/strength/MuscleTrainingController.java`

Use for strength profile, week plan, daily composer, check-in, exercise library, or muscle heatmap.

- Frontend first: `pages/muscle-training/MuscleTraining.jsx`; then `components/MuscleHeatmap.jsx` and `utils/muscleSlugMapper.js`.
- API seam: `/api/training/muscle/**`.
- Backend first: `MuscleTrainingController.java`; follow to profile, planner, session, or metrics service according to the endpoint.
- Persistence: muscle preference and check-in repositories.

<!-- feature:rewards-cosmetics -->
### Rewards, milestones, and digital cosmetics
- Manifest evidence: Rewards, milestones, and digital cosmetics · `/rewards` · `/api/cosmetics/**` · `frontend/src/pages/rewards/Rewards.jsx` · `backend/src/main/java/com/hermes/backend/rewards/DigitalCosmeticsController.java`

Use for badges, reward progress, earned drops, inventory, or active theme.

- Frontend first: `pages/rewards/Rewards.jsx`; then reward catalog/badge utilities.
- API seam: `/api/cosmetics/**` plus activity data used by the rewards view.
- Backend first: `rewards/DigitalCosmeticsController.java` → `DigitalCosmeticsService.java` → `DigitalCosmeticDropRepository.java`.
- If a drop was not minted after import, also inspect `ActivityIngestedEventListenerComponent.java` and the ingest event path.

<!-- feature:settings-account -->
### Settings, identity, preferences, and avatar
- Manifest evidence: Settings, identity, preferences, and avatar · `/settings` · `/api/profile/me/**` · `frontend/src/pages/settings/Settings.jsx` · `backend/src/main/java/com/hermes/backend/runner/ProfileController.java`

Use for account name, avatar upload/delete, units, language, theme, or runner preferences.

- Frontend first: `pages/settings/Settings.jsx`; client-only preferences live in i18n/theme/unit contexts.
- API seam: `/api/profile/me/**`, `/api/profile/preferences`.
- Backend first: `ProfileController.java` → `Runner.java` / `RunnerRepository.java`.
- For Strava, Garmin, or wellness cards, route to Integrations sync rather than changing generic settings code blindly.

<!-- feature:activity-import -->
### Activity file import and normalization
- Manifest evidence: Activity file import and normalization · `/settings/import-data` · `/api/import/files` · `frontend/src/pages/settings/ImportDataSettings.jsx` · `backend/src/main/java/com/hermes/backend/imports/ImportController.java`

Use for FIT, GPX, TCX, multipart upload, parser errors, duplicates, or bad normalized metrics.

- Frontend first: `pages/settings/ImportDataSettings.jsx`; import entrypoints also exist in Runs and Analysis.
- API seam: `/api/import/files`, `/api/import/batch`.
- Backend first: `ImportController.java` → `ActivityImportService.java` → format parser → `ActivityNormalizationService.java` → activity repositories.
- Diagnose parser output before changing analytics derived from already-normalized activities.

<!-- feature:integrations-sync -->
### Strava, Garmin, and wellness integrations
- Manifest evidence: Strava, Garmin, and wellness integrations · `/settings` · `/api/auth/strava/**` · `frontend/src/pages/settings/Settings.jsx` · `backend/src/main/java/com/hermes/backend/auth/OAuthController.java`

Use for linking, token refresh, auto-sync, provider status, Garmin imports, Apple/Google Health, or Strava webhooks.

- Frontend first: `pages/settings/Settings.jsx`, `pages/settings/GarminImportSettings.jsx`, and `contexts/AuthContext.jsx`.
- API seam: `/api/auth/strava/**`, `/api/strava/**`, `/api/garmin/connect/**`, `/api/wellness/**`.
- Backend first: the matching controller; then provider-specific sync/import/token service.
- Risk gate: preserve credential encryption, webhook idempotency, rate limits, runner scope, and scheduled-job access context.

<!-- feature:billing-subscriptions -->
### Billing, subscription tier, and AI quota
- Manifest evidence: Billing, subscription tier, and AI quota · `/profile` · `/api/billing/**` · `frontend/src/pages/profile/ProfileDashboard.jsx` · `backend/src/main/java/com/hermes/backend/billing/BillingController.java`

Use for Stripe config/checkout/webhook, Pro expiry, admin grants, or AI scan quota.

- Frontend first: `pages/profile/ProfileDashboard.jsx` for runner state and checkout return, `pages/admin/Dashboard.jsx` for admin subscription operations.
- API seam: `/api/billing/**`, `/api/profile/quota`, `/api/admin/users/**`.
- Backend first: `billing/BillingController.java`, `ProfileController.java`, or `AdminUserPortalController.java`; then `QuotaService.java`, `AiUsageService.java`, and `SystemConfigService.java`.
- Risk gate: never expose Stripe secrets; preserve webhook signature validation and processed-event idempotency.

<!-- feature:admin-operations -->
### Admin dashboard, users, jobs, shoes, and race maps
- Manifest evidence: Admin dashboard, users, jobs, shoes, and race maps · `/dashboard/*` · `/api/admin/**` · `frontend/src/pages/admin/Dashboard.jsx` · `backend/src/main/java/com/hermes/backend/admin/AdminPortalController.java`

Use for admin overview, users, bulk operations, queues, audit, jobs, shoe review, or race-map scanning/publishing.

- Frontend first: `pages/admin/Dashboard.jsx`, then the selected dashboard section and `AdminCourseMapPreview.jsx` when relevant.
- API seam: `/api/admin/**`, `/api/shoe-catalog/admin/**`, `/api/shoes/admin/**`.
- Backend first: select the matching `Admin*Controller.java`; then `AdminPortalService.java`, background-job/audit service, or the domain service being operated.
- Risk gate: preserve `AdminOnlyRoute`, backend role checks, audit writes, preview/execute separation, and publish state.

<!-- feature:platform-api-runtime -->
### Shared API client, routing, security, and static runtime
- Manifest evidence: Shared API client, routing, security, and static runtime · `all frontend routes` · `/api/**` · `frontend/src/main.jsx` · `backend/src/main/java/com/hermes/backend/BackendApplication.java`

Use for base URL, JWT/language headers, global 401 behavior, route guards, CORS, SPA fallback, or stale built assets.

- Frontend first: `main.jsx`, `App.jsx`, `api.ts`, then the error boundary or Vite config.
- Backend first: `BackendApplication.java`, `SecurityConfig.java`, `SpaForwardingController.java`; then auth/error/static cache filters.
- Contract gate: route access must agree between React guards and Spring Security.
- Runtime gate: source edit → frontend build → backend static sync → live HTTP proof. Each is a distinct state.

## Shared concern branches

<!-- concern:api-contracts -->
### API contracts
- Manifest evidence: Frontend/backend API contract mismatch · `frontend/src/api.ts` · `backend/src/main/java/com/hermes/backend/infrastructure/config/JacksonConfig.java`

For a request/response mismatch, compare `frontend/src/api.ts`, the relevant typed contract/adapter, the controller method, and Jackson/error behavior. Fix producer and consumer together; do not mask an invalid payload only in presentation code.

<!-- concern:localization-copy -->
### Localization and copy
- Manifest evidence: Localization and user-visible copy · `frontend/src/i18n/localeRegistry.js` · `frontend/src/i18n/locales/en/pages.js`

Update the authoritative English and Chinese locale modules together. Read `localeRegistry.js` and `translationRuntime.js` before changing fallback behavior. Run the full translation parity checker.

<!-- concern:styles-themes-responsive -->
### Styles, themes, and responsive behavior
- Manifest evidence: Styles, themes, and responsive behavior · `design.md` · `frontend/src/styles/_split/light-theme-overrides.css`

Start at `frontend/src/index.css` to identify runtime cascade order, then use the surface file under `styles/_split/`. `style.css` is a frozen legacy reference; do not restore it as an active owner. Check light and dark modes and long-value behavior.

<!-- concern:security-authorization -->
### Security and authorization
- Manifest evidence: Authentication, authorization, and request hardening · `frontend/src/contexts/AuthContext.jsx` · `backend/src/main/java/com/hermes/backend/auth/ApiRateLimitFilter.java`

Trace both the React guard and Spring Security rule. Then inspect JWT, rate-limit, security-header, input-validation, or sanitization code only as required by the symptom. Security fixes require requirement-by-requirement proof.

<!-- concern:database-persistence -->
### Database and persistence
- Manifest evidence: Database entities, repositories, and H2/PostgreSQL behavior · `backend/src/main/resources/application.properties` · `backend/src/main/java/com/hermes/backend/runner/Runner.java`

Start with the entity and repository reached by the owning service. Preserve H2 development compatibility unless the task is explicitly PostgreSQL-only. Configuration files and `pom.xml` outrank architecture prose for current dependency/runtime facts.

<!-- concern:background-jobs-webhooks -->
### Background jobs and webhooks
- Manifest evidence: Schedulers, background jobs, and webhooks · `backend/src/main/java/com/hermes/backend/imports/StravaWebhookController.java` · `backend/src/main/java/com/hermes/backend/admin/AdminBackgroundJobService.java`

Start at the scheduler/controller boundary, then trace job state, idempotency record, access context, and retry behavior. Do not infer that an enqueued job executed successfully from an accepted HTTP response.

For opt-in sleep/wake behavior, check `runtime/SleepModeConfiguration.java` and
`runtime/SleepWakeCatchUp.java` under the backend package. The matching runtime
tests and Garmin completion/watermark tests are indexed in this concern's manifest.

<!-- concern:runtime-publication -->
### Runtime publication
- Manifest evidence: Frontend build publication and live runtime drift · `frontend/scripts/run-vite-build.mjs` · `backend/src/main/java/com/hermes/backend/infrastructure/web/StaticAssetCacheConfig.java`

Use when source checks pass but the local website still serves old behavior. Build through `frontend/scripts/run-vite-build.mjs`, verify the active `backend/src/main/resources/static/index.html`, and run the runtime sync proof from `AGENTS.md`. Never edit hashed assets manually.

## Updating the tree

When a new surface or major endpoint is added:

1. Add or update the route in `frontend/src/App.jsx`.
2. Add one `features[]` branch in `functionality-direction-tree.json` with exact existing paths.
3. Add the matching `<!-- feature:id -->` section here.
4. Link representative frontend and backend tests plus focused verification commands.
5. Run both direction-tree checks and the AI context budget check.

The checker rejects missing files, absolute paths, globs, duplicate search terms, missing frontend/backend entrypoints, and undocumented manifest branches.

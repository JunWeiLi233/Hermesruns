# Hermes Project Map

Purpose: durable architecture map for Hermes maintainers and coding agents. Current work queue remains in `TASKS.md`; cross-agent state remains in `.workspace/state/AGENT_SYNC.md`. For symptom-to-file routing across a specific frontend/backend feature, use `docs/ai/FUNCTIONALITY_DIRECTION_TREE.md` and its machine-readable JSON manifest.

## 1. Product purpose

Hermes is a local-first personal running coach and analytics app. Its product goal is not to clone Strava social features. It should quickly answer three runner questions: should I run today and how hard, am I improving, and which shoes should I use. See `README.md`.

Primary surfaces include Today Run, Profile, Runs, Analysis, Heatmap, Weather, Shoes, Races, Schedule, Muscle Training, Rewards, Settings, and the admin Dashboard. See `frontend/src/App.jsx`.

## 2. Technology stack

Frontend facts:
- React 19, Vite, React Router 8, incremental TypeScript, Vitest/React Testing Library, Leaflet, and Chart.js. Source of truth: `frontend/package.json`.
- Frontend entry: `frontend/src/main.jsx`.
- Route and provider composition: `frontend/src/App.jsx`.
- Shared typed API client: `frontend/src/api.ts`.
- User copy: locale modules under `frontend/src/i18n/locales/`; registry and fallback policy: `frontend/src/i18n/localeRegistry.js`.

Backend facts:
- Java 17 source target, Maven, Spring Boot 4.1.1, Spring MVC, Spring Security, JPA/Hibernate. Source of truth: `backend/pom.xml`.
- Backend entry: `backend/src/main/java/com/hermes/backend/BackendApplication.java`.
- Development database: H2. Production database: PostgreSQL. Source of truth: `backend/pom.xml`, `.env.example`, `Hermes.local.env.example.ps1`.
- Important integrations: Google OAuth, Strava OAuth, Garmin Connect, Stripe Checkout/Webhook, AI shoe image scanning, weather/map services.

Note: if `backend/pom.xml` and docs disagree on dependency versions, `pom.xml` wins.

## 3. Directory map

- `AGENTS.md`: top-level agent policy, truth rules, task workflow, runtime proof gates.
- `README.md`: product overview and repository entry point.
- `TASKS.md`: current work queue. Do not duplicate live task status here.
- `design.md`: default visual authority for meaningful UI work.
- `DESIGN_VERSIONS.md`: design-change log.
- `docs/domain-glossary.md`: shared domain vocabulary, including strength-training focus, dose, recovery and load terms.
- `docs/repo-rules/`: durable repo rules split by concern.
- `docs/ai/FUNCTIONALITY_DIRECTION_TREE.md`: behavior-led decision tree from product symptoms to frontend/backend owners, tests, and verification.
- `docs/ai/functionality-direction-tree.json`: validated machine-readable source for the functionality direction tree.
- `.workspace/codex/`: optimized Codex context and checkpoints.
- `.workspace/state/`: cross-agent claims, human loop, and short-term coordination state.
- `tools/`: build, sync, verification, workflow, and maintenance scripts.
- `frontend/`: React app, frontend tests, styles, build scripts.
- `backend/`: Spring Boot app, Maven wrapper, backend tests.
- `.workspace/`: grouped coordination state, checkpoints, disposable build cache and scratch output; see `docs/architecture/repository-layout.md`.
- `Hermes.code-workspace`: app-first editor view with integration setup in a separate section.
- `task-images/`: local task proof/design artifacts; treat as local-only unless user asks to publish.

## 4. Frontend module map

- `frontend/src/main.jsx`: React browser mount.
- `frontend/src/App.jsx`: providers, lazy-loaded pages, route guards.
- `frontend/src/api.ts`: typed backend base URL, bearer-session header, language header, JSON parsing, 401 handling.
- `frontend/src/api/`: typed product-domain API adapters with runtime payload normalization.
- `frontend/src/contracts/`: incremental TypeScript API and product-domain contracts.
- `frontend/src/i18n/localeRegistry.js`: supported locale metadata, normalization, and `Intl` formatter ownership.
- `frontend/src/i18n/translationRuntime.js`: translation lookup, English fallback, interpolation, and missing-key behavior.
- `frontend/src/pages/`: feature directories matching browser routes; start at `frontend/src/pages/README.md` to find a page, stylesheet, backend owner and test command.
- `frontend/src/pages/<feature>/__tests__/`: that feature's behavior and contract tests; `frontend/src/test/contracts/` owns application-wide contracts.
- `frontend/src/pages/admin/`: admin section rendering, row components, navigation and domain presentation models; Dashboard owns page orchestration.
- `frontend/src/components/`: shared UI, shell, navigation, cards, visual components.
- `frontend/src/components/ui/`: low-level reusable UI pieces.
- `frontend/src/contexts/`: Auth, i18n, theme, units.
- `frontend/src/data/`: static catalog and shared frontend data.
- `frontend/src/hooks/`: reusable React hooks.
- `frontend/src/utils/`: cross-page helpers, with domain-specific `coach/`, `races/` and `heatmap/` ownership. Shared code must not statically import pages.
- `frontend/src/hooks/useCatalogLongPress.js`: shared pointer/long-press interaction lifecycle.
- `frontend/src/styles/_split/` and the later imports in `frontend/src/index.css`: active CSS sources in runtime cascade order.
- `frontend/src/styles/style.css`: frozen legacy reference; do not edit or split from it.
- `frontend/src/styles/style.generated.css`: ignored test compatibility view generated from active `index.css` imports.
- `frontend/src/styles/_split/`: split CSS by surface or feature.

Key route mapping is in `frontend/src/App.jsx`: `/profile`, `/runs`, `/run/:id`, `/analysis`, `/heatmap`, `/weather`, `/today-run`, `/shoes`, `/races`, `/schedule`, `/muscle-training`, `/rewards`, `/settings`, and `/dashboard/*`.

## 5. Backend module map

Product-domain packages own controllers, services, repositories, entities, data contracts and integrations. Only `BackendApplication` and `StartupPhaseDiagnosticsLogger` remain at the package root. Infrastructure is grouped under `infrastructure/{web,cache,mail,config,diagnostics,bootstrap}`. See `docs/architecture/backend-package-migration.md` for the complete tree and dependency rules.

Major controller groups:
- `auth/LoginController.java`: `/api/auth`, password login/signup/reset, email verification, admin login.
- `auth/OAuthController.java`: Google/Strava OAuth, linking, sync status.
- `runner/ProfileController.java`: `/api/profile/**`, `/api/today/dashboard`, dashboard/profile summaries.
- `activity/ActivityController.java`: `/api/activities/**`, activities, analysis, heatmap, telemetry, route previews.
- `imports/ImportController.java`: `/api/import/**`, activity file import.
- `coaching/CoachController.java`: `/api/coach/**`, readiness, today plan, training blocks, alerts.
- `coaching/InjuryRiskController.java`: `/api/injury-risk/**`.
- `coaching/WellnessController.java`: `/api/wellness/**`.
- `imports/GarminConnectController.java`: `/api/garmin/connect/**`.
- `shoes/ShoeController.java`, `shoes/ShoeImageController.java`, `shoes/ShoeCatalogController.java`: shoes, AI scan, catalog.
- `races/RaceController.java`: `/api/races/**`.
- `routing/RoutePlannerController.java`: `/api/route/**`.
- `strength/MuscleTrainingController.java`: `/api/training/muscle/**`.
- `billing/BillingController.java`: `/api/billing/**`, Stripe.
- `rewards/DigitalCosmeticsController.java`: `/api/cosmetics/**`, earned digital inventory and active themes.
- `admin/Admin*Controller.java`: `/api/admin/**`, admin portal, jobs, audit, users, shoes, race maps.
- `weather/WeatherContextController.java`: `/api/v1/weather/**`.
- `imports/StravaWebhookController.java`: `/api/strava/webhook`.
- `infrastructure/web/SpaForwardingController.java`: React SPA route fallback.

Controllers delegate business/data operations to domain services. Profile uses `runner/ProfileApplicationService.java`, `runner/ProfileHeatmapService.java` and `runner/ProfileAvatarService.java`; inventory uses `shoes/ShoeInventoryService.java`; race management uses `races/RaceEventService.java`; wellness preferences use `coaching/WellnessPreferenceService.java`; map tiles use `routing/MapTileService.java`; OAuth HTTP exchanges use `auth/OAuthProviderClient.java`. Shared course-map records and enums live in `races/model/` to avoid service dependency cycles. Do not create root-package product classes.

## 6. Key call chains and data flow

### Authentication

`Login.jsx` / auth UI -> `AuthContext.jsx` and `api.ts` -> `POST /api/auth/login` -> `auth/LoginController.java` -> `auth/AuthService.java`, `auth/PasswordHasher.java`, login limiter/store -> opaque bearer-session token (stored as a hash by the backend) -> `localStorage` -> route guards in `App.jsx` and authenticated API calls.

### OAuth and Strava sync

Login/Settings UI -> `/api/auth/google/start` or `/api/auth/strava/start` -> `auth/OAuthController.java` and `auth/OAuthProviderClient.java` -> provider redirect/callback -> linked account/token persistence -> Strava sync endpoints -> activities saved and later surfaced by Profile, Runs, Analysis, Today Run.

### Activity import

Import UI -> multipart `/api/import/files` or `/api/import/batch` -> `imports/ImportController.java` -> `imports/ActivityImportService.java` -> parser such as `imports/FitActivityFileParser.java` or `imports/GpxActivityFileParser.java` -> `imports/ActivityNormalizationService.java` -> `activity/Activity.java`, `activity/ActivityPoint.java`, repositories -> derived analytics and UI refresh.

### Runs and run detail

`Runs.jsx` / `RunDetail.jsx` -> `/api/activities/**` -> `activity/ActivityController.java` -> `activity/ActivityDataAccess.java`, repositories -> `activity/ActivityRoutePreviewHelper.java`, `activity/ActivityTelemetryResponseBuilder.java` -> route, metrics, telemetry, heart-rate, elevation and improvement UI.

### Profile and Analysis

`Profile.jsx` -> `/api/profile/dashboard` -> `runner/ProfileController.java` -> profile application/heatmap/avatar services -> runner and activity repositories.

`Analysis.jsx` -> `/api/activities/analysis` and related profile/activity endpoints -> `activity/ActivityController.java` and `runner/ProfileController.java` -> analysis utilities such as `frontend/src/utils/analysisInsights.js` -> charts and insight detail routes.

Do not change VDOT, ACWR, recovery, or prediction methodology as part of a visual task without explicit approval. See `AGENTS.md`.

### Today Run

`TodayRun.jsx`, `ProfileDashboard.jsx`, `Schedule.jsx`, and `AnalysisInsightDetail.jsx` -> `/api/today/dashboard`, `/api/coach/today`, `/api/coach/schedule` -> `runner/ProfileController.java`, `coaching/CoachController.java` -> `coaching/AutomatedCoachService.java`, `coaching/PersonalizedRunningPlanner.java`, coach state, injury risk, race goals, weather context -> one shared session type, distance/duration, pace range, rationale, recovery and shoe guidance.

### Shoes and AI scan

`Shoes.jsx`, `AddShoes.jsx`, `ShoeCatalog.jsx` -> `/api/shoes/**`, `/api/shoe-catalog/**` -> `shoes/ShoeController.java`, `shoes/ShoeCatalogController.java`, `shoes/ShoeImageController.java` -> shoe data, image validation, `shoes/AiShoeScanService.java`, recommendation/mileage flows.

### Races and route maps

`Races.jsx`, `RacesDetail.jsx` -> `/api/races/**` -> `races/RaceController.java` -> `races/RaceEventService.java` and course-map services -> saved races, known course data, official image, elevation, course map. Admin route-map tooling uses `admin/AdminRacePortalController.java`, `admin/AdminRouteExtractionController.java`, and marathon route services.

### Admin dashboard

`Login.jsx` -> password/Google/Strava primary authentication -> passkey or one-time recovery verification -> MFA-backed admin token/cookie -> `AdminOnlyRoute` -> `Dashboard.jsx` -> `/api/admin/**`. The admin hostname and all admin routes are additionally protected by signed Cloudflare Access assertions; there is no public `AdminLogin.jsx` route.

### Frontend build into backend runtime

Frontend source -> `frontend/scripts/run-vite-build.mjs` -> production assets -> backend static resources -> `http://localhost:8080` -> `tools/verify-frontend-runtime-sync.mjs`.

Source changed, build passed, static bundle synced, and live backend running are separate states. Runtime-sync scripts mentioned here are machine-local helpers and are not shipped in this checkout; if absent, report runtime synchronization as unverified.

## 7. Local commands

Portable root verification aliases are in `package.json`: `lint:frontend`, `typecheck:frontend`, `test:frontend:unit`, `test:frontend:contracts`, `build:frontend`, `test:backend`, `test:tooling` and `check:architecture`. Supply `--classes backend/target/classes` to the architecture command after a fresh backend compile for compiled `jdeps` evidence. See `docs/repo-rules/stack-and-commands.md`.

Windows quick start:

```powershell
Copy-Item Hermes.local.env.example.ps1 Hermes.local.env.ps1
.\start_hermes.bat
```

Backend:

```bash
cd backend
./mvnw spring-boot:run
./mvnw test
./mvnw -DskipTests compile
./mvnw package
```

Frontend:

```bash
cd frontend
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm test
npm run build
npm run preview
```

Frontend runtime proof for website-facing changes:

```bash
cd frontend
node scripts/run-vite-build.mjs
cd ..
node tools/verify-frontend-runtime-sync.mjs
```

Backend runtime proof for backend/runtime changes:

```bash
cd backend
./mvnw -q -DskipTests compile
cd ..
node tools/verify-backend-runtime-sync.mjs
```

Do not claim local runtime changed unless the relevant proof gate passes. Backend runtime claims also require `http://localhost:8080` to return `200`. See `AGENTS.md`.

## 8. Testing notes

- Backend tests mirror domain packages under `backend/src/test/java/com/hermes/backend/` and run through Maven; whole-application integration contracts remain at the test root.
- Course-map fixtures live in `backend/src/test/resources/course-maps/`. Tests write uploads/routes to JUnit temporary directories, never the runtime `backend/course-map-images/` folder.
- Frontend source-contract tests are colocated under feature `__tests__/` directories or next to shared modules, and run through `frontend/scripts/run-tests.mjs`. `npm --prefix frontend run test:contracts -- runs` selects one feature; omit the feature to run every contract.
- Vitest behavior tests are colocated as `*.vitest.{js,jsx,ts,tsx}`; React interaction tests use React Testing Library and jsdom.
- `npm test` runs TypeScript checking, Vitest behavior tests, and the source-contract runner in that order.
- Prefer targeted tests first, then lint/build/compile and runtime proof for affected surfaces.

## 9. Stable change rules

- Product intent comes first. Every runner-facing feature should improve action, trust, readiness, progress, motivation, or clarity.
- Keep frontend and backend contracts synchronized in the same task.
- Preserve auth, role routing, real data wiring, language, units, themes, and existing integrations unless explicitly tasked otherwise.
- User-visible copy must update both Chinese and English entries.
- Do not hardcode secrets, production credentials, real user tokens, webhook secrets, or local machine paths into product code.
- High-risk areas require extra care: OAuth, Stripe, admin endpoints, uploads, webhooks, sync schedulers, remote images, map proxying, AI calls.
- H2 development compatibility should be preserved unless the task explicitly targets PostgreSQL-only behavior.
- Meaningful design work should follow `design.md` and append `DESIGN_VERSIONS.md`.

## 10. Current architecture risks and unknowns

Known risks:
- Domain moves require import, source-test, reflection and configuration updates; `check:architecture` enforces source placement and dependency boundaries.
- The active CSS cascade spans split surface files and later route overrides; `style.generated.css` gives source-inspection tests one generated view without restoring dual ownership.
- Translation bundles remain large; the locale registry and parity checker reduce but do not eliminate synchronization risk.
- The TypeScript migration is intentionally incremental, so unconverted JavaScript remains outside compiler checking unless imported by typed modules.
- H2/PostgreSQL differences can hide database bugs.
- The bearer-session token is stored in `localStorage`, so XSS-sensitive UI changes need extra scrutiny.
- Source, built static files, and live backend can drift; use runtime sync tools.
- `.workspace/state/AGENT_SYNC.md` can become stale; current filesystem and command output outrank old coordination notes.
- The repository may contain worktrees, backups, generated files, and local artifacts. Always confirm the real checkout and target path before editing.

Unknowns to verify before related work:
- Final production deployment topology and migration policy.
- Full CI test matrix and which smoke tests run automatically.
- Current external API timeout, retry, and idempotency guarantees.
- Complete entity cascade/delete behavior.
- Whether current multi-agent claims are still active or stale.

## 11. Recommended workflow for new tasks

1. Read `README.md` and the relevant `TASKS.md` block.
2. Check `git status` and `.workspace/state/AGENT_SYNC.md`.
3. Match the symptom in `docs/ai/FUNCTIONALITY_DIRECTION_TREE.md`, then open the listed frontend entrypoint, API seam, backend entrypoint, and related tests.
4. Restate current implementation, call chain, impact surface, and risks.
5. Propose the smallest safe plan.
6. Modify only after approval when the user asked for plan mode.
7. Run targeted tests and required lint/build/compile.
8. Run runtime proof if claiming website/backend runtime changed.
9. Update task/design records only when required.

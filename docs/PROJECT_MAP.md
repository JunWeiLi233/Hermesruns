# Hermes Project Map

Purpose: durable architecture map for Hermes maintainers and coding agents. Current work queue remains in `TASKS.md`; cross-agent state remains in `.ai-sync/AGENT_SYNC.md`.

## 1. Product purpose

Hermes is a local-first personal running coach and analytics app. Its product goal is not to clone Strava social features. It should quickly answer three runner questions: should I run today and how hard, am I improving, and which shoes should I use. See `README.md` and `PRODUCT.md`.

Primary surfaces include Today Run, Profile, Runs, Analysis, Heatmap, Weather, Shoes, Races, Schedule, Muscle Training, Rewards, Settings, and the admin Dashboard. See `frontend/src/App.jsx`.

## 2. Technology stack

Frontend facts:
- React 19, Vite, React Router, Leaflet, Chart.js, Zustand. Source of truth: `frontend/package.json`.
- Frontend entry: `frontend/src/main.jsx`.
- Route and provider composition: `frontend/src/App.jsx`.
- Shared API client: `frontend/src/api.js`.
- User copy: `frontend/src/i18n/translations.js`.

Backend facts:
- Java 17, Maven, Spring Boot, Spring MVC, Spring Security, JPA/Hibernate. Source of truth: `backend/pom.xml`.
- Backend entry: `backend/src/main/java/com/hermes/backend/BackendApplication.java`.
- Development database: H2. Production database: PostgreSQL. Source of truth: `backend/pom.xml`, `.env.example`, `Hermes.local.env.example.ps1`.
- Important integrations: Google OAuth, Strava OAuth, Garmin Connect, Stripe Checkout/Webhook, AI shoe image scanning, weather/map services.

Note: if `backend/pom.xml` and docs disagree on dependency versions, `pom.xml` wins.

## 3. Directory map

- `AGENTS.md`: top-level agent policy, truth rules, task workflow, runtime proof gates.
- `PRODUCT.md`: product north star, personas, feature priority, product voice, anti-patterns.
- `TASKS.md`: current work queue. Do not duplicate live task status here.
- `design.md`: default visual authority for meaningful UI work.
- `DESIGN_VERSIONS.md`: design-change log.
- `docs/repo-rules/`: durable repo rules split by concern.
- `.ai-codex/`: optimized Codex context and checkpoints.
- `.ai-sync/`: cross-agent claims, human loop, and short-term coordination state.
- `.tools/`: build, sync, verification, workflow, and maintenance scripts.
- `frontend/`: React app, frontend tests, styles, build scripts.
- `backend/`: Spring Boot app, Maven wrapper, backend tests.
- `task-images/`: local task proof/design artifacts; treat as local-only unless user asks to publish.

## 4. Frontend module map

- `frontend/src/main.jsx`: React browser mount.
- `frontend/src/App.jsx`: providers, lazy-loaded pages, route guards.
- `frontend/src/api.js`: backend base URL, JWT header, language header, JSON parsing, 401 handling.
- `frontend/src/pages/`: route-level pages and page smoke tests.
- `frontend/src/components/`: shared UI, shell, navigation, cards, visual components.
- `frontend/src/components/ui/`: low-level reusable UI pieces.
- `frontend/src/contexts/`: Auth, i18n, theme, units.
- `frontend/src/stores/`: Zustand or other shared local state.
- `frontend/src/data/`: static catalog and shared frontend data.
- `frontend/src/hooks/`: reusable React hooks.
- `frontend/src/utils/`: formatting, analysis, route, race, shoe, and contract helpers.
- `frontend/src/styles/style.css`: large legacy/global stylesheet.
- `frontend/src/styles/_split/`: split CSS by surface or feature.

Key route mapping is in `frontend/src/App.jsx`: `/profile`, `/runs`, `/run/:id`, `/analysis`, `/heatmap`, `/weather`, `/today-run`, `/shoes`, `/races`, `/schedule`, `/muscle-training`, `/rewards`, `/settings`, and `/dashboard/*`.

## 5. Backend module map

Most backend classes currently share package `backend/src/main/java/com/hermes/backend/`.

Major controller groups:
- `LoginController.java`: `/api/auth`, password login/signup/reset, email verification, admin login.
- `OAuthController.java`: Google/Strava OAuth, linking, sync status.
- `ProfileController.java`: `/api/profile/**`, `/api/today/dashboard`, dashboard/profile summaries.
- `ActivityController.java`: `/api/activities/**`, activities, analysis, heatmap, telemetry, route previews.
- `ImportController.java`: `/api/import/**`, activity file import.
- `CoachController.java`: `/api/coach/**`, readiness, today plan, training blocks, alerts.
- `InjuryRiskController.java`: `/api/injury-risk/**`.
- `WellnessController.java`: `/api/wellness/**`.
- `GarminConnectController.java`: `/api/garmin/connect/**`.
- `ShoeController.java`, `ShoeImageController.java`, `ShoeCatalogController.java`: shoes, AI scan, catalog.
- `RaceController.java`: `/api/races/**`.
- `RoutePlannerController.java`: `/api/route/**`.
- `MuscleTrainingController.java`: `/api/training/muscle/**`.
- `BillingController.java`: `/api/billing/**`, Stripe.
- `Admin*Controller.java`: `/api/admin/**`, admin portal, jobs, audit, users, shoes, race maps.
- `WeatherContextController.java`: `/api/v1/weather/**`.
- `StravaWebhookController.java`: `/api/strava/webhook`.
- `SpaForwardingController.java`: React SPA route fallback.

Backend class types are currently mixed in the same package: controllers, services, entities, repositories, filters, schedulers, parsers, and DTOs.

## 6. Key call chains and data flow

### Authentication

`Login.jsx` / auth UI -> `AuthContext.jsx` and `api.js` -> `POST /api/auth/login` -> `LoginController.java` -> `AuthService.java`, `PasswordHasher.java`, login limiter/store -> JWT response -> `localStorage` -> route guards in `App.jsx` and authenticated API calls.

### OAuth and Strava sync

Login/Settings UI -> `/api/auth/google/start` or `/api/auth/strava/start` -> `OAuthController.java` -> provider redirect/callback -> linked account/token persistence -> Strava sync endpoints -> activities saved and later surfaced by Profile, Runs, Analysis, Today Run.

### Activity import

Import UI -> multipart `/api/import/files` or `/api/import/batch` -> `ImportController.java` -> `ActivityImportService.java` -> parser such as `FitActivityFileParser.java` or `GpxActivityFileParser.java` -> `ActivityNormalizationService.java` -> `Activity.java`, `ActivityPoint.java`, repositories -> derived analytics and UI refresh.

### Runs and run detail

`Runs.jsx` / `RunDetail.jsx` -> `/api/activities/**` -> `ActivityController.java` -> `ActivityDataAccess.java`, repositories -> `ActivityRoutePreviewHelper.java`, `ActivityTelemetryResponseBuilder.java` -> route, metrics, telemetry, heart-rate, elevation and improvement UI.

### Profile and Analysis

`Profile.jsx` -> `/api/profile/dashboard` -> `ProfileController.java` -> profile/recent/summary data.

`Analysis.jsx` -> `/api/activities/analysis` and related profile/activity endpoints -> `ActivityController.java` and `ProfileController.java` -> analysis utilities such as `frontend/src/utils/analysisInsights.js` -> charts and insight detail routes.

Do not change VDOT, ACWR, recovery, or prediction methodology as part of a visual task without explicit approval. See `PRODUCT.md` and `AGENTS.md`.

### Today Run

`TodayRun.jsx` -> `/api/today/dashboard`, `/api/coach/today` -> `ProfileController.java`, `CoachController.java` -> `AutomatedCoachService.java`, coach state, injury risk, weather context -> session type, pace, recovery and shoe guidance.

### Shoes and AI scan

`Shoes.jsx`, `AddShoes.jsx`, `ShoeCatalog.jsx` -> `/api/shoes/**`, `/api/shoe-catalog/**` -> `ShoeController.java`, `ShoeCatalogController.java`, `ShoeImageController.java` -> shoe data, image validation, `AiShoeScanService.java`, recommendation/mileage flows.

### Races and route maps

`Races.jsx`, `RacesDetail.jsx` -> `/api/races/**` -> `RaceController.java` -> saved races, known course data, official image, elevation, course map. Admin route-map tooling uses `AdminRacePortalController.java`, `AdminRouteExtractionController.java`, and marathon route services.

### Admin dashboard

`AdminLogin.jsx` -> `/api/auth/admin-login` -> `LoginController.java` -> admin JWT/role -> `AdminOnlyRoute` -> `Dashboard.jsx` -> `/api/admin/**` controllers and services.

### Frontend build into backend runtime

Frontend source -> `frontend/scripts/run-vite-build.mjs` -> production assets -> backend static resources -> `http://localhost:8080` -> `.tools/verify-frontend-runtime-sync.mjs`.

Source changed, build passed, static bundle synced, and live backend running are separate states.

## 7. Local commands

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
npm test
npm run build
npm run preview
```

Frontend runtime proof for website-facing changes:

```bash
cd frontend
node scripts/run-vite-build.mjs
cd ..
node .tools/verify-frontend-runtime-sync.mjs
```

Backend runtime proof for backend/runtime changes:

```bash
cd backend
./mvnw -q -DskipTests compile
cd ..
node .tools/verify-backend-runtime-sync.mjs
```

Do not claim local runtime changed unless the relevant proof gate passes. Backend runtime claims also require `http://localhost:8080` to return `200`. See `AGENTS.md`.

## 8. Testing notes

- Backend tests live under `backend/src/test/java/com/hermes/backend/` and run through Maven.
- Frontend has many colocated `*.smoke.test.js` and `*.test.js` files.
- `frontend/package.json` runs an explicit list of Node smoke/unit scripts; adding a test file does not automatically add it to `npm test` unless the script is updated.
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
- Backend package is very flat; many domains share `com.hermes.backend`, increasing navigation and coupling cost.
- `frontend/src/styles/style.css` is large and interacts with split CSS, increasing cascade/regression risk.
- Translation table is centralized and easy to desynchronize.
- `npm test` is not broad test auto-discovery; it runs explicit scripts.
- H2/PostgreSQL differences can hide database bugs.
- JWT is stored in `localStorage`, so XSS-sensitive UI changes need extra scrutiny.
- Source, built static files, and live backend can drift; use runtime sync tools.
- `.ai-sync/AGENT_SYNC.md` can become stale; current filesystem and command output outrank old coordination notes.
- The repository may contain worktrees, backups, generated files, and local artifacts. Always confirm the real checkout and target path before editing.

Unknowns to verify before related work:
- Final production deployment topology and migration policy.
- Full CI test matrix and which smoke tests run automatically.
- Current external API timeout, retry, and idempotency guarantees.
- Complete entity cascade/delete behavior.
- Whether current multi-agent claims are still active or stale.

## 11. Recommended workflow for new tasks

1. Read `PRODUCT.md` and the relevant `TASKS.md` block.
2. Check `git status` and `.ai-sync/AGENT_SYNC.md`.
3. Locate the target route/page/controller/service/repository and related tests.
4. Restate current implementation, call chain, impact surface, and risks.
5. Propose the smallest safe plan.
6. Modify only after approval when the user asked for plan mode.
7. Run targeted tests and required lint/build/compile.
8. Run runtime proof if claiming website/backend runtime changed.
9. Update task/design records only when required.

# Find A Page To Fix

Start with the URL you see in the browser. Open its entry component below, then
follow the imports for the part you want to change. Each feature's contract and
behavior tests live in its `__tests__/` directory.

Backend paths in this table are relative to
`backend/src/main/java/com/hermes/backend/`. Styles are relative to
`frontend/src/styles/`.

| Browser URL | Open this frontend file | Backend owner | Main stylesheet |
| --- | --- | --- | --- |
| `/` | [landing/Landing.jsx](landing/Landing.jsx) | Public content; `races/` for race data | `_split/landing.css` |
| `/login`, `/signup`, `/forgot-password` | [auth/](auth/) | `auth/LoginController.java`, `auth/OAuthController.java` | `auth-liquid-glass.css`, `_split/auth.css` |
| `/profile` | [profile/ProfileDashboard.jsx](profile/ProfileDashboard.jsx) via [Profile.jsx](profile/Profile.jsx) | `runner/ProfileController.java`, `runner/ProfileApplicationService.java` | `_split/profile.css`, `_split/profile-dashboard-redesign.css` |
| `/runs` | [runs/Runs.jsx](runs/Runs.jsx) | `activity/ActivityController.java`, `activity/ActivityDataAccess.java` | `_split/runs.css` |
| `/runs/:id` | [runs/RunDetail.jsx](runs/RunDetail.jsx) | `activity/ActivityController.java`, telemetry helpers | `run-detail-profile-minimal.css` |
| `/analysis` | [analysis/Analysis.jsx](analysis/Analysis.jsx) | `activity/ActivityController.java` | `_split/analysis.css` |
| `/analysis/:insightKey` | [analysis/AnalysisInsightDetail.jsx](analysis/AnalysisInsightDetail.jsx) | `activity/`, `coaching/` | `analysis-profile-visual-alignment.css`, `analysis-detail-redesigns.css` |
| `/prediction/:distKey` | [prediction/PredictionDetail.jsx](prediction/PredictionDetail.jsx) | Analysis data from `activity/` | `prediction-profile-alignment.css` |
| `/heatmap` | [heatmap/Heatmap.jsx](heatmap/Heatmap.jsx) | `runner/ProfileHeatmapService.java`, `routing/MapTileService.java` | `_split/heatmap.css` |
| `/weather` | [weather/WeatherEngine.jsx](weather/WeatherEngine.jsx) | `weather/WeatherContextController.java` | `_split/weather.css` |
| `/today-run` | [today-run/TodayRun.jsx](today-run/TodayRun.jsx) | `runner/ProfileApplicationService.java`, `coaching/` | `_split/today-run.css` |
| `/schedule` | [schedule/Schedule.jsx](schedule/Schedule.jsx) | `coaching/CoachController.java`, `routing/RoutePlannerController.java` | `_split/schedule.css` |
| `/muscle-training` | [muscle-training/MuscleTraining.jsx](muscle-training/MuscleTraining.jsx) | `strength/MuscleTrainingController.java` | `_split/muscle-training.css`, `muscle-training-action-list.css` |
| `/shoes` | [shoes/Shoes.jsx](shoes/Shoes.jsx) | `shoes/ShoeController.java`, `shoes/ShoeInventoryService.java` | `_split/shoes.css`, `shoes-atelier-redesign.css` |
| `/shoes/add`, `/shoe-catalog` | [shoes/AddShoes.jsx](shoes/AddShoes.jsx), [ShoeCatalog.jsx](shoes/ShoeCatalog.jsx) | `shoes/ShoeCatalogController.java`, `ShoeImageController.java` | `add-shoes-profile-alignment.css`, `_split/shoes.css` |
| `/races`, `/races/details/:raceId` | [races/Races.jsx](races/Races.jsx), [RacesDetail.jsx](races/RacesDetail.jsx) | `races/RaceController.java`, `races/RaceEventService.java`, course-map services | `_split/races.css` |
| `/rewards` | [rewards/Rewards.jsx](rewards/Rewards.jsx) | `rewards/DigitalCosmeticsController.java` | `_split/rewards.css`, `rewards-profile-alignment.css` |
| `/settings`, `/settings/import-data` | [settings/Settings.jsx](settings/Settings.jsx), [ImportDataSettings.jsx](settings/ImportDataSettings.jsx) | `runner/`, `auth/`, `imports/`, `coaching/WellnessController.java` | `_split/settings.css`, `settings-fullwidth.css` |
| Garmin import dialog in settings | [settings/GarminImportSettings.jsx](settings/GarminImportSettings.jsx) | `imports/GarminConnectController.java` | `_split/integrations.css` |
| `/dashboard/*` | [admin/Dashboard.jsx](admin/Dashboard.jsx) | `admin/` controllers and `admin/AdminPortalService.java` | `_split/admin.css`, `admin-monitoring-dashboard.css` |
| `/terms`, `/privacy` | [legal/LegalPage.jsx](legal/LegalPage.jsx) | Static SPA response | `_split/auth.css`, `auth-liquid-glass.css` |

## Admin Sections

Open [admin/OverviewSection.jsx](admin/OverviewSection.jsx),
[UsersSection.jsx](admin/UsersSection.jsx),
[CourseMapsSection.jsx](admin/CourseMapsSection.jsx), or
[AuditSection.jsx](admin/AuditSection.jsx) for that section's rendering.
`DashboardRows.jsx` owns shared rows and pagination. `catalogModels.js`,
`courseMapModels.js` and `operationsModels.js` own presentation calculations.
`Dashboard.jsx` owns requests, page state, dialogs and the remaining sections.

## Common Changes

- **Wrong data or failed request:** inspect the page's `apiJson`/`apiFetch` call,
  then the matching backend controller and service. Transport lives in `../api.ts`.
- **Wrong wording:** update both `../i18n/locales/en/` and `zh-CN/`.
- **Shared sidebar, top bar or icons:** inspect `../components/RunnerShellTopNav.jsx`,
  `AppIcon.jsx` and `../utils/runnerShellNav.js`.
- **Wrong spacing or color:** inspect the stylesheet above and later imports in
  `../styles/app.css`. Its import order is intentional; `style.css` is a frozen
  reference, and `style.generated.css` is generated for tests.
- **Run-list loading:** use `runsCache.ts`, `runsLoadMore.ts` and
  `runsRequestCoordinator.ts` beside `runs/Runs.jsx`.
- **Shared heatmap cache:** use `../utils/heatmap/cache.js`; its owner is shared
  because authentication and run deletion also invalidate it.

## Run Tests

From the repository root:

```bash
npm --prefix frontend run test:contracts -- shoes
npm --prefix frontend run test:contracts -- admin
npm --prefix frontend run test:contracts -- shared
npm --prefix frontend run test:unit -- src/pages/runs/
npm --prefix frontend test
npm run check:architecture
```

`test:contracts` with no feature runs every contract, including shared utilities.
Feature names match directory names. Vitest filters are useful for features that
contain `*.vitest.*` files. Unknown or empty contract selections fail.

Routes and access guards live in [../App.jsx](../App.jsx); lazy loaders and hover
prefetching live in [../utils/routePreload.js](../utils/routePreload.js). The aliases
`/admin`, `/workflows`, `/weather-engine`, `/analysis/vo2max` and `/add-shoes` are
redirects in App, not extra implementations.

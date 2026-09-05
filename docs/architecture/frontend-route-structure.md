# Frontend Route Structure

Pages are organized by the feature names visible in the browser. Keep each route's
entry component and private helpers in its feature directory. Feature tests belong
in that directory's `__tests__/`; checks spanning the application belong in
`frontend/src/test/contracts/`.

## Migration

| Previous files under `frontend/src/pages/` | New feature directory |
| --- | --- |
| Login, Signup, ForgotPassword | `auth/` |
| Profile, ProfileDashboard | `profile/` |
| Runs, RunDetail, runsCache, runsLoadMore, runsRequestCoordinator | `runs/` |
| Analysis, AnalysisInsightDetail | `analysis/` |
| PredictionDetail | `prediction/` |
| Heatmap, heatmapRenderPointPool | `heatmap/` |
| Shoes, AddShoes, ShoeCatalog | `shoes/` |
| Races, RacesDetail | `races/` |
| Schedule | `schedule/` |
| TodayRun | `today-run/` |
| MuscleTraining | `muscle-training/` |
| Settings, ImportDataSettings, GarminImportSettings | `settings/` |
| Dashboard and existing admin section/model files | `admin/` |
| Landing | `landing/` |
| LegalPage | `legal/` |
| Rewards | `rewards/` |
| WeatherEngine | `weather/` |

The 289-file migration includes route code, private helpers, and their tests.
URLs, component names, lazy loading, storage keys, API behavior and CSS cascade
remain unchanged. There are no forwarding files at old locations.

## Editing A Feature

Start at the route entry named in `frontend/src/pages/README.md`, then follow its
imports. Shared React components live in `components/`, shared hooks in `hooks/`,
domain calculations in `utils/`, HTTP adapters in `api/`, and locale copy in
`i18n/locales/`. A shared utility must not import a page component.

Styles retain their current cascade under `styles/`; the route guide identifies
the principal stylesheet and later overrides. The complete frontend/backend owner
map is `docs/ai/functionality-direction-tree.json`.

Run a feature's tests with `npm --prefix frontend run test:contracts -- <feature>`
and `npm --prefix frontend run test:unit -- src/pages/<feature>/`. The unit command
is applicable when that feature has Vitest files. Run `npm --prefix frontend test`,
lint, the architecture check, and the production build after a route migration.

## Verification

Verified in the requested 125d worktree on 2026-09-04:

- All 289 destination files exist; all old source locations are removed.
- 157 runtime modules have equivalent syntax trees after resolving moved imports.
- Typecheck, 80 Vitest tests, and all 330 contract tests pass.
- Feature selection passes 38 shoe contracts and rejects unknown features.
- Lint has zero errors and two existing I18nContext warnings.
- Production build, architecture checks and 16 architecture guard tests pass.
- Functionality direction-tree validation and its tests pass.
- Updated console/workflow path checks pass. The workflow-adapter suite retains
  three previously documented assertions unrelated to the route moves.

This is source/build verification, not proof of a running website update. The
machine-local runtime synchronization verifier is absent in this worktree.

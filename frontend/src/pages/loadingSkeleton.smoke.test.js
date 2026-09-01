import fs from 'node:fs';
import assert from 'node:assert/strict';

const appSource = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const skeletonSource = fs.readFileSync(new URL('../components/PageSkeleton.jsx', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const styleSource = fs.readFileSync(new URL('../styles/loading-skeleton.css', import.meta.url), 'utf8');

const routeVariants = {
  '/': 'landing',
  '/login': 'auth',
  '/signup': 'signup',
  '/forgot-password': 'forgot-password',
  '/admin': 'admin',
  '/terms': 'legal',
  '/privacy': 'legal',
  '/profile': 'profile',
  '/runs': 'runs',
  '/runs/:id': 'run-detail',
  '/analysis': 'analysis',
  '/analysis/:insight': 'analysis-insight',
  '/analysis/load-balance': 'analysis-load',
  '/analysis/intensity': 'analysis-intensity',
  '/analysis/injury-risk': 'analysis-injury',
  '/analysis/coach-insight': 'analysis-coach',
  '/prediction/:id': 'prediction',
  '/heatmap': 'heatmap',
  '/weather': 'weather',
  '/today-run': 'today-run',
  '/rewards': 'rewards',
  '/settings': 'settings',
  '/settings/import-data': 'import-data',
  '/shoes': 'shoes',
  '/shoes/add': 'add-shoes',
  '/shoe-catalog': 'shoe-catalog',
  '/races': 'races',
  '/races/details/:raceId': 'race-detail',
  '/schedule': 'schedule',
  '/muscle-training': 'muscle-training',
  '/dashboard': 'admin',
  '/workflows': 'admin',
  '/analysis/vo2max': 'analysis',
};

assert(
  appSource.includes("import PageSkeleton from './components/PageSkeleton';")
    && appSource.includes('<Suspense fallback={<RouteLoading />}>')
    && appSource.includes('return <PageSkeleton variant={variant} activeTab={activeTab} />;')
    && appSource.includes("get('skeleton-preview')")
    && appSource.includes('ADMIN_SKELETON_ROUTE_TABS')
    && appSource.includes('getAdminSkeletonTab')
    && appSource.includes("'login'")
    && appSource.includes('if (skeletonPreviewVariant)')
    && Object.values(routeVariants).every((variant) => appSource.includes(`variant = '${variant}'`)),
  'Route-level code splitting should render a route-specific page skeleton instead of a text-only loader.',
);

assert(
  skeletonSource.includes('aria-busy="true"')
    && skeletonSource.includes('page-skeleton--${variant}')
    && skeletonSource.includes("['page-skeleton', 'page-skeleton--runner', 'is-sidebar-collapsed', `page-skeleton--${variant}`]")
    && skeletonSource.includes('function RunnerFooterSkeleton()')
    && skeletonSource.includes('page-skeleton__runner-footer')
    && skeletonSource.includes('page-skeleton--legal')
    && skeletonSource.includes('page-skeleton__rail')
    && skeletonSource.includes('page-skeleton__rail-item')
    && skeletonSource.includes('page-skeleton__topbar-pill')
    && skeletonSource.includes('page-skeleton__runs-cockpit')
    && skeletonSource.includes('page-skeleton__runs-workbench')
    && skeletonSource.includes('page-skeleton__runs-insight-strip')
    && skeletonSource.includes('page-skeleton__runs-card-grid')
    && skeletonSource.includes('page-skeleton__analysis-cockpit')
    && skeletonSource.includes('page-skeleton__analysis-reference-grid')
    && skeletonSource.includes('page-skeleton__analysis-bento-grid')
    && skeletonSource.includes('page-skeleton__analysis-table-grid')
    && skeletonSource.includes('page-skeleton__profile-editorial-hero')
    && skeletonSource.includes('page-skeleton__profile-comeback')
    && skeletonSource.includes('page-skeleton__profile-today')
    && skeletonSource.includes('page-skeleton__profile-training-grid')
    && skeletonSource.includes('page-skeleton__profile-progression')
    && skeletonSource.includes('page-skeleton__profile-rewards')
    && skeletonSource.includes('page-skeleton__shoes-workspace-head')
    && skeletonSource.includes('page-skeleton__shoes-inventory-grid')
    && skeletonSource.includes('page-skeleton__heatmap-map-shell')
    && skeletonSource.includes('page-skeleton__heatmap-utility-divider')
    && skeletonSource.includes('page-skeleton__heatmap-legend-band-label')
    && skeletonSource.includes('page-skeleton__heatmap-legend-band-swatch')
    && skeletonSource.includes('page-skeleton__schedule-week-grid')
    && skeletonSource.includes('page-skeleton__schedule-command-metric')
    && skeletonSource.includes('page-skeleton__schedule-coach-card')
    && skeletonSource.includes('page-skeleton__today-coaching')
    && skeletonSource.includes('page-skeleton__rewards-hero-card')
    && skeletonSource.includes('page-skeleton__settings-identity-hero')
    && skeletonSource.includes('page-skeleton__settings-content-grid')
    && skeletonSource.includes('page-skeleton__settings-preferences')
    && skeletonSource.includes('page-skeleton__settings-checklist')
    && skeletonSource.includes('page-skeleton__settings-weekly')
    && skeletonSource.includes('page-skeleton__settings-services-grid')
    && skeletonSource.includes('page-skeleton__settings-services-inner')
    && skeletonSource.includes('page-skeleton__muscle-above-fold')
    && skeletonSource.includes('page-skeleton__muscle-selector')
    && skeletonSource.includes('page-skeleton__muscle-reference')
    && skeletonSource.includes('page-skeleton__run-detail-content-grid')
    && skeletonSource.includes('page-skeleton__insight-command-grid')
    && skeletonSource.includes('page-skeleton__prediction-command-grid')
    && skeletonSource.includes('page-skeleton__admin-layout')
    && skeletonSource.includes('page-skeleton__admin-sidebar')
    && ['profile', 'runs', 'run-detail', 'analysis', 'analysis-insight', 'analysis-load', 'analysis-intensity', 'analysis-injury', 'analysis-coach', 'prediction', 'heatmap', 'weather', 'today-run', 'rewards', 'settings', 'garmin', 'import-data', 'shoes', 'add-shoes', 'shoe-catalog', 'races', 'race-detail', 'schedule', 'muscle-training', 'admin']
      .every((variant) => skeletonSource.includes(`variant === '${variant}'`))
    && skeletonSource.includes("if (variant === 'landing')")
    && skeletonSource.includes('page-skeleton__landing-hero')
    && skeletonSource.includes('page-skeleton__landing-art')
    && skeletonSource.includes('page-skeleton__landing-shoe')
    && styleSource.includes('.page-skeleton__landing-hero')
    && styleSource.includes('.page-skeleton__landing-shoe')
    && skeletonSource.includes('shoeSkeletonAsset')
    && styleSource.includes('-webkit-mask-image: var(--page-skeleton-shoe-mask)')
    && styleSource.includes('aspect-ratio: 1;')
    && skeletonSource.includes("if (['auth', 'login', 'signup', 'forgot-password', 'admin-login'].includes(variant))")
    && skeletonSource.includes('page-skeleton__auth-dot-field')
    && skeletonSource.includes('page-skeleton__auth-formside')
    && skeletonSource.includes('page-skeleton__auth-social')
    && styleSource.includes('.page-skeleton__auth-dot-field')
    && styleSource.includes('.page-skeleton__auth-formside'),
  'The shared skeleton should expose a distinct composition for every application route.',
);

const pageVariants = {
  'ProfileDashboard.jsx': 'profile',
  'Runs.jsx': 'runs',
  'Analysis.jsx': 'analysis',
  'Heatmap.jsx': 'heatmap',
  'MuscleTraining.jsx': 'muscle-training',
  'Shoes.jsx': 'shoes',
  'ShoeCatalog.jsx': 'shoe-catalog',
  'Dashboard.jsx': 'admin',
  'AnalysisInsightDetail.jsx': 'analysis-insight',
  'Races.jsx': 'races',
  'Rewards.jsx': 'rewards',
  'Schedule.jsx': 'schedule',
  'Settings.jsx': 'settings',
  'TodayRun.jsx': 'today-run',
  'WeatherEngine.jsx': 'weather',
  'PredictionDetail.jsx': 'prediction',
  'AddShoes.jsx': 'add-shoes',
};

for (const [file, variant] of Object.entries(pageVariants)) {
  const source = fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
  assert(
    source.includes(`PageSkeleton variant="${variant}"`),
    `${file} should use its route-specific data skeleton while loading.`,
  );
}

const dataLoadingSkeletons = {
  'ProfileDashboard.jsx': /if \(loadState === 'loading'\) return <PageSkeleton variant="profile" \/>/,
  'Runs.jsx': /if \(loadState === 'loading'\) return <PageSkeleton variant="runs" \/>/,
  'Analysis.jsx': /if \(runsState === 'loading'\) return <PageSkeleton variant="analysis" \/>/,
  'Heatmap.jsx': /if \(heatmapState === 'loading'\) return <PageSkeleton variant="heatmap" \/>/,
  'MuscleTraining.jsx': /if \(loading\) return <PageSkeleton variant="muscle-training" \/>/,
  'Shoes.jsx': /if \(loadState === 'loading'\) return <PageSkeleton variant="shoes" \/>/,
  'ShoeCatalog.jsx': /if \(isLoading\) return <PageSkeleton variant="shoe-catalog" \/>/,
};

for (const [file, loadingPattern] of Object.entries(dataLoadingSkeletons)) {
  assert.match(
    fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'),
    loadingPattern,
    `${file} should visibly switch to its custom skeleton during the initial API wait.`,
  );
}

assert(
  fs.readFileSync(new URL('./RacesDetail.jsx', import.meta.url), 'utf8').includes('race-detail-page--loading'),
  'RacesDetail should keep its race hero and course-map landmarks visible while supplemental data loads.',
);

assert(
  indexSource.includes("@import './styles/loading-skeleton.css';")
    && styleSource.includes('@keyframes hermesSkeletonShimmer')
    && styleSource.includes('.runner-shell-page--loading[data-loading-state="loading"]')
    && styleSource.includes('.dashboard-body--loading')
    && styleSource.includes('--hermes-skeleton-base: rgba(214, 228, 238, 0.12)')
    && styleSource.includes('linear-gradient(180deg, #07090c 0%, #05070a 54%, #030406 100%)')
    && styleSource.includes('grid-template-columns: auto minmax(250px, 390px) minmax(0, 1fr)')
    && styleSource.includes('width: 60px; max-height: calc(100vh - 136px)')
    && styleSource.includes('right: 26px; bottom: 26px; display: grid; gap: 20px; width: min(320px, calc(100% - 52px)); padding: 24px; border: 1px solid')
    && styleSource.includes('border-radius: 26px; background: rgba(255,252,247,.88)')
    && styleSource.includes('grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px')
    && styleSource.includes('height: 42px; border-radius: 999px')
    && styleSource.includes('@media (prefers-reduced-motion: reduce)'),
  'Loading skeleton styles should cover route shells, admin shells, reduced motion, and data-page fallbacks.',
);

assert(
  [
    '.page-skeleton__profile-hero',
    '.page-skeleton__map-hero',
    '.page-skeleton__weather-hero',
    '.page-skeleton__weather-metrics',
    '.page-skeleton__weather-forecast',
    '.page-skeleton__runs-shell',
    '.page-skeleton__analysis-load',
    '.page-skeleton__analysis-intensity',
    '.page-skeleton__analysis-injury-profile',
    '.page-skeleton__analysis-coach',
    '.page-skeleton__races-content',
    '.page-skeleton__catalog-shell',
    '.page-skeleton__garmin-shell',
    '.page-skeleton__import-shell',
    '.page-skeleton__shoes-screen',
    '.page-skeleton__hero-metrics',
    '.page-skeleton__product-grid',
    '.page-skeleton__race-detail-hero',
    '.race-detail-page--loading',
    '.race-detail-loading-hero',
    '.page-skeleton__settings-grid',
    '.page-skeleton__garmin-panel',
    '.page-skeleton__import-panel',
    '.page-skeleton__import-lanes',
    '.page-skeleton__admin-layout',
    '.page-skeleton__admin-sidebar',
    '.page-skeleton__profile-editorial-hero',
    '.page-skeleton__profile-comeback',
    '.page-skeleton__profile-today',
    '.page-skeleton__profile-metric-strip',
    '.page-skeleton__profile-training-grid',
    '.page-skeleton__profile-progression',
    '.page-skeleton__profile-bottom-grid',
    '.page-skeleton__profile-rewards',
    '.page-skeleton__shoes-workspace-head',
    '.page-skeleton__shoes-stage',
    '.page-skeleton__shoes-inventory-grid',
    '.page-skeleton__heatmap-map-shell',
    '.page-skeleton__heatmap-legend',
    '.page-skeleton__schedule-week-grid',
    '.page-skeleton__schedule-bottom-grid',
    '.page-skeleton__today-coaching',
    '.page-skeleton__today-coach',
    '.page-skeleton__muscle-above-fold',
    '.page-skeleton__muscle-workbench-grid',
    '.page-skeleton__rewards-hero-card',
    '.page-skeleton__rewards-catalog-grid',
    '.page-skeleton__settings-content-grid',
    '.page-skeleton__settings-bottom-grid',
    '.page-skeleton__settings-identity-hero',
    '.page-skeleton__settings-preferences',
    '.page-skeleton__settings-checklist',
    '.page-skeleton__settings-weekly',
    '.page-skeleton__settings-services-grid',
    '.page-skeleton__settings-services-inner',
    '.page-skeleton__run-detail-content-grid',
    '.page-skeleton__run-detail-telemetry',
    '.page-skeleton__insight-command-grid',
    '.page-skeleton__prediction-command-grid',
    '.page-skeleton__garmin-content-grid',
    '.page-skeleton__import-lanes',
    '.page-skeleton__add-shoes-content-grid',
    '.page-skeleton__analysis-cockpit',
    '.page-skeleton__analysis-reference-grid',
    '.page-skeleton__analysis-bento-grid',
    '.page-skeleton__analysis-table-grid',
    '.page-skeleton__analysis-injury',
    '.page-skeleton__admin-topbar',
    '.page-skeleton--signup',
    '.page-skeleton--forgot-password',
    '.page-skeleton--admin-login',
    '.runner-dashboard-loading-card--skeleton',
    '.recent-runs-status--loading',
    '.premium-empty-state--loading',
    '.heatmap-page-empty--loading',
    '.muscle-training-loading-skeleton',
    '.shoe-inventory-status--loading',
    '.weather-engine-forecast-empty--loading',
  ].every((selector) => styleSource.includes(selector)),
  'Route-specific skeleton geometry should include the page landmarks for dashboard, data, auth, race, catalog, and settings surfaces.',
);

assert(
  styleSource.includes('--hermes-skeleton-rail-width: clamp(156px, 9.2vw, 178px)')
    && styleSource.includes('grid-template-columns: var(--hermes-skeleton-rail-width) minmax(0, 1fr)')
    && styleSource.includes('.page-skeleton__rail-item')
    && styleSource.includes('.page-skeleton__topbar-pill')
    && styleSource.includes('min-height: 80px'),
  'The loading shell should preserve the live runner rail, numbered navigation rows, topbar, and canvas proportions.',
);

assert(
  skeletonSource.includes('function AdminPageSkeleton({ activeTab = \'overview\' })')
    && skeletonSource.includes('const ADMIN_SKELETON_TABS')
    && skeletonSource.includes('Array.from({ length: ADMIN_SKELETON_TABS.length }')
    && skeletonSource.includes('page-skeleton__admin-content')
    && skeletonSource.includes('page-skeleton__admin-hero')
    && skeletonSource.includes('page-skeleton__admin-metric-grid')
    && skeletonSource.includes("const isJobs = activeTab === 'jobs'")
    && skeletonSource.includes('page-skeleton__admin-spotlight')
    && skeletonSource.includes('page-skeleton__admin-workspace')
    && skeletonSource.includes('page-skeleton__admin-detail')
    && skeletonSource.includes('page-skeleton__admin-job-row'),
  'The admin jobs skeleton should preserve the loaded hierarchy: hero, metrics, spotlight, queue, and detail workspace.',
);

assert(
  ['AdminOverviewSkeleton', 'AdminUsersSkeleton', 'AdminCourseMapsSkeleton', 'AdminShoesSkeleton', 'AdminAuditSkeleton', 'AdminSettingsSkeleton']
    .every((name) => skeletonSource.includes(`function ${name}()`))
    && [
      'page-skeleton__admin-overview-charts',
      'page-skeleton__admin-overview-two-col',
      'page-skeleton__admin-users-hero',
      'page-skeleton__admin-coursemaps-grid',
      'page-skeleton__admin-shoes-catalog',
      'page-skeleton__admin-audit-table',
      'page-skeleton__admin-settings-grid',
    ].every((className) => skeletonSource.includes(className) && styleSource.includes(`.${className}`)),
  'Every non-jobs admin destination should expose route-specific loading landmarks instead of the generic list fallback.',
);

assert(
  styleSource.includes('--hermes-admin-skeleton-rail-width: 304px')
    && styleSource.includes('--hermes-admin-skeleton-topbar-height: 80px')
    && styleSource.includes('.page-skeleton__admin-sidebar {')
    && styleSource.includes('position: fixed;')
    && styleSource.includes('margin-left: var(--hermes-admin-skeleton-rail-width);')
    && styleSource.includes('min-height: var(--hermes-admin-skeleton-topbar-height);')
    && styleSource.includes('@media (max-width: 1100px) and (min-width: 901px)')
    && styleSource.includes('grid-template-rows: 182px 159px;')
    && styleSource.includes('grid-template-rows: 128px 1081px 374px 591px 147px 99px;')
    && styleSource.includes('min-height: 267px;')
    && styleSource.includes('min-height: 196px;')
    && styleSource.includes('.page-skeleton__admin-spotlight {')
    && styleSource.includes('.page-skeleton__admin-workspace {')
    && styleSource.includes('.page-skeleton__admin-detail {')
    && styleSource.includes('.page-skeleton__admin-job-row'),
  'The admin skeleton should use the same fixed rail, topbar, spotlight, and two-column workspace geometry as the loaded admin shell.',
);

assert(
  fs.readFileSync(new URL('./Dashboard.jsx', import.meta.url), 'utf8').includes('<PageSkeleton variant="admin" activeTab={activeTab} />')
    && fs.readFileSync(new URL('./Dashboard.jsx', import.meta.url), 'utf8').includes('admin-jobs-command-deck__spotlight')
    && fs.readFileSync(new URL('./Dashboard.jsx', import.meta.url), 'utf8').includes('admin-jobs-command-deck__workspace'),
  'The admin skeleton should retain the active dashboard destination and mirror the loaded jobs landmarks.',
);

console.log('[PASS] Shared page skeleton guardrails passed.');

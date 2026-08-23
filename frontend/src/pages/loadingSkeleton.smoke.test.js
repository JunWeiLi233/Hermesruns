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
  '/admin': 'admin-login',
  '/terms': 'legal',
  '/privacy': 'legal',
  '/profile': 'profile',
  '/runs': 'runs',
  '/runs/:id': 'run-detail',
  '/analysis': 'analysis',
  '/analysis/:insight': 'analysis-insight',
  '/prediction/:id': 'prediction',
  '/heatmap': 'heatmap',
  '/weather': 'weather',
  '/today-run': 'today-run',
  '/rewards': 'rewards',
  '/settings': 'settings',
  '/settings/garmin-import': 'garmin',
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
    && appSource.includes('return <PageSkeleton variant={variant} />;')
    && appSource.includes("get('skeleton-preview')")
    && appSource.includes("'login'")
    && appSource.includes('if (skeletonPreviewVariant)')
    && Object.values(routeVariants).every((variant) => appSource.includes(`variant = '${variant}'`)),
  'Route-level code splitting should render a route-specific page skeleton instead of a text-only loader.',
);

assert(
  skeletonSource.includes('aria-busy="true"')
    && skeletonSource.includes('page-skeleton--${variant}')
    && skeletonSource.includes("['page-skeleton', 'page-skeleton--runner', `page-skeleton--${variant}`]")
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
    && skeletonSource.includes('page-skeleton__shoes-signal')
    && skeletonSource.includes('page-skeleton__shoes-inventory-grid')
    && skeletonSource.includes('page-skeleton__heatmap-map-shell')
    && skeletonSource.includes('page-skeleton__schedule-week-grid')
    && skeletonSource.includes('page-skeleton__schedule-command-metric')
    && skeletonSource.includes('page-skeleton__schedule-coach-card')
    && skeletonSource.includes('page-skeleton__today-coaching')
    && skeletonSource.includes('page-skeleton__rewards-achievements')
    && skeletonSource.includes('page-skeleton__settings-identity-hero')
    && skeletonSource.includes('page-skeleton__settings-content-grid')
    && skeletonSource.includes('page-skeleton__settings-preferences')
    && skeletonSource.includes('page-skeleton__settings-checklist')
    && skeletonSource.includes('page-skeleton__settings-weekly')
    && skeletonSource.includes('page-skeleton__settings-services-grid')
    && skeletonSource.includes('page-skeleton__settings-health')
    && skeletonSource.includes('page-skeleton__muscle-above-fold')
    && skeletonSource.includes('page-skeleton__muscle-selector')
    && skeletonSource.includes('page-skeleton__muscle-reference')
    && skeletonSource.includes('page-skeleton__run-detail-main-grid')
    && skeletonSource.includes('page-skeleton__insight-command-grid')
    && skeletonSource.includes('page-skeleton__prediction-command-grid')
    && skeletonSource.includes('page-skeleton__admin-layout')
    && skeletonSource.includes('page-skeleton__admin-sidebar')
    && ['profile', 'runs', 'run-detail', 'analysis', 'analysis-insight', 'prediction', 'heatmap', 'weather', 'today-run', 'rewards', 'settings', 'garmin', 'import-data', 'shoes', 'add-shoes', 'shoe-catalog', 'races', 'race-detail', 'schedule', 'muscle-training', 'admin']
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
    '.page-skeleton__hero-metrics',
    '.page-skeleton__product-grid',
    '.page-skeleton__race-detail-hero',
    '.race-detail-page--loading',
    '.race-detail-loading-hero',
    '.page-skeleton__settings-grid',
    '.page-skeleton__garmin-panel',
    '.page-skeleton__import-panel',
    '.page-skeleton__import-sources',
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
    '.page-skeleton__shoes-signal',
    '.page-skeleton__shoes-stage',
    '.page-skeleton__shoes-inventory-grid',
    '.page-skeleton__heatmap-map-shell',
    '.page-skeleton__heatmap-legend',
    '.page-skeleton__heatmap-sessions',
    '.page-skeleton__schedule-week-grid',
    '.page-skeleton__schedule-bottom-grid',
    '.page-skeleton__today-coaching',
    '.page-skeleton__today-middle-grid',
    '.page-skeleton__today-coach',
    '.page-skeleton__muscle-above-fold',
    '.page-skeleton__muscle-workbench-grid',
    '.page-skeleton__rewards-achievements',
    '.page-skeleton__rewards-catalog-grid',
    '.page-skeleton__settings-content-grid',
    '.page-skeleton__settings-bottom-grid',
    '.page-skeleton__settings-identity-hero',
    '.page-skeleton__settings-preferences',
    '.page-skeleton__settings-checklist',
    '.page-skeleton__settings-weekly',
    '.page-skeleton__settings-services-grid',
    '.page-skeleton__settings-health',
    '.page-skeleton__run-detail-main-grid',
    '.page-skeleton__run-detail-telemetry',
    '.page-skeleton__insight-command-grid',
    '.page-skeleton__prediction-command-grid',
    '.page-skeleton__garmin-content-grid',
    '.page-skeleton__import-workbench',
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

console.log('[PASS] Shared page skeleton guardrails passed.');

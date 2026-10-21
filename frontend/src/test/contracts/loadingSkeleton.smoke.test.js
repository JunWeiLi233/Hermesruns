import fs from 'node:fs';
import assert from 'node:assert/strict';

const appSource = fs.readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const skeletonSource = fs.readFileSync(new URL('../../components/PageSkeleton.jsx', import.meta.url), 'utf8');
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

const pageVariants = {
  "../../pages/profile/ProfileDashboard.jsx": 'profile',
  "../../pages/runs/Runs.jsx": 'runs',
  "../../pages/analysis/Analysis.jsx": 'analysis',
  "../../pages/heatmap/Heatmap.jsx": 'heatmap',
  "../../pages/muscle-training/MuscleTraining.jsx": 'muscle-training',
  "../../pages/shoes/Shoes.jsx": 'shoes',
  "../../pages/shoes/ShoeCatalog.jsx": 'shoe-catalog',
  "../../pages/admin/Dashboard.jsx": 'admin',
  "../../pages/analysis/AnalysisInsightDetail.jsx": 'analysis-insight',
  "../../pages/races/Races.jsx": 'races',
  "../../pages/races/RacesDetail.jsx": 'race-detail',
  "../../pages/rewards/Rewards.jsx": 'rewards',
  "../../pages/schedule/Schedule.jsx": 'schedule',
  "../../pages/settings/Settings.jsx": 'settings',
  "../../pages/today-run/TodayRun.jsx": 'today-run',
  "../../pages/weather/WeatherEngine.jsx": 'weather',
  "../../pages/prediction/PredictionDetail.jsx": 'prediction',
  "../../pages/shoes/AddShoes.jsx": 'add-shoes',
};

for (const [file, variant] of Object.entries(pageVariants)) {
  const source = fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
  assert(
    source.includes(`PageSkeleton variant="${variant}"`),
    `${file} should use its route-specific data skeleton while loading.`,
  );
}

const dataLoadingSkeletons = {
  "../../pages/profile/ProfileDashboard.jsx": /if \(loadState === 'loading'\) return <PageSkeleton variant="profile" \/>/,
  "../../pages/runs/Runs.jsx": /if \(loadState === 'loading'\) return <PageSkeleton variant="runs" \/>/,
  "../../pages/analysis/Analysis.jsx": /if \(runsState === 'loading'\) return <PageSkeleton variant="analysis" \/>/,
  "../../pages/heatmap/Heatmap.jsx": /if \(heatmapState === 'loading'\) return <PageSkeleton variant="heatmap" \/>/,
  "../../pages/muscle-training/MuscleTraining.jsx": /if \(loading\) return <PageSkeleton variant="muscle-training" \/>/,
  "../../pages/shoes/Shoes.jsx": /if \(loadState === 'loading'\) return <PageSkeleton variant="shoes" \/>/,
  "../../pages/shoes/ShoeCatalog.jsx": /if \(isLoading\) return <PageSkeleton variant="shoe-catalog" \/>/,
};

for (const [file, loadingPattern] of Object.entries(dataLoadingSkeletons)) {
  assert.match(
    fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'),
    loadingPattern,
    `${file} should visibly switch to its custom skeleton during the initial API wait.`,
  );
}

assert(
  fs.readFileSync(new URL('../../pages/races/RacesDetail.jsx', import.meta.url), 'utf8').includes("if (loadState === 'loading') return <PageSkeleton variant=\"race-detail\" />"),
  'RacesDetail should keep its race hero and course-map landmarks visible while supplemental data loads.',
);

assert(skeletonSource.includes("import './loading/loading-design.css';"), 'Route loading styles must be eager, before lazy content.');
const statusSource=fs.readFileSync(new URL('../../components/loading/LoadingStatus.jsx',import.meta.url),'utf8');
assert(statusSource.includes('subscribeWakeRetry') && statusSource.includes('clearTimeout') && statusSource.includes('aria-live="polite"'), 'Live loading status must follow the API wake signal and release subscriptions/timers.');
console.log('[PASS] Route-specific loading gates and shared status contracts passed.');

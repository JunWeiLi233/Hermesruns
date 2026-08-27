import React, { Suspense, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UnitProvider } from './contexts/UnitContext';
import AppErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import { routeParamPreloaders, routePreloaders } from './utils/routePreload';

// Route chunks are loaded through the shared routePreloaders map so
// hover/focus prefetching (utils/routePreload.js) triggers the exact same
// import functions React.lazy uses here.
const Landing = React.lazy(routePreloaders['/']);
const Login = React.lazy(routePreloaders['/login']);
const Signup = React.lazy(routePreloaders['/signup']);
const ForgotPassword = React.lazy(routePreloaders['/forgot-password']);
const Dashboard = React.lazy(routePreloaders['/dashboard']);
const Profile = React.lazy(routePreloaders['/profile']);
const Runs = React.lazy(routePreloaders['/runs']);
const RunDetail = React.lazy(routeParamPreloaders['/runs/:id']);
const Analysis = React.lazy(routePreloaders['/analysis']);
const Heatmap = React.lazy(routePreloaders['/heatmap']);
const WeatherEngine = React.lazy(routePreloaders['/weather']);
const AnalysisInsightDetail = React.lazy(routeParamPreloaders['/analysis/:insightKey']);
const AddShoes = React.lazy(routePreloaders['/shoes/add']);
const Shoes = React.lazy(routePreloaders['/shoes']);
const ShoeCatalog = React.lazy(routePreloaders['/shoe-catalog']);
const Races = React.lazy(routePreloaders['/races']);
const RacesDetail = React.lazy(routeParamPreloaders['/races/details/:raceId']);
const Schedule = React.lazy(routePreloaders['/schedule']);
const TodayRun = React.lazy(routePreloaders['/today-run']);
const PredictionDetail = React.lazy(routeParamPreloaders['/prediction/:distKey']);
const MuscleTraining = React.lazy(routePreloaders['/muscle-training']);
const Rewards = React.lazy(routePreloaders['/rewards']);
const Settings = React.lazy(routePreloaders['/settings']);
const GarminImportSettings = React.lazy(routePreloaders['/settings/garmin-import']);
const ImportDataSettings = React.lazy(routePreloaders['/settings/import-data']);
const LegalPage = React.lazy(routePreloaders['/terms']);

const SKELETON_PREVIEW_VARIANTS = new Set([
  'runner', 'profile', 'runs', 'run-detail', 'analysis', 'analysis-insight', 'prediction',
  'heatmap', 'weather', 'today-run', 'rewards', 'settings', 'garmin', 'import-data',
  'shoes', 'add-shoes', 'shoe-catalog', 'races', 'race-detail', 'schedule',
  'muscle-training', 'analysis-load', 'analysis-intensity', 'analysis-injury', 'analysis-coach', 'admin', 'landing', 'auth', 'login', 'signup', 'forgot-password', 'legal',
]);

const ADMIN_SKELETON_ROUTE_TABS = {
  '/dashboard': 'overview',
  '/dashboard/users': 'users',
  '/dashboard/course-maps': 'courseMaps',
  '/dashboard/shoes': 'shoes',
  '/dashboard/jobs': 'jobs',
  '/dashboard/audit': 'audit',
  '/dashboard/settings': 'settings',
};

function getAdminSkeletonTab(pathname) {
  return ADMIN_SKELETON_ROUTE_TABS[String(pathname || '').replace(/\/+$/, '')] || 'overview';
}

function getSkeletonPreviewVariant() {
  if (typeof window === 'undefined') return null;
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!import.meta.env.DEV && !isLocalHost) return null;
  const variant = new URLSearchParams(window.location.search).get('skeleton-preview');
  return SKELETON_PREVIEW_VARIANTS.has(variant) ? variant : null;
}

function ScrollToTop() {
  const location = useLocation();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const rafId = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(rafId);
  }, [location.key]);

  return null;
}

function RouteLoading() {
  const { pathname } = useLocation();
  let variant = 'runner';
  if (pathname === '/') variant = 'landing';
  else if (pathname === '/login') variant = 'auth';
  else if (pathname === '/signup') variant = 'signup';
  else if (pathname === '/forgot-password') variant = 'forgot-password';
  else if (pathname === '/admin') variant = 'admin';
  else if (pathname === '/terms' || pathname === '/privacy') variant = 'legal';
  else if (pathname.startsWith('/dashboard')) variant = 'admin';
  else if (pathname === '/workflows') variant = 'admin';
  else if (pathname === '/profile') variant = 'profile';
  else if (pathname === '/runs') variant = 'runs';
  else if (pathname.startsWith('/runs/')) variant = 'run-detail';
  else if (pathname === '/analysis') variant = 'analysis';
  else if (pathname === '/analysis/vo2max') variant = 'analysis';
  else if (pathname === '/analysis/load-balance') variant = 'analysis-load';
  else if (pathname === '/analysis/intensity') variant = 'analysis-intensity';
  else if (pathname === '/analysis/injury-risk') variant = 'analysis-injury';
  else if (pathname === '/analysis/coach-insight') variant = 'analysis-coach';
  else if (pathname.startsWith('/analysis/')) variant = 'analysis-insight';
  else if (pathname.startsWith('/prediction/')) variant = 'prediction';
  else if (pathname === '/heatmap') variant = 'heatmap';
  else if (pathname === '/weather' || pathname === '/weather-engine') variant = 'weather';
  else if (pathname === '/today-run') variant = 'today-run';
  else if (pathname === '/rewards') variant = 'rewards';
  else if (pathname === '/settings') variant = 'settings';
  else if (pathname === '/settings/garmin-import') variant = 'garmin';
  else if (pathname === '/settings/import-data') variant = 'import-data';
  else if (pathname === '/shoes') variant = 'shoes';
  else if (pathname === '/shoes/add' || pathname === '/add-shoes') variant = 'add-shoes';
  else if (pathname === '/shoe-catalog') variant = 'shoe-catalog';
  else if (pathname === '/races') variant = 'races';
  else if (pathname.startsWith('/races/details/')) variant = 'race-detail';
  else if (pathname === '/schedule') variant = 'schedule';
  else if (pathname === '/muscle-training') variant = 'muscle-training';

  const activeTab = variant === 'admin' ? getAdminSkeletonTab(pathname) : 'overview';
  return <PageSkeleton variant={variant} activeTab={activeTab} />;
}

function AdminOnlyRoute({ children }) {
  const { isAuthenticated, isAdmin, authHydrated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!authHydrated) return <RouteLoading />;
  if (!isAdmin) return <Navigate to="/profile" replace />;
  return children;
}

function UserOnlyRoute({ children }) {
  const { isAuthenticated, isAdmin, authHydrated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!authHydrated) return <RouteLoading />;
  if (isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  const skeletonPreviewVariant = getSkeletonPreviewVariant();
  if (skeletonPreviewVariant) {
    const activeTab = skeletonPreviewVariant === 'admin' && typeof window !== 'undefined'
      ? getAdminSkeletonTab(window.location.pathname)
      : 'overview';
    return <PageSkeleton variant={skeletonPreviewVariant} activeTab={activeTab} />;
  }

  return (
    <I18nProvider>
      <AppErrorBoundary>
        <ThemeProvider>
          <UnitProvider>
            <AuthProvider>
              <Suspense fallback={<RouteLoading />}>
                <ScrollToTop />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/terms" element={<LegalPage variant="terms" />} />
                  <Route path="/privacy" element={<LegalPage variant="privacy" />} />
                  <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard/*" element={<AdminOnlyRoute><Dashboard /></AdminOnlyRoute>} />
                  <Route path="/workflows" element={<Navigate to="/dashboard/workflows" replace />} />
                  <Route path="/profile" element={<UserOnlyRoute><Profile /></UserOnlyRoute>} />
                  <Route path="/runs" element={<UserOnlyRoute><Runs /></UserOnlyRoute>} />
                  <Route path="/runs/:id" element={<UserOnlyRoute><RunDetail /></UserOnlyRoute>} />
                  <Route path="/analysis" element={<UserOnlyRoute><Analysis /></UserOnlyRoute>} />
                  <Route path="/heatmap" element={<UserOnlyRoute><Heatmap /></UserOnlyRoute>} />
                  <Route path="/weather" element={<UserOnlyRoute><WeatherEngine /></UserOnlyRoute>} />
                  <Route path="/weather-engine" element={<Navigate to="/weather" replace />} />
                  <Route path="/analysis/vo2max" element={<Navigate to="/analysis" replace />} />
                  <Route path="/analysis/:insightKey" element={<UserOnlyRoute><AnalysisInsightDetail /></UserOnlyRoute>} />
                  <Route path="/prediction/:distKey" element={<UserOnlyRoute><PredictionDetail /></UserOnlyRoute>} />
                  <Route path="/today-run" element={<UserOnlyRoute><TodayRun /></UserOnlyRoute>} />
                  <Route path="/rewards" element={<UserOnlyRoute><Rewards /></UserOnlyRoute>} />
                  <Route path="/settings" element={<UserOnlyRoute><Settings /></UserOnlyRoute>} />
                  <Route path="/settings/garmin-import" element={<UserOnlyRoute><GarminImportSettings /></UserOnlyRoute>} />
                  <Route path="/settings/import-data" element={<UserOnlyRoute><ImportDataSettings /></UserOnlyRoute>} />
                  <Route path="/shoes" element={<UserOnlyRoute><Shoes /></UserOnlyRoute>} />
                  <Route path="/shoes/add" element={<UserOnlyRoute><AddShoes /></UserOnlyRoute>} />
                  <Route path="/add-shoes" element={<Navigate to="/shoes/add" replace />} />
                  <Route path="/shoe-catalog" element={<UserOnlyRoute><ShoeCatalog /></UserOnlyRoute>} />
                  <Route path="/races" element={<UserOnlyRoute><Races /></UserOnlyRoute>} />
                  <Route path="/races/details/:raceId" element={<UserOnlyRoute><RacesDetail /></UserOnlyRoute>} />
                  <Route path="/schedule" element={<UserOnlyRoute><Schedule /></UserOnlyRoute>} />
                  <Route path="/muscle-training" element={<UserOnlyRoute><MuscleTraining /></UserOnlyRoute>} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </UnitProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </I18nProvider>
  );
}

export default App;

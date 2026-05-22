import React, { Suspense, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UnitProvider } from './contexts/UnitContext';
import AppErrorBoundary from './components/ErrorBoundary';

const Landing = React.lazy(() => import('./pages/Landing'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const AdminLogin = React.lazy(() => import('./pages/AdminLogin'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Runs = React.lazy(() => import('./pages/Runs'));
const RunDetail = React.lazy(() => import('./pages/RunDetail'));
const Analysis = React.lazy(() => import('./pages/Analysis'));
const Heatmap = React.lazy(() => import('./pages/Heatmap'));
const Territory = React.lazy(() => import('./pages/Territory'));
const WeatherEngine = React.lazy(() => import('./pages/WeatherEngine'));
const AnalysisInsightDetail = React.lazy(() => import('./pages/AnalysisInsightDetail'));
const AddShoes = React.lazy(() => import('./pages/AddShoes'));
const Shoes = React.lazy(() => import('./pages/Shoes'));
const ShoeCatalog = React.lazy(() => import('./pages/ShoeCatalog'));
const Races = React.lazy(() => import('./pages/Races'));
const RacesDetail = React.lazy(() => import('./pages/RacesDetail'));
const Schedule = React.lazy(() => import('./pages/Schedule'));
const TodayRun = React.lazy(() => import('./pages/TodayRun'));
const PredictionDetail = React.lazy(() => import('./pages/PredictionDetail'));
const MuscleTraining = React.lazy(() => import('./pages/MuscleTraining'));
const Rewards = React.lazy(() => import('./pages/Rewards'));
const Settings = React.lazy(() => import('./pages/Settings'));
const GarminImportSettings = React.lazy(() => import('./pages/GarminImportSettings'));
const ImportDataSettings = React.lazy(() => import('./pages/ImportDataSettings'));
const LegalPage = React.lazy(() => import('./pages/LegalPage'));
const WorkflowBuilder = React.lazy(() => import('./pages/WorkflowBuilder'));

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
  return <div className="route-loading">Loading...</div>;
}

function AdminOnlyRoute({ children }) {
  const { isAuthenticated, isAdmin, authHydrated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/admin" replace />;
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
  return (
    <I18nProvider>
      <AppErrorBoundary>
        <ThemeProvider>
          <UnitProvider>
            <AuthProvider>
              <Suspense fallback={<div className="route-loading">Loading...</div>}>
                <ScrollToTop />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/terms" element={<LegalPage variant="terms" />} />
                  <Route path="/privacy" element={<LegalPage variant="privacy" />} />
                  <Route path="/admin" element={<AdminLogin />} />
                  <Route path="/dashboard/*" element={<AdminOnlyRoute><Dashboard /></AdminOnlyRoute>} />
                  <Route path="/profile" element={<UserOnlyRoute><Profile /></UserOnlyRoute>} />
                  <Route path="/runs" element={<UserOnlyRoute><Runs /></UserOnlyRoute>} />
                  <Route path="/run/:id" element={<UserOnlyRoute><RunDetail /></UserOnlyRoute>} />
                  <Route path="/run" element={<UserOnlyRoute><RunDetail /></UserOnlyRoute>} />
                  <Route path="/analysis" element={<UserOnlyRoute><Analysis /></UserOnlyRoute>} />
                  <Route path="/heatmap" element={<UserOnlyRoute><Heatmap /></UserOnlyRoute>} />
                  <Route path="/territory" element={<UserOnlyRoute><Territory /></UserOnlyRoute>} />
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
                  <Route path="/workflows" element={<UserOnlyRoute><WorkflowBuilder /></UserOnlyRoute>} />
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

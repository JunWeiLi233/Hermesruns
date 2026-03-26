import React, { Suspense, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UnitProvider } from './contexts/UnitContext';

const Landing = React.lazy(() => import('./pages/Landing'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const AdminLogin = React.lazy(() => import('./pages/AdminLogin'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Runs = React.lazy(() => import('./pages/Runs'));
const RunDetail = React.lazy(() => import('./pages/RunDetail'));
const Analysis = React.lazy(() => import('./pages/Analysis'));
const Shoes = React.lazy(() => import('./pages/Shoes'));
const Races = React.lazy(() => import('./pages/Races'));
const TodayRun = React.lazy(() => import('./pages/TodayRun'));
const PredictionDetail = React.lazy(() => import('./pages/PredictionDetail'));
const MuscleTraining = React.lazy(() => import('./pages/MuscleTraining'));

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
  return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted, #64748b)' }}>Loading…</div>;
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
      <ThemeProvider>
        <UnitProvider>
        <AuthProvider>
          <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem' }}>Loading...</div>}>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/dashboard" element={<AdminOnlyRoute><Dashboard /></AdminOnlyRoute>} />
              <Route path="/profile" element={<UserOnlyRoute><Profile /></UserOnlyRoute>} />
              <Route path="/runs" element={<UserOnlyRoute><Runs /></UserOnlyRoute>} />
              <Route path="/run/:id" element={<UserOnlyRoute><RunDetail /></UserOnlyRoute>} />
              <Route path="/run" element={<UserOnlyRoute><RunDetail /></UserOnlyRoute>} />
              <Route path="/analysis" element={<UserOnlyRoute><Analysis /></UserOnlyRoute>} />
              <Route path="/prediction/:distKey" element={<UserOnlyRoute><PredictionDetail /></UserOnlyRoute>} />
              <Route path="/today-run" element={<UserOnlyRoute><TodayRun /></UserOnlyRoute>} />
              <Route path="/shoes" element={<UserOnlyRoute><Shoes /></UserOnlyRoute>} />
              <Route path="/races" element={<UserOnlyRoute><Races /></UserOnlyRoute>} />
              <Route path="/muscle-training" element={<UserOnlyRoute><MuscleTraining /></UserOnlyRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
        </UnitProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default App;

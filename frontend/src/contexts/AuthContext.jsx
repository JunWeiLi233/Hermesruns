import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { apiFetch, apiJson, isHeatmapCapabilityPath, isPublicHeatmapPath } from '../api';
import { invalidateHeatmapCache } from '../utils/heatmap/cache.js';
import { clearPlanReadCache } from '../utils/trainingPlanCache';
import { consumeTrainingAuthReturn } from '../utils/trainingAuthReturn';
import {
  STRAVA_SYNC_FINISHED_EVENT,
  clearStravaOauthPendingFlag,
  hasStravaOauthPendingFlag,
  markStravaAutoSyncTriggered,
  markStravaOauthPendingFlag,
  shouldTriggerStravaAutoSync,
} from '../utils/stravaAutoSync';

// BUG(strava-sign-in): Strava OAuth can still break in some setups (localhost webhooks, token refresh,
// encryption key changes, or stale sessions). Re-test /api/auth/strava/* and /api/strava/sync after auth changes.

const AuthContext = createContext(null);

const ROLE_STORAGE_KEY = 'hermes_role';
const AUTH_PING_TIMEOUT_MS = 12000;

function readAuthFromUrl() {
  try {
    // These are single-purpose public capabilities, never Hermes session tokens.
    // The heatmap page consumes and removes the query after mounting.
    if (isHeatmapCapabilityPath(window.location.pathname)) {
      return { token: null, email: null, source: null };
    }
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return {
      token: hashParams.get('token') || searchParams.get('token'),
      email: hashParams.get('email') || searchParams.get('email'),
      source: hashParams.get('source') || searchParams.get('source'),
    };
  } catch {
    return { token: null, email: null, source: null };
  }
}

function normalizeRole(role) {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

function persistIncomingAuth(incomingAuth) {
  try {
    if (incomingAuth?.token) {
      localStorage.setItem('hermes_jwt', incomingAuth.token);
    }
    if (incomingAuth?.email) {
      localStorage.setItem('hermes_email', incomingAuth.email);
    }
  } catch {
    // Ignore storage failures; route guards will still use React state for this render.
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const publicHeatmap = isPublicHeatmapPath(pathname);
  // If OAuth redirects back with `#token=...` (backend RedirectView), derive the initial token synchronously
  // so route guards do not kick the user to `/login` or `/admin` before URL-hash parsing runs.
  const incomingAuth = readAuthFromUrl();
  persistIncomingAuth(incomingAuth);
  const initialToken = incomingAuth?.token || localStorage.getItem('hermes_jwt') || null;
  const initialEmail = incomingAuth?.email || localStorage.getItem('hermes_email') || null;
  const incomingReturnPending = useRef(Boolean(incomingAuth.token));

  const [token, setToken] = useState(() => initialToken);
  const [email, setEmail] = useState(() => initialEmail);
  /** Authoritative role comes from /api/auth/protected/ping after token is known (never trust stale localStorage alone). */
  const [role, setRole] = useState(null);
  /** False while JWT exists but role has not been confirmed by the server yet. */
  const [authHydrated, setAuthHydrated] = useState(() => !initialToken);
  const [stravaOauthPending, setStravaOauthPending] = useState(false);
  const [logoutDestination, setLogoutDestination] = useState(null);

  // OAuth / magic-link: token in URL hash or query (backend redirect)
  useEffect(() => {
    try {
      localStorage.removeItem('hermes_admin');
    } catch { /* ignore */ }

    const { token: incomingToken, email: incomingEmail, source: incomingSource } = readAuthFromUrl();

    if (incomingToken) {
      localStorage.setItem('hermes_jwt', incomingToken);
      setToken(incomingToken);
    }
    if (incomingEmail) {
      localStorage.setItem('hermes_email', incomingEmail);
      setEmail(incomingEmail);
    }
    if (incomingSource === 'strava') {
      markStravaOauthPendingFlag({});
      setStravaOauthPending(true);
    }

    if (incomingToken || incomingEmail || incomingSource) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(()=>{
    if(!incomingReturnPending.current || !authHydrated || !token)return;
    incomingReturnPending.current=false;
    const target=consumeTrainingAuthReturn(window.location.origin);
    if(role!=='ADMIN' && target)navigate(target,{replace:true});
  },[authHydrated,navigate,role,token]);

  useLayoutEffect(() => {
    if (!token || !authHydrated || role !== 'ADMIN') return;
    const adminPage = pathname === '/admin' || pathname === '/admin/'
      || pathname === '/dashboard' || pathname.startsWith('/dashboard/')
      || pathname === '/workflows';
    if (!adminPage) navigate('/dashboard', { replace: true });
  }, [authHydrated, navigate, pathname, role, token]);

  useEffect(() => {
    if (logoutDestination && pathname === logoutDestination) setLogoutDestination(null);
  }, [logoutDestination, pathname]);

  // Resolve role from backend whenever JWT changes
  useEffect(() => {
    if (publicHeatmap && token) {
      // Public capabilities/help must remain usable with an expired saved session.
      setAuthHydrated(false);
      return;
    }
    if (!token) {
      setRole(null);
      localStorage.removeItem(ROLE_STORAGE_KEY);
      setAuthHydrated(true);
      return;
    }

    let cancelled = false;
    const authController = new AbortController();
    const timeoutId = window.setTimeout(
      () => authController.abort(),
      AUTH_PING_TIMEOUT_MS,
    );
    setAuthHydrated(false);

    (async () => {
      try {
        const session = await apiJson('/api/auth/protected/ping', { signal: authController.signal });
        if (cancelled) return;
        const r = normalizeRole(session.role);
        setRole(r);
        localStorage.setItem(ROLE_STORAGE_KEY, r);
      } catch (e) {
        if (e.message === 'Unauthorized') return;
        if (cancelled) return;
        setRole('USER');
        localStorage.setItem(ROLE_STORAGE_KEY, 'USER');
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setAuthHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      authController.abort();
    };
  }, [token, publicHeatmap]);

  useEffect(() => {
    if (!shouldTriggerStravaAutoSync({ isAuthenticated: Boolean(token), authHydrated, token })) {
      return;
    }

    markStravaAutoSyncTriggered({});
    apiFetch('/api/auth/strava/auto-sync').catch(() => {
      // Best-effort only.
    });
  }, [authHydrated, token]);

  useEffect(() => {
    if (!token || !authHydrated || !(stravaOauthPending || hasStravaOauthPendingFlag({}))) {
      return;
    }

    let cancelled = false;
    let timeoutId = null;
    let sawActiveSync = false;
    const deadlineMs = Date.now() + (90 * 1000);

    async function pollStravaSyncCompletion() {
      try {
        const syncStatus = await apiJson('/api/auth/strava/sync-status');
        if (cancelled) return;

        if (syncStatus?.active) {
          sawActiveSync = true;
        }

        const finished = syncStatus?.status === 'COMPLETED'
          || syncStatus?.status === 'FAILED'
          || (sawActiveSync && !syncStatus?.active);

        if (finished) {
          clearStravaOauthPendingFlag({});
          setStravaOauthPending(false);
          function handleStravaSyncFinished() {
            invalidateHeatmapCache(email);
            window.dispatchEvent(new CustomEvent(STRAVA_SYNC_FINISHED_EVENT, { detail: syncStatus }));
          }
          handleStravaSyncFinished();
          return;
        }
      } catch {
        if (cancelled) return;
      }

      if (Date.now() >= deadlineMs) {
        clearStravaOauthPendingFlag({});
        setStravaOauthPending(false);
        return;
      }

      timeoutId = window.setTimeout(pollStravaSyncCompletion, 2000);
    }

    pollStravaSyncCompletion();

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [authHydrated, email, stravaOauthPending, token]);

  const login = useCallback((newToken, newEmail) => {
    const credentialChanged = localStorage.getItem('hermes_jwt') !== newToken;
    if (credentialChanged) clearPlanReadCache();
    // Commit token before callers run navigate(); otherwise route guards still see the old (empty) session.
    flushSync(() => {
      setLogoutDestination(null);
      if (credentialChanged) {
        setRole(null);
        setAuthHydrated(false);
      }
      localStorage.setItem('hermes_jwt', newToken);
      setToken(newToken);
      if (newEmail) {
        localStorage.setItem('hermes_email', newEmail);
        setEmail(newEmail);
      }
    });
  }, []);

  const logout = useCallback((options = {}) => {
    const tokenToInvalidate = token || localStorage.getItem('hermes_jwt');
    const redirectTo = role === 'ADMIN' ? '/' : options?.redirectTo || '/login';
    setLogoutDestination(redirectTo);
    clearPlanReadCache();
    // Clear local state immediately so the UI updates before the API call.
    localStorage.removeItem('hermes_jwt');
    localStorage.removeItem('hermes_email');
    localStorage.removeItem(ROLE_STORAGE_KEY);
    try {
      localStorage.removeItem('hermes_admin');
    } catch { /* ignore */ }
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('hermes_profile_dashboard_')) {
          localStorage.removeItem(key);
        }
      }
    } catch { /* ignore */ }
    setToken(null);
    setEmail(null);
    setRole(null);
    setAuthHydrated(true);
    setStravaOauthPending(false);
    navigate(redirectTo, { replace: true });
    // Best-effort backend invalidation — fire and forget.
    if (tokenToInvalidate && options?.invalidate !== false) {
      apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenToInvalidate}` },
      }).catch(() => {});
    }
  }, [navigate, role, token]);

  const isAuthenticated = Boolean(token);
  const isAdmin = role === 'ADMIN';

  const value = useMemo(() => ({
    token,
    email,
    role,
    isAdmin,
    authHydrated,
    login,
    logout,
    isAuthenticated,
  }), [token, email, role, isAdmin, authHydrated, login, logout, isAuthenticated]);

  return (
    <AuthContext.Provider value={value}>
      {/* Unmount protected guards until logout navigation commits, including lazy destination loads. */}
      {logoutDestination && pathname !== logoutDestination ? null : children}
    </AuthContext.Provider>
  );
}

export default AuthContext;

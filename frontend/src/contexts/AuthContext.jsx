import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';

// BUG(strava-sign-in): Strava OAuth can still break in some setups (localhost webhooks, token refresh,
// encryption key changes, or stale sessions). Re-test /api/auth/strava/* and /api/strava/sync after auth changes.

const AuthContext = createContext(null);

const ROLE_STORAGE_KEY = 'hermes_role';

function normalizeRole(role) {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('hermes_jwt') || null);
  const [email, setEmail] = useState(() => localStorage.getItem('hermes_email') || null);
  /** Authoritative role comes from /api/auth/protected/ping after token is known (never trust stale localStorage alone). */
  const [role, setRole] = useState(null);
  /** False while JWT exists but role has not been confirmed by the server yet. */
  const [authHydrated, setAuthHydrated] = useState(() => !localStorage.getItem('hermes_jwt'));

  // OAuth / magic-link: token in URL hash or query (backend redirect)
  useEffect(() => {
    try {
      localStorage.removeItem('hermes_admin');
    } catch { /* ignore */ }

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    const incomingToken = hashParams.get('token') || searchParams.get('token');
    const incomingEmail = hashParams.get('email') || searchParams.get('email');
    const incomingSource = hashParams.get('source') || searchParams.get('source');

    if (incomingToken) {
      localStorage.setItem('hermes_jwt', incomingToken);
      setToken(incomingToken);
    }
    if (incomingEmail) {
      localStorage.setItem('hermes_email', incomingEmail);
      setEmail(incomingEmail);
    }

    if (incomingToken || incomingEmail || incomingSource) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Resolve role from backend whenever JWT changes
  useEffect(() => {
    if (!token) {
      setRole(null);
      localStorage.removeItem(ROLE_STORAGE_KEY);
      setAuthHydrated(true);
      return;
    }

    let cancelled = false;
    setAuthHydrated(false);

    (async () => {
      try {
        const session = await apiJson('/api/auth/protected/ping');
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
        if (!cancelled) setAuthHydrated(true);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const login = useCallback((newToken, newEmail, _serverRole) => {
    // Commit token before callers run navigate(); otherwise route guards still see the old (empty) session.
    flushSync(() => {
      localStorage.setItem('hermes_jwt', newToken);
      setToken(newToken);
      if (newEmail) {
        localStorage.setItem('hermes_email', newEmail);
        setEmail(newEmail);
      }
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hermes_jwt');
    localStorage.removeItem('hermes_email');
    localStorage.removeItem(ROLE_STORAGE_KEY);
    try {
      localStorage.removeItem('hermes_admin');
    } catch { /* ignore */ }
    setToken(null);
    setEmail(null);
    setRole(null);
    setAuthHydrated(true);
    navigate('/login');
  }, [navigate]);

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
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;

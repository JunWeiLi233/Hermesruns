import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('hermes_jwt') || null);
  const [email, setEmail] = useState(() => localStorage.getItem('hermes_email') || null);
  const navigate = useNavigate();

  // Read token/email from URL params on mount (OAuth callback support)
  useEffect(() => {
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

    // Clean URL if we consumed any params
    if (incomingToken || incomingEmail || incomingSource) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const login = useCallback((newToken, newEmail) => {
    localStorage.setItem('hermes_jwt', newToken);
    setToken(newToken);
    if (newEmail) {
      localStorage.setItem('hermes_email', newEmail);
      setEmail(newEmail);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hermes_jwt');
    localStorage.removeItem('hermes_email');
    localStorage.removeItem('hermes_admin');
    setToken(null);
    setEmail(null);
    navigate('/login');
  }, [navigate]);

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{ token, email, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;

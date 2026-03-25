import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';

export default function AdminLogin() {
  const { login, isAuthenticated, isAdmin, authHydrated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    if (isAdmin) navigate('/dashboard', { replace: true });
    else navigate('/login', { replace: true });
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || data.message || t('auth.admin_invalid'));
        return;
      }

      login(data.token, data.email, 'ADMIN');
      // useEffect sends admins to /dashboard once session is hydrated from /api/auth/protected/ping
    } catch {
      setError(t('admin.system_offline'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <LanguageSwitcher />
      <div className="login-container">
        <div className="logo">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <HermesLogo tone="light" />
          </div>
          <h1 style={{ color: 'var(--brand-accent)', textAlign: 'center' }}>{t('admin.brand')}</h1>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: 30 }}>{t('admin.subtitle')}</p>
        </div>

        <h2 className="auth-card-title" style={{ textAlign: 'center' }}>{t('admin.form_title')}</h2>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-alert" style={{ display: 'block' }}>{error}</div>}

          <div className="form-group">
            <label htmlFor="admin-email">{t('admin.email_label')}</label>
            <input
              type="text"
              id="admin-email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password">{t('admin.password_label')}</label>
            <input
              type="password"
              id="admin-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? t('admin.submit_loading') : t('admin.submit')}
          </button>

          <div className="signup-link">
            <Link to="/login">{t('admin.back_link')}</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    <div className="auth-page auth-page--stitch-login auth-page--stitch-admin">
      <LanguageSwitcher />
      <main className="auth-stitch-shell">
        <section className="auth-stitch-brand">
          <div className="auth-stitch-brand-inner">
            <div className="auth-stitch-wordmark-wrap">
              <HermesLogo tone="light" />
              <span className="auth-stitch-pulse">ADMIN OPS</span>
            </div>

            <div className="auth-stitch-copy">
              <h1 className="auth-stitch-hero">
                <span>{t('admin.brand')}</span>
                <span className="is-accent">{t('admin.form_title')}</span>
              </h1>
              <p className="auth-stitch-text">{t('admin.subtitle')}</p>

              <div className="auth-stitch-stats auth-stitch-stats--admin">
                <div>
                  <strong>Ops</strong>
                  <span>{t('admin.brand')}</span>
                </div>
                <div>
                  <strong>Hermes</strong>
                  <span>{t('admin.back_link')}</span>
                </div>
              </div>
            </div>

            <div className="auth-stitch-dots" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>
          </div>
        </section>

        <section className="auth-stitch-formside">
          <div className="auth-stitch-card auth-stitch-card--admin">
            <div className="auth-stitch-header">
              <h3>{t('admin.form_title')}</h3>
              <p>{t('admin.subtitle')}</p>
            </div>

            <form className="auth-stitch-form" onSubmit={handleSubmit}>
              {error && <div className="error-alert is-visible">{error}</div>}

              <div className="form-group form-group--stitch">
                <label htmlFor="admin-email">{t('admin.email_label')}</label>
                <input
                  type="text"
                  id="admin-email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group form-group--stitch">
                <label htmlFor="admin-password">{t('admin.password_label')}</label>
                <input
                  type="password"
                  id="admin-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="auth-stitch-btn auth-stitch-btn--submit" disabled={loading}>
                <span>{loading ? t('admin.submit_loading') : t('admin.submit')}</span>
              </button>
            </form>

            <div className="auth-stitch-legal">
              <Link to="/login">{t('admin.back_link')}</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/privacy">Privacy</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

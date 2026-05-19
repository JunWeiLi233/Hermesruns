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
    <div className="auth-page auth-page--login auth-page--admin">
      <LanguageSwitcher />
      <main className="auth-flow-shell">
        <section className="auth-flow-brand">
          <div className="auth-flow-brand-inner">
            <div className="auth-flow-wordmark-wrap">
              <HermesLogo tone="light" />
              <span className="auth-flow-pulse">ADMIN OPS</span>
            </div>

            <div className="auth-flow-copy">
              <h1 className="auth-flow-hero">
                <span>{t('admin.brand')}</span>
                <span className="is-accent">{t('admin.form_title')}</span>
              </h1>
              <p className="auth-flow-text">{t('admin.subtitle')}</p>

              <div className="auth-flow-stats auth-flow-stats--admin">
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

            <div className="auth-flow-dots" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>
          </div>
        </section>

        <section className="auth-flow-formside">
          <div className="auth-flow-card auth-flow-card--admin">
            <div className="auth-flow-header">
              <h3>{t('admin.form_title')}</h3>
              <p>{t('admin.subtitle')}</p>
            </div>

            <form className="auth-flow-form" onSubmit={handleSubmit}>
              {error && <div className="error-alert is-visible" role="alert">{error}</div>}

              <div className="form-group form-group--auth">
                <label htmlFor="admin-email">{t('admin.email_label')}</label>
                <input
                  type="text"
                  id="admin-email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group form-group--auth">
                <label htmlFor="admin-password">{t('admin.password_label')}</label>
                <input
                  type="password"
                  id="admin-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="auth-flow-btn auth-flow-btn--submit" disabled={loading}>
                <span>{loading ? t('admin.submit_loading') : t('admin.submit')}</span>
              </button>
            </form>

            <div className="auth-flow-legal">
              <Link to="/login">{t('admin.back_link')}</Link>
              <Link to="/terms">{t('landing.stitch_footer_terms')}</Link>
              <Link to="/privacy">{t('landing.stitch_footer_privacy')}</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

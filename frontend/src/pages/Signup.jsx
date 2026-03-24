import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Signup() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t('common.password_too_short'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || data.message || 'Request failed.');
        setLoading(false);
        return;
      }

      alert(t('common.account_created'));
      navigate('/login');
    } catch {
      setError(t('common.connection_failed'));
      setLoading(false);
    }
  }

  function startOAuth(provider) {
    const baseUrl = getBackendBaseUrl();
    window.location.href = `${baseUrl}/api/auth/${provider}/start?state=signup`;
  }

  return (
    <div className="auth-page">
      <LanguageSwitcher />
      <div className="layout-wrapper">
        <section className="brand-section">
          <div className="brand-content">
            <div className="brand-badge">HERMES <span>{t('common.logo_mark')}</span></div>
            <h1 className="auth-hero-title">{t('signup.hero_title').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}</h1>
            <p className="auth-hero-text">{t('signup.hero_text')}</p>
          </div>
        </section>

        <section className="form-section">
          <div className="auth-panel">
            <div className="login-container">
              <div className="auth-card-header">
                <p className="auth-card-kicker">HERMES</p>
                <h2 className="auth-card-title">{t('signup.form_title')}</h2>
              </div>

              <form onSubmit={handleSubmit}>
                {error && <div className="error-alert" style={{ display: 'block' }}>{error}</div>}

                <div className="form-group">
                  <label htmlFor="email">{t('signup.email_label')}</label>
                  <input
                    type="email"
                    id="email"
                    placeholder="runner@hermes.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">{t('signup.password_label')}</label>
                  <input
                    type="password"
                    id="password"
                    placeholder={t('signup.password_placeholder')}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? t('signup.submit_loading') : t('signup.submit')}
                </button>

                <div className="divider"><span>{t('signup.divider')}</span></div>

                <div className="social-login">
                  <button type="button" className="btn-strava" onClick={() => startOAuth('strava')}>
                    {t('signup.strava')}
                  </button>
                  <button type="button" className="btn-google" onClick={() => startOAuth('google')}>
                    {t('signup.google')}
                  </button>
                </div>

                <div className="signup-link">
                  <span>{t('signup.signin_prompt')}</span>
                  <Link to="/login">{t('signup.signin_link')}</Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

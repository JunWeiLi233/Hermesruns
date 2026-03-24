import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/profile');
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t('common.password_too_short'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
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

      login(data.token, data.email);

      if (data.role === 'ADMIN') {
        navigate('/dashboard');
      } else {
        navigate('/profile');
      }
    } catch {
      setError(t('common.connection_failed'));
      setLoading(false);
    }
  }

  function startOAuth(provider) {
    const baseUrl = getBackendBaseUrl();
    window.location.href = `${baseUrl}/api/auth/${provider}/start?state=login`;
  }

  return (
    <div className="auth-page">
      <LanguageSwitcher />
      <div className="layout-wrapper">
        <section className="brand-section">
          <div className="brand-content">
            <div className="brand-badge">HERMES <span>{t('common.logo_mark')}</span></div>
            <h1 className="auth-hero-title">{t('index.hero_title').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}</h1>
            <p className="auth-hero-text">{t('index.hero_text')}</p>
            <div className="hero-chip-row">
              <span className="hero-chip">{t('profile.heatmap')}</span>
              <span className="hero-chip">{t('profile.analysis_title')}</span>
              <span className="hero-chip">{t('profile.gear_tracker')}</span>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="auth-panel">
            <div className="login-container">
              <div className="auth-card-header">
                <p className="auth-card-kicker">HERMES</p>
                <h2 className="auth-card-title">{t('index.submit')}</h2>
                <p className="auth-card-copy">{t('index.hero_text')}</p>
              </div>

              <form onSubmit={handleSubmit}>
                {error && <div className="error-alert" style={{ display: 'block' }}>{error}</div>}

                <div className="form-group">
                  <label htmlFor="email">{t('index.email_label')}</label>
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
                  <div className="label-row">
                    <label htmlFor="password">{t('index.password_label')}</label>
                    <a href="#" className="forgot-password">{t('index.forgot_password')}</a>
                  </div>
                  <input
                    type="password"
                    id="password"
                    placeholder={t('index.password_placeholder')}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? t('index.submit_loading') : t('index.submit')}
                </button>

                <div className="divider"><span>{t('index.divider')}</span></div>

                <div className="social-login">
                  <button type="button" className="btn-strava" onClick={() => startOAuth('strava')}>
                    {t('index.strava')}
                  </button>
                  <button type="button" className="btn-google" onClick={() => startOAuth('google')}>
                    {t('index.google')}
                  </button>
                </div>

                <div className="signup-link">
                  <span>{t('index.signup_prompt')}</span>
                  <Link to="/signup">{t('index.signup_link')}</Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

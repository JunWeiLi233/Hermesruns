import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import BrandLogo from '../components/BrandLogo';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [showResend, setShowResend] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/profile');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setBanner('verified');
    }
    const err = searchParams.get('error');
    if (err === 'verify_invalid') setBanner('invalid');
    if (err === 'verify_expired') setBanner('expired');
    if (searchParams.get('verified') || searchParams.get('error')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handleResend(e) {
    e?.preventDefault?.();
    setResendMsg('');
    setResendBusy(true);
    try {
      const res = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setResendMsg(data.message || t('common.resend_sent'));
    } catch {
      setResendMsg(t('common.connection_failed'));
    } finally {
      setResendBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setShowResend(false);

    if (!password) {
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
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setError(t('common.email_not_verified'));
          setShowResend(true);
        } else {
          setError(data.error || data.message || 'Request failed.');
        }
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
            <div className="brand-badge brand-badge-logo-only">
              <BrandLogo size="lg" />
            </div>
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
                <p className="auth-card-kicker">Hermesruns</p>
                <h2 className="auth-card-title">{t('index.submit')}</h2>
                <p className="auth-card-copy">{t('index.hero_text')}</p>
              </div>

              <form onSubmit={handleSubmit}>
                {banner === 'verified' && (
                  <div className="error-alert" style={{ display: 'block', background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', color: '#166534' }}>
                    {t('common.verified_banner')}
                  </div>
                )}
                {banner === 'invalid' && (
                  <div className="error-alert" style={{ display: 'block' }}>{t('common.verify_error')}</div>
                )}
                {banner === 'expired' && (
                  <div className="error-alert" style={{ display: 'block' }}>{t('common.verify_expired')}</div>
                )}
                {error && <div className="error-alert" style={{ display: 'block' }}>{error}</div>}

                {(showResend || banner === 'expired') && (
                  <div style={{ marginBottom: 16, padding: '12px', background: 'var(--classic-bg, #f8fafc)', borderRadius: 8, border: '1px solid var(--classic-border, #e2e8f0)' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>{t('common.resend_email_placeholder')}</p>
                    <button type="button" className="btn-secondary" disabled={resendBusy || !email.trim()} onClick={handleResend}>
                      {resendBusy ? '…' : t('common.resend_verification')}
                    </button>
                    {resendMsg && <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>{resendMsg}</p>}
                  </div>
                )}

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
                    <a href="#" className="forgot-password" onClick={e => e.preventDefault()}>{t('index.forgot_password')}</a>
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

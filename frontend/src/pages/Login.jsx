import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch, apiJson } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';
import { parseLoginStatusQuery } from '../utils/stravaLinking';

export default function Login() {
  const { login, isAuthenticated, isAdmin, authHydrated } = useAuth();
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
  const [altLoginOpen, setAltLoginOpen] = useState(false);
  const [stravaStatus, setStravaStatus] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  useEffect(() => {
    let cancelled = false;
    apiJson('/api/auth/strava/status')
      .then((res) => {
        if (cancelled) return;
        setStravaStatus(res || null);
      })
      .catch(() => {
        if (cancelled) return;
        setStravaStatus(null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const bannerState = parseLoginStatusQuery(window.location.search, {
      verifyInvalid: t('common.verify_error'),
      verifyExpired: t('common.verify_expired'),
      stravaConfirmationFallback: t('profile.strava_link_confirmation_required'),
    });
    if (bannerState.banner) {
      setBanner(bannerState.banner);
      setAltLoginOpen(bannerState.autoOpen);
      if (bannerState.banner === 'strava_not_configured') {
        setError(t('common.strava_not_configured'));
      } else if (bannerState.banner === 'strava_failed') {
        setError(bannerState.errorMessage || t('common.strava_login_failed'));
      } else if (bannerState.banner === 'invalid' || bannerState.banner === 'expired') {
        setError(bannerState.errorMessage || '');
      } else {
        setError(bannerState.errorMessage || t('profile.strava_link_confirmation_required'));
      }
    }
    if (bannerState.shouldClear) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

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
          setAltLoginOpen(true);
        } else {
          setError(data.error || data.message || 'Request failed.');
        }
        return;
      }

      login(data.token, data.email, data.role);
      // Redirect after authHydrated (see useEffect); avoids racing route guards that still saw no token.
    } catch {
      setError(t('common.connection_failed'));
    } finally {
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
            <div className="brand-badge">
              <HermesLogo mark={t('common.logo_mark')} tone="dark" />
            </div>
            <p className="auth-hero-title auth-hero-title--intro">
              {t('index.hero_title').replace(/\n+/g, ' ')}
            </p>
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
                <p className="auth-card-kicker"><HermesLogo tone="light" showIcon={false} /></p>
                <h2 className="auth-card-title">{t('index.submit')}</h2>
                <p className="auth-card-copy">{t('index.strava_focus_copy')}</p>
              </div>

              {stravaStatus && !stravaStatus.configured && (
                <div className="error-alert is-visible">
                  {t('common.strava_not_configured')}
                  {stravaStatus.reason && (
                    <div className="auth-status-detail">{stravaStatus.reason}</div>
                  )}
                </div>
              )}

              <button
                type="button"
                className="btn-strava btn-strava--lead"
                disabled={Boolean(stravaStatus && !stravaStatus.configured)}
                onClick={() => startOAuth('strava')}
              >
                {t('index.strava')}
              </button>

              <button
                type="button"
                className="auth-alt-toggle"
                onClick={() => setAltLoginOpen(o => !o)}
                aria-expanded={altLoginOpen}
              >
                {altLoginOpen ? t('index.alt_login_hide') : t('index.alt_login_show')}
              </button>

              {altLoginOpen && (
              <form className="auth-alt-block" onSubmit={handleSubmit}>
                {banner === 'verified' && (
                  <div className="error-alert error-alert--success is-visible">
                    {t('common.verified_banner')}
                  </div>
                )}
                {banner === 'invalid' && (
                  <div className="error-alert is-visible">{t('common.verify_error')}</div>
                )}
                {banner === 'expired' && (
                  <div className="error-alert is-visible">{t('common.verify_expired')}</div>
                )}
                {banner === 'strava_not_configured' && (
                  <div className="error-alert is-visible">{t('common.strava_not_configured')}</div>
                )}
                {banner === 'strava_link_confirmation_required' && (
                  <div className="error-alert is-visible">{t('profile.strava_link_confirmation_required')}</div>
                )}
                {banner === 'strava_failed' && (
                  <div className="error-alert is-visible">{t('common.strava_login_failed')}</div>
                )}
                {error && <div className="error-alert is-visible">{error}</div>}

                {(showResend || banner === 'expired') && (
                  <div className="auth-resend-box">
                    <p className="auth-resend-copy">{t('common.resend_email_placeholder')}</p>
                    <button type="button" className="btn-secondary" disabled={resendBusy || !email.trim()} onClick={handleResend}>
                      {resendBusy ? '…' : t('common.resend_verification')}
                    </button>
                    {resendMsg && <p className="auth-resend-message">{resendMsg}</p>}
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

                <div className="divider"><span>{t('index.divider_alt')}</span></div>

                <div className="social-login social-login--single">
                  <button type="button" className="btn-google" onClick={() => startOAuth('google')}>
                    {t('index.google')}
                  </button>
                </div>
              </form>
              )}

              <div className="signup-link">
                <span>{t('index.signup_prompt')}</span>
                <Link to="/signup">{t('index.signup_link')}</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

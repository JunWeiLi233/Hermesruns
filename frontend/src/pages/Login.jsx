import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch, apiJson } from '../api';
import AuthDotField from '../components/AuthDotField';
import AuthBrandCarousel from '../components/AuthBrandCarousel';
import FooterNavLinks from '../components/FooterNavLinks';
import stravaConnectButton from '../assets/btn_strava_connect_with_orange.svg';
import { parseLoginStatusQuery } from '../utils/stravaLinking';

const LOCAL_SHARED_RUNNER_EMAIL = 'strava+140971747@hermes.local';

export default function Login() {
  const { login, isAuthenticated, isAdmin, authHydrated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [showResend, setShowResend] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [stravaStatus, setStravaStatus] = useState(null);
  const [authProviders, setAuthProviders] = useState(null);

  const stravaConfigured = stravaStatus?.configured !== false;
  const googleConfigured = authProviders?.googleConfigured === true;

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/auth/strava/status')
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return response.json().catch(() => null);
      })
      .then((res) => {
        if (!cancelled) setStravaStatus(res || null);
      })
      .catch(() => {
        if (!cancelled) setStravaStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiJson('/api/auth/providers')
      .then((res) => {
        if (!cancelled) setAuthProviders(res || {});
      })
      .catch(() => {
        if (!cancelled) setAuthProviders({ googleConfigured: false, stravaConfigured: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const bannerState = parseLoginStatusQuery(window.location.search, {
      verifyInvalid: t('index.verify_error'),
      verifyExpired: t('index.verify_expired'),
      stravaConfirmationFallback: t('profile.strava_link_confirmation_required'),
    });

    if (bannerState.banner) {
      setBanner(bannerState.banner);
      if (bannerState.banner === 'strava_not_configured') {
        setError(t('common.strava_not_configured'));
      } else if (bannerState.banner === 'strava_failed') {
        setError(bannerState.errorMessage || t('common.strava_login_failed'));
      } else if (bannerState.banner === 'google_not_configured') {
        setError(t('common.google_not_configured'));
      } else if (bannerState.banner === 'google_failed') {
        setError(bannerState.errorMessage || t('common.google_login_failed'));
      } else if (bannerState.banner === 'invalid' || bannerState.banner === 'expired') {
        setError(bannerState.errorMessage || '');
      } else {
        setError(bannerState.errorMessage || t('profile.strava_link_confirmation_required'));
      }
    }

    if (bannerState.shouldClear) {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams, t]);

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
      setResendMsg(data.message || t('index.resend_sent'));
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
          setError(t('index.email_not_verified'));
          setShowResend(true);
        } else {
          setError(data.error || data.message || 'Request failed.');
        }
        return;
      }

      login(data.token, data.email, data.role);
    } catch {
      setError(t('common.connection_failed'));
    } finally {
      setLoading(false);
    }
  }

  function startOAuth(provider) {
    if (provider === 'strava' && !stravaConfigured) {
      return;
    }
    if (provider === 'google' && !googleConfigured) {
      return;
    }
    const baseUrl = getBackendBaseUrl();
    window.location.href = `${baseUrl}/api/auth/${provider}/start?state=login`;
  }

  const stravaStatusReason = stravaStatus?.reason?.trim();
  const stravaUnavailableHint = stravaStatusReason
    ? `Strava OAuth is off on this server: ${stravaStatusReason}`
    : t('index.stitch_strava_hint');
  const googleUnavailableHint = t('common.google_not_configured');
  const isLocalSharedRunnerEmail = email.trim().toLowerCase() === LOCAL_SHARED_RUNNER_EMAIL;

  return (
    <div className="auth-page auth-page--login auth-page--liquid-glass" data-auth-redesign="command-entry">
      <AuthDotField />
      <main className="auth-flow-shell">
        <section className="auth-flow-brand">
          <div className="auth-flow-brand-inner">
            <div className="auth-flow-wordmark-wrap">
              <h1 className="auth-flow-wordmark">HERMES</h1>
              <span className="auth-flow-pulse">{t('index.stitch_pulse')}</span>
            </div>

            <AuthBrandCarousel t={t} />
          </div>
        </section>

        <section className="auth-flow-formside">
          <div className="auth-flow-card">
            <div className="auth-flow-header">
              <h3>{t('index.stitch_welcome')}</h3>
              <p>{t('index.stitch_access')}</p>
            </div>

            <form className="auth-flow-form" onSubmit={handleSubmit}>
              {banner === 'verified' && (
                <div className="error-alert error-alert--success is-visible" role="status">
                  {t('index.verified_banner')}
                </div>
              )}
              {banner === 'invalid' && (
                <div className="error-alert is-visible" role="alert">{t('index.verify_error')}</div>
              )}
              {banner === 'expired' && (
                <div className="error-alert is-visible" role="alert">{t('index.verify_expired')}</div>
              )}
              {banner === 'strava_not_configured' && (
                <div className="error-alert is-visible" role="alert">{t('common.strava_not_configured')}</div>
              )}
              {banner === 'strava_link_confirmation_required' && (
                <div className="error-alert is-visible" role="alert">{t('profile.strava_link_confirmation_required')}</div>
              )}
              {banner === 'strava_failed' && (
                <div className="error-alert is-visible" role="alert">{t('common.strava_login_failed')}</div>
              )}
              {banner === 'google_not_configured' && (
                <div className="error-alert is-visible" role="alert">{t('common.google_not_configured')}</div>
              )}
              {banner === 'google_failed' && (
                <div className="error-alert is-visible" role="alert">{t('common.google_login_failed')}</div>
              )}
              {error && <div className="error-alert is-visible" role="alert">{error}</div>}

              {(showResend || banner === 'expired') && (
                <div className="auth-resend-box auth-resend-box--login" aria-live="polite">
                  <p className="auth-resend-copy">{t('index.resend_email_placeholder')}</p>
                  <button type="button" className="btn-secondary" disabled={resendBusy || !email.trim()} onClick={handleResend}>
                    {resendBusy ? '...' : t('index.resend_verification')}
                  </button>
                  {resendMsg && <p className="auth-resend-message">{resendMsg}</p>}
                </div>
              )}

              <div className="form-group form-group--auth">
                <label htmlFor="email">{t('index.email_label')}</label>
                <input
                  type="email"
                  id="email"
                  placeholder="runner@hermes.io"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group form-group--auth">
                <div className="label-row label-row--auth">
                  <label htmlFor="password">{t('index.password_label')}</label>
                  <Link to="/forgot-password" className="forgot-password forgot-password--auth">
                    {t('index.forgot_password')}
                  </Link>
                </div>
                <input
                  type="password"
                  id="password"
                  placeholder="********"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {isLocalSharedRunnerEmail && (
                  <p className="auth-flow-field-note" aria-live="polite">
                    {t('index.local_mock_password_hint')}
                  </p>
                )}
              </div>

              <button type="submit" className="auth-flow-btn auth-flow-btn--submit" disabled={loading}>
                {loading ? t('index.submit_loading') : t('index.submit')}
              </button>
            </form>

            <div className="auth-flow-social">
              <button
                type="button"
                className="auth-flow-btn auth-flow-btn--strava auth-flow-btn--strava-official"
                disabled={!stravaConfigured}
                onClick={() => startOAuth('strava')}
              >
                <img
                  className="auth-flow-btn__strava-official"
                  src={stravaConnectButton}
                  alt={t(stravaConfigured ? 'index.stitch_strava_cta' : 'index.stitch_strava_unavailable')}
                />
              </button>

              {!stravaConfigured && (
                <p className="auth-flow-status-note auth-flow-status-note--strava">{stravaUnavailableHint}</p>
              )}

              <button
                type="button"
                className="auth-flow-btn auth-flow-btn--google"
                disabled={!googleConfigured}
                onClick={() => startOAuth('google')}
              >
                <span className="auth-flow-google-g" aria-hidden="true">G</span>
                <span>{t(googleConfigured ? 'index.google' : 'common.google_not_configured')}</span>
              </button>

              {!googleConfigured && (
                <p className="auth-flow-status-note auth-flow-status-note--google">{googleUnavailableHint}</p>
              )}
            </div>

            <div className="signup-link signup-link--auth">
              <span>{t('index.signup_prompt')}</span>
              <Link to="/signup">{t('index.signup_link')}</Link>
            </div>
          </div>

          <footer className="auth-flow-legal">
            <FooterNavLinks publicOnly={true} />
          </footer>
        </section>
      </main>
    </div>
  );
}

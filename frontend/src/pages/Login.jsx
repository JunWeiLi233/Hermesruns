import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch, apiJson } from '../api';
import FooterNavLinks from '../components/FooterNavLinks';
import { parseLoginStatusQuery } from '../utils/stravaLinking';

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

  const stravaConfigured = stravaStatus?.configured !== false;

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  useEffect(() => {
    let cancelled = false;
    apiJson('/api/auth/strava/status')
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
    const baseUrl = getBackendBaseUrl();
    window.location.href = `${baseUrl}/api/auth/${provider}/start?state=login`;
  }

  const stravaStatusReason = stravaStatus?.reason?.trim();
  const stravaUnavailableHint = stravaStatusReason
    ? `Strava OAuth is off on this server: ${stravaStatusReason}`
    : t('index.stitch_strava_hint');

  return (
    <div className="auth-page auth-page--login">
      <main className="auth-flow-shell">
        <section className="auth-flow-brand">
          <div className="auth-flow-brand-inner">
            <div className="auth-flow-wordmark-wrap">
              <h1 className="auth-flow-wordmark">HERMES</h1>
              <span className="auth-flow-pulse">{t('index.stitch_pulse')}</span>
            </div>

            <div className="auth-flow-copy">
              <h2 className="auth-flow-hero">
                <span>{t('index.stitch_hero_line_one')}</span>
                <span className="is-accent">{t('index.stitch_hero_line_two')}</span>
              </h2>
              <p className="auth-flow-text">{t('index.stitch_hero_copy')}</p>

              <div className="auth-flow-stats">
                <div>
                  <strong>12k+</strong>
                  <span>{t('index.stitch_stat_athletes')}</span>
                </div>
                <div>
                  <strong>99.8%</strong>
                  <span>{t('index.stitch_stat_accuracy')}</span>
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
          <div className="auth-flow-card">
            <div className="auth-flow-header">
              <h3>{t('index.stitch_welcome')}</h3>
              <p>{t('index.stitch_access')}</p>
            </div>

            <div className="auth-flow-social">
              <button
                type="button"
                className="auth-flow-btn auth-flow-btn--strava"
                disabled={!stravaConfigured}
                onClick={() => startOAuth('strava')}
              >
                <span className="auth-flow-btn__icon auth-flow-btn__icon--bolt" aria-hidden="true">+</span>
                <span>{t(stravaConfigured ? 'index.stitch_strava_cta' : 'index.stitch_strava_unavailable')}</span>
              </button>

              {!stravaConfigured && (
                <p className="auth-flow-status-note">{stravaUnavailableHint}</p>
              )}

              <button
                type="button"
                className="auth-flow-btn auth-flow-btn--google"
                onClick={() => startOAuth('google')}
              >
                <span className="auth-flow-google-g" aria-hidden="true">G</span>
                <span>{t('index.google')}</span>
              </button>
            </div>

            <div className="auth-flow-divider">
              <span />
              <strong>{t('index.divider')}</strong>
              <span />
            </div>

            <form className="auth-flow-form" onSubmit={handleSubmit}>
              {banner === 'verified' && (
                <div className="error-alert error-alert--success is-visible">
                  {t('index.verified_banner')}
                </div>
              )}
              {banner === 'invalid' && (
                <div className="error-alert is-visible">{t('index.verify_error')}</div>
              )}
              {banner === 'expired' && (
                <div className="error-alert is-visible">{t('index.verify_expired')}</div>
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
                <div className="auth-resend-box auth-resend-box--login">
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
                  <a href="#" className="forgot-password forgot-password--auth" onClick={(e) => e.preventDefault()}>
                    {t('index.forgot_password')}
                  </a>
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
              </div>

              <button type="submit" className="auth-flow-btn auth-flow-btn--submit" disabled={loading}>
                {loading ? t('index.submit_loading') : t('index.submit')}
              </button>
            </form>

            <div className="signup-link signup-link--auth">
              <span>{t('index.signup_prompt')}</span>
              <Link to="/signup">{t('index.signup_link')}</Link>
            </div>
          </div>

          <footer className="auth-flow-legal">
            <FooterNavLinks />
          </footer>
        </section>
      </main>
    </div>
  );
}

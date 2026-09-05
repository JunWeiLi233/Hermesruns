import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch, apiJson } from '../../api';
import AuthDotField from '../../components/AuthDotField';
import AuthBrandCarousel from '../../components/AuthBrandCarousel';
import FooterNavLinks from '../../components/FooterNavLinks';
import HermesMarkSvg from '../../components/HermesMarkSvg';
import stravaConnectButton from '../../assets/btn_strava_connect_with_orange.svg';
import { parseLoginStatusQuery } from '../../utils/stravaLinking';
import { createPasskey, getPasskey, isWebAuthnSupported } from '../../utils/webauthn';

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
  const [authProviders, setAuthProviders] = useState(null);
  const [adminMfaStage, setAdminMfaStage] = useState(null);
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [pendingAdminSession, setPendingAdminSession] = useState(null);

  const stravaConfigured = authProviders?.stravaConfigured === true;
  const googleConfigured = authProviders?.googleConfigured === true;
  const hasConfiguredSocialProvider = stravaConfigured || googleConfigured;

  useEffect(() => {
    const oauthMfa = searchParams.get('adminMfa');
    if (oauthMfa === 'required' || oauthMfa === 'setup') {
      setAdminMfaStage(oauthMfa === 'setup' ? 'setup' : 'verify');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

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

      if (res.status === 202 && (data.code === 'ADMIN_MFA_REQUIRED' || data.code === 'ADMIN_MFA_SETUP_REQUIRED')) {
        setPassword('');
        setAdminMfaStage(data.code === 'ADMIN_MFA_SETUP_REQUIRED' ? 'setup' : 'verify');
        return;
      }

      login(data.token, data.email, data.role);
    } catch {
      setError(t('common.connection_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadMfaOptions(path, body) {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || t('index.admin_mfa_failed'));
      error.code = data.code;
      throw error;
    }
    return data.publicKey || data;
  }

  async function handlePasskeyAuthentication() {
    setError('');
    setLoading(true);
    try {
      const options = await loadMfaOptions('/api/auth/admin-mfa/authentication/options');
      const credential = await getPasskey(options);
      const res = await apiFetch('/api/auth/admin-mfa/authentication/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('index.admin_mfa_failed'));
      login(data.token, data.email, data.role);
    } catch (mfaError) {
      setError(mfaError?.message === 'PASSKEY_UNSUPPORTED'
        ? t('index.admin_mfa_unsupported')
        : t('index.admin_mfa_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeyRegistration() {
    setError('');
    setLoading(true);
    try {
      const options = await loadMfaOptions('/api/auth/admin-mfa/registration/options', { bootstrapToken });
      const credential = await createPasskey(options);
      const res = await apiFetch('/api/auth/admin-mfa/registration/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('index.admin_mfa_failed'));
      setPendingAdminSession(data);
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : []);
      setAdminMfaStage('recovery-codes');
      setBootstrapToken('');
    } catch (mfaError) {
      if (mfaError?.code === 'ADMIN_MFA_SETUP_UNAVAILABLE') {
        setAdminMfaStage(null);
        setBootstrapToken('');
        setError(t('index.admin_mfa_setup_unavailable'));
      } else {
        setError(isWebAuthnSupported() ? t('index.admin_mfa_failed') : t('index.admin_mfa_unsupported'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRecoveryAuthentication() {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/admin-mfa/recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('index.admin_mfa_failed'));
      login(data.token, data.email, data.role);
    } catch {
      setError(t('index.admin_mfa_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function cancelAdminMfa() {
    await apiFetch('/api/auth/admin-mfa/challenge', { method: 'DELETE' }).catch(() => {});
    setAdminMfaStage(null);
    setBootstrapToken('');
    setRecoveryCode('');
    setRecoveryCodes([]);
    setPendingAdminSession(null);
    setError('');
  }

  function continueAfterRecoveryCodes() {
    if (pendingAdminSession?.token) {
      login(pendingAdminSession.token, pendingAdminSession.email, pendingAdminSession.role);
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

  return (
    <div className="auth-page auth-page--login auth-page--liquid-glass" data-auth-redesign="command-entry">
      <AuthDotField />
      <main className="auth-flow-shell">
        <section className="auth-flow-brand">
          <div className="auth-flow-brand-inner">
            <div className="auth-flow-wordmark-wrap">
              <div className="auth-flow-wordmark-row">
                <HermesMarkSvg tone="light" className="auth-flow-wordmark-logo" />
                <h1 className="auth-flow-wordmark">HERMES</h1>
              </div>
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

              {adminMfaStage ? (
                <div className="auth-resend-box auth-resend-box--login" aria-live="polite">
                  <h4>{adminMfaStage === 'setup'
                    ? t('index.admin_mfa_setup_title')
                    : adminMfaStage === 'recovery-codes'
                      ? t('index.admin_mfa_codes_title')
                      : t('index.admin_mfa_title')}</h4>
                  <p className="auth-resend-copy">
                    {adminMfaStage === 'setup'
                      ? t('index.admin_mfa_setup_copy')
                      : adminMfaStage === 'recovery-codes'
                        ? t('index.admin_mfa_codes_copy')
                        : adminMfaStage === 'recovery'
                          ? t('index.admin_mfa_recovery_copy')
                          : t('index.admin_mfa_copy')}
                  </p>

                  {adminMfaStage === 'verify' && (
                    <>
                      <button type="button" className="auth-flow-btn auth-flow-btn--submit" disabled={loading} onClick={handlePasskeyAuthentication}>
                        {loading ? t('index.admin_mfa_working') : t('index.admin_mfa_use_passkey')}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setAdminMfaStage('recovery')}>
                        {t('index.admin_mfa_use_recovery')}
                      </button>
                    </>
                  )}

                  {adminMfaStage === 'setup' && (
                    <>
                      <div className="form-group form-group--auth">
                        <label htmlFor="admin-bootstrap-token">{t('index.admin_mfa_bootstrap_label')}</label>
                        <input id="admin-bootstrap-token" type="password" autoComplete="off" value={bootstrapToken} onChange={(event) => setBootstrapToken(event.target.value)} />
                      </div>
                      <button type="button" className="auth-flow-btn auth-flow-btn--submit" disabled={loading || !bootstrapToken} onClick={handlePasskeyRegistration}>
                        {loading ? t('index.admin_mfa_working') : t('index.admin_mfa_create_passkey')}
                      </button>
                    </>
                  )}

                  {adminMfaStage === 'recovery' && (
                    <>
                      <div className="form-group form-group--auth">
                        <label htmlFor="admin-recovery-code">{t('index.admin_mfa_recovery_label')}</label>
                        <input id="admin-recovery-code" type="text" autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} />
                      </div>
                      <button type="button" className="auth-flow-btn auth-flow-btn--submit" disabled={loading || !recoveryCode} onClick={handleRecoveryAuthentication}>
                        {loading ? t('index.admin_mfa_working') : t('index.admin_mfa_verify_recovery')}
                      </button>
                    </>
                  )}

                  {adminMfaStage === 'recovery-codes' && (
                    <>
                      <pre className="auth-resend-message">{recoveryCodes.join('\n')}</pre>
                      <button type="button" className="auth-flow-btn auth-flow-btn--submit" onClick={continueAfterRecoveryCodes}>
                        {t('index.admin_mfa_codes_continue')}
                      </button>
                    </>
                  )}

                  {adminMfaStage !== 'recovery-codes' && (
                    <button type="button" className="btn-secondary" onClick={cancelAdminMfa}>
                      {t('index.admin_mfa_cancel')}
                    </button>
                  )}
                </div>
              ) : (
                <>
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
              </div>

              <button type="submit" className="auth-flow-btn auth-flow-btn--submit" disabled={loading}>
                {loading ? t('index.submit_loading') : t('index.submit')}
              </button>
                </>
              )}
            </form>

            {!adminMfaStage && hasConfiguredSocialProvider && (
              <div className="auth-flow-social">
                {stravaConfigured && (
                  <button
                    type="button"
                    className="auth-flow-btn auth-flow-btn--strava auth-flow-btn--strava-official"
                    onClick={() => startOAuth('strava')}
                  >
                    <img
                      className="auth-flow-btn__strava-official"
                      src={stravaConnectButton}
                      alt={t('index.stitch_strava_cta')}
                      width="237"
                      height="48"
                      loading="eager"
                      decoding="async"
                    />
                  </button>
                )}

                {googleConfigured && (
                  <button
                    type="button"
                    className="auth-flow-btn auth-flow-btn--google"
                    onClick={() => startOAuth('google')}
                  >
                    <span className="auth-flow-google-g" aria-hidden="true">G</span>
                    <span>{t('index.google')}</span>
                  </button>
                )}
              </div>
            )}

            <div className="signup-link signup-link--auth">
              <span>{t('index.signup_prompt')}</span>
              <Link to="/signup">{t('index.signup_link')}</Link>
            </div>

            <footer className="auth-flow-legal auth-flow-legal--inline">
              <FooterNavLinks publicOnly={true} />
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

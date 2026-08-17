import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch, apiJson } from '../api';
import { fetchPasswordRules, getFailedPasswordRuleIds } from '../utils/passwordRules';
import AuthDotField from '../components/AuthDotField';
import AuthBrandCarousel from '../components/AuthBrandCarousel';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesMarkSvg from '../components/HermesMarkSvg';
import stravaConnectButton from '../assets/btn_strava_connect_with_orange.svg';
import { parseSignupStatusQuery } from '../utils/stravaLinking';

const SIGNUP_STITCH_COPY = {
  'zh-CN': {
    login_nav: '返回登录',
    hero_line_one: '从下一次',
    hero_line_two: '聪明训练',
    hero_line_three: '开始。',
    hero_copy: '创建账号，把跑步记录、恢复状态、跑鞋里程和比赛目标汇成每天一个清晰训练决定。现在连接 Strava，或先用邮箱注册，稍后再补充数据。',
    standard: '跑者优先设置',
    strava_cta: '使用 Strava 继续',
    email_divider: '或使用邮箱',
    email_label: '跑者邮箱',
    password_label: '密码 / PASSKEY',
    confirm_password_label: '确认密码',
    security_title: '密码要求',
    submit: '创建账号',
    done_line_one: '欢迎加入',
    done_line_two: 'Hermes',
    legal_prefix: '继续即表示你同意',
    legal_joiner: '与',
    confirm_password_mismatch: '两次输入的密码不一致。',
    footer_support: '支持',
    footer_terms: '条款',
    footer_privacy: '隐私',
    footer_contact: '联系',
    footer_copy: '为认真训练的跑者准备的入场页。',
  },
  en: {
    login_nav: 'Back to login',
    hero_line_one: 'Start with',
    hero_line_two: 'your next',
    hero_line_three: 'smart run.',
    hero_copy: 'Create the account that turns runs, recovery, shoes, and race goals into one daily training decision. Connect Strava now or start with email and add data later.',
    standard: 'Runner-first setup',
    strava_cta: 'Continue with Strava',
    email_divider: 'or use email',
    email_label: 'Runner email',
    password_label: 'Password / Passkey',
    confirm_password_label: 'Confirm password',
    security_title: 'Password rules',
    submit: 'Create account',
    done_line_one: 'Welcome to',
    done_line_two: 'Hermes',
    legal_prefix: 'By continuing you agree to the',
    legal_joiner: 'and',
    confirm_password_mismatch: 'Passwords do not match.',
    footer_support: 'Support',
    footer_terms: 'Terms',
    footer_privacy: 'Privacy',
    footer_contact: 'Contact',
    footer_copy: 'A daily training entry point for runners who care about the next decision.',
  },
};

function formatLocalCopy(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

const SIGNUP_EMAIL_ERROR_KEYS = {
  INVALID_EMAIL: 'signup.error_invalid_email',
  DISPOSABLE_EMAIL: 'signup.error_disposable_email',
  INVALID_EMAIL_DOMAIN: 'signup.error_invalid_email_domain',
};

function loadRecaptchaScript(siteKey) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('recaptcha_unavailable'));
  }
  if (!siteKey) {
    return Promise.reject(new Error('recaptcha_missing_site_key'));
  }
  if (window.grecaptcha?.execute && window.grecaptcha?.ready) {
    return Promise.resolve();
  }

  const scriptId = 'hermes-recaptcha-v3';
  const existing = document.getElementById(scriptId);
  if (existing) {
    if (existing.dataset.loaded === 'true') {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('recaptcha_script_failed')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('recaptcha_script_failed'));
    document.head.appendChild(script);
  });
}

async function getSignupCaptchaToken({ required, siteKey }) {
  if (!required) return '';

  await loadRecaptchaScript(siteKey);
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha?.ready || !grecaptcha?.execute) {
    throw new Error('recaptcha_unavailable');
  }

  return new Promise((resolve, reject) => {
    grecaptcha.ready(async () => {
      try {
        const token = await grecaptcha.execute(siteKey, { action: 'signup' });
        if (!token) throw new Error('recaptcha_empty_token');
        resolve(token);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export default function Signup() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const stitchCopy = useMemo(() => SIGNUP_STITCH_COPY[lang] || SIGNUP_STITCH_COPY.en, [lang]);
  const s = (key, vars) => formatLocalCopy(stitchCopy[key] || key, vars);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [suggestedEmail, setSuggestedEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pwRules, setPwRules] = useState(null);
  const [doneInfo, setDoneInfo] = useState(null);
  const [banner, setBanner] = useState(null);
  const [authProviders, setAuthProviders] = useState(null);

  const stravaConfigured = authProviders?.stravaConfigured === true;
  const googleConfigured = authProviders?.googleConfigured === true;
  const recaptchaRequired = authProviders?.recaptchaRequired === true;
  const recaptchaSiteKey = typeof authProviders?.recaptchaSiteKey === 'string'
    ? authProviders.recaptchaSiteKey.trim()
    : '';

  useEffect(() => {
    fetchPasswordRules().then(setPwRules);
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
    const bannerState = parseSignupStatusQuery(window.location.search, {
      stravaConfirmationFallback: t('profile.strava_link_confirmation_required'),
    });

    if (bannerState.prefillEmail) {
      setEmail(bannerState.prefillEmail);
    }

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
      } else {
        setError(bannerState.errorMessage || t('profile.strava_link_confirmation_required'));
      }
    }

    if (bannerState.shouldClear) {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams, t]);

  const clientFailed = useMemo(
    () => getFailedPasswordRuleIds(password, pwRules || {}),
    [password, pwRules],
  );

  const strengthScore = useMemo(() => {
    if (!password) return null;
    const allRules = ['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL'];
    const passed = allRules.filter((r) => !clientFailed.includes(r)).length;
    if (passed <= 2) return 'weak';
    if (passed === 3) return 'fair';
    return 'strong';
  }, [password, clientFailed]);

  const ruleLabels = {
    MIN_LENGTH: () => t('signup.password_rule_min', { n: pwRules?.minLength || 10 }),
    UPPERCASE: () => t('signup.password_rule_upper'),
    LOWERCASE: () => t('signup.password_rule_lower'),
    DIGIT: () => t('signup.password_rule_digit'),
    SPECIAL: () => t('signup.password_rule_special'),
    NOT_COMMON: () => t('signup.password_rule_common'),
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuggestedEmail(null);

    if (password !== confirmPassword) {
      setError(s('confirm_password_mismatch'));
      return;
    }

    const failed = getFailedPasswordRuleIds(password, pwRules || {});
    if (failed.length > 0) {
      setError(t('signup.password_rules_title'));
      return;
    }

    setLoading(true);
    try {
      const captchaToken = await getSignupCaptchaToken({
        required: recaptchaRequired,
        siteKey: recaptchaSiteKey,
      });
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, captchaToken }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const emailErrorKey = SIGNUP_EMAIL_ERROR_KEYS[data.code];
        if (emailErrorKey) {
          setError(t(emailErrorKey));
          if (data.code === 'INVALID_EMAIL_DOMAIN' && data.suggestedEmail) {
            setSuggestedEmail(data.suggestedEmail);
          }
        } else if (data.code === 'WEAK_PASSWORD' && Array.isArray(data.failedRules)) {
          setError(data.error || t('signup.password_rules_title'));
        } else {
          setError(data.error || data.message || 'Request failed.');
        }
        setLoading(false);
        return;
      }

      setDoneInfo({
        verificationRequired: !!data.verificationRequired,
        message: data.message,
      });
    } catch (err) {
      const recaptchaFailed = err instanceof Error && err.message.startsWith('recaptcha_');
      setError(t(recaptchaFailed ? 'common.recaptcha_failed' : 'common.connection_failed'));
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
    window.location.href = `${baseUrl}/api/auth/${provider}/start?state=signup`;
  }

  if (doneInfo) {
    return (
      <div className="auth-page auth-page--signup auth-page--liquid-glass" data-auth-redesign="command-entry">
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
                <h3>{s('done_line_one')}</h3>
                <p>{s('done_line_two')}</p>
              </div>

              <p className="auth-flow-text">{doneInfo.message || t('signup.check_email_body')}</p>
              {!doneInfo.verificationRequired && (
                <p className="auth-flow-status-note">{t('signup.no_mail_server_note')}</p>
              )}

              <button
                type="button"
                className="auth-flow-btn auth-flow-btn--submit"
                onClick={() => navigate('/login')}
              >
                {t('signup.signin_link')}
              </button>
            </div>

            <footer className="auth-flow-legal">
              <FooterNavLinks className="signup-flow-footer-links" publicOnly={true} />
            </footer>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page--signup auth-page--liquid-glass" data-auth-redesign="command-entry">
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
              <h3>{s('hero_line_one')} {s('hero_line_two')} <span className="is-accent">{s('hero_line_three')}</span></h3>
              <p>{s('hero_copy')}</p>
            </div>

            <form className="auth-flow-form" onSubmit={handleSubmit}>
              {banner === 'strava_link_confirmation_required' && (
                <div className="error-alert is-visible" role="alert">{t('profile.strava_link_confirmation_required')}</div>
              )}
              {banner === 'strava_not_configured' && (
                <div className="error-alert is-visible" role="alert">{t('common.strava_not_configured')}</div>
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
              {suggestedEmail && (
                <div className="error-alert is-visible signup-typo-suggestion" role="status">
                  <span>{t('signup.typo_suggestion_prefix', { email: suggestedEmail })}</span>
                  <button
                    type="button"
                    className="signup-typo-suggestion__use"
                    onClick={() => {
                      setEmail(suggestedEmail);
                      setSuggestedEmail(null);
                      setError('');
                    }}
                  >
                    {t('signup.typo_suggestion_use')}
                  </button>
                </div>
              )}

              <div className={`pwd-strength-card${!password ? ' pwd-strength-card--hidden' : ''}`}>
                <div className="pwd-strength-header">
                  <span className="pwd-strength-label">{t('signup.password_strength')}</span>
                  {strengthScore && (
                    <span className={`pwd-strength-badge pwd-strength-badge--${strengthScore}`}>
                      {t(`signup.password_strength_${strengthScore}`)}
                    </span>
                  )}
                </div>
                <div className="pwd-strength-bar-track">
                  <div className={`pwd-strength-bar-fill${strengthScore ? ` pwd-strength-bar-fill--${strengthScore}` : ''}`} />
                </div>
                <ul className="pwd-strength-rules">
                  {['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL'].map((id) => {
                    const isMet = !clientFailed.includes(id) && password.length > 0;
                    return (
                      <li key={id} className={`pwd-strength-rule${isMet ? ' is-met' : ''}`}>
                        <AppIcon name={isMet ? 'check' : 'close'} className="rule-icon" />
                        <span>{ruleLabels[id] ? ruleLabels[id]() : id}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="form-group form-group--auth">
                <label htmlFor="email">{t('signup.email_label')}</label>
                <input
                  type="email"
                  id="email"
                  placeholder="athlete@hermes.io"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSuggestedEmail(null);
                  }}
                />
              </div>

              <div className="form-group form-group--auth">
                <label htmlFor="password">{t('signup.password_label')}</label>
                <input
                  type="password"
                  id="password"
                  placeholder="********"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="form-group form-group--auth">
                <label htmlFor="confirm-password">{t('signup.confirm_password_label')}</label>
                <input
                  type="password"
                  id="confirm-password"
                  placeholder="********"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="auth-flow-btn auth-flow-btn--submit" disabled={loading}>
                {loading ? t('signup.submit_loading') : t('signup.submit')}
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
                  alt={stravaConfigured ? s('strava_cta') : t('common.strava_not_configured')}
                />
              </button>

              {!stravaConfigured && (
                <p className="auth-flow-status-note auth-flow-status-note--strava">{t('common.strava_not_configured')}</p>
              )}

              <button
                type="button"
                className="auth-flow-btn auth-flow-btn--google"
                disabled={!googleConfigured}
                onClick={() => startOAuth('google')}
              >
                <span className="auth-flow-google-g" aria-hidden="true">G</span>
                <span>{t(googleConfigured ? 'signup.google' : 'common.google_not_configured')}</span>
              </button>

              {!googleConfigured && (
                <p className="auth-flow-status-note auth-flow-status-note--google">{t('common.google_not_configured')}</p>
              )}
            </div>

            <div className="signup-link signup-link--auth">
              <span>{t('signup.signin_prompt')}</span>
              <Link to="/login">{t('signup.signin_link')}</Link>
            </div>

            <footer className="auth-flow-legal auth-flow-legal--inline">
              <FooterNavLinks className="signup-flow-footer-links" publicOnly={true} />
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

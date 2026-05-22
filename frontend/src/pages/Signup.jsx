import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch, apiJson } from '../api';
import { fetchPasswordRules, getFailedPasswordRuleIds } from '../utils/passwordRules';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import { parseSignupStatusQuery } from '../utils/stravaLinking';
import authBrandSlides from '../data/authBrandSlides';

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
  const [loading, setLoading] = useState(false);
  const [pwRules, setPwRules] = useState(null);
  const [doneInfo, setDoneInfo] = useState(null);
  const [banner, setBanner] = useState(null);
  const [authProviders, setAuthProviders] = useState(null);

  const stravaConfigured = authProviders?.stravaConfigured === true;
  const googleConfigured = authProviders?.googleConfigured === true;

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
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === 'WEAK_PASSWORD' && Array.isArray(data.failedRules)) {
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
    window.location.href = `${baseUrl}/api/auth/${provider}/start?state=signup`;
  }

  if (doneInfo) {
    return (
      <div className="auth-page auth-page--signup">
        <main className="auth-flow-shell">
          <section className="auth-flow-brand">
            <div className="auth-flow-brand-inner">
              <div className="auth-flow-wordmark-wrap">
                <h1 className="auth-flow-wordmark">HERMES</h1>
                <span className="auth-flow-pulse">{t('index.stitch_pulse')}</span>
              </div>

              <div className="auth-flow-copy auth-flow-copy--carousel" aria-label={t('index.stitch_slides_label')}>
                <div className="auth-flow-slide-viewport">
                  <div className="auth-flow-slide-track">
                    {authBrandSlides.map((slide) => (
                      <article className="auth-flow-slide" key={slide.id}>
                        <span className="auth-flow-kicker">{t(slide.kickerKey)}</span>
                        <h2 className="auth-flow-hero">
                          <span>{t(slide.lineOneKey)}</span>
                          <span className="is-accent">{t(slide.lineTwoKey)}</span>
                        </h2>
                        <p className="auth-flow-text">{t(slide.copyKey)}</p>
                        <div className="auth-flow-stats">
                          {slide.stats.map((stat) => (
                            <div key={stat.labelKey}>
                              <strong>{stat.value}</strong>
                              <span>{t(stat.labelKey)}</span>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <div className="auth-flow-dots" aria-hidden="true">
                {authBrandSlides.map((slide, index) => (
                  <span className={`auth-flow-dot auth-flow-dot--${index + 1}`} key={slide.id} />
                ))}
              </div>
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
              <FooterNavLinks publicOnly={true} />
            </footer>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page--signup">
      <main className="auth-flow-shell">
        <section className="auth-flow-brand">
          <div className="auth-flow-brand-inner">
            <div className="auth-flow-wordmark-wrap">
              <h1 className="auth-flow-wordmark">HERMES</h1>
              <span className="auth-flow-pulse">{t('index.stitch_pulse')}</span>
            </div>

            <div className="auth-flow-copy auth-flow-copy--carousel" aria-label={t('index.stitch_slides_label')}>
              <div className="auth-flow-slide-viewport">
                <div className="auth-flow-slide-track">
                  {authBrandSlides.map((slide) => (
                    <article className="auth-flow-slide" key={slide.id}>
                      <span className="auth-flow-kicker">{t(slide.kickerKey)}</span>
                      <h2 className="auth-flow-hero">
                        <span>{t(slide.lineOneKey)}</span>
                        <span className="is-accent">{t(slide.lineTwoKey)}</span>
                      </h2>
                      <p className="auth-flow-text">{t(slide.copyKey)}</p>
                      <div className="auth-flow-stats">
                        {slide.stats.map((stat) => (
                          <div key={stat.labelKey}>
                            <strong>{stat.value}</strong>
                            <span>{t(stat.labelKey)}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="auth-flow-dots" aria-hidden="true">
              {authBrandSlides.map((slide, index) => (
                <span className={`auth-flow-dot auth-flow-dot--${index + 1}`} key={slide.id} />
              ))}
            </div>
          </div>
        </section>

        <section className="auth-flow-formside">
          <div className="auth-flow-card">
            <div className="auth-flow-header">
              <h3>{s('hero_line_one')} {s('hero_line_two')} <span className="is-accent">{s('hero_line_three')}</span></h3>
              <p>{s('hero_copy')}</p>
            </div>

            <div className="auth-flow-social">
              <button
                type="button"
                className="auth-flow-btn auth-flow-btn--strava"
                disabled={!stravaConfigured}
                onClick={() => startOAuth('strava')}
              >
                <span className="auth-flow-btn__icon auth-flow-btn__icon--bolt" aria-hidden="true">+</span>
                <span>{stravaConfigured ? s('strava_cta') : t('common.strava_not_configured')}</span>
              </button>

              {!stravaConfigured && (
                <p className="auth-flow-status-note">{t('common.strava_not_configured')}</p>
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
                <p className="auth-flow-status-note">{t('common.google_not_configured')}</p>
              )}
            </div>

            <div className="auth-flow-divider">
              <span />
              <strong>{s('email_divider')}</strong>
              <span />
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
                  onChange={(e) => setEmail(e.target.value)}
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

            <div className="signup-link signup-link--auth">
              <span>{t('signup.signin_prompt')}</span>
              <Link to="/login">{t('signup.signin_link')}</Link>
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

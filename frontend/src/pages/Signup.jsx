import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import { parseSignupStatusQuery } from '../utils/stravaLinking';

const SIGNUP_STITCH_COPY = {
  'zh-CN': {
    login_nav: '返回登录',
    hero_line_one: '提高你的',
    hero_line_two: '每一步',
    hero_line_three: '表现。',
    hero_copy: '把训练记录、表现判断和下一步建议放进同一个入口。连接 Strava 后，Hermes 会把新的跑步数据持续带回你的训练面板。',
    standard: '数字节律',
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
    hero_line_one: 'Elevate your',
    hero_line_two: 'every',
    hero_line_three: 'stride.',
    hero_copy: 'Bring training history, performance signals, and the next best action into one entry point. Once Strava is connected, Hermes keeps pulling fresh run data back into your coaching dashboard.',
    standard: 'Digital pulse',
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
    footer_copy: 'A better training entry point for serious runners.',
  },
};

function formatLocalCopy(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function checkPasswordClient(password, minLength) {
  const failed = [];
  if (!password || password.length < minLength) failed.push('MIN_LENGTH');
  if (!/[A-Z]/.test(password)) failed.push('UPPERCASE');
  if (!/[a-z]/.test(password)) failed.push('LOWERCASE');
  if (!/\d/.test(password)) failed.push('DIGIT');
  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?/~`"'\\]/.test(password)) failed.push('SPECIAL');
  const common = ['password', 'password123', '12345678', '123456789', 'qwerty', 'admin', 'letmein'];
  if (common.includes(password.toLowerCase())) failed.push('NOT_COMMON');
  return failed;
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
  const [failedRules, setFailedRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwRules, setPwRules] = useState({ minLength: 10 });
  const [doneInfo, setDoneInfo] = useState(null);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const baseUrl = getBackendBaseUrl();
        const res = await fetch(`${baseUrl}/api/auth/password-rules`);
        if (res.ok) {
          const data = await res.json();
          if (data.minLength) setPwRules(data);
        }
      } catch {
        // Ignore password rule fetch failures and keep the local fallback.
      }
    })();
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
      } else {
        setError(bannerState.errorMessage || t('profile.strava_link_confirmation_required'));
      }
    }

    if (bannerState.shouldClear) {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams, t]);

  const clientFailed = useMemo(
    () => checkPasswordClient(password, pwRules.minLength || 10),
    [password, pwRules.minLength],
  );
  const displayFailed = failedRules.length > 0 ? failedRules : clientFailed;

  const ruleLabels = {
    MIN_LENGTH: () => t('signup.password_rule_min', { n: pwRules.minLength || 10 }),
    UPPERCASE: () => t('signup.password_rule_upper'),
    LOWERCASE: () => t('signup.password_rule_lower'),
    DIGIT: () => t('signup.password_rule_digit'),
    SPECIAL: () => t('signup.password_rule_special'),
    NOT_COMMON: () => t('signup.password_rule_common'),
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFailedRules([]);

    if (password !== confirmPassword) {
      setError(s('confirm_password_mismatch'));
      return;
    }

    const failed = checkPasswordClient(password, pwRules.minLength || 10);
    if (failed.length > 0) {
      setFailedRules(failed);
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
          setFailedRules(data.failedRules);
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
    const baseUrl = getBackendBaseUrl();
    window.location.href = `${baseUrl}/api/auth/${provider}/start?state=signup`;
  }

  if (doneInfo) {
    return (
      <div className="auth-page auth-page--signup">
        <div className="signup-flow-bg" />
        <main className="signup-flow-shell signup-flow-shell--done">
          <section className="signup-flow-copy signup-flow-copy--done">
            <div className="signup-flow-copy-stack">
              <Link to="/" className="signup-flow-wordmark">HERMES</Link>
              <h1 className="signup-flow-hero">
                <span>{s('done_line_one')}</span>
                <span className="is-accent">{s('done_line_two')}</span>
              </h1>
              <p className="signup-flow-text">{doneInfo.message || t('signup.check_email_body')}</p>
              {!doneInfo.verificationRequired && (
                <p className="signup-flow-subtle">{t('signup.no_mail_server_note')}</p>
              )}
              <button type="button" className="signup-flow-primary" onClick={() => navigate('/login')}>
                {t('signup.signin_link')}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page--signup">
      <div className="signup-flow-bg" />

      <nav className="signup-flow-nav">
        <Link to="/" className="signup-flow-wordmark">HERMES</Link>
        <Link to="/login" className="signup-flow-login-link">{s('login_nav')}</Link>
      </nav>

      <main className="signup-flow-shell">
        <section className="signup-flow-copy">
          <div className="signup-flow-copy-stack">
            <h1 className="signup-flow-hero">
              <span>{s('hero_line_one')}</span>
              <span>{s('hero_line_two')}</span>
              <span className="is-accent">{s('hero_line_three')}</span>
            </h1>
            <p className="signup-flow-text">{s('hero_copy')}</p>
            <div className="signup-flow-standard">
              <span className="signup-flow-standard-line" />
              <span>{s('standard')}</span>
            </div>
            <div className="signup-flow-rail" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>
          </div>
        </section>

        <section className="signup-flow-panel-wrap">
          <div className="signup-flow-panel">
            <button type="button" className="signup-flow-strava" onClick={() => startOAuth('strava')}>
              <AppIcon name="directions_run" className="signup-flow-strava-icon" />
              <span>{s('strava_cta')}</span>
            </button>

            <div className="signup-flow-divider">
              <span />
              <strong>{s('email_divider')}</strong>
              <span />
            </div>

            <form className="signup-flow-form" onSubmit={handleSubmit}>
              {banner === 'strava_link_confirmation_required' && (
                <div className="error-alert is-visible">{t('profile.strava_link_confirmation_required')}</div>
              )}
              {banner === 'strava_not_configured' && (
                <div className="error-alert is-visible">{t('common.strava_not_configured')}</div>
              )}
              {banner === 'strava_failed' && (
                <div className="error-alert is-visible">{t('common.strava_login_failed')}</div>
              )}
              {error && <div className="error-alert is-visible">{error}</div>}

              <div className="signup-flow-field">
                <label htmlFor="email">{s('email_label')}</label>
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

              <div className="signup-flow-field">
                <label htmlFor="password">{s('password_label')}</label>
                <input
                  type="password"
                  id="password"
                  placeholder="********"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFailedRules([]);
                  }}
                />
              </div>

              <div className="signup-flow-field">
                <label htmlFor="confirm-password">{s('confirm_password_label')}</label>
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

              <div className="signup-flow-rules">
                <h3>{s('security_title')}</h3>
                <ul>
                  {['MIN_LENGTH', 'DIGIT', 'SPECIAL'].map((id) => (
                    <li key={id} className={displayFailed.includes(id) ? '' : 'is-passed'}>
                      <span aria-hidden="true">{displayFailed.includes(id) ? '○' : '●'}</span>
                      <span>{ruleLabels[id] ? ruleLabels[id]() : id}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button type="submit" className="signup-flow-primary" disabled={loading}>
                {loading ? t('signup.submit_loading') : s('submit')}
              </button>

              <button
                type="button"
                className="signup-flow-google"
                onClick={() => startOAuth('google')}
              >
                {t('signup.google')}
              </button>
            </form>

            <p className="signup-flow-legal">
              {s('legal_prefix')}{' '}
              <a href="/terms">{s('footer_terms')}</a>{' '}
              {s('legal_joiner')}{' '}
              <a href="/privacy">{s('footer_privacy')}</a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="signup-flow-footer">
        <FooterNavLinks className="signup-flow-footer-links" />
        <p>{s('footer_copy')}</p>
      </footer>
    </div>
  );
}

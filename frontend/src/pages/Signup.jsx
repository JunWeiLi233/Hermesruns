import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl, apiFetch } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import BrandLogo from '../components/BrandLogo';

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
  const { t } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [failedRules, setFailedRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwRules, setPwRules] = useState({ minLength: 10 });
  const [doneInfo, setDoneInfo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const baseUrl = getBackendBaseUrl();
        const res = await fetch(`${baseUrl}/api/auth/password-rules`);
        if (res.ok) {
          const data = await res.json();
          if (data.minLength) setPwRules(data);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const clientFailed = useMemo(() => checkPasswordClient(password, pwRules.minLength || 10), [password, pwRules.minLength]);
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

    const f = checkPasswordClient(password, pwRules.minLength || 10);
    if (f.length > 0) {
      setFailedRules(f);
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
      <div className="auth-page">
        <LanguageSwitcher />
        <div className="layout-wrapper">
          <section className="form-section" style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '2rem' }}>
            <div className="auth-panel">
              <div className="login-container">
                <h2 className="auth-card-title">{t('signup.check_email_title')}</h2>
                <p className="auth-hero-text" style={{ marginTop: 16 }}>{doneInfo.message || t('signup.check_email_body')}</p>
                {!doneInfo.verificationRequired && (
                  <p className="auth-card-copy" style={{ marginTop: 12 }}>{t('signup.no_mail_server_note')}</p>
                )}
                <button type="button" className="btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/login')}>
                  {t('signup.signin_link')}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
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
                <p className="auth-card-kicker">Hermesruns</p>
                <h2 className="auth-card-title">{t('signup.form_title')}</h2>
              </div>

              <form onSubmit={handleSubmit}>
                {error && <div className="error-alert" style={{ display: 'block' }}>{error}</div>}

                <div className="form-group">
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>{t('signup.password_rules_title')}</div>
                  <ul style={{ fontSize: '0.8rem', color: 'var(--classic-muted, #666)', margin: '0 0 12px 1rem', lineHeight: 1.5 }}>
                    {['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL', 'NOT_COMMON'].map(id => (
                      <li key={id} style={{ color: displayFailed.includes(id) ? '#c02626' : 'inherit' }}>
                        {ruleLabels[id] ? ruleLabels[id]() : id}
                      </li>
                    ))}
                  </ul>
                </div>

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
                    onChange={e => { setPassword(e.target.value); setFailedRules([]); }}
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

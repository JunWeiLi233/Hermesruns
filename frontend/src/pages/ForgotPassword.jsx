import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || t('common.connection_failed'));
      } else {
        setMessage(data.message || t('forgotPassword.reset_link_sent'));
      }
    } catch {
      setError(t('common.connection_failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page--forgot-password">
      <main className="auth-flow-shell">
        <section className="auth-flow-brand">
          <div className="auth-flow-brand-inner">
            <div className="auth-flow-wordmark-wrap">
              <Link to="/" className="auth-flow-wordmark">HERMES</Link>
            </div>
            <div className="auth-flow-copy">
              <h2 className="auth-flow-hero">
                <span>{t('forgotPassword.hero_recover')}</span>
                <span className="is-accent">{t('forgotPassword.hero_your_password')}</span>
              </h2>
              <p className="auth-flow-text">
                {t('forgotPassword.hero_instruction')}
              </p>
            </div>
          </div>
        </section>

        <section className="auth-flow-formside">
          <div className="auth-flow-card">
            <div className="auth-flow-header">
              <h3>{t('forgotPassword.heading')}</h3>
              <p>{t('forgotPassword.subtitle')}</p>
            </div>

            <form className="auth-flow-form" onSubmit={handleSubmit}>
              {error && <div className="error-alert is-visible" role="alert">{error}</div>}
              {message && <div className="error-alert error-alert--success is-visible" role="status">{message}</div>}

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
                  disabled={loading}
                />
              </div>

              <button type="submit" className="auth-flow-btn auth-flow-btn--submit" disabled={loading}>
                {loading ? t('index.submit_loading') : t('forgotPassword.send_reset_link')}
              </button>
            </form>

            <div className="signup-link signup-link--auth">
              <Link to="/login">
                <AppIcon name="arrow_back" className="btn-icon-left" />
                {t('signup.signin_link')}
              </Link>
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

import { Link } from 'react-router';
import { useI18n } from '../contexts/I18nContext';
import HermesMarkSvg from './HermesMarkSvg';
import AuthDotField from './AuthDotField';
import AuthBrandCarousel from './AuthBrandCarousel';
import '../styles/auth-studio.css';

export function AuthGoogleMark() {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.35-2.59Z" />
    <path fill="#EA4335" d="M12 5.96c1.47 0 2.8.5 3.83 1.5l2.88-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.35 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
  </svg>;
}

export default function AuthPageLayout({ variant, title, description, children }) {
  const { t, lang, setLang } = useI18n();

  return (
    <div className={`auth-page auth-page--${variant} auth-page--liquid-glass auth-page--refined`} data-auth-redesign="command-entry">
      <AuthDotField />
      <button type="button" className="auth-refined-language" aria-label={t('landing.studio_language')}
          onClick={() => setLang(lang === 'zh-CN' ? 'en' : 'zh-CN')}>
          {lang === 'zh-CN' ? 'EN' : '中文'}
      </button>
      <main className="auth-flow-shell">
        <section className="auth-flow-brand">
          <div className="auth-flow-brand-inner">
            <div className="auth-flow-wordmark-wrap">
              <Link to="/" className="auth-flow-wordmark-row" aria-label={t('index.studio_home')}>
                <HermesMarkSvg tone="light" className="auth-flow-wordmark-logo" />
                <span className="auth-flow-wordmark">HERMES</span>
              </Link>
              <span className="auth-flow-pulse">{t('index.stitch_pulse')}</span>
            </div>
            <AuthBrandCarousel t={t} />
          </div>
        </section>
        <section className="auth-flow-formside" aria-labelledby="auth-title">
          <div className="auth-flow-card">
            <div className="auth-flow-header">
              <h1 id="auth-title">{title}</h1>
              <p>{description}</p>
            </div>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

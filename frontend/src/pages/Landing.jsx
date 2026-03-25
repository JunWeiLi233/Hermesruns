import { useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/profile');
  }, [isAuthenticated, navigate]);

  const startStrava = useCallback(() => {
    const baseUrl = getBackendBaseUrl();
    window.location.href = `${baseUrl}/api/auth/strava/start?state=login`;
  }, []);

  const features = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      ),
      title: t('landing.feature_analytics_title'),
      desc: t('landing.feature_analytics_desc'),
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
      title: t('landing.feature_training_title'),
      desc: t('landing.feature_training_desc'),
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      title: t('landing.feature_heatmap_title'),
      desc: t('landing.feature_heatmap_desc'),
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      ),
      title: t('landing.feature_races_title'),
      desc: t('landing.feature_races_desc'),
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
      title: t('landing.feature_shoes_title'),
      desc: t('landing.feature_shoes_desc'),
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10"/>
          <path d="M12 20V4"/>
          <path d="M6 20v-6"/>
        </svg>
      ),
      title: t('landing.feature_prediction_title'),
      desc: t('landing.feature_prediction_desc'),
    },
  ];

  const integrations = [
    { name: 'Strava', color: '#fc4c02' },
    { name: 'Garmin', color: '#007cc3' },
    { name: 'Google', color: '#4285f4' },
    { name: 'COROS', color: '#e53935' },
  ];

  return (
    <div className="landing-page">
      <LanguageSwitcher />

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <nav className="landing-nav">
          <div className="landing-nav-brand">
            <HermesLogo mark={t('common.logo_mark')} tone="dark" />
          </div>
          <div className="landing-nav-actions">
            <button type="button" className="landing-btn-strava-sm" onClick={startStrava}>
              {t('landing.cta_strava')}
            </button>
            <Link to="/login" className="landing-nav-link">{t('landing.alt_sign_in')}</Link>
            <Link to="/signup" className="landing-nav-link">{t('landing.get_started')}</Link>
          </div>
        </nav>

        <div className="landing-hero-content">
          <div className="landing-hero-badge">{t('landing.badge')}</div>
          <h1 className="landing-hero-title">
            {t('landing.hero_title').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </h1>
          <p className="landing-hero-text">{t('landing.hero_text')}</p>
          <div className="landing-hero-actions landing-hero-actions--wrap">
            <button type="button" className="landing-btn-strava" onClick={startStrava}>
              {t('landing.cta_strava')}
            </button>
            <Link to="/login" className="landing-btn-ghost">{t('landing.alt_sign_in')}</Link>
            <Link to="/signup" className="landing-hero-tertiary">{t('landing.get_started')}</Link>
          </div>

          <div className="landing-stats-row">
            <div className="landing-stat">
              <span className="landing-stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </span>
              <span className="landing-stat-label">{t('landing.stat_vdot')}</span>
            </div>
            <div className="landing-stat">
              <span className="landing-stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </span>
              <span className="landing-stat-label">{t('landing.stat_zones')}</span>
            </div>
            <div className="landing-stat">
              <span className="landing-stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
              <span className="landing-stat-label">{t('landing.stat_routes')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-kicker">{t('landing.features_kicker')}</span>
            <h2 className="landing-section-title">{t('landing.features_title')}</h2>
            <p className="landing-section-copy">{t('landing.features_copy')}</p>
          </div>

          <div className="landing-features-grid">
            {features.map((f, i) => (
              <div className="landing-feature-card" key={i}>
                <div className="landing-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="landing-integrations">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-kicker">{t('landing.integrations_kicker')}</span>
            <h2 className="landing-section-title">{t('landing.integrations_title')}</h2>
            <p className="landing-section-copy">{t('landing.integrations_copy')}</p>
          </div>

          <div className="landing-integrations-row">
            {integrations.map((intg, i) => (
              <div className="landing-integration-chip" key={i}>
                <span className="landing-integration-dot" style={{ background: intg.color }} />
                {intg.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <div className="landing-section-inner">
          <h2 className="landing-cta-title">{t('landing.cta_title')}</h2>
          <p className="landing-cta-copy">{t('landing.cta_copy')}</p>
          <div className="landing-hero-actions landing-hero-actions--wrap">
            <button type="button" className="landing-btn-strava" onClick={startStrava}>
              {t('landing.cta_strava')}
            </button>
            <Link to="/login" className="landing-btn-ghost">{t('landing.alt_sign_in')}</Link>
            <Link to="/signup" className="landing-hero-tertiary">{t('landing.get_started')}</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span><HermesLogo mark={t('common.logo_mark')} tone="light" /></span>
        <span className="landing-footer-copy">{t('landing.footer')}</span>
      </footer>
    </div>
  );
}

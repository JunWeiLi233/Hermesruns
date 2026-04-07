import { useEffect, useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';
import { useScrollReveal } from '../hooks/useScrollReveal';

function RevealSection({ children, className = '', delay = 0 }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.15, rootMargin: '0px' });
  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? 'reveal-visible' : 'reveal-hidden'}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, isAdmin, authHydrated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const startStrava = useCallback(() => {
    window.location.href = `${getBackendBaseUrl()}/api/auth/strava/start?state=login`;
  }, []);

  const features = [
    {
      icon: '📊',
      title: t('landing.feature_analytics_title'),
      desc: t('landing.feature_analytics_desc'),
    },
    {
      icon: '🏃',
      title: t('landing.feature_training_title'),
      desc: t('landing.feature_training_desc'),
    },
    {
      icon: '🗺️',
      title: t('landing.feature_heatmap_title'),
      desc: t('landing.feature_heatmap_desc'),
    },
    {
      icon: '🏅',
      title: t('landing.feature_races_title'),
      desc: t('landing.feature_races_desc'),
    },
    {
      icon: '👟',
      title: t('landing.feature_shoes_title'),
      desc: t('landing.feature_shoes_desc'),
    },
    {
      icon: '🎯',
      title: t('landing.feature_prediction_title'),
      desc: t('landing.feature_prediction_desc'),
    },
  ];

  const stats = [
    { value: 'VO₂max', label: t('landing.stat_vdot') },
    { value: '6', label: t('landing.stat_zones') },
    { value: 'GPS', label: t('landing.stat_routes') },
  ];

  const heroLines = t('landing.hero_title').split('\n');

  return (
    <div className="landing-v2">
      <LanguageSwitcher />

      {/* — Nav — */}
      <nav className={`lv2-nav ${isScrolled ? 'lv2-nav--scrolled' : ''}`}>
        <HermesLogo mark={t('common.logo_mark')} tone="light" />
        <div className="lv2-nav-right">
          <Link to="/login" className="lv2-nav-link">{t('landing.alt_sign_in')}</Link>
          <button type="button" className="lv2-btn lv2-btn--sm" onClick={startStrava}>
            {t('landing.cta_strava')}
          </button>
        </div>
      </nav>

      {/* — Hero — */}
      <section className="lv2-hero">
        <RevealSection>
          <span className="lv2-badge">{t('landing.badge')}</span>
          <h1 className="lv2-hero-title">
            {heroLines.map((line, i) => (
              <span key={i} className={i === heroLines.length - 1 ? 'lv2-accent' : ''}>
                {line}
              </span>
            ))}
          </h1>
          <p className="lv2-hero-sub">{t('landing.hero_text')}</p>
          <div className="lv2-hero-actions">
            <button type="button" className="lv2-btn lv2-btn--primary" onClick={startStrava}>
              {t('landing.cta_strava')}
            </button>
            <Link to="/signup" className="lv2-btn lv2-btn--outline">{t('landing.get_started')}</Link>
          </div>
        </RevealSection>
      </section>

      {/* — Stats strip — */}
      <RevealSection className="lv2-stats">
        {stats.map((s) => (
          <div key={s.label} className="lv2-stat">
            <span className="lv2-stat-value">{s.value}</span>
            <span className="lv2-stat-label">{s.label}</span>
          </div>
        ))}
      </RevealSection>

      {/* — Features — */}
      <section className="lv2-features">
        <RevealSection>
          <h2 className="lv2-section-title">{t('landing.features_title')}</h2>
          <p className="lv2-section-sub">{t('landing.features_copy')}</p>
        </RevealSection>
        <div className="lv2-features-grid">
          {features.map((f, i) => (
            <RevealSection key={f.title} delay={i * 80}>
              <article className="lv2-feature-card">
                <span className="lv2-feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* — Final CTA — */}
      <RevealSection>
        <section className="lv2-cta">
          <h2 className="lv2-cta-title">{t('landing.cta_title')}</h2>
          <p className="lv2-cta-sub">{t('landing.cta_copy')}</p>
          <button type="button" className="lv2-btn lv2-btn--primary" onClick={startStrava}>
            {t('landing.cta_strava')}
          </button>
        </section>
      </RevealSection>

      {/* — Footer — */}
      <footer className="lv2-footer">
        <HermesLogo mark={t('common.logo_mark')} tone="light" />
        <span className="lv2-footer-copy">{t('landing.footer')}</span>
      </footer>
    </div>
  );
}

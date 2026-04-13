import { useEffect, useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl } from '../api';
import AppIcon from '../components/AppIcon';
import { useScrollReveal } from '../hooks/useScrollReveal';

function RevealSection({ children, className = '', delay = 0 }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.16, rootMargin: '0px' });
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
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const startStrava = useCallback(() => {
    window.location.href = `${getBackendBaseUrl()}/api/auth/strava/start?state=login`;
  }, []);

  const heroTitle = t('landing.hero_title').split('\n');
  const redlineTitle = t('landing.cta_title').split('\n');

  const storyPoints = [
    {
      icon: 'insights',
      title: t('landing.feature_analytics_title'),
      copy: t('landing.feature_analytics_desc'),
    },
    {
      icon: 'show_chart',
      title: t('landing.feature_training_title'),
      copy: t('landing.feature_training_desc'),
    },
  ];

  const analyticsCards = [
    {
      type: 'chart',
      kicker: t('landing.feature_heatmap_title'),
      title: t('landing.feature_prediction_title'),
      copy: t('landing.feature_prediction_desc'),
    },
    {
      type: 'latency',
      value: '0.02s',
      label: t('landing.integ_files'),
      icon: 'timer',
    },
    {
      type: 'gps',
      value: t('landing.integ_strava'),
      label: t('landing.integrations_kicker'),
      icon: 'location_on',
    },
  ];
  const footerLabels = lang === 'zh-CN'
    ? { terms: '服务条款', privacy: '隐私政策', support: '支持', contact: '联系' }
    : { terms: 'Terms', privacy: 'Privacy', support: 'Support', contact: 'Contact' };

  return (
    <div className="landing-page landing-page--stitch">
      <header className={`landing-stitch-nav ${isScrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-stitch-brand">HERMES</div>

        <div className="landing-stitch-header-actions">
          <Link to="/login" className="landing-stitch-header-btn landing-stitch-header-btn--ghost">
            {t('landing.sign_in')}
          </Link>
          <Link to="/signup" className="landing-stitch-header-btn landing-stitch-header-btn--primary">
            {t('landing.signup_link')}
          </Link>
        </div>
      </header>

      <main className="landing-stitch-main">
        <section className="landing-stitch-hero">
          <div className="landing-stitch-hero-media" aria-hidden="true" />
          <div className="landing-stitch-hero-overlay" aria-hidden="true" />

          <RevealSection className="landing-stitch-hero-inner">
            <div className="landing-stitch-hero-copy">
              <span className="landing-stitch-kicker">{t('landing.badge')}</span>

              <h1 className="landing-stitch-hero-title">
                {heroTitle.map((line, index) => (
                  <span key={line} className={index === heroTitle.length - 1 ? 'is-accent' : ''}>
                    {line}
                  </span>
                ))}
              </h1>

              <p className="landing-stitch-hero-text">{t('landing.hero_text')}</p>

              <div className="landing-stitch-hero-actions">
                <button type="button" className="landing-stitch-btn landing-stitch-btn--primary" onClick={startStrava}>
                  <span>{t('landing.cta_strava')}</span>
                  <AppIcon name="trending_flat" className="runner-dashboard-side-link-icon" />
                </button>
                <Link to="/signup" className="landing-stitch-btn landing-stitch-btn--secondary">
                  {t('landing.get_started')}
                </Link>
              </div>
            </div>

            <div className="landing-stitch-hero-metrics">
              <div>
                <span>{t('landing.stat_zones')}</span>
                <strong>94.2%</strong>
              </div>
              <div>
                <span>{t('landing.stat_vdot')}</span>
                <strong>68.4</strong>
              </div>
            </div>
          </RevealSection>
        </section>

        <section id="story" className="landing-stitch-story">
          <RevealSection className="landing-stitch-story-grid">
            <div className="landing-stitch-story-media">
              <div className="landing-stitch-story-photo landing-stitch-story-photo--shoe" />
              <div className="landing-stitch-story-photo landing-stitch-story-photo--runner" />
            </div>

            <div className="landing-stitch-story-copy">
              <span className="landing-stitch-kicker">{t('landing.features_kicker')}</span>
              <h2 className="landing-stitch-section-title">{t('landing.features_title')}</h2>
              <p className="landing-stitch-section-copy">{t('landing.features_copy')}</p>

              <div className="landing-stitch-story-points">
                {storyPoints.map((point) => (
                  <article key={point.title} className="landing-stitch-story-point">
                    <span className="landing-stitch-story-icon" aria-hidden="true">
                      <AppIcon name={point.icon} className="runner-dashboard-side-link-icon" />
                    </span>
                    <div>
                      <h3>{point.title}</h3>
                      <p>{point.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </RevealSection>
        </section>

        <section id="analytics" className="landing-stitch-analytics">
          <RevealSection className="landing-stitch-section-heading">
            <h2 className="landing-stitch-section-title landing-stitch-section-title--center">
              {t('landing.integrations_title')}
            </h2>
            <p className="landing-stitch-section-copy landing-stitch-section-copy--center">
              {t('landing.integrations_copy')}
            </p>
          </RevealSection>

          <div className="landing-stitch-analytics-grid">
            <RevealSection className="landing-stitch-analytics-card landing-stitch-analytics-card--chart" delay={40}>
              <div className="landing-stitch-card-top">
                <span>{analyticsCards[0].kicker}</span>
              </div>
              <div>
                <h3>{analyticsCards[0].title}</h3>
                <p>{analyticsCards[0].copy}</p>
              </div>
              <div className="landing-stitch-bars" aria-hidden="true">
                <span style={{ height: '26%' }} />
                <span style={{ height: '34%' }} />
                <span style={{ height: '58%' }} className="is-accent" />
                <span style={{ height: '40%' }} />
                <span style={{ height: '22%' }} />
                <span style={{ height: '36%' }} />
                <span style={{ height: '56%' }} className="is-accent" />
                <span style={{ height: '32%' }} />
              </div>
            </RevealSection>

            <RevealSection className="landing-stitch-analytics-card landing-stitch-analytics-card--signal" delay={90}>
              <AppIcon name={analyticsCards[1].icon} className="runner-dashboard-side-link-icon" />
              <strong>{analyticsCards[1].value}</strong>
              <p>{analyticsCards[1].label}</p>
            </RevealSection>

            <RevealSection className="landing-stitch-analytics-card landing-stitch-analytics-card--gps" delay={130}>
              <AppIcon name={analyticsCards[2].icon} className="runner-dashboard-side-link-icon" />
              <strong>{analyticsCards[2].value}</strong>
              <p>{analyticsCards[2].label}</p>
            </RevealSection>

            <RevealSection className="landing-stitch-analytics-callout" delay={170}>
              <div>
                <h3>{t('landing.cta_title')}</h3>
                <p>{t('landing.cta_copy')}</p>
              </div>
              <Link to="/login" className="landing-stitch-pill">
                {t('landing.sign_in')}
              </Link>
            </RevealSection>
          </div>
        </section>

        <section id="cta" className="landing-stitch-redline">
          <div className="landing-stitch-redline-media" aria-hidden="true" />
          <div className="landing-stitch-redline-overlay" aria-hidden="true" />

          <RevealSection className="landing-stitch-redline-inner">
            <h2 className="landing-stitch-redline-title">
              {redlineTitle.map((line, index) => (
                <span key={line} className={index === redlineTitle.length - 1 ? 'is-accent' : ''}>
                  {line}
                </span>
              ))}
            </h2>

            <p>{t('landing.cta_copy')}</p>

            <div className="landing-stitch-redline-actions">
              <button type="button" className="landing-stitch-btn landing-stitch-btn--primary" onClick={startStrava}>
                {t('landing.cta_strava')}
              </button>
              <Link to="/signup" className="landing-stitch-btn landing-stitch-btn--outline">
                {t('landing.get_started')}
              </Link>
            </div>
          </RevealSection>
        </section>
      </main>

      <footer className="landing-stitch-footer">
        <div className="landing-stitch-footer-links">
          <a href="/terms">{footerLabels.terms}</a>
          <a href="/privacy">{footerLabels.privacy}</a>
          <a href="#">{footerLabels.support}</a>
          <a href="#">{footerLabels.contact}</a>
        </div>
        <p>{t('landing.footer')}</p>
      </footer>
    </div>
  );
}

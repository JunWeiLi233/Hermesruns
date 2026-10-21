import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContextState';
import HermesMarkSvg from '../../components/HermesMarkSvg';
import HermesWordmarkSvg from '../../components/HermesWordmarkSvg';
import { SUPPORT_MAILTO } from '../../utils/supportContact';
import { METHODS_DOC_URL } from '../../utils/methodsDoc';
import LandingMethods from './LandingMethods';
import { GOAL_IMAGE_PROPS, FEATURE_IMAGE_PROPS, CTA_IMAGE_PROPS, CTA_MOBILE_SRCSET } from './landingResponsiveImages';
import '../../styles/landing-v3.css';
import {
  DEFAULT_GOAL_ID, FAQS, FEATURES, GOALS, NAV_LINKS, PHOTOS, PLANS, PROMISES, SYNC_SOURCES,
} from './landingV3Content';

function Logo({ onDark = false }) {
  return (
    <span className={`lv3-logo${onDark ? ' lv3-logo--dark' : ''}`}>
      <HermesMarkSvg className="lv3-logo-mark" />
      <HermesWordmarkSvg className="lv3-logo-word" />
    </span>
  );
}

function PhoneMockup() {
  return (
    <div className="lv3-phone" aria-hidden="true">
      <span className="lv3-phone-btn lv3-phone-btn--action" />
      <span className="lv3-phone-btn lv3-phone-btn--vol-up" />
      <span className="lv3-phone-btn lv3-phone-btn--vol-down" />
      <span className="lv3-phone-btn lv3-phone-btn--power" />
      <div className="lv3-phone-bezel">
        <div className="lv3-phone-screen">
          <div className="lv3-phone-island" />
          <div className="lv3-phone-status">
            <span>9:41</span>
            <span className="lv3-phone-status-icons">
              <span className="lv3-signal"><i /><i /><i /><i /></span>
              <span className="lv3-wifi" />
              <span className="lv3-battery"><i /></span>
            </span>
          </div>
          <img className="lv3-phone-shot" src={PHOTOS.phone} width="390" height="772" alt="" loading="lazy" decoding="async" />
          <span className="lv3-phone-home" />
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, featured = false }) {
  const { t } = useI18n();
  const status = plan.statusKey ? t(plan.statusKey) : '';
  return (
    <div className={`lv3-plan${featured ? ' lv3-plan--featured' : ''}`}>
      <div className="lv3-plan-head">
        <h3>{t(plan.nameKey)}</h3>
        {plan.badgeKey && <span className="lv3-plan-badge">{t(plan.badgeKey)}</span>}
      </div>
      <div className="lv3-plan-price"><strong>{t(plan.priceKey)}</strong><span>{t(plan.unitKey)}</span></div>
      <ul className="lv3-plan-list">{plan.itemKeys.map((key) => <li key={key}>{t(key)}</li>)}</ul>
      <Link to="/signup" reloadDocument className={`lv3-btn ${featured ? 'lv3-btn--primary' : 'lv3-btn--outline'} lv3-plan-cta`}>{t(plan.ctaKey)}</Link>
      {status ? <p className="lv3-plan-note">{status}</p> : null}
    </div>
  );
}

export default function Landing({ initialYear }) {
  const { isAuthenticated, isAdmin, authHydrated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [goalId, setGoalId] = useState(DEFAULT_GOAL_ID);
  const [year, setYear] = useState(() => initialYear ?? new Date().getFullYear());
  const goalsRef = useRef(null);
  const goal = GOALS.find((item) => item.id === goalId) || GOALS[0];

  useEffect(() => { setYear(new Date().getFullYear()); }, []);

  useEffect(() => {
    if (!isAuthenticated || !authHydrated) return;
    navigate(isAdmin ? '/dashboard' : '/profile');
  }, [isAuthenticated, authHydrated, isAdmin, navigate]);

  useEffect(() => {
    // On a phone the goals are a swipe row: open it on the preselected goal instead of the first card.
    const row = goalsRef.current;
    const active = row?.querySelector('.is-active');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
  }, []);

  const footerLinks = [
    { label: t('landing.home_footer_methods'), href: METHODS_DOC_URL },
    { label: t('landing.home_footer_privacy'), to: '/privacy' },
    { label: t('landing.home_footer_terms'), to: '/terms' },
    { label: t('landing.home_footer_support'), href: SUPPORT_MAILTO },
  ];

  return (
    <div className="landing-v3" data-hermes-landing="true" data-render-year={year}>
      <a className="lv3-skip" href="#landing-main">{t('landing.home_skip')}</a>

      <header className="lv3-nav">
        <div className="lv3-nav-inner lv3-width">
          <Link to="/" aria-label={t('landing.home_brand_home')}><Logo onDark /></Link>
          <nav className="lv3-nav-links" aria-label={t('landing.home_nav_label')}>
            {NAV_LINKS.map((link) => <a key={link.href} href={link.href}>{t(link.labelKey)}</a>)}
          </nav>
          <div className="lv3-nav-actions">
            <Link to="/login" reloadDocument className="lv3-btn lv3-btn--ghost-dark">{t('landing.home_nav_signin')}</Link>
            <Link to="/signup" reloadDocument className="lv3-btn lv3-btn--light">{t('landing.home_nav_start')}</Link>
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="lv3-hero" aria-labelledby="lv3-hero-title">
          <img className="lv3-cover" src={PHOTOS.hero} alt="" fetchPriority="high" decoding="async" />
          <div className="lv3-hero-scrim" />
          <div className="lv3-hero-body lv3-width">
            <h1 id="lv3-hero-title">{t('landing.home_hero_title')}</h1>
            <p>{t('landing.home_hero_copy')}</p>
            <div className="lv3-row">
              <Link to="/signup" reloadDocument className="lv3-btn lv3-btn--primary lv3-btn--xl">{t('landing.home_hero_cta')}</Link>
              <a href="#coaching" className="lv3-btn lv3-btn--outline-dark lv3-btn--xl">{t('landing.home_hero_alt')}</a>
            </div>
            <span className="lv3-hero-proof">{t('landing.home_hero_proof')}</span>
          </div>
        </section>

        <div className="lv3-sync lv3-width">
          <span className="lv3-sync-label">{t('landing.home_sync_label')}</span>
          {SYNC_SOURCES.map((source) => <b key={source}>{source}</b>)}
          <span className="lv3-sync-note">{t('landing.home_sync_note')}</span>
        </div>

        <section id="plans" className="lv3-section lv3-width" aria-labelledby="lv3-goals-title">
          <div className="lv3-head lv3-head--center">
            <h2 id="lv3-goals-title">{t('landing.home_goals_title')}</h2>
            <p>{t('landing.home_goals_copy')}</p>
          </div>
          <div ref={goalsRef} className="lv3-goals" role="group" aria-label={t('landing.home_goals_group')}>
            {GOALS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`lv3-goal${item.id === goal.id ? ' is-active' : ''}`}
                onClick={() => setGoalId(item.id)}
                aria-pressed={item.id === goal.id}
              >
                <img className="lv3-cover" src={item.photo} {...GOAL_IMAGE_PROPS[item.id]} alt="" loading="lazy" decoding="async" />
                <span className="lv3-goal-label"><strong>{t(item.labelKey)}</strong><span>{t(item.subKey)}</span></span>
              </button>
            ))}
          </div>
          <div className="lv3-goal-summary">
            <div aria-live="polite">
              <strong>{t(goal.titleKey)}</strong>
              <span>{t('landing.home_goal_line')}</span>
            </div>
            <Link to="/signup" reloadDocument className="lv3-btn lv3-btn--dark">{t('landing.home_goal_cta')}</Link>
          </div>
        </section>

        <section id="coaching" className="lv3-band lv3-band--white" aria-labelledby="lv3-coaching-title">
          <h2 id="lv3-coaching-title" className="lv3-sr-only">{t('landing.home_nav_coaching')}</h2>
          <div className="lv3-width lv3-features">
            {FEATURES.map((feature) => (
              <div key={feature.id} className={`lv3-feature${feature.reverse ? ' lv3-feature--reverse' : ''}`}>
                <div className="lv3-feature-copy">
                  <span className="lv3-eyebrow">{t(feature.eyebrowKey)}</span>
                  <h3>{t(feature.titleKey)}</h3>
                  <p>{t(feature.copyKey)}</p>
                </div>
                <div className="lv3-feature-media">
                  <div className="lv3-feature-photo"><img className="lv3-cover" src={feature.photo} {...FEATURE_IMAGE_PROPS[feature.id]} alt="" loading="lazy" decoding="async" /></div>
                  <div className="lv3-feature-card">
                    <span className="lv3-feature-card-top">
                      <span>{t(feature.card.labelKey)}</span>
                      <span className="lv3-feature-card-tag">{t('landing.home_feat_example')}</span>
                    </span>
                    <strong>{t(feature.card.valueKey)}</strong>
                    <em className={`is-${feature.tone}`}>{t(feature.card.noteKey)}</em>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lv3-band lv3-band--ink" aria-labelledby="lv3-app-title">
          <div className="lv3-width lv3-app">
            <div className="lv3-app-copy">
              <span className="lv3-eyebrow lv3-eyebrow--coral">{t('landing.home_app_eyebrow')}</span>
              <h2 id="lv3-app-title">{t('landing.home_app_title')}</h2>
              <p>{t('landing.home_app_copy')}</p>
            </div>
            <div className="lv3-app-device">
              <PhoneMockup />
              <p className="lv3-app-caption">{t('landing.home_app_caption')}</p>
            </div>
          </div>
        </section>

        <section id="promises" className="lv3-section lv3-width" aria-labelledby="lv3-promises-title">
          <h2 id="lv3-promises-title" className="lv3-title-center">{t('landing.home_promises_title')}</h2>
          <div className="lv3-promises">
            {PROMISES.map((promise) => (
              <article key={promise.id} className="lv3-promise">
                <div className="lv3-promise-photo"><img className="lv3-cover" src={promise.photo} alt="" loading="lazy" decoding="async" /></div>
                <div className="lv3-promise-copy">
                  <h3>{t(promise.titleKey)}</h3>
                  <p>{t(promise.copyKey)}</p>
                  {promise.id === 'formula' && <a className="lv3-methods-link" href={METHODS_DOC_URL}>{t('landing.home_promise_formula_link')}</a>}
                  {promise.id === 'data' && <Link className="lv3-methods-link" to="/privacy">{t('landing.home_promise_data_link')}</Link>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <LandingMethods />

        <section id="pricing" className="lv3-band lv3-band--white" aria-labelledby="lv3-pricing-title">
          <div className="lv3-width lv3-pricing">
            <div className="lv3-head lv3-head--center">
              <h2 id="lv3-pricing-title">{t('landing.home_pricing_title')}</h2>
              <p>{t('landing.home_pricing_copy')}</p>
            </div>
            <div className="lv3-plans">
              <PlanCard plan={PLANS.free} />
              <PlanCard plan={PLANS.supporter} featured />
            </div>
          </div>
        </section>

        <section id="questions" className="lv3-section lv3-faq" aria-labelledby="lv3-faq-title">
          <h2 id="lv3-faq-title" className="lv3-title-center">{t('landing.home_faq_title')}</h2>
          <div className="lv3-faq-list">
            {FAQS.map((faq, index) => (
              <details key={faq.id} id={`faq-${faq.id}`} className="lv3-faq-item" name="lv3-faq" open={index === 0 ? true : undefined}>
                <summary className="lv3-faq-q"><span>{t(faq.questionKey)}</span><span className="lv3-faq-icon" aria-hidden="true" /></summary>
                <p className="lv3-faq-a">{t(faq.answerKey)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lv3-cta" aria-labelledby="lv3-cta-title">
          <picture>
            <source media="(max-width: 760px)" srcSet={CTA_MOBILE_SRCSET} sizes="100vw" width="768" height="1075" />
            <img className="lv3-cover" src={PHOTOS.cta} {...CTA_IMAGE_PROPS} alt="" loading="lazy" decoding="async" />
          </picture>
          <div className="lv3-cta-scrim" />
          <div className="lv3-cta-body lv3-width">
            <h2 id="lv3-cta-title">{t('landing.home_cta_title')}</h2>
            <Link to="/signup" reloadDocument className="lv3-btn lv3-btn--primary lv3-btn--xl">{t('landing.home_hero_cta')}</Link>
          </div>
        </section>
      </main>

      <footer className="lv3-footer lv3-width">
        <Logo />
        <nav aria-label={t('landing.home_footer_label')}>
          <a href="#plans">{t('landing.home_nav_plans')}</a>
          <a href="#pricing">{t('landing.home_nav_pricing')}</a>
          {footerLinks.map((link) => (
            link.to
              ? <Link key={link.label} to={link.to}>{link.label}</Link>
              : <a key={link.label} href={link.href}>{link.label}</a>
          ))}
          <span>{t('landing.home_footer_copy', { year })}</span>
        </nav>
      </footer>
    </div>
  );
}

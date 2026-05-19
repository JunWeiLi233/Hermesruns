import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl } from '../api';
import { useScrollReveal } from '../hooks/useScrollReveal';
import HermesMarkSvg from '../components/HermesMarkSvg';

function RevealSection({ children, className = '', delay = 0, initialVisible = false }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.16, rootMargin: '0px', initialVisible });
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

function PageWidth({ children, className = '' }) {
  return <div className={`landing-cinematic-width ${className}`}>{children}</div>;
}

function StravaLogo({ className = '' }) {
  const classNames = ['landing-strava-logo', className].filter(Boolean).join(' ');

  return (
    <svg
      className={classNames}
      viewBox="0 0 168 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="168" height="48" rx="10" fill="#fc4c02" />
      <text
        x="84"
        y="31"
        fill="#ffffff"
        textAnchor="middle"
        fontFamily="'Arial Black', 'Arial Narrow', Arial, sans-serif"
        fontSize="25"
        fontWeight="900"
        letterSpacing="-2.4"
      >
        STRAVA
      </text>
    </svg>
  );
}

function LandingGlyph({ name, className = '' }) {
  const classNames = ['landing-cinematic-glyph', className].filter(Boolean).join(' ');

  if (name === 'logo') {
    return <HermesMarkSvg tone="light" className={`${classNames} landing-cinematic-glyph--logo`} />;
  }

  return (
    <svg className={classNames} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === 'runner' && (
        <>
          <circle cx="13.5" cy="4.7" r="2.1" />
          <path d="M10.7 8.5l3.5 2.2 2.8-1.2" />
          <path d="M12.9 10.7l-2 4.6 3.9 4.5" />
          <path d="M10.9 15.1l-4.2 1.5" />
          <path d="M14.5 12.2l2.1 3.1 3.2.7" />
        </>
      )}
      {name === 'arrow' && (
        <>
          <path d="M5 12h13" />
          <path d="M13 6l6 6-6 6" />
        </>
      )}
      {name === 'check' && <path d="M5 12.5l4.2 4.2L19 7" />}
      {name === 'minus' && <path d="M6 12h12" />}
      {name === 'close' && (
        <>
          <path d="M7 7l10 10" />
          <path d="M17 7L7 17" />
        </>
      )}
      {name === 'vdot' && (
        <>
          <path d="M4 20l5-12 4 8 6-14" />
          <circle cx="19" cy="4" r="2" />
        </>
      )}
      {name === 'zones' && (
        <>
          <rect x="4" y="16" width="3" height="4" rx="1" />
          <rect x="8.5" y="12" width="3" height="8" rx="1" />
          <rect x="13" y="8" width="3" height="12" rx="1" />
          <rect x="17.5" y="4" width="3" height="16" rx="1" />
        </>
      )}
      {name === 'shoe' && (
        <>
          <path d="M4 18c1.5-4 4-6 6-8l2-1 3 2c1 1 1.5 2 1 3l-1 2" />
          <path d="M8 8l2-2 6 4-2 2" />
        </>
      )}
      {name === 'sync' && (
        <>
          <path d="M4 12a8 8 0 0 1 13.6-5.6" />
          <path d="M20 12a8 8 0 0 1-13.6 5.6" />
          <polyline points="18,4 18,8 14,8" />
          <polyline points="6,20 6,16 10,16" />
        </>
      )}
      {name === 'globe' && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <ellipse cx="12" cy="12" rx="3" ry="8" />
        </>
      )}
      {name === 'chart' && (
        <>
          <rect x="3" y="12" width="4" height="8" rx="1" />
          <rect x="10" y="7" width="4" height="13" rx="1" />
          <rect x="17" y="3" width="4" height="17" rx="1" />
        </>
      )}
    </svg>
  );
}

function ReadinessRing({ value }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;

  return (
    <svg viewBox="0 0 160 160" className="landing-cinematic-ring" aria-hidden="true">
      <circle cx="80" cy="80" r={radius} className="landing-cinematic-ring-track" />
      <circle
        cx="80"
        cy="80"
        r={radius}
        className="landing-cinematic-ring-progress"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={circumference / 4}
      />
    </svg>
  );
}

function VdotSpark() {
  const points = [54.2, 54.6, 54.5, 55.1, 55.4, 55.8, 56, 56.4, 56.8, 57, 56.7, 57.2, 57.6, 58, 58.4];
  const min = 53.5;
  const max = 59;
  const coord = (value, index) => `${(index / (points.length - 1)) * 270 + 5},${75 - ((value - min) / (max - min)) * 65}`;

  return (
    <svg viewBox="0 0 280 80" className="landing-cinematic-vdot-spark" aria-hidden="true">
      <polygon points={`${points.map(coord).join(' ')} 275,80 5,80`} className="landing-cinematic-vdot-fill" />
      <polyline points={points.map(coord).join(' ')} className="landing-cinematic-vdot-line" />
      <circle cx="275" cy={75 - ((58.4 - min) / (max - min)) * 65} r="3.5" className="landing-cinematic-vdot-dot" />
    </svg>
  );
}

function WorldMap({ races }) {
  const continents = [
    [22, 30, 9, 10],
    [27, 47, 5, 8],
    [48, 28, 8, 10],
    [56, 42, 8, 12],
    [70, 30, 14, 11],
    [82, 53, 5, 3],
  ];
  const dots = [];
  const inContinent = (x, y) => continents.some(([cx, cy, rx, ry]) => ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1);

  for (let y = 4; y < 58; y += 1.6) {
    for (let x = 2; x < 98; x += 1.6) {
      if (inContinent(x, y)) dots.push([x, y]);
    }
  }

  return (
    <div className="landing-cinematic-map" aria-hidden="true">
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
        {dots.map(([x, y], index) => (
          <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r="0.45" className="landing-cinematic-map-dot" />
        ))}
        {races.map((race) => (
          <g key={race.name} transform={`translate(${race.pin.x} ${race.pin.y})`} className="landing-cinematic-map-pin">
            <circle r="2.6" className="landing-cinematic-map-pulse" />
            <circle r="0.9" className="landing-cinematic-map-core" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function AnswerCard({ number, title, body, children }) {
  return (
    <article className="landing-cinematic-answer-card">
      <div className="landing-cinematic-answer-head">
        <span>{number}</span>
        <h3>{title}</h3>
      </div>
      <p>{body}</p>
      <div className="landing-cinematic-answer-figure">{children}</div>
    </article>
  );
}

function CompareGlyph({ value }) {
  if (value === true) return <LandingGlyph name="check" className="landing-cinematic-compare-icon is-yes" />;
  if (value === 'partial') return <LandingGlyph name="minus" className="landing-cinematic-compare-icon is-partial" />;
  return <LandingGlyph name="close" className="landing-cinematic-compare-icon is-no" />;
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
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const startStrava = useCallback(() => {
    window.location.href = `${getBackendBaseUrl()}/api/auth/strava/start?state=login`;
  }, []);

  const navLinks = [
    ['#features', t('landing.cinematic_nav_daily')],
    ['#answers', t('landing.cinematic_nav_method')],
    ['#science', t('landing.cinematic_nav_races')],
    ['#compare', t('landing.cinematic_nav_compare')],
  ];

  const commandCards = [
    {
      number: '01',
      icon: 'zones',
      title: t('landing.cinematic_answer_1_title'),
      body: t('landing.cinematic_answer_1_body'),
      metric: '4:21',
    },
    {
      number: '02',
      icon: 'vdot',
      title: t('landing.cinematic_answer_2_title'),
      body: t('landing.cinematic_answer_2_body'),
      metric: '58.4',
    },
    {
      number: '03',
      icon: 'shoe',
      title: t('landing.cinematic_answer_3_title'),
      body: t('landing.cinematic_answer_3_body'),
      metric: '68%',
    },
  ];

  const heroWorkout = {
    type: t('landing.cinematic_zone_threshold'),
    distance: '8 km',
    count: '8',
    shoe: 'Endorphin Speed 4',
  };

  const formulaValues = {
    vdot: '58.4',
    acwr: '0.82',
    h: '18',
    count: '6',
    date: '2026-05-17',
    distance: heroWorkout.distance,
    pace: '4:21 /km',
  };

  const formulaRows = [
    [t('landing.cinematic_formula_vdot_label'), t('landing.cinematic_formula_vdot', formulaValues)],
    [t('landing.cinematic_formula_acwr_label'), t('landing.cinematic_formula_acwr', formulaValues)],
    [t('landing.cinematic_formula_recovery_label'), t('landing.cinematic_formula_recovery', formulaValues)],
    [t('landing.cinematic_formula_paces_label'), t('landing.cinematic_formula_paces', formulaValues)],
  ];

  const races = [
    { name: t('landing.cinematic_race_berlin'), date: '21 SEP', days: 218, goal: '2:55', pin: { x: 52, y: 36 } },
    { name: t('landing.cinematic_race_chicago'), date: '12 OCT', days: 239, goal: 'Sub-3', pin: { x: 24, y: 41 } },
    { name: t('landing.cinematic_race_tokyo'), date: '01 MAR', days: 380, goal: 'PB', pin: { x: 86, y: 44 } },
    { name: t('landing.cinematic_race_boston'), date: '20 APR', days: 430, goal: 'Q+8', pin: { x: 31, y: 38 } },
    { name: t('landing.cinematic_race_comrades'), date: '08 JUN', days: 480, goal: 'Silver', pin: { x: 60, y: 72 } },
  ];

  const compareRows = [
    [t('landing.cinematic_compare_daily'), true, false, 'partial'],
    [t('landing.cinematic_compare_vdot'), true, false, false],
    [t('landing.cinematic_compare_acwr'), true, false, 'partial'],
    [t('landing.cinematic_compare_shoes'), true, false, false],
    [t('landing.cinematic_compare_local'), true, false, false],
    [t('landing.cinematic_compare_noise'), true, false, true],
    [t('landing.cinematic_compare_bilingual'), true, false, false],
  ];

  const zones = [
    [t('landing.cinematic_zone_recovery'), '<59%', t('landing.cinematic_zone_recovery_desc'), '6:18 /km'],
    [t('landing.cinematic_zone_easy'), '59-75%', t('landing.cinematic_zone_easy_desc'), '5:42 /km'],
    [t('landing.cinematic_zone_marathon'), '75-83%', t('landing.cinematic_zone_marathon_desc'), '4:36 /km'],
    [t('landing.cinematic_zone_threshold'), '83-92%', t('landing.cinematic_zone_threshold_desc'), '4:21 /km'],
    [t('landing.cinematic_zone_interval'), '92-105%', t('landing.cinematic_zone_interval_desc'), '3:52 /km'],
    [t('landing.cinematic_zone_repetition'), '>105%', t('landing.cinematic_zone_repetition_desc'), '3:30 /km'],
  ];

  const footerColumns = [
    [t('landing.cinematic_footer_product'), ['Today Run', 'Analysis', 'Heatmap', 'Shoes', 'Races']],
    [t('landing.cinematic_footer_method'), ['VDOT', 'ACWR', t('landing.cinematic_footer_training_paces'), t('landing.cinematic_footer_citations')]],
    [t('landing.cinematic_footer_connect'), ['Strava', 'Garmin Connect', 'COROS', 'FIT / GPX / TCX']],
  ];
  const footerUtilityLinks = [
    { label: t('landing.stitch_footer_terms'), to: '/terms' },
    { label: t('landing.stitch_footer_privacy'), to: '/privacy' },
    { label: t('landing.stitch_footer_support'), href: 'mailto:support@hermes.run' },
  ];

  return (
    <div className="landing-page--cinematic">
      {/* ── Navigation ── */}
      <header className={`landing-cinematic-nav ${isScrolled ? 'is-scrolled' : ''}`}>
        <PageWidth className="landing-cinematic-nav-inner">
          <Link to="/" className="landing-cinematic-brand">
            <span className="landing-cinematic-brand-glyph" aria-hidden="true">
              <LandingGlyph name="logo" />
            </span>
            <span>HERMES</span>
          </Link>

          <nav className="landing-cinematic-links" aria-label={t('landing.cinematic_nav_label')}>
            {navLinks.map(([href, label]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </nav>

          <div className="landing-cinematic-nav-actions">
            <Link to="/login" className="landing-cinematic-btn landing-cinematic-btn--ghost">{t('landing.sign_in')}</Link>
            <Link to="/signup" className="landing-cinematic-btn landing-cinematic-btn--primary">
              <span>{t('landing.signup_link')}</span>
              <LandingGlyph name="arrow" />
            </Link>
          </div>
        </PageWidth>
      </header>

      <main>
        {/* ── 1. Hero ── */}
        <section className="landing-cinematic-hero">
          <div className="landing-cinematic-hero-plate" aria-hidden="true">
            <div className="landing-cinematic-hero-photo" />
            <div className="landing-cinematic-hero-scrim" />
          </div>

          <PageWidth className="landing-cinematic-hero-inner">
            <RevealSection className="landing-cinematic-hero-grid landing-command-hero" initialVisible>
              <div className="landing-cinematic-hero-copy landing-command-copy">
                <span className="landing-cinematic-kicker landing-command-kicker">{t('landing.badge')}</span>
                <h1 className="landing-cinematic-hero-title">
                  <span>{t('landing.cinematic_hero_line_1')}</span>
                  <span>{t('landing.cinematic_hero_line_2')}</span>
                  <span className="is-accent">{t('landing.cinematic_hero_line_3')}</span>
                </h1>
                <p>{t('landing.cinematic_hero_text')}</p>

                <div className="landing-cinematic-hero-actions">
                  <button type="button" className="landing-cinematic-btn landing-cinematic-btn--primary landing-cinematic-btn--strava is-large" onClick={startStrava}>
                    <StravaLogo />
                    <span>{t('landing.cta_strava')}</span>
                  </button>
                  <Link to="/signup" className="landing-cinematic-btn landing-cinematic-btn--ghost is-large">
                    <span>{t('landing.get_started')}</span>
                    <LandingGlyph name="arrow" />
                  </Link>
                </div>

                <div className="landing-cinematic-trust">
                  <span>{t('landing.cinematic_trust_local')}</span>
                  <span>{t('landing.cinematic_trust_method')}</span>
                </div>
              </div>
            </RevealSection>
          </PageWidth>
        </section>

        {/* ── 2. Feature Grid ── */}
        <section id="features" className="landing-command-deck">
          <PageWidth className="landing-command-deck-grid">
            <RevealSection className="landing-command-card-stack">
              {commandCards.map((card) => (
                <article key={card.number} className="landing-command-card">
                  <div className="landing-command-card-index">
                    <span>{card.number}</span>
                    <LandingGlyph name={card.icon} />
                  </div>
                  <small>{t('landing.cinematic_ticker_label')}</small>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <strong>{card.metric}</strong>
                </article>
              ))}
            </RevealSection>

            <RevealSection className="landing-command-rhythm" delay={90}>
              <span className="landing-cinematic-kicker">{t('landing.cinematic_formula_kicker')}</span>
              <h2>{t('landing.cinematic_formula_title')}</h2>
              <p>{t('landing.cinematic_formula_copy')}</p>
              <div className="landing-command-rhythm-list">
                {formulaRows.map(([label, copy], index) => (
                  <div key={label} style={{ '--rhythm-index': index }}>
                    <span>{label}</span>
                    <p>{copy}</p>
                  </div>
                ))}
              </div>
            </RevealSection>
          </PageWidth>
        </section>

        {/* ── 3. Coach Voice ── */}
        <section className="landing-cinematic-coach">
          <PageWidth>
            <RevealSection className="landing-cinematic-coach-grid">
              <div className="landing-cinematic-quote-mark" aria-hidden="true">"</div>
              <blockquote>
                <p>{t('landing.cinematic_coach_quote')}</p>
                <p className="is-muted">{t('landing.cinematic_coach_muted')}</p>
              </blockquote>
              <div className="landing-cinematic-coach-meta">
                <span>{t('landing.cinematic_coach_kicker')}</span>
                <strong>{t('landing.cinematic_coach_meta')}</strong>
              </div>
            </RevealSection>
          </PageWidth>
        </section>

        {/* ── 4. Three Daily Answers ── */}
        <section id="answers" className="landing-cinematic-answers">
          <PageWidth>
            <RevealSection className="landing-cinematic-section-head">
              <span className="landing-cinematic-kicker">{t('landing.cinematic_answers_kicker')}</span>
              <h2>{t('landing.cinematic_answers_title')} <span>{t('landing.cinematic_answers_title_muted')}</span></h2>
            </RevealSection>

            <div className="landing-cinematic-answer-grid">
              <RevealSection delay={40}>
                <AnswerCard number="01" title={t('landing.cinematic_answer_1_title')} body={t('landing.cinematic_answer_1_body')}>
                  <div className="landing-cinematic-mini-paces">
                    {[t('landing.cinematic_zone_recovery'), t('landing.cinematic_zone_easy'), t('landing.cinematic_zone_marathon'), t('landing.cinematic_zone_threshold'), t('landing.cinematic_zone_interval'), t('landing.cinematic_zone_repetition')].map((label, index) => (
                      <div key={label} className={index === 3 ? 'is-active' : ''}>
                        <span>{label}</span>
                        <strong>{['6:18', '5:42', '4:36', '4:21', '3:52', '3:30'][index]}</strong>
                      </div>
                    ))}
                  </div>
                </AnswerCard>
              </RevealSection>

              <RevealSection delay={90}>
                <AnswerCard number="02" title={t('landing.cinematic_answer_2_title')} body={t('landing.cinematic_answer_2_body')}>
                  <VdotSpark />
                  <div className="landing-cinematic-vdot-row">
                    <strong>58.4</strong>
                    <span>+1.2 / 30d</span>
                  </div>
                </AnswerCard>
              </RevealSection>

              <RevealSection delay={140}>
                <AnswerCard number="03" title={t('landing.cinematic_answer_3_title')} body={t('landing.cinematic_answer_3_body')}>
                  {[
                    ['Endorphin Speed 4', '68%', t('landing.cinematic_shoe_today')],
                    ['Cloudmonster', '42%', t('landing.cinematic_shoe_easy')],
                    ['Vaporfly 3', '91%', t('landing.cinematic_shoe_race')],
                    ['Pegasus 41', '18%', t('landing.cinematic_shoe_recovery')],
                  ].map(([name, width, tag]) => (
                    <div key={name} className="landing-cinematic-shoe-row">
                      <div><span>{name}</span><em>{tag}</em></div>
                      <i><span style={{ width }} /></i>
                    </div>
                  ))}
                </AnswerCard>
              </RevealSection>
            </div>
          </PageWidth>
        </section>

        {/* ── 5. Science: VDOT + Formula ── */}
        <section id="science" className="landing-cinematic-formula">
          <PageWidth className="landing-cinematic-formula-grid">
            <RevealSection className="landing-cinematic-formula-copy">
              <span className="landing-cinematic-kicker">{t('landing.cinematic_formula_kicker')}</span>
              <h2>{t('landing.cinematic_formula_title')}</h2>
              <p>{t('landing.cinematic_formula_copy')}</p>
              <div className="landing-cinematic-formula-list">
                {formulaRows.map(([label, copy]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <p>{copy}</p>
                  </div>
                ))}
              </div>
            </RevealSection>

            <RevealSection className="landing-cinematic-paper" delay={80}>
              <div className="landing-cinematic-paper-head">
                <span>{t('landing.cinematic_formula_paper_kicker')}</span>
                <span>{t('landing.cinematic_formula_paper_source')}</span>
              </div>
              <div className="landing-cinematic-equations">
                <span>v = distance / time</span>
                <span>VO2 = -4.60 + 0.182258v + 0.000104v2</span>
                <span>%VO2max = 0.8 + 0.1894e-0.0128t + 0.2989e-0.1933t</span>
                <strong>VDOT = VO2 / %VO2max</strong>
              </div>
              <div className="landing-cinematic-paper-foot">
                <div>
                  <span>{t('landing.cinematic_formula_last_input')}</span>
                  <strong>{t('landing.cinematic_formula_last_input_value', formulaValues)}</strong>
                </div>
                <div>
                  <span>{t('landing.cinematic_formula_result')}</span>
                  <strong>VDOT 58.4</strong>
                </div>
              </div>
            </RevealSection>
          </PageWidth>
        </section>

        {/* ── 6. Training Zones ── */}
        <section className="landing-cinematic-zones">
          <PageWidth>
            <RevealSection className="landing-cinematic-section-head">
              <span className="landing-cinematic-kicker">{t('landing.cinematic_zones_kicker')}</span>
              <h2>{t('landing.cinematic_zones_title')}</h2>
            </RevealSection>

            <div className="landing-cinematic-zone-grid">
              {zones.map(([name, percent, desc, pace], index) => (
                <RevealSection key={name} className={`landing-cinematic-zone ${index === 3 ? 'is-active' : ''}`} delay={index * 35}>
                  <div>
                    <h3>{name}</h3>
                    <span>{percent} VO2</span>
                  </div>
                  <p>{desc}</p>
                  <i><span style={{ width: `${22 + index * 12}%` }} /></i>
                  <strong>{pace}</strong>
                </RevealSection>
              ))}
            </div>
          </PageWidth>
        </section>

        {/* ── 7. Races ── */}
        <section id="races" className="landing-cinematic-races">
          <PageWidth>
            <RevealSection className="landing-cinematic-section-head is-split">
              <div>
                <span className="landing-cinematic-kicker">{t('landing.cinematic_races_kicker')}</span>
                <h2>{t('landing.cinematic_races_title')}</h2>
              </div>
              <p>{t('landing.cinematic_races_copy')}</p>
            </RevealSection>

            <div className="landing-cinematic-race-stage">
              <WorldMap races={races} />
              <RevealSection className="landing-cinematic-race-list" delay={70}>
                <div className="landing-cinematic-race-head">
                  <span>{t('landing.cinematic_race_col_race')}</span>
                  <span>{t('landing.cinematic_race_col_date')}</span>
                  <span>{t('landing.cinematic_race_col_days')}</span>
                  <span>{t('landing.cinematic_race_col_goal')}</span>
                </div>
                {races.map((race, index) => (
                  <div key={race.name} className="landing-cinematic-race-row">
                    <span>{race.name}</span>
                    <span>{race.date}</span>
                    <strong>{race.days}</strong>
                    <em className={index === 0 ? 'is-primary' : ''}>{race.goal}</em>
                  </div>
                ))}
              </RevealSection>
            </div>
          </PageWidth>
        </section>

        {/* ── 8. Comparison ── */}
        <section id="compare" className="landing-cinematic-compare">
          <PageWidth>
            <RevealSection className="landing-cinematic-section-head">
              <span className="landing-cinematic-kicker">{t('landing.cinematic_compare_kicker')}</span>
              <h2>{t('landing.cinematic_compare_title')}</h2>
            </RevealSection>

            <RevealSection className="landing-cinematic-compare-table">
              <div className="landing-cinematic-compare-row is-head">
                <span />
                <strong>Hermes</strong>
                <span>{t('landing.cinematic_compare_social')}</span>
                <span>{t('landing.cinematic_compare_device')}</span>
              </div>
              {compareRows.map(([feature, hermes, social, device]) => (
                <div key={feature} className="landing-cinematic-compare-row">
                  <span>{feature}</span>
                  <CompareGlyph value={hermes} />
                  <CompareGlyph value={social} />
                  <CompareGlyph value={device} />
                </div>
              ))}
            </RevealSection>
          </PageWidth>
        </section>

        {/* ── 9. Final CTA ── */}
        <section className="landing-cinematic-final">
          <PageWidth>
            <RevealSection className="landing-cinematic-final-card">
              <div className="landing-cinematic-final-bg" aria-hidden="true" />
              <div className="landing-cinematic-final-copy">
                <span className="landing-cinematic-kicker">{t('landing.cinematic_final_kicker')}</span>
                <h2>{t('landing.cinematic_cta_title')}</h2>
                <p>{t('landing.cinematic_cta_copy')}</p>
                <div className="landing-cinematic-hero-actions">
                  <button type="button" className="landing-cinematic-btn landing-cinematic-btn--primary landing-cinematic-btn--strava is-large" onClick={startStrava}>
                    <StravaLogo />
                    <span>{t('landing.cta_strava')}</span>
                  </button>
                  <Link to="/signup" className="landing-cinematic-btn landing-cinematic-btn--outline is-large">
                    {t('landing.get_started')}
                  </Link>
                </div>
                <div className="landing-cinematic-final-trust">
                  <span>{t('landing.cinematic_final_no_card')}</span>
                  <span>{t('landing.cinematic_final_no_feed')}</span>
                  <span>{t('landing.cinematic_final_method')}</span>
                </div>
              </div>
            </RevealSection>
          </PageWidth>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="landing-cinematic-footer">
        <PageWidth className="landing-cinematic-footer-inner">
          <div className="landing-cinematic-footer-brand">
            <strong>HERMES</strong>
            <span>{t('landing.footer')}</span>
          </div>
          <div className="landing-cinematic-footer-cols">
            {footerColumns.map(([title, links]) => (
              <div key={title}>
                <span>{title}</span>
                {links.map((label) => <span key={label} className="landing-cinematic-footer-link">{label}</span>)}
              </div>
            ))}
            <div>
              <span>{t('landing.cinematic_footer_company')}</span>
              <div className="landing-cinematic-footer-links">
                {footerUtilityLinks.map((link) => (
                  link.to ? (
                    <Link key={link.label} to={link.to} className="landing-cinematic-footer-link">{link.label}</Link>
                  ) : (
                    <a key={link.label} href={link.href} className="landing-cinematic-footer-link">{link.label}</a>
                  )
                ))}
              </div>
            </div>
          </div>
          <p>{t('landing.stitch_footer_copy')}</p>
        </PageWidth>
      </footer>
    </div>
  );
}

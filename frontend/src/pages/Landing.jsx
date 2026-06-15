import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getBackendBaseUrl } from '../api';
import { useScrollReveal } from '../hooks/useScrollReveal';
import AppIcon from '../components/AppIcon';
import HermesMarkSvg from '../components/HermesMarkSvg';
import worldMapPoliticalDotted from '../assets/generated/landing-world-map-political-dotted.png';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const landingRaceDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

function parseRaceDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatRaceDate(isoDate) {
  const raceDate = new Date(parseRaceDate(isoDate));
  const parts = landingRaceDateFormatter.formatToParts(raceDate);
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value.toUpperCase() ?? '';
  return `${day} ${month}`;
}

function getRaceCountdownDays(isoDate, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.ceil((parseRaceDate(isoDate) - today) / DAY_IN_MS));
}

function RevealSection({ children, className = '', delay = 0, initialVisible = false, onClick }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.16, rootMargin: '0px', initialVisible });
  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? 'reveal-visible' : 'reveal-hidden'}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      onClick={onClick}
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

  if (name === 'shoe') {
    return <AppIcon name="shoe" className={classNames} />;
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
          <path d="M4 18.5 8.8 12l4.1 3.8L20 5.5" />
          <circle cx="8.8" cy="12" r="1.3" />
          <circle cx="12.9" cy="15.8" r="1.3" />
          <circle cx="20" cy="5.5" r="1.3" />
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

const WORLD_MAP_GRATICULE = [
  'M8 12.5H94',
  'M6 25H96',
  'M10 37.5H92',
  'M25 3V47',
  'M50 2V48',
  'M75 3V47',
];

const ROBINSON_X_COEFFICIENTS = [
  1,
  0.9986,
  0.9954,
  0.99,
  0.9822,
  0.973,
  0.96,
  0.9427,
  0.9216,
  0.8962,
  0.8679,
  0.835,
  0.7986,
  0.7597,
  0.7186,
  0.6732,
  0.6213,
  0.5722,
  0.5322,
];

const ROBINSON_Y_COEFFICIENTS = [
  0,
  0.062,
  0.124,
  0.186,
  0.248,
  0.31,
  0.372,
  0.434,
  0.4958,
  0.5571,
  0.6176,
  0.6769,
  0.7346,
  0.7903,
  0.8435,
  0.8936,
  0.9394,
  0.9761,
  1,
];

function interpolateRobinsonCoefficient(coefficients, absLat) {
  const clampedLat = Math.max(0, Math.min(90, absLat));
  const lowerIndex = Math.min(Math.floor(clampedLat / 5), coefficients.length - 2);
  const localT = (clampedLat - lowerIndex * 5) / 5;

  return coefficients[lowerIndex] + ((coefficients[lowerIndex + 1] - coefficients[lowerIndex]) * localT);
}

function projectWorldPoint({ lat, lng }) {
  const absLat = Math.abs(lat);
  const xCoefficient = interpolateRobinsonCoefficient(ROBINSON_X_COEFFICIENTS, absLat);
  const yCoefficient = interpolateRobinsonCoefficient(ROBINSON_Y_COEFFICIENTS, absLat);
  const robinsonX = 50 + ((lng / 360) * 100 * xCoefficient);
  const robinsonY = 25 - (lat >= 0 ? yCoefficient : -yCoefficient) * 25;

  return {
    x: robinsonX,
    y: robinsonY,
  };
}

const RACE_MAP_CITY_ANCHORS = {
  tokyo: { x: 83.65, y: 13.65 },
  boston: { x: 29.85, y: 11.60 },
  london: { x: 47.35, y: 8.95 },
  berlin: { x: 51.55, y: 8.55 },
  chicago: { x: 27.45, y: 12.15 },
  newYork: { x: 29.60, y: 12.15 },
  paris: { x: 49.45, y: 10.05 },
  valencia: { x: 47.10, y: 12.40 },
  sydney: { x: 85.25, y: 35.55 },
  comrades: { x: 55.50, y: 34.40 },
};

function resolveRaceMapPoint(race) {
  return RACE_MAP_CITY_ANCHORS[race.id] ?? projectWorldPoint(race.geo);
}

const RACE_MAP_CYCLE_STEP_SECONDS = 3;

function getRaceCycleDuration(total) {
  return `${Math.max(total, 1) * RACE_MAP_CYCLE_STEP_SECONDS}s`;
}

function getRaceTimelineDelay(index, total) {
  if (!total) return '0s';

  return `${index * RACE_MAP_CYCLE_STEP_SECONDS}s`;
}

function WorldMap({ races, metricLabels, flowLabels }) {
  const racePins = races.map((race) => ({
    ...race,
    pin: race.pin ?? (race.geo ? resolveRaceMapPoint(race) : null),
  }));
  const getRacePhaseDelay = (index) => getRaceTimelineDelay(index, racePins.length);
  const raceCycleDuration = getRaceCycleDuration(racePins.length);
  const flowSteps = [
    { key: 'locate', order: '01', label: flowLabels.select },
    { key: 'read', order: '02', label: flowLabels.score },
    { key: 'match', order: '03', label: flowLabels.plan },
  ];

  return (
    <div className="landing-cinematic-map" style={{ '--race-cycle-duration': raceCycleDuration }} aria-hidden="true">
      <svg viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet">
        <g className="landing-cinematic-map-graticule">
          {WORLD_MAP_GRATICULE.map((path) => <path key={path} d={path} />)}
        </g>
        <image
          href={worldMapPoliticalDotted}
          width="100"
          height="50"
          preserveAspectRatio="none"
          className="landing-cinematic-map-reference"
        />
        <g className="landing-cinematic-map-selection-layer">
          {racePins.map((race, index) => (
            <g
              key={`${race.name}-selection`}
              transform={`translate(${race.pin.x} ${race.pin.y})`}
              className="landing-cinematic-map-selection"
              style={{ '--race-delay': getRacePhaseDelay(index), '--race-cycle-duration': raceCycleDuration }}
            >
              <circle r="1.2" className="landing-cinematic-map-selection-spread" />
              <circle r="3.4" className="landing-cinematic-map-selection-ping" />
              <circle r="2.55" className="landing-cinematic-map-selection-ring" />
            </g>
          ))}
        </g>
        {racePins.map((race, index) => (
          <g
            key={race.name}
            transform={`translate(${race.pin.x} ${race.pin.y})`}
            className="landing-cinematic-map-pin"
            style={{ '--race-index': index, '--race-delay': getRacePhaseDelay(index), '--race-cycle-duration': raceCycleDuration }}
          >
            <circle r="1.35" className="landing-cinematic-map-badge" />
            <circle r="0.42" className="landing-cinematic-map-core" />
            <text x="0" y="0.34" textAnchor="middle" className="landing-cinematic-map-order">
              {String(index + 1).padStart(2, '0')}
            </text>
          </g>
        ))}
      </svg>
      <div className="landing-cinematic-map-timeline">
        {racePins.map((race, index) => (
          <div
            key={`${race.name}-timeline`}
            className="landing-cinematic-map-timeline-item"
            style={{ '--race-index': index, '--race-delay': getRacePhaseDelay(index), '--race-cycle-duration': raceCycleDuration }}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <em>{race.date}</em>
          </div>
        ))}
      </div>
      <div className="landing-cinematic-map-bottom-deck">
        <div className="landing-cinematic-map-guide">
          {flowSteps.map((step) => (
            <span key={step.key} className={`landing-cinematic-map-guide-step is-${step.key}`}>
              <em>{step.order}</em>
              <strong>{step.label}</strong>
            </span>
          ))}
        </div>
        <div className="landing-cinematic-map-caption-strip">
          {racePins.map((race, index) => (
            <div
              key={`${race.name}-caption`}
              className="landing-cinematic-map-caption"
              style={{ '--race-index': index, '--race-delay': getRacePhaseDelay(index), '--race-cycle-duration': raceCycleDuration }}
            >
              <span className="landing-cinematic-map-caption-order">{String(index + 1).padStart(2, '0')}</span>
              <strong>{race.name}</strong>
              <span className="landing-cinematic-map-caption-verb">{flowLabels.score}</span>
              <div className="landing-cinematic-map-caption-meta">
                <em className="landing-cinematic-map-caption-field is-date"><span>{metricLabels.date}</span>{race.date}</em>
                <small className="landing-cinematic-map-caption-field is-days"><span>{metricLabels.days}</span>{race.days}</small>
                <b className="landing-cinematic-map-caption-field is-goal"><span>{metricLabels.goal}</span>{race.goal}</b>
              </div>
            </div>
          ))}
        </div>
      </div>
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
  if (value === true) {
    return (
      <span className="landing-cinematic-compare-cell">
        <LandingGlyph name="check" className="landing-cinematic-compare-icon is-yes" />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="landing-cinematic-compare-cell">
        <LandingGlyph name="minus" className="landing-cinematic-compare-icon is-partial" />
      </span>
    );
  }
  return (
    <span className="landing-cinematic-compare-cell">
      <LandingGlyph name="close" className="landing-cinematic-compare-icon is-no" />
    </span>
  );
}

export default function Landing() {
  const { isAuthenticated, isAdmin, authHydrated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeFormulaId, setActiveFormulaId] = useState(null);

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
    ['#races', t('landing.cinematic_nav_races')],
    ['#compare', t('landing.cinematic_nav_compare')],
  ];

  const commandCards = [
    {
      number: '01',
      icon: 'zones',
      title: t('landing.cinematic_answer_1_title'),
      body: t('landing.cinematic_answer_1_body'),
      metric: '建议轻松跑',
    },
    {
      number: '02',
      icon: 'vdot',
      title: t('landing.cinematic_answer_2_title'),
      body: t('landing.cinematic_answer_2_body'),
      metric: '体能在进步',
    },
    {
      number: '03',
      icon: 'shoe',
      title: t('landing.cinematic_answer_3_title'),
      body: t('landing.cinematic_answer_3_body'),
      metric: '轮换训练鞋',
    },
  ];

  const formulaValues = {
    vdot: '58.4',
    acwr: '0.82',
    h: '18',
    count: '6',
    date: '2026-05-17',
    distance: '8 km',
    pace: '4:21 /km',
  };

  const formulaRows = [
    {
      id: 'vdot',
      label: t('landing.cinematic_formula_vdot_label'),
      copy: t('landing.cinematic_formula_vdot', formulaValues),
      formula: t('landing.cinematic_formula_vdot_full'),
      proof: t('landing.cinematic_formula_vdot_proof', formulaValues),
      steps: [
        t('landing.cinematic_formula_vdot_step_1'),
        t('landing.cinematic_formula_vdot_step_2'),
        t('landing.cinematic_formula_vdot_step_3', formulaValues),
      ],
    },
    {
      id: 'acwr',
      label: t('landing.cinematic_formula_acwr_label'),
      copy: t('landing.cinematic_formula_acwr', formulaValues),
      formula: t('landing.cinematic_formula_acwr_full'),
      proof: t('landing.cinematic_formula_acwr_proof', formulaValues),
      steps: [
        t('landing.cinematic_formula_acwr_step_1'),
        t('landing.cinematic_formula_acwr_step_2'),
        t('landing.cinematic_formula_acwr_step_3', formulaValues),
      ],
    },
    {
      id: 'recovery',
      label: t('landing.cinematic_formula_recovery_label'),
      copy: t('landing.cinematic_formula_recovery', formulaValues),
      formula: t('landing.cinematic_formula_recovery_full'),
      proof: t('landing.cinematic_formula_recovery_proof', formulaValues),
      steps: [
        t('landing.cinematic_formula_recovery_step_1'),
        t('landing.cinematic_formula_recovery_step_2'),
        t('landing.cinematic_formula_recovery_step_3', formulaValues),
      ],
    },
    {
      id: 'paces',
      label: t('landing.cinematic_formula_paces_label'),
      copy: t('landing.cinematic_formula_paces', formulaValues),
      formula: t('landing.cinematic_formula_paces_full'),
      proof: t('landing.cinematic_formula_paces_proof', formulaValues),
      steps: [
        t('landing.cinematic_formula_paces_step_1'),
        t('landing.cinematic_formula_paces_step_2'),
        t('landing.cinematic_formula_paces_step_3', formulaValues),
      ],
    },
  ];
  const activeFormula = formulaRows.find((row) => row.id === activeFormulaId);

  const races = [
    { id: 'tokyo', name: t('landing.cinematic_race_tokyo'), raceDate: '2027-03-07', goal: 'PB', geo: { lat: 35.6762, lng: 139.6503 } },
    { id: 'boston', name: t('landing.cinematic_race_boston'), raceDate: '2027-04-19', goal: 'Q+8', geo: { lat: 42.3601, lng: -71.0589 } },
    { id: 'london', name: t('landing.cinematic_race_london'), raceDate: '2027-04-25', goal: '2:58', geo: { lat: 51.5072, lng: -0.1276 } },
    { id: 'berlin', name: t('landing.cinematic_race_berlin'), raceDate: '2026-09-27', goal: '2:55', geo: { lat: 52.52, lng: 13.405 } },
    { id: 'chicago', name: t('landing.cinematic_race_chicago'), raceDate: '2026-10-11', goal: 'Sub-3', geo: { lat: 41.8781, lng: -87.6298 } },
    { id: 'newYork', name: t('landing.cinematic_race_new_york'), raceDate: '2026-11-01', goal: 'Sub-3', geo: { lat: 40.7128, lng: -74.006 } },
    { id: 'paris', name: t('landing.cinematic_race_paris'), raceDate: '2027-04-11', goal: 'PB', geo: { lat: 48.8566, lng: 2.3522 } },
    { id: 'valencia', name: t('landing.cinematic_race_valencia'), raceDate: '2026-12-06', goal: '2:52', geo: { lat: 39.4699, lng: -0.3763 } },
    { id: 'sydney', name: t('landing.cinematic_race_sydney'), raceDate: '2026-08-30', goal: 'Major', geo: { lat: -33.8688, lng: 151.2093 } },
    { id: 'comrades', name: t('landing.cinematic_race_comrades'), raceDate: '2027-06-13', goal: 'Silver', geo: { lat: -29.8587, lng: 31.0218 } },
  ].map((race) => ({
    ...race,
    date: formatRaceDate(race.raceDate),
    days: getRaceCountdownDays(race.raceDate),
  }));

  const compareRows = [
    { feature: t('landing.cinematic_compare_decision'), note: t('landing.cinematic_compare_decision_note'), hermes: true, strava: 'partial', runna: 'partial' },
    { feature: t('landing.cinematic_compare_race_plan'), note: t('landing.cinematic_compare_race_plan_note'), hermes: 'partial', strava: 'partial', runna: true },
    { feature: t('landing.cinematic_compare_formula'), note: t('landing.cinematic_compare_formula_note'), hermes: true, strava: false, runna: false },
    { feature: t('landing.cinematic_compare_sync'), note: t('landing.cinematic_compare_sync_note'), hermes: true, strava: true, runna: 'partial' },
    { feature: t('landing.cinematic_compare_acwr'), note: t('landing.cinematic_compare_acwr_note'), hermes: true, strava: 'partial', runna: 'partial' },
    { feature: t('landing.cinematic_compare_shoes'), note: t('landing.cinematic_compare_shoes_note'), hermes: true, strava: 'partial', runna: false },
    { feature: t('landing.cinematic_compare_local'), note: t('landing.cinematic_compare_local_note'), hermes: true, strava: false, runna: false },
    { feature: t('landing.cinematic_compare_noise'), note: t('landing.cinematic_compare_noise_note'), hermes: true, strava: false, runna: true },
  ];

  const zones = [
    [t('landing.cinematic_zone_recovery'), '<59%', t('landing.cinematic_zone_recovery_desc'), '6:18 /km'],
    [t('landing.cinematic_zone_easy'), '59-75%', t('landing.cinematic_zone_easy_desc'), '5:42 /km'],
    [t('landing.cinematic_zone_marathon'), '75-83%', t('landing.cinematic_zone_marathon_desc'), '4:36 /km'],
    [t('landing.cinematic_zone_threshold'), '83-92%', t('landing.cinematic_zone_threshold_desc'), '4:21 /km'],
    [t('landing.cinematic_zone_interval'), '92-105%', t('landing.cinematic_zone_interval_desc'), '3:52 /km'],
    [t('landing.cinematic_zone_repetition'), '>105%', t('landing.cinematic_zone_repetition_desc'), '3:30 /km'],
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
            <div className="landing-cinematic-hero-copy landing-command-copy">
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
              </div>
            </div>
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
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <strong>{card.metric}</strong>
                </article>
              ))}
            </RevealSection>

            <RevealSection className="landing-command-rhythm" delay={90} onClick={() => setActiveFormulaId(null)}>
              <span className="landing-cinematic-kicker">{t('landing.cinematic_formula_kicker')}</span>
              <h2>{t('landing.cinematic_formula_title')}</h2>
              <p>{t('landing.cinematic_formula_copy')}</p>
              <div className="landing-command-rhythm-list">
                {formulaRows.map((row, index) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`landing-command-rhythm-card${activeFormulaId === row.id ? ' is-active' : ''}`}
                    style={{ '--rhythm-index': index }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveFormulaId(row.id);
                    }}
                    aria-pressed={activeFormulaId === row.id ? 'true' : 'false'}
                  >
                    <span>{row.label}</span>
                    <p>{row.copy}</p>
                  </button>
                ))}
              </div>
              {activeFormula ? (
                <div className="landing-command-formula-detail" aria-live="polite">
                  <div className="landing-command-formula-detail-head">
                    <span>{activeFormula.label}</span>
                    <strong>{activeFormula.copy}</strong>
                  </div>
                  <code>{activeFormula.formula}</code>
                  <p>{activeFormula.proof}</p>
                  <ol className="landing-command-formula-steps">
                    {activeFormula.steps.map((step, index) => (
                      <li key={step}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <p>{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
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
            <RevealSection className="landing-cinematic-section-head landing-cinematic-section-head--answers">
              <span className="landing-cinematic-kicker">{t('landing.cinematic_answers_kicker')}</span>
              <h2 className="landing-cinematic-answers-title">{t('landing.cinematic_answers_title')} <span>{t('landing.cinematic_answers_title_muted')}</span></h2>
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
                {formulaRows.map((row) => (
                  <div key={row.id}>
                    <span>{row.label}</span>
                    <p>{row.copy}</p>
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
              <WorldMap
                races={races}
                metricLabels={{
                  date: t('landing.cinematic_race_col_date'),
                  days: t('landing.cinematic_race_col_days'),
                  goal: t('landing.cinematic_race_col_goal'),
                }}
                flowLabels={{
                  select: t('landing.cinematic_race_flow_select'),
                  score: t('landing.cinematic_race_flow_score'),
                  plan: t('landing.cinematic_race_flow_plan'),
                }}
              />
              <RevealSection className="landing-cinematic-race-list" delay={70}>
                <div className="landing-cinematic-race-head">
                  <span aria-hidden="true" />
                  <span>{t('landing.cinematic_race_col_race')}</span>
                  <span>{t('landing.cinematic_race_col_date')}</span>
                  <span>{t('landing.cinematic_race_col_days')}</span>
                  <span>{t('landing.cinematic_race_col_goal')}</span>
                </div>
                {races.map((race, index) => (
                  <div
                    key={race.name}
                    className="landing-cinematic-race-row"
                    style={{
                      '--race-index': index,
                      '--race-delay': getRaceTimelineDelay(index, races.length),
                      '--race-cycle-duration': getRaceCycleDuration(races.length),
                    }}
                  >
                    <span className="landing-cinematic-race-order">{String(index + 1).padStart(2, '0')}</span>
                    <span>{race.name}</span>
                    <span data-label={t('landing.cinematic_race_col_date')}>
                      <span className="landing-cinematic-sr-only">{t('landing.cinematic_race_col_date')}: </span>
                      {race.date}
                    </span>
                    <strong data-label={t('landing.cinematic_race_col_days')}>
                      <span className="landing-cinematic-sr-only">{t('landing.cinematic_race_col_days')}: </span>
                      {race.days}
                    </strong>
                    <em data-label={t('landing.cinematic_race_col_goal')} className={index === 0 ? 'is-primary' : ''}>
                      <span className="landing-cinematic-sr-only">{t('landing.cinematic_race_col_goal')}: </span>
                      {race.goal}
                    </em>
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
              {compareRows.map(({ feature, note, hermes, strava, runna }) => (
                <div key={feature} className="landing-cinematic-compare-row">
                  <span className="landing-cinematic-compare-feature">
                    <strong>{feature}</strong>
                    <small>{note}</small>
                  </span>
                  <CompareGlyph value={hermes} />
                  <CompareGlyph value={strava} />
                  <CompareGlyph value={runna} />
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
          <div className="landing-cinematic-footer-links">
            {footerUtilityLinks.map((link) => (
              link.to ? (
                <Link key={link.label} to={link.to} className="landing-cinematic-footer-link">{link.label}</Link>
              ) : (
                <a key={link.label} href={link.href} className="landing-cinematic-footer-link">{link.label}</a>
              )
            ))}
          </div>
        </PageWidth>
      </footer>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import { getTodayRunRecommendation } from '../utils/todayRun';
import { formatDistance } from '../utils/format';
import { formatShoeDisplayName } from '../utils/shoeNames';
import { buildRecentShoeSignal } from '../utils/shoeRotation';

const MARATHON_BLOCK_WEEKS = 16;

function formatRaceCountdown(eventDate, t) {
  if (!eventDate) return '--';
  const raceDate = new Date(eventDate);
  if (Number.isNaN(raceDate.getTime())) return '--';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  raceDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((raceDate.getTime() - today.getTime()) / 86400000);
  if (diffDays >= 0) return t('today_run.marathon_countdown_days', { days: diffDays });
  return t('today_run.marathon_countdown_past', { days: Math.abs(diffDays) });
}

function getRunTimestamp(run) {
  const candidates = [
    run?.startDateLocal,
    run?.startDate,
    run?.activityDate,
    run?.date,
    run?.createdAt,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  return 0;
}

function resolveMarathonBlockStart(upcomingMarathon) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const recentWindowStart = today.getTime() - (MARATHON_BLOCK_WEEKS * 7 * 24 * 60 * 60 * 1000);

  if (!upcomingMarathon?.eventDate) return recentWindowStart;

  const raceDate = new Date(upcomingMarathon.eventDate);
  if (Number.isNaN(raceDate.getTime())) return recentWindowStart;

  raceDate.setHours(0, 0, 0, 0);
  const raceBlockStart = raceDate.getTime() - (MARATHON_BLOCK_WEEKS * 7 * 24 * 60 * 60 * 1000);

  if (raceBlockStart > today.getTime()) return recentWindowStart;
  return Math.max(recentWindowStart, raceBlockStart);
}

function buildMarathonPlan(runs, races, recommendation, coachPayload, t, lang, unit) {
  const upcomingMarathon = (Array.isArray(races) ? races : [])
    .filter((race) => Number(race?.distanceKm) >= 41.5 && race?.registrationStatus !== 'CANCELED')
    .sort((a, b) => new Date(a?.eventDate || 0) - new Date(b?.eventDate || 0))
    .find((race) => new Date(race?.eventDate || 0).getTime() >= new Date().setHours(0, 0, 0, 0)) || null;

  const marathonBlockStart = resolveMarathonBlockStart(upcomingMarathon);
  const completedRuns = (Array.isArray(runs) ? runs : []).filter((run) => {
    if (Number(run?.distanceKm || 0) <= 0) return false;
    return getRunTimestamp(run) >= marathonBlockStart;
  });
  const longestRunKm = completedRuns.reduce((max, run) => Math.max(max, Number(run.distanceKm || 0)), 0);
  const targetDistanceKm = upcomingMarathon ? Number(upcomingMarathon.distanceKm || 42.195) : 42.195;
  const longRunTargetKm = upcomingMarathon
    ? Math.max(18, Math.min(34, Math.round(targetDistanceKm * 0.72)))
    : 28;
  const longRunProgress = longRunTargetKm > 0
    ? Math.max(0, Math.min(100, Math.round((longestRunKm / longRunTargetKm) * 100)))
    : 0;

  let phaseWeek = null;
  let phaseLabel = t('today_run.marathon_phase_default');
  let focusTitle = t('today_run.marathon_focus_default_title');
  let focusCopy = t('today_run.marathon_focus_default_copy', { workout: recommendation.type });

  if (upcomingMarathon?.eventDate) {
    const raceDate = new Date(upcomingMarathon.eventDate);
    const today = new Date();
    raceDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const daysToRace = Math.max(0, Math.round((raceDate.getTime() - today.getTime()) / 86400000));
    const weeksToRace = Math.max(1, Math.ceil(daysToRace / 7));
    phaseWeek = Math.max(1, 16 - weeksToRace);
    phaseLabel = t('today_run.marathon_phase_label', { week: phaseWeek });

    if (daysToRace <= 21) {
      focusTitle = t('today_run.marathon_focus_taper_title');
      focusCopy = t('today_run.marathon_focus_taper_copy', { race: upcomingMarathon.name });
    } else if (daysToRace <= 56) {
      focusTitle = t('today_run.marathon_focus_specific_title');
      focusCopy = t('today_run.marathon_focus_specific_copy', { longRun: formatDistance(longRunTargetKm, 0, lang, unit) });
    } else {
      focusTitle = t('today_run.marathon_focus_build_title');
      focusCopy = t('today_run.marathon_focus_build_copy', { longRun: formatDistance(longRunTargetKm, 0, lang, unit) });
    }
  }

  const coachNote = coachPayload?.today?.notes
    || (phaseWeek
      ? t('today_run.marathon_coach_body_block', { week: phaseWeek, longRun: formatDistance(longRunTargetKm, 0, lang, unit) })
      : t('today_run.marathon_coach_body_default'));

  return {
    race: upcomingMarathon,
    countdown: upcomingMarathon ? formatRaceCountdown(upcomingMarathon.eventDate, t) : t('today_run.marathon_no_race'),
    phaseLabel,
    longestRunKm,
    longRunTargetKm,
    longRunProgress,
    focusTitle,
    focusCopy,
    coachNote,
  };
}

function formatPlannedDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--';
  const wholeMinutes = Math.round(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const mins = wholeMinutes % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:00`;
  }
  return `${mins}:00`;
}

function formatSegmentDuration(minutes, t) {
  if (!Number.isFinite(minutes) || minutes <= 0) return t('today_run.stitch_duration_unknown');
  return t('today_run.stitch_minutes_short', { minutes: Math.max(1, Math.round(minutes)) });
}

function buildWorkoutBlueprint(plan, plannedDurationMinutes, t) {
  if (!Array.isArray(plan) || plan.length === 0) return [];

  const ratiosByLength = {
    3: [0.22, 0.58, 0.2],
    4: [0.18, 0.42, 0.22, 0.18],
  };
  const labelsByLength = {
    3: [
      t('today_run.stitch_blueprint_warmup'),
      t('today_run.stitch_blueprint_main'),
      t('today_run.stitch_blueprint_finish'),
    ],
    4: [
      t('today_run.stitch_blueprint_warmup'),
      t('today_run.stitch_blueprint_main'),
      t('today_run.stitch_blueprint_extension'),
      t('today_run.stitch_blueprint_cooldown'),
    ],
  };

  const totalMinutes = Number.isFinite(plannedDurationMinutes) && plannedDurationMinutes > 0
    ? plannedDurationMinutes
    : plan.length === 4 ? 40 : 32;
  const ratios = ratiosByLength[plan.length] || Array.from({ length: plan.length }, () => 1 / plan.length);
  const labels = labelsByLength[plan.length] || plan.map((_, index) => t('today_run.plan_step_generic', { index: index + 1 }));

  return plan.map((step, index) => ({
    ...step,
    phase: labels[index] || t('today_run.plan_step_generic', { index: index + 1 }),
    duration: formatSegmentDuration(totalMinutes * (ratios[index] || 1 / plan.length), t),
    isAccent: index === 1 || (plan.length === 4 && index === 2),
  }));
}

function getDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function prettifyWorkoutType(workoutType, t) {
  const normalized = String(workoutType || '').trim().toUpperCase();
  switch (normalized) {
    case 'QUALITY':
      return t('profile.dashboard_workout_quality');
    case 'EASY':
      return t('profile.dashboard_workout_easy');
    case 'RECOVERY':
      return t('profile.dashboard_workout_recovery');
    case 'LONG_RUN':
      return t('profile.dashboard_workout_long_run');
    case 'BASE':
      return t('profile.dashboard_workout_base');
    case 'REST':
      return t('profile.dashboard_workout_rest');
    default:
      return normalized.replace(/_/g, ' ') || t('profile.dashboard_workout_fallback');
  }
}

function buildConfidenceModel(metrics, toneKey, hasCoachSession) {
  let score = 76;

  if (hasCoachSession) score += 6;
  if (toneKey === 'quality') score += 5;
  if (toneKey === 'easy') score += 1;
  if (toneKey === 'recovery') score -= 7;
  if (toneKey === 'restart') score -= 10;

  if (metrics.acwr != null) {
    if (metrics.acwr >= 0.9 && metrics.acwr <= 1.15) score += 7;
    else if (metrics.acwr > 1.2 || metrics.acwr < 0.7) score -= 9;
    else score -= 2;
  }

  if (metrics.recoveryHours > 24) score -= 10;
  else if (metrics.recoveryHours > 12) score -= 5;
  else score += 3;

  if ((metrics.hardRuns7d || 0) >= (metrics.qualityCap || 1)) score -= 4;
  if ((metrics.runDays7 || 0) >= 4) score += 3;

  score = Math.max(42, Math.min(96, Math.round(score)));

  let tone = 'ready';
  if (score < 60) tone = 'action';
  else if (score < 76) tone = 'warning';

  return { score, tone };
}

export default function TodayRun() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const location = useLocation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [races, setRaces] = useState([]);
  const [shoes, setShoes] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [coachPayload, setCoachPayload] = useState(null);
  const [weatherContext, setWeatherContext] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [heatDismissed, setHeatDismissed] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return window.localStorage.getItem(`hermes_heat_strip_dismissed_${today}`) === '1';
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadTodayRun() {
      setLoadState('loading');
      try {
        const [profileData, activitiesData, coachData, weatherData, raceData, shoeData] = await Promise.all([
          apiJson('/api/profile/me').catch(() => null),
          apiJson('/api/activities'),
          apiJson('/api/coach/today').catch(() => null),
          apiJson('/api/v1/weather/context').catch(() => null),
          apiJson('/api/races').catch(() => []),
          apiJson('/api/shoes').catch(() => []),
        ]);

        if (cancelled) return;

        const list = Array.isArray(activitiesData) ? activitiesData : [];
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));

        setProfile(profileData && typeof profileData === 'object' ? profileData : null);
        setRuns(list);
        setCoachPayload(coachData && typeof coachData === 'object' ? coachData : null);
        setWeatherContext(weatherData && typeof weatherData === 'object' ? weatherData : null);
        setRaces(Array.isArray(raceData) ? raceData : []);
        setShoes(Array.isArray(shoeData) ? shoeData : []);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    }

    loadTodayRun();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate]);

  const {
    recommendation,
    tone,
    plan,
    reasons,
    metrics,
  } = useMemo(() => getTodayRunRecommendation({ runs, t, lang }), [runs, t, lang]);

  const displayName = useMemo(() => getDisplayName(profile, t('profile.default_name')), [profile, t]);
  const initials = displayName.slice(0, 1).toUpperCase();
  const hasHeatPenalty = weatherContext?.available && (weatherContext?.pacePenaltySecPerKm ?? 0) > 0;
  const showWeatherStrip = weatherContext?.available && !heatDismissed;
  const confidence = useMemo(
    () => buildConfidenceModel(metrics, tone.key, Boolean(coachPayload?.today)),
    [coachPayload, metrics, tone.key],
  );

  const coachSessionTitle = coachPayload?.today
    ? prettifyWorkoutType(coachPayload.today.workoutType, t)
    : recommendation.type;

  const coachDistance = coachPayload?.today?.plannedDistanceKm != null
    ? formatDistance(coachPayload.today.plannedDistanceKm, 1, lang, unit)
    : recommendation.distance;

  const coachDuration = coachPayload?.today?.plannedDurationMinutes != null
    ? formatPlannedDuration(coachPayload.today.plannedDurationMinutes)
    : '--';
  const marathonPlan = useMemo(
    () => buildMarathonPlan(runs, races, recommendation, coachPayload, t, lang, unit),
    [runs, races, recommendation, coachPayload, t, lang, unit],
  );
  const shoeSignal = useMemo(
    () => buildRecentShoeSignal(shoes, runs, { preferOwnedFallback: true }),
    [runs, shoes],
  );
  const shoeRecommendation = shoeSignal.recommendation;
  const recommendedShoeName = shoeRecommendation?.shoe
    ? formatShoeDisplayName({
      brand: shoeRecommendation.shoe.brand,
      model: shoeRecommendation.shoe.model,
      nickname: shoeRecommendation.shoe.nickname,
      lang,
    })
    : '';
  const recommendedShoeMileageLeftKm = shoeRecommendation?.shoe
    ? Math.max(
      0,
      Number(shoeRecommendation.shoe.maxDistanceKm || 0) - Number(shoeRecommendation.shoe.currentDistanceKm || 0),
    )
    : 0;
  const heroLocation = marathonPlan.race?.location || marathonPlan.race?.city || t('today_run.stitch_route_fallback');
  const readinessBattery = Math.max(
    48,
    Math.min(
      98,
      Math.round(confidence.score + (metrics.recoveryHours > 0 ? Math.max(-16, -metrics.recoveryHours / 2) : 6)),
    ),
  );
  const blueprintSteps = useMemo(
    () => buildWorkoutBlueprint(plan, coachPayload?.today?.plannedDurationMinutes, t),
    [plan, coachPayload, t],
  );
  const heroImageUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuALWfYinsgU1vEz5BwYWn1TDBuWXpQ7Fyt4jEXI-PHej1hQINxAVphQAFEullM64fz8BRJ0vzC9L7_nWCQNAKMaCRaDvBu9MgbTyqyWIp76Die0LEA3bDryIjtV6KfvDTTuY8SKnTS7ffXWD0WCbHGqBiiAeOU7rifxUpYgvms42ChKsIwo3UHjsYLD5-uFxp0xZZzXYsl1CmkEwQFXiqpluTdE5W2ZUgNMBC20DvRxlDX-SnipIE1pE0J3DKs5P3nB2gOBrcQd0hq-';

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ].map((item) => ({
    ...item,
    active: location.pathname === item.route || location.pathname.startsWith(`${item.route}/`),
  }));

  if (loadState === 'loading') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t('runs.loading')}</div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t('runs.load_error')}</div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page today-run-plan-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('today_run.stitch_sidebar_tagline')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>

        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runner-shell-sidebar-footer">
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/schedule')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&lt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('today_run.stitch_action_schedule')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <div className="runner-shell-topnav">
              <span className="runner-shell-topnav-link is-active">{t('today_run.stitch_shell_title')}</span>
            </div>
          </div>

          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={displayName} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas today-run-stitch-canvas">
          <section className="today-run-stitch-hero">
            <div
              className="today-run-stitch-hero-media"
              style={{ backgroundImage: `url(${heroImageUrl})` }}
              aria-hidden="true"
            />

            <div className="today-run-stitch-hero-copy">
              <span className="today-run-stitch-focus-tag">{t('today_run.stitch_focus_label')}</span>
              <h1>
                {marathonPlan.focusTitle}
                <span>{coachSessionTitle}</span>
              </h1>
              <p>{marathonPlan.focusCopy}</p>

              <div className="today-run-stitch-meta-row">
                <article>
                  <span>{t('today_run.stitch_route_label')}</span>
                  <strong>{heroLocation}</strong>
                </article>
                <article>
                  <span>{t('today_run.stitch_intensity_label')}</span>
                  <strong>{recommendation.type}</strong>
                </article>
              </div>
            </div>
          </section>

          <section className="today-run-stitch-band">
            <div className="today-run-stitch-metrics">
              <article className="today-run-stitch-metric-card">
                <span>{t('profile.today_run_distance')}</span>
                <strong>{coachDistance}</strong>
              </article>
              <article className="today-run-stitch-metric-card">
                <span>{t('today_run.stitch_target_pace')}</span>
                <strong>{recommendation.pace}</strong>
              </article>
              <article className="today-run-stitch-metric-card">
                <span>{t('today_run.stitch_est_time')}</span>
                <strong>{coachDuration}</strong>
              </article>
            </div>

            <aside className="today-run-stitch-readiness-card">
              <span className="today-run-stitch-card-kicker">{t('today_run.stitch_readiness_status')}</span>
              <div className="today-run-stitch-readiness-grid">
                <div>
                  <strong>
                    {metrics.recoveryHours > 0
                      ? t('today_run.metric_recovery_hours', { hours: metrics.recoveryHours })
                      : t('analysis.fully_recovered')}
                  </strong>
                  <span>{t('today_run.stitch_recovery_hour')}</span>
                </div>
                <div>
                  <strong>{metrics.bestVdot > 0 ? metrics.bestVdot.toFixed(1) : '--'}</strong>
                  <span>{t('today_run.metric_vo2max')}</span>
                </div>
              </div>
              <div className="today-run-stitch-readiness-pill">
                <span>{t('today_run.stitch_body_battery')}</span>
                <strong>{`${readinessBattery}%`}</strong>
              </div>
            </aside>
          </section>

          {showWeatherStrip && (
            <section className={`today-run-stitch-weather${hasHeatPenalty ? ' is-penalty' : ''}`}>
              <div className="today-run-stitch-weather-copy">
                <span>{t('today_run.acclimatization_title')}</span>
                <strong>
                  {hasHeatPenalty
                    ? t('today_run.acclimatization_penalty', { n: weatherContext.pacePenaltySecPerKm })
                    : t('today_run.acclimatization_clear')}
                </strong>
                <p>
                  {hasHeatPenalty
                    ? t('today_run.acclimatization_reason', { n: weatherContext.pacePenaltySecPerKm })
                    : t('today_run.stitch_weather_none')}
                </p>
              </div>
              <button
                type="button"
                className="today-run-stitch-weather-dismiss"
                aria-label={t('profile.close')}
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  window.localStorage.setItem(`hermes_heat_strip_dismissed_${today}`, '1');
                  setHeatDismissed(true);
                }}
              >
                <AppIcon name="close" className="runner-dashboard-side-link-icon" />
              </button>
            </section>
          )}

          <section className="today-run-stitch-grid">
            <div className="today-run-stitch-left">
              <article className="today-run-stitch-card today-run-stitch-card--blueprint">
                <div className="today-run-stitch-card-head">
                  <div>
                    <span>{t('today_run.plan_title')}</span>
                    <h2>{t('today_run.stitch_workout_blueprint')}</h2>
                  </div>
                  <p>{t('today_run.marathon_plan_copy', { race: marathonPlan.race?.name || t('today_run.marathon_goal_generic') })}</p>
                </div>

                <div className="today-run-stitch-timeline">
                  {blueprintSteps.map((step, index) => (
                    <article
                      key={`${step.phase}-${index}`}
                      className={`today-run-stitch-step${step.isAccent ? ' is-accent' : ''}`}
                    >
                      <div className="today-run-stitch-step-rail" aria-hidden="true">
                        <span className="today-run-stitch-step-dot" />
                      </div>
                      <div className="today-run-stitch-step-body">
                        <div className="today-run-stitch-step-head">
                          <span>{step.phase}</span>
                          <strong>{step.duration}</strong>
                        </div>
                        <h3>{step.label}</h3>
                        <p>{step.value}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </div>

            <aside className="today-run-stitch-right">
              <article className="today-run-stitch-card today-run-stitch-card--coach">
                <div className="today-run-stitch-card-head">
                  <div>
                    <span>{t('today_run.coach_title')}</span>
                    <h2>{t('today_run.stitch_automated_coach')}</h2>
                  </div>
                  <p>{t('today_run.stitch_logic_engine')}</p>
                </div>

                <div className="today-run-stitch-why">
                  <span>{t('today_run.stitch_why_label')}</span>
                  <p>{recommendation.purpose}</p>
                </div>

                <div className="today-run-stitch-note">
                  <span>{t('today_run.stitch_coach_note_label')}</span>
                  <p>{marathonPlan.coachNote}</p>
                </div>

                <div className="today-run-stitch-reason-list">
                  {reasons.slice(0, 3).map((reason, index) => (
                    <article key={`${reason}-${index}`} className="today-run-stitch-reason">
                      <strong>{String(index + 1).padStart(2, '0')}</strong>
                      <p>{reason}</p>
                    </article>
                  ))}
                </div>

                <div className="today-run-stitch-support-grid">
                  <article>
                    <span>{t('today_run.coach_polarization')}</span>
                    <strong>
                      {coachPayload?.state?.highIntensityRatioLast7d != null
                        ? `${(coachPayload.state.highIntensityRatioLast7d * 100).toFixed(0)}%`
                        : '--'}
                    </strong>
                  </article>
                  <article>
                    <span>{t('today_run.coach_grey_zone')}</span>
                    <strong>{coachPayload?.state?.minutesGreyZ3Last7d ?? '--'}</strong>
                  </article>
                  <article>
                    <span>{t('today_run.metric_acwr')}</span>
                    <strong>{metrics.acwr !== null ? metrics.acwr.toFixed(2) : '--'}</strong>
                  </article>
                  <article>
                    <span>{t('today_run.stitch_load_7d')}</span>
                    <strong>{formatDistance(metrics.recent7Km || 0, 1, lang, unit)}</strong>
                  </article>
                </div>

                {coachPayload?.today?.readinessAdjusted && (
                  <div className="today-run-stitch-alert">
                    <span>{t('today_run.coach_readiness')}</span>
                    <p>{t('today_run.coach_recovery_hint')}</p>
                  </div>
                )}

                {shoeRecommendation ? (
                  <div className={`today-run-shoe-brief${shoeRecommendation.type === 'insight' ? ' is-positive' : ''}`}>
                    <div className="today-run-shoe-brief-copy">
                      <span>{t('today_run.shoe_title')}</span>
                      <h3>{recommendedShoeName}</h3>
                      <p>
                        {shoeRecommendation.type === 'insight'
                          ? t('today_run.shoe_insight_summary', {
                            bpm: Math.abs(shoeRecommendation.insight.deltaHr).toFixed(1),
                            runCount: shoeRecommendation.runCount,
                          })
                          : shoeRecommendation.type === 'rotation'
                            ? t('today_run.shoe_rotation_summary', { count: shoeRecommendation.runCount })
                            : t('today_run.shoe_primary_summary')}
                      </p>
                    </div>
                    <div className="today-run-shoe-brief-meta">
                      <span>{t('today_run.shoe_current_mileage', { distance: formatDistance(Number(shoeRecommendation.shoe.currentDistanceKm || 0), 0, lang, unit) })}</span>
                      <span>{t('today_run.shoe_mileage_left', { distance: formatDistance(recommendedShoeMileageLeftKm, 0, lang, unit) })}</span>
                      <button
                        type="button"
                        className="today-run-shoe-brief-action"
                        onClick={() => navigate('/shoes')}
                      >
                        {t('today_run.shoe_open_locker')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="today-run-shoe-brief is-empty">
                    <div className="today-run-shoe-brief-copy">
                      <span>{t('today_run.shoe_title')}</span>
                      <h3>{t('today_run.shoe_empty_title')}</h3>
                      <p>{t('today_run.shoe_empty_copy')}</p>
                    </div>
                    <div className="today-run-shoe-brief-meta">
                      <button
                        type="button"
                        className="today-run-shoe-brief-action"
                        onClick={() => navigate('/shoes')}
                      >
                        {t('today_run.shoe_empty_cta')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="today-run-stitch-action-row">
                  <button
                    type="button"
                    className="today-run-stitch-primary-btn"
                    onClick={() => navigate('/schedule')}
                  >
                    {t('today_run.stitch_sync_watch')}
                  </button>
                  <button
                    type="button"
                    className="today-run-stitch-secondary-btn"
                    onClick={() => navigate(marathonPlan.race ? '/races' : '/schedule')}
                  >
                    {marathonPlan.race ? t('today_run.stitch_manage_block') : t('today_run.stitch_action_schedule')}
                  </button>
                </div>
              </article>
            </aside>
          </section>

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}

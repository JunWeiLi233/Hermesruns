import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
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
  const { isAuthenticated, logout } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
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

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'today-run', label: t('profile.dashboard_nav_today_run'), route: '/today-run', icon: 'directions_run', active: true },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  if (loadState === 'loading') {
    return (
      <div className="analysis-stitch-page analysis-stitch-page--loading">
        <div className="analysis-stitch-loading">{t('runs.loading')}</div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="analysis-stitch-page analysis-stitch-page--loading">
        <div className="analysis-stitch-loading">{t('runs.load_error')}</div>
      </div>
    );
  }

  return (
    <div className={`analysis-stitch-page runner-dashboard-page today-run-stitch-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="analysis-stitch-sidebar">
        <div className="analysis-stitch-brand runner-dashboard-brand">
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

        <nav className="analysis-stitch-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`analysis-stitch-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="analysis-stitch-sidebar-footer">
          <button type="button" className="analysis-stitch-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/schedule')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('today_run.stitch_action_schedule')}</span>
          </button>
        </div>
      </aside>

      <main className="analysis-stitch-main">
        <header className="analysis-stitch-topbar runner-dashboard-shell-topbar">
          <div className="analysis-stitch-topbar-left">
            <div className="schedule-stitch-topnav">
              <span className="schedule-stitch-topnav-link is-active">{t('profile.dashboard_nav_today_run')}</span>
            </div>
          </div>

          <div className="analysis-stitch-topbar-actions">
            <div className="analysis-stitch-topbar-profile-actions">
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/runs')} aria-label={t('analysis.stitch_open_runs')}>
                <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-avatar" aria-label={displayName} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="analysis-stitch-canvas today-run-stitch-canvas">
          <section className="today-run-stitch-hero">
            <div className="today-run-stitch-hero-copy">
              <span className="today-run-stitch-kicker">{marathonPlan.phaseLabel}</span>
              <h1>{marathonPlan.race?.name || t('today_run.marathon_default_title')}</h1>
              <p>{marathonPlan.focusCopy}</p>

              <div className="today-run-stitch-badges">
                <span className={`analysis-recommend-pill tone-${tone.key}`}>{recommendation.type}</span>
                <span className="today-run-marathon-pill">{marathonPlan.countdown}</span>
                <span className={`today-run-confidence-badge today-run-confidence-badge--${confidence.tone}`}>
                  {t('today_run.stitch_confidence')} {confidence.score}%
                </span>
              </div>

              <div className="today-run-stitch-hero-metrics">
                <article>
                  <span>{t('today_run.marathon_countdown_label')}</span>
                  <strong>{marathonPlan.countdown}</strong>
                </article>
                <article>
                  <span>{t('today_run.marathon_long_run_progress')}</span>
                  <strong>{`${marathonPlan.longRunProgress}%`}</strong>
                </article>
                <article>
                  <span>{t('today_run.marathon_long_run_target')}</span>
                  <strong>{formatDistance(marathonPlan.longRunTargetKm, 0, lang, unit)}</strong>
                </article>
                <article>
                  <span>{t('today_run.coach_session')}</span>
                  <strong>{coachSessionTitle}</strong>
                </article>
              </div>

              {showWeatherStrip && (
                <div className={`today-run-stitch-weather${hasHeatPenalty ? ' is-penalty' : ''}`}>
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
                </div>
              )}
            </div>

            <aside className="today-run-stitch-hero-panel">
              <div className="today-run-stitch-panel-copy">
                <span>{t('today_run.marathon_focus_title')}</span>
                <h2>{marathonPlan.focusTitle}</h2>
                <p>{marathonPlan.coachNote}</p>
              </div>

              <div className="today-run-stitch-panel-grid">
                <article>
                  <span>{t('profile.today_run_distance')}</span>
                  <strong>{coachDistance}</strong>
                </article>
                <article>
                  <span>{t('profile.dashboard_total_duration')}</span>
                  <strong>{coachDuration}</strong>
                </article>
                <article>
                  <span>{t('today_run.marathon_longest_run')}</span>
                  <strong>{formatDistance(marathonPlan.longestRunKm, 0, lang, unit)}</strong>
                </article>
                <article>
                  <span>{t('today_run.stitch_recovery_window')}</span>
                  <strong>
                    {metrics.recoveryHours > 0
                      ? t('today_run.metric_recovery_hours', { hours: metrics.recoveryHours })
                      : t('analysis.fully_recovered')}
                  </strong>
                </article>
              </div>

              {coachPayload?.today?.readinessAdjusted && (
                <div className="today-run-signal-explainer today-run-signal-explainer--warning">
                  <span className="today-run-signal-explainer__label">{t('today_run.coach_readiness')}</span>
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
            </aside>
          </section>

          <section className="today-run-stitch-grid">
            <div className="today-run-stitch-left">
              <article className="today-run-stitch-card">
                <div className="today-run-stitch-card-head">
                  <div>
                    <span>{t('today_run.plan_title')}</span>
                    <h2>{t('today_run.marathon_plan_title')}</h2>
                  </div>
                  <p>{t('today_run.marathon_plan_copy', { race: marathonPlan.race?.name || t('today_run.marathon_goal_generic') })}</p>
                </div>

                <div className="today-run-stitch-step-list">
                  {plan.map((step) => (
                    <article key={step.label} className="today-run-stitch-step-card">
                      <span>{step.label}</span>
                      <p>{step.value}</p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="today-run-stitch-card">
                <div className="today-run-stitch-card-head">
                  <div>
                    <span>{t('today_run.reasons_title')}</span>
                    <h2>{marathonPlan.focusTitle}</h2>
                  </div>
                  <p>{recommendation.purpose}</p>
                </div>

                <div className="today-run-stitch-reason-list">
                  {reasons.map((reason, index) => (
                    <article key={`${reason}-${index}`} className="today-run-stitch-reason-card">
                      <strong>{String(index + 1).padStart(2, '0')}</strong>
                      <p>{reason}</p>
                    </article>
                  ))}
                </div>
              </article>
            </div>

            <aside className="today-run-stitch-right">
              <article className="today-run-stitch-card">
                <div className="today-run-stitch-card-head">
                  <div>
                    <span>{t('today_run.marathon_progress_title')}</span>
                    <h2>{marathonPlan.race?.name || t('today_run.marathon_goal_generic')}</h2>
                  </div>
                  <p>{t('today_run.marathon_progress_copy')}</p>
                </div>

                <div className="today-run-stitch-signal-grid">
                  <article>
                    <span>{t('today_run.metric_vo2max')}</span>
                    <strong>{metrics.bestVdot > 0 ? metrics.bestVdot.toFixed(1) : '--'}</strong>
                  </article>
                  <article>
                    <span>{t('today_run.metric_acwr')}</span>
                    <strong>{metrics.acwr !== null ? metrics.acwr.toFixed(2) : '--'}</strong>
                  </article>
                  <article>
                    <span>{t('today_run.stitch_load_7d')}</span>
                    <strong>{formatDistance(metrics.recent7Km || 0, 1, lang, unit)}</strong>
                  </article>
                  <article>
                    <span>{t('today_run.marathon_countdown_label')}</span>
                    <strong>{marathonPlan.countdown}</strong>
                  </article>
                </div>

                {marathonPlan.race ? (
                  <div className="today-run-signal-explainer today-run-signal-explainer--ready">
                    <span className="today-run-signal-explainer__label">{t('today_run.marathon_target_locked')}</span>
                    <p>{t('today_run.marathon_target_locked_copy', { race: marathonPlan.race.name })}</p>
                  </div>
                ) : (
                  <div className="today-run-signal-explainer today-run-signal-explainer--warning">
                    <span className="today-run-signal-explainer__label">{t('today_run.marathon_pick_race_title')}</span>
                    <p>{t('today_run.marathon_pick_race_copy')}</p>
                    <div className="today-run-marathon-cta-row">
                      <button
                        type="button"
                        className="race-center-primary-btn today-run-marathon-cta-btn"
                        onClick={() => navigate('/races')}
                      >
                        {t('today_run.marathon_pick_race_cta')}
                      </button>
                    </div>
                  </div>
                )}
              </article>

              <article className="today-run-stitch-card today-run-stitch-card--coach">
                <div className="today-run-stitch-card-head">
                  <div>
                    <span>{t('today_run.coach_title')}</span>
                    <h2>{t('today_run.marathon_focus_title')}</h2>
                  </div>
                  <p>{marathonPlan.coachNote}</p>
                </div>

                <div className="today-run-stitch-coach-lines">
                  <div className="today-run-stitch-coach-line">
                    <span>{t('today_run.coach_polarization')}</span>
                    <strong>
                      {coachPayload?.state?.highIntensityRatioLast7d != null
                        ? `${(coachPayload.state.highIntensityRatioLast7d * 100).toFixed(0)}%`
                        : '--'}
                    </strong>
                  </div>
                  <div className="today-run-stitch-coach-line">
                    <span>{t('today_run.coach_grey_zone')}</span>
                    <strong>{coachPayload?.state?.minutesGreyZ3Last7d ?? '--'}</strong>
                  </div>
                  <div className="today-run-stitch-coach-line">
                    <span>{t('today_run.stitch_recovery_window')}</span>
                    <strong>
                      {metrics.recoveryHours > 0
                        ? t('today_run.metric_recovery_hours', { hours: metrics.recoveryHours })
                        : t('analysis.fully_recovered')}
                    </strong>
                  </div>
                </div>
              </article>
            </aside>
          </section>

          <footer className="analysis-stitch-footer runner-dashboard-footer">
            <button type="button" onClick={() => navigate('/terms')}>{t('landing.stitch_footer_terms')}</button>
            <button type="button" onClick={() => navigate('/privacy')}>{t('landing.stitch_footer_privacy')}</button>
            <button type="button" onClick={() => { window.location.href = 'mailto:support@hermes.run'; }}>{t('landing.stitch_footer_support')}</button>
            <button type="button" onClick={logout}>{t('profile.logout')}</button>
          </footer>
        </div>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import CoachIdentityBadge from '../components/CoachIdentityBadge';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import InfoDisclosure from '../components/ui/InfoDisclosure';
import ShoeRecommendation from '../components/ShoeRecommendation';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import { resolveAssignedCoach } from '../utils/coachIdentity';
import { getTodayRunRecommendation } from '../utils/todayRun';
import { getTodayRunAcwrInsight } from '../utils/todayRunAcwrInsight';
import { generateMorningBriefing } from '../utils/coachVoice';
import { formatDistance } from '../utils/format';
import { computeVdotTrend } from '../utils/vdot';
import { formatShoeDisplayName } from '../utils/shoeNames';
import { buildRecentShoeSignal, predictRetirement } from '../utils/shoeRotation';
import { interpretWellness } from '../utils/wellnessInterpretation';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';

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

function buildConfidenceModel(metrics, toneKey, hasCoachSession, runs, coachState) {
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

  // Recovery Data (Garmin Wellness)
  if (coachState) {
    if (coachState.lastSleepScore != null) {
      if (coachState.lastSleepScore < 50) score -= 15;
      else if (coachState.lastSleepScore < 70) score -= 5;
      else if (coachState.lastSleepScore > 85) score += 5;
    }
    if (coachState.lastStressScore != null) {
      if (coachState.lastStressScore > 75) score -= 10;
      else if (coachState.lastStressScore < 25) score += 5;
    }
    if (coachState.lastNightRestingHr != null && coachState.baselineRestingHr != null) {
      const hrDelta = coachState.lastNightRestingHr - coachState.baselineRestingHr;
      if (hrDelta > 5) score -= 8;
      else if (hrDelta < -2) score += 4;
    }
  }

  // VDOT trend adjustment
  if (Array.isArray(runs) && runs.length > 0) {
    const vdotTrend = computeVdotTrend(runs);
    if (vdotTrend.hasData) {
      if (vdotTrend.direction === 'declining') score -= 3;
      else if (vdotTrend.direction === 'improving') score += 2;
      // 'maintaining' leaves score unchanged
    }
  }

  score = Math.max(42, Math.min(96, Math.round(score)));

  let tone = 'ready';
  if (score < 60) tone = 'action';
  else if (score < 76) tone = 'warning';

  return { score, tone };
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sortRunsByMostRecent(runs) {
  const list = Array.isArray(runs) ? [...runs] : [];
  list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
  return list;
}

function normalizeTodayDashboardPayload(payload) {
  if (!isRecord(payload)) return null;
  const activities = payload.activities ?? payload.runs;
  if (!Array.isArray(activities)) return null;

  return {
    profile: payload.profile ?? null,
    runs: sortRunsByMostRecent(activities),
    coachPayload: payload.coachPayload ?? payload.coachToday ?? payload.coach ?? null,
    weatherContext: payload.weatherContext ?? payload.weather ?? null,
    races: payload.races ?? [],
    shoes: payload.shoes ?? [],
  };
}

async function loadTodayRunFallbackData() {
  const [profileData, activitiesData, coachData, weatherData, raceData, shoeData] = await Promise.all([
    apiJson('/api/profile/me').catch(() => null),
    apiJson('/api/activities'),
    apiJson('/api/coach/today').catch(() => null),
    apiJson('/api/v1/weather/context').catch(() => null),
    apiJson('/api/races').catch(() => []),
    apiJson('/api/shoes').catch(() => []),
  ]);

  return {
    profile: profileData,
    runs: sortRunsByMostRecent(activitiesData),
    coachPayload: coachData,
    weatherContext: weatherData,
    races: raceData,
    shoes: shoeData,
  };
}

async function loadTodayRunData() {
  try {
    const batchPayload = await apiJson('/api/today/dashboard');
    const normalized = normalizeTodayDashboardPayload(batchPayload);
    if (normalized) return normalized;
  } catch {
    // Fall through to the individual endpoints that powered Today's Run before batching.
  }

  return loadTodayRunFallbackData();
}

export default function TodayRun() {
  const { isAuthenticated, email } = useAuth();
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
  const [isDownshifted, setIsDownshifted] = useState(false);
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
        const dashboardData = await loadTodayRunData();

        if (cancelled) return;

        setProfile(dashboardData.profile && typeof dashboardData.profile === 'object' ? dashboardData.profile : null);
        setRuns(dashboardData.runs);
        setCoachPayload(dashboardData.coachPayload && typeof dashboardData.coachPayload === 'object' ? dashboardData.coachPayload : null);
        setWeatherContext(dashboardData.weatherContext && typeof dashboardData.weatherContext === 'object' ? dashboardData.weatherContext : null);
        setRaces(Array.isArray(dashboardData.races) ? dashboardData.races : []);
        setShoes(Array.isArray(dashboardData.shoes) ? dashboardData.shoes : []);
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
  } = useMemo(() => getTodayRunRecommendation({ runs, races, t, lang, weatherContext, forceRecovery: isDownshifted, coachPayload }), [runs, races, t, lang, weatherContext, isDownshifted, coachPayload]);

  const morningBriefing = useMemo(
    () => generateMorningBriefing({ recommendation, metrics, lang }),
    [recommendation, metrics, lang],
  );

  const displayName = useMemo(() => getDisplayName(profile, t('profile.default_name')), [profile, t]);
  const initials = displayName.slice(0, 1).toUpperCase();
  const hasHeatPenalty = weatherContext?.available && (weatherContext?.pacePenaltySecPerKm ?? 0) > 0;
  const showWeatherStrip = weatherContext?.available && !heatDismissed;
  const confidence = useMemo(
    () => buildConfidenceModel(metrics, tone.key, Boolean(coachPayload?.today), runs, coachPayload?.state),
    [coachPayload, metrics, tone.key, runs],
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
  const recommendedShoe = shoeRecommendation?.shoe || null;
  const recommendedShoeHealth = useMemo(() => {
    if (!recommendedShoe) return null;
    return predictRetirement(recommendedShoe, runs);
  }, [recommendedShoe, runs]);
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
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);

  const wellnessInterpretations = useMemo(
    () => (coachPayload?.state ? interpretWellness(coachPayload.state, t) : []),
    [coachPayload, t],
  );

  const vdotTrend = useMemo(
    () => (Array.isArray(runs) && runs.length > 0 ? computeVdotTrend(runs) : { direction: 'maintaining', delta: 0, hasData: false }),
    [runs],
  );
  const acwrInsight = useMemo(() => getTodayRunAcwrInsight(metrics.acwr), [metrics.acwr]);
  const acwrNarrative = useMemo(
    () => ({
      title: t(acwrInsight.calloutTitleKey, acwrInsight.calloutParams),
      body: t(acwrInsight.calloutBodyKey, acwrInsight.calloutParams),
      stripLabel: t(acwrInsight.stripLabelKey),
    }),
    [acwrInsight.calloutBodyKey, acwrInsight.calloutParams, acwrInsight.calloutTitleKey, acwrInsight.stripLabelKey, t],
  );

  const stamina = useMemo(() => {
    const s = coachPayload?.state?.stamina;
    if (s) {
      return {
        ...s,
        scorePercent: Math.max(0, Math.min(100, Number(s.scorePercent || 0))),
        recoveryCapPercent: Math.max(0, Math.min(100, Number(s.recoveryCapPercent || 0))),
      };
    }
    return {
      scorePercent: readinessBattery,
      recoveryCapPercent: Math.min(100, readinessBattery + 2),
      targetHeartRateBpm: null,
      direction: 'steady',
    };
  }, [coachPayload, readinessBattery]);

  const staminaScorePercent = stamina.scorePercent;
  const staminaCapPercent = stamina.recoveryCapPercent;
  const staminaHeartLabel = stamina.targetHeartRateBpm != null ? String(stamina.targetHeartRateBpm) : '--';

  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang }),
    [lang, t],
  );


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
    <div className={`runner-shell-page runner-dashboard-page today-run-plan-page today-run-command-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
          <button
            type="button"
            className="runner-shell-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={t('today_run.stitch_shell_title')}
              navigate={navigate}
            />
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

        <div className="runner-shell-canvas today-run-plan-canvas today-run-command-canvas">
          <section className="today-run-coaching-strip" aria-label={t('today_run.coaching_intelligence_title')}>
            <div className="today-run-coaching-strip-inner">
              <article className={`today-run-coaching-answer today-run-coaching-answer--readiness is-verdict-${(coachPayload?.state?.readinessVerdict || tone.key).toLowerCase()}`}>
                <span className="today-run-coaching-answer-kicker">{t('today_run.readiness_label')}</span>
                <strong className="today-run-coaching-answer-value">
                  {coachPayload?.state?.readinessVerdict
                    ? t(`today_run.readiness_verdict_${coachPayload.state.readinessVerdict.toLowerCase()}`)
                    : (tone.key === 'recovery' || tone.key === 'restart'
                      ? t('today_run.coaching_intelligence_rest')
                      : tone.key === 'easy'
                        ? t('today_run.coaching_intelligence_easy')
                        : t('today_run.coaching_intelligence_run'))}
                </strong>
                <span className="today-run-coaching-answer-sub">{coachPayload?.state?.readinessScore != null ? `${coachPayload.state.readinessScore}/100` : recommendation.purpose}</span>
                <div className="today-run-readiness-signals">
                  {coachPayload?.state?.readinessSleep != null && (
                    <span
                      className="today-run-readiness-signal"
                      aria-label={`${t('today_run.readiness_signal_sleep')}: ${coachPayload.state.readinessSleep}/100`}
                      title={t('today_run.readiness_signal_sleep_tooltip')}
                    >
                      <AppIcon name="sleep" className="today-run-readiness-signal-icon" aria-hidden="true" />
                      <span className="today-run-readiness-signal-label" aria-hidden="true">{t('today_run.readiness_signal_sleep_short')}</span>
                      <span className="today-run-readiness-signal-bar">
                        <span className="today-run-readiness-signal-fill" style={{ width: `${coachPayload.state.readinessSleep}%` }} />
                      </span>
                      <small aria-hidden="true">{coachPayload.state.readinessSleep}<span className="today-run-readiness-signal-scale">{t('today_run.readiness_signal_sleep_scale')}</span></small>
                    </span>
                  )}
                  {coachPayload?.state?.readinessHrv != null && (
                    <span
                      className="today-run-readiness-signal"
                      aria-label={`${t('today_run.readiness_signal_hrv')}: ${coachPayload.state.readinessHrv}/100`}
                      title={t('today_run.readiness_signal_hrv_tooltip')}
                    >
                      <AppIcon name="monitor_heart" className="today-run-readiness-signal-icon" aria-hidden="true" />
                      <span className="today-run-readiness-signal-label" aria-hidden="true">{t('today_run.readiness_signal_hrv_short')}</span>
                      <span className="today-run-readiness-signal-bar">
                        <span className="today-run-readiness-signal-fill" style={{ width: `${coachPayload.state.readinessHrv}%` }} />
                      </span>
                      <small aria-hidden="true">{coachPayload.state.readinessHrv}<span className="today-run-readiness-signal-scale">{t('today_run.readiness_signal_hrv_scale')}</span></small>
                    </span>
                  )}
                  {coachPayload?.state?.readinessRhr != null && (
                    <span
                      className="today-run-readiness-signal"
                      aria-label={`${t('today_run.readiness_signal_rhr')}: ${coachPayload.state.readinessRhr}/100`}
                      title={t('today_run.readiness_signal_rhr_tooltip')}
                    >
                      <AppIcon name="favorite" className="today-run-readiness-signal-icon" aria-hidden="true" />
                      <span className="today-run-readiness-signal-label" aria-hidden="true">{t('today_run.readiness_signal_rhr_short')}</span>
                      <span className="today-run-readiness-signal-bar">
                        <span className="today-run-readiness-signal-fill" style={{ width: `${coachPayload.state.readinessRhr}%` }} />
                      </span>
                      <small aria-hidden="true">{coachPayload.state.readinessRhr}<span className="today-run-readiness-signal-scale">{t('today_run.readiness_signal_rhr_scale')}</span></small>
                    </span>
                  )}
                  {coachPayload?.state?.readinessStress != null && (
                    <span
                      className="today-run-readiness-signal"
                      aria-label={`${t('today_run.readiness_signal_stress')}: ${coachPayload.state.readinessStress}/100`}
                      title={t('today_run.readiness_signal_stress_tooltip')}
                    >
                      <AppIcon name="stress" className="today-run-readiness-signal-icon" aria-hidden="true" />
                      <span className="today-run-readiness-signal-label" aria-hidden="true">{t('today_run.readiness_signal_stress_short')}</span>
                      <span className="today-run-readiness-signal-bar">
                        <span className="today-run-readiness-signal-fill" style={{ width: `${coachPayload.state.readinessStress}%` }} />
                      </span>
                      <small aria-hidden="true">{coachPayload.state.readinessStress}<span className="today-run-readiness-signal-scale">{t('today_run.readiness_signal_stress_scale')}</span></small>
                    </span>
                  )}
                </div>
              </article>

              <article className="today-run-coaching-answer today-run-coaching-answer--fitness">
                <span className="today-run-coaching-answer-kicker">{t('today_run.vdot_trend_label')}</span>
                <strong className={`today-run-coaching-answer-value is-${vdotTrend.direction}`}>
                  {vdotTrend.hasData
                    ? t(`today_run.coaching_intelligence_fitness_${vdotTrend.direction === 'improving' ? 'improving' : vdotTrend.direction === 'declining' ? 'declining' : 'steady'}`)
                    : '--'}
                </strong>
                {vdotTrend.hasData && vdotTrend.delta !== 0 && (
                  <span className="today-run-coaching-answer-delta">
                    {vdotTrend.delta > 0 ? '+' : ''}{vdotTrend.delta.toFixed(1)}
                  </span>
                )}
              </article>

              {coachPayload?.state && (coachPayload.state.lastSleepScore != null || coachPayload.state.lastStressScore != null) && (
                <article className="today-run-coaching-answer today-run-coaching-answer--wellness">
                  <span className="today-run-coaching-answer-kicker">{t('today_run.wellness_signal_label')}</span>
                  <div className="today-run-coaching-wellness-row">
                    {coachPayload.state.lastSleepScore != null && (
                      <div className="today-run-coaching-wellness-item" aria-label={`${t('profile.dashboard_sleep_score')}: ${coachPayload.state.lastSleepScore}`}>
                        <AppIcon name="sleep" className="today-run-coaching-wellness-icon" aria-hidden="true" />
                        <strong>{coachPayload.state.lastSleepScore}</strong>
                      </div>
                    )}
                    {coachPayload.state.lastStressScore != null && (
                      <div className="today-run-coaching-wellness-item" aria-label={`${t('profile.dashboard_stress_score')}: ${coachPayload.state.lastStressScore}`}>
                        <AppIcon name="stress" className="today-run-coaching-wellness-icon" aria-hidden="true" />
                        <strong>{coachPayload.state.lastStressScore}</strong>
                      </div>
                    )}
                  </div>
                  <span className="today-run-coaching-answer-sub">{t('today_run.wellness_signal_sub')}</span>
                </article>
              )}

              <article className={`today-run-coaching-answer today-run-coaching-answer--load is-acwr-${acwrInsight.zone}`}>
                <span className="today-run-coaching-answer-kicker">{t('today_run.metric_acwr')}</span>
                <strong className="today-run-coaching-answer-value">
                  {metrics.acwr != null ? metrics.acwr.toFixed(2) : '--'}
                </strong>
                <span className="today-run-coaching-answer-sub">{acwrNarrative.stripLabel}</span>
              </article>

              <article className="today-run-coaching-answer today-run-coaching-answer--shoe">
                <span className="today-run-coaching-answer-kicker">{t('today_run.coaching_intelligence_shoe_label')}</span>
                <strong className="today-run-coaching-answer-value">
                  {recommendedShoeName || t('today_run.coaching_intelligence_no_shoe')}
                </strong>
                {recommendedShoeMileageLeftKm > 0 && (
                  <span className="today-run-coaching-answer-sub">
                    {t('today_run.shoe_mileage_left', { distance: formatDistance(recommendedShoeMileageLeftKm, 0, lang, unit) })}
                  </span>
                )}
                {recommendedShoeHealth && recommendedShoeHealth.healthPercent != null && (
                  <span className={`today-run-shoe-health today-run-shoe-health--${recommendedShoeHealth.healthPercent > 50 ? 'healthy' : recommendedShoeHealth.healthPercent > 20 ? 'warning' : 'replace'}`}>
                    <span className="today-run-shoe-health-bar">
                      <span className="today-run-shoe-health-bar-fill" style={{ width: `${Math.min(100, recommendedShoeHealth.healthPercent)}%` }} />
                    </span>
                    <span className="today-run-shoe-health-label">
                      {recommendedShoeHealth.healthPercent > 50
                        ? t('today_run.shoe_health_healthy')
                        : recommendedShoeHealth.healthPercent > 20
                          ? t('today_run.shoe_health_warning')
                          : t('today_run.shoe_health_replace')}
                    </span>
                  </span>
                )}
              </article>
            </div>
          </section>

          <section className="today-run-plan-hero today-run-command-hero">
            <div className="today-run-plan-hero-copy today-run-command-hero-copy">
              <span className="today-run-plan-kicker">{t('today_run.stitch_focus_label')}</span>
              <h1>{marathonPlan.focusTitle}</h1>
              <p>{marathonPlan.focusCopy}</p>

              <InfoDisclosure className="today-run-overview-disclosure">
                <p>{t('today_run.copy')}</p>
              </InfoDisclosure>

              <div className="today-run-plan-morning-briefing">
                <span className="today-run-plan-morning-briefing-label">{t('today_run.morning_briefing_label')}</span>
                <p>{morningBriefing}</p>
                {wellnessInterpretations.length > 0 && (
                  <div className="today-run-plan-wellness-insights">
                    {wellnessInterpretations.map((insight) => (
                      <div key={insight} className="today-run-plan-wellness-insight">
                        <AppIcon name="chat_bubble_outline" className="today-run-plan-wellness-insight-icon" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className={`today-run-plan-downshift-btn${isDownshifted ? ' is-active' : ''}`}
                  onClick={() => setIsDownshifted(!isDownshifted)}
                >
                  <AppIcon name={isDownshifted ? 'refresh' : 'low_priority'} className="runner-dashboard-side-link-icon" />
                  <span>{t(isDownshifted ? 'profile.reset' : 'today_run.downshift_trigger')}</span>
                </button>
              </div>

              <div className="today-run-plan-badges">
                <span className="today-run-marathon-pill">{coachSessionTitle}</span>
                <span className="today-run-marathon-pill">{heroLocation}</span>
                <span className="today-run-marathon-pill">{marathonPlan.countdown}</span>
              </div>

              <div className="today-run-plan-rationale">
                <div className="today-run-plan-rationale-header">
                  <span className="today-run-plan-rationale-label">{t('today_run.rationale_title')}</span>
                </div>
                <div className="today-run-plan-rationale-content">
                  {reasons.slice(0, 3).map((reason) => (
                    <span key={reason} className="today-run-plan-rationale-item">
                      <AppIcon name="check_circle" className="today-run-plan-rationale-icon" />
                      {reason}
                    </span>
                  ))}
                </div>              </div>

              <div className="today-run-plan-hero-metrics">
                <article>
                  <span>{t('profile.today_run_distance')}</span>
                  <strong>{coachDistance}</strong>
                </article>
                <article className={metrics.weatherPenalty > 0 ? 'today-run-plan-metric-adjusted' : ''}>
                  <span>{t('today_run.stitch_target_pace')}</span>
                  <strong>{recommendation.pace}</strong>
                  {metrics.weatherPenalty > 0 && (
                    <small>{t('today_run.acclimatization_normal_pace', { pace: recommendation.normalPace })}</small>
                  )}
                </article>
                <article>
                  <span>{t('today_run.stitch_est_time')}</span>
                  <strong>{coachDuration}</strong>
                </article>
                <article>
                  <span>
                    {coachPayload?.state?.lastBodyBatteryAtWake != null
                      ? t('today_run.stitch_body_battery')
                      : t('today_run.stitch_readiness_blend')}
                  </span>
                  <strong>
                    {coachPayload?.state?.lastBodyBatteryAtWake != null
                      ? `${coachPayload.state.lastBodyBatteryAtWake}%`
                      : `${readinessBattery}%`}
                  </strong>
                </article>
              </div>

              {showWeatherStrip && (
                <section className={`today-run-plan-weather${hasHeatPenalty ? ' is-penalty' : ''}`}>
                  <div className="today-run-plan-weather-copy">
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
                    className="today-run-plan-weather-dismiss"
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
            </div>

            <aside className="today-run-plan-hero-panel today-run-command-readiness-panel">
              <div className="today-run-plan-panel-copy">
                <span>{t('today_run.stitch_readiness_status')}</span>
                <h2>{recommendation.type}</h2>
                <p>{recommendation.purpose}</p>
              </div>

                <div className="today-run-plan-panel-grid">
                  <article>
                    <span>{t('today_run.stitch_recovery_hour')}</span>
                    <strong>
                      {metrics.recoveryHours > 0
                        ? t('today_run.metric_recovery_hours', { hours: metrics.recoveryHours })
                        : t('analysis.fully_recovered')}
                    </strong>
                  </article>
                  <article>
                    <span>{t('today_run.stamina_score')}</span>
                    <strong>{staminaScorePercent}%</strong>
                  </article>
                  <article>
                    <span>{t('today_run.metric_vo2max')}</span>
                    <strong>{metrics.bestVdot > 0 ? metrics.bestVdot.toFixed(1) : '--'}</strong>
                  </article>
                  <article>
                    <span>{t('today_run.metric_acwr')}</span>
                    <strong>{metrics.acwr !== null ? metrics.acwr.toFixed(2) : '--'}</strong>
                  </article>
                  {vdotTrend.hasData && (
                    <article className={`today-run-plan-vdot-trend is-${vdotTrend.direction}`}>
                      <span>{t('today_run.vdot_trend_label')}</span>
                      <strong>
                        {vdotTrend.direction === 'improving' ? t('today_run.vdot_trend_improving') :
                         vdotTrend.direction === 'declining' ? t('today_run.vdot_trend_declining') :
                         t('today_run.vdot_trend_maintaining')}
                        {vdotTrend.delta !== 0 && (
                          <span className="today-run-plan-vdot-trend-delta">
                            ({vdotTrend.delta > 0 ? '+' : ''}{vdotTrend.delta.toFixed(1)})
                          </span>
                        )}
                      </strong>
                    </article>
                  )}
                </div>
            </aside>
          </section>

          <section className="today-run-plan-grid today-run-command-grid">
            <div className="today-run-plan-left">
              <ShoeRecommendation recommendedShoe={coachPayload?.recommendedShoe} />

              <article className="today-run-plan-card">
                <div className="today-run-plan-card-head">
                  <div>
                    <span>{t('today_run.plan_title')}</span>
                    <h2>{t('today_run.stitch_workout_blueprint')}</h2>
                  </div>
                  <p>{t('today_run.marathon_plan_copy', { race: marathonPlan.race?.name || t('today_run.marathon_goal_generic') })}</p>
                </div>

                <div className="today-run-plan-step-list">
                  {blueprintSteps.map((step) => (
                    <article
                      key={`${step.phase}-${step.label}`}
                      className="today-run-plan-step-card"
                    >
                      <span>{step.phase}</span>
                      <h3>{step.label}</h3>
                      <strong>{step.duration}</strong>
                      <p>{step.value}</p>
                    </article>
                  ))}
                </div>
              </article>
            </div>

            <aside className="today-run-plan-right">
              <article className="today-run-plan-card today-run-plan-card--coach">
                <div className="today-run-plan-card-head">
                  <div>
                    <span>{t('today_run.coach_title')}</span>
                    <h2>{t('today_run.stitch_automated_coach')}</h2>
                  </div>
                  <CoachIdentityBadge coach={assignedCoach} lang={lang} className="today-run-stitch-coach-badge" />
                </div>
                <p>{t('today_run.stitch_logic_engine')}</p>

                <div className="today-run-plan-coach-lines">
                  <article className="today-run-plan-coach-line">
                    <div>
                      <span>{t('today_run.stitch_why_label')}</span>
                      <strong>{recommendation.type}</strong>
                    </div>
                    <p>{recommendation.purpose}</p>
                  </article>
                  <article className="today-run-plan-coach-line">
                    <div>
                      <span>{t('today_run.stitch_coach_note_label')}</span>
                      <strong>{marathonPlan.phaseLabel}</strong>
                    </div>
                    <p>{marathonPlan.coachNote}</p>
                  </article>
                  {coachPayload?.today?.readinessAdjusted && (
                    <article className="today-run-plan-coach-line">
                      <div>
                        <span>{t('today_run.coach_readiness')}</span>
                        <strong>{t('today_run.stitch_readiness_status')}</strong>
                      </div>
                      <p>{t('today_run.coach_recovery_hint')}</p>
                    </article>
                  )}
                </div>

                <div className="today-run-plan-reason-list">
                  {reasons.slice(0, 3).map((reason, index) => (
                    <article key={reason} className="today-run-plan-reason-card">
                      <strong>{String(index + 1).padStart(2, '0')}</strong>
                      <p>{reason}</p>
                    </article>
                  ))}
                </div>

                <div className="today-run-plan-signal-grid">
                  <article>
                    <span>{t('today_run.coach_polarization')}</span>
                    <strong>
                      {coachPayload?.state?.highIntensityRatioLast7d != null
                        ? `${(coachPayload.state.highIntensityRatioLast7d * 100).toFixed(0)}%`
                        : '--'}
                    </strong>
                  </article>
                  <article>
                    <span>{t('today_run.stamina_recovery_cap')}</span>
                    <strong>{staminaCapPercent}%</strong>
                  </article>
                  <article>
                    <span>{t('today_run.stamina_target_hr')}</span>
                    <strong>{staminaHeartLabel} {staminaHeartLabel !== '--' ? 'bpm' : ''}</strong>
                  </article>
                  <article>
                    <span>{t('today_run.coach_grey_zone')}</span>
                    <strong>{coachPayload?.state?.minutesGreyZ3Last7d ?? '--'}</strong>
                  </article>
                </div>

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

                <div className="today-run-marathon-cta-row today-run-stitch-action-row">
                  <button
                    type="button"
                    className="today-run-stitch-primary-btn today-run-marathon-cta-btn"
                    onClick={() => navigate('/schedule')}
                  >
                    {t('today_run.stitch_sync_watch')}
                  </button>
                  <button
                    type="button"
                    className="today-run-stitch-secondary-btn today-run-marathon-cta-btn"
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

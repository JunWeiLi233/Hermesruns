import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import AppIcon from '../../components/AppIcon';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import CoachIdentityBadge from '../../components/CoachIdentityBadge';
import FooterNavLinks from '../../components/FooterNavLinks';
import HermesLogo from '../../components/HermesLogo';
import PageSkeleton from '../../components/PageSkeleton';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import InfoDisclosure from '../../components/ui/InfoDisclosure';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { apiJson } from '../../api';
import { cachedApiJson } from '../../api/resourceCache';
import { resolveAssignedCoach } from '../../utils/coachIdentity';
import { getTodayRunRecommendation } from '../../utils/todayRun';
import { normalizeCoachEvidence } from '../../utils/personalizedCoachPlan';
import { prettifyWorkoutType } from '../../utils/coach/presentation.js';
import { getTodayRunAcwrInsight } from '../../utils/todayRunAcwrInsight';
import { generateMorningBriefing } from '../../utils/coachVoice';
import { formatDistance } from '../../utils/format';
import { computeVdotTrend } from '../../utils/vdot';
import { formatShoeDisplayName } from '../../utils/shoeNames';
import { buildRecentShoeSignal, predictRetirement } from '../../utils/shoeRotation';
import { resolveRunnerPersona } from '../../utils/resolveRunnerPersona';
import { interpretWellness } from '../../utils/wellnessInterpretation';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';

const MARATHON_BLOCK_WEEKS = 16;

function getRaceDate(eventDate) {
  return new Date(typeof eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    ? `${eventDate}T00:00:00`
    : eventDate);
}

function formatRaceCountdown(eventDate, t) {
  if (!eventDate) return '--';
  const raceDate = getRaceDate(eventDate);
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

  const raceDate = getRaceDate(upcomingMarathon.eventDate);
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
    .find((race) => getRaceDate(race?.eventDate || 0).getTime() >= new Date().setHours(0, 0, 0, 0)) || null;

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
    const raceDate = getRaceDate(upcomingMarathon.eventDate);
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
    durationMinutes: step.isRest ? 0 : totalMinutes * (ratios[index] || 1 / plan.length),
    duration: step.isRest ? t('today_run.stitch_duration_unknown')
      : formatSegmentDuration(totalMinutes * (ratios[index] || 1 / plan.length), t),
    isAccent: index === 1 || (plan.length === 4 && index === 2),
  }));
}

function getDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
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
    cachedApiJson('/api/profile/me').catch(() => null),
    cachedApiJson('/api/activities'),
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
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
        setCoachPayload(normalizeCoachEvidence(dashboardData.coachPayload));
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
    plan,
    reasons,
    metrics,
  } = useMemo(
    () => getTodayRunRecommendation({ runs, races, t, lang, unit, weatherContext, forceRecovery: isDownshifted, coachPayload }),
    [runs, races, t, lang, unit, weatherContext, isDownshifted, coachPayload],
  );

  const morningBriefing = useMemo(
    () => generateMorningBriefing({ recommendation, metrics, lang }),
    [recommendation, metrics, lang],
  );

  const displayName = useMemo(() => getDisplayName(profile, t('profile.default_name')), [profile, t]);
  const initials = displayName.slice(0, 1).toUpperCase();
  const hasHeatPenalty = weatherContext?.available && (weatherContext?.pacePenaltySecPerKm ?? 0) > 0;
  const showWeatherStrip = weatherContext?.available && !heatDismissed;

  const coachSessionTitle = coachPayload?.today
    ? prettifyWorkoutType(coachPayload.today.workoutType, t)
    : recommendation.type;

  const isRestDay = !isDownshifted && coachPayload?.today?.workoutType === 'REST';
  const coachDistance = isRestDay
    ? t('today_run.personalized_distance_rest')
    : !isDownshifted && coachPayload?.today?.plannedDistanceKm != null
      ? formatDistance(coachPayload.today.plannedDistanceKm, 1, lang, unit)
      : recommendation.distance;

  const coachDuration = !isDownshifted && coachPayload?.today?.plannedDurationMinutes != null
    ? formatSegmentDuration(coachPayload.today.plannedDurationMinutes, t)
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
  const readinessBattery = coachPayload?.state?.currentReadinessScore ?? null;
  const blueprintSteps = useMemo(
    () => buildWorkoutBlueprint(plan, isDownshifted ? null : coachPayload?.today?.plannedDurationMinutes, t),
    [plan, coachPayload, isDownshifted, t],
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

  const runnerPersona = useMemo(() => {
    return resolveRunnerPersona({
      runs,
      runnerState: coachPayload?.runnerState,
    });
  }, [runs, coachPayload?.runnerState]);
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
      scorePercent: null,
      recoveryCapPercent: null,
      targetHeartRateBpm: null,
      direction: 'steady',
    };
  }, [coachPayload]);

  const distanceDisplay = typeof coachDistance === 'string' ? coachDistance.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/) : null;
  const wellnessSignals = [
    { metric: 'sleep', icon: 'sleep', score: coachPayload?.state?.readinessSleep },
    { metric: 'hrv', icon: 'monitor_heart', score: coachPayload?.state?.readinessHrv },
    { metric: 'rhr', icon: 'favorite', score: coachPayload?.state?.readinessRhr },
    { metric: 'stress', icon: 'stress', score: coachPayload?.state?.readinessStress },
  ];
  const historyOnlyReadiness = coachPayload?.state?.readinessLoad != null && wellnessSignals.every(signal => signal.score == null);
  const staminaScorePercent = stamina.scorePercent;
  const staminaCapPercent = stamina.recoveryCapPercent;
  const staminaHeartLabel = stamina.targetHeartRateBpm != null ? String(stamina.targetHeartRateBpm) : '--';

  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang }),
    [lang, t],
  );


  if (loadState === 'loading') {
    return <PageSkeleton variant="today-run" />;
  }

  if (loadState === 'error') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t('runs.load_error')}</div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page today-run-session-page today-run-plan-page today-run-command-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
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
            aria-current="page"
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
              <TopbarUserMenu initials={initials} label={t('components.account_menu.title')} showProfile />
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas today-run-plan-canvas today-run-command-canvas">
          <section className={`tr-v2-hero${isDownshifted ? ' is-downshifted' : ''}`} aria-labelledby="tr-session-title">
            <div className="tr-v2-gate">
              <span className="tr-v2-gate-label">{t('today_run.readiness_label')}</span>
              <div className="tr-v2-gate-score">
                <strong>{readinessBattery != null ? readinessBattery : '—'}</strong>
                {readinessBattery != null && <span>/100</span>}
              </div>
              {coachPayload?.state?.readinessVerdict && (
                <span className={`tr-v2-gate-verdict is-${coachPayload.state.readinessVerdict.toLowerCase()}`}>
                  <i aria-hidden="true" />
                  {t(`today_run.readiness_verdict_${coachPayload.state.readinessVerdict.toLowerCase()}`)}
                </span>
              )}
              {historyOnlyReadiness && <p className="tr-v2-gate-note">{t('today_run.readiness_load_only')}</p>}
              {!historyOnlyReadiness && wellnessInterpretations.length > 0 && (
                <p className="tr-v2-gate-note">{wellnessInterpretations.slice(0, 2).join(' ')}</p>
              )}
              <div className="tr-v2-gate-signals">
                {wellnessSignals.map(({ metric, score }) => (
                  <div className={`tr-v2-signal${score == null ? ' is-missing' : ''}`} key={metric}>
                    <span>{t(`today_run.readiness_signal_${metric}_short`)}</span>
                    {score != null
                      ? <span className="tr-v2-signal-meter" role="meter" aria-label={t(`today_run.readiness_signal_${metric}`)}
                          aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}><i style={{ width: `${score}%` }} /></span>
                      : <span className="tr-v2-signal-meter is-empty" />}
                    <strong>{score != null ? score : '—'}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="tr-v2-session">
              <div className="tr-v2-session-intro">
                <div className="tr-v2-session-head">
                  <span className="tr-v2-kicker">{t('today_run.session_heading')}</span>
                  <InfoDisclosure className="tr-session-about"><p>{t('today_run.copy')}</p></InfoDisclosure>
                </div>
                <h1 id="tr-session-title">{isDownshifted ? recommendation.type : coachSessionTitle}</h1>
                <p className="tr-v2-purpose">{recommendation.purpose}</p>
              </div>

              <dl className="tr-v2-targets">
                <div>
                  <dt>{t('today_run.v2_distance')}</dt>
                  <dd>{distanceDisplay ? <>{distanceDisplay[1]}<em>{distanceDisplay[2]}</em></> : coachDistance}</dd>
                </div>
                <div>
                  <dt>{t('today_run.stitch_target_pace')}</dt>
                  <dd className="tr-v2-pace">{recommendation.pace}</dd>
                  {hasHeatPenalty && <small>{t('today_run.acclimatization_normal_pace', { pace: recommendation.normalPace })}</small>}
                </div>
                <div>
                  <dt>{t('today_run.stitch_est_time')}</dt>
                  <dd>{coachDuration}</dd>
                </div>
              </dl>

              <div className="tr-v2-structure" aria-label={t('today_run.plan_title')}>
                <div className="tr-v2-structure-bar" aria-hidden="true">
                  {blueprintSteps.map((step) => (
                    <span
                      key={`bar-${step.phase}-${step.label}`}
                      className={step.isAccent ? 'is-main' : ''}
                      style={{ flexGrow: Math.max(1, step.durationMinutes) }}
                    >
                      {step.phase}
                    </span>
                  ))}
                </div>
                <ol className="tr-v2-structure-steps">
                  {blueprintSteps.map((step) => (
                    <li
                      key={`step-${step.phase}-${step.label}`}
                      style={{ flexGrow: Math.max(1, step.durationMinutes) }}
                    >
                      <span className="tr-v2-phase-label">{step.phase}</span>
                      <strong>{step.value}</strong>
                      <span>{coachDuration === '--' ? t('today_run.stitch_duration_unknown') : step.duration}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {showWeatherStrip && hasHeatPenalty && (
                <div className="tr-v2-weather">
                  <AppIcon name="weather" />
                  <p><strong>{t('today_run.acclimatization_penalty', { n: weatherContext.pacePenaltySecPerKm })}</strong>
                    <span>{t('today_run.acclimatization_reason', { n: weatherContext.pacePenaltySecPerKm })}</span></p>
                  <button type="button" aria-label={t('profile.close')} onClick={() => setHeatDismissed(true)}><AppIcon name="close" /></button>
                </div>
              )}

              <div className="tr-v2-actions">
                <button type="button" className="tr-v2-primary" onClick={() => navigate('/schedule')}>
                  {t('today_run.stitch_sync_watch')}
                </button>
                <button type="button" className={`tr-v2-secondary${isDownshifted ? ' is-active' : ''}`}
                  aria-pressed={isDownshifted} onClick={() => setIsDownshifted(!isDownshifted)}>
                  <AppIcon name={isDownshifted ? 'refresh' : 'low_priority'} />
                  {t(isDownshifted ? 'today_run.v2_reset' : 'today_run.downshift_trigger')}
                </button>
                <button type="button" className="tr-v2-link" onClick={() => navigate('/schedule')}>
                  {t('today_run.stitch_action_schedule')} ›
                </button>
                {marathonPlan.race && (
                  <button type="button" className="tr-v2-race" onClick={() => navigate('/races')}>
                    <AppIcon name="flag" /><span>{marathonPlan.race.name} · {marathonPlan.countdown}</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {runnerPersona !== 'active' && <section className="tr-session-notice tr-v2-notice" role="status">
            <strong>{t(runnerPersona === 'new' ? 'today_run.new_runner_title' : 'today_run.comeback_title')}</strong>
            <p>{t(runnerPersona === 'new' ? 'today_run.new_runner_body' : 'today_run.comeback_body')}</p>
            {runnerPersona === 'new' && <button type="button" className="tr-session-text-link" onClick={() => navigate('/runs')}>{t('today_run.new_runner_cta')} →</button>}
          </section>}

          <section className="tr-v2-support" aria-label={t('today_run.coaching_intelligence_title')}>
            <article className="tr-v2-card tr-v2-coach">
              <div className="tr-v2-card-head">
                <CoachIdentityBadge coach={assignedCoach} lang={lang} className="tr-session-coach-identity" />
                <h2>{t('today_run.v2_coach_briefing')}</h2>
              </div>
              <p className="tr-v2-briefing">{morningBriefing}</p>
              <details className="tr-v2-context">
                <summary>{t('today_run.training_context')}<AppIcon name="expand_more" /></summary>
                {wellnessInterpretations.length > 0 && <ul className="tr-v2-notes">{wellnessInterpretations.map((insight) => <li key={insight}>{insight}</li>)}</ul>}
                <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <p><strong>{marathonPlan.phaseLabel}</strong> — {marathonPlan.coachNote}</p>
                <dl>
                  <div><dt>{t('today_run.coach_polarization')}</dt><dd>{coachPayload?.state?.highIntensityRatioLast7d != null ? `${(coachPayload.state.highIntensityRatioLast7d * 100).toFixed(0)}%` : '—'}</dd></div>
                  <div><dt>{t('today_run.coach_grey_zone')}</dt><dd>{coachPayload?.state?.minutesGreyZ3Last7d ?? '—'}</dd></div>
                  <div><dt>{t('today_run.stamina_recovery_cap')}</dt><dd>{staminaCapPercent != null ? `${staminaCapPercent}%` : t('today_run.wellness_no_data')}</dd></div>
                  <div><dt>{t('today_run.stamina_target_hr')}</dt><dd>{staminaHeartLabel} {staminaHeartLabel !== '--' ? 'bpm' : ''}</dd></div>
                </dl>
              </details>
              <button type="button" className="tr-v2-shoe" onClick={() => navigate('/shoes')} aria-label={t('today_run.shoe_open_locker')}>
                <AppIcon name="footprint" />
                <span className="tr-v2-shoe-copy">
                  <span>{t('today_run.shoe_title')}</span>
                  <strong>{recommendedShoeName || t('today_run.shoe_empty_title')}</strong>
                  <small>
                    {shoeRecommendation
                      ? t('today_run.shoe_mileage_left', { distance: formatDistance(recommendedShoeMileageLeftKm, 0, lang, unit) })
                      : t('today_run.shoe_empty_copy')}
                    {recommendedShoeHealth?.healthPercent != null
                      ? ` · ${t(recommendedShoeHealth.healthPercent > 50 ? 'today_run.shoe_health_healthy' : recommendedShoeHealth.healthPercent > 20 ? 'today_run.shoe_health_warning' : 'today_run.shoe_health_replace')}`
                      : ''}
                  </small>
                </span>
                <AppIcon name="chevron_right" />
              </button>
            </article>

            <article className="tr-v2-card tr-v2-metric">
              <h2 className="tr-v2-card-label">{t('today_run.metric_vo2max')}</h2>
              <strong>{metrics.bestVdot > 0 ? metrics.bestVdot.toFixed(1) : '—'}</strong>
              {vdotTrend.hasData && (
                <span className={`tr-v2-trend is-${vdotTrend.direction}`}>
                  {vdotTrend.delta !== 0 ? `${vdotTrend.delta > 0 ? '+' : ''}${vdotTrend.delta.toFixed(1)} · ` : ''}
                  {t(`today_run.coaching_intelligence_fitness_${vdotTrend.direction === 'improving' ? 'improving' : vdotTrend.direction === 'declining' ? 'declining' : 'steady'}`)}
                </span>
              )}
              <p>
                {t('today_run.last_run_recovery_estimate')}{' '}
                <strong>{metrics.recoveryHours > 0 ? t('today_run.metric_recovery_hours', { hours: metrics.recoveryHours })
                  : metrics.recoveryHasData ? t('today_run.last_run_recovery_elapsed') : t('today_run.wellness_no_data')}</strong>
              </p>
              {staminaScorePercent != null && <p>{t('today_run.stamina_score')} <strong>{staminaScorePercent}%</strong></p>}
            </article>

            <article className={`tr-v2-card tr-v2-metric is-acwr-${acwrInsight.zone}`}>
              <h2 className="tr-v2-card-label">{t('today_run.v2_load_balance')}</h2>
              <strong>{metrics.acwr !== null ? metrics.acwr.toFixed(2) : '—'}</strong>
              <span className="tr-v2-acwr-scale" aria-hidden="true">
                {metrics.acwr != null && <i style={{ left: `${Math.max(0, Math.min(100, ((metrics.acwr - 0.5) / 1.1) * 100))}%` }} />}
              </span>
              <p>{acwrNarrative.stripLabel}</p>
              <details className="tr-v2-context is-compact"><summary>{acwrNarrative.title}<AppIcon name="expand_more" /></summary><p>{acwrNarrative.body}</p></details>
            </article>
          </section>

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}

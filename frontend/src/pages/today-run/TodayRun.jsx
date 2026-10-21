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
import { activitySortTime, calendarDate, getAccountDate, getActivityDateKey } from '../../utils/timeZone';
import { useAccountDate } from '../../hooks/useAccountDate';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';
import { prettifyWorkoutType } from '../../utils/coach/presentation.js';
import { getTodayRunAcwrInsight } from '../../utils/todayRunAcwrInsight';
import { generateMorningBriefing } from '../../utils/coachVoice';
import { formatDistance } from '../../utils/format';
import { computeVdotTrend } from '../../utils/vdot';
import { formatShoeDisplayName } from '../../utils/shoeNames';
import { buildRecentShoeSignal } from '../../utils/shoeRotation';
import { resolveRunnerPersona } from '../../utils/resolveRunnerPersona';
import VersionedPlanRoute, { useVersionedPlan } from '../training-plan/VersionedPlanRoute';
import {useAuthoredCalendar,AuthoredWeekProvider,AuthoredDayEntries} from '../../features/training/integrated/PageTools';
import { authoredOn, asAuthoredWorkout } from '../training-plan/authoredWorkout';
import { TodayPlanDetails } from '../training-plan/TrainingPlan';
import { asCoachWorkout } from '../training-plan/publishedWorkout';
import { interpretWellness } from '../../utils/wellnessInterpretation';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';

const MARATHON_BLOCK_WEEKS = 16;

function getRaceDate(eventDate) {
  return calendarDate(typeof eventDate === 'string' ? eventDate.slice(0, 10) : '');
}

function formatRaceCountdown(eventDate, t, todayKey) {
  if (!eventDate) return '--';
  const raceDate = getRaceDate(eventDate);
  if (Number.isNaN(raceDate.getTime())) return '--';
  const today = calendarDate(todayKey);
  const diffDays = Math.round((raceDate.getTime() - today.getTime()) / 86400000);
  if (diffDays >= 0) return t('today_run.marathon_countdown_days', { days: diffDays });
  return t('today_run.marathon_countdown_past', { days: Math.abs(diffDays) });
}

function getRunTimestamp(run) {
  // File imports have a real instant. Legacy Strava wall clocks can only be ordered
  // as wall-clock coordinates; never manufacture an elapsed-time instant for them.
  const timestamp = activitySortTime({ ...run, startTime: getRunStartTime(run) });
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getRunStartTime(run) {
  return run?.startTime || run?.startDateLocal || run?.startDate || run?.activityDate || run?.date || run?.createdAt;
}

function resolveMarathonBlockStart(upcomingMarathon, todayKey) {
  const today = calendarDate(todayKey);
  const recentWindowStart = today.getTime() - (MARATHON_BLOCK_WEEKS * 7 * 24 * 60 * 60 * 1000);

  if (!upcomingMarathon?.eventDate) return recentWindowStart;

  const raceDate = getRaceDate(upcomingMarathon.eventDate);
  if (Number.isNaN(raceDate.getTime())) return recentWindowStart;

  const raceBlockStart = raceDate.getTime() - (MARATHON_BLOCK_WEEKS * 7 * 24 * 60 * 60 * 1000);

  if (raceBlockStart > today.getTime()) return recentWindowStart;
  return Math.max(recentWindowStart, raceBlockStart);
}

export function buildMarathonPlan(runs, races, recommendation, coachPayload, t, lang, unit, timeZone, todayKey = getAccountDate(timeZone)) {
  const upcomingMarathon = (Array.isArray(races) ? races : [])
    .filter((race) => Number(race?.distanceKm) >= 41.5 && race?.registrationStatus !== 'CANCELED')
    .sort((a, b) => getRaceDate(a?.eventDate) - getRaceDate(b?.eventDate))
    .find((race) => getRaceDate(race?.eventDate).getTime() >= calendarDate(todayKey).getTime()) || null;

  const marathonBlockStart = resolveMarathonBlockStart(upcomingMarathon, todayKey);
  const completedRuns = (Array.isArray(runs) ? runs : []).filter((run) => {
    if (Number(run?.distanceKm || 0) <= 0) return false;
    const key = getActivityDateKey({ ...run, startTime: getRunStartTime(run) }, timeZone);
    return calendarDate(key).getTime() >= marathonBlockStart;
  });
  const longestRunKm = completedRuns.reduce((max, run) => Math.max(max, Number(run.distanceKm || 0)), 0);
  const longRun = (Array.isArray(coachPayload?.schedule) ? coachPayload.schedule : [])
    .find(session => session.workoutType === 'LONG_RUN' && session.scheduledDate >= todayKey && Number.isFinite(session.plannedDistanceKm) && session.plannedDistanceKm > 0);
  const longRunTargetKm = longRun?.plannedDistanceKm ?? null;
  const longRunProgress = longRunTargetKm > 0
    ? Math.max(0, Math.min(100, Math.round((longestRunKm / longRunTargetKm) * 100))) : 0;
  const phaseWeek = coachPayload?.state?.activeBlock?.weekIndex ?? null;
  const phaseLabel = phaseWeek ? t('today_run.marathon_phase_label', { week: phaseWeek }) : t('today_run.marathon_phase_default');
  const focusTitle = recommendation.title;
  const focusCopy = recommendation.purpose;
  const coachNote = coachPayload?.today?.notes || recommendation.purpose;

  return {
    race: upcomingMarathon,
    countdown: upcomingMarathon ? formatRaceCountdown(upcomingMarathon.eventDate, t, todayKey) : t('today_run.marathon_no_race'),
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
    : null;
  const ratios = ratiosByLength[plan.length] || Array.from({ length: plan.length }, () => 1 / plan.length);
  const labels = labelsByLength[plan.length] || plan.map((_, index) => t('today_run.plan_step_generic', { index: index + 1 }));

  return plan.map((step, index) => ({
    ...step,
    phase: labels[index] || t('today_run.plan_step_generic', { index: index + 1 }),
    durationMinutes: step.isRest ? 0 : 1,
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

export function sortRunsByMostRecent(runs) {
  const list = Array.isArray(runs) ? [...runs] : [];
  list.sort((a, b) => getRunTimestamp(b) - getRunTimestamp(a));
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

async function loadTodayRunFallbackData(includePrescription = true) {
  const [profileData, activitiesData, coachData, weatherData, raceData, shoeData] = await Promise.all([
    cachedApiJson('/api/profile/me').catch(() => null),
    cachedApiJson('/api/activities').catch(error=>{if(!includePrescription)return [];throw error;}),
    includePrescription?apiJson('/api/coach/today').catch(() => null):apiJson('/api/coach/state').then(state=>({state})).catch(()=>null),
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

async function loadTodayRunData(includePrescription = true) {
  if(!includePrescription)return loadTodayRunFallbackData(false);
  try {
    const batchPayload = await apiJson('/api/today/dashboard');
    const normalized = normalizeTodayDashboardPayload(batchPayload);
    if (normalized) return normalized;
  } catch {
    // Fall through to the individual endpoints that powered Today's Run before batching.
  }

  return loadTodayRunFallbackData();
}

export default function TodayRunRoute() {
  return <VersionedPlanRoute variant="today-run"><TodayRun /></VersionedPlanRoute>;
}

function TodayRun() {
  const recommendationRevision = useRecommendationRevision();
  const selection=useVersionedPlan();
  const activePlan=selection.data?.plan;
  const publishedWorkout=selection.data?.workout;
  const prescriptionUnavailable=Boolean(selection.error);
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const todayKey = useAccountDate(activePlan?.inputs.timeZone||profile?.timeZone);
  const authored=useAuthoredCalendar(todayKey);
  const todayEvents=useMemo(()=>authoredOn(authored.events,todayKey),[authored.events,todayKey]);
  const authoredWorkout=useMemo(()=>activePlan?null:asAuthoredWorkout(todayEvents),[activePlan,todayEvents]);
  const hasAuthoredWorkout=Boolean(authoredWorkout);
  const [runs, setRuns] = useState([]);
  const [races, setRaces] = useState([]);
  const [shoes, setShoes] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [coachPayload, setCoachPayload] = useState(null);
  const [staleCoachDate, setStaleCoachDate] = useState(null);
  const [weatherContext, setWeatherContext] = useState(null);
  const [isDownshifted, setIsDownshifted] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [heatDismissed, setHeatDismissed] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return window.localStorage.getItem(`hermes_heat_strip_dismissed_${today}`) === '1';
  });

  useEffect(() => {
    if(authored.loading)return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadTodayRun() {
      setLoadState('loading');
      try {
        const dashboardData = await loadTodayRunData(selection.allowLegacy&&!hasAuthoredWorkout);

        if (cancelled) return;

        setProfile(dashboardData.profile && typeof dashboardData.profile === 'object' ? dashboardData.profile : null);
        setRuns(dashboardData.runs);
        const normalizedCoach = normalizeCoachEvidence(activePlan?{...dashboardData.coachPayload,today:asCoachWorkout(publishedWorkout)}:dashboardData.coachPayload);
        const scheduledDate = normalizedCoach?.today?.scheduledDate;
        const currentDate = getAccountDate(activePlan?.inputs.timeZone||dashboardData.profile?.timeZone);
        const isStale = typeof scheduledDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) && scheduledDate !== currentDate;
        setStaleCoachDate(isStale ? scheduledDate : null);
        setCoachPayload(isStale ? null : normalizedCoach);
        setIsDownshifted(!isStale && normalizedCoach?.today?.reasonCode === 'manual_ease');
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
  }, [isAuthenticated, navigate, retryAttempt, todayKey, selection.allowLegacy, activePlan, publishedWorkout,authored.loading,hasAuthoredWorkout, recommendationRevision]);

  const {
    recommendation,
    plan,
    reasons,
    metrics,
  } = useMemo(
    () => getTodayRunRecommendation({ runs, races, t, lang, unit, weatherContext, coachPayload, timeZone: activePlan?.inputs.timeZone || profile?.timeZone, todayKey }),
    [runs, races, t, lang, unit, weatherContext, coachPayload, activePlan?.inputs.timeZone, profile?.timeZone, todayKey],
  );

  async function toggleEasierSession() {
    setSavingAdjustment(true);
    setAdjustmentError(false);
    try {
      const updated = await apiJson('/api/coach/today/ease', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isDownshifted }),
      });
      if (updated?.today?.scheduledDate !== todayKey) throw new Error('Current prescription unavailable');
      setCoachPayload(normalizeCoachEvidence(updated));
      setIsDownshifted(updated.today.reasonCode === 'manual_ease');
    } catch {
      setAdjustmentError(true);
    } finally {
      setSavingAdjustment(false);
    }
  }

  const morningBriefing = useMemo(
    () => activePlan?`${activePlan.title} · ${publishedWorkout?.phase?t(`training_plan.${publishedWorkout.phase}`):t('training_plan.restHelp')}`:authoredWorkout?`${t('training_integration.authoredWorkout')} · ${authoredWorkout.title}`:generateMorningBriefing({ recommendation, metrics, lang }),
    [activePlan,publishedWorkout,authoredWorkout,t,recommendation, metrics, lang],
  );

  const displayName = useMemo(() => getDisplayName(profile, t('profile.default_name')), [profile, t]);
  const initials = displayName.slice(0, 1).toUpperCase();
  const hasHeatPenalty = weatherContext?.available && (weatherContext?.pacePenaltySecPerKm ?? 0) > 0;
  const showWeatherStrip = weatherContext?.available && !heatDismissed;

  const coachSessionTitle = prescriptionUnavailable?t('training_plan.error'):activePlan ? t(`training_plan.${publishedWorkout?.workoutType==='RUN_WALK'?'RUN_WALK_KIND':publishedWorkout?.workoutType||selection.data.state}`) : authoredWorkout?authoredWorkout.title:recommendation.source==='unavailable'?recommendation.title:coachPayload?.today
    ? prettifyWorkoutType(coachPayload.today.workoutType, t)
    : recommendation.type;

  const isRestDay = recommendation.source !== 'unavailable' && coachPayload?.today?.workoutType === 'REST';
  const coachDistance = prescriptionUnavailable||authoredWorkout?'—':activePlan ? (publishedWorkout?.targetDistanceM!=null?formatDistance(publishedWorkout.targetDistanceM/1000,1,lang,unit):publishedWorkout?.workoutType==='REST'?t('today_run.personalized_distance_rest'):'—') : isRestDay
    ? t('today_run.personalized_distance_rest')
    : recommendation.distance;

  const coachDuration = prescriptionUnavailable?'—':activePlan ? (publishedWorkout?.targetDurationS!=null?formatSegmentDuration(publishedWorkout.targetDurationS/60,t):'—') : authoredWorkout?formatSegmentDuration(authoredWorkout.plannedDurationMinutes,t):coachPayload?.today?.plannedDurationMinutes != null
    ? formatSegmentDuration(coachPayload.today.plannedDurationMinutes, t)
    : '--';
  const paceStep=publishedWorkout?.steps?.find(step=>step.paceMinSPerKm!=null&&step.paceMaxSPerKm!=null);
  const publishedPace=seconds=>{const total=Math.round(seconds*(unit==='mile'?1.609344:1));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;};
  const publishedPaceRange=paceStep?`${publishedPace(paceStep.paceMinSPerKm)}–${publishedPace(paceStep.paceMaxSPerKm)} / ${unit==='mile'?'mi':'km'}`:'—';
  const marathonPlan = useMemo(
    () => buildMarathonPlan(runs, races, recommendation, coachPayload, t, lang, unit, profile?.timeZone, todayKey),
    [runs, races, recommendation, coachPayload, t, lang, unit, profile?.timeZone, todayKey],
  );
  const shoeSignal = useMemo(
    () => buildRecentShoeSignal(shoes, runs, { preferOwnedFallback: true }),
    [runs, shoes],
  );
  // Catalogue suggestions are not owned shoes with tracked mileage or wear.
  const shoeRecommendation = shoeSignal.recommendation?.type === 'recommend' ? null : shoeSignal.recommendation;
  const recommendedShoeName = shoeRecommendation?.shoe
    ? formatShoeDisplayName({
      brand: shoeRecommendation.shoe.brand,
      model: shoeRecommendation.shoe.model,
      nickname: shoeRecommendation.shoe.nickname,
      lang,
    })
    : '';
  const recommendedShoe = shoeRecommendation?.shoe || null;
  const recommendedShoeMileageLeftKm = Number(recommendedShoe?.maxDistanceKm) > 0
    ? Math.max(0, Number(recommendedShoe.maxDistanceKm) - Number(recommendedShoe.currentDistanceKm || 0))
    : null;
  const readinessBattery = coachPayload?.state?.currentReadinessScore ?? null;
  const blueprintSteps = useMemo(
    () => activePlan?(publishedWorkout?.steps||[]).map((step,index)=>({phase:t(`training_plan.${step.stepType}`),label:String(index),value:step.distanceM!=null?formatDistance(step.distanceM/1000,2,lang,unit):step.durationS!=null?formatSegmentDuration(step.durationS/60,t):'—',duration:step.durationS!=null?formatSegmentDuration(step.durationS/60,t):'—',durationMinutes:step.durationS/60||1,isAccent:step.stepType==='RUN'||step.stepType==='MAIN'})):authoredWorkout?authoredWorkout.steps.map((step,index)=>({phase:step.name,label:String(index),value:step.target==null?'—':`${step.target}${step.unit}`,duration:formatSegmentDuration(step.minutes,t),durationMinutes:step.minutes,isAccent:false})):buildWorkoutBlueprint(plan, coachPayload?.today?.plannedDurationMinutes, t),
    [activePlan,publishedWorkout,authoredWorkout,lang,unit,plan, coachPayload, t],
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
  const acwrInsight = useMemo(
    () => getTodayRunAcwrInsight(metrics.acwr, metrics.coachLoadEvidence),
    [metrics.acwr, metrics.coachLoadEvidence],
  );

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
        <div className="runner-shell-loading">
          <div>
            <p role="alert">{t('today_run.load_error')}</p>
            <button type="button" className="rewards-load-retry" onClick={() => setRetryAttempt(attempt => attempt + 1)}>
              {t('today_run.retry')}
            </button>
          </div>
        </div>
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
                {activePlan&&<p role="note">{t('training_plan.experimentalNotice')}</p>}
                <p className="tr-v2-purpose">
                  <span className="tr-v2-reason-label">{t('today_run.reason_label')}</span>
                  {activePlan?`${activePlan.title} · ${t(`training_plan.${publishedWorkout?.phase||'restHelp'}`)}`:authoredWorkout?t('training_integration.authoredWorkout'):recommendation.summaryReason || recommendation.purpose || t('today_run.reason_unavailable')}
                  {staleCoachDate && !isDownshifted && <span className="tr-v2-reason-note">{t('today_run.reason_stale', { date: staleCoachDate })}</span>}
                </p>
              </div>

              <dl className="tr-v2-targets">
                <div>
                  <dt>{t('today_run.v2_distance')}</dt>
                  <dd>{distanceDisplay ? <>{distanceDisplay[1]}<em>{distanceDisplay[2]}</em></> : coachDistance}</dd>
                </div>
                <div>
                  <dt>{t('today_run.stitch_target_pace')}</dt>
                  <dd className="tr-v2-pace">{prescriptionUnavailable||authoredWorkout?'—':activePlan?publishedPaceRange:recommendation.pace}</dd>
                  {hasHeatPenalty && !activePlan && !authoredWorkout && <small>{t('today_run.acclimatization_normal_pace', { pace: recommendation.normalPace })}</small>}
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
                {!activePlan&&!authoredWorkout&&!prescriptionUnavailable&&<button type="button" className={`tr-v2-secondary${isDownshifted ? ' is-active' : ''}`}
                  disabled={savingAdjustment || !recommendation.distanceKm}
                  aria-pressed={isDownshifted} onClick={toggleEasierSession}>
                  <AppIcon name={isDownshifted ? 'refresh' : 'low_priority'} />
                  {t(isDownshifted ? 'today_run.v2_reset' : 'today_run.downshift_trigger')}
                </button>}
                <button type="button" className="tr-v2-link" onClick={() => navigate('/schedule')}>
                  {t('today_run.stitch_action_schedule')} ›
                </button>
                {marathonPlan.race && (
                  <button type="button" className="tr-v2-race" onClick={() => navigate('/races')}>
                    <AppIcon name="flag" /><span>{marathonPlan.race.name} · {marathonPlan.countdown}</span>
                  </button>
                )}
              </div>
              {adjustmentError ? <p role="alert">{t('today_run.shared_adjustment_failed')}</p> : null}
            </div>
          </section>

          {runnerPersona !== 'active' && <section className="tr-session-notice tr-v2-notice" role="status">
            <strong>{t(runnerPersona === 'new'
              ? runs.length > 0 ? 'today_run.limited_history_title' : 'today_run.new_runner_title'
              : 'today_run.comeback_title')}</strong>
            <p>{t(runnerPersona === 'new'
              ? runs.length > 0 ? 'today_run.limited_history_body' : 'today_run.new_runner_body'
              : 'today_run.comeback_body')}</p>
            {runnerPersona === 'new' && runs.length === 0 && <button type="button" className="tr-session-text-link" onClick={() => navigate('/runs')}>{t('today_run.new_runner_cta')} →</button>}
          </section>}

          <TodayPlanDetails />
          {todayEvents.length>0&&<section aria-label={t('training_integration.authoredWorkout')}>{activePlan&&<><p role="status">{t('training_integration.generatedPriority')}</p><h2>{t('training_integration.otherScheduled')}</h2></>}<AuthoredWeekProvider source={authored}><AuthoredDayEntries date={todayKey} source={authored}/></AuthoredWeekProvider></section>}
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
                <ul>{(authoredWorkout?[t('training_integration.authoredWorkout')]:reasons).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <p><strong>{activePlan?(publishedWorkout?.phase?t(`training_plan.${publishedWorkout.phase}`):t('training_plan.restHelp')):authoredWorkout?t('training_integration.authoredWorkout'):marathonPlan.phaseLabel}</strong> — {activePlan?activePlan.title:authoredWorkout?authoredWorkout.title:marathonPlan.coachNote}</p>
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
                      ? t('today_run.shoe_current_mileage', { distance: formatDistance(Number(recommendedShoe.currentDistanceKm || 0), 0, lang, unit) })
                      : t('today_run.shoe_empty_copy')}
                    {recommendedShoeMileageLeftKm != null
                      ? ` · ${t('today_run.shoe_mileage_left', { distance: formatDistance(recommendedShoeMileageLeftKm, 0, lang, unit) })}`
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

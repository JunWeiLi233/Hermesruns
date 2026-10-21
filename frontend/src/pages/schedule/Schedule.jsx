import { resolveCoachReadinessScore, resolveCoachReadinessLabel, resolveCoachWeeklyTarget } from '../../utils/personalizedCoachPlan';
import RecommendationEvidence from '../../components/RecommendationEvidence';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import VersionedPlanRoute, { useVersionedPlan } from '../training-plan/VersionedPlanRoute';
import { SchedulePlanTools, usePublishedCalendar, planWorkoutUrl } from '../training-plan/TrainingPlan';
import { asCoachWorkout } from '../training-plan/publishedWorkout';
import {ScheduleAuthoringTools,useAuthoredCalendar,AuthoredWeekProvider,AuthoredDayEntries} from '../../features/training/integrated/PageTools';
import { authoredOn, asAuthoredWorkout } from '../training-plan/authoredWorkout';
import { addDays, mondayOf } from '../training-plan/planApi';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { apiJson, apiFetch } from '../../api';
import { cachedApiJson } from '../../api/resourceCache';
import 'leaflet/dist/leaflet.css';
import AppIcon from '../../components/AppIcon';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import CoachIdentityBadge from '../../components/CoachIdentityBadge';
import FooterNavLinks from '../../components/FooterNavLinks';
import HermesLogo from '../../components/HermesLogo';
import PageSkeleton from '../../components/PageSkeleton';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import { formatDistance } from '../../utils/format';
import { resolveAssignedCoach } from '../../utils/coachIdentity';
import { buildScheduleTargetBlockModel } from '../../utils/scheduleMarathonBlock';
import { getTodayRunRecommendation } from '../../utils/todayRun';
import { localizedReason } from '../../utils/personalizedCoachPlan';
import { formatPlannedDuration, prettifyWorkoutType } from '../../utils/coach/presentation.js';
import { computeVdotTrend } from '../../utils/vdot';
import { buildWeeklyCoachSummaryModel, selectNextSessionForWeek } from '../../utils/scheduleCoachSummary';
import { buildScheduleRecoverySignals } from '../../utils/scheduleRecoverySignals';
import {
  extractRouteWaypoints,
  isRouteNearAnchor,
  isRouteRecommendationUsable,
  normalizeRouteAnchor,
  normalizeRouteWaypoint,
  resolveDailyRouteDistanceKm,
} from '../../utils/routeRecommendation';
import TopbarNotifications from '../../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import { accountWeekStart, activitySortTime, addCalendarDays, calendarDate, getActivityDateKey } from '../../utils/timeZone';
import { useAccountDate } from '../../hooks/useAccountDate';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';
import { planReadOnly } from '../../utils/trainingPlanCache';
import { getSafeImageUrl } from '../../utils/safeImageUrl';
import scheduleSessionPhoto from '../../assets/schedule-session.jpg';


function resolveRunDistanceKm(run) {
  const km = Number(run?.distanceKm || 0);
  if (km > 0) return km;
  const meters = Number(run?.distanceMeters || 0);
  return meters > 0 ? meters / 1000 : 0;
}

function formatScheduleTargetDate(dateValue, lang) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}





function getScheduleCountdownLabel(countdownDays, s) {
  if (!Number.isFinite(countdownDays)) return null;
  if (countdownDays < 0) return s('hero_countdown_passed');
  if (countdownDays === 0) return s('hero_countdown_today');
  if (countdownDays === 1) return s('hero_countdown_day');
  return s('hero_countdown_days', { days: countdownDays });
}

function getDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function scheduleTag(workoutType, s) {
  const normalized = String(workoutType || '').trim().toUpperCase();
  switch (normalized) {
    case 'QUALITY':
      return s('speed_focus');
    case 'LONG_RUN':
      return s('endurance_peak');
    case 'RECOVERY':
      return s('recovery');
    case 'BASE':
      return s('steady');
    case 'REST':
      return s('active_rest');
    default:
      return s('training_block');
  }
}

function buildReadinessModel(recommendationBundle, coachState, t) {
  const recommendation = recommendationBundle?.recommendation;
  const score = resolveCoachReadinessScore({ state: coachState });

  const label = resolveCoachReadinessLabel({ state: coachState }, t);

  return {
    score,
    label,
    copy: recommendation?.purpose || t('profile.dashboard_readiness_fallback'),
  };
}

function buildWeekSchedule(schedule, runs, weekStart, t, s, lang, unit, todayWorkout, todayKey, timeZone) {
  const scheduleMap = new Map();
  (Array.isArray(schedule) ? schedule : []).forEach((entry) => {
    if (entry?.scheduledDate) {
      scheduleMap.set(entry.scheduledDate, entry);
    }
  });

  return Array.from({ length: 7 }, (_, index) => {
    const key = addCalendarDays(weekStart, index);
    const date = calendarDate(key);
    const entry = scheduleMap.get(key) || (todayWorkout?.scheduledDate === key ? todayWorkout : null);
    const dayRuns = runs.filter((run) => {
      return getActivityDateKey(run, timeZone) === key;
    });
    const completedKm = dayRuns.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
    const title = entry?.authored?entry.title:entry?.publishedType?t(`training_plan.${entry.publishedType==='RUN_WALK'?'RUN_WALK_KIND':entry.publishedType}`):entry ? prettifyWorkoutType(entry.workoutType, t) : s('open_slot');
    const detail = entry?.plannedDistanceKm
      ? formatDistance(entry.plannedDistanceKm, 1, lang, unit)
      : entry?.plannedDurationMinutes
        ? formatPlannedDuration(entry.plannedDurationMinutes)
        : s('no_distance');

    const tone = entry?.workoutType === 'QUALITY'
      ? 'quality'
      : entry?.workoutType === 'LONG_RUN'
        ? 'peak'
        : entry?.workoutType === 'REST'
          ? 'rest'
          : entry?.workoutType === 'RECOVERY' ? 'recovery' : 'default';

    return {
      key,
      dayLabel: date.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 3).toUpperCase(),
      title,
      tag: entry?.authored?t('training_integration.authoredWorkout'):scheduleTag(entry?.workoutType, s),
      detail,
      entry,
      completedKm,
      isToday: key === todayKey,
      tone,
    };
  });
}

function pickCurrentGear(shoes) {
  const list = Array.isArray(shoes) ? shoes : [];
  return list.find((shoe) => shoe?.isPrimary && !shoe?.retired)
    || list.find((shoe) => !shoe?.retired)
    || list[0]
    || null;
}

function buildPlannedRoutePreview(waypoints) {
  const points = (Array.isArray(waypoints) ? waypoints : [])
    .map(normalizeRouteWaypoint)
    .filter(Boolean);
  if (points.length < 2) return null;

  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  const maxLng = Math.max(...points.map((point) => point.lng));
  const latSpan = Math.max(0.00012, maxLat - minLat);
  const lngSpan = Math.max(0.00012, maxLng - minLng);
  const padding = 10;
  const scale = 100 - padding * 2;
  const projected = points.map((point) => ({
    x: padding + ((point.lng - minLng) / lngSpan) * scale,
    y: padding + ((maxLat - point.lat) / latSpan) * scale,
  }));
  const path = projected
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const start = projected[0];
  const finish = projected[projected.length - 1];
  return {
    path,
    startX: start.x,
    startY: start.y,
    finishX: finish.x,
    finishY: finish.y,
  };
}

function selectPlannedRouteRecommendation(plannedRoutes, targetDistanceKm, anchor) {
  if (!anchor || !(targetDistanceKm > 0)) return null;
  const candidates = (Array.isArray(plannedRoutes) ? plannedRoutes : [])
    .map((route) => {
      const actualDistanceKm = Number(route?.actualDistanceKm || 0);
      const waypoints = extractRouteWaypoints(route);
      const preview = waypoints ? buildPlannedRoutePreview(route?.waypoints) : null;
      const desiredDistanceKm = targetDistanceKm;
      if (!isRouteRecommendationUsable(route, desiredDistanceKm) || !isRouteNearAnchor(route, anchor)) return null;
      const distanceGapKm = Math.abs(actualDistanceKm - desiredDistanceKm);
      const distanceAccuracy = Number(route?.distanceAccuracy || (desiredDistanceKm > 0 ? actualDistanceKm / desiredDistanceKm : 1));
      const createdAt = new Date(route?.createdAt || 0).getTime();
      return {
        zoneKey: 'core',
        confidence: distanceGapKm <= Math.max(1, desiredDistanceKm * 0.12) ? 'distance-match' : 'near-match',
        targetDistanceKm: desiredDistanceKm,
        representativeDistanceKm: actualDistanceKm,
        activityCount: 1,
        preview,
        waypoints,
        source: 'planner',
        anchorSource: route.anchorSource,
        actualDistanceKm,
        distanceGapKm,
        distanceAccuracy,
        elevationGainMeters: Number(route?.elevationGainMeters || 0),
        estimatedTimeMinutes: Number(route?.estimatedTimeMinutes || 0),
        elevationPreference: String(route?.elevationPreference || 'rolling').toLowerCase(),
        createdAt: Number.isFinite(createdAt) ? createdAt : 0,
      };
    })
    .filter(Boolean);

  return candidates.sort((a, b) => (
    a.distanceGapKm - b.distanceGapKm
      || b.createdAt - a.createdAt
  ))[0] || null;
}

function getRouteElevationPreferenceLabel(preference, s) {
  switch (String(preference || '').toLowerCase()) {
    case 'flat':
      return s('route_elevation_flat');
    case 'hilly':
      return s('route_elevation_hilly');
    default:
      return s('route_elevation_rolling');
  }
}

function getRouteZoneLabel(zoneKey, s) {
  return s(`routeZone.${zoneKey}`);
}

function getRouteAnchoredRunsLabel(routeRecommendation, s) {
  if (!routeRecommendation) {
    return s('routeAnchoredRuns.waiting');
  }
  return s('routeAnchoredRuns.runs_anchored', { count: routeRecommendation.activityCount });
}

function getRouteConfidenceLabel(routeRecommendation, s, unit, lang) {
  if (!routeRecommendation) {
    return s('routeConfidence.waiting');
  }

  const distanceKm = Number(routeRecommendation.representativeDistanceKm ?? routeRecommendation.actualDistanceKm);
  return Number.isFinite(distanceKm) && distanceKm > 0
    ? s('route_recorded_distance', { distance: formatDistance(distanceKm, 1, lang, unit) })
    : s('routeConfidence.built_from_history');
}

export default function ScheduleRoute() {
  return <VersionedPlanRoute variant="schedule"><Schedule /></VersionedPlanRoute>;
}

function Schedule() {
  const recommendationRevision = useRecommendationRevision();
  const selection=useVersionedPlan();
  const activePlan=selection.data?.plan;
  const [selectedWeek,setSelectedWeek]=useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const planDate=selection.data?.localDate||new Date().toISOString().slice(0,10);
  const publishedWeek=selectedWeek||mondayOf(activePlan?(planDate<activePlan.inputs.startDate?activePlan.inputs.startDate:planDate>activePlan.inputs.endDate?activePlan.inputs.endDate:planDate):planDate);
  const published=usePublishedCalendar(activePlan,publishedWeek);
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const s = useCallback((key, vars) => t(`schedule.${key}`, vars), [t]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [profile, setProfile] = useState(null);
  const todayKey = useAccountDate(activePlan?.inputs.timeZone||profile?.timeZone);
  const weekStart = activePlan ? publishedWeek : selectedWeek || accountWeekStart(todayKey);
  const authored=useAuthoredCalendar(weekStart);
  const authoredToday=authoredOn(authored.events,todayKey).length>0;
  const [runs, setRuns] = useState([]);
  const [coachState, setCoachState] = useState(null);
  const [coachToday, setCoachToday] = useState(null);
  const [coachSchedule, setCoachSchedule] = useState([]);
  const [shoes, setShoes] = useState([]);
  const [plannedRoutes, setPlannedRoutes] = useState([]);
  const [routeAnchor, setRouteAnchor] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [autoPlanning, setAutoPlanning] = useState(false);
  const [loadedRecommendationRevision, setLoadedRecommendationRevision] = useState(null);

  const routeMapRef = useRef(null);
  const didAutoPlanRef = useRef(false);

  useEffect(() => {
    if(authored.loading)return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadSchedule() {
      // Background calendar/source refreshes must not unmount an open authoring tool.
      // The account-keyed route provider remounts this component when credentials change.
      setLoadState(current=>current==='ready'?'ready':'loading');
      try {
        const [profileData, activitiesData, coachStateData, coachTodayData, coachScheduleData, shoeData, plannedRouteData, anchorData] = await Promise.all([
          cachedApiJson('/api/profile/me').catch(error=>{if(activePlan)return null;throw error;}),
          cachedApiJson('/api/activities').catch(error=>{if(activePlan)return [];throw error;}),
          apiJson('/api/coach/state').catch(() => null),
          selection.allowLegacy&&!authoredToday?apiJson('/api/coach/today').catch(() => null):null,
          selection.allowLegacy?apiJson('/api/coach/schedule?days=14').catch(() => []):[],
          apiJson('/api/shoes').catch(() => []),
          apiJson('/api/route/plan/recent').catch(() => []),
          apiJson('/api/route/plan/anchor').catch(() => null),
        ]);

        if (cancelled) return;

        const list = Array.isArray(activitiesData) ? activitiesData : [];
        list.sort((a, b) => activitySortTime(b) - activitySortTime(a));

        setProfile(profileData);
        setRuns(list);
        setCoachState(coachStateData && typeof coachStateData === 'object' ? coachStateData : null);
        setCoachToday(activePlan?{state:coachStateData,today:asCoachWorkout(selection.data.workout)}:coachTodayData && typeof coachTodayData === 'object' ? coachTodayData : null);
        const currentSchedule = Array.isArray(coachTodayData?.schedule) && coachTodayData.schedule.length > 0
          ? coachTodayData.schedule : Array.isArray(coachScheduleData) ? coachScheduleData : [];
        const sharedSchedule = new Map((Array.isArray(coachTodayData?.weekSchedule) ? coachTodayData.weekSchedule : [])
          .map(entry => [entry.scheduledDate, entry]));
        currentSchedule.forEach(entry => sharedSchedule.set(entry.scheduledDate, entry));
        if (coachTodayData?.today?.scheduledDate) sharedSchedule.set(coachTodayData.today.scheduledDate, coachTodayData.today);
        setCoachSchedule([...sharedSchedule.values()]);
        setShoes(Array.isArray(shoeData) ? shoeData : []);
        setPlannedRoutes(Array.isArray(plannedRouteData) ? plannedRouteData : []);
        setRouteAnchor(normalizeRouteAnchor(anchorData));
        setLoadedRecommendationRevision(recommendationRevision);
        setLoadState('ready');
      } catch {
        if (!cancelled) {
          setLoadState(current=>current==='ready'?'ready':'error');
        }
      }
    }

    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate, todayKey, selection.allowLegacy, selection.data, activePlan,authored.loading,authoredToday, recommendationRevision]);

  const recommendationBundle = useMemo(
    () => getTodayRunRecommendation({ runs, t, lang, unit, coachPayload: coachToday, timeZone: profile?.timeZone, todayKey }),
    [runs, t, lang, unit, coachToday, profile?.timeZone, todayKey],
  );
  const vdotTrend = useMemo(
    () => computeVdotTrend(runs),
    [runs],
  );

  const readiness = useMemo(
    () => buildReadinessModel(recommendationBundle, coachToday?.state || coachState, t),
    [recommendationBundle, coachToday, coachState, t],
  );

  const weekSchedule = useMemo(
    () => {
      const prescribed=activePlan?(published.data?.weeks||[]).flatMap(w=>w.days).map(asCoachWorkout):[
        ...coachSchedule.filter(entry=>!authoredOn(authored.events,entry.scheduledDate).length),
        ...[...new Set(authored.events.filter(e=>e.state!=='cancelled').map(e=>e.date))].map(date=>asAuthoredWorkout(authoredOn(authored.events,date))),
      ];
      return buildWeekSchedule(prescribed, runs, weekStart, t, s, lang, unit, coachToday?.today, todayKey, activePlan?.inputs.timeZone||profile?.timeZone);
    },
    [activePlan,published.data,authored.events,coachSchedule, runs, weekStart, t, s, lang, unit, coachToday, todayKey, profile?.timeZone],
  );

  const targetVolumeKm = useMemo(
    () => resolveCoachWeeklyTarget(coachToday, weekStart, accountWeekStart(todayKey),
      weekSchedule.reduce((sum, day) => sum + Number(day.entry?.plannedDistanceKm || 0), 0)),
    [weekSchedule, coachToday, weekStart, todayKey],
  );
  const prescribedMinutes=weekSchedule.reduce((sum,day)=>sum+Number(day.entry?.plannedDurationMinutes||0),0);

  const completedVolumeKm = useMemo(
    () => coachToday?.plan?.weeklyBudgets?.find(week => week.start === weekStart)?.completedKm
      ?? weekSchedule.reduce((sum, day) => sum + Number(day.completedKm || 0), 0),
    [weekSchedule, coachToday, weekStart],
  );

  const nextSession = useMemo(
    () => selectNextSessionForWeek(activePlan||authored.events.some(e=>e.state!=='cancelled')?weekSchedule.map(d=>d.entry).filter(Boolean):coachSchedule, todayKey, weekStart),
    [activePlan,authored.events,weekSchedule,coachSchedule, todayKey, weekStart],
  );

  const currentGear = useMemo(
    () => pickCurrentGear(shoes),
    [shoes],
  );

  const activeBlock = activePlan?null:coachState?.activeBlock || null;
  const targetBlock = useMemo(
    () => buildScheduleTargetBlockModel(activeBlock),
    [activeBlock],
  );
  const displayName = getDisplayName(profile, t('profile.default_name'));
  const initials = displayName.slice(0, 1).toUpperCase();
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'schedule',
  }), [lang, t]);
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);

  const heroTitle = activePlan?.title || (targetBlock.hasActiveBlock
    ? targetBlock.isMarathonBlock
      ? s('hero_title_marathon')
      : s('hero_title_block')
    : s('hero_title'));
  const raceTargetDistanceLabel = targetBlock.raceDistanceKm != null
    ? formatDistance(targetBlock.raceDistanceKm, 1, lang, unit)
    : null;
  const longRunAnchorLabel = targetBlock.currentLongRunKm != null
    ? formatDistance(targetBlock.currentLongRunKm, 1, lang, unit)
    : s('no_distance');
  const targetRaceDateLabel = useMemo(
    () => formatScheduleTargetDate(targetBlock.targetRaceDate, lang),
    [targetBlock.targetRaceDate, lang],
  );
  const targetCountdownLabel = useMemo(
    () => getScheduleCountdownLabel(targetBlock.countdownDays, s),
    [targetBlock.countdownDays, s],
  );
  const heroDescription = targetBlock.hasActiveBlock
    ? [s('phase_label', { week: targetBlock.weekIndex || 1 }), targetBlock.name,
      raceTargetDistanceLabel, targetRaceDateLabel, targetCountdownLabel].filter(Boolean).join(' · ')
    : s('week_intro');
  const weekDateLabel = new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  }).formatRange(calendarDate(weekStart), calendarDate(addCalendarDays(weekStart, 6)));
  const changeWeek = (date) => {
    setSelectedWeek(date);
    setSelectedDate(date);
    setShowSessionDetails(false);
  };

  const nextSessionTitle = nextSession?.authored?nextSession.title:activePlan ? (nextSession?t(`training_plan.${nextSession.publishedType==='RUN_WALK'?'RUN_WALK_KIND':nextSession.publishedType}`):t('training_plan.restHelp')) : nextSession
    ? prettifyWorkoutType(nextSession.workoutType, t)
    : recommendationBundle.recommendation.title;

  const nextSessionCopy = nextSession?.authored?`${t('training_integration.authoredWorkout')} · ${formatPlannedDuration(nextSession.plannedDurationMinutes)}`:activePlan ? (nextSession?`${activePlan.title} · ${t(`training_plan.${nextSession.phase}`)}`:t('training_plan.restHelp')) : nextSession
    ? nextSession.notes || localizedReason(nextSession.reasonCode, t, {
      sessionNeutral: nextSession.scheduledDate > todayKey,
    })
    : recommendationBundle.recommendation.purpose;
  const selectedDay = weekSchedule.find((day) => day.key === selectedDate);
  const featuredDay = selectedDay || weekSchedule.find((day) => day.key === nextSession?.scheduledDate)
    || (!nextSession ? weekSchedule.find((day) => day.isToday) : null);
  useEffect(() => {
    // Keep the initially displayed day selected when background replanning changes the next run.
    if (loadState === 'ready' && featuredDay) setSelectedDate(current => current || featuredDay.key);
  }, [loadState, featuredDay]);
  const featuredEntry = selectedDay ? selectedDay.entry : nextSession;
  const featuredTitle = selectedDay ? selectedDay.title : nextSessionTitle;
  const featuredCopy = selectedDay
    ? selectedDay.entry?.notes || (selectedDay.entry?.authored
      ? t('training_integration.authoredWorkout')
      : selectedDay.entry?.publishedType
        ? selectedDay.entry.workoutType === 'REST'
          ? t('training_plan.restHelp')
          : [activePlan?.title, selectedDay.entry.phase ? t(`training_plan.${selectedDay.entry.phase}`) : null].filter(Boolean).join(' · ')
        : selectedDay.entry
          ? localizedReason(selectedDay.entry.reasonCode, t, { sessionNeutral: !selectedDay.isToday })
          : s('open_slot_copy'))
    : nextSessionCopy;
  const featuredDate = selectedDay?.key || nextSession?.scheduledDate || todayKey;
  const featuredIsToday = featuredDate === todayKey;
  const featuredCompletedRun = runs.find((run) => getActivityDateKey(run, activePlan?.inputs.timeZone || profile?.timeZone) === featuredDate);
  const featuredMeta = [featuredEntry?.plannedDistanceKm > 0
    ? formatDistance(featuredEntry.plannedDistanceKm, 1, lang, unit)
    : featuredEntry?.plannedDurationMinutes > 0 ? formatPlannedDuration(featuredEntry.plannedDurationMinutes) : null,
  featuredEntry ? scheduleTag(featuredEntry.workoutType, s) : null].filter(Boolean).join(' · ');
  const openFeaturedSession = () => {
    if (activePlan && featuredEntry?.id) navigate(planWorkoutUrl(activePlan.id, featuredEntry.id));
    else if (featuredCompletedRun?.id) navigate(`/runs/${featuredCompletedRun.id}`);
    else if (featuredIsToday) navigate('/today-run');
    else setShowSessionDetails((current) => !current);
  };
  const weeklyAcwr = recommendationBundle.metrics?.acwr ?? null;
  const weeklyAcwrLabel = weeklyAcwr != null ? weeklyAcwr.toFixed(2) : '--';
  const weeklyCoachSummary = useMemo(
    () => buildWeeklyCoachSummaryModel({
      vdotTrend,
      acwr: weeklyAcwr,
      targetBlock,
      nextSessionTitle,
      coachPayload: coachToday,
    }),
    [coachToday, nextSessionTitle, targetBlock, vdotTrend, weeklyAcwr],
  );

  const weeklySummaryTrendLine = useMemo(() => {
    if (weeklyCoachSummary.trendState === 'improving') {
      return s('weekly_summary_trend_improving', { delta: Math.abs(vdotTrend.delta).toFixed(1) });
    }
    if (weeklyCoachSummary.trendState === 'declining') {
      return s('weekly_summary_trend_declining', { delta: Math.abs(vdotTrend.delta).toFixed(1) });
    }
    if (weeklyCoachSummary.trendState === 'steady') {
      return s('weekly_summary_trend_steady');
    }
    return s('weekly_summary_trend_unknown');
  }, [s, vdotTrend.delta, weeklyCoachSummary.trendState]);

  const weeklySummaryLoadLine = useMemo(() => {
    switch (weeklyCoachSummary.loadState) {
      case 'planner':
        return s('weekly_summary_load_planner', {
          reason: localizedReason(weeklyCoachSummary.plannerReasonCode, t, {
            planContext: weeklyCoachSummary.plannerReasonIsPlan,
            sessionNeutral: true,
          }),
        });
      case 'low':
        return s('weekly_summary_load_low', { acwr: weeklyAcwrLabel });
      case 'optimal':
        return s('weekly_summary_load_optimal', { acwr: weeklyAcwrLabel });
      case 'high':
        return s('weekly_summary_load_high', { acwr: weeklyAcwrLabel });
      case 'danger':
        return s('weekly_summary_load_danger', { acwr: weeklyAcwrLabel });
      default:
        return s('weekly_summary_load_unknown');
    }
  }, [s, t, weeklyAcwrLabel, weeklyCoachSummary.loadState, weeklyCoachSummary.plannerReasonCode, weeklyCoachSummary.plannerReasonIsPlan]);

  const weeklySummaryFocusLine = useMemo(() => {
    if (weeklyCoachSummary.focusMode === 'target-race') {
      return s('weekly_summary_focus_target_race', {
        week: weeklyCoachSummary.focus.weekIndex || 1,
        raceDistance: raceTargetDistanceLabel || '--',
      });
    }
    if (weeklyCoachSummary.focusMode === 'training-block') {
      return s('weekly_summary_focus_training_block', {
        week: weeklyCoachSummary.focus.weekIndex || 1,
        longRun: longRunAnchorLabel,
      });
    }
    return s('weekly_summary_focus_next_session', {
      session: weeklyCoachSummary.focus.nextSessionTitle || nextSessionTitle,
    });
  }, [
    longRunAnchorLabel,
    nextSessionTitle,
    raceTargetDistanceLabel,
    s,
    weeklyCoachSummary.focus.nextSessionTitle,
    weeklyCoachSummary.focus.weekIndex,
    weeklyCoachSummary.focusMode,
  ]);

  const weeklySummaryBody = useMemo(
    () => s('weekly_summary_body', {
      trend: weeklySummaryTrendLine,
      load: weeklySummaryLoadLine,
      focus: weeklySummaryFocusLine,
    }),
    [s, weeklySummaryFocusLine, weeklySummaryLoadLine, weeklySummaryTrendLine],
  );

  const weeklySummaryTrendValue = useMemo(() => {
    if (weeklyCoachSummary.trendState === 'improving') {
      return s('weekly_summary_trend_value_improving', { delta: Math.abs(vdotTrend.delta).toFixed(1) });
    }
    if (weeklyCoachSummary.trendState === 'declining') {
      return s('weekly_summary_trend_value_declining', { delta: Math.abs(vdotTrend.delta).toFixed(1) });
    }
    if (weeklyCoachSummary.trendState === 'steady') {
      return s('weekly_summary_trend_value_steady');
    }
    return s('weekly_summary_trend_value_unknown');
  }, [s, vdotTrend.delta, weeklyCoachSummary.trendState]);

  const weeklySummaryLoadValue = useMemo(() => {
    switch (weeklyCoachSummary.loadState) {
      case 'planner':
        return s('weekly_summary_load_value_planner');
      case 'low':
        return s('weekly_summary_load_value_low', { acwr: weeklyAcwrLabel });
      case 'optimal':
        return s('weekly_summary_load_value_optimal', { acwr: weeklyAcwrLabel });
      case 'high':
        return s('weekly_summary_load_value_high', { acwr: weeklyAcwrLabel });
      case 'danger':
        return s('weekly_summary_load_value_danger', { acwr: weeklyAcwrLabel });
      default:
        return s('weekly_summary_load_value_unknown');
    }
  }, [s, weeklyAcwrLabel, weeklyCoachSummary.loadState]);

  const weeklySummaryFocusValue = useMemo(() => {
    if (weeklyCoachSummary.focusMode === 'target-race') {
      return raceTargetDistanceLabel || '--';
    }
    if (weeklyCoachSummary.focusMode === 'training-block') {
      return s('phase_label', { week: weeklyCoachSummary.focus.weekIndex || 1 });
    }
    return weeklyCoachSummary.focus.nextSessionTitle || nextSessionTitle;
  }, [
    nextSessionTitle,
    raceTargetDistanceLabel,
    s,
    weeklyCoachSummary.focus.nextSessionTitle,
    weeklyCoachSummary.focus.weekIndex,
    weeklyCoachSummary.focusMode,
  ]);

  const recoverySignals = buildScheduleRecoverySignals({
    metrics: recommendationBundle.metrics,
    coachState,
    t: s,
  });
  const dailyRouteWorkout = activePlan
    ? asCoachWorkout(selection.data?.workout)
    : authoredToday ? asAuthoredWorkout(authoredOn(authored.events, todayKey)) : coachToday?.today;
  const runningHistoryStart = addCalendarDays(todayKey, -27);
  const routeInputsCurrent = loadedRecommendationRevision === recommendationRevision && loadState === 'ready' && !selection.refreshing;
  const targetRouteDistanceKm = routeInputsCurrent ? resolveDailyRouteDistanceKm({
    workout: dailyRouteWorkout,
    todayKey,
    explicitPlan: Boolean(activePlan),
    hasRunningHistory: runs.some((run) => {
      const dateKey = getActivityDateKey(run, profile?.timeZone);
      const date = calendarDate(dateKey);
      const distanceKm = resolveRunDistanceKm(run);
      return (!run.activityType || run.activityType === 'RUN')
        && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateKey
        && dateKey >= runningHistoryStart && dateKey <= todayKey
        && Number.isFinite(distanceKm) && distanceKm > 0;
    }),
  }) : null;
  const plannedRouteRecommendation = useMemo(
    () => selectPlannedRouteRecommendation(plannedRoutes, targetRouteDistanceKm, routeAnchor),
    [plannedRoutes, targetRouteDistanceKm, routeAnchor],
  );
  const historyRoute = coachToday?.routeRecommendation;
  const routeRecommendation = plannedRouteRecommendation
    || (targetRouteDistanceKm > 0 && historyRoute
      && isRouteRecommendationUsable({ ...historyRoute, actualDistanceKm: historyRoute.representativeDistanceKm ?? historyRoute.actualDistanceKm }, targetRouteDistanceKm, { requireStreetGraph: false })
      && isRouteNearAnchor(historyRoute, routeAnchor) ? historyRoute : null);
  const routeRecommendationSource = routeRecommendation?.source === 'planner'
    ? 'planner'
    : routeRecommendation ? 'history' : null;
  const noRunningToday = routeInputsCurrent && ['REST', 'CROSS_TRAIN'].includes(dailyRouteWorkout?.workoutType);
  const routeUnavailableCopy = noRunningToday ? s('route_rest_hint')
    : targetRouteDistanceKm > 0 ? s('route_no_match_hint') : s('signal_no_data');
  const routeWaypoints = useMemo(
    () => (Array.isArray(routeRecommendation?.waypoints) ? routeRecommendation.waypoints : [])
      .map(normalizeRouteWaypoint)
      .filter(Boolean),
    [routeRecommendation],
  );
  const hasRoutePreview = Boolean(routeWaypoints && routeWaypoints.length >= 2);
  const routeSketch = routeRecommendation?.preview || null;
  const routeSketchStartX = Number(routeSketch?.startX ?? routeSketch?.start?.[0]);
  const routeSketchStartY = Number(routeSketch?.startY ?? routeSketch?.start?.[1]);
  const routeSketchFinishX = Number(routeSketch?.finishX ?? routeSketch?.finish?.[0]);
  const routeSketchFinishY = Number(routeSketch?.finishY ?? routeSketch?.finish?.[1]);
  const hasRouteSketch = typeof routeSketch?.path === 'string'
    && routeSketch.path.trim().length > 0
    && [routeSketchStartX, routeSketchStartY, routeSketchFinishX, routeSketchFinishY].every(Number.isFinite);
  const routeTitle = routeRecommendation
    ? routeRecommendationSource === 'planner'
      ? s('route_planner_title')
      : getRouteZoneLabel(routeRecommendation.zoneKey, s)
    : noRunningToday ? t('today_run.personalized_distance_rest') : s('planned_route');
  const routeAnchoredRuns = !routeRecommendation ? routeUnavailableCopy : routeRecommendationSource === 'planner'
    ? s(routeRecommendation.anchorSource === 'heatmap-hotspot' ? 'route_planner_source_heatmap' : 'route_planner_source')
    : getRouteAnchoredRunsLabel(routeRecommendation, s);
  const routeConfidenceLabel = routeRecommendationSource === 'planner' && routeRecommendation?.actualDistanceKm
    ? s('route_planner_accuracy', {
      distance: formatDistance(routeRecommendation.actualDistanceKm, 1, lang, unit),
    })
    : getRouteConfidenceLabel(routeRecommendation, s, unit, lang);
  const routeTargetDistanceKm = targetRouteDistanceKm;
  const routeTargetDistanceLabel = routeTargetDistanceKm > 0
    ? formatDistance(routeTargetDistanceKm, 1, lang, unit)
    : null;
  const routeFallbackDistanceBadge = routeTargetDistanceKm > 0
    ? formatDistance(routeTargetDistanceKm, 1, lang, unit)
    : noRunningToday ? t('today_run.personalized_distance_rest') : s('no_distance');
  const routeFallbackStatus = routeRecommendation ? routeConfidenceLabel : routeAnchoredRuns;
  const routeFallbackBadges = [
    routeFallbackDistanceBadge,
    routeRecommendation ? routeAnchoredRuns : noRunningToday ? null : nextSessionTitle,
    targetBlock.hasTargetRace && raceTargetDistanceLabel
      ? raceTargetDistanceLabel
      : targetBlock.weekIndex
        ? s('phase_label', { week: targetBlock.weekIndex || 1 })
        : null,
  ].filter(Boolean);
  const coachTargetValue = [raceTargetDistanceLabel, targetRaceDateLabel].filter(Boolean).join(' / ');

  // Plan from the personal heatmap hotspot and today's supported prescription.
  useEffect(() => {
    if (!routeInputsCurrent || !isAuthenticated || planReadOnly()) return;
    if (!routeAnchor || plannedRouteRecommendation || !(targetRouteDistanceKm > 0) || targetRouteDistanceKm > 50) return;

    const targetDistanceKm = targetRouteDistanceKm;
    const recentWithElevation = runs
      .filter((run) => resolveRunDistanceKm(run) > 0 && Number(run.elevationGainMeters ?? run.totalElevationGain) > 0)
      .slice(0, 5);
    const gains = recentWithElevation.map((run) => (
      Number(run.elevationGainMeters ?? run.totalElevationGain) / resolveRunDistanceKm(run)
    )).filter(Number.isFinite).sort((a, b) => a - b);
    const median = gains.length ? gains[Math.floor(gains.length / 2)] : null;
    const elevationPreference = median === null ? 'rolling' : median < 6 ? 'flat' : median > 12 ? 'hilly' : 'rolling';
    const requestKey = [todayKey, targetDistanceKm, routeAnchor.lat, routeAnchor.lng, elevationPreference].join(':');
    if (didAutoPlanRef.current === requestKey) return;
    didAutoPlanRef.current = requestKey;

    const controller = new AbortController();
    setAutoPlanning(true);
    apiFetch('/api/route/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        startLat: routeAnchor.lat,
        startLng: routeAnchor.lng,
        targetDistanceKm,
        elevationPreference,
        anchorSource: 'heatmap-hotspot',
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Route planning failed: ' + response.status);
        return response.json();
      })
      .then((newRoute) => {
        if (controller.signal.aborted) return;
        setAutoPlanning(false);
        if (isRouteRecommendationUsable(newRoute, targetDistanceKm) && isRouteNearAnchor(newRoute, routeAnchor)) {
          setPlannedRoutes((previous) => [{ ...newRoute, anchorSource: 'heatmap-hotspot' }, ...previous]);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.warn('[Schedule] auto-plan failed:', error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAutoPlanning(false);
      });

    return () => {
      controller.abort();
      setAutoPlanning(false);
      if (didAutoPlanRef.current === requestKey) didAutoPlanRef.current = null;
    };
  }, [routeInputsCurrent, isAuthenticated, routeAnchor, plannedRouteRecommendation, targetRouteDistanceKm, todayKey, runs, recommendationRevision]);

  // Leaflet map effect for the route card
  useEffect(() => {
    const routeMapHost = routeMapRef.current;
    if (loadState !== 'ready' || !routeMapHost || routeWaypoints.length < 2) return;
    let cancelled = false;
    let createdMap = null;

    import('leaflet').then((L) => {
      if (cancelled || routeMapRef.current !== routeMapHost) return;
      const map = L.map(routeMapHost, {
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: true,
      });
      createdMap = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      const latlngs = routeWaypoints.map((pt) => [pt.lat, pt.lng]);
      const polyline = L.polyline(latlngs, {
        color: '#f07561',
        weight: 4,
        opacity: 0.92,
      }).addTo(map);

      L.circleMarker(latlngs[0], {
        radius: 6,
        color: '#ffffff',
        fillColor: '#4caf50',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      L.circleMarker(latlngs[latlngs.length - 1], {
        radius: 7,
        color: '#ffffff',
        fillColor: '#f07561',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [16, 16] });
    });

    return () => {
      cancelled = true;
      createdMap?.remove();
    };
  }, [loadState, routeWaypoints]);

  if (loadState === 'loading') {
    return <PageSkeleton variant="schedule" />;
  }

  if (loadState === 'error') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{s('load_error')}</div></div>;
  }

  return (
    <div className={`runner-shell-page schedule-plan-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle_schedule')}</span>
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
              activeLabel={t('profile.dashboard_nav_schedule')}
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

        <div className="runner-shell-canvas schedule-plan-canvas">
          <section className={`schedule-plan-hero${targetBlock.hasActiveBlock ? ' is-block-active' : ''}${targetBlock.isMarathonBlock ? ' is-marathon-block' : ''}`}>
            <div className="schedule-plan-hero-copy">
              <h1>{heroTitle}</h1>
              <p className="schedule-plan-hero-description">{heroDescription}</p>
              {activePlan&&<p role="note">{t('training_plan.experimentalNotice')}</p>}
            </div>
            <div className="schedule-plan-volume">
              <div className="schedule-plan-volume-labels">
                <span>{s(weekStart === accountWeekStart(todayKey) ? 'this_week' : 'week_volume')}</span>
                <p><strong>{formatDistance(completedVolumeKm, 1, lang, unit)}</strong><span> / {s('volume_planned', { distance: targetVolumeKm > 0 || !prescribedMinutes ? formatDistance(targetVolumeKm, 1, lang, unit) : formatPlannedDuration(prescribedMinutes) })}</span></p>
              </div>
              <div className="schedule-plan-volume-track" role="progressbar" aria-label={s('completed_volume')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={targetVolumeKm > 0 ? Math.min(100, Math.round(completedVolumeKm / targetVolumeKm * 100)) : 0}>
                <span style={{ width: `${targetVolumeKm > 0 ? Math.min(100, completedVolumeKm / targetVolumeKm * 100) : 0}%` }} />
              </div>
            </div>
          </section>

          <RecommendationEvidence payload={coachToday} weekStart={weekStart} workout={featuredEntry} />
          <section className="schedule-plan-calendar" aria-label={s('week_calendar')}>
            <div className="schedule-plan-calendar-toolbar">
              <div className="schedule-plan-week-nav">
                <button type="button" aria-label={t('training_plan.previous')} disabled={Boolean(activePlan && weekStart <= activePlan.inputs.startDate)} onClick={() => changeWeek(addCalendarDays(weekStart, -7))}>‹</button>
                <h2>{weekDateLabel}</h2>
                <button type="button" aria-label={t('training_plan.nextWeek')} disabled={Boolean(activePlan && addDays(weekStart, 6) >= activePlan.inputs.endDate)} onClick={() => changeWeek(addCalendarDays(weekStart, 7))}>›</button>
                {weekStart !== accountWeekStart(todayKey) && <button type="button" className="schedule-plan-current-week" onClick={() => changeWeek(null)}>{s('this_week')}</button>}
              </div>
              <ScheduleAuthoringTools />
            </div>
          {activePlan&&authored.events.some(e=>e.state!=='cancelled')&&<p role="status">{t('training_integration.generatedPriority')}</p>}
          {activePlan&&<div className="tp-ui tp-embedded schedule-plan-published-status">{published.error&&<p role="alert">{t('training_plan.error')} <button type="button" onClick={published.reload}>{t('training_plan.retry')}</button></p>}{published.loading&&<p role="status">{t('training_plan.loading')}</p>}{published.data&&<p>{t('training_plan.trainingOnly')}: {published.data.weeks.map(w=>[w.trainingDistanceM!=null?formatDistance(w.trainingDistanceM/1000,1,lang,unit):null,w.trainingDurationS!=null?formatPlannedDuration(w.trainingDurationS/60):null].filter(Boolean).join(' · ')).join(' · ')} · {t('training_plan.actual')}: {formatDistance(published.data.actualDistanceM/1000,1,lang,unit)} · {t('training_plan.actualDuration')}: {formatPlannedDuration(published.data.actualDurationS/60)}</p>}{published.data?.unknownDateCount>0&&<p>{t('training_plan.unknownDate')}</p>}</div>}
          <AuthoredWeekProvider source={authored}><section className="schedule-plan-week-grid">
            {weekSchedule.map((day) => {
              const isLongRunAnchor = targetBlock.hasActiveBlock && String(day.entry?.workoutType || '').toUpperCase() === 'LONG_RUN';
              const isReadinessDeferred = Boolean(day.entry?.readinessAdjusted && day.entry?.mutatedFrom);
              return (
                <article
                  key={day.key}
                  aria-label={day.key}
                  className={`schedule-plan-day schedule-plan-day--${day.tone}${day.isToday ? ' is-today' : ''}${day.key === (selectedDate || featuredDay?.key) ? ' is-selected' : ''}${isLongRunAnchor ? ' is-marathon-anchor' : ''}${isReadinessDeferred ? ' is-readiness-deferred' : ''}`}
                >
                  <button type="button" className="schedule-plan-day-select" aria-pressed={day.key === (selectedDate || featuredDay?.key)} aria-controls="schedule-featured-session" onClick={() => { setSelectedDate(day.key); setShowSessionDetails(false); }}>
                    <div className="schedule-plan-day-head">
                      <span className="schedule-plan-day-label">{day.dayLabel} {Number(day.key.slice(-2))}</span>
                      {day.isToday ? <span className="schedule-plan-day-today-badge">{s('today_badge')}</span> : day.completedKm > 0 ? <span className="schedule-plan-day-check" aria-label={s('completed_volume')}>✓</span> : null}
                    </div>
                    <span className="schedule-plan-day-rule" aria-hidden="true" />
                    <span className="schedule-plan-day-title">{day.title}</span>
                    <span className="schedule-plan-day-distance">{day.entry?.workoutType === 'REST' ? '—' : day.detail}</span>
                    {isReadinessDeferred && (
                      <span className="schedule-plan-day-deferred-badge">
                        {s('readinessDeferred.badge', {
                          originalType: prettifyWorkoutType(day.entry.mutatedFrom, t),
                          newType: prettifyWorkoutType(day.entry.workoutType, t),
                        })}
                      </span>
                    )}
                    {day.completedKm > 0 && <span className="schedule-plan-day-done">{s('distance_done', { distance: formatDistance(day.completedKm, 1, lang, unit) })}</span>}
                    <span className="schedule-plan-day-tag">{isLongRunAnchor ? s('long_run_anchor') : day.tag}</span>
                  </button>
                  <div className="schedule-plan-day-extras">
                    {activePlan&&day.entry&&<><p>{t(`training_plan.${day.entry.state}`)}</p><button type="button" onClick={()=>navigate(planWorkoutUrl(activePlan.id,day.entry.id))}>{t('training_plan.details')}</button></>}
                    {activePlan&&authoredOn(authored.events,day.key).length>0&&<h3>{t('training_integration.otherScheduled')}</h3>}<AuthoredDayEntries date={day.key} source={authored}/>
                  </div>
                </article>
              );
            })}
          </section></AuthoredWeekProvider>
          </section>

          <details className="schedule-plan-management" open={Boolean(new URLSearchParams(window.location.search).get('planView')) || undefined}>
            <summary>{t('training_plan.title')}</summary>
            <SchedulePlanTools />
          </details>

          <section className="schedule-plan-bottom-grid">
            <div className="schedule-plan-left-rail">
                <article className="schedule-plan-next-card" id="schedule-featured-session" aria-label={s('selected_session')}>
                  <div className="schedule-plan-next-content">
                    <span>{featuredIsToday ? s('today_badge') : calendarDate(featuredDate).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                    <h3>{featuredTitle}</h3>
                    {featuredMeta && <div className="schedule-plan-session-meta">{featuredMeta}</div>}
                    <p>{featuredCopy}</p>
                    <div className="schedule-plan-readiness-card">
                  <div className="schedule-plan-readiness-ring">
                    <svg viewBox="0 0 220 220" aria-hidden="true">
                      <circle cx="110" cy="110" r="92" className="schedule-plan-readiness-track" />
                      <circle
                        cx="110"
                        cy="110"
                        r="92"
                        className="schedule-plan-readiness-progress"
                        style={{ strokeDasharray: 578, strokeDashoffset: 578 - ((578 * (readiness.score ?? 0)) / 100) }}
                      />
                    </svg>
                    <div className="schedule-plan-readiness-center">
                      <strong>{readiness.score ?? '—'}</strong>
                    </div>
                  </div>
                  <div className="schedule-plan-readiness-copy"><span>{s('readiness_title')}</span><strong>{readiness.label}</strong><p>{s('readiness_context')}</p></div>
                    </div>
                    <div className="schedule-plan-session-actions">
                    <button type="button" className="schedule-plan-session-primary" onClick={openFeaturedSession}>
                      {featuredIsToday ? s('view_drills') : featuredCompletedRun?.id ? s('open_run') : s('open_session')}
                      <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
                    </button>
                    <button type="button" className="schedule-plan-session-details" aria-expanded={showSessionDetails} aria-controls="schedule-session-details" onClick={() => setShowSessionDetails((current) => !current)}>{t('training_plan.details')}</button>
                    </div>
                    {showSessionDetails && <div className="schedule-plan-session-expanded" id="schedule-session-details">
                      <strong>{calendarDate(featuredDate).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { dateStyle: 'full', timeZone: 'UTC' })}</strong>
                      <p>{featuredMeta || s('open_slot_copy')}</p>
                      {featuredEntry?.plannedDurationMinutes > 0 && <p>{formatPlannedDuration(featuredEntry.plannedDurationMinutes)}</p>}
                      {featuredDay?.completedKm > 0 && <p>{s('distance_done', { distance: formatDistance(featuredDay.completedKm, 1, lang, unit) })}</p>}
                      <p>{featuredCopy}</p>
                    </div>}
                  </div>
                  <div className="schedule-plan-session-photo" aria-hidden="true"><img src={scheduleSessionPhoto} alt="" /></div>
                </article>

              <article className={`schedule-plan-route-card${hasRoutePreview ? ' has-route-preview' : ' is-route-fallback'}`}>
                <div className="schedule-plan-route-map" role="region" aria-label={s('planned_route')}>
                  {hasRoutePreview ? (
                    <div ref={routeMapRef} className="schedule-plan-route-leaflet-map" />
                  ) : (
                    <>
                      {hasRouteSketch ? (
                        <svg className="schedule-plan-route-map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                          <path d={routeSketch.path} className="schedule-plan-route-map-shadow" />
                          <path d={routeSketch.path} className="schedule-plan-route-map-line" />
                          <circle cx={routeSketchStartX} cy={routeSketchStartY} r="3.4" className="schedule-plan-route-map-start" />
                          <circle cx={routeSketchFinishX} cy={routeSketchFinishY} r="4" className="schedule-plan-route-map-finish" />
                        </svg>
                      ) : null}
                      {autoPlanning && !hasRouteSketch ? (
                        <div className="schedule-plan-route-empty-panel schedule-plan-route-empty-panel--loading">
                          <div className="schedule-plan-route-auto-spinner" aria-hidden="true" />
                          <div className="schedule-plan-route-empty-copy">
                            <span>{s('route_auto_loading')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`schedule-plan-route-empty-panel${hasRouteSketch ? ' has-route-sketch' : ''}`}>
                          <div className="schedule-plan-route-empty-badges">
                            {routeFallbackBadges.map((badge) => (
                              <span key={badge} className="schedule-plan-route-empty-badge">{badge}</span>
                            ))}
                          </div>
                          <div className="schedule-plan-route-empty-copy">
                            <strong>{routeTitle}</strong>
                            <span>{runs.length === 0 ? s('route_auto_empty_hint') : routeFallbackStatus}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="schedule-plan-route-content">
                  <div>
                    <span>{s(routeRecommendationSource === 'history' ? 'route_history_label' : 'planned_route')}</span>
                    <h3>{routeTitle}</h3>
                    <div className="schedule-plan-route-meta">
                      <span>{routeAnchoredRuns}</span>
                    </div>
                    <dl className="schedule-plan-route-insight schedule-plan-route-facts" aria-label={s('route_planner_insights')}>
                      {(routeTargetDistanceLabel || dailyRouteWorkout?.workoutType === 'REST') && <div className="schedule-plan-route-target"><dt>{s('route_target_label')}</dt><dd className="schedule-plan-route-distance">{routeTargetDistanceLabel || t('today_run.personalized_distance_rest')}</dd></div>}
                      <div><dt>{s('route_length')}</dt><dd className="schedule-plan-route-distance">{routeRecommendation?.actualDistanceKm || routeRecommendation?.representativeDistanceKm
                        ? formatDistance(Number(routeRecommendation.actualDistanceKm || routeRecommendation.representativeDistanceKm), 1, lang, unit)
                        : s('signal_no_data')}</dd></div>
                      <div><dt>{s('route_elevation')}</dt><dd>{routeRecommendationSource === 'planner' ? getRouteElevationPreferenceLabel(routeRecommendation.elevationPreference, s) : s('signal_no_data')}</dd></div>
                      <div><dt>{s('route_roads')}</dt><dd>{noRunningToday ? '—' : s(routeRecommendationSource === 'planner' ? 'route_planner_safety' : routeRecommendation ? 'route_history_hint' : 'route_planner_safety_pending')}</dd></div>
                    </dl>
                  </div>
                  <button type="button" className="schedule-plan-watch-btn" disabled={!(targetRouteDistanceKm > 0) || !hasRoutePreview} onClick={() => navigate('/today-run')}>
                    {s('sync_to_watch')}
                  </button>
                </div>
              </article>
            </div>

            <aside className="schedule-plan-right-rail">
              <article className="schedule-plan-coach-card">
                <div className="schedule-plan-coach-head">
                  <div>
                    <h3>{s('coach_title')}</h3>
                    <p>{s('coach_subtitle')}</p>
                  </div>
                  <CoachIdentityBadge coach={assignedCoach} lang={lang} className="schedule-plan-coach-badge" />
                </div>

                <div className={`schedule-plan-weekly-summary is-${weeklyCoachSummary.loadState}`}>
                  <span className="schedule-plan-weekly-summary-kicker">{s('weekly_summary_eyebrow')}</span>
                  <p className="schedule-plan-weekly-summary-body">{weeklySummaryBody}</p>
                  <div className="schedule-plan-coach-focus-grid schedule-plan-coach-focus-grid--summary">
                    <div className="schedule-plan-coach-focus-pill">
                      <span>{s('weekly_summary_metric_fitness')}</span>
                      <strong>{weeklySummaryTrendValue}</strong>
                    </div>
                    <div className="schedule-plan-coach-focus-pill">
                      <span>{s('weekly_summary_metric_load')}</span>
                      <strong>{weeklySummaryLoadValue}</strong>
                    </div>
                    <div className="schedule-plan-coach-focus-pill">
                      <span>{s('weekly_summary_metric_focus')}</span>
                      <strong>{weeklySummaryFocusValue}</strong>
                    </div>
                  </div>
                </div>

                {targetBlock.hasActiveBlock ? (
                  <div className="schedule-plan-coach-focus-grid">
                    <div className="schedule-plan-coach-focus-pill">
                      <span>{s('coach_block_week')}</span>
                      <strong>{s('phase_label', { week: targetBlock.weekIndex || 1 })}</strong>
                    </div>
                    <div className="schedule-plan-coach-focus-pill">
                      <span>{s('long_run_anchor')}</span>
                      <strong>{longRunAnchorLabel}</strong>
                    </div>
                    <div className="schedule-plan-coach-focus-pill">
                      <span>{s('coach_race_target')}</span>
                      <strong>{coachTargetValue || raceTargetDistanceLabel || '--'}</strong>
                    </div>
                  </div>
                ) : null}

                <div className="schedule-plan-signal-group">
                  <div className="schedule-plan-signal-row">
                    <span>{s('fatigue_level')} <em>{s('signal_estimated')}</em></span>
                    <strong>{recoverySignals.fatigue.label}</strong>
                  </div>
                  <div className={`schedule-plan-signal-bar${recoverySignals.fatigue.supported ? '' : ' is-unsupported'}`}>
                    <span style={{ width: `${recoverySignals.fatigue.percent ?? 0}%` }} />
                  </div>
                  <div className="schedule-plan-signal-row">
                    <span>{s('sleep_quality')}</span>
                    <strong>
                      {recoverySignals.sleep.supported
                        ? `${recoverySignals.sleep.label} · ${recoverySignals.sleep.percent} / 100`
                        : recoverySignals.sleep.label}
                    </strong>
                  </div>
                  <div className={`schedule-plan-signal-bar${recoverySignals.sleep.supported ? '' : ' is-unsupported'}`}>
                    <span className="is-sleep" style={{ width: `${recoverySignals.sleep.percent ?? 0}%` }} />
                  </div>
                </div>

                <button type="button" className="schedule-plan-secondary-btn" onClick={() => navigate('/analysis')}>
                  {s('detailed_biometrics')} <span aria-hidden="true">→</span>
                </button>
              </article>

              <article className="schedule-plan-gear-card">
                <div className="schedule-plan-gear-head"><h3>{s('current_gear')}</h3><button type="button" onClick={() => navigate('/shoes')}>{t('profile.dashboard_nav_shoes')} <span aria-hidden="true">→</span></button></div>
                <div className="schedule-plan-gear-row">
                  <div className="schedule-plan-gear-thumb">{getSafeImageUrl(currentGear?.photoUrl) ? <img src={getSafeImageUrl(currentGear.photoUrl)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <AppIcon name="shoe_outline" />}</div>
                  <div>
                    <strong>{currentGear ? `${currentGear.brand || ''} ${currentGear.model || ''}`.trim() : s('gear_fallback')}</strong>
                    <p>
                      {currentGear
                        ? s('gear_distance', { current: formatDistance(Number(currentGear.currentDistanceKm || 0), 0, lang, unit), max: formatDistance(Number(currentGear.maxDistanceKm || 650), 0, lang, unit) })
                        : s('gear_missing')}
                    </p>
                  </div>
                </div>
                <div className="schedule-plan-gear-bar">
                  <span
                    style={{
                      width: currentGear
                        ? `${Math.max(0, Math.min(100, Math.round((Number(currentGear.currentDistanceKm || 0) / Math.max(1, Number(currentGear.maxDistanceKm || 650))) * 100)))}%`
                        : '0%',
                    }}
                  />
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

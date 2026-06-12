import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson, apiFetch } from '../api';
import 'leaflet/dist/leaflet.css';
import AppIcon from '../components/AppIcon';
import CoachIdentityBadge from '../components/CoachIdentityBadge';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import { formatDistance } from '../utils/format';
import { resolveAssignedCoach } from '../utils/coachIdentity';
import { buildScheduleTargetBlockModel } from '../utils/scheduleMarathonBlock';
import { getTodayRunRecommendation } from '../utils/todayRun';
import { computeVdotTrend } from '../utils/vdot';
import { buildWeeklyCoachSummaryModel } from '../utils/scheduleCoachSummary';
import TopbarNotifications from '../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';


function resolveRunDistanceKm(run) {
  const km = Number(run?.distanceKm || 0);
  if (km > 0) return km;
  const meters = Number(run?.distanceMeters || 0);
  return meters > 0 ? meters / 1000 : 0;
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

function startOfIsoWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
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
  const metrics = recommendationBundle?.metrics || {};
  const tone = recommendationBundle?.tone?.key || 'easy';
  let score = 82;

  if (tone === 'quality') score += 8;
  if (tone === 'easy') score -= 4;
  if (tone === 'recovery') score -= 12;
  if (tone === 'restart') score -= 18;

  if (metrics.acwr != null) {
    if (metrics.acwr >= 0.9 && metrics.acwr <= 1.15) score += 6;
    if (metrics.acwr > 1.2) score -= 8;
    if (metrics.acwr < 0.75) score -= 4;
  }

  if (metrics.recoveryHours > 24) score -= 12;
  else if (metrics.recoveryHours > 12) score -= 6;
  else if (metrics.recoveryHours <= 8) score += 4;

  if (coachState?.lastSleepScore != null) {
    if (coachState.lastSleepScore >= 80) score += 6;
    else if (coachState.lastSleepScore < 60) score -= 8;
  }

  const restingDelta = coachState?.baselineRestingHr != null && coachState?.lastNightRestingHr != null
    ? coachState.lastNightRestingHr - coachState.baselineRestingHr
    : null;
  if (restingDelta != null) {
    if (restingDelta <= -2) score += 4;
    if (restingDelta >= 5) score -= 8;
  }

  score = Math.max(42, Math.min(96, Math.round(score)));

  let label = t('profile.dashboard_readiness_ready');
  if (score >= 90) label = t('profile.dashboard_readiness_peaking');
  else if (score <= 55) label = t('profile.dashboard_readiness_reset');
  else if (score <= 72) label = t('profile.dashboard_readiness_build');

  return {
    score,
    label,
    copy: recommendation?.purpose || t('profile.dashboard_readiness_fallback'),
  };
}

function buildWeekSchedule(schedule, runs, weekStart, t, s, lang, unit, todayWorkout) {
  const scheduleMap = new Map();
  (Array.isArray(schedule) ? schedule : []).forEach((entry) => {
    if (entry?.scheduledDate) {
      scheduleMap.set(entry.scheduledDate, entry);
    }
  });

  const now = new Date();
  const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const entry = scheduleMap.get(key) || (todayWorkout?.scheduledDate === key ? todayWorkout : null);
    const dayRuns = runs.filter((run) => {
      const started = new Date(run.startTime || run.startDate || 0);
      return !Number.isNaN(started.getTime()) && started.toISOString().slice(0, 10) === key;
    });
    const completedKm = dayRuns.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
    const title = entry ? prettifyWorkoutType(entry.workoutType, t) : s('open_slot');
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
          ? 'recovery'
          : 'default';

    return {
      key,
      dayLabel: date.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'short' }).slice(0, 3).toUpperCase(),
      title,
      tag: scheduleTag(entry?.workoutType, s),
      detail,
      entry,
      completedKm,
      isToday: key === todayKey,
      tone,
    };
  });
}

function pickNextSession(schedule, todayKey) {
  return (Array.isArray(schedule) ? schedule : []).find((entry) => {
    if (!entry?.scheduledDate) return false;
    if (entry.scheduledDate < todayKey) return false;
    return String(entry.workoutType || '').toUpperCase() !== 'REST';
  }) || null;
}

function pickCurrentGear(shoes) {
  const list = Array.isArray(shoes) ? shoes : [];
  return list.find((shoe) => shoe?.isPrimary && !shoe?.retired)
    || list.find((shoe) => !shoe?.retired)
    || list[0]
    || null;
}

function normalizeRouteWaypoint(point) {
  if (Array.isArray(point) && point.length >= 2) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.lon ?? point?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
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

function extractRouteWaypoints(route) {
  const rawWaypoints = route?.waypoints;
  const points = (Array.isArray(rawWaypoints) ? rawWaypoints : [])
    .map(normalizeRouteWaypoint)
    .filter(Boolean);
  return points.length >= 2 ? points : null;
}

function selectPlannedRouteRecommendation(plannedRoutes, targetDistanceKm) {
  const candidates = (Array.isArray(plannedRoutes) ? plannedRoutes : [])
    .map((route) => {
      const actualDistanceKm = Number(route?.actualDistanceKm || 0);
      const routeTargetDistanceKm = Number(route?.targetDistanceKm || actualDistanceKm || 0);
      const waypoints = extractRouteWaypoints(route);
      const preview = waypoints ? buildPlannedRoutePreview(route?.waypoints) : null;
      if (!waypoints || actualDistanceKm <= 0) return null;
      const desiredDistanceKm = Number(targetDistanceKm || routeTargetDistanceKm || actualDistanceKm);
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

  const targetDistance = Number(routeRecommendation.targetDistanceKm || 0) > 0
    ? formatDistance(routeRecommendation.targetDistanceKm, 1, lang, unit)
    : null;

  if (!targetDistance) {
    return s('routeConfidence.built_from_history');
  }

  switch (routeRecommendation.confidence) {
    case 'distance-match':
      return s('routeConfidence.distance_match', { distance: targetDistance });
    case 'near-match':
      return s('routeConfidence.near_match', { distance: targetDistance });
    default:
      return s('routeConfidence.best_recent', { distance: targetDistance });
  }
}

export default function Schedule() {
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const s = useCallback((key, vars) => t(`schedule.${key}`, vars), [t]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [coachState, setCoachState] = useState(null);
  const [coachToday, setCoachToday] = useState(null);
  const [coachSchedule, setCoachSchedule] = useState([]);
  const [shoes, setShoes] = useState([]);
  const [plannedRoutes, setPlannedRoutes] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [autoPlanning, setAutoPlanning] = useState(false);
  const [recentRunFallback, setRecentRunFallback] = useState(null);

  const routeMapRef = useRef(null);
  const routeMapInstanceRef = useRef(null);
  const didAutoPlanRef = useRef(false);
  const startPointCacheRef = useRef(null);
  const didRecentRunFetchRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadSchedule() {
      setLoadState('loading');
      try {
        const [profileData, activitiesData, coachStateData, coachTodayData, coachScheduleData, shoeData, plannedRouteData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/activities'),
          apiJson('/api/coach/state').catch(() => null),
          apiJson('/api/coach/today').catch(() => null),
          apiJson('/api/coach/schedule?days=14').catch(() => []),
          apiJson('/api/shoes').catch(() => []),
          apiJson('/api/route/plan/recent').catch(() => []),
        ]);

        if (cancelled) return;

        const list = Array.isArray(activitiesData) ? activitiesData : [];
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));

        setProfile(profileData);
        setRuns(list);
        setCoachState(coachStateData && typeof coachStateData === 'object' ? coachStateData : null);
        setCoachToday(coachTodayData && typeof coachTodayData === 'object' ? coachTodayData : null);
        setCoachSchedule(Array.isArray(coachScheduleData) ? coachScheduleData : []);
        setShoes(Array.isArray(shoeData) ? shoeData : []);
        setPlannedRoutes(Array.isArray(plannedRouteData) ? plannedRouteData : []);
        setLoadState('ready');
      } catch {
        if (!cancelled) {
          setLoadState('error');
        }
      }
    }

    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate]);

  const recommendationBundle = useMemo(
    () => getTodayRunRecommendation({ runs, t, lang }),
    [runs, t, lang],
  );
  const vdotTrend = useMemo(
    () => computeVdotTrend(runs),
    [runs],
  );

  const readiness = useMemo(
    () => buildReadinessModel(recommendationBundle, coachState, t),
    [recommendationBundle, coachState, t],
  );

  const weekStart = useMemo(() => startOfIsoWeek(new Date()), []);
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const weekSchedule = useMemo(
    () => buildWeekSchedule(coachSchedule, runs, weekStart, t, s, lang, unit, coachToday?.today),
    [coachSchedule, runs, weekStart, t, s, lang, unit, coachToday],
  );

  const targetVolumeKm = useMemo(
    () => weekSchedule.reduce((sum, day) => sum + Number(day.entry?.plannedDistanceKm || 0), 0),
    [weekSchedule],
  );

  const completedVolumeKm = useMemo(
    () => weekSchedule.reduce((sum, day) => sum + Number(day.completedKm || 0), 0),
    [weekSchedule],
  );

  const nextSession = useMemo(
    () => pickNextSession(coachSchedule, todayKey),
    [coachSchedule, todayKey],
  );

  const currentGear = useMemo(
    () => pickCurrentGear(shoes),
    [shoes],
  );

  const activeBlock = coachState?.activeBlock || null;
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

  const heroKicker = targetBlock.name
    ? `${targetBlock.name}: ${s('phase_label', { week: targetBlock.weekIndex || 1 })}`
    : s('phase_label', { week: 1 });
  const heroTitle = targetBlock.hasActiveBlock
    ? targetBlock.isMarathonBlock
      ? s('hero_title_marathon')
      : s('hero_title_block')
    : s('hero_title');
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
  const heroSummary = [
    targetBlock.hasTargetRace && raceTargetDistanceLabel
      ? { label: s('hero_target_distance'), value: raceTargetDistanceLabel }
      : null,
    targetCountdownLabel
      ? { label: s('hero_countdown'), value: targetCountdownLabel }
      : null,
    targetRaceDateLabel
      ? { label: s('hero_race_day'), value: targetRaceDateLabel }
      : null,
  ].filter(Boolean);

  const nextSessionTitle = nextSession
    ? prettifyWorkoutType(nextSession.workoutType, t)
    : recommendationBundle.recommendation.title;

  const nextSessionCopy = nextSession?.notes
    || recommendationBundle.recommendation.purpose;
  const weeklyAcwr = recommendationBundle.metrics?.acwr ?? null;
  const weeklyAcwrLabel = weeklyAcwr != null ? weeklyAcwr.toFixed(2) : '--';
  const weeklyCoachSummary = useMemo(
    () => buildWeeklyCoachSummaryModel({
      vdotTrend,
      acwr: weeklyAcwr,
      targetBlock,
      nextSessionTitle,
    }),
    [nextSessionTitle, targetBlock, vdotTrend, weeklyAcwr],
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
  }, [s, weeklyAcwrLabel, weeklyCoachSummary.loadState]);

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

  const fatigueLevel = readiness.score >= 86
    ? s('fatigue_low')
    : readiness.score >= 70
      ? s('fatigue_moderate')
      : s('fatigue_high');

  const fatiguePct = readiness.score >= 86 ? 42 : readiness.score >= 70 ? 60 : 82;
  const sleepPct = coachState?.lastSleepScore != null ? Math.max(12, Math.min(100, Math.round(coachState.lastSleepScore))) : 72;
  const sleepLabel = coachState?.lastSleepScore != null && coachState.lastSleepScore >= 80
    ? s('sleep_high')
    : s('sleep_moderate');
  const targetRouteDistanceKm = Number(
    nextSession?.plannedDistanceKm
      || coachToday?.today?.plannedDistanceKm
      || targetBlock.currentLongRunKm
      || 0,
  );
  const plannedRouteRecommendation = useMemo(
    () => selectPlannedRouteRecommendation(plannedRoutes, targetRouteDistanceKm),
    [plannedRoutes, targetRouteDistanceKm],
  );
  const routeRecommendation = plannedRouteRecommendation || recentRunFallback || coachToday?.routeRecommendation || null;
  const routeRecommendationSource = routeRecommendation?.source === 'planner'
    ? 'planner'
    : routeRecommendation?.source === 'recent-run'
      ? 'recent-run'
      : 'history';
  const routeWaypoints = routeRecommendation?.waypoints || null;
  const hasRoutePreview = Boolean(routeWaypoints && routeWaypoints.length >= 2);
  const routeTitle = routeRecommendation
    ? routeRecommendationSource === 'planner'
      ? s('route_planner_title')
      : getRouteZoneLabel(routeRecommendation.zoneKey, s)
    : targetBlock.name || s('default_route_name');
  const routeAnchoredRuns = routeRecommendationSource === 'planner'
    ? s('route_planner_source')
    : routeRecommendationSource === 'recent-run'
      ? s('route_planner_source_recent_run', { date: routeRecommendation?.runDateLabel || '' })
      : getRouteAnchoredRunsLabel(routeRecommendation, s);
  const routeConfidenceLabel = routeRecommendationSource === 'planner' && routeRecommendation?.actualDistanceKm
    ? s('route_planner_accuracy', {
      distance: formatDistance(routeRecommendation.actualDistanceKm, 1, lang, unit),
    })
    : routeRecommendationSource === 'recent-run' && routeRecommendation?.actualDistanceKm
      ? s('route_planner_accuracy', {
        distance: formatDistance(routeRecommendation.actualDistanceKm, 1, lang, unit),
      })
      : getRouteConfidenceLabel(routeRecommendation, s, unit, lang);
  const routeTargetDistanceKm = Number(
    routeRecommendation?.targetDistanceKm
      || targetRouteDistanceKm
      || 0,
  );
  const routeTargetDistanceLabel = routeTargetDistanceKm > 0
    ? formatDistance(routeTargetDistanceKm, 1, lang, unit)
    : null;
  const routeTargetContextLabel = targetBlock.isMarathonBlock
    ? s('route_target_marathon')
    : s('route_target_block');
  const routeFallbackDistanceBadge = routeTargetDistanceKm > 0
    ? formatDistance(routeTargetDistanceKm, 1, lang, unit)
    : s('no_distance');
  const routeFallbackStatus = routeRecommendation ? routeConfidenceLabel : routeAnchoredRuns;
  const routeFallbackBadges = [
    routeFallbackDistanceBadge,
    routeRecommendation ? routeAnchoredRuns : nextSessionTitle,
    targetBlock.hasTargetRace && raceTargetDistanceLabel
      ? raceTargetDistanceLabel
      : targetBlock.weekIndex
        ? s('phase_label', { week: targetBlock.weekIndex || 1 })
        : null,
  ].filter(Boolean);
  const routePlannerInsights = routeRecommendationSource === 'planner'
    ? [
      getRouteElevationPreferenceLabel(routeRecommendation.elevationPreference, s),
      s('route_planner_safety'),
      routeConfidenceLabel,
    ]
    : [
      routeTargetDistanceLabel ? s('route_planner_target', { distance: routeTargetDistanceLabel }) : null,
      s('route_elevation_rolling'),
      s('route_planner_safety_pending'),
    ].filter(Boolean);
  const coachTargetValue = [raceTargetDistanceLabel, targetRaceDateLabel].filter(Boolean).join(' / ');

  // Auto-plan: fire once when load is ready AND no saved planned routes exist.
  // Derives start lat/lng from /api/activities/{id}/points because the activity
  // payload does not expose top-level lat/lng — only routePreview with normalised
  // viewBox coords.
  useEffect(() => {
    if (loadState !== 'ready') return;
    if (plannedRoutes.length > 0) return;
    if (didAutoPlanRef.current) return;
    if (!isAuthenticated) return;

    // Find the most recent run that has GPS-backed route data
    const startCandidateRun = runs.find((r) => r?.routePreview && r?.id != null);
    if (!startCandidateRun) return;

    didAutoPlanRef.current = true;
    setAutoPlanning(true);

    const rawTarget = Number(
      nextSession?.plannedDistanceKm
        || coachToday?.today?.plannedDistanceKm
        || targetBlock?.currentLongRunKm
        || 0,
    );
    const targetDistanceKm = Math.min(50, Math.max(1, rawTarget > 0 ? rawTarget : 5));

    // Derive elevation preference from last 5 runs (median gain/km)
    const recentWithElevation = runs
      .filter((r) => Number(r.distanceKm || 0) > 0 && Number(r.elevationGainMeters || r.totalElevationGain || 0) > 0)
      .slice(0, 5);
    let elevationPreference = 'rolling';
    if (recentWithElevation.length > 0) {
      const gainPerKmValues = recentWithElevation.map((r) => {
        const dist = Number(r.distanceKm || 1);
        const gain = Number(r.elevationGainMeters || r.totalElevationGain || 0);
        return gain / dist;
      });
      gainPerKmValues.sort((a, b) => a - b);
      const median = gainPerKmValues[Math.floor(gainPerKmValues.length / 2)];
      if (median < 6) elevationPreference = 'flat';
      else if (median > 12) elevationPreference = 'hilly';
      else elevationPreference = 'rolling';
    }

    const resolveStartPoint = () => {
      if (startPointCacheRef.current) {
        return Promise.resolve(startPointCacheRef.current);
      }
      return apiJson(`/api/activities/${startCandidateRun.id}/points`)
        .then((points) => {
          const first = Array.isArray(points) ? points[0] : null;
          if (!first) return null;
          const lat = Number(first.latitude);
          const lng = Number(first.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
            return null;
          }
          // Cache full points list so the recent-run fallback effect can reuse it
          const pt = { lat, lng, _fullPoints: Array.isArray(points) ? points : null };
          startPointCacheRef.current = pt;
          return pt;
        })
        .catch((err) => {
          console.warn('[Schedule] auto-plan points fetch failed:', err.message);
          return null;
        });
    };

    resolveStartPoint()
      .then((pt) => {
        if (!pt) {
          setAutoPlanning(false);
          return;
        }
        return apiFetch('/api/route/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startLat: pt.lat,
            startLng: pt.lng,
            targetDistanceKm,
            elevationPreference,
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`auto-plan HTTP ${res.status}`);
            return res.json();
          })
          .then((newRoute) => {
            if (newRoute && typeof newRoute === 'object') {
              setPlannedRoutes((prev) => [newRoute, ...prev]);
            }
          })
          .catch((err) => {
            console.warn('[Schedule] auto-plan failed:', err.message);
          })
          .finally(() => {
            setAutoPlanning(false);
          });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, plannedRoutes.length, isAuthenticated]);

  // Recent-run fallback: when no plannedRoutes, immediately build a recommendation
  // from the most recent run's GPS points so the Leaflet map renders right away.
  // Re-uses the same /api/activities/{id}/points fetch (cached in startPointCacheRef)
  // that the auto-plan effect already uses for its start coord.
  useEffect(() => {
    if (loadState !== 'ready') return;
    if (plannedRoutes.length > 0) return;
    if (didRecentRunFetchRef.current) return;
    if (!isAuthenticated) return;

    const startCandidateRun = runs.find((r) => r?.routePreview && r?.id != null);
    if (!startCandidateRun) return;

    didRecentRunFetchRef.current = true;

    const resolvePoints = () => {
      if (startPointCacheRef.current?._fullPoints) {
        return Promise.resolve(startPointCacheRef.current._fullPoints);
      }
      return apiJson(`/api/activities/${startCandidateRun.id}/points`)
        .then((points) => {
          if (!Array.isArray(points) || points.length < 2) return null;
          // Cache both first-point (for auto-plan) and full points list
          const first = points[0];
          const lat = Number(first.latitude);
          const lng = Number(first.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
            startPointCacheRef.current = { lat, lng, _fullPoints: points };
          }
          return points;
        })
        .catch((err) => {
          console.warn('[Schedule] recent-run points fetch failed:', err.message);
          return null;
        });
    };

    resolvePoints().then((points) => {
      if (!Array.isArray(points) || points.length < 2) return;

      // Decimate to ~100 points — keep first and last exactly
      const MAX_WAYPOINTS = 100;
      let decimated;
      if (points.length <= MAX_WAYPOINTS) {
        decimated = points;
      } else {
        const step = Math.floor(points.length / (MAX_WAYPOINTS - 1));
        const sampled = [];
        for (let i = 0; i < points.length - 1; i += step) {
          sampled.push(points[i]);
        }
        sampled.push(points[points.length - 1]);
        decimated = sampled;
      }

      const waypoints = decimated
        .map((p) => {
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
        })
        .filter(Boolean);

      if (waypoints.length < 2) return;

      const preview = buildPlannedRoutePreview(waypoints);
      const runDistanceKm = resolveRunDistanceKm(startCandidateRun);
      const rawTarget = Number(
        nextSession?.plannedDistanceKm
          || coachToday?.today?.plannedDistanceKm
          || 0,
      );
      const targetDistanceKm = rawTarget > 0 ? rawTarget : runDistanceKm;

      // Format date for the source label
      const runDate = new Date(startCandidateRun.startTime || startCandidateRun.startDate || 0);
      const runDateLabel = Number.isNaN(runDate.getTime())
        ? ''
        : runDate.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
          month: 'short',
          day: 'numeric',
        });

      setRecentRunFallback({
        source: 'recent-run',
        zoneKey: 'core',
        confidence: 'built_from_history',
        waypoints,
        preview,
        actualDistanceKm: runDistanceKm,
        targetDistanceKm,
        activityCount: 1,
        elevationGainMeters: Number(startCandidateRun.elevationGainMeters || startCandidateRun.totalElevationGain || 0),
        estimatedTimeMinutes: 0,
        elevationPreference: 'rolling',
        distanceGapKm: Math.abs(runDistanceKm - targetDistanceKm),
        distanceAccuracy: targetDistanceKm > 0 ? runDistanceKm / targetDistanceKm : 1,
        createdAt: runDate.getTime() || 0,
        runDateLabel,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, plannedRoutes.length, isAuthenticated]);

  // Leaflet map effect for the route card
  useEffect(() => {
    if (!routeMapRef.current) return;
    if (!routeWaypoints || routeWaypoints.length < 2) {
      if (routeMapInstanceRef.current) {
        routeMapInstanceRef.current.remove();
        routeMapInstanceRef.current = null;
      }
      return;
    }

    if (routeMapInstanceRef.current) {
      // Already initialized — rebuild for new waypoints
      routeMapInstanceRef.current.remove();
      routeMapInstanceRef.current = null;
    }

    import('leaflet').then((L) => {
      if (!routeMapRef.current) return;
      const map = L.map(routeMapRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: true,
      });
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
      routeMapInstanceRef.current = map;
    });

    return () => {
      if (routeMapInstanceRef.current) {
        routeMapInstanceRef.current.remove();
        routeMapInstanceRef.current = null;
      }
    };
  }, [routeWaypoints]);

  if (loadState === 'loading') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{s('loading')}</div></div>;
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
            <span>{t('analysis.stitch_brand_subtitle')}</span>
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
              <button type="button" className="runner-shell-avatar" aria-label={displayName} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas schedule-plan-canvas">
          <section className={`schedule-plan-hero${targetBlock.hasActiveBlock ? ' is-block-active' : ''}${targetBlock.isMarathonBlock ? ' is-marathon-block' : ''}`}>
            <div className="schedule-plan-hero-copy">
              <span className="schedule-plan-kicker">{heroKicker}</span>
              <h1>{heroTitle}</h1>
              {heroSummary.length > 0 ? (
                <div className="schedule-plan-hero-summary">
                  {heroSummary.map((item) => (
                    <div key={item.label} className="schedule-plan-hero-summary-chip">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="schedule-plan-hero-metrics">
              <div>
                <span>{s('target_volume')}</span>
                <strong>{formatDistance(targetVolumeKm, 1, lang, unit)}</strong>
              </div>
              <div>
                <span>{s('completed_volume')}</span>
                <strong>{formatDistance(completedVolumeKm, 1, lang, unit)}</strong>
              </div>
            </div>

            <div className="schedule-plan-hero-pulse" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <path d="M0 50 Q 25 20 50 50 T 100 50" />
                <path d="M0 60 Q 25 30 50 60 T 100 60" />
                <path d="M0 40 Q 25 10 50 40 T 100 40" />
              </svg>
            </div>
          </section>

          <section className="schedule-plan-week-grid">
            {weekSchedule.map((day) => {
              const isLongRunAnchor = targetBlock.hasActiveBlock && String(day.entry?.workoutType || '').toUpperCase() === 'LONG_RUN';
              const isReadinessDeferred = Boolean(day.entry?.readinessAdjusted && day.entry?.mutatedFrom);
              return (
                <article
                  key={day.key}
                  className={`schedule-plan-day schedule-plan-day--${day.tone}${day.isToday ? ' is-today' : ''}${isLongRunAnchor ? ' is-marathon-anchor' : ''}${isReadinessDeferred ? ' is-readiness-deferred' : ''}`}
                >
                  <div>
                    <div className="schedule-plan-day-head">
                      <p className="schedule-plan-day-label">{day.dayLabel}</p>
                      {isLongRunAnchor ? <span className="schedule-plan-day-anchor">{s('long_run_anchor')}</span> : null}
                    </div>
                    {isReadinessDeferred && (
                      <span className="schedule-plan-day-deferred-badge">
                        {s('readinessDeferred.badge', {
                          originalType: prettifyWorkoutType(day.entry.mutatedFrom, t),
                          newType: prettifyWorkoutType(day.entry.workoutType, t),
                        })}
                      </span>
                    )}
                    <p className="schedule-plan-day-tag">{day.tag}</p>
                  </div>
                  <div>
                    <h2>{day.title}</h2>
                    <p>{day.detail}</p>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="schedule-plan-bottom-grid">
            <div className="schedule-plan-left-rail">
              <div className="schedule-plan-dual-grid">
                <article className="schedule-plan-readiness-card">
                  <h3>{s('readiness_title')}</h3>
                  <div className="schedule-plan-readiness-ring">
                    <svg viewBox="0 0 220 220" aria-hidden="true">
                      <circle cx="110" cy="110" r="92" className="schedule-plan-readiness-track" />
                      <circle
                        cx="110"
                        cy="110"
                        r="92"
                        className="schedule-plan-readiness-progress"
                        style={{ strokeDasharray: 578, strokeDashoffset: 578 - ((578 * readiness.score) / 100) }}
                      />
                    </svg>
                    <div className="schedule-plan-readiness-center">
                      <strong>{readiness.score}</strong>
                      <span>{readiness.label}</span>
                    </div>
                  </div>
                  <p>{readiness.copy}</p>
                </article>

                <article className="schedule-plan-next-card">
                  <div className="schedule-plan-next-bg" />
                  <div className="schedule-plan-next-overlay" />
                  <div className="schedule-plan-next-content">
                    <span>{t('schedule.next_up')}</span>
                    
                    <h3>{nextSessionTitle}</h3>
                    <p>{nextSessionCopy}</p>
                    <button type="button" aria-label={s('view_drills')} onClick={() => navigate('/today-run')}>
                      {s('view_drills')}
                      <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
                    </button>
                  </div>
                </article>
              </div>

              <article className={`schedule-plan-route-card${hasRoutePreview ? ' has-route-preview' : ' is-route-fallback'}`}>
                <div className="schedule-plan-route-map" aria-hidden="true">
                  {hasRoutePreview ? (
                    <div ref={routeMapRef} className="schedule-plan-route-leaflet-map" />
                  ) : autoPlanning ? (
                    <div className="schedule-plan-route-empty-panel schedule-plan-route-empty-panel--loading">
                      <div className="schedule-plan-route-auto-spinner" aria-hidden="true" />
                      <div className="schedule-plan-route-empty-copy">
                        <span>{s('route_auto_loading')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="schedule-plan-route-empty-panel">
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
                </div>
                <div className="schedule-plan-route-content">
                  <div>
                    <span>{s('planned_route')}</span>
                    <h3>{routeTitle}</h3>
                    <div className="schedule-plan-route-meta">
                      <span>{routeAnchoredRuns}</span>
                      <span>{routeConfidenceLabel}</span>
                    </div>
                    <div className="schedule-plan-route-insight" aria-label={s('route_planner_insights')}>
                      {routePlannerInsights.map((insight) => (
                        <span key={insight}>{insight}</span>
                      ))}
                    </div>
                    {targetBlock.hasActiveBlock && routeTargetDistanceLabel ? (
                      <div className="schedule-plan-route-target">
                        <div className="schedule-plan-route-target-metric">
                          <span>{s('route_target_label')}</span>
                          <strong>{routeTargetDistanceLabel}</strong>
                        </div>
                        <p>{routeTargetContextLabel}</p>
                      </div>
                    ) : null}
                  </div>
                  <button type="button" className="schedule-plan-watch-btn" onClick={() => navigate('/today-run')}>
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

                <div className="schedule-plan-coach-copy">
                  <h4>{s('coach_quote')}</h4>
                  <p>
                    {targetBlock.hasTargetRace
                      ? s('coach_body_target_block', {
                        week: targetBlock.weekIndex || 1,
                        longRun: longRunAnchorLabel,
                        raceDistance: raceTargetDistanceLabel || '--',
                      })
                      : activeBlock
                        ? s('coach_body_block', {
                          week: activeBlock.weekIndex || 1,
                          longRun: activeBlock.currentLongRunKm?.toFixed?.(1) || activeBlock.currentLongRunKm || '--',
                        })
                      : s('coach_body_default')}
                  </p>
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
                    <span>{s('fatigue_level')}</span>
                    <strong>{fatigueLevel}</strong>
                  </div>
                  <div className="schedule-plan-signal-bar"><span style={{ width: `${fatiguePct}%` }} /></div>
                  <div className="schedule-plan-signal-row">
                    <span>{s('sleep_quality')}</span>
                    <strong>{sleepLabel}</strong>
                  </div>
                  <div className="schedule-plan-signal-bar"><span className="is-sleep" style={{ width: `${sleepPct}%` }} /></div>
                </div>

                <button type="button" className="schedule-plan-secondary-btn" onClick={() => navigate('/analysis')}>
                  {s('detailed_biometrics')}
                </button>
              </article>

              <article className="schedule-plan-gear-card">
                <h3>{s('current_gear')}</h3>
                <div className="schedule-plan-gear-row">
                  <div className="schedule-plan-gear-thumb" />
                  <div>
                    <strong>{currentGear ? `${currentGear.brand || ''} ${currentGear.model || ''}`.trim() : s('gear_fallback')}</strong>
                    <p>
                      {currentGear
                        ? `${Math.round(Number(currentGear.currentDistanceKm || 0))} km / ${Math.round(Number(currentGear.maxDistanceKm || 650))} km`
                        : s('gear_missing')}
                    </p>
                  </div>
                </div>
                <div className="schedule-plan-gear-bar">
                  <span
                    style={{
                      width: currentGear
                        ? `${Math.max(8, Math.min(100, Math.round((Number(currentGear.currentDistanceKm || 0) / Math.max(1, Number(currentGear.maxDistanceKm || 650))) * 100)))}%`
                        : '24%',
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

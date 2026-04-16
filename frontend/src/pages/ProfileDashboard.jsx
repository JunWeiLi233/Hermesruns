import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import Modal from '../components/Modal';
import FooterNavLinks from '../components/FooterNavLinks';
import TopbarNotifications from '../components/TopbarNotifications';
import { formatDate, formatDistance, formatDuration, formatPaceSeconds } from '../utils/format';
import { getTodayRunRecommendation } from '../utils/todayRun';
import { parseCheckoutBannerQuery, parseProfileLinkingQuery } from '../utils/stravaLinking';
import { estimateCurrentVdot, computeVdotTrend } from '../utils/vdot';

const DASHBOARD_HERO_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCduh8I3MMazSPbifhs59F6YdwIOS-ZRvW7t_n3qJKHxcqDJP3fep7cglrfaXiwrYYPwPxFtz_ExFJggZD-Cy5WZbURvgfE6h4Bvc2M_XU19LaXiqyfdCoyiRn0Aoln4WxGCgqJqtK1Kn2Mlp-KiHvYvqqeidejVqd75xj0rXOXokd_ePH6X6P2LEuMuuZNA5N5gVErlHBg3f0Qdi_d5PaePI6Fzw8BoDHmloQLsQl4agd74Hb85CXqnA1DUwAI-P6P3oPHBwKS50k8';
const PR_SNAPSHOT_VERSION = 1;
const PROGRESSION_TIMEFRAMES = ['day', 'week', 'month', 'year', 'total'];

function getPrSnapshotStorageKey(email) {
  return `hermes_pr_snapshot_${String(email || '').trim().toLowerCase()}`;
}

function readJsonStorage(key) {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(key, value) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures so the dashboard still loads.
  }
}

function resolveRunDistanceKm(run) {
  const km = Number(run?.distanceKm || 0);
  if (km > 0) return km;
  const meters = Number(run?.distanceMeters || 0);
  return meters > 0 ? meters / 1000 : 0;
}

function formatDurationCompact(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
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

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfIsoWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfCurrentDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function getRunStartedAt(run) {
  return new Date(run?.startTime || run?.startDate || 0);
}

function formatProgressionWindowLabel(start, end, timeframe, lang) {
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return '--';
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) return '--';

  if (timeframe === 'day') {
    return start.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (timeframe === 'week') {
    const sameYear = start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString(locale, sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' });
    const endLabel = end.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }

  if (timeframe === 'month') {
    return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }

  if (timeframe === 'year') {
    return start.toLocaleDateString(locale, { year: 'numeric' });
  }

  const startLabel = start.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const endLabel = end.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function formatProgressionAxisLabel(date, timeframe, lang) {
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--';

  if (timeframe === 'year' || timeframe === 'total') {
    return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  }

  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatPaceDisplay(secondsPerKm, lang) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--';
  return `${formatPaceSeconds(secondsPerKm)} ${lang === 'zh-CN' ? '/公里' : '/km'}`;
}

function formatElevationDisplay(totalMeters, lang) {
  if (!Number.isFinite(totalMeters) || totalMeters <= 0) return '--';
  return `${Math.round(totalMeters)} ${lang === 'zh-CN' ? '米' : 'm'}`;
}

function buildProgressionAtlas(runs, timeframe, lang) {
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  const sortedAsc = [...runs]
    .filter((run) => !Number.isNaN(getRunStartedAt(run).getTime()))
    .sort((a, b) => getRunStartedAt(a) - getRunStartedAt(b));
  const now = new Date();
  const rangeEnd = endOfCurrentDay(now);

  let rangeStart = startOfDay(now);
  let bucket = 'day';

  if (timeframe === 'week') {
    rangeStart = startOfIsoWeek(now);
  } else if (timeframe === 'month') {
    rangeStart = startOfMonth(now);
  } else if (timeframe === 'year') {
    rangeStart = startOfYear(now);
    bucket = 'month';
  } else if (timeframe === 'total') {
    rangeStart = sortedAsc[0] ? startOfDay(getRunStartedAt(sortedAsc[0])) : startOfDay(now);
    bucket = 'month';
  }

  const filteredAsc = sortedAsc.filter((run) => {
    const startedAt = getRunStartedAt(run);
    return startedAt >= rangeStart && startedAt <= rangeEnd;
  });
  const filteredDesc = [...filteredAsc].reverse();

  const totalDistanceKm = filteredAsc.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
  const totalMovingSeconds = filteredAsc.reduce((sum, run) => sum + Number(run?.movingTimeSeconds || 0), 0);
  const totalElevationMeters = filteredAsc.reduce(
    (sum, run) => sum + Number(run?.elevationGainMeters || run?.totalElevationGainMeters || 0),
    0,
  );
  const sessionCount = filteredAsc.length;
  const allDistanceKm = sortedAsc.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
  const shareOfDistance = allDistanceKm > 0 ? Math.round((totalDistanceKm / allDistanceKm) * 100) : 0;
  const averagePaceSeconds = totalDistanceKm > 0 ? totalMovingSeconds / totalDistanceKm : null;

  const grouped = filteredAsc.reduce((map, run) => {
    const startedAt = getRunStartedAt(run);
    const bucketDate = bucket === 'month'
      ? new Date(startedAt.getFullYear(), startedAt.getMonth(), 1)
      : startOfDay(startedAt);
    const key = bucket === 'month'
      ? `${bucketDate.getFullYear()}-${bucketDate.getMonth() + 1}`
      : bucketDate.toISOString().slice(0, 10);
    const existing = map.get(key) || {
      key,
      date: bucketDate,
      distanceKm: 0,
      sessions: 0,
    };
    existing.distanceKm += resolveRunDistanceKm(run);
    existing.sessions += 1;
    map.set(key, existing);
    return map;
  }, new Map());

  let cumulativeDistance = 0;
  const chartBaseLine = 86;
  const chartLeft = 6;
  const chartRight = 94;
  const chartHeight = 56;
  const groupedSeries = Array.from(grouped.values())
    .sort((a, b) => a.date - b.date)
    .map((entry, index, source) => {
      cumulativeDistance += entry.distanceKm;
      const ratio = source.length === 1 ? 1 : index / (source.length - 1);
      return {
        ...entry,
        cumulativeDistance,
        x: chartLeft + ((chartRight - chartLeft) * ratio),
      };
    });

  const maxCumulativeDistance = Math.max(1, ...groupedSeries.map((entry) => entry.cumulativeDistance));
  const chartPoints = groupedSeries.map((entry) => ({
    ...entry,
    y: chartBaseLine - ((entry.cumulativeDistance / maxCumulativeDistance) * chartHeight),
    label: formatProgressionAxisLabel(entry.date, timeframe, lang),
  }));
  const chartLine = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const chartArea = chartPoints.length > 0
    ? `M ${chartPoints[0].x} ${chartBaseLine} L ${chartPoints.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${chartPoints[chartPoints.length - 1].x} ${chartBaseLine} Z`
    : '';

  return {
    hasData: filteredAsc.length > 0,
    rangeLabel: formatProgressionWindowLabel(rangeStart, rangeEnd, timeframe, lang),
    totalDistanceKm,
    totalMovingSeconds,
    totalElevationMeters,
    sessionCount,
    shareOfDistance,
    averagePaceSeconds,
    chartPoints,
    chartLine,
    chartArea,
    latestPoint: chartPoints[chartPoints.length - 1] || null,
    startLabel: chartPoints[0]?.label || formatProgressionAxisLabel(rangeStart, timeframe, lang),
    endLabel: chartPoints[chartPoints.length - 1]?.label || formatProgressionAxisLabel(rangeEnd, timeframe, lang),
    recentRuns: filteredDesc.slice(0, 4).map((run) => {
      const distanceKm = resolveRunDistanceKm(run);
      const movingTimeSeconds = Number(run?.movingTimeSeconds || 0);
      const paceSeconds = distanceKm > 0 && movingTimeSeconds > 0 ? movingTimeSeconds / distanceKm : null;
      return {
        ...run,
        distanceKm,
        movingTimeSeconds,
        paceSeconds,
        startedAtLabel: formatRunDate(run, lang),
        completionLabel: getRunStartedAt(run).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      };
    }),
  };
}

function getDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function buildWeekBars(runs, lang) {
  const now = new Date();
  const weekStart = startOfIsoWeek(now);
  const dayNames = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'short' }).slice(0, 3).toUpperCase();
  });

  const actual = Array.from({ length: 7 }, () => 0);
  const projected = Array.from({ length: 7 }, () => 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  runs.forEach((run) => {
    const started = new Date(run.startTime || run.startDate || 0);
    if (Number.isNaN(started.getTime())) return;
    const distanceKm = resolveRunDistanceKm(run);
    if (started >= weekStart && started < weekEnd) {
      const dayIndex = Math.max(0, Math.min(6, Math.floor((started - weekStart) / 86400000)));
      actual[dayIndex] += distanceKm;
    }
  });

  for (let weekday = 0; weekday < 7; weekday += 1) {
    let total = 0;
    let count = 0;
    for (let lookback = 1; lookback <= 4; lookback += 1) {
      const sampleStart = new Date(weekStart);
      sampleStart.setDate(weekStart.getDate() - (lookback * 7) + weekday);
      const sampleEnd = new Date(sampleStart);
      sampleEnd.setDate(sampleStart.getDate() + 1);
      const sampleDistance = runs.reduce((sum, run) => {
        const started = new Date(run.startTime || run.startDate || 0);
        if (Number.isNaN(started.getTime()) || started < sampleStart || started >= sampleEnd) return sum;
        return sum + resolveRunDistanceKm(run);
      }, 0);
      if (sampleDistance > 0) {
        total += sampleDistance;
        count += 1;
      }
    }
    projected[weekday] = count > 0 ? total / count : actual[weekday];
  }

  const maxValue = Math.max(1, ...actual, ...projected);
  const todayIndex = Math.max(0, Math.min(6, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - weekStart) / 86400000)));

  return dayNames.map((label, index) => ({
    key: `${label}-${index}`,
    index,
    label,
    actual: actual[index],
    projected: projected[index],
    actualPct: Math.max(8, Math.round((actual[index] / maxValue) * 100)),
    projectedPct: Math.max(8, Math.round((projected[index] / maxValue) * 100)),
    actualAnchorTopPct: 100 - Math.max(8, Math.round((actual[index] / maxValue) * 100)),
    isToday: index === todayIndex,
  }));
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

function buildWorkoutHeadline(today, recommendation, t) {
  if (!today) return recommendation?.title || t('profile.dashboard_workout_fallback');
  const workoutLabel = prettifyWorkoutType(today.workoutType, t);
  if (Number.isFinite(today.plannedDistanceKm) && today.plannedDistanceKm > 0) {
    return `${workoutLabel}: ${today.plannedDistanceKm.toFixed(1)} km`;
  }
  if (Number.isFinite(today.plannedDurationMinutes) && today.plannedDurationMinutes > 0) {
    return `${workoutLabel}: ${today.plannedDurationMinutes} min`;
  }
  return workoutLabel;
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

function buildSessionMetric(run, lang, unit, t) {
  const avgHr = Number(run?.averageHeartRate || 0);
  if (avgHr > 0) {
    return {
      value: `${Math.round(avgHr)} BPM`,
      label: t('profile.dashboard_metric_avg_hr'),
    };
  }

  const elevation = Number(run?.elevationGainMeters || run?.totalElevationGainMeters || 0);
  if (elevation > 0) {
    return {
      value: `${Math.round(elevation)} m`,
      label: t('profile.dashboard_metric_elevation'),
    };
  }

  return {
    value: formatDistance(resolveRunDistanceKm(run), 1, lang, unit),
    label: t('profile.dashboard_metric_distance'),
  };
}

function formatRunDate(run, lang) {
  const started = new Date(run?.startTime || run?.startDate || 0);
  if (Number.isNaN(started.getTime())) return '--';
  return started.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function buildRecordSnapshot(personalRecords, runs) {
  const latestSeenActivityId = runs.reduce((max, run) => Math.max(max, Number(run?.id || 0)), 0);
  return {
    version: PR_SNAPSHOT_VERSION,
    latestSeenActivityId,
    records: Object.fromEntries(
      Object.entries(personalRecords?.records || {}).map(([key, record]) => [key, {
        key,
        elapsedSeconds: Number(record?.elapsedSeconds || 0),
        paceSecondsPerKm: Number(record?.paceSecondsPerKm || 0),
        recordedAt: record?.recordedAt || null,
        activityId: Number(record?.activityId || 0),
      }]),
    ),
    longestRun: personalRecords?.longestRun ? {
      primaryValue: Number(personalRecords.longestRun.primaryValue || 0),
      activityId: Number(personalRecords.longestRun.activityId || 0),
    } : null,
    fastestPace: personalRecords?.fastestPace ? {
      primaryValue: Number(personalRecords.fastestPace.primaryValue || 0),
      activityId: Number(personalRecords.fastestPace.activityId || 0),
    } : null,
    mostElevation: personalRecords?.mostElevation ? {
      primaryValue: Number(personalRecords.mostElevation.primaryValue || 0),
      activityId: Number(personalRecords.mostElevation.activityId || 0),
    } : null,
    acknowledgedBreakthroughs: [],
  };
}

function getBreakthroughSignature(entry) {
  const activityId = Number(entry?.record?.activityId || 0);
  const recordedAt = entry?.record?.recordedAt || 'unknown-date';
  const primaryValue = Number(
    entry?.record?.elapsedSeconds
      || entry?.record?.primaryValue
      || 0,
  );
  return [entry?.type || 'unknown', entry?.key || 'summary', activityId, recordedAt, primaryValue].join(':');
}

function collectPersonalRecordBreakthroughs(previousSnapshot, personalRecords, runs) {
  if (!previousSnapshot || !personalRecords || !Array.isArray(runs) || runs.length === 0) {
    return [];
  }

  const lastSeenActivityId = Number(previousSnapshot.latestSeenActivityId || 0);
  if (lastSeenActivityId <= 0) {
    return [];
  }

  const breakthroughs = [];
  const currentRecords = personalRecords.records || {};
  const acknowledged = new Set(previousSnapshot.acknowledgedBreakthroughs || []);

  Object.entries(currentRecords).forEach(([key, record]) => {
    const activityId = Number(record?.activityId || 0);
    if (activityId <= lastSeenActivityId) return;

    const previous = previousSnapshot.records?.[key];
    const currentSeconds = Number(record?.elapsedSeconds || 0);
    const previousSeconds = Number(previous?.elapsedSeconds || 0);
    if (!previous || (currentSeconds > 0 && currentSeconds < previousSeconds)) {
      const entry = {
        type: 'distance',
        key,
        record,
      };
      if (!acknowledged.has(getBreakthroughSignature(entry))) {
        breakthroughs.push(entry);
      }
    }
  });

  const summaryComparisons = [
    { type: 'longest', current: personalRecords.longestRun, previous: previousSnapshot.longestRun, isBetter: (a, b) => a > b },
    { type: 'pace', current: personalRecords.fastestPace, previous: previousSnapshot.fastestPace, isBetter: (a, b) => a < b },
    { type: 'elevation', current: personalRecords.mostElevation, previous: previousSnapshot.mostElevation, isBetter: (a, b) => a > b },
  ];

  summaryComparisons.forEach(({ type, current, previous, isBetter }) => {
    const activityId = Number(current?.activityId || 0);
    if (activityId <= lastSeenActivityId) return;

    const currentValue = Number(current?.primaryValue || 0);
    const previousValue = Number(previous?.primaryValue || 0);
    if (!previous || isBetter(currentValue, previousValue)) {
      const entry = {
        type,
        record: current,
      };
      if (!acknowledged.has(getBreakthroughSignature(entry))) {
        breakthroughs.push(entry);
      }
    }
  });

  return breakthroughs;
}

function formatCelebrationValue(entry, lang, unit, t) {
  if (entry.type === 'distance') {
    return formatDuration(entry.record?.elapsedSeconds || 0);
  }
  if (entry.type === 'longest') {
    return formatDistance(entry.record?.primaryValue || 0, 1, lang, unit);
  }
  if (entry.type === 'pace') {
    return `${formatPaceSeconds(entry.record?.primaryValue || 0)} ${lang === 'zh-CN' ? '/公里' : '/km'}`;
  }
  if (entry.type === 'elevation') {
    return `${Math.round(Number(entry.record?.primaryValue || 0))} ${lang === 'zh-CN' ? '米爬升' : 'm gain'}`;
  }
  return t('profile.pr_modal_value_fallback');
}

function getCelebrationLabel(entry, t) {
  if (entry.type === 'distance') {
    return t(`profile.pr_label_${entry.key}`) || entry.key;
  }
  if (entry.type === 'longest') return t('profile.pr_label_longest');
  if (entry.type === 'pace') return t('profile.pr_label_fastest_pace');
  if (entry.type === 'elevation') return t('profile.pr_label_elevation');
  return '';
}

export default function ProfileDashboard() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [coachState, setCoachState] = useState(null);
  const [coachToday, setCoachToday] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [banner, setBanner] = useState(null);
  const [prCelebration, setPrCelebration] = useState(null);
  const [activeWeeklyBar, setActiveWeeklyBar] = useState(null);
  const [activeProgressionFrame, setActiveProgressionFrame] = useState('total');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      setLoadState('loading');
      try {
        const [profileData, activitiesData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/activities'),
        ]);

        if (cancelled) return;

        const list = Array.isArray(activitiesData) ? activitiesData : [];
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));

        setProfile(profileData);
        setRuns(list);
        setLoadState('ready');

        const query = new URLSearchParams(window.location.search);
        if (query.get('source') === 'strava') {
          setBanner({
            tone: 'success',
            message: t('profile.sync_activity_count', { count: list.length }),
          });
          query.delete('source');
          const nextQuery = query.toString();
          window.history.replaceState({}, document.title, nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname);
        }

        void Promise.all([
          apiJson('/api/coach/state').catch(() => null),
          apiJson('/api/coach/today').catch(() => null),
          apiJson('/api/profile/personal-records').catch(() => null),
        ]).then(([coachStateData, coachTodayData, personalRecordsData]) => {
          if (cancelled) return;

          setCoachState(coachStateData && typeof coachStateData === 'object' ? coachStateData : null);
          setCoachToday(coachTodayData && typeof coachTodayData === 'object' ? coachTodayData : null);

          if (profileData?.email && personalRecordsData && typeof personalRecordsData === 'object') {
            const storageKey = getPrSnapshotStorageKey(profileData.email);
            const previousSnapshot = readJsonStorage(storageKey);
            const breakthroughs = collectPersonalRecordBreakthroughs(previousSnapshot, personalRecordsData, list);
            const nextSnapshot = buildRecordSnapshot(personalRecordsData, list);
            const acknowledgedBreakthroughs = new Set(previousSnapshot?.acknowledgedBreakthroughs || []);
            breakthroughs.forEach((entry) => acknowledgedBreakthroughs.add(getBreakthroughSignature(entry)));
            nextSnapshot.acknowledgedBreakthroughs = Array.from(acknowledgedBreakthroughs);
            writeJsonStorage(storageKey, nextSnapshot);
            if (breakthroughs.length > 0) {
              setPrCelebration({
                count: breakthroughs.length,
                latestRunName: breakthroughs[0]?.record?.sourceRunName || list[0]?.name || t('profile.dashboard_session_fallback'),
                entries: breakthroughs.slice(0, 4),
              });
            }
          }
        }).catch(() => {
          // Optional dashboard enrichments should not block the first render.
        });
      } catch {
        if (!cancelled) {
          setLoadState('error');
        }
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate, t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const checkout = parseCheckoutBannerQuery(window.location.search);
    const linkingNotice = parseProfileLinkingQuery(window.location.search, {
      success: t('profile.strava_link_success'),
      confirmationRequired: t('profile.strava_link_confirmation_required'),
      conflict: t('profile.strava_link_conflict'),
      sessionExpired: t('profile.strava_link_session_expired'),
    });

    if (linkingNotice) {
      setBanner(linkingNotice);
    } else if (checkout === 'success' || checkout === 'cancel') {
      setBanner({
        tone: checkout === 'success' ? 'success' : 'warning',
        message: checkout === 'success'
          ? t('profile.subscription_checkout_success')
          : t('profile.subscription_checkout_cancel'),
      });
    }

    if (linkingNotice || checkout) {
      params.delete('linking');
      params.delete('error');
      params.delete('details');
      params.delete('checkout');
      const nextQuery = params.toString();
      window.history.replaceState({}, document.title, nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname);
    }
  }, [isAuthenticated, t]);

  const displayName = useMemo(() => getDisplayName(profile, t('profile.default_name')), [profile, t]);
  const currentDateLine = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [lang]);

  const todayBundle = useMemo(() => getTodayRunRecommendation({ runs, t, lang }), [runs, t, lang]);
  const readiness = useMemo(() => buildReadinessModel(todayBundle, coachState, t), [coachState, t, todayBundle]);
  const weeklyBars = useMemo(() => buildWeekBars(runs, lang), [lang, runs]);
  const profileVdot = useMemo(() => estimateCurrentVdot(runs).representativeVdot, [runs]);
  const profileVdotTrend = useMemo(() => computeVdotTrend(runs), [runs]);

  const thresholdEstimate = useMemo(() => {
    if (coachState?.profileMaxHeartRateBpm) return Math.round(coachState.profileMaxHeartRateBpm * 0.88);
    const maxHr = runs.reduce((best, run) => Math.max(best, Number(run?.maxHeartRate || 0)), 0);
    return maxHr > 0 ? Math.round(maxHr * 0.88) : null;
  }, [coachState, runs]);

  const restingHrValue = coachState?.lastNightRestingHr ?? coachState?.profileRestingHeartRateBpm ?? null;
  const sleepScoreValue = coachState?.lastSleepScore ?? null;

  const heroWorkout = coachToday?.today || null;
  const heroWorkoutTitle = buildWorkoutHeadline(heroWorkout, todayBundle.recommendation, t);
  const heroDuration = heroWorkout?.plannedDurationMinutes
    ? formatPlannedDuration(heroWorkout.plannedDurationMinutes)
    : todayBundle.recommendation?.distance || '--';
  const heroPace = todayBundle.recommendation?.pace || '--';
  const heroLoad = coachState?.volumeKm7d
    ? formatDistance(coachState.volumeKm7d, 1, lang, unit)
    : '--';
  const recentSessions = runs.slice(0, 3);
  const weeklyActualTotal = weeklyBars.reduce((sum, bar) => sum + Number(bar.actual || 0), 0);
  const weeklyProjectedTotal = weeklyBars.reduce((sum, bar) => sum + Number(bar.projected || 0), 0);
  const weeklyCompletion = weeklyProjectedTotal > 0
    ? Math.max(0, Math.min(100, Math.round((weeklyActualTotal / weeklyProjectedTotal) * 100)))
    : 0;
  const featuredSession = recentSessions[0] || null;
  const featuredSessionMetric = featuredSession ? buildSessionMetric(featuredSession, lang, unit, t) : null;
  const progressionFrames = useMemo(() => PROGRESSION_TIMEFRAMES.map((key) => ({
    key,
    label: t(`profile.dashboard_progression_${key}`),
  })), [t]);
  const progressionAtlas = useMemo(
    () => buildProgressionAtlas(runs, activeProgressionFrame, lang),
    [activeProgressionFrame, lang, runs],
  );

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard', active: true },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  return (
    <div className={`runner-shell-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <Modal
        isOpen={Boolean(prCelebration)}
        onClose={() => setPrCelebration(null)}
        title={t('profile.pr_modal_title')}
        shellClassName="runner-pr-modal-shell"
        cardClassName="runner-pr-modal-card"
      >
        {prCelebration && (
          <div className="runner-pr-modal-body">
            <div className="runner-pr-modal-hero">
              <span className="runner-pr-modal-kicker">{t('profile.pr_modal_kicker')}</span>
              <h4>{t('profile.pr_modal_headline')}</h4>
              <p>{t('profile.pr_modal_copy', { count: prCelebration.count, runName: prCelebration.latestRunName })}</p>
            </div>

            <div className="runner-pr-modal-list">
              {prCelebration.entries.map((entry) => (
                <article key={`${entry.type}-${entry.key || entry.record?.activityId || 'summary'}`} className="runner-pr-modal-entry">
                  <div>
                    <span className="runner-pr-modal-entry-label">{getCelebrationLabel(entry, t)}</span>
                    <strong>{formatCelebrationValue(entry, lang, unit, t)}</strong>
                  </div>
                  <div className="runner-pr-modal-entry-meta">
                    <span>{entry.record?.sourceRunName || t('profile.dashboard_session_fallback')}</span>
                    <span>{formatDate(entry.record?.recordedAt, lang === 'zh-CN' ? 'zh-CN' : 'en-US')}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="runner-pr-modal-actions">
              <button type="button" className="runner-pr-modal-primary" onClick={() => setPrCelebration(null)}>
                {t('profile.pr_modal_cta')}
              </button>
            </div>
          </div>
        )}
      </Modal>

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
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">
              {isSidebarCollapsed ? '>' : '<'}
            </span>
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
            <div className="runner-shell-topnav">
              <span className="runner-shell-topnav-link is-active">{t('profile.dashboard_nav_dashboard')}</span>
            </div>
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={t('profile.settings')}>
                {displayName.slice(0, 1).toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
      <div className="runner-dashboard-main">
        <section className="runner-dashboard-hero-copy">
          <h1>{`${t('profile.dashboard_greeting')}, ${displayName}.`}</h1>
          <p>{currentDateLine} | {t('profile.dashboard_window_active')}</p>
        </section>

        {banner && (
          <section className={`runner-dashboard-banner tone-${banner.tone || 'info'}`}>
            <span>{banner.message}</span>
            <button type="button" onClick={() => setBanner(null)} aria-label={t('profile.close')}>x</button>
          </section>
        )}

        {loadState === 'loading' && (
          <section className="runner-dashboard-loading-card">
            <strong>{t('runs.loading')}</strong>
          </section>
        )}

        {loadState === 'error' && (
          <section className="runner-dashboard-loading-card">
            <strong>{t('runs.load_error')}</strong>
          </section>
        )}

        {loadState === 'ready' && (
          <>
            <section className="runner-dashboard-grid">
              <article className="runner-dashboard-readiness-card">
                <span className="runner-dashboard-card-kicker">{t('profile.dashboard_readiness_status')}</span>
                <h2>{readiness.label}</h2>
                <div className="runner-dashboard-readiness-meter" aria-hidden="true">
                  <div className="runner-dashboard-readiness-meter-fill" style={{ width: `${readiness.score}%` }} />
                </div>
                <div className="runner-dashboard-readiness-score">{readiness.score}%</div>
                <div className="runner-dashboard-readiness-note">
                  <span className="runner-dashboard-note-dot" aria-hidden="true" />
                  <p>{readiness.copy}</p>
                </div>
              </article>

              <article className="runner-dashboard-workout-card" style={{ backgroundImage: `url(${DASHBOARD_HERO_IMAGE})` }}>
                <div className="runner-dashboard-workout-overlay" />
                <div className="runner-dashboard-workout-content">
                  <span className="runner-dashboard-workout-chip">{t('profile.dashboard_suggested_workout')}</span>
                  <h3>{heroWorkoutTitle}</h3>
                  <div className="runner-dashboard-workout-stats">
                    <div>
                      <span>{t('profile.dashboard_total_duration')}</span>
                      <strong>{heroDuration}</strong>
                    </div>
                    <div>
                      <span>{t('profile.dashboard_target_pace')}</span>
                      <strong>{heroPace}</strong>
                    </div>
                    <div>
                      <span>{t('profile.dashboard_focus_load')}</span>
                      <strong>{heroLoad}</strong>
                    </div>
                  </div>
                </div>
              </article>

              <article className="runner-dashboard-weekly-card">
                <div className="runner-dashboard-section-head">
                  <div>
                    <span className="runner-dashboard-card-kicker">{t('profile.dashboard_training_load')}</span>
                    <h4>{t('profile.dashboard_weekly_progress')}</h4>
                  </div>
                  <div className="runner-dashboard-legend">
                    <span><i className="actual" /> {t('profile.dashboard_actual')}</span>
                    <span><i className="projected" /> {t('profile.dashboard_projected')}</span>
                  </div>
                </div>
                <div className="runner-dashboard-bar-chart">
                  {activeWeeklyBar ? (
                    <div
                      className={`runner-dashboard-bar-tooltip${activeWeeklyBar.index <= 1 ? ' is-left' : activeWeeklyBar.index >= 5 ? ' is-right' : ''}`}
                      role="status"
                      aria-live="polite"
                      style={{
                        ...(activeWeeklyBar.index > 1 && activeWeeklyBar.index < 5
                          ? { left: `${((activeWeeklyBar.index + 0.5) / weeklyBars.length) * 100}%` }
                          : {}),
                        top: `clamp(6px, calc(${activeWeeklyBar.actualAnchorTopPct}% - 86px), 112px)`,
                      }}
                    >
                      <strong>{activeWeeklyBar.label}</strong>
                      <span>{t('profile.dashboard_actual')}: {formatDistance(activeWeeklyBar.actual, 1, lang, unit)}</span>
                      <span>{t('profile.dashboard_projected')}: {formatDistance(activeWeeklyBar.projected, 1, lang, unit)}</span>
                    </div>
                  ) : null}
                  {weeklyBars.map((bar) => (
                    <div
                      key={bar.key}
                      className={`runner-dashboard-bar-col${bar.isToday ? ' is-today' : ''}${activeWeeklyBar?.key === bar.key ? ' is-active' : ''}`}
                    >
                      <div className="runner-dashboard-bar-track">
                        <div className="runner-dashboard-bar projected" style={{ height: `${bar.projectedPct}%` }} />
                        <div
                          className="runner-dashboard-bar actual"
                          style={{ height: `${bar.actualPct}%` }}
                          onMouseEnter={() => setActiveWeeklyBar(bar)}
                          onMouseLeave={() => setActiveWeeklyBar(null)}
                          onFocus={() => setActiveWeeklyBar(bar)}
                          onBlur={() => setActiveWeeklyBar(null)}
                          tabIndex={0}
                        />
                      </div>
                      <span>{bar.label}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="runner-dashboard-sessions-card">
                <div className="runner-dashboard-section-head">
                  <div>
                    <span className="runner-dashboard-card-kicker">{t('profile.dashboard_timeline')}</span>
                    <h4>{t('profile.dashboard_recent_sessions')}</h4>
                  </div>
                </div>
                {recentSessions.length === 0 ? (
                  <div className="runner-dashboard-empty">{t('profile.dashboard_no_sessions')}</div>
                ) : (
                  <div className="runner-dashboard-session-list">
                    {recentSessions.map((run) => {
                      const metric = buildSessionMetric(run, lang, unit, t);
                      return (
                        <button
                          key={run.id}
                          type="button"
                          className="runner-dashboard-session-row"
                          onClick={() => navigate(`/run/${run.id}`)}
                        >
                          <div className="runner-dashboard-session-main">
                            <span className="runner-dashboard-session-icon" aria-hidden="true">&gt;</span>
                            <div>
                              <strong>{run.name || t('profile.dashboard_session_fallback')}</strong>
                              <span>{formatRunDate(run, lang)} | {formatDurationCompact(run.movingTimeSeconds || 0)}</span>
                            </div>
                          </div>
                          <div className="runner-dashboard-session-metric">
                            <strong>{metric.value}</strong>
                            <span>{metric.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button type="button" className="runner-dashboard-history-btn" onClick={() => navigate('/runs')}>
                  {t('profile.dashboard_view_full_history')}
                </button>
              </article>
            </section>

            <section className="runner-dashboard-progression-atlas" aria-label={t('profile.dashboard_progression_title')}>
              <div className="runner-dashboard-progression-head">
                <div className="runner-dashboard-progression-heading">
                  <span className="runner-dashboard-card-kicker">{t('profile.dashboard_progression_kicker')}</span>
                  <h3>{t('profile.dashboard_progression_title')}</h3>
                  <p>{t('profile.dashboard_progression_copy')}</p>
                </div>
                <div
                  className="runner-dashboard-progression-switcher"
                  role="tablist"
                  aria-label={t('profile.dashboard_progression_switcher')}
                >
                  {progressionFrames.map((frame) => (
                    <button
                      key={frame.key}
                      type="button"
                      role="tab"
                      className={`runner-dashboard-progression-tab${activeProgressionFrame === frame.key ? ' is-active' : ''}`}
                      aria-selected={activeProgressionFrame === frame.key}
                      onClick={() => setActiveProgressionFrame(frame.key)}
                    >
                      {frame.label}
                    </button>
                  ))}
                </div>
              </div>

              {progressionAtlas.hasData ? (
                <>
                  <div className="runner-dashboard-progression-summary">
                    <div className="runner-dashboard-progression-summary-main">
                      <span className="runner-dashboard-progression-label">{t('profile.dashboard_progression_distance')}</span>
                      <strong>{formatDistance(progressionAtlas.totalDistanceKm, 1, lang, unit)}</strong>
                    </div>
                    <div className="runner-dashboard-progression-summary-meta">
                      <span>{progressionAtlas.rangeLabel}</span>
                      <span>{t('profile.dashboard_progression_share', { share: progressionAtlas.shareOfDistance })}</span>
                    </div>
                  </div>

                  <div className="runner-dashboard-progression-stat-row">
                    <article className="runner-dashboard-progression-stat">
                      <span>{t('profile.dashboard_progression_elevation')}</span>
                      <strong>{formatElevationDisplay(progressionAtlas.totalElevationMeters, lang)}</strong>
                    </article>
                    <article className="runner-dashboard-progression-stat">
                      <span>{t('profile.dashboard_progression_avg_pace')}</span>
                      <strong>{formatPaceDisplay(progressionAtlas.averagePaceSeconds, lang)}</strong>
                    </article>
                    <article className="runner-dashboard-progression-stat">
                      <span>{t('profile.dashboard_progression_duration')}</span>
                      <strong>{formatDuration(progressionAtlas.totalMovingSeconds)}</strong>
                    </article>
                    <article className="runner-dashboard-progression-stat">
                      <span>{t('profile.dashboard_progression_sessions')}</span>
                      <strong>{progressionAtlas.sessionCount}</strong>
                    </article>
                  </div>

                  <div className="runner-dashboard-progression-lane">
                    <article className="runner-dashboard-progression-chart-card">
                      <div className="runner-dashboard-progression-chart-frame">
                        <div className="runner-dashboard-progression-gridlines" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <svg viewBox="0 0 100 100" className="runner-dashboard-progression-chart" aria-hidden="true" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="runner-dashboard-progression-line" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#ffb4a7" />
                              <stop offset="100%" stopColor="#f07561" />
                            </linearGradient>
                            <linearGradient id="runner-dashboard-progression-area" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="rgba(240, 117, 97, 0.32)" />
                              <stop offset="100%" stopColor="rgba(240, 117, 97, 0.02)" />
                            </linearGradient>
                          </defs>
                          {progressionAtlas.chartArea ? (
                            <path d={progressionAtlas.chartArea} fill="url(#runner-dashboard-progression-area)" />
                          ) : null}
                          {progressionAtlas.chartLine ? (
                            <polyline
                              points={progressionAtlas.chartLine}
                              fill="none"
                              stroke="url(#runner-dashboard-progression-line)"
                              strokeWidth="2.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : null}
                          {progressionAtlas.chartPoints.map((point, index) => (
                            <circle
                              key={point.key}
                              cx={point.x}
                              cy={point.y}
                              r={index === progressionAtlas.chartPoints.length - 1 ? 2.8 : 1.7}
                              fill={index === progressionAtlas.chartPoints.length - 1 ? '#f07561' : '#ffddd5'}
                            />
                          ))}
                        </svg>
                        {progressionAtlas.latestPoint ? (
                          <div
                            className={`runner-dashboard-progression-callout${progressionAtlas.latestPoint.x >= 78 ? ' is-right' : progressionAtlas.latestPoint.x <= 22 ? ' is-left' : ''}`}
                            style={{
                              left: `${progressionAtlas.latestPoint.x}%`,
                              top: `${progressionAtlas.latestPoint.y}%`,
                            }}
                          >
                            <strong>{formatDistance(progressionAtlas.totalDistanceKm, 1, lang, unit)}</strong>
                            <span>{t('profile.dashboard_progression_distance')}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="runner-dashboard-progression-axis">
                        <span>{progressionAtlas.startLabel}</span>
                        <span>{progressionAtlas.endLabel}</span>
                      </div>
                    </article>

                    <article className="runner-dashboard-progression-runlist">
                      <div className="runner-dashboard-progression-runlist-head">
                        <div>
                          <span className="runner-dashboard-card-kicker">{t('profile.dashboard_progression_recent')}</span>
                          <h4>{t('profile.dashboard_progression_recent_title')}</h4>
                        </div>
                        <span className="runner-dashboard-progression-runlist-window">{progressionAtlas.rangeLabel}</span>
                      </div>

                      <div className="runner-dashboard-progression-runstack">
                        {progressionAtlas.recentRuns.map((run) => (
                          <button
                            key={run.id}
                            type="button"
                            className="runner-dashboard-progression-runrow"
                            onClick={() => navigate(`/run/${run.id}`)}
                          >
                            <div className="runner-dashboard-progression-runmain">
                              <strong>{run.name || t('profile.dashboard_session_fallback')}</strong>
                              <span>{run.startedAtLabel}</span>
                            </div>
                            <div className="runner-dashboard-progression-runmeta">
                              <strong>{formatDistance(run.distanceKm, 1, lang, unit)}</strong>
                              <span>{formatDurationCompact(run.movingTimeSeconds)} / {formatPaceDisplay(run.paceSeconds, lang)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </article>
                  </div>
                </>
              ) : (
                <div className="runner-dashboard-progression-empty">
                  <strong>{t('profile.dashboard_progression_empty_title')}</strong>
                  <p>{t('profile.dashboard_progression_empty_copy')}</p>
                  <button type="button" className="runner-dashboard-history-btn" onClick={() => navigate('/runs')}>
                    {t('profile.dashboard_view_full_history')}
                  </button>
                </div>
              )}
            </section>

            <section className="runner-dashboard-feature-grid" aria-label={t('profile.dashboard_nav_dashboard')}>
              <article className="runner-dashboard-feature-card runner-dashboard-feature-card--readiness">
                <div className="runner-dashboard-feature-head">
                  <span className="runner-dashboard-card-kicker">{t('profile.dashboard_readiness_status')}</span>
                  <span className="runner-dashboard-feature-eyebrow">{currentDateLine}</span>
                </div>
                <div className="runner-dashboard-feature-copy">
                  <h3>{readiness.label}</h3>
                  <p>{readiness.copy}</p>
                </div>
                <div className="runner-dashboard-feature-scoreband">
                  <strong>{readiness.score}%</strong>
                  <span>{t('profile.dashboard_window_active')}</span>
                </div>
                <div className="runner-dashboard-feature-meter" aria-hidden="true">
                  <div className="runner-dashboard-feature-meter-fill" style={{ width: `${readiness.score}%` }} />
                </div>
              </article>

              <article className="runner-dashboard-feature-card runner-dashboard-feature-card--workout">
                <div className="runner-dashboard-feature-head">
                  <span className="runner-dashboard-card-kicker">{t('profile.dashboard_suggested_workout')}</span>
                  <span className="runner-dashboard-feature-eyebrow">{displayName}</span>
                </div>
                <div className="runner-dashboard-feature-copy">
                  <h3>{heroWorkoutTitle}</h3>
                  <p>{todayBundle.recommendation?.purpose || readiness.copy}</p>
                </div>
                <div className="runner-dashboard-feature-stat-row">
                  <div>
                    <span>{t('profile.dashboard_total_duration')}</span>
                    <strong>{heroDuration}</strong>
                  </div>
                  <div>
                    <span>{t('profile.dashboard_target_pace')}</span>
                    <strong>{heroPace}</strong>
                  </div>
                  <div>
                    <span>{t('profile.dashboard_focus_load')}</span>
                    <strong>{heroLoad}</strong>
                  </div>
                </div>
                <div className="runner-dashboard-feature-actions">
                  <button type="button" className="runner-dashboard-feature-primary" onClick={() => navigate('/today-run')}>
                    {t('profile.dashboard_start_workout')}
                  </button>
                  <button type="button" className="runner-dashboard-feature-secondary" onClick={() => navigate('/analysis')}>
                    {t('profile.dashboard_nav_analysis')}
                  </button>
                </div>
              </article>

              <article className="runner-dashboard-feature-card runner-dashboard-feature-card--load">
                <div className="runner-dashboard-feature-head">
                  <span className="runner-dashboard-card-kicker">{t('profile.dashboard_training_load')}</span>
                  <span className="runner-dashboard-feature-eyebrow">{t('profile.dashboard_weekly_progress')}</span>
                </div>
                <div className="runner-dashboard-feature-copy">
                  <h3>{formatDistance(weeklyActualTotal, 1, lang, unit)}</h3>
                  <p>
                    {t('profile.dashboard_actual')} {weeklyCompletion}% · {t('profile.dashboard_projected')} {formatDistance(weeklyProjectedTotal, 1, lang, unit)}
                  </p>
                </div>
                <div className="runner-dashboard-feature-mini-bars" aria-hidden="true">
                  {weeklyBars.map((bar) => (
                    <span key={bar.key} className={`runner-dashboard-feature-mini-bar${bar.isToday ? ' is-today' : ''}`}>
                      <i className="projected" style={{ height: `${bar.projectedPct}%` }} />
                      <i className="actual" style={{ height: `${bar.actualPct}%` }} />
                    </span>
                  ))}
                </div>
                <div className="runner-dashboard-feature-chip-row">
                  <span>
                    {t('profile.dashboard_vo2_est')}: {profileVdot > 0 ? profileVdot.toFixed(1) : '--'}
                    {profileVdot > 0 && profileVdotTrend.hasData && (
                      <span className={`runner-dashboard-vdot-trend runner-dashboard-vdot-trend--${profileVdotTrend.direction}`}>
                        {profileVdotTrend.direction === 'improving' && <>&#x2191; {profileVdotTrend.delta > 0 ? `+${profileVdotTrend.delta.toFixed(1)}` : profileVdotTrend.delta.toFixed(1)} {t('profile.vdot_trend_improving')}</>}
                        {profileVdotTrend.direction === 'declining' && <>&#x2193; {profileVdotTrend.delta.toFixed(1)} {t('profile.vdot_trend_declining')}</>}
                        {profileVdotTrend.direction === 'maintaining' && <>{t('profile.vdot_trend_maintaining')}</>}
                      </span>
                    )}
                  </span>
                  <span>{t('profile.dashboard_lactate_threshold')}: {thresholdEstimate ?? '--'} bpm</span>
                </div>
              </article>

              <article className="runner-dashboard-feature-card runner-dashboard-feature-card--sessions">
                <div className="runner-dashboard-feature-head">
                  <span className="runner-dashboard-card-kicker">{t('profile.dashboard_recent_sessions')}</span>
                  <span className="runner-dashboard-feature-eyebrow">{featuredSession ? formatRunDate(featuredSession, lang) : '--'}</span>
                </div>
                <div className="runner-dashboard-feature-copy">
                  <h3>{featuredSession?.name || t('profile.dashboard_session_fallback')}</h3>
                  <p>
                    {featuredSessionMetric
                      ? `${featuredSessionMetric.label} · ${featuredSessionMetric.value}`
                      : t('profile.dashboard_no_sessions')}
                  </p>
                </div>
                {recentSessions.length === 0 ? (
                  <div className="runner-dashboard-empty">{t('profile.dashboard_no_sessions')}</div>
                ) : (
                  <div className="runner-dashboard-feature-session-stack">
                    {recentSessions.map((run) => {
                      const metric = buildSessionMetric(run, lang, unit, t);
                      return (
                        <button
                          key={run.id}
                          type="button"
                          className="runner-dashboard-feature-session-pill"
                          onClick={() => navigate(`/run/${run.id}`)}
                        >
                          <div>
                            <strong>{run.name || t('profile.dashboard_session_fallback')}</strong>
                            <span>{formatRunDate(run, lang)}</span>
                          </div>
                          <em>{metric.value}</em>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button type="button" className="runner-dashboard-feature-link" onClick={() => navigate('/runs')}>
                  {t('profile.dashboard_view_full_history')}
                </button>
              </article>
            </section>

            <section className="runner-dashboard-metric-strip">
              <article className="runner-dashboard-mini-metric">
                <span>01</span>
                <div>
                  <label>{t('profile.dashboard_vo2_est')}</label>
                  <strong>{profileVdot > 0 ? profileVdot.toFixed(1) : '--'} <em>{t('profile.vo2_unit_short')}</em></strong>
                  {profileVdot > 0 && profileVdotTrend.hasData && (
                    <span className={`runner-dashboard-vdot-trend runner-dashboard-vdot-trend--${profileVdotTrend.direction}`}>
                      {profileVdotTrend.direction === 'improving' && <>&#x2191; {profileVdotTrend.delta > 0 ? `+${profileVdotTrend.delta.toFixed(1)}` : profileVdotTrend.delta.toFixed(1)} {t('profile.vdot_trend_improving')}</>}
                      {profileVdotTrend.direction === 'declining' && <>&#x2193; {profileVdotTrend.delta.toFixed(1)} {t('profile.vdot_trend_declining')}</>}
                      {profileVdotTrend.direction === 'maintaining' && <>{t('profile.vdot_trend_maintaining')}</>}
                    </span>
                  )}
                </div>
              </article>
              <article className="runner-dashboard-mini-metric">
                <span>02</span>
                <div>
                  <label>{t('profile.dashboard_lactate_threshold')}</label>
                  <strong>{thresholdEstimate ?? '--'} <em>bpm</em></strong>
                </div>
              </article>
              <article className="runner-dashboard-mini-metric">
                <span>03</span>
                <div>
                  <label>{t('profile.dashboard_resting_hr')}</label>
                  <strong>{restingHrValue ?? '--'} <em>bpm</em></strong>
                </div>
              </article>
              <article className="runner-dashboard-mini-metric">
                <span>04</span>
                <div>
                  <label>{t('profile.dashboard_sleep_score')}</label>
                  <strong>{sleepScoreValue ?? '--'} <em>/ 100</em></strong>
                </div>
              </article>
            </section>
          </>
        )}

        <footer className="runner-shell-footer runner-dashboard-footer">
          <FooterNavLinks />
        </footer>
      </div>
        </div>
      </main>
    </div>
  );
}

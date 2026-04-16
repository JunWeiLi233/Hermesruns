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
import {
  buildProgressionAtlas,
  getNearestProgressionPointIndex,
  PROGRESSION_TIMEFRAMES,
} from '../utils/progressionAtlas';
import { getTodayRunRecommendation } from '../utils/todayRun';
import { parseCheckoutBannerQuery, parseProfileLinkingQuery } from '../utils/stravaLinking';
import { estimateCurrentVdot, computeVdotTrend } from '../utils/vdot';

const DASHBOARD_HERO_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCduh8I3MMazSPbifhs59F6YdwIOS-ZRvW7t_n3qJKHxcqDJP3fep7cglrfaXiwrYYPwPxFtz_ExFJggZD-Cy5WZbURvgfE6h4Bvc2M_XU19LaXiqyfdCoyiRn0Aoln4WxGCgqJqtK1Kn2Mlp-KiHvYvqqeidejVqd75xj0rXOXokd_ePH6X6P2LEuMuuZNA5N5gVErlHBg3f0Qdi_d5PaePI6Fzw8BoDHmloQLsQl4agd74Hb85CXqnA1DUwAI-P6P3oPHBwKS50k8';
const PR_SNAPSHOT_VERSION = 1;

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

function startOfIsoWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function formatPaceDisplay(secondsPerKm, lang) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--';
  return `${formatPaceSeconds(secondsPerKm)} ${lang === 'zh-CN' ? '/公里' : '/km'}`;
}

function formatElevationDisplay(totalMeters, lang) {
  if (!Number.isFinite(totalMeters) || totalMeters <= 0) return '--';
  return `${Math.round(totalMeters)} ${lang === 'zh-CN' ? '米' : 'm'}`;
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

function buildStaminaFallback(readiness, heroPace, restingHrValue) {
  return {
    scorePercent: readiness.score,
    recoveryCapPercent: Math.min(100, readiness.score + 2),
    targetPaceSecondsPerKm: null,
    targetHeartRateBpm: restingHrValue,
    direction: 'steady',
    fallbackPaceLabel: heroPace || '--',
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
  const [races, _setRaces] = useState([]);
  const [nextRace, setNextRace] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [banner, setBanner] = useState(null);
  const [prCelebration, setPrCelebration] = useState(null);
  const [activeWeeklyBar, setActiveWeeklyBar] = useState(null);
  const [activeProgressionFrame, setActiveProgressionFrame] = useState('total');
  const [activeProgressionPointIndex, setActiveProgressionPointIndex] = useState(-1);

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
          apiJson('/api/races').catch(() => null),
        ]).then(([coachStateData, coachTodayData, personalRecordsData, racesData]) => {
          if (cancelled) return;

          setCoachState(coachStateData && typeof coachStateData === 'object' ? coachStateData : null);
          setCoachToday(coachTodayData && typeof coachTodayData === 'object' ? coachTodayData : null);

          if (Array.isArray(racesData)) {
            _setRaces(racesData);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const upcoming = racesData
              .filter(r => !r.canceled)
              .map(r => ({ ...r, parsedDate: new Date(r.date) }))
              .filter(r => !Number.isNaN(r.parsedDate.getTime()) && r.parsedDate >= now)
              .sort((a, b) => a.parsedDate - b.parsedDate);
            setNextRace(upcoming[0] || null);
          }

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

  const raceCountdown = useMemo(() => {
    if (!nextRace?.parsedDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = nextRace.parsedDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [nextRace]);

  const racePrepPhase = useMemo(() => {
    if (raceCountdown === null) return null;
    if (raceCountdown <= 7) return { key: 'taper', label: t('profile.dashboard_race_phase_taper') };
    if (raceCountdown <= 21) return { key: 'peak', label: t('profile.dashboard_race_phase_peak') };
    if (raceCountdown <= 56) return { key: 'specific', label: t('profile.dashboard_race_phase_specific') };
    return { key: 'base', label: t('profile.dashboard_race_phase_base') };
  }, [raceCountdown, t]);

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
  const stamina = useMemo(
    () => coachState?.stamina || buildStaminaFallback(readiness, heroPace, restingHrValue),
    [coachState?.stamina, heroPace, readiness, restingHrValue],
  );
  const staminaArrowIcon = stamina.direction === 'up'
    ? 'arrow_upward'
    : stamina.direction === 'steady'
      ? 'trending_flat'
      : 'arrow_downward';
  const staminaPaceLabel = stamina.targetPaceSecondsPerKm != null
    ? formatPaceSeconds(stamina.targetPaceSecondsPerKm)
    : stamina.fallbackPaceLabel || '--';
  const staminaHeartLabel = stamina.targetHeartRateBpm != null ? String(stamina.targetHeartRateBpm) : '--';
  const staminaScorePercent = Math.max(0, Math.min(100, Number(stamina.scorePercent || 0)));
  const staminaCapPercent = Math.max(0, Math.min(100, Number(stamina.recoveryCapPercent || 0)));
  const staminaCapMarkerLeft = Math.max(4, Math.min(96, staminaCapPercent));
  const progressionFrames = useMemo(() => PROGRESSION_TIMEFRAMES.map((key) => ({
    key,
    label: t(`profile.dashboard_progression_${key}`),
  })), [t]);
  const progressionAtlas = useMemo(
    () => buildProgressionAtlas(runs, activeProgressionFrame, lang),
    [activeProgressionFrame, lang, runs],
  );
  const activeProgressionPoint = activeProgressionPointIndex >= 0
    ? progressionAtlas.chartPoints[activeProgressionPointIndex] || progressionAtlas.latestPoint
    : progressionAtlas.latestPoint;

  useEffect(() => {
    if (progressionAtlas.chartPoints.length === 0) {
      setActiveProgressionPointIndex(-1);
      return;
    }
    setActiveProgressionPointIndex(progressionAtlas.chartPoints.length - 1);
  }, [progressionAtlas.chartPoints.length, progressionAtlas.latestPoint?.key]);

  function setNearestProgressionPoint(clientX, currentTarget) {
    if (!currentTarget || progressionAtlas.chartPoints.length === 0) return;

    const bounds = currentTarget.getBoundingClientRect();
    if (!bounds.width) return;

    const xPercent = ((clientX - bounds.left) / bounds.width) * 100;
    const nextIndex = getNearestProgressionPointIndex(progressionAtlas.chartPoints, xPercent);
    setActiveProgressionPointIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
  }

  function resetProgressionPoint() {
    setActiveProgressionPointIndex(progressionAtlas.chartPoints.length - 1);
  }

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard', active: true },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'weather_engine', label: lang === 'zh-CN' ? '天气引擎' : 'Weather Engine', route: '/weather-engine', icon: 'thermostat' },
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
                      <div
                        className="runner-dashboard-progression-chart-frame"
                        onPointerMove={(event) => setNearestProgressionPoint(event.clientX, event.currentTarget)}
                        onPointerDown={(event) => setNearestProgressionPoint(event.clientX, event.currentTarget)}
                        onPointerLeave={resetProgressionPoint}
                      >
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
                            <path
                              d={progressionAtlas.chartLine}
                              className="runner-dashboard-progression-line-glow"
                              fill="none"
                              stroke="url(#runner-dashboard-progression-line)"
                              strokeWidth="4.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : null}
                          {progressionAtlas.chartLine ? (
                            <path
                              d={progressionAtlas.chartLine}
                              fill="none"
                              stroke="url(#runner-dashboard-progression-line)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : null}
                          {activeProgressionPoint ? (
                            <line
                              className="runner-dashboard-progression-focus-rail"
                              x1={activeProgressionPoint.x}
                              x2={activeProgressionPoint.x}
                              y1={activeProgressionPoint.y}
                              y2="86"
                            />
                          ) : null}
                        </svg>
                        <div className="runner-dashboard-progression-marker-layer" aria-hidden="true">
                          {progressionAtlas.chartPoints.map((point) => (
                            <span
                              key={`${point.key}-marker`}
                              className={`runner-dashboard-progression-marker${activeProgressionPoint?.key === point.key ? ' is-active' : ''}`}
                              style={{
                                left: `${point.x}%`,
                                top: `${point.y}%`,
                              }}
                            />
                          ))}
                          {activeProgressionPoint ? (
                            <span
                              className="runner-dashboard-progression-active-marker"
                              style={{
                                left: `${activeProgressionPoint.x}%`,
                                top: `${activeProgressionPoint.y}%`,
                              }}
                            >
                              <span className="runner-dashboard-progression-active-marker-halo" />
                              <span className="runner-dashboard-progression-active-marker-core" />
                            </span>
                          ) : null}
                        </div>
                        <div className="runner-dashboard-progression-hit-lane">
                          {progressionAtlas.chartPoints.map((point, index) => (
                            <button
                              key={`${point.key}-hit`}
                              type="button"
                              className={`runner-dashboard-progression-hitpoint${activeProgressionPoint?.key === point.key ? ' is-active' : ''}`}
                              style={{
                                left: `${point.x}%`,
                                top: `${point.y}%`,
                              }}
                              onMouseEnter={() => setActiveProgressionPointIndex(index)}
                              onFocus={() => setActiveProgressionPointIndex(index)}
                              onBlur={resetProgressionPoint}
                              aria-label={`${point.label}: ${formatDistance(point.cumulativeDistance, 1, lang, unit)}`}
                            />
                          ))}
                        </div>
                        {activeProgressionPoint ? (
                          <div
                            className={`runner-dashboard-progression-callout${activeProgressionPoint.x >= 78 ? ' is-right' : activeProgressionPoint.x <= 22 ? ' is-left' : ''}`}
                            role="status"
                            aria-live="polite"
                            style={{
                              left: `${activeProgressionPoint.x}%`,
                              top: `${activeProgressionPoint.y}%`,
                            }}
                          >
                            <strong>{formatDistance(activeProgressionPoint.cumulativeDistance, 1, lang, unit)}</strong>
                            <span>{activeProgressionPoint.label}</span>
                            <small>
                              {formatDistance(activeProgressionPoint.distanceKm, 1, lang, unit)} · {activeProgressionPoint.sessions} {t('profile.dashboard_progression_sessions')}
                            </small>
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
              <article className="runner-dashboard-feature-card runner-dashboard-feature-card--race">
                <div className="runner-dashboard-feature-head">
                  <span className="runner-dashboard-card-kicker">{t('profile.dashboard_race_countdown_title')}</span>
                  <span className="runner-dashboard-feature-eyebrow">
                    {nextRace ? formatDate(nextRace.date, lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '--'}
                  </span>
                </div>
                {nextRace ? (
                  <>
                    <div className="runner-dashboard-feature-copy">
                      <h3>{nextRace.name}</h3>
                      <div className="runner-dashboard-race-countdown">
                        <strong>{raceCountdown}</strong>
                        <span>{t('profile.dashboard_race_days_left', { days: '' }).trim()}</span>
                      </div>
                    </div>
                    <div className="runner-dashboard-race-prep">
                      <span className="runner-dashboard-race-phase-tag">{racePrepPhase?.label}</span>
                      <p>
                        <small>{t('profile.dashboard_race_prep_advice')}</small>
                        {racePrepPhase?.key === 'taper' && (lang === 'zh-CN' ? '优先保证睡眠，适当通过短促冲刺维持神经兴奋性。' : 'Prioritize sleep and maintain neuro-muscular pop with short strides.')}
                        {racePrepPhase?.key === 'peak' && (lang === 'zh-CN' ? '进入最高跑量周，注意核心肌群的力量补充。' : 'Peak volume weeks—ensure core strength maintenance.')}
                        {racePrepPhase?.key === 'specific' && (lang === 'zh-CN' ? '磨炼比赛配速的体感，优化补给策略。' : 'Refine race-pace feel and practice fueling strategies.')}
                        {racePrepPhase?.key === 'base' && (lang === 'zh-CN' ? '稳步提升有氧耐力，重点在于低心率慢跑。' : 'Build aerobic base with steady, low-HR volume.')}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="runner-dashboard-feature-copy is-empty">
                    <h3>{t('profile.dashboard_race_no_upcoming')}</h3>
                    <button type="button" className="runner-dashboard-feature-link" onClick={() => navigate('/races')}>
                      {t('profile.dashboard_race_view_all', { count: races.length })}
                    </button>
                  </div>
                )}
                <div className="runner-dashboard-feature-actions">
                  <button type="button" className="runner-dashboard-feature-secondary" onClick={() => navigate('/races')}>
                    {t('profile.dashboard_nav_races')}
                  </button>
                </div>
              </article>

              <article className="runner-dashboard-feature-card runner-dashboard-feature-card--readiness runner-dashboard-feature-card--stamina">
                <div className="runner-dashboard-feature-head">
                  <span className="runner-dashboard-card-kicker">{t('profile.dashboard_stamina_title')}</span>
                  <span className="runner-dashboard-feature-eyebrow">{currentDateLine}</span>
                </div>
                <div className="runner-dashboard-feature-copy runner-dashboard-stamina-copy">
                  <h3>{readiness.label}</h3>
                  <p>{readiness.copy}</p>
                </div>
                <div className="runner-dashboard-stamina-hero">
                  <div className="runner-dashboard-feature-scoreband runner-dashboard-stamina-scoreband">
                    <span>{t('profile.dashboard_readiness_status')}</span>
                    <div className="runner-dashboard-stamina-scoreline">
                      <AppIcon name={staminaArrowIcon} className={`runner-dashboard-stamina-arrow runner-dashboard-stamina-arrow--${stamina.direction}`} />
                      <strong>{staminaScorePercent}<em>%</em></strong>
                    </div>
                  </div>
                  <div className="runner-dashboard-stamina-capline">
                    <span>{t('profile.dashboard_stamina_cap')}</span>
                    <strong>{staminaCapPercent}<em>%</em></strong>
                    <small>{currentDateLine}</small>
                  </div>
                </div>
                <div className="runner-dashboard-stamina-meter-wrap">
                  <div className="runner-dashboard-stamina-meter-labels">
                    <span>{t('profile.dashboard_stamina_title')}</span>
                    <span>{t('profile.dashboard_stamina_cap')}</span>
                  </div>
                  <div className="runner-dashboard-feature-meter runner-dashboard-stamina-meter" aria-hidden="true">
                    <div className="runner-dashboard-feature-meter-fill runner-dashboard-stamina-meter-fill" style={{ width: `${staminaScorePercent}%` }} />
                    <span className="runner-dashboard-stamina-cap-marker" style={{ left: `${staminaCapMarkerLeft}%` }} />
                  </div>
                </div>
                <div className="runner-dashboard-feature-stat-row runner-dashboard-stamina-stat-row">
                  <div>
                    <span>{t('profile.dashboard_stamina_pace')}</span>
                    <strong>{staminaPaceLabel}</strong>
                  </div>
                  <div>
                    <span>{t('analysis.intensity_dashboard_sample_heart_rate')}</span>
                    <strong>
                      {staminaHeartLabel}
                      {staminaHeartLabel !== '--' && <em>bpm</em>}
                    </strong>
                  </div>
                  <div>
                    <span>{t('profile.dashboard_stamina_cap')}</span>
                    <strong>{staminaCapPercent}<em>%</em></strong>
                  </div>
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

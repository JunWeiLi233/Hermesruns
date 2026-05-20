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
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import { formatDate, formatDistance, formatDuration, formatPaceSeconds } from '../utils/format';
import {
  buildProgressionAtlas,
  getNearestProgressionPointIndex,
  PROGRESSION_TIMEFRAMES,
} from '../utils/progressionAtlas';
import { getTodayRunRecommendation } from '../utils/todayRun';
import { parseCheckoutBannerQuery, parseProfileLinkingQuery } from '../utils/stravaLinking';
import { consumeStravaOauthPendingFlag, STRAVA_SYNC_FINISHED_EVENT } from '../utils/stravaAutoSync';
import { estimateCurrentVdot, computeVdotTrend, buildOrderedRacePredictions } from '../utils/vdot';
import { calculateStreaks, getDaysSinceLastRun } from '../utils/streakUtils';
import { buildRewardShowcase, RewardGlyph } from '../utils/rewardBadges';
import ComebackMessage from '../components/ComebackMessage';

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

function formatPaceDisplay(secondsPerKm, t) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--';
  return `${formatPaceSeconds(secondsPerKm)} ${t('run_detail.unit_pace')}`;
}

function formatElevationDisplay(totalMeters, t) {
  if (!Number.isFinite(totalMeters) || totalMeters <= 0) return '--';
  return `${Math.round(totalMeters)} ${t('run_detail.unit_meter')}`;
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
    return day.toLocaleDateString(lang, { weekday: 'short' }).slice(0, 3).toUpperCase();
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
    key: label,
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

  const elevation = Number(run?.elevationGainMeters ?? run?.totalElevationGainMeters ?? run?.totalElevationGain ?? 0);
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
  return started.toLocaleDateString(lang, {
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

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sortRunsByMostRecent(runs) {
  const list = Array.isArray(runs) ? [...runs] : [];
  list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
  return list;
}

function normalizeProfileDashboardPayload(payload) {
  if (!isRecord(payload) || !isRecord(payload.profile)) return null;
  const activities = payload.activities ?? payload.runs;
  if (!Array.isArray(activities)) return null;

  return {
    source: 'batch',
    profile: payload.profile,
    runs: sortRunsByMostRecent(activities),
    coachState: payload.coachState ?? payload.state ?? null,
    coachToday: payload.coachToday ?? payload.today ?? null,
    personalRecords: payload.personalRecords ?? payload.personalRecordSummary ?? null,
    races: payload.races ?? [],
    shoes: Array.isArray(payload.shoes) ? payload.shoes : [],
    musclePlan: payload.musclePlan ?? payload.trainingMusclePlan ?? null,
    quota: payload.quota ?? payload.subscriptionState ?? null,
    deferredEnrichment: payload.deferredEnrichment === true,
  };
}

async function loadProfileDashboardFallbackData() {
  const [profileResult, activitiesResult, shoesResult] = await Promise.allSettled([
    apiJson('/api/profile/me'),
    apiJson('/api/activities'),
    apiJson('/api/shoes'),
  ]);

  if (profileResult.status !== 'fulfilled') {
    throw profileResult.reason || new Error('profile_load_failed');
  }

  return {
    source: 'fallback',
    profile: profileResult.value,
    runs: sortRunsByMostRecent(activitiesResult.status === 'fulfilled' ? activitiesResult.value : []),
    shoes: shoesResult.status === 'fulfilled' && Array.isArray(shoesResult.value) ? shoesResult.value : [],
  };
}

async function loadProfileDashboardFallbackEnrichmentData() {
  const [
    coachStateData,
    coachTodayData,
    personalRecordsData,
    racesData,
    musclePlanData,
    quotaData,
  ] = await Promise.all([
    apiJson('/api/coach/state').catch(() => null),
    apiJson('/api/coach/today').catch(() => null),
    apiJson('/api/profile/personal-records').catch(() => null),
    apiJson('/api/races').catch(() => null),
    apiJson('/api/training/muscle/plan').catch(() => null),
    apiJson('/api/profile/quota').catch(() => null),
  ]);

  return {
    coachState: coachStateData,
    coachToday: coachTodayData,
    personalRecords: personalRecordsData,
    races: racesData,
    musclePlan: musclePlanData,
    quota: quotaData,
  };
}

async function loadProfileDashboardData() {
  try {
    const batchPayload = await apiJson('/api/profile/dashboard');
    const normalized = normalizeProfileDashboardPayload(batchPayload);
    if (normalized) return normalized;
  } catch {
    // Fall through to the individual endpoints that powered the dashboard before batching.
  }

  return loadProfileDashboardFallbackData();
}

function getUpcomingRace(racesData) {
  if (!Array.isArray(racesData)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = racesData
    .filter(r => !r.canceled)
    .map(r => ({ ...r, date: r.date ?? r.eventDate, parsedDate: new Date(r.date ?? r.eventDate) }))
    .filter(r => !Number.isNaN(r.parsedDate.getTime()) && r.parsedDate >= now)
    .sort((a, b) => a.parsedDate - b.parsedDate);
  return upcoming[0] || null;
}

function formatCelebrationValue(entry, lang, unit, t) {
  if (entry.type === 'distance') {
    return formatDuration(entry.record?.elapsedSeconds || 0);
  }
  if (entry.type === 'longest') {
    return formatDistance(entry.record?.primaryValue || 0, 1, lang, unit);
  }
  if (entry.type === 'pace') {
    return `${formatPaceSeconds(entry.record?.primaryValue || 0)} ${t('run_detail.unit_pace')}`;
  }
  if (entry.type === 'elevation') {
    return `${Math.round(Number(entry.record?.primaryValue || 0))} ${t('run_detail.unit_elevation_gain')}`;
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
  const [dismissedComeback, setDismissedComeback] = useState(false);
  const [activeWeeklyBar, setActiveWeeklyBar] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeProgressionFrame, setActiveProgressionFrame] = useState('total');
  const [activeProgressionPointIndex, setActiveProgressionPointIndex] = useState(-1);
  const [musclePlan, setMusclePlan] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      setLoadState('loading');
      try {
        const dashboardData = await loadProfileDashboardData();

        if (cancelled) return;

        const profileData = dashboardData.profile;
        const list = dashboardData.runs;

        function applyDashboardEnrichment(enrichmentData) {
          setCoachState(enrichmentData.coachState && typeof enrichmentData.coachState === 'object' ? enrichmentData.coachState : null);
          setCoachToday(enrichmentData.coachToday && typeof enrichmentData.coachToday === 'object' ? enrichmentData.coachToday : null);
          setMusclePlan(enrichmentData.musclePlan && typeof enrichmentData.musclePlan === 'object' && enrichmentData.musclePlan.days ? enrichmentData.musclePlan : null);
          if (Array.isArray(enrichmentData.races)) {
            _setRaces(enrichmentData.races);
            setNextRace(getUpcomingRace(enrichmentData.races));
          }

          const personalRecordsData = enrichmentData.personalRecords;
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
        }

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

        if (dashboardData.source === 'batch') {
          applyDashboardEnrichment(dashboardData);
          if (dashboardData.deferredEnrichment) {
            void loadProfileDashboardFallbackEnrichmentData().then((enrichmentData) => {
              if (!cancelled) applyDashboardEnrichment(enrichmentData);
            }).catch(() => {
              // Optional dashboard enrichments should not block the first render.
            });
          }
        } else {
          void loadProfileDashboardFallbackEnrichmentData().then((enrichmentData) => {
            if (!cancelled) applyDashboardEnrichment(enrichmentData);
          }).catch(() => {
            // Optional dashboard enrichments should not block the first render.
          });
        }
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

    const query = new URLSearchParams(window.location.search);
    const redirectedFromStrava = query.get('source') === 'strava';
    const pendingStravaHydration = redirectedFromStrava || consumeStravaOauthPendingFlag({});

    if (!pendingStravaHydration) {
      return;
    }

    setBanner((current) => current ?? {
      tone: 'info',
      message: t('profile.strava_sync_processing'),
    });

    if (redirectedFromStrava) {
      query.delete('source');
      const nextQuery = query.toString();
      window.history.replaceState({}, document.title, nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    function handleStravaSyncFinished() {
      window.location.reload();
    }

    window.addEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    return () => {
      window.removeEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    };
  }, [isAuthenticated]);

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
    return now.toLocaleDateString(lang, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [lang]);

  const todayBundle = useMemo(() => getTodayRunRecommendation({ runs, t, lang }), [runs, t, lang]);
  const readiness = useMemo(() => buildReadinessModel(todayBundle, coachState, t), [coachState, t, todayBundle]);
  const weeklyBars = useMemo(() => buildWeekBars(runs, lang), [lang, runs]);
  const profileVdot = useMemo(() => estimateCurrentVdot(runs), [runs]);
  const vdotTrend = useMemo(() => computeVdotTrend(runs), [runs]);
  const hasWeatherAdjustments = useMemo(() => runs.some((r) => (r.pacePenaltySecPerKm || 0) > 0), [runs]);
  const totalRuns = runs.length;
  const totalDistanceKm = useMemo(() => runs.reduce((sum, r) => sum + resolveRunDistanceKm(r), 0), [runs]);
  const streak = useMemo(() => calculateStreaks(runs), [runs]);
  const daysOff = useMemo(() => getDaysSinceLastRun(runs), [runs]);
  const rewardShowcase = useMemo(() => buildRewardShowcase(runs, lang), [runs, lang]);
  const rewardEarnedCount = rewardShowcase.earnedRewards.length;
  const rewardTotalCount = rewardShowcase.allRewards.length;
  const rewardCompletionPct = rewardTotalCount > 0
    ? Math.round((rewardEarnedCount / rewardTotalCount) * 100)
    : 0;
  const rewardNextMilestone = rewardShowcase.upcomingRewards[0] || null;
  const rewardNextMilestonePct = rewardNextMilestone
    ? Math.round(rewardNextMilestone.progress * 100)
    : 100;

  const racePredictions = useMemo(() => {
    const vdotValue = profileVdot.representativeVdot;
    if (vdotValue <= 0) return [];
    return buildOrderedRacePredictions(vdotValue, runs).map((d) => {
      const timeMin = d.timeMin;
      if (!timeMin || timeMin <= 0) return null;
      const totalSec = Math.round(timeMin * 60);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const display = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
      return { key: d.key, label: lang === 'zh-CN' ? d.labelZh : d.labelEn, time: display };
    }).filter(Boolean);
  }, [profileVdot, runs, lang]);

  const thresholdEstimate = useMemo(() => {
    if (coachState?.profileMaxHeartRateBpm) return Math.round(coachState.profileMaxHeartRateBpm * 0.88);
    const maxHr = runs.reduce((best, run) => Math.max(best, Number(run?.maxHeartRate || 0)), 0);
    return maxHr > 0 ? Math.round(maxHr * 0.88) : null;
  }, [coachState, runs]);

  const restingHrValue = coachState?.lastNightRestingHr ?? coachState?.profileRestingHeartRateBpm ?? null;
  const sleepScoreValue = coachState?.lastSleepScore ?? null;

  const strengthSummary = useMemo(() => {
    if (!musclePlan || !Array.isArray(musclePlan.days)) return null;
    const days = musclePlan.days;
    const today = days[0] || null;
    const strengthDays = days.filter((d) => d && d.strength);
    const sessionCount = strengthDays.length;
    const sessionMinutes = musclePlan.profile?.sessionMinutes || musclePlan.weekContext?.sessionMinutes || 30;
    const focus = musclePlan.weekContext?.currentFocus || '';
    const todayHasStrength = today && today.strength;
    const todaySessionType = todayHasStrength ? today.strength.sessionType : null;
    const todayDuration = todayHasStrength ? (today.strength.durationMinutes ?? sessionMinutes) : null;
    const todayOptional = todayHasStrength ? today.strength.optional : false;
    return {
      sessionCount,
      sessionMinutes,
      focus,
      todayHasStrength,
      todaySessionType,
      todayDuration,
      todayOptional,
    };
  }, [musclePlan]);

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
  const featuredSession = recentSessions[0] || null;
  const featuredSessionMetric = featuredSession ? buildSessionMetric(featuredSession, lang, unit, t) : null;
  const weeklyActualTotal = weeklyBars.reduce((sum, bar) => sum + Number(bar.actual || 0), 0);
  const weeklyProjectedTotal = weeklyBars.reduce((sum, bar) => sum + Number(bar.projected || 0), 0);
  const weeklyCompletion = weeklyProjectedTotal > 0
    ? Math.max(0, Math.min(100, Math.round((weeklyActualTotal / weeklyProjectedTotal) * 100)))
    : 0;
  const profileDecisionMap = useMemo(() => [
    {
      key: 'today',
      icon: 'calendar_today',
      label: t('profile.dashboard_suggested_workout'),
      value: heroWorkoutTitle,
      detail: heroDuration,
    },
    {
      key: 'load',
      icon: 'show_chart',
      label: t('profile.dashboard_training_load'),
      value: formatDistance(weeklyActualTotal, 1, lang, unit),
      detail: `${weeklyCompletion}% ${t('profile.dashboard_actual')}`,
    },
    {
      key: 'fitness',
      icon: 'insights',
      label: t('profile.dashboard_vo2_est'),
      value: profileVdot.representativeVdot > 0 ? profileVdot.representativeVdot.toFixed(1) : '--',
      detail: profileVdot.representativeVdot > 0 && vdotTrend.hasData
        ? `${vdotTrend.delta > 0 ? '+' : ''}${vdotTrend.delta.toFixed(1)} ${t(`profile.vdot_trend_${vdotTrend.direction}`)}`
        : t('profile.dashboard_window_active'),
    },
    {
      key: 'race',
      icon: 'flag',
      label: t('profile.dashboard_race_countdown_title'),
      value: nextRace?.name || t('profile.dashboard_race_no_upcoming'),
      detail: raceCountdown != null
        ? t('profile.dashboard_race_days_left', { days: raceCountdown })
        : t('profile.dashboard_nav_races'),
    },
  ], [
    heroDuration,
    heroWorkoutTitle,
    lang,
    nextRace?.name,
    profileVdot.representativeVdot,
    raceCountdown,
    t,
    unit,
    vdotTrend.delta,
    vdotTrend.direction,
    vdotTrend.hasData,
    weeklyActualTotal,
    weeklyCompletion,
  ]);
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
    { key: 'territory', label: t('profile.dashboard_nav_territory'), route: '/territory', icon: 'territory' },
    { key: 'weather_engine', label: t('profile.dashboard_nav_weather_engine'), route: '/weather', icon: 'thermostat' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
    { key: 'muscle', label: t('muscle_training.nav_label'), route: '/muscle-training', icon: 'fitness_center' },
    { key: 'workflows', label: t('profile.dashboard_nav_workflows'), route: '/workflows', icon: 'account_tree' },
  ];

  return (
    <div className={`runner-shell-page runner-dashboard-page profile-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
                    <span>{formatDate(entry.record?.recordedAt, lang)}</span>
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
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={t('profile.dashboard_nav_dashboard')}
              navigate={navigate}
            />
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
          <div className="hd-content">
            {/* ── Kinetic Editorial Sections ── */}

            {/* 1. Hero */}
            <section className="hd-hero">
              <div className="hd-hero-text">
                <span className="hd-hero-date">{currentDateLine}</span>
                <h1 className="hd-hero-greeting">
                  {(() => {
                    const h = new Date().getHours();
                    if (h < 12) return t('profile.dashboard_redesign.hero_morning');
                    if (h < 18) return t('profile.dashboard_redesign.hero_afternoon');
                    return t('profile.dashboard_redesign.hero_evening');
                  })()}, {displayName}.
                </h1>
              </div>
              <div className="hd-hero-readiness">
                <div className="hd-readiness-ring">
                  <svg viewBox="0 0 80 80" className="hd-readiness-svg">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="6" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke="url(#hdReadinessGrad)" strokeWidth="6"
                      strokeDasharray={`${readiness.score * 2.136} 999`}
                      strokeLinecap="round" transform="rotate(-90 40 40)" />
                    <defs>
                      <linearGradient id="hdReadinessGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f07561" />
                        <stop offset="100%" stopColor="#a0392a" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="hd-readiness-value"><strong>{readiness.score}</strong></div>
                </div>
                <div className="hd-readiness-meta">
                  <span className="hd-readiness-label">{t('profile.dashboard_redesign.hero_readiness')}</span>
                  <span className="hd-readiness-status">{readiness.label}</span>
                </div>
              </div>
            </section>

            {/* Banners / comeback (preserved) */}
            {banner && (
              <section className={`runner-dashboard-banner tone-${banner.tone || 'info'}`}>
                <span>{banner.message}</span>
                <button type="button" onClick={() => setBanner(null)} aria-label={t('profile.close')}>x</button>
              </section>
            )}
            {!dismissedComeback && daysOff >= 3 && (
              <ComebackMessage daysOff={daysOff} onDismiss={() => setDismissedComeback(true)} />
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
            {loadState === 'ready' && runs.length === 0 && (
              <section className="runner-dashboard-empty-state">
                <div className="runner-dashboard-empty-hero">
                  <span className="material-symbols-outlined runner-dashboard-empty-icon" aria-hidden="true">directions_run</span>
                  <h2>{t('profile.dashboard_empty_title')}</h2>
                  <p>{t('profile.dashboard_empty_copy')}</p>
                </div>
                <div className="runner-dashboard-empty-actions">
                  <button type="button" className="runner-dashboard-empty-cta runner-dashboard-empty-cta--primary" onClick={() => navigate('/profile?linking=strava')}>
                    <span className="material-symbols-outlined" aria-hidden="true">sync</span>
                    {t('profile.dashboard_empty_cta_strava')}
                  </button>
                  <button type="button" className="runner-dashboard-empty-cta runner-dashboard-empty-cta--secondary" onClick={() => navigate('/today-run')}>
                    <span className="material-symbols-outlined" aria-hidden="true">today</span>
                    {t('profile.dashboard_empty_cta_today')}
                  </button>
                </div>
              </section>
            )}

            {loadState === 'ready' && runs.length > 0 && (
              <>
                {/* 2. Today's Session */}
                <section className="hd-today-card">
                  <div className="hd-today-bg" style={{ backgroundImage: `url(${DASHBOARD_HERO_IMAGE})` }}>
                    <div className="hd-today-bg-overlay" />
                  </div>
                  <div className="hd-today-content">
                    <span className="hd-today-kicker">{t('profile.dashboard_redesign.today_kicker')}</span>
                    <h2 className="hd-today-title">{heroWorkoutTitle}</h2>
                    <p className="hd-today-purpose">{todayBundle.recommendation?.purpose || readiness.copy}</p>
                    <div className="hd-today-stats">
                      <div className="hd-today-stat">
                        <span className="hd-today-stat-label">{t('profile.dashboard_redesign.today_duration')}</span>
                        <strong>{heroDuration}</strong>
                      </div>
                      <div className="hd-today-stat">
                        <span className="hd-today-stat-label">{t('profile.dashboard_redesign.today_pace')}</span>
                        <strong>{heroPace}</strong>
                      </div>
                      <div className="hd-today-stat">
                        <span className="hd-today-stat-label">{t('profile.dashboard_redesign.today_distance')}</span>
                        <strong>{heroLoad}</strong>
                      </div>
                    </div>
                    <div className="hd-today-actions">
                      <button type="button" className="hd-btn-primary" onClick={() => navigate('/today-run')}>
                        {t('profile.dashboard_redesign.today_start')}
                      </button>
                      <button type="button" className="hd-btn-ghost" onClick={() => navigate('/analysis')}>
                        {t('profile.dashboard_redesign.today_details')}
                      </button>
                    </div>
                  </div>
                </section>

                {/* 3. Metric Strip */}
                <section className="hd-metric-strip">
                  {/* VDOT card */}
                  <article className="hd-metric-card">
                    <div className="hd-metric-head">
                      <span className="hd-metric-icon">
                        <span className="material-symbols-outlined">speed</span>
                      </span>
                      <span className="hd-metric-kicker">{t('profile.dashboard_redesign.metrics_vdot')}</span>
                    </div>
                    <strong className="hd-metric-value">
                      {profileVdot.representativeVdot > 0 ? profileVdot.representativeVdot.toFixed(1) : '--'}
                    </strong>
                    <div className="hd-metric-trend">
                      {profileVdot.representativeVdot > 0 && vdotTrend.hasData ? (
                        <span className={`hd-trend-badge ${vdotTrend.direction}`}>
                          {vdotTrend.direction === 'improving' ? '↑' : vdotTrend.direction === 'declining' ? '↓' : '→'}
                          {' '}{vdotTrend.delta > 0 ? `+${vdotTrend.delta.toFixed(1)}` : vdotTrend.delta.toFixed(1)}
                        </span>
                      ) : null}
                      <span className="hd-metric-detail">
                        {profileVdot.representativeVdot > 0 && vdotTrend.hasData
                          ? t(`profile.vdot_trend_${vdotTrend.direction}`)
                          : t('profile.dashboard_window_active')}
                      </span>
                    </div>
                  </article>
                  {/* Weekly load card */}
                  <article className="hd-metric-card">
                    <div className="hd-metric-head">
                      <span className="hd-metric-icon">
                        <span className="material-symbols-outlined">show_chart</span>
                      </span>
                      <span className="hd-metric-kicker">{t('profile.dashboard_redesign.metrics_weekly_load')}</span>
                    </div>
                    <strong className="hd-metric-value">{formatDistance(weeklyActualTotal, 1, lang, unit)}</strong>
                    <div className="hd-metric-trend">
                      <span className="hd-metric-completion">{weeklyCompletion}%</span>
                      <span className="hd-metric-detail">
                        {t('profile.dashboard_redesign.metrics_of_projected')} {formatDistance(weeklyProjectedTotal, 1, lang, unit)}
                      </span>
                    </div>
                  </article>
                  {/* Next race countdown card */}
                  <article className="hd-metric-card">
                    <div className="hd-metric-head">
                      <span className="hd-metric-icon">
                        <span className="material-symbols-outlined">flag</span>
                      </span>
                      <span className="hd-metric-kicker">{t('profile.dashboard_redesign.metrics_next_race')}</span>
                    </div>
                    <strong className="hd-metric-value">
                      {nextRace?.name || t('profile.dashboard_redesign.metrics_no_race')}
                    </strong>
                    <div className="hd-metric-trend">
                      {raceCountdown != null ? (
                        <>
                          <strong className="hd-race-days">{raceCountdown}</strong>
                          <span className="hd-metric-detail">{t('profile.dashboard_redesign.metrics_days_left')}</span>
                        </>
                      ) : (
                        <span className="hd-metric-detail">{t('profile.dashboard_redesign.metrics_no_race')}</span>
                      )}
                    </div>
                  </article>
                </section>

                {/* 4. Training Grid */}
                <div className="hd-training-grid">
                  {/* Weekly bar chart */}
                  <article className="hd-weekly-card">
                    <div className="hd-card-head">
                      <div>
                        <span className="hd-card-kicker">{t('profile.dashboard_redesign.weekly_kicker')}</span>
                        <h3 className="hd-card-title">{t('profile.dashboard_redesign.weekly_title')}</h3>
                      </div>
                      <div className="hd-weekly-legend">
                        <span><i className="hd-legend-dot actual" />{t('profile.dashboard_redesign.weekly_actual')}</span>
                        <span><i className="hd-legend-dot projected" />{t('profile.dashboard_redesign.weekly_projected')}</span>
                      </div>
                    </div>
                    <div className="hd-bar-chart">
                      {weeklyBars.map((bar) => {
                        const maxVal = Math.max(1, ...weeklyBars.map(b => Math.max(b.actual, b.projected)));
                        const actualH = Math.max(6, (bar.actual / maxVal) * 100);
                        const projH = Math.max(6, (bar.projected / maxVal) * 100);
                        return (
                          <div
                            key={bar.key}
                            className={`hd-bar-col${bar.isToday ? ' is-today' : ''}`}
                            onMouseEnter={() => setActiveWeeklyBar(bar)}
                            onMouseLeave={() => setActiveWeeklyBar(null)}
                          >
                            <div className="hd-bar-track">
                              <div className="hd-bar projected" style={{ height: `${projH}%` }} />
                              <div className="hd-bar actual" style={{ height: `${actualH}%` }} />
                            </div>
                            <span className="hd-bar-label">{bar.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {activeWeeklyBar && (
                      <div className="hd-bar-tooltip" role="status">
                        <strong>{activeWeeklyBar.label}</strong>: {formatDistance(activeWeeklyBar.actual, 1, lang, unit)} {t('profile.dashboard_redesign.weekly_actual')} / {formatDistance(activeWeeklyBar.projected, 1, lang, unit)} {t('profile.dashboard_redesign.weekly_projected')}
                      </div>
                    )}
                  </article>
                  {/* Recent sessions */}
                  <article className="hd-sessions-card">
                    <div className="hd-card-head">
                      <div>
                        <span className="hd-card-kicker">{t('profile.dashboard_redesign.sessions_kicker')}</span>
                        <h3 className="hd-card-title">{t('profile.dashboard_redesign.sessions_title')}</h3>
                      </div>
                    </div>
                    <div className="hd-session-list">
                      {runs.slice(0, 5).map((run) => {
                        const metric = buildSessionMetric(run, lang, unit, t);
                        const avgPaceS = run.averagePaceSecondsPerKm || run.paceSecondsPerKm || 0;
                        const tone = avgPaceS > 0 && avgPaceS > 330 ? 'easy' : avgPaceS > 0 && avgPaceS < 270 ? 'quality' : 'recovery';
                        return (
                          <button
                            key={run.id}
                            type="button"
                            className="hd-session-row"
                            onClick={() => navigate(`/run/${run.id}`)}
                          >
                            <div className="hd-session-left">
                              <span className={`hd-session-dot tone-${tone}`} />
                              <div className="hd-session-info">
                                <strong>{run.name || t('profile.dashboard_session_fallback')}</strong>
                                <span>{formatRunDate(run, lang)} · {formatDurationCompact(run.movingTimeSeconds || 0)}</span>
                              </div>
                            </div>
                            <div className="hd-session-right">
                              <strong>{metric.value}</strong>
                              <span>{metric.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" className="hd-link-btn" onClick={() => navigate('/runs')}>
                      {t('profile.dashboard_redesign.sessions_view_all')}
                    </button>
                  </article>
                </div>

                {/* 5. Progression */}
                <section className="hd-progression">
                  <div className="hd-progression-head">
                    <div>
                      <span className="hd-card-kicker">{t('profile.dashboard_redesign.progression_kicker')}</span>
                      <h3 className="hd-card-title">{t('profile.dashboard_redesign.progression_title')}</h3>
                    </div>
                    <div className="hd-progression-switcher">
                      {[
                        { key: 'total', label: t('profile.dashboard_redesign.progression_total') },
                        { key: '12m', label: t('profile.dashboard_redesign.progression_12m') },
                        { key: '6m', label: t('profile.dashboard_redesign.progression_6m') },
                        { key: '3m', label: t('profile.dashboard_redesign.progression_3m') },
                        { key: '1m', label: t('profile.dashboard_redesign.progression_1m') },
                      ].map((frame) => (
                        <button
                          key={frame.key}
                          type="button"
                          className={`hd-progression-tab${activeProgressionFrame === frame.key ? ' is-active' : ''}`}
                          onClick={() => setActiveProgressionFrame(frame.key)}
                        >
                          {frame.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="hd-progression-summary">
                    <div className="hd-progression-hero-stat">
                      <span>{t('profile.dashboard_redesign.progression_total_distance')}</span>
                      <strong>{formatDistance(progressionAtlas.totalDistanceKm, 1, lang, unit)}</strong>
                    </div>
                    <div className="hd-progression-meta-row">
                      <div className="hd-progression-stat">
                        <span>{t('profile.dashboard_redesign.progression_elevation')}</span>
                        <strong>{formatElevationDisplay(progressionAtlas.totalElevationMeters, t)}</strong>
                      </div>
                      <div className="hd-progression-stat">
                        <span>{t('profile.dashboard_redesign.progression_avg_pace')}</span>
                        <strong>{formatPaceDisplay(progressionAtlas.averagePaceSeconds, t)}</strong>
                      </div>
                      <div className="hd-progression-stat">
                        <span>{t('profile.dashboard_redesign.progression_total_time')}</span>
                        <strong>{formatDuration(progressionAtlas.totalMovingSeconds)}</strong>
                      </div>
                      <div className="hd-progression-stat">
                        <span>{t('profile.dashboard_redesign.progression_sessions')}</span>
                        <strong>{progressionAtlas.sessionCount}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="hd-progression-chart-area">
                    <svg viewBox="0 0 400 120" className="hd-progression-svg" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="hdProgLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#ffb4a7" />
                          <stop offset="100%" stopColor="#f07561" />
                        </linearGradient>
                        <linearGradient id="hdProgArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(240,117,97,0.28)" />
                          <stop offset="100%" stopColor="rgba(240,117,97,0.02)" />
                        </linearGradient>
                      </defs>
                      {progressionAtlas.chartArea ? (
                        <path d={progressionAtlas.chartArea} fill="url(#hdProgArea)" />
                      ) : (
                        <path d="M0 100 C40 95 80 80 120 75 C160 70 200 55 240 48 C280 40 320 28 360 22 L400 18 L400 120 L0 120Z" fill="url(#hdProgArea)" />
                      )}
                      {progressionAtlas.chartLine ? (
                        <path d={progressionAtlas.chartLine} fill="none" stroke="url(#hdProgLine)" strokeWidth="2.5" strokeLinecap="round" />
                      ) : (
                        <path d="M0 100 C40 95 80 80 120 75 C160 70 200 55 240 48 C280 40 320 28 360 22 L400 18" fill="none" stroke="url(#hdProgLine)" strokeWidth="2.5" strokeLinecap="round" />
                      )}
                    </svg>
                    <div className="hd-progression-range">
                      <span>{progressionAtlas.startLabel}</span>
                      <span>{progressionAtlas.endLabel}</span>
                    </div>
                  </div>
                </section>

                {/* 6. Bottom Grid */}
                <div className="hd-bottom-grid">
                  {/* Race predictions */}
                  <article className="hd-predictions-card">
                    <div className="hd-card-head">
                      <div>
                        <span className="hd-card-kicker">{t('profile.dashboard_redesign.predictions_kicker')}</span>
                        <h3 className="hd-card-title">{t('profile.dashboard_redesign.predictions_title')}</h3>
                      </div>
                      {profileVdot.representativeVdot > 0 && (
                        <span className="hd-predictions-vdot">
                          {profileVdot.representativeVdot.toFixed(1)} VO₂
                        </span>
                      )}
                    </div>
                    <div className="hd-predictions-grid">
                      {racePredictions.slice(0, 4).map((pred, i) => (
                        <div key={pred.key} className="hd-prediction-item">
                          <span className="hd-prediction-index">{String(i + 1).padStart(2, '0')}</span>
                          <div>
                            <strong className="hd-prediction-time">{pred.time}</strong>
                            <span className="hd-prediction-label">{pred.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                  {/* Stamina */}
                  <article className="hd-stamina-card">
                    <div className="hd-card-head">
                      <div>
                        <span className="hd-card-kicker">{t('profile.dashboard_redesign.stamina_kicker')}</span>
                        <h3 className="hd-card-title">{readiness.label}</h3>
                      </div>
                    </div>
                    <p className="hd-stamina-copy">{readiness.copy}</p>
                    <div className="hd-stamina-meters">
                      <div className="hd-stamina-meter-group">
                        <div className="hd-stamina-meter-head">
                          <span>{t('profile.dashboard_redesign.stamina_score')}</span>
                          <strong>{staminaScorePercent}%</strong>
                        </div>
                        <div className="hd-stamina-meter">
                          <div className="hd-stamina-fill" style={{ width: `${staminaScorePercent}%` }} />
                        </div>
                      </div>
                      <div className="hd-stamina-meter-group">
                        <div className="hd-stamina-meter-head">
                          <span>{t('profile.dashboard_redesign.stamina_cap')}</span>
                          <strong>{staminaCapPercent}%</strong>
                        </div>
                        <div className="hd-stamina-meter">
                          <div className="hd-stamina-fill cap" style={{ width: `${staminaCapPercent}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="hd-stamina-stats">
                      <div>
                        <span>{t('profile.dashboard_redesign.stamina_pace')}</span>
                        <strong>{staminaPaceLabel}</strong>
                      </div>
                      {staminaHeartLabel !== '--' && (
                        <div>
                          <span>{t('profile.dashboard_redesign.stamina_hr')}</span>
                          <strong>{staminaHeartLabel} <em>bpm</em></strong>
                        </div>
                      )}
                    </div>
                  </article>
                  {/* Streak */}
                  <article className="hd-streak-card">
                    <div className="hd-card-head">
                      <div>
                        <span className="hd-card-kicker">{t('profile.dashboard_redesign.streak_kicker')}</span>
                      </div>
                    </div>
                    <div className="hd-streak-row">
                      <div className="hd-streak-stat">
                        <span>{t('profile.dashboard_redesign.streak_current')}</span>
                        <strong>{streak.current}</strong>
                      </div>
                      <div className="hd-streak-divider" />
                      <div className="hd-streak-stat">
                        <span>{t('profile.dashboard_redesign.streak_best')}</span>
                        <strong>{streak.best}</strong>
                      </div>
                    </div>
                  </article>
                </div>

                {/* 7. Rewards */}
                <section className="hd-rewards">
                  <div className="hd-rewards-head">
                    <div>
                      <span className="hd-card-kicker">{t('profile.dashboard_redesign.rewards_kicker')}</span>
                      <h3 className="hd-card-title">{t('profile.dashboard_redesign.rewards_title')}</h3>
                    </div>
                    <button type="button" className="hd-link-btn" onClick={() => navigate('/rewards')}>
                      {t('profile.dashboard_redesign.rewards_view_all')}
                    </button>
                  </div>
                  {/* Ring + next milestone */}
                  <div className="hd-rewards-hero-row">
                    <div className="hd-rewards-progress-ring-area">
                      <div className="hd-rewards-ring-wrap">
                        <svg viewBox="0 0 88 88" className="hd-rewards-ring-svg">
                          <circle cx="44" cy="44" r="38" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="5" />
                          <circle cx="44" cy="44" r="38" fill="none" stroke="url(#hdRewardRingGrad)" strokeWidth="5"
                            strokeDasharray={`${(rewardCompletionPct / 100) * 238.76} 999`}
                            strokeLinecap="round" transform="rotate(-90 44 44)" />
                          <defs>
                            <linearGradient id="hdRewardRingGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#f07561" />
                              <stop offset="100%" stopColor="#a0392a" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="hd-rewards-ring-center">
                          <strong>{rewardEarnedCount}</strong>
                          <span>/ {rewardTotalCount}</span>
                        </div>
                      </div>
                      <div className="hd-rewards-progress-label">
                        <strong>{rewardCompletionPct}%</strong>
                        <span>{t('profile.dashboard_redesign.rewards_completion')}</span>
                      </div>
                    </div>

                    {rewardNextMilestone && (
                      <div className="hd-rewards-next">
                        <span className="hd-rewards-next-tag">{t('profile.dashboard_redesign.rewards_next_up')}</span>
                        <div className="hd-rewards-next-icon" aria-hidden="true">
                          <RewardGlyph icon={rewardNextMilestone.icon} />
                        </div>
                        <strong className="hd-rewards-next-title">{rewardNextMilestone.title}</strong>
                        <p className="hd-rewards-next-hint">{rewardNextMilestone.hint || rewardNextMilestone.subtitle}</p>
                        <div className="hd-rewards-next-bar-wrap">
                          <div className="hd-rewards-next-bar">
                            <div className="hd-rewards-next-fill" style={{ width: `${rewardNextMilestonePct}%` }} />
                          </div>
                          <span className="hd-rewards-next-pct">{rewardNextMilestonePct}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {rewardShowcase.earnedRewards.length > 0 && (
                    <div className="hd-rewards-badges">
                      {rewardShowcase.earnedRewards.slice(0, 8).map((badge, i) => (
                        <div key={badge.id} className={`hd-rewards-badge${i === 0 ? ' is-latest' : ''}`}>
                          <div className="hd-rewards-badge-icon" aria-hidden="true">
                            <RewardGlyph icon={badge.icon} />
                          </div>
                          <div className="hd-rewards-badge-info">
                            <strong>{badge.title}</strong>
                            <span>{badge.subtitle}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
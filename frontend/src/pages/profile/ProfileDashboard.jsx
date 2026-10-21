import { resolveCoachReadinessScore, resolveCoachReadinessLabel, resolveCoachWeeklyTarget } from '../../utils/personalizedCoachPlan';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { apiJson } from '../../api';
import { cachedApiJson, invalidateResourceCache } from '../../api/resourceCache';
import AppIcon from '../../components/AppIcon';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import HermesLogo from '../../components/HermesLogo';
import Modal from '../../components/Modal';
import FooterNavLinks from '../../components/FooterNavLinks';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { runIsWithinLastDays, runnersToday } from '../../utils/calendarDays';
import { formatDate, formatDistance, formatDuration, formatPaceSeconds } from '../../utils/format';
import { accountWeekStart, activitySortTime, calendarDate, formatActivityTime, getAccountDate, getActivityDateKey } from '../../utils/timeZone';
import { useAccountDate } from '../../hooks/useAccountDate';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';
import {
  buildProgressionAtlas,
  PROGRESSION_TIMEFRAMES,
} from '../../utils/progressionAtlas';
import { getTodayRunRecommendation } from '../../utils/todayRun';
import { formatPlannedDuration, prettifyWorkoutType } from '../../utils/coach/presentation.js';
import { parseCheckoutBannerQuery, parseProfileLinkingQuery } from '../../utils/stravaLinking';
import { preloadRoute } from '../../utils/routePreload';
import { consumeStravaOauthPendingFlag, STRAVA_SYNC_FINISHED_EVENT } from '../../utils/stravaAutoSync';
import { estimateCurrentVdot, computeVdotTrend, buildOrderedRacePredictions } from '../../utils/vdot';
import { buildRunDetailPath } from '../../utils/runRoute';
import { calculateStreaks, getDaysSinceLastRun } from '../../utils/streakUtils';
import { buildRewardShowcase } from '../../utils/rewardBadges';
import RewardIllustration from '../../components/RewardIllustration';
import ComebackMessage from '../../components/ComebackMessage';
import PageSkeleton from '../../components/PageSkeleton';
import GoalsCard from '../../components/goals/GoalsCard';
import ProgressionChart from './ProgressionChart';
import TeamProfileCard from '../team/TeamProfileCard';
import WeeklyLoadCard from './WeeklyLoadCard';

const DASHBOARD_HERO_IMAGE = '/images/races/dashboard-hero.webp';
// Start the largest visible image while the dashboard data is still loading.
preload(DASHBOARD_HERO_IMAGE, { as: 'image', fetchPriority: 'high' });
const PR_SNAPSHOT_VERSION = 1;

function getPrSnapshotStorageKey(email) {
  return `hermes_pr_snapshot_${String(email || '').trim().toLowerCase()}`;
}

function getDashboardCacheKey(email) {
  const safe = String(email || '').trim().toLowerCase();
  return safe ? `hermes_profile_dashboard_${safe}` : 'hermes_profile_dashboard_anon';
}

// Cap the runs array we write to localStorage. Most accounts have well under
// this; power users with thousands of activities would otherwise blow past the
// 5 MB quota. The background revalidate still hydrates the full list into
// memory, so derived stats stay correct after the first paint.
const DASHBOARD_CACHE_RUN_LIMIT = 500;
// Keep in sync with BE APP_ACTIVITIES_DEFAULT_LIMIT / RFC-005 (max 500).
const PROFILE_ACTIVITIES_FETCH_LIMIT = DASHBOARD_CACHE_RUN_LIMIT;
const DASHBOARD_FIRST_PAINT_RUN_LIMIT = 60;
const PROFILE_DASHBOARD_BATCH_TIMEOUT_MS = 8000;

function buildDashboardCacheSnapshot(dashboardData) {
  if (!dashboardData || !dashboardData.profile) return null;
  // Cache only the fields the dashboard first paint reads. Full activity
  // objects can carry route maps/telemetry that blow past the 5 MB
  // localStorage quota for active accounts (QuotaExceededError).
  const slimRunForCache = (run) => ({
    id: run?.id,
    name: run?.name,
    startTime: run?.startTime,
    startDate: run?.startDate,
    activityInstant: run?.activityInstant,
    accountLocalDate: run?.accountLocalDate,
    accountLocalTime: run?.accountLocalTime,
    accountTimeZone: run?.accountTimeZone,
    timeRepresentation: run?.timeRepresentation,
    distanceKm: run?.distanceKm,
    distanceMeters: run?.distanceMeters,
    movingTimeSeconds: run?.movingTimeSeconds,
    paceSecondsPerKm: run?.paceSecondsPerKm,
    averagePaceSecondsPerKm: run?.averagePaceSecondsPerKm,
  });
  const cappedRuns = Array.isArray(dashboardData.runs)
    ? dashboardData.runs.slice(0, DASHBOARD_CACHE_RUN_LIMIT).map(slimRunForCache)
    : [];
  return {
    cachedAt: Date.now(),
    profileEmail: dashboardData.profile?.email || null,
    profile: dashboardData.profile,
    runs: cappedRuns,
    coachState: dashboardData.coachState ?? null,
    coachToday: dashboardData.coachToday ?? null,
    races: Array.isArray(dashboardData.races) ? dashboardData.races : [],
    musclePlan: dashboardData.musclePlan ?? null,
  };
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
  let payload;
  try {
    payload = JSON.stringify(value);
  } catch {
    return;
  }
  try {
    window.localStorage.setItem(key, payload);
  } catch (error) {
    // Quota exceeded: the origin's storage is full. Evict this key plus the
    // other per-account caches (old fat dashboard/runs snapshots) so a slim
    // snapshot can land; all of them rehydrate from the API on next visit.
    try {
      window.localStorage.removeItem(key);
      window.localStorage.setItem(key, payload);
      return;
    } catch { /* keep evicting */ }
    try {
      const evictPrefixes = ['hermes_profile_dashboard_', 'hermes_runs_v1_'];
      const doomed = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const storedKey = window.localStorage.key(i);
        if (storedKey && evictPrefixes.some((prefix) => storedKey.startsWith(prefix))) {
          doomed.push(storedKey);
        }
      }
      for (const storedKey of doomed) window.localStorage.removeItem(storedKey);
      window.localStorage.setItem(key, payload);
      return;
    } catch {
      // fall through to the warn below
    }
    // A silent quota failure here used to drop PR-celebration state and make
    // the modal reappear on every visit with no trace of why.
    console.warn('[hermes] localStorage write failed:', key, error);
  }
}
function withProfileDashboardTimeout(promiseFactory) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      controller.abort();
      reject(new Error('profile_dashboard_batch_timeout'));
    }, PROFILE_DASHBOARD_BATCH_TIMEOUT_MS);
  });
  return Promise.race([promiseFactory(controller.signal), timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
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

export function buildWeekBars(runs, lang, timeZone, todayKey, coachPayload) {
  const now = calendarDate(todayKey || getAccountDate(timeZone));
  const weekStart = calendarDate(accountWeekStart(todayKey || getAccountDate(timeZone)));
  const dayNames = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setUTCDate(weekStart.getUTCDate() + index);
    return day.toLocaleDateString(lang, { weekday: 'short', timeZone: 'UTC' });
  });

  const actual = Array.from({ length: 7 }, () => 0);
  const projected = Array.from({ length: 7 }, () => 0);
  const projectedKnown = Array.from({ length: 7 }, () => false);
  const prescriptionsByDay = Array.from({ length: 7 }, () => null);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  runs.forEach((run) => {
    const started = calendarDate(getActivityDateKey(run, timeZone));
    if (Number.isNaN(started.getTime())) return;
    const distanceKm = resolveRunDistanceKm(run);
    if (started >= weekStart && started < weekEnd) {
      const dayIndex = Math.max(0, Math.min(6, Math.floor((started - weekStart) / 86400000)));
      actual[dayIndex] += distanceKm;
    }
  });

  const prescriptions = new Map((coachPayload?.weekSchedule || []).map(row => [row.scheduledDate, row]));
  // Current prescriptions take precedence over the week's earlier comparison targets.
  for (const row of coachPayload?.schedule || []) prescriptions.set(row.scheduledDate, row);
  if (coachPayload?.today?.scheduledDate) prescriptions.set(coachPayload.today.scheduledDate, coachPayload.today);
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + weekday);
    const row = prescriptions.get(date.toISOString().slice(0, 10));
    if (!row || row.reasonCode === 'history_required') continue;
    const distance = row.workoutType === 'REST' || row.workoutType === 'CROSS_TRAIN' ? 0 : row.plannedDistanceKm;
    if (!Number.isFinite(distance) || distance < 0) continue;
    projected[weekday] = distance;
    projectedKnown[weekday] = true;
    prescriptionsByDay[weekday] = row;
  }
  const maxValue = Math.max(1, ...actual, ...projected);
  const todayIndex = Math.max(0, Math.min(6, Math.floor((now - weekStart) / 86400000)));

  return dayNames.map((label, index) => ({
    key: label,
    index,
    label,
    actual: actual[index],
    projected: projected[index],
    projectedKnown: projectedKnown[index],
    originalProjected: Number.isFinite(prescriptionsByDay[index]?.originalDistanceKm)
      && prescriptionsByDay[index].originalDistanceKm >= 0
      ? prescriptionsByDay[index].originalDistanceKm : projected[index],
    workoutType: prescriptionsByDay[index]?.workoutType,
    reasonCode: prescriptionsByDay[index]?.reasonCode,
    actualPct: Math.max(8, Math.round((actual[index] / maxValue) * 100)),
    projectedPct: Math.max(8, Math.round((projected[index] / maxValue) * 100)),
    actualAnchorTopPct: 100 - Math.max(8, Math.round((actual[index] / maxValue) * 100)),
    isToday: index === todayIndex,
  }));
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
  const score = resolveCoachReadinessScore({ state: coachState });

  const label = resolveCoachReadinessLabel({ state: coachState }, t);

  return {
    score,
    label,
    copy: recommendation?.purpose || t('profile.dashboard_readiness_fallback'),
  };
}

function buildStaminaFallback(readiness, heroPace) {
  return {
    scorePercent: readiness.score,
    recoveryCapPercent: readiness.score,
    targetPaceSecondsPerKm: null,
    targetHeartRateBpm: null,
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
  return formatActivityTime(run, lang, {
    month: 'short',
    day: 'numeric',
  }) || '--';
}

export function buildRecordSnapshot(personalRecords, runs) {
  const latestSeenActivityId = runs.reduce((max, run) => Math.max(max, Number(run?.id || 0)), 0);
  const records = Object.fromEntries(
    Object.entries(personalRecords?.records || {}).map(([key, record]) => [key, {
      key,
      elapsedSeconds: Number(record?.elapsedSeconds || 0),
      paceSecondsPerKm: Number(record?.paceSecondsPerKm || 0),
      recordedAt: record?.recordedAt || null,
      activityId: Number(record?.activityId || 0),
    }]),
  );
  const longestRun = personalRecords?.longestRun ? {
    primaryValue: Number(personalRecords.longestRun.primaryValue || 0),
    activityId: Number(personalRecords.longestRun.activityId || 0),
  } : null;
  const fastestPace = personalRecords?.fastestPace ? {
    primaryValue: Number(personalRecords.fastestPace.primaryValue || 0),
    activityId: Number(personalRecords.fastestPace.activityId || 0),
  } : null;
  const mostElevation = personalRecords?.mostElevation ? {
    primaryValue: Number(personalRecords.mostElevation.primaryValue || 0),
    activityId: Number(personalRecords.mostElevation.activityId || 0),
  } : null;

  // The run feed is ordered by run date and capped, so imported history (old
  // dates, brand-new activity ids) never appears in it. Fold record-holder ids
  // into the high-water mark or the "just set this record" gate re-arms on
  // every visit for those records.
  const recordHolderIds = [
    ...Object.values(records).map((record) => record.activityId),
    longestRun?.activityId || 0,
    fastestPace?.activityId || 0,
    mostElevation?.activityId || 0,
  ];
  return {
    version: PR_SNAPSHOT_VERSION,
    latestSeenActivityId: recordHolderIds.reduce((max, id) => Math.max(max, id), latestSeenActivityId),
    records,
    longestRun,
    fastestPace,
    mostElevation,
    celebratedRecords: {},
  };
}

// One celebration slot per distance key plus the three summary records; each
// slot is celebrated at most once per record-holding activity.
function celebrationKeyFor(entry) {
  return entry?.type === 'distance' ? `distance:${entry?.key}` : String(entry?.type || '');
}

export function collectPersonalRecordBreakthroughs(previousSnapshot, personalRecords, runs) {
  if (!previousSnapshot || !personalRecords || !Array.isArray(runs) || runs.length === 0) {
    return [];
  }

  const lastSeenActivityId = Number(previousSnapshot.latestSeenActivityId || 0);
  if (lastSeenActivityId <= 0) {
    return [];
  }

  const celebrated = previousSnapshot.celebratedRecords || {};
  const summarySlotField = { longest: 'longestRun', pace: 'fastestPace', elevation: 'mostElevation' };
  const isAlreadyCelebrated = (entry) => {
    const activityId = Number(entry?.record?.activityId || 0);
    if (activityId <= 0) return false;
    // Snapshots written before celebratedRecords existed only carry the record
    // maps themselves; seed from those so an upgrade never re-celebrates
    // records the runner has already seen.
    const celebratedId = Number(
      celebrated[celebrationKeyFor(entry)]
        ?? previousSnapshot.records?.[entry?.key]?.activityId
        ?? previousSnapshot[summarySlotField[entry?.type]]?.activityId
        ?? 0,
    );
    return celebratedId === activityId;
  };

  const breakthroughs = [];
  const currentRecords = personalRecords.records || {};

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
      if (!isAlreadyCelebrated(entry)) {
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
      if (!isAlreadyCelebrated(entry)) {
        breakthroughs.push(entry);
      }
    }
  });

  return breakthroughs;
}

export function buildAcknowledgedSnapshot(previousSnapshot, personalRecords, runs, breakthroughs) {
  const nextSnapshot = buildRecordSnapshot(personalRecords, runs);
  const celebratedRecords = { ...(previousSnapshot?.celebratedRecords || {}) };
  breakthroughs.forEach((entry) => {
    const activityId = Number(entry?.record?.activityId || 0);
    if (activityId > 0) celebratedRecords[celebrationKeyFor(entry)] = activityId;
  });
  nextSnapshot.celebratedRecords = celebratedRecords;
  return nextSnapshot;
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sortRunsByMostRecent(runs) {
  const list = Array.isArray(runs) ? [...runs] : [];
  list.sort((a, b) => activitySortTime(b) - activitySortTime(a));
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
    cachedApiJson('/api/profile/me'),
    cachedApiJson(`/api/activities?limit=${PROFILE_ACTIVITIES_FETCH_LIMIT}`),
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

export async function loadProfileDashboardFallbackEnrichmentData(publishCoach) {
  const [
    coachStateData,
    coachTodayData,
    personalRecordsData,
    racesData,
    musclePlanData,
    quotaData,
  ] = await Promise.all([
    apiJson('/api/coach/state').catch(() => null),
    apiJson('/api/coach/today').then(data => {
      publishCoach?.(data);
      return data;
    }).catch(() => null),
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
    const batchPayload = await withProfileDashboardTimeout(
      (signal) => cachedApiJson('/api/profile/dashboard', { signal }),
    );
    const normalized = normalizeProfileDashboardPayload(batchPayload);
    if (normalized) return normalized;
  } catch {
    // Fall through to the individual endpoints that powered the dashboard before batching.
    // Timeout aborts the batch request first so fallback does not stampede alongside it.
  }

  return loadProfileDashboardFallbackData();
}

async function loadProfileDashboardFullHistoryData() {
  const activities = await cachedApiJson(`/api/activities?limit=${PROFILE_ACTIVITIES_FETCH_LIMIT}`);
  return sortRunsByMostRecent(Array.isArray(activities) ? activities : []);
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
  const recommendationRevision = useRecommendationRevision();
  const { isAuthenticated, email: authEmail } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [coachState, setCoachState] = useState(null);
  const [coachToday, setCoachToday] = useState(null);
  const accountToday = useAccountDate(coachToday?.plan?.timeZone || profile?.timeZone);
  const [_races, _setRaces] = useState([]);
  const [nextRace, setNextRace] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [banner, setBanner] = useState(null);
  const [prCelebration, setPrCelebration] = useState(null);
  const [dismissedComeback, setDismissedComeback] = useState(false);
  // pending | settled | timed_out �� only render comeback after coach enrichment settles
  const [comebackGateStatus, setComebackGateStatus] = useState('pending');
  const [activeProgressionFrame, setActiveProgressionFrame] = useState('total');
  const [_musclePlan, setMusclePlan] = useState(null);
  const [weeklyDigest, setWeeklyDigest] = useState(null);
  const [weeklyDigestLoading, setWeeklyDigestLoading] = useState(false);
  const [useFullDashboardMetrics, setUseFullDashboardMetrics] = useState(false);

  // Mirrors the Runs.jsx load-generation guard: each load takes a token, and a
  // newer load (or unmount) bumps the counter so superseded requests drop
  // their results instead of clobbering fresh state.
  const dashboardLoadGenerationRef = useRef(0);

  const loadDashboard = useCallback(() => {
    const loadToken = ++dashboardLoadGenerationRef.current;
    const isCurrentLoad = () => dashboardLoadGenerationRef.current === loadToken;
    setComebackGateStatus('pending');

    // Stale-while-revalidate: paint immediately from the last cached payload
    // for this account, then fetch fresh data in the background. Only the
    // first-ever login (no cache) shows the loading spinner.
    const cacheKey = getDashboardCacheKey(authEmail);
    const cachedSnapshot = readJsonStorage(cacheKey);
    const cachedMatchesUser =
      cachedSnapshot
      && (!authEmail
        || !cachedSnapshot.profileEmail
        || String(cachedSnapshot.profileEmail).toLowerCase() === String(authEmail).toLowerCase());
    const hasUsableCache = Boolean(cachedSnapshot && cachedMatchesUser && Array.isArray(cachedSnapshot.runs));

    if (hasUsableCache) {
      setProfile(cachedSnapshot.profile || null);
      setRuns(cachedSnapshot.runs);
      if (cachedSnapshot.coachState && typeof cachedSnapshot.coachState === 'object') {
        setCoachState(cachedSnapshot.coachState);
      }
      if (cachedSnapshot.coachToday && typeof cachedSnapshot.coachToday === 'object') {
        setCoachToday(cachedSnapshot.coachToday);
      }
      if (Array.isArray(cachedSnapshot.races)) {
        _setRaces(cachedSnapshot.races);
        setNextRace(getUpcomingRace(cachedSnapshot.races));
      }
      if (cachedSnapshot.musclePlan && typeof cachedSnapshot.musclePlan === 'object' && cachedSnapshot.musclePlan.days) {
        setMusclePlan(cachedSnapshot.musclePlan);
      }
      setLoadState('ready');
    }

    async function fetchDashboardData() {
      setUseFullDashboardMetrics(false);
      if (!hasUsableCache) setLoadState('loading');
      try {
        const dashboardData = await loadProfileDashboardData();

        if (!isCurrentLoad()) return;

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
            writeJsonStorage(
              storageKey,
              buildAcknowledgedSnapshot(previousSnapshot, personalRecordsData, list, breakthroughs),
            );
            if (breakthroughs.length > 0) {
              setPrCelebration({
                count: breakthroughs.length,
                latestRunName: breakthroughs[0]?.record?.sourceRunName || list[0]?.name || t('profile.dashboard_session_fallback'),
                entries: breakthroughs.slice(0, 4),
              });
            }
          }

          // Re-write cache with merged enrichment so next visit hydrates coach
          // state, today, races, and muscle plan from the cache on first paint.
          const enrichedSnapshot = buildDashboardCacheSnapshot({
            ...dashboardData,
            coachState: enrichmentData.coachState ?? dashboardData.coachState ?? null,
            coachToday: enrichmentData.coachToday ?? dashboardData.coachToday ?? null,
            races: Array.isArray(enrichmentData.races) ? enrichmentData.races : dashboardData.races,
            musclePlan: enrichmentData.musclePlan ?? dashboardData.musclePlan ?? null,
          });
          if (enrichedSnapshot) writeJsonStorage(cacheKey, enrichedSnapshot);
        }

        setProfile(profileData);
        setRuns(list);
        setLoadState('ready');

        // Write the primary dashboard data to cache right away so the next
        // page load can paint instantly even if enrichment hasn't merged yet.
        const primarySnapshot = buildDashboardCacheSnapshot(dashboardData);
        if (primarySnapshot) writeJsonStorage(cacheKey, primarySnapshot);

        if (dashboardData.source === 'batch') {
          const scheduleIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 160));
          scheduleIdle(() => {
            void loadProfileDashboardFullHistoryData().then((fullRuns) => {
              if (!isCurrentLoad() || fullRuns.length <= list.length) return;
              setRuns(fullRuns);
              const fullSnapshot = buildDashboardCacheSnapshot({
                ...dashboardData,
                runs: fullRuns,
              });
              if (fullSnapshot) writeJsonStorage(cacheKey, fullSnapshot);
            }).catch(() => {
              // Full history is an enhancement; the bounded dashboard payload is enough to render.
            });
          });
        }

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

        const settleComebackGate = () => {
          if (isCurrentLoad()) setComebackGateStatus('settled');
        };
        const publishCoach = (data) => {
          if (!isCurrentLoad()) return;
          setCoachToday(data);
          if (data?.state) setCoachState(data.state);
        };

        if (dashboardData.source === 'batch') {
          applyDashboardEnrichment(dashboardData);
          if (dashboardData.deferredEnrichment || !dashboardData.coachToday?.today) {
            void loadProfileDashboardFallbackEnrichmentData(publishCoach).then((enrichmentData) => {
              if (!isCurrentLoad()) return;
              applyDashboardEnrichment(enrichmentData);
              settleComebackGate();
            }).catch(() => {
              // Enrichment failed �� leave gate pending until timeout forces timed_out (no flash).
            });
          } else {
            settleComebackGate();
          }
        } else {
          void loadProfileDashboardFallbackEnrichmentData(publishCoach).then((enrichmentData) => {
            if (!isCurrentLoad()) return;
            applyDashboardEnrichment(enrichmentData);
            settleComebackGate();
          }).catch(() => {
            // Enrichment failed �� leave gate pending until timeout forces timed_out (no flash).
          });
        }
      } catch {
        if (isCurrentLoad() && !hasUsableCache) {
          // Only show the error card when there's no cached snapshot to fall
          // back on. With cache, we silently keep the stale dashboard visible
          // and let the next mount retry - better than blanking the user.
          setLoadState('error');
        }
      }
    }

    fetchDashboardData();
  }, [authEmail, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    loadDashboard();
    return () => {
      dashboardLoadGenerationRef.current += 1;
    };
  }, [isAuthenticated, navigate, loadDashboard, recommendationRevision]);

  useEffect(() => {
    if (comebackGateStatus !== 'pending' || loadState === 'loading') return undefined;
    const timeoutId = window.setTimeout(() => {
      setComebackGateStatus((status) => (status === 'pending' ? 'timed_out' : status));
    }, 8000);
    return () => window.clearTimeout(timeoutId);
  }, [comebackGateStatus, loadState]);

  useEffect(() => {
    if (loadState !== 'ready' || runs.length <= DASHBOARD_FIRST_PAINT_RUN_LIMIT) {
      setUseFullDashboardMetrics(false);
      return undefined;
    }

    let cancelled = false;
    const scheduleIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 120));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
    const handle = scheduleIdle(() => {
      if (!cancelled) setUseFullDashboardMetrics(true);
    });

    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
  }, [loadState, runs.length]);

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
      invalidateResourceCache('/api/profile/dashboard');
      invalidateResourceCache('/api/activities');
      invalidateResourceCache('/api/profile/me');
      loadDashboard();
    }

    window.addEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    return () => {
      window.removeEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    };
  }, [isAuthenticated, loadDashboard]);

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

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    setWeeklyDigestLoading(true);
    const scheduleIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 240));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
    const idleHandle = scheduleIdle(() => {
      if (cancelled) return;
      apiJson('/api/weekly-digest')
        .then((data) => {
          if (!cancelled) setWeeklyDigest(data || null);
        })
        .catch(() => {
          if (!cancelled) setWeeklyDigest(null);
        })
        .finally(() => {
          if (!cancelled) setWeeklyDigestLoading(false);
        });
    });
    return () => {
      cancelled = true;
      cancelIdle(idleHandle);
    };
  }, [isAuthenticated]);

  const displayName = useMemo(() => getDisplayName(profile, t('profile.default_name')), [profile, t]);
  const currentDateLine = useMemo(() => {
    const now = calendarDate(accountToday);
    return now.toLocaleDateString(lang, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }, [lang, accountToday]);

  const dashboardMetricRuns = useMemo(() => {
    if (useFullDashboardMetrics || runs.length <= DASHBOARD_FIRST_PAINT_RUN_LIMIT) return runs;
    return runs.slice(0, DASHBOARD_FIRST_PAINT_RUN_LIMIT);
  }, [runs, useFullDashboardMetrics]);
  const todayBundle = useMemo(
    () => getTodayRunRecommendation({ runs: dashboardMetricRuns, t, lang, unit, coachPayload: coachToday, timeZone: profile?.timeZone, todayKey: accountToday }),
    [dashboardMetricRuns, t, lang, unit, coachToday, profile?.timeZone, accountToday],
  );
  const readiness = useMemo(() => buildReadinessModel(todayBundle, coachToday?.state || coachState, t), [coachToday, coachState, t, todayBundle]);
  const weeklyBars = useMemo(() => buildWeekBars(dashboardMetricRuns, lang, profile?.timeZone, accountToday, coachToday), [lang, dashboardMetricRuns, profile?.timeZone, accountToday, coachToday]);
  const profileVdot = useMemo(() => estimateCurrentVdot(dashboardMetricRuns), [dashboardMetricRuns]);
  const vdotTrend = useMemo(() => computeVdotTrend(dashboardMetricRuns), [dashboardMetricRuns]);
  const streak = useMemo(() => calculateStreaks(dashboardMetricRuns, profile?.timeZone, accountToday), [dashboardMetricRuns, profile?.timeZone, accountToday]);
  const daysOff = useMemo(() => getDaysSinceLastRun(dashboardMetricRuns, profile?.timeZone, accountToday), [dashboardMetricRuns, profile?.timeZone, accountToday]);
  // Wait for coach enrichment to settle before rendering. Timed-out / failed
  // enrichment never shows the card (avoids first-paint comeback flash).
  const shouldShowComebackCard = (
    loadState === 'ready'
    && comebackGateStatus === 'settled'
    && !dismissedComeback
    && todayBundle.recommendation?.intent === 'comeback'
    && runs.length > 0
  );
  const rewardShowcase = useMemo(() => buildRewardShowcase(dashboardMetricRuns, lang), [dashboardMetricRuns, lang]);
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
    return buildOrderedRacePredictions(vdotValue, dashboardMetricRuns).map((d) => {
      const timeMin = d.timeMin;
      if (!timeMin || timeMin <= 0) return null;
      const totalSec = Math.round(timeMin * 60);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const display = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
      return { key: d.key, label: lang === 'zh-CN' ? d.labelZh : d.labelEn, time: display };
    }).filter(Boolean);
  }, [profileVdot, dashboardMetricRuns, lang]);


  const raceCountdown = useMemo(() => {
    if (!nextRace?.parsedDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = nextRace.parsedDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [nextRace]);

  const heroWorkout = todayBundle.recommendation.source !== 'unavailable' ? coachToday?.today : null;
  const heroWorkoutTitle = buildWorkoutHeadline(heroWorkout, todayBundle.recommendation, t);
  const heroDuration = heroWorkout?.plannedDurationMinutes
    ? formatPlannedDuration(heroWorkout.plannedDurationMinutes)
    : todayBundle.recommendation?.distance || '--';
  const heroPace = todayBundle.recommendation?.pace || '--';
  // The last 7 calendar days, added up from the runs the page holds, the way Load balance adds them up (BUG-026); the coach's own
  // figure is worked out on a clock window and only when something changes, so the two used to disagree.
  const volumeKm7d = useMemo(() => {
    const today = runnersToday(runs);
    return runs.reduce((sum, run) => (
      runIsWithinLastDays(run, 7, today) ? sum + (Number(run.distanceKm || 0) || (Number(run.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0)) : sum
    ), 0);
  }, [runs]);
  const heroLoad = formatDistance(volumeKm7d, 1, lang, unit);
  const currentWeekStart = accountWeekStart(accountToday);
  const weeklyActualTotal = coachToday?.plan?.weeklyBudgets?.find(week => week.start === currentWeekStart)?.completedKm
    ?? weeklyBars.reduce((sum, bar) => sum + Number(bar.actual || 0), 0);
  const weeklyProjectedTotal = resolveCoachWeeklyTarget(coachToday, currentWeekStart, currentWeekStart, null);
  const weeklyCompletion = weeklyProjectedTotal > 0
    ? Math.max(0, Math.min(100, Math.round((weeklyActualTotal / weeklyProjectedTotal) * 100)))
    : null;
  const stamina = useMemo(
    () => coachState?.stamina || buildStaminaFallback(readiness, heroPace),
    [coachState?.stamina, heroPace, readiness],
  );
  const staminaPaceLabel = stamina.targetPaceSecondsPerKm != null
    ? formatPaceSeconds(stamina.targetPaceSecondsPerKm)
    : stamina.fallbackPaceLabel || '--';
  const staminaHeartLabel = stamina.targetHeartRateBpm != null ? String(stamina.targetHeartRateBpm) : '--';
  const staminaScorePercent = stamina.scorePercent == null ? null : Math.max(0, Math.min(100, Number(stamina.scorePercent)));
  const staminaCapPercent = stamina.recoveryCapPercent == null ? null
    : Math.max(0, Math.min(100, Number(stamina.recoveryCapPercent)));
  const progressionAtlas = useMemo(
    () => buildProgressionAtlas(dashboardMetricRuns, activeProgressionFrame, lang, new Date(`${accountToday}T12:00:00`)),
    [activeProgressionFrame, lang, dashboardMetricRuns, accountToday],
  );

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard', active: true },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'weather_engine', label: t('profile.dashboard_nav_weather_engine'), route: '/weather', icon: 'weather' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'shoe_outline' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
    { key: 'muscle', label: t('muscle_training.nav_label'), route: '/muscle-training', icon: 'fitness_center' },
  ];

  if (loadState === 'loading') return <PageSkeleton variant="profile" />;

  return (
    <div className={`runner-shell-page runner-dashboard-page profile-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <Modal
        isOpen={Boolean(prCelebration)}
        onClose={() => setPrCelebration(null)}
        title={t('profile.pr_modal_title')}
        icon={<AppIcon name="emoji_events" className="runner-pr-modal-icon" />}
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
            <span>{t('analysis.stitch_brand_subtitle_profile')}</span>
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
              onPointerEnter={() => preloadRoute(item.route)}
              onFocus={() => preloadRoute(item.route)}
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
            onPointerEnter={() => preloadRoute('/today-run')}
            onFocus={() => preloadRoute('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar profile-dashboard-topbar">
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
              <TopbarUserMenu initials={displayName.slice(0, 1).toUpperCase()} label={t('components.account_menu.title')} showProfile />
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
              {runs.length > 0 && (
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
                    <div className="hd-readiness-value"><strong>{readiness.score ?? '—'}</strong></div>
                  </div>
                  <div className="hd-readiness-meta">
                    <span className="hd-readiness-label">{t('profile.dashboard_redesign.hero_readiness')}</span>
                    <span className="hd-readiness-status">{readiness.label}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Banners / comeback (preserved) */}
            {banner && (
              <section className={`runner-dashboard-banner tone-${banner.tone || 'info'}`}>
                <span>{banner.message}</span>
                <button type="button" onClick={() => setBanner(null)} aria-label={t('profile.close')}>x</button>
              </section>
            )}
            {shouldShowComebackCard && (
              <ComebackMessage
                daysOff={daysOff}
                onDismiss={() => setDismissedComeback(true)}
                primaryLabel={t('profile.comeback_action_primary')}
                secondaryLabel={t('profile.comeback_action_secondary')}
                onPrimaryAction={() => navigate('/today-run')}
                onSecondaryAction={() => navigate('/runs')}
              />
            )}
            {loadState === 'loading' && (
              <section className="runner-dashboard-loading-card runner-dashboard-loading-card--skeleton">
                <strong>{t('runs.loading')}</strong>
              </section>
            )}
            {loadState === 'error' && (
              <section className="runner-dashboard-loading-card">
                <strong>{t('runs.load_error')}</strong>
              </section>
            )}
            {loadState === 'ready' && runs.length === 0 && (
              <section className="runner-dashboard-empty-state" aria-labelledby="profile-empty-title">
                <div className="runner-dashboard-empty-hero">
                  <span className="runner-dashboard-empty-icon" aria-hidden="true">
                    <AppIcon name="directions_run" />
                  </span>
                  <h2 id="profile-empty-title">{t('profile.dashboard_empty_title')}</h2>
                  <p>{t('profile.dashboard_empty_copy')}</p>
                </div>
                <ol className="runner-dashboard-empty-steps" aria-label={t('profile.dashboard_empty_steps_label')}>
                  <li>
                    <span>01</span>
                    <p>{t('profile.dashboard_empty_step_sync')}</p>
                  </li>
                  <li>
                    <span>02</span>
                    <p>{t('profile.dashboard_empty_step_measure')}</p>
                  </li>
                  <li>
                    <span>03</span>
                    <p>{t('profile.dashboard_empty_step_unlock')}</p>
                  </li>
                </ol>
                <p className="runner-dashboard-empty-trust">{t('profile.dashboard_empty_trust')}</p>
                <div className="runner-dashboard-empty-actions">
                  <button type="button" className="runner-dashboard-empty-cta runner-dashboard-empty-cta--primary" onClick={() => navigate('/profile?linking=strava')}>
                    <AppIcon name="sync" aria-hidden="true" />
                    {t('profile.dashboard_empty_cta_strava')}
                  </button>
                  <button type="button" className="runner-dashboard-empty-cta runner-dashboard-empty-cta--secondary" onClick={() => navigate('/settings/import-data')}>
                    <AppIcon name="upload_file" aria-hidden="true" />
                    {t('profile.dashboard_empty_cta_files')}
                  </button>
                </div>
              </section>
            )}

            {loadState === 'ready' && runs.length > 0 && (
              <>
                {/* 2. Today's Session */}
                <section className="hd-today-card">
                  <div className="hd-today-bg">
                    <img className="hd-today-image" src={DASHBOARD_HERO_IMAGE} alt="" width="512" height="512" fetchPriority="high" decoding="async" />
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
                        <span className="hd-today-stat-label">{t('profile.dashboard_redesign.today_recent_volume')}</span>
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
                        <AppIcon name="speed" />
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
                        <AppIcon name="show_chart" />
                      </span>
                      <span className="hd-metric-kicker">{t('profile.dashboard_redesign.metrics_weekly_load')}</span>
                    </div>
                    <strong className="hd-metric-value">{formatDistance(weeklyActualTotal, 1, lang, unit)}</strong>
                    <div className="hd-metric-trend">
                      <span className="hd-metric-completion">{weeklyCompletion == null ? '—' : `${weeklyCompletion}%`}</span>
                      <span className="hd-metric-detail">
                        {t('profile.dashboard_redesign.metrics_of_projected')} {weeklyProjectedTotal == null ? '—' : formatDistance(weeklyProjectedTotal, 1, lang, unit)}
                      </span>
                    </div>
                  </article>
                  {/* Next race countdown card */}
                  <article className="hd-metric-card">
                    <div className="hd-metric-head">
                      <span className="hd-metric-icon">
                        <AppIcon name="flag" />
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
                  <WeeklyLoadCard bars={weeklyBars} plannedDistanceKm={weeklyProjectedTotal} lang={lang} unit={unit} t={t} />
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
                            onClick={() => navigate(buildRunDetailPath(run.id))}
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
                          aria-pressed={activeProgressionFrame === frame.key}
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
                  <ProgressionChart key={`${activeProgressionFrame}-${lang}-${unit}`} atlas={progressionAtlas} lang={lang} unit={unit} t={t} />
                </section>

                {/* 5b. Weekly Digest */}
                {(() => {
                  const hasDigestData = weeklyDigest
                    && weeklyDigest.coachFocus?.message
                    && weeklyDigest.vdotTrend?.hasData !== false;
                  const showEmpty = !weeklyDigestLoading && (!weeklyDigest || !hasDigestData);
                  const vdotDir = weeklyDigest?.vdotTrend?.direction || 'stable';
                  const vdotLabel = vdotDir === 'improving'
                    ? t('profile.weekly_digest_vdot_up')
                    : vdotDir === 'declining'
                      ? t('profile.weekly_digest_vdot_down')
                      : t('profile.weekly_digest_vdot_stable');
                  const vdotArrow = vdotDir === 'improving' ? '↑' : vdotDir === 'declining' ? '↓' : '→';
                  const runCount = weeklyDigest?.summary?.runCount ?? 0;
                  const totalKm = weeklyDigest?.summary?.totalDistanceKm != null
                    ? Number(weeklyDigest.summary.totalDistanceKm).toFixed(1)
                    : null;
                  return (
                    <section className="profile-weekly-digest-card hd-card">
                      <div className="hd-card-head profile-weekly-digest-head">
                        <div>
                          <span className="hd-card-kicker">{t('profile.weekly_digest_kicker')}</span>
                          <h3 className="hd-card-title">{t('profile.weekly_digest_title')}</h3>
                        </div>
                      </div>
                      {weeklyDigestLoading && (
                        <p className="profile-weekly-digest-loading">{t('runs.loading')}</p>
                      )}
                      {!weeklyDigestLoading && showEmpty && (
                        <p className="profile-weekly-digest-empty">{t('profile.weekly_digest_empty')}</p>
                      )}
                      {!weeklyDigestLoading && !showEmpty && (
                        <div className="profile-weekly-digest-body">
                          {runCount > 0 && totalKm && (
                            <div className="profile-weekly-digest-summary">
                              <span className="profile-weekly-digest-runs">
                                {t('profile.weekly_digest_runs', { n: runCount, km: totalKm })}
                              </span>
                              {weeklyDigest?.vdotTrend?.hasData && (
                                <span className={`profile-weekly-digest-vdot-badge profile-weekly-digest-vdot-${vdotDir}`}>
                                  <span className="profile-weekly-digest-arrow" aria-hidden="true">{vdotArrow}</span>
                                  {vdotLabel}
                                </span>
                              )}
                            </div>
                          )}
                          {weeklyDigest?.coachFocus?.message && (() => {
                            const focusKey = weeklyDigest.coachFocus.key;
                            const i18nKey = focusKey ? `profile.weekly_digest_focus_msg_${focusKey}` : null;
                            const translated = i18nKey ? t(i18nKey) : null;
                            const message = translated && translated !== i18nKey
                              ? translated
                              : weeklyDigest.coachFocus.message;
                            return (
                              <blockquote className="profile-weekly-digest-focus">
                                {message}
                              </blockquote>
                            );
                          })()}
                        </div>
                      )}
                    </section>
                  );
                })()}

                <GoalsCard defer showRecommendationEvidence={false} />

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
                          <strong>{staminaScorePercent == null ? '—' : staminaScorePercent + '%'}</strong>
                        </div>
                        <div className="hd-stamina-meter">
                          <div className="hd-stamina-fill" style={{ transform: `scaleX(${staminaScorePercent / 100})` }} />
                        </div>
                      </div>
                      <div className="hd-stamina-meter-group">
                        <div className="hd-stamina-meter-head">
                          <span>{t('profile.dashboard_redesign.stamina_cap')}</span>
                          <strong>{staminaCapPercent == null ? '—' : `${staminaCapPercent}%`}</strong>
                        </div>
                        <div className="hd-stamina-meter">
                          <div className="hd-stamina-fill cap" style={{ transform: `scaleX(${staminaCapPercent / 100})` }} />
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
                          <RewardIllustration reward={rewardNextMilestone} />
                        </div>
                        <strong className="hd-rewards-next-title">{rewardNextMilestone.title}</strong>
                        <p className="hd-rewards-next-hint">{rewardNextMilestone.hint || rewardNextMilestone.subtitle}</p>
                        <div className="hd-rewards-next-bar-wrap">
                          <div className="hd-rewards-next-bar">
                            <div className="hd-rewards-next-fill" style={{ transform: `scaleX(${rewardNextMilestonePct / 100})` }} />
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
                            <RewardIllustration reward={badge} />
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

            <TeamProfileCard />

            <footer className="runner-shell-footer runner-dashboard-footer">
              <FooterNavLinks />
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}

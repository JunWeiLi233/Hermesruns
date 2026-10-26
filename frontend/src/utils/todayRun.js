import { formatPace } from './format';
import { estimateCurrentVdot, computeTrainingPaces } from './vdot';
import { resolvePersonalizedCoachRecommendation } from './personalizedCoachPlan';
import { calendarDate, getAccountDate, getActivityDateKey } from './timeZone';

function hrToVo2Fraction(avgHr, hrMax) {
  if (!avgHr || !hrMax || hrMax <= 0) return null;
  const hrPct = Math.min(1.0, avgHr / hrMax);
  // Swain (1994) running rule-of-thumb:
  // %HRmax = 0.64 * %VO2max + 37  =>  %VO2max = (%HRmax - 37) / 0.64
  // vo2Fraction = %VO2max/100. With %HRmax = hrPct*100:
  // vo2Fraction = (hrPct*100 - 37) / 64
  return Math.max(0, (hrPct * 100 - 37) / 64);
}

function paceToVo2Fraction(paceSecPerKm, vdot) {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !vdot || vdot <= 0) return null;
  const velocity = (1000 / paceSecPerKm) * 60;
  const vo2 = -4.60 + (0.182258 * velocity) + (0.000104 * velocity * velocity);
  return vo2 / vdot;
}

function computeEffortScore(vo2Fraction, durationMin) {
  if (vo2Fraction <= 0 || durationMin <= 0) return 0;
  const intensityRatio = vo2Fraction / 0.85;
  return (durationMin / 60) * intensityRatio * intensityRatio * 100;
}

function recoveryHoursFromScore(score, durationMin, vdot) {
  if (score <= 0) return 0;
  const durationFactor = durationMin > 90 ? 1 + 0.005 * (durationMin - 90) : 1;
  const adjustedScore = score * durationFactor;
  const base = 0.45 * Math.pow(adjustedScore, 0.85);
  const fitnessDiscount = Math.max(0.8, 1.10 - (vdot || 40) / 200);
  return Math.min(96, base * fitnessDiscount);
}

function computeRecoveryState(runs, vdot) {
  let estimatedHRmax = 0;
  for (const run of runs) {
    if (run.maxHeartRate && run.maxHeartRate > estimatedHRmax) estimatedHRmax = run.maxHeartRate;
  }

  const now = Date.now();
  const lookbackMs = 4 * 24 * 60 * 60 * 1000;
  const recentRuns = runs
    .filter((run) => {
      const time = new Date(run.startTime || run.startDate).getTime();
      return !Number.isNaN(time) && (now - time) < lookbackMs;
    })
    .sort((a, b) => new Date(b.startTime || b.startDate) - new Date(a.startTime || a.startDate));

  if (recentRuns.length === 0) return { recoveryHoursLeft: 0, hasData: false };

  let maxRemainingHours = 0;
  let hasData = false;
  for (const run of recentRuns) {
    const durationMin = (run.movingTimeSeconds || 0) / 60;
    if (durationMin <= 0) continue;
    hasData = true;

    const distKm = run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0);
    const paceSecPerKm = distKm > 0 ? (run.movingTimeSeconds / distKm) : 0;

    let vo2Fraction;
    if (run.averageHeartRate && estimatedHRmax > 100) {
      const hrFrac = hrToVo2Fraction(run.averageHeartRate, estimatedHRmax);
      if (hrFrac !== null && hrFrac > 0) vo2Fraction = hrFrac;
    }

    if (!vo2Fraction) {
      const paceFrac = paceToVo2Fraction(paceSecPerKm, vdot);
      vo2Fraction = (paceFrac !== null && paceFrac > 0) ? paceFrac : 0.65;
    }

    vo2Fraction = Math.max(0.4, Math.min(1.2, vo2Fraction));
    const score = computeEffortScore(vo2Fraction, durationMin);
    const recoveryHours = recoveryHoursFromScore(score, durationMin, vdot);
    const runTime = new Date(run.startTime || run.startDate).getTime();
    const hoursElapsed = (now - runTime) / (1000 * 60 * 60);
    const remaining = Math.max(0, recoveryHours - hoursElapsed);
    if (remaining > maxRemainingHours) maxRemainingHours = remaining;
  }

  return { recoveryHoursLeft: Math.min(96, Math.round(maxRemainingHours)), hasData };
}

function computeTrainingLoadSnapshot(runs, bestVdot, timeZone) {
  if (runs.length < 3) return null;

  let estimatedHRmax = 0;
  for (const run of runs) {
    if (run.maxHeartRate && run.maxHeartRate > estimatedHRmax) estimatedHRmax = run.maxHeartRate;
  }

  const dailyLoads = {};
  runs.forEach((run) => {
    const dateKey = getActivityDateKey(run, timeZone);
    if (Number.isNaN(calendarDate(dateKey).getTime())) return;

    const durationMin = (run.movingTimeSeconds || 0) / 60;
    if (durationMin <= 0) return;

    const distKm = run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0);
    const paceSecPerKm = distKm > 0 ? (run.movingTimeSeconds / distKm) : 0;

    let vo2Fraction;
    if (run.averageHeartRate && estimatedHRmax > 100) {
      const hrFrac = hrToVo2Fraction(run.averageHeartRate, estimatedHRmax);
      if (hrFrac !== null && hrFrac > 0) vo2Fraction = hrFrac;
    }

    if (!vo2Fraction) {
      const paceFrac = paceToVo2Fraction(paceSecPerKm, bestVdot);
      vo2Fraction = (paceFrac && paceFrac > 0) ? paceFrac : 0.65;
    }

    vo2Fraction = Math.max(0.4, Math.min(1.2, vo2Fraction));
    const score = computeEffortScore(vo2Fraction, durationMin);
    dailyLoads[dateKey] = (dailyLoads[dateKey] || 0) + score;
  });

  const dateKeys = Object.keys(dailyLoads).sort();
  if (!dateKeys.length) return null;

  // UTC coordinates represent account calendar days, not elapsed instants.
  // Use the same coordinate for buckets and iteration, including DST days.
  const start = calendarDate(dateKeys[0]);
  const end = calendarDate(getAccountDate(timeZone));

  const allDates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    allDates.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (allDates.length < 7) return null;

  const lambdaA = 2 / 8;
  const lambdaC = 2 / 29;
  let ewmaA = dailyLoads[allDates[0]] || 0;
  let ewmaC = ewmaA;
  let lastAcwr = null;

  for (let i = 0; i < allDates.length; i += 1) {
    const load = dailyLoads[allDates[i]] || 0;
    if (i === 0) {
      ewmaA = load;
      ewmaC = load;
    } else {
      ewmaA = load * lambdaA + (1 - lambdaA) * ewmaA;
      ewmaC = load * lambdaC + (1 - lambdaC) * ewmaC;
    }
    lastAcwr = ewmaC > 0.5 ? ewmaA / ewmaC : null;
  }

  return { acute: ewmaA, chronic: ewmaC, acwr: lastAcwr };
}

function resolveRunDistanceKm(run) {
  const km = Number(run.distanceKm || 0);
  if (km > 0) return km;
  const meters = Number(run.distanceMeters || 0);
  return meters > 0 ? meters / 1000 : 0;
}

function resolveRunTimeMs(run) {
  return new Date(run.startTime || run.startDate || 0).getTime();
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function classifyHardRuns(runs) {
  const eligiblePaces = runs
    .map((r) => {
      const km = resolveRunDistanceKm(r);
      const sec = Number(r.movingTimeSeconds || 0);
      return km >= 3 && sec > 0 ? sec / km : null;
    })
    .filter((v) => Number.isFinite(v));

  const hardPaceThreshold = percentile(eligiblePaces, 0.35);

  return runs.map((r) => {
    const km = resolveRunDistanceKm(r);
    const sec = Number(r.movingTimeSeconds || 0);
    const durationMin = sec / 60;
    const pace = km > 0 ? sec / km : null;
    const longRun = durationMin >= 90 || km >= 16;
    const fasterRun = hardPaceThreshold !== null && pace !== null && pace <= hardPaceThreshold && durationMin >= 30;
    return { run: r, isHard: Boolean(longRun || fasterRun), durationMin, km };
  });
}

function computeMicrocycleSnapshot(runs, nowMs, timeZone) {
  const d7 = 7 * 24 * 60 * 60 * 1000;
  const d14 = 14 * 24 * 60 * 60 * 1000;
  const tagged = classifyHardRuns(runs);
  let km7 = 0;
  let km14 = 0;
  let hard7 = 0;
  const runDays7 = new Set();
  let lastHardAt = null;

  for (const item of tagged) {
    const t = resolveRunTimeMs(item.run);
    if (!Number.isFinite(t)) continue;
    const age = nowMs - t;
    if (age <= d14) km14 += item.km;
    if (age <= d7) {
      km7 += item.km;
      const dateKey = getActivityDateKey(item.run, timeZone);
      if (dateKey) runDays7.add(dateKey);
      if (item.isHard) hard7 += 1;
    }
    if (item.isHard && (lastHardAt === null || t > lastHardAt)) {
      lastHardAt = t;
    }
  }

  const hoursSinceHard = lastHardAt ? (nowMs - lastHardAt) / (1000 * 60 * 60) : null;
  const runDaysCount7 = runDays7.size;
  const qualityCap = runDaysCount7 >= 5 ? 2 : 1;
  return { km7, km14, hard7, hoursSinceHard, runDaysCount7, qualityCap };
}

function getRecommendationTone(type, t) {
  switch (type) {
    case t('today_run.personalized_type_rest'):
    case t('profile.today_run_type_recovery'):
      return { key: 'recovery', icon: 'R', accent: '#94a3b8' };
    case t('profile.today_run_type_easy'):
    case t('profile.today_run_type_base'):
      return { key: 'easy', icon: 'E', accent: '#22c55e' };
    case t('profile.today_run_type_quality'):
      return { key: 'quality', icon: 'Q', accent: '#f59e0b' };
    default:
      return { key: 'restart', icon: 'T', accent: '#ff6b2c' };
  }
}

export function getTodayRunRecommendation({ runs, t, lang, unit, weatherContext, coachPayload, timeZone = 'UTC', todayKey: accountToday }) {
  timeZone = timeZone || 'UTC';
  // File imports now supply an explicit instant. Adapt it once for all existing
  // history/VDOT calculations; retain legacy wall-time fallback without inferring a zone.
  runs = runs.map(run => run.activityInstant ? { ...run, startTime: run.activityInstant } : run);
  const totalKm = runs.reduce((s, r) => s + resolveRunDistanceKm(r), 0);
  const totalSec = runs.reduce((s, r) => s + (r.movingTimeSeconds || 0), 0);
  const now = new Date();
  const nowMs = now.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const todayKey = accountToday || getAccountDate(coachPayload?.plan?.timeZone || timeZone, now);
  const recent7 = runs.filter((run) => {
    const date = new Date(run.startTime || run.startDate);
    return !Number.isNaN(date.getTime()) && (nowMs - date.getTime()) / msPerDay <= 7;
  });
  const recent14 = runs.filter((run) => {
    const date = new Date(run.startTime || run.startDate);
    return !Number.isNaN(date.getTime()) && (nowMs - date.getTime()) / msPerDay <= 14;
  });
  const recent7Km = recent7.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
  const recent14Km = recent14.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
  const bestVdot = estimateCurrentVdot(runs).representativeVdot;
  const trainingPaces = bestVdot > 0 ? computeTrainingPaces(bestVdot) : null;
  const recoveryState = computeRecoveryState(runs, bestVdot);
  const trainingLoad = computeTrainingLoadSnapshot(runs, bestVdot, timeZone);

  const penalty = weatherContext?.available ? (weatherContext.pacePenaltySecPerKm || 0) : 0;

  const safeFormatPace = (seconds, applyPenalty = true) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const s = applyPenalty ? seconds + penalty : seconds;
    return formatPace(1, s, lang);
  };

  const formatPaceRange = (range, fallback, applyPenalty = true) => {
    if (!Array.isArray(range) || range.length === 0) return fallback;
    const values = range.map((s) => safeFormatPace(s, applyPenalty)).filter(Boolean);
    if (values.length === 0) return fallback;
    if (values.length === 1) return values[0];
    return `${values[0]} - ${values[1]}`;
  };

  const easyPace = formatPaceRange(trainingPaces?.easy, t('profile.today_run_pace_easy'));
  const thresholdPace = formatPaceRange(trainingPaces?.threshold, t('profile.today_run_pace_quality'));
  const intervalPace = formatPaceRange(trainingPaces?.interval, t('profile.today_run_pace_quality'));

  const normalEasyPace = formatPaceRange(trainingPaces?.easy, t('profile.today_run_pace_easy'), false);
  const normalThresholdPace = formatPaceRange(trainingPaces?.threshold, t('profile.today_run_pace_quality'), false);
  const normalIntervalPace = formatPaceRange(trainingPaces?.interval, t('profile.today_run_pace_quality'), false);

  const recoveryHours = recoveryState.recoveryHoursLeft || 0;
  const acwr = trainingLoad?.acwr ?? null;
  const micro = computeMicrocycleSnapshot(runs, nowMs, timeZone);

  const personalized = resolvePersonalizedCoachRecommendation({
    coachPayload, t, lang, unit, todayKey,
  });
  const recommendation = personalized?.recommendation || {
    intent: 'unavailable', source: 'unavailable', workoutType: null,
    type: t('today_run.shared_plan_waiting'), title: t('today_run.shared_plan_waiting'),
    distance: '—', distanceKm: null, pace: '—', normalPace: '—',
    purpose: t('today_run.shared_plan_unavailable'),
  };

  const tone = getRecommendationTone(recommendation.type, t);
  const metrics = {
    bestVdot,
    recoveryHours,
    recoveryHasData: recoveryState.hasData,
    acwr,
    coachLoadEvidence: personalized ? { source: 'personalized-planner' } : null,
    totalKm,
    totalSec,
    recent7Km,
    recent14Km,
    hardRuns7d: micro.hard7,
    hoursSinceHard: micro.hoursSinceHard,
    runDays7: micro.runDaysCount7,
    qualityCap: micro.qualityCap,
    easyPace,
    thresholdPace,
    intervalPace,
    normalEasyPace,
    normalThresholdPace,
    normalIntervalPace,
    weatherPenalty: penalty,
  };

  return {
    recommendation,
    tone,
    metrics,
    plan: personalized?.steps || [],
    reasons: personalized?.reasons || [recommendation.purpose],
    personalizedPlan: personalized?.plan || null,
  };
}

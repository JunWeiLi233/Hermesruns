import { formatPace } from './format';
import { estimateCurrentVdot, computeTrainingPaces } from './vdot';

function hrToVo2Fraction(avgHr, hrMax) {
  if (!avgHr || !hrMax || hrMax <= 0) return null;
  const hrPct = Math.min(1.0, avgHr / hrMax);
  return Math.max(0, 1.67 * hrPct - 0.67);
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

  if (recentRuns.length === 0) return { recoveryHoursLeft: 0, hasData: runs.length > 0 };

  let maxRemainingHours = 0;
  for (const run of recentRuns) {
    const durationMin = (run.movingTimeSeconds || 0) / 60;
    if (durationMin <= 0) continue;

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

  return { recoveryHoursLeft: Math.min(96, Math.round(maxRemainingHours)), hasData: true };
}

function computeTrainingLoadSnapshot(runs, bestVdot) {
  if (runs.length < 3) return null;

  let estimatedHRmax = 0;
  for (const run of runs) {
    if (run.maxHeartRate && run.maxHeartRate > estimatedHRmax) estimatedHRmax = run.maxHeartRate;
  }

  const dailyLoads = {};
  runs.forEach((run) => {
    const date = new Date(run.startTime || run.startDate);
    if (Number.isNaN(date.getTime())) return;
    const dateKey = date.toISOString().split('T')[0];

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

  const start = new Date(dateKeys[0]);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const allDates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    allDates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
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

function getRecommendationTone(type, t) {
  switch (type) {
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

function buildPlan(type, t, metrics) {
  const easyPace = metrics.easyPace;
  const thresholdPace = metrics.thresholdPace;
  const intervalPace = metrics.intervalPace;

  if (type === t('profile.today_run_type_recovery')) {
    return [
      { label: t('today_run.plan_step_1'), value: t('today_run.plan_recovery_1') },
      { label: t('today_run.plan_step_2'), value: t('today_run.plan_recovery_2', { pace: easyPace }) },
      { label: t('today_run.plan_step_3'), value: t('today_run.plan_recovery_3') },
    ];
  }

  if (type === t('profile.today_run_type_quality')) {
    return [
      { label: t('today_run.plan_step_1'), value: t('today_run.plan_quality_1') },
      { label: t('today_run.plan_step_2'), value: t('today_run.plan_quality_2', { pace: thresholdPace }) },
      { label: t('today_run.plan_step_3'), value: t('today_run.plan_quality_3', { pace: intervalPace }) },
      { label: t('today_run.plan_step_4'), value: t('today_run.plan_quality_4') },
    ];
  }

  if (type === t('profile.today_run_type_easy')) {
    return [
      { label: t('today_run.plan_step_1'), value: t('today_run.plan_easy_1') },
      { label: t('today_run.plan_step_2'), value: t('today_run.plan_easy_2', { pace: easyPace }) },
      { label: t('today_run.plan_step_3'), value: t('today_run.plan_easy_3') },
    ];
  }

  if (type === t('profile.today_run_type_restart')) {
    return [
      { label: t('today_run.plan_step_1'), value: t('today_run.plan_restart_1') },
      { label: t('today_run.plan_step_2'), value: t('today_run.plan_restart_2') },
      { label: t('today_run.plan_step_3'), value: t('today_run.plan_restart_3') },
    ];
  }

  return [
    { label: t('today_run.plan_step_1'), value: t('today_run.plan_base_1') },
    { label: t('today_run.plan_step_2'), value: t('today_run.plan_base_2', { pace: easyPace }) },
    { label: t('today_run.plan_step_3'), value: t('today_run.plan_base_3') },
  ];
}

function buildReasons(recommendation, t, metrics) {
  const reasons = [];

  if (metrics.bestVdot > 0) {
    reasons.push(t('today_run.reason_vdot', { vdot: metrics.bestVdot.toFixed(1) }));
  }
  if (metrics.recoveryHours > 0) {
    reasons.push(t('today_run.reason_recovery', { hours: metrics.recoveryHours }));
  }
  if (metrics.acwr !== null) {
    reasons.push(t('today_run.reason_acwr', { acwr: metrics.acwr.toFixed(2) }));
  }
  reasons.push(recommendation.purpose);
  return reasons;
}

export function getTodayRunRecommendation({ runs, t, lang }) {
  const totalKm = runs.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalSec = runs.reduce((s, r) => s + (r.movingTimeSeconds || 0), 0);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const recent7 = runs.filter((run) => {
    const date = new Date(run.startTime || run.startDate);
    return !Number.isNaN(date.getTime()) && (now - date) / msPerDay <= 7;
  });
  const recent14 = runs.filter((run) => {
    const date = new Date(run.startTime || run.startDate);
    return !Number.isNaN(date.getTime()) && (now - date) / msPerDay <= 14;
  });
  const recent7Km = recent7.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
  const recent14Km = recent14.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
  const lastRun = runs[0] || null;
  const daysSinceLastRun = lastRun
    ? Math.max(0, Math.floor((now - new Date(lastRun.startTime || lastRun.startDate)) / msPerDay))
    : null;

  const bestVdot = estimateCurrentVdot(runs).representativeVdot;
  const trainingPaces = bestVdot > 0 ? computeTrainingPaces(bestVdot) : null;
  const recoveryState = computeRecoveryState(runs, bestVdot);
  const trainingLoad = computeTrainingLoadSnapshot(runs, bestVdot);

  const safeFormatPace = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return formatPace(1, seconds, lang);
  };
  const formatPaceRange = (range, fallback) => {
    if (!Array.isArray(range) || range.length === 0) return fallback;
    const values = range.map(safeFormatPace).filter(Boolean);
    if (values.length === 0) return fallback;
    if (values.length === 1) return values[0];
    return `${values[0]} - ${values[1]}`;
  };

  const easyPace = formatPaceRange(trainingPaces?.easy, t('profile.today_run_pace_easy'));
  const thresholdPace = formatPaceRange(trainingPaces?.threshold, t('profile.today_run_pace_quality'));
  const intervalPace = formatPaceRange(trainingPaces?.interval, t('profile.today_run_pace_quality'));
  const recoveryHours = recoveryState.recoveryHoursLeft || 0;
  const acwr = trainingLoad?.acwr ?? null;

  let recommendation;
  if (!runs.length) {
    recommendation = {
      type: t('profile.today_run_type_restart'),
      title: t('profile.today_run_title_restart'),
      distance: t('profile.today_run_distance_restart'),
      pace: t('profile.today_run_pace_restart'),
      purpose: t('profile.today_run_purpose_restart'),
    };
  } else if (recoveryState.hasData && recoveryHours > 24) {
    recommendation = {
      type: t('profile.today_run_type_recovery'),
      title: t('profile.today_run_title_recovery'),
      distance: t('profile.today_run_distance_recovery'),
      pace: easyPace,
      purpose: t('profile.today_run_purpose_recovery_analysis', { hours: recoveryHours }),
    };
  } else if (acwr !== null && acwr > 1.35) {
    recommendation = {
      type: t('profile.today_run_type_recovery'),
      title: t('profile.today_run_title_load_high'),
      distance: t('profile.today_run_distance_load_high'),
      pace: easyPace,
      purpose: t('profile.today_run_purpose_load_high', { acwr: acwr.toFixed(2) }),
    };
  } else if (acwr !== null && acwr < 0.8 && bestVdot > 0) {
    recommendation = {
      type: t('profile.today_run_type_quality'),
      title: t('profile.today_run_title_quality'),
      distance: t('profile.today_run_distance_quality_analysis'),
      pace: thresholdPace,
      purpose: t('profile.today_run_purpose_quality_analysis', { vdot: bestVdot.toFixed(1) }),
    };
  } else if (daysSinceLastRun !== null && daysSinceLastRun >= 2) {
    recommendation = {
      type: t('profile.today_run_type_easy'),
      title: t('profile.today_run_title_comeback'),
      distance: t('profile.today_run_distance_comeback', {
        distance: recent14Km >= 30 ? '8-10 km' : '6-8 km',
      }),
      pace: easyPace,
      purpose: t('profile.today_run_purpose_comeback'),
    };
  } else if (bestVdot > 0 && recent7Km >= 22 && recoveryHours <= 12) {
    recommendation = {
      type: t('profile.today_run_type_quality'),
      title: t('profile.today_run_title_threshold'),
      distance: t('profile.today_run_distance_threshold'),
      pace: thresholdPace,
      purpose: t('profile.today_run_purpose_threshold'),
    };
  } else {
    recommendation = {
      type: t('profile.today_run_type_base'),
      title: t('profile.today_run_title_base'),
      distance: t('profile.today_run_distance_base', {
        distance: recent14Km >= 20 ? '7-9 km' : '5-7 km',
      }),
      pace: bestVdot > 0 ? easyPace : intervalPace,
      purpose: bestVdot > 0
        ? t('profile.today_run_purpose_base_analysis', { vdot: bestVdot.toFixed(1) })
        : t('profile.today_run_purpose_base'),
    };
  }

  const tone = getRecommendationTone(recommendation.type, t);
  const metrics = {
    bestVdot,
    recoveryHours,
    acwr,
    totalKm,
    totalSec,
    recent7Km,
    recent14Km,
    easyPace,
    thresholdPace,
    intervalPace,
  };

  return {
    recommendation,
    tone,
    metrics,
    plan: buildPlan(recommendation.type, t, metrics),
    reasons: buildReasons(recommendation, t, metrics),
  };
}

import { formatDuration, formatPaceSeconds } from './format.js';
import {
  calculateVdot,
  buildOrderedRacePredictions,
  collectAllVdotEntries,
  estimateCurrentVdot,
  predictRaceTimeCalibrated,
  RACE_DISTANCES,
  danielsRunningVo2CostMlKgMin,
  computeTrainingPaces,
  vdotToPaceSecondsPerKm,
} from './vdot.js';

export const KM_TO_MILE = 1.60934;

export const ZONES = [
  { key: 'recovery', minFrac: 0, color: '#88909d' },
  { key: 'easy', minFrac: 0.59, color: '#4ccd73' },
  { key: 'marathon', minFrac: 0.75, color: '#5b8cff' },
  { key: 'threshold', minFrac: 0.83, color: '#f49787' },
  { key: 'interval', minFrac: 0.92, color: '#ff6e5d' },
  { key: 'rep', minFrac: 1.05, color: '#ff5647' },
];

const TRAINING_ZONE_DISPLAY_FRACTIONS = {
  easy: [0.59, 0.74],
  marathon: [0.75, 0.83],
  threshold: [0.83, 0.92],
  interval: [0.92, 1.05],
  repetition: [1.05, 1.1],
};

const avg = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

export function normalizeAnalysisList(value) {
  return Array.isArray(value) ? value : [];
}

export function kmOf(run) {
  return Number(run?.distanceKm || 0) || (Number(run?.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0);
}

export function hrToVo2Fraction(avgHr, hrMax) {
  if (!avgHr || !hrMax || hrMax <= 0) return null;
  return Math.max(0, (((Math.min(1, avgHr / hrMax) * 100) - 37) / 64));
}

export function paceToVo2Fraction(paceSecPerKm, vdot) {
  if (!paceSecPerKm || !vdot) return null;
  return danielsRunningVo2CostMlKgMin((1000 / paceSecPerKm) * 60) / vdot;
}

export function classifyZone(vo2Fraction) {
  let zone = ZONES[0];
  ZONES.forEach((candidate) => {
    if (vo2Fraction >= candidate.minFrac) zone = candidate;
  });
  return zone;
}

export function effortScore(vo2Fraction, durationMin) {
  if (vo2Fraction <= 0 || durationMin <= 0) return 0;
  const ratio = vo2Fraction / 0.85;
  return (durationMin / 60) * ratio * ratio * 100;
}

function resolveRunVo2Fraction(run, bestVdot, hrMax) {
  const durationSec = Number(run?.movingTimeSeconds || 0);
  const distanceKm = kmOf(run);
  if (durationSec <= 0 || distanceKm <= 0) return null;
  const paceSec = durationSec / distanceKm;
  const avgHr = Number(run?.averageHeartRate || 0);
  let vo2Fraction = null;
  if (avgHr > 0 && hrMax > 100) vo2Fraction = hrToVo2Fraction(avgHr, hrMax);
  vo2Fraction = vo2Fraction || paceToVo2Fraction(paceSec, bestVdot) || 0.65;
  return Math.max(0.4, Math.min(1.2, vo2Fraction));
}

export function acwrZone(acwr) {
  if (acwr == null) return { key: 'unknown', tone: 'muted', color: '#8f8c88' };
  if (acwr < 0.8) return { key: 'under', tone: 'cool', color: '#5b8cff' };
  if (acwr <= 1.3) return { key: 'optimal', tone: 'good', color: '#59d487' };
  if (acwr <= 1.5) return { key: 'warning', tone: 'warn', color: '#ffb56f' };
  return { key: 'danger', tone: 'danger', color: '#ff7b69' };
}

export function buildTrainingLoad(runs, bestVdot) {
  if (!runs.length || !bestVdot) return null;

  let hrMax = 0;
  runs.forEach((run) => {
    hrMax = Math.max(hrMax, Number(run.maxHeartRate || 0));
  });

  const daily = {};
  runs.forEach((run) => {
    const started = new Date(run.startTime || run.startDate || 0);
    const durationMin = Number(run.movingTimeSeconds || 0) / 60;
    const distanceKm = kmOf(run);
    if (Number.isNaN(started.getTime()) || durationMin <= 0 || distanceKm <= 0) return;

    const vo2Fraction = resolveRunVo2Fraction(run, bestVdot, hrMax) || 0.65;
    const key = started.toISOString().slice(0, 10);
    daily[key] = (daily[key] || 0) + effortScore(vo2Fraction, durationMin);
  });

  const keys = Object.keys(daily).sort();
  if (!keys.length) return null;

  const start = new Date(keys[0]);
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const days = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  if (days.length < 7) return null;

  let acute = daily[days[0]] || 0;
  let chronic = acute;
  const acuteSeries = [];
  const chronicSeries = [];
  const acwrSeries = [];

  days.forEach((day, index) => {
    const load = daily[day] || 0;
    if (index === 0) {
      acute = load;
      chronic = load;
    } else {
      acute = (load * (2 / 8)) + ((1 - (2 / 8)) * acute);
      chronic = (load * (2 / 29)) + ((1 - (2 / 29)) * chronic);
    }
    acuteSeries.push(Math.round(acute * 10) / 10);
    chronicSeries.push(Math.round(chronic * 10) / 10);
    acwrSeries.push(chronic > 0.5 ? Math.round((acute / chronic) * 100) / 100 : null);
  });

  return {
    lastAcute: acuteSeries.at(-1) || 0,
    lastChronic: chronicSeries.at(-1) || 0,
    lastAcwr: acwrSeries.at(-1) ?? null,
    acuteSeries,
    chronicSeries,
    acwrSeries,
    days,
  };
}

export function buildPolarized(runs, bestVdot) {
  if (!runs.length || !bestVdot) return null;

  const now = Date.now();
  const lookback = 28 * 24 * 60 * 60 * 1000;
  let hrMax = 0;
  runs.forEach((run) => {
    hrMax = Math.max(hrMax, Number(run.maxHeartRate || 0));
  });

  let easy = 0;
  let moderate = 0;
  let hard = 0;

  runs.forEach((run) => {
    const started = new Date(run.startTime || run.startDate || 0).getTime();
    const duration = Number(run.movingTimeSeconds || 0);
    const distanceKm = kmOf(run);
    if (Number.isNaN(started) || now - started > lookback || duration <= 0 || distanceKm <= 0) return;

    const zone = classifyZone(resolveRunVo2Fraction(run, bestVdot, hrMax) || 0.65);
    if (zone.key === 'recovery' || zone.key === 'easy') easy += duration;
    else if (zone.key === 'marathon') moderate += duration;
    else hard += duration;
  });

  const total = easy + moderate + hard;
  if (!total) return null;

  const easySharePct = Math.round((easy / total) * 100);
  const hardSharePct = Math.round((hard / total) * 100);
  const moderateSharePct = Math.max(0, 100 - easySharePct - hardSharePct);
  const ratioBase = easy + hard;
  const easyPct = ratioBase > 0 ? Math.round((easy / ratioBase) * 100) : (moderate > 0 ? 100 : 0);
  const hardPct = Math.max(0, 100 - easyPct);

  return {
    easyPct,
    hardPct,
    easySharePct,
    hardSharePct,
    moderateSharePct,
    easySeconds: easy,
    moderateSeconds: moderate,
    hardSeconds: hard,
  };
}

export function buildInjuryInsight(runs, trainingLoad) {
  const now = Date.now();
  const recentStart = now - (14 * 24 * 60 * 60 * 1000);
  const baselineStart = now - (42 * 24 * 60 * 60 * 1000);
  const eligible = runs.map((run) => {
    const started = new Date(run.startTime || run.startDate || 0).getTime();
    const distanceKm = kmOf(run);
    const durationSec = Number(run.movingTimeSeconds || 0);
    const cadence = Number(run.averageCadence || 0);
    const hr = Number(run.averageHeartRate || 0);
    if (Number.isNaN(started) || started < baselineStart || distanceKm < 4 || durationSec < 20 * 60) return null;
    const paceSec = durationSec / Math.max(distanceKm, 0.001);
    return { started, cadence: cadence > 0 ? cadence : null, cost: hr > 0 ? hr * (paceSec / 300) : null };
  }).filter(Boolean);

  const baseline = eligible.filter((run) => run.started >= baselineStart && run.started < recentStart);
  const recent = eligible.filter((run) => run.started >= recentStart);
  const cadenceBaseline = avg(baseline.filter((run) => run.cadence != null).map((run) => run.cadence));
  const cadenceRecent = avg(recent.filter((run) => run.cadence != null).map((run) => run.cadence));
  const costBaseline = avg(baseline.filter((run) => run.cost != null).map((run) => run.cost));
  const costRecent = avg(recent.filter((run) => run.cost != null).map((run) => run.cost));
  const cadenceDelta = cadenceBaseline > 0 ? ((cadenceRecent - cadenceBaseline) / cadenceBaseline) * 100 : 0;
  const costDelta = costBaseline > 0 ? ((costRecent - costBaseline) / costBaseline) * 100 : 0;

  let score = 6;
  if (trainingLoad?.lastAcwr != null) {
    if (trainingLoad.lastAcwr >= 1.35) score += 28;
    else if (trainingLoad.lastAcwr >= 1.18) score += 16;
  }
  if (cadenceDelta <= -2) score += 24;
  else if (cadenceDelta <= -1) score += 12;
  if (costDelta >= 4.5) score += 26;
  else if (costDelta >= 2) score += 14;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = score >= 72 ? 'high' : score >= 46 ? 'moderate' : 'low';

  return {
    level,
    score,
    cadenceDelta,
    costDelta,
    cadenceBaseline,
    cadenceRecent,
    costBaseline,
    costRecent,
    baselineCount: baseline.length,
    recentCount: recent.length,
  };
}

export function buildVo2Bars(entries, lang) {
  const safeEntries = normalizeAnalysisList(entries);
  const fmt = new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short' });
  const now = new Date();
  const bars = [];

  for (let i = 5; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthEntries = safeEntries.filter((entry) => entry.date >= start && entry.date < end);
    const best = monthEntries.reduce((max, entry) => Math.max(max, entry.vdot || 0), 0);
    const bestAdjusted = monthEntries.reduce((max, entry) => Math.max(max, entry.adjustedVo2max || entry.vdot || 0), 0);

    bars.push({
      key: `${start.getFullYear()}-${start.getMonth()}`,
      label: fmt.format(start).slice(0, 3).toUpperCase(),
      value: best || null,
      adjustedValue: bestAdjusted || best || null,
      hasAdjustment: best > 0 && (bestAdjusted - best) > 0.05,
    });
  }

  const max = Math.max(50, ...bars.flatMap((bar) => [bar.value || 0, bar.adjustedValue || 0]));
  return bars.map((bar, index) => ({
    ...bar,
    current: index === bars.length - 1,
    height: bar.value ? Math.max(26, Math.round((bar.value / max) * 100)) : 22,
    adjustedHeight: bar.adjustedValue ? Math.max(26, Math.round((bar.adjustedValue / max) * 100)) : 22,
  }));
}

export function buildPredictionRows(bestVdot, runs, lang, unit) {
  if (!bestVdot) return [];

  return normalizeAnalysisList(buildOrderedRacePredictions(bestVdot, runs))
    .map((row) => {
      const totalSeconds = Math.round((row.timeMin || 0) * 60);
      const paceSec = row.timeMin ? (totalSeconds / row.meters) * 1000 : null;
      return {
        ...row,
        label: lang === 'zh-CN' ? row.labelZh : row.labelEn,
        timeLabel: row.timeMin ? formatDuration(totalSeconds) : '--',
        paceLabel: paceSec ? formatPaceSeconds(unit === 'mile' ? paceSec * KM_TO_MILE : paceSec) : '--:--',
      };
    });
}

export function buildCoachInsight(snapshot) {
  if (snapshot.injury.level === 'high') {
    return { key: 'protect', tone: 'danger' };
  }
  if ((snapshot.trainingLoad?.lastAcwr ?? 0) > 1.3) {
    return { key: 'absorb', tone: 'warn' };
  }
  if ((snapshot.polarized?.hardPct ?? 0) >= 32) {
    return { key: 'rebalance', tone: 'warn' };
  }
  if ((snapshot.marathonDeltaSeconds ?? 0) < 0) {
    return { key: 'press', tone: 'good' };
  }
  return { key: 'build', tone: 'cool' };
}

function buildRecentVdotTrend(entries) {
  if (!Array.isArray(entries) || entries.length < 4) return null;

  const sorted = entries
    .filter((entry) => entry && entry.date && Number.isFinite(Number(entry.vdot || entry.vo2max || 0)))
    .map((entry) => ({
      date: new Date(entry.date),
      vdot: Number(entry.vdot || entry.vo2max || 0),
    }))
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .sort((a, b) => a.date - b.date);

  const sampleSize = Math.min(3, Math.floor(sorted.length / 2));
  if (sampleSize < 2) return null;

  const recent = sorted.slice(-sampleSize).map((entry) => entry.vdot);
  const prior = sorted.slice(-(sampleSize * 2), -sampleSize).map((entry) => entry.vdot);
  if (!recent.length || !prior.length) return null;

  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  if (!Number.isFinite(recentAvg) || !Number.isFinite(priorAvg) || priorAvg <= 0) return null;

  const delta = Math.round((recentAvg - priorAvg) * 10) / 10;
  const pct = Math.round((((recentAvg - priorAvg) / priorAvg) * 100) * 10) / 10;

  return {
    recentAvg: Math.round(recentAvg * 10) / 10,
    priorAvg: Math.round(priorAvg * 10) / 10,
    delta,
    pct,
    sampleSize,
  };
}

function resolveCoachSystemState(snapshot, trend) {
  const acwr = snapshot.trainingLoad?.lastAcwr ?? null;
  const injuryLevel = snapshot.injury?.level ?? 'low';
  const hardPct = snapshot.polarized?.hardPct ?? 0;
  const marathonDeltaSeconds = snapshot.marathonDeltaSeconds ?? null;
  const vdotDelta = trend?.delta ?? null;

  const loadState = injuryLevel === 'high' || (acwr != null && acwr >= 1.35)
    ? 'protect'
    : acwr != null && acwr >= 1.18
      ? 'absorb'
      : 'build';

  const mixState = hardPct >= 32
    ? 'rebalance'
    : (snapshot.polarized?.easyPct ?? 0) >= 75
      ? 'balanced'
      : 'build';

  const forecastState = injuryLevel === 'high'
    ? 'reset'
    : (vdotDelta != null && vdotDelta > 0.4) || (marathonDeltaSeconds != null && marathonDeltaSeconds < 0)
      ? 'press'
      : (vdotDelta != null && vdotDelta < -0.4) || (marathonDeltaSeconds != null && marathonDeltaSeconds > 45)
        ? 'reset'
        : 'hold';

  return {
    loadState,
    mixState,
    forecastState,
  };
}

function resolveSectionTone(state, fallbackTone = 'cool') {
  if (state === 'protect' || state === 'reset') return 'danger';
  if (state === 'absorb' || state === 'rebalance') return 'warn';
  if (state === 'press' || state === 'balanced') return 'good';
  return fallbackTone;
}

export function buildCoachSystemSections(snapshot) {
  if (!snapshot) {
    return {
      key: 'build',
      tone: 'cool',
      phase: 'build',
      sections: [],
      signals: {
        acwr: null,
        acute: null,
        chronic: null,
        injuryLevel: null,
        injuryScore: null,
        easySharePct: null,
        moderateSharePct: null,
        hardSharePct: null,
        bestVdot: null,
        marathonDeltaSeconds: null,
        vdotTrendDelta: null,
        vdotTrendPct: null,
      },
    };
  }

  const coach = snapshot.coachInsight || buildCoachInsight(snapshot);
  const trend = buildRecentVdotTrend(snapshot.entries);
  const states = resolveCoachSystemState(snapshot, trend);

  const acwr = snapshot.trainingLoad?.lastAcwr ?? null;
  const acute = snapshot.trainingLoad?.lastAcute ?? null;
  const chronic = snapshot.trainingLoad?.lastChronic ?? null;
  const injuryLevel = snapshot.injury?.level ?? null;
  const injuryScore = snapshot.injury?.score ?? null;
  const easySharePct = snapshot.polarized?.easySharePct ?? null;
  const moderateSharePct = snapshot.polarized?.moderateSharePct ?? null;
  const hardSharePct = snapshot.polarized?.hardSharePct ?? null;
  const bestVdot = snapshot.bestVdot ?? null;
  const marathonDeltaSeconds = snapshot.marathonDeltaSeconds ?? null;

  return {
    key: coach.key,
    tone: coach.tone,
    phase: coach.key,
    sections: [
      {
        key: 'load',
        state: states.loadState,
        tone: resolveSectionTone(states.loadState, acwrZone(acwr).tone),
        metrics: {
          acwr,
          acute,
          chronic,
          injuryLevel,
          injuryScore,
        },
      },
      {
        key: 'mix',
        state: states.mixState,
        tone: resolveSectionTone(states.mixState),
        metrics: {
          easyPct: snapshot.polarized?.easyPct ?? null,
          hardPct: snapshot.polarized?.hardPct ?? null,
          easySharePct,
          moderateSharePct,
          hardSharePct,
        },
      },
      {
        key: 'forecast',
        state: states.forecastState,
        tone: resolveSectionTone(states.forecastState),
        metrics: {
          bestVdot,
          marathonDeltaSeconds,
          vdotTrendDelta: trend?.delta ?? null,
          vdotTrendPct: trend?.pct ?? null,
          trendSampleSize: trend?.sampleSize ?? null,
        },
      },
    ],
    signals: {
      acwr,
      acute,
      chronic,
      injuryLevel,
      injuryScore,
      easySharePct,
      moderateSharePct,
      hardSharePct,
      bestVdot,
      marathonDeltaSeconds,
      vdotTrendDelta: trend?.delta ?? null,
      vdotTrendPct: trend?.pct ?? null,
    },
  };
}

export function buildRunInsightRows(runs, bestVdot, unit, lang, limit = 6) {
  if (!runs.length) return [];

  let hrMax = 0;
  runs.forEach((run) => {
    hrMax = Math.max(hrMax, Number(run.maxHeartRate || 0));
  });

  const dateFormatter = new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });

  return runs
    .filter((run) => Number(run?.movingTimeSeconds || 0) > 0 && kmOf(run) > 0)
    .slice(0, limit)
    .map((run) => {
      const distanceKm = kmOf(run);
      const durationSec = Number(run.movingTimeSeconds || 0);
      const paceSec = durationSec / distanceKm;
      const vo2Fraction = resolveRunVo2Fraction(run, bestVdot, hrMax) || 0.65;
      const zone = classifyZone(vo2Fraction);
      const distanceValue = unit === 'mile' ? distanceKm / KM_TO_MILE : distanceKm;
      return {
        id: run.id,
        title: run.name || run.title || (lang === 'zh-CN' ? '训练记录' : 'Training session'),
        dateLabel: dateFormatter.format(new Date(run.startTime || run.startDate || 0)),
        distanceLabel: `${distanceValue.toFixed(1)} ${unit === 'mile' ? 'mi' : 'km'}`,
        paceLabel: `${formatPaceSeconds(unit === 'mile' ? paceSec * KM_TO_MILE : paceSec)} /${unit === 'mile' ? 'mi' : 'km'}`,
        zoneKey: zone.key,
        loadScore: Math.round(effortScore(vo2Fraction, durationSec / 60)),
        cadence: Number(run.averageCadence || 0) || null,
        averageHeartRate: Number(run.averageHeartRate || 0) || null,
      };
    });
}

export function calculatePredictionConsistency(entries) {
  if (!Array.isArray(entries) || entries.length < 3) return { score: 0, level: 'low' };

  const recent = entries
    .filter((e) => e && e.vdot > 0)
    .sort((a, b) => b.date - a.date)
    .slice(0, 5)
    .map((e) => e.vdot);

  if (recent.length < 3) return { score: 0, level: 'low' };

  const mean = avg(recent);
  const variance = avg(recent.map((v) => Math.pow(v - mean, 2)));
  const stdDev = Math.sqrt(variance);

  // Daniels VDOT noise: < 0.5 is very consistent, > 1.2 is high variance
  const score = Math.max(0, Math.min(100, Math.round(100 - (stdDev * 40))));
  let level = 'low';
  if (score >= 85) level = 'high';
  else if (score >= 65) level = 'moderate';

  return { score, level, stdDev };
}

export function buildTrainingZones(bestVdot, lang, unit) {
  if (!bestVdot) return [];
  const paces = computeTrainingPaces(bestVdot);
  const zones = [
    { key: 'easy', range: paces.easy },
    { key: 'marathon', range: paces.marathon },
    { key: 'threshold', range: paces.threshold },
    { key: 'interval', range: paces.interval },
    { key: 'repetition', range: paces.repetition },
  ];

  return zones.map((zone) => {
    const displaySeconds = zone.range.length > 1
      ? zone.range
      : (TRAINING_ZONE_DISPLAY_FRACTIONS[zone.key] || [])
        .map((fraction) => vdotToPaceSecondsPerKm(bestVdot, fraction))
        .filter(Boolean);
    const range = (displaySeconds.length ? displaySeconds : zone.range).map((seconds) => {
      const pace = unit === 'mile' ? seconds * KM_TO_MILE : seconds;
      return formatPaceSeconds(pace);
    });
    return {
      ...zone,
      label: zone.key.charAt(0).toUpperCase() + zone.key.slice(1),
      paceLabel: range.length > 1 ? `${range[0]} - ${range[1]}` : range[0],
    };
  });
}

export function buildAnalysisSnapshot(runs, lang, unit) {
  const bestEstimate = estimateCurrentVdot(runs);
  const bestVdot = bestEstimate.representativeVdot;
  const entries = normalizeAnalysisList(collectAllVdotEntries(runs));
  const vo2Bars = normalizeAnalysisList(buildVo2Bars(entries, lang));
  const trainingLoad = buildTrainingLoad(runs, bestVdot);
  const loadZone = acwrZone(trainingLoad?.lastAcwr);
  const polarized = buildPolarized(runs, bestVdot);
  const injury = buildInjuryInsight(runs, trainingLoad);
  const predictionRows = normalizeAnalysisList(buildPredictionRows(bestVdot, runs, lang, unit));
  const trainingZones = normalizeAnalysisList(buildTrainingZones(bestVdot, lang, unit));
  const marathonRow = predictionRows.find((row) => row.key === 'marathon') || null;

  let marathonDeltaSeconds = null;
  if (bestVdot && marathonRow?.timeMin) {
    const baseline = predictRaceTimeCalibrated(Math.max(20, bestVdot - 1.2), marathonRow.meters, []);
    marathonDeltaSeconds = baseline ? Math.round((marathonRow.timeMin - baseline) * 60) : null;
  }

  const coachInsight = buildCoachInsight({
    trainingLoad,
    loadZone,
    polarized,
    injury,
    marathonDeltaSeconds,
    bestVdot,
  });
  const predictionConsistency = calculatePredictionConsistency(entries);

  return {
    bestEstimate,
    bestVdot,
    entries,
    vo2Bars,
    trainingLoad,
    loadZone,
    polarized,
    injury,
    predictionRows,
    trainingZones,
    marathonRow,
    marathonDeltaSeconds,
    coachInsight,
    predictionConsistency,
  };
}

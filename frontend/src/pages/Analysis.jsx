import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson, apiFetch } from '../api';
import { formatDuration, formatPaceSeconds } from '../utils/format';
import { calculateVdot, computeTrainingPaces, predictRaceTime, RACE_DISTANCES } from '../utils/vdot';
import TopNav from '../components/TopNav';
import Modal from '../components/Modal';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, LineController, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Scatter, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, LineController, ArcElement, Title, Tooltip, Legend, Filler);

const KM_TO_MILE = 1.60934;

const DANIELS_ZONES = [
  { key: 'recovery',  minFrac: 0,    labelEn: 'Recovery',   labelZh: '恢复跑',    color: '#94a3b8' },
  { key: 'easy',      minFrac: 0.59, labelEn: 'Easy',       labelZh: '轻松跑',    color: '#22c55e' },
  { key: 'marathon',  minFrac: 0.75, labelEn: 'Marathon',   labelZh: '马拉松配速', color: '#3b82f6' },
  { key: 'threshold', minFrac: 0.83, labelEn: 'Threshold',  labelZh: '乳酸阈值',  color: '#f59e0b' },
  { key: 'interval',  minFrac: 0.92, labelEn: 'Interval',   labelZh: '间歇',      color: '#ef4444' },
  { key: 'rep',       minFrac: 1.05, labelEn: 'Repetition', labelZh: '重复跑',    color: '#dc2626' },
];

function classifyZone(vo2Fraction) {
  let zone = DANIELS_ZONES[0];
  for (const z of DANIELS_ZONES) {
    if (vo2Fraction >= z.minFrac) zone = z;
  }
  return zone;
}

function hrToVo2Fraction(avgHr, hrMax) {
  if (!avgHr || !hrMax || hrMax <= 0) return null;
  const hrPct = Math.min(1.0, avgHr / hrMax);
  return Math.max(0, 1.67 * hrPct - 0.67);
}

function paceToVo2Fraction(paceSecPerKm, vdot) {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !vdot || vdot <= 0) return null;
  const v = (1000 / paceSecPerKm) * 60;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  return vo2 / vdot;
}

function computeEffortScore(vo2Fraction, durationMin) {
  if (vo2Fraction <= 0 || durationMin <= 0) return 0;
  const ir = vo2Fraction / 0.85;
  return (durationMin / 60) * ir * ir * 100;
}

function recoveryHoursFromScore(score, durationMin, vdot) {
  if (score <= 0) return 0;
  const durationFactor = durationMin > 90 ? 1 + 0.005 * (durationMin - 90) : 1.0;
  const adjustedScore = score * durationFactor;
  const base = 0.45 * Math.pow(adjustedScore, 0.85);
  const fitnessDiscount = Math.max(0.80, 1.10 - (vdot || 40) / 200);
  return Math.min(96, base * fitnessDiscount);
}

function analyzeRunRecovery(run, vdot, estimatedHRmax) {
  const durationMin = (run.movingTimeSeconds || 0) / 60;
  if (durationMin <= 0) return null;

  const distKm = run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0);
  const paceSecPerKm = distKm > 0 ? (run.movingTimeSeconds / distKm) : 0;
  let vo2Fraction, hrBased = false;

  const avgHr = run.averageHeartRate;
  if (avgHr && avgHr > 0 && estimatedHRmax && estimatedHRmax > 100) {
    const hrFrac = hrToVo2Fraction(avgHr, estimatedHRmax);
    if (hrFrac !== null && hrFrac > 0) {
      vo2Fraction = hrFrac;
      hrBased = true;
    }
  }

  if (!hrBased) {
    const paceFrac = paceToVo2Fraction(paceSecPerKm, vdot);
    vo2Fraction = (paceFrac !== null && paceFrac > 0) ? paceFrac : 0.65;
  }

  vo2Fraction = Math.max(0.40, Math.min(1.20, vo2Fraction));
  const zone = classifyZone(vo2Fraction);
  const score = computeEffortScore(vo2Fraction, durationMin);
  const recHours = recoveryHoursFromScore(score, durationMin, vdot);

  return { zone, score: Math.round(score), recoveryHours: recHours, vo2Fraction, hrBased, distKm };
}

function computeRecoveryState(runs, vdot) {
  let estimatedHRmax = 0;
  for (const r of runs) {
    if (r.maxHeartRate && r.maxHeartRate > estimatedHRmax) {
      estimatedHRmax = r.maxHeartRate;
    }
  }

  const now = Date.now();
  const lookbackMs = 4 * 24 * 60 * 60 * 1000;
  const recentRuns = runs
    .filter(r => {
      const t = new Date(r.startTime || r.startDate).getTime();
      return !isNaN(t) && (now - t) < lookbackMs;
    })
    .sort((a, b) => new Date(b.startTime || b.startDate) - new Date(a.startTime || a.startDate));

  if (recentRuns.length === 0) {
    return { recoveryHoursLeft: 0, runDetails: [], hasData: runs.length > 0 };
  }

  let maxRemainingHours = 0;
  const runDetails = [];

  for (const run of recentRuns) {
    const analysis = analyzeRunRecovery(run, vdot, estimatedHRmax);
    if (!analysis) continue;

    const runTime = new Date(run.startTime || run.startDate).getTime();
    const hoursElapsed = (now - runTime) / (1000 * 60 * 60);
    const remaining = Math.max(0, analysis.recoveryHours - hoursElapsed);
    const recoveryPct = analysis.recoveryHours > 0
      ? Math.min(100, Math.round((hoursElapsed / analysis.recoveryHours) * 100))
      : 100;

    if (remaining > maxRemainingHours) maxRemainingHours = remaining;

    runDetails.push({
      name: run.name || 'Run',
      distKm: analysis.distKm,
      date: new Date(run.startTime || run.startDate),
      score: analysis.score,
      zone: analysis.zone,
      recoveryHours: Math.round(analysis.recoveryHours),
      recoveryPct,
      hrBased: analysis.hrBased,
    });
  }

  let totalHours = maxRemainingHours;
  for (const rd of runDetails) {
    const runTime = rd.date.getTime();
    const elapsed = (now - runTime) / (1000 * 60 * 60);
    const rem = Math.max(0, rd.recoveryHours - elapsed);
    if (rem < maxRemainingHours) totalHours += rem * 0.20;
  }
  totalHours = Math.min(96, Math.round(totalHours));

  return { recoveryHoursLeft: totalHours, runDetails: runDetails.slice(0, 5), hasData: true };
}

function getRank(vdot) {
  if (vdot >= 70) return { key: 'diamond', color: '#8b5cf6', min: 70, max: 80 };
  if (vdot >= 60) return { key: 'platinum', color: '#0ea5e9', min: 60, max: 70 };
  if (vdot >= 50) return { key: 'gold', color: '#eab308', min: 50, max: 60 };
  if (vdot >= 40) return { key: 'silver', color: '#94a3b8', min: 40, max: 50 };
  if (vdot >= 30) return { key: 'bronze', color: '#b45309', min: 30, max: 40 };
  return { key: 'starter', color: '#64748b', min: 20, max: 30 };
}

function getAcwrZone(acwr) {
  if (acwr == null) return { key: 'no_data', color: '#64748b', bg: '#f1f5f9' };
  if (acwr < 0.8) return { key: 'under', color: '#0ea5e9', bg: '#e0f2fe' };
  if (acwr <= 1.3) return { key: 'optimal', color: '#16a34a', bg: '#dcfce7' };
  if (acwr <= 1.5) return { key: 'warning', color: '#f59e0b', bg: '#fef3c7' };
  return { key: 'danger', color: '#ef4444', bg: '#fee2e2' };
}

/** Chart.js inline plugin — draws colored ACWR zone bands */
const acwrZoneBandsPlugin = {
  id: 'acwrZoneBands',
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.y) return;
    const { left, right, top, bottom } = chartArea;
    const yScale = scales.y;
    const bands = [
      { min: 0, max: 0.8, color: 'rgba(14, 165, 233, 0.07)' },
      { min: 0.8, max: 1.3, color: 'rgba(22, 163, 74, 0.07)' },
      { min: 1.3, max: 1.5, color: 'rgba(245, 158, 11, 0.07)' },
      { min: 1.5, max: 3.0, color: 'rgba(239, 68, 68, 0.07)' },
    ];
    for (const b of bands) {
      const pxTop = yScale.getPixelForValue(Math.min(b.max, yScale.max));
      const pxBot = yScale.getPixelForValue(Math.max(b.min, yScale.min));
      if (pxBot <= top || pxTop >= bottom) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(left, Math.max(top, pxTop), right - left, Math.min(bottom, pxBot) - Math.max(top, pxTop));
    }
  },
};

export default function Analysis() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { theme, setTheme, isDark } = useTheme();
  const { unit, isMile } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);

  // Modals
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [garminFiles, setGarminFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadData();
  }, [isAuthenticated]);

  async function loadData() {
    try {
      const [profileData, activitiesData] = await Promise.all([
        apiJson('/api/profile/me'),
        apiJson('/api/activities'),
      ]);
      setProfile(profileData);
      const list = Array.isArray(activitiesData) ? activitiesData : [];
      list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      setRuns(list);
    } catch { /* ignored */ }
  }

  // VDOT calculation from runs
  const { bestVdot, bestRun, allVdots } = useMemo(() => {
    let best = 0, bestR = null;
    const vdots = [];
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;

    runs.forEach(run => {
      const km = Number(run.distanceKm || 0);
      const sec = Number(run.movingTimeSeconds || 0);
      if (km < 1.5 || sec <= 0) return;

      const distM = km * 1000;
      const timeMin = sec / 60;
      const v = calculateVdot(distM, timeMin);
      if (v <= 0 || v > 85) return;

      const runDate = new Date(run.startTime || run.startDate || 0);
      vdots.push({ vdot: v, date: runDate, run });

      if ((now - runDate.getTime()) <= ninetyDays && v > best) {
        best = v;
        bestR = run;
      }
    });

    return { bestVdot: best, bestRun: bestR, allVdots: vdots };
  }, [runs]);

  // Training paces
  const paces = useMemo(() => {
    if (bestVdot <= 0) return null;
    return computeTrainingPaces(bestVdot);
  }, [bestVdot]);

  // Race predictions
  const predictions = useMemo(() => {
    if (bestVdot <= 0) return [];
    return RACE_DISTANCES.map(rd => {
      const timeMin = predictRaceTime(bestVdot, rd.meters);
      return { ...rd, timeMin };
    });
  }, [bestVdot]);

  // Summary stats
  const { totalKm, totalSec } = useMemo(() => {
    let km = 0, sec = 0;
    runs.forEach(r => { km += Number(r.distanceKm || 0); sec += Number(r.movingTimeSeconds || 0); });
    return { totalKm: km, totalSec: sec };
  }, [runs]);

  // Recovery state (matches old analysis.html logic)
  const recoveryState = useMemo(() => {
    return computeRecoveryState(runs, bestVdot);
  }, [runs, bestVdot]);

  const recoveryColor = useMemo(() => {
    const h = recoveryState.recoveryHoursLeft;
    if (h <= 0) return '#166534';
    if (h <= 18) return '#15803d';
    if (h <= 48) return '#ca8a04';
    if (h <= 72) return '#ea580c';
    return '#dc2626';
  }, [recoveryState.recoveryHoursLeft]);

  const recoveryStatusKey = useMemo(() => {
    const h = recoveryState.recoveryHoursLeft;
    if (h <= 0) return 'analysis.fully_recovered';
    if (h <= 18) return 'analysis.recovery_short';
    if (h <= 48) return 'analysis.recovery_moderate';
    if (h <= 72) return 'analysis.recovery_long';
    return 'analysis.recovery_extreme';
  }, [recoveryState.recoveryHoursLeft]);

  // Rank
  const rank = useMemo(() => bestVdot > 0 ? getRank(bestVdot) : null, [bestVdot]);

  // Run level: Lv. X within the rank tier (1-10)
  const { runLevel, progressPoints, pointsToNext, rankPct } = useMemo(() => {
    if (!rank) return { runLevel: 0, progressPoints: 0, pointsToNext: 100, rankPct: 0 };
    const progress = Math.max(0, Math.min(10, bestVdot - rank.min));
    const remaining = Math.max(0, 10 - progress);
    let lv = Math.floor(progress) + 1;
    if (lv > 10) lv = 10;
    if (lv < 1) lv = 1;
    return { runLevel: lv, progressPoints: progress, pointsToNext: remaining, rankPct: Math.round((progress / 10) * 100) };
  }, [bestVdot, rank]);

  // Format pace helper
  function fmtPace(secPerKm) {
    if (secPerKm == null) return '--:--';
    const val = unit === 'mile' ? secPerKm * KM_TO_MILE : secPerKm;
    return formatPaceSeconds(val);
  }

  // Pace chart data
  const paceChartData = useMemo(() => {
    if (!paces) return null;
    const labels = [
      t('analysis.chart_zone_easy'),
      t('analysis.chart_zone_marathon'),
      t('analysis.chart_zone_threshold'),
      t('analysis.chart_zone_interval'),
      t('analysis.chart_zone_repetition'),
    ];
    const values = [
      paces.easy[0],
      paces.marathon[0],
      paces.threshold[0],
      paces.interval[0],
      paces.repetition[0],
    ].map(v => v != null ? (unit === 'mile' ? v * KM_TO_MILE : v) : 0);

    return {
      labels,
      datasets: [{
        label: t('analysis.chart_label_pace'),
        data: values,
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#dc2626'],
        borderRadius: 4,
      }],
    };
  }, [paces, unit, t]);

  // Progress chart data — scatter + rolling peak line (two datasets)
  const progressChartData = useMemo(() => {
    if (!allVdots.length) return null;
    const sorted = [...allVdots].sort((a, b) => a.date - b.date);

    const scatterData = sorted.map(v => ({ x: v.date.getTime(), y: Math.round(v.vdot * 10) / 10 }));

    const windowMs = 90 * 24 * 60 * 60 * 1000;
    const peakData = sorted.map(run => {
      const windowStart = run.date.getTime() - windowMs;
      let peak = 0;
      for (const r of sorted) {
        if (r.date.getTime() > run.date.getTime()) break;
        if (r.date.getTime() >= windowStart && r.vdot > peak) peak = r.vdot;
      }
      return { x: run.date.getTime(), y: Math.round(peak * 10) / 10 };
    });

    return {
      datasets: [
        {
          label: t('analysis.progress_all_runs') || 'All Runs',
          data: scatterData,
          backgroundColor: 'rgba(255, 107, 44, 0.3)',
          borderColor: 'rgba(255, 107, 44, 0.5)',
          pointRadius: 4,
          pointHoverRadius: 7,
          showLine: false,
          order: 2,
        },
        {
          label: t('analysis.progress_fitness') || '90-Day Peak',
          data: peakData,
          type: 'line',
          borderColor: '#ea4f1f',
          backgroundColor: 'rgba(234, 79, 31, 0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.3,
          order: 1,
        },
      ],
    };
  }, [allVdots, t]);

  // Prediction history chart — predicted times over time based on rolling 90-day peak VDOT
  const predictionHistoryData = useMemo(() => {
    if (!allVdots.length || allVdots.length < 3) return null;
    const sorted = [...allVdots].sort((a, b) => a.date - b.date);
    const windowMs = 90 * 24 * 60 * 60 * 1000;

    // Sample monthly to keep chart clean
    const samples = [];
    let lastMonth = -1;
    sorted.forEach(run => {
      const m = run.date.getFullYear() * 12 + run.date.getMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        // Compute 90-day peak VDOT at this point
        const cutoff = run.date.getTime() - windowMs;
        let peak = 0;
        for (const r of sorted) {
          if (r.date.getTime() > run.date.getTime()) break;
          if (r.date.getTime() >= cutoff && r.vdot > peak) peak = r.vdot;
        }
        if (peak > 0) samples.push({ date: run.date.getTime(), vdot: peak });
      }
    });
    // Always include latest point
    const lastRun = sorted[sorted.length - 1];
    const lastCutoff = lastRun.date.getTime() - windowMs;
    let lastPeak = 0;
    for (const r of sorted) {
      if (r.date.getTime() >= lastCutoff && r.vdot > lastPeak) lastPeak = r.vdot;
    }
    if (lastPeak > 0 && (samples.length === 0 || samples[samples.length - 1].date !== lastRun.date.getTime())) {
      samples.push({ date: lastRun.date.getTime(), vdot: lastPeak });
    }

    if (samples.length < 2) return null;

    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#dc2626'];
    return RACE_DISTANCES.map((rd, i) => {
      const data = samples.map(s => {
        const timeMin = predictRaceTime(s.vdot, rd.meters);
        return { x: s.date, y: timeMin ? Math.round(timeMin * 60) : null };
      });
      const latest = data[data.length - 1]?.y || 0;
      const earliest = data[0]?.y || 0;
      const improved = earliest > 0 && latest > 0 && latest < earliest;
      const diffSec = earliest - latest;
      return {
        key: rd.key,
        label: lang === 'en' ? rd.labelEn : rd.labelZh,
        color: colors[i],
        latestFormatted: latest > 0 ? formatDuration(latest) : '--',
        improved,
        diffFormatted: diffSec > 0 ? formatDuration(Math.abs(diffSec)) : null,
        chartData: {
          datasets: [{
            data,
            borderColor: colors[i],
            backgroundColor: colors[i] + '25',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: colors[i],
            pointHoverRadius: 7,
            tension: 0.35,
            fill: true,
          }],
        },
      };
    });
  }, [allVdots, lang]);

  // ── Training Load (EWMA) & ACWR ──
  const trainingLoadData = useMemo(() => {
    if (runs.length < 3) return null;

    let estimatedHRmax = 0;
    for (const r of runs) {
      if (r.maxHeartRate && r.maxHeartRate > estimatedHRmax) estimatedHRmax = r.maxHeartRate;
    }

    // Build daily load map (sum effort scores per day)
    const dailyLoads = {};
    runs.forEach(run => {
      const date = new Date(run.startTime || run.startDate);
      if (isNaN(date.getTime())) return;
      const dateKey = date.toISOString().split('T')[0];

      const durationMin = (run.movingTimeSeconds || 0) / 60;
      if (durationMin <= 0) return;

      const distKm = run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0);
      const paceSecPerKm = distKm > 0 ? (run.movingTimeSeconds / distKm) : 0;

      let vo2Frac;
      const avgHr = run.averageHeartRate;
      if (avgHr > 0 && estimatedHRmax > 100) {
        const hrFrac = hrToVo2Fraction(avgHr, estimatedHRmax);
        if (hrFrac !== null && hrFrac > 0) vo2Frac = hrFrac;
      }
      if (!vo2Frac) {
        const paceFrac = paceToVo2Fraction(paceSecPerKm, bestVdot);
        vo2Frac = (paceFrac && paceFrac > 0) ? paceFrac : 0.65;
      }
      vo2Frac = Math.max(0.40, Math.min(1.20, vo2Frac));

      const score = computeEffortScore(vo2Frac, durationMin);
      dailyLoads[dateKey] = (dailyLoads[dateKey] || 0) + score;
    });

    const dateKeys = Object.keys(dailyLoads).sort();
    if (dateKeys.length === 0) return null;

    // Complete date range from first activity to today
    const start = new Date(dateKeys[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(0, 0, 0, 0);

    const allDates = [];
    const d = new Date(start);
    while (d <= end) {
      allDates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    if (allDates.length < 7) return null;

    // EWMA: λ_acute = 2/(7+1) = 0.25, λ_chronic = 2/(28+1) ≈ 0.069
    const lambdaA = 2 / 8;
    const lambdaC = 2 / 29;

    let ewmaA = dailyLoads[allDates[0]] || 0;
    let ewmaC = ewmaA;

    const acute = [], chronic = [], acwr = [];

    for (let i = 0; i < allDates.length; i++) {
      const load = dailyLoads[allDates[i]] || 0;
      if (i === 0) { ewmaA = load; ewmaC = load; }
      else {
        ewmaA = load * lambdaA + (1 - lambdaA) * ewmaA;
        ewmaC = load * lambdaC + (1 - lambdaC) * ewmaC;
      }

      const ts = new Date(allDates[i]).getTime();
      acute.push({ x: ts, y: Math.round(ewmaA * 10) / 10 });
      chronic.push({ x: ts, y: Math.round(ewmaC * 10) / 10 });

      const ratio = ewmaC > 0.5 ? ewmaA / ewmaC : null;
      acwr.push({ x: ts, y: ratio !== null ? Math.round(ratio * 100) / 100 : null });
    }

    return {
      acute, chronic,
      acwr: acwr.filter(p => p.y !== null),
      lastAcute: acute[acute.length - 1]?.y || 0,
      lastChronic: chronic[chronic.length - 1]?.y || 0,
      lastAcwr: acwr[acwr.length - 1]?.y ?? null,
    };
  }, [runs, bestVdot]);

  const acwrZone = useMemo(() => {
    if (!trainingLoadData) return getAcwrZone(null);
    return getAcwrZone(trainingLoadData.lastAcwr);
  }, [trainingLoadData]);

  const loadChartData = useMemo(() => {
    if (!trainingLoadData) return null;
    return {
      datasets: [
        {
          label: t('analysis.tl_acute'),
          data: trainingLoadData.acute,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          fill: true, tension: 0.3,
        },
        {
          label: t('analysis.tl_chronic'),
          data: trainingLoadData.chronic,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          fill: true, tension: 0.3,
        },
      ],
    };
  }, [trainingLoadData, t]);

  const acwrChartData = useMemo(() => {
    if (!trainingLoadData) return null;
    return {
      datasets: [{
        label: 'ACWR',
        data: trainingLoadData.acwr,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
        fill: true, tension: 0.3,
      }],
    };
  }, [trainingLoadData]);

  // Import handler
  async function handleImport(e) {
    e.preventDefault();
    const formData = new FormData();
    if (garminFiles) for (const f of garminFiles) formData.append('garmins', f);
    if (corosFiles) for (const f of corosFiles) formData.append('coros', f);
    if (huaweiFiles) for (const f of huaweiFiles) formData.append('huawei', f);
    try {
      await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      setImportModalOpen(false);
      loadData();
    } catch { /* ignored */ }
  }

  async function handleSaveName(e) {
    e.preventDefault();
    try {
      await apiFetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayNameInput }),
      });
      setProfile(prev => ({ ...prev, displayName: displayNameInput }));
      setNameModalOpen(false);
    } catch { /* ignored */ }
  }

  const textColor = isDark ? '#e2e8f0' : '#1a2b4c';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  // Doughnut chart for run level
  const doughnutData = useMemo(() => ({
    datasets: [{
      data: rank ? [progressPoints, pointsToNext] : [0, 100],
      backgroundColor: rank ? [rank.color, '#e2e8f0'] : ['#1A2B4C', '#e2e8f0'],
      borderWidth: 0,
    }],
  }), [rank, progressPoints, pointsToNext]);

  const doughnutOptions = useMemo(() => ({
    cutout: '85%',
    plugins: { tooltip: { enabled: false }, legend: { display: false } },
    animation: { animateScale: true },
  }), []);

  return (
    <div className="dashboard-body">
      <LanguageSwitcher />
      <TopNav
        showProfile
        profile={{
          displayName: profile?.displayName,
          email: profile?.email,
          onSettings: () => setSettingsModalOpen(true),
          onChangeName: () => { setDisplayNameInput(profile?.displayName || ''); setNameModalOpen(true); },
          onImportData: () => setImportModalOpen(true),
        }}
        backLink={{ to: '/profile', label: 'HERMES' }}
      />

      <main className="dashboard-container analysis-container">
        {/* Page Header */}
        <section className="analysis-page-header">
          <Link to="/profile" className="analysis-back-link">
            <span className="analysis-back-icon">&lsaquo;</span>
            <span>{t('analysis.back_to_profile')}</span>
          </Link>
          <h1 className="analysis-title">{t('analysis.heading')}</h1>
        </section>

        {/* Run Level — Doughnut Chart */}
        <section className="card analysis-card-center">
          <h3>{t('analysis.run_level')}</h3>
          <div className="analysis-chart-shell analysis-chart-shell-large" style={{ width: 180, margin: '15px auto' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
          {rank ? (
            <>
              <p className="analysis-level-copy" style={{ color: rank.color, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', margin: '8px 0 0' }}>
                {t(`analysis.rank_${rank.key}`)} Lv. {runLevel}
              </p>
              <p style={{ color: '#666', fontSize: '0.85rem', marginTop: 5, textAlign: 'center' }}>{t('analysis.next_rank_progress', { percent: rankPct })}</p>
            </>
          ) : (
            <>
              <p className="analysis-level-copy" style={{ color: textColor, textAlign: 'center' }}>{t('analysis.run_level_waiting')}</p>
              <p style={{ color: '#666', fontSize: '0.85rem', marginTop: 5, textAlign: 'center' }}>{t('analysis.run_level_prompt')}</p>
            </>
          )}
        </section>

        {/* Summary */}
        <section className="card summary-wide analysis-summary-card">
          <div className="analysis-summary-row">
            <div className="analysis-summary-copy">
              <p><strong>{t('analysis.weekly_mileage')}</strong> <span>{isMile ? (totalKm / KM_TO_MILE).toFixed(1) : totalKm.toFixed(1)}</span> <span className="unit-text">{t(isMile ? 'analysis.unit_distance_mile' : 'analysis.unit_distance_km')}</span></p>
              <p><strong>{t('analysis.avg_pace')}</strong> <span>{totalKm > 0 ? fmtPace(totalSec / totalKm) : '--:--'}</span> <span className="unit-pace">{t(isMile ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km')}</span></p>
              <p><strong>{t('analysis.current_vdot_label')}</strong> <span>{bestVdot > 0 ? bestVdot.toFixed(1) : '--'}</span></p>
            </div>
          </div>
        </section>

        {/* VDOT Card */}
        <section className="card analysis-vdot-card">
          <div className="analysis-vdot-header">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('analysis.vdot_auto_heading')}</h2>
              <p className="analysis-vdot-copy analysis-muted">{t('analysis.vdot_auto_copy')}</p>
            </div>
            {bestVdot > 0 && (
              <div className="vdot-badge vdot-badge-large">{t('analysis.vdot_prefix')} {bestVdot.toFixed(1)}</div>
            )}
          </div>
          {bestRun && (
            <div className="vdot-best-effort">
              <strong>{bestRun.name || 'Run'}</strong> &mdash; {(bestRun.distanceKm || 0).toFixed(2)} km in {formatDuration(bestRun.movingTimeSeconds)}
            </div>
          )}
          {bestVdot <= 0 && <div className="vdot-no-data">{t('analysis.vdot_no_data')}</div>}

          {paceChartData && (
            <div style={{ marginTop: 20, height: 200 }}>
              <Bar data={paceChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${formatPaceSeconds(ctx.parsed.y)} ${t(isMile ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km')}`,
                    },
                  },
                },
                scales: {
                  y: {
                    reverse: true,
                    ticks: { color: textColor, callback: (value) => formatPaceSeconds(value) },
                    grid: { color: gridColor },
                  },
                  x: { ticks: { color: textColor }, grid: { display: false } },
                },
              }} />
            </div>
          )}
        </section>

        {/* Progress Chart — Scatter + Line */}
        <section className="card progress-card" style={{ marginTop: 25 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('analysis.progress_heading')}</h2>
          <p className="analysis-muted" style={{ marginTop: 6 }}>{t('analysis.progress_copy')}</p>
          <div className="progress-chart-shell" style={{ position: 'relative', height: 280, marginTop: 18 }}>
            {progressChartData ? (
              <Scatter data={progressChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16, color: textColor } },
                  tooltip: {
                    callbacks: {
                      title: (items) => {
                        if (!items.length) return '';
                        const d = new Date(items[0].parsed.x);
                        return d.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
                      },
                      label: (ctx) => `VDOT: ${ctx.parsed.y.toFixed(1)}`,
                    },
                  },
                },
                scales: {
                  x: {
                    type: 'linear',
                    grid: { display: false },
                    ticks: {
                      color: textColor,
                      maxTicksLimit: 8,
                      callback: (value) => {
                        const d = new Date(value);
                        return d.toLocaleDateString(lang, { month: 'short', year: '2-digit' });
                      },
                    },
                  },
                  y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    title: { display: true, text: 'VDOT', color: textColor },
                  },
                },
              }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                {t('analysis.vdot_no_data')}
              </div>
            )}
          </div>
        </section>

        {/* Recovery + Training Paces side by side */}
        <div className="analysis-grid" style={{ marginTop: 24 }}>
          <section className="card">
              <h3 style={{ margin: '0 0 10px' }}>{t('analysis.recovery')}</h3>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.1, color: recoveryState.hasData ? recoveryColor : '#64748b' }}>
                  {recoveryState.hasData ? (recoveryState.recoveryHoursLeft <= 0 ? '0h' : recoveryState.recoveryHoursLeft + 'h') : '--'}
                </div>
                <div style={{ fontSize: '0.82rem', marginTop: 4, color: 'var(--text-muted, #64748b)' }}>
                  {recoveryState.hasData ? t(recoveryStatusKey) : t('analysis.recovery_no_data')}
                </div>
              </div>
              <div style={{ background: 'var(--border-color, #e2e8f0)', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{
                  height: '100%', borderRadius: 6, transition: 'width 0.6s ease',
                  width: `${Math.min(100, Math.round((recoveryState.recoveryHoursLeft / 96) * 100))}%`,
                  background: recoveryColor,
                }} />
              </div>

              {/* Per-run recovery breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recoveryState.runDetails.map((rd, i) => {
                  const dist = isMile ? (rd.distKm * (1 / KM_TO_MILE)).toFixed(2) + ' mi' : rd.distKm.toFixed(2) + ' km';
                  const dateStr = rd.date.toLocaleDateString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const zoneLabel = lang === 'en' ? rd.zone.labelEn : rd.zone.labelZh;
                  const barColor = rd.recoveryPct >= 100 ? '#166534' : rd.recoveryPct >= 60 ? '#ca8a04' : '#ea580c';
                  const hrTag = rd.hrBased ? ' ♥' : '';
                  return (
                    <div key={i} style={{ borderLeft: `3px solid ${rd.zone.color}`, paddingLeft: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-strong, #1e293b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{rd.name}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: rd.zone.color, whiteSpace: 'nowrap' }}>{rd.score} · {zoneLabel}{hrTag}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: 'var(--text-muted, #94a3b8)', marginBottom: 4 }}>
                        <span>{dist} · {dateStr}</span>
                        <span>{rd.recoveryHours}h → {rd.recoveryPct}%</span>
                      </div>
                      <div style={{ background: 'var(--border-color, #e2e8f0)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, rd.recoveryPct)}%`, background: barColor, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          </section>

          <section className="card">
          <h3>
            <span>{t('analysis.pace_zones')}</span>
            <span className="pace-unit-note" style={{ marginLeft: 8 }}>({t(isMile ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km')})</span>
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 15 }}>
            <tbody>
              {[
                { key: 'easy', label: t('analysis.pace_easy_label'), color: '#22c55e', range: paces?.easy },
                { key: 'marathon', label: t('analysis.pace_marathon_label'), color: '#3b82f6', range: paces?.marathon },
                { key: 'threshold', label: t('analysis.pace_threshold_label'), color: '#f59e0b', range: paces?.threshold },
                { key: 'interval', label: t('analysis.pace_interval_label'), color: '#ef4444', range: paces?.interval },
                { key: 'repetition', label: t('analysis.pace_repetition_label'), color: '#dc2626', range: paces?.repetition },
              ].map(({ key, label, color, range }) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--border-color, #eee)' }}>
                  <td style={{ padding: '12px 0', borderLeft: `4px solid ${color}`, paddingLeft: 12, color, fontWeight: 600 }}>{label}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color }}>
                    {range ? (range.length === 2 ? `${fmtPace(range[0])} - ${fmtPace(range[1])}` : fmtPace(range[0])) : '--:--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </section>
        </div>

        {/* Race Predictions */}
        {predictions.length > 0 && (
          <section className="card" style={{ marginTop: 25 }}>
            <h3 style={{ margin: '0 0 4px' }}>{t('analysis.race_predictions')}</h3>
            <p className="analysis-muted" style={{ margin: '0 0 15px', fontSize: '0.85rem' }}>{t('analysis.race_predictions_copy')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {predictions.map(p => {
                const totalSec = p.timeMin ? Math.round(p.timeMin * 60) : 0;
                const paceSecPerKm = totalSec > 0 ? (totalSec / p.meters) * 1000 : 0;
                const paceDisplay = paceSecPerKm > 0 ? formatPaceSeconds(isMile ? paceSecPerKm * KM_TO_MILE : paceSecPerKm) : '--:--';
                return (
                  <div key={p.key} style={{ background: 'var(--card-bg, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', marginBottom: 6 }}>
                      {lang === 'en' ? p.labelEn : p.labelZh}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-strong, #1e293b)' }}>
                      {p.timeMin ? formatDuration(p.timeMin * 60) : '--'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginTop: 4 }}>
                      {paceDisplay} {t(isMile ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km')}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Prediction History — 4 mini charts */}
        {predictionHistoryData && predictionHistoryData.length > 0 && (
          <section className="card" style={{ marginTop: 25 }}>
            <h3 style={{ margin: '0 0 4px' }}>{t('analysis.pred_history_heading')}</h3>
            <p className="analysis-muted" style={{ margin: '0 0 20px', fontSize: '0.85rem' }}>{t('analysis.pred_history_copy')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
              {predictionHistoryData.map(item => (
                <div key={item.key} onClick={() => navigate(`/prediction/${item.key}`)} style={{ border: `2px solid ${item.color}22`, borderRadius: 14, padding: '18px 16px 12px', background: `${item.color}08`, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${item.color}30`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: item.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-strong, #1e293b)', marginTop: 2 }}>{item.latestFormatted}</div>
                    </div>
                    {item.diffFormatted && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.78rem', color: item.improved ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                          {item.improved ? '\u25BC' : '\u25B2'} {item.diffFormatted}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>{t('analysis.pred_history_since_start')}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ height: 120 }}>
                    <Line data={item.chartData} options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            title: (items) => {
                              if (!items.length) return '';
                              return new Date(items[0].parsed.x).toLocaleDateString(lang, { year: 'numeric', month: 'short' });
                            },
                            label: (ctx) => ctx.parsed.y ? formatDuration(ctx.parsed.y) : '--',
                          },
                        },
                      },
                      scales: {
                        x: {
                          type: 'linear',
                          display: false,
                        },
                        y: {
                          reverse: true,
                          grid: { color: gridColor, drawBorder: false },
                          ticks: {
                            color: textColor,
                            font: { size: 10 },
                            maxTicksLimit: 4,
                            callback: (v) => formatDuration(v),
                          },
                        },
                      },
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Training Load & ACWR */}
        {trainingLoadData && loadChartData && acwrChartData && (
          <section className="card training-load-card" style={{ marginTop: 25 }}>
            <div className="tl-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('analysis.tl_heading')}</h2>
                <p className="analysis-muted" style={{ marginTop: 6 }}>{t('analysis.tl_copy')}</p>
              </div>
            </div>

            {/* Current stats row */}
            <div className="tl-stats-row">
              <div className="tl-stat">
                <span className="tl-stat-label">{t('analysis.tl_acute')}</span>
                <span className="tl-stat-value" style={{ color: '#ef4444' }}>{trainingLoadData.lastAcute.toFixed(0)}</span>
                <span className="tl-stat-sub">{t('analysis.tl_7day')}</span>
              </div>
              <div className="tl-stat">
                <span className="tl-stat-label">{t('analysis.tl_chronic')}</span>
                <span className="tl-stat-value" style={{ color: '#3b82f6' }}>{trainingLoadData.lastChronic.toFixed(0)}</span>
                <span className="tl-stat-sub">{t('analysis.tl_28day')}</span>
              </div>
              <div className="tl-stat">
                <span className="tl-stat-label">ACWR</span>
                <span className="tl-stat-value" style={{ color: acwrZone.color }}>
                  {trainingLoadData.lastAcwr != null ? trainingLoadData.lastAcwr.toFixed(2) : '--'}
                </span>
                <span className="tl-stat-zone" style={{ color: acwrZone.color, background: acwrZone.bg }}>
                  {t(`analysis.acwr_${acwrZone.key}`)}
                </span>
              </div>
            </div>

            {/* Acute vs Chronic load chart */}
            <div style={{ position: 'relative', height: 250, marginTop: 18 }}>
              <Line data={loadChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16, color: textColor } },
                  tooltip: {
                    callbacks: {
                      title: (items) => {
                        if (!items.length) return '';
                        return new Date(items[0].parsed.x).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
                      },
                      label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`,
                    },
                  },
                },
                scales: {
                  x: {
                    type: 'linear', grid: { display: false },
                    ticks: { color: textColor, maxTicksLimit: 8, callback: v => new Date(v).toLocaleDateString(lang, { month: 'short', day: 'numeric' }) },
                  },
                  y: {
                    grid: { color: gridColor }, ticks: { color: textColor },
                    title: { display: true, text: t('analysis.tl_load_axis'), color: textColor },
                  },
                },
              }} />
            </div>

            {/* ACWR ratio sub-section */}
            <h3 style={{ margin: '24px 0 0', fontSize: '1rem' }}>{t('analysis.acwr_heading')}</h3>
            <p className="analysis-muted" style={{ marginTop: 4, marginBottom: 0 }}>{t('analysis.acwr_copy')}</p>

            <div style={{ position: 'relative', height: 180, marginTop: 12 }}>
              <Line data={acwrChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      title: (items) => {
                        if (!items.length) return '';
                        return new Date(items[0].parsed.x).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
                      },
                      label: (ctx) => `ACWR: ${ctx.parsed.y.toFixed(2)}`,
                    },
                  },
                },
                scales: {
                  x: {
                    type: 'linear', grid: { display: false },
                    ticks: { color: textColor, maxTicksLimit: 8, callback: v => new Date(v).toLocaleDateString(lang, { month: 'short', day: 'numeric' }) },
                  },
                  y: {
                    grid: { color: gridColor }, ticks: { color: textColor },
                    title: { display: true, text: 'ACWR', color: textColor },
                    suggestedMin: 0, suggestedMax: 2.0,
                  },
                },
              }} plugins={[acwrZoneBandsPlugin]} />
            </div>

            {/* Zone legend */}
            <div className="acwr-zone-legend">
              <span style={{ color: '#0ea5e9' }}>{'\u25CF'} {t('analysis.acwr_under')} (&lt;0.8)</span>
              <span style={{ color: '#16a34a' }}>{'\u25CF'} {t('analysis.acwr_optimal')} (0.8–1.3)</span>
              <span style={{ color: '#f59e0b' }}>{'\u25CF'} {t('analysis.acwr_warning')} (1.3–1.5)</span>
              <span style={{ color: '#ef4444' }}>{'\u25CF'} {t('analysis.acwr_danger')} (&gt;1.5)</span>
            </div>
          </section>
        )}
      </main>

      {/* Name Modal */}
      <Modal isOpen={nameModalOpen} onClose={() => setNameModalOpen(false)} title={t('profile.name_modal_title')}>
        <form onSubmit={handleSaveName}>
          <label className="modal-label">{t('profile.name_label')}</label>
          <input type="text" maxLength={60} placeholder={t('profile.name_placeholder')} value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} />
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setNameModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.save_name')}</button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title={t('profile.import_modal_title')}>
        <form onSubmit={handleImport}>
          <p className="modal-help">{t('profile.import_hint')}</p>
          <div className="import-source-grid">
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.garmin_source_title')}</span>
                  <span className="import-source-hint">{t('profile.garmin_source_hint')}</span>
                </div>
                <span className="import-source-tag">GARMIN</span>
              </div>
              <label className="modal-label">{t('profile.garmin_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setGarminFiles(e.target.files)} />
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.coros_source_title')}</span>
                  <span className="import-source-hint">{t('profile.coros_source_hint')}</span>
                </div>
                <span className="import-source-tag">COROS</span>
              </div>
              <label className="modal-label">{t('profile.coros_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setCorosFiles(e.target.files)} />
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.huawei_source_title')}</span>
                  <span className="import-source-hint">{t('profile.huawei_source_hint')}</span>
                </div>
                <span className="import-source-tag">HUAWEI</span>
              </div>
              <label className="modal-label">{t('profile.huawei_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setHuaweiFiles(e.target.files)} />
            </section>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setImportModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.upload_file')}</button>
          </div>
        </form>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} title={t('profile.settings_modal_title')}>
        <div className="settings-row">
          <div className="settings-copy">
            <strong>{t('profile.theme_title')}</strong>
            <p>{t('profile.theme_hint')}</p>
          </div>
          <select className="theme-select" value={theme} onChange={e => setTheme(e.target.value)}>
            <option value="light">{t('profile.theme_light')}</option>
            <option value="midnight">{t('profile.theme_midnight')}</option>
            <option value="high-contrast">{t('profile.theme_high_contrast')}</option>
            <option value="high-contrast-light">{t('profile.theme_high_contrast_light')}</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}

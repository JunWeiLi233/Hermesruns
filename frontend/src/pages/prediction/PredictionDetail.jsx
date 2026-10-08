import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchActivitySummaries } from '../../api/activityApi.ts';
import AppIcon from '../../components/AppIcon';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import AnalysisSubpageNav from '../../components/AnalysisSubpageNav';
import PageSkeleton from '../../components/PageSkeleton';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import {
  collectAllVdotEntries,
  computeRollingRepresentativeSeries,
  computeTrainingPaces,
  estimateCurrentVdot,
  predictRaceTimeCalibrated,
  RACE_DISTANCES,
  vdotToPaceSecondsPerKm,
} from '../../utils/vdot';
import { formatPaceSeconds } from '../../utils/format';
import { selectRacePrediction } from '../../utils/predictionSelection.ts';
import { hasMeaningfulWeatherTrendAdjustment } from '../../utils/predictionTrend.js';
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, ScatterController, Title, Tooltip, Legend, Filler);

const DIST_COLORS = { '5k': '#4ccd73', '10k': '#5b8cff', half: '#f4b860', marathon: '#f07561' };

const EFFORT_LEVELS = [
  { key: 'easy', vo2Fraction: 0.65, cssClass: 'is-easy' },
  { key: 'moderate', vo2Fraction: 0.75, cssClass: 'is-moderate' },
  { key: 'hard', vo2Fraction: 0.88, cssClass: 'is-hard' },
  { key: 'race', vo2Fraction: 0.98, cssClass: 'is-race' },
];

function formatPredictedTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '--';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getTargetKm(distKey) {
  if (distKey === '5k') return 5;
  if (distKey === '10k') return 10;
  if (distKey === 'half') return 21.1;
  return 42.2;
}

function getBestRecentDistanceMatch(runs, distKey) {
  const now = Date.now();
  const lookbackMs = 180 * 24 * 60 * 60 * 1000;
  const targetKm = getTargetKm(distKey);
  let best = null;
  for (const run of runs) {
    const km = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
    const sec = Number(run.movingTimeSeconds || run.durationSeconds || 0);
    const t = new Date(run.startTime || run.startDate || 0).getTime();
    if (!Number.isFinite(km) || !Number.isFinite(sec) || !Number.isFinite(t)) continue;
    if (km <= 0 || sec <= 0 || now - t > lookbackMs) continue;
    const distRatio = Math.abs(km - targetKm);
    if (best == null || distRatio < best.distRatio) {
      best = { run, km, sec, date: new Date(t), distRatio };
    }
  }
  return best;
}

function calculateConfidence({ hasVdot, hasMatch, rollingCount, usedTopN }) {
  if (!hasVdot) return 0;
  const score = 34
    + (hasMatch ? 24 : 0)
    + Math.min(24, rollingCount * 4)
    + Math.min(18, usedTopN * 6);
  return Math.max(38, Math.min(95, Math.round(score)));
}

function formatTrendDelta(deltaMinutes, t) {
  if (!Number.isFinite(deltaMinutes) || Math.abs(deltaMinutes) < 0.1) {
    return t('analysis.pred_cockpit_delta_flat');
  }
  const seconds = Math.abs(deltaMinutes) * 60;
  const value = formatPredictedTime(seconds);
  return deltaMinutes < 0
    ? t('analysis.pred_cockpit_delta_faster', { value })
    : t('analysis.pred_cockpit_delta_slower', { value });
}

export default function PredictionDetail() {
  const { distKey } = useParams();
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const distance = useMemo(() => RACE_DISTANCES.find((d) => d.key === distKey), [distKey]);
  const showConfidencePanel = distance?.key !== '5k' && distance?.key !== '10k' && distance?.key !== 'half' && distance?.key !== 'marathon';

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    (async () => {
      setLoadState('loading');
      try {
        const list = await fetchActivitySummaries();
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
        setRuns(list);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    })();
  }, [isAuthenticated, navigate]);

  const allVdotEntries = useMemo(() => collectAllVdotEntries(runs), [runs]);
  const rollingSeries = useMemo(() => computeRollingRepresentativeSeries(allVdotEntries), [allVdotEntries]);
  const currentVdot = useMemo(() => estimateCurrentVdot(runs), [runs]);
  const representativeVdot = currentVdot.representativeVdot || 0;
  const adjustedVdot = currentVdot.adjustedVdot || representativeVdot;
  const hasCurrentWeatherEvidence = currentVdot.windowEntries.some(
    (entry) => entry.adjustedVo2max - entry.vo2max > 0.05,
  );

  const rawRacePredictionMinutes = useMemo(() => {
    if (!distance || representativeVdot <= 0) return null;
    return predictRaceTimeCalibrated(representativeVdot, distance.meters, runs);
  }, [distance, representativeVdot, runs]);

  const adjustedRacePredictionMinutes = useMemo(() => {
    if (!distance || adjustedVdot <= 0) return null;
    return predictRaceTimeCalibrated(adjustedVdot, distance.meters, runs, { weatherAdjustedAnchors: true });
  }, [adjustedVdot, distance, runs]);

  const predictionSelection = useMemo(() => selectRacePrediction({
    representativeVdot,
    adjustedVdot,
    rawPredictionMinutes: rawRacePredictionMinutes,
    adjustedPredictionMinutes: adjustedRacePredictionMinutes,
    hasWeatherEvidence: hasCurrentWeatherEvidence,
  }), [
    adjustedRacePredictionMinutes,
    adjustedVdot,
    hasCurrentWeatherEvidence,
    rawRacePredictionMinutes,
    representativeVdot,
  ]);
  const useWeatherAdjustedPrediction = predictionSelection.useWeatherAdjusted;
  const forecastVdot = predictionSelection.forecastVdot;
  const racePredictionMinutes = predictionSelection.predictionMinutes;
  const trainingPaces = useMemo(() => computeTrainingPaces(forecastVdot), [forecastVdot]);

  const effortPredictions = useMemo(() => {
    if (!distance || forecastVdot <= 0) return [];
    return EFFORT_LEVELS.map((level) => {
      const paceSecPerKm = vdotToPaceSecondsPerKm(forecastVdot, level.vo2Fraction);
      const totalSeconds = paceSecPerKm != null ? (paceSecPerKm * (distance.meters / 1000)) : null;
      return {
        ...level,
        label: t(`analysis.pred_effort_${level.key}`),
        timeDisplay: formatPredictedTime(totalSeconds),
        paceDisplay: paceSecPerKm != null ? formatPaceSeconds(paceSecPerKm) : '--',
        fill: Math.max(18, Math.min(100, Math.round(level.vo2Fraction * 100))),
      };
    });
  }, [distance, forecastVdot, t]);

  const confidenceBasis = useMemo(() => {
    if (!distance) return null;
    const bestMatch = getBestRecentDistanceMatch(runs, distance.key);
    if (!bestMatch) return null;
    const displayDate = bestMatch.date.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    const displayKm = bestMatch.km.toFixed(1);
    const displayPace = formatPaceSeconds(bestMatch.sec / bestMatch.km);
    return {
      date: displayDate,
      km: displayKm,
      pace: displayPace,
      name: bestMatch.run.name || t('analysis.pred_cockpit_recent_run'),
    };
  }, [distance, runs, lang, t]);

  const confidenceScore = useMemo(() => calculateConfidence({
    hasVdot: forecastVdot > 0,
    hasMatch: Boolean(confidenceBasis),
    rollingCount: rollingSeries.length,
    usedTopN: currentVdot.usedTopN || 0,
  }), [forecastVdot, confidenceBasis, rollingSeries.length, currentVdot.usedTopN]);

  const coachRecommendation = useMemo(() => {
    if (!distance || forecastVdot <= 0) return t('analysis.pred_coach_empty');
    const racePace = effortPredictions.find((effort) => effort.key === 'race');
    const easyPaces = trainingPaces.easy || [];
    const easyLower = easyPaces[0] != null ? formatPaceSeconds(easyPaces[0]) : '--';
    const easyUpper = easyPaces[1] != null ? formatPaceSeconds(easyPaces[1]) : '--';
    const racePaceDisplay = racePace?.paceDisplay || '--';
    const distanceLabel = lang === 'zh-CN' ? distance.labelZh : distance.labelEn;

    if (distance.key === 'marathon') {
      return t('analysis.pred_coach_marathon', { easyLower, easyUpper, distance: distanceLabel });
    }
    if (distance.key === 'half') {
      return t('analysis.pred_coach_half', { racePace: racePaceDisplay });
    }
    if (distance.key === '10k') {
      return t('analysis.pred_coach_10k', { racePace: racePaceDisplay });
    }
    return t('analysis.pred_coach_5k', { racePace: racePaceDisplay });
  }, [distance, forecastVdot, effortPredictions, trainingPaces, lang, t]);

  const trendPredictions = useMemo(() => {
    if (!distance || !rollingSeries.length) return [];
    return rollingSeries
      .map((point) => {
        const raw = predictRaceTimeCalibrated(point.y, distance.meters, runs);
        const adjustedPointVdot = point.adjustedY || point.y;
        const adjusted = predictRaceTimeCalibrated(adjustedPointVdot, distance.meters, runs, { weatherAdjustedAnchors: true });
        return {
          date: point.date,
          raw,
          adjusted,
          hasAdjustment: hasMeaningfulWeatherTrendAdjustment({
            rawVdot: point.y,
            adjustedVdot: adjustedPointVdot,
            rawMinutes: raw,
            adjustedMinutes: adjusted,
          }),
        };
      })
      .filter((point) => Number.isFinite(point.raw) && point.raw > 0);
  }, [distance, rollingSeries, runs]);

  const hasWeatherTrend = trendPredictions.some((point) => point.hasAdjustment);

  const chartData = useMemo(() => {
    if (!trendPredictions.length) return null;
    const labels = trendPredictions.map((point) => new Date(point.date).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }));

    return {
      labels,
      datasets: [
        {
          label: t('analysis.vdot_raw'),
          data: trendPredictions.map((point) => point.raw),
          borderColor: DIST_COLORS[distKey] || '#f07561',
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.4,
        },
        ...(hasWeatherTrend ? [{
          label: t('analysis.vdot_weather_adjusted'),
          data: trendPredictions.map((point) => point.adjusted),
          borderColor: '#5275b8',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0.4,
        }] : []),
      ],
    };
  }, [trendPredictions, lang, t, distKey, hasWeatherTrend]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { color: isDark ? 'rgba(232, 226, 220, 0.7)' : 'rgba(44, 47, 48, 0.7)', boxWidth: 10, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatPredictedTime(Number(context.parsed.y) * 60)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: isDark ? 'rgba(232, 226, 220, 0.58)' : 'rgba(44, 47, 48, 0.58)' } },
      y: {
        grid: { color: isDark ? 'rgba(232, 226, 220, 0.08)' : 'rgba(44, 47, 48, 0.08)' },
        ticks: {
          color: isDark ? 'rgba(232, 226, 220, 0.58)' : 'rgba(44, 47, 48, 0.58)',
          callback: (value) => formatPredictedTime(Number(value) * 60),
        },
      },
    },
  }), [isDark]);
  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'analysis' }),
    [t, lang],
  );

  if (loadState === 'loading' || !distance) {
    return <PageSkeleton variant="prediction" />;
  }

  const title = lang === 'zh-CN' ? distance.labelZh : distance.labelEn;
  const displayName = email?.split('@')[0] || t('profile.default_name');
  const initials = displayName.slice(0, 1).toUpperCase();
  const primaryTime = racePredictionMinutes ? formatPredictedTime(racePredictionMinutes * 60) : '--';
  const rawPrimaryTime = rawRacePredictionMinutes ? formatPredictedTime(rawRacePredictionMinutes * 60) : '--';
  const adjustedPrimaryTime = adjustedRacePredictionMinutes ? formatPredictedTime(adjustedRacePredictionMinutes * 60) : '--';
  const weatherRecoveredSeconds = useWeatherAdjustedPrediction
    ? Math.max(0, (rawRacePredictionMinutes - adjustedRacePredictionMinutes) * 60)
    : 0;
  const racePace = racePredictionMinutes ? formatPaceSeconds((racePredictionMinutes * 60) / (distance.meters / 1000)) : '--';
  const trendDelta = trendPredictions.length > 1
    ? trendPredictions[trendPredictions.length - 1][useWeatherAdjustedPrediction ? 'adjusted' : 'raw']
      - trendPredictions[0][useWeatherAdjustedPrediction ? 'adjusted' : 'raw']
    : null;
  const evidenceTiles = [
    {
      label: t('analysis.pred_cockpit_vdot'),
      value: forecastVdot > 0 ? forecastVdot.toFixed(1) : '--',
      helper: useWeatherAdjustedPrediction
        ? `${t('analysis.vdot_weather_adjusted')} · ${t('analysis.vdot_raw')} ${representativeVdot.toFixed(1)}`
        : t('analysis.pred_cockpit_vdot_helper', { count: currentVdot.usedTopN || 0 }),
    },
    {
      label: t('analysis.pred_cockpit_race_pace'),
      value: racePace,
      helper: t('analysis.pred_cockpit_pace_unit'),
    },
    {
      label: t('analysis.pred_cockpit_samples'),
      value: String(runs.length),
      helper: t('analysis.pred_cockpit_samples_helper', { count: rollingSeries.length }),
    },
    {
      label: t('analysis.pred_cockpit_best_match'),
      value: confidenceBasis ? `${confidenceBasis.km} km` : '--',
      helper: confidenceBasis ? `${confidenceBasis.date} / ${confidenceBasis.pace}` : t('analysis.pred_evidence_recent_none'),
    },
  ];

  return (
    <div className={`runner-shell-page runner-dashboard-page prediction-detail-page prediction-v2-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`} style={{ '--prediction-accent': DIST_COLORS[distKey] || '#f07561' }}>
      <AnalysisSubpageNav
        activePredictionKey={distKey}
        collapsed={isSidebarCollapsed}
        lang={lang}
        navigate={navigate}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
        t={t}
      />

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              parentLabel={t('profile.dashboard_nav_analysis')}
              parentRoute="/analysis"
              activeLabel={title}
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

        <div className="runner-shell-canvas">
          <div className="prediction-profile-content prediction-forecast-cockpit prediction-v2">
            <section className="prediction-v2-top">
              <div className="prediction-v2-hero">
                <span className="prediction-v2-kicker">{title} · {t('analysis.pred_cockpit_kicker')}</span>
                <h1 className="prediction-v2-title">{t('analysis.pred_cockpit_title', { dist: title })}</h1>
                <div className="prediction-v2-time-row">
                  <strong className="prediction-forecast-time">{primaryTime}</strong>
                  <div className="prediction-v2-time-meta">
                    {trendDelta != null ? <span className={`prediction-v2-delta${trendDelta < 0 ? ' is-faster' : ''}`}>{formatTrendDelta(trendDelta, t)}</span> : null}
                    <span>
                      {confidenceBasis
                        ? t('analysis.pred_cockpit_basis_recent', { km: confidenceBasis.km, date: confidenceBasis.date, pace: confidenceBasis.pace })
                        : forecastVdot > 0
                          ? t('analysis.pred_cockpit_basis_vdot', { count: currentVdot.usedTopN || 0 })
                          : t('analysis.pred_cockpit_basis_empty')}
                    </span>
                  </div>
                </div>
                {showConfidencePanel ? (
                  <div className="prediction-v2-confidence" aria-label={t('analysis.pred_cockpit_confidence')}>
                    <div><span>{t('analysis.pred_cockpit_confidence')}</span><strong>{confidenceScore}%</strong></div>
                    <span className="prediction-v2-bar" aria-hidden="true"><i style={{ width: `${confidenceScore}%` }} /></span>
                  </div>
                ) : null}
                {useWeatherAdjustedPrediction ? (
                  <div className="prediction-v2-weather">
                    <span>{t('analysis.pred_weather_title')}</span>
                    <div>
                      <span>{t('analysis.vdot_raw')} <strong>{rawPrimaryTime}</strong></span>
                      <span>{t('analysis.vdot_weather_adjusted')} <strong>{adjustedPrimaryTime}</strong></span>
                      <span>{t('analysis.pred_weather_gain_label')} <strong>{formatPredictedTime(weatherRecoveredSeconds)}</strong></span>
                    </div>
                  </div>
                ) : null}
                {coachRecommendation ? <p className="prediction-v2-coach">{coachRecommendation}</p> : null}
                <div className="prediction-v2-actions">
                  <button type="button" className="prediction-v2-primary" onClick={() => navigate('/today-run')}>{t('analysis.pred_open_today')}</button>
                  <button type="button" className="prediction-v2-link" onClick={() => navigate('/analysis')}>{t('analysis.pred_open_analysis')} ›</button>
                </div>
              </div>

              <aside className="prediction-v2-ladder">
                <span className="prediction-v2-label">{t('analysis.pred_effort_title')}</span>
                {effortPredictions.length > 0 ? (
                  <ul>
                    {effortPredictions.map((level) => (
                      <li key={level.key} className={level.cssClass}>
                        <span className="prediction-v2-ladder-copy"><strong>{level.label}</strong><span>{level.paceDisplay}{t('analysis.pred_cockpit_pace_unit')}</span></span>
                        <strong className="prediction-v2-ladder-time">{level.timeDisplay}</strong>
                        <span className="prediction-v2-bar" aria-hidden="true"><i style={{ width: `${level.fill}%` }} /></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="prediction-detail-empty"><strong>{t('analysis.pred_detail_empty_title')}</strong><p>{t('analysis.pred_detail_empty_copy')}</p></div>
                )}
              </aside>
            </section>

            <section className="prediction-v2-levers" aria-label={t('analysis.pred_evidence_title')}>
              {evidenceTiles.map((tile) => (
                <article key={tile.label} className="prediction-v2-lever">
                  <span>{tile.label}</span>
                  <strong>{tile.value}</strong>
                  <p>{tile.helper}</p>
                </article>
              ))}
            </section>

            <section className="prediction-trend-card">
              <div className="prediction-section-heading prediction-trend-heading">
                <div>
                  <span>{t('analysis.pred_trend_kicker')}</span>
                  <h2>{t('analysis.pred_trend_title', { dist: title })}</h2>
                  <p>{t('analysis.pred_trend_copy')}</p>
                </div>
                <div className="prediction-trend-pills">
                  <span>{t('analysis.pred_trend_window_90d')}</span>
                  <span>{t('analysis.pred_trend_window_samples', { count: rollingSeries.length })}</span>
                </div>
              </div>
              <div className="prediction-trend-chart">
                {chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="prediction-detail-empty">
                    <strong>{t('analysis.pred_detail_empty_title')}</strong>
                    <p>{t('analysis.pred_detail_empty_copy')}</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

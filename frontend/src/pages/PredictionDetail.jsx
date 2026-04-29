import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import {
  collectAllVdotEntries,
  computeRollingRepresentativeSeries,
  computeTrainingPaces,
  estimateCurrentVdot,
  predictRaceTimeCalibrated,
  RACE_DISTANCES,
  VDOT_LOOKBACK_MS,
  vdotToPaceSecondsPerKm,
} from '../utils/vdot';
import { formatPaceSeconds } from '../utils/format';
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
  { key: 'easy', labelEn: 'Easy', labelZh: '轻松跑', vo2Fraction: 0.65, cssClass: 'is-easy' },
  { key: 'moderate', labelEn: 'Moderate', labelZh: '中等强度', vo2Fraction: 0.75, cssClass: 'is-moderate' },
  { key: 'hard', labelEn: 'Hard', labelZh: '高强度', vo2Fraction: 0.88, cssClass: 'is-hard' },
  { key: 'race', labelEn: 'Race', labelZh: '比赛', vo2Fraction: 0.98, cssClass: 'is-race' },
];

function formatPredictedTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '--';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getBestRecentDistanceMatch(runs, distKey) {
  const now = Date.now();
  const lookbackMs = 180 * 24 * 60 * 60 * 1000;
  let best = null;
  for (const run of runs) {
    const km = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
    const sec = Number(run.movingTimeSeconds || run.durationSeconds || 0);
    const t = new Date(run.startTime || run.startDate || 0).getTime();
    if (!Number.isFinite(km) || !Number.isFinite(sec) || !Number.isFinite(t)) continue;
    if (km <= 0 || sec <= 0 || now - t > lookbackMs) continue;
    const distRatio = distKey === '5k' ? Math.abs(km - 5) : distKey === '10k' ? Math.abs(km - 10) : distKey === 'half' ? Math.abs(km - 21.1) : Math.abs(km - 42.2);
    if (best == null || distRatio < best.distRatio) {
      best = { run, km, sec, date: new Date(t), distRatio };
    }
  }
  return best;
}

export default function PredictionDetail() {
  const { distKey } = useParams();
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');


  const distance = useMemo(() => RACE_DISTANCES.find((d) => d.key === distKey), [distKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    (async () => {
      setLoadState('loading');
      try {
        const activitiesData = await apiJson('/api/activities');
        const list = Array.isArray(activitiesData) ? activitiesData : [];
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
  const trainingPaces = useMemo(() => computeTrainingPaces(currentVdot.representativeVdot), [currentVdot]);

  const effortPredictions = useMemo(() => {
    if (!distance || currentVdot.representativeVdot <= 0) return [];
    return EFFORT_LEVELS.map((level) => {
      const paceSecPerKm = vdotToPaceSecondsPerKm(currentVdot.representativeVdot, level.vo2Fraction);
      const totalSeconds = paceSecPerKm != null ? (paceSecPerKm * (distance.meters / 1000)) : null;
      return {
        ...level,
        paceSecPerKm,
        totalSeconds,
        label: lang === 'zh-CN' ? level.labelZh : level.labelEn,
        timeDisplay: formatPredictedTime(totalSeconds),
        paceDisplay: paceSecPerKm != null ? formatPaceSeconds(paceSecPerKm) : '--',
      };
    });
  }, [distance, currentVdot, lang]);

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
      name: bestMatch.run.name || '',
    };
  }, [distance, runs, lang]);

  const trainingRecommendation = useMemo(() => {
    if (!distance || currentVdot.representativeVdot <= 0) return null;
    const racePace = effortPredictions.find((e) => e.key === 'race');
    const easyPaces = trainingPaces.easy || [];
    const easyPaceLower = easyPaces[0] || null;
    const easyPaceUpper = easyPaces[1] || null;

    if (distance.key === 'marathon') {
      return lang === 'zh-CN'
        ? `以 ${easyPaceLower != null ? formatPaceSeconds(easyPaceLower) : '--'} 到 ${easyPaceUpper != null ? formatPaceSeconds(easyPaceUpper) : '--'} 的轻松配速积累跑步量，每周至少一次长距离跑逐步接近 ${distance.labelZh} 距离。`
        : `Build volume at easy pace ${easyPaceLower != null ? formatPaceSeconds(easyPaceLower) : '--'}–${easyPaceUpper != null ? formatPaceSeconds(easyPaceUpper) : '--'}, with at least one long run per week gradually approaching ${distance.labelEn} distance.`;
    }
    if (distance.key === 'half') {
      return lang === 'zh-CN'
        ? `每周安排一次节奏跑和一次长距离跑，节奏跑以 ${racePace?.paceDisplay || '--'} 的目标配速练习，逐步适应半马节奏。`
        : `Schedule one tempo run and one long run per week. Practice at ${racePace?.paceDisplay || '--'} target pace to gradually adapt to half marathon rhythm.`;
    }
    if (distance.key === '10k') {
      return lang === 'zh-CN'
        ? `每周安排 2-3 次阈值训练（节奏跑或间歇跑），以 ${racePace?.paceDisplay || '--'} 附近的配速练习，配合轻松跑恢复。`
        : `Schedule 2–3 threshold sessions per week (tempo or intervals) near ${racePace?.paceDisplay || '--'} pace, with easy runs for recovery.`;
    }
    return lang === 'zh-CN'
      ? `每周安排 1-2 次速度训练（间歇跑或重复跑），以 ${racePace?.paceDisplay || '--'} 附近的配速刺激神经肌肉系统。`
      : `Schedule 1–2 speed sessions per week (intervals or repetitions) near ${racePace?.paceDisplay || '--'} pace to stimulate neuromuscular adaptation.`;
  }, [distance, currentVdot, effortPredictions, trainingPaces, lang]);

  const chartData = useMemo(() => {
    if (!distance || !rollingSeries.length) return null;

    const labels = rollingSeries.map((p) => new Date(p.date).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }));
    const data = rollingSeries.map((p) => predictRaceTimeCalibrated(p.y, distance.meters, runs));
    const adjustedData = rollingSeries.map((p) => predictRaceTimeCalibrated(p.adjustedY || p.y, distance.meters, runs));

    return {
      labels,
      datasets: [
        {
          label: t('analysis.vdot_raw'),
          data,
          borderColor: DIST_COLORS[distKey] || '#f07561',
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.4,
        },
        {
          label: t('analysis.vdot_weather_adjusted'),
          data: adjustedData,
          borderColor: '#818cf8',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0.4,
        }
      ],
    };
  }, [distance, rollingSeries, runs, lang, t, distKey]);

  if (loadState !== 'ready' || !distance) {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t('analysis.stitch_loading')}</div>
      </div>
    );
  }

  const title = lang === 'zh-CN' ? distance.labelZh : distance.labelEn;

  return (
    <div className="runner-shell-page runner-dashboard-page prediction-detail-page">
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <HermesLogo dark />
        </div>
        <nav className="runner-shell-side-nav">
          <button type="button" className="runner-shell-side-link" onClick={() => navigate('/profile')}>
            <AppIcon name="dashboard" className="runner-dashboard-side-link-icon" />
            <span className="runner-dashboard-side-link-label">{t('profile.dashboard_nav_dashboard')}</span>
          </button>
        </nav>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar">
           <div className="runner-shell-topnav">
              <button type="button" className="runner-shell-topnav-link" onClick={() => navigate('/analysis')}>{t('profile.dashboard_nav_analysis')}</button>
              <span className="runner-shell-topnav-link is-section is-active">{title}</span>
           </div>
        </header>

        <div className="runner-shell-canvas">
          <div className="prediction-detail-content">
            <section className="prediction-hero">
              <h1>{lang === 'zh-CN' ? `${title} 预测` : `${title} Prediction`}</h1>
              {confidenceBasis && (
                <p className="prediction-hero-basis">
                  {lang === 'zh-CN'
                    ? `基于你最近 ${confidenceBasis.km} 公里的跑步（${confidenceBasis.date}，配速 ${confidenceBasis.pace}/公里）`
                    : `Based on your recent ${confidenceBasis.km} km run on ${confidenceBasis.date} at ${confidenceBasis.pace}/km pace`}
                </p>
              )}
              {!confidenceBasis && currentVdot.representativeVdot > 0 && (
                <p className="prediction-hero-basis">
                  {lang === 'zh-CN'
                    ? `基于你当前 VO2max ${currentVdot.representativeVdot.toFixed(1)} 和 ${runs.length} 次历史跑步数据`
                    : `Based on your current VO2max of ${currentVdot.representativeVdot.toFixed(1)} and ${runs.length} historical runs`}
                </p>
              )}
            </section>

            {effortPredictions.length > 0 && (
              <section className="prediction-effort-grid">
                <h2>{lang === 'zh-CN' ? '各强度预估完成时间' : 'Predicted Times by Effort'}</h2>
                <div className="prediction-effort-cards">
                  {effortPredictions.map((level) => (
                    <div key={level.key} className={`prediction-effort-card ${level.cssClass}`}>
                      <span className="prediction-effort-card-label">{level.label}</span>
                      <strong className="prediction-effort-card-time">{level.timeDisplay}</strong>
                      <span className="prediction-effort-card-pace">
                        {level.paceDisplay}{lang === 'zh-CN' ? '/公里' : '/km'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {trainingRecommendation && (
              <section className="prediction-recommendation">
                <h2>{lang === 'zh-CN' ? '训练建议' : 'Training Recommendation'}</h2>
                <p>{trainingRecommendation}</p>
              </section>
            )}

            <section className="prediction-chart-section">
              <h2>{lang === 'zh-CN' ? `${title} 预测趋势` : `${title} Prediction Trend`}</h2>
              <div className="prediction-detail-chart">
                {chartData && <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

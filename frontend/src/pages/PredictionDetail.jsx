import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import {
  collectAllVdotEntries,
  computeRollingRepresentativeSeries,
  predictRaceTimeCalibrated,
  RACE_DISTANCES,
  VDOT_LOOKBACK_MS,
} from '../utils/vdot';
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

export default function PredictionDetail() {
  const { distKey } = useParams();
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    <div className={`runner-shell-page runner-dashboard-page prediction-detail-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
            <h1>{title} Prediction Trend</h1>
            <div className="prediction-detail-chart">
              {chartData && <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

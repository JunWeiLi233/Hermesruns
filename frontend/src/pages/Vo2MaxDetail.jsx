import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import {
  collectAllVdotEntries,
  computeRollingRepresentativeSeries,
  VDOT_LOOKBACK_MS,
} from '../utils/vdot';

const cx = (...parts) => parts.filter(Boolean).join(' ');

function formatChartDate(date, lang) {
  return new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function sampleTrendSeries(rollingSeries) {
  if (!rollingSeries.length) return [];
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const sampled = [];
  let currentBucket = null;

  rollingSeries.forEach((point) => {
    const bucket = Math.floor(point.x / weekMs);
    if (bucket !== currentBucket) {
      currentBucket = bucket;
      sampled.push(point);
    } else {
      sampled[sampled.length - 1] = point;
    }
  });

  const latest = rollingSeries.at(-1);
  if (latest && sampled.at(-1)?.x !== latest.x) sampled.push(latest);
  return sampled;
}

function buildSmoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].cx.toFixed(2)} ${points[0].cy.toFixed(2)}`;

  let path = `M ${points[0].cx.toFixed(2)} ${points[0].cy.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const following = points[index + 2] || next;
    const control1X = current.cx + ((next.cx - previous.cx) / 6);
    const control1Y = current.cy + ((next.cy - previous.cy) / 6);
    const control2X = next.cx - ((following.cx - current.cx) / 6);
    const control2Y = next.cy - ((following.cy - current.cy) / 6);
    path += ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)}, ${control2X.toFixed(2)} ${control2Y.toFixed(2)}, ${next.cx.toFixed(2)} ${next.cy.toFixed(2)}`;
  }

  return path;
}

function buildChartModel(entries, rollingSeries, lang) {
  if (!entries.length) return null;

  const width = 920;
  const height = 420;
  const padLeft = 56;
  const padRight = 18;
  const padTop = 30;
  const padBottom = 52;
  const domain = [...entries.map((entry) => entry.vo2max), ...rollingSeries.map((point) => point.y)];
  const minDomain = Math.min(...domain);
  const maxDomain = Math.max(...domain);
  const minY = Math.max(20, Math.floor((minDomain - 1.5) / 2) * 2);
  const maxY = Math.ceil((maxDomain + 1.5) / 2) * 2;
  const safeSpanY = Math.max(6, maxY - minY);
  const firstTs = entries[0].date.getTime();
  const rawLastTs = entries[entries.length - 1].date.getTime();
  const lastTs = rawLastTs + 7 * 24 * 60 * 60 * 1000;
  const safeSpanX = Math.max(1, lastTs - firstTs);
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const toX = (ts) => padLeft + (((ts - firstTs) / safeSpanX) * plotWidth);
  const toY = (value) => padTop + ((maxY - value) / safeSpanY) * plotHeight;

  const points = entries.map((entry) => ({
    ...entry,
    cx: toX(entry.date.getTime()),
    cy: toY(entry.vo2max),
    label: formatChartDate(entry.date, lang),
  }));

  const trendPoints = rollingSeries.map((point) => ({
    ...point,
    cx: toX(point.x),
    cy: toY(point.y),
    label: formatChartDate(point.date, lang),
  }));

  const trendPath = buildSmoothPath(trendPoints);
  const trendAreaPath = trendPoints.length
    ? `${trendPath} L ${trendPoints.at(-1).cx.toFixed(2)} ${(height - padBottom).toFixed(2)} L ${trendPoints[0].cx.toFixed(2)} ${(height - padBottom).toFixed(2)} Z`
    : '';

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = minY + ((safeSpanY / 4) * index);
    return {
      value: Math.round(value),
      y: toY(value),
    };
  }).reverse();

  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const ts = firstTs + ((safeSpanX / 4) * index);
    return {
      x: toX(ts),
      label: formatChartDate(new Date(ts), lang),
    };
  });

  const barWidth = Math.min(14, Math.max(4, plotWidth / Math.max(1, entries.length) * 0.55));

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    barWidth,
    points,
    trendPoints,
    trendPath,
    trendAreaPath,
    yTicks,
    xTicks,
    latestTrendPoint: trendPoints.at(-1) || null,
  };
}

function sliceChartWindow(entries, rollingSeries, windowMs = VDOT_LOOKBACK_MS) {
  if (!entries.length) return { entries: [], rollingSeries: [] };
  const endTs = entries[entries.length - 1].date.getTime();
  const startTs = endTs - windowMs;
  return {
    entries: entries.filter((entry) => entry.date.getTime() >= startTs),
    rollingSeries: rollingSeries.filter((point) => point.x >= startTs),
  };
}

export default function Vo2MaxDetail() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [scrubber, setScrubber] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    (async () => {
      setLoadState('loading');
      try {
        const [profileData, activitiesData] = await Promise.all([apiJson('/api/profile/me'), apiJson('/api/activities')]);
        const list = Array.isArray(activitiesData) ? activitiesData : [];
        list.sort((a, b) => new Date(a.startTime || a.startDate || 0) - new Date(b.startTime || b.startDate || 0));
        setProfile(profileData);
        setRuns(list);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    })();
  }, [isAuthenticated, navigate]);

  const entries = useMemo(() => collectAllVdotEntries(runs), [runs]);
  const rollingSeries = useMemo(() => sampleTrendSeries(computeRollingRepresentativeSeries(entries)), [entries]);
  const chartWindow = useMemo(() => sliceChartWindow(entries, rollingSeries), [entries, rollingSeries]);
  const chart = useMemo(
    () => buildChartModel(chartWindow.entries, chartWindow.rollingSeries, lang),
    [chartWindow.entries, chartWindow.rollingSeries, lang],
  );

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const latestEntry = chartWindow.entries.at(-1) || null;
  const firstEntry = chartWindow.entries[0] || null;
  const chartMax = chartWindow.entries.length ? Math.max(...chartWindow.entries.map((entry) => entry.vo2max)) : null;
  const chartAverage = chartWindow.entries.length
    ? chartWindow.entries.reduce((sum, entry) => sum + entry.vo2max, 0) / chartWindow.entries.length
    : null;
  const chartPeak = chartWindow.rollingSeries.length
    ? Math.max(...chartWindow.rollingSeries.map((point) => point.y))
    : chartMax;
  const trendDelta = latestEntry && firstEntry ? latestEntry.vo2max - firstEntry.vo2max : null;
  const trendPercent = latestEntry && firstEntry && firstEntry.vo2max > 0
    ? ((latestEntry.vo2max - firstEntry.vo2max) / firstEntry.vo2max) * 100
    : null;

  const handleChartPointerMove = useCallback((event) => {
    if (!chart) return;
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    const svgX = svgPt.x;

    let nearestTrend = null;
    let nearestTrendDist = Infinity;
    for (const point of chart.trendPoints) {
      const dist = Math.abs(point.cx - svgX);
      if (dist < nearestTrendDist) {
        nearestTrendDist = dist;
        nearestTrend = point;
      }
    }
    if (!nearestTrend) return;

    const plotWidth = chart.width - chart.padLeft - chart.padRight;
    const plotHeight = chart.height - chart.padTop - chart.padBottom;
    const tooltipLeft = Math.min(80, Math.max(5, ((nearestTrend.cx - chart.padLeft) / plotWidth) * 100));
    const tooltipTop = Math.min(70, Math.max(5, ((nearestTrend.cy - chart.padTop) / plotHeight) * 100));

    setScrubber({
      point: { vo2max: nearestTrend.y, label: nearestTrend.label },
      cx: nearestTrend.cx,
      cy: nearestTrend.cy,
      tooltipLeft,
      tooltipTop,
    });
  }, [chart]);

  const handleChartPointerLeave = useCallback(() => setScrubber(null), []);

  if (loadState !== 'ready') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</div>
      </div>
    );
  }

  const rangeLabel = latestEntry?.vo2max >= 60 ? (lang === 'zh-CN' ? '卓越' : 'Superior') : (latestEntry?.vo2max >= 50 ? (lang === 'zh-CN' ? '优秀' : 'Strong') : (lang === 'zh-CN' ? '发展中' : 'Developing'));

  return (
    <div className={`runner-shell-page runner-dashboard-page analysis-vo2-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle')}</span>
          </div>
          <button type="button" className="runner-dashboard-sidebar-toggle" onClick={() => setIsSidebarCollapsed((prev) => !prev)}>
             <span className="runner-dashboard-toggle-glyph">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>
        <nav className="runner-shell-side-nav">
          <button type="button" className="runner-shell-side-link" onClick={() => navigate('/profile')}>
            <AppIcon name="dashboard" className="runner-dashboard-side-link-icon" />
            <span className="runner-dashboard-side-link-label">{t('profile.dashboard_nav_dashboard')}</span>
          </button>
          <button type="button" className="runner-shell-side-link is-active" onClick={() => navigate('/analysis')}>
            <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
            <span className="runner-dashboard-side-link-label">{t('profile.dashboard_nav_analysis')}</span>
          </button>
        </nav>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <div className="runner-shell-topnav runner-shell-topnav--editorial-detail">
              <button type="button" className="runner-shell-topnav-link" onClick={() => navigate('/analysis')}>{t('profile.dashboard_nav_analysis')}</button>
              <span className="runner-shell-topnav-link is-section is-active">VO2max</span>
            </div>
          </div>
          <div className="runner-shell-topbar-actions">
            <TopbarNotifications />
            <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')}>{initials}</button>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <section className="analysis-vo2-kinetic-dashboard">
            <header className="analysis-vo2-kinetic-header">
              <div className="analysis-vo2-kinetic-title">
                <h1>VO2max Detail</h1>
                <p>Your fitness shifted by {Math.abs(trendPercent || 0).toFixed(1)}% in 90 days ({rangeLabel}).</p>
              </div>
              <div className="analysis-vo2-kinetic-summary">
                <div className="analysis-vo2-kinetic-value-row">
                  <strong>{latestEntry ? latestEntry.vo2max.toFixed(1) : '--'}</strong>
                  <span>ml/kg/min</span>
                </div>
                <div className="analysis-vo2-kinetic-stat-row">
                  <div><small>Peak</small><strong>{chartPeak ? chartPeak.toFixed(1) : '--'}</strong></div>
                  <div><small>Average</small><strong>{chartAverage ? chartAverage.toFixed(1) : '--'}</strong></div>
                  <div><small>Trend</small><strong>{trendDelta != null ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)}` : '--'}</strong></div>
                </div>
              </div>
            </header>

            {chart ? (
              <section className="analysis-vo2-kinetic-chart-panel">
                 <div className="analysis-vo2-chart-shell">
                    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ cursor: 'crosshair' }} onPointerMove={handleChartPointerMove} onPointerLeave={handleChartPointerLeave}>
                      <rect x="0" y="0" width={chart.width} height={chart.height} fill="transparent" />
                      {/* Y-axis gridlines */}
                      <g>
                        {chart.yTicks.map((tick) => (
                          <g key={`y-${tick.value}`}>
                            <line x1={chart.padLeft} y1={tick.y} x2={chart.width - chart.padRight} y2={tick.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                            <text x={chart.padLeft - 8} y={tick.y + 4} textAnchor="end" fill="rgba(243,237,232,0.42)" fontSize="11" fontFamily="Manrope, sans-serif">{tick.value}</text>
                          </g>
                        ))}
                      </g>
                      {/* Baseline */}
                      <line x1={chart.padLeft} y1={chart.height - chart.padBottom} x2={chart.width - chart.padRight} y2={chart.height - chart.padBottom} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
                      {/* Bars */}
                      <g>
                        {chart.points.map((point, i) => (
                          <rect
                            key={`vo2bar-${i}`}
                            x={point.cx - chart.barWidth / 2}
                            y={point.cy}
                            width={chart.barWidth}
                            height={Math.max(1, chart.height - chart.padBottom - point.cy)}
                            fill="rgba(240, 117, 97, 0.45)"
                            rx="1.5"
                          />
                        ))}
                      </g>
                      {/* Trend area and line */}
                      <g>
                        {chart.trendAreaPath && <path d={chart.trendAreaPath} fill="rgba(240, 117, 97, 0.10)" />}
                        {chart.trendPath && <path d={chart.trendPath} fill="none" stroke="#f07561" strokeWidth="2.5" />}
                      </g>
                      {/* Scrubber */}
                      {scrubber && (
                        <g>
                          <line x1={chart.padLeft} y1={scrubber.cy} x2={chart.width - chart.padRight} y2={scrubber.cy} stroke="rgba(240,117,97,0.20)" strokeWidth="1" strokeDasharray="4 3" />
                          <circle cx={scrubber.cx} cy={scrubber.cy} r="5" fill="#f07561" stroke="#1f1c1c" strokeWidth="2" />
                          <rect x={scrubber.cx - 36} y={scrubber.cy - 32} width="72" height="22" rx="4" fill="rgba(31,28,28,0.92)" stroke="rgba(240,117,97,0.35)" strokeWidth="1" />
                          <text x={scrubber.cx} y={scrubber.cy - 17} textAnchor="middle" fill="#f3ede8" fontSize="12" fontWeight="700" fontFamily="Manrope, sans-serif">{scrubber.point.vo2max.toFixed(1)}</text>
                        </g>
                      )}
                      {/* X-axis labels */}
                      <g>
                        {chart.xTicks.map((tick, i) => (
                          <text key={`x-${i}`} x={tick.x} y={chart.height - 12} textAnchor="middle" fill="rgba(243,237,232,0.42)" fontSize="11" fontFamily="Manrope, sans-serif">{tick.label}</text>
                        ))}
                      </g>
                    </svg>
                 </div>
              </section>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

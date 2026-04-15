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
  const domain = [...entries.map((entry) => entry.vdot), ...rollingSeries.map((point) => point.y)];
  const minDomain = Math.min(...domain);
  const maxDomain = Math.max(...domain);
  const minY = Math.max(20, Math.floor((minDomain - 1.5) / 2) * 2);
  const maxY = Math.ceil((maxDomain + 1.5) / 2) * 2;
  const safeSpanY = Math.max(6, maxY - minY);
  const firstTs = entries[0].date.getTime();
  const rawLastTs = entries[entries.length - 1].date.getTime();
  const lastTs = rawLastTs + 7 * 24 * 60 * 60 * 1000; // 7-day right-side padding
  const safeSpanX = Math.max(1, lastTs - firstTs);
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const toX = (ts) => padLeft + (((ts - firstTs) / safeSpanX) * plotWidth);
  const toY = (value) => padTop + ((maxY - value) / safeSpanY) * plotHeight;

  const points = entries.map((entry) => ({
    ...entry,
    cx: toX(entry.date.getTime()),
    cy: toY(entry.vdot),
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

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
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
  if (!entries.length) {
    return { entries: [], rollingSeries: [] };
  }

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
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
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
  const chartMax = chartWindow.entries.length ? Math.max(...chartWindow.entries.map((entry) => entry.vdot)) : null;
  const chartAverage = chartWindow.entries.length
    ? chartWindow.entries.reduce((sum, entry) => sum + entry.vdot, 0) / chartWindow.entries.length
    : null;
  const chartPeak = chartWindow.rollingSeries.length
    ? Math.max(...chartWindow.rollingSeries.map((point) => point.y))
    : chartMax;
  const trendDelta = latestEntry && firstEntry ? latestEntry.vdot - firstEntry.vdot : null;
  const trendPercent = latestEntry && firstEntry && firstEntry.vdot > 0
    ? ((latestEntry.vdot - firstEntry.vdot) / firstEntry.vdot) * 100
    : null;
  const rangeLabel = latestEntry
    ? latestEntry.vdot >= 60
      ? (lang === 'zh-CN' ? '优秀区间' : 'Superior Range')
      : latestEntry.vdot >= 50
        ? (lang === 'zh-CN' ? '强劲区间' : 'Strong Range')
        : (lang === 'zh-CN' ? '发展区间' : 'Developing Range')
    : (lang === 'zh-CN' ? '等待样本' : 'Awaiting Samples');
  const subtitleCopy = latestEntry
    ? (
      lang === 'zh-CN'
        ? `过去 90 天你的心肺效率变化约为 ${Math.abs(trendPercent || 0).toFixed(1)}%，当前处于 ${rangeLabel}。`
        : `Your cardiovascular efficiency has shifted by ${Math.abs(trendPercent || 0).toFixed(1)}% over the last 90 days. You are currently in the ${rangeLabel}.`
    )
    : (lang === 'zh-CN' ? '一旦 Hermes 积累到足够样本，这里会显示你 90 天内的 VO2max 走势。' : 'Once Hermes has enough samples, this page will show your 90-day VO2max direction here.');
  const healthInsight = latestEntry
    ? (
      lang === 'zh-CN'
        ? `最新 VO2max 为 ${latestEntry.vdot.toFixed(1)}，说明你的有氧引擎${trendDelta != null && trendDelta >= 0 ? '仍在稳步提升' : '正在等待下一轮巩固'}。`
        : `Your latest VO2max sample is ${latestEntry.vdot.toFixed(1)}, which suggests your aerobic engine ${trendDelta != null && trendDelta >= 0 ? 'is still improving steadily' : 'is waiting for the next consolidation block'}.`
    )
    : (lang === 'zh-CN' ? '继续记录跑步后，这里会解释你的心肺表现走势。' : 'Once more runs are logged, this panel will explain how your aerobic engine is trending.');
  const primaryDriver = trendDelta != null
    ? (
      lang === 'zh-CN'
        ? `最近 90 天的方向主要由${trendDelta >= 0 ? '持续性的高质量训练与更稳定的输出' : '近期训练波动与样本偏薄'}推动。`
        : `The last 90 days are being driven mostly by ${trendDelta >= 0 ? 'consistent quality sessions and steadier output' : 'recent training variability and thinner sampling'}.`
    )
    : (lang === 'zh-CN' ? '样本不足，暂时还看不出稳定驱动因素。' : 'There are not enough samples yet to identify a stable driver.');
  const optimalThreshold = chart ? chart.yTicks[Math.min(1, chart.yTicks.length - 1)]?.value ?? null : null;
  const latestTooltipLeft = chart?.latestTrendPoint
    ? Math.min(80, Math.max(18, ((chart.latestTrendPoint.cx - chart.padLeft) / (chart.width - chart.padLeft - chart.padRight)) * 100))
    : 76;
  const latestTooltipTop = chart?.latestTrendPoint
    ? Math.min(70, Math.max(10, ((chart.latestTrendPoint.cy - chart.padTop) / (chart.height - chart.padTop - chart.padBottom)) * 100))
    : 34;

  const copy = {
    back: lang === 'zh-CN' ? '返回分析' : 'Back to Analysis',
    deepAnalysis: lang === 'zh-CN' ? 'VO2max 深度分析' : 'VO2max Deep Analysis',
    detail: lang === 'zh-CN' ? '详情' : 'Detail',
    peak: lang === 'zh-CN' ? '峰值' : 'Peak',
    average: lang === 'zh-CN' ? '平均' : 'Average',
    trend: lang === 'zh-CN' ? '趋势' : 'Trend',
    threshold: lang === 'zh-CN' ? '高水平阈值' : 'Optimal Zone Threshold',
    latestSession: lang === 'zh-CN' ? '最近一次样本' : 'Latest session',
    healthInsight: lang === 'zh-CN' ? '健康洞察' : 'Health Insight',
    primaryDriver: lang === 'zh-CN' ? '主要驱动' : 'Primary Driver',
    chartAria: lang === 'zh-CN' ? 'VO2max 详情图表' : 'VO2max detail chart',
    noSamples: lang === 'zh-CN' ? '还没有足够样本来生成 VO2max 详情。' : 'There are not enough samples yet to render the VO2max detail view.',
  };

  const handleChartPointerMove = useCallback((event) => {
    if (!chart) return;
    const svg = event.currentTarget;

    // Use SVG's own coordinate transform — handles scaling/viewBox correctly
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    const svgX = svgPt.x;

    // Always snap to the trend line (orange curve) — individual run dots are decorative scatter
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

    // Check if an individual run dot is very close in X — use it for the label/vdot value
    const plotWidth = chart.width - chart.padLeft - chart.padRight;
    const plotHeight = chart.height - chart.padTop - chart.padBottom;
    const tooltipLeft = Math.min(80, Math.max(5, ((nearestTrend.cx - chart.padLeft) / plotWidth) * 100));
    const tooltipTop = Math.min(70, Math.max(5, ((nearestTrend.cy - chart.padTop) / plotHeight) * 100));

    setScrubber({
      point: {
        vdot: nearestTrend.y,
        label: nearestTrend.label,
      },
      cx: nearestTrend.cx,
      cy: nearestTrend.cy,
      tooltipLeft,
      tooltipTop,
    });
  }, [chart]);

  const handleChartPointerLeave = useCallback(() => setScrubber(null), []);

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights', active: true },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];
  const topnavTitle = 'VO2max';

  if (loadState !== 'ready') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page analysis-vo2-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
              className={cx('runner-shell-side-link', item.active && 'is-active')}
              onClick={() => navigate(item.route)}
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
            <div className="runner-shell-topnav runner-shell-topnav--editorial-detail">
              <button type="button" className="runner-shell-topnav-brand" onClick={() => navigate('/profile')}>HERMES</button>
              <button type="button" className="runner-shell-topnav-link" onClick={() => navigate('/analysis')}>
                {t('profile.dashboard_nav_analysis')}
              </button>
              <span className="runner-shell-topnav-link is-section is-active">{topnavTitle}</span>
            </div>
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={profile?.displayName || 'Hermes'} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas analysis-vo2-page-canvas">
          <section className="analysis-vo2-kinetic-dashboard">
            <div className="analysis-vo2-kinetic-nav">
              <button type="button" className="analysis-vo2-page-back is-kinetic" onClick={() => navigate('/analysis')}>
                <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                <span>{copy.back}</span>
              </button>
              <div className="analysis-vo2-kinetic-nav-status">
                <span>{copy.deepAnalysis}</span>
                <i />
              </div>
            </div>

            <header className="analysis-vo2-kinetic-header">
              <div className="analysis-vo2-kinetic-title">
                <h1>
                  VO<span>2</span>max {copy.detail}
                </h1>
                <p>{subtitleCopy}</p>
              </div>

              <div className="analysis-vo2-kinetic-summary">
                <div className="analysis-vo2-kinetic-value-row">
                  <strong>{latestEntry ? latestEntry.vdot.toFixed(1) : '--'}</strong>
                  <span>{t('analysis.vo2_chart_y_title')}</span>
                </div>
                <div className="analysis-vo2-kinetic-stat-row">
                  <div>
                    <small>{copy.peak}</small>
                    <strong>{chartPeak ? chartPeak.toFixed(1) : '--'}</strong>
                  </div>
                  <div>
                    <small>{copy.average}</small>
                    <strong>{chartAverage ? chartAverage.toFixed(1) : '--'}</strong>
                  </div>
                  <div>
                    <small>{copy.trend}</small>
                    <strong className={trendDelta != null && trendDelta >= 0 ? 'is-positive' : ''}>
                      {trendDelta != null ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)}` : '--'}
                    </strong>
                  </div>
                </div>
              </div>
            </header>

            {chart ? (
              <section className="analysis-vo2-kinetic-chart-panel">
                <div className="analysis-vo2-kinetic-y-axis" aria-hidden="true">
                  {chart.yTicks.map((tick) => (
                    <span key={tick.value}>{tick.value}</span>
                  ))}
                </div>

                <div className="analysis-vo2-kinetic-chart-stage">
                  {optimalThreshold != null ? (
                    <div
                      className="analysis-vo2-kinetic-threshold"
                      style={{ top: `${((optimalThreshold - chart.yTicks.at(-1).value) / Math.max(1, chart.yTicks[0].value - chart.yTicks.at(-1).value)) * 100}%` }}
                    >
                      <span>{copy.threshold}</span>
                    </div>
                  ) : null}

                  <div
                    className={`analysis-vo2-kinetic-tooltip${scrubber ? ' is-scrubbing' : ''}`}
                    style={{
                      left: `${scrubber ? scrubber.tooltipLeft : latestTooltipLeft}%`,
                      top: `${scrubber ? scrubber.tooltipTop : latestTooltipTop}%`,
                    }}
                  >
                    <p>{scrubber ? scrubber.point.label : (latestEntry ? latestEntry.label : copy.latestSession)}</p>
                    <strong>
                      {scrubber
                        ? (scrubber.point.vdot != null ? Number(scrubber.point.vdot).toFixed(1) : '--')
                        : (latestEntry ? latestEntry.vdot.toFixed(1) : '--')}{' '}
                      <span>VO2max</span>
                    </strong>
                  </div>

                  <div className="analysis-vo2-chart-shell analysis-vo2-chart-shell--kinetic">
                    <svg
                      viewBox={`0 0 ${chart.width} ${chart.height}`}
                      className="analysis-vo2-chart-svg"
                      aria-label={copy.chartAria}
                      style={{ cursor: 'crosshair' }}
                      onPointerMove={handleChartPointerMove}
                      onPointerLeave={handleChartPointerLeave}
                    >
                      {/* Transparent hit-area — ensures pointer events fire over empty SVG space */}
                      <rect x="0" y="0" width={chart.width} height={chart.height} fill="transparent" />
                      <defs>
                        <linearGradient id="analysisVo2TrendFill" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ff9d72" stopOpacity="0.52" />
                          <stop offset="58%" stopColor="#ff7d61" stopOpacity="0.16" />
                          <stop offset="100%" stopColor="#ff7d61" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="analysisVo2TrendStroke" x1="0%" y1="50%" x2="100%" y2="50%">
                          <stop offset="0%" stopColor="#ffba8d" />
                          <stop offset="55%" stopColor="#ff7d61" />
                          <stop offset="100%" stopColor="#ffd86f" />
                        </linearGradient>
                        <filter id="analysisVo2TrendGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="7" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <clipPath id="analysisVo2PlotClip">
                          <rect
                            x={chart.padLeft}
                            y={chart.padTop}
                            width={chart.width - chart.padLeft - chart.padRight}
                            height={chart.height - chart.padTop - chart.padBottom}
                            rx="24"
                          />
                        </clipPath>
                      </defs>

                      <rect
                        x={chart.padLeft}
                        y={chart.padTop}
                        width={chart.width - chart.padLeft - chart.padRight}
                        height={chart.height - chart.padTop - chart.padBottom}
                        rx="24"
                        className="analysis-vo2-plot-bg"
                      />

                      {chart.yTicks.map((tick) => (
                        <g key={tick.value}>
                          <line x1={chart.padLeft} x2={chart.width - chart.padRight} y1={tick.y} y2={tick.y} className="analysis-vo2-grid-line" />
                        </g>
                      ))}

                      <g clipPath="url(#analysisVo2PlotClip)">
                        {chart.trendAreaPath ? <path d={chart.trendAreaPath} className="analysis-vo2-trend-area" /> : null}
                        {chart.trendPath ? <path d={chart.trendPath} className="analysis-vo2-trend-path-glow" filter="url(#analysisVo2TrendGlow)" /> : null}
                        {chart.trendPath ? <path d={chart.trendPath} className="analysis-vo2-trend-path" /> : null}

                        {false && chart.points.map((point) => (
                          <circle key={`${point.run?.id || point.date.getTime()}-${point.vdot}`} cx={point.cx} cy={point.cy} r="4.2" className="analysis-vo2-run-dot">
                            <title>{`${point.label} · ${point.vdot.toFixed(1)} VO2max`}</title>
                          </circle>
                        ))}

                        {false && chart.latestTrendPoint ? (
                          <circle cx={chart.latestTrendPoint.cx} cy={chart.latestTrendPoint.cy} r="28" className="analysis-vo2-latest-glow" />
                        ) : null}

                        {false && chart.trendPoints.map((point, index) => (
                          <circle
                            key={`${point.x}-${point.y}`}
                            cx={point.cx}
                            cy={point.cy}
                            r={index === chart.trendPoints.length - 1 ? '5.5' : '3.5'}
                            className={`analysis-vo2-trend-dot${index === chart.trendPoints.length - 1 ? ' is-latest' : ''}`}
                          >
                            <title>{`${point.label} · ${point.y.toFixed(1)} VO2max`}</title>
                          </circle>
                        ))}

                        {scrubber && (
                          <>
                            <line
                              x1={scrubber.cx}
                              x2={scrubber.cx}
                              y1={chart.padTop}
                              y2={chart.height - chart.padBottom}
                              className="analysis-vo2-scrubber-line"
                            />
                            <circle
                              cx={scrubber.cx}
                              cy={scrubber.cy}
                              r="22"
                              className="analysis-vo2-scrubber-glow"
                            />
                            <circle
                              cx={scrubber.cx}
                              cy={scrubber.cy}
                              r="7"
                              className="analysis-vo2-scrubber-dot"
                            />
                          </>
                        )}
                      </g>
                    </svg>
                  </div>

                  <div className="analysis-vo2-kinetic-x-axis" aria-hidden="true">
                    {chart.xTicks.map((tick) => (
                      <span key={`${tick.x}-${tick.label}`}>{tick.label}</span>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <div className="analysis-vo2-empty-state">{copy.noSamples}</div>
            )}

            <footer className="analysis-vo2-kinetic-footer">
              <div className="analysis-vo2-kinetic-footer-copy">
                <h4>{copy.healthInsight}</h4>
                <p>{healthInsight}</p>
              </div>
              <div className="analysis-vo2-kinetic-footer-copy">
                <h4>{copy.primaryDriver}</h4>
                <p>{primaryDriver}</p>
              </div>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

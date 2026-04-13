import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import { formatDuration, formatPaceSeconds } from '../utils/format';
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
import { Line, Scatter } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, ScatterController, Title, Tooltip, Legend, Filler);

const KM_TO_MILE = 1.60934;
const DIST_COLORS = { '5k': '#4ccd73', '10k': '#5b8cff', half: '#f4b860', marathon: '#f07561' };
const cx = (...parts) => parts.filter(Boolean).join(' ');

function detailColor(distKey) {
  return DIST_COLORS[distKey] || '#f07561';
}

export default function PredictionDetail() {
  const { distKey } = useParams();
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    (async () => {
      setLoadState('loading');
      try {
        const [profileData, activitiesData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/activities'),
        ]);
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

  const raceDist = RACE_DISTANCES.find((distance) => distance.key === distKey) || null;
  const accentColor = detailColor(distKey);
  const allVdots = useMemo(() => collectAllVdotEntries(runs), [runs]);

  const historyData = useMemo(() => {
    if (!raceDist || allVdots.length < 1) return [];
    const rolling = computeRollingRepresentativeSeries(allVdots, VDOT_LOOKBACK_MS);
    if (!rolling.length) return [];

    const samples = [];
    let lastWeek = -1;
    rolling.forEach((point) => {
      const week = Math.floor(point.x / (7 * 24 * 60 * 60 * 1000));
      if (week !== lastWeek) {
        lastWeek = week;
        const timeMin = predictRaceTimeCalibrated(point.y, raceDist.meters, runs);
        samples.push({
          date: point.x,
          timeSec: timeMin ? Math.round(timeMin * 60) : null,
          vdot: point.y,
        });
      }
    });

    const last = rolling.at(-1);
    const latestMin = predictRaceTimeCalibrated(last.y, raceDist.meters, runs);
    const latestEntry = {
      date: last.x,
      timeSec: latestMin ? Math.round(latestMin * 60) : null,
      vdot: last.y,
    };
    if (!samples.length || samples.at(-1).date !== latestEntry.date) samples.push(latestEntry);
    return samples.filter((sample) => sample.timeSec > 0);
  }, [allVdots, raceDist, runs]);

  const nearRuns = useMemo(() => {
    if (!raceDist) return [];
    const targetKm = raceDist.meters / 1000;
    const lower = targetKm * 0.8;
    const upper = targetKm * 1.2;
    return runs
      .filter((run) => {
        const km = Number(run.distanceKm || 0);
        return km >= lower && km <= upper;
      })
      .map((run) => {
        const km = Number(run.distanceKm || 0);
        const sec = Number(run.movingTimeSeconds || 0);
        const paceSec = km > 0 ? sec / km : 0;
        return {
          ...run,
          normalizedSec: Math.round(paceSec * targetKm),
          paceSecPerKm: paceSec,
          date: new Date(run.startTime || run.startDate || 0),
        };
      })
      .filter((run) => run.normalizedSec > 0)
      .sort((a, b) => a.date - b.date);
  }, [raceDist, runs]);

  const stats = useMemo(() => {
    if (!raceDist || !historyData.length) return null;
    const times = historyData.map((sample) => sample.timeSec).filter((value) => value > 0);
    if (!times.length) return null;
    const latest = times.at(-1);
    const earliest = times[0];
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const diffSec = earliest - latest;
    const latestPaceSec = latest / (raceDist.meters / 1000);
    return {
      best,
      worst,
      latest,
      earliest,
      diffSec,
      improved: latest < earliest,
      latestPaceSec,
      confidence: Math.max(68, Math.min(96, 74 + (times.length * 4) + Math.min(nearRuns.length, 4))),
    };
  }, [historyData, nearRuns.length, raceDist]);

  const trendChartData = useMemo(() => {
    if (historyData.length < 2) return null;
    return {
      datasets: [{
        label: t('analysis.pred_detail_predicted'),
        data: historyData.map((sample) => ({ x: sample.date, y: sample.timeSec })),
        borderColor: accentColor,
        backgroundColor: `${accentColor}20`,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: accentColor,
        tension: 0.28,
        fill: true,
      }],
    };
  }, [accentColor, historyData, t]);

  const actualRunsChartData = useMemo(() => {
    if (!nearRuns.length) return null;
    return {
      datasets: [{
        label: t('analysis.pred_detail_actual'),
        data: nearRuns.map((run) => ({ x: run.date.getTime(), y: run.normalizedSec })),
        backgroundColor: `${accentColor}66`,
        borderColor: accentColor,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false,
      }],
    };
  }, [accentColor, nearRuns, t]);

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const distLabel = raceDist ? (lang === 'en' ? raceDist.labelEn : raceDist.labelZh) : '--';
  const paceUnitLabel = t(unit === 'mile' ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km');
  const fmtPace = (secPerKm) => formatPaceSeconds(unit === 'mile' ? secPerKm * KM_TO_MILE : secPerKm);
  const rangeLabel = useMemo(() => {
    if (!raceDist) return '--';
    const targetKm = raceDist.meters / 1000;
    return `${(targetKm * 0.8).toFixed(1)}-${(targetKm * 1.2).toFixed(1)} km`;
  }, [raceDist]);

  const scaleOpts = useMemo(() => ({
    x: {
      type: 'linear',
      grid: { display: false },
      ticks: {
        color: 'rgba(232, 226, 220, 0.55)',
        maxTicksLimit: 8,
        callback: (value) => new Date(value).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', year: '2-digit' }),
      },
    },
    y: {
      reverse: true,
      grid: { color: 'rgba(255,255,255,0.08)' },
      ticks: {
        color: 'rgba(232, 226, 220, 0.7)',
        callback: (value) => formatDuration(value),
      },
    },
  }), [lang]);

  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights', active: true },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  if (!raceDist) {
    return (
      <div className="analysis-stitch-page analysis-stitch-page--loading">
        <div className="analysis-stitch-loading">
          <p>{t('analysis.pred_detail_empty_title')}</p>
          <Link to="/analysis" className="analysis-stitch-inline-btn">{t('analysis.pred_detail_back')}</Link>
        </div>
      </div>
    );
  }

  if (loadState !== 'ready') {
    return <div className="analysis-stitch-page analysis-stitch-page--loading"><div className="analysis-stitch-loading">{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</div></div>;
  }

  return (
    <div className={`analysis-stitch-page runner-dashboard-page prediction-detail-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="analysis-stitch-sidebar">
        <div className="analysis-stitch-brand runner-dashboard-brand">
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
        <nav className="analysis-stitch-side-nav">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={cx('analysis-stitch-side-link', item.active && 'is-active')} onClick={() => navigate(item.route)}>
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="analysis-stitch-sidebar-footer">
          <button
            type="button"
            className="analysis-stitch-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="analysis-stitch-main">
        <header className="analysis-stitch-topbar runner-dashboard-shell-topbar">
          <div className="analysis-stitch-topbar-left">
            <div className="schedule-stitch-topnav">
              <span className="schedule-stitch-topnav-link is-active">{distLabel}</span>
            </div>
          </div>
          <div className="analysis-stitch-topbar-actions">
            <div className="analysis-stitch-topbar-profile-actions">
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/runs')} aria-label={t('analysis.stitch_open_runs')}>
                <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-avatar" aria-label={t('analysis.stitch_edit_profile')} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="analysis-stitch-canvas">
          <section className="analysis-stitch-grid analysis-stitch-grid--hero prediction-detail-grid">
            <article className="analysis-stitch-card prediction-detail-hero-card">
              <div className="prediction-detail-band" style={{ background: `linear-gradient(135deg, ${accentColor}, #2d2b2b)` }}>
                <span>{t('analysis.pred_detail_hero_kicker')}</span>
                <strong>{distLabel}</strong>
              </div>
              <div className="prediction-detail-hero-body">
                <div className="prediction-detail-hero-copy">
                  <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_subtitle')}</span>
                  <h2>{stats ? formatDuration(stats.latest) : '--'}</h2>
                  <p>{t('analysis.pred_detail_signal_copy', { dist: distLabel })}</p>
                </div>
                <div className="prediction-detail-hero-meta">
                  <div className="prediction-detail-kpi">
                    <span>{t('analysis.pred_detail_pace')}</span>
                    <strong>{stats ? `${fmtPace(stats.latestPaceSec)} ${paceUnitLabel}` : '--'}</strong>
                  </div>
                  <div className="prediction-detail-kpi">
                    <span>{t('analysis.pred_detail_runs')}</span>
                    <strong>{nearRuns.length}</strong>
                  </div>
                  <div className="prediction-detail-kpi">
                    <span>{t('analysis.stitch_confidence', { value: stats?.confidence ?? 0 })}</span>
                    <strong>{historyData.length}</strong>
                  </div>
                </div>
              </div>
            </article>

            <div className="analysis-stitch-side-stack">
              <article className="analysis-stitch-card prediction-detail-sidecard">
                <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_signal_title')}</span>
                <strong className="prediction-detail-sidecard-value" style={{ color: accentColor }}>
                  {stats?.diffSec ? `${stats.improved ? '-' : '+'}${formatDuration(Math.abs(stats.diffSec))}` : '--'}
                </strong>
                <p>{t('analysis.pred_history_since_start')}</p>
                <div className="prediction-detail-chip-row">
                  <span className={cx('analysis-stitch-status-pill', stats?.improved ? 'is-good' : 'is-warn')}>{stats?.improved ? t('profile.dashboard_readiness_ready') : t('profile.dashboard_readiness_build')}</span>
                  <span className="analysis-stitch-status-pill">{rangeLabel}</span>
                </div>
              </article>

              <article className="analysis-stitch-card prediction-detail-sidecard">
                <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                <strong className="prediction-detail-sidecard-value">{nearRuns.length ? formatDuration(Math.min(...nearRuns.map((run) => run.normalizedSec))) : '--'}</strong>
                <p>{t('analysis.pred_detail_actual_copy', { dist: distLabel })}</p>
              </article>
            </div>
          </section>

          <section className="analysis-stitch-grid analysis-stitch-grid--summary prediction-detail-summary-grid">
            <article className="analysis-stitch-card analysis-stitch-card--metric analysis-stitch-card--metric-accent">
              <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_best')}</span>
              <strong>{stats ? formatDuration(stats.best) : '--'}</strong>
              <p>{t('analysis.pred_detail_trend_copy')}</p>
            </article>
            <article className="analysis-stitch-card analysis-stitch-card--metric">
              <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_worst')}</span>
              <strong>{stats ? formatDuration(stats.worst) : '--'}</strong>
              <p>{t('analysis.pred_detail_actual_copy', { dist: distLabel })}</p>
            </article>
            <article className="analysis-stitch-card analysis-stitch-card--metric">
              <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_runs')}</span>
              <strong>{nearRuns.length}</strong>
              <p>{t('analysis.pred_detail_table_title')}</p>
            </article>
          </section>

          <section className="analysis-stitch-card prediction-detail-chart-card">
            <div className="analysis-stitch-table-head prediction-detail-chart-head">
              <div>
                <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_trend_title')}</span>
                <h2>{distLabel}</h2>
              </div>
              <span className="analysis-stitch-confidence-pill">{t('analysis.stitch_confidence', { value: stats?.confidence ?? 0 })}</span>
            </div>
            {trendChartData ? (
              <div className="prediction-detail-chart-wrap">
                <Line
                  data={trendChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          title: (items) => (items.length ? new Date(items[0].parsed.x).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' }) : ''),
                          label: (context) => `${t('analysis.pred_detail_predicted')}: ${formatDuration(context.parsed.y)}`,
                        },
                      },
                    },
                    scales: scaleOpts,
                  }}
                />
              </div>
            ) : (
              <div className="prediction-detail-empty">
                <strong>{t('analysis.pred_detail_empty_title')}</strong>
                <p>{t('analysis.pred_detail_empty_copy')}</p>
              </div>
            )}
          </section>

          <section className="analysis-stitch-card prediction-detail-chart-card">
            <div className="analysis-stitch-table-head prediction-detail-chart-head">
              <div>
                <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                <h2>{t('analysis.pred_detail_actual_title')}</h2>
              </div>
              <span className="analysis-stitch-confidence-pill">{rangeLabel}</span>
            </div>
            {actualRunsChartData ? (
              <div className="prediction-detail-chart-wrap prediction-detail-chart-wrap--short">
                <Scatter
                  data={actualRunsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          title: (items) => {
                            if (!items.length) return '';
                            const run = nearRuns[items[0].dataIndex];
                            return run ? (run.name || t('runs.default_run_name')) : '';
                          },
                          label: (context) => {
                            const run = nearRuns[context.dataIndex];
                            if (!run) return [];
                            return [
                              run.date.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                              `${t('analysis.pred_detail_normalized')}: ${formatDuration(context.parsed.y)}`,
                              `${t('runs.metric_distance')}: ${Number(run.distanceKm).toFixed(2)} km`,
                            ];
                          },
                        },
                      },
                    },
                    scales: scaleOpts,
                  }}
                />
              </div>
            ) : (
              <div className="prediction-detail-empty">
                <strong>{t('analysis.pred_detail_empty_title')}</strong>
                <p>{t('analysis.pred_detail_actual_copy', { dist: distLabel })}</p>
              </div>
            )}
          </section>

          <section className="analysis-stitch-card analysis-stitch-card--table">
            <div className="analysis-stitch-table-head">
              <div>
                <span className="analysis-stitch-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                <h2>{t('analysis.pred_detail_table_title')}</h2>
              </div>
              <span className="analysis-stitch-confidence-pill">{t('analysis.pred_detail_runs')}: {nearRuns.length}</span>
            </div>
            {nearRuns.length ? (
              <>
                <div className="analysis-stitch-table-wrap">
                  <table className="analysis-stitch-table prediction-detail-table">
                    <thead>
                      <tr>
                        <th>{t('analysis.pred_detail_col_date')}</th>
                        <th>{t('analysis.pred_detail_col_name')}</th>
                        <th>{t('runs.metric_distance')}</th>
                        <th>{t('analysis.pred_detail_col_time')}</th>
                        <th>{t('analysis.pred_detail_col_norm')}</th>
                        <th>{t('analysis.pred_detail_col_pace')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nearRuns.slice().reverse().map((run) => {
                        const isBest = run.normalizedSec === stats?.best;
                        return (
                          <tr key={run.id || `${run.name}-${run.date.getTime()}`} onClick={() => navigate(`/run/${run.id}`)}>
                            <td>{run.date.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                            <td className={isBest ? 'is-accent' : ''}>
                              <div className="prediction-detail-run-cell">
                                <span>{run.name || t('runs.default_run_name')}</span>
                                {isBest ? <span className="prediction-detail-pr-badge">PR</span> : null}
                              </div>
                            </td>
                            <td>{Number(run.distanceKm).toFixed(2)} km</td>
                            <td>{formatDuration(Number(run.movingTimeSeconds || 0))}</td>
                            <td className="is-accent">{formatDuration(run.normalizedSec)}</td>
                            <td>{fmtPace(run.paceSecPerKm)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="analysis-stitch-table-actions">
                  <button type="button" className="analysis-stitch-inline-btn" onClick={() => navigate('/runs')}>{t('analysis.stitch_open_runs')}</button>
                  <button type="button" className="analysis-stitch-inline-btn" onClick={() => navigate('/analysis')}>{t('analysis.pred_detail_back')}</button>
                </div>
              </>
            ) : (
              <div className="prediction-detail-empty">
                <strong>{t('analysis.pred_detail_empty_title')}</strong>
                <p>{t('analysis.pred_detail_actual_copy', { dist: distLabel })}</p>
              </div>
            )}
          </section>

          <footer className="analysis-stitch-footer">
            <a href="/terms">{t('landing.stitch_footer_terms')}</a>
            <a href="/privacy">{t('landing.stitch_footer_privacy')}</a>
            <a href="#support">{t('landing.stitch_footer_support')}</a>
            <a href="#contact">{t('landing.stitch_footer_contact')}</a>
            <p>{t('landing.stitch_footer_copy')}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}

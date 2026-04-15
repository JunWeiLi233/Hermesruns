import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import CoachIdentityBadge from '../components/CoachIdentityBadge';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import { resolveAssignedCoach } from '../utils/coachIdentity';
import { formatDuration, formatPaceSeconds, formatDistance, formatDistanceValue, getDistanceUnitLabel } from '../utils/format';
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
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { theme } = useTheme();
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

  const coachJudgment = useMemo(() => {
    if (!stats) {
      return {
        title: t('analysis.pred_marathon_judgment_title'),
        body: t('analysis.pred_marathon_judgment_body_empty'),
        insights: [
          t('analysis.pred_marathon_judgment_empty_1'),
          t('analysis.pred_marathon_judgment_empty_2'),
          t('analysis.pred_marathon_judgment_empty_3'),
        ],
      };
    }

    const reliability = Math.max(72, Math.min(96, stats.confidence + Math.min(historyData.length, 3)));
    const improving = stats.diffSec > 0;

    return {
      title: t('analysis.pred_marathon_judgment_title'),
      body: t(improving ? 'analysis.pred_marathon_judgment_body_up' : 'analysis.pred_marathon_judgment_body_flat', {
        delta: formatDuration(Math.abs(stats.diffSec || 0)),
        reliability,
      }),
      insights: [
        t(improving ? 'analysis.pred_marathon_judgment_insight_up_1' : 'analysis.pred_marathon_judgment_insight_flat_1'),
        t('analysis.pred_marathon_judgment_insight_2', { runs: nearRuns.length }),
        t('analysis.pred_marathon_judgment_insight_3', { confidence: stats.confidence }),
      ],
    };
  }, [historyData.length, nearRuns.length, stats, t]);

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);
  const distLabel = raceDist ? (lang === 'en' ? raceDist.labelEn : raceDist.labelZh) : '--';
  const topnavTitle = distLabel;
  const isMarathonDetail = distKey === 'marathon';
  const noRelatedRunsCopy = t('analysis.pred_detail_no_related_runs');
  const paceUnitLabel = t(unit === 'mile' ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km');
  const fmtPace = (secPerKm) => formatPaceSeconds(unit === 'mile' ? secPerKm * KM_TO_MILE : secPerKm);
  const rangeLabel = useMemo(() => {
    if (!raceDist) return '--';
    const targetKm = raceDist.meters / 1000;
    const lower = formatDistanceValue(targetKm * 0.8, unit, 1);
    const upper = formatDistanceValue(targetKm * 1.2, unit, 1);
    return `${lower}-${upper} ${getDistanceUnitLabel(lang, unit)}`;
  }, [lang, raceDist, unit]);
  const isLightTheme = theme === 'light';

  const scaleOpts = useMemo(() => ({
    x: {
      type: 'linear',
      grid: { display: false },
      ticks: {
        color: isLightTheme ? 'rgba(89, 92, 93, 0.78)' : 'rgba(232, 226, 220, 0.55)',
        maxTicksLimit: 8,
        callback: (value) => new Date(value).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', year: '2-digit' }),
      },
    },
    y: {
      reverse: true,
      grid: { color: isLightTheme ? 'rgba(171, 173, 174, 0.26)' : 'rgba(255,255,255,0.08)' },
      ticks: {
        color: isLightTheme ? 'rgba(44, 47, 48, 0.84)' : 'rgba(232, 226, 220, 0.7)',
        callback: (value) => formatDuration(value),
      },
    },
  }), [isLightTheme, lang]);

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
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">
          <p>{t('analysis.pred_detail_empty_title')}</p>
          <Link to="/analysis" className="runner-shell-inline-btn">{t('analysis.pred_detail_back')}</Link>
        </div>
      </div>
    );
  }

  if (loadState !== 'ready') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</div></div>;
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page prediction-detail-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
            <button key={item.key} type="button" className={cx('runner-shell-side-link', item.active && 'is-active')} onClick={() => navigate(item.route)}>
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
              <button type="button" className="runner-shell-avatar" aria-label={t('analysis.stitch_edit_profile')} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          {isMarathonDetail ? (
            <>
              <section className="prediction-marathon-hero" style={{ '--prediction-accent': accentColor }}>
                <div className="prediction-marathon-hero-copy">
                  <span className="prediction-marathon-live-pill">{t('analysis.pred_marathon_live')}</span>
                  <h1>{distLabel}</h1>
                  <div className="prediction-marathon-time">{stats ? formatDuration(stats.latest) : '--'}</div>
                </div>
                <div className="prediction-marathon-hero-meta">
                  <div className="prediction-marathon-meta-pair">
                    <div>
                      <span>{t('analysis.pred_detail_pace')}</span>
                      <strong>{stats ? `${fmtPace(stats.latestPaceSec)} ${paceUnitLabel}` : '--'}</strong>
                    </div>
                    <div>
                      <span>{t('analysis.pred_marathon_confidence')}</span>
                      <strong>{stats ? `${stats.confidence}%` : '--'}</strong>
                    </div>
                  </div>
                  <div className="prediction-marathon-confidence-bar" aria-hidden="true">
                    <div style={{ width: `${stats?.confidence ?? 0}%` }} />
                  </div>
                  <p>{t('analysis.pred_marathon_reliability', { weeks: historyData.length || 0 })}</p>
                </div>
              </section>

              <section className="prediction-marathon-command-grid">
                <article className="prediction-marathon-chart-card">
                  <div className="prediction-marathon-section-head">
                    <div>
                      <h2>{t('analysis.pred_detail_trend_title')}</h2>
                      <p>{t('analysis.pred_marathon_trend_copy')}</p>
                    </div>
                    <div className="prediction-marathon-window-pills" aria-hidden="true">
                      <span>{t('analysis.pred_marathon_window_short')}</span>
                      <span className="is-active">{t('analysis.pred_marathon_window_long')}</span>
                    </div>
                  </div>
                  {trendChartData ? (
                    <div className="prediction-marathon-chart-wrap">
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
                </article>

                <div className="prediction-marathon-side-stack">
                  <article className="prediction-marathon-judgment-card">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} className="prediction-marathon-coach-badge" />
                    <h2>{coachJudgment.title}</h2>
                    <p>{coachJudgment.body}</p>
                    <div className="prediction-marathon-insight-list">
                      {coachJudgment.insights.map((insight) => (
                        <div key={insight} className="prediction-marathon-insight-row">
                          <AppIcon name="check_circle" className="runner-dashboard-side-link-icon" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <button type="button" className="prediction-marathon-action-card" onClick={() => navigate('/analysis')}>
                    <div>
                      <span>{t('analysis.pred_marathon_action_kicker')}</span>
                      <strong>{t('analysis.pred_marathon_action_title')}</strong>
                    </div>
                    <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
                  </button>
                </div>
              </section>

              <section className="prediction-marathon-evidence-grid">
                <section className="analysis-overview-card prediction-detail-chart-card">
                  <div className="analysis-overview-table-head prediction-detail-chart-head">
                    <div>
                      <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                      <h2>{t('analysis.pred_detail_actual_title')}</h2>
                    </div>
                    <span className="analysis-overview-confidence-pill">{rangeLabel}</span>
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
                                    `${t('runs.metric_distance')}: ${formatDistance(Number(run.distanceKm), 2, lang, unit)}`,
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
                    <div className="prediction-detail-empty is-record-empty">
                      <p>{noRelatedRunsCopy}</p>
                    </div>
                  )}
                </section>

                <section className="analysis-overview-card analysis-overview-card--prediction-table">
                  <div className="analysis-overview-table-head">
                    <div>
                      <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                      <h2>{t('analysis.pred_detail_table_title')}</h2>
                    </div>
                    <span className="analysis-overview-confidence-pill">{t('analysis.pred_detail_runs')}: {nearRuns.length}</span>
                  </div>
                  {nearRuns.length ? (
                    <>
                      <div className="analysis-overview-table-wrap">
                        <table className="analysis-overview-table prediction-detail-table">
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
                                      {isBest ? <span className="prediction-detail-pr-badge">{t('analysis.pred_detail_pr_badge')}</span> : null}
                                    </div>
                                  </td>
                                  <td>{formatDistance(Number(run.distanceKm), 2, lang, unit)}</td>
                                  <td>{formatDuration(Number(run.movingTimeSeconds || 0))}</td>
                                  <td className="is-accent">{formatDuration(run.normalizedSec)}</td>
                                  <td>{fmtPace(run.paceSecPerKm)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="analysis-overview-table-actions">
                        <button type="button" className="runner-shell-inline-btn" onClick={() => navigate('/runs')}>{t('analysis.stitch_open_runs')}</button>
                        <button type="button" className="runner-shell-inline-btn" onClick={() => navigate('/analysis')}>{t('analysis.pred_detail_back')}</button>
                      </div>
                    </>
                  ) : (
                    <div className="prediction-detail-empty is-record-empty">
                      <p>{noRelatedRunsCopy}</p>
                    </div>
                  )}
                </section>
              </section>
            </>
          ) : (
            <>
          <section className="analysis-overview-grid analysis-overview-grid--hero prediction-detail-grid">
            <article className="analysis-overview-card prediction-detail-hero-card">
              <div className="prediction-detail-band" style={{ background: `linear-gradient(135deg, ${accentColor}, #2d2b2b)` }}>
                <span>{t('analysis.pred_detail_hero_kicker')}</span>
                <strong>{distLabel}</strong>
              </div>
              <div className="prediction-detail-hero-body">
                <div className="prediction-detail-hero-copy">
                  <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_subtitle')}</span>
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

            <div className="analysis-overview-side-stack">
              <article className="analysis-overview-card prediction-detail-sidecard">
                <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_signal_title')}</span>
                <strong className="prediction-detail-sidecard-value" style={{ color: accentColor }}>
                  {stats?.diffSec ? `${stats.improved ? '-' : '+'}${formatDuration(Math.abs(stats.diffSec))}` : '--'}
                </strong>
                <p>{t('analysis.pred_history_since_start')}</p>
                <div className="prediction-detail-chip-row">
                  <span className={cx('analysis-overview-status-pill', stats?.improved ? 'is-good' : 'is-warn')}>{stats?.improved ? t('profile.dashboard_readiness_ready') : t('profile.dashboard_readiness_build')}</span>
                  <span className="analysis-overview-status-pill">{rangeLabel}</span>
                </div>
              </article>

              <article className="analysis-overview-card prediction-detail-sidecard">
                <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                <strong className="prediction-detail-sidecard-value">{nearRuns.length ? formatDuration(Math.min(...nearRuns.map((run) => run.normalizedSec))) : '--'}</strong>
                <p>{nearRuns.length ? t('analysis.pred_detail_actual_copy', { dist: distLabel }) : noRelatedRunsCopy}</p>
              </article>
            </div>
          </section>

          <section className="analysis-overview-grid analysis-overview-grid--summary prediction-detail-summary-grid">
            <article className="analysis-overview-card analysis-overview-card--metric analysis-overview-card--intensity">
              <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_best')}</span>
              <strong>{stats ? formatDuration(stats.best) : '--'}</strong>
              <p>{t('analysis.pred_detail_trend_copy')}</p>
            </article>
            <article className="analysis-overview-card analysis-overview-card--metric">
              <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_worst')}</span>
              <strong>{stats ? formatDuration(stats.worst) : '--'}</strong>
              <p>{t('analysis.pred_detail_actual_copy', { dist: distLabel })}</p>
            </article>
            <article className="analysis-overview-card analysis-overview-card--metric">
              <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_runs')}</span>
              <strong>{nearRuns.length}</strong>
              <p>{t('analysis.pred_detail_table_title')}</p>
            </article>
          </section>

          <section className="analysis-overview-card prediction-detail-chart-card">
            <div className="analysis-overview-table-head prediction-detail-chart-head">
              <div>
                <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_trend_title')}</span>
                <h2>{distLabel}</h2>
              </div>
              <span className="analysis-overview-confidence-pill">{t('analysis.stitch_confidence', { value: stats?.confidence ?? 0 })}</span>
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

          <section className="analysis-overview-card prediction-detail-chart-card">
            <div className="analysis-overview-table-head prediction-detail-chart-head">
              <div>
                <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                <h2>{t('analysis.pred_detail_actual_title')}</h2>
              </div>
              <span className="analysis-overview-confidence-pill">{rangeLabel}</span>
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
                              `${t('runs.metric_distance')}: ${formatDistance(Number(run.distanceKm), 2, lang, unit)}`,
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
              <div className="prediction-detail-empty is-record-empty">
                <p>{noRelatedRunsCopy}</p>
              </div>
            )}
          </section>

          <section className="analysis-overview-card analysis-overview-card--prediction-table">
            <div className="analysis-overview-table-head">
              <div>
                <span className="analysis-overview-card-kicker">{t('analysis.pred_detail_actual_title')}</span>
                <h2>{t('analysis.pred_detail_table_title')}</h2>
              </div>
              <span className="analysis-overview-confidence-pill">{t('analysis.pred_detail_runs')}: {nearRuns.length}</span>
            </div>
            {nearRuns.length ? (
              <>
                <div className="analysis-overview-table-wrap">
                  <table className="analysis-overview-table prediction-detail-table">
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
                                {isBest ? <span className="prediction-detail-pr-badge">{t('analysis.pred_detail_pr_badge')}</span> : null}
                              </div>
                            </td>
                            <td>{formatDistance(Number(run.distanceKm), 2, lang, unit)}</td>
                            <td>{formatDuration(Number(run.movingTimeSeconds || 0))}</td>
                            <td className="is-accent">{formatDuration(run.normalizedSec)}</td>
                            <td>{fmtPace(run.paceSecPerKm)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="analysis-overview-table-actions">
                  <button type="button" className="runner-shell-inline-btn" onClick={() => navigate('/runs')}>{t('analysis.stitch_open_runs')}</button>
                  <button type="button" className="runner-shell-inline-btn" onClick={() => navigate('/analysis')}>{t('analysis.pred_detail_back')}</button>
                </div>
              </>
            ) : (
              <div className="prediction-detail-empty is-record-empty">
                <p>{noRelatedRunsCopy}</p>
              </div>
            )}
          </section>

          <footer className="runner-shell-footer">
            <FooterNavLinks />
            <p>{t('landing.stitch_footer_copy')}</p>
          </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

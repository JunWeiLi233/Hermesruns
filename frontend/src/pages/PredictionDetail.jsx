import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import { formatDuration, formatPaceSeconds } from '../utils/format';
import { predictRaceTimeCalibrated, RACE_DISTANCES, collectAllVdotEntries, computeRollingRepresentativeSeries, VDOT_LOOKBACK_MS } from '../utils/vdot';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, ScatterController, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, ScatterController, Title, Tooltip, Legend, Filler);

const KM_TO_MILE = 1.60934;

const DIST_COLORS = { '5k': '#22c55e', '10k': '#3b82f6', 'half': '#f59e0b', 'marathon': '#dc2626' };

export default function PredictionDetail() {
  const { distKey } = useParams();
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { isDark } = useTheme();
  const { isMile } = useUnit();
  const navigate = useNavigate();

  const [runs, setRuns] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    apiJson('/api/activities').then(data => {
      setRuns(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [isAuthenticated]);

  const raceDist = RACE_DISTANCES.find(rd => rd.key === distKey);
  const color = DIST_COLORS[distKey] || '#3b82f6';
  const textColor = isDark ? '#e2e8f0' : '#334155';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const allVdots = useMemo(() => collectAllVdotEntries(runs), [runs]);

  const historyData = useMemo(() => {
    if (!raceDist || allVdots.length < 1) return null;
    const rolling = computeRollingRepresentativeSeries(allVdots, VDOT_LOOKBACK_MS);
    if (!rolling.length) return null;

    const samples = [];
    let lastWeek = -1;
    rolling.forEach((pt) => {
      const week = Math.floor(pt.x / (7 * 24 * 60 * 60 * 1000));
      if (week !== lastWeek) {
        lastWeek = week;
        const timeMin = predictRaceTimeCalibrated(pt.y, raceDist.meters, runs);
        samples.push({
          date: pt.x,
          timeSec: timeMin ? Math.round(timeMin * 60) : null,
          vdot: pt.y,
        });
      }
    });

    const last = rolling[rolling.length - 1];
    const timeMinLast = predictRaceTimeCalibrated(last.y, raceDist.meters, runs);
    const entry = {
      date: last.x,
      timeSec: timeMinLast ? Math.round(timeMinLast * 60) : null,
      vdot: last.y,
    };
    if (!samples.length || samples[samples.length - 1].date !== entry.date) samples.push(entry);

    return samples;
  }, [allVdots, raceDist, runs]);

  // Stats
  const stats = useMemo(() => {
    if (!historyData || historyData.length < 1) return null;
    const times = historyData.filter(s => s.timeSec > 0).map(s => s.timeSec);
    if (!times.length) return null;
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const latest = times[times.length - 1];
    const earliest = times[0];
    const improved = latest < earliest;
    const diffSec = earliest - latest;
    // Pace
    const latestPaceSec = latest / (raceDist.meters / 1000);
    return { best, worst, latest, earliest, improved, diffSec, latestPaceSec };
  }, [historyData, raceDist]);

  // Actual runs near this distance (±20%)
  const nearRuns = useMemo(() => {
    if (!raceDist) return [];
    const targetKm = raceDist.meters / 1000;
    const lo = targetKm * 0.8, hi = targetKm * 1.2;
    return runs
      .filter(r => {
        const km = Number(r.distanceKm || 0);
        return km >= lo && km <= hi;
      })
      .map(r => {
        const km = Number(r.distanceKm || 0);
        const sec = Number(r.movingTimeSeconds || 0);
        // Normalize to target distance
        const paceSec = sec / km;
        const normalizedSec = Math.round(paceSec * targetKm);
        return {
          ...r,
          normalizedSec,
          date: new Date(r.startTime || r.startDate || 0),
          paceSecPerKm: paceSec,
        };
      })
      .sort((a, b) => a.date - b.date);
  }, [runs, raceDist]);

  // Chart: prediction trend line
  const trendChartData = useMemo(() => {
    if (!historyData || historyData.length < 2) return null;
    return {
      datasets: [{
        label: t('analysis.pred_detail_predicted'),
        data: historyData.map(s => ({ x: s.date, y: s.timeSec })),
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: color,
        pointHoverRadius: 8,
        tension: 0.3,
        fill: true,
      }],
    };
  }, [historyData, color, t]);

  // Chart: actual runs scatter
  const actualRunsChartData = useMemo(() => {
    if (!nearRuns.length) return null;
    return {
      datasets: [{
        label: t('analysis.pred_detail_actual'),
        data: nearRuns.map(r => ({ x: r.date.getTime(), y: r.normalizedSec })),
        backgroundColor: color + '60',
        borderColor: color,
        pointRadius: 6,
        pointHoverRadius: 9,
        showLine: false,
      }],
    };
  }, [nearRuns, color, t]);

  if (!raceDist) {
    return (
      <AuthenticatedPageChrome>
        <main className="dashboard-container" style={{ padding: 40, textAlign: 'center' }}>
          <p>Unknown distance.</p>
          <Link to="/analysis">{t('analysis.back_to_profile')}</Link>
        </main>
      </AuthenticatedPageChrome>
    );
  }

  const distLabel = lang === 'en' ? raceDist.labelEn : raceDist.labelZh;
  const fmtPace = (secPerKm) => formatPaceSeconds(isMile ? secPerKm * KM_TO_MILE : secPerKm);

  const scaleOpts = {
    x: {
      type: 'linear',
      grid: { display: false },
      ticks: {
        color: textColor,
        maxTicksLimit: 10,
        callback: (value) => new Date(value).toLocaleDateString(lang, { month: 'short', year: '2-digit' }),
      },
    },
    y: {
      reverse: true,
      grid: { color: gridColor },
      ticks: {
        color: textColor,
        callback: (v) => formatDuration(v),
      },
    },
  };

  return (
    <AuthenticatedPageChrome>

      <main className="dashboard-container history-container">
        {/* Hero */}
        <section className="card" style={{ marginBottom: 24 }}>
          <Link to="/analysis" style={{ fontSize: '0.85rem', color: 'var(--classic-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            &lsaquo; {t('analysis.pred_detail_back')}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 8, height: 48, borderRadius: 4, background: color }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{distLabel}</h1>
              <p className="analysis-muted" style={{ margin: '4px 0 0' }}>{t('analysis.pred_detail_subtitle')}</p>
            </div>
            {stats && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-strong, #1e293b)' }}>{formatDuration(stats.latest)}</div>
                {stats.diffSec !== 0 && (
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: stats.improved ? '#16a34a' : '#dc2626' }}>
                    {stats.improved ? '\u25BC' : '\u25B2'} {formatDuration(Math.abs(stats.diffSec))} {t('analysis.pred_history_since_start')}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
            <div className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('analysis.pred_detail_best')}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{formatDuration(stats.best)}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('analysis.pred_detail_worst')}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-strong)' }}>{formatDuration(stats.worst)}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('analysis.pred_detail_pace')}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-strong)' }}>{fmtPace(stats.latestPaceSec)} {t(isMile ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km')}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('analysis.pred_detail_runs')}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-strong)' }}>{nearRuns.length}</div>
            </div>
          </div>
        )}

        {/* Main prediction trend chart */}
        {trendChartData && (
          <section className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem' }}>{t('analysis.pred_detail_trend_title')}</h2>
            <p className="analysis-muted" style={{ margin: '0 0 16px', fontSize: '0.85rem' }}>{t('analysis.pred_detail_trend_copy')}</p>
            <div style={{ position: 'relative', height: 360 }}>
              <Line data={trendChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleDateString(lang, { year: 'numeric', month: 'long' }) : '',
                      label: (ctx) => ctx.parsed.y ? `${t('analysis.pred_detail_predicted')}: ${formatDuration(ctx.parsed.y)}` : '--',
                    },
                  },
                },
                scales: scaleOpts,
              }} />
            </div>
          </section>
        )}

        {/* Actual runs scatter */}
        {actualRunsChartData && (
          <section className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem' }}>{t('analysis.pred_detail_actual_title')}</h2>
            <p className="analysis-muted" style={{ margin: '0 0 16px', fontSize: '0.85rem' }}>{t('analysis.pred_detail_actual_copy', { dist: distLabel })}</p>
            <div style={{ position: 'relative', height: 320 }}>
              <Scatter data={actualRunsChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      title: (items) => {
                        if (!items.length) return '';
                        const idx = items[0].dataIndex;
                        const run = nearRuns[idx];
                        return run ? (run.name || t('runs.default_run_name')) : '';
                      },
                      label: (ctx) => {
                        const idx = ctx.dataIndex;
                        const run = nearRuns[idx];
                        const lines = [];
                        if (run) {
                          lines.push(`${run.date.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' })}`);
                          lines.push(`${t('analysis.pred_detail_normalized')}: ${formatDuration(ctx.parsed.y)}`);
                          lines.push(`${t('runs.metric_distance')}: ${Number(run.distanceKm).toFixed(2)} km`);
                        }
                        return lines;
                      },
                    },
                  },
                },
                scales: scaleOpts,
              }} />
            </div>
          </section>
        )}

        {/* Run table */}
        {nearRuns.length > 0 && (
          <section className="card">
            <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>{t('analysis.pred_detail_table_title')}</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('analysis.pred_detail_col_date')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('analysis.pred_detail_col_name')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('runs.metric_distance')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('analysis.pred_detail_col_time')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('analysis.pred_detail_col_norm')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('analysis.pred_detail_col_pace')}</th>
                  </tr>
                </thead>
                <tbody>
                  {nearRuns.slice().reverse().map((r, i) => {
                    const isBest = r.normalizedSec === stats?.best;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color, #eee)', background: isBest ? color + '10' : 'transparent' }}>
                        <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{r.date.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td style={{ padding: '10px 8px', fontSize: '0.85rem', fontWeight: isBest ? 700 : 400 }}>
                          <Link to={`/run/${r.id}`} style={{ color: isBest ? color : 'var(--text-strong)', textDecoration: 'none' }}>
                            {r.name || t('runs.default_run_name')}
                          </Link>
                          {isBest && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: color, color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>PR</span>}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.85rem' }}>{Number(r.distanceKm).toFixed(2)} km</td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.85rem' }}>{formatDuration(Number(r.movingTimeSeconds))}</td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.85rem', fontWeight: 700, color: isBest ? color : 'var(--text-strong)' }}>{formatDuration(r.normalizedSec)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', fontSize: '0.85rem' }}>{fmtPace(r.paceSecPerKm)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </AuthenticatedPageChrome>
  );
}

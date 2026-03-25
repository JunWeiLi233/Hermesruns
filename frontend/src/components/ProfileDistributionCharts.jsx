import { useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from 'chart.js';
import {
  filterRunsLastDays,
  computeZoneValues,
  distanceBucketLabelsKm,
} from '../utils/profileDistributions';

ChartJS.register(ArcElement, Tooltip);

const PACE_COLORS = ['#14532d', '#166534', '#15803d', '#22c55e', '#4ade80', '#86efac'];
const DIST_COLORS = ['#1e3a5f', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
const HR_COLORS = ['#7f1d1d', '#991b1b', '#dc2626', '#f87171', '#fda4af', '#fecdd3'];

const DAYS = 28;

function formatMetricValue(mode, v, isMile, t) {
  if (mode === 'count') return String(Math.round(v));
  if (mode === 'load') return String(Math.round(v));
  const num = isMile ? v * 0.621371 : v;
  return `${num.toFixed(1)} ${isMile ? t('analysis.unit_distance_mile') : t('analysis.unit_distance_km')}`;
}

function ZoneCard({
  title,
  zoneKind,
  labels,
  colors,
  runs,
  isMile,
  t,
}) {
  const [metric, setMetric] = useState('distance');

  const { values, total, percentages, chartData, maxVal } = useMemo(() => {
    const { values: vals } = computeZoneValues(runs, zoneKind, metric);
    const tot = vals.reduce((a, b) => a + b, 0);
    const pcts = tot > 0 ? vals.map((v) => (100 * v) / tot) : vals.map(() => 0);
    const maxV = Math.max(...vals, 1e-6);
    const hasData = tot > 0;
    const data = {
      labels,
      datasets: [
        {
          data: hasData ? vals : [1],
          backgroundColor: hasData ? colors : ['rgba(148, 163, 184, 0.35)'],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
    return { values: vals, total: tot, percentages: pcts, chartData: data, maxVal: maxV };
  }, [runs, zoneKind, metric, labels, colors]);

  const doughnutOptions = useMemo(
    () => ({
      cutout: '75%',
      rotation: -90,
      circumference: 180,
      aspectRatio: 2,
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: total > 0,
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              if (!total) return '';
              const raw = values[i];
              const pct = percentages[i].toFixed(1);
              const formatted = formatMetricValue(metric, raw, isMile, t);
              return `${labels[i]}: ${formatted} (${pct}%)`;
            },
          },
        },
      },
    }),
    [total, values, percentages, labels, metric, isMile, t],
  );

  return (
    <article className="profile-zone-card">
      <div className="profile-zone-card-head">
        <h3 className="profile-zone-card-title">{title}</h3>
        <select
          className="filter-dropdown profile-zone-metric-select"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          aria-label={t('profile.distribution_metric_aria')}
        >
          <option value="load">{t('profile.distribution_metric_load')}</option>
          <option value="count">{t('profile.distribution_metric_count')}</option>
          <option value="distance">{t('profile.distribution_metric_distance')}</option>
        </select>
      </div>
      {runs.length === 0 ? (
        <p className="profile-zone-empty">{t('profile.distribution_no_runs')}</p>
      ) : (
        <div className="profile-zone-card-body">
          <div className="profile-zone-donut-wrap">
            <Doughnut data={chartData} options={doughnutOptions} />
          </div>
          <ul className="profile-zone-rows" aria-label={title}>
            {labels.map((label, i) => (
              <li key={label} className="profile-zone-row">
                <span className="profile-zone-pct">
                  {total > 0 ? `${percentages[i].toFixed(1)}%` : '—'}
                </span>
                <span className="profile-zone-label">{label}</span>
                <span className="profile-zone-bar-wrap">
                  <span
                    className="profile-zone-bar"
                    style={{
                      width: `${(values[i] / maxVal) * 100}%`,
                      background: colors[i],
                    }}
                  />
                </span>
                <span className="profile-zone-num">
                  {total > 0 ? formatMetricValue(metric, values[i], isMile, t) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function ProfileDistributionCharts({ runs, isMile, t }) {
  const windowRuns = useMemo(() => filterRunsLastDays(runs, DAYS), [runs]);

  const paceLabels = useMemo(
    () => [1, 2, 3, 4, 5, 6].map((n) => t('profile.zone_label', { n })),
    [t],
  );
  const hrLabels = useMemo(
    () => [1, 2, 3, 4, 5, 6].map((n) => t('profile.zone_label', { n })),
    [t],
  );
  const distLabels = useMemo(() => distanceBucketLabelsKm(t), [t]);

  return (
    <div className="profile-distribution-section">
      <div className="profile-distribution-header">
        <h2 className="profile-distribution-heading">{t('profile.distribution_heading')}</h2>
        <p className="profile-distribution-sub">{t('profile.distribution_sub', { weeks: 4 })}</p>
      </div>
      <div className="profile-distribution-grid">
        <ZoneCard
          title={t('profile.distribution_pace_title')}
          zoneKind="pace"
          labels={paceLabels}
          colors={PACE_COLORS}
          runs={windowRuns}
          isMile={isMile}
          t={t}
        />
        <ZoneCard
          title={t('profile.distribution_distance_title')}
          zoneKind="distance"
          labels={distLabels}
          colors={DIST_COLORS}
          runs={windowRuns}
          isMile={isMile}
          t={t}
        />
        <ZoneCard
          title={t('profile.distribution_hr_title')}
          zoneKind="hr"
          labels={hrLabels}
          colors={HR_COLORS}
          runs={windowRuns}
          isMile={isMile}
          t={t}
        />
      </div>
    </div>
  );
}

import { useId, useState } from 'react';
import { formatDistance, formatDistanceValue, getDistanceUnitLabel } from '../../utils/format';
import { getNearestProgressionPointIndex } from '../../utils/progressionAtlas';

export default function ProgressionChart({ atlas, lang, unit, t }) {
  const chartId = useId();
  const [activeIndex, setActiveIndex] = useState(null);
  const point = activeIndex == null ? null : atlas.chartSeries[Math.min(activeIndex, atlas.chartSeries.length - 1)];
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  const pointDate = point?.date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  const selectedWeek = point && atlas.weeklyBars.find((bar) => point.date >= bar.start && point.date <= bar.end);
  const valueText = point
    ? `${pointDate}, ${t('profile.dashboard_progression_distance')}: ${formatDistance(point.cumulativeDistance, 1, lang, unit)}, ${t('profile.dashboard_redesign.progression_day_distance')}: ${formatDistance(point.distanceKm, 1, lang, unit)}`
    : '';
  const selectPoint = (event) => {
    if (!atlas.hasData || event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setActiveIndex(getNearestProgressionPointIndex(atlas.chartSeries, ((event.clientX - bounds.left) / bounds.width) * 400));
  };

  return (
    <figure className="hd-progression-chart-area" aria-labelledby={`${chartId}-caption`}>
      <figcaption className="hd-progression-chart-caption" id={`${chartId}-caption`}>
        <span className="hd-progression-legend"><i aria-hidden="true" />{t('profile.dashboard_progression_distance')}</span>
        <span>{pointDate || atlas.rangeLabel}</span>
      </figcaption>
      <div className="hd-progression-readout">
        {point ? (
          <span>
            <strong>{formatDistance(point.cumulativeDistance, 1, lang, unit)}</strong>
            <span>{t('profile.dashboard_redesign.progression_day_distance')} <b>+{formatDistance(point.distanceKm, 1, lang, unit)}</b></span>
          </span>
        ) : <span>{t('profile.dashboard_redesign.progression_slope_hint')}</span>}
      </div>
      <div className="hd-progression-plot-frame">
        <div className="hd-progression-y-axis" aria-hidden="true">
          <span className="hd-progression-axis-unit">{getDistanceUnitLabel(lang, unit)}</span>
          {atlas.yTicks.map((tick) => (
            <span key={tick.y} style={{ top: `${tick.y / 220 * 100}%` }}>
              {Number(formatDistanceValue(tick.valueKm, unit, 1)).toLocaleString(locale, { maximumFractionDigits: 1 })}
            </span>
          ))}
        </div>
        <div className="hd-progression-plot" onPointerMove={selectPoint} onPointerLeave={() => setActiveIndex(null)}>
          <svg viewBox="0 0 400 220" className="hd-progression-svg" preserveAspectRatio="none" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
            <title id={`${chartId}-title`}>{t('profile.dashboard_progression_distance')}: {formatDistance(atlas.totalDistanceKm, 1, lang, unit)}</title>
            <desc id={`${chartId}-description`}>{atlas.rangeLabel}. {t('profile.dashboard_redesign.progression_slope_hint')}</desc>
            <defs>
              <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--hd-coral)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--hd-coral)" stopOpacity="0.015" />
              </linearGradient>
            </defs>
            {atlas.yTicks.map((tick) => <line key={tick.y} x1="0" x2="400" y1={tick.y} y2={tick.y} className="hd-progression-grid-line" vectorEffect="non-scaling-stroke" />)}
            {atlas.xTicks.map((tick) => <line key={tick.x} x1={tick.x} x2={tick.x} y1="10" y2="210" className="hd-progression-grid-line is-vertical" vectorEffect="non-scaling-stroke" />)}
            {atlas.hasData && <path d={atlas.chartArea} fill={`url(#${chartId}-fill)`} />}
            {atlas.hasData && <path d={atlas.chartLine} fill="none" className="hd-progression-line" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {point && <line x1={point.x} x2={point.x} y1="10" y2="210" className="hd-progression-cursor" vectorEffect="non-scaling-stroke" />}
          </svg>
          {atlas.hasData ? (
            <>
              <span className="hd-progression-dot" aria-hidden="true" style={{ left: `${(point || atlas.chartSeries.at(-1)).x / 4}%`, top: `${(point || atlas.chartSeries.at(-1)).y / 220 * 100}%` }} />
              <input
                className="hd-progression-scrubber"
                type="range"
                min="0"
                max={atlas.chartSeries.length - 1}
                step="1"
                value={activeIndex == null ? atlas.chartSeries.length - 1 : Math.min(activeIndex, atlas.chartSeries.length - 1)}
                aria-label={t('profile.dashboard_redesign.progression_explore')}
                aria-valuetext={valueText || `${atlas.rangeLabel}, ${formatDistance(atlas.totalDistanceKm, 1, lang, unit)}`}
                onChange={(event) => setActiveIndex(Number(event.target.value))}
                onFocus={() => setActiveIndex(atlas.chartSeries.length - 1)}
                onBlur={() => setActiveIndex(null)}
              />
            </>
          ) : <p className="hd-progression-empty">{t('profile.dashboard_redesign.progression_empty')}</p>}
        </div>
      </div>
      <div className="hd-progression-volume-head">
        <span className="hd-progression-legend is-volume"><i aria-hidden="true" />{t('profile.dashboard_redesign.progression_weekly_distance')}</span>
        <span>{selectedWeek ? `${selectedWeek.label} · ${formatDistance(selectedWeek.distanceKm, 1, lang, unit)}` : `${t('profile.dashboard_redesign.progression_week_peak')} ${formatDistance(atlas.hasData ? atlas.maxWeeklyDistanceKm : 0, 1, lang, unit)}`}</span>
      </div>
      <div className="hd-progression-volume-frame">
        <div className="hd-progression-volume-axis" aria-hidden="true">
          <span>{Number(formatDistanceValue(atlas.hasData ? atlas.maxWeeklyDistanceKm : 0, unit, 1)).toLocaleString(locale, { maximumFractionDigits: 1 })}</span>
          <span>0</span>
        </div>
        <svg viewBox="0 0 400 70" className="hd-progression-volume-svg" preserveAspectRatio="none" role="img" aria-label={t('profile.dashboard_redesign.progression_weekly_distance')}>
          <line x1="0" x2="400" y1="68" y2="68" className="hd-progression-grid-line" vectorEffect="non-scaling-stroke" />
          {atlas.hasData && atlas.weeklyBars.map((bar) => {
            const height = atlas.maxWeeklyDistanceKm > 0 ? (bar.distanceKm / atlas.maxWeeklyDistanceKm) * 60 : 0;
            return <rect key={bar.key} x={bar.x + bar.width * 0.12} y={68 - Math.max(1, height)} width={bar.width * 0.76} height={Math.max(1, height)} className={`hd-progression-volume-bar${bar.distanceKm === 0 ? ' is-empty' : ''}${selectedWeek?.key === bar.key ? ' is-active' : ''}`}>
              <title>{bar.label}: {formatDistance(bar.distanceKm, 1, lang, unit)}</title>
            </rect>;
          })}
        </svg>
      </div>
      <div className="hd-progression-range" aria-hidden="true">
        {atlas.xTicks.map((tick, index) => <span key={tick.x} className={index % 2 ? 'is-intermediate' : ''} style={{ left: `${tick.x / 4}%` }}>{tick.label}</span>)}
      </div>
    </figure>
  );
}

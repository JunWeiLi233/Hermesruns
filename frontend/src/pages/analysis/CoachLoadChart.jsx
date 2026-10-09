import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { buildCoachLoadChartGeometry, getCoachLoadTooltipPosition } from './coachLoadChartGeometry';

export default function CoachLoadChart({ dashboard }) {
  const { t } = useI18n();
  const chartRef = useRef(null);
  const [width, setWidth] = useState(920);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const gradientId = useId();
  const historyId = useId();
  const geometry = useMemo(() => buildCoachLoadChartGeometry(dashboard.chartWindow, width), [dashboard.chartWindow, width]);
  const selected = selectedIndex == null ? null : geometry?.points[Math.min(selectedIndex, geometry.points.length - 1)];
  const current = selected || geometry?.points.at(-1);
  const valueText = (point) => `${point.label}, ${dashboard.chartLegendAcute}: ${Math.round(point.acute)}, ${dashboard.chartLegendChronic}: ${Math.round(point.chronic)}`;

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const measure = () => { if (element.clientWidth > 0) setWidth(element.clientWidth); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selectPoint = (event) => {
    if (!geometry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const x = (event.clientX - rect.left) / rect.width * geometry.width;
    const nearest = geometry.points.reduce((best, point) => Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best);
    setSelectedIndex(nearest.index);
  };
  const handleKeyDown = (event) => {
    const last = geometry.points.length - 1;
    const index = selectedIndex ?? last;
    const next = { ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(last, index + 1), Home: 0, End: last }[event.key];
    if (next != null) { event.preventDefault(); setSelectedIndex(next); }
    else if (event.key === 'Escape') setSelectedIndex(null);
  };

  return (
    <div className="coach-load-chart">
      <div className="coach-load-chart__legend">
        <span><i className="is-acute" aria-hidden="true" />{dashboard.chartLegendAcute}<strong>{current ? Math.round(current.acute) : '—'}</strong></span>
        <span><i className="is-chronic" aria-hidden="true" />{dashboard.chartLegendChronic}<strong>{current ? Math.round(current.chronic) : '—'}</strong></span>
        {current && <time dateTime={current.day}>{current.label}</time>}
      </div>
      <div
        ref={chartRef}
        className="coach-load-chart__plot"
        role={geometry ? 'slider' : undefined}
        tabIndex={geometry ? 0 : undefined}
        aria-label={geometry ? t('analysis.coach_dashboard_insights_title') : undefined}
        aria-describedby={geometry ? historyId : undefined}
        aria-valuemin={geometry ? 0 : undefined}
        aria-valuemax={geometry ? geometry.points.length - 1 : undefined}
        aria-valuenow={geometry ? current.index : undefined}
        aria-valuetext={geometry ? valueText(current) : undefined}
        onFocus={() => { if (geometry) setSelectedIndex(geometry.points.length - 1); }}
        onBlur={() => setSelectedIndex(null)}
        onKeyDown={geometry ? handleKeyDown : undefined}
        onPointerMove={selectPoint}
        onPointerDown={selectPoint}
        onPointerLeave={() => { if (document.activeElement !== chartRef.current) setSelectedIndex(null); }}
      >
        {geometry ? <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} width={geometry.width} height={geometry.height} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--coach-chart-acute)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--coach-chart-acute)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geometry.yTicks.map((tick) => <g key={tick.value}>
            <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={tick.y} y2={tick.y} className="coach-load-chart__grid" />
            <text x={geometry.padL - 12} y={tick.y + 4} textAnchor="end">{tick.value}</text>
          </g>)}
          <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path d={geometry.chronicPath} className="coach-load-chart__line is-chronic" />
          <path d={geometry.acutePath} className="coach-load-chart__line is-acute" />
          {(selected ? [selected] : geometry.points.length === 1 ? geometry.points : [geometry.points.at(-1)]).map((point) => <g key={point.day} className="coach-load-chart__markers">
            {selected && <line x1={point.x} x2={point.x} y1={geometry.padT} y2={geometry.baseline} className="coach-load-chart__crosshair" />}
            {selected && <circle cx={point.x} cy={point.acuteY} r="11" className="coach-load-chart__halo" />}
            <circle cx={point.x} cy={point.acuteY} r="4" className="is-acute" />
            <circle cx={point.x} cy={point.chronicY} r="3.5" className="is-chronic" />
          </g>)}
          {geometry.xTicks.map((point, index) => <text key={point.day} x={point.x} y={geometry.height - 8} textAnchor={geometry.xTicks.length === 1 ? 'middle' : index === 0 ? 'start' : index === geometry.xTicks.length - 1 ? 'end' : 'middle'}>{point.label}</text>)}
        </svg> : <div className="coach-load-chart__empty">{t('analysisInsight.load_no_data')}</div>}
        {selected && <div className="coach-load-chart__tooltip" style={getCoachLoadTooltipPosition(selected, geometry)} aria-hidden="true">
          <time dateTime={selected.day}>{selected.label}</time>
          <div className="is-acute"><i /><span>{t('analysisInsight.load_chart_acute_short')}</span><strong>{Math.round(selected.acute)}</strong></div>
          <div className="is-chronic"><i /><span>{t('analysisInsight.load_chart_chronic_short')}</span><strong>{Math.round(selected.chronic)}</strong></div>
        </div>}
      </div>
      <ul id={historyId} className="sr-only analysis-profile-v2-history" data-analysis-history="coach">
        {dashboard.chartWindow.map((entry) => <li key={entry.day}>
          <span>{entry.label}</span>
          <span>{`${dashboard.chartLegendAcute}: ${Math.round(entry.acute)}`}</span>
          <span>{`${dashboard.chartLegendChronic}: ${Math.round(entry.chronic)}`}</span>
        </li>)}
      </ul>
    </div>
  );
}

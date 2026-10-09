import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { formatPaceSeconds } from '../../utils/format';
import { areaPath, distanceTicks, linePath, nearestIndex, paceDomain, paceTicks } from '../../utils/paceAnalysis';

const MARGIN = { top: 14, right: 14, bottom: 30, left: 46 };
/** The elevation area takes the bottom third of the plot, behind the pace. */
const ELEVATION_BAND = 0.34;

/** The width of the element, read before the first paint so the chart is not drawn at a guess and then redrawn. */
function useWidth(ref, fallback = 720) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measured = Math.floor(node.clientWidth);
    if (measured > 0) setWidth(measured);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** What the chart draws and reads out, for the kilometre splits or for the smoothed line. */
function buildModel(profile, view, adjusted) {
  const totalKm = Math.max(0.001, profile.summary.distanceMeters / 1000);
  const series = profile.smoothed;
  const elevation = profile.hasElevation ? series.elevationMeters : null;
  const elevationValues = elevation ? elevation.filter((value) => value != null) : [];
  const elevationRange = elevationValues.length > 1
    ? { min: Math.min(...elevationValues), max: Math.max(...elevationValues) }
    : null;

  let items;
  if (view === 'splits') {
    let start = 0;
    items = profile.splits.map((split) => {
      const x0 = start;
      start += split.distanceMeters / 1000;
      return {
        x0,
        x1: start,
        x: (x0 + start) / 2,
        index: split.index,
        partial: split.partial,
        distanceMeters: split.distanceMeters,
        pace: split.paceSecPerKm ?? null,
        gap: split.gapSecPerKm ?? null,
        elevationChange: split.elevationChangeMeters ?? null,
      };
    });
  } else {
    items = series.t.map((t, index) => ({
      x: series.distanceKm[index],
      t,
      pace: series.paceSecPerKm[index] ?? null,
      gap: series.gapSecPerKm[index] ?? null,
      elevation: series.elevationMeters[index] ?? null,
    }));
  }

  const domainValues = [];
  for (const item of items) {
    domainValues.push(item.pace);
    if (adjusted) domainValues.push(item.gap);
  }
  const domain = paceDomain(domainValues);
  const marker = adjusted ? profile.markers?.gap : profile.markers?.pace;
  return {
    view,
    totalKm,
    items,
    domain,
    paceTickValues: paceTicks(domain),
    kmTicks: distanceTicks(totalKm),
    elevation,
    elevationRange: elevation ? elevationRange : null,
    seriesKm: series.distanceKm,
    fastest: view === 'splits' ? marker?.fastestSplit ?? null : null,
    slowest: view === 'splits' ? marker?.slowestSplit ?? null : null,
  };
}

/** The words for one split or one moment: a title and labelled values. */
function describe(item, view, adjusted, hasElevation, t, formatNumber) {
  const unit = t('run_detail.unit_pace');
  const pace = (value) => (value == null ? t('run_detail.pace_hover_stopped') : `${formatPaceSeconds(value)} ${unit}`);
  const lines = [{ label: t('run_detail.pace_legend_pace'), value: pace(item.pace) }];
  if (adjusted && item.gap != null) lines.push({ label: t('run_detail.pace_gap_toggle'), value: pace(item.gap) });
  if (view === 'splits') {
    if (hasElevation && item.elevationChange != null) {
      const rounded = Math.round(item.elevationChange);
      lines.push({
        label: t('run_detail.pace_hover_elevation_change'),
        value: `${rounded > 0 ? '+' : ''}${formatNumber(rounded)} ${t('run_detail.unit_meter')}`,
      });
    }
    const title = item.partial
      ? t('run_detail.pace_hover_partial', { distance: formatNumber(item.distanceMeters / 1000, { maximumFractionDigits: 2 }) })
      : t('run_detail.pace_marker_split', { index: item.index });
    return { title, lines };
  }
  if (hasElevation && item.elevation != null) {
    lines.push({
      label: t('run_detail.pace_legend_elevation'),
      value: `${formatNumber(Math.round(item.elevation))} ${t('run_detail.unit_meter')}`,
    });
  }
  const title = `${formatNumber(item.x, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t('run_detail.unit_km')}`;
  return { title, lines };
}

/**
 * Pace along the run, faster at the top, with the run's elevation as a soft area behind it. Kilometre splits are bars
 * (taller is faster, the fastest and slowest are marked); the smoothed view is a line that breaks where the runner
 * stood still. With "grade adjusted" on, each split gets a tick at its grade-adjusted pace and the smoothed view gets a
 * second, dashed line. Hover, touch or the arrow keys read out one split or one moment.
 */
export default function PaceChart({ profile, view, adjusted }) {
  const { t, formatNumber } = useI18n();
  const wrapperRef = useRef(null);
  const titleId = useId();
  const width = useWidth(wrapperRef);
  const [active, setActive] = useState(null);

  const model = useMemo(() => buildModel(profile, view, adjusted), [profile, view, adjusted]);
  const safeActive = active != null && active < model.items.length ? active : null;

  if (!model.domain) {
    return <p className="run-detail-v2__muted">{t('run_detail.pace_no_stream')}</p>;
  }

  const height = width < 520 ? 210 : 260;
  const plotWidth = Math.max(40, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(40, height - MARGIN.top - MARGIN.bottom);
  const plotBottom = MARGIN.top + plotHeight;
  const { domain } = model;
  const scaleX = (km) => MARGIN.left + (km / model.totalKm) * plotWidth;
  const scaleY = (pace) => {
    const clamped = Math.min(domain.max, Math.max(domain.min, pace));
    return MARGIN.top + ((clamped - domain.min) / (domain.max - domain.min)) * plotHeight;
  };
  const scaleElevation = (value) => {
    const { min, max } = model.elevationRange;
    const fraction = max === min ? 0.5 : (value - min) / (max - min);
    return plotBottom - fraction * plotHeight * ELEVATION_BAND;
  };

  function handlePointerMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const km = ((event.clientX - bounds.left) / bounds.width) * model.totalKm;
    const index = model.view === 'splits'
      ? nearestIndex(model.items.map((item) => item.x), km)
      : nearestIndex(model.seriesKm, km);
    if (index >= 0) setActive(index);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setActive(null);
      return;
    }
    const last = model.items.length - 1;
    const target = {
      ArrowRight: (safeActive ?? -1) + 1,
      ArrowLeft: (safeActive ?? 1) - 1,
      PageDown: (safeActive ?? 0) + 10,
      PageUp: (safeActive ?? 10) - 10,
      Home: 0,
      End: last,
    }[event.key];
    if (target == null) return;
    event.preventDefault();
    setActive(Math.max(0, Math.min(last, target)));
  }

  const activeItem = safeActive == null ? null : model.items[safeActive];
  const readout = activeItem ? describe(activeItem, model.view, adjusted, profile.hasElevation, t, formatNumber) : null;
  const cursorX = activeItem ? scaleX(activeItem.x) : null;
  const tooltipOnLeft = cursorX != null && cursorX > MARGIN.left + plotWidth * 0.55;

  const itemXs = model.items.map((item) => item.x);
  const paceLine = model.view === 'smoothed' ? linePath(itemXs, model.items.map((item) => item.pace), scaleX, scaleY) : '';
  const gapLine = model.view === 'smoothed' && adjusted ? linePath(itemXs, model.items.map((item) => item.gap), scaleX, scaleY) : '';
  const elevationShape = model.elevation && model.elevationRange
    ? areaPath(model.seriesKm, model.elevation, scaleX, scaleElevation, plotBottom)
    : '';

  return (
    <div
      ref={wrapperRef}
      className="run-detail-v2__pa-chart"
      role="group"
      aria-labelledby={titleId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={() => setActive(null)}
    >
      <span id={titleId} className="sr-only">{t('run_detail.pace_chart_label')}</span>
      <svg className="run-detail-v2__pa-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
        {model.paceTickValues.map((tick) => (
          <g key={tick} className="run-detail-v2__pa-grid">
            <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={scaleY(tick)} y2={scaleY(tick)} />
            <text x={MARGIN.left - 8} y={scaleY(tick)} textAnchor="end" dominantBaseline="middle">{formatPaceSeconds(tick)}</text>
          </g>
        ))}
        <text className="run-detail-v2__pa-axis" x={MARGIN.left - 8} y={plotBottom + 18} textAnchor="end">{t('run_detail.unit_km')}</text>
        {model.kmTicks.map((tick) => (
          <text key={tick} className="run-detail-v2__pa-axis" x={scaleX(tick)} y={plotBottom + 18} textAnchor="middle">{tick}</text>
        ))}

        {elevationShape ? <path className="run-detail-v2__pa-elevation" d={elevationShape} /> : null}

        {model.view === 'splits' ? model.items.map((item, index) => {
          if (item.pace == null) return null;
          const left = scaleX(item.x0) + 1;
          const right = scaleX(item.x1) - 1;
          const top = scaleY(item.pace);
          const classes = ['run-detail-v2__pa-bar'];
          if (item.index === model.fastest) classes.push('is-fastest');
          if (item.index === model.slowest) classes.push('is-slowest');
          if (item.partial) classes.push('is-partial');
          if (index === safeActive) classes.push('is-active');
          return (
            <g key={item.index}>
              <rect
                className={classes.join(' ')}
                data-split={item.index}
                x={left}
                y={top}
                width={Math.max(1, right - left)}
                height={Math.max(1, plotBottom - top)}
                rx="3"
              />
              {adjusted && item.gap != null ? (
                <line className="run-detail-v2__pa-gap-tick" data-gap-split={item.index} x1={left} x2={Math.max(left + 1, right)} y1={scaleY(item.gap)} y2={scaleY(item.gap)} />
              ) : null}
            </g>
          );
        }) : (
          <>
            <path className="run-detail-v2__pa-line" d={paceLine} fill="none" />
            {adjusted ? <path className="run-detail-v2__pa-line is-gap" d={gapLine} fill="none" /> : null}
            {activeItem ? (
              <g className="run-detail-v2__pa-cursor">
                <line x1={cursorX} x2={cursorX} y1={MARGIN.top} y2={plotBottom} />
                {activeItem.pace != null ? <circle cx={cursorX} cy={scaleY(activeItem.pace)} r="4" /> : null}
                {adjusted && activeItem.gap != null ? <circle className="is-gap" cx={cursorX} cy={scaleY(activeItem.gap)} r="4" /> : null}
              </g>
            ) : null}
          </>
        )}

        <rect
          className="run-detail-v2__pa-hit"
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onPointerDown={handlePointerMove}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {readout ? (
        <div className={`run-detail-v2__pa-tooltip${tooltipOnLeft ? ' is-left' : ''}`} style={{ left: cursorX, top: MARGIN.top }} aria-hidden="true">
          <strong>{readout.title}</strong>
          {readout.lines.map((line) => (
            <span key={line.label}><em>{line.label}</em>{line.value}</span>
          ))}
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {readout ? `${readout.title}. ${readout.lines.map((line) => `${line.label} ${line.value}`).join('. ')}` : ''}
      </p>
    </div>
  );
}

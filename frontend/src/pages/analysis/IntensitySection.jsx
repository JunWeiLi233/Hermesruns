import { useId, useMemo, useRef, useState } from 'react';
import { MethodsLink } from '../../components/HowWorkedOut';
import { zoneName, zoneNumberLabel } from '../../components/heartRateZoneLabels';
import { useI18n } from '../../contexts/I18nContext';
import useElementWidth from '../../hooks/useElementWidth';
import { formatShortDate } from '../../utils/fitnessChart';
import { zoneDurationLabel } from '../../utils/heartRateZones';
import { DEFAULT_LOW_ZONES, ZONE_NUMBERS, axisUnit, buildIntensityChart, percentOf, weekBands } from '../../utils/intensityChart';
import { weeklyTooltipPosition } from '../../utils/weeklyEffortChart';
import useIntensity from './useIntensity';
import useScrubber from './useScrubber';

const WEEKS_SHOWN = 12;
const PATTERNS = ['polarized', 'pyramidal', 'threshold', 'high', 'mixed', 'insufficient'];

/** "31 h 20 min" or "45 min": a time in words, for a sentence. */
function hoursMinutes(t, seconds) {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? t('training_intensity.duration_hm', { h, m }) : t('training_intensity.duration_m', { m });
}

/** "Zones 1 to 3", "Zone 4" or "Zone 5": the three bands by the numbers of their zones. */
function bandLabel(t, band, lowZones) {
  if (band === 'low') return lowZones > 1 ? t('training_intensity.band_low', { from: 1, to: lowZones }) : zoneNumberLabel(t, 1);
  return zoneNumberLabel(t, band === 'moderate' ? lowZones + 1 : lowZones + 2);
}

/** The chart: a bar for each week, its time stacked from zone 1 at the bottom to zone 5 at the top. */
function IntensityChart({ weeks, label, lowZones }) {
  const { t, lang, formatNumber } = useI18n();
  const plotRef = useRef(null);
  const measured = useElementWidth(plotRef);
  const historyId = useId();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const geometry = useMemo(() => buildIntensityChart(weeks, { width: measured, height: measured < 520 ? 200 : 230 }), [weeks, measured]);
  const positions = useMemo(() => (geometry ? geometry.bars.map((bar) => bar.centre) : []), [geometry]);
  const last = geometry ? geometry.bars.length - 1 : 0;
  const scrub = useScrubber({
    plotRef, positions, viewWidth: geometry?.width ?? 0, startIndex: last, lastIndex: last, selectedIndex, onSelect: setSelectedIndex,
  });
  if (!geometry) return null;

  const selected = selectedIndex == null ? null : geometry.bars[Math.min(selectedIndex, last)];
  const shownBar = selected ?? geometry.bars[last];
  const weekText = (bar) => {
    const date = formatShortDate(bar.week.start, lang);
    const bands = weekBands(bar.week, lowZones);
    if (!bands) return t('training_intensity.week_text_none', { date });
    return t('training_intensity.week_text', {
      date,
      time: zoneDurationLabel(bar.total),
      low: percentOf(bands.low),
      moderate: percentOf(bands.moderate),
      high: percentOf(bands.high),
    });
  };

  return (
    <div className="analysis-load-command-chart-wrap analysis-fit-v2-chart">
      <div
        ref={plotRef}
        className="analysis-fit-v2-plot"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-describedby={historyId}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={shownBar.index}
        aria-valuetext={weekText(shownBar)}
        {...scrub}
      >
        <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} width={geometry.width} height={geometry.height} aria-hidden="true" className="analysis-fit-v2-svg">
          {geometry.yTicks.map((tick) => (
            <g key={tick.value}>
              <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={tick.y} y2={tick.y} className="analysis-fit-v2-grid" />
              <text x={geometry.padL - 8} y={tick.y + 4} textAnchor="end">{formatNumber(tick.value)}</text>
            </g>
          ))}
          {geometry.bars.map((bar) => (
            <g
              key={bar.week.start}
              className={`training-intensity-v2__bar${bar.week.complete ? '' : ' is-open'}${bar.index === last ? ' is-current' : ''}${selected && selected.index === bar.index ? ' is-selected' : ''}`}
            >
              {bar.segments.map((segment) => (segment.height > 0 ? (
                <rect
                  key={segment.zone}
                  className={`training-intensity-v2__segment is-zone-${segment.zone}`}
                  x={bar.x}
                  y={segment.y}
                  width={bar.width}
                  height={segment.height}
                />
              ) : null))}
            </g>
          ))}
          {geometry.xTicks.map((bar) => (
            <text key={bar.week.start} x={bar.centre} y={geometry.height - 8} textAnchor="middle">
              {formatShortDate(bar.week.start, lang)}
            </text>
          ))}
        </svg>

        {selected ? (
          <div className="analysis-fit-v2-tooltip" style={weeklyTooltipPosition(selected, geometry, { height: 176 })} aria-hidden="true">
            <time dateTime={selected.week.start}>{t('training_series.week_of', { date: formatShortDate(selected.week.start, lang) })}</time>
            {[...ZONE_NUMBERS].reverse().map((zone) => (
              <div key={zone}>
                <i className={`training-intensity-v2__swatch is-zone-${zone}`} />
                <span>{zoneNumberLabel(t, zone)} · {zoneName(t, zone)}</span>
                <strong>{zoneDurationLabel(selected.segments[zone - 1].seconds)}</strong>
              </div>
            ))}
            <div className="is-effort">
              <span>{t('training_intensity.tooltip_total')}</span>
              <strong>{zoneDurationLabel(selected.total)}</strong>
            </div>
            <div className="is-effort">
              <span>{t('training_intensity.tooltip_runs', { withHeartRate: selected.week.runsWithHeartRate, runs: selected.week.runs })}</span>
            </div>
          </div>
        ) : null}
      </div>

      <table id={historyId} className="sr-only analysis-profile-v2-history" data-analysis-history="intensity">
        <thead>
          <tr>
            <th scope="col">{t('training_series.col_week')}</th>
            <th scope="col">{t('training_series.col_runs')}</th>
            {ZONE_NUMBERS.map((zone) => <th key={zone} scope="col">{zoneNumberLabel(t, zone)}</th>)}
          </tr>
        </thead>
        <tbody>
          {geometry.bars.map((bar) => (
            <tr key={bar.week.start}>
              <th scope="row">{formatShortDate(bar.week.start, lang)}</th>
              <td>{t('training_intensity.table_runs', { withHeartRate: bar.week.runsWithHeartRate, runs: bar.week.runs })}</td>
              {bar.segments.map((segment) => <td key={segment.zone}>{zoneDurationLabel(segment.seconds)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The three bands as three cards: how much of the heart-rate time each held. */
function Bands({ summary, lowZones }) {
  const { t, formatNumber } = useI18n();
  const shares = summary.shares;
  const seconds = { low: 0, moderate: 0, high: 0 };
  summary.zoneSeconds.forEach((value, index) => {
    const band = index + 1 <= lowZones ? 'low' : index + 1 === lowZones + 1 ? 'moderate' : 'high';
    seconds[band] += value;
  });
  const names = {
    low: ZONE_NUMBERS.slice(0, lowZones).map((zone) => zoneName(t, zone)).join(' · '),
    moderate: zoneName(t, lowZones + 1),
    high: zoneName(t, lowZones + 2),
  };
  return (
    <section className="analysis-load-v2-metrics analysis-fit-v2-metrics" aria-label={t('training_intensity.bands_label')}>
      {['low', 'moderate', 'high'].map((band) => (
        <article key={band} className="analysis-load-v2-metric">
          <span>{bandLabel(t, band, lowZones)}</span>
          <strong>{formatNumber(percentOf(shares[band]))}%</strong>
          <em className="is-neutral">{zoneDurationLabel(seconds[band])}</em>
          <small>{names[band]}</small>
        </article>
      ))}
    </section>
  );
}

/**
 * Time in zones: where each week's running time went, by heart-rate zone, with the name of the spread over the weeks
 * shown. A card on the Load balance page, beside the weekly effort. It fetches for itself.
 */
export default function IntensitySection() {
  const { t, formatNumber } = useI18n();
  const titleId = useId();
  const { status, data, stale, reload } = useIntensity(WEEKS_SHOWN);

  const weeks = data?.weeks ?? [];
  const summary = data?.summary ?? null;
  const lowZones = data?.lowZones ?? DEFAULT_LOW_ZONES;
  const hasTime = Boolean(summary && summary.coveredSeconds > 0);
  const pattern = summary && PATTERNS.includes(summary.pattern) ? summary.pattern : 'insufficient';
  const without = summary ? summary.runs - summary.runsWithHeartRate : 0;
  const unitWord = t(axisUnit(weeks) === 'min' ? 'training_intensity.unit_minutes' : 'training_intensity.unit_hours');

  let body;
  if (data) {
    body = (
      <>
        {stale ? (
          <p className="analysis-fit-v2-note is-error" role="status">
            {t('training_series.stale')}{' '}
            <button type="button" className="analysis-load-v2-link" onClick={reload}>{t('training_series.retry')}</button>
          </p>
        ) : null}
        {weeks.length === 0 ? <p className="analysis-fit-v2-note">{t('training_intensity.empty')}</p> : null}
        {weeks.length > 0 && !hasTime ? <p className="analysis-fit-v2-note">{t('training_intensity.empty_no_heart_rate')}</p> : null}
        {weeks.length > 0 && hasTime ? (
          <>
            <div className="analysis-load-v2-chart-meta">
              <div className="analysis-load-command-legend analysis-fit-v2-legend training-intensity-v2__legend" aria-hidden="true">
                {ZONE_NUMBERS.map((zone) => (
                  <span key={zone}><i className={`training-intensity-v2__swatch is-zone-${zone}`} />{zoneNumberLabel(t, zone)}</span>
                ))}
                <span className="training-intensity-v2__unit">{t(axisUnit(weeks) === 'min' ? 'training_intensity.axis_minutes' : 'training_intensity.axis_hours')}</span>
              </div>
              <span className="analysis-load-v2-zone is-unknown">{t(`training_intensity.pattern_${pattern}`)}</span>
            </div>
            <IntensityChart
              weeks={weeks}
              lowZones={lowZones}
              label={t('training_intensity.chart_label', { unit: unitWord })}
            />
            <Bands summary={summary} lowZones={lowZones} />
            <p className="analysis-fit-v2-note">
              {t('training_intensity.summary', {
                time: hoursMinutes(t, summary.coveredSeconds),
                withHeartRate: formatNumber(summary.runsWithHeartRate),
                runs: formatNumber(summary.runs),
              })}{' '}
              {pattern === 'insufficient'
                ? t('training_intensity.sentence_insufficient', {
                  runs: data.minRuns,
                  minutes: Math.round(data.minCoveredSeconds / 60),
                })
                : t(`training_intensity.sentence_${pattern}`)}
            </p>
            {pattern !== 'insufficient' ? (
              <p className="analysis-fit-v2-note">
                {summary.polarizationIndex == null
                  ? t('training_intensity.index_none')
                  : t('training_intensity.index_line', { value: summary.polarizationIndex.toFixed(2) })}{' '}
                {t('training_intensity.guideline', { percent: formatNumber(percentOf(summary.shares.moderate + summary.shares.high)) })}
              </p>
            ) : null}
            {without > 0 ? (
              <p className="analysis-fit-v2-note is-faint">
                {without === 1 ? t('training_intensity.no_heart_rate_one') : t('training_intensity.no_heart_rate', { count: formatNumber(without) })}
              </p>
            ) : null}
          </>
        ) : null}
        {data.pendingRuns > 0 ? (
          <p className="analysis-fit-v2-note" role="status">
            {t('training_series.pending', { count: formatNumber(data.pendingRuns) })}{' '}
            <button type="button" className="analysis-load-v2-link" onClick={reload}>{t('training_series.refresh')}</button>
          </p>
        ) : null}
        <p className="analysis-fit-v2-note is-faint">
          {t('training_intensity.basis', { zone: data.timeZone === 'Z' ? 'UTC' : data.timeZone })} <MethodsLink anchor="time-in-zones-and-the-intensity-distribution" />
        </p>
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="analysis-fit-v2-state">
        <p className="analysis-fit-v2-note is-error" role="alert">{t('training_intensity.error')}</p>
        <button type="button" className="analysis-load-v2-link" onClick={reload}>{t('training_series.retry')}</button>
      </div>
    );
  } else {
    body = (
      <div className="analysis-fit-v2-skeleton" aria-hidden="true">
        <span className="page-skeleton__block analysis-fit-v2-skeleton-chart is-short" />
        <span className="page-skeleton__block analysis-fit-v2-skeleton-line" />
      </div>
    );
  }

  return (
    <section
      id="load-intensity"
      tabIndex={-1}
      className="analysis-load-v2-chart analysis-fit-v2 training-intensity-v2"
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}
    >
      <div className="analysis-load-v2-head">
        <div>
          <h2 id={titleId}>{t('training_intensity.title')}</h2>
          <p>{t('training_intensity.hint')}</p>
        </div>
      </div>
      {status === 'loading' && !data ? <p className="sr-only" role="status">{t('training_intensity.loading')}</p> : null}
      {body}
    </section>
  );
}

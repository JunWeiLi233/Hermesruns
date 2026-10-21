import { useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { MethodsLink } from '../../components/HowWorkedOut';
import useElementWidth from '../../hooks/useElementWidth';
import { formatShortDate } from '../../utils/fitnessChart';
import { WEEK_STATUS_TONE, buildWeeklyChart, weeklyTooltipPosition } from '../../utils/weeklyEffortChart';
import useScrubber from './useScrubber';
import useWeeklyEffort from './useWeeklyEffort';

const WEEKS_SHOWN = 12;
const CHIP_CLASS = { good: '', high: ' is-high', low: ' is-low', neutral: ' is-unknown' };

/** The chart: a bar for each week's effort over a block for the range it was compared with. */
function WeeklyChart({ weeks, label }) {
  const { t, lang, formatNumber } = useI18n();
  const plotRef = useRef(null);
  const measured = useElementWidth(plotRef);
  const historyId = useId();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const geometry = useMemo(() => buildWeeklyChart(weeks, { width: measured, height: measured < 520 ? 200 : 230 }), [weeks, measured]);
  const positions = useMemo(() => (geometry ? geometry.bars.map((bar) => bar.centre) : []), [geometry]);
  const last = geometry ? geometry.bars.length - 1 : 0;
  const scrub = useScrubber({
    plotRef, positions, viewWidth: geometry?.width ?? 0, startIndex: last, lastIndex: last, selectedIndex, onSelect: setSelectedIndex,
  });
  if (!geometry) return null;

  const selected = selectedIndex == null ? null : geometry.bars[Math.min(selectedIndex, last)];
  const shownBar = selected ?? geometry.bars[last];
  const weekText = (bar) => `${t('training_series.week_of', { date: formatShortDate(bar.week.start, lang) })}, ${formatNumber(Math.round(bar.week.total))}, ${t(`training_series.status_${bar.week.status}`)}`;

  return (
    <div className="analysis-load-command-chart-wrap analysis-fit-v2-chart is-weekly">
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
              <text x={geometry.padL - 8} y={tick.y + 4} textAnchor="end">{formatNumber(Math.round(tick.value))}</text>
            </g>
          ))}
          {geometry.bars.map((bar) => (bar.range ? (
            <rect
              key={`range-${bar.week.start}`}
              className="analysis-fit-v2-range"
              x={bar.slotX + 3}
              width={Math.max(2, bar.slotWidth - 6)}
              y={bar.range.y}
              height={bar.range.height}
              rx="5"
            />
          ) : null))}
          {geometry.bars.map((bar) => (
            <rect
              key={`bar-${bar.week.start}`}
              className={`analysis-fit-v2-bar is-${bar.week.status}${bar.index === last ? ' is-current' : ''}${bar.week.complete ? '' : ' is-open'}${selected && selected.index === bar.index ? ' is-selected' : ''}`}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx="5"
            />
          ))}
          {geometry.xTicks.map((bar) => (
            <text
              key={bar.week.start}
              x={bar.centre}
              y={geometry.height - 8}
              textAnchor="middle"
            >
              {formatShortDate(bar.week.start, lang)}
            </text>
          ))}
        </svg>

        {selected ? (
          <div className="analysis-fit-v2-tooltip" style={weeklyTooltipPosition(selected, geometry)} aria-hidden="true">
            <time dateTime={selected.week.start}>{t('training_series.week_of', { date: formatShortDate(selected.week.start, lang) })}</time>
            <div className="is-effort"><span>{t('training_series.legend_effort')}</span><strong>{formatNumber(Math.round(selected.week.total))}</strong></div>
            <div className="is-effort"><span>{selected.week.runs === 1 ? t('training_series.tooltip_one_run') : t('training_series.tooltip_runs', { count: formatNumber(selected.week.runs) })}</span></div>
            {selected.week.range ? (
              <div className="is-effort"><span>{t('training_series.legend_range')}</span><strong>{t('training_series.range_text', { low: formatNumber(Math.round(selected.week.range.low)), high: formatNumber(Math.round(selected.week.range.high)) })}</strong></div>
            ) : null}
            <div className="is-status"><span>{t(`training_series.status_${selected.week.status}`)}</span></div>
          </div>
        ) : null}
      </div>

      <table id={historyId} className="sr-only analysis-profile-v2-history" data-analysis-history="weekly">
        <thead>
          <tr>
            <th scope="col">{t('training_series.col_week')}</th>
            <th scope="col">{t('training_series.col_effort')}</th>
            <th scope="col">{t('training_series.col_runs')}</th>
            <th scope="col">{t('training_series.col_range')}</th>
            <th scope="col">{t('training_series.col_status')}</th>
          </tr>
        </thead>
        <tbody>
          {geometry.bars.map((bar) => (
            <tr key={bar.week.start}>
              <th scope="row">{formatShortDate(bar.week.start, lang)}</th>
              <td>{formatNumber(Math.round(bar.week.total))}</td>
              <td>{formatNumber(bar.week.runs)}</td>
              <td>{bar.week.range ? t('training_series.range_text', { low: formatNumber(Math.round(bar.week.range.low)), high: formatNumber(Math.round(bar.week.range.high)) }) : '–'}</td>
              <td>{t(`training_series.status_${bar.week.status}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What this week looks like so far, in a sentence that says why. */
function thisWeekSentence(t, formatNumber, week) {
  const range = week.range;
  const values = {
    total: formatNumber(Math.round(week.total)),
    low: range ? formatNumber(Math.round(range.low)) : '',
    high: range ? formatNumber(Math.round(range.high)) : '',
  };
  if (!range) return t('training_series.this_week_none', values);
  if (week.status === 'within') return t('training_series.this_week_within', values);
  if (week.status === 'above') return t('training_series.this_week_above', values);
  return t('training_series.this_week_building', values);
}

/**
 * Weekly effort (S05, S12): the effort of each of the last weeks, each against the range of the three weeks before it,
 * with a word for how this week stands. A card on the Load balance page. It fetches for itself once the page has its runs.
 */
export default function WeeklyEffortSection() {
  const { t, formatNumber } = useI18n();
  const titleId = useId();
  const { status, data, stale, reload } = useWeeklyEffort(WEEKS_SHOWN);

  const weeks = data?.weeks ?? [];
  const thisWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null;
  const tone = thisWeek ? WEEK_STATUS_TONE[thisWeek.status] ?? 'neutral' : 'neutral';

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
        {weeks.length === 0 ? <p className="analysis-fit-v2-note">{t('training_series.weekly_empty')}</p> : null}
        {weeks.length > 0 ? (
          <>
            <div className="analysis-load-v2-chart-meta">
              <div className="analysis-load-command-legend analysis-fit-v2-legend" aria-hidden="true">
                <span><i className="is-within" />{t('training_series.legend_within')}</span>
                <span><i className="is-above" />{t('training_series.legend_above')}</span>
                <span><i className="is-below" />{t('training_series.legend_below')}</span>
                <span><i className="is-range" />{t('training_series.legend_range')}</span>
              </div>
              <span className={`analysis-load-v2-zone${CHIP_CLASS[tone]}`}>{t(`training_series.status_${thisWeek.status}`)}</span>
            </div>
            <WeeklyChart weeks={weeks} label={weeks.length === 1 ? t('training_series.weekly_chart_label_one') : t('training_series.weekly_chart_label', { count: weeks.length })} />
            <p className="analysis-fit-v2-note">{thisWeekSentence(t, formatNumber, thisWeek)}</p>
          </>
        ) : null}
        {data.pendingRuns > 0 ? (
          <p className="analysis-fit-v2-note" role="status">
            {t('training_series.pending', { count: formatNumber(data.pendingRuns) })}{' '}
            <button type="button" className="analysis-load-v2-link" onClick={reload}>{t('training_series.refresh')}</button>
          </p>
        ) : null}
        {weeks.length > 0 ? <p className="analysis-fit-v2-note is-faint">{t('training_series.weekly_basis', { band: data.bandPercent })} <MethodsLink anchor="weekly-effort" /></p> : null}
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="analysis-fit-v2-state">
        <p className="analysis-fit-v2-note is-error" role="alert">{t('training_series.weekly_error')}</p>
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
      id="load-weekly-effort"
      tabIndex={-1}
      className="analysis-load-v2-chart analysis-fit-v2"
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}
    >
      <div className="analysis-load-v2-head">
        <div>
          <h2 id={titleId}>{t('training_series.weekly_title')}</h2>
          <p>{t('training_series.weekly_hint')}</p>
        </div>
      </div>
      {status === 'loading' && !data ? <p className="sr-only" role="status">{t('training_series.weekly_loading')}</p> : null}
      {body}
    </section>
  );
}

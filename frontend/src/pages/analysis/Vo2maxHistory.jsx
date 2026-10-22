import { memo, useId, useMemo, useRef, useState } from 'react';
import { MethodsLink } from '../../components/HowWorkedOut';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import useElementWidth from '../../hooks/useElementWidth';
import useReadoutBox from '../../hooks/useReadoutBox';
import { formatDistance } from '../../utils/format';
import { DEFAULT_HISTORY_RANGE, FIRM_POINT_RUNS, HISTORY_RANGES, buildHistoryPlot, historyRangeStart, historyTooltipPosition } from '../../utils/vo2maxHistory';
import useScrubber from './useScrubber';

const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
/** A line of more points than this has hundreds of them on a few hundred pixels: smaller dots, with no ring round them to draw over the line. */
const DENSE_POINTS = 120;
/** How tall the readout of a point is taken to be until it has been drawn and measured (it is as tall as its text, which is as large as the reader has it): a hollow point has a few words more. */
const READOUT_HEIGHT = { firm: 84, thin: 102 };

/** One point of the line in words, the same everywhere: the sentence the slider and the list give, and the note a hollow point carries (empty for a firm one). */
function usePointWords() {
  const { t, lang, formatNumber } = useI18n();
  const day = (time) => new Date(time).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
  const value = (point) => formatNumber(point.value, ONE_DECIMAL);
  const name = (point) => point.name || t('vo2max_estimates.history_run_unnamed');
  return {
    day,
    value,
    name,
    /** "Mar 3, 2026: 48.2, after Morning 10k", or "Now: 48.2". */
    text: (point) => (point.now
      ? t('vo2max_estimates.history_dot_now', { value: value(point) })
      : t('vo2max_estimates.history_dot', { value: value(point), date: day(point.time), name: name(point) })),
    thin: (point) => {
      if (point.firm) return '';
      return point.usedCount <= 1 ? t('vo2max_estimates.history_point_thin_one') : t('vo2max_estimates.history_point_thin', { count: point.usedCount });
    },
    /** The same in a few words, for the readout, which is small. */
    thinShort: (point) => {
      if (point.firm) return '';
      return point.usedCount <= 1 ? t('vo2max_estimates.history_point_hollow_one') : t('vo2max_estimates.history_point_hollow', { count: point.usedCount });
    },
  };
}

/** The picture of the line itself: grid, axes, the line, a dot for each point and the marks on the highest and the lowest. It does not change with the point looked at. */
const PlotMarks = memo(function PlotMarks({ plot, dense }) {
  const { lang } = useI18n();
  const axisDay = (time) => new Date(time).toLocaleDateString(lang, { year: 'numeric', month: 'short' });

  return (
    <>
      {plot.yTicks.map((tick) => (
        <g key={tick.value}>
          <line x1={plot.padL} x2={plot.width - plot.padR} y1={tick.y} y2={tick.y} className="vo2max-estimates-v2__grid" />
          <text x={plot.padL - 8} y={tick.y + 4} textAnchor="end">{tick.value}</text>
        </g>
      ))}
      {plot.xTicks.map((tick, index) => (
        <text
          key={tick.time}
          x={tick.x}
          y={plot.height - 10}
          textAnchor={index === 0 ? 'start' : index === plot.xTicks.length - 1 ? 'end' : 'middle'}
        >
          {axisDay(tick.time)}
        </text>
      ))}
      {plot.dots.length > 1 ? <path d={plot.path} className="vo2max-estimates-v2__history-line" /> : null}
      {plot.dots.map((dot) => (
        <circle
          key={`${dot.point.time}-${dot.point.id ?? 'now'}`}
          cx={dot.x}
          cy={dot.y}
          r={dot.point.now ? 5 : dense ? 2.2 : 3.5}
          className={`vo2max-estimates-v2__history-dot${dot.point.firm ? '' : ' is-thin'}${dot.point.now ? ' is-now' : ''}`}
        />
      ))}
      {[plot.highest, plot.lowest].filter(Boolean).map((mark, index) => (
        <circle key={index === 0 ? 'highest' : 'lowest'} cx={mark.x} cy={mark.y} r="8" className="vo2max-estimates-v2__history-mark" />
      ))}
    </>
  );
});

/** Every point as a list, oldest first, for a screen reader to read through (the slider gives one at a time): the same words as the readout, so the same numbers as the dots. */
const PointList = memo(function PointList({ plot }) {
  const { t } = useI18n();
  const words = usePointWords();
  const join = t('vo2max_estimates.history_note_join');

  return (
    <ul className="sr-only vo2max-estimates-v2__history-list" aria-label={t('vo2max_estimates.history_list_label')}>
      {plot.dots.map((dot) => (
        <li key={`${dot.point.time}-${dot.point.id ?? 'now'}`}>
          <span>{words.text(dot.point)}</span>
          {dot.point.firm ? null : <>{join}<span>{words.thin(dot.point)}</span></>}
        </li>
      ))}
    </ul>
  );
});

/**
 * The line of the number: one dot for each point, hollow where the number was the mean of fewer than three runs. It is a slider, as the fitness chart is: the
 * pointer, a finger or the arrow keys pick one point, and its date, its number and the run it came after are read out beside it (and, for a screen reader,
 * in the slider's value).
 */
function HistoryPlot({ plot }) {
  const { t, formatNumber } = useI18n();
  const words = usePointWords();
  const plotRef = useRef(null);
  const readoutRef = useRef(null);
  const readoutBox = useReadoutBox(readoutRef);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const lastIndex = plot.dots.length - 1;
  const positions = useMemo(() => plot.dots.map((dot) => dot.x), [plot]);
  const scrub = useScrubber({
    plotRef, positions, viewWidth: plot.width, startIndex: lastIndex, lastIndex, selectedIndex, onSelect: setSelectedIndex,
  });
  const dense = plot.dots.length > DENSE_POINTS;
  const pickedIndex = selectedIndex == null ? null : Math.min(selectedIndex, lastIndex);
  const picked = pickedIndex == null ? null : plot.dots[pickedIndex];
  const shownIndex = pickedIndex ?? lastIndex;
  const shown = plot.dots[shownIndex].point;
  const label = plot.dots.length === 1
    ? t('vo2max_estimates.history_chart_label_one', { date: words.day(plot.dots[0].point.time), value: words.value(plot.dots[0].point) })
    : t('vo2max_estimates.history_chart_label', {
      count: plot.dots.length,
      from: words.day(plot.dots[0].point.time),
      to: words.day(plot.dots[lastIndex].point.time),
      low: formatNumber(Math.min(...plot.dots.map((dot) => dot.point.value)), ONE_DECIMAL),
      high: formatNumber(Math.max(...plot.dots.map((dot) => dot.point.value)), ONE_DECIMAL),
    });

  return (
    <>
      <div
        ref={plotRef}
        className="vo2max-estimates-v2__slider"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={lastIndex}
        aria-valuenow={shownIndex}
        aria-valuetext={[words.text(shown), words.thin(shown)].filter(Boolean).join(t('vo2max_estimates.history_note_join'))}
        {...scrub}
      >
        <svg
          viewBox={`0 0 ${plot.width} ${plot.height}`}
          width={plot.width}
          height={plot.height}
          className={`vo2max-estimates-v2__svg${dense ? ' is-dense' : ''}`}
          aria-hidden="true"
        >
          <PlotMarks plot={plot} dense={dense} />
          {picked ? (
            <g>
              <line x1={picked.x} x2={picked.x} y1={plot.padT} y2={plot.baseline} className="vo2max-estimates-v2__history-cross" />
              <circle cx={picked.x} cy={picked.y} r="9" className="vo2max-estimates-v2__history-selected" />
            </g>
          ) : null}
        </svg>

        {picked ? (
          <div
            ref={readoutRef}
            className="vo2max-estimates-v2__tooltip"
            style={historyTooltipPosition(picked, plot, { width: readoutBox?.width, height: readoutBox?.height ?? (picked.point.firm ? READOUT_HEIGHT.firm : READOUT_HEIGHT.thin) })}
            aria-hidden="true"
          >
            <time dateTime={new Date(picked.point.time).toISOString()}>{picked.point.now ? t('vo2max_estimates.history_read_now') : words.day(picked.point.time)}</time>
            <strong>{words.value(picked.point)}</strong>
            {picked.point.now ? null : <span>{t('vo2max_estimates.history_point_after', { name: words.name(picked.point) })}</span>}
            {picked.point.firm ? null : <small>{words.thinShort(picked.point)}</small>}
          </div>
        ) : null}
      </div>
      <PointList plot={plot} />
    </>
  );
}

/** The years in numbers: the highest and the lowest number of the year (firm points only), where it ended, and what was run. */
function YearsTable({ years }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const cell = (found) => (found
    ? (
      <>
        <strong>{formatNumber(found.value, ONE_DECIMAL)}</strong>
        <small>{found.date.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}</small>
      </>
    )
    : t('vo2max_estimates.no_hr'));
  const averageCell = (found) => (found
    ? (
      <>
        <strong>{formatNumber(found.value, ONE_DECIMAL)}</strong>
        <small>{t('vo2max_estimates.history_read_avg_days', { days: formatNumber(Math.round(found.days)) })}</small>
      </>
    )
    : t('vo2max_estimates.no_hr'));

  return (
    <div className="vo2max-estimates-v2__table-wrap">
      <table className="vo2max-estimates-v2__table is-years" aria-label={t('vo2max_estimates.history_years_label')}>
        <thead>
          <tr>
            <th scope="col">{t('vo2max_estimates.history_col_year')}</th>
            <th scope="col">{t('vo2max_estimates.history_col_high')}</th>
            <th scope="col">{t('vo2max_estimates.history_col_avg')}</th>
            <th scope="col">{t('vo2max_estimates.history_col_low')}</th>
            <th scope="col">{t('vo2max_estimates.history_col_end')}</th>
            <th scope="col">{t('vo2max_estimates.history_col_runs')}</th>
            <th scope="col">{t('vo2max_estimates.history_col_distance')}</th>
          </tr>
        </thead>
        <tbody>
          {years.map((row) => (
            <tr key={row.year}>
              <th scope="row">{row.year}</th>
              <td className="vo2max-estimates-v2__figure">{cell(row.high)}</td>
              <td className="vo2max-estimates-v2__figure">{averageCell(row.average)}</td>
              <td className="vo2max-estimates-v2__figure">{cell(row.low)}</td>
              <td className="vo2max-estimates-v2__figure">
                {row.end != null
                  ? (
                    <>
                      <strong>{formatNumber(row.end, ONE_DECIMAL)}</strong>
                      {row.current ? <small className="vo2max-estimates-v2__tag">{t('vo2max_estimates.history_year_now')}</small> : null}
                    </>
                  )
                  : t('vo2max_estimates.no_hr')}
              </td>
              <td>{formatNumber(row.runs)}</td>
              <td>{formatDistance(row.km, 0, lang, unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The number over time: what the VO2max was right after each run, by the rule that gives today's number, with the highest
 * and the lowest of the range and a table of the years. It adds nothing to the number; it shows how it got there.
 */
export default function Vo2maxHistory({ history }) {
  const { t, lang, formatNumber } = useI18n();
  const headingId = useId();
  const plotRef = useRef(null);
  const measured = useElementWidth(plotRef);
  const [range, setRange] = useState(DEFAULT_HISTORY_RANGE);
  const start = historyRangeStart(range, history.at);
  const plot = useMemo(
    () => buildHistoryPlot({ points: history.points, start, now: history.at, width: measured, height: measured < 520 ? 230 : 270 }),
    [history, start, measured],
  );
  if (history.points.length === 0) return null;

  const day = (time) => new Date(time).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
  const thin = plot ? plot.dots.some((dot) => !dot.point.firm) : false;

  return (
    <section className="vo2max-estimates-v2__card vo2max-estimates-v2__history" aria-labelledby={headingId}>
      <div className="vo2max-estimates-v2__history-head">
        <h2 id={headingId}>{t('vo2max_estimates.history_title')}</h2>
        <div className="vo2max-estimates-v2__ranges" role="group" aria-label={t('vo2max_estimates.history_ranges_label')}>
          {HISTORY_RANGES.map((candidate) => (
            <button key={candidate.key} type="button" aria-pressed={candidate.key === range} onClick={() => setRange(candidate.key)}>
              {t(`vo2max_estimates.history_range_${candidate.key}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="vo2max-estimates-v2__note">{t('vo2max_estimates.history_intro', { days: 90 })}</p>

      {plot ? (
        <div className="vo2max-estimates-v2__history-reads" role="group" aria-label={t('vo2max_estimates.history_reads_label')}>
          <div>
            <span>{t('vo2max_estimates.history_read_now')}</span>
            <strong>{history.now != null ? formatNumber(history.now, ONE_DECIMAL) : t('vo2max_estimates.no_hr')}</strong>
          </div>
          <div>
            <span>{t('vo2max_estimates.history_read_high')}</span>
            <strong>{plot.highest ? formatNumber(plot.highest.point.value, ONE_DECIMAL) : t('vo2max_estimates.no_hr')}</strong>
            {plot.highest ? <small>{day(plot.highest.point.time)}</small> : null}
          </div>
          <div>
            <span>{t('vo2max_estimates.history_read_avg')}</span>
            <strong>{plot.average ? formatNumber(plot.average.value, ONE_DECIMAL) : t('vo2max_estimates.no_hr')}</strong>
            {plot.average ? <small>{t('vo2max_estimates.history_read_avg_days', { days: formatNumber(Math.round(plot.average.days)) })}</small> : null}
          </div>
          <div>
            <span>{t('vo2max_estimates.history_read_low')}</span>
            <strong>{plot.lowest ? formatNumber(plot.lowest.point.value, ONE_DECIMAL) : t('vo2max_estimates.no_hr')}</strong>
            {plot.lowest ? <small>{day(plot.lowest.point.time)}</small> : null}
          </div>
        </div>
      ) : (
        <p className="vo2max-estimates-v2__note" role="status">{t('vo2max_estimates.history_empty_range')}</p>
      )}
      <div ref={plotRef} className="vo2max-estimates-v2__plot">
        {plot ? <HistoryPlot key={range} plot={plot} /> : null}
      </div>
      {plot ? <p className="vo2max-estimates-v2__note is-faint">{t('vo2max_estimates.history_hint')}</p> : null}
      {thin ? <p className="vo2max-estimates-v2__note is-faint">{t('vo2max_estimates.history_thin', { count: FIRM_POINT_RUNS })}</p> : null}

      <YearsTable years={history.years} />
      <p className="vo2max-estimates-v2__note is-faint">
        {t('vo2max_estimates.history_basis', { count: FIRM_POINT_RUNS })}{' '}
        <MethodsLink anchor="the-number-over-time" />
      </p>
    </section>
  );
}

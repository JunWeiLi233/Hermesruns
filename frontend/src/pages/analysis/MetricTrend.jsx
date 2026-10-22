import useSectionSearchParams from '../../hooks/useSectionSearchParams';
import { memo, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { MethodsLink } from '../../components/HowWorkedOut';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import useElementWidth from '../../hooks/useElementWidth';
import useReadoutBox from '../../hooks/useReadoutBox';
import {
  AVERAGE_FROM,
  AVERAGE_RUNS,
  DEFAULT_LINE,
  DEFAULT_METRIC,
  DEFAULT_RANGE,
  DEFAULT_RUN_SET,
  LINES,
  METRICS,
  MIN_RUNS_TO_COMPARE,
  RANGES,
  RUN_SETS,
  SPREAD_FROM_RUNS,
  buildMetricTrend,
} from '../../utils/metricTrend';
import { buildTrendPlot } from '../../utils/metricTrendPlot';
import { describeComparison, describeTrend, metricWords } from '../../utils/metricTrendWords';
import { historyTooltipPosition } from '../../utils/vo2maxHistory';
import useAnalysisRuns from './useAnalysisRuns';
import useScrubber from './useScrubber';

/** More dots than this and they are small, with no ring round them. */
const DENSE_POINTS = 120;
/** How tall the readout of a run is taken to be until it has been drawn and measured. */
const READOUT_HEIGHT = 84;

const RANGE_KEYS = RANGES.map((range) => range.key);

/**
 * What the runner has chosen, kept in the address (so that a view can be shared and Back leaves the page): the thing to follow, which runs, the period and the line.
 * A choice that is the default is not written, and a value that is none of the choices is the default.
 */
function useTrendChoice() {
  const [params, setParams] = useSectionSearchParams();
  const pick = (name, allowed, fallback) => (allowed.includes(params.get(name)) ? params.get(name) : fallback);
  const metric = pick('metric', METRICS, DEFAULT_METRIC);
  const runSet = pick('runs', RUN_SETS, DEFAULT_RUN_SET);
  const range = pick('range', RANGE_KEYS, DEFAULT_RANGE);
  const line = pick('line', LINES, DEFAULT_LINE);
  const choose = (name, value, fallback) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value === fallback) next.delete(name);
    else next.set(name, value);
    return next;
  }, { replace: true });
  return {
    metric, runSet, range, line,
    setMetric: (value) => choose('metric', value, DEFAULT_METRIC),
    setRunSet: (value) => choose('runs', value, DEFAULT_RUN_SET),
    setRange: (value) => choose('range', value, DEFAULT_RANGE),
    setLine: (value) => choose('line', value, DEFAULT_LINE),
  };
}

function Skeleton() {
  return (
    <div className="metric-trend-v2__skeleton" aria-hidden="true">
      <span className="page-skeleton__block metric-trend-v2__skeleton-choices" />
      <span className="page-skeleton__block metric-trend-v2__skeleton-tiles" />
      <span className="page-skeleton__block metric-trend-v2__skeleton-chart" />
    </div>
  );
}

/** One row of chips: one of several, in the address. */
function ChipGroup({ label, hint, options, value, onChange, name }) {
  return (
    <div className="metric-trend-v2__choice">
      <span className="metric-trend-v2__choice-label" id={`${name}-label`}>{label}</span>
      <div className="metric-trend-v2__chips" role="group" aria-labelledby={`${name}-label`}>
        {options.map((option) => (
          <button key={option.key} type="button" aria-pressed={option.key === value} onClick={() => onChange(option.key)}>{option.label}</button>
        ))}
      </div>
      {hint ? <p className="metric-trend-v2__hint">{hint}</p> : null}
    </div>
  );
}

/** The four choices: the thing to follow, which runs, the period and the trend line. */
function Choices({ choice }) {
  const { t } = useI18n();
  const idBase = useId();
  const label = (group, keys) => keys.map((key) => ({ key, label: t(`trends.${group}_${key}`) }));
  return (
    <section className="metric-trend-v2__card metric-trend-v2__choices" aria-label={t('trends.choices_label')}>
      <ChipGroup
        name={`${idBase}-metric`}
        label={t('trends.metric_label')}
        options={label('metric', METRICS)}
        value={choice.metric}
        onChange={choice.setMetric}
        hint={t(`trends.metric_hint_${choice.metric}`)}
      />
      <ChipGroup
        name={`${idBase}-set`}
        label={t('trends.set_label')}
        options={label('set', RUN_SETS)}
        value={choice.runSet}
        onChange={choice.setRunSet}
        hint={choice.runSet === 'all' ? null : t('trends.set_hint')}
      />
      <ChipGroup name={`${idBase}-range`} label={t('trends.range_label')} options={label('range', RANGE_KEYS)} value={choice.range} onChange={choice.setRange} />
      <ChipGroup name={`${idBase}-line`} label={t('trends.line_label')} options={label('line', LINES)} value={choice.line} onChange={choice.setLine} />
    </section>
  );
}

/** The four readings: how many runs, their middle, the range they usually keep to, and how the middle stands against the stretch before (or the latest run, for all time). */
function Readings({ model, words }) {
  const { t, lang, formatNumber } = useI18n();
  const { stats, comparison } = model;
  const day = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
  const latest = model.points[model.points.length - 1];

  let fourth;
  if (comparison) {
    const change = comparison.ok ? comparison.change : null;
    fourth = (
      <div>
        <span>{t(`trends.read_compare_${model.range}`)}</span>
        <strong>{change == null ? '--' : words.level(change) ? t('trends.read_compare_same') : t('trends.read_compare_value', { amount: words.amount(change), way: words.way(change) })}</strong>
        <small>
          {comparison.ok
            ? t('trends.read_compare_hint', { median: words.value(comparison.median), count: formatNumber(comparison.count), from: day(comparison.from), to: day(comparison.to) })
            : t('trends.read_compare_few', { count: formatNumber(comparison.count), need: MIN_RUNS_TO_COMPARE })}
        </small>
      </div>
    );
  } else {
    fourth = (
      <div>
        <span>{t('trends.read_latest')}</span>
        <strong>{words.value(latest.value)}</strong>
        <small>{day(latest.day)}</small>
      </div>
    );
  }

  return (
    <div className="metric-trend-v2__reads" role="group" aria-label={t('trends.reads_label')}>
      <div>
        <span>{t('trends.read_runs')}</span>
        <strong>{formatNumber(stats.count)}</strong>
        <small>{t('trends.read_runs_hint', { from: day(model.points[0].day), to: day(latest.day) })}</small>
      </div>
      <div>
        <span>{t('trends.read_middle')}</span>
        <strong>{words.value(stats.median)}</strong>
        <small>{t('trends.read_middle_hint')}</small>
      </div>
      <div>
        <span>{t('trends.read_spread')}</span>
        <strong>{t('trends.read_spread_value', { low: words.value(stats.low), high: words.value(stats.high) })}</strong>
        <small>{stats.usual ? t('trends.read_spread_hint_usual') : t('trends.read_spread_hint_few', { count: SPREAD_FROM_RUNS })}</small>
      </div>
      {fourth}
    </div>
  );
}

/** One run of the chart in words, the same everywhere: the slider's value and the list a screen reader reads. */
function usePointWords(words) {
  const { t, lang } = useI18n();
  const day = (point) => new Date(`${point.day}T12:00:00`).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
  const name = (point) => point.name || t('trends.run_unnamed');
  const type = (point) => (point.runType ? t(`run_labels.type_${point.runType}`) : '');
  return {
    day,
    name,
    type,
    text: (point) => `${t('trends.point_text', { date: day(point), value: words.value(point.value), name: name(point) })}${point.runType ? t('trends.point_type', { type: type(point) }) : ''}`,
  };
}

/** The picture itself: grid, axes, the usual range, the middle, the trend line and a dot for each run. It does not change with the run looked at. */
const PlotMarks = memo(function PlotMarks({ plot, words, dense }) {
  const { lang } = useI18n();
  const axisDay = (at) => new Date(at * 86_400_000).toLocaleDateString(lang, { timeZone: 'UTC', year: 'numeric', month: 'short' });
  return (
    <>
      <rect x={plot.padL} y={plot.band.top} width={plot.width - plot.padL - plot.padR} height={Math.max(1, plot.band.bottom - plot.band.top)} className="metric-trend-v2__band" />
      {words.axisUnit ? <text x={plot.padL - 8} y={plot.padT - 12} textAnchor="end" className="metric-trend-v2__axis-unit">{words.axisUnit}</text> : null}
      {plot.yTicks.map((tick) => (
        <g key={tick.value}>
          <line x1={plot.padL} x2={plot.width - plot.padR} y1={tick.y} y2={tick.y} className="metric-trend-v2__grid" />
          <text x={plot.padL - 8} y={tick.y + 4} textAnchor="end">{words.axis(tick.value)}</text>
        </g>
      ))}
      {plot.xTicks.map((tick, index) => (
        <text key={tick.at} x={tick.x} y={plot.height - 10} textAnchor={index === 0 ? 'start' : index === plot.xTicks.length - 1 ? 'end' : 'middle'}>{axisDay(tick.at)}</text>
      ))}
      <line x1={plot.padL} x2={plot.width - plot.padR} y1={plot.medianY} y2={plot.medianY} className="metric-trend-v2__middle" />
      {plot.straight ? <line x1={plot.straight.x1} y1={plot.straight.y1} x2={plot.straight.x2} y2={plot.straight.y2} className="metric-trend-v2__trend" /> : null}
      {plot.averagePath ? <path d={plot.averagePath} className="metric-trend-v2__trend is-average" /> : null}
      {plot.dots.map((dot) => <circle key={dot.point.key} cx={dot.x} cy={dot.y} r={dense ? 2.2 : 3.5} className="metric-trend-v2__dot" />)}
    </>
  );
});

/** Every run as a list, oldest first, for a screen reader to read through (the slider gives one at a time): the same words as the readout. */
const RunList = memo(function RunList({ model, pointWords }) {
  const { t } = useI18n();
  return (
    <ul className="sr-only metric-trend-v2__list" aria-label={t('trends.list_label')}>
      {model.points.map((point) => <li key={point.key}>{pointWords.text(point)}</li>)}
    </ul>
  );
});

/** The chart as a slider, as the others are: the pointer, a finger or the arrow keys pick one run, and its date, value and name are read out beside it. */
function TrendChart({ model, words }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const wrapRef = useRef(null);
  const measured = useElementWidth(wrapRef);
  const plotRef = useRef(null);
  const readoutRef = useRef(null);
  const readoutBox = useReadoutBox(readoutRef);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const pointWords = usePointWords(words);
  const plot = useMemo(() => buildTrendPlot(model, { width: measured, height: measured < 520 ? 230 : 270, unit }), [model, measured, unit]);
  const lastIndex = model.points.length - 1;
  const positions = useMemo(() => (plot ? plot.dots.map((dot) => dot.x) : []), [plot]);
  const scrub = useScrubber({ plotRef, positions, viewWidth: plot?.width ?? measured, startIndex: lastIndex, lastIndex, selectedIndex, onSelect: setSelectedIndex });
  const dense = model.points.length > DENSE_POINTS;
  const pickedIndex = selectedIndex == null ? null : Math.min(selectedIndex, lastIndex);
  const picked = pickedIndex == null || !plot ? null : plot.dots[pickedIndex];
  const shownIndex = pickedIndex ?? lastIndex;
  const shown = model.points[shownIndex];
  const first = model.points[0];
  const last = model.points[lastIndex];
  const label = model.points.length === 1
    ? t('trends.chart_label_one', { date: pointWords.day(first), value: words.value(first.value) })
    : t('trends.chart_label', {
      count: formatNumber(model.points.length),
      from: pointWords.day(first),
      to: pointWords.day(last),
      metric: t(`trends.metric_${model.metric}`).toLocaleLowerCase(lang),
      low: words.value(model.stats.min),
      high: words.value(model.stats.max),
    });

  return (
    <div ref={wrapRef} className="metric-trend-v2__plot">
      {plot ? (
        <>
          <div
            ref={plotRef}
            className="metric-trend-v2__slider"
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={lastIndex}
            aria-valuenow={shownIndex}
            aria-valuetext={pointWords.text(shown)}
            {...scrub}
          >
            <svg viewBox={`0 0 ${plot.width} ${plot.height}`} width={plot.width} height={plot.height} className={`metric-trend-v2__svg${dense ? ' is-dense' : ''}`} aria-hidden="true">
              <PlotMarks plot={plot} words={words} dense={dense} />
              {picked ? (
                <g>
                  <line x1={picked.x} x2={picked.x} y1={plot.padT} y2={plot.baseline} className="metric-trend-v2__cross" />
                  <circle cx={picked.x} cy={picked.y} r="9" className="metric-trend-v2__selected" />
                </g>
              ) : null}
            </svg>
            {picked ? (
              <div
                ref={readoutRef}
                className="metric-trend-v2__tooltip"
                style={historyTooltipPosition(picked, plot, { width: readoutBox?.width, height: readoutBox?.height ?? READOUT_HEIGHT })}
                aria-hidden="true"
              >
                <time dateTime={picked.point.day}>{pointWords.day(picked.point)}</time>
                <strong>{words.value(picked.point.value)}</strong>
                <span>{pointWords.name(picked.point)}</span>
                {picked.point.runType ? <small>{pointWords.type(picked.point)}</small> : null}
              </div>
            ) : null}
          </div>
          <RunList model={model} pointWords={pointWords} />
        </>
      ) : null}
    </div>
  );
}

/** What the trend line says and how the period compares with the stretch before, in sentences, with what was left out. */
function Sentences({ model, words }) {
  const { t, lang, formatNumber } = useI18n();
  const trend = describeTrend(model, words, { t, formatNumber });
  const compare = describeComparison(model, words, { t });
  return (
    <div className="metric-trend-v2__sentences">
      {trend.length > 0 ? <p className="metric-trend-v2__note">{trend.join(lang === 'zh-CN' ? '' : ' ')}</p> : null}
      {compare ? <p className="metric-trend-v2__note">{compare}</p> : null}
      {model.leftOut > 0 ? <p className="metric-trend-v2__note is-faint">{t('trends.left_out', { what: t(`trends.what_${model.metric}`), count: formatNumber(model.leftOut) })}</p> : null}
    </div>
  );
}

function EmptyState({ model }) {
  const { t, formatNumber } = useI18n();
  return (
    <section className="metric-trend-v2__card metric-trend-v2__empty">
      <h2>{t('trends.empty_title')}</h2>
      <p>{t('trends.empty_body', { what: t(`trends.what_${model.metric}`) })}</p>
      {model.leftOut > 0 ? <p className="metric-trend-v2__note is-faint">{t('trends.left_out', { what: t(`trends.what_${model.metric}`), count: formatNumber(model.leftOut) })}</p> : null}
      <Link className="metric-trend-v2__button" to="/runs">{t('trends.empty_action')}</Link>
    </section>
  );
}

/**
 * Trends: one thing about the runner's runs (their pace, distance, time, heart rate, efficiency or cadence), run by run over a period, with the middle of it, the range
 * the runs usually keep to, a trend line and a comparison with the stretch before. Worked out in the browser from the run list Analysis loads; nothing here judges.
 */
export default function MetricTrend({ showHeader = true, runs: providedRuns } = {}) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const choice = useTrendChoice();
  const { status, runs, reload } = useAnalysisRuns(providedRuns);
  const model = useMemo(
    () => (runs ? buildMetricTrend(runs, { metric: choice.metric, runSet: choice.runSet, range: choice.range, line: choice.line }) : null),
    [runs, choice.metric, choice.runSet, choice.range, choice.line],
  );
  const words = useMemo(() => metricWords(choice.metric, { unit, lang, t, formatNumber }), [choice.metric, unit, lang, t, formatNumber]);

  let body;
  if (model) {
    body = (
      <>
        <Choices choice={choice} />
        {model.points.length > 0 ? (
          <>
            <Readings model={model} words={words} />
            <section className="metric-trend-v2__card" aria-label={t('trends.title')}>
              <div className="metric-trend-v2__legend" aria-hidden="true">
                <span><i className="metric-trend-v2__swatch is-dot" />{t('trends.legend_dot')}</span>
                <span><i className="metric-trend-v2__swatch is-middle" />{t('trends.legend_middle')}</span>
                <span><i className="metric-trend-v2__swatch is-band" />{t('trends.legend_band')}</span>
                <span><i className="metric-trend-v2__swatch is-trend" />{t(`trends.legend_line_${model.line}`)}</span>
              </div>
              <TrendChart key={`${choice.metric}-${choice.runSet}-${choice.range}-${choice.line}`} model={model} words={words} />
              <p className="metric-trend-v2__note is-faint">{t('trends.hint')}</p>
            </section>
            <Sentences model={model} words={words} />
          </>
        ) : (
          <EmptyState model={model} />
        )}
        <p className="metric-trend-v2__note is-faint">
          {t('trends.basis', { spread: SPREAD_FROM_RUNS, window: AVERAGE_RUNS, from: AVERAGE_FROM })}{' '}
          <MethodsLink anchor="trends" />
        </p>
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="metric-trend-v2__state">
        <p className="metric-trend-v2__note is-error" role="alert">{t('trends.error')}</p>
        <button type="button" className="metric-trend-v2__button" onClick={reload}>{t('trends.retry')}</button>
      </div>
    );
  } else {
    body = (
      <>
        <p className="sr-only" role="status">{t('trends.loading')}</p>
        <Skeleton />
      </>
    );
  }

  return (
    <section aria-label={t('trends.title')} className="metric-trend-v2" aria-busy={status === 'loading' ? 'true' : undefined}>
        {showHeader ? (
        <header className="metric-trend-v2__head">
          <div>
            <h2>{t('trends.title')}</h2>
            <p>{t('trends.subtitle')}</p>
          </div>
          <nav className="metric-trend-v2__links" aria-label={t('trends.links_label')}>
            <Link to="/analysis">{t('trends.link_analysis')}</Link>
            <Link to="/analysis#vo2max-estimates">{t('trends.link_vo2max')}</Link>
          </nav>
        </header>
        ) : null}
        {body}
    </section>
  );
}

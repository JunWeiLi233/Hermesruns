import { useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { MethodsLink } from '../../components/HowWorkedOut';
import useElementWidth from '../../hooks/useElementWidth';
import {
  DEFAULT_FITNESS_RANGE,
  FITNESS_RANGES,
  TREND_ARROW,
  buildFitnessChart,
  describeForm,
  fitnessTooltipPosition,
  formatChange,
  formatShortDate,
  movementOver,
  rangeStart,
  restDaysToZeroForm,
  trendDirection,
} from '../../utils/fitnessChart';
import useScrubber from './useScrubber';
import useTrainingSeries from './useTrainingSeries';

const KNOWN_SOURCES = ['HR_ZONES', 'PERCEIVED', 'HR_AVERAGE', 'PACE_MODEL', 'PACE_CALIBRATED'];

function oneDecimal(formatNumber, value) {
  return formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** The lines of the chart: at least one of them stays showing. The bars of daily effort are not a line and can all go. */
const LINE_KEYS = ['fitness', 'fatigue', 'form'];

/** One line under a tile's number: how far it moved, with an arrow that points the way (the words stand beside it). */
function Move({ direction, className, children }) {
  return <em className={className}><span className="analysis-fit-v2-arrow" aria-hidden="true">{TREND_ARROW[direction]}</span> {children}</em>;
}

/**
 * The chart: fitness and fatigue as lines, form as an area below them, and a readout for one day at a time. Which day is
 * selected belongs to the card (its key shows that day's numbers too), so it is handed in.
 */
function FitnessChart({ series, shown, label, selectedIndex, onSelect }) {
  const { t, lang, formatNumber } = useI18n();
  const plotRef = useRef(null);
  const measured = useElementWidth(plotRef);
  const clipId = useId();
  const historyId = useId();
  const geometry = useMemo(
    () => buildFitnessChart(series, {
      width: measured, height: measured < 520 ? 250 : 300, withForm: shown.form, showFitness: shown.fitness, showFatigue: shown.fatigue, withEffort: shown.effort,
    }),
    [series, measured, shown.form, shown.fitness, shown.fatigue, shown.effort],
  );
  const positions = useMemo(() => (geometry ? geometry.entries.map((entry) => entry.x) : []), [geometry]);
  const lastIndex = geometry ? geometry.entries.length - 1 : 0;
  const lastRealIndex = geometry ? geometry.realCount - 1 : 0;
  const scrub = useScrubber({
    plotRef, positions, viewWidth: geometry?.width ?? 0, startIndex: lastRealIndex, lastIndex, selectedIndex, onSelect,
  });
  if (!geometry) return null;

  const selected = selectedIndex == null ? null : geometry.entries[Math.min(selectedIndex, lastIndex)];
  const shownEntry = selected ?? geometry.entries[lastRealIndex];
  const valueText = (entry) => `${formatShortDate(entry.date, lang)}, ${t('training_series.line_fitness')} ${oneDecimal(formatNumber, entry.fitness)}, ${t('training_series.line_fatigue')} ${oneDecimal(formatNumber, entry.fatigue)}, ${t('training_series.line_form')} ${formatChange(entry.form)}${entry.projected ? '' : `, ${t('training_series.tooltip_effort')} ${formatNumber(Math.round(entry.load))}`}${entry.race ? `, ${t('training_series.race_day')}` : ''}`;

  const bottom = geometry.bottom;
  const aboveId = `${clipId}-above`;
  const belowId = `${clipId}-below`;

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
        aria-valuemax={lastIndex}
        aria-valuenow={shownEntry.index}
        aria-valuetext={valueText(shownEntry)}
        {...scrub}
      >
        <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} width={geometry.width} height={geometry.height} aria-hidden="true" className="analysis-fit-v2-svg">
          <defs>
            <clipPath id={aboveId}><rect x="0" y={geometry.formTop} width={geometry.width} height={Math.max(0, geometry.zeroY - geometry.formTop)} /></clipPath>
            <clipPath id={belowId}><rect x="0" y={geometry.zeroY} width={geometry.width} height={Math.max(0, geometry.formBottom - geometry.zeroY)} /></clipPath>
          </defs>

          {geometry.yTicks.map((tick) => (
            <g key={tick.value}>
              <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={tick.y} y2={tick.y} className="analysis-fit-v2-grid" />
              <text x={geometry.padL - 8} y={tick.y + 4} textAnchor="end">{formatNumber(Math.round(tick.value))}</text>
            </g>
          ))}

          {geometry.projectionStartX != null ? (
            <g>
              <line x1={geometry.projectionStartX} x2={geometry.projectionStartX} y1={geometry.mainTop} y2={bottom} className="analysis-fit-v2-today" />
              <text x={geometry.projectionStartX - 6} y={geometry.mainTop + 10} textAnchor="end" className="analysis-fit-v2-today-label">{t('training_series.today')}</text>
            </g>
          ) : null}

          {geometry.raceMarks.map((mark) => (
            <g key={mark.date} className="analysis-fit-v2-race">
              <line x1={mark.x} x2={mark.x} y1={geometry.mainTop} y2={bottom} className="analysis-fit-v2-race-line" />
              <line x1={mark.x} x2={mark.x} y1={geometry.mainTop} y2={geometry.mainTop + 18} className="analysis-fit-v2-race-pole" />
              <path d={`M${mark.x},${geometry.mainTop} L${mark.x + 10},${geometry.mainTop + 4.5} L${mark.x},${geometry.mainTop + 9} Z`} className="analysis-fit-v2-race-flag" />
            </g>
          ))}

          {shown.fatigue ? <path d={geometry.fatiguePath} className="analysis-fit-v2-line is-fatigue" /> : null}
          {shown.fitness ? <path d={geometry.fitnessPath} className="analysis-fit-v2-line is-fitness" /> : null}
          {shown.fatigue && geometry.projectedFatiguePath ? <path d={geometry.projectedFatiguePath} className="analysis-fit-v2-line is-fatigue is-projected" /> : null}
          {shown.fitness && geometry.projectedFitnessPath ? <path d={geometry.projectedFitnessPath} className="analysis-fit-v2-line is-fitness is-projected" /> : null}

          {geometry.withForm ? (
            <g>
              {geometry.formTicks.map((tick) => (
                <g key={tick.value}>
                  <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={tick.y} y2={tick.y} className={tick.value === 0 ? 'analysis-fit-v2-zero' : 'analysis-fit-v2-grid'} />
                  <text x={geometry.padL - 8} y={tick.y + 4} textAnchor="end">{tick.value > 0 ? '+' : tick.value < 0 ? '−' : ''}{formatNumber(Math.round(Math.abs(tick.value)))}</text>
                </g>
              ))}
              <path d={geometry.formArea} className="analysis-fit-v2-form-area is-fresh" clipPath={`url(#${aboveId})`} />
              <path d={geometry.formArea} className="analysis-fit-v2-form-area is-tired" clipPath={`url(#${belowId})`} />
              <path d={geometry.formPath} className="analysis-fit-v2-line is-form" />
              {geometry.projectedFormPath ? <path d={geometry.projectedFormPath} className="analysis-fit-v2-line is-form is-projected" /> : null}
            </g>
          ) : null}

          {geometry.withEffort ? (
            <g className="analysis-fit-v2-effort">
              <text x={geometry.padL} y={geometry.effortTop - 9} className="analysis-fit-v2-effort-caption">{t('training_series.line_effort')}</text>
              {geometry.effortTicks.map((tick) => (
                <g key={tick.value}>
                  <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={tick.y} y2={tick.y} className="analysis-fit-v2-grid" />
                  <text x={geometry.padL - 8} y={tick.y + 4} textAnchor="end">{formatNumber(tick.value)}</text>
                </g>
              ))}
              <path d={geometry.effortPath} className="analysis-fit-v2-effort-bars" />
              {selected && selected.barH > 0 ? (
                <rect x={selected.barX} y={selected.barY} width={geometry.barWidth} height={selected.barH} className="analysis-fit-v2-effort-selected" />
              ) : null}
            </g>
          ) : null}

          {geometry.xTicks.map((entry, index) => (
            <text
              key={entry.date}
              x={entry.x}
              y={geometry.height - 8}
              textAnchor={geometry.xTicks.length === 1 ? 'middle' : index === 0 ? 'start' : index === geometry.xTicks.length - 1 ? 'end' : 'middle'}
            >
              {formatShortDate(entry.date, lang)}
            </text>
          ))}

          {selected ? (
            <g className="analysis-fit-v2-markers">
              <line x1={selected.x} x2={selected.x} y1={geometry.mainTop} y2={bottom} className="analysis-fit-v2-crosshair" />
              {shown.fitness ? <circle cx={selected.x} cy={selected.fitnessY} r="5" className="analysis-fit-v2-dot is-fitness" /> : null}
              {shown.fatigue ? <circle cx={selected.x} cy={selected.fatigueY} r="4.5" className="analysis-fit-v2-dot is-fatigue" /> : null}
              {geometry.withForm ? <circle cx={selected.x} cy={selected.formY} r="4.5" className="analysis-fit-v2-dot is-form" /> : null}
            </g>
          ) : null}
        </svg>

        {selected ? (
          <div className="analysis-fit-v2-tooltip" style={fitnessTooltipPosition(selected, geometry)} aria-hidden="true">
            <time dateTime={selected.date}>{formatShortDate(selected.date, lang)}{selected.projected ? ` · ${t('training_series.if_rest')}` : ''}</time>
            {shown.fitness ? <div className="is-fitness"><i /><span>{t('training_series.line_fitness')}</span><strong>{oneDecimal(formatNumber, selected.fitness)}</strong></div> : null}
            {shown.fatigue ? <div className="is-fatigue"><i /><span>{t('training_series.line_fatigue')}</span><strong>{oneDecimal(formatNumber, selected.fatigue)}</strong></div> : null}
            {shown.form ? <div className="is-form"><i /><span>{t('training_series.line_form')}</span><strong>{formatChange(selected.form)}</strong></div> : null}
            {selected.race ? <div className="is-race"><span>{t('training_series.race_day')}</span></div> : null}
            {!selected.projected ? <div className="is-effort"><span>{t('training_series.tooltip_effort')}</span><strong>{formatNumber(Math.round(selected.load))}</strong></div> : null}
          </div>
        ) : null}
      </div>

      <ul id={historyId} className="sr-only analysis-profile-v2-history" data-analysis-history="fitness">
        {geometry.entries.map((entry) => (
          <li key={entry.date}>
            <span>{formatShortDate(entry.date, lang)}{entry.projected ? ` (${t('training_series.if_rest')})` : ''}</span>
            <span>{`${t('training_series.line_fitness')}: ${oneDecimal(formatNumber, entry.fitness)}`}</span>
            <span>{`${t('training_series.line_fatigue')}: ${oneDecimal(formatNumber, entry.fatigue)}`}</span>
            <span>{`${t('training_series.line_form')}: ${formatChange(entry.form)}`}</span>
            {entry.projected ? null : <span>{`${t('training_series.tooltip_effort')}: ${formatNumber(Math.round(entry.load))}`}</span>}
            {entry.race ? <span>{t('training_series.race_day')}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A sentence saying how many of the runs each kind of effort came from, most common first. */
function sourcesSentence(t, formatNumber, formatList, data) {
  const entries = Object.entries(data.sources ?? {}).filter(([, count]) => count > 0);
  if (entries.length === 0 || !data.runs) return null;
  const parts = entries.map(([key, count]) => t('training_series.sources_part', {
    count: formatNumber(count),
    source: t(`training_series.source_${KNOWN_SOURCES.includes(key) ? key : 'UNKNOWN'}`),
  }));
  return t(data.runs === 1 ? 'training_series.sources_one' : 'training_series.sources', {
    count: formatNumber(data.runs),
    list: formatList(parts),
  });
}

/**
 * Fitness, fatigue and form (S13, S14): how a runner's daily effort has built up over weeks, and how fresh that leaves
 * them. A card on the Load balance page, kept apart from the acute and chronic chart there because it is built on the
 * run Effort score, which is not the load that chart uses. It fetches for itself once the page has its runs.
 */
export default function FitnessFormSection() {
  const { t, lang, formatNumber, formatList } = useI18n();
  const titleId = useId();
  const [rangeKey, setRangeKey] = useState(DEFAULT_FITNESS_RANGE);
  const [shown, setShown] = useState({ fitness: true, fatigue: true, form: true, effort: true });
  const [selectedIndex, setSelectedIndex] = useState(null);
  const from = useMemo(() => rangeStart(rangeKey), [rangeKey]);
  const { status, data, stale, reload } = useTrainingSeries(from);

  const toggle = (key) => setShown((current) => {
    const next = { ...current, [key]: !current[key] };
    // At least one line stays: an empty chart would look like a failure.
    return LINE_KEYS.some((line) => next[line]) ? next : current;
  });
  const changeRange = (key) => {
    setRangeKey(key);
    setSelectedIndex(null);
  };

  const ready = Boolean(data && data.status === 'ready' && data.points.length > 0);
  const current = ready ? data.current : null;
  const formWord = current ? describeForm(current.form, current.fitness) : 'even';
  // Fitness against a week ago, as a number and as a share of what it was (no share when it was nothing).
  const fitnessWeekAgo = current ? current.fitness - current.fitnessChange7d : 0;
  const fitnessWeekText = !current ? '' : fitnessWeekAgo > 0
    ? t('training_series.change_week_pct', { change: formatChange(current.fitnessChange7d), percent: `${formatChange((current.fitnessChange7d / fitnessWeekAgo) * 100, { digits: 0 })}%` })
    : t('training_series.change_week', { change: formatChange(current.fitnessChange7d) });
  // The 14 days are the difference of the two numbers on the chart; the 7 days come from the server, which works them out unrounded.
  const fortnight = {
    fitness: ready ? movementOver(data.points, 'fitness', 14) : null,
    fatigue: ready ? movementOver(data.points, 'fatigue', 14) : null,
    form: ready ? movementOver(data.points, 'form', 14) : null,
  };
  const fortnightText = (move, { withPercent }) => (withPercent && move.ratio != null
    ? t('training_series.change_fortnight_pct', { change: formatChange(move.change), percent: `${formatChange(move.ratio * 100, { digits: 0 })}%` })
    : t('training_series.change_fortnight', { change: formatChange(move.change) }));
  const sentence = data ? sourcesSentence(t, formatNumber, formatList, data) : null;
  const rest = ready ? restDaysToZeroForm(data) : { state: 'none' };
  // The day whose numbers the key shows: the one being looked at, else today.
  const day = !ready ? null
    : selectedIndex == null ? { ...current, load: data.points[data.points.length - 1].load, projected: false }
      : (selectedIndex < data.points.length ? data.points[selectedIndex] : data.projection[selectedIndex - data.points.length]) ?? current;

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

        {data.status === 'none' ? <p className="analysis-fit-v2-note">{t('training_series.empty_none')}</p> : null}
        {data.status === 'building' ? (
          <p className="analysis-fit-v2-note">{t('training_series.building', { min: data.minHistoryDays, days: data.historyDays })}</p>
        ) : null}
        {data.status === 'ready' && data.points.length === 0 ? <p className="analysis-fit-v2-note">{t('training_series.empty_window')}</p> : null}

        {ready ? (
          <>
            <div className="analysis-load-v2-chart-meta">
              <div className="analysis-fit-v2-toggles" role="group" aria-label={t('training_series.lines_group')}>
                {[...LINE_KEYS, 'effort'].map((key) => (
                  <button key={key} type="button" className={`analysis-fit-v2-toggle is-${key}`} aria-pressed={shown[key]} onClick={() => toggle(key)}>
                    <i aria-hidden="true" />
                    {t(`training_series.line_${key}`)}
                    <strong>{key === 'form' ? formatChange(day.form) : key === 'effort' ? (Number.isFinite(day.load) ? formatNumber(Math.round(day.load)) : '–') : oneDecimal(formatNumber, day[key])}</strong>
                  </button>
                ))}
              </div>
              <span>{selectedIndex == null ? t('training_series.today') : formatShortDate(day.date, lang)}</span>
            </div>

            <FitnessChart
              series={data}
              shown={shown}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              label={t('training_series.chart_label', {
                count: data.points.length,
                from: formatShortDate(data.points[0].date, lang),
                to: formatShortDate(data.points[data.points.length - 1].date, lang),
              })}
            />
            {data.projection.length > 0 ? (
              <p className="analysis-fit-v2-note">{t('training_series.projection_note', { days: data.projection.length })}</p>
            ) : null}
            {rest.state === 'days' ? (
              <p className="analysis-fit-v2-note">
                {t(rest.days === 1 ? 'training_series.rest_zero_one' : 'training_series.rest_zero', { days: rest.days, date: formatShortDate(rest.date, lang) })}
              </p>
            ) : null}
            {rest.state === 'later' ? <p className="analysis-fit-v2-note">{t('training_series.rest_zero_later', { days: rest.days })}</p> : null}
            <p className="analysis-fit-v2-note is-faint">
              {Array.isArray(data.raceDays) && data.raceDays.length > 0 ? t('training_series.race_key') : t('training_series.race_hint')}
            </p>

            <section className="analysis-load-v2-metrics analysis-fit-v2-metrics" aria-label={t('training_series.cards_label')}>
              <article className="analysis-load-v2-metric">
                <span>{t('training_series.line_fitness')}</span>
                <strong>{oneDecimal(formatNumber, current.fitness)}</strong>
                <Move direction={trendDirection(current.fitnessChange7d, fitnessWeekAgo)} className={current.fitnessChange7d < 0 ? 'is-neutral' : undefined}>{fitnessWeekText}</Move>
                {fortnight.fitness ? (
                  <Move direction={fortnight.fitness.direction} className={fortnight.fitness.change < 0 ? 'is-neutral' : undefined}>{fortnightText(fortnight.fitness, { withPercent: true })}</Move>
                ) : null}
                <small>{t('training_series.card_fitness_note', { days: data.fitnessDays })}</small>
              </article>
              <article className="analysis-load-v2-metric">
                <span>{t('training_series.line_fatigue')}</span>
                <strong>{oneDecimal(formatNumber, current.fatigue)}</strong>
                <Move direction={trendDirection(current.fatigueChange7d, current.fatigue - current.fatigueChange7d)} className="is-neutral">{t('training_series.change_week', { change: formatChange(current.fatigueChange7d) })}</Move>
                {fortnight.fatigue ? (
                  <Move direction={fortnight.fatigue.direction} className="is-neutral">{fortnightText(fortnight.fatigue, { withPercent: false })}</Move>
                ) : null}
                <small>{t('training_series.card_fatigue_note', { days: data.fatigueDays })}</small>
              </article>
              <article className={`analysis-load-v2-metric${formWord === 'tired' ? ' is-watch' : ''}`}>
                <span>{t('training_series.line_form')}</span>
                <strong>{formatChange(current.form)}</strong>
                <em className={formWord === 'even' ? 'is-neutral' : undefined}>{t(`training_series.form_${formWord}`)}</em>
                {Number.isFinite(current.formChange7d) ? (
                  <Move direction={trendDirection(current.formChange7d, Math.max(Math.abs(current.form), Math.abs(current.form - current.formChange7d)))} className="is-neutral">{t('training_series.change_week', { change: formatChange(current.formChange7d) })}</Move>
                ) : null}
                {fortnight.form ? (
                  <Move direction={fortnight.form.direction} className="is-neutral">{fortnightText(fortnight.form, { withPercent: false })}</Move>
                ) : null}
                <small>{t('training_series.card_form_note')}</small>
              </article>
            </section>
          </>
        ) : null}

        {sentence ? <p className="analysis-fit-v2-note">{sentence}</p> : null}
        {data.pendingRuns > 0 ? (
          <p className="analysis-fit-v2-note" role="status">
            {t('training_series.pending', { count: formatNumber(data.pendingRuns) })}{' '}
            <button type="button" className="analysis-load-v2-link" onClick={reload}>{t('training_series.refresh')}</button>
          </p>
        ) : null}
        {data.status !== 'none' ? (
          <p className="analysis-fit-v2-note is-faint">{t('training_series.basis', { fitnessDays: data.fitnessDays, fatigueDays: data.fatigueDays })} <MethodsLink anchor="fitness-fatigue-and-form" /></p>
        ) : null}
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="analysis-fit-v2-state">
        <p className="analysis-fit-v2-note is-error" role="alert">{t('training_series.error')}</p>
        <button type="button" className="analysis-load-v2-link" onClick={reload}>{t('training_series.retry')}</button>
      </div>
    );
  } else {
    body = (
      <div className="analysis-fit-v2-skeleton" aria-hidden="true">
        <span className="page-skeleton__block analysis-fit-v2-skeleton-chart" />
        <span className="page-skeleton__block analysis-fit-v2-skeleton-line" />
        <span className="page-skeleton__block analysis-fit-v2-skeleton-line is-short" />
      </div>
    );
  }

  return (
    <section
      id="load-fitness"
      tabIndex={-1}
      className="analysis-load-v2-chart analysis-fit-v2"
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}
    >
      <div className="analysis-load-v2-head">
        <div>
          <h2 id={titleId}>{t('training_series.fitness_title')}</h2>
          <p>{t('training_series.fitness_hint')}</p>
        </div>
        <div className="analysis-load-v2-ranges" role="group" aria-label={t('training_series.range_group')}>
          {FITNESS_RANGES.map((range) => (
            <button key={range.key} type="button" aria-pressed={range.key === rangeKey} onClick={() => changeRange(range.key)}>
              {t(`training_series.range_${range.key}`)}
            </button>
          ))}
        </div>
      </div>
      {status === 'loading' && !data ? <p className="sr-only" role="status">{t('training_series.loading')}</p> : null}
      {body}
    </section>
  );
}

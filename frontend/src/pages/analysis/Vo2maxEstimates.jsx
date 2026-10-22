import { useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { MethodsLink } from '../../components/HowWorkedOut';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import useElementWidth from '../../hooks/useElementWidth';
import { formatChange } from '../../utils/fitnessChart';
import { formatDistance, formatDuration, formatPaceSeconds } from '../../utils/format';
import { paceForUnit } from '../../utils/paceCurveChart';
import { SHORTEST_RACE_KM, buildRaceEvidence } from '../../utils/raceEvidence';
import { buildVo2maxHistory } from '../../utils/vo2maxHistory';
import { POOL_MIN_KM, SHORTEST_KM, SLOW_RUN_FACTOR, TOP_COUNT, buildEstimatePlot, buildVdotEvidence } from '../../utils/vdotEvidence';
import useAnalysisRuns from './useAnalysisRuns';
import Vo2maxHistory from './Vo2maxHistory';

const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

function paceLabel(secondsPerKm, unit) {
  return `${formatPaceSeconds(paceForUnit(secondsPerKm, unit))} ${unit === 'mile' ? '/mi' : '/km'}`;
}

/** The pool's shortest run, in the runner's unit: "3 km" or "1.9 mi". */
function poolLength(lang, unit) {
  return formatDistance(POOL_MIN_KM, unit === 'mile' ? 1 : 0, lang, unit);
}

function Skeleton() {
  return (
    <div className="vo2max-estimates-v2__skeleton" aria-hidden="true">
      <span className="page-skeleton__block vo2max-estimates-v2__skeleton-tiles" />
      <span className="page-skeleton__block vo2max-estimates-v2__skeleton-chart" />
      <span className="page-skeleton__block vo2max-estimates-v2__skeleton-line" />
    </div>
  );
}

/** The number, how many runs there are behind it, and the one input of the heart-rate estimates a wrong value spoils. */
function Tiles({ evidence }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const minLength = poolLength(lang, unit);

  let currentHint;
  if (evidence.poolCount === 1) currentHint = t('vo2max_estimates.tile_current_hint_single');
  else if (evidence.pool === 'strict') {
    currentHint = t('vo2max_estimates.tile_current_hint_strict', { used: evidence.usedCount, pool: evidence.poolCount, minLength });
  } else {
    currentHint = t('vo2max_estimates.tile_current_hint_all', { used: evidence.usedCount, pool: evidence.poolCount, minLength });
  }

  return (
    <section className="vo2max-estimates-v2__tiles" aria-label={t('vo2max_estimates.tiles_label')}>
      <article>
        <span>{t('vo2max_estimates.tile_current')}</span>
        <strong>{formatNumber(evidence.value, ONE_DECIMAL)}</strong>
        <small>{currentHint}</small>
      </article>
      <article>
        <span>{t('vo2max_estimates.tile_runs')}</span>
        <strong>{formatNumber(evidence.rows.length)}</strong>
        <small>{t('vo2max_estimates.tile_runs_hint', { hr: evidence.methodCounts.hr, race: evidence.methodCounts.race })}</small>
      </article>
      <article>
        <span>{t('vo2max_estimates.tile_hr')}</span>
        <strong>{evidence.hrMax != null ? t('vo2max_estimates.tile_hr_value', { bpm: formatNumber(evidence.hrMax) }) : t('vo2max_estimates.tile_hr_none')}</strong>
        <small>{evidence.hrMax != null ? t('vo2max_estimates.tile_hr_hint') : t('vo2max_estimates.tile_hr_hint_none')}</small>
      </article>
    </section>
  );
}

/** One dot for each run: the day across, the estimate up, the number as a line. */
function EstimatePlot({ evidence }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const plotRef = useRef(null);
  const measured = useElementWidth(plotRef);
  const titleId = useId();
  const geometry = useMemo(
    () => buildEstimatePlot({
      rows: evidence.rows,
      value: evidence.value,
      now: evidence.now,
      windowDays: evidence.windowDays,
      width: measured,
      height: measured < 520 ? 240 : 280,
    }),
    [evidence, measured],
  );
  if (!geometry) return null;

  const day = (time) => new Date(time).toLocaleDateString(lang, { month: 'short', day: 'numeric' });
  return (
    <div ref={plotRef} className="vo2max-estimates-v2__plot">
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        width={geometry.width}
        height={geometry.height}
        className="vo2max-estimates-v2__svg"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{t('vo2max_estimates.chart_label', { days: evidence.windowDays })}</title>
        {geometry.yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={tick.y} y2={tick.y} className="vo2max-estimates-v2__grid" />
            <text x={geometry.padL - 8} y={tick.y + 4} textAnchor="end">{tick.value}</text>
          </g>
        ))}
        {geometry.xTicks.map((tick, index) => (
          <text
            key={tick.time}
            x={tick.x}
            y={geometry.height - 10}
            textAnchor={index === 0 ? 'start' : index === geometry.xTicks.length - 1 ? 'end' : 'middle'}
          >
            {day(tick.time)}
          </text>
        ))}
        {geometry.mean ? (
          <g>
            <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={geometry.mean.y} y2={geometry.mean.y} className="vo2max-estimates-v2__mean" />
            <text
              x={geometry.mean.side === 'left' ? geometry.padL + 6 : geometry.width - geometry.padR - 4}
              y={geometry.mean.y - 6}
              textAnchor={geometry.mean.side === 'left' ? 'start' : 'end'}
              className="vo2max-estimates-v2__mean-label"
            >
              {t('vo2max_estimates.mean_label', { value: formatNumber(geometry.mean.value, ONE_DECIMAL) })}
            </text>
          </g>
        ) : null}
        {geometry.dots.map((dot) => (
          <circle
            key={dot.row.key}
            cx={dot.x}
            cy={dot.y}
            r={dot.role === 'counted' ? 6 : 5}
            className={`vo2max-estimates-v2__dot is-${dot.role}`}
          >
            <title>
              {`${dot.row.name || t('vo2max_estimates.run_fallback')}: ${formatNumber(dot.row.vdot, TWO_DECIMALS)}, ${formatDistance(dot.row.distanceKm, 1, lang, unit)}, ${dot.row.date.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' })}`}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/** The same runs in numbers, highest first: what each run was, how its estimate was made and whether it counts. */
function EstimateTable({ evidence, compact = false }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const minLength = poolLength(lang, unit);
  const showAdjusted = evidence.rows.some((row) => row.adjustedVdot - row.vdot >= 0.05);
  const [showAll, setShowAll] = useState(false);
  const tableId = useId();
  const rows = compact && !showAll ? evidence.rows.slice(0, 6) : evidence.rows;

  return (
    <div className="vo2max-estimates-v2__runs">
    <div className="vo2max-estimates-v2__table-wrap" role="region" tabIndex={0} aria-label={t('vo2max_estimates.table_label', { days: evidence.windowDays })}>
      <table id={tableId} className="vo2max-estimates-v2__table" aria-label={t('vo2max_estimates.table_label', { days: evidence.windowDays })}>
        <thead>
          <tr>
            <th scope="col">{t('vo2max_estimates.col_day')}</th>
            <th scope="col">{t('vo2max_estimates.col_run')}</th>
            <th scope="col">{t('vo2max_estimates.col_distance')}</th>
            <th scope="col">{t('vo2max_estimates.col_pace')}</th>
            <th scope="col">{t('vo2max_estimates.col_hr')}</th>
            <th scope="col">{t('vo2max_estimates.col_method')}</th>
            <th scope="col">{t('vo2max_estimates.col_estimate')}</th>
            {showAdjusted ? <th scope="col">{t('vo2max_estimates.col_adjusted')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            let heartRate = t('vo2max_estimates.no_hr');
            if (row.averageHeartRate != null) {
              heartRate = row.heartRateShare != null
                ? t('vo2max_estimates.hr_cell', { bpm: row.averageHeartRate, percent: Math.round(row.heartRateShare * 100) })
                : t('vo2max_estimates.hr_cell_plain', { bpm: row.averageHeartRate });
            }
            return (
              <tr key={row.key} className={row.counted ? 'is-counted' : !row.eligible ? 'is-outside' : undefined}>
                <th scope="row"><time dateTime={row.date.toISOString()}>{row.date.toLocaleDateString(lang, { ...(!compact ? { year: 'numeric' } : {}), month: 'short', day: 'numeric' })}</time></th>
                <td className="vo2max-estimates-v2__run">
                  {row.id != null ? <Link to={`/runs/${row.id}`}>{row.name || t('vo2max_estimates.run_fallback')}</Link> : (row.name || t('vo2max_estimates.run_fallback'))}
                </td>
                <td>{formatDistance(row.distanceKm, 1, lang, unit)}</td>
                <td>{paceLabel(row.paceSecondsPerKm, unit)}</td>
                <td>{heartRate}</td>
                <td>{t(`vo2max_estimates.method_${row.method}`)}</td>
                <td>
                  {row.counted ? <small className="vo2max-estimates-v2__tag is-counted">{t('vo2max_estimates.tag_counted')}</small> : null}
                  {!row.eligible ? <small className="vo2max-estimates-v2__tag">{t('vo2max_estimates.tag_short', { minLength })}</small> : null}
                  <strong>{formatNumber(row.vdot, TWO_DECIMALS)}</strong>
                </td>
                {showAdjusted ? <td>{formatNumber(row.adjustedVdot, TWO_DECIMALS)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {compact && evidence.rows.length > 6 ? (
      <button className="vo2max-estimates-v2__show-runs" type="button" aria-expanded={showAll} aria-controls={tableId} onClick={() => setShowAll(value => !value)}>
        {t(showAll ? 'vo2max_estimates.show_fewer' : 'vo2max_estimates.show_all', { count: evidence.rows.length })}
      </button>
    ) : null}
    </div>
  );
}

/** Keep the race check beside the estimates, with its full evidence one click away. */
function RaceSummary({ races }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const way = races.meanGap > 0 ? 'above' : races.meanGap < 0 ? 'below' : 'level';
  const summary = races.count === 0 ? t('vo2max_estimates.races_empty_compact')
    : races.comparedCount === 0 ? t('vo2max_estimates.races_summary_none', {
      minLength: formatDistance(SHORTEST_RACE_KM, 1, lang, unit), days: races.windowDays,
    }) : t(`vo2max_estimates.races_summary_${races.comparedCount === 1 ? 'one' : 'many'}_${way}`, {
      count: races.comparedCount, gap: formatNumber(Math.abs(races.meanGap), ONE_DECIMAL),
    });
  return (
    <details className="vo2max-estimates-v2__race-evidence">
      <summary><strong>{t('vo2max_estimates.races_compact_title')}</strong><span>{summary}</span></summary>
      <Races races={races} />
    </details>
  );
}

function HistoryDisclosure({ runs }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const history = useMemo(() => open ? buildVo2maxHistory(runs) : null, [runs, open]);
  return (
    <details className="vo2max-estimates-v2__history-disclosure" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{t('vo2max_estimates.history_title')}</summary>
      {open ? <Vo2maxHistory history={history} /> : null}
    </details>
  );
}

/**
 * The runner's races, each set against the VO2max the app showed the day before it: whether the number was low or high for
 * them. The runs the runner set to the Race type are the only input; nothing here changes the number.
 */
function Races({ races }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const headingId = useId();
  const minLength = formatDistance(SHORTEST_RACE_KM, 1, lang, unit);

  let body;
  if (races.count === 0) {
    body = (
      <>
        <p className="vo2max-estimates-v2__note">{t('vo2max_estimates.races_empty')}</p>
        <Link className="vo2max-estimates-v2__button" to="/runs">{t('vo2max_estimates.races_empty_action')}</Link>
      </>
    );
  } else {
    const way = races.meanGap > 0 ? 'above' : races.meanGap < 0 ? 'below' : 'level';
    const summary = races.comparedCount === 0
      ? t('vo2max_estimates.races_summary_none', { minLength, days: races.windowDays })
      : t(`vo2max_estimates.races_summary_${races.comparedCount === 1 ? 'one' : 'many'}_${way}`, {
        count: races.comparedCount,
        gap: formatNumber(Math.abs(races.meanGap), ONE_DECIMAL),
      });
    body = (
      <>
        <p className="vo2max-estimates-v2__note">{t('vo2max_estimates.races_intro', { days: races.windowDays })}</p>
        <div className="vo2max-estimates-v2__table-wrap">
          <table className="vo2max-estimates-v2__table is-races" aria-label={t('vo2max_estimates.races_table_label')}>
            <thead>
              <tr>
                <th scope="col">{t('vo2max_estimates.races_col_day')}</th>
                <th scope="col">{t('vo2max_estimates.races_col_race')}</th>
                <th scope="col">{t('vo2max_estimates.races_col_distance')}</th>
                <th scope="col">{t('vo2max_estimates.races_col_time')}</th>
                <th scope="col">{t('vo2max_estimates.races_col_from_time')}</th>
                <th scope="col">{t('vo2max_estimates.races_col_before')}</th>
                <th scope="col">{t('vo2max_estimates.races_col_gap')}</th>
              </tr>
            </thead>
            <tbody>
              {races.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.date.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' })}</th>
                  <td className="vo2max-estimates-v2__run">
                    {row.id != null ? <Link to={`/runs/${row.id}`}>{row.name || t('vo2max_estimates.run_fallback')}</Link> : (row.name || t('vo2max_estimates.run_fallback'))}
                  </td>
                  <td>{formatDistance(row.distanceKm, 1, lang, unit)}</td>
                  <td>{formatDuration(row.timeSeconds)}</td>
                  <td>
                    {row.tooShort
                      ? <>{t('vo2max_estimates.no_hr')}<small className="vo2max-estimates-v2__tag">{t('vo2max_estimates.races_tag_short', { minLength })}</small></>
                      : <strong>{formatNumber(row.vdot, ONE_DECIMAL)}</strong>}
                  </td>
                  <td>
                    {row.tooShort ? t('vo2max_estimates.no_hr')
                      : row.before != null ? formatNumber(row.before, ONE_DECIMAL)
                        : <span className="vo2max-estimates-v2__none">{t('vo2max_estimates.races_before_none')}</span>}
                  </td>
                  <td>{row.gap != null ? <strong>{formatChange(row.gap)}</strong> : t('vo2max_estimates.no_hr')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="vo2max-estimates-v2__note">{summary}</p>
        {races.comparedCount > 1 ? (
          <p className="vo2max-estimates-v2__note">
            {t('vo2max_estimates.races_split', { count: races.comparedCount, above: races.above, below: races.below, level: races.level })}
          </p>
        ) : null}
        <p className="vo2max-estimates-v2__note">{t('vo2max_estimates.races_read')}</p>
        <p className="vo2max-estimates-v2__note is-faint">
          {t('vo2max_estimates.races_basis', { days: races.windowDays })}{' '}
          <MethodsLink anchor="your-races-against-the-number" />
        </p>
      </>
    );
  }

  return (
    <section className="vo2max-estimates-v2__races" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('vo2max_estimates.races_title')}</h2>
      {body}
    </section>
  );
}

/** When no run of the window gives an estimate: what a run needs to give one. */
function EmptyState({ evidence }) {
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  return (
    <section className="vo2max-estimates-v2__empty">
      <h2>{t('vo2max_estimates.empty_title')}</h2>
      <p>{t('vo2max_estimates.empty_body', { days: evidence.windowDays, shortest: formatDistance(SHORTEST_KM, 1, lang, unit) })}</p>
      <Link className="vo2max-estimates-v2__button" to="/runs">{t('vo2max_estimates.empty_action')}</Link>
    </section>
  );
}

/** Under the table: the sum behind the number, what one run moves it by, and the runs the rule left out. */
function Working({ evidence, compact = false, detailsOnly = false }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const { arithmetic, withoutBest } = evidence;

  return (
    <div className="vo2max-estimates-v2__working">
      {!detailsOnly && arithmetic ? (
        <p className="vo2max-estimates-v2__note">
          {arithmetic.terms.length === 1
            ? t('vo2max_estimates.arithmetic_single', {
              mean: formatNumber(arithmetic.mean, TWO_DECIMALS),
              shown: formatNumber(arithmetic.shown, ONE_DECIMAL),
            })
            : t('vo2max_estimates.arithmetic', {
              sum: arithmetic.terms.map((term) => formatNumber(term, TWO_DECIMALS)).join(' + '),
              count: arithmetic.terms.length,
              mean: formatNumber(arithmetic.mean, TWO_DECIMALS),
              shown: formatNumber(arithmetic.shown, ONE_DECIMAL),
            })}
        </p>
      ) : null}
      {!detailsOnly && withoutBest ? (
        <p className="vo2max-estimates-v2__note">
          {t('vo2max_estimates.without_best', {
            value: formatNumber(withoutBest.value, ONE_DECIMAL),
            drop: formatNumber(withoutBest.drop, ONE_DECIMAL),
          })}
        </p>
      ) : null}
      {compact ? <MethodsLink anchor="vdot-and-vo2max" /> : null}
      {compact ? <details className="vo2max-estimates-v2__calculation-details"><summary>{t('vo2max_estimates.calculation_details')}</summary><Working evidence={evidence} detailsOnly /></details> : null}
      {!compact && evidence.leftOut > 0 ? (
        <p className="vo2max-estimates-v2__note">
          {t('vo2max_estimates.left_out', {
            count: evidence.leftOut,
            days: evidence.windowDays,
            percent: Math.round((SLOW_RUN_FACTOR - 1) * 100),
            median: evidence.medianPaceSecondsPerKm != null ? paceLabel(evidence.medianPaceSecondsPerKm, unit) : '--',
            cutoff: evidence.slowCutoffSecondsPerKm != null ? paceLabel(evidence.slowCutoffSecondsPerKm, unit) : '--',
          })}
        </p>
      ) : null}
      {!compact ? <p className="vo2max-estimates-v2__note is-faint">
        {t('vo2max_estimates.basis', {
          days: evidence.windowDays,
          minLength: poolLength(lang, unit),
          shortest: formatDistance(SHORTEST_KM, 1, lang, unit),
          top: TOP_COUNT,
        })}{' '}
        <MethodsLink anchor="vdot-and-vo2max" />
      </p> : null}
    </div>
  );
}

/**
 * The runs behind the VO2max number on Analysis: every run of the last 90 days that gives an estimate, the three the number
 * is the mean of, and the inputs the rule takes from the runner's data, so the number can be checked against the runs.
 * The order is the number and the dots of the 90 days, then how it got there (the line over time) and how it stands against the
 * races, then the table of the runs, which is the longest part, and the working: the line used to start three screens down.
 */
export default function Vo2maxEstimates({ showHeader = true, runs: providedRuns, compact = false } = {}) {
  const { t } = useI18n();
  const { status, runs, reload } = useAnalysisRuns(providedRuns);
  const evidence = useMemo(() => (runs ? buildVdotEvidence(runs) : null), [runs]);
  const races = useMemo(() => (runs ? buildRaceEvidence(runs) : null), [runs]);
  const history = useMemo(() => (runs && !compact ? buildVo2maxHistory(runs) : null), [runs, compact]);

  let body;
  if (evidence && evidence.rows.length > 0) {
    body = (
      <>
        <Tiles evidence={evidence} />
        <section className="vo2max-estimates-v2__card" aria-label={t('vo2max_estimates.plot_label')}>
          <div className="vo2max-estimates-v2__legend" aria-hidden="true">
            <span><i className="vo2max-estimates-v2__swatch is-counted" />{t('vo2max_estimates.legend_counted')}</span>
            <span><i className="vo2max-estimates-v2__swatch is-other" />{t('vo2max_estimates.legend_other')}</span>
            {evidence.rows.some((row) => !row.eligible) ? (
              <span><i className="vo2max-estimates-v2__swatch is-short" />{t('vo2max_estimates.legend_short')}</span>
            ) : null}
            <span><i className="vo2max-estimates-v2__swatch is-mean" />{t('vo2max_estimates.legend_mean')}</span>
          </div>
          <EstimatePlot evidence={evidence} />
          {!compact ? <p className="vo2max-estimates-v2__note is-faint">{t('vo2max_estimates.axis_caption', { days: evidence.windowDays })}</p> : null}
        </section>
        {compact ? <RaceSummary races={races} /> : <><Vo2maxHistory history={history} /><Races races={races} /></>}
        <EstimateTable evidence={evidence} compact={compact} />
        <Working evidence={evidence} compact={compact} />
        {compact ? <HistoryDisclosure runs={runs} /> : null}
      </>
    );
  } else if (evidence) {
    body = (
      <>
        <EmptyState evidence={evidence} />
        {compact ? <HistoryDisclosure runs={runs} /> : <Vo2maxHistory history={history} />}
        <Races races={races} />
        <Working evidence={evidence} />
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="vo2max-estimates-v2__state">
        <p className="vo2max-estimates-v2__note is-error" role="alert">{t('vo2max_estimates.error')}</p>
        <button type="button" className="vo2max-estimates-v2__button" onClick={reload}>{t('vo2max_estimates.retry')}</button>
      </div>
    );
  } else {
    body = (
      <>
        <p className="sr-only" role="status">{t('vo2max_estimates.loading')}</p>
        <Skeleton />
      </>
    );
  }

  return (
    <section aria-label={t('vo2max_estimates.title')} className={`vo2max-estimates-v2${compact ? ' vo2max-estimates-v2--compact' : ''}`} aria-busy={status === 'loading' ? 'true' : undefined}>
        {showHeader ? (
        <header className="vo2max-estimates-v2__head">
          <div>
            <h2>{t('vo2max_estimates.title')}</h2>
            <p>{t('vo2max_estimates.subtitle')}</p>
          </div>
          <nav className="vo2max-estimates-v2__links" aria-label={t('vo2max_estimates.links_label')}>
            <Link to="/analysis">{t('vo2max_estimates.link_analysis')}</Link>
            <Link to="/prediction/10k">{t('vo2max_estimates.link_predictions')}</Link>
          </nav>
        </header>
        ) : null}
        {body}
    </section>
  );
}

import { useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import useElementWidth from '../../hooks/useElementWidth';
import { formatCalendarDate } from '../../utils/bestEfforts';
import { formatDuration, formatPaceSeconds } from '../../utils/format';
import { buildMatchScatter, formatPaceDelta } from '../../utils/matchesChart';
import { buildRunDetailPath } from '../../utils/runRoute';
import useRunMatches from './useRunMatches';

/** One dot per run by day and pace, faster nearer the top, with the run on screen and the fastest picked out. */
function MatchScatter({ runs, label }) {
  const { t, lang } = useI18n();
  const figureRef = useRef(null);
  const measured = useElementWidth(figureRef);
  // Drawn at the width it has, so the labels keep their size on a phone and the chart fills a wide card.
  const scatter = useMemo(() => buildMatchScatter(runs, { width: measured, height: measured < 520 ? 190 : 230 }), [runs, measured]);
  const unit = t('run_detail.unit_pace');
  // The key shows only what the chart shows: a year without this run or the fastest has no such dot.
  const hasCurrent = Boolean(scatter?.points.some((point) => point.run.current));
  const hasFastest = Boolean(scatter?.points.some((point) => point.run.fastest && !point.run.current));
  const hasOthers = Boolean(scatter?.points.some((point) => !point.run.current && !point.run.fastest));
  return (
    <figure className="run-detail-v2__rm-chart" ref={figureRef}>
      {scatter ? <MatchScatterSvg scatter={scatter} label={label} unit={unit} lang={lang} /> : null}
      {scatter ? (
        <figcaption>
          <ul className="run-detail-v2__rm-legend" aria-hidden="true">
            {hasCurrent ? <li className="is-current">{t('run_matches.legend_current')}</li> : null}
            {hasFastest ? <li className="is-fastest">{t('run_matches.legend_fastest')}</li> : null}
            {hasOthers ? <li className="is-other">{t('run_matches.legend_other')}</li> : null}
            {scatter.trend ? <li className="is-trend">{t('run_matches.legend_trend')}</li> : null}
          </ul>
        </figcaption>
      ) : null}
    </figure>
  );
}

function MatchScatterSvg({ scatter, label, unit, lang }) {
  const { width, height, left, right, bottom } = scatter;
  return (
    <>
      <svg className="run-detail-v2__rm-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <g className="run-detail-v2__rm-grid">
          {scatter.ticks.map((tick) => (
            <g key={tick.pace}>
              <line x1={left} x2={width - right} y1={tick.y} y2={tick.y} />
              <text x={left - 8} y={tick.y + 4} textAnchor="end">{formatPaceSeconds(tick.pace)}</text>
            </g>
          ))}
        </g>
        <text className="run-detail-v2__rm-axis" x={left} y={height - bottom + 20} textAnchor="start">{formatCalendarDate(scatter.firstDate, lang)}</text>
        {scatter.lastDate !== scatter.firstDate ? (
          <text className="run-detail-v2__rm-axis" x={width - right} y={height - bottom + 20} textAnchor="end">{formatCalendarDate(scatter.lastDate, lang)}</text>
        ) : null}
        {scatter.trend ? (
          <line className="run-detail-v2__rm-trend" x1={scatter.trend.x1} y1={scatter.trend.y1} x2={scatter.trend.x2} y2={scatter.trend.y2} />
        ) : null}
        {scatter.points
          .slice()
          .sort((a, b) => Number(a.run.current || a.run.fastest) - Number(b.run.current || b.run.fastest))
          .map((point) => {
            const kind = point.run.current ? 'is-current' : point.run.fastest ? 'is-fastest' : 'is-other';
            return (
              <circle key={point.run.activityId} className={`run-detail-v2__rm-dot ${kind}`} cx={point.x} cy={point.y} r={kind === 'is-other' ? 4 : 6.5}>
                <title>{`${formatCalendarDate(point.run.date, lang)} · ${formatPaceSeconds(point.run.paceSecPerKm)} ${unit}`}</title>
              </circle>
            );
          })}
      </svg>
    </>
  );
}

/**
 * The other runs over the same route as this one (S07): when each was run, how long it took and how its pace compares
 * with this run's, with a scatter of pace over time. The section is on the page, with its anchor for the run navigation,
 * in every state, and says why when there is nothing to compare with. It fetches once the run page has the run's stream
 * (`streamReady`).
 */
export default function RunMatches({ runId, streamReady }) {
  const { t, lang, formatNumber } = useI18n();
  const titleId = useId();
  const { status, data, stale, reload } = useRunMatches(runId, { enabled: streamReady });
  const [year, setYear] = useState(null);
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const years = useMemo(() => [...new Set(runs.map((run) => run.year))].sort((a, b) => b - a), [runs]);
  const activeYear = year != null && years.includes(year) ? year : null;
  const shown = useMemo(() => (activeYear == null ? runs : runs.filter((run) => run.year === activeYear)), [runs, activeYear]);
  const newestFirst = useMemo(() => [...shown].reverse(), [shown]);
  const current = runs.find((run) => run.current) ?? null;
  const fastest = runs.find((run) => run.fastest) ?? null;
  const unit = t('run_detail.unit_pace');

  let body;
  if (data && runs.length > 1) {
    const slower = current && fastest && !current.fastest ? current.paceSecPerKm - fastest.paceSecPerKm : null;
    body = (
      <>
        {stale ? (
          <p className="run-detail-v2__muted is-error" role="status">
            {t('run_detail.numbers_stale')}{' '}
            <button type="button" className="run-detail-v2__link" onClick={reload}>{t('run_matches.retry')}</button>
          </p>
        ) : null}
        <p className="run-detail-v2__rm-summary">
          {t('run_matches.summary', { count: data.count })}
          {fastest ? ` ${t('run_matches.summary_fastest', { date: formatCalendarDate(fastest.date, lang), pace: `${formatPaceSeconds(fastest.paceSecPerKm)} ${unit}` })}` : ''}
          {current?.fastest ? ` ${t('run_matches.this_is_fastest')}` : ''}
          {slower != null ? ` ${t('run_matches.this_vs_fastest', { delta: formatPaceSeconds(slower), unit })}` : ''}
        </p>

        {years.length > 1 ? (
          <div className="run-detail-v2__segmented run-detail-v2__rm-years" role="group" aria-label={t('run_matches.year_group')}>
            <button type="button" className={activeYear == null ? 'is-active' : ''} aria-pressed={activeYear == null} onClick={() => setYear(null)}>
              {t('run_matches.all_years')}
            </button>
            {years.map((value) => (
              <button key={value} type="button" className={activeYear === value ? 'is-active' : ''} aria-pressed={activeYear === value} onClick={() => setYear(value)}>
                {value}
              </button>
            ))}
          </div>
        ) : null}

        <MatchScatter runs={shown} label={t('run_matches.chart_label', { count: shown.length })} />

        <div className="run-detail-v2__be-scroll">
          <table className="run-detail-v2__rm-table">
            <thead>
              <tr>
                <th scope="col">{t('run_matches.col_run')}</th>
                <th scope="col">{t('run_matches.col_distance')}</th>
                <th scope="col">{t('run_matches.col_time')}</th>
                <th scope="col">{t('run_matches.col_pace')}</th>
                <th scope="col">{t('run_matches.col_vs_this')}</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((run) => {
                const classes = ['run-detail-v2__rm-row'];
                if (run.current) classes.push('is-current');
                if (run.fastest) classes.push('is-fastest');
                return (
                  <tr key={run.activityId} className={classes.join(' ')} aria-current={run.current ? 'true' : undefined}>
                    <th scope="row" className="run-detail-v2__rm-run">
                      {run.current ? (
                        <strong>{formatCalendarDate(run.date, lang)}</strong>
                      ) : (
                        <Link className="run-detail-v2__link" to={buildRunDetailPath(run.activityId)}>{formatCalendarDate(run.date, lang)}</Link>
                      )}
                      {run.current ? <span className="run-detail-v2__be-tag">{t('run_matches.tag_this')}</span> : null}
                      {run.fastest ? <span className="run-detail-v2__be-tag is-fastest">{t('run_matches.tag_fastest')}</span> : null}
                      {run.name ? <small>{run.name}</small> : null}
                    </th>
                    <td>{formatNumber(run.distanceMeters / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('run_detail.unit_km')}</td>
                    <td>{formatDuration(run.movingSeconds)}</td>
                    <td>{formatPaceSeconds(run.paceSecPerKm)} {unit}</td>
                    <td>{current && !run.current ? `${formatPaceDelta(run.paceSecPerKm - current.paceSecPerKm)} ${unit}` : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="run-detail-v2__muted">{t('run_matches.basis')}</p>
        {!data.complete ? <p className="run-detail-v2__muted" role="status">{t('run_matches.incomplete')}</p> : null}
      </>
    );
  } else if (data) {
    body = (
      <>
        <p className="run-detail-v2__muted">{t(data.groupId == null ? 'run_matches.no_route' : 'run_matches.only_run')}</p>
        {!data.complete ? <p className="run-detail-v2__muted" role="status">{t('run_matches.incomplete')}</p> : null}
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="run-detail-v2__training-state">
        <p className="run-detail-v2__muted" role="alert">{t('run_matches.error')}</p>
        <button type="button" className="run-detail-v2__btn" onClick={reload}>{t('run_matches.retry')}</button>
      </div>
    );
  } else {
    body = <p className="run-detail-v2__muted" role="status">{t('run_matches.loading')}</p>;
  }

  return (
    <section
      id="run-detail-matches"
      className="run-detail-v2__card run-detail-v2__matches"
      aria-labelledby={titleId}
      aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}
    >
      <div className="run-detail-v2__card-head">
        <h2 id={titleId}>{t('run_matches.title')}</h2>
      </div>
      {body}
    </section>
  );
}

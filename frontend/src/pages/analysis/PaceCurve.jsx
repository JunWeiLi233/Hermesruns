import useSectionSearchParams from '../../hooks/useSectionSearchParams';
import { useCallback, useId, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { distanceName } from '../../components/bestEffortLabels';
import { MethodsLink } from '../../components/HowWorkedOut';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import useElementWidth from '../../hooks/useElementWidth';
import { formatCalendarDate } from '../../utils/bestEfforts';
import { formatDuration, formatPaceSeconds } from '../../utils/format';
import { DEFAULT_WINDOW, WINDOWS, buildPaceCurve, paceForUnit, windowOf } from '../../utils/paceCurveChart';
import usePaceCurve from './usePaceCurve';

const HAS_NUMBERS = new Set(['ok', 'rough']);

function paceLabel(secondsPerKm, unit) {
  return `${formatPaceSeconds(paceForUnit(secondsPerKm, unit))} ${unit === 'mile' ? '/mi' : '/km'}`;
}

/** "5 min" or "1 h": a length of time as the time axis names it. */
function tickLabel(t, seconds) {
  if (seconds >= 3600) return t('pace_curve.tick_hours', { n: seconds / 3600 });
  return seconds >= 60 ? t('pace_curve.tick_minutes', { n: seconds / 60 }) : t('pace_curve.tick_seconds', { n: seconds });
}

function Skeleton() {
  return (
    <div className="pace-curve-v2__skeleton" aria-hidden="true">
      <span className="page-skeleton__block pace-curve-v2__skeleton-tiles" />
      <span className="page-skeleton__block pace-curve-v2__skeleton-chart" />
      <span className="page-skeleton__block pace-curve-v2__skeleton-line" />
    </div>
  );
}

/** The dots and the line, drawn on a log time axis and a pace axis with the faster paces higher. */
function PaceCurveChart({ data, unit }) {
  const { t, lang } = useI18n();
  const plotRef = useRef(null);
  const measured = useElementWidth(plotRef);
  const titleId = useId();
  const model = HAS_NUMBERS.has(data.model.status) ? data.model : null;
  const geometry = useMemo(
    () => buildPaceCurve({ points: data.points, model, unit, width: measured, height: measured < 520 ? 280 : 340 }),
    [data.points, model, unit, measured],
  );
  if (!geometry) return null;

  const suffix = unit === 'mile' ? '/mi' : '/km';
  return (
    <div ref={plotRef} className="pace-curve-v2__plot">
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        width={geometry.width}
        height={geometry.height}
        className="pace-curve-v2__svg"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{t('pace_curve.chart_label', { unit: suffix })}</title>
        {geometry.yTicks.map((tick) => (
          <g key={tick.pace}>
            <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={tick.y} y2={tick.y} className="pace-curve-v2__grid" />
            <text x={geometry.padL - 8} y={tick.y + 4} textAnchor="end">{formatPaceSeconds(tick.pace)}</text>
          </g>
        ))}
        {geometry.xTicks.map((tick) => (
          <g key={tick.seconds}>
            <line x1={tick.x} x2={tick.x} y1={geometry.padT} y2={geometry.baseline} className="pace-curve-v2__grid is-vertical" />
            <text x={tick.x} y={geometry.height - 10} textAnchor="middle">{tickLabel(t, tick.seconds)}</text>
          </g>
        ))}
        {geometry.critical ? (
          <g>
            <line x1={geometry.padL} x2={geometry.width - geometry.padR} y1={geometry.critical.y} y2={geometry.critical.y} className="pace-curve-v2__critical" />
            <text x={geometry.padL + 6} y={geometry.critical.y - 6} textAnchor="start" className="pace-curve-v2__critical-label">
              {t('pace_curve.critical_pace')} {formatPaceSeconds(geometry.critical.pace)}
            </text>
          </g>
        ) : null}
        {geometry.curve ? (
          <>
            <path d={geometry.curve.dashed} className="pace-curve-v2__line is-extended" />
            <path d={geometry.curve.solid} className="pace-curve-v2__line" />
          </>
        ) : null}
        {geometry.dots.map((dot) => (
          <circle
            key={dot.point.key}
            cx={dot.x}
            cy={dot.y}
            r={dot.point.inModel ? 6 : 5}
            className={`pace-curve-v2__dot${dot.point.inModel ? ' is-in-line' : ''}`}
          >
            <title>
              {`${distanceName(t, dot.point.key)}: ${formatDuration(dot.point.seconds)}, ${paceLabel(dot.point.paceSecondsPerKm, unit)}, ${formatCalendarDate(dot.point.date, lang)}`}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/** What the data says in numbers: each effort with its time, pace, day and run, and whether the line was fitted through it. */
function PaceCurveTable({ data, unit }) {
  const { t, lang } = useI18n();
  const hasLine = HAS_NUMBERS.has(data.model.status);
  const inLine = (point) => {
    if (point.inModel) return t('pace_curve.in_line_yes');
    if (!hasLine) return t('pace_curve.in_line_none');
    if (point.seconds < data.limits.minSeconds) return t('pace_curve.in_line_short', { minutes: data.limits.minSeconds / 60 });
    if (point.seconds > data.limits.maxSeconds) return t('pace_curve.in_line_long', { minutes: data.limits.maxSeconds / 60 });
    return t('pace_curve.in_line_none');
  };
  return (
    <div className="pace-curve-v2__table-wrap">
      <table className="pace-curve-v2__table" aria-label={t('pace_curve.table_label')}>
        <thead>
          <tr>
            <th scope="col">{t('pace_curve.col_distance')}</th>
            <th scope="col">{t('pace_curve.col_time')}</th>
            <th scope="col">{t('pace_curve.col_pace')}</th>
            <th scope="col">{t('pace_curve.col_day')}</th>
            <th scope="col">{t('pace_curve.col_run')}</th>
            <th scope="col">{t('pace_curve.col_line')}</th>
          </tr>
        </thead>
        <tbody>
          {data.points.map((point) => (
            <tr key={point.key} className={point.inModel ? 'is-in-line' : undefined}>
              <th scope="row">{distanceName(t, point.key)}</th>
              <td>
                {formatDuration(point.seconds)}
                {point.edited ? <small className="pace-curve-v2__tag">{t('pace_curve.typed')}</small> : null}
              </td>
              <td>{paceLabel(point.paceSecondsPerKm, unit)}</td>
              <td>{formatCalendarDate(point.date, lang)}</td>
              <td><Link to={`/runs/${point.activityId}`}>{point.name || t('pace_curve.run_fallback')}</Link></td>
              <td>{inLine(point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The critical pace, D' and how well the line fits; or why there is no line. */
function Summary({ data, unit }) {
  const { t, formatNumber } = useI18n();
  const model = data.model;
  if (!HAS_NUMBERS.has(model.status)) {
    return (
      <p className="pace-curve-v2__note" role="status">
        {t(`pace_curve.no_line_${model.status}`, {
          min: data.limits.minPoints,
          count: model.pointsUsed,
          from: data.limits.minSeconds / 60,
          to: data.limits.maxSeconds / 60,
          spread: data.limits.minSpread,
          worst: data.limits.roughErrorPercent,
        })}
      </p>
    );
  }
  return (
    <>
      <section className="pace-curve-v2__tiles" aria-label={t('pace_curve.tiles_label')}>
        <article>
          <span>{t('pace_curve.critical_pace')}</span>
          <strong>{paceLabel(model.criticalPaceSecondsPerKm, unit)}</strong>
          <small>{t('pace_curve.critical_pace_hint')}</small>
        </article>
        <article>
          <span>{t('pace_curve.d_prime')}</span>
          <strong>{t('pace_curve.d_prime_value', { meters: formatNumber(Math.round(model.dPrimeMeters)) })}</strong>
          <small>{t('pace_curve.d_prime_hint')}</small>
        </article>
        <article className={model.status === 'rough' ? 'is-watch' : undefined}>
          <span>{t('pace_curve.fit')}</span>
          <strong>{t('pace_curve.fit_value', { percent: formatNumber(model.maxErrorPercent, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })}</strong>
          <small>{t('pace_curve.fit_hint', { count: model.pointsUsed })}</small>
        </article>
      </section>
      {model.status === 'rough' ? (
        <p className="pace-curve-v2__note is-watch" role="status">
          {t('pace_curve.rough_note', { percent: formatNumber(model.maxErrorPercent, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })}
        </p>
      ) : null}
    </>
  );
}

/**
 * The pace curve: the runner's fastest time over each standard distance within a window, shown by how long each effort
 * lasted, and the critical pace the efforts of three to forty minutes line up on. The window lives in the address
 * (`?days=`), so a view can be bookmarked and the back button leaves it.
 */
export default function PaceCurve({ showHeader = true, resource } = {}) {
  const { t } = useI18n();
  const { unit } = useUnit();
  const [searchParams, setSearchParams] = useSectionSearchParams();
  const range = windowOf(searchParams.get('days'));
  const ownResource = usePaceCurve(range.key, { enabled: !resource });
  const { status, data, stale, reload } = resource || ownResource;
  const groupId = useId();

  const chooseWindow = useCallback((key) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      if (key === DEFAULT_WINDOW) next.delete('days');
      else next.set('days', key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  let body;
  if (data) {
    body = (
      <>
        {stale ? (
          <p className="pace-curve-v2__note is-error" role="status">
            {t('pace_curve.stale')}{' '}
            <button type="button" className="pace-curve-v2__link" onClick={reload}>{t('pace_curve.retry')}</button>
          </p>
        ) : null}
        {data.points.length === 0 ? (
          <section className="pace-curve-v2__empty">
            <h2>{t('pace_curve.empty_title')}</h2>
            <p>{range.key === 'all' ? t('pace_curve.empty_all') : t('pace_curve.empty_window')}</p>
          </section>
        ) : (
          <>
            <Summary data={data} unit={unit} />
            <section className="pace-curve-v2__card" aria-label={t('pace_curve.plot_label')}>
              <div className="pace-curve-v2__legend" aria-hidden="true">
                <span><i className="pace-curve-v2__swatch is-in-line" />{t('pace_curve.legend_used')}</span>
                <span><i className="pace-curve-v2__swatch" />{t('pace_curve.legend_unused')}</span>
                {HAS_NUMBERS.has(data.model.status) ? (
                  <>
                    <span><i className="pace-curve-v2__swatch is-line" />{t('pace_curve.legend_line')}</span>
                    <span><i className="pace-curve-v2__swatch is-critical" />{t('pace_curve.critical_pace')}</span>
                  </>
                ) : null}
              </div>
              <PaceCurveChart data={data} unit={unit} />
              <p className="pace-curve-v2__note is-faint">{t('pace_curve.axis_caption')}</p>
            </section>
            <PaceCurveTable data={data} unit={unit} />
          </>
        )}
        {!data.complete ? (
          <p className="pace-curve-v2__note" role="status">
            {t('pace_curve.pending')}{' '}
            <button type="button" className="pace-curve-v2__link" onClick={reload}>{t('pace_curve.refresh')}</button>
          </p>
        ) : null}
        <p className="pace-curve-v2__note is-faint">
          {t('pace_curve.basis', { minutes: data.limits.minSeconds / 60, to: data.limits.maxSeconds / 60, minPoints: data.limits.minPoints, spread: data.limits.minSpread })}{' '}
          <MethodsLink anchor="pace-curve-and-critical-pace" />
        </p>
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="pace-curve-v2__state">
        <p className="pace-curve-v2__note is-error" role="alert">{t('pace_curve.error')}</p>
        <button type="button" className="pace-curve-v2__button" onClick={reload}>{t('pace_curve.retry')}</button>
      </div>
    );
  } else {
    body = (
      <>
        <p className="sr-only" role="status">{t('pace_curve.loading')}</p>
        <Skeleton />
      </>
    );
  }

  return (
    <section aria-label={t('pace_curve.title')} className="pace-curve-v2" aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}>
        {showHeader ? (
        <header className="pace-curve-v2__head">
          <div>
            <h2>{t('pace_curve.title')}</h2>
            <p>{t('pace_curve.subtitle')}</p>
          </div>
          <nav className="pace-curve-v2__links" aria-label={t('pace_curve.links_label')}>
            <Link to="/analysis">{t('pace_curve.link_analysis')}</Link>
            <Link to="/prediction/10k">{t('pace_curve.link_predictions')}</Link>
          </nav>
        </header>
        ) : null}
        <section className="pace-curve-v2__window" aria-label={t('pace_curve.window_label')}>
          <span id={groupId} className="pace-curve-v2__window-label">{t('pace_curve.window_label')}</span>
          <div className="pace-curve-v2__chips" role="group" aria-labelledby={groupId}>
            {WINDOWS.map((option) => (
              <button key={option.key} type="button" aria-pressed={range.key === option.key} onClick={() => chooseWindow(option.key)}>
                {t(`pace_curve.window_${option.key}`)}
              </button>
            ))}
          </div>
        </section>
        {body}
    </section>
  );
}

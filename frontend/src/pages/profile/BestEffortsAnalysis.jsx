import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { distanceName, placeName, placeTone } from '../../components/bestEffortLabels';
import { useI18n } from '../../contexts/I18nContext';
import useElementWidth from '../../hooks/useElementWidth';
import { useUnit } from '../../contexts/UnitContext';
import { buildYearTrend, formatCalendarDate, formatEffortTime } from '../../utils/bestEfforts';
import { getDistanceUnitLabel, formatPaceSeconds } from '../../utils/format';
import { buildRunDetailPath } from '../../utils/runRoute';
import useBestEffortsAnalysis from './useBestEffortsAnalysis';

const KM_PER_MILE = 1.609344;

/** "4:58 /km" or "8:00 /mi", by the unit the runner chose. */
function paceText(secondsPerKm, lang, unit) {
  if (!Number.isFinite(secondsPerKm)) return '–';
  const perUnit = unit === 'mile' ? secondsPerKm * KM_PER_MILE : secondsPerKm;
  return `${formatPaceSeconds(perUnit)} /${getDistanceUnitLabel(lang, unit)}`;
}

/** A ranking: the place, the time, the pace, and the run it came from. */
function RankedList({ title, items, empty }) {
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  return (
    <div className="hd-records-block">
      <h4 className="hd-records-subtitle">{title}</h4>
      {items.length === 0 ? (
        <p className="hd-records-muted">{empty}</p>
      ) : (
        <ol className="hd-records-list">
          {items.map((item) => (
            <li key={`${item.rank}-${item.activityId}`}>
              <span className={`hd-records-pill ${placeTone(item.rank)}`}>{placeName(t, item.rank)}</span>
              <strong className="hd-records-time">{formatEffortTime(item.effectiveSeconds)}</strong>
              <span className="hd-records-pace">{paceText(item.paceSecPerKm, lang, unit)}</span>
              <span className="hd-records-run">
                <Link className="hd-records-link" to={buildRunDetailPath(item.activityId)}>{formatCalendarDate(item.date, lang)}</Link>
                {item.name ? <small>{item.name}</small> : null}
              </span>
              {item.edited ? <span className="hd-records-tag">{t('best_efforts.tag_edited')}</span> : null}
              {item.estimated ? <span className="hd-records-tag">{t('best_efforts.tag_estimated')}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The best time of every year at the chosen distance, faster nearer the top. */
function YearTrend({ trend, label }) {
  const { t } = useI18n();
  const figureRef = useRef(null);
  const measured = useElementWidth(figureRef);
  // Drawn at the width it has, so the labels keep their size on a phone and the chart fills a wide card.
  const chart = buildYearTrend(trend, { width: measured, height: measured < 520 ? 170 : 190 });
  if (!chart) return null;
  const { width, height, left, right, top, bottom } = chart;
  return (
    <figure className="hd-records-trend" ref={figureRef}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <g className="hd-records-grid">
          {chart.ticks.map((tick) => (
            <g key={tick.seconds}>
              <line x1={left} x2={width - right} y1={tick.y} y2={tick.y} />
              <text x={left - 8} y={tick.y + 4} textAnchor="end">{formatEffortTime(tick.seconds)}</text>
            </g>
          ))}
        </g>
        {chart.points.length > 1 ? <path className="hd-records-line" d={chart.path} /> : null}
        {chart.points.map((point) => (
          <g key={point.year}>
            <circle className="hd-records-dot" cx={point.x} cy={point.y} r="5">
              <title>{`${point.year} · ${formatEffortTime(point.bestSeconds)} · ${t('best_efforts.analysis_trend_count', { count: point.count })}`}</title>
            </circle>
            <text className="hd-records-year" x={point.x} y={height - bottom + 20} textAnchor="middle">{point.year}</text>
            <text className="hd-records-value" x={point.x} y={Math.max(top - 4, point.y - 11)} textAnchor="middle">{formatEffortTime(point.bestSeconds)}</text>
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">{chart.points.map((point) => `${point.year}: ${formatEffortTime(point.bestSeconds)}`).join('; ')}</figcaption>
    </figure>
  );
}

/**
 * The best-efforts analysis of the runner's whole history (S16): the three best ever and the ten best of a year at one
 * distance, and the best time of every year. It stays closed, and makes no request, until the runner opens it, so the
 * Profile page's first paint is what it was.
 */
export default function BestEffortsAnalysis() {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  // Asked for once, the first time it is opened, and kept: closing and opening it again does not ask again.
  const [wanted, setWanted] = useState(false);
  const [distance, setDistance] = useState(null);
  const [year, setYear] = useState(null);
  const { status, data, stale, reload } = useBestEffortsAnalysis({ enabled: wanted, distance, year });
  // The selectors are drawn from the last answer, so choosing another distance does not blank them while it loads.
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (data) setShown(data);
  }, [data]);

  let body = null;
  if (open) {
    if (shown) {
      const years = [...shown.years].sort((a, b) => b - a);
      body = (
        <div id={bodyId} className="hd-records-body" aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}>
          {stale || status === 'error' ? (
            <p className="hd-records-muted is-error" role="status">
              {t(stale ? 'best_efforts.stale' : 'best_efforts.analysis_switch_failed')}{' '}
              <button type="button" className="hd-records-retry" onClick={reload}>{t('best_efforts.retry')}</button>
            </p>
          ) : null}
          {shown.key == null ? (
            <p className="hd-records-muted">{t('best_efforts.analysis_empty')}</p>
          ) : (
            <>
              <div className="hd-records-controls">
                <label>
                  <span>{t('best_efforts.analysis_distance')}</span>
                  <select
                    value={shown.key}
                    onChange={(event) => {
                      setDistance(event.target.value);
                      setYear(null);
                    }}
                  >
                    {shown.distances.map((entry) => (
                      <option key={entry.key} value={entry.key}>{distanceName(t, entry.key)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('best_efforts.analysis_year')}</span>
                  <select value={shown.year ?? ''} onChange={(event) => setYear(Number(event.target.value))}>
                    {years.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              <div className="hd-records-grid-2">
                <RankedList title={t('best_efforts.analysis_lifetime')} items={shown.lifetime} empty={t('best_efforts.analysis_none_yet')} />
                <RankedList title={t('best_efforts.analysis_annual', { year: shown.year ?? '' })} items={shown.annual} empty={t('best_efforts.analysis_none_this_year')} />
              </div>
              <div className="hd-records-block">
                <h4 className="hd-records-subtitle">{t('best_efforts.analysis_trend')}</h4>
                <YearTrend trend={shown.trend} label={t('best_efforts.analysis_trend_label', { distance: distanceName(t, shown.key) })} />
              </div>
            </>
          )}
          <p className="hd-records-muted">{t('best_efforts.analysis_note')}</p>
          {!shown.complete ? <p className="hd-records-muted" role="status">{t('best_efforts.incomplete')}</p> : null}
        </div>
      );
    } else if (status === 'error') {
      body = (
        <div id={bodyId} className="hd-records-body">
          <p className="hd-records-muted is-error" role="alert">{t('best_efforts.analysis_error')}</p>
          <button type="button" className="hd-records-retry" onClick={reload}>{t('best_efforts.retry')}</button>
        </div>
      );
    } else {
      body = (
        <div id={bodyId} className="hd-records-body" aria-busy="true">
          <p className="hd-records-muted" role="status">{t('best_efforts.analysis_loading')}</p>
        </div>
      );
    }
  }

  return (
    <section id="profile-best-efforts" className="hd-records" aria-labelledby={titleId}>
      <div className="hd-records-head">
        <div>
          <span className="hd-card-kicker">{t('best_efforts.analysis_kicker')}</span>
          <h3 id={titleId} className="hd-card-title">{t('best_efforts.analysis_title')}</h3>
        </div>
        <button
          type="button"
          className="hd-records-toggle"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => {
            setOpen((current) => !current);
            setWanted(true);
          }}
        >
          {open ? t('best_efforts.analysis_close') : t('best_efforts.analysis_open')}
        </button>
      </div>
      {open ? null : <p className="hd-records-muted">{t('best_efforts.analysis_intro')}</p>}
      {body}
    </section>
  );
}

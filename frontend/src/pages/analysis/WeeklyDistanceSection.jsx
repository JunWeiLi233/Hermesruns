import { useId, useMemo, useRef, useState } from 'react';
import { MethodsLink } from '../../components/HowWorkedOut';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import useElementWidth from '../../hooks/useElementWidth';
import useReadoutBox from '../../hooks/useReadoutBox';
import { formatShortDate } from '../../utils/fitnessChart';
import { formatDistance } from '../../utils/format';
import {
  DEFAULT_DISTANCE_RANGE,
  DISTANCE_RANGES,
  buildDistanceChart,
  buildWeeklyDistance,
  distanceRangeWeeks,
  distanceReadings,
  distanceTooltipPosition,
} from '../../utils/weeklyDistance';
import useScrubber from './useScrubber';

/** The chart: a bar for the distance of each week, and a line through the average of the four weeks to each week that is over. */
function DistanceChart({ weeks, label, unit }) {
  const { t, lang, formatNumber } = useI18n();
  const plotRef = useRef(null);
  const readoutRef = useRef(null);
  const readoutBox = useReadoutBox(readoutRef);
  const measured = useElementWidth(plotRef);
  const tableId = useId();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const height = Math.max(measured < 520 ? 200 : 230, Math.ceil(readoutBox?.height ?? 0) + 16);
  const geometry = useMemo(() => buildDistanceChart(weeks, { width: measured, height, unit }), [weeks, measured, height, unit]);
  const positions = useMemo(() => (geometry ? geometry.bars.map((bar) => bar.centre) : []), [geometry]);
  const last = geometry ? geometry.bars.length - 1 : 0;
  const scrub = useScrubber({
    plotRef, positions, viewWidth: geometry?.width ?? 0, startIndex: last, lastIndex: last, selectedIndex, onSelect: setSelectedIndex,
  });
  if (!geometry) return null;

  const selected = selectedIndex == null ? null : geometry.bars[Math.min(selectedIndex, last)];
  const shownBar = selected ?? geometry.bars[last];
  const distance = (km) => formatDistance(km, 1, lang, unit);
  const runsText = (count) => {
    if (count === 0) return t('weekly_distance.no_run');
    return count === 1 ? t('weekly_distance.one_run') : t('weekly_distance.runs', { count: formatNumber(count) });
  };
  const weekName = (week) => t('weekly_distance.week_of', { date: formatShortDate(week.start, lang) });
  const weekText = ({ week }) => t('weekly_distance.value_text', {
    week: weekName(week),
    going: week.open ? t('weekly_distance.going_part') : '',
    distance: distance(week.km),
    runs: runsText(week.runs),
    average: week.average != null ? t('weekly_distance.average_part', { distance: distance(week.average) }) : '',
  });

  return (
    <div className="analysis-load-command-chart-wrap analysis-fit-v2-chart is-weekly">
      <div
        ref={plotRef}
        className="analysis-fit-v2-plot"
        role="slider"
        tabIndex={0}
        aria-label={label}
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
            <rect
              key={`bar-${bar.week.start}`}
              className={`analysis-fit-v2-bar is-distance${bar.week.open ? ' is-open' : ''}${selected && selected.index === bar.index ? ' is-selected' : ''}`}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx="5"
            />
          ))}
          {geometry.path ? <path d={geometry.path} className="analysis-wd-average" /> : null}
          {geometry.withAverage.map((bar) => (
            <circle key={`average-${bar.week.start}`} cx={bar.centre} cy={bar.averageY} r={geometry.withAverage.length > 30 ? 2.2 : 3.5} className="analysis-wd-average-dot" />
          ))}
          {geometry.xTicks.map((bar) => (
            <text key={bar.week.start} x={bar.centre} y={geometry.height - 8} textAnchor="middle">{formatShortDate(bar.week.start, lang)}</text>
          ))}
        </svg>

        {selected ? (
          <div ref={readoutRef} className="analysis-fit-v2-tooltip analysis-wd-tooltip" style={distanceTooltipPosition(selected, geometry, readoutBox ?? undefined)} aria-hidden="true">
            <time dateTime={selected.week.start}>{weekName(selected.week)}</time>
            <div><span>{t('weekly_distance.legend_distance')}</span><strong>{distance(selected.week.km)}</strong></div>
            <div><span>{runsText(selected.week.runs)}</span></div>
            {selected.week.average != null ? <div><span>{t('weekly_distance.average')}</span><strong>{distance(selected.week.average)}</strong></div> : null}
            {selected.week.open ? <div className="is-status"><span>{t('weekly_distance.going')}</span></div> : null}
          </div>
        ) : null}
      </div>

      <table id={tableId} className="sr-only analysis-profile-v2-history" data-analysis-history="distance">
        <thead>
          <tr>
            <th scope="col">{t('weekly_distance.col_week')}</th>
            <th scope="col">{t('weekly_distance.col_distance')}</th>
            <th scope="col">{t('weekly_distance.col_runs')}</th>
            <th scope="col">{t('weekly_distance.col_average')}</th>
          </tr>
        </thead>
        <tbody>
          {geometry.bars.map(({ week }) => (
            <tr key={week.start}>
              <th scope="row">{weekName(week)}{week.open ? `, ${t('weekly_distance.going')}` : ''}</th>
              <td>{distance(week.km)}</td>
              <td>{formatNumber(week.runs)}</td>
              <td>{week.average != null ? distance(week.average) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Weekly distance (F35): how far the runner ran in each of the last weeks, with the mean of the four weeks to each week that is over. A card on the
 * Load balance page, worked out in the browser from the run list the page has (`utils/weeklyDistance.js`). It describes what was run and judges nothing:
 * no target, no range, no colour for a big week.
 */
export default function WeeklyDistanceSection({ runs }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const titleId = useId();
  const [rangeKey, setRangeKey] = useState(DEFAULT_DISTANCE_RANGE);
  const model = useMemo(() => buildWeeklyDistance(runs), [runs]);
  const shown = useMemo(() => (model ? model.weeks.slice(-distanceRangeWeeks(rangeKey)) : []), [model, rangeKey]);
  const readings = useMemo(() => distanceReadings(shown), [shown]);
  const distance = (km) => formatDistance(km, 1, lang, unit);
  const day = (key) => formatShortDate(key, lang);

  const thisWeek = readings.thisWeek;
  const thisRuns = thisWeek?.runs ?? 0;

  return (
    <section id="load-distance" tabIndex={-1} className="analysis-load-v2-chart analysis-fit-v2" aria-labelledby={titleId}>
      <div className="analysis-load-v2-head">
        <div>
          <h2 id={titleId}>{t('weekly_distance.title')}</h2>
          <p>{t('weekly_distance.hint')}</p>
        </div>
        {model ? (
          <div className="analysis-load-v2-ranges" role="group" aria-label={t('weekly_distance.range_group')}>
            {DISTANCE_RANGES.map((range) => (
              <button key={range.key} type="button" aria-pressed={range.key === rangeKey} onClick={() => setRangeKey(range.key)}>
                {t(`weekly_distance.range_${range.key}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {model ? (
        <>
          <section className="analysis-load-v2-metrics analysis-fit-v2-metrics" aria-label={t('weekly_distance.reads_label')}>
            <article className="analysis-load-v2-metric">
              <span>{t('weekly_distance.read_this')}</span>
              <strong>{thisWeek ? distance(thisWeek.km) : '–'}</strong>
              <small>{thisRuns === 0 ? t('weekly_distance.no_run') : thisRuns === 1 ? t('weekly_distance.one_run') : t('weekly_distance.runs', { count: formatNumber(thisRuns) })}</small>
            </article>
            <article className="analysis-load-v2-metric">
              <span>{t('weekly_distance.read_average')}</span>
              <strong>{readings.average ? distance(readings.average.km) : '–'}</strong>
              <small>{readings.average ? t('weekly_distance.read_average_small', { date: day(readings.average.to) }) : t('weekly_distance.read_average_none')}</small>
            </article>
            <article className="analysis-load-v2-metric">
              <span>{t('weekly_distance.read_high')}</span>
              <strong>{readings.highest ? distance(readings.highest.km) : '–'}</strong>
              <small>{readings.highest ? t('weekly_distance.read_high_small', { date: day(readings.highest.start) }) : t('weekly_distance.read_high_none')}</small>
            </article>
          </section>

          <div className="analysis-load-v2-chart-meta">
            <div className="analysis-load-command-legend analysis-fit-v2-legend" aria-hidden="true">
              <span><i className="is-distance" />{t('weekly_distance.legend_distance')}</span>
              <span><i className="is-average" />{t('weekly_distance.legend_average')}</span>
            </div>
          </div>
          <DistanceChart key={rangeKey} weeks={shown} unit={unit} label={shown.length === 1 ? t('weekly_distance.chart_label_one') : t('weekly_distance.chart_label', { count: shown.length })} />
          <p className="analysis-fit-v2-note is-faint">{t('weekly_distance.basis')} <MethodsLink anchor="weekly-distance-and-its-moving-average" /></p>
        </>
      ) : (
        <p className="analysis-fit-v2-note">{t('weekly_distance.empty')}</p>
      )}
    </section>
  );
}

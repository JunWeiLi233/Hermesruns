import { useId } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { formatDistance, getDistanceUnitLabel } from '../../utils/format';
import { tagKey } from '../../utils/runLabels';
import {
  clockText,
  dayMetric,
  dayOfMonth,
  formatDayHeading,
  formatWeekRange,
  formatWeekday,
  metricText,
  paceText,
  runMetric,
  weekStrip,
  weekTimeParts,
} from '../../utils/trainingLog';

const KNOWN_TYPES = ['RACE', 'LONG_RUN', 'WORKOUT'];

/** The class of a figure that is the one the log is looking at (see the metric choice above the weeks). */
const chosen = (metric, key) => (metric === key ? 'is-chosen' : undefined);

/** A run's stats, each with its caption: the captions are what tell the numbers apart, on a phone as on a desktop. */
function RunRow({ run, metric, activeTags, onToggleTag }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const typeName = KNOWN_TYPES.includes(run.runType) ? t(`run_labels.type_${run.runType}`) : run.runType;
  const pace = paceText(run.paceSecPerKm, unit);
  const active = new Set(activeTags.map(tagKey));
  return (
    <li className="training-log-v2__run">
      <div className="training-log-v2__run-main">
        <Link className="training-log-v2__run-name" to={`/runs/${run.id}`} title={run.name || undefined}>
          {run.name || t('training_log.unnamed_run')}
        </Link>
        {run.runType ? <span className={`training-log-v2__type is-${String(run.runType).toLowerCase()}`}>{typeName}</span> : null}
      </div>
      <dl className="training-log-v2__run-stats">
        <div className={chosen(metric, 'distance')}><dt>{t('training_log.stat_distance')}</dt><dd>{formatDistance(run.distanceKm, 1, lang, unit)}</dd></div>
        <div className={chosen(metric, 'time')}><dt>{t('training_log.stat_time')}</dt><dd>{clockText(run.movingSeconds)}</dd></div>
        <div>
          <dt>{t('training_log.stat_pace')}</dt>
          <dd>{pace === '–' ? pace : `${pace} /${getDistanceUnitLabel(lang, unit)}`}</dd>
        </div>
        <div className={chosen(metric, 'effort')}>
          <dt>{t('training_log.stat_effort')}</dt>
          <dd title={run.effort == null ? t('training_log.effort_none') : undefined}>{run.effort == null ? '–' : formatNumber(Math.round(run.effort))}</dd>
        </div>
        <div className={chosen(metric, 'climb')}>
          <dt>{t('training_log.stat_climb')}</dt>
          <dd>{metricText(runMetric(run, 'climb'), 'climb', { lang, unit, formatNumber })}</dd>
        </div>
      </dl>
      {run.tags.length > 0 ? (
        <ul className="training-log-v2__run-tags" aria-label={t('training_log.tags_label')}>
          {run.tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                className="training-log-v2__tag"
                aria-pressed={active.has(tagKey(tag))}
                aria-label={t('training_log.tag_filter', { tag })}
                title={tag}
                onClick={() => onToggleTag(tag)}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Seven bars, one for each day of the week, in the metric the log is looking at, drawn against the biggest day on the page.
 * The lists below say the same in words (each day's heading carries its total in the metric).
 */
function Strip({ week, scale, metric }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const days = weekStrip(week, scale, metric);
  return (
    <ol className="training-log-v2__strip" aria-hidden="true">
      {days.map((day) => (
        <li
          key={day.date}
          className={day.runs > 0 ? 'has-runs' : undefined}
          title={day.runs > 0 ? t('training_log.bar_title', { day: formatDayHeading(day.date, lang), value: metricText(day.value, metric, { lang, unit, formatNumber }) }) : undefined}
        >
          <span className="training-log-v2__bar"><i style={{ height: `${Math.round(day.height * 100)}%` }} /></span>
          <span className="training-log-v2__dow">{formatWeekday(day.date, lang, 'narrow')}</span>
          <span className="training-log-v2__dom">{dayOfMonth(day.date)}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * One week of the log: its dates, what it added up to, a strip of the days and then the runs, day by day. A week without
 * a run is one quiet line, because a gap is part of the picture but not worth a card of its own. Its heading can be given
 * focus by the page (after more weeks are loaded), which finds the week by `data-week`.
 */
export default function LogWeek({ week, current, scale, metric, filtered, activeTags, onToggleTag }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const headId = useId();
  const range = formatWeekRange(week.start, week.end, lang);
  const time = weekTimeParts(week.movingSeconds);
  const timeText = time.hours > 0 ? t('training_log.time_hm', time) : t('training_log.time_m', time);
  const empty = week.runs === 0;

  return (
    <article className={`training-log-v2__week${empty ? ' is-empty' : ''}${current ? ' is-current' : ''}`} aria-labelledby={headId} data-week={week.start}>
      <header className="training-log-v2__week-head">
        <h2 id={headId} tabIndex={-1}>
          <span>{range}</span>
          {current ? <em className="training-log-v2__badge">{t('training_log.this_week')}</em> : null}
        </h2>
        {empty ? (
          <p className="training-log-v2__quiet">{filtered ? t('training_log.no_matches_week') : t('training_log.no_runs_week')}</p>
        ) : (
          <dl className="training-log-v2__totals">
            <div><dt>{t('training_log.stat_runs')}</dt><dd>{formatNumber(week.runs)}</dd></div>
            <div className={chosen(metric, 'distance')}><dt>{t('training_log.stat_distance')}</dt><dd>{formatDistance(week.distanceKm, 1, lang, unit)}</dd></div>
            <div className={chosen(metric, 'time')}><dt>{t('training_log.stat_time')}</dt><dd>{timeText}</dd></div>
            <div className={chosen(metric, 'effort')}><dt>{t('training_log.stat_effort')}</dt><dd>{formatNumber(Math.round(week.effort))}</dd></div>
            {week.elevationGainM > 0 || metric === 'climb'
              ? <div className={chosen(metric, 'climb')}><dt>{t('training_log.stat_climb')}</dt><dd>{formatNumber(Math.round(week.elevationGainM))} m</dd></div>
              : null}
          </dl>
        )}
      </header>

      {empty ? null : (
        <>
          <Strip week={week} scale={scale} metric={metric} />
          <div className="training-log-v2__days">
            {week.days.map((day) => (
              <section key={day.date} className="training-log-v2__day">
                <h3>
                  <time dateTime={day.date}>{formatDayHeading(day.date, lang)}</time>
                  <span className="training-log-v2__day-total">{metricText(dayMetric(day, metric), metric, { lang, unit, formatNumber })}</span>
                </h3>
                <ul>
                  {day.runs.map((run) => <RunRow key={run.id} run={run} metric={metric} activeTags={activeTags} onToggleTag={onToggleTag} />)}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

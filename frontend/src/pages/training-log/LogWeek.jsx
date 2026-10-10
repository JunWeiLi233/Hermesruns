import { useId } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { formatDistance, getDistanceUnitLabel } from '../../utils/format';
import { tagKey } from '../../utils/runLabels';
import {
  clockText,
  dayOfMonth,
  formatDayHeading,
  formatWeekRange,
  formatWeekday,
  paceText,
  weekStrip,
  weekTimeParts,
} from '../../utils/trainingLog';

const KNOWN_TYPES = ['RACE', 'LONG_RUN', 'WORKOUT'];

/** A run's stats, each with its caption: the captions are what tell the numbers apart, on a phone as on a desktop. */
function RunRow({ run, activeTags, onToggleTag }) {
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
        <div><dt>{t('training_log.stat_distance')}</dt><dd>{formatDistance(run.distanceKm, 1, lang, unit)}</dd></div>
        <div><dt>{t('training_log.stat_time')}</dt><dd>{clockText(run.movingSeconds)}</dd></div>
        <div>
          <dt>{t('training_log.stat_pace')}</dt>
          <dd>{pace === '–' ? pace : `${pace} /${getDistanceUnitLabel(lang, unit)}`}</dd>
        </div>
        <div>
          <dt>{t('training_log.stat_effort')}</dt>
          <dd title={run.effort == null ? t('training_log.effort_none') : undefined}>{run.effort == null ? '–' : formatNumber(Math.round(run.effort))}</dd>
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

/** Seven bars, one for each day of the week, drawn against the longest day on the page. The lists below say the same in words. */
function Strip({ week, scaleKm }) {
  const { lang } = useI18n();
  const days = weekStrip(week, scaleKm);
  return (
    <ol className="training-log-v2__strip" aria-hidden="true">
      {days.map((day) => (
        <li key={day.date} className={day.runs > 0 ? 'has-runs' : undefined}>
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
 * a run is one quiet line, because a gap is part of the picture but not worth a card of its own.
 */
export default function LogWeek({ week, current, scaleKm, filtered, activeTags, onToggleTag }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const headId = useId();
  const range = formatWeekRange(week.start, week.end, lang);
  const time = weekTimeParts(week.movingSeconds);
  const timeText = time.hours > 0 ? t('training_log.time_hm', time) : t('training_log.time_m', time);
  const empty = week.runs === 0;

  return (
    <article className={`training-log-v2__week${empty ? ' is-empty' : ''}${current ? ' is-current' : ''}`} aria-labelledby={headId}>
      <header className="training-log-v2__week-head">
        <h2 id={headId}>
          <span>{range}</span>
          {current ? <em className="training-log-v2__badge">{t('training_log.this_week')}</em> : null}
        </h2>
        {empty ? (
          <p className="training-log-v2__quiet">{filtered ? t('training_log.no_matches_week') : t('training_log.no_runs_week')}</p>
        ) : (
          <dl className="training-log-v2__totals">
            <div><dt>{t('training_log.stat_runs')}</dt><dd>{formatNumber(week.runs)}</dd></div>
            <div><dt>{t('training_log.stat_distance')}</dt><dd>{formatDistance(week.distanceKm, 1, lang, unit)}</dd></div>
            <div><dt>{t('training_log.stat_time')}</dt><dd>{timeText}</dd></div>
            <div><dt>{t('training_log.stat_effort')}</dt><dd>{formatNumber(Math.round(week.effort))}</dd></div>
            {week.elevationGainM > 0 ? <div><dt>{t('training_log.stat_climb')}</dt><dd>{formatNumber(Math.round(week.elevationGainM))} m</dd></div> : null}
          </dl>
        )}
      </header>

      {empty ? null : (
        <>
          <Strip week={week} scaleKm={scaleKm} />
          <div className="training-log-v2__days">
            {week.days.map((day) => (
              <section key={day.date} className="training-log-v2__day">
                <h3><time dateTime={day.date}>{formatDayHeading(day.date, lang)}</time></h3>
                <ul>
                  {day.runs.map((run) => <RunRow key={run.id} run={run} activeTags={activeTags} onToggleTag={onToggleTag} />)}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

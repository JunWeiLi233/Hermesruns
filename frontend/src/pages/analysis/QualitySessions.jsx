import useSectionSearchParams from '../../hooks/useSectionSearchParams';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MethodsLink } from '../../components/HowWorkedOut';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { RANGES } from '../../utils/metricTrend';
import { formatDistance, formatDuration, formatPaceSeconds } from '../../utils/format';
import { paceForUnit } from '../../utils/paceCurveChart';
import { DEFAULT_SESSION_RANGE, DEFAULT_SESSION_TYPES, SESSION_TYPES, buildQualitySessions } from '../../utils/qualitySessions';
import useAnalysisRuns from './useAnalysisRuns';

const RANGE_KEYS = RANGES.map((range) => range.key);
/** Under this many sessions a week the rate rounds to 0.0. */
const RARE_PER_WEEK = 0.05;

/**
 * The choices, kept in the address (so that a view can be shared and Back leaves the page): which types count, as a list (`types=workout,race`, or `none`), and the period.
 * A choice that is the default is not written, and a value that is none of the choices is the default.
 */
function useSessionChoice() {
  const [params, setParams] = useSectionSearchParams();
  const raw = params.get('types');
  let types = DEFAULT_SESSION_TYPES;
  if (raw === 'none') types = [];
  else if (raw) {
    const picked = SESSION_TYPES.filter((type) => raw.split(',').includes(type));
    if (picked.length > 0) types = picked;
  }
  const range = RANGE_KEYS.includes(params.get('range')) ? params.get('range') : DEFAULT_SESSION_RANGE;
  const write = (name, value) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value == null) next.delete(name);
    else next.set(name, value);
    return next;
  }, { replace: true });
  return {
    types,
    range,
    toggle: (type) => {
      const next = SESSION_TYPES.filter((candidate) => (candidate === type ? !types.includes(candidate) : types.includes(candidate)));
      const same = next.length === DEFAULT_SESSION_TYPES.length && next.every((candidate, index) => candidate === DEFAULT_SESSION_TYPES[index]);
      write('types', same ? null : next.length === 0 ? 'none' : next.join(','));
    },
    setRange: (value) => write('range', value === DEFAULT_SESSION_RANGE ? null : value),
  };
}

function Skeleton() {
  return (
    <div className="quality-sessions-v2__skeleton" aria-hidden="true">
      <span className="page-skeleton__block quality-sessions-v2__skeleton-choices" />
      <span className="page-skeleton__block quality-sessions-v2__skeleton-tiles" />
      <span className="page-skeleton__block quality-sessions-v2__skeleton-table" />
    </div>
  );
}

/** What counts (one or more of three types, each a toggle) and the period (one of four). */
function Choices({ choice }) {
  const { t } = useI18n();
  const idBase = useId();
  return (
    <section className="quality-sessions-v2__card quality-sessions-v2__choices" aria-label={t('quality_sessions.choices_label')}>
      <div className="quality-sessions-v2__choice">
        <span className="quality-sessions-v2__choice-label" id={`${idBase}-types`}>{t('quality_sessions.types_label')}</span>
        <div className="quality-sessions-v2__chips" role="group" aria-labelledby={`${idBase}-types`}>
          {SESSION_TYPES.map((type) => (
            <button key={type} type="button" aria-pressed={choice.types.includes(type)} onClick={() => choice.toggle(type)}>{t(`quality_sessions.type_${type}`)}</button>
          ))}
        </div>
        <p className="quality-sessions-v2__hint">{t('quality_sessions.types_hint')}</p>
      </div>
      <div className="quality-sessions-v2__choice">
        <span className="quality-sessions-v2__choice-label" id={`${idBase}-range`}>{t('quality_sessions.range_label')}</span>
        <div className="quality-sessions-v2__chips" role="group" aria-labelledby={`${idBase}-range`}>
          {RANGE_KEYS.map((key) => (
            <button key={key} type="button" aria-pressed={key === choice.range} onClick={() => choice.setRange(key)}>{t(`quality_sessions.range_${key}`)}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The four readings: how many sessions, how far they were, how fast, and how the count stands against the stretch before (or the latest session, for all time). */
function Readings({ model, paceWords, compact = false }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const day = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
  const comparison = model.comparison;
  const latest = model.sessions[0];

  // One decimal is how a rate is written; a rate that would be written 0.0 is "under 0.1", which reads as a few and not as none.
  let sessionsHint;
  if (model.count === 0) sessionsHint = t('quality_sessions.read_sessions_none');
  else if (model.perWeek < RARE_PER_WEEK) sessionsHint = t('quality_sessions.read_sessions_rare');
  else sessionsHint = t('quality_sessions.read_sessions_hint', { count: formatNumber(model.perWeek, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });

  let fourth;
  if (comparison) {
    let value = '--';
    if (comparison.ok) {
      if (comparison.change === 0) value = t('quality_sessions.read_compare_same');
      else value = t(comparison.change > 0 ? 'quality_sessions.read_compare_more' : 'quality_sessions.read_compare_fewer', { count: formatNumber(Math.abs(comparison.change)) });
    }
    fourth = (
      <div>
        <span>{t(`quality_sessions.read_compare_${model.range}`)}</span>
        <strong>{value}</strong>
        <small>
          {comparison.ok
            ? t('quality_sessions.read_compare_hint', {
              sessions: formatNumber(comparison.sessions),
              runs: t(comparison.runs === 1 ? 'quality_sessions.runs_one' : 'quality_sessions.runs_many', { count: formatNumber(comparison.runs) }),
            })
            : t('quality_sessions.read_compare_none')}
        </small>
      </div>
    );
  } else {
    fourth = (
      <div>
        <span>{t('quality_sessions.read_latest')}</span>
        <strong>{latest ? day(latest.day) : '--'}</strong>
        <small>{latest ? (latest.name || t('quality_sessions.run_unnamed')) : t('quality_sessions.read_latest_none')}</small>
      </div>
    );
  }

  return (
    <div className="quality-sessions-v2__reads" role="group" aria-label={t('quality_sessions.reads_label')}>
      <div>
        <span>{t('quality_sessions.read_sessions')}</span>
        <strong>{formatNumber(model.count)}</strong>
        <small>{sessionsHint}</small>
      </div>
      <div>
        <span>{t('quality_sessions.read_distance')}</span>
        <strong>{formatDistance(model.km, 1, lang, unit)}</strong>
        <small>{model.share == null ? t('quality_sessions.read_distance_none') : t('quality_sessions.read_distance_hint', { percent: formatNumber(Math.round(model.share * 100)) })}</small>
      </div>
      <div>
        <span>{t('quality_sessions.read_pace')}</span>
        <strong>{model.medianPace == null ? '--' : paceWords(model.medianPace)}</strong>
        <small>{model.otherMedianPace == null ? t('quality_sessions.read_pace_no_others') : t('quality_sessions.read_pace_hint', { pace: paceWords(model.otherMedianPace) })}</small>
      </div>
      {compact ? <div className="intensity-quality-latest"><span>{t('analysis.intensity_redesign_latest')}</span><strong>{latest ? latest.name || t('quality_sessions.run_unnamed') : t('quality_sessions.read_latest_none')}</strong><small>{latest ? day(latest.day) : ''}</small></div> : fourth}
    </div>
  );
}

function CompactSessions({ model, paceWords }) {
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const [expandedChoice, setExpandedChoice] = useState(null);
  const choiceKey = `${model.range}:${model.kinds.join(',')}`;
  const expanded = expandedChoice === choiceKey;
  const sessions = expanded ? model.sessions : model.sessions.slice(0, 5);
  return <>
    <ul className="intensity-quality-list" aria-label={t('quality_sessions.table_label')}>
      {sessions.map(session => {
        const content = <>
          <i className={session.runType === 'RACE' ? 'is-race' : session.runType === 'LONG_RUN' ? 'is-long' : ''} aria-hidden="true" />
          <span className="intensity-quality-run"><strong>{session.name || t('quality_sessions.run_unnamed')}</strong><small>{t(`run_labels.type_${session.runType}`)} · {new Date(`${session.day}T12:00:00`).toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric' })}{session.autoReason ? <span title={t(`quality_sessions.detected_${session.autoReason}`)}> · {t('quality_sessions.automatic')}</span> : null}</small></span>
          <span className="intensity-quality-pace"><strong>{paceWords(session.pace)}</strong><small>{formatDistance(session.km, 1, lang, unit)}</small></span>
        </>;
        return <li key={session.key}>{session.id != null ? <Link to={`/runs/${session.id}`} title={session.name || undefined}>{content}</Link> : <div>{content}</div>}</li>;
      })}
    </ul>
    {model.count > 5 ? <button type="button" className="intensity-text-button" aria-expanded={expanded} onClick={() => setExpandedChoice(expanded ? null : choiceKey)}>{t(expanded ? 'analysis.intensity_redesign_fewer' : 'analysis.intensity_redesign_show_all', { count: model.count })}</button> : null}
  </>;
}

/** The sessions of the period as a table, newest first: the day, the run (a link to its page, which has the pace chart and the splits), its type and its numbers. */
function SessionsTable({ model, paceWords }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const day = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
  const heartRate = (session) => {
    if (session.averageHeartRate != null && session.maxHeartRate != null) {
      return t('quality_sessions.hr_both', { average: formatNumber(Math.round(session.averageHeartRate)), max: formatNumber(Math.round(session.maxHeartRate)) });
    }
    if (session.averageHeartRate != null) return t('quality_sessions.hr_average', { value: formatNumber(Math.round(session.averageHeartRate)) });
    if (session.maxHeartRate != null) return t('quality_sessions.hr_max', { value: formatNumber(Math.round(session.maxHeartRate)) });
    return '--';
  };
  return (
    <div className="quality-sessions-v2__table-wrap">
      <table className="quality-sessions-v2__table" aria-label={t('quality_sessions.table_label')}>
        <thead>
          <tr>
            <th scope="col">{t('quality_sessions.col_day')}</th>
            <th scope="col">{t('quality_sessions.col_run')}</th>
            <th scope="col">{t('quality_sessions.col_type')}</th>
            <th scope="col">{t('quality_sessions.col_distance')}</th>
            <th scope="col">{t('quality_sessions.col_time')}</th>
            <th scope="col">{t('quality_sessions.col_pace')}</th>
            <th scope="col">{t('quality_sessions.col_heart_rate')}</th>
          </tr>
        </thead>
        <tbody>
          {model.sessions.map((session) => (
            <tr key={session.key}>
              <th scope="row">{day(session.day)}</th>
              <td className="quality-sessions-v2__run">
                {session.id != null
                  ? <Link to={`/runs/${session.id}`} title={session.name || undefined}>{session.name || t('quality_sessions.run_unnamed')}</Link>
                  : (session.name || t('quality_sessions.run_unnamed'))}
              </td>
              <td>
                {session.runType ? t(`run_labels.type_${session.runType}`) : '--'}
                {session.autoReason && <small className="quality-sessions-v2__automatic">{t('quality_sessions.automatic')} · {t(`quality_sessions.detected_${session.autoReason}`)}</small>}
              </td>
              <td>{formatDistance(session.km, 1, lang, unit)}</td>
              <td>{formatDuration(session.seconds)}</td>
              <td><strong>{paceWords(session.pace)}</strong></td>
              <td>{heartRate(session)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ model }) {
  const { t } = useI18n();
  const noTypes = model.kinds.length === 0;
  return (
    <section className="quality-sessions-v2__card quality-sessions-v2__empty">
      <h2>{t(noTypes ? 'quality_sessions.empty_no_types_title' : 'quality_sessions.empty_title')}</h2>
      <p>{t(noTypes ? 'quality_sessions.empty_no_types_body' : 'quality_sessions.empty_body')}</p>
      {noTypes ? null : (
        <div className="quality-sessions-v2__actions">
          <Link className="quality-sessions-v2__button" to="/runs">{t('quality_sessions.empty_action')}</Link>
          <Link className="quality-sessions-v2__link" to="/runs#training-log">{t('quality_sessions.empty_log')}</Link>
        </div>
      )}
    </section>
  );
}

/** Manual and inferred sessions share the filters; inferred rows explain their detection. */
export default function QualitySessions({ showHeader = true, runs: providedRuns, compact = false } = {}) {
  const { t } = useI18n();
  const { unit } = useUnit();
  const choice = useSessionChoice();
  const { status, runs, reload } = useAnalysisRuns(providedRuns);
  const typesKey = choice.types.join(',');
  const model = useMemo(() => (runs ? buildQualitySessions(runs, { types: typesKey ? typesKey.split(',') : [], range: choice.range }) : null), [runs, typesKey, choice.range]);
  const paceWords = (secondsPerKm) => `${formatPaceSeconds(paceForUnit(secondsPerKm, unit))} ${t(unit === 'mile' ? 'quality_sessions.unit_pace_mile' : 'quality_sessions.unit_pace_km')}`;

  if (compact && model) return (
    <section className="quality-sessions-v2 intensity-quality intensity-card" aria-label={t('quality_sessions.title')}>
      <header className="intensity-section-head">
        <div><h2>{t('quality_sessions.title')}</h2><p>{t('analysis.intensity_redesign_quality_subtitle')}</p></div>
        <div className="intensity-segments" role="group" aria-label={t('quality_sessions.range_label')}>
          {RANGE_KEYS.map(key => <button key={key} type="button" aria-pressed={choice.range === key} onClick={() => choice.setRange(key)} aria-label={t(`quality_sessions.range_${key}`)}>{t(`analysis.intensity_redesign_range_${key}`)}</button>)}
        </div>
      </header>
      <div className="intensity-quality-types" role="group" aria-label={t('quality_sessions.types_label')}>
        <span>{t('analysis.intensity_redesign_counts')}</span>
        {SESSION_TYPES.map(type => <button key={type} type="button" aria-pressed={choice.types.includes(type)} onClick={() => choice.toggle(type)}>{choice.types.includes(type) ? <span aria-hidden="true">✓</span> : null}{t(`quality_sessions.type_${type}`)}</button>)}
      </div>
      {model.count > 0 ? <><Readings model={model} paceWords={paceWords} compact /><CompactSessions model={model} paceWords={paceWords} /></> : <EmptyState model={model} />}
      <details className="intensity-quality-methods"><summary>{t('methods.link')}</summary><p>{t('quality_sessions.types_hint')}</p><p>{t('quality_sessions.basis')} <MethodsLink anchor="quality-sessions" /></p></details>
    </section>
  );

  let body;
  if (model) {
    body = (
      <>
        <Choices choice={choice} />
        {model.count > 0 ? (
          <>
            <Readings model={model} paceWords={paceWords} />
            <section className="quality-sessions-v2__sessions" aria-labelledby="quality-sessions-list-title">
              <h2 id="quality-sessions-list-title">{t('quality_sessions.list_title')}</h2>
              <SessionsTable model={model} paceWords={paceWords} />
              <p className="quality-sessions-v2__note">{t('quality_sessions.table_hint')}</p>
            </section>
          </>
        ) : (
          <EmptyState model={model} />
        )}
        <p className="quality-sessions-v2__note is-faint">
          {t('quality_sessions.basis')}{' '}
          <MethodsLink anchor="quality-sessions" />
        </p>
      </>
    );
  } else if (status === 'error') {
    body = (
      <div className="quality-sessions-v2__state">
        <p className="quality-sessions-v2__note is-error" role="alert">{t('quality_sessions.error')}</p>
        <button type="button" className="quality-sessions-v2__button" onClick={reload}>{t('quality_sessions.retry')}</button>
      </div>
    );
  } else {
    body = (
      <>
        <p className="sr-only" role="status">{t('quality_sessions.loading')}</p>
        <Skeleton />
      </>
    );
  }

  return (
    <section aria-label={t('quality_sessions.title')} className="quality-sessions-v2" aria-busy={status === 'loading' ? 'true' : undefined}>
        {showHeader ? (
        <header className="quality-sessions-v2__head">
          <div>
            <h2>{t('quality_sessions.title')}</h2>
            <p>{t('quality_sessions.subtitle')}</p>
          </div>
          <nav className="quality-sessions-v2__links" aria-label={t('quality_sessions.links_label')}>
            <Link to="/analysis">{t('quality_sessions.link_analysis')}</Link>
            <Link to="/analysis#analysis-trends">{t('quality_sessions.link_trends')}</Link>
          </nav>
        </header>
        ) : null}
        {body}
    </section>
  );
}

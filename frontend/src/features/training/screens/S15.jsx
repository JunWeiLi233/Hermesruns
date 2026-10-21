import { useId, useState } from 'react';
import { addDays } from '../data/model.mjs';
import { weekStart } from '../data/dates.mjs';
import { useWorkspace, useResource } from '../ui/workspace.jsx';
import { useI18n } from '../../../contexts/I18nContext';
import './periods.css';

const total = data => (data.items || []).reduce((sum, row) => ({
  minutes: sum.minutes + row.minutes,
  load: sum.load + (row.load ?? 0),
  unknown: sum.unknown + row.unknown,
}), { minutes: 0, load: 0, unknown: 0 });

function Metric({ label, a, b, format, same, weeks }) {
  const maximum = Math.max(a, b) || 1;
  const difference = a - b;
  return <div className="periods-metric">
    <dt><span>{label}</span><span className={`periods-delta ${difference === 0 ? 'is-same' : difference > 0 ? 'is-up' : 'is-down'}`}>
      {difference === 0 ? same : `${difference > 0 ? '+' : '−'}${format(Math.abs(difference))}`}
    </span></dt>
    <dd>{[a, b].map((value, index) => <div className={`periods-reading periods-reading-${index}`} key={index}>
      <span className="periods-track" aria-hidden="true"><i style={{ width: `${value / maximum * 100}%` }} /></span>
      <span className="periods-value"><span className="periods-sr">{weeks[index]}: </span>{format(value)}</span>
    </div>)}</dd>
  </div>;
}

export default function Periods() {
  const { athleteId, actor = athleteId } = useWorkspace();
  const { t, lang } = useI18n();
  const tx = (key, values) => t(`training_integration.periods.${key}`, values);
  const selectorId = useId();
  const [selection, setSelection] = useState(null);
  const other = selection?.athleteId === athleteId ? selection.id : athleteId;
  const from = weekStart();
  const roster = useResource('getRoster');
  const a = useResource('getActivityTotals', { athleteId, from, through: addDays(from, 6) });
  const b = useResource('getActivityTotals', { athleteId: other, from: addDays(from, -7), through: addDays(from, -1) });
  const athletes = (roster.data?.items || []).filter(person => person.access !== 'none');
  const selected = athletes.find(person => person.id === athleteId);
  const comparison = athletes.find(person => person.id === other);
  const name = person => person ? `${person.name}${person.id === actor ? ` (${tx('you')})` : ''}` : '—';
  const initials = comparison?.name.trim().split(/\s+/u).map(part => Array.from(part)[0]).slice(0, 2).join('').toLocaleUpperCase() || '—';
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en';
  const number = value => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const duration = value => {
    const minutes = Math.round(value), hours = Math.floor(minutes / 60);
    return hours ? tx('hoursMinutes', { hours: number(hours), minutes: String(minutes % 60).padStart(2, '0') }) : tx('minutes', { minutes: number(minutes) });
  };
  const range = (start, end) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .formatRange(new Date(`${start}T12:00:00Z`), new Date(`${end}T12:00:00Z`));
  const loading = [roster, a, b].some(query => query.loading || !query.data && !query.error);
  const error = [roster, a, b].find(query => query.error)?.error;
  const ready = !loading && !error && selected && comparison;
  const first = ready ? total(a.data) : null;
  const second = ready ? total(b.data) : null;
  const weeks = [tx('thisWeek'), tx('lastWeek')];
  let summary;
  if (ready) {
    const who = other === actor ? tx('yourOwn') : tx('athleteTime', { name: comparison.name });
    const values = { who, percent: second.minutes ? number(Math.round(Math.abs(first.minutes - second.minutes) / second.minutes * 100)) : 0 };
    summary = !first.minutes && !second.minutes ? tx('noTime')
      : !second.minutes ? tx('noBaseline', { who })
        : first.minutes === second.minutes ? tx('sameTime', { who })
          : tx(first.minutes > second.minutes ? 'moreTime' : 'lessTime', values);
  }

  return <section className="periods-comparison" aria-label={t('training_integration.period_comparison')}>
    <div className="periods-selector">
      <label htmlFor={selectorId}>{tx('compareWith')}</label>
      <div className="periods-select-wrap">
        <span className={`periods-avatar ${other === actor ? 'is-self' : ''}`} aria-hidden="true">{initials}</span>
        <select id={selectorId} value={other} disabled={roster.loading || !athletes.length} onChange={event => setSelection({ athleteId, id: event.target.value })}>
          {!athletes.length && <option value={other}>—</option>}
          {athletes.map(person => <option key={person.id} value={person.id}>{name(person)}</option>)}
        </select>
        <span className="periods-chevron" aria-hidden="true">▾</span>
      </div>
    </div>
    <div className="periods-cards">
      {[{ person: selected, start: from, end: addDays(from, 6) }, { person: comparison, start: addDays(from, -7), end: addDays(from, -1) }].map((period, index) => <div className={`periods-card periods-card-${index}`} key={index}>
        <span className="periods-week"><i aria-hidden="true" />{weeks[index]}</span>
        <strong title={name(period.person)}>{name(period.person)}</strong>
        <span className="periods-range">{range(period.start, period.end)}</span>
      </div>)}
    </div>
    {error ? <p className="periods-status" role="alert">{tx(error.status === 403 || error.status === 404 ? 'accessUnavailable' : 'loadError')}</p>
      : loading ? <p className="periods-status" role="status">{tx('loading')}</p>
        : !ready ? <p className="periods-status" role="status">{tx('accessUnavailable')}</p>
          : <div aria-live="polite" aria-atomic="true">
            <dl className="periods-metrics">
              <Metric label={tx('time')} a={first.minutes} b={second.minutes} format={duration} same={tx('same')} weeks={weeks} />
              <Metric label={tx('knownLoad')} a={first.load} b={second.load} format={number} same={tx('same')} weeks={weeks} />
              <Metric label={tx('missingLoad')} a={first.unknown} b={second.unknown} format={number} same={tx('same')} weeks={weeks} />
            </dl>
            <p className="periods-summary">{summary}</p>
          </div>}
    <footer className="periods-footer">{tx('footnote')}</footer>
  </section>;
}

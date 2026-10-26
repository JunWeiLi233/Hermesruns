import { useId, useState } from 'react';
import { Bike, Plus, Waves } from 'lucide-react';
import AppIcon from '../../../components/AppIcon';
import { useI18n } from '../../../contexts/I18nContext';
import { currentDate } from '../data/dates.mjs';
import { addDays, civilDate } from '../data/model.mjs';
import { useWorkspace, useResource } from '../ui/workspace.jsx';
import './sport-totals.css';

function RunningIcon() {
  return <AppIcon name="load_balance_runner" />;
}

const SPORTS = [
  { key: 'running', Icon: RunningIcon },
  { key: 'cycling', Icon: Bike },
  { key: 'swimming', Icon: Waves },
  { key: 'other', Icon: Plus },
];

export default function Totals({ embedded = false }) {
  const { athleteId } = useWorkspace();
  const { t, formatNumber, formatDate, formatList } = useI18n();
  const text = (key, values) => t(`training_integration.totals.${key}`, values);
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => ({ from: `${currentDate().slice(0, 8)}01`, through: currentDate() }));
  const [draft, setDraft] = useState(range);
  const q = useResource('getActivityTotals', { athleteId, ...range });
  const id = useId();
  const invalid = preset === 'custom' && (!civilDate(draft.from) || !civilDate(draft.through) || draft.from > draft.through);

  function pick(next) {
    const today = currentDate();
    const dates = next === 'custom' ? range : {
      from: next === 'month' ? `${today.slice(0, 8)}01` : next === 'year' ? `${today.slice(0, 4)}-01-01` : addDays(today, -27),
      through: today,
    };
    setPreset(next);
    setRange(dates);
    setDraft(dates);
  }
  function edit(key, value) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (civilDate(next.from) && civilDate(next.through) && next.from <= next.through) setRange(next);
  }
  function duration(minutes) {
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    return hours ? text('hoursMinutes', { hours: formatNumber(hours), minutes: String(rounded % 60).padStart(2, '0') }) : text('minutesOnly', { minutes: formatNumber(rounded) });
  }
  const rows = SPORTS.map(sport => ({ ...sport, ...(q.data?.items || []).find(row => row.sport.toLowerCase() === sport.key) }))
    .map(row => ({ ...row, sessions: Number(row.sessions) || 0, minutes: Number(row.minutes) || 0, load: Number(row.load) || 0, unknown: Number(row.unknown) || 0 }));
  const sum = key => rows.reduce((total, row) => total + row[key], 0);
  const totalMinutes = sum('minutes');
  const active = rows.filter(row => row.sessions > 0).sort((a, b) => b.minutes - a.minutes);
  const idle = rows.filter(row => row.sessions === 0).map(row => text(`idleSports.${row.key}`));
  const date = value => formatDate(`${value}T12:00:00Z`, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const sessions = count => text(count === 1 ? 'session' : 'sessionsCount', { count: formatNumber(count) });
  const unknown = count => text('unknown', { count: formatNumber(count) });
  const ready = !q.loading && !q.error && !invalid;

  return <section className={`sport-totals${embedded ? ' sport-totals-embedded' : ''}`} aria-label={t('training_integration.sport_totals')}>
    {!embedded && <h2>{t('training_integration.sport_totals')}</h2>}
    <p className="sport-totals-range">{date(range.from)} – {date(range.through)}</p>
    <div className="sport-totals-controls">
      <div className="sport-totals-presets" role="group" aria-label={text('dateRange')}>
        {['month', '4w', 'year', 'custom'].map(key => <button key={key} type="button" aria-pressed={preset === key} onClick={() => pick(key)}>{text(`presets.${key}`)}</button>)}
      </div>
      {preset === 'custom' && <div className="sport-totals-dates">
        <label><span>{text('from')}</span><input type="date" value={draft.from} max={draft.through || undefined} onInput={e => edit('from', e.currentTarget.value)} onChange={e => edit('from', e.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} /></label>
        <span aria-hidden="true">→</span>
        <label><span>{text('through')}</span><input type="date" value={draft.through} min={draft.from || undefined} onInput={e => edit('through', e.currentTarget.value)} onChange={e => edit('through', e.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} /></label>
      </div>}
    </div>
    {invalid && <p className="sport-totals-message" id={`${id}-error`} role="alert">{text('invalidRange')}</p>}
    {!invalid && q.loading && <p className="sport-totals-message" role="status">{t('analysis.stitch_loading')}</p>}
    {!invalid && q.error && <p className="sport-totals-message" role="alert">{text(q.error.status === 403 || q.error.status === 404 ? 'accessError' : 'loadError')} <span>{q.error.message}</span></p>}
    {ready && (active.length ? <>
      <dl className="sport-totals-summary">
        <div><dt>{text('sessions')}</dt><dd>{formatNumber(sum('sessions'))}</dd></div>
        <div><dt>{text('time')}</dt><dd>{duration(totalMinutes)}</dd></div>
        <div><dt>{text('knownLoad')}</dt><dd aria-describedby={sum('unknown') ? `${id}-note` : undefined}>{formatNumber(sum('load'))}{sum('unknown') > 0 && '*'}</dd></div>
      </dl>
      {totalMinutes > 0 && <div className="sport-totals-bar" aria-hidden="true">{active.filter(row => row.minutes > 0).map(row => <span key={row.key} className={`sport-${row.key}`} style={{ flexGrow: row.minutes }} />)}</div>}
      <ul className="sport-totals-list">
        {active.map(({ key, Icon, sessions: count, minutes, load, unknown: missing }) => <li key={key} className={`sport-${key}`}>
          <span className="sport-totals-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
          <div className="sport-totals-name"><strong>{text(`sports.${key}`)}</strong><span>{sessions(count)}{totalMinutes > 0 ? ` · ${formatNumber(Math.round(minutes / totalMinutes * 100))}%` : ''}</span></div>
          <div className="sport-totals-values"><strong>{duration(minutes)}</strong><span className={load === 0 && missing >= count ? 'is-unknown' : undefined}>{load === 0 && missing >= count ? text('noLoad') : text('loadValue', { value: formatNumber(load) })}{missing > 0 ? ` · ${unknown(missing)}` : ''}</span></div>
        </li>)}
      </ul>
      {idle.length > 0 && <p className="sport-totals-idle">{text('idle', { sports: formatList(idle, { type: 'disjunction' }) })}</p>}
    </> : <div className="sport-totals-empty"><strong>{text('emptyTitle')}</strong><p>{text('emptyBody')}</p></div>)}
    <footer className="sport-totals-note" id={`${id}-note`}>{text('note')}</footer>
  </section>;
}

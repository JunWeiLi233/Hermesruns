import { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../contexts/I18nContext';
import { useUnit } from '../../../contexts/UnitContext';
import { useWorkspace, useResource } from '../ui/workspace.jsx';
import { QueryGate } from '../ui/components.jsx';
import { comparisonPlot, heartRateAverage } from './comparisonChart.js';
import './comparison.css';

const COLORS = ['var(--cmp-trace-0)', 'var(--cmp-trace-1)', 'var(--cmp-trace-2)', 'var(--cmp-trace-3)'];
const LIMIT = 4;

function duration(minutes) {
  if (minutes == null || !Number.isFinite(+minutes)) return '—';
  const seconds = Math.max(0, Math.round(minutes * 60));
  const hours = Math.floor(seconds / 3600), mins = Math.floor(seconds % 3600 / 60), secs = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(mins).padStart(2, '0')}:${secs}` : `${mins}:${secs}`;
}

function HeartRateChart({ traces, offset, message, s }) {
  const titleId = useId();
  const plot = useMemo(() => comparisonPlot(traces, offset), [traces, offset]);
  return <div className="comparison-chart">
    <div className="comparison-plot">
      {plot.ticks.map(tick => <div className="comparison-gridline" key={tick.value} style={{ top: `${tick.y}%` }}><span>{tick.value}</span></div>)}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{s('chartDescription')}</title>
        {plot.lines.map((line, index) => <path key={traces[index].id} d={line.path} fill="none" stroke={COLORS[index]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
      {message && <div className="comparison-chart-empty" role="status"><span>{message}</span></div>}
    </div>
    <div className="comparison-x-axis" aria-hidden="true"><span>0</span><span>{Math.round(plot.lastSample / 2)}</span><span>{plot.lastSample}</span></div>
  </div>;
}

function ComparisonContent({ activities }) {
  const { t, lang } = useI18n(), { isMile } = useUnit(), { api } = useWorkspace();
  const s = (key, values) => t(`training_integration.compare.${key}`, values);
  const [ids, setIds] = useState(() => activities.slice(0, 2).map(activity => activity.id));
  const [search, setSearch] = useState(''), [name, setName] = useState(() => s('defaultName'));
  const [offset, setOffset] = useState(0), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(null);
  const saved = useResource('getComparisons'), overlays = useResource('getActivityOverlays', { activityIds: ids });
  const date = value => {
    if (!value) return s('unknownDate');
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? s('unknownDate') : parsed.toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  const selected = ids.map(id => ({ ...activities.find(activity => activity.id === id), ...overlays.data?.items.find(activity => activity.id === id), id }));
  const query = search.trim().toLocaleLowerCase(lang);
  const shown = activities.filter(activity => !query || `${activity.title} ${activity.date || ''} ${date(activity.date)}`.toLocaleLowerCase(lang).includes(query));
  const full = ids.length >= LIMIT;
  function edit(change) { setFeedback(null); change(); }
  function toggle(id) { edit(() => setIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < LIMIT ? [...previous, id] : previous)); }
  function load(comparison) {
    if (comparison.activityIds.length > LIMIT) { setFeedback({ error: true, text: s('savedLimit') }); return; }
    edit(() => { setIds(comparison.activityIds); setName(comparison.name); setOffset(Math.max(0, Math.min(20, Number(comparison.offset) || 0))); });
  }
  async function save(event) {
    event.preventDefault();
    if (busy || ids.length < 2 || !name.trim()) return;
    setBusy(true); setFeedback(null);
    try {
      await api.saveComparison({ activityIds: ids, name: name.trim(), offset });
      setFeedback({ text: s('savedMessage') });
    } catch (error) { setFeedback({ error: true, text: error.message }); }
    finally { setBusy(false); }
  }
  const noHeartRate = !selected.some(activity => heartRateAverage(activity) != null && activity.samples?.some(sample => sample.hr > 0));
  const chartMessage = ids.length < 2 ? s(ids.length ? 'pickOneMore' : 'pickSessions') : overlays.loading ? s('loading') : overlays.error ? overlays.error.message : noHeartRate ? s('noHeartRate') : null;
  return <form className="session-comparison" onSubmit={save}>
    <section className="comparison-sidebar" aria-label={s('sessions')}>
      <div className="comparison-sidebar-heading">
        <div className="comparison-selection"><span>{s('sessions')}</span><output className={full ? 'is-full' : ''} aria-live="polite">{s(full ? 'maxSelected' : 'selected', { count: ids.length })}</output></div>
        <label className="comparison-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><input type="search" aria-label={s('search')} placeholder={s('search')} value={search} onChange={event => setSearch(event.target.value)} /></label>
      </div>
      <div className="comparison-session-list">
        {shown.map(activity => {
          const index = ids.indexOf(activity.id), checked = index >= 0;
          const detail = selected.find(item => item.id === activity.id) || activity, average = heartRateAverage(detail), distance = detail.distanceKm;
          return <label key={activity.id} className={`comparison-session ${checked ? 'is-selected' : ''} ${!checked && full ? 'is-blocked' : ''}`} style={{ '--trace-color': COLORS[index] }}>
            <input type="checkbox" checked={checked} disabled={busy || !checked && full} onChange={() => toggle(activity.id)} />
            <span className="comparison-session-copy"><strong>{activity.title}</strong><span>{date(activity.date)} · {average == null ? s('noAverage') : s('average', { value: average })}</span></span>
            <span className="comparison-session-metrics"><strong>{distance == null ? '—' : `${(distance / (isMile ? 1.609344 : 1)).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${isMile ? 'mi' : 'km'}`}</strong><span>{duration(activity.minutes)}</span></span>
          </label>;
        })}
        {!shown.length && <p className="comparison-list-empty" role="status">{s(activities.length ? 'noMatch' : 'noSessions', { query: search })}</p>}
      </div>
    </section>
    <section className="comparison-detail" aria-label={s('overlay')}>
      {!!saved.data?.items.length && <div className="comparison-saved"><span>{s('saved')}</span>{saved.data.items.map(comparison => <button type="button" key={comparison.id} disabled={busy} aria-pressed={comparison.name === name && comparison.offset === offset && comparison.activityIds.length === ids.length && comparison.activityIds.every((id, index) => id === ids[index])} onClick={() => load(comparison)}>{comparison.name}</button>)}</div>}
      {saved.error && <p className="comparison-notice" role="alert">{s('savedUnavailable')}</p>}
      <div className="comparison-overlay">
        <div className="comparison-chart-heading"><h4>{s('overlay')}</h4><span>{s('sampleUnits')}</span></div>
        <div className="comparison-legend" aria-label={s('selectedSessions')}>
          {selected.map((activity, index) => <span className="comparison-legend-item" key={activity.id}><i style={{ background: COLORS[index] }} aria-hidden="true" /><span className="comparison-legend-name">{activity.title || s('session')}{activity.date ? `, ${date(activity.date)}` : ''}</span><span className="comparison-legend-average">{heartRateAverage(activity) ?? '—'}</span><button type="button" disabled={busy} onClick={() => toggle(activity.id)} aria-label={s('remove', { name: activity.title || s('session') })}>×</button></span>)}
        </div>
        <HeartRateChart traces={overlays.loading || overlays.error ? [] : selected} offset={offset} message={chartMessage} s={s} />
      </div>
      <div className="comparison-controls">
        <label className="comparison-name"><span>{s('name')}</span><input value={name} maxLength={160} required disabled={busy} onChange={event => edit(() => setName(event.target.value))} /></label>
        <label className="comparison-shift"><span>{s('shift')}<output>{s('samples', { count: offset })}</output></span><input type="range" min="0" max="20" step="1" value={offset} aria-label={s('shift')} aria-valuetext={s('samples', { count: offset })} disabled={busy} onChange={event => edit(() => setOffset(Number(event.target.value)))} /></label>
      </div>
      <div className="comparison-footer">
        {feedback && <p className={feedback.error ? 'comparison-error' : 'comparison-success'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
        <button className="comparison-clear" type="button" disabled={busy || !ids.length} onClick={() => edit(() => setIds([]))}>{s('clear')}</button>
        <button className="comparison-save" type="submit" disabled={busy || ids.length < 2 || !name.trim()}>{s(busy ? 'saving' : 'save')}</button>
      </div>
    </section>
  </form>;
}

export default function Compare() {
  const { actor, athleteId } = useWorkspace();
  const query = useResource('getActivities', { athleteId });
  return <QueryGate query={query}>{data => <ComparisonContent key={`${actor}:${athleteId}`} activities={data.items} />}</QueryGate>;
}

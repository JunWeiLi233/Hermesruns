import { weekStart } from '../data/dates.mjs';
import { WorkoutPalette } from '../ui/WorkoutPalette.jsx';
import { useState } from 'react';
import { Link } from '../ui/router.jsx';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Feedback, Panel, QueryGate, TextField, fmt } from '../ui/components.jsx';
import { addDays, civilDate } from '../data/model.mjs';
import { CalendarEntry } from '../ui/CalendarEntry.jsx';
export default function Calendar() {
  const {
      api,
      athleteId
    } = useWorkspace(),
    [week, setWeek] = useState(weekStart()),
    library = useResource('getLibrary'),
    query = useResource('getCalendar', {
      athleteId,
      start: week,
      end: addDays(week, 6)
    }),
    command = useCommand();
  return <><div className="tw-actions"><Button onClick={() => setWeek(addDays(week, -7))}>Previous week</Button><TextField label="Week begins" type="date" value={week} onChange={e => civilDate(e.target.value) && setWeek(e.target.value)} /><Button onClick={() => setWeek(addDays(week, 7))}>Next week</Button><Link className="ds-button ds-primary" to="/import">Import activity</Link><Link className="ds-button" to="/workout">Plan a workout</Link></div><Feedback command={command} /><QueryGate query={query}>{data => <><Panel title="Weekly overview" meta={`${week} – ${addDays(week, 6)}`}><dl className="tw-metrics">{[['Completed minutes', fmt(data.activities.reduce((n, a) => n + a.minutes, 0))], ['Known load', data.activities.reduce((n, a) => n + (a.load ?? 0), 0)], ['Unknown loads', data.activities.filter(a => a.load == null).length], ['Remaining planned minutes', data.events.filter(e => e.state === 'planned').reduce((n, e) => n + e.minutes, 0)]].map(([k, v]) => <div className="tw-metric" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><p className="tw-muted">Totals are provisional when a load is unknown. Planned sessions are counted separately.</p></Panel><WorkoutPalette workouts={library.data?.workouts || []} /><div className="tw-calendar">{Array.from({
            length: 7
          }, (_, i) => addDays(week, i)).map(date => <section className="tw-day" key={date} onDragOver={e => e.preventDefault()} onDrop={e => {
            e.preventDefault();
            try {
              const p = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (p.workoutId) {
                const w = library.data?.workouts.find(w => w.id === p.workoutId);
                if (w) command.run(() => api.createEvent({
                  athleteId,
                  date,
                  title: w.title,
                  minutes: w.minutes,
                  sport: w.sport,
                  sourceVersion: w.version,
                  snapshot: {
                    source: w.source
                  }
                }), 'Workout scheduled from library.');
              } else command.run(() => api.updateEvent({
                ...p,
                date
              }), 'Workout moved.');
            } catch {/* Ignore external drags that do not contain a workspace prescription. */}
          }}><h2 className="ds-small">{new Intl.DateTimeFormat('en', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC'
              }).format(new Date(date + 'T12:00:00Z'))}</h2>{data.activities.filter(a => a.date === date).map(a => <article className="tw-session" key={a.id}><Badge tone="success">Completed</Badge><Link to={`/activity?id=${a.id}`}>{a.title}</Link><span className="tw-muted">{fmt(a.minutes)} min · {a.sport}</span><span className="tw-muted">Load {fmt(a.load)} · {a.model}</span></article>)}{data.events.filter(e => e.date === date && e.state !== 'cancelled').map(e => <CalendarEntry key={e.id} event={e} activities={data.activities} />)}{!data.activities.some(a => a.date === date) && !data.events.some(e => e.date === date) && <span className="tw-muted">Open day</span>}</section>)}</div></>}</QueryGate></>;
}

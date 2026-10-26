import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useWorkspace, useResource, useCommand, useCanWrite } from '../ui/workspace.jsx';
import { Button, Feedback, Field, LineChart, Panel, QueryGate, SelectField, TextField, fmt } from '../ui/components.jsx';
import { compileWorkout } from '../data/model.mjs';
function Editor({
  workout,
  folders
}) {
  const canWrite = useCanWrite();
  const {
      api,
      actor,
      athleteId
    } = useWorkspace(),
    [title, setTitle] = useState(workout?.title || 'Progressive endurance'),
    [source, setSource] = useState(workout?.source || '10m @65% Warm up\n20m @80% Steady work\n10m @55% Cool down'),
    [sport, setSport] = useState(workout?.sport || 'Running'),
    [date, setDate] = useState('2026-10-16'),
    [folderId, setFolder] = useState(workout?.folderId || ''),
    [saved, setSaved] = useState(null),
    c = useCommand(),
    compiled = compileWorkout(source),
    owned = workout?.ownerId === actor;
  return <div className="tw-grid"><Panel title="Author the steps" meta={owned ? `Owned version ${workout.version}` : workout ? 'Shared source · save as your own copy' : 'New draft'}><TextField label="Workout name" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} /><SelectField label="Sport" value={sport} onChange={e => setSport(e.target.value)} options={['Running', 'Cycling', 'Swimming']} /><SelectField label="Workout folder" value={folderId} onChange={e => setFolder(e.target.value)} options={[{
        value: '',
        label: 'Unfiled'
      }, ...folders.map(f => ({
        value: f.id,
        label: f.name
      }))]} /><Field label="Workout source" error={compiled.errors.join(' ')} hint="Nm @target unit name. Repeats: 3x followed by indented steps. Units %, bpm, W, rpm, m/s.">{p => <textarea {...p} rows={10} maxLength={65536} value={source} onChange={e => {
          setSource(e.target.value);
          setSaved(null);
        }} spellCheck={false} />}</Field><Button variant="primary" disabled={!!compiled.errors.length} busy={c.busy} onClick={() => c.run(async () => {
        const w = await api.saveWorkout({
          workoutId: owned ? workout.id : undefined,
          revision: owned ? workout.revision : undefined,
          title,
          source,
          sport,
          folderId
        });
        setSaved(w);
      }, 'Published a pinned workout version in your library.')}>Save workout version</Button><Feedback command={c} /></Panel><Panel title="Preview and schedule" meta={`${fmt(compiled.minutes)} min · ${compiled.steps.length} steps`}><LineChart title="Workout targets" units="target units" series={[...new Set(compiled.steps.map(s => s.unit))].map(unit => ({
        name: `Target (${unit})`,
        values: compiled.steps.map(s => s.unit === unit ? s.target : null)
      }))} /><ol>{compiled.steps.map((s, i) => <li key={i}>{s.name} · {s.minutes}m · {s.target}{s.unit}</li>)}</ol><TextField label="Schedule day" type="date" value={date} onChange={e => setDate(e.target.value)} /><Button disabled={!!compiled.errors.length || !canWrite} onClick={() => c.run(() => api.createEvent({
        athleteId,
        date,
        title,
        minutes: compiled.minutes,
        sport,
        snapshot: {
          source,
          steps: compiled.steps
        },
        sourceVersion: saved?.version || workout?.version || null,
        key: crypto.randomUUID()
      }), 'Workout scheduled. Open the calendar to move or match it.')}>Schedule for selected athlete</Button><Link to="/calendar">Open calendar</Link></Panel></div>;
}
export default function Workout() {
  const [params] = useSearchParams(),
    query = useResource('getLibrary');
  return <QueryGate query={query}>{data => <Editor folders={data.folders} key={params.get('id') || 'new'} workout={data.workouts.find(w => w.id === params.get('id'))} />}</QueryGate>;
}

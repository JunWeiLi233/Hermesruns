import { useState } from 'react';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, DataTable, Feedback, Panel, QueryGate, SelectField, TextField } from '../ui/components.jsx';
import { BulkReview } from '../ui/BulkReview.jsx';
export default function Plans() {
  const {
      api,
      athleteId
    } = useWorkspace(),
    q = useResource('getLibrary'),
    roster = useResource('getRoster'),
    [title, setTitle] = useState('My foundation plan'),
    [items, setItems] = useState([]),
    [workout, setWorkout] = useState(''),
    [day, setDay] = useState(0),
    [targets, setTargets] = useState([athleteId]),
    [date, setDate] = useState('2026-10-19'),
    [preview, setPreview] = useState(null),
    c = useCommand();
  return <QueryGate query={q}>{data => <><div className="tw-grid"><Panel title="Compose a reusable plan"><TextField label="Plan name" value={title} onChange={e => setTitle(e.target.value)} /><SelectField label="Workout to add" value={workout} onChange={e => setWorkout(e.target.value)} options={[{
            value: '',
            label: 'Choose a pinned workout'
          }, ...data.workouts.map(w => ({
            value: w.id,
            label: `${w.title} · v${w.version}`
          }))]} /><TextField label="Day offset" type="number" min="0" max="365" value={day} onChange={e => setDay(+e.target.value)} /><Button disabled={!workout} onClick={() => {
            const w = data.workouts.find(w => w.id === workout);
            setItems([...items, {
              day,
              title: w.title,
              minutes: w.minutes,
              sport: w.sport,
              source: w.source,
              workoutId: w.id,
              sourceVersion: w.version
            }]);
          }}>Add workout to plan</Button><DataTable caption="Draft plan sessions" rows={items} columns={[{
            key: 'title',
            label: 'Workout'
          }, {
            key: 'day',
            label: 'Day offset'
          }, {
            key: 'minutes',
            label: 'Minutes'
          }, {
            key: 'action',
            label: 'Arrange',
            render: r => <Button size="sm" onClick={() => setItems(items.map(x => x === r ? {
              ...x,
              day: Math.max(0, x.day - 1)
            } : x))}>Move earlier</Button>
          }]} /><Button variant="primary" disabled={!items.length} onClick={() => c.run(() => api.savePlan({
            title,
            items
          }), 'Pinned plan version saved.')}>Publish reusable plan</Button></Panel><Panel title="Choose recipients and start day"><fieldset className="tw-checklist"><legend>Application targets</legend>{roster.data?.items.map(a => <label key={a.id}><input type="checkbox" checked={targets.includes(a.id)} onChange={e => setTargets(e.target.checked ? [...targets, a.id] : targets.filter(id => id !== a.id))} />{a.name} · {a.access}</label>)}</fieldset><TextField label="Plan start day" type="date" value={date} onChange={e => setDate(e.target.value)} /><p className="tw-muted">Read-only and unconsented athletes are listed as ineligible in the preview.</p>{preview && <BulkReview preview={preview} />}<Feedback command={c} /></Panel></div><Panel title="Published library plans"><div className="tw-card-list">{data.plans.map(p => <article className="tw-card" key={p.id}><Badge>Version {p.version}</Badge><h3>{p.title}</h3><p>{p.items.length} sessions · immutable source snapshot</p><Button disabled={!targets.length} onClick={() => c.run(async () => {
              setPreview(await api.previewPlan({
                planId: p.id,
                athleteIds: targets,
                date
              }));
            }, 'Review prepared. Open the application review to commit.')}>Preview {p.title}</Button></article>)}</div></Panel></>}</QueryGate>;
}

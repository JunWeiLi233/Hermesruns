import { useState } from 'react';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, LineChart, Panel, QueryGate, TextField } from '../ui/components.jsx';
export default function Compare() {
  const {
      api,
      athleteId
    } = useWorkspace(),
    q = useResource('getActivities', {
      athleteId
    }),
    saved = useResource('getComparisons'),
    [ids, setIds] = useState([]),
    [name, setName] = useState('Session comparison'),
    [offset, setOffset] = useState(0),
    c = useCommand(),
    overlays = useResource('getActivityOverlays', {activityIds: ids});
  return <QueryGate query={q}>{data => <><Panel title="Overlay authorized sessions"><fieldset className="tw-checklist"><legend>Choose sessions</legend>{data.items.map(a => <label key={a.id}><input type="checkbox" checked={ids.includes(a.id)} onChange={e => setIds(e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id))} />{a.title}</label>)}</fieldset><TextField label="Comparison name" value={name} onChange={e => setName(e.target.value)} /><TextField label="Second trace offset (samples)" type="number" min="0" max="20" value={offset} onChange={e => setOffset(Math.max(0, Math.min(20, +e.target.value)))} /><LineChart title="Heart rate overlay" units="bpm" series={(overlays.data?.items || []).map((a, i) => ({
          name: a.title,
          values: [...Array(i ? offset : 0).fill(null), ...a.samples.map(s => s.hr)]
        }))} /><Button disabled={ids.length < 2} onClick={() => c.run(() => api.saveComparison({
          activityIds: ids,
          name,
          offset
        }), 'Comparison saved.')}>Save comparison</Button><Feedback command={c} /></Panel><Panel title="Saved comparisons">{saved.data?.items.map(s => <Button key={s.id} onClick={() => {
          setIds(s.activityIds);
          setName(s.name);
          setOffset(s.offset || 0);
        }}>{s.name}</Button>)}</Panel></>}</QueryGate>;
}

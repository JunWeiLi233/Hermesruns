import { currentDate } from '../data/dates.mjs';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Button, DataTable, Feedback, Notice, Panel, QueryGate, TextField } from '../ui/components.jsx';
export default function Wellness() {
  const {
      api,
      athleteId,
      actor
    } = useWorkspace(),
    q = useResource('getWellness', {
      athleteId
    }),
    c = useCommand();
  return <QueryGate query={q}>{data => <Panel title="Daily recovery journal" meta="Optional fields · manual values"><DataTable caption="Permitted wellness values" rows={data.items} columns={[{
        key: 'date',
        label: 'Day'
      }, {
        key: 'sleep',
        label: 'Sleep (h)'
      }, {
        key: 'restingHr',
        label: 'Resting HR'
      }, {
        key: 'feeling',
        label: 'Feeling (1–5)'
      }]} />{actor !== athleteId && <Notice tone="warning">Unshared wellness fields stay hidden. A calendar grant alone does not allow editing them.</Notice>}{actor === athleteId && <form onSubmit={e => {
        e.preventDefault();
        const p = Object.fromEntries(new FormData(e.currentTarget));
        c.run(() => api.saveWellness({
          athleteId,
          date: p.date,
          revision: data.items.find(item=>item.date===p.date)?.revision,
          ...Object.fromEntries(['sleep', 'restingHr', 'feeling'].filter(k => p[k] !== '').map(k => [k, +p[k]]))
        }), 'Wellness saved.');
      }}><TextField label="Journal day" name="date" type="date" defaultValue={currentDate()} required />{[['sleep', 'Sleep hours', 0, 24], ['restingHr', 'Resting heart rate', 25, 150], ['feeling', 'Feeling', 1, 5]].map(([name, label, min, max]) => <TextField key={name} label={label} name={name} type="number" min={min} max={max} step={name === 'sleep' ? '.1' : '1'} />)}<Button type="submit" variant="primary">Save journal entry</Button></form>}<Feedback command={c} /></Panel>}</QueryGate>;
}

import { useState } from 'react';
import { useActivity, useWorkspace, useCommand, useCanWrite } from '../ui/workspace.jsx';
import { ActivityLinks, Button, DataTable, Empty, Feedback, Panel, QueryGate, TextField } from '../ui/components.jsx';
import { csv, downloadText } from '../ui/download.mjs';
export default function Intervals() {
  const canWrite = useCanWrite();
  const {
      api
    } = useWorkspace(),
    {
      detail,
      activity: a,
      id
    } = useActivity(),
    [start, setStart] = useState('0'),
    [end, setEnd] = useState('60'),
    c = useCommand();
  return <QueryGate query={detail}>{() => a ? <><ActivityLinks id={id} /><Panel title={`Intervals · ${a.title}`} meta="Own sustained-HR candidates; manual overrides retain the raw stream"><DataTable caption="Interval metrics" rows={a.intervals} columns={[{
          key: 'id',
          label: 'Interval'
        }, {
          key: 'start',
          label: 'Start (s)'
        }, {
          key: 'end',
          label: 'End (s)'
        }, {
          key: 'minutes',
          label: 'Duration (min)',
          render: r => (r.end - r.start) / 60
        }]} /><div className="tw-actions"><TextField label="Interval start (s)" type="number" value={start} onChange={e => setStart(e.target.value)} /><TextField label="Interval end (s)" type="number" value={end} onChange={e => setEnd(e.target.value)} /><Button disabled={!canWrite} onClick={() => c.run(() => api.saveIntervals({
            activityId: id,
            revision: a.revision,
            intervals: [...a.intervals, {
              id: crypto.randomUUID(),
              start: +start,
              end: +end
            }]
          }), 'Interval override saved.')}>Add interval</Button><Button onClick={() => downloadText('intervals.csv', csv(a.intervals, ['start', 'end', 'minutes']), 'text/csv')}>Export intervals</Button></div><Feedback command={c} /></Panel></> : <Empty />}</QueryGate>;
}

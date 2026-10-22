import { useState } from 'react';
import { useWorkspace, useResource } from '../ui/workspace.jsx';
import { DataTable, Panel, QueryGate, TextField } from '../ui/components.jsx';
export default function Totals() {
  const {
      athleteId
    } = useWorkspace(),
    q = useResource('getActivities', {
      athleteId
    }),
    [from, setFrom] = useState('2026-10-01'),
    [through, setThrough] = useState('2026-10-31');
  return <QueryGate query={q}>{data => <Panel title="Volume by sport"><div className="tw-actions"><TextField label="Totals from" type="date" value={from} onChange={e => setFrom(e.target.value)} /><TextField label="Totals through" type="date" value={through} onChange={e => setThrough(e.target.value)} /></div><DataTable caption="Sport totals; known loads only" columns={[{
        key: 'sport',
        label: 'Sport'
      }, {
        key: 'sessions',
        label: 'Sessions'
      }, {
        key: 'minutes',
        label: 'Minutes'
      }, {
        key: 'load',
        label: 'Known load'
      }, {
        key: 'unknown',
        label: 'Unknown loads'
      }]} rows={['Running', 'Cycling', 'Swimming'].map(sport => {
        const a = data.items.filter(a => a.sport === sport && a.date >= from && a.date <= through);
        return {
          sport,
          sessions: a.length,
          minutes: a.reduce((n, x) => n + x.minutes, 0),
          load: a.reduce((n, x) => n + (x.load ?? 0), 0),
          unknown: a.filter(x => x.load == null).length
        };
      })} /></Panel>}</QueryGate>;
}

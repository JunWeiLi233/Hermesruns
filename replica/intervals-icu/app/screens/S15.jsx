import { useState } from 'react';
import { useWorkspace, useResource } from '../ui/workspace.jsx';
import { DataTable, Panel, QueryGate, SelectField } from '../ui/components.jsx';
export default function Periods() {
  const {
      athleteId
    } = useWorkspace(),
    [other, setOther] = useState(athleteId),
    roster = useResource('getRoster'),
    a = useResource('getActivities', {
      athleteId
    }),
    b = useResource('getActivities', {
      athleteId: other
    });
  return <Panel title="Compare an authorized athlete and period"><SelectField label="Comparison athlete" value={other} onChange={e => setOther(e.target.value)} options={(roster.data?.items || []).filter(u => u.access !== 'none').map(u => ({
      value: u.id,
      label: u.name
    }))} /><QueryGate query={a}>{first => <QueryGate query={b}>{second => <DataTable caption="Current and preceding week" columns={[{
          key: 'name',
          label: 'Selection'
        }, {
          key: 'minutes',
          label: 'Minutes'
        }, {
          key: 'load',
          label: 'Known load'
        }, {
          key: 'unknown',
          label: 'Missing loads'
        }]} rows={[[first, 'Selected athlete · 12–18 Oct', '2026-10-12', '2026-10-18'], [second, 'Comparison · 5–11 Oct', '2026-10-05', '2026-10-11']].map(([d, name, start, end]) => {
          const rows = d.items.filter(x => x.date >= start && x.date <= end);
          return {
            name,
            minutes: rows.reduce((n, a) => n + a.minutes, 0),
            load: rows.reduce((n, a) => n + (a.load ?? 0), 0),
            unknown: rows.filter(a => a.load == null).length
          };
        })} />}</QueryGate>}</QueryGate></Panel>;
}

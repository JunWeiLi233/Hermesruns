import { useState } from 'react';
import { Link } from '../ui/router.jsx';
import { useActivity, useWorkspace, useCommand, useCanWrite } from '../ui/workspace.jsx';
import { ActivityLinks, Button, Empty, Feedback, LineChart, Panel, QueryGate, TextField, fmt } from '../ui/components.jsx';
export default function Timeline() {
  const canWrite = useCanWrite();
  const {
      api
    } = useWorkspace(),
    {
      detail,
      id,
      activity: a
    } = useActivity(),
    command = useCommand(),
    [rpe, setRpe] = useState('');
  return <QueryGate query={detail}>{() => a ? <><ActivityLinks id={id} /><Panel title={a.title} meta={`${a.date} · ${a.sport}`}><dl className="tw-metrics">{[['Minutes', fmt(a.minutes)], ['Load', fmt(a.load)], ['Coverage', `${Math.round(a.coverage * 100)}%`], ['Method', a.model]].map(([k, v]) => <div key={k} className="tw-metric"><dt>{k}</dt><dd>{v}</dd></div>)}</dl><LineChart title="Session heart rate" units="bpm" series={[{
          name: 'Heart rate',
          values: a.samples.map(s => s.hr)
        }]} /><p className="tw-muted">Source: {a.source}. Automatic interval candidates use the Hermes sustained heart-rate threshold rule. Unknown metrics remain unknown.</p></Panel><Panel title="Perceived effort fallback"><div className="tw-actions"><TextField label="Session RPE (1–10)" type="number" min="1" max="10" value={rpe} onChange={e => setRpe(e.target.value)} /><Button disabled={!canWrite} onClick={() => command.run(() => api.updateActivity({
            activityId: id,
            rpe: +rpe,
            revision: a.revision
          }), 'Effort updated and load recalculated.')}>Save effort</Button><Link to="/fitness">Review training impact</Link><Link to="/workout">Plan next session</Link><Link to={`/messages?activity=${id}`}>Discuss this session</Link></div><Feedback command={command} /></Panel></> : <Empty />}</QueryGate>;
}

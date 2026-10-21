import { useState } from 'react';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, Notice, Panel, QueryGate, SelectField } from '../ui/components.jsx';
import { BulkReview } from '../ui/BulkReview.jsx';
export default function Bulk() {
  const {
      api
    } = useWorkspace(),
    q = useResource('getRoster'),
    [ids, setIds] = useState([]),
    [units, setUnits] = useState('metric'),
    [preview, setPreview] = useState(null),
    c = useCommand();
  return <QueryGate query={q}>{data => <Panel title="Copy a typed configuration"><Notice>This local variant copies display units only. Additional custom columns, chart layouts and zone bundles need their own validated schemas.</Notice><SelectField label="Units to apply" value={units} onChange={e => setUnits(e.target.value)} options={['metric', 'imperial']} /><fieldset className="tw-checklist"><legend>Targets</legend>{data.items.map(a => <label key={a.id}><input type="checkbox" checked={ids.includes(a.id)} onChange={e => setIds(e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id))} />{a.name} · {a.access}</label>)}</fieldset><Button disabled={!ids.length} onClick={() => c.run(async () => setPreview(await api.previewConfiguration({
        athleteIds: ids,
        units
      })), 'Configuration review prepared.')}>Preview configuration changes</Button>{preview && <BulkReview preview={preview} />}<Feedback command={c} /></Panel>}</QueryGate>;
}

import { useState } from 'react';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Feedback, Notice, Panel, QueryGate, SelectField } from '../ui/components.jsx';
export default function Access() {
  const {
      api,
      actor
    } = useWorkspace(),
    requests = useResource('getRequests'),
    profiles = useResource('searchAthletes'),
    [target, setTarget] = useState(''),
    [level, setLevel] = useState('read'),
    [sleep, setSleep] = useState(false),
    c = useCommand();
  return <><Panel title="Request a relationship"><SelectField label="Discoverable athlete" value={target} onChange={e => setTarget(e.target.value)} options={[{
        value: '',
        label: 'Choose an athlete'
      }, ...(profiles.data?.items || []).map(p => ({
        value: p.id,
        label: p.name
      }))]} /><SelectField label="Requested access" value={level} onChange={e => setLevel(e.target.value)} options={[{
        value: 'read',
        label: 'Follow: read only'
      }, {
        value: 'coach',
        label: 'Coach: calendar editing'
      }]} /><Button disabled={!target} onClick={() => c.run(() => api.requestAccess({
        athleteId: target,
        level
      }), 'Request sent locally. Switch to the athlete account to decide.')}>Request access</Button><Feedback command={c} /></Panel><QueryGate query={requests}>{data => <Panel title="Received and sent relationships"><Notice>Accepting read access does not grant editing. Wellness needs an additional field choice. Group consent is handled separately.</Notice><label className="ds-check"><input type="checkbox" checked={sleep} onChange={e => setSleep(e.target.checked)} /> Include sleep duration when accepting (optional)</label><div className="tw-card-list">{data.items.map(r => <article className="tw-card" key={r.id}><h3>{r.granteeName} → {r.subjectName}</h3><Badge>{r.level} · {r.state}</Badge>{r.subject === actor && <div className="tw-actions">{['accepted', 'declined', 'revoked'].map(decision => <Button key={decision} variant={decision === 'revoked' ? 'danger' : 'secondary'} onClick={() => c.run(() => api.decideAccess({
                relationshipId: r.id,
                decision,
                wellness: sleep ? ['sleep'] : []
              }), 'Relationship updated.')}>{decision === 'accepted' ? 'Accept' : decision === 'declined' ? 'Decline' : 'Revoke'} {r.granteeName}</Button>)}</div>}</article>)}</div></Panel>}</QueryGate></>;
}

import { useState } from 'react';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Feedback, Notice, Panel, QueryGate, SelectField, TextField } from '../ui/components.jsx';
export default function Consent() {
  const {
      api,
      actor
    } = useWorkspace(),
    [joinDraft,setJoinDraft] = useState(''),
    [joinSlug,setJoinSlug] = useState(''),
    q = useResource('getTeams'),
    join = useResource('getJoinCard', {slug:joinSlug}),
    [level, setLevel] = useState('coach'),
    [sleep, setSleep] = useState(false),
    c = useCommand();
  return <QueryGate query={q}>{data => <><Panel title="Join a coaching group">{api.mode === 'http' && <div className="ds-stack"><TextField label="Team join code" value={joinDraft} onChange={e=>setJoinDraft(e.target.value)}/><Button onClick={()=>setJoinSlug(joinDraft.trim())}>Review team code</Button>{join.error && <Notice tone="warning">That team code is unavailable.</Notice>}</div>}<p>{join.data?.name || (api.mode === 'http' ? 'Review a team code before requesting membership' : 'Northfield Endurance')} · membership and data consent are separate.</p><Button disabled={api.mode === 'http' && !join.data?.id} onClick={() => c.run(() => api.joinTeam({
          teamId: join.data?.id || 'team'
        }), 'Membership request recorded. A team administrator reviews pending members.')}>Request team membership</Button><Feedback command={c} /></Panel>{data.items.map(t => <Panel title={`${t.name} · your consent`} key={t.id} meta={`Membership: ${t.ownRole}; scope ${t.scopeRevision}`}><Badge tone={t.consent.state === 'granted' ? 'success' : 'warning'}>{t.consent.state}</Badge><Notice>Audience: current and future team coaches and administrators. Team followers receive read access only. Excludes account identity, billing, provider credentials and unselected wellness fields.</Notice><SelectField label="Group data scope" value={level} onChange={e => setLevel(e.target.value)} options={[{
          value: 'read',
          label: 'Read eligible training data'
        }, {
          value: 'coach',
          label: 'Read and coach calendar'
        }]} /><label className="ds-check"><input type="checkbox" checked={sleep} onChange={e => setSleep(e.target.checked)} /> Also share sleep duration (optional)</label><div className="tw-actions">{['granted', 'declined', 'revoked'].map(decision => <Button key={decision} disabled={t.ownRole !== 'member'} variant={decision === 'revoked' ? 'danger' : 'secondary'} onClick={() => c.run(() => api.decideTeamConsent({
            teamId: t.id,
            decision,
            scopeRevision: t.scopeRevision,
            level,
            wellness: sleep ? ['sleep'] : []
          }), 'Group consent updated. Separate direct grants are unchanged.')}>{decision === 'granted' ? 'Accept disclosed scope' : decision === 'declined' ? 'Decline coaching scope' : 'Revoke group scope'}</Button>)}<Button variant="danger" onClick={() => c.run(() => api.updateMember({
            teamId: t.id,
            userId: actor,
            role: 'removed'
          }), 'You left the team. Group-derived access ended.')}>Leave team</Button></div>{t.ownRole !== 'member' && <p className="tw-muted">Staff roles cannot consent on behalf of athlete members.</p>}<Feedback command={c} /></Panel>)}</>}</QueryGate>;
}

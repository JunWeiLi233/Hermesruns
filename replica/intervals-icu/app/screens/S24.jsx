import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, DataTable, Feedback, Notice, Panel, QueryGate, SelectField, TextField } from '../ui/components.jsx';
export default function Team() {
  const {
      api
    } = useWorkspace(),
    q = useResource('getTeams'),
    c = useCommand();
  return <QueryGate query={q}>{data => <>{api.mode === 'http' && <Panel title="Create a team"><form onSubmit={e=>{e.preventDefault();const values=new FormData(e.currentTarget);c.run(()=>api.createTeam({name:values.get('name')}),'Team created. Share its join code; membership requires approval and data consent stays separate.');}}><TextField label="New team name" name="name" required maxLength={160}/><Button type="submit">Create team</Button></form><Feedback command={c}/></Panel>}{data.items.map(t => <Panel key={t.id} title={t.name} meta={`Your role: ${t.ownRole} · scope revision ${t.scopeRevision}`}><TextField label={`Join code for ${t.name}`} readOnly value={t.slug || t.id}/><Notice>Membership governs this team. It grants athlete data only after explicit current coaching consent.</Notice>{t.ownRole === 'admin' && <form onSubmit={e => {
          e.preventDefault();
          const p = Object.fromEntries(new FormData(e.currentTarget));
          c.run(() => api.updateTeam({
            teamId: t.id,
            revision: t.revision,
            name: p.name,
            coachingEnabled: p.coaching === 'on',
            posting: p.posting,
            visibility: p.visibility
          }), 'Team policy saved. Coaching scope changes require fresh consent.');
        }}><TextField label="Team display name" name="name" defaultValue={t.name} maxLength={160} required /><label className="ds-check"><input name="coaching" type="checkbox" defaultChecked={t.coachingEnabled} /> Enable group coaching, subject to each athlete’s consent</label><SelectField label="Posting permission" name="posting" defaultValue={t.posting} options={['members', 'staff']} /><SelectField label="Membership visibility" name="visibility" defaultValue={t.visibility} options={['members', 'staff']} /><Button type="submit" variant="primary">Save team policy</Button></form>}<DataTable caption="Team membership and roles" rows={t.members} columns={[{
          key: 'name',
          label: 'Member'
        }, {
          key: 'role',
          label: 'Role'
        }, {
          key: 'state',
          label: 'Membership'
        }, {
          key: 'change',
          label: 'Change role',
          render: m => t.ownRole === 'admin' && m.state !== 'removed' ? <div className="ds-stack">{m.state === 'pending' && <Button onClick={() => c.run(() => api.updateMember({ teamId: t.id, userId: m.userId, role: m.role }), 'Membership approved. Data consent remains separate.')}>Approve {m.name}</Button>}<SelectField label={`Role for ${m.name}`} value={m.role} onChange={e => c.run(() => api.updateMember({
            teamId: t.id,
            userId: m.userId,
            role: e.target.value
          }), 'Membership role updated.')} options={['member', 'follower', 'coach', 'admin', 'removed']} /></div> : <Badge>{m.role}</Badge>
        }]} /><Feedback command={c} /><p className="tw-muted">The last active administrator must appoint a successor before leaving or demotion.</p></Panel>)}</>}</QueryGate>;
}

import { useState } from 'react';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Badge, Button, Feedback, Modal, Notice, Panel, QueryGate, TextField } from '../ui/components.jsx';
export default function Privacy() {
  const {
      api
    } = useWorkspace(),
    q = useResource('getAccess'),
    me = useResource('getMe'),
    c = useCommand(), [confirmation,setConfirmation]=useState('');
  return <QueryGate query={q}>{data => <><Panel title="Your data, your grants"><Notice>Training and wellness are private without a current grant. Discoverability affects profile search only. Group and direct grants can coexist.</Notice><div className="tw-actions"><label className="ds-check"><input type="checkbox" checked={!!me.data?.discoverable} onChange={e => c.run(() => api.updateProfile({
              discoverable: e.target.checked,
              revision: me.data.revision
            }))} /> Allow sample profile discovery</label><label className="ds-check"><input type="checkbox" checked={me.data?.routePrivate !== false} onChange={e => c.run(() => api.updateProfile({
              routePrivate: e.target.checked,
              revision: me.data.revision
            }))} /> Keep precise route private</label></div><p className="tw-muted">Route geometry is not rendered in this build; production masking requires the backend data-access layer.</p><div className="tw-card-list">{data.items.map(r => <article className="tw-card" key={r.id}><strong>{r.granteeName}</strong><Badge>Direct · {r.level} · {r.state}</Badge><Button variant="danger" disabled={r.state === 'revoked'} onClick={() => c.run(() => api.decideAccess({
              relationshipId: r.id,
              decision: 'revoked'
            }), 'This direct grant was revoked.')}>Revoke direct grant for {r.granteeName}</Button></article>)}{data.groups.map(g => <article key={g.teamId} className="tw-card"><strong>{g.teamName}</strong><Badge>Group · {g.state} · scope {g.scopeRevision}</Badge></article>)}</div><Modal trigger="Review revoke all grants" title="Revoke every athlete-data grant?">{close => <><p>This ends accepted direct and group-derived access for your athlete data. Team membership and already-owned prescriptions remain.</p><Button variant="danger" onClick={async () => {
              if (await c.run(() => api.revokeAll(), 'All athlete-data grants revoked.')) close();
            }}>Revoke all athlete-data grants</Button></>}</Modal><Feedback command={c} /></Panel><Panel title="Account export and deletion"><p>Account export and deletion use the existing Hermes backend and its registered domain contributors.</p>{api.mode === 'http' ? <><a className="ds-button" href="/api/training/me/export">Download account export</a><Modal trigger="Review account deletion" title="Delete your account and owned data?" onOpen={()=>setConfirmation('')}>{close=><><p>This removes your account, owned activity and wellness records, grants, and new workspace records. Team ownership transfers to another administrator when possible. This action cannot be undone.</p><TextField label="Type DELETE to confirm" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/><Button variant="danger" disabled={confirmation!=='DELETE'} onClick={()=>c.run(async()=>{await api.deleteAccount({confirmation});close();},'Account deleted.')}>Delete my account</Button></>}</Modal></> : <Button disabled>Server account operations require server mode</Button>}</Panel></>}</QueryGate>;
}

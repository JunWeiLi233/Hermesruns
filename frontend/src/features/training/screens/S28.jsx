import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../contexts/I18nContext';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, Modal, Panel, QueryGate, TextField } from '../ui/components.jsx';
import { AccessAvatar, AccessCard, AccessFeedback, AccessSwitch } from './CoachAccessUi';

export default function Privacy({ hideAccountOperations = false }) {
  const { t } = useI18n();
  const s = (key, values) => t(`training_integration.coachAccess.${key}`, values);
  const { api } = useWorkspace();
  const q = useResource('getAccess');
  const me = useResource('getMe');
  const teams = useResource('getTeams');
  const c = useCommand();
  const [confirmation, setConfirmation] = useState('');
  const [confirming, setConfirming] = useState(false);
  const revokeTrigger = useRef(null);
  const cancelButton = useRef(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) cancelButton.current?.focus();
    else if (wasConfirming.current) revokeTrigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  const cancelRevoke = () => setConfirming(false);

  return <QueryGate query={q}>{data => <>
    <AccessCard title={s('yourData')}>
      <QueryGate query={me}>{profile => <div className="coach-access-privacy-toggles">
        <AccessSwitch label={s('discovery')} help={s('discoveryHelp')} checked={!!profile.discoverable} disabled={c.busy || me.refreshing} onChange={event => c.run(() => api.updateProfile({ discoverable: event.target.checked, revision: profile.revision }), s('privacySaved'))} />
        <AccessSwitch label={s('routePrivacy')} help={s('routePrivacyHelp')} checked={profile.routePrivate !== false} disabled={c.busy || me.refreshing} onChange={event => c.run(() => api.updateProfile({ routePrivate: event.target.checked, revision: profile.revision }), s('privacySaved'))} />
      </div>}</QueryGate>
      <QueryGate query={teams}>{teamData => {
        const direct = data.items.filter(r => r.state === 'accepted');
        const groups = data.groups.filter(g => g.state === 'granted' && teamData.items.some(team => team.id === g.teamId && team.ownRole === 'member' && team.coachingEnabled && team.scopeRevision === g.scopeRevision && team.consent.state === 'granted'));
        const count = direct.length + groups.length;
        return <div className="coach-access-grants">
          <div className="coach-access-grants-heading"><h4>{s('whoCanSee')}</h4><span>{s(count ? 'activeCount' : 'nobody', { count })}</span></div>
          {direct.map(r => <article className="coach-access-person-row" key={r.id}>
            <div className="coach-access-person"><AccessAvatar name={r.granteeName} /><div className="coach-access-copy"><strong>{r.granteeName}</strong><span>{s('directMeta', { level: s(r.level === 'coach' ? 'coachMeta' : 'followMeta') })}</span></div></div>
            <button type="button" className="coach-access-button coach-access-button-danger" disabled={c.busy} aria-label={s('revokeDirectName', { name: r.granteeName })} onClick={() => c.run(() => api.decideAccess({ relationshipId: r.id, decision: 'revoked' }), s('directRevoked'))}>{s('revoke')}</button>
          </article>)}
          {groups.map(g => <article className="coach-access-person-row" key={g.teamId}>
            <div className="coach-access-person"><AccessAvatar group name={g.teamName} /><div className="coach-access-copy"><strong>{g.teamName}</strong><span>{s('groupMeta', { revision: g.scopeRevision })}</span></div></div>
            <a className="coach-access-team-link" href="#coach-access-team-settings" onClick={() => {
              const settings = document.getElementById('coach-access-team-settings');
              if (settings) settings.open = true;
            }}>{s('managedInTeams')}</a>
          </article>)}
          {!count && <p className="coach-access-empty">{s('noGrants')}</p>}
        </div>;
      }}</QueryGate>
      <div className="coach-access-revoke-all" onKeyDown={event => { if (event.key === 'Escape' && confirming && !c.busy) cancelRevoke(); }}>
        {confirming ? <>
          <strong role="status">{s('revokeAllQuestion')}</strong>
          <div className="coach-access-row-actions"><button type="button" ref={cancelButton} className="coach-access-button coach-access-button-text" disabled={c.busy} onClick={cancelRevoke}>{s('cancel')}</button><button type="button" className="coach-access-button coach-access-button-accent" disabled={c.busy} onClick={async () => {
            const result = await c.run(() => api.revokeAll(), s('allRevoked'));
            if (result !== null) cancelRevoke();
          }}>{s('confirmRevokeAll')}</button></div>
        </> : <>
          <p>{s('revokeAllHelp')}</p>
          <button type="button" ref={revokeTrigger} className="coach-access-button coach-access-button-danger" disabled={c.busy} onClick={() => setConfirming(true)}>{s('revokeAll')}</button>
        </>}
      </div>
      <AccessFeedback command={c} />
    </AccessCard>
    {!hideAccountOperations && <Panel title="Account export and deletion"><p>Account export and deletion use the existing Hermes backend and its registered domain contributors.</p>{api.mode === 'http' ? <><a className="ds-button" href="/api/training/me/export">Download account export</a><Modal trigger="Review account deletion" title="Delete your account and owned data?" onOpen={() => setConfirmation('')}>{close => <><p>This removes your account, owned activity and wellness records, grants, and new workspace records. Team ownership transfers to another administrator when possible. This action cannot be undone.</p><TextField label="Type DELETE to confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} /><Button variant="danger" disabled={confirmation !== 'DELETE'} onClick={() => c.run(async () => { await api.deleteAccount({ confirmation }); close(); }, 'Account deleted.')}>Delete my account</Button></>}</Modal></> : <Button disabled>Server account operations require server mode</Button>}<Feedback command={c} /></Panel>}
  </>}</QueryGate>;
}

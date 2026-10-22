import { useId, useState } from 'react';
import { useI18n } from '../../../contexts/I18nContext';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { QueryGate } from '../ui/components.jsx';
import { AccessAvatar, AccessCard, AccessFeedback, AccessSwitch } from './CoachAccessUi';

export default function Access() {
  const { t } = useI18n();
  const s = (key, values) => t(`training_integration.coachAccess.${key}`, values);
  const { api, actor } = useWorkspace();
  const requests = useResource('getRequests');
  const profiles = useResource('searchAthletes');
  const requestCommand = useCommand();
  const relationshipCommand = useCommand();
  const [target, setTarget] = useState('');
  const [level, setLevel] = useState('read');
  const [sleep, setSleep] = useState(false);
  const [tab, setTab] = useState('received');
  const id = useId();
  const athletes = (profiles.data?.items || []).filter(p => p.id !== actor);
  const validTarget = athletes.some(p => p.id === target);
  const pending = (requests.data?.items || []).filter(r => r.subject === actor && r.state === 'pending').length;

  const decide = (relationship, decision) => relationshipCommand.run(() => api.decideAccess({
    relationshipId: relationship.id,
    decision,
    ...(decision === 'accepted' ? { wellness: sleep ? ['sleep'] : [] } : {}),
  }), s('relationshipUpdated'));

  return <>
    <AccessCard title={s('requestTitle')} className="coach-access-request">
      <p className="coach-access-subtitle">{s('requestHelp')}</p>
      <form onSubmit={async event => {
        event.preventDefault();
        if (!validTarget || requestCommand.busy) return;
        const result = await requestCommand.run(() => api.requestAccess({ athleteId: target, level }), s('requestSent'));
        if (result !== null) { setTarget(''); setTab('sent'); }
      }}>
        <label className="coach-access-field" htmlFor={`${id}-athlete`}>
          <span>{s('athlete')}</span>
          <select id={`${id}-athlete`} value={target} disabled={profiles.loading || !!profiles.error || requestCommand.busy} onChange={event => setTarget(event.target.value)}>
            <option value="">{s(profiles.loading ? 'loadingAthletes' : 'chooseAthlete')}</option>
            {athletes.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
        </label>
        {profiles.error && <p className="coach-access-error" role="alert">{s('athletesUnavailable')}</p>}
        {!profiles.loading && !profiles.error && !athletes.length && <p className="coach-access-hint">{s('noAthletes')}</p>}
        <fieldset className="coach-access-levels">
          <legend>{s('access')}</legend>
          <div>{['read', 'coach'].map(value => <label className="coach-access-level" key={value}>
            <input type="radio" name={`${id}-level`} aria-label={s(value === 'read' ? 'follow' : 'coach')} aria-describedby={`${id}-${value}-help`} value={value} checked={level === value} disabled={requestCommand.busy} onChange={() => setLevel(value)} />
            <span className="coach-access-copy"><strong>{s(value === 'read' ? 'follow' : 'coach')}</strong><span id={`${id}-${value}-help`}>{s(`${value}Help`)}</span></span>
          </label>)}</div>
        </fieldset>
        <div className="coach-access-request-footer">
          <AccessFeedback command={requestCommand} />
          <button className="coach-access-button coach-access-button-accent" type="submit" disabled={!validTarget || requestCommand.busy}>{s('requestAccess')}</button>
        </div>
      </form>
    </AccessCard>

    <AccessCard title={s('relationships')} tools={<div className="coach-access-tabs" role="tablist" aria-label={s('relationships')}>
      {['received', 'sent'].map(value => <button type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-relationships`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} key={value} onClick={() => setTab(value)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'received' : event.key === 'End' ? 'sent' : tab === 'received' ? 'sent' : 'received';
        setTab(next);
        document.getElementById(`${id}-${next}`)?.focus();
      }}>{s(value)}{' '}{value === 'received' && pending > 0 && <span className="coach-access-count">{pending}</span>}</button>)}
    </div>}>
      <div id={`${id}-relationships`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === 'received' && <AccessSwitch muted label={s('sleepLabel')} help={s('sleepHelp')} checked={sleep} disabled={relationshipCommand.busy} onChange={event => setSleep(event.target.checked)} />}
        <QueryGate query={requests}>{data => {
          const relationships = data.items.filter(r => tab === 'received' ? r.subject === actor : r.grantee === actor);
          return <div className="coach-access-relationships">
            {relationships.map(r => {
              const received = r.subject === actor;
              const name = received ? r.granteeName : r.subjectName;
              return <article className="coach-access-person-row" key={r.id}>
                <div className="coach-access-person"><AccessAvatar name={name} /><div className="coach-access-copy">
                  <strong>{s(received ? 'receivedTitle' : 'sentTitle', { name })}</strong>
                  <span className="coach-access-meta"><span>{s(r.level === 'coach' ? 'coachMeta' : 'followMeta')}</span><span className={`coach-access-status coach-access-status-${r.state}`}>{s(`state_${r.state}`)}</span></span>
                </div></div>
                {received && <div className="coach-access-row-actions">
                  {r.state === 'pending' && <>
                    <button type="button" className="coach-access-button" disabled={relationshipCommand.busy} aria-label={s('declineName', { name })} onClick={() => decide(r, 'declined')}>{s('decline')}</button>
                    <button type="button" className="coach-access-button coach-access-button-ink" disabled={relationshipCommand.busy} aria-label={s('acceptName', { name })} onClick={() => decide(r, 'accepted')}>{s('accept')}</button>
                  </>}
                  {r.state === 'accepted' && <button type="button" className="coach-access-button coach-access-button-danger" disabled={relationshipCommand.busy} aria-label={s('revokeName', { name })} onClick={() => decide(r, 'revoked')}>{s('revoke')}</button>}
                </div>}
              </article>;
            })}
            {!relationships.length && <p className="coach-access-empty">{s(tab === 'received' ? 'noReceived' : 'noSent')}</p>}
          </div>;
        }}</QueryGate>
        <AccessFeedback command={relationshipCommand} />
      </div>
      <p className="coach-access-footnote">{s('teamConsentHelp')}</p>
    </AccessCard>
  </>;
}

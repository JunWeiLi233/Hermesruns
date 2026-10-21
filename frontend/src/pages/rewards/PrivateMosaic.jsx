import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

const SYMBOLS = ['sun', 'leaf', 'star', 'wave'];
const MARKS = { sun: '☀', leaf: '❧', star: '☆', wave: '≈' };

export default function PrivateMosaic({ data, text, disabled, onCommand, commit }) {
  const [token, setToken] = useState('');
  // Keep only this account's in-page choices across removal of the group UI.
  // Never retain deleted server snapshots or invitation bearer tokens here.
  const [draftsByGroup, setDraftsByGroup] = useState({});
  const [recipients, setRecipients] = useState({});
  const [removedIds, setRemovedIds] = useState([]);
  const heading = useRef(null);
  const id = useId();
  useLayoutEffect(() => {
    if (commit?.removedKind === 'group') {
      setRemovedIds(current => current.includes(commit.result.id) ? current : [...current, commit.result.id]);
    } else if (commit?.scope.startsWith('tile:')) {
      const [, groupId, index] = commit.scope.split(':');
      setDraftsByGroup(current => {
        const next = { ...current[groupId] }; delete next[index];
        return { ...current, [groupId]: next };
      });
    }
    if (commit?.removedKind === 'group' || ['accept', 'decline', 'group-create', 'group-remove'].includes(commit?.scope)) {
      setToken(''); heading.current?.focus();
    }
  }, [commit]);
  return <div><h3 ref={heading} tabIndex={-1}>{text('mosaic_title')}</h3>
    <p>{text('mosaic_intro')}</p><p>{text('mosaic_privacy')}</p>
    <p>{text('account_id', { id: data.accountId })}</p><p className="entertainment-note">{text('invite_policy')}</p>
    {data.groups.length === 0 && <button type="button" disabled={disabled} onClick={() => onCommand({ path: '/groups', scope: 'group-create', matches: result => Boolean(result?.id && result?.members?.some(member => member.accountId === data.accountId)) })}>{text('mosaic_create')}</button>}
    <fieldset disabled={disabled}><legend>{text('invite_received')}</legend>
      <label htmlFor={`${id}-token`}>{text('invite_token')}</label>
      <input id={`${id}-token`} type="password" autoComplete="off" spellCheck={false} value={token} onChange={event => setToken(event.target.value)} />
      <div className="entertainment-actions">{['accept', 'decline'].map(action => <button key={action} type="button" disabled={disabled || !token.trim()} onClick={() => onCommand({
        path: `/invites/${action}`, body: { token: token.trim() }, scope: action,
        matches: result => action === 'decline' ? result?.declined === true : Boolean(result?.members?.some(member => member.accountId === data.accountId)),
      })}>{text(`invite_${action}`)}</button>)}
        <button type="button" disabled={disabled || !token} onClick={() => setToken('')}>{text('invite_clear')}</button>
      </div>
    </fieldset>
    {removedIds.filter(groupId => Object.keys(draftsByGroup[groupId] || {}).length || recipients[groupId]).map(groupId => <div key={groupId} className="entertainment-conflict">
      <h4 tabIndex={-1}>{text(Object.keys(draftsByGroup[groupId] || {}).length ? 'tile_retained_title' : 'invite_retained_title')}</h4>
      <p>{text('mosaic_draft_removed')}</p>
      <ul>{Object.entries(draftsByGroup[groupId] || {}).map(([index, draft]) => <li key={index}>{text('tile_retained_choice', { number: Number(index) + 1, symbol: text(draft.symbol || 'symbol_empty') })}</li>)}</ul>
      {recipients[groupId] && <p>{text('invite_retained_recipient', { id: recipients[groupId] })}</p>}
      <div className="entertainment-actions">
        <button type="button" disabled={disabled} onClick={event => event.currentTarget.closest('div.entertainment-conflict').querySelector('h4').focus()}>{text(Object.keys(draftsByGroup[groupId] || {}).length ? 'tile_keep_draft' : 'invite_keep_draft')}</button>
        <button type="button" disabled={disabled} onClick={() => {
          setDraftsByGroup(current => { const next = { ...current }; delete next[groupId]; return next; });
          setRecipients(current => { const next = { ...current }; delete next[groupId]; return next; });
          setRemovedIds(current => current.filter(id => id !== groupId)); heading.current?.focus();
        }}>{text(Object.keys(draftsByGroup[groupId] || {}).length ? 'tile_discard_draft' : 'invite_discard_draft')}</button>
      </div>
    </div>)}
    {data.groups.map(group => <MosaicGroup key={group.id} group={group} accountId={data.accountId} text={text} disabled={disabled} onCommand={onCommand} commit={commit}
      drafts={draftsByGroup[group.id] || {}} setDrafts={next => setDraftsByGroup(current => ({ ...current, [group.id]: next }))}
      recipient={recipients[group.id] || ''} setRecipient={next => setRecipients(current => ({ ...current, [group.id]: next }))} />)}
  </div>;
}

function MosaicGroup({ group, accountId, text, disabled, onCommand, commit, drafts, setDrafts, recipient, setRecipient }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const id = useId();
  const recipientInput = useRef(null);
  const tokenInput = useRef(null);
  const inviteButton = useRef(null);
  const confirmButton = useRef(null);
  const owner = group.ownerAccountId === accountId;
  const conflict = Object.values(drafts).some(draft => draft.version !== group.version);
  useEffect(() => {
    if (commit?.scope === 'invite' && commit.recovered && commit.result?.group?.id === group.id) {
      setInviteOpen(true); setInviteResult(commit.result);
    }
  }, [commit, group.id]);
  useEffect(() => { if (inviteOpen) recipientInput.current?.focus(); }, [inviteOpen]);
  useEffect(() => { if (confirm) confirmButton.current?.focus(); }, [confirm]);
  function closeInvite() {
    setInviteOpen(false); setRecipient(''); setInviteResult(null); setCopyStatus(null); inviteButton.current?.focus();
  }
  return <article className="entertainment-mosaic" aria-label={text('mosaic_group')}>
    <p>{text('members_count', { count: group.members.length })}</p>
    <ul>{group.members.map(member => <li key={member.accountId}>{text('member_id', { id: member.accountId })}{member.accountId === accountId ? ` (${text('you')})` : ''}</li>)}</ul>
    <p aria-live="polite">{text(group.complete ? 'mosaic_complete' : 'mosaic_incomplete')}</p>
    <div className="entertainment-tiles">{group.slots.map(slot => <fieldset disabled={disabled} key={slot.index}>
      <legend>{text('tile_number', { number: slot.index + 1 })}</legend>
      <div className="entertainment-symbol" aria-hidden="true">{MARKS[slot.symbol] || '·'}</div>
      <p>{text('tile_saved', { symbol: text(slot.symbol || 'symbol_empty') })}</p>
      <label htmlFor={`${id}-tile-${slot.index}`}>{text('tile_symbol')}</label>
      <select id={`${id}-tile-${slot.index}`} value={drafts[slot.index]?.symbol ?? slot.symbol ?? ''} onChange={event => setDrafts({ ...drafts, [slot.index]: { symbol: event.target.value, version: group.version } })}>
        <option value="">{text('symbol_empty')}</option>{SYMBOLS.map(symbol => <option key={symbol} value={symbol}>{text(symbol)}</option>)}
      </select>
      {drafts[slot.index] && <p>{text('tile_draft')}</p>}
      <button type="button" disabled={disabled || conflict} onClick={() => onCommand({
        path: `/groups/${group.id}/slots/${slot.index}`, method: 'PUT', scope: `tile:${group.id}:${slot.index}`,
        body: { expectedVersion: drafts[slot.index]?.version ?? group.version, symbol: (drafts[slot.index]?.symbol ?? slot.symbol) || null },
        matches: result => result?.id === group.id && result?.slots?.[slot.index]?.symbol === ((drafts[slot.index]?.symbol ?? slot.symbol) || null),
      })}>{text('tile_save')}</button>
    </fieldset>)}</div>
    {conflict && <div className="entertainment-conflict" role="status"><p>{text('tile_conflict')}</p>
      <button type="button" disabled={disabled} onClick={() => setDrafts(Object.fromEntries(Object.entries(drafts).map(([index, draft]) => [index, { ...draft, version: group.version }])))}>{text('tile_rebase')}</button></div>}
    {owner && <>
      <button type="button" ref={inviteButton} disabled={disabled || group.members.length >= 4 || inviteOpen} onClick={() => setInviteOpen(true)}>{text('invite_open')}</button>
      {inviteOpen && <fieldset className="entertainment-invite"><legend>{text('invite_create_title')}</legend>
        <label htmlFor={`${id}-recipient`}>{text('invite_recipient')}</label>
        <input ref={recipientInput} id={`${id}-recipient`} inputMode="numeric" autoComplete="off" value={recipient} disabled={disabled} onChange={event => setRecipient(event.target.value)} />
        <p>{text('invite_recipient_hint')}</p>
        <button type="button" disabled={disabled || !/^\d+$/.test(recipient.trim()) || Boolean(inviteResult)} onClick={async () => {
          const result = await onCommand({ path: `/groups/${group.id}/invites`, scope: 'invite', body: { expectedVersion: group.version, recipientAccountId: recipient.trim() },
            matches: result => Boolean(result?.inviteId && result?.group?.id === group.id) });
          if (result) { setInviteResult(result); setCopyStatus(null); }
        }}>{text('invite_create')}</button>
        {inviteResult && <>
          {inviteResult.token ? <><label htmlFor={`${id}-created-token`}>{text('invite_private_token')}</label>
            <input ref={tokenInput} id={`${id}-created-token`} type="password" readOnly autoComplete="off" value={inviteResult.token} />
            <p>{text('invite_secret_hint')}</p>
            <button type="button" onClick={async () => {
              try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
                await navigator.clipboard.writeText(inviteResult.token); setCopyStatus('invite_copied');
              } catch { setCopyStatus('invite_copy_failed'); tokenInput.current?.focus(); tokenInput.current?.select(); }
            }}>{text('invite_copy')}</button>
            {copyStatus && <p role="status">{text(copyStatus)}</p>}
          </> : <p role="status">{text('invite_lost_token')}</p>}
          <p>{text('invite_expires', { date: inviteResult.expiresAt })}</p>
        </>}
        <button type="button" disabled={disabled} onClick={closeInvite}>{text('invite_close')}</button>
      </fieldset>}
      {group.invites.length > 0 && <ul className="entertainment-invite-list">{group.invites.map(invite => <li key={invite.id}>
        <p>{text('invite_to', { id: invite.recipientAccountId })}</p><p>{text(`invite_status_${String(invite.status).toLowerCase()}`)}</p>
        <p>{text('invite_expires', { date: invite.expiresAt })}</p>
        {String(invite.status).toLowerCase() === 'pending' && <button type="button" disabled={disabled} onClick={() => onCommand({
          path: `/groups/${group.id}/invites/${invite.id}/revoke`, scope: 'revoke', body: { expectedVersion: group.version },
          matches: result => result?.id === group.id && result.invites?.some(row => row.id === invite.id && String(row.status).toLowerCase() === 'revoked'),
        })}>{text('invite_revoke')}</button>}
      </li>)}</ul>}
    </>}
    <p className="entertainment-note">{text(owner ? 'mosaic_delete_hint' : 'mosaic_leave_hint')}</p>
    <button type="button" disabled={disabled || confirm} onClick={() => setConfirm(true)}>{text(owner ? 'mosaic_delete' : 'mosaic_leave')}</button>
    {confirm && <fieldset><legend>{text(owner ? 'mosaic_delete_question' : 'mosaic_leave_question')}</legend><div className="entertainment-actions">
      <button type="button" ref={confirmButton} disabled={disabled} onClick={() => onCommand({
        path: `/groups/${group.id}${owner ? '' : '/leave'}`, method: owner ? 'DELETE' : 'POST', scope: 'group-remove', body: { expectedVersion: group.version },
        matches: result => result?.id === group.id && (owner ? result.deleted === true : result.left === true),
      })}>{text(owner ? 'mosaic_delete_confirm' : 'mosaic_leave_confirm')}</button>
      <button type="button" disabled={disabled} onClick={() => setConfirm(false)}>{text('keep')}</button>
    </div></fieldset>}
  </article>;
}

import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../../contexts/I18nContext';
import AppIcon from '../../../components/AppIcon';
import { ShieldCheck } from 'lucide-react';
import { useWorkspace, useResource, useCommand } from '../ui/workspace.jsx';
import { QueryGate } from '../ui/components.jsx';
import { TeamAvatar, TeamFeedback } from './TeamUi';

function TeamSettings({ team, copy, command }) {
  const { api } = useWorkspace();
  const [form, setForm] = useState({ name: team.name, coachingEnabled: team.coachingEnabled, posting: team.posting, visibility: team.visibility });
  const dirty = Object.keys(form).some(key => form[key] !== team[key]);
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  return <form className="team-settings-card team-card" onSubmit={event => {
    event.preventDefault();
    if (!dirty || !form.name.trim() || command.busy) return;
    command.run(() => api.updateTeam({ teamId: team.id, revision: team.revision, ...form, name: form.name.trim() }), copy('saved'));
  }}>
    <h3>{copy('settings')}</h3>
    <label className="team-field"><span>{copy('displayName')}</span><input value={form.name} onChange={event => set('name', event.target.value)} maxLength={160} required /></label>
    <label className="team-coaching-toggle"><span><strong>{copy('coaching')}</strong><small>{copy('coachingHelp')}</small></span><input type="checkbox" role="switch" checked={form.coachingEnabled} onChange={event => set('coachingEnabled', event.target.checked)} /><span className="team-switch-track" aria-hidden="true" /></label>
    {['posting', 'visibility'].map(policy => <fieldset className="team-policy" key={policy}>
      <legend>{copy(policy)}</legend>
      <div className="team-segmented">{['members', 'staff'].map(value => <label key={value}>
        <input type="radio" name={`${team.id}-${policy}`} value={value} checked={form[policy] === value} onChange={() => set(policy, value)} />
        <span>{copy(`policy_${value}`)}</span>
      </label>)}</div>
    </fieldset>)}
    <div className="team-settings-actions"><button className="team-button team-button-accent" type="submit" disabled={!dirty || !form.name.trim() || command.busy}>{copy(command.busy ? 'saving' : 'save')}</button></div>
  </form>;
}

function TeamCard({ team, copy, command, creating, onCreate }) {
  const { api, actor } = useWorkspace();
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const headingId = useId();
  const admin = team.ownRole === 'admin';
  const members = team.members.filter(member => member.state !== 'removed');
  const active = members.filter(member => member.state === 'active');
  const pending = members.filter(member => member.state === 'pending');
  const staff = active.filter(member => ['admin', 'coach'].includes(member.role));
  const admins = active.filter(member => member.role === 'admin');
  const filtered = filter === 'pending' ? pending : filter === 'staff' ? staff : members;
  const changeMember = (member, role, message) => command.run(() => api.updateMember({ teamId: team.id, userId: member.userId, role }), copy(message));
  return <section className="team-management-grid" aria-labelledby={headingId}>
    <div className="team-members-column">
      <article className="team-summary-card team-card">
        <TeamAvatar name={team.name} club />
        <div className="team-summary-copy"><h2 id={headingId}>{team.name}</h2><p>{copy(team.visibility === 'staff' && !['admin', 'coach'].includes(team.ownRole) ? 'visibleCount' : 'memberCount', { count: active.length })} · {copy('role', { role: copy(`role_${team.ownRole}`) })} · {copy(team.coachingEnabled ? 'coachingOn' : 'coachingOff')}</p></div>
        <div className="team-join-code"><span>{copy('joinCode')}</span><div><code>{team.slug || team.id}</code><button type="button" aria-label={copy('code', { name: team.name })} onClick={async () => {
          try { await navigator.clipboard.writeText(team.slug || team.id); setCopied(true); setCopyError(false); }
          catch { setCopyError(true); }
        }}>{copy(copied ? 'copied' : 'copy')}</button></div><span role="status">{copyError ? copy('copyError') : copied ? copy('copied') : ''}</span></div>
      </article>
      <article className="team-members-card team-card">
        <header className="team-members-heading"><h3>{copy('members')}</h3><div className="team-segmented team-member-filters" role="group" aria-label={copy('filterMembers')}>
          {[['all', members.length], ['pending', pending.length], ['staff', staff.length]].map(([key, count]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{copy(key)} <span>{count}</span></button>)}
        </div></header>
        <ul className="team-member-list">{filtered.map(member => {
          const isPending = member.state === 'pending';
          const fixedAdmin = member.state === 'active' && member.role === 'admin' && admins.length === 1;
          return <li key={member.userId} className={isPending ? 'is-pending' : ''}>
            <div className="team-person"><TeamAvatar name={member.name} muted={isPending} coach={member.role === 'coach'} /><div><strong>{member.name}{member.userId === actor && <span> {copy('you')}</span>}</strong><small>{isPending ? copy('requestedRole', { role: copy(`role_${member.role}`) }) : copy(`role_${member.role}`)}</small></div></div>
            <div className="team-member-actions">{admin && isPending ? <>
              <button type="button" className="team-button" aria-label={copy('declineName', { name: member.name })} disabled={command.busy} onClick={() => changeMember(member, 'removed', 'declined')}>{copy('decline')}</button>
              <button type="button" className="team-button team-button-ink" aria-label={copy('approve', { name: member.name })} disabled={command.busy} onClick={() => changeMember(member, member.role, 'approved')}>{copy('approveShort')}</button>
            </> : admin && !fixedAdmin ? <select aria-label={copy('roleFor', { name: member.name })} value={member.role} disabled={command.busy} onChange={event => changeMember(member, event.target.value, 'roleUpdated')}>
              {['member', 'follower', 'coach', 'admin', 'removed'].map(role => <option value={role} key={role}>{copy(role === 'removed' ? 'remove' : `role_${role}`)}</option>)}
            </select> : <span className="team-role-badge">{copy(isPending ? 'state_pending' : `role_${member.role}`)}</span>}</div>
          </li>;
        })}</ul>
        {!filtered.length && <p className="team-empty-filter">{copy('noMembers')}</p>}
        <p className="team-member-footer">{copy('successor')}</p>
      </article>
    </div>
    <aside className="team-settings-column">
      {admin && <TeamSettings key={`${team.id}:${team.revision}`} team={team} copy={copy} command={command} />}
      <div className="team-consent-note"><ShieldCheck aria-hidden="true" /><p>{copy('consent')}</p></div>
      {onCreate && <button type="button" className="team-create-toggle" aria-expanded={creating} onClick={onCreate}>{copy(creating ? 'cancel' : 'createAnother')}</button>}
    </aside>
  </section>;
}

function TeamCollection({ query }) {
  const { t } = useI18n();
  const copy = (key, values) => t(`training_integration.teamManagement.${key}`, values);
  const { api } = useWorkspace();
  const command = useCommand();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  return <><QueryGate query={query}>{data => <div className="team-management">
    {data.items.map((team, index) => <TeamCard key={team.id} team={team} copy={copy} command={command} creating={creating} onCreate={api.mode === 'http' && index === 0 ? () => setCreating(!creating) : undefined} />)}
    {!data.items.length && <section className="team-no-membership team-card"><AppIcon name="groups" aria-hidden="true" /><h2>{t('training_integration.teamPage.emptyTitle')}</h2><p>{t('training_integration.teamPage.emptyCopy')}</p><div className="team-empty-actions">
      {api.mode === 'http' && <button className="team-button team-button-accent" type="button" onClick={() => setCreating(true)}>{copy('createTitle')}</button>}
      <Link className="team-button" to="/settings?section=account#coach-access-team-settings">{t('training_integration.teamPage.join')}</Link>
    </div></section>}
    {api.mode === 'http' && <div className="team-create-area">
      {creating && <form className="team-create-form team-card" onSubmit={async event => {
        event.preventDefault();
        if (!name.trim() || command.busy) return;
        const result = await command.run(() => api.createTeam({ name: name.trim() }), copy('created'));
        if (result) { setName(''); setCreating(false); }
      }}><label className="team-field"><span>{copy('name')}</span><input value={name} onChange={event => setName(event.target.value)} maxLength={160} required /></label><button type="button" className="team-button" disabled={command.busy} onClick={() => setCreating(false)}>{copy('cancel')}</button><button className="team-button team-button-accent" type="submit" disabled={!name.trim() || command.busy}>{copy(command.busy ? 'saving' : 'create')}</button><p>{copy('createHelp')}</p></form>}
    </div>}
  </div>}</QueryGate><TeamFeedback command={command} /></>;
}

function LoadedTeams() {
  const query = useResource('getTeams');
  return <TeamCollection query={query} />;
}

export default function Team({ teamsQuery }) {
  return teamsQuery ? <TeamCollection query={teamsQuery} /> : <LoadedTeams />;
}

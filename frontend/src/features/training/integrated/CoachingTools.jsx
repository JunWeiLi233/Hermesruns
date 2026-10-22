import { useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../../contexts/I18nContext';
import { useTheme } from '../../../contexts/ThemeContext';
import AppIcon from '../../../components/AppIcon';
import { useCommand, useResource, useWorkspace } from '../ui/workspace';
import { QueryGate } from '../ui/components';
import { TeamAvatar, TeamFeedback } from '../screens/TeamUi';
import { useNavigate } from 'react-router';
import Messages from '../screens/S23';
import Team from '../screens/S24';
import './integrationTools.css';

function Athletes() {
  const { t } = useI18n();
  const { api, actor, setAthlete } = useWorkspace();
  const navigate = useNavigate();
  const command = useCommand();
  const roster = useResource('getRoster');
  const [search, setSearch] = useState('');
  return <section className="team-athletes-card team-card">
    <header className="team-athletes-heading"><h2>{t('training_integration.athletes')}</h2>
      <label className="team-athlete-search"><AppIcon name="search" aria-hidden="true" /><span className="team-sr-only">{t('training_integration.findAthlete')}</span><input type="search" placeholder={t('training_integration.findAthlete')} value={search} onChange={event => setSearch(event.target.value)} /></label>
    </header>
    <QueryGate query={roster}>{data => {
      const athletes = data.items.filter(athlete => athlete.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
      return <ul className="team-athlete-list">{athletes.map(athlete => <li key={athlete.id}>
        <div className="team-person"><TeamAvatar name={athlete.name} coach={athlete.access === 'coach'} /><strong>{athlete.name}</strong></div>
        <span className={`team-access-badge access-${athlete.access}`}><i aria-hidden="true" />{t(`training_integration.access_${athlete.access}`)}</span>
        <div className="team-athlete-actions">{athlete.access !== 'none' ? <>
          {api.mode === 'http' && athlete.id !== actor && <button className="team-button team-message-athlete" type="button" disabled={command.busy} aria-label={t('training_integration.teamMessages.messageName', { name: athlete.name })} onClick={() => command.run(async () => {
            const thread = await api.openConversation({ kind: 'direct', peerId: athlete.id });
            navigate(`/profile/team?view=messages&conversation=${encodeURIComponent(thread.id)}`);
          }, t('training_integration.teamMessages.opened'))}><AppIcon name="chat_bubble_outline" aria-hidden="true" /></button>}
          <Link className="team-button team-button-ink" aria-label={`${t('training_integration.openCalendar')} ${athlete.name}`} to={`/schedule?athlete=${encodeURIComponent(athlete.id)}`} onClick={() => setAthlete(athlete.id)}>{t('training_integration.openCalendar')}</Link>
        </> : <span className="team-consent-required">{t('training_integration.consentRequired')}</span>}</div>
      </li>)}{!athletes.length && <li>{t('training_integration.noAthletes')}</li>}</ul>;
    }}</QueryGate>
    <TeamFeedback command={command} />
    <p className="team-athlete-footer">{t('training_integration.coachDirectoryUnavailable')}</p>
  </section>;
}

/** Team owns the surrounding page and section navigation. */
export default function CoachingTools({ view = 'athletes', teamsQuery }) {
  const { isDark } = useTheme();
  return <div className="icu-design training-app hermes-training-integrated" data-theme={isDark ? 'dark' : 'light'}>
    {view === 'messages' ? <Messages /> : view === 'team' ? <Team teamsQuery={teamsQuery} /> : <Athletes />}
  </div>;
}

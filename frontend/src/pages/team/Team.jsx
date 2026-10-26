import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import { ShieldCheck } from 'lucide-react';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import TrainingDataProvider from '../../features/training/integrated/TrainingDataProvider';
import CoachingTools from '../../features/training/integrated/CoachingTools';
import { useResource } from '../../features/training/ui/workspace';
import { teamSection, teamSections } from './teamSections';
import './team.css';

function TeamWorkspace({ params, view }) {
  const { t } = useI18n();
  const teams = useResource('getTeams');
  const pending = teams.data?.items.reduce((count, team) => count + (team.ownRole === 'admin'
    ? team.members.filter(member => member.state === 'pending').length : 0), 0);
  return <>
    <nav className="team-section-grid" aria-label={t('training_integration.teamPage.navigation')}>
      {teamSections.map(section => {
        const next = new URLSearchParams(params);
        next.set('view', section.key);
        return <Link key={section.key} to={`?${next}`} className={`team-section-link${view === section.key ? ' is-active' : ''}`} aria-current={view === section.key ? 'page' : undefined}>
          {t(`training_integration.${section.key}`)}
          {section.key === 'team' && pending > 0 && <span className="team-section-count" aria-label={t('training_integration.teamManagement.pendingCount', { count: pending })}>{pending}</span>}
        </Link>;
      })}
    </nav>
    <section className="team-workspace" aria-label={t(`training_integration.${view}`)}>
      <CoachingTools view={view} teamsQuery={teams} />
    </section>
  </>;
}

export default function Team() {
  const { t } = useI18n();
  const title = t('training_integration.team');
  useEffect(() => { document.title = `${title} | HermesRuns`; }, [title]);
  const [params] = useSearchParams();
  const view = teamSection(params.get('view'));
  return <AuthenticatedPageChrome title={title} activeKey="dashboard" bodyClassName="team-page-shell" breadcrumbLabel={t('training_integration.teamPage.profile')}>
    <div className="team-page">
      <header className="team-page-heading">
        <div>
          <h1>{title}</h1>
          <p>{t('training_integration.teamPage.intro')}</p>
        </div>
        <Link className="team-access-link" to="/settings?section=account">
          <ShieldCheck aria-hidden="true" />{t('training_integration.teamPage.access')}
        </Link>
      </header>
      <TrainingDataProvider selfOnly><TeamWorkspace params={params} view={view} /></TrainingDataProvider>
      <p className="team-privacy-note">{t('training_integration.teamPage.privacy')}</p>
    </div>
  </AuthenticatedPageChrome>;
}

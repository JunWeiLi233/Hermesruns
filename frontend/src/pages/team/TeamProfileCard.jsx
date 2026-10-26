import { Link } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import AppIcon from '../../components/AppIcon';
import { preloadRoute } from '../../utils/routePreload';
import { teamSections } from './teamSections';
import './team-profile-card.css';

export default function TeamProfileCard() {
  const { t } = useI18n();
  const preload = () => preloadRoute('/profile/team');
  return <section className="hd-team-card" aria-labelledby="profile-team-title">
    <div className="hd-team-head">
      <span className="hd-team-emblem"><AppIcon name="groups" aria-hidden="true" /></span>
      <div className="hd-team-copy">
        <span className="hd-card-kicker">{t('training_integration.teamPage.kicker')}</span>
        <h2 id="profile-team-title" className="hd-card-title">{t('training_integration.teamPage.cardTitle')}</h2>
        <p>{t('training_integration.teamPage.cardCopy')}</p>
      </div>
      <Link className="hd-team-open" to="/profile/team" onPointerEnter={preload} onFocus={preload}>
        {t('training_integration.teamPage.open')}<AppIcon name="arrow_forward" aria-hidden="true" />
      </Link>
    </div>
    <div className="hd-team-shortcuts">
      {teamSections.map(section => <Link key={section.key} to={`/profile/team?view=${section.key}`} onPointerEnter={preload} onFocus={preload}>
        <AppIcon name={section.icon} aria-hidden="true" />
        <span>{t(`training_integration.${section.key}`)}</span>
        <AppIcon name="arrow_forward" className="hd-team-shortcut-arrow" aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}

import { useI18n } from '../../../contexts/I18nContext';

export function TeamAvatar({ name = '', club = false, muted = false, coach = false }) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const initials = (words.length > 1 ? `${words[0][0]}${words[club ? 1 : words.length - 1][0]}` : name.slice(0, 2)).toLocaleUpperCase();
  return <span className={`team-avatar${club ? ' is-club' : ''}${muted ? ' is-muted' : ''}${coach ? ' is-coach' : ''}`} aria-hidden="true">{initials}</span>;
}

export function TeamFeedback({ command }) {
  const { t } = useI18n();
  return <>{command.busy && <span className="team-sr-only" role="status">{t('training_integration.teamManagement.saving')}</span>}{command.error && <p className="team-feedback is-error" role="alert">{command.error}</p>}{command.message && <p className="team-feedback" role="status">{command.message}</p>}</>;
}

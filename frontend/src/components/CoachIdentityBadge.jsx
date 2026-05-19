import { getCoachRoleLabel } from '../utils/coachIdentity';
import defaultCoachAvatar from '../assets/generated/coach-identity-avatar-default.webp';

export default function CoachIdentityBadge({ coach, lang, className = '' }) {
  if (!coach) return null;
  const fallbackAvatarSrc = coach.fallbackAvatarUrl || defaultCoachAvatar;

  return (
    <div className={`coach-identity-badge${className ? ` ${className}` : ''}`}>
      {coach.avatarUrl ? (
        <img className="coach-identity-avatar" src={coach.avatarUrl} alt={coach.name} decoding="async" />
      ) : (
        <img className="coach-identity-avatar coach-identity-avatar--fallback" src={fallbackAvatarSrc} alt={coach.name || 'Hermes Coach'} decoding="async" />
      )}
      <div className="coach-identity-copy">
        <strong>{coach.name}</strong>
        <span>{getCoachRoleLabel(coach, lang)}</span>
      </div>
    </div>
  );
}

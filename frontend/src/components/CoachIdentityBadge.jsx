import { getCoachRoleLabel } from '../utils/coachIdentity';

export default function CoachIdentityBadge({ coach, lang, className = '' }) {
  if (!coach) return null;
  const initials = String(coach.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    || 'H';

  return (
    <div className={`coach-identity-badge${className ? ` ${className}` : ''}`}>
      {coach.avatarUrl ? (
        <img className="coach-identity-avatar" src={coach.avatarUrl} alt={coach.name} />
      ) : (
        <div className="coach-identity-avatar coach-identity-avatar--fallback" aria-hidden="true">{initials}</div>
      )}
      <div className="coach-identity-copy">
        <strong>{coach.name}</strong>
        <span>{getCoachRoleLabel(coach, lang)}</span>
      </div>
    </div>
  );
}

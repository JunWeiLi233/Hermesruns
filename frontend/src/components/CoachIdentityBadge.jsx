import { getCoachRoleLabel } from '../utils/coachIdentity';

export default function CoachIdentityBadge({ coach, lang, className = '' }) {
  if (!coach) return null;

  return (
    <div className={`coach-identity-badge${className ? ` ${className}` : ''}`}>
      <img className="coach-identity-avatar" src={coach.avatarUrl} alt={coach.name} />
      <div className="coach-identity-copy">
        <strong>{coach.name}</strong>
        <span>{getCoachRoleLabel(coach, lang)}</span>
      </div>
    </div>
  );
}

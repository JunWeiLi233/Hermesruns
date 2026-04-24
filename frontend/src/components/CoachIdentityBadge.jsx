import { getCoachRoleLabel } from '../utils/coachIdentity';

const FALLBACK_AVATAR_PALETTES = [
  { start: '#f6c8b8', end: '#d96b57', jacket: '#7b3226' },
  { start: '#d7e7f6', end: '#7ea6cf', jacket: '#2f4d6d' },
  { start: '#d8eddc', end: '#7cb588', jacket: '#305a3d' },
  { start: '#f0dff8', end: '#b88ad3', jacket: '#5c3675' },
];

function hashString(value) {
  return Array.from(String(value || '')).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0);
}

function buildFallbackCoachAvatar(name) {
  const palette = FALLBACK_AVATAR_PALETTES[hashString(name) % FALLBACK_AVATAR_PALETTES.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.start}" />
          <stop offset="100%" stop-color="${palette.end}" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#bg)" />
      <circle cx="32" cy="23" r="11" fill="#f7eee8" />
      <path d="M17 55c2-10 9-16 15-16s13 6 15 16" fill="${palette.jacket}" />
      <path d="M24 20c2-6 14-6 16 0-2 1-4 2-8 2s-6-1-8-2Z" fill="rgba(42, 29, 24, 0.28)" />
      <circle cx="28" cy="23" r="1.2" fill="#7b5b4a" />
      <circle cx="36" cy="23" r="1.2" fill="#7b5b4a" />
      <path d="M28 28c1.5 1.8 6.5 1.8 8 0" stroke="#7b5b4a" stroke-width="1.6" stroke-linecap="round" fill="none" />
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function CoachIdentityBadge({ coach, lang, className = '' }) {
  if (!coach) return null;
  const fallbackAvatarSrc = buildFallbackCoachAvatar(coach.name || 'Hermes Coach');

  return (
    <div className={`coach-identity-badge${className ? ` ${className}` : ''}`}>
      {coach.avatarUrl ? (
        <img className="coach-identity-avatar" src={coach.avatarUrl} alt={coach.name} />
      ) : (
        <img className="coach-identity-avatar coach-identity-avatar--fallback" src={fallbackAvatarSrc} alt={coach.name} />
      )}
      <div className="coach-identity-copy">
        <strong>{coach.name}</strong>
        <span>{getCoachRoleLabel(coach, lang)}</span>
      </div>
    </div>
  );
}

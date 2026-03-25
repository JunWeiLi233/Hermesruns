/**
 * Decorative tier medal for Analysis "run level" (starter → diamond).
 * Colors align with getRank() in Analysis.jsx.
 * @param {'full' | 'discOnly'} variant — `discOnly` = round disc + star only (for doughnut center).
 */
export default function RunLevelMedal({ rankKey, accentColor, size = 84, className = '', variant = 'full' }) {
  const uid = `${rankKey || 'starter'}${variant === 'discOnly' ? '-d' : ''}`;
  const gradId = `medal-grad-${uid}`;
  const shadowId = `medal-shadow-${uid}`;

  if (variant === 'discOnly') {
    const s = size;
    return (
      <svg
        className={`run-level-medal run-level-medal--disc ${className}`.trim()}
        width={s}
        height={s}
        viewBox="0 0 80 80"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="45%" stopColor={accentColor} stopOpacity="1" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.65" />
          </linearGradient>
          <filter id={shadowId} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.18" />
          </filter>
        </defs>
        <circle
          cx="40"
          cy="40"
          r="30"
          fill={`url(#${gradId})`}
          stroke={accentColor}
          strokeWidth="2"
          filter={`url(#${shadowId})`}
        />
        <circle cx="40" cy="40" r="21" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.25" />
        <path
          fill="rgba(255,255,255,0.9)"
          d="M40 22 L43.2 31.2 L53 32.5 L45.5 39 L47.8 48.5 L40 43.5 L32.2 48.5 L34.5 39 L27 32.5 L36.8 31.2 Z"
        />
      </svg>
    );
  }

  const w = size;
  const h = Math.round(size * 1.12);

  return (
    <svg
      className={`run-level-medal ${className}`.trim()}
      width={w}
      height={h}
      viewBox="0 0 80 90"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="45%" stopColor={accentColor} stopOpacity="1" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.65" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
        </filter>
      </defs>
      <path
        d="M 28 40 L 16 88 L 30 80 L 36 44 Z"
        fill={accentColor}
        opacity={0.88}
      />
      <path
        d="M 52 40 L 64 88 L 50 80 L 44 44 Z"
        fill={accentColor}
        opacity={0.78}
      />
      <circle
        cx="40"
        cy="36"
        r="27"
        fill={`url(#${gradId})`}
        stroke={accentColor}
        strokeWidth="2"
        filter={`url(#${shadowId})`}
      />
      <circle cx="40" cy="36" r="19" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.25" />
      <path
        fill="rgba(255,255,255,0.9)"
        d="M40 20 L43.2 29.2 L53 30.5 L45.5 37 L47.8 46.5 L40 41.5 L32.2 46.5 L34.5 37 L27 30.5 L36.8 29.2 Z"
      />
    </svg>
  );
}

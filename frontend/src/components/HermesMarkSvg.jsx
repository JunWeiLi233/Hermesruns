/**
 * App mark: navy tile + H + accent stripe (same as /hermes-tab-icon.svg and /favicon.svg).
 * @param {'light'|'dark'} tone — light: dark tile on UI; dark: light tile on hero panels.
 */
export default function HermesMarkSvg({ tone = 'light', className = '' }) {
  const bg = tone === 'dark' ? '#ffffff' : '#10203d';
  const fg = tone === 'dark' ? '#10203d' : '#ffffff';
  const accent = '#ff6b2c';
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill={bg} />
      <rect x="7" y="7" width="3" height="18" rx="0.5" fill={fg} />
      <rect x="22" y="7" width="3" height="18" rx="0.5" fill={fg} />
      <rect x="7" y="14.5" width="18" height="3" rx="0.5" fill={fg} />
      <rect x="8" y="24" width="16" height="2.5" rx="1.25" fill={accent} />
    </svg>
  );
}

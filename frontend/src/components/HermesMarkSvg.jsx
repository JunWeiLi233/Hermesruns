/**
 * App mark: industrial H + route lane (same as /hermes-tab-icon.svg and /favicon.svg).
 * @param {'light'|'dark'} tone - light: dark tile on UI; dark: light tile on hero panels.
 */
export default function HermesMarkSvg({ tone = 'light', className = '' }) {
  const bg = tone === 'dark' ? '#ffffff' : '#10203d';
  const fg = tone === 'dark' ? '#10203d' : '#ffffff';
  const rail = tone === 'dark' ? '#5f748f' : '#c7d6e6';
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
      <rect width="32" height="32" rx="7.5" fill={bg} />
      <path
        fill={fg}
        d="M7.1 8.9 12.2 6v10.3h7.6V8.9L24.9 6v20.1h-4.6v-6.2h-1.8c-1.6 0-2.8.8-3.5 2.2l-2.1 4H7.1V8.9Z"
      />
      <path
        fill={bg}
        d="M10.4 26.1 14.3 18.7c.8-1.4 2-2.2 3.6-2.2h2.1l3.8 9.6h-4.3l-2.1-5.5h-1.2l-2.7 5.5h-3.1Z"
      />
      <path d="M19.7 12.1 24.9 9.1v2.3l-5.2 3v-2.3Z" fill={rail} />
      <path d="M19.7 15.4 24.9 12.4v2.2l-5.2 3v-2.2Z" fill={rail} />
      <path d="M19.7 18.6 24.9 15.6v2.2l-5.2 3v-2.2Z" fill={rail} />
      <path d="M12.6 26.1 14.9 21.2" stroke={accent} strokeWidth="1.25" strokeLinecap="round" />
      <path d="M19.4 26.1 17.3 21.2" stroke={accent} strokeWidth="1.25" strokeLinecap="round" />
      <path d="M16 21.5v1.1M16 23.6v1.1M16 25.6v.5" stroke={accent} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

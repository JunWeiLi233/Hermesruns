/**
 * HermesRuns symbol (logo kit 2026, "Split time"): a lowercase h and the colon from pace and finish times, on a
 * rounded tile. Same drawing as the kit's symbol.svg; variant="colon" is the kit's favicon.svg (the colon alone, for
 * 16 to 32 px). The colon is always coral: never recolour it.
 * @param {'light'|'dark'|'auto'} tone - light: ink tile, paper h (for light surfaces, the default).
 *   dark: paper tile, ink h (for dark surfaces). auto: light, flipped to dark by shared.css under the midnight theme.
 * @param {'symbol'|'colon'} variant
 */
const INK = '#1a1714';
const PAPER = '#f5f1ea';
const CORAL = '#ff5a3c';
const H = 'M31 20 V80 M31 57 C31 46 38 41 45.5 41 C53.5 41 58.5 46 58.5 55 V80';

export default function HermesMarkSvg({ tone = 'light', variant = 'symbol', className = '' }) {
  const tile = tone === 'dark' ? PAPER : INK;
  const letter = tone === 'dark' ? INK : PAPER;
  const root = `hermes-mark hermes-mark--${tone}${className ? ` ${className}` : ''}`;

  if (variant === 'colon') {
    return (
      <svg className={root} viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
        <rect className="hermes-mark__tile" width="32" height="32" rx="8" fill={tile} />
        <rect x="11" y="5" width="10" height="10" rx="2.5" fill={CORAL} />
        <rect x="11" y="17" width="10" height="10" rx="2.5" fill={CORAL} />
      </svg>
    );
  }

  return (
    <svg className={root} viewBox="0 0 100 100" width="32" height="32" aria-hidden="true" focusable="false">
      <rect className="hermes-mark__tile" width="100" height="100" rx="24" fill={tile} />
      <path
        className="hermes-mark__letter"
        d={H}
        fill="none"
        stroke={letter}
        strokeWidth="14"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <rect x="69" y="43" width="12" height="12" rx="3" fill={CORAL} />
      <rect x="69" y="68" width="12" height="12" rx="3" fill={CORAL} />
    </svg>
  );
}

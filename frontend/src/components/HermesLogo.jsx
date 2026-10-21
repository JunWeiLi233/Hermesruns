import HermesMarkSvg from './HermesMarkSvg';
import HermesWordmarkSvg from './HermesWordmarkSvg';

/**
 * Symbol + logotype: the hermes:runs lockup (logo kit 2026, lockup.svg). Tile, logotype and gap keep the kit's
 * proportions (96 : 42.7 : 22); resize it with --hermes-logo-tile (shared.css). Optional accent (e.g. 跑 / RUN).
 * @param {'auto'|'light'|'dark'} [tone='auto'] - auto follows the theme (paper tile and letters under the midnight
 *   theme, ink otherwise); light is always the ink version, dark always the paper one.
 * @param {boolean} [showIcon=true] — set false for very small lines (e.g. form kicker).
 */
export default function HermesLogo({ mark, tone = 'auto', className = '', showIcon = true }) {
  const root = `hermes-logo hermes-logo--${tone}${className ? ` ${className}` : ''}`.trim();
  return (
    <span className={root}>
      {showIcon ? <HermesMarkSvg tone={tone} className="hermes-logo__icon" /> : null}
      <HermesWordmarkSvg className="hermes-logo__word" />
      {mark != null && mark !== '' ? (
        <span className="hermes-logo__mark">{mark}</span>
      ) : null}
    </span>
  );
}

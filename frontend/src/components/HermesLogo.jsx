import HermesMarkSvg from './HermesMarkSvg';
import HermesWordmarkSvg from './HermesWordmarkSvg';

/**
 * Symbol + logotype: the HermesRuns lockup (same drawing as the favicon). Optional accent (e.g. 跑 / RUN).
 * @param {boolean} [showIcon=true] — set false for very small lines (e.g. form kicker).
 */
export default function HermesLogo({ mark, tone = 'light', className = '', showIcon = true }) {
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

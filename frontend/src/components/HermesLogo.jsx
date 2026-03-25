import HermesMarkSvg from './HermesMarkSvg';

/**
 * Icon + wordmark: same mark as favicon (not React/Vite). Optional accent (e.g. 跑 / RUN).
 * @param {boolean} [showIcon=true] — set false for very small lines (e.g. form kicker).
 */
export default function HermesLogo({ mark, tone = 'light', className = '', showIcon = true }) {
  const root = `hermes-logo hermes-logo--${tone}${className ? ` ${className}` : ''}`.trim();
  return (
    <span className={root}>
      {showIcon ? <HermesMarkSvg tone={tone} className="hermes-logo__icon" /> : null}
      <span className="hermes-logo__word">HERMES</span>
      {mark != null && mark !== '' ? (
        <span className="hermes-logo__mark">{mark}</span>
      ) : null}
    </span>
  );
}

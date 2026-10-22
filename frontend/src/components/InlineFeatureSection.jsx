import { Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useI18n } from '../contexts/I18nContext';
import useScrollHold from '../hooks/useScrollHold';
import '../styles/inline-feature-section.css';

/** An optional view within its owning page. Load its charts only when the runner opens it. */
export default function InlineFeatureSection({ id, title, description, summaryValue, defaultExpanded = false, children }) {
  const { hash } = useLocation();
  const { t } = useI18n();
  const section = useRef(null);
  const [expanded, setExpanded] = useState(hash === `#${id}` || (!hash && defaultExpanded));
  const holdAt = useScrollHold();

  useEffect(() => {
    if (hash !== `#${id}`) return undefined;
    setExpanded(true);
    const frame = window.requestAnimationFrame(() => holdAt(section.current, { behavior: 'instant' }));
    return () => {
      window.cancelAnimationFrame(frame);
      holdAt(null);
    };
  }, [hash, id, holdAt]);

  return (
    <details id={id} ref={section} tabIndex={-1} className="inline-feature" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary className="inline-feature__summary">
        <h2 className="inline-feature__title">{title}</h2>
        {description ? <span className="inline-feature__description">{description}</span> : null}
        {summaryValue != null ? <span className="inline-feature__value">{summaryValue}</span> : null}
      </summary>
      {expanded ? (
        <div className="inline-feature__content">
          <Suspense fallback={<p role="status">{t('analysis.stitch_loading')}</p>}>{children}</Suspense>
        </div>
      ) : null}
    </details>
  );
}

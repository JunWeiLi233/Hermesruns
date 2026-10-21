import { useEffect, useRef } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import AppIcon from '../../components/AppIcon';

export default function RunDetailSessionAnalysis({ children }) {
  const { t } = useI18n();
  const detailsRef = useRef(null);

  useEffect(() => {
    const revealSection = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target || target === detailsRef.current || !detailsRef.current?.contains(target)) return;
      detailsRef.current.open = true;
      target.scrollIntoView?.({ block: 'start' });
    };
    revealSection();
    window.addEventListener('hashchange', revealSection);
    return () => window.removeEventListener('hashchange', revealSection);
  }, []);

  return (
    <details ref={detailsRef} className="run-detail-v2__session-analysis">
      <summary>
        <span>
          <strong>{t('run_detail.session_analysis_title')}</strong>
          <small>{t('run_detail.session_analysis_hint')}</small>
        </span>
        <AppIcon name="chevron_right" aria-hidden="true" />
      </summary>
      <div className="run-detail-v2__session-content">{children}</div>
    </details>
  );
}

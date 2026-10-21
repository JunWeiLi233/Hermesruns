import { useEffect, useState } from 'react';
import { subscribeWakeRetry } from '../../api';
import { useI18n } from '../../contexts/I18nContext';
import { translateLoadingText } from '../../i18n/loadingCopy';

export function useLoadingStage(what, enabled = true) {
  const [slow, setSlow] = useState(false);
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    setSlow(false);
    setWaking(false);
    if (!enabled) return undefined;
    const timer = window.setTimeout(() => setSlow(true), 4000);
    const unsubscribe = subscribeWakeRetry(setWaking);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [enabled, what]);
  return waking ? 'waking' : slow ? 'slow' : 'initial';
}

export function useLoadingStatus(what, enabled = true) {
  const { t } = useI18n();
  const stage = useLoadingStage(what, enabled);
  const message = t(`loading.status.${stage}`, { what: translateLoadingText(t, what) });
  return { stage, message };
}

// Announce outside aria-busy so readers receive updates while content is busy.
export default function LoadingStatus({ stage, message, inline = false }) {
  const { t } = useI18n();
  return <div role="status" aria-live="polite" aria-atomic="true"
    className={`loading-design__status${inline ? ' loading-design__status--inline' : ''}${stage === 'initial' && !inline ? ' loading-design__status--initial' : ''}`}>
    <span className="hr-dot" aria-hidden="true" />
    <span><strong>{message}</strong>{stage !== 'initial' && <span className="loading-design__status-detail">{t(`loading.status.${stage}_body`)}</span>}</span>
  </div>;
}

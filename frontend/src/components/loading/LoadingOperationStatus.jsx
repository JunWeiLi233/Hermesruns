import { useLoadingStage } from './LoadingStatus';
import { translateLoadingText } from '../../i18n/loadingCopy';
import './loading-design.css';

// Operation forms also work with a supplied translator outside I18nProvider.
export default function LoadingOperationStatus({ t, what, initial, slow }) {
  const stage = useLoadingStage(what);
  const message = stage === 'initial' ? initial : stage === 'slow' && slow ? slow : t(`loading.status.${stage}`, { what: translateLoadingText(t, what) });
  return <div className="loading-design" data-loading-operation={what}>
    <div className="loading-design__status loading-design__status--inline" role="status" aria-live="polite" aria-atomic="true">
      <span className="hr-dot" aria-hidden="true" /><span><strong>{message}</strong>{stage !== 'initial' && <span className="loading-design__status-detail">{t(`loading.status.${stage}_body`)}</span>}</span>
    </div>
  </div>;
}

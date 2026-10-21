import { useMemo, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { translateLoadingText } from '../i18n/loadingCopy';
import { createLoadingDesign } from './loading/LoadingDesign';
import LoadingStatus, { useLoadingStatus } from './loading/LoadingStatus';
import useLoadingViewport from './loading/useLoadingViewport';
import './loading/loading-design.css';

export default function ModalLoadingSkeleton({ variant }) {
  const { t } = useI18n();
  const container = useRef(null);
  const mobile = useLoadingViewport(container);
  const design = useMemo(() => createLoadingDesign({ mobile, t }), [mobile, t]);
  const state = design.states.find(item => item.id === variant && item.kind === 'dialog');
  const status = useLoadingStatus(state?.what || 'your training');
  if (!state) return null;
  const buttons = state.buttons || [['Cancel', 0], [state.primary, 1]];
  return <div ref={container} className="loading-design loading-design--dialog" data-loading-state={variant}>
    <div className="loading-design__dialog-body" aria-busy="true" style={{ minHeight: state.minH }}>{design.renderDialogBody(variant)}</div>
    <div className="loading-design__dialog-footer">
      <LoadingStatus {...status} inline />
      <div className="loading-design__dialog-actions" aria-hidden="true">{buttons.filter(([label]) => label).map(([label, primary]) => <span key={label} className={primary ? 'is-primary' : ''}>{translateLoadingText(t, label)}</span>)}</div>
    </div>
  </div>;
}

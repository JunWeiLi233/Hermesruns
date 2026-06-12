import { useId, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';

export default function InfoDisclosure({ children, className = '', title }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonTitle = title || t('common.show_details');

  return (
    <div className={`info-disclosure${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="info-disclosure-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={buttonTitle}
        title={buttonTitle}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">i</span>
      </button>
      <div id={panelId} className="info-disclosure-panel" hidden={!open}>
        {open ? (
          <div className="info-disclosure-panel__inner">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

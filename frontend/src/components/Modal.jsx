import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function Modal({ isOpen, onClose, title, children, icon = null, shellClassName = '', cardClassName = '', portalToBody = false, adminDashboard = false }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.classList.add('modal-open');

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  const content = (
    <div className={joinClasses('modal-shell', adminDashboard && 'admin-dashboard-modal-shell', shellClassName)} onClick={handleOverlayClick} role="presentation">
      <div className={joinClasses('modal-card', adminDashboard && 'admin-dashboard-modal-card', cardClassName)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          {icon ? <div className="modal-header-icon" aria-hidden="true">{icon}</div> : null}
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-form">
          {children}
        </div>
      </div>
    </div>
  );

  return portalToBody && typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
}

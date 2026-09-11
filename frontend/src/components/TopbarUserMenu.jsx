import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import AppIcon from './AppIcon';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import '../styles/account-menu.css';

export default function TopbarUserMenu({ initials = 'H', label, className = '', showProfile = false, onOpenProfile }) {
  const { logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('closed');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const logoutStarted = useRef(false);
  const panelId = useId();
  const isOpen = phase === 'menu';

  useEffect(() => {
    if (!isOpen) return undefined;
    panelRef.current?.querySelector('button')?.focus();
    function outside(event) {
      if (!rootRef.current?.contains(event.target)) setPhase('closed');
    }
    function escape(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPhase('closed');
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  function requestLogout() {
    // The menu action disappears; let Modal restore focus to the durable avatar.
    triggerRef.current?.focus();
    logoutStarted.current = false;
    setPhase('confirm');
  }

  function confirmLogout() {
    if (logoutStarted.current) return;
    logoutStarted.current = true;
    setPhase('closed');
    logout();
  }

  return (
    <div ref={rootRef} className={`runner-shell-notification-wrap runner-shell-user-menu-wrap${isOpen ? ' is-open' : ''}`}
      onBlur={event => {
        if (isOpen && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setPhase('closed');
      }}>
      <button ref={triggerRef} type="button" className={`runner-shell-avatar${className ? ` ${className}` : ''}`}
        aria-label={label || t('components.account_menu.title')} aria-haspopup="dialog" aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined} onClick={() => setPhase(isOpen ? 'closed' : 'menu')}>
        {initials}
      </button>
      {isOpen ? (
        <div ref={panelRef} id={panelId} className="account-menu-panel" role="dialog" aria-label={t('components.account_menu.title')}>
          <div className="account-menu-identity">
            <span className="account-menu-monogram" aria-hidden="true">{initials}</span>
            <div><strong>{t('components.account_menu.title')}</strong><p>{t('components.account_menu.signed_in')}</p></div>
          </div>
          {showProfile ? (
            <button type="button" className="account-menu-action" onClick={() => {
              triggerRef.current?.focus();
              setPhase('closed');
              if (onOpenProfile) onOpenProfile();
              else navigate('/profile');
            }}>
              <AppIcon name="person" /><span>{t('profile.change_name')}</span><AppIcon name="chevron_right" />
            </button>
          ) : null}
          <button type="button" className="account-menu-action account-menu-action--logout" onClick={requestLogout}>
            <AppIcon name="logout" /><span>{t('profile.logout')}</span><AppIcon name="chevron_right" />
          </button>
        </div>
      ) : null}
      <Modal isOpen={phase === 'confirm'} onClose={() => setPhase('closed')} title={t('components.account_menu.confirm_title')}
        closeLabel={t('components.account_menu.close')} portalToBody shellClassName="logout-confirm-shell" cardClassName="logout-confirm-card"
        headerContent={<span className="logout-confirm-symbol" aria-hidden="true"><AppIcon name="logout" /></span>}>
        <p className="logout-confirm-description">{t('components.account_menu.confirm_body')}</p>
        <div className="logout-confirm-actions">
          <button type="button" className="logout-confirm-cancel" data-modal-initial-focus onClick={() => setPhase('closed')}>{t('components.account_menu.cancel')}</button>
          <button type="button" className="logout-confirm-submit" onClick={confirmLogout}>{t('profile.logout')}</button>
        </div>
      </Modal>
    </div>
  );
}

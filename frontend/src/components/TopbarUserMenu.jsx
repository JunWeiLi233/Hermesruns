import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

export default function TopbarUserMenu({ initials = 'H', label, className = '' }) {
  const { logout } = useAuth();
  const { t, lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonClassName = `runner-shell-avatar${className ? ` ${className}` : ''}`;
  const menuLabel = label || t('profile.settings');

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={isOpen ? 'runner-shell-notification-wrap runner-shell-user-menu-wrap is-open' : 'runner-shell-notification-wrap runner-shell-user-menu-wrap'}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={menuLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen ? 'true' : 'false'}
        onClick={() => setIsOpen((current) => !current)}
      >
        {initials}
      </button>

      {isOpen ? (
        <div className={lang === 'zh-CN' ? 'runner-shell-notification-popover runner-shell-user-popover is-zh' : 'runner-shell-notification-popover runner-shell-user-popover'} role="dialog" aria-label={t('profile.logout')}>
          <button
            type="button"
            className="runner-shell-user-menu-action"
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
          >
            <AppIcon name="logout" className="runner-dashboard-side-link-icon" />
            <span>{t('profile.logout')}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

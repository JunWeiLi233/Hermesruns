import { useEffect, useId, useMemo, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { useI18n } from '../contexts/I18nContext';

const NOTIFICATION_SEEN_STORAGE_KEY = 'hermes.topbar_notifications_seen.v1';
const NOTIFICATION_DELETED_STORAGE_KEY = 'hermes.topbar_notifications_deleted.v1';

function buildNotificationCopy(t) {
  const key = 'components.training_tips';
  return {
    buttonLabel: t(key + '.open'),
    closeLabel: t(key + '.close'),
    title: t(key + '.title'),
    subtitle: t(key + '.subtitle'),
    actionLabel: t(key + '.open_runs'),
    deleteLabel: t(key + '.dismiss'),
    emptyTitle: t(key + '.empty_title'),
    emptyBody: t(key + '.empty_body'),
    items: [
      { id: 'training-load-tip', icon: 'load_balance_runner', copy: 'load' },
      { id: 'route-history-tip', icon: 'map', copy: 'routes' },
      { id: 'connections-tip', icon: 'sync', copy: 'connections' },
    ].map((item) => ({
      ...item,
      eyebrow: t(key + '.' + item.copy + '_label'),
      title: t(key + '.' + item.copy + '_title'),
      body: t(key + '.' + item.copy + '_body'),
    })),
  };
}

export default function TopbarNotifications({ onOpenRuns }) {
  const { t, lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(NOTIFICATION_SEEN_STORAGE_KEY) !== 'seen';
    } catch {
      return true;
    }
  });
  const [deletedIds, setDeletedIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const value = JSON.parse(window.localStorage.getItem(NOTIFICATION_DELETED_STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  });
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const panelId = useId();

  const copy = useMemo(() => buildNotificationCopy(t), [t]);
  const visibleItems = useMemo(() => copy.items.filter((item) => !deletedIds.includes(item.id)), [copy.items, deletedIds]);

  function closePopover() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleDeleteMessage(itemId) {
    setDeletedIds((currentIds) => {
      if (currentIds.includes(itemId)) return currentIds;
      const nextIds = [...currentIds, itemId];
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(NOTIFICATION_DELETED_STORAGE_KEY, JSON.stringify(nextIds));
        } catch { /* Dismiss still works when browser storage is unavailable. */ }
      }
      return nextIds;
    });
    closeRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;
    setHasUnread(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NOTIFICATION_SEEN_STORAGE_KEY, 'seen');
      } catch { /* The seen state remains available for this session. */ }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    closeRef.current?.focus();

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className={isOpen ? 'runner-shell-notification-wrap is-open' : 'runner-shell-notification-wrap'}
      onBlur={(event) => {
        if (isOpen && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={isOpen ? 'runner-shell-icon-btn runner-shell-notification-btn is-open' : 'runner-shell-icon-btn runner-shell-notification-btn'}
        aria-label={copy.buttonLabel}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="dialog"
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setIsOpen((value) => !value)}
      >
        <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
        {hasUnread && visibleItems.length > 0 ? <span className="runner-shell-notification-dot" aria-hidden="true" /> : null}
      </button>

      {isOpen ? (
        <div id={panelId} className={lang === 'zh-CN' ? 'runner-shell-notification-popover is-zh' : 'runner-shell-notification-popover'} role="dialog" aria-label={copy.title} aria-describedby={`${panelId}-description`}>
          <div className="runner-shell-notification-head">
            <div className="runner-shell-notification-heading">
              <span className="runner-shell-notification-heading-icon" aria-hidden="true">
                <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
              </span>
              <div className="runner-shell-notification-head-copy">
                <div className="runner-shell-notification-title-row">
                  <strong>{copy.title}</strong>
                  {visibleItems.length > 0 ? <span className="runner-shell-notification-count" aria-hidden="true">{visibleItems.length}</span> : null}
                </div>
                <p id={`${panelId}-description`}>{copy.subtitle}</p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="runner-shell-notification-close"
              aria-label={copy.closeLabel}
              onClick={closePopover}
            >
              <AppIcon name="close" className="runner-dashboard-side-link-icon" />
            </button>
          </div>

          <div className="runner-shell-notification-list">
            {visibleItems.length > 0 ? visibleItems.map((item) => (
              <article key={item.id} className="runner-shell-notification-card" data-kind={item.copy}>
                <span className="runner-shell-notification-card-icon" aria-hidden="true">
                  <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
                </span>
                <div className="runner-shell-notification-card-copy">
                  <div className="runner-shell-notification-eyebrow">{item.eyebrow}</div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <button
                  type="button"
                  className="runner-shell-notification-delete"
                  aria-label={`${copy.deleteLabel}: ${item.title}`}
                  onClick={() => handleDeleteMessage(item.id)}
                >
                  <AppIcon name="close" className="runner-dashboard-side-link-icon" />
                </button>
              </article>
            )) : (
              <div className="runner-shell-notification-empty" role="status">
                <span className="runner-shell-notification-empty-icon" aria-hidden="true">
                  <AppIcon name="check_circle" className="runner-dashboard-side-link-icon" />
                </span>
                <div>
                  <strong>{copy.emptyTitle}</strong>
                  <p>{copy.emptyBody}</p>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="runner-shell-notification-link"
            onClick={() => {
              setIsOpen(false);
              onOpenRuns?.();
            }}
          >
            {copy.actionLabel}
            <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

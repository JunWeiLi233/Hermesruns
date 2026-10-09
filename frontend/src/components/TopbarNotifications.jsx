import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useInRouterContext, useNavigate } from 'react-router';
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
    dismissAllLabel: t(key + '.dismiss_all'),
    emptyTitle: t(key + '.empty_title'),
    emptyBody: t(key + '.empty_body'),
    items: [
      { id: 'training-load-tip', icon: 'load_balance_runner', copy: 'load', path: '/analysis' },
      { id: 'route-history-tip', icon: 'map', copy: 'routes', path: '/heatmap' },
      { id: 'connections-tip', icon: 'sync', copy: 'connections', path: '/settings' },
    ].map((item) => ({
      ...item,
      title: t(key + '.' + item.copy + '_title'),
      body: t(key + '.' + item.copy + '_body'),
      cta: t(key + '.' + item.copy + '_cta'),
    })),
  };
}

function persistDeleted(ids) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIFICATION_DELETED_STORAGE_KEY, JSON.stringify(ids));
  } catch { /* Dismiss still works when browser storage is unavailable. */ }
}

// Only mounted inside a router so the component keeps working in isolation (tests, storybook).
function RouterNavigateBridge({ onReady }) {
  const navigate = useNavigate();
  useEffect(() => { onReady(() => navigate); }, [navigate, onReady]);
  return null;
}

export default function TopbarNotifications({ onOpenRuns, onOpenTip }) {
  const { t, lang } = useI18n();
  const inRouter = useInRouterContext();
  const [routerNavigate, setRouterNavigate] = useState(null);
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
      persistDeleted(nextIds);
      return nextIds;
    });
    closeRef.current?.focus();
  }

  function handleDismissAll() {
    const nextIds = copy.items.map((item) => item.id);
    setDeletedIds(nextIds);
    persistDeleted(nextIds);
    closeRef.current?.focus();
  }

  function handleOpenTip(item) {
    setIsOpen(false);
    if (onOpenTip) onOpenTip(item.path, item.id);
    else if (routerNavigate) routerNavigate(item.path);
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

  const showBadge = hasUnread && visibleItems.length > 0;

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
      {inRouter ? <RouterNavigateBridge onReady={setRouterNavigate} /> : null}
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
        {showBadge ? (
          <span className="runner-shell-notification-dot tips-v2-badge" aria-hidden="true">{visibleItems.length}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className={`runner-shell-notification-popover tips-v2${lang === 'zh-CN' ? ' is-zh' : ''}`}
          role="dialog"
          aria-label={copy.title}
          aria-describedby={`${panelId}-description`}
        >
          <div className="tips-v2-head">
            <div className="tips-v2-head-copy">
              <strong>{copy.title}</strong>
              {visibleItems.length > 0 ? <span className="tips-v2-count">{visibleItems.length}</span> : null}
              <p id={`${panelId}-description`} className="tips-v2-sr">{copy.subtitle}</p>
            </div>
            <div className="tips-v2-head-actions">
              {visibleItems.length > 1 ? (
                <button type="button" className="tips-v2-text-btn" onClick={handleDismissAll}>{copy.dismissAllLabel}</button>
              ) : null}
              <button
                ref={closeRef}
                type="button"
                className="tips-v2-icon-btn"
                aria-label={copy.closeLabel}
                onClick={closePopover}
              >
                <AppIcon name="close" className="runner-dashboard-side-link-icon" />
              </button>
            </div>
          </div>

          <div className="tips-v2-list">
            {visibleItems.length > 0 ? visibleItems.map((item) => (
              <article key={item.id} className="tips-v2-row" data-kind={item.copy}>
                <button type="button" className="tips-v2-row-main" onClick={() => handleOpenTip(item)}>
                  <span className="tips-v2-icon" aria-hidden="true">
                    <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
                  </span>
                  <span className="tips-v2-copy">
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    <em>{item.cta} ›</em>
                  </span>
                </button>
                <button
                  type="button"
                  className="tips-v2-icon-btn tips-v2-dismiss"
                  aria-label={`${copy.deleteLabel}: ${item.title}`}
                  onClick={() => handleDeleteMessage(item.id)}
                >
                  <AppIcon name="close" className="runner-dashboard-side-link-icon" />
                </button>
              </article>
            )) : (
              <div className="tips-v2-empty" role="status">
                <span className="tips-v2-empty-icon" aria-hidden="true">
                  <AppIcon name="check_circle" className="runner-dashboard-side-link-icon" />
                </span>
                <strong>{copy.emptyTitle}</strong>
                <p>{copy.emptyBody}</p>
              </div>
            )}
          </div>

          <div className="tips-v2-foot">
            <span>{copy.subtitle}</span>
            <button
              type="button"
              className="tips-v2-text-btn is-strong"
              onClick={() => {
                setIsOpen(false);
                onOpenRuns?.();
              }}
            >
              {copy.actionLabel}
              <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

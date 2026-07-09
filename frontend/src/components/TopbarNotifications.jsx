import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { useI18n } from '../contexts/I18nContext';

const NOTIFICATION_SEEN_STORAGE_KEY = 'hermes.topbar_notifications_seen.v1';
const NOTIFICATION_DELETED_STORAGE_KEY = 'hermes.topbar_notifications_deleted.v1';

function buildNotificationCopy(lang) {
  if (lang === 'zh-CN') {
    return {
      buttonLabel: '打开通知',
      title: '训练消息',
      subtitle: 'Hermes 刚刚为你整理的重点提醒',
      actionLabel: '查看跑步记录',
      deleteLabel: '删除消息',
      emptyTitle: '暂无训练消息',
      emptyBody: '新的同步提醒会在这里出现。',
      items: [
        {
          id: 'coach-load',
          eyebrow: '今日教练',
          title: '训练负荷保持稳定',
          body: '最近几次训练已经同步完成，今天更适合按计划推进，而不是临时加量。',
        },
        {
          id: 'gps-samples',
          eyebrow: '路线同步',
          title: 'GPS 采样点已刷新',
          body: '热力图现在会用全部跑步的 GPS 采样点显示总量，地图仍然保留轻量渲染。',
        },
        {
          id: 'connection-health',
          eyebrow: '连接状态',
          title: '导入通道处于健康状态',
          body: 'Strava 或 Garmin 连接正常时，新的路线和训练消息会继续自动进入 Hermes。',
        },
      ],
    };
  }

  return {
    buttonLabel: 'Open notifications',
    title: 'Training messages',
    subtitle: 'A quick Hermes pulse from your latest sync',
    actionLabel: 'Open runs',
    deleteLabel: 'Delete message',
    emptyTitle: 'No training messages',
    emptyBody: 'New sync reminders will appear here.',
    items: [
      {
        id: 'coach-load',
        eyebrow: 'Coach note',
        title: 'Your load is staying controlled',
        body: 'Recent sessions are synced and your current pattern looks steady enough to keep the plan on track.',
      },
      {
        id: 'gps-samples',
        eyebrow: 'Route sync',
        title: 'GPS sample totals are refreshed',
        body: 'Heatmap totals now read from all-run GPS samples while the map keeps a lighter render budget.',
      },
      {
        id: 'connection-health',
        eyebrow: 'Connection',
        title: 'Import channels look healthy',
        body: 'When Strava or Garmin stays connected, new routes and coach cues will keep flowing into Hermes.',
      },
    ],
  };
}

export default function TopbarNotifications({ onOpenRuns }) {
  const { t, lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(NOTIFICATION_SEEN_STORAGE_KEY) !== 'seen';
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

  const copy = useMemo(() => buildNotificationCopy(lang), [lang]);
  const visibleItems = useMemo(() => copy.items.filter((item) => !deletedIds.includes(item.id)), [copy.items, deletedIds]);

  function handleDeleteMessage(itemId) {
    setDeletedIds((currentIds) => {
      if (currentIds.includes(itemId)) return currentIds;
      const nextIds = [...currentIds, itemId];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(NOTIFICATION_DELETED_STORAGE_KEY, JSON.stringify(nextIds));
      }
      return nextIds;
    });
  }

  useEffect(() => {
    if (!isOpen) return;
    setHasUnread(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(NOTIFICATION_SEEN_STORAGE_KEY, 'seen');
    }
  }, [isOpen]);

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
    <div ref={rootRef} className={isOpen ? 'runner-shell-notification-wrap is-open' : 'runner-shell-notification-wrap'}>
      <button
        type="button"
        className={isOpen ? 'runner-shell-icon-btn runner-shell-notification-btn is-open' : 'runner-shell-icon-btn runner-shell-notification-btn'}
        aria-label={copy.buttonLabel}
        aria-expanded={isOpen ? 'true' : 'false'}
        onClick={() => setIsOpen((value) => !value)}
      >
        <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
        {hasUnread ? <span className="runner-shell-notification-dot" aria-hidden="true" /> : null}
      </button>

      {isOpen ? (
        <div className={lang === 'zh-CN' ? 'runner-shell-notification-popover is-zh' : 'runner-shell-notification-popover'} role="dialog" aria-label={copy.title}>
          <div className="runner-shell-notification-head">
            <div>
              <strong>{copy.title}</strong>
              <p>{copy.subtitle}</p>
            </div>
            <button
              type="button"
              className="runner-shell-notification-close"
              aria-label={t('common.close_notifications')}
              onClick={() => setIsOpen(false)}
            >
              <AppIcon name="close" className="runner-dashboard-side-link-icon" />
            </button>
          </div>

          <div className="runner-shell-notification-list">
            {visibleItems.length > 0 ? visibleItems.map((item) => (
              <article key={item.id} className="runner-shell-notification-card">
                <div className="runner-shell-notification-card-copy">
                  <span>{item.eyebrow}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <button
                  type="button"
                  className="runner-shell-notification-delete"
                  aria-label={`${copy.deleteLabel}: ${item.title}`}
                  onClick={() => handleDeleteMessage(item.id)}
                >
                  <AppIcon name="delete_sweep" className="runner-dashboard-side-link-icon" />
                </button>
              </article>
            )) : (
              <div className="runner-shell-notification-empty" role="status">
                <strong>{copy.emptyTitle}</strong>
                <p>{copy.emptyBody}</p>
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

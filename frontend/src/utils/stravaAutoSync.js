const AUTO_SYNC_SESSION_KEY = 'hermes_strava_auto_sync_at';
const AUTO_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;
const STRAVA_OAUTH_PENDING_SESSION_KEY = 'hermes_strava_oauth_pending_at';
const STRAVA_OAUTH_PENDING_MAX_AGE_MS = 2 * 60 * 1000;
export const STRAVA_SYNC_FINISHED_EVENT = 'hermes:strava-sync-finished';

export function shouldTriggerStravaAutoSync({ isAuthenticated, authHydrated, token, storage = window.sessionStorage, nowMs = Date.now() }) {
  if (!isAuthenticated || !authHydrated || !token) return false;
  try {
    const raw = storage.getItem(AUTO_SYNC_SESSION_KEY);
    const previous = raw ? Number.parseInt(raw, 10) : 0;
    if (Number.isFinite(previous) && previous > 0 && nowMs - previous < AUTO_SYNC_MIN_INTERVAL_MS) {
      return false;
    }
  } catch {
    // Ignore storage failures and allow a best-effort trigger.
  }
  return true;
}

export function markStravaAutoSyncTriggered({ storage = window.sessionStorage, nowMs = Date.now() }) {
  try {
    storage.setItem(AUTO_SYNC_SESSION_KEY, String(nowMs));
  } catch {
    // Ignore storage failures.
  }
}

export function markStravaOauthPendingFlag({ storage = window.sessionStorage, nowMs = Date.now() }) {
  try {
    storage.setItem(STRAVA_OAUTH_PENDING_SESSION_KEY, String(nowMs));
  } catch {
    // Ignore storage failures.
  }
}

export function hasStravaOauthPendingFlag({ storage = window.sessionStorage, nowMs = Date.now() }) {
  try {
    const raw = storage.getItem(STRAVA_OAUTH_PENDING_SESSION_KEY);
    const pendingAt = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(pendingAt) && pendingAt > 0 && nowMs - pendingAt < STRAVA_OAUTH_PENDING_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function consumeStravaOauthPendingFlag({ storage = window.sessionStorage, nowMs = Date.now() }) {
  const pending = hasStravaOauthPendingFlag({ storage, nowMs });
  if (pending) {
    clearStravaOauthPendingFlag({ storage });
  }
  return pending;
}

export function clearStravaOauthPendingFlag({ storage = window.sessionStorage }) {
  try {
    storage.removeItem(STRAVA_OAUTH_PENDING_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function formatStravaSyncLabel(status, t) {
  const syncStatus = status?.syncStatus;
  if (!status?.linked) return t('settings.strava_not_connected');
  if (!syncStatus) return t('settings.stitch_strava_active');
  if (syncStatus.active) return t('profile.strava_sync_processing');
  if (syncStatus.status === 'FAILED') {
    return /relink|authorization expired|invalid/i.test(syncStatus.error || '')
      ? t('profile.strava_sync_relink_required')
      : (syncStatus.error || t('profile.strava_sync_failed'));
  }
  if (syncStatus.status === 'COMPLETED' && syncStatus.processedActivities > 0) {
    return t('profile.strava_sync_completed');
  }
  return t('settings.stitch_strava_active');
}

export function stravaSyncTone(status) {
  if (!status?.linked) return 'review';
  const syncStatus = status?.syncStatus;
  if (!syncStatus) return 'live';
  if (syncStatus.active) return 'active';
  if (syncStatus.status === 'FAILED') return 'alert';
  return 'live';
}

import { useSyncExternalStore } from 'react';

const PREFIX = 'hermes_plan_read_v1:';
const TTL = 24 * 60 * 60 * 1000;
const LIMIT = 48;
let cachedToken = null;
let capturedAt = 0;
const eventName = 'hermes-plan-cache-changed';
const notify = () => window.dispatchEvent(new Event(eventName));
const snapshot = () => navigator.onLine === false ? `offline:${capturedAt}` : cachedToken && cachedToken === localStorage.getItem('hermes_jwt') ? `cached:${capturedAt}` : 'online';
function subscribe(listener) {
  for (const name of [eventName, 'online', 'offline', 'storage']) window.addEventListener(name, listener);
  return () => { for (const name of [eventName, 'online', 'offline', 'storage']) window.removeEventListener(name, listener); };
}
export const usePlanCacheStatus = () => useSyncExternalStore(subscribe, snapshot, () => 'online');
export const planReadOnly = () => snapshot() !== 'online';
export function clearPlanReadCache() {
  try { for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key); }
  catch { /* Storage may be denied; logout must still complete. */ }
  cachedToken = null; capturedAt = 0; notify();
}
function sessionValid(token) {
  return Boolean(token) && localStorage.getItem('hermes_jwt') === token;
}
const allowed = url => url === '/api/profile/me' || url === '/api/plan-profile' || /^\/api\/run-plans(?:\/|\?|$)/.test(url);
async function cacheKey(token, url) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return PREFIX + Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('') + ':' + url;
}
export async function planRead(url, token, load) {
  if (!allowed(url) || !sessionValid(token)) return load();
  const key = await cacheKey(token, url);
  const authorizationKey = await cacheKey(token, 'authorization');
  async function recover(error) {
    if (error?.status || error?.name === 'AbortError' || !sessionValid(token)) throw error;
    let entry; try { entry = JSON.parse(localStorage.getItem(key)); } catch { /* unusable cache */ }
    let authorization; try { authorization = JSON.parse(localStorage.getItem(authorizationKey)); } catch { /* no valid server window */ }
    if (!authorization || !Number.isFinite(authorization.until) || authorization.until <= Date.now() || !entry || !Number.isFinite(entry.savedAt) || entry.data == null || entry.savedAt > Date.now() || Date.now() - entry.savedAt > TTL) throw Object.assign(new Error('OFFLINE_NOT_CACHED'), { code: 'OFFLINE_NOT_CACHED' });
    cachedToken = token; capturedAt = capturedAt ? Math.min(capturedAt, entry.savedAt) : entry.savedAt; notify();
    return entry.data;
  }
  if (navigator.onLine === false) return recover(new TypeError('offline'));
  try {
    const data = await load();
    if (sessionValid(token)) {
      try {
        if (url === '/api/run-plans' && Number.isFinite(data.offlineUntil) && data.offlineUntil > Date.now()) localStorage.setItem(authorizationKey, JSON.stringify({ until: Math.min(data.offlineUntil, Date.now() + TTL) }));
        const entries = Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && !k.endsWith(':authorization'));
        for (const k of entries) {
          try { if (Date.now() - JSON.parse(localStorage.getItem(k)).savedAt > TTL) localStorage.removeItem(k); }
          catch { localStorage.removeItem(k); }
        }
        const remaining = entries.filter(k => localStorage.getItem(k) != null && k !== key).sort((a, b) => JSON.parse(localStorage.getItem(a)).savedAt - JSON.parse(localStorage.getItem(b)).savedAt);
        while (remaining.length >= LIMIT) localStorage.removeItem(remaining.shift());
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
      } catch { /* Storage denial/quota must not fail an online read. */ }
      if (url === '/api/run-plans') { cachedToken = null; capturedAt = 0; notify(); }
    }
    return data;
  } catch (error) {
    if ([401, 403].includes(error?.status)) clearPlanReadCache();
    if ([404, 410].includes(error?.status)) {
      try { localStorage.removeItem(key); } catch { /* Storage cleanup must preserve the server error. */ }
    }
    return recover(error);
  }
}

export async function preparePlanOfflineShell() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/training-plan-sw.js');
    const ready = await navigator.serviceWorker.ready;
    const worker = ready.active || registration.active;
    const urls = performance.getEntriesByType('resource').map(entry => entry.name).filter(url => new URL(url, location.href).origin === location.origin && new URL(url, location.href).pathname.startsWith('/assets/'));
    worker?.postMessage({ type: 'CACHE_PLAN_ASSETS', urls });
  } catch { /* Ordinary online use remains available when workers are disabled. */ }
}

import { apiFetch } from '../api.js';

const TRACKER_FLAG = '__hermesLocalConsoleErrorTrackerInstalled';
const pendingByFingerprint = new Map();
let flushTimer = null;

export function shouldTrackLocalConsoleErrors(locationLike = globalThis?.window?.location) {
  if (!locationLike) return false;
  const hostname = String(locationLike.hostname || '').toLowerCase();
  const port = String(locationLike.port || '');
  return (hostname === 'localhost' || hostname === '127.0.0.1') && port === '8080';
}

function normalizeText(value, maxLength = 2000) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeStack(value) {
  return normalizeText(value, 6000);
}

function buildMessageFromArgs(args) {
  const parts = args
    .map((part) => {
      if (part instanceof Error) {
        return part.message || String(part);
      }
      if (typeof part === 'string') {
        return part;
      }
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    })
    .filter(Boolean);
  return normalizeText(parts.join(' | '), 1500);
}

export function buildConsoleFingerprint(payload) {
  return [
    payload.kind || 'console.error',
    payload.severity || 'error',
    payload.route || '',
    payload.message || '',
    (payload.stack || '').split('\n')[0] || '',
    payload.sourceUrl || '',
    payload.assetUrl || '',
  ].join('||');
}

function buildBasePayload(windowObj) {
  return {
    severity: 'error',
    route: normalizeText(`${windowObj.location.pathname || ''}${windowObj.location.search || ''}${windowObj.location.hash || ''}`, 240),
    pageUrl: normalizeText(windowObj.location.href, 1200),
    userAgent: normalizeText(windowObj.navigator?.userAgent || '', 1000),
    sessionId: ensureSessionId(windowObj),
  };
}

function ensureSessionId(windowObj) {
  const key = 'hermes.localConsoleSessionId';
  try {
    const existing = windowObj.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `console-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    windowObj.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `console-${Date.now().toString(36)}`;
  }
}

function queuePayload(payload, sendReport) {
  if (!payload.message) return;
  const fingerprint = buildConsoleFingerprint(payload);
  const existing = pendingByFingerprint.get(fingerprint);
  if (existing) {
    existing.count += 1;
    if (payload.stack) existing.stack = payload.stack;
    if (payload.sourceUrl) existing.sourceUrl = payload.sourceUrl;
    if (payload.assetUrl) existing.assetUrl = payload.assetUrl;
    existing.route = payload.route || existing.route;
    existing.pageUrl = payload.pageUrl || existing.pageUrl;
  } else {
    pendingByFingerprint.set(fingerprint, { ...payload, count: 1 });
  }

  if (flushTimer) return;
  flushTimer = window.setTimeout(async () => {
    flushTimer = null;
    const batch = [...pendingByFingerprint.values()];
    pendingByFingerprint.clear();
    if (!batch.length) return;
    try {
      await sendReport(batch);
    } catch {
      // Avoid recursive console noise if the tracker endpoint itself fails.
    }
  }, 1200);
}

async function defaultSendReport(errors) {
  await apiFetch('/api/dev/console-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errors }),
    keepalive: true,
  });
}

function buildErrorPayload(windowObj, event) {
  const base = buildBasePayload(windowObj);
  const resourceTarget = event?.target;
  const assetUrl = normalizeText(
    resourceTarget?.currentSrc || resourceTarget?.src || resourceTarget?.href || '',
    1200,
  );
  if (assetUrl) {
    return {
      ...base,
      kind: 'resource-error',
      message: normalizeText(`Failed to load resource: ${assetUrl}`, 1500),
      sourceUrl: assetUrl,
      assetUrl,
      stack: null,
    };
  }

  const error = event?.error;
  return {
    ...base,
    kind: 'window.error',
    message: normalizeText(error?.message || event?.message || 'Window error', 1500),
    stack: normalizeStack(error?.stack),
    sourceUrl: normalizeText(event?.filename || '', 1200),
    assetUrl: null,
  };
}

function buildRejectionPayload(windowObj, event) {
  const base = buildBasePayload(windowObj);
  const reason = event?.reason;
  return {
    ...base,
    kind: 'unhandledrejection',
    message: normalizeText(
      reason instanceof Error ? (reason.message || String(reason)) : buildMessageFromArgs([reason]) || 'Unhandled promise rejection',
      1500,
    ),
    stack: normalizeStack(reason instanceof Error ? reason.stack : null),
    sourceUrl: null,
    assetUrl: null,
  };
}

function buildConsolePayload(windowObj, args) {
  const base = buildBasePayload(windowObj);
  const firstError = args.find((value) => value instanceof Error);
  return {
    ...base,
    kind: 'console.error',
    message: buildMessageFromArgs(args),
    stack: normalizeStack(firstError?.stack),
    sourceUrl: null,
    assetUrl: null,
  };
}

export function installLocalConsoleErrorTracker({ windowObj = window, sendReport = defaultSendReport } = {}) {
  if (!shouldTrackLocalConsoleErrors(windowObj.location)) {
    return () => {};
  }
  if (windowObj[TRACKER_FLAG]) {
    return () => {};
  }
  windowObj[TRACKER_FLAG] = true;

  const originalConsoleError = windowObj.console.error.bind(windowObj.console);

  const handleWindowError = (event) => {
    const payload = buildErrorPayload(windowObj, event);
    queuePayload(payload, sendReport);
  };

  const handleUnhandledRejection = (event) => {
    const payload = buildRejectionPayload(windowObj, event);
    queuePayload(payload, sendReport);
  };

  windowObj.console.error = (...args) => {
    queuePayload(buildConsolePayload(windowObj, args), sendReport);
    return originalConsoleError(...args);
  };

  windowObj.addEventListener('error', handleWindowError, true);
  windowObj.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    windowObj.console.error = originalConsoleError;
    windowObj.removeEventListener('error', handleWindowError, true);
    windowObj.removeEventListener('unhandledrejection', handleUnhandledRejection);
    windowObj[TRACKER_FLAG] = false;
  };
}

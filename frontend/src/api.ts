/**
 * Centralized API module for Hermes frontend.
 * Handles base URL resolution, JWT auth headers, and JSON parsing.
 */

import type { ApiErrorPayload } from './contracts/api';

export class ApiRequestError extends Error {
  status: number;
  retryAfter?: string;

  constructor(message: string, status: number, retryAfter?: string | null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    if (retryAfter) this.retryAfter = retryAfter;
  }
}

/** Retries after the first attempt for Railway cold-start wake failures. */
export const WAKE_RETRY_MAX = 2;
export const WAKE_RETRY_DELAYS_MS = [1000, 2500] as const;
const WAKE_RETRYABLE_STATUSES = new Set([502, 503, 504]);

type WakeRetryListener = (active: boolean) => void;
const wakeRetryListeners = new Set<WakeRetryListener>();
let wakeRetryDepth = 0;

export function subscribeWakeRetry(listener: WakeRetryListener): () => void {
  wakeRetryListeners.add(listener);
  listener(wakeRetryDepth > 0);
  return () => {
    wakeRetryListeners.delete(listener);
  };
}

function setWakeRetryActive(active: boolean): void {
  if (active) {
    wakeRetryDepth += 1;
    if (wakeRetryDepth === 1) {
      wakeRetryListeners.forEach((listener) => listener(true));
    }
    return;
  }
  wakeRetryDepth = Math.max(0, wakeRetryDepth - 1);
  if (wakeRetryDepth === 0) {
    wakeRetryListeners.forEach((listener) => listener(false));
  }
}

/** GET/HEAD/OPTIONS only — never blindly retry POST mutations. */
export function isSafeWakeRetryMethod(method?: string): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
}

export function isWakeRetryableStatus(status: number): boolean {
  return WAKE_RETRYABLE_STATUSES.has(status);
}

export function isWakeRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Caller aborted — do not wake-retry.
  if (error.name === 'AbortError') return false;
  if (error.name === 'TypeError') return true;
  const message = error.message.toLowerCase();
  return message.includes('network')
    || message.includes('failed to fetch')
    || message.includes('fetch failed')
    || message.includes('timeout')
    || message.includes('timed out');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry helper for Railway sleep wake: network blips + 502/503/504 on safe methods.
 * Does not retry 401/400 or unsafe methods (POST/PUT/PATCH/DELETE).
 */
export async function withWakeRetry<T>(
  operation: () => Promise<T>,
  options: {
    method?: string;
    shouldRetryResult?: (result: T) => boolean;
    maxRetries?: number;
    delaysMs?: readonly number[];
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? WAKE_RETRY_MAX;
  const delays = options.delaysMs ?? WAKE_RETRY_DELAYS_MS;
  const allowRetry = isSafeWakeRetryMethod(options.method);

  let attempt = 0;
  let wakeNotified = false;

  try {
    while (true) {
      try {
        const result = await operation();
        if (
          allowRetry
          && typeof options.shouldRetryResult === 'function'
          && options.shouldRetryResult(result)
          && attempt < maxRetries
        ) {
          if (!wakeNotified) {
            setWakeRetryActive(true);
            wakeNotified = true;
          }
          const delay = delays[Math.min(attempt, delays.length - 1)] ?? 500;
          attempt += 1;
          await sleep(delay);
          continue;
        }
        return result;
      } catch (error) {
        if (allowRetry && isWakeRetryableNetworkError(error) && attempt < maxRetries) {
          if (!wakeNotified) {
            setWakeRetryActive(true);
            wakeNotified = true;
          }
          const delay = delays[Math.min(attempt, delays.length - 1)] ?? 500;
          attempt += 1;
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
  } finally {
    if (wakeNotified) setWakeRetryActive(false);
  }
}

export function resolveBackendBaseUrl(
  _location: Pick<Location, 'hostname' | 'port'>,
  _isDev: boolean,
): string {
  // Development requests must stay on the frontend origin so Vite's /api
  // proxy can forward them without requiring backend CORS configuration.
  // Production is served by the same backend origin, so relative URLs work
  // there as well.
  return '';
}

export function getBackendBaseUrl(): string {
  return resolveBackendBaseUrl(window.location, Boolean(import.meta.env && import.meta.env.DEV));
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getBackendBaseUrl();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept-Language')) {
    const storedLanguage = localStorage.getItem('hermes_lang');
    const browserLanguage = typeof navigator !== 'undefined'
      ? navigator.languages?.[0] || navigator.language || 'en'
      : 'en';
    headers.set('Accept-Language', storedLanguage || browserLanguage);
  }
  const token = localStorage.getItem('hermes_jwt');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = typeof options.method === 'string' ? options.method : 'GET';
  return withWakeRetry(
    () => fetch(`${baseUrl}${url}`, { ...options, headers }),
    {
      method,
      shouldRetryResult: (response) => isWakeRetryableStatus(response.status),
    },
  );
}

export async function apiJson<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(url, options);
  if (response.status === 401) {
    localStorage.removeItem('hermes_jwt');
    localStorage.removeItem('hermes_email');
    localStorage.removeItem('hermes_role');
    try {
      localStorage.removeItem('hermes_admin');
    } catch { /* ignore */ }
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const contentType = response.headers.get('content-type') || '';
  const data: unknown = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    const payload = isApiErrorPayload(data) ? data : {};
    const retryAfter = response.headers.get('retry-after');
    throw new ApiRequestError(payload.error || payload.message || 'Request failed', response.status, retryAfter);
  }
  return data as T;
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return (payload.error === undefined || typeof payload.error === 'string')
    && (payload.message === undefined || typeof payload.message === 'string');
}

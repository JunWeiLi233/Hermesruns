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

export function getBackendBaseUrl(): string {
  const { hostname, port } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isDev = Boolean(import.meta.env && import.meta.env.DEV);
  if (!isDev) return '';
  if (!isLocalHost || port === '8080') return '';
  return 'http://localhost:8080';
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
  return fetch(`${baseUrl}${url}`, { ...options, headers });
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

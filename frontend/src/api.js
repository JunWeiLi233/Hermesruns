/**
 * Centralized API module for Hermes frontend.
 * Handles base URL resolution, JWT auth headers, and JSON parsing.
 */

export function getBackendBaseUrl() {
  const { hostname, port } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isLocalHost || port === '8080') return '';
  return 'http://localhost:8080';
}

export async function apiFetch(url, options = {}) {
  const baseUrl = getBackendBaseUrl();
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('hermes_jwt');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${baseUrl}${url}`, { ...options, headers });
}

export async function apiJson(url, options = {}) {
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
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data;
}

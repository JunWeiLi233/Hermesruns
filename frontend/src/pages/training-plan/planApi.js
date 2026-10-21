import { apiFetch } from '../../api';
import { planReadOnly } from '../../utils/trainingPlanCache';

export async function planRequest(path, { body, ...options } = {}) {
  if (body && planReadOnly()) throw Object.assign(new Error('OFFLINE_READ_ONLY'), { code: 'OFFLINE_READ_ONLY' });
  const response = await apiFetch(path, {
    ...options,
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.code || 'REQUEST_FAILED');
    Object.assign(error, { code: payload.code, status: response.status, fields: payload.fieldErrors || [], retryAfter: response.headers.get('Retry-After') });
    throw error;
  }
  return payload;
}

// A failed/ambiguous command keeps its key. Changing its reviewed payload gets a new key.
// Owner is the authenticated profile ID; storage and cache are never shared across accounts.
export async function planCommand(owner, path, payload) {
  const signature = JSON.stringify([path, payload]);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature))), b => b.toString(16).padStart(2, '0')).join('');
  const slot = `hermes-plan-command:${owner}:${digest}`;
  let key = sessionStorage.getItem(slot);
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(slot, key); }
  const result = await planRequest(path, { method: 'POST', body: { ...payload, clientKey: key } });
  sessionStorage.removeItem(slot);
  window.dispatchEvent(new Event('hermes-plan-changed'));
  return result;
}

export function addDays(date, count) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function mondayOf(date) { return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)); }
export function localDate(zone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(p => parts.find(x => x.type === p)?.value).join('-');
}
export function defaultInputs(zone, units) {
  const startDate = localDate(zone);
  return { schemaVersion: 1, goalKind: 'DISTANCE', goalDistanceM: 5000, startDate, endDate: addDays(startDate, 83),
    timeZone: zone, adultConfirmed: false, experience: 'BEGINNER', trainingMode: 'RUN_WALK', baselineWeeklyM: 0,
    baselineRunsPerWeek: 0, longestRecentM: 0, canWalk20Minutes: false, availableWeekdays: [2, 4, 7], runsPerWeek: 3,
    longRunWeekday: 7, volume: 'STANDARD', difficulty: 'EASY', recentResult: null, title: '', eventName: '', units };
}

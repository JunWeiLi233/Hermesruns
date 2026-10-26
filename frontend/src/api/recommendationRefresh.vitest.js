import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '../api';
import { invalidateResourceCache } from './resourceCache';

vi.mock('./resourceCache', () => ({ invalidateResourceCache: vi.fn() }));
let changed;
beforeEach(() => {
  localStorage.clear();
  changed=vi.fn();window.addEventListener('hermes-recommendations-changed',changed);
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json'}})));
});
afterEach(() => {window.removeEventListener('hermes-recommendations-changed',changed);vi.unstubAllGlobals();});

it('invalidates activity and dashboard snapshots and notifies all consumers after a saved adjustment', async () => {
  await apiFetch('/api/coach/today/ease',{method:'POST',body:'{"enabled":true}'});
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/profile');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('hermes_recommendation_revision')).toBeTruthy();
});
it('does not cause refresh loops on ordinary recommendation reads', async () => {
  await apiFetch('/api/coach/today');
  expect(changed).not.toHaveBeenCalled();
  expect(invalidateResourceCache).not.toHaveBeenCalled();
});
it('does not announce failed writes as changed recommendations', async () => {
  fetch.mockResolvedValue(new Response('{}',{status:400}));
  await apiFetch('/api/coach/today/ease',{method:'POST'});
  expect(changed).not.toHaveBeenCalled();
});
it.each(['/api/manual-runs', '/api/import/files', '/api/wellness/source-preferences'])('refreshes recommendations after a saved source update at %s', async (url) => {
  await apiFetch(url, { method: 'POST' });
  expect(changed).toHaveBeenCalledTimes(1);
});
it('waits for persisted input changes instead of announcing an accepted background import as complete', async () => {
  fetch.mockResolvedValue(new Response('{}', { status: 202 }));
  await apiFetch('/api/wellness/apple/import', { method: 'POST' });
  expect(changed).not.toHaveBeenCalled();
});

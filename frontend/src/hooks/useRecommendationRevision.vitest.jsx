import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useRecommendationRevision from './useRecommendationRevision';
import { apiJson } from '../api';
import { invalidateResourceCache } from '../api/resourceCache';

vi.mock('../api', () => ({ apiJson: vi.fn() }));
vi.mock('../api/resourceCache', () => ({ invalidateResourceCache: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('hermes_jwt', 'test-account-token');
  localStorage.setItem('hermes_email', 'refresh@example.test');
  apiJson.mockResolvedValue({ revision: 'initial' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shares one source check across consumers and refreshes both after a background recovery update', async () => {
  const a = renderHook(useRecommendationRevision);
  const b = renderHook(useRecommendationRevision);
  await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1));
  await act(async () => {});
  apiJson.mockResolvedValue({ revision: 'recovery-import-completed' });
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(a.result.current).toBeGreaterThan(0));
  expect(b.result.current).toBe(a.result.current);
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/profile');
});

it('polls without refreshing unchanged recommendations or announcing failed checks', async () => {
  vi.useFakeTimers();
  const view = renderHook(useRecommendationRevision);
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(apiJson).toHaveBeenCalledTimes(2);
  expect(view.result.current).toBe(0);
  apiJson.mockRejectedValue(new Error('offline'));
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(view.result.current).toBe(0);
  expect(invalidateResourceCache).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(apiJson).toHaveBeenCalledTimes(3);
});

it('does not request private recommendations while signed out', async () => {
  localStorage.clear();
  renderHook(useRecommendationRevision);
  await act(async () => {});
  expect(apiJson).not.toHaveBeenCalled();
});

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useTrainingLog from './useTrainingLog';
import { apiJson } from '../../api';
vi.mock('../../api', () => ({ apiJson: vi.fn() }));
vi.mock('../../api/resourceCache', () => ({ invalidateResourceCache: vi.fn() }));
afterEach(cleanup);

it('refreshes actual log totals after the same source change as the recommendations', async () => {
  localStorage.clear();
  const initial = { today: '2026-10-16', weeks: [], runTypes: [], tags: [], olderRuns: false };
  apiJson.mockResolvedValue(initial);
  const view = renderHook(() => useTrainingLog());
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  const updated = { ...initial, weeks: [{ start: '2026-10-12', end: '2026-10-18', distanceKm: 35.345 }] };
  apiJson.mockResolvedValue(updated);
  await act(async () => { window.dispatchEvent(new Event('hermes-recommendations-changed')); });
  await waitFor(() => expect(view.result.current.log).toEqual(updated));
});

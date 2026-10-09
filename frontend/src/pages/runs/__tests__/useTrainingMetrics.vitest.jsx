import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import useTrainingMetrics from '../useTrainingMetrics';

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));

const payload = (score) => ({
  activityId: 1,
  effort: { score, source: 'HR_ZONES', perceivedExertion: null },
  heartRate: { hasStream: true, zones: [] },
});

beforeEach(() => {
  apiJson.mockReset();
});

describe('useTrainingMetrics', () => {
  it('loads the numbers of the run it is given', async () => {
    apiJson.mockResolvedValue(payload(100));
    const { result } = renderHook(() => useTrainingMetrics(41));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.effort.score).toBe(100);
    expect(apiJson).toHaveBeenCalledWith('/api/activities/41/training-metrics', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('does not ask for a run it does not have', () => {
    renderHook(() => useTrainingMetrics(null));
    expect(apiJson).not.toHaveBeenCalled();
  });

  it('never hands out the numbers of the old run for the next run, not even for one render', async () => {
    apiJson.mockResolvedValueOnce(payload(100));
    const renders = [];
    const { result, rerender } = renderHook(({ runId }) => {
      const value = useTrainingMetrics(runId);
      renders.push({ runId, status: value.status, score: value.data?.effort.score ?? null });
      return value;
    }, { initialProps: { runId: 1 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let release;
    apiJson.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(payload(55)); }));
    rerender({ runId: 2 });
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe('loading');
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.data?.effort.score).toBe(55));

    const forSecondRun = renders.filter((entry) => entry.runId === 2);
    expect(forSecondRun.length).toBeGreaterThan(1);
    expect(forSecondRun.every((entry) => entry.score !== 100)).toBe(true);
    expect(forSecondRun[0]).toEqual({ runId: 2, status: 'loading', score: null });
  });

  it('keeps the numbers on screen while it reloads, and when the reload fails', async () => {
    apiJson.mockResolvedValueOnce(payload(100));
    const { result } = renderHook(() => useTrainingMetrics(1));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let fail;
    apiJson.mockImplementationOnce(() => new Promise((_, reject) => { fail = () => reject(new Error('down')); }));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('refreshing'));
    expect(result.current.data.effort.score).toBe(100);

    await act(async () => { fail(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.effort.score).toBe(100);
  });

  it('reports an error when there is nothing to show', async () => {
    apiJson.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));
    const { result } = renderHook(() => useTrainingMetrics(1));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });

  it('treats an answer without the expected parts as an error', async () => {
    apiJson.mockResolvedValue({});
    const { result } = renderHook(() => useTrainingMetrics(1));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });
});

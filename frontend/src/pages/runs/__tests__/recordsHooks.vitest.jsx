import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import useBestEffortsAnalysis from '../../profile/useBestEffortsAnalysis';
import useRunBestEfforts from '../useRunBestEfforts';
import useRunMatches from '../useRunMatches';
import { aloneOnItsRoute, analysis, matches, NO_EFFORTS_ANALYSIS, runEfforts } from './recordsFixtures';

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));

beforeEach(() => {
  apiJson.mockReset();
});

describe('useRunBestEfforts', () => {
  it('loads the efforts of the run it is given', async () => {
    apiJson.mockResolvedValue(runEfforts());
    const { result } = renderHook(() => useRunBestEfforts(41));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.efforts).toHaveLength(4);
    expect(apiJson).toHaveBeenCalledWith('/api/activities/41/best-efforts', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('holds the request back until it is enabled', async () => {
    apiJson.mockResolvedValue(runEfforts());
    const { result, rerender } = renderHook(({ enabled }) => useRunBestEfforts(41, { enabled }), { initialProps: { enabled: false } });

    expect(result.current.status).toBe('loading');
    expect(apiJson).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it('accepts a run with no efforts as an answer', async () => {
    apiJson.mockResolvedValue(runEfforts({ efforts: [] }));
    const { result } = renderHook(() => useRunBestEfforts(41));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.efforts).toEqual([]);
  });

  it.each([
    ['an empty answer', {}],
    ['efforts that are not a list', { complete: true, efforts: null }],
    ['no word on whether the records are complete', { efforts: [] }],
    ['text', 'nope'],
  ])('treats %s as a failed load rather than drawing it', async (_name, answer) => {
    apiJson.mockResolvedValue(answer);
    const { result } = renderHook(() => useRunBestEfforts(41));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });

  it('asks nothing for no run', () => {
    renderHook(() => useRunBestEfforts(null));
    expect(apiJson).not.toHaveBeenCalled();
  });

  it('never hands the efforts of one run to another', async () => {
    apiJson.mockResolvedValueOnce(runEfforts());
    const { result, rerender } = renderHook(({ id }) => useRunBestEfforts(id), { initialProps: { id: 41 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    apiJson.mockImplementationOnce(() => new Promise(() => {}));
    rerender({ id: 42 });
    expect(result.current.data).toBeNull();
    expect(apiJson).toHaveBeenLastCalledWith('/api/activities/42/best-efforts', expect.anything());
  });
});

describe('useRunMatches', () => {
  it('loads the runs over the same route as the run it is given', async () => {
    apiJson.mockResolvedValue(matches());
    const { result } = renderHook(() => useRunMatches(41));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.runs).toHaveLength(4);
    expect(apiJson).toHaveBeenCalledWith('/api/activities/41/matches', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('holds the request back until it is enabled', async () => {
    apiJson.mockResolvedValue(matches());
    const { result, rerender } = renderHook(({ enabled }) => useRunMatches(41, { enabled }), { initialProps: { enabled: false } });

    expect(apiJson).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('accepts a run that is alone on its route, and one with no route, as answers', async () => {
    apiJson.mockResolvedValueOnce(aloneOnItsRoute());
    const first = renderHook(() => useRunMatches(41));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    expect(first.result.current.data.runs).toEqual([]);

    apiJson.mockResolvedValueOnce(aloneOnItsRoute({ groupId: null }));
    const second = renderHook(() => useRunMatches(42));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(second.result.current.data.groupId).toBeNull();
  });

  it.each([
    ['an empty answer', {}],
    ['runs that are not a list', { complete: true, count: 2, runs: null }],
    ['no count', { complete: true, runs: [] }],
    ['no word on whether the records are complete', { count: 0, runs: [] }],
  ])('treats %s as a failed load rather than drawing it', async (_name, answer) => {
    apiJson.mockResolvedValue(answer);
    const { result } = renderHook(() => useRunMatches(41));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('useBestEffortsAnalysis', () => {
  it('asks nothing until it is enabled, and nothing at all for the first paint of the page', async () => {
    apiJson.mockResolvedValue(analysis());
    const { result, rerender } = renderHook(({ enabled }) => useBestEffortsAnalysis({ enabled }), { initialProps: { enabled: false } });

    expect(result.current.status).toBe('loading');
    expect(apiJson).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(apiJson).toHaveBeenCalledTimes(1);
    expect(apiJson.mock.calls[0][0]).toBe('/api/training/best-efforts');
  });

  it('leaves the choice of distance and year to the server when it is not given one', async () => {
    apiJson.mockResolvedValue(analysis());
    renderHook(() => useBestEffortsAnalysis({ enabled: true }));
    await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1));
    expect(apiJson.mock.calls[0][0]).toBe('/api/training/best-efforts');
  });

  it.each([
    [{ distance: '10km' }, '/api/training/best-efforts?distance=10km'],
    [{ year: 2025 }, '/api/training/best-efforts?year=2025'],
    [{ distance: 'half', year: 2024 }, '/api/training/best-efforts?distance=half&year=2024'],
  ])('asks for %o', async (choice, url) => {
    apiJson.mockResolvedValue(analysis());
    renderHook(() => useBestEffortsAnalysis({ enabled: true, ...choice }));
    await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1));
    expect(apiJson.mock.calls[0][0]).toBe(url);
  });

  it('asks again when the choice changes', async () => {
    apiJson.mockResolvedValue(analysis());
    const { result, rerender } = renderHook(({ distance }) => useBestEffortsAnalysis({ enabled: true, distance }), { initialProps: { distance: null } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ distance: '10km' });
    await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(2));
    expect(apiJson.mock.calls[1][0]).toBe('/api/training/best-efforts?distance=10km');
  });

  it('accepts a runner with no efforts as an answer', async () => {
    apiJson.mockResolvedValue(NO_EFFORTS_ANALYSIS);
    const { result } = renderHook(() => useBestEffortsAnalysis({ enabled: true }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.key).toBeNull();
  });

  it.each([
    ['an empty answer', {}],
    ['lists that are not lists', { complete: true, distances: [], years: [], lifetime: null, annual: [], trend: [] }],
    ['no trend', { complete: true, distances: [], years: [], lifetime: [], annual: [] }],
    ['no word on whether the records are complete', { distances: [], years: [], lifetime: [], annual: [], trend: [] }],
  ])('treats %s as a failed load rather than drawing it', async (_name, answer) => {
    apiJson.mockResolvedValue(answer);
    const { result } = renderHook(() => useBestEffortsAnalysis({ enabled: true }));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

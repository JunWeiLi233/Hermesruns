import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../api';
import { goal, response } from './goalFixtures';
import useGoals from './useGoals';

vi.mock('../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));

let respond;
const urls = () => apiJson.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  apiJson.mockReset();
  respond = () => response([goal({ id: 1 })]);
  apiJson.mockImplementation(async (url, options) => {
    const result = await respond(String(url), options);
    if (result instanceof Error) throw result;
    return result;
  });
});
afterEach(() => {
  delete window.requestIdleCallback;
  delete window.cancelIdleCallback;
});

describe('loading', () => {
  it('starts out loading and is ready with the goals once they arrive', async () => {
    const { result } = renderHook(() => useGoals());

    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.goals).toHaveLength(1);
    expect(urls()).toEqual(['/api/goals']);
  });

  it('is an error, with nothing to show, when the goals cannot be loaded, and loads them again on request', async () => {
    respond = () => Object.assign(new Error('boom'), { status: 500 });
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();

    respond = () => response([goal({ id: 1 })]);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it.each([
    ['goals that are not a list', { goals: 'none', periods: [], metrics: [] }],
    ['no periods', { goals: [], metrics: [] }],
    ['nothing at all', null],
  ])('treats %s as a failed load', async (_name, answer) => {
    respond = () => answer;
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('keeps the goals it has when a reload fails', async () => {
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    respond = () => new Error('later');
    act(() => result.current.reload());
    await waitFor(() => expect(urls()).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(result.current.status).toBe('ready');
    expect(result.current.data.goals).toHaveLength(1);
  });

  it('names the run in the request', async () => {
    renderHook(() => useGoals({ runId: 77 }));
    await waitFor(() => expect(urls()).toEqual(['/api/goals?runId=77']));
  });

  it('waits for the browser to be idle before it asks, when told to', async () => {
    let idle;
    window.requestIdleCallback = (callback) => { idle = callback; return 3; };
    window.cancelIdleCallback = vi.fn();
    const { result, unmount } = renderHook(() => useGoals({ defer: true }));

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(urls()).toEqual([]);
    expect(result.current.status).toBe('loading');

    act(() => idle());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(urls()).toEqual(['/api/goals']);
    unmount();
    expect(window.cancelIdleCallback).toHaveBeenCalledWith(3);
  });

  it('falls back to a short timer where the browser has no idle callback', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useGoals({ defer: true }));
      expect(urls()).toEqual([]);

      await act(async () => { await vi.advanceTimersByTimeAsync(300); });

      expect(urls()).toEqual(['/api/goals']);
      expect(result.current.status).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('changing goals', () => {
  it('sets a goal, takes the answer as the new list and says it went well', async () => {
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = (url, options) => (options?.method === 'POST' ? response([goal({ id: 1 }), goal({ id: 2, period: 'YEAR' })]) : response([goal({ id: 1 })]));

    let outcome;
    await act(async () => { outcome = await result.current.create('YEAR', 'DISTANCE', 1000); });

    expect(outcome).toEqual({ ok: true });
    expect(result.current.data.goals).toHaveLength(2);
    const post = apiJson.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(post[0]).toBe('/api/goals');
    expect(post[1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(post[1].body)).toEqual({ period: 'YEAR', metric: 'DISTANCE', target: 1000 });
  });

  it('changes a target and deletes a goal at the goal\'s own address', async () => {
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { await result.current.changeTarget(1, 55.5); });
    await act(async () => { await result.current.remove(1); });

    const put = apiJson.mock.calls.find(([, options]) => options?.method === 'PUT');
    expect(put[0]).toBe('/api/goals/1');
    expect(JSON.parse(put[1].body)).toEqual({ target: 55.5 });
    const del = apiJson.mock.calls.find(([, options]) => options?.method === 'DELETE');
    expect(del[0]).toBe('/api/goals/1');
    expect(del[1].body).toBeUndefined();
  });

  it('answers with the status of a request that fails, and 0 when it never got an answer', async () => {
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    respond = () => Object.assign(new Error('exists'), { status: 409 });
    let conflict;
    await act(async () => { conflict = await result.current.create('WEEK', 'DISTANCE', 5); });
    respond = () => new Error('offline');
    let offline;
    await act(async () => { offline = await result.current.remove(1); });

    expect(conflict).toEqual({ ok: false, status: 409 });
    expect(offline).toEqual({ ok: false, status: 0 });
    expect(result.current.data.goals).toHaveLength(1);
  });

  it('treats an answer to a change that is not a list of goals as a failure and keeps what it has', async () => {
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = () => ({ ok: true });

    let outcome;
    await act(async () => { outcome = await result.current.create('WEEK', 'COUNT', 3); });

    expect(outcome).toEqual({ ok: false, status: 0 });
    expect(result.current.data.goals).toHaveLength(1);
  });

  it('asks again with the run named after a change, since the answer to a change does not carry it', async () => {
    const { result } = renderHook(() => useGoals({ runId: 9 }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { await result.current.changeTarget(1, 80); });
    await waitFor(() => expect(urls().filter((url) => url === '/api/goals?runId=9')).toHaveLength(2));
  });

  it('does not ask again after a change when no run is named', async () => {
    const { result } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { await result.current.changeTarget(1, 80); });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(urls().filter((url) => url === '/api/goals')).toHaveLength(1);
  });

  it('does not touch its state after it has gone', async () => {
    const { result, unmount } = renderHook(() => useGoals());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(response([])); });

    let pending;
    act(() => { pending = result.current.create('WEEK', 'COUNT', 3); });
    unmount();
    release();

    await expect(pending).resolves.toEqual({ ok: true });
  });
});

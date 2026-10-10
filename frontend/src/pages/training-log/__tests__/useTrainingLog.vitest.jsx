import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../../api';
import useTrainingLog from '../useTrainingLog';
import { day, log, run, week } from './trainingLogFixtures';

vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));

let respond;
const urls = () => apiJson.mock.calls.map(([url]) => String(url));
const earlier = () => log({ weeks: [week('2026-09-14', [day('2026-09-15', [run({ id: 31 })])]), week('2026-09-07', [])], olderRuns: false });

beforeEach(() => {
  apiJson.mockReset();
  respond = (url) => (url.includes('to=') ? earlier() : log());
  apiJson.mockImplementation(async (url) => {
    const result = await respond(String(url));
    if (result instanceof Error) throw result;
    return result;
  });
});

describe('the first weeks', () => {
  it('starts out loading and is ready with the weeks once they arrive', async () => {
    const { result } = renderHook(() => useTrainingLog({ runType: '', tags: [] }));

    expect(result.current.status).toBe('loading');
    expect(result.current.log).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.log.weeks).toHaveLength(3);
    expect(result.current.more).toBe('idle');
    expect(urls()).toEqual(['/api/training/log?weeks=12']);
  });

  it('is an error, with nothing to show, when the answer cannot be loaded, and loads again on request', async () => {
    respond = () => new Error('boom');
    const { result } = renderHook(() => useTrainingLog({}));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.log).toBeNull();

    respond = () => log();
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(urls()).toHaveLength(2);
  });

  it('puts the filters in the request', async () => {
    renderHook(() => useTrainingLog({ runType: 'RACE', tags: ['hills', 'with the dog'] }));
    await waitFor(() => expect(urls()).toEqual(['/api/training/log?weeks=12&runType=RACE&tag=hills&tag=with+the+dog']));
  });
});

describe('earlier weeks', () => {
  it('adds the weeks before the oldest one it has, and takes the answer about even older runs from the last page', async () => {
    const { result } = renderHook(() => useTrainingLog({ runType: '', tags: [] }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.log.olderRuns).toBe(true);

    await act(async () => { await result.current.loadMore(); });

    expect(urls()).toContain('/api/training/log?weeks=12&to=2026-09-20');
    expect(result.current.log.weeks.map((one) => one.start)).toEqual(['2026-10-05', '2026-09-28', '2026-09-21', '2026-09-14', '2026-09-07']);
    expect(result.current.log.olderRuns).toBe(false);
    expect(result.current.more).toBe('idle');
  });

  it('ignores a second request for them while the first is on its way', async () => {
    const { result } = renderHook(() => useTrainingLog({ runType: '', tags: [] }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(earlier()); });

    await act(async () => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(urls().filter((url) => url.includes('to='))).toHaveLength(1);
    expect(result.current.more).toBe('loading');

    await act(async () => { release(); });
    await waitFor(() => expect(result.current.more).toBe('idle'));
    expect(result.current.log.weeks).toHaveLength(5);
  });

  it('keeps the weeks it has and says so when earlier ones cannot be loaded', async () => {
    const { result } = renderHook(() => useTrainingLog({ runType: '', tags: [] }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = () => new Error('nope');

    await act(async () => { await result.current.loadMore(); });

    expect(result.current.more).toBe('error');
    expect(result.current.status).toBe('ready');
    expect(result.current.log.weeks).toHaveLength(3);
  });

  it('asks for nothing before the first weeks are in', async () => {
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(log()); });
    const { result } = renderHook(() => useTrainingLog({}));

    await act(async () => { await result.current.loadMore(); });

    expect(urls().filter((url) => url.includes('to='))).toHaveLength(0);
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('treats an answer without the parts the page draws as a failure to load more, not as weeks', async () => {
    const { result } = renderHook(() => useTrainingLog({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = () => ({ weeks: 'none' });

    await act(async () => { await result.current.loadMore(); });

    expect(result.current.more).toBe('error');
    expect(result.current.log.weeks).toHaveLength(3);
  });
});

describe('changing the filters', () => {
  it('keeps the earlier weeks, as refreshing, until the new ones arrive', async () => {
    const { result, rerender } = renderHook((props) => useTrainingLog(props), { initialProps: { runType: '', tags: [] } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(log({ weeks: [week('2026-10-05', [])] })); });

    rerender({ runType: 'RACE', tags: [] });

    await waitFor(() => expect(result.current.status).toBe('refreshing'));
    expect(result.current.log.weeks).toHaveLength(3);
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.log.weeks).toHaveLength(1);
  });

  it('shows an error, and not the weeks of the old filters, when the new ones cannot be loaded', async () => {
    const { result, rerender } = renderHook((props) => useTrainingLog(props), { initialProps: { runType: '', tags: [] } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = () => new Error('boom');

    rerender({ runType: 'RACE', tags: [] });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.log).toBeNull();
  });

  it('does not start again for filters that are the same', async () => {
    const { result, rerender } = renderHook((props) => useTrainingLog(props), { initialProps: { runType: 'RACE', tags: ['a'] } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ runType: 'RACE', tags: ['a'] });

    expect(urls()).toHaveLength(1);
  });
});

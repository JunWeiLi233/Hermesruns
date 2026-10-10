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

describe('saying whether more weeks were added', () => {
  it('says so for earlier weeks that came in, and not when there was nothing to ask or the answer was refused', async () => {
    const { result } = renderHook(() => useTrainingLog({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let added;
    await act(async () => { added = await result.current.loadMore(); });
    expect(added).toBe(true);

    respond = () => new Error('nope');
    await act(async () => { added = await result.current.loadMore(); });
    expect(added).toBe(false);
    expect(result.current.more).toBe('error');
  });

  it('says no, without asking, before the first weeks are in', async () => {
    respond = () => new Promise(() => {});
    const { result } = renderHook(() => useTrainingLog({}));
    let added;
    await act(async () => { added = await result.current.loadMore(); });
    expect(added).toBe(false);
  });
});

describe('a jump to a day', () => {
  const jumped = () => log({ weeks: [week('2026-03-30', [day('2026-03-31', [run({ id: 41 })])]), week('2026-03-23', [])], olderRuns: true });
  const later = () => log({ weeks: [week('2026-04-13', [day('2026-04-14', [run({ id: 42 })])]), week('2026-04-06', [])], olderRuns: false });

  beforeEach(() => {
    respond = (url) => {
      if (url.includes('to=2026-06-28')) return later();
      if (url.includes('to=2026-03-31')) return jumped();
      return log();
    };
  });

  it('asks for the weeks ending with the week of the day, from the start', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(urls()).toEqual(['/api/training/log?weeks=12&to=2026-03-31']);
    expect(result.current.log.weeks[0].start).toBe('2026-03-30');
  });

  it('starts again, keeping the weeks it has as refreshing, when the day changes, and when it is taken away', async () => {
    const { result, rerender } = renderHook((props) => useTrainingLog(props), { initialProps: { to: '' } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(jumped()); });

    rerender({ to: '2026-03-31' });

    await waitFor(() => expect(result.current.status).toBe('refreshing'));
    expect(result.current.log.weeks).toHaveLength(3);
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.log.weeks).toHaveLength(2);
    expect(urls()).toEqual(['/api/training/log?weeks=12', '/api/training/log?weeks=12&to=2026-03-31']);

    respond = () => log();
    rerender({ to: '' });
    await waitFor(() => expect(result.current.log.weeks).toHaveLength(3));
    expect(urls().at(-1)).toBe('/api/training/log?weeks=12');
  });

  it('adds the weeks after the newest one, keeps the answer about older runs as it was and says it added them', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let added;
    await act(async () => { added = await result.current.loadNewer(); });

    expect(added).toBe(true);
    expect(urls()).toContain('/api/training/log?weeks=12&to=2026-06-28');
    expect(result.current.log.weeks.map((one) => one.start)).toEqual(['2026-04-13', '2026-04-06', '2026-03-30', '2026-03-23']);
    expect(result.current.log.olderRuns).toBe(true);
    expect(result.current.newer).toBe('idle');
    expect(result.current.more).toBe('idle');
  });

  it('says the log was started from a past day when the first weeks stop short of today, and not otherwise', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.jumped).toBe(true);
    const plain = renderHook(() => useTrainingLog({}));
    await waitFor(() => expect(plain.result.current.status).toBe('ready'));
    expect(plain.result.current.jumped).toBe(false);
    expect(renderHook(() => useTrainingLog({})).result.current.jumped).toBe(false);
  });

  it('is not jumped when the day is in the week going on', async () => {
    respond = () => log();
    const { result } = renderHook(() => useTrainingLog({ to: '2026-10-08' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.jumped).toBe(false);
  });

  it('keeps saying the log was started from a past day after later weeks have reached today', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = () => log({ weeks: [week('2026-10-05', []), week('2026-09-28', []), week('2026-09-21', [])] });

    await act(async () => { await result.current.loadNewer(); });

    expect(result.current.log.weeks[0].start).toBe('2026-10-05');
    expect(result.current.jumped).toBe(true);
  });

  it('works it out again for each fresh answer and for none that failed', async () => {
    const { result, rerender } = renderHook((props) => useTrainingLog(props), { initialProps: { to: '2026-03-31' } });
    await waitFor(() => expect(result.current.jumped).toBe(true));

    rerender({ to: '' });
    await waitFor(() => expect(result.current.jumped).toBe(false));

    rerender({ to: '2026-03-31' });
    await waitFor(() => expect(result.current.jumped).toBe(true));
    respond = () => new Error('boom');
    rerender({ to: '2026-02-28' });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.jumped).toBe(false);
  });

  it('carries the filters along when it asks for later weeks', async () => {
    const { result } = renderHook(() => useTrainingLog({ runType: 'RACE', tags: ['a'], to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { await result.current.loadNewer(); });

    expect(urls()).toContain('/api/training/log?weeks=12&to=2026-06-28&runType=RACE&tag=a');
  });

  it('asks for nothing, and says it added nothing, when the newest week is the one today is in', async () => {
    const { result } = renderHook(() => useTrainingLog({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let added;
    await act(async () => { added = await result.current.loadNewer(); });

    expect(added).toBe(false);
    expect(urls()).toHaveLength(1);
  });

  it('asks for nothing before the first weeks are in', async () => {
    respond = () => new Promise(() => {});
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await act(async () => { await result.current.loadNewer(); });
    expect(urls()).toHaveLength(1);
  });

  it('ignores a second request for later weeks while the first is on its way', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let release;
    respond = () => new Promise((resolve) => { release = () => resolve(later()); });

    await act(async () => {
      result.current.loadNewer();
      result.current.loadNewer();
    });
    expect(urls().filter((url) => url.includes('to=2026-06-28'))).toHaveLength(1);
    expect(result.current.newer).toBe('loading');

    await act(async () => { release(); });
    await waitFor(() => expect(result.current.newer).toBe('idle'));
    expect(result.current.log.weeks).toHaveLength(4);
  });

  it('can load earlier and later weeks at the same time, each in its own place', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const releases = {};
    respond = (url) => new Promise((resolve) => {
      releases[url.includes('to=2026-06-28') ? 'later' : 'earlier'] = () => resolve(url.includes('to=2026-06-28')
        ? later()
        : log({ weeks: [week('2026-03-16', []), week('2026-03-09', [])], olderRuns: false }));
    });

    await act(async () => {
      result.current.loadMore();
      result.current.loadNewer();
    });
    expect(result.current.more).toBe('loading');
    expect(result.current.newer).toBe('loading');
    await act(async () => { releases.later(); releases.earlier(); });

    await waitFor(() => expect(result.current.log.weeks).toHaveLength(6));
    expect(result.current.log.weeks.map((one) => one.start)).toEqual(['2026-04-13', '2026-04-06', '2026-03-30', '2026-03-23', '2026-03-16', '2026-03-09']);
    expect(result.current.log.olderRuns).toBe(false);
  });

  it('keeps the weeks it has and says so when later ones cannot be loaded', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = () => new Error('nope');

    let added;
    await act(async () => { added = await result.current.loadNewer(); });

    expect(added).toBe(false);
    expect(result.current.newer).toBe('error');
    expect(result.current.more).toBe('idle');
    expect(result.current.status).toBe('ready');
    expect(result.current.log.weeks).toHaveLength(2);
  });

  it('treats an answer without the parts the page draws as a failure to load later weeks', async () => {
    const { result } = renderHook(() => useTrainingLog({ to: '2026-03-31' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    respond = () => ({ weeks: 'none' });

    await act(async () => { await result.current.loadNewer(); });

    expect(result.current.newer).toBe('error');
    expect(result.current.log.weeks).toHaveLength(2);
  });

  it('throws away later weeks that were asked for under another day', async () => {
    const { result, rerender } = renderHook((props) => useTrainingLog(props), { initialProps: { to: '2026-03-31' } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const gate = {};
    respond = (url) => (url.includes('to=2026-06-28')
      ? new Promise((resolve) => { gate.release = () => resolve(later()); })
      : log({ weeks: [week('2026-02-23', [])], olderRuns: false }));
    let pending;
    act(() => { pending = result.current.loadNewer(); });
    await waitFor(() => expect(result.current.newer).toBe('loading'));

    rerender({ to: '2026-02-28' });
    await waitFor(() => expect(result.current.log.weeks.map((one) => one.start)).toEqual(['2026-02-23']));
    let added;
    await act(async () => { gate.release(); added = await pending; });

    expect(added).toBe(false);
    expect(result.current.log.weeks.map((one) => one.start)).toEqual(['2026-02-23']);
    expect(result.current.newer).toBe('idle');
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

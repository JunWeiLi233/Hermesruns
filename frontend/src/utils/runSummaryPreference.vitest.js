import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_KEY,
  HIDDEN_KEY,
  MAX_HIDDEN_RUNS,
  forgetMemory,
  readEnabled,
  readHiddenRuns,
  useRunSummariesEnabled,
  useRunSummaryPreference,
  writeEnabled,
  writeHidden,
} from './runSummaryPreference';

beforeEach(() => {
  localStorage.clear();
  forgetMemory();
});
afterEach(() => vi.restoreAllMocks());

describe('whether the summary is on', () => {
  it('is on for a runner who has never chosen, and for anything in storage that is not "off"', () => {
    expect(readEnabled()).toBe(true);
    localStorage.setItem(ALL_KEY, 'maybe');
    forgetMemory();
    expect(readEnabled()).toBe(true);
    localStorage.setItem(ALL_KEY, '');
    forgetMemory();
    expect(readEnabled()).toBe(true);
  });

  it('is turned off by writing off, and on again by taking the choice away, keeping nothing for the default', () => {
    writeEnabled(false);
    expect(localStorage.getItem(ALL_KEY)).toBe('off');
    expect(readEnabled()).toBe(false);

    writeEnabled(true);
    expect(localStorage.getItem(ALL_KEY)).toBeNull();
    expect(readEnabled()).toBe(true);
  });
});

describe('the runs it is hidden on', () => {
  it('starts with none, hides a run and shows it again', () => {
    expect(readHiddenRuns()).toEqual([]);
    writeHidden(7, true);
    writeHidden(9, true);
    expect(readHiddenRuns()).toEqual([7, 9]);

    writeHidden(7, false);
    expect(readHiddenRuns()).toEqual([9]);
    writeHidden(9, false);
    expect(readHiddenRuns()).toEqual([]);
    expect(localStorage.getItem(HIDDEN_KEY)).toBeNull();
  });

  it('hides a run once however many times it is hidden, the latest hide last', () => {
    writeHidden(7, true);
    writeHidden(9, true);
    writeHidden(7, true);

    expect(readHiddenRuns()).toEqual([9, 7]);
  });

  it.each([0, -3, 1.5, NaN, '7', null, undefined])('does not take %s for a run', (id) => {
    writeHidden(id, true);
    expect(readHiddenRuns()).toEqual([]);
    expect(localStorage.getItem(HIDDEN_KEY)).toBeNull();
  });

  it('keeps the last five hundred only, dropping the oldest', () => {
    for (let id = 1; id <= MAX_HIDDEN_RUNS + 2; id += 1) writeHidden(id, true);

    const kept = readHiddenRuns();
    expect(kept).toHaveLength(MAX_HIDDEN_RUNS);
    expect(kept[0]).toBe(3);
    expect(kept.at(-1)).toBe(MAX_HIDDEN_RUNS + 2);
  });

  it('ignores whatever in storage is not a list of run ids', () => {
    for (const [stored, expected] of [['nonsense', []], ['{"a":1}', []], ['[1,"x",-3,2.5,7,null]', [1, 7]]]) {
      localStorage.setItem(HIDDEN_KEY, stored);
      forgetMemory();
      expect(readHiddenRuns()).toEqual(expected);
    }
  });

  it('starts from what an earlier visit left in storage', () => {
    localStorage.setItem(ALL_KEY, 'off');
    localStorage.setItem(HIDDEN_KEY, '[4,8]');

    expect(readEnabled()).toBe(false);
    expect(readHiddenRuns()).toEqual([4, 8]);
    writeHidden(9, true);
    expect(JSON.parse(localStorage.getItem(HIDDEN_KEY))).toEqual([4, 8, 9]);
  });

  it('is kept apart from the choice for every run: turning summaries back on leaves a hidden run hidden', () => {
    writeHidden(7, true);
    writeEnabled(false);
    writeEnabled(true);

    expect(readHiddenRuns()).toEqual([7]);
  });
});

describe('a browser that will not store', () => {
  it('still keeps the choices until the page is closed when storage refuses them', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });

    expect(readEnabled()).toBe(true);
    writeEnabled(false);
    expect(readEnabled()).toBe(false);
    writeHidden(7, true);
    expect(readHiddenRuns()).toEqual([7]);
    writeHidden(7, false);
    expect(readHiddenRuns()).toEqual([]);
    writeEnabled(true);
    expect(readEnabled()).toBe(true);
  });

  it('works the same when there is no storage at all', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });

    writeEnabled(false);
    writeHidden(7, true);

    expect(readEnabled()).toBe(false);
    expect(readHiddenRuns()).toEqual([7]);
  });
});

describe('what the page sees', () => {
  it('follows a change made elsewhere on the page, such as the Settings switch', () => {
    const { result } = renderHook(() => useRunSummariesEnabled());
    expect(result.current[0]).toBe(true);

    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);

    act(() => writeEnabled(true));
    expect(result.current[0]).toBe(true);
  });

  it('follows a change made in another tab', () => {
    const { result } = renderHook(() => useRunSummariesEnabled());

    act(() => {
      localStorage.setItem(ALL_KEY, 'off');
      window.dispatchEvent(new StorageEvent('storage', { key: ALL_KEY }));
    });
    expect(result.current[0]).toBe(false);

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(result.current[0]).toBe(true);
  });

  it('ignores the storage events of other keys', () => {
    const { result } = renderHook(() => useRunSummariesEnabled());
    localStorage.setItem(ALL_KEY, 'off');

    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'hermes_theme' })); });

    expect(result.current[0]).toBe(true);
  });

  it('says for one run whether it is hidden there, whatever happens to the others', () => {
    const { result } = renderHook(() => useRunSummaryPreference(7));
    const other = renderHook(() => useRunSummaryPreference(9));
    expect(result.current).toMatchObject({ enabled: true, hidden: false });

    act(() => result.current.setHidden(true));
    expect(result.current.hidden).toBe(true);
    expect(other.result.current.hidden).toBe(false);

    act(() => result.current.setHidden(false));
    expect(result.current.hidden).toBe(false);
  });

  it('says it is off for every run when it is turned off, and on a run it was hidden on before', () => {
    writeHidden(7, true);
    const { result } = renderHook(() => useRunSummaryPreference(7));
    expect(result.current).toMatchObject({ enabled: true, hidden: true });

    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(result.current.hidden).toBe(true);
  });

  it('does not say a run is hidden when it has no id yet', () => {
    const { result } = renderHook(() => useRunSummaryPreference(undefined));
    expect(result.current.hidden).toBe(false);
  });
});

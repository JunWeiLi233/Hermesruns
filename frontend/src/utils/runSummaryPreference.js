/**
 * Whether the run summary is shown: on every run, and on each one. Both are kept in the browser, like the distance unit and
 * the theme, so no account setting and no request is involved (see docs/README-ANALYSIS.md, "Run Summary"). Plain functions
 * over the browser's storage plus a tiny subscription, so the card and the Settings page stay in step and the rules can be
 * tested.
 *
 * - `hermes_run_summaries`: 'off' when the summary is turned off for every run; anything else (or nothing) is on.
 * - `hermes_run_summaries_hidden`: the ids of the runs it is hidden on, as a JSON list, the newest hide last. Kept to the last
 *   `MAX_HIDDEN_RUNS` so it cannot grow for ever.
 *
 * What is chosen is held in memory for the page that is open and written through to storage, so a browser that will not store
 * (a private window, a full disk) still works until the page is closed. Storage is read once and again only when another tab
 * changes it.
 */
import { useCallback, useSyncExternalStore } from 'react';

export const ALL_KEY = 'hermes_run_summaries';
export const HIDDEN_KEY = 'hermes_run_summaries_hidden';
export const MAX_HIDDEN_RUNS = 500;
const CHANGE_EVENT = 'hermes:run-summaries';

/** What this page knows; undefined until it has looked in storage (and again after another tab has changed it). */
const memory = { all: undefined, hidden: undefined };

/** For tests: forgets what was held in memory, so the next read goes to storage. */
export function forgetMemory() {
  memory.all = undefined;
  memory.hidden = undefined;
}

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read(key) {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Writes through to storage; a browser that refuses is ignored, since the page still has what was chosen. */
function write(key, value) {
  const store = storage();
  if (!store) return;
  try {
    if (value == null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // Nothing to do: the choice lives on in memory until the page is closed.
  }
}

/** Whether the summary is on for runs in general. */
export function readEnabled() {
  if (memory.all === undefined) memory.all = read(ALL_KEY) === 'off' ? 'off' : 'on';
  return memory.all !== 'off';
}

/** The ids of the runs the summary is hidden on, oldest hide first. Anything in storage that is not a list of ids is ignored. */
export function readHiddenRuns() {
  if (memory.hidden === undefined) {
    let list = [];
    try {
      const parsed = JSON.parse(read(HIDDEN_KEY) ?? '[]');
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
    memory.hidden = list.filter((id) => Number.isSafeInteger(id) && id > 0);
  }
  return [...memory.hidden];
}

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Turns the summary on or off for every run. Turning it on leaves the runs it was hidden on hidden. */
export function writeEnabled(on) {
  memory.all = on ? 'on' : 'off';
  // Turning it on is the default, so nothing is kept for it.
  write(ALL_KEY, on ? null : 'off');
  announce();
}

/** Hides the summary on one run, or shows it there again. */
export function writeHidden(runId, hidden) {
  if (!Number.isSafeInteger(runId) || runId <= 0) return;
  const without = readHiddenRuns().filter((id) => id !== runId);
  const next = hidden ? [...without, runId].slice(-MAX_HIDDEN_RUNS) : without;
  memory.hidden = next;
  write(HIDDEN_KEY, next.length > 0 ? JSON.stringify(next) : null);
  announce();
}

function subscribe(listener) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event) => {
    if (event.key === null || event.key === ALL_KEY || event.key === HIDDEN_KEY) {
      // Another tab changed it: look again in storage.
      forgetMemory();
      listener();
    }
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** `useSyncExternalStore` wants a value that is the same until something changes, so the answers are strings. */
const snapshotAll = () => (readEnabled() ? 'on' : 'off');
const snapshotRuns = () => JSON.stringify(readHiddenRuns());

/** Whether the summary is on for runs in general, and the way to change it (the Settings page). */
export function useRunSummariesEnabled() {
  const enabled = useSyncExternalStore(subscribe, snapshotAll, () => 'on') !== 'off';
  return [enabled, writeEnabled];
}

/** The summary's switches for one run: on in general, hidden on this run, and how to change either. */
export function useRunSummaryPreference(runId) {
  const [enabled] = useRunSummariesEnabled();
  const hiddenList = useSyncExternalStore(subscribe, snapshotRuns, () => '[]');
  const hidden = Number.isSafeInteger(runId) && JSON.parse(hiddenList).includes(runId);
  const setHidden = useCallback((value) => writeHidden(runId, value), [runId]);
  return { enabled, hidden, setEnabled: writeEnabled, setHidden };
}

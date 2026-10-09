import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../api';

/**
 * Loads one JSON resource that belongs to the run on screen (its training metrics, its pace profile).
 *
 * While a reload runs, and when a reload fails, the earlier numbers for the same url stay on screen, so acting on a
 * run never blanks its cards; `stale` says the latest reload failed, so they can be marked as possibly out of date.
 * Numbers fetched for another url are never handed out, not even for one render, so moving from one run to the next
 * cannot show the old run's figures under the new run.
 *
 * - `url`: what to fetch; null for nothing yet.
 * - `isValid`: whether an answer has the parts the cards draw. Anything else is treated as a failed load, not drawn half.
 * - `enabled`: false holds the request back (status stays 'loading') until the page is ready for it. It is meant to go
 *   from false to true once and stay true.
 * - `refreshToken`: changing it fetches again.
 *
 * status: 'loading' | 'refreshing' | 'ready' | 'error' (nothing to show: the request failed or the run is not the runner's)
 * stale: true while the numbers shown are the earlier ones because the latest reload failed (or answered with something
 *        the cards cannot draw); the next successful load clears it.
 */
export default function useRunResource(url, isValid, { enabled = true, refreshToken = 0 } = {}) {
  const [state, setState] = useState({ url, status: 'loading', data: null, failed: false });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (url == null || !enabled) return undefined;
    const controller = new AbortController();
    setState((current) => (current.url === url && current.data
      ? { ...current, status: 'refreshing' }
      : { url, status: 'loading', data: null, failed: false }));
    apiJson(url, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState((current) => {
          if (isValid(data)) return { url, status: 'ready', data, failed: false };
          return current.url === url && current.data
            ? { ...current, status: 'ready', failed: true }
            : { url, status: 'error', data: null, failed: false };
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((current) => (current.url === url && current.data
          ? { ...current, status: 'ready', failed: true }
          : { url, status: 'error', data: null, failed: false }));
      });
    return () => controller.abort();
  }, [url, enabled, isValid, reloadCount, refreshToken]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const current = state.url === url ? state : { url, status: 'loading', data: null, failed: false };
  return { status: current.status, data: current.data, stale: Boolean(current.failed && current.data), reload };
}

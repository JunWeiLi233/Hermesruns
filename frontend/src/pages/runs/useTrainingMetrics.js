import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../api';

/** Whether a response has the parts the cards draw. Anything else is treated as a failed load, not drawn half. */
function isTrainingMetrics(data) {
  return Boolean(data && typeof data === 'object' && data.effort && data.heartRate && Array.isArray(data.heartRate.zones));
}

/**
 * Loads the effort score and heart-rate zones of one run.
 *
 * While a reload runs, and when a reload fails, the earlier numbers of the same run stay on screen, so rating a
 * run never blanks the cards. Numbers of another run are never shown.
 *
 * status: 'loading' | 'refreshing' | 'ready' | 'error' (nothing to show: the request failed or the run is not
 * the runner's)
 */
export default function useTrainingMetrics(runId) {
  const [state, setState] = useState({ runId, status: 'loading', data: null });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (runId == null) return undefined;
    const controller = new AbortController();
    setState((current) => (current.runId === runId && current.data
      ? { ...current, status: 'refreshing' }
      : { runId, status: 'loading', data: null }));
    apiJson(`/api/activities/${runId}/training-metrics`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState((current) => {
          if (isTrainingMetrics(data)) return { runId, status: 'ready', data };
          return current.runId === runId && current.data ? { ...current, status: 'ready' } : { runId, status: 'error', data: null };
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((current) => (current.runId === runId && current.data
          ? { ...current, status: 'ready' }
          : { runId, status: 'error', data: null }));
      });
    return () => controller.abort();
  }, [runId, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const current = state.runId === runId ? state : { runId, status: 'loading', data: null };
  return { status: current.status, data: current.data, reload };
}

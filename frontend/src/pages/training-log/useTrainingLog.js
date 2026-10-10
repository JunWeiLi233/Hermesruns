import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '../../api';
import { logUrl, mergeWeeks, nextPageTo } from '../../utils/trainingLog';

/** Whether an answer has the parts the page draws. Anything else is treated as a failed load, not drawn half. */
function isTrainingLog(data) {
  return Boolean(
    data && typeof data === 'object'
    && Array.isArray(data.weeks) && Array.isArray(data.runTypes) && Array.isArray(data.tags)
    && typeof data.olderRuns === 'boolean',
  );
}

/**
 * The runner's training log through the filters they have set. The first request asks for the latest weeks; asking for more
 * adds the weeks before the oldest one on screen. Changing a filter starts again, keeping the earlier weeks on screen
 * (marked as busy) until the new ones arrive, and never mixing the two: an answer for filters that are no longer set is
 * thrown away.
 *
 * status: 'loading' (nothing yet) | 'refreshing' (new filters, the earlier weeks still shown) | 'ready' | 'error'
 * more:   'idle' | 'loading' | 'error' for the request for earlier weeks
 */
export default function useTrainingLog({ runType = '', tags = [] } = {}) {
  const filterKey = JSON.stringify([runType, tags]);
  const [state, setState] = useState({ status: 'loading', log: null, more: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const currentKey = useRef(filterKey);
  const loading = useRef(false);

  // Read by the request for earlier weeks when it comes back, to tell whether the filters are still the ones it was made for.
  useEffect(() => {
    currentKey.current = filterKey;
  }, [filterKey]);

  useEffect(() => {
    const controller = new AbortController();
    const [type, words] = JSON.parse(filterKey);
    loading.current = false;
    setState((current) => ({ status: current.log ? 'refreshing' : 'loading', log: current.log, more: 'idle' }));
    apiJson(logUrl({ runType: type, tags: words }), { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(isTrainingLog(data) ? { status: 'ready', log: data, more: 'idle' } : { status: 'error', log: null, more: 'idle' });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', log: null, more: 'idle' });
      });
    return () => controller.abort();
  }, [filterKey, attempt]);

  const loadMore = useCallback(async () => {
    const key = currentKey.current;
    if (loading.current) return;
    const log = state.log;
    const to = log ? nextPageTo(log.weeks) : null;
    if (!log || !to || state.status !== 'ready') return;
    loading.current = true;
    setState((current) => ({ ...current, more: 'loading' }));
    const [type, words] = JSON.parse(key);
    try {
      const data = await apiJson(logUrl({ to, runType: type, tags: words }));
      if (!isTrainingLog(data)) throw new Error('unexpected answer');
      if (currentKey.current !== key) return;
      setState((current) => (current.log
        ? { status: 'ready', more: 'idle', log: { ...current.log, weeks: mergeWeeks(current.log.weeks, data.weeks), olderRuns: data.olderRuns } }
        : current));
    } catch {
      if (currentKey.current === key) setState((current) => ({ ...current, more: 'error' }));
    } finally {
      loading.current = false;
    }
  }, [state.log, state.status]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  return { status: state.status, log: state.log, more: state.more, loadMore, reload };
}

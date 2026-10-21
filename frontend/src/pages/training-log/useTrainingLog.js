import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '../../api';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';
import { logUrl, mergeWeeks, newerPageTo, nextPageTo, prependWeeks, showsLatestWeek } from '../../utils/trainingLog';

/** Whether an answer has the parts the page draws. Anything else is treated as a failed load, not drawn half. */
function isTrainingLog(data) {
  return Boolean(
    data && typeof data === 'object'
    && Array.isArray(data.weeks) && Array.isArray(data.runTypes) && Array.isArray(data.tags)
    && typeof data.olderRuns === 'boolean',
  );
}

/**
 * The runner's training log through the filters they have set, from the week of `to` (the latest weeks when it is empty).
 * The first request asks for a page of weeks; asking for more adds the weeks before the oldest one on screen, or the weeks
 * after the newest. Changing a filter or the day starts again, keeping the earlier weeks on screen (marked as busy) until
 * the new ones arrive, and never mixing the two: an answer for filters that are no longer set is thrown away.
 *
 * status: 'loading' (nothing yet) | 'refreshing' (new filters, the earlier weeks still shown) | 'ready' | 'error'
 * more:   'idle' | 'loading' | 'error' for the request for earlier weeks
 * newer:  the same, for the request for later weeks
 * jumped: whether the log was started from a past day, that is, whether the first weeks that came for these filters stop
 *         short of today. Later weeks added afterwards do not change it: the log was still started from that day.
 *
 * loadMore and loadNewer say, when they are done, whether they added weeks.
 */
export default function useTrainingLog({ runType = '', tags = [], to = '' } = {}) {
  const recommendationRevision = useRecommendationRevision();
  const filterKey = JSON.stringify([runType, tags, to, recommendationRevision]);
  const [state, setState] = useState({ status: 'loading', log: null, jumped: false, more: 'idle', newer: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const currentKey = useRef(filterKey);
  const loadingMore = useRef(false);
  const loadingNewer = useRef(false);

  // Read by the requests for more weeks when they come back, to tell whether the filters are still the ones they were made for.
  useEffect(() => {
    currentKey.current = filterKey;
  }, [filterKey]);

  useEffect(() => {
    const controller = new AbortController();
    const [type, words, day] = JSON.parse(filterKey);
    loadingMore.current = false;
    loadingNewer.current = false;
    setState((current) => ({ status: current.log ? 'refreshing' : 'loading', log: current.log, jumped: current.jumped, more: 'idle', newer: 'idle' }));
    apiJson(logUrl({ to: day, runType: type, tags: words }), { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(isTrainingLog(data)
          ? { status: 'ready', log: data, jumped: !showsLatestWeek(data.weeks, data.today), more: 'idle', newer: 'idle' }
          : { status: 'error', log: null, jumped: false, more: 'idle', newer: 'idle' });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', log: null, jumped: false, more: 'idle', newer: 'idle' });
      });
    return () => controller.abort();
  }, [filterKey, attempt]);

  /** One more page of weeks at one end of the list; `field` is the state to report progress in, `merge` puts the weeks in. */
  const loadPage = useCallback(async ({ field, busy, to: day, merge }) => {
    const key = currentKey.current;
    if (busy.current) return false;
    const log = state.log;
    if (!log || !day || state.status !== 'ready') return false;
    busy.current = true;
    setState((current) => ({ ...current, [field]: 'loading' }));
    const [type, words] = JSON.parse(key);
    try {
      const data = await apiJson(logUrl({ to: day, runType: type, tags: words }));
      if (!isTrainingLog(data)) throw new Error('unexpected answer');
      if (currentKey.current !== key) return false;
      setState((current) => (current.log
        ? { ...current, status: 'ready', [field]: 'idle', log: merge(current.log, data) }
        : current));
      return true;
    } catch {
      if (currentKey.current === key) setState((current) => ({ ...current, [field]: 'error' }));
      return false;
    } finally {
      busy.current = false;
    }
  }, [state.log, state.status]);

  const loadMore = useCallback(() => loadPage({
    field: 'more',
    busy: loadingMore,
    to: state.log ? nextPageTo(state.log.weeks) : null,
    // The answer about runs older still is the last page's.
    merge: (log, data) => ({ ...log, weeks: mergeWeeks(log.weeks, data.weeks), olderRuns: data.olderRuns }),
  }), [loadPage, state.log]);

  const loadNewer = useCallback(() => loadPage({
    field: 'newer',
    busy: loadingNewer,
    to: state.log ? newerPageTo(state.log.weeks, state.log.today) : null,
    merge: (log, data) => ({ ...log, weeks: prependWeeks(log.weeks, data.weeks) }),
  }), [loadPage, state.log]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  return { status: state.status, log: state.log, jumped: state.jumped, more: state.more, newer: state.newer, loadMore, loadNewer, reload };
}

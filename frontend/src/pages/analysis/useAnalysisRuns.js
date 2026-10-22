import { useCallback, useEffect, useMemo, useState } from 'react';
import { cachedApiJson } from '../../api/resourceCache';
import { prepareAnalysisRuns } from '../../utils/analysisInsights';

/**
 * The runner's runs as the Analysis page loads them (/api/activities/analysis, shared with it through the resource cache,
 * so a page opened from Analysis does not ask again within the cache's time). Anything but a list is a failed load.
 *
 * status: 'loading' | 'ready' | 'error'. `runs` is null until they are in. `reload` asks again after a failure.
 */
export default function useAnalysisRuns(providedRuns) {
  const supplied = Array.isArray(providedRuns);
  const prepared = useMemo(() => supplied ? prepareAnalysisRuns(providedRuns) : null, [providedRuns, supplied]);
  const [state, setState] = useState({ status: 'loading', runs: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (supplied) return undefined;
    let cancelled = false;
    setState((current) => (current.status === 'loading' ? current : { status: 'loading', runs: null }));
    cachedApiJson('/api/activities/analysis')
      .then((data) => {
        if (cancelled) return;
        setState(Array.isArray(data) ? { status: 'ready', runs: prepareAnalysisRuns(data) } : { status: 'error', runs: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', runs: null });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, supplied]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  return { status: supplied ? 'ready' : state.status, runs: supplied ? prepared : state.runs, reload };
}

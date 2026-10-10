import { useEffect, useMemo, useState } from 'react';
import { cachedApiJson } from '../../api/resourceCache';
import { paceZoneBands } from '../../utils/paceAnalysis';
import { estimateCurrentVdot } from '../../utils/vdot';

/**
 * The runner's pace zones, worked out in the browser the way the Analysis page works out its training paces: the
 * VDOT of their best recent runs, turned into Daniels paces. They are today's zones, so a run from last year is read
 * against the runner's fitness now. Loads the run list (shared with the Analysis page through the resource cache)
 * only once `enabled`, so the pace card's first paint does not wait for it.
 *
 * status: 'idle' | 'loading' | 'ready' | 'error'. A runner with too few recent runs is 'ready' with no bands.
 */
export default function usePaceZones(enabled) {
  const [state, setState] = useState({ status: 'idle', vdot: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((current) => (current.status === 'ready' ? current : { status: 'loading', vdot: null }));
    cachedApiJson('/api/activities/analysis')
      .then((runs) => {
        if (cancelled) return;
        const vdot = Array.isArray(runs) ? Number(estimateCurrentVdot(runs).representativeVdot) : null;
        setState({ status: 'ready', vdot: vdot > 0 ? vdot : null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', vdot: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const bands = useMemo(() => paceZoneBands(state.vdot), [state.vdot]);
  return { status: state.status, vdot: state.vdot, bands };
}

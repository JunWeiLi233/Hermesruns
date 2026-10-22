import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api';
import { cachedApiJson } from '../../api/resourceCache';
import { paceZoneBands, zonesVdot } from '../../utils/paceAnalysis';

/**
 * The pace zones of one run, worked out in the browser the way the Analysis page works out its training paces: the
 * VDOT of the runner's best runs, turned into Daniels paces. They are the zones the runner had going into the run
 * (their best runs in the 90 days before it), or today's when there is nothing before it to go on (see zonesVdot).
 * Loads the run list (shared with the Analysis page through the resource cache) only once `enabled`, so the pace
 * card's first paint does not wait for it.
 *
 * A race the runner entered in Settings (/api/training/pace-zones) sets the zones for runs on or after its date; when that
 * cannot be loaded the zones are the ones from the runner's runs, as before.
 *
 * status: 'idle' | 'loading' | 'ready' | 'error'. A runner with no VDOT is 'ready' with no bands.
 * basis: 'race' | 'before' | 'today' | null, where the VDOT comes from. race: the race, when there is one.
 */
export default function usePaceZones(enabled, startTime) {
  const [state, setState] = useState({ status: 'idle', runs: null, race: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((current) => (current.status === 'ready' ? current : { status: 'loading', runs: null, race: null }));
    Promise.all([
      cachedApiJson('/api/activities/analysis'),
      apiJson('/api/training/pace-zones').catch(() => null), // never cached, so a race just entered in Settings is seen
    ])
      .then(([runs, entered]) => {
        if (!cancelled) setState({ status: 'ready', runs: Array.isArray(runs) ? runs : [], race: entered?.race ?? null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', runs: null, race: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const zones = useMemo(
    () => (state.status === 'ready' ? zonesVdot(state.runs, startTime, Date.now(), state.race) : { vdot: null, basis: null }),
    [state.status, state.runs, state.race, startTime],
  );
  const bands = useMemo(() => paceZoneBands(zones.vdot), [zones.vdot]);
  return { status: state.status, vdot: zones.vdot, basis: zones.basis, bands, race: zones.basis === 'race' ? state.race : null };
}

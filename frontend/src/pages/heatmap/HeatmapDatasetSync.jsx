import { useEffect, useRef } from 'react';
import { useExplorer } from '../../features/heatmap-explorer/context.jsx';
import { invalidateResourceCache } from '../../api/resourceCache';
import { invalidateHeatmapCache } from '../../utils/heatmap/cache.js';

/** Publish committed Explorer revisions to existing Hermes history consumers. */
export default function HeatmapDatasetSync({ email }) {
  const { view } = useExplorer();
  const previous = useRef({email, revision: null});
  const revision = view?.revision;
  useEffect(() => {
    const before = previous.current;
    if (revision == null && before.email === email) return;
    previous.current = {email, revision: revision ?? null};
    if (revision == null || before.email !== email || before.revision == null || before.revision === revision) return;
    invalidateResourceCache('/api/activities');
    invalidateResourceCache('/api/profile');
    if (email) void invalidateHeatmapCache(email).catch(() => {});
    try {localStorage.setItem('hermes_recommendation_revision', String(Date.now()));} catch { /* The in-memory event remains available. */ }
    window.dispatchEvent(new Event('hermes-recommendations-changed'));
  }, [email, revision]);
  return null;
}

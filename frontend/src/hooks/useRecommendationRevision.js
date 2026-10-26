import { useEffect, useReducer } from 'react';
import { apiJson } from '../api';
import { invalidateResourceCache } from '../api/resourceCache';

let consumers = 0;
let stopWatching;

function watchSourceInputs() {
  consumers += 1;
  if (consumers === 1) {
    let stopped = false;
    let pending = false;
    let account = null;
    let previous = null;
    const check = async () => {
      if (stopped || pending || document.visibilityState === 'hidden') return;
      const token = localStorage.getItem('hermes_jwt');
      if (!token) return;
      const scope = `${localStorage.getItem('hermes_email')}:${token}`;
      if (scope !== account) { account = scope; previous = null; }
      pending = true;
      try {
        const result = await apiJson('/api/coach/revision', { cache: 'no-store' });
        if (stopped || token !== localStorage.getItem('hermes_jwt') || !result?.revision) return;
        const changed = previous !== null && previous !== result.revision;
        previous = result.revision;
        if (changed) {
          invalidateResourceCache('/api/activities');
          invalidateResourceCache('/api/profile');
          try { localStorage.setItem('hermes_recommendation_revision', `${Date.now()}:${result.revision}`); } catch { /* Same-tab updates still work. */ }
          window.dispatchEvent(new Event('hermes-recommendations-changed'));
        }
      } catch { /* Retry on the next poll or focus after a network failure. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(check, 15_000);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    check();
    stopWatching = () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }
  return () => { consumers -= 1; if (consumers === 0) stopWatching?.(); };
}

/** Every recommendation consumer refreshes after the same source data changes. */
export default function useRecommendationRevision() {
  const [revision, refresh] = useReducer(value => value + 1, 0);
  useEffect(() => {
    const changed = () => {
      invalidateResourceCache('/api/activities');
      invalidateResourceCache('/api/profile');
      refresh();
    };
    const events = ['hermes-recommendations-changed', 'hermes-plan-changed', 'hermes-training-changed', 'hermes:strava-sync-finished'];
    for (const event of events) window.addEventListener(event, changed);
    const otherTab = event => {
      if (event.key !== 'hermes_recommendation_revision') return;
      changed();
    };
    window.addEventListener('storage', otherTab);
    const unsubscribe = watchSourceInputs();
    return () => {
      unsubscribe();
      for (const event of events) window.removeEventListener(event, changed);
      window.removeEventListener('storage', otherTab);
    };
  }, []);
  return revision;
}

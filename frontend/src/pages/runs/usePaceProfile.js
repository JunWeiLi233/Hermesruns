import useRunResource from './useRunResource';

/** Whether a response has the parts the pace card draws. Anything else is treated as a failed load, not drawn half. */
function isPaceProfile(data) {
  if (!data || typeof data !== 'object' || typeof data.hasStream !== 'boolean') return false;
  if (!data.hasStream) return true;
  return Boolean(data.summary && Array.isArray(data.splits) && data.smoothed && Array.isArray(data.smoothed.t));
}

/**
 * Loads the pace profile of one run: splits, a smoothed pace line and grade-adjusted pace.
 *
 * `enabled` holds the request back until the run page has fetched the run's stream: for a Strava run the stream is
 * fetched on first view, and asking sooner would only report that there is none yet.
 * `refreshToken` fetches again, for when something the profile depends on (the run's elevation) changed.
 */
export default function usePaceProfile(runId, { enabled = true, refreshToken = 0 } = {}) {
  return useRunResource(runId == null ? null : `/api/activities/${runId}/pace-profile`, isPaceProfile, { enabled, refreshToken });
}

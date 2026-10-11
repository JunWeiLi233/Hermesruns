import useRunResource from './useRunResource';

/** Whether a response has the parts the card draws. Anything else is treated as a failed load, not drawn half. */
function isRunEfforts(data) {
  return Boolean(data && typeof data === 'object' && typeof data.complete === 'boolean' && Array.isArray(data.efforts));
}

/**
 * Loads the best efforts of one run, each with its place among the runner's efforts at that distance (see
 * useRunResource for what the status means and how one run's numbers are kept from showing under another).
 *
 * `enabled` holds the request back until the run page has fetched the run's stream: for a Strava run the stream is
 * fetched on first view, and asking sooner would only get the efforts the run's average pace allows.
 */
export default function useRunBestEfforts(runId, { enabled = true } = {}) {
  return useRunResource(runId == null ? null : `/api/activities/${runId}/best-efforts`, isRunEfforts, { enabled });
}

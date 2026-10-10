import useRunResource from './useRunResource';

/** Whether a response has the parts the card draws. Anything else is treated as a failed load, not drawn half. */
function isMatches(data) {
  return Boolean(data && typeof data === 'object' && typeof data.complete === 'boolean'
    && typeof data.count === 'number' && Array.isArray(data.runs));
}

/**
 * Loads the runs over the same route as one run (see useRunResource for what the status means and how one run's
 * numbers are kept from showing under another). `enabled` holds the request back until the run's stream is there, as
 * for the pace card: a Strava run has no positions to match until it has been opened once.
 */
export default function useRunMatches(runId, { enabled = true } = {}) {
  return useRunResource(runId == null ? null : `/api/activities/${runId}/matches`, isMatches, { enabled });
}

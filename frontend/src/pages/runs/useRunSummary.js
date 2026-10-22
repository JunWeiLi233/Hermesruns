import { isRunSummary } from '../../utils/runSummary';
import useRunResource from './useRunResource';

/**
 * Loads the summary of one run (see useRunResource for what the status means and how one run's numbers are kept from
 * showing under another).
 *
 * `enabled` holds the request back until the run page has fetched the run's stream: for a Strava run the stream is fetched on
 * first view, and asking sooner would only get the lines the run's totals allow. `refreshToken` asks again, as the pace
 * analysis does, when the elevation is recalibrated and the grade-adjusted paces change.
 */
export default function useRunSummary(runId, { enabled = true, refreshToken = 0 } = {}) {
  return useRunResource(runId == null ? null : `/api/activities/${runId}/summary`, isRunSummary, { enabled, refreshToken });
}

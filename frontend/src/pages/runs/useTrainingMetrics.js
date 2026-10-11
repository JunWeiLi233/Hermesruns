import useRunResource from './useRunResource';

/** Whether a response has the parts the cards draw. Anything else is treated as a failed load, not drawn half. */
function isTrainingMetrics(data) {
  return Boolean(data && typeof data === 'object' && data.effort && data.heartRate && Array.isArray(data.heartRate.zones));
}

/**
 * Loads the effort score and heart-rate zones of one run (see useRunResource for what the status means and how the
 * numbers of one run are kept from showing under another). `refreshToken` asks again, as when the run was edited.
 */
export default function useTrainingMetrics(runId, { refreshToken = 0 } = {}) {
  return useRunResource(runId == null ? null : `/api/activities/${runId}/training-metrics`, isTrainingMetrics, { refreshToken });
}

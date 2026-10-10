import useRunResource from './useRunResource';

/** Whether an answer has the parts the card draws. Anything else is treated as a failed load, not drawn half. */
function isRunLabels(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.tags) && Array.isArray(data.runTypes));
}

/**
 * Loads a run's type and tags, with the runner's most used tags to offer (see useRunResource for what the status
 * means and how one run's answer is kept from showing under another).
 */
export default function useRunLabels(runId) {
  return useRunResource(runId == null ? null : `/api/activities/${runId}/labels`, isRunLabels);
}

import useRunResource from '../runs/useRunResource';

/** Whether a response has the parts the section draws. Anything else is treated as a failed load, not drawn half. */
function isAnalysis(data) {
  return Boolean(data && typeof data === 'object' && typeof data.complete === 'boolean'
    && Array.isArray(data.distances) && Array.isArray(data.lifetime) && Array.isArray(data.annual)
    && Array.isArray(data.trend) && Array.isArray(data.years));
}

/**
 * Loads the runner's best efforts at one distance (see useRunResource for what the status means). With no `distance`
 * the server picks one (the 5 km when the runner has it) and with no `year` the latest year that has an effort.
 *
 * `enabled` holds the request back until the runner asks to see the analysis, so the Profile page's first paint does
 * not make a request more.
 */
export default function useBestEffortsAnalysis({ enabled, distance = null, year = null }) {
  const query = new URLSearchParams();
  if (distance) query.set('distance', distance);
  if (year != null) query.set('year', String(year));
  const text = query.toString();
  return useRunResource(`/api/training/best-efforts${text ? `?${text}` : ''}`, isAnalysis, { enabled });
}

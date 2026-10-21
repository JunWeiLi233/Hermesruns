import useRunResource from '../runs/useRunResource';

/** Whether an answer has the parts the chart draws. Anything else is treated as a failed load, not drawn half. */
function isSeries(data) {
  return Boolean(data && typeof data === 'object' && typeof data.status === 'string'
    && Array.isArray(data.points) && Array.isArray(data.projection) && data.sources && typeof data.sources === 'object');
}

/**
 * Loads the runner's fitness, fatigue and form from `from` (a day, `yyyy-MM-dd`) to today. While a reload runs, and when
 * a reload fails, the earlier numbers for the same window stay on screen (see useRunResource); a different window never
 * shows the numbers of another.
 */
export default function useTrainingSeries(from, { enabled = true } = {}) {
  return useRunResource(`/api/training/series?from=${encodeURIComponent(from)}`, isSeries, { enabled });
}

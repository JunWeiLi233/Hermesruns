import useRunResource from '../runs/useRunResource';

/** Whether an answer has the parts the page draws. Anything else is treated as a failed load, not drawn half. */
function isPaceCurve(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.points)
    && data.model && typeof data.model === 'object' && typeof data.model.status === 'string'
    && data.limits && typeof data.limits === 'object');
}

/**
 * Loads the runner's fastest time over each standard distance within a window, and the critical speed line through them.
 * `days` is `'90'`, `'180'`, `'365'` or `'all'`. While a reload runs, and when one fails, the earlier numbers for the same
 * window stay on screen; a different window never shows the numbers of another (see useRunResource).
 */
export default function usePaceCurve(days, { enabled = true } = {}) {
  return useRunResource(`/api/training/pace-curve?days=${encodeURIComponent(days)}`, isPaceCurve, { enabled });
}

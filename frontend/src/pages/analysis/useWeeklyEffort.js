import useRunResource from '../runs/useRunResource';

/** Whether an answer has the parts the chart draws. Anything else is treated as a failed load, not drawn half. */
function isWeekly(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.weeks) && Number.isFinite(data.bandPercent));
}

/** Loads the runner's effort for each of the last `weeks` weeks, each with the range of the three weeks before it. */
export default function useWeeklyEffort(weeks = 12, { enabled = true } = {}) {
  return useRunResource(`/api/training/weekly-effort?weeks=${encodeURIComponent(weeks)}`, isWeekly, { enabled });
}

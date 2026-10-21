import useRunResource from '../runs/useRunResource';

/** Whether an answer has the parts the chart draws. Anything else is treated as a failed load, not drawn half. */
function isIntensity(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.weeks)
    && data.summary && typeof data.summary === 'object' && typeof data.summary.pattern === 'string'
    && Array.isArray(data.summary.zoneSeconds));
}

/** Loads how the runner's running time was spread over their heart-rate zones in each of the last `weeks` weeks. */
export default function useIntensity(weeks = 12, { enabled = true } = {}) {
  return useRunResource(`/api/training/intensity?weeks=${encodeURIComponent(weeks)}`, isIntensity, { enabled });
}

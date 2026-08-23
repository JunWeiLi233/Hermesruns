export function buildRunDetailPath(runId) {
  return `/runs/${String(runId ?? '')}`;
}

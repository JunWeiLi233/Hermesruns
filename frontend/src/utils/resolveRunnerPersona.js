function getRunTimestamp(run) {
  return new Date(run?.startTime || run?.startDate || 0).getTime();
}

export function resolveRunnerPersona({ runs, runnerState, now = Date.now() }) {
  if (runnerState === 'new' || runnerState === 'comeback' || runnerState === 'active') {
    return runnerState;
  }

  if (!Array.isArray(runs) || runs.length === 0) return 'new';

  const sorted = [...runs].sort((a, b) => getRunTimestamp(b) - getRunTimestamp(a));
  const lastTs = getRunTimestamp(sorted[0]);
  if (!Number.isFinite(lastTs) || lastTs <= 0) return 'active';

  const currentTs = typeof now === 'string' ? new Date(now).getTime() : now;
  const safeNow = Number.isFinite(currentTs) ? currentTs : Date.now();
  const daysAgo = (safeNow - lastTs) / 86400000;

  if (daysAgo > 14) return 'comeback';
  return 'active';
}

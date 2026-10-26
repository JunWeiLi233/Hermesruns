const usableHeartRate = value => typeof value === 'number' && Number.isFinite(value) && value >= 30 && value <= 240;

export function heartRateAverage(activity) {
  if (usableHeartRate(activity.averageHeartRate)) return Math.round(activity.averageHeartRate);
  const values = (activity.samples || []).map(sample => sample.hr).filter(usableHeartRate);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export function comparisonPlot(traces, offset = 0) {
  const values = traces.flatMap(trace => (trace.samples || []).map(sample => sample.hr).filter(usableHeartRate));
  const low = Math.min(100, Math.floor(Math.min(...values, 100) / 20) * 20);
  const high = Math.max(190, Math.ceil(Math.max(...values, 180) / 20) * 20 + 10);
  const y = value => 94 - (value - low) / (high - low) * 88;
  const lastSample = Math.max(1, ...traces.map((trace, index) => (trace.samples?.length || 1) - 1 + (index ? offset : 0)));
  const lines = traces.map((trace, index) => {
    let connected = false;
    const path = (trace.samples || []).map((sample, sampleIndex) => {
      if (!usableHeartRate(sample.hr)) { connected = false; return ''; }
      const command = connected ? 'L' : 'M';
      connected = true;
      return `${command}${((sampleIndex + (index ? offset : 0)) / lastSample * 100).toFixed(2)},${y(sample.hr).toFixed(2)}`;
    }).join(' ');
    return { path };
  });
  const ticks = [];
  for (let value = low; value < high; value += 20) ticks.push({ value, y: y(value) });
  return { lines, ticks, lastSample };
}

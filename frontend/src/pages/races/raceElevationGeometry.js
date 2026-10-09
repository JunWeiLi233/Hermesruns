function niceInterval(value, roundUp) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 0.01)));
  const fraction = value / magnitude;
  const steps = [1, 2, 5, 10];
  const step = roundUp
    ? steps.find((candidate) => candidate >= fraction) || 10
    : [...steps].reverse().find((candidate) => candidate <= fraction) || 1;
  return step * magnitude;
}

export function buildElevationScale(values) {
  const valid = values.filter(Number.isFinite);
  const low = valid.length ? Math.min(...valid) : 0;
  const high = valid.length ? Math.max(...valid) : 0;
  const step = niceInterval(Math.max(20, high - low) / 3, true);
  const minimum = Math.floor(low / step) * step;
  const maximum = Math.max(minimum + step * 2, Math.ceil(high / step) * step);
  const count = Math.round((maximum - minimum) / step);
  return { minimum, maximum, ticks: Array.from({ length: count + 1 }, (_, index) => minimum + index * step) };
}

export function buildElevationDistanceTicks(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return [];
  const step = niceInterval(distanceKm / 4, false);
  const ticks = [{ km: 0, isFinish: false }];
  for (let index = 1; index * step < distanceKm - step / 2; index += 1) {
    ticks.push({ km: Number((index * step).toFixed(3)), isFinish: false });
  }
  ticks.push({ km: distanceKm, isFinish: true });
  return ticks;
}

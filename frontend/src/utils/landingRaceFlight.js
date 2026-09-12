export const RACE_FLIGHT_STEP_MS = 3000;
export const RACE_FLIGHT_DWELL_MS = 1800;

export function buildRaceFlight(points) {
  if (!Array.isArray(points) || points.length === 0) return { legs: [], path: '' };
  const legs = points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const control = {
      x: (start.x + end.x) / 2,
      y: Math.min(start.y, end.y) - Math.min(8, Math.max(2.4, Math.abs(end.x - start.x) * 0.08)),
    };
    const curve = `Q ${control.x} ${control.y} ${end.x} ${end.y}`;
    return { start, end, control, curve, path: `M ${start.x} ${start.y} ${curve}` };
  });
  return { legs, path: `M ${points[0].x} ${points[0].y} ${legs.map(leg => leg.curve).join(' ')}` };
}

export function sampleRaceFlightLeg(leg, progress) {
  const t = progress * progress * (3 - 2 * progress);
  const u = 1 - t;
  const { start, end, control } = leg;
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
    angle: Math.atan2(u * (control.y - start.y) + t * (end.y - control.y),
      u * (control.x - start.x) + t * (end.x - control.x)) * 180 / Math.PI,
  };
}

// One clock drives the pointer and its destination. Hold at each city, then
// name the next destination while travelling to it, irrespective of leg length.
export function getRaceFlightFrame(legs, elapsedMs) {
  if (!legs.length) return null;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const sourceIndex = Math.floor(elapsed / RACE_FLIGHT_STEP_MS) % legs.length;
  const phase = elapsed % RACE_FLIGHT_STEP_MS;
  const travelling = legs.length > 1 && phase >= RACE_FLIGHT_DWELL_MS;
  const activeIndex = travelling ? (sourceIndex + 1) % legs.length : sourceIndex;
  const legIndex = travelling ? sourceIndex : (sourceIndex + legs.length - 1) % legs.length;
  const progress = travelling ? (phase - RACE_FLIGHT_DWELL_MS) / (RACE_FLIGHT_STEP_MS - RACE_FLIGHT_DWELL_MS) : 1;
  return { ...sampleRaceFlightLeg(legs[legIndex], progress), activeIndex, legIndex, progress, travelling };
}

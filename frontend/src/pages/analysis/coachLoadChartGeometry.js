const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function buildCoachLoadChartGeometry(entries, layoutWidth) {
  if (!entries?.length) return null;
  const width = Math.max(220, layoutWidth);
  const height = width < 480 ? 240 : 280;
  const padL = 36;
  const padR = 20;
  const padT = 20;
  const padB = 36;
  const plotWidth = width - padL - padR;
  const baseline = height - padB;
  const maximum = Math.max(1, ...entries.flatMap(({ acute, chronic }) => [acute, chronic]));
  const rawStep = maximum * 1.12 / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find((size) => size >= rawStep / magnitude) * magnitude;
  const yMax = step * 4;
  const toY = (value) => baseline - value / yMax * (baseline - padT);
  const points = entries.map((entry, index) => ({
    ...entry,
    index,
    x: padL + (entries.length === 1 ? plotWidth / 2 : index / (entries.length - 1) * plotWidth),
    acuteY: toY(entry.acute),
    chronicY: toY(entry.chronic),
  }));
  const line = (key) => points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point[key].toFixed(2)}`).join(' ');
  const acutePath = line('acuteY');
  const tickCount = Math.min(entries.length, width < 480 ? 3 : width < 700 ? 4 : 5);
  const xTicks = Array.from({ length: tickCount }, (_, index) => points[Math.round(index / Math.max(1, tickCount - 1) * (points.length - 1))]);
  const yTicks = Array.from({ length: 5 }, (_, index) => ({ value: Number((step * index).toPrecision(3)), y: toY(step * index) }));
  return {
    width, height, padL, padR, padT, baseline, points, xTicks, yTicks,
    acutePath,
    chronicPath: line('chronicY'),
    areaPath: `${acutePath} L${points.at(-1).x},${baseline} L${points[0].x},${baseline} Z`,
  };
}

export function getCoachLoadTooltipPosition(point, geometry) {
  const width = Math.min(172, geometry.width - 16);
  const height = 110;
  const right = point.x + 16;
  return {
    width,
    left: clamp(right + width <= geometry.width - 8 ? right : point.x - width - 16, 8, geometry.width - width - 8),
    top: clamp(Math.min(point.acuteY, point.chronicY) - height / 2, 8, geometry.baseline - height - 8),
  };
}

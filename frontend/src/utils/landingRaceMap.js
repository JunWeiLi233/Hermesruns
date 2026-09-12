export const MAX_MAP_ZOOM = 3;
export const MAP_ZOOM_STEP = 0.5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mapUnit({ width, height }) {
  return Math.max(0, Math.min(width / 100, height / 50));
}

export function clampMapCamera(camera, size) {
  const zoom = clamp(Number.isFinite(camera.zoom) ? camera.zoom : 1, 1, MAX_MAP_ZOOM);
  const unit = mapUnit(size);
  const limitX = Math.max(0, (100 * unit * zoom - size.width) / 2);
  const limitY = Math.max(0, (50 * unit * zoom - size.height) / 2);
  return { zoom, x: clamp(camera.x || 0, -limitX, limitX), y: clamp(camera.y || 0, -limitY, limitY) };
}

export function raceScreenPoint(pin, size, camera) {
  const unit = mapUnit(size) * camera.zoom;
  return { x: size.width / 2 + (pin.x - 50) * unit + camera.x, y: size.height / 2 + (pin.y - 25) * unit + camera.y };
}

export function focusRaceCamera(pin, size, zoom) {
  const boundedZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 1, MAX_MAP_ZOOM);
  const unit = mapUnit(size) * boundedZoom;
  return clampMapCamera({ zoom: boundedZoom, x: -(pin.x - 50) * unit, y: -(pin.y - 25) * unit }, size);
}

export function zoomMapCamera(camera, size, zoom) {
  const nextZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 1, MAX_MAP_ZOOM);
  const ratio = nextZoom / camera.zoom;
  return clampMapCamera({ zoom: nextZoom, x: camera.x * ratio, y: camera.y * ratio }, size);
}

// Separate labels from geographic anchors, so nearby races stay individually selectable.
export function layoutRaceMarkers(races, size, camera) {
  const width = size.width < 600 ? 76 : 88;
  const height = 44;
  const points = races.map(race => ({ race, ...raceScreenPoint(race.pin, size, camera) }))
    .filter(point => point.x >= 0 && point.x <= size.width && point.y >= 0 && point.y <= size.height);
  const columns = Math.max(1, Math.floor((size.width - 12) / (width + 6)));
  const rows = Math.max(1, Math.floor((size.height - 12) / (height + 4)));
  const slots = Array.from({ length: columns * rows }, (_, index) => ({
    x: (index % columns + 0.5) * size.width / columns,
    y: (Math.floor(index / columns) + 0.5) * size.height / rows,
  }));
  const cost = (point, slot) => {
    // Keep labels close to their destination and clear of all true city dots.
    const coversCity = points.some(pin => Math.abs(pin.x - slot.x) < width / 2 + 7 && Math.abs(pin.y - slot.y) < height / 2 + 7);
    return (slot.x - point.x) ** 2 + (slot.y - point.y) ** 2 + (coversCity ? 1e6 : 0);
  };
  const available = [...slots];
  const placed = points.map(point => {
    const nearest = available.reduce((best, slot, index) => cost(point, slot) < cost(point, available[best]) ? index : best, 0);
    const slot = available.splice(nearest, 1)[0];
    return slot ? { ...point, slot } : null;
  }).filter(Boolean);
  // Untangle neighboring callouts without moving anchors or changing the hit-area spacing.
  for (let pass = 0; pass < placed.length; pass += 1) {
    let changed = false;
    placed.forEach((a, index) => placed.slice(index + 1).forEach(b => {
      if (cost(a, b.slot) + cost(b, a.slot) + 1 < cost(a, a.slot) + cost(b, b.slot)) {
        [a.slot, b.slot] = [b.slot, a.slot];
        changed = true;
      }
    }));
    if (!changed) break;
  }
  // Pull each label off the placement grid toward its city without covering another target.
  for (let pass = 0; pass < 3; pass += 1) {
    placed.forEach(point => {
      const candidates = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({
        x: point.x + dx * (width / 2 + 12), y: point.y + dy * (height / 2 + 12),
      })));
      for (const ratio of [0.2, 0.4, 0.6, 0.8]) candidates.push({
        x: point.slot.x + (point.x - point.slot.x) * ratio,
        y: point.slot.y + (point.y - point.slot.y) * ratio,
      });
      candidates.forEach(slot => {
        if (slot.x < width / 2 + 6 || slot.x > size.width - width / 2 - 6
          || slot.y < height / 2 + 6 || slot.y > size.height - height / 2 - 6) return;
        if (placed.some(other => other !== point && Math.abs(slot.x - other.slot.x) < width + 6
          && Math.abs(slot.y - other.slot.y) < height + 4)) return;
        if (cost(point, slot) < cost(point, point.slot)) point.slot = slot;
      });
    });
  }
  return placed.map(({ race, x, y, slot }) => ({
    race, key: race.id, anchorX: x, anchorY: y, x: slot.x, y: slot.y, width, height,
  }));
}

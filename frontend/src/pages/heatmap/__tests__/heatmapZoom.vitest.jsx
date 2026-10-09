import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Heatmap from '../Heatmap';

const leaflet = vi.hoisted(() => ({ map: null, positions: [] }));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, authHydrated: true, email: 'zoom@example.test' }),
}));
vi.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ lang: 'en', t: (key) => key }),
}));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../api', () => ({
  getBackendBaseUrl: () => '',
  apiJson: async (url) => {
    if (url.startsWith('/api/profile/heatmap/viewport')) return { points: [] };
    if (url.startsWith('/api/profile/heatmap')) return {
      pointCount: 2,
      bounds: { minLatitude: 40.7, maxLatitude: 40.8, minLongitude: -74.05, maxLongitude: -73.95 },
      points: [[1, 40.74, -74.01, 0.5], [1, 40.76, -73.99, 0.7]],
      diagnostics: { complete: true },
    };
    return { displayName: 'Zoom Runner' };
  },
}));
vi.mock('../../../utils/heatmap/cache.js', async (importOriginal) => ({
  ...await importOriginal(),
  openHeatmapCacheDb: async () => null,
}));
vi.mock('leaflet', async (importOriginal) => {
  const module = await importOriginal();
  const L = module.default;
  return { default: {
    ...L,
    map: (...args) => {
      leaflet.map = L.map(...args);
      return leaflet.map;
    },
  } };
});

let contexts;
beforeEach(() => {
  leaflet.map = null;
  leaflet.positions = [];
  contexts = new Map();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const canvas = this;
    if (!contexts.has(this)) contexts.set(this, {
      beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
      setTransform: vi.fn(() => {
        if (canvas.classList.contains('heatmap-page-dot-canvas')) leaflet.positions.push(leaflet.map.getZoom());
      }),
      clearRect: vi.fn(), drawImage: vi.fn(),
    });
    return contexts.get(this);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function mountHeatmap() {
  render(<MemoryRouter><Heatmap /></MemoryRouter>);
  await waitFor(() => expect(leaflet.positions.length).toBeGreaterThan(0));
  vi.useFakeTimers();
  leaflet.positions = [];
  return leaflet.map;
}

function startZoom(map, targetZoom) {
  act(() => {
    map._animateToCenter = map.getCenter();
    map._animateToZoom = targetZoom;
    map._animatingZoom = true;
    map.fire('zoomstart');
    map.fire('movestart');
    map.fire('zoomanim', { center: map.getCenter(), zoom: targetZoom });
    // Leaflet updates its camera before the CSS transition has completed.
    map._move(map.getCenter(), targetZoom, undefined, true);
  });
}

function endZoom(map) {
  act(() => { map._animatingZoom = false; map.fire('zoomend'); map.fire('moveend'); });
}

it.each([1, -1])('finishes a %s zoom without replaying button clicks from the active animation', async (direction) => {
  const map = await mountHeatmap();
  const firstZoom = map.getZoom() + direction;
  startZoom(map, firstZoom);
  const requestZoom = vi.spyOn(map, 'setZoom');
  const button = screen.getByRole('button', { name: direction > 0 ? 'heatmap.page_zoom_in' : 'heatmap.page_zoom_out' });
  fireEvent.click(button);
  fireEvent.click(button);
  endZoom(map);
  act(() => vi.advanceTimersByTime(1000));
  expect(requestZoom).not.toHaveBeenCalled();
  expect(leaflet.positions).toEqual([firstZoom]);
  fireEvent.click(button);
  expect(requestZoom).toHaveBeenCalledTimes(1);
  expect(requestZoom.mock.calls[0][0]).toBe(firstZoom + direction);
});

it('preserves the visible GPS frame when a resize requests a redraw during zoom', async () => {
  const map = await mountHeatmap();
  const canvas = document.querySelector('.heatmap-page-dot-canvas');
  const context = contexts.get(canvas);
  context.clearRect.mockClear();
  startZoom(map, map.getZoom() + 1);
  const animatedTransform = canvas.style.transform;
  act(() => map.fire('resize'));
  act(() => vi.advanceTimersByTime(32));
  expect(context.clearRect).not.toHaveBeenCalled();
  expect(canvas.style.transform).toBe(animatedTransform);
  endZoom(map);
  expect(context.clearRect).toHaveBeenCalled();
});

function recordWheelViews(map) {
  const acceptedViews = vi.fn();
  vi.spyOn(map, 'setView').mockImplementation((center, zoom, options) => {
    // Match Leaflet's native _tryAnimatedZoom guard: input received during
    // the transition does not start another camera animation.
    if (map._animatingZoom) return map;
    acceptedViews(center, zoom, options);
    map._animateToCenter = center;
    map._animateToZoom = zoom;
    map._animatingZoom = true;
    map.fire('zoomstart');
    map.fire('movestart');
    map.fire('zoomanim', { center, zoom });
    map._move(center, zoom, undefined, true);
    return map;
  });
  return acceptedViews;
}

it('responds to small wheel input without imposing a new dead zone', async () => {
  const map = await mountHeatmap();
  const initialZoom = map.getZoom();
  const views = recordWheelViews(map);
  fireEvent.wheel(map.getContainer(), { deltaY: 40, deltaMode: 0, clientX: 640, clientY: 350 });
  act(() => vi.advanceTimersByTime(64));
  expect(views).toHaveBeenCalledTimes(1);
  expect(views.mock.calls[0][1]).toBe(initialZoom - 1);
});

it('preserves Leaflet sensitivity for a large packet in one animated zoom', async () => {
  const map = await mountHeatmap();
  const initialZoom = map.getZoom();
  const views = recordWheelViews(map);
  fireEvent.wheel(map.getContainer(), { deltaY: 720, deltaMode: 0, clientX: 640, clientY: 350 });
  act(() => vi.advanceTimersByTime(64));
  expect(views).toHaveBeenCalledTimes(1);
  expect(views.mock.calls[0][1]).toBe(initialZoom - 3);
  endZoom(map);
  act(() => vi.advanceTimersByTime(64));
  expect(views).toHaveBeenCalledTimes(1);
});

it('does not replay the tail of a wheel gesture after its first zoom finishes', async () => {
  const map = await mountHeatmap();
  const initialZoom = map.getZoom();
  const views = recordWheelViews(map);
  for (const deltaY of [120, 40, 20]) {
    fireEvent.wheel(map.getContainer(), { deltaY, deltaMode: 0, clientX: 640, clientY: 350 });
    act(() => vi.advanceTimersByTime(32));
  }
  expect(views).toHaveBeenCalledTimes(1);
  expect(map.getZoom()).toBe(initialZoom - 1);
  endZoom(map);
  act(() => vi.advanceTimersByTime(1000));
  expect(views).toHaveBeenCalledTimes(1);
  expect(map.getZoom()).toBe(initialZoom - 1);

  fireEvent.wheel(map.getContainer(), { deltaY: -120, deltaMode: 0, clientX: 640, clientY: 350 });
  act(() => vi.advanceTimersByTime(64));
  expect(views).toHaveBeenCalledTimes(2);
  expect(map.getZoom()).toBe(initialZoom);
});

it('discards a debounced wheel tail still pending when the animation finishes', async () => {
  const map = await mountHeatmap();
  const views = recordWheelViews(map);
  fireEvent.wheel(map.getContainer(), { deltaY: 120, deltaMode: 0, clientX: 640, clientY: 350 });
  act(() => vi.advanceTimersByTime(32));
  const currentZoom = map.getZoom();
  fireEvent.wheel(map.getContainer(), { deltaY: 40, deltaMode: 0, clientX: 640, clientY: 350 });
  endZoom(map);
  act(() => vi.advanceTimersByTime(1000));
  expect(views).toHaveBeenCalledTimes(1);
  expect(map.getZoom()).toBe(currentZoom);
});

it('cancels a pending wheel gesture when the heatmap unmounts', async () => {
  const map = await mountHeatmap();
  const requestZoom = vi.spyOn(map, 'setZoomAround').mockReturnValue(map);
  fireEvent.wheel(map.getContainer(), { deltaY: 720, deltaMode: 0, clientX: 640, clientY: 350 });
  cleanup();
  act(() => vi.advanceTimersByTime(500));
  expect(requestZoom).not.toHaveBeenCalled();
});

it('retains the painted basemap across a large zoom-out until replacement tiles load', async () => {
  const map = await mountHeatmap();
  let layer;
  map.eachLayer((candidate) => { if (!layer && candidate.options.className === 'heatmap-page-dark-tile-layer') layer = candidate; });
  const initialZoom = map.getZoom();
  for (const tile of Object.values(layer._tiles)) {
    tile.loaded = Date.now();
    tile.active = true;
    Object.defineProperty(tile.el, 'complete', { configurable: true, value: true });
  }
  startZoom(map, initialZoom - 3);
  act(() => map.fire('zoom'));
  endZoom(map);
  expect(layer.isLoading()).toBe(true);
  expect(Object.values(layer._tiles).some((tile) => tile.coords.z === initialZoom && tile.loaded)).toBe(true);
  act(() => {
    for (const tile of Object.values(layer._tiles)) {
      if (tile.coords.z === initialZoom - 3) layer._tileReady(tile.coords, null, tile.el);
    }
    vi.advanceTimersByTime(300);
  });
  expect(layer.isLoading()).toBe(false);
  expect(Object.values(layer._tiles).some((tile) => tile.coords.z === initialZoom)).toBe(false);
});

it('finishes CSS zoom transitions within Leaflet 1.9\'s 250 ms animation lifecycle', () => {
  const css = readFileSync('src/styles/_split/heatmap.css', 'utf8');
  const transitions = [...css.matchAll(/transition:\s*transform\s+([\d.]+)s/g)];
  expect(transitions.length).toBeGreaterThan(0);
  for (const [, seconds] of transitions) expect(Number(seconds)).toBeLessThanOrEqual(0.25);
});

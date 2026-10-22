import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminCourseMapPreview from './AdminCourseMapPreview.jsx';

const calls = vi.hoisted(() => ({ overlay: vi.fn(), polyline: vi.fn(), marker: vi.fn(), tileLoads: [], failMap: false }));
vi.mock('../api', () => ({ getBackendBaseUrl: () => '' }));
vi.mock('leaflet', () => {
  const bounds = { pad() { return this; } };
  const layer = () => ({
    addTo() { return this; }, on() { return this; }, off() { return this; },
    getBounds: () => bounds, getContainer: () => null, redraw() {},
  });
  return { default: {
    map: () => {
      if (calls.failMap) throw new Error('Leaflet unavailable');
      return { createPane: () => ({ style: {} }), fitBounds() {}, invalidateSize() {}, remove() {}, removeLayer() {}, setView() {} };
    },
    latLngBounds: () => bounds,
    tileLayer: () => {
      const tiles = layer();
      tiles.on = (event, listener) => {
        if (event === 'tileload') calls.tileLoads.push(listener);
        return tiles;
      };
      return tiles;
    },
    imageOverlay: (...args) => { calls.overlay(...args); return layer(); },
    polyline: (...args) => { calls.polyline(...args); return layer(); },
    circleMarker: (...args) => { calls.marker(...args); return layer(); },
  } };
});

beforeEach(() => { vi.clearAllMocks(); calls.tileLoads.length = 0; calls.failMap = false; });
afterEach(cleanup);
const preview = {
  imageUrl: '/official-tokyo-reference.png',
  source: 'tokyo-official-course',
  overlayBounds: { north: 35.71, south: 35.64, east: 139.81, west: 139.69 },
  routePoints: [{ lat: 35.690272, lng: 139.691507 }, { lat: 35.681498, lng: 139.764924 }],
};

it('renders the verified Tokyo street route without stretching its illustration over the map', async () => {
  render(<AdminCourseMapPreview preview={preview} title="Tokyo Marathon" />);
  await waitFor(() => expect(calls.polyline).toHaveBeenCalledTimes(2));
  expect(calls.polyline.mock.calls[0][0]).toEqual([[35.690272, 139.691507], [35.681498, 139.764924]]);
  expect(calls.overlay).not.toHaveBeenCalled();
});

it.each([undefined, 'unknown-source', 'admin-upload', 'admin-upload-aligned', 'reviewed-source-map:qingdao-marathon', 'verified-official-map:qingdao-marathon'])('keeps the %s map free of source images while loading and ready', async source => {
  const sourcePreview = { ...preview, source, imageUrl: '/qingdao-poster.jpg' };
  const { container, rerender } = render(<AdminCourseMapPreview preview={sourcePreview} title="Qingdao Marathon" />);
  await waitFor(() => expect(calls.polyline).toHaveBeenCalledTimes(2));
  expect(calls.polyline.mock.calls[1][0]).toEqual([[35.690272, 139.691507], [35.681498, 139.764924]]);
  expect(calls.overlay).not.toHaveBeenCalled();
  expect(container.querySelector('.admin-review-preview__map')).toBeInTheDocument();
  expect(container.querySelector('.admin-review-preview__map.is-ready')).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Qingdao Marathon' })).not.toBeInTheDocument();
  await act(async () => calls.tileLoads[0]());
  await waitFor(() => expect(container.querySelector('.admin-review-preview__map.is-ready')).toBeInTheDocument());
  expect(screen.queryByRole('img', { name: 'Qingdao Marathon' })).not.toBeInTheDocument();
  expect(calls.overlay).not.toHaveBeenCalled();
  rerender(<AdminCourseMapPreview preview={sourcePreview} title="Qingdao Marathon" renderMap={false} />);
  expect(screen.getByRole('img', { name: 'Qingdao Marathon' })).toHaveAttribute('src', '/qingdao-poster.jpg');
});

it('keeps the standalone poster when no geographic route is available', () => {
  const { container } = render(<AdminCourseMapPreview preview={{ imageUrl: '/source-poster.jpg' }} title="Source poster" />);
  expect(screen.getByRole('img', { name: 'Source poster' })).toHaveAttribute('src', '/source-poster.jpg');
  expect(container.querySelector('.admin-review-preview__map')).not.toBeInTheDocument();
  expect(calls.overlay).not.toHaveBeenCalled();
});

it('keeps marker-only map mode free of source images', async () => {
  const { container } = render(<AdminCourseMapPreview preview={{ imageUrl: '/source-poster.jpg' }} title="Location" fallbackCenter={{ lat: 36.06, lng: 120.38 }} forceLiveMap />);
  await waitFor(() => expect(calls.marker).toHaveBeenCalledTimes(1));
  expect(calls.marker.mock.calls[0][0]).toEqual([36.06, 120.38]);
  expect(screen.queryByRole('img', { name: 'Location' })).not.toBeInTheDocument();
  await act(async () => calls.tileLoads[0]());
  await waitFor(() => expect(container.querySelector('.admin-review-preview__map.is-ready')).toBeInTheDocument());
  expect(calls.overlay).not.toHaveBeenCalled();
});

it('keeps an aligned geographic route visible if Leaflet fails without substituting its poster', async () => {
  calls.failMap = true;
  const { container, rerender } = render(<AdminCourseMapPreview preview={preview} title="Tokyo Marathon" />);
  await waitFor(() => expect(container.querySelector('svg.admin-review-preview__static-route')).toBeInTheDocument());
  expect(container.querySelector('path.admin-review-preview__static-route-line')).toHaveAttribute('d');
  expect(container.querySelector('img')).not.toBeInTheDocument();
  rerender(<AdminCourseMapPreview preview={preview} title="Tokyo Marathon" renderMap={false} />);
  expect(screen.getByRole('img', { name: 'Tokyo Marathon' })).toHaveAttribute('src', preview.imageUrl);
});

it('keeps a known-route source image separate from the geographic route', async () => {
  render(<AdminCourseMapPreview preview={{ ...preview, source: 'admin-upload', summary: 'Hermes aligned this upload through a known ordered marathon route before CV/Qwen analysis.' }} title="Course map" />);
  await waitFor(() => expect(calls.polyline).toHaveBeenCalledTimes(2));
  expect(calls.overlay).not.toHaveBeenCalled();
});

it.each(['admin-official-rtrt-map', 'admin-official-strava-route', 'admin-validated-umap-route'])('does not stretch the interactive source %s over the route', async source => {
  render(<AdminCourseMapPreview preview={{ ...preview, source }} title="Course map" />);
  await waitFor(() => expect(calls.polyline).toHaveBeenCalledTimes(2));
  expect(calls.overlay).not.toHaveBeenCalled();
});

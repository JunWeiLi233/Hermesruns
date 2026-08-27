import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { buildRunDetailPath } from '../utils/runRoute';

const RUNS_STRAVA_SYNC_POLL_INTERVAL_MS = 2000;
const RUNS_STRAVA_SYNC_POLL_DEADLINE_MS = 120000;
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import { invalidateResourceCache } from '../api/resourceCache';
import AppIcon from '../components/AppIcon';
import PageSkeleton from '../components/PageSkeleton';
import FooterNavLinks from '../components/FooterNavLinks';
import { formatDate, formatDistance, formatDuration, formatPace } from '../utils/format';
import HermesLogo from '../components/HermesLogo';
import ImportDataGuide from '../components/ImportDataGuide';
import Modal from '../components/Modal';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import { preloadRoute } from '../utils/routePreload';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { formatStravaSyncLabel, STRAVA_SYNC_FINISHED_EVENT } from '../utils/stravaAutoSync';
import { createRoutePreviewRequestCoordinator } from './runsRequestCoordinator';
import { canonicalizeRunsCacheEmail, createRunsLoadGeneration, invalidateRunsCache, readRunsCache, writeRunsCache } from './runsCache';
import { invalidateHeatmapCache } from './heatmapCache';
import { budgetMonthGroupsByRunCount, captureRunsScrollPosition, getRunsLoadMoreRootMargin, restoreRunsScrollPosition } from './runsLoadMore';

const runDate = (r) => new Date(r.startTime || r.startDate || 0);

function localizeStravaSyncMessage(message, t) {
  const raw = String(message || '').trim();
  if (!raw) return '';
  if (raw === 'Strava sync started') return t('profile.strava_sync_started');
  if (/No Strava/i.test(raw)) return t('profile.strava_sync_not_linked');
  if (/application.*inactive|inactive.*application|api app/i.test(raw)) return t('settings.stitch_strava_active');
  if (/invalid|expired|relink/i.test(raw)) return t('profile.strava_sync_relink_required');
  return raw;
}

function computeBboxFromPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) return null;
  return { minLat, maxLat, minLng, maxLng };
}

function lngToWorldX(lng) {
  return clampNumber((lng + 180) / 360, 0, 1);
}

function latToWorldY(lat) {
  const latRad = (clampMercatorLat(lat) * Math.PI) / 180;
  return clampNumber((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2, 0, 1);
}

function buildRoutePreviewModel(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const bbox = computeBboxFromPoints(points);
  if (!bbox) return null;
  const projected = points.map(([lat, lng]) => [lngToWorldX(lng), latToWorldY(lat)]);
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const mapFrame = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
  const xSpan = Math.max(0.0000001, mapFrame.maxX - mapFrame.minX);
  const ySpan = Math.max(0.0000001, mapFrame.maxY - mapFrame.minY);
  const normalized = projected.map(([x, y]) => [
    ROUTE_PREVIEW_PADDING + ((x - mapFrame.minX) / xSpan) * ROUTE_PREVIEW_INNER_SIZE,
    ROUTE_PREVIEW_PADDING + ((y - mapFrame.minY) / ySpan) * ROUTE_PREVIEW_INNER_SIZE,
  ]);
  return {
    path: normalized.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' '),
    start: normalized[0],
    finish: normalized[normalized.length - 1],
    bbox,
    mapFrame,
    mercatorPoints: projected,
  };
}

function readBboxFromPreview(preview) {
  if (!preview || typeof preview !== 'object') return null;
  const direct = preview.bbox && typeof preview.bbox === 'object' ? preview.bbox : preview;
  const minLat = Number(direct.minLat);
  const maxLat = Number(direct.maxLat);
  const minLng = Number(direct.minLng);
  const maxLng = Number(direct.maxLng);
  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) return null;
  if (minLat === maxLat && minLng === maxLng) return null;
  return { minLat, maxLat, minLng, maxLng };
}

function readMapFrameFromPreview(preview) {
  if (!preview || typeof preview !== 'object' || !preview.mapFrame || typeof preview.mapFrame !== 'object') return null;
  const minX = Number(preview.mapFrame.minX);
  const maxX = Number(preview.mapFrame.maxX);
  const minY = Number(preview.mapFrame.minY);
  const maxY = Number(preview.mapFrame.maxY);
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;
  if (minX === maxX && minY === maxY) return null;
  return {
    minX: clampNumber(minX, 0, 1),
    maxX: clampNumber(maxX, 0, 1),
    minY: clampNumber(minY, 0, 1),
    maxY: clampNumber(maxY, 0, 1),
  };
}

function readMercatorPointsFromPreview(preview) {
  if (!preview || typeof preview !== 'object' || !Array.isArray(preview.mercatorPoints)) return null;
  const points = preview.mercatorPoints
    .map((point) => (Array.isArray(point) ? [Number(point[0]), Number(point[1])] : null))
    .filter((point) => point && point.every(Number.isFinite));
  return points.length >= 2 ? points : null;
}

function normalizeRoutePreview(preview) {
  if (!preview || typeof preview !== 'object' || !preview.path) return null;
  const startX = Array.isArray(preview.start) ? Number(preview.start[0]) : Number(preview.startX);
  const startY = Array.isArray(preview.start) ? Number(preview.start[1]) : Number(preview.startY);
  const finishX = Array.isArray(preview.finish) ? Number(preview.finish[0]) : Number(preview.finishX);
  const finishY = Array.isArray(preview.finish) ? Number(preview.finish[1]) : Number(preview.finishY);
  if (![startX, startY, finishX, finishY].every(Number.isFinite)) return null;
  return {
    path: preview.path,
    start: [startX, startY],
    finish: [finishX, finishY],
    bbox: readBboxFromPreview(preview),
    mapFrame: readMapFrameFromPreview(preview),
    mercatorPoints: readMercatorPointsFromPreview(preview),
  };
}

// Real-world dark-mode map tile helpers — renders a concrete OpenStreetMap
// area under each thumbnail's SVG route so a runner sees where the run
// actually happened, not just an abstract gradient.
const ROUTE_PREVIEW_VIEW_SIZE = 100;
const ROUTE_PREVIEW_PADDING = 24;
const ROUTE_PREVIEW_INNER_SIZE = ROUTE_PREVIEW_VIEW_SIZE - (ROUTE_PREVIEW_PADDING * 2);
const ROUTE_TILE_MIN_ZOOM = 2;
// Esri World Dark Gray Base stops at LOD 16; CARTO's dark tiles now require
// a registered API key, so 16 is also the keyless ceiling for thumbnails.
const ROUTE_TILE_MAX_ZOOM = 16;
const ROUTE_TILE_MAX_LAYERS = 64;
const ROUTE_TILE_TARGET_CSS_PX = 128;
const ROUTE_TILE_MAX_MERCATOR_LAT = 85.05112878;
const ROUTE_THUMB_DEFAULT_ASPECT = 132 / 240;
const ROUTE_THUMB_DEFAULT_SIZE = { width: 132, height: 240 };

function pickRouteTileZoom(latSpan, lngSpan) {
  // Pick the smallest zoom whose single 256-tile width exceeds the route span,
  // so the whole route fits in roughly one tile. log2(360 / span) gives the
  // zoom at which one tile equals `span` degrees of longitude; subtract 1 so
  // the route sits comfortably with margin.
  const span = Math.max(latSpan * 2, lngSpan, 0.0005);
  const rawZoom = Math.floor(Math.log2(360 / span)) - 1;
  if (!Number.isFinite(rawZoom)) return 12;
  return Math.max(ROUTE_TILE_MIN_ZOOM, Math.min(ROUTE_TILE_MAX_ZOOM, rawZoom));
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampMercatorLat(lat) {
  return clampNumber(lat, -ROUTE_TILE_MAX_MERCATOR_LAT, ROUTE_TILE_MAX_MERCATOR_LAT);
}

function worldXToTileX(x, zoom) {
  const n = 2 ** zoom;
  return clampNumber(Math.floor(clampNumber(x, 0, 1) * n), 0, n - 1);
}

function worldYToTileY(y, zoom) {
  const n = 2 ** zoom;
  return clampNumber(Math.floor(clampNumber(y, 0, 1) * n), 0, n - 1);
}

function buildRouteTileUrl(zoom, x, y) {
  if (![zoom, x, y].every(Number.isFinite)) return null;
  const n = 2 ** zoom;
  if (zoom < ROUTE_TILE_MIN_ZOOM || zoom > ROUTE_TILE_MAX_ZOOM || x < 0 || y < 0 || x >= n || y >= n) return null;
  // Esri Dark Gray (no labels at thumbnail scale); the MapServer tile path is
  // /tile/{z}/{y}/{x} with no file extension.
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${zoom}/${y}/${x}`;
}

function tileRangeForPreviewBounds(viewBounds, zoom) {
  const minX = worldXToTileX(viewBounds.minX, zoom);
  const maxX = worldXToTileX(viewBounds.maxX, zoom);
  const minY = worldYToTileY(viewBounds.minY, zoom);
  const maxY = worldYToTileY(viewBounds.maxY, zoom);
  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  };
}

function pickRouteTileZoomForViewport(viewBounds, viewportSize = ROUTE_THUMB_DEFAULT_SIZE) {
  const viewXSpan = Math.max(0.0000001, viewBounds.maxX - viewBounds.minX);
  const viewYSpan = Math.max(0.0000001, viewBounds.maxY - viewBounds.minY);
  const fallbackZoom = pickRouteTileZoom(viewYSpan * 360, viewXSpan * 360);
  const width = Number(viewportSize?.width);
  const height = Number(viewportSize?.height);
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return fallbackZoom;
  }

  const xZoom = Math.ceil(Math.log2(width / (ROUTE_TILE_TARGET_CSS_PX * viewXSpan)));
  const yZoom = Math.ceil(Math.log2(height / (ROUTE_TILE_TARGET_CSS_PX * viewYSpan)));
  const rawZoom = Math.max(fallbackZoom, xZoom, yZoom);
  if (!Number.isFinite(rawZoom)) return fallbackZoom;
  return Math.max(ROUTE_TILE_MIN_ZOOM, Math.min(ROUTE_TILE_MAX_ZOOM, rawZoom));
}

function mapFrameFromBbox(bbox) {
  if (!bbox) return null;
  const minX = lngToWorldX(bbox.minLng);
  const maxX = lngToWorldX(bbox.maxLng);
  const minY = latToWorldY(bbox.maxLat);
  const maxY = latToWorldY(bbox.minLat);
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;
  return { minX, maxX, minY, maxY };
}

function shiftFrameIntoWorld(min, span) {
  if (span >= 1) return { min: 0, max: 1 };
  const shiftedMin = clampNumber(min, 0, 1 - span);
  return { min: shiftedMin, max: shiftedMin + span };
}

function buildRouteViewportFrame(routeFrame, viewportAspect = ROUTE_THUMB_DEFAULT_ASPECT) {
  if (!routeFrame) return null;
  const xSpan = Math.max(0.0000001, routeFrame.maxX - routeFrame.minX);
  const ySpan = Math.max(0.0000001, routeFrame.maxY - routeFrame.minY);
  const aspect = Number.isFinite(viewportAspect) && viewportAspect > 0
    ? viewportAspect
    : ROUTE_THUMB_DEFAULT_ASPECT;
  const innerRatio = ROUTE_PREVIEW_INNER_SIZE / ROUTE_PREVIEW_VIEW_SIZE;
  const minViewXSpan = xSpan / innerRatio;
  const minViewYSpan = ySpan / innerRatio;
  let viewXSpan = minViewXSpan;
  let viewYSpan = minViewYSpan;
  if (viewXSpan / viewYSpan < aspect) {
    viewXSpan = viewYSpan * aspect;
  } else {
    viewYSpan = viewXSpan / aspect;
  }
  viewXSpan = Math.min(1, Math.max(viewXSpan, 0.0000001));
  viewYSpan = Math.min(1, Math.max(viewYSpan, 0.0000001));
  const centerX = (routeFrame.minX + routeFrame.maxX) / 2;
  const centerY = (routeFrame.minY + routeFrame.maxY) / 2;
  const xFrame = shiftFrameIntoWorld(centerX - (viewXSpan / 2), viewXSpan);
  const yFrame = shiftFrameIntoWorld(centerY - (viewYSpan / 2), viewYSpan);
  return {
    minX: xFrame.min,
    maxX: xFrame.max,
    minY: yFrame.min,
    maxY: yFrame.max,
  };
}

function buildMercatorPreviewPath(mercatorPoints, viewportFrame) {
  if (!Array.isArray(mercatorPoints) || mercatorPoints.length < 2 || !viewportFrame) return null;
  const viewXSpan = Math.max(0.0000001, viewportFrame.maxX - viewportFrame.minX);
  const viewYSpan = Math.max(0.0000001, viewportFrame.maxY - viewportFrame.minY);
  const normalized = mercatorPoints.map(([worldX, worldY]) => [
    ((worldX - viewportFrame.minX) / viewXSpan) * ROUTE_PREVIEW_VIEW_SIZE,
    ((worldY - viewportFrame.minY) / viewYSpan) * ROUTE_PREVIEW_VIEW_SIZE,
  ]);
  return {
    path: normalized.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' '),
    start: normalized[0],
    finish: normalized[normalized.length - 1],
  };
}

function buildRouteTileLayers(viewBounds, viewportSize = ROUTE_THUMB_DEFAULT_SIZE) {
  if (!viewBounds) return [];
  const viewXSpan = Math.max(0.0000001, viewBounds.maxX - viewBounds.minX);
  const viewYSpan = Math.max(0.0000001, viewBounds.maxY - viewBounds.minY);
  let zoom = pickRouteTileZoomForViewport(viewBounds, viewportSize);
  let range = tileRangeForPreviewBounds(viewBounds, zoom);
  while (((range.maxX - range.minX + 1) * (range.maxY - range.minY + 1)) > ROUTE_TILE_MAX_LAYERS && zoom > ROUTE_TILE_MIN_ZOOM) {
    zoom -= 1;
    range = tileRangeForPreviewBounds(viewBounds, zoom);
  }

  const layers = [];
  for (let x = range.minX; x <= range.maxX; x += 1) {
    for (let y = range.minY; y <= range.maxY; y += 1) {
      const url = buildRouteTileUrl(zoom, x, y);
      if (!url) continue;
      const tileMinX = x / (2 ** zoom);
      const tileMaxX = (x + 1) / (2 ** zoom);
      const tileMinY = y / (2 ** zoom);
      const tileMaxY = (y + 1) / (2 ** zoom);
      layers.push({
        key: `${zoom}-${x}-${y}`,
        url,
        style: {
          left: `${((tileMinX - viewBounds.minX) / viewXSpan) * 100}%`,
          top: `${((tileMinY - viewBounds.minY) / viewYSpan) * 100}%`,
          width: `${((tileMaxX - tileMinX) / viewXSpan) * 100}%`,
          height: `${((tileMaxY - tileMinY) / viewYSpan) * 100}%`,
        },
      });
    }
  }
  return layers;
}

function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () => {
      const rect = node.getBoundingClientRect();
      const width = Number(rect.width.toFixed(2));
      const height = Number(rect.height.toFixed(2));
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      setSize((current) => (
        current && current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

// Persist bbox per run id so subsequent loads don't re-fetch the point list
// just to recompute the same 4 numbers. Bbox never changes for a given run.
const ROUTE_BBOX_CACHE_PREFIX = 'hermes_run_bbox_v1_';
const ROUTE_BBOX_CACHE_TTL_MS = 30 * 86400000; // 30 days

function readBboxCache(runId) {
  try {
    const raw = localStorage.getItem(`${ROUTE_BBOX_CACHE_PREFIX}${runId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > ROUTE_BBOX_CACHE_TTL_MS) return null;
    return readBboxFromPreview(parsed.bbox);
  } catch { return null; }
}

function writeBboxCache(runId, bbox) {
  if (!bbox) return;
  try {
    localStorage.setItem(`${ROUTE_BBOX_CACHE_PREFIX}${runId}`, JSON.stringify({ bbox, cachedAt: Date.now() }));
  } catch { /* quota — ignore */ }
}

function RoutePreviewThumb({ preview, provider, runName, bbox }) {
  const [thumbRef, thumbSize] = useElementSize();
  const normalizedPreview = normalizeRoutePreview(preview);
  const resolvedBbox = bbox || (normalizedPreview ? normalizedPreview.bbox : null);
  const routeFrame = normalizedPreview?.mapFrame || mapFrameFromBbox(resolvedBbox);
  const viewportAspect = thumbSize?.width && thumbSize?.height
    ? thumbSize.width / thumbSize.height
    : ROUTE_THUMB_DEFAULT_ASPECT;
  const viewportFrame = routeFrame ? buildRouteViewportFrame(routeFrame, viewportAspect) : null;
  const tileLayers = viewportFrame ? buildRouteTileLayers(viewportFrame, thumbSize) : [];
  const mercatorPreview = normalizedPreview?.mercatorPoints
    ? buildMercatorPreviewPath(normalizedPreview.mercatorPoints, viewportFrame)
    : null;
  const displayPreview = mercatorPreview || normalizedPreview;

  return (
    <div ref={thumbRef} className={`recent-runs-thumb${displayPreview ? ' is-route-preview' : ''}${tileLayers.length ? ' has-route-tile' : ''}`}>
      {tileLayers.map((layer) => (
        <img
          key={layer.key}
          className="recent-runs-thumb-route-tile"
          src={layer.url}
          style={layer.style}
          data-route-tile-layer={layer.key}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
      ))}
      {displayPreview ? (
        <>
          <svg className="recent-runs-thumb-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="recent-runs-thumb-route-shadow" d={displayPreview.path} />
            <path className="recent-runs-thumb-route-line" d={displayPreview.path} />
          </svg>
          <span
            className="recent-runs-thumb-route-point recent-runs-thumb-route-start"
            style={{ left: `${displayPreview.start[0]}%`, top: `${displayPreview.start[1]}%` }}
            aria-hidden="true"
          />
          <span
            className="recent-runs-thumb-route-point recent-runs-thumb-route-finish"
            style={{ left: `${displayPreview.finish[0]}%`, top: `${displayPreview.finish[1]}%` }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div className="recent-runs-thumb-route-empty" aria-hidden="true">
          <AppIcon name="route" className="runner-dashboard-side-link-icon" />
        </div>
      )}
      <div className="recent-runs-thumb-badge">{provider}</div>
      <div className="recent-runs-thumb-map-label">{runName}</div>
    </div>
  );
}

const RECENT_RUNS_INITIAL_VISIBLE_COUNT = 3;
const RECENT_RUNS_LOAD_BATCH_SIZE = 6;
// The history render window grows on this cadence until every filtered run is
// mounted, so loading never depends on where the scroll sentinel sits or on
// month cards being expanded/collapsed. The observer only accelerates it.
const RUNS_BACKGROUND_LOAD_STEP_MS = 120;
const ROUTE_PREVIEW_INITIAL_PRELOAD_COUNT = RECENT_RUNS_INITIAL_VISIBLE_COUNT + (RECENT_RUNS_LOAD_BATCH_SIZE * 2);
const ROUTE_PREVIEW_PREFETCH_LOOKAHEAD = RECENT_RUNS_LOAD_BATCH_SIZE * 3;

function normalizeRoutePreviewBatch(data) {
  const previewUpdates = {};
  const bboxUpdates = {};
  const terminalIds = [];
  if (!Array.isArray(data)) return { previewUpdates, bboxUpdates, terminalIds };

  data.forEach((entry) => {
    const activityId = Number(entry?.activityId);
    if (!Number.isFinite(activityId)) return;
    const availability = String(entry?.availability || '').toUpperCase();
    if (availability === 'READY' || availability === 'NO_ROUTE' || availability === 'DEFERRED') {
      terminalIds.push(activityId);
    }
    const pointCount = Number(entry?.pointCount);
    const points = Array.isArray(entry?.points)
      ? entry.points
        .map((point) => [Number(point?.latitude), Number(point?.longitude)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
      : [];
    const previewModel = buildRoutePreviewModel(points);
    const preview = previewModel
      ? {
        ...previewModel,
        pointCount: Number.isFinite(pointCount) && pointCount > 0 ? pointCount : points.length,
      }
      : null;
    const bbox = readBboxFromPreview(entry?.bbox) || preview?.bbox || null;
    if (preview) {
      previewUpdates[activityId] = preview;
    }
    if (bbox) {
      bboxUpdates[activityId] = bbox;
      writeBboxCache(activityId, bbox);
    }
  });

  return { previewUpdates, bboxUpdates, terminalIds };
}

async function fetchRoutePreviewBatch(ids) {
  const normalizedIds = Array.isArray(ids)
    ? ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
    : [];
  if (normalizedIds.length === 0) return { previewUpdates: {}, bboxUpdates: {}, terminalIds: [] };
  const params = new URLSearchParams({ ids: normalizedIds.join(',') });
  const data = await apiJson(`/api/activities/route-previews?${params.toString()}`);
  return normalizeRoutePreviewBatch(data);
}

function RunCard({ run, t, lang, routePreviewFallbacks, routeBboxes, onOpen, onDelete }) {
  const provider = run.provider || t('runs.manual_import');
  const runName = run.name || t('runs.default_run_name');
  const pointPreview = routePreviewFallbacks[run.id];
  const preview = pointPreview || run.routePreview || null;
  // Bbox priority: explicit override (cached from a previous fallback fetch) →
  // bbox embedded in the preview (today only happens via the fallback path).
  const bbox = routeBboxes[run.id] || readBboxFromPreview(pointPreview) || readBboxFromPreview(run.routePreview);

  return (
    <div className="recent-runs-card-shell">
      <button type="button" className="recent-runs-card" data-run-id={run.id || ''} onClick={() => onOpen(run)}>
        <RoutePreviewThumb preview={preview} provider={provider} runName={runName} bbox={bbox} />
        <div className="recent-runs-card-body">
          <div className="recent-runs-card-top">
            <div>
              <h2>{runName}</h2>
              <p className="recent-runs-card-date"><AppIcon name="calendar_today" className="runner-dashboard-side-link-icon" />{formatDate(run.startTime || run.startDate, lang)}</p>
            </div>
          </div>
          <div className="recent-runs-card-metrics">
            <div className="recent-runs-card-metric recent-runs-card-metric--accent"><span>{t('runs.metric_distance')}</span><strong>{formatDistance(Number(run.distanceKm || 0), 1, lang)}</strong></div>
            <div className="recent-runs-card-metric"><span>{t('runs.metric_average_pace')}</span><strong>{formatPace(Number(run.distanceKm || 0), Number(run.movingTimeSeconds || 0), lang)}</strong></div>
            <div className="recent-runs-card-metric"><span>{t('runs.metric_moving_time')}</span><strong>{formatDuration(run.movingTimeSeconds)}</strong></div>
          </div>
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          className="recent-runs-card-delete"
          aria-label={t('runs.delete')}
          title={t('runs.delete')}
          onClick={(e) => { e.stopPropagation(); onDelete(run); }}
        >
          <AppIcon name="close" />
        </button>
      )}
    </div>
  );
}

const Runs = memo(function Runs() {
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [profile, setProfile] = useState(null);
  const [allRuns, setAllRuns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [activeMode, setActiveMode] = useState('all');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [runsSort, setRunsSort] = useState('date');
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaLinking, setStravaLinking] = useState(false);
  const [integrationNotice, setIntegrationNotice] = useState('');
  const [integrationNoticeTone, setIntegrationNoticeTone] = useState('info');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [fitExportFiles, setFitExportFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const selectedImportFileCount = [fitExportFiles, corosFiles, huaweiFiles]
    .reduce((total, files) => total + (files?.length ?? 0), 0);
  const [routePreviewFallbacks, setRoutePreviewFallbacks] = useState({});
  // Per-run geographic bbox keyed by run id. Seeded from localStorage so a
  // repeat page load does not need to re-fetch preview metadata for the same runs.
  const [routeBboxes, setRouteBboxes] = useState({});
  const [visibleRunsCount, setVisibleRunsCount] = useState(RECENT_RUNS_INITIAL_VISIBLE_COUNT);
  // Track which month groups the runner has explicitly collapsed. Default
  // open: every month starts expanded so all runs render exactly the way
  // they did before the fold-affordance shipped — runners only feel the
  // change when they deliberately fold a month. Using a Set of keys keeps
  // the state O(1) per toggle and short-circuits on the empty default.
  const [collapsedMonthKeys, setCollapsedMonthKeys] = useState(() => new Set());
  const routePreviewRequestCoordinatorRef = useRef(null);
  if (routePreviewRequestCoordinatorRef.current === null) {
    routePreviewRequestCoordinatorRef.current = createRoutePreviewRequestCoordinator();
  }
  const runsLoadGenerationRef = useRef(null);
  if (runsLoadGenerationRef.current === null) {
    runsLoadGenerationRef.current = createRunsLoadGeneration();
  }
  const runsIdentity = canonicalizeRunsCacheEmail(email);
  const runsMetadataRef = useRef({ identity: null, profile: null, stravaStatus: null });
  const loadMoreSentinelRef = useRef(null);

  const toggleMonthFold = useCallback((monthKey) => {
    setCollapsedMonthKeys((current) => {
      const next = new Set(current);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const resetRoutePreviewState = useCallback(() => {
    routePreviewRequestCoordinatorRef.current.reset();
  }, []);

  const requestRoutePreviews = useCallback(async (candidateIds, { isCurrent = () => true } = {}) => {
    if (!isCurrent()) return;
    const requestGeneration = routePreviewRequestCoordinatorRef.current.getGeneration();
    let retryableIds = await routePreviewRequestCoordinatorRef.current.waitFor(candidateIds);
    if (!isCurrent() || routePreviewRequestCoordinatorRef.current.getGeneration() !== requestGeneration || retryableIds.length === 0) return;

    let claim = routePreviewRequestCoordinatorRef.current.claimWithToken(retryableIds);
    while (claim.ids.length !== retryableIds.length) {
      const pendingIds = [...retryableIds];
      routePreviewRequestCoordinatorRef.current.release(claim.ids, claim.token);
      retryableIds = await routePreviewRequestCoordinatorRef.current.waitFor(pendingIds);
      if (!isCurrent() || routePreviewRequestCoordinatorRef.current.getGeneration() !== requestGeneration || retryableIds.length === 0) return;
      claim = routePreviewRequestCoordinatorRef.current.claimWithToken(retryableIds);
    }

    try {
      const { previewUpdates, bboxUpdates, terminalIds = [] } = await fetchRoutePreviewBatch(claim.ids);
      if (!routePreviewRequestCoordinatorRef.current.isCurrent(claim.token) || !isCurrent()) {
        routePreviewRequestCoordinatorRef.current.release(claim.ids, claim.token);
        return;
      }
      if (Object.keys(previewUpdates).length > 0) {
        setRoutePreviewFallbacks((current) => ({ ...current, ...previewUpdates }));
      }
      if (Object.keys(bboxUpdates).length > 0) {
        setRouteBboxes((current) => ({ ...current, ...bboxUpdates }));
      }
      routePreviewRequestCoordinatorRef.current.settle([...claim.ids, ...terminalIds], claim.token);
    } catch {
      // Preserve the current retry behavior: only transport/server failures
      // release these IDs; successful NO_ROUTE/DEFERRED responses stay terminal.
      routePreviewRequestCoordinatorRef.current.release(claim.ids, claim.token);
    }
  }, []);

  const loadRuns = useCallback(async ({ fromCache = false } = {}) => {
    const loadToken = runsLoadGenerationRef.current.begin();
    const isCurrentLoad = () => runsLoadGenerationRef.current.isCurrent(loadToken);
    const cachedHit = readRunsCache(localStorage, email, Date.now());

    if (fromCache && cachedHit && isCurrentLoad()) {
      const sorted = [...cachedHit.runs].sort((a, b) => runDate(b) - runDate(a));
      setAllRuns(sorted);
      setProfile(cachedHit.profile);
      setStravaStatus(cachedHit.stravaStatus);
      if (runsIdentity) {
        runsMetadataRef.current.profile = cachedHit.profile;
        runsMetadataRef.current.stravaStatus = cachedHit.stravaStatus;
      }
      setLoadState('ready');
      const preloadIds = sorted
        .slice(0, ROUTE_PREVIEW_INITIAL_PRELOAD_COUNT)
        .map((run) => run?.id)
        .filter((id) => Number.isFinite(Number(id)));
      if (preloadIds.length > 0) {
        requestRoutePreviews(preloadIds, { isCurrent: isCurrentLoad });
      }
    }

    if (!isCurrentLoad()) return;

    // Fire the three calls in parallel but apply each result as it resolves,
    // so the (heavy) runs payload paints as soon as it arrives instead of
    // waiting for /api/profile/me and /api/auth/strava/status to finish too.
    let latestRuns = null;
    let latestProfile = runsIdentity
      ? (runsMetadataRef.current.profile ?? cachedHit?.profile ?? null)
      : (cachedHit?.profile ?? null);
    let latestStrava = runsIdentity
      ? (runsMetadataRef.current.stravaStatus ?? cachedHit?.stravaStatus ?? null)
      : (cachedHit?.stravaStatus ?? null);
    let runsFailed = false;

    const runsPromise = apiJson('/api/activities')
      .then((data) => {
        if (!isCurrentLoad()) return;
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => runDate(b) - runDate(a));
        latestRuns = list;
        const preloadIds = list
          .slice(0, ROUTE_PREVIEW_INITIAL_PRELOAD_COUNT)
          .map((run) => run?.id)
          .filter((id) => Number.isFinite(Number(id)));
        setAllRuns(list);
        setLoadState('ready');
        if (preloadIds.length > 0) {
          requestRoutePreviews(preloadIds, { isCurrent: isCurrentLoad });
        }
      })
      .catch((err) => {
        if (!isCurrentLoad()) return;
        runsFailed = true;
        if (err && err.message !== 'Unauthorized') {
          setLoadState((prev) => (prev === 'ready' ? prev : 'error'));
        }
      });

    const profilePromise = apiJson('/api/profile/me')
      .then((data) => {
        if (!isCurrentLoad() || data == null) return;
        setProfile(data);
        if (runsIdentity) runsMetadataRef.current.profile = data;
        latestProfile = data;
      })
      .catch(() => {});

    const stravaPromise = apiJson('/api/auth/strava/status')
      .then((data) => {
        if (!isCurrentLoad() || data == null) return;
        setStravaStatus(data);
        if (runsIdentity) runsMetadataRef.current.stravaStatus = data;
        latestStrava = data;
      })
      .catch(() => {});

    await Promise.allSettled([runsPromise, profilePromise, stravaPromise]);
    // The slim cache only needs the runs payload; profile/strava fall back to
    // the values seeded above (cache/metadata) when their endpoints fail, so
    // a flaky side endpoint no longer blocks cache refreshes.
    if (isCurrentLoad() && !runsFailed && latestRuns) {
      writeRunsCache(localStorage, email, latestRuns, latestProfile, latestStrava, Date.now());
    }
  }, [email, requestRoutePreviews, runsIdentity]);

  const refreshRuns = useCallback(() => {
    runsLoadGenerationRef.current.invalidate();
    resetRoutePreviewState();
    setRoutePreviewFallbacks({});
    setRouteBboxes({});
    return loadRuns();
  }, [loadRuns, resetRoutePreviewState]);

  useEffect(() => {
    runsLoadGenerationRef.current.invalidate();
    runsMetadataRef.current = { identity: runsIdentity, profile: null, stravaStatus: null };
  }, [runsIdentity]);

  useEffect(() => {
    if (!isAuthenticated) {
      runsLoadGenerationRef.current.invalidate();
      navigate('/login');
      return;
    }
    loadRuns({ fromCache: true });
  }, [isAuthenticated, navigate, loadRuns]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    function handleStravaSyncFinished() {
      refreshRuns();
    }

    window.addEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    return () => {
      window.removeEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    };
  }, [isAuthenticated, refreshRuns]);

  const pollManualStravaSyncCompletion = useCallback(async () => {
    const deadlineMs = Date.now() + RUNS_STRAVA_SYNC_POLL_DEADLINE_MS;
    let sawActiveSync = false;

    while (Date.now() < deadlineMs) {
      let syncStatus = null;
      try {
        syncStatus = await apiJson('/api/auth/strava/sync-status');
      } catch {
        break;
      }

      setStravaStatus((current) => {
        const next = {
          ...(current || {}),
          linked: current?.linked ?? true,
          syncStatus,
        };
        if (runsIdentity) runsMetadataRef.current.stravaStatus = next;
        return next;
      });

      if (syncStatus?.active) {
        sawActiveSync = true;
      }

      const finished = syncStatus?.status === 'COMPLETED'
        || syncStatus?.status === 'FAILED'
        || (sawActiveSync && !syncStatus?.active);

      if (finished) {
        await refreshRuns();
        if (syncStatus?.status === 'FAILED') {
          setIntegrationNotice(localizeStravaSyncMessage(syncStatus.error, t) || t('profile.strava_sync_failed'));
          setIntegrationNoticeTone('alert');
        } else {
          setIntegrationNotice(t('profile.strava_sync_completed'));
          setIntegrationNoticeTone('active');
        }
        return syncStatus;
      }

      await new Promise((resolve) => window.setTimeout(resolve, RUNS_STRAVA_SYNC_POLL_INTERVAL_MS));
    }

    await refreshRuns();
    return null;
  }, [refreshRuns, runsIdentity, t]);

  async function handleStravaConnect() {
    setStravaLinking(true);
    try {
      if (stravaStatus?.linked) {
        const response = await apiFetch('/api/strava/sync');
        const rawMessage = (await response.text()).trim();
        const localizedMessage = localizeStravaSyncMessage(rawMessage, t);
        setIntegrationNotice(response.ok ? (localizedMessage || t('profile.strava_sync_started')) : (localizedMessage || t('profile.strava_sync_failed')));
        setIntegrationNoticeTone(response.ok ? 'active' : 'alert');
        if (response.ok) await pollManualStravaSyncCompletion();
      } else {
        const data = await apiJson('/api/auth/strava/link-url', { method: 'POST' });
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch {
      setIntegrationNotice(t('profile.strava_sync_failed'));
      setIntegrationNoticeTone('alert');
    }
    setStravaLinking(false);
  }

  async function handleImport(event) {
    event.preventDefault();
    const formData = new FormData();
    let hasFiles = false;
    [[fitExportFiles, 'exports'], [corosFiles, 'coros'], [huaweiFiles, 'huawei']].forEach(([files, field]) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        formData.append(field, file);
        hasFiles = true;
      });
    });
    if (!hasFiles) return;
    setImportStatus('');
    try {
      const response = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!response.ok) throw new Error();
      setImportModalOpen(false);
      refreshRuns();
    } catch {
      setImportStatus(t('profile.import_failed'));
    }
  }

  const filteredRuns = useMemo(() => {
    const now = new Date();
    let result = [...allRuns];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((run) => (run.name || t('runs.default_run_name')).toLowerCase().includes(q));
    }

    if (activeMode === 'year') {
      if (selectedYear != null) {
        result = result.filter((run) => runDate(run).getFullYear() === selectedYear);
      }
    } else if (activeMode === 'month') {
      const year = selectedYear || now.getFullYear();
      result = result.filter((run) => {
        const date = runDate(run);
        if (date.getFullYear() !== year) return false;
        return selectedMonth == null ? true : date.getMonth() === selectedMonth;
      });
    } else if (activeMode === 'day') {
      result = result.filter((run) => {
        const date = runDate(run);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      });
    }

    if (runsSort === 'distance') {
      result.sort((a, b) => Number(b.distanceKm || 0) - Number(a.distanceKm || 0));
    } else if (runsSort === 'pace') {
      result.sort((a, b) => {
        const paceA = Number(a.movingTimeSeconds || 0) / Math.max(0.1, Number(a.distanceKm || 0));
        const paceB = Number(b.movingTimeSeconds || 0) / Math.max(0.1, Number(b.distanceKm || 0));
        return paceA - paceB;
      });
    } else {
      result.sort((a, b) => runDate(b).getTime() - runDate(a).getTime());
    }

    return result;
  }, [activeMode, allRuns, selectedMonth, selectedYear, searchQuery, runsSort, t]);

  const distinctYears = useMemo(() => {
    const years = new Set();
    allRuns.forEach((run) => {
      const date = runDate(run);
      if (!Number.isNaN(date.getTime())) years.add(date.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [allRuns]);

  const monthsWithData = useMemo(() => {
    const year = selectedYear || new Date().getFullYear();
    const months = new Set();
    allRuns.forEach((run) => {
      const date = runDate(run);
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === year) months.add(date.getMonth());
    });
    return [...months].sort((a, b) => a - b);
  }, [allRuns, selectedYear]);

  useEffect(() => {
    if (activeMode === 'year' && selectedYear == null && distinctYears.length) setSelectedYear(distinctYears[0]);
    if (activeMode === 'month' && selectedYear == null) setSelectedYear(new Date().getFullYear());
  }, [activeMode, distinctYears, selectedYear]);

  useEffect(() => {
    if (activeMode === 'month' && selectedMonth == null && monthsWithData.length) setSelectedMonth(monthsWithData[monthsWithData.length - 1]);
  }, [activeMode, monthsWithData, selectedMonth]);

  useEffect(() => {
    setVisibleRunsCount(RECENT_RUNS_INITIAL_VISIBLE_COUNT);
  }, [activeMode, runsSort, searchQuery, selectedMonth, selectedYear]);

  const displayName = (profile?.displayName || profile?.email?.split('@')[0] || t('profile.default_name')).trim();
  const initials = displayName.slice(0, 1).toUpperCase();
  const monthNames = t('runs.months').split(',');
  const isAwaitingData = loadState === 'ready' && allRuns.length === 0;
  const stravaLinked = Boolean(stravaStatus?.linked);
  const awaitingTitle = t(stravaLinked ? 'runs.awaiting_title_linked' : 'runs.awaiting_title_disconnected');
  const awaitingCopy = t(stravaLinked ? 'runs.awaiting_copy_linked' : 'runs.awaiting_copy_disconnected');
  const awaitingStatus = integrationNotice || (stravaLinked
    ? formatStravaSyncLabel(stravaStatus, t)
    : t('runs.awaiting_status_disconnected'));
  const awaitingPrimaryAction = stravaLinking ? t('profile.strava_link_connecting') : t(stravaLinked ? 'runs.awaiting_retry_sync' : 'runs.awaiting_connect_strava');
  const countText = filteredRuns.length === 0 ? t('runs.count_zero') : t('runs.count_label', { count: filteredRuns.length });
  const filteredDistanceKm = filteredRuns.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
  const filteredTimeSeconds = filteredRuns.reduce((sum, run) => sum + Number(run.movingTimeSeconds || 0), 0);
  const totalDistanceText = formatDistance(filteredDistanceKm, 1, lang);
  const totalTimeText = formatDuration(filteredTimeSeconds);
  const avgPaceText = filteredRuns.length > 0
    ? formatPace(filteredDistanceKm, filteredTimeSeconds, lang)
    : t('runs.pace_zero');
  const latestRun = allRuns.reduce((latest, run) => {
    const runTime = runDate(run).getTime();
    if (Number.isNaN(runTime)) return latest;
    if (!latest) return run;
    const latestTime = runDate(latest).getTime();
    return Number.isNaN(latestTime) || runTime > latestTime ? run : latest;
  }, null);
  const latestSource = latestRun?.provider || t('runs.no_data');

  const routePreviewRuns = useMemo(
    () => filteredRuns.slice(0, Math.min(filteredRuns.length, visibleRunsCount + ROUTE_PREVIEW_PREFETCH_LOOKAHEAD)),
    [filteredRuns, visibleRunsCount],
  );
  const hasMoreRuns = visibleRunsCount < filteredRuns.length;

  // Group the FULL filtered history by YYYY-MM so each month header always
  // shows the month's true run count and distance — never the partial
  // numbers of whatever slice happens to be rendered. The rendered cards are
  // budgeted separately (visibleMonthGroups), so headers stay truthful while
  // the grid streams in. filteredRuns is already sorted most-recent-first, so
  // a single pass preserves the chronological group order without an extra
  // sort.
  const runsByMonth = useMemo(() => {
    const groups = [];
    const groupByKey = new Map();
    const monthLabelFormatter = (() => {
      try {
        return new Intl.DateTimeFormat(lang || 'en', { year: 'numeric', month: 'long' });
      } catch {
        return null;
      }
    })();
    filteredRuns.forEach((run) => {
      const started = runDate(run);
      if (Number.isNaN(started.getTime())) return;
      const key = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, '0')}`;
      let group = groupByKey.get(key);
      if (!group) {
        group = {
          key,
          label: monthLabelFormatter
            ? monthLabelFormatter.format(started)
            : `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, '0')}`,
          runs: [],
          runCount: 0,
          totalKm: 0,
        };
        groupByKey.set(key, group);
        groups.push(group);
      }
      group.runs.push(run);
      group.runCount += 1;
      group.totalKm += Number(run.distanceKm || 0)
        || (Number(run.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0);
    });
    return groups;
  }, [filteredRuns, lang]);

  // Apply the render window on top of the true month groups: headers keep
  // their full-month aggregates, only the mounted cards are limited, and the
  // window grows (below) regardless of any card's fold state.
  const visibleMonthGroups = useMemo(
    () => budgetMonthGroupsByRunCount(runsByMonth, visibleRunsCount),
    [runsByMonth, visibleRunsCount],
  );

  const activeDaysCount = useMemo(() => {
    const uniqueDays = new Set();
    filteredRuns.forEach((run) => {
      const date = runDate(run);
      if (!Number.isNaN(date.getTime())) uniqueDays.add(date.toISOString().slice(0, 10));
    });
    return uniqueDays.size;
  }, [filteredRuns]);
  const longestRun = useMemo(() => (
    filteredRuns.reduce((best, run) => (Number(run.distanceKm || 0) > Number(best?.distanceKm || 0) ? run : best), null)
  ), [filteredRuns]);
  const fastestRun = useMemo(() => (
    filteredRuns.reduce((best, run) => {
      const distanceKm = Number(run.distanceKm || 0);
      const movingTimeSeconds = Number(run.movingTimeSeconds || 0);
      if (distanceKm <= 0 || movingTimeSeconds <= 0) return best;
      const paceSeconds = movingTimeSeconds / distanceKm;
      if (!best || paceSeconds < best.paceSeconds) return { run, paceSeconds };
      return best;
    }, null)
  ), [filteredRuns]);

  const timeFilterOptions = [
    { key: 'all', label: t('runs.filter_all') },
    { key: 'year', label: t('runs.filter_year') },
    { key: 'month', label: t('runs.filter_month') },
    { key: 'day', label: t('runs.filter_day') },
  ];
  const sortOptions = [
    { key: 'date', label: t('runs.sort_date') },
    { key: 'distance', label: t('runs.sort_distance') },
    { key: 'pace', label: t('runs.sort_pace') },
  ];
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'activities',
  }), [lang, t]);

  function openRun(run) {
    sessionStorage.setItem('hermes_selected_run', JSON.stringify(run));
    navigate(buildRunDetailPath(run.id || ''));
  }

  function confirmDeleteRun(run) {
    if (!run) return;
    setDeleteTarget(run);
  }

  function closeDeleteModal() {
    if (deleting) return; // don't allow closing mid-delete
    setDeleteTarget(null);
  }

  async function handleDeleteRun() {
    const run = deleteTarget;
    if (!run || deleting) return;
    const deleteScrollPosition = captureRunsScrollPosition(window);
    runsLoadGenerationRef.current.invalidate();
    setDeleting(true);
    try {
      await apiJson(`/api/activities/${run.id}`, { method: 'DELETE' });
      resetRoutePreviewState();
      invalidateResourceCache('/api/activities');
      // Optimistically remove from state + clear per-run caches.
      setAllRuns(prev => prev.filter(r => r.id !== run.id));
      setRoutePreviewFallbacks(prev => {
        if (!(run.id in prev)) return prev;
        const next = { ...prev };
        delete next[run.id];
        return next;
      });
      setRouteBboxes(prev => {
        if (!(run.id in prev)) return prev;
        const next = { ...prev };
        delete next[run.id];
        return next;
      });
      try { localStorage.removeItem(`${ROUTE_BBOX_CACHE_PREFIX}${run.id}`); } catch { /* ignore */ }
      await invalidateHeatmapCache(email);
      invalidateRunsCache(localStorage, email);
      setDeleteTarget(null);
      restoreRunsScrollPosition(window, deleteScrollPosition);
    } catch {
      setIntegrationNotice(t('runs.delete_failed'));
      setIntegrationNoticeTone('alert');
    } finally {
      setDeleting(false);
    }
  }

  // Stream the remaining history in bounded batches on a timer so the list
  // always finishes loading — whether month cards are expanded, collapsed, or
  // the scroll sentinel never enters view. Scrolling to the sentinel (below)
  // still accelerates the same growth; nothing about the fold state gates it.
  useEffect(() => {
    if (!hasMoreRuns || loadState !== 'ready') return undefined;
    const stepTimer = window.setInterval(() => {
      setVisibleRunsCount((current) => Math.min(current + RECENT_RUNS_LOAD_BATCH_SIZE, filteredRuns.length));
    }, RUNS_BACKGROUND_LOAD_STEP_MS);
    return () => window.clearInterval(stepTimer);
  }, [filteredRuns.length, hasMoreRuns, loadState]);

  useEffect(() => {
    if (!hasMoreRuns || loadState !== 'ready') return undefined;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisibleRunsCount((current) => Math.min(current + RECENT_RUNS_LOAD_BATCH_SIZE, filteredRuns.length));
    }, {
      root: null,
      rootMargin: getRunsLoadMoreRootMargin(window.innerHeight),
      threshold: 0.01,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredRuns.length, hasMoreRuns, loadState, visibleRunsCount]);

  useEffect(() => {
    if (!Array.isArray(routePreviewRuns) || routePreviewRuns.length === 0) return undefined;
    // 1. Hydrate from localStorage for any soon-visible run we haven't loaded yet.
    const seeded = {};
    for (const run of routePreviewRuns) {
      if (!run?.id) continue;
      if (run.id in routeBboxes) continue;
      const cached = readBboxCache(run.id);
      if (cached) seeded[run.id] = cached;
    }
    if (Object.keys(seeded).length > 0) {
      setRouteBboxes((current) => ({ ...current, ...seeded }));
      return undefined; // Re-run after the seed lands; next pass picks the still-missing runs.
    }

    // 2. Batch-fetch preview points + bbox for the visible window plus a short
    // lookahead so runners do not watch cards visibly "upgrade" while scrolling.
    const pendingRuns = routePreviewRuns.filter((run) => {
      if (!run?.id) return false;
      const hasPointPreview = run.id in routePreviewFallbacks;
      const hasBbox = run.id in routeBboxes || !!readBboxFromPreview(routePreviewFallbacks[run.id] || run.routePreview);
      return !hasPointPreview || !hasBbox;
    }).slice(0, 50);
    if (pendingRuns.length === 0) return undefined;

    let cancelled = false;
    const pendingIds = pendingRuns.map((run) => run.id);
    requestRoutePreviews(pendingIds, { isCurrent: () => !cancelled });
    return () => {
      cancelled = true;
    };
  }, [requestRoutePreviews, routePreviewRuns, routeBboxes, routePreviewFallbacks]);

  function renderSecondaryFilterRow() {
    if (activeMode === 'year') {
      return distinctYears.map((year) => (
        <button key={year} type="button" className={`recent-runs-chip${year === selectedYear ? ' is-active' : ''}`} onClick={() => setSelectedYear(year)}>
          {year}
        </button>
      ));
    }
    if (activeMode === 'month') {
      return monthsWithData.map((month) => (
        <button key={month} type="button" className={`recent-runs-chip${month === selectedMonth ? ' is-active' : ''}`} onClick={() => setSelectedMonth(month)}>
          {monthNames[month]}
        </button>
      ));
    }
    return sortOptions.map((option) => (
      <button key={option.key} type="button" className={`recent-runs-chip${runsSort === option.key ? ' is-active' : ''}`} onClick={() => setRunsSort(option.key)}>
        {option.label}
      </button>
    ));
  }

  function renderImportModal() {
    return (
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title={t('profile.import_modal_title')}
        shellClassName="profile-import-modal-shell"
        cardClassName="profile-import-modal-card"
      >
        <form className="profile-import-modal-form" onSubmit={handleImport}>
          <ImportDataGuide />
          <header className="import-upload-heading">
            <span>{t('profile.import_upload_kicker')}</span>
            <h3>{t('profile.import_upload_title')}</h3>
            <p className="modal-help">{t('profile.import_hint')}</p>
          </header>
          <div className="import-source-grid">
            {[
              ['fit', 'FIT/GPX', fitExportFiles, setFitExportFiles, 'profile.fit_export_source_title', 'profile.fit_export_source_hint', 'profile.fit_export_file_label'],
              ['coros', 'COROS', corosFiles, setCorosFiles, 'profile.coros_source_title', 'profile.coros_source_hint', 'profile.coros_file_label'],
              ['huawei', 'HUAWEI', huaweiFiles, setHuaweiFiles, 'profile.huawei_source_title', 'profile.huawei_source_hint', 'profile.huawei_file_label'],
            ].map(([key, tag, files, setter, titleKey, hintKey, labelKey]) => (
              <section key={key} className={`import-source-card${files?.length ? ' is-selected' : ''}`}>
                <div className="import-source-header">
                  <div className="import-source-copy">
                    <span className="import-source-title">{t(titleKey)}</span>
                    <span className="import-source-hint">{t(hintKey)}</span>
                  </div>
                  <span className="import-source-tag">{tag}</span>
                </div>
                <label className="modal-label" htmlFor={`runs-import-${key}`}>{t(labelKey)}</label>
                <input
                  id={`runs-import-${key}`}
                  type="file"
                  accept=".gpx,.tcx,.fit,.zip"
                  multiple
                  aria-describedby={`runs-import-${key}-selection`}
                  onChange={(event) => setter(event.target.files)}
                />
                <p id={`runs-import-${key}-selection`} className="selected-file-name">
                  {files?.length ? t('profile.selected_files_count', { count: files.length }) : t('profile.no_file_selected')}
                </p>
              </section>
            ))}
          </div>
          <div className="import-summary-line">
            <strong>{t('profile.import_selected_total', { count: selectedImportFileCount })}</strong>
            <span>{t('profile.import_batch_hint')}</span>
          </div>
          {importStatus ? <div className="modal-status is-error" role="alert">{importStatus}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setImportModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button" disabled={selectedImportFileCount === 0}>
              {t('profile.upload_file_count', { count: selectedImportFileCount })}
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  if (loadState === 'loading') return <PageSkeleton variant="runs" />;

  if (isAwaitingData) {
    return (
      <div className={`runner-shell-page runner-dashboard-page runs-dashboard-page runs-ledger-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <aside className="runner-shell-sidebar">
          <div className="runner-shell-brand runner-dashboard-brand">
            <div className="runner-dashboard-brand-copy">
              <HermesLogo dark />
              <span>{t('analysis.stitch_brand_subtitle_runs')}</span>
            </div>
            <button
              type="button"
              className="runner-dashboard-sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
              aria-pressed={isSidebarCollapsed}
            >
              <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
            </button>
          </div>
          <nav className="runner-shell-side-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
                onClick={() => navigate(item.route)}
                onPointerEnter={() => preloadRoute(item.route)}
                onFocus={() => preloadRoute(item.route)}
                aria-label={item.label}
              >
                <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
                <span className="runner-dashboard-side-link-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="runner-shell-sidebar-footer">
            <button
              type="button"
              className="runner-shell-workout-btn runner-dashboard-workout-btn"
              onClick={() => navigate('/today-run')}
              onPointerEnter={() => preloadRoute('/today-run')}
              onFocus={() => preloadRoute('/today-run')}
              aria-label={t('profile.dashboard_start_workout')}
            >
              <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
              <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
            </button>
          </div>
        </aside>

        <main className="runner-shell-main">
          <header className="runner-shell-topbar runner-dashboard-shell-topbar">
            <div className="runner-shell-topbar-left">
              <RunnerShellTopNav
                navItems={navItems}
                activeLabel={t('profile.dashboard_nav_activities')}
                navigate={navigate}
              />
            </div>
            <div className="runner-shell-topbar-actions">
              <div className="runner-shell-topbar-profile-actions">
                <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
                <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                  <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
                </button>
                <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={t('profile.settings')}>
                  {initials}
                </button>
              </div>
            </div>
          </header>

          <div className="runner-shell-canvas">
            <main className="integration-alert-shell runs-dashboard-shell runs-ledger-awaiting">
              <div className="runner-dashboard-hero-copy runs-dashboard-hero-copy">
                <h1>{t('runs.heading')}</h1>
                <p>{t('runs.page_copy')}</p>
              </div>
              <div className="integration-alert-background" aria-hidden="true">
                <div className="integration-alert-orb integration-alert-orb--primary" />
                <div className="integration-alert-orb integration-alert-orb--secondary" />
              </div>
              <div className="integration-alert-grid">
                <section className="integration-alert-primary-panel">
                  <article className="integration-alert-card">
                    <div className="integration-alert-band">
                      <span>{t('runs.awaiting_alert_kicker')}</span>
                      <strong>{t(stravaLinked ? 'runs.awaiting_error_code_linked' : 'runs.awaiting_error_code_disconnected')}</strong>
                    </div>
                    <div className="integration-alert-card-body">
                      <div className="integration-alert-copy">
                        <h2>{awaitingTitle}</h2>
                        <p>{awaitingCopy}</p>
                      </div>
                      <div className="integration-alert-actions">
                        <button type="button" className="integration-alert-primary-btn" onClick={handleStravaConnect} disabled={stravaLinking}>{awaitingPrimaryAction}</button>
                        <button type="button" className="integration-alert-secondary-btn" onClick={() => setImportModalOpen(true)}>{t('runs.awaiting_import_files')}</button>
                      </div>
                    </div>
                  </article>
                  <div className={`integration-alert-status integration-alert-status--${integrationNoticeTone}`}>
                    <span className="integration-alert-status-dot" aria-hidden="true" />
                    <span>{awaitingStatus}</span>
                  </div>
                </section>
                <aside className="integration-alert-sidebar">
                  <section className="integration-alert-sidecard">
                    <div className="integration-alert-sidecard-head"><h2>{t('runs.awaiting_pipeline_title')}</h2></div>
                    <div className="integration-alert-pipeline-list">
                      <article className={`integration-alert-pipeline${stravaLinked ? ' is-live' : ' is-muted'}`}>
                        <div className="integration-alert-pipeline-main">
                          <div className="integration-alert-pipeline-icon is-strava"><AppIcon name="bolt" className="runner-dashboard-side-link-icon" /></div>
                          <div>
                            <strong>{t('runs.awaiting_pipeline_strava')}</strong>
                            <p>{t(stravaLinked ? 'runs.awaiting_pipeline_strava_connected' : 'runs.awaiting_pipeline_strava_disconnected')}</p>
                          </div>
                        </div>
                        <AppIcon name={stravaLinked ? 'check_circle' : 'error'} className="integration-alert-pipeline-state" />
                      </article>
                      <article className="integration-alert-pipeline is-live">
                        <div className="integration-alert-pipeline-main">
                          <div className="integration-alert-pipeline-icon is-manual"><AppIcon name="folder_open" className="runner-dashboard-side-link-icon" /></div>
                          <div>
                            <strong>{t('runs.awaiting_pipeline_manual')}</strong>
                            <p>{t('runs.awaiting_pipeline_manual_ready')}</p>
                          </div>
                        </div>
                        <AppIcon name="check_circle" className="integration-alert-pipeline-state" />
                      </article>
                      <article className="integration-alert-pipeline is-standby">
                        <div className="integration-alert-pipeline-main">
                          <div className="integration-alert-pipeline-icon is-garmin"><AppIcon name="watch" className="runner-dashboard-side-link-icon" /></div>
                          <div>
                            <strong>{t('runs.awaiting_pipeline_garmin')}</strong>
                            <p>{t('runs.awaiting_pipeline_garmin_ready')}</p>
                          </div>
                        </div>
                      </article>
                    </div>
                    <button type="button" className="integration-alert-inline-link" onClick={() => navigate('/settings')}>
                      <span>{t('runs.awaiting_pipeline_settings')}</span>
                      <AppIcon name="chevron_right" className="runner-dashboard-side-link-icon" />
                    </button>
                  </section>
                  <section className="integration-alert-support-card">
                    <div>
                      <strong>{t('runs.awaiting_support_title')}</strong>
                      <p>{t('runs.awaiting_support_copy')}</p>
                    </div>
                    <button type="button" className="integration-alert-support-link" onClick={() => setImportModalOpen(true)}>{t('runs.awaiting_support_cta')}</button>
                    <AppIcon name="support_agent" className="integration-alert-support-mark" />
                  </section>
                </aside>
              </div>
              <footer className="runner-shell-footer runner-dashboard-footer">
                <FooterNavLinks />
              </footer>
            </main>
          </div>
        </main>
        {renderImportModal()}
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page runs-dashboard-page runs-ledger-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle_runs')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>
        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
              onPointerEnter={() => preloadRoute(item.route)}
              onFocus={() => preloadRoute(item.route)}
              aria-label={item.label}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="runner-shell-sidebar-footer">
          <button
            type="button"
            className="runner-shell-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            onPointerEnter={() => preloadRoute('/today-run')}
            onFocus={() => preloadRoute('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={t('profile.dashboard_nav_activities')}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={displayName}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <main className="recent-runs-shell runs-dashboard-shell runs-profile-history runs-ledger-redesign">
            <section className="runs-profile-cockpit" aria-labelledby="runs-profile-title">
              <div className="runs-profile-cockpit__primary">
                <div className="runs-profile-cockpit__heading">
                  <h1 id="runs-profile-title">{t('runs.heading')}</h1>
                  <p>{t('runs.page_copy')}</p>
                </div>
                <div className="runs-profile-cockpit__actions">
                  <button
                    type="button"
                    className="runs-profile-primary-action"
                    onClick={handleStravaConnect}
                    disabled={stravaLinking}
                  >
                    <AppIcon name="sync" className="runner-dashboard-side-link-icon" />
                    {awaitingPrimaryAction}
                  </button>
                  <button
                    type="button"
                    className="runs-profile-secondary-action"
                    onClick={() => setImportModalOpen(true)}
                  >
                    <AppIcon name="folder_open" className="runner-dashboard-side-link-icon" />
                    {t('runs.awaiting_import_files')}
                  </button>
                </div>
              </div>
              <div className="runs-profile-cockpit__rail" aria-label={t('runs.stitch_pattern_title')}>
                <article className="runs-profile-signal runs-profile-signal--count">
                  <span>{t('runs.full_history')}</span>
                  <strong>{countText}</strong>
                </article>
                <article className="runs-profile-signal">
                      <span>{t('runs.latest_source')}</span>
                      <strong>{latestSource}</strong>
                    </article>
                <article className={`runs-profile-signal runs-profile-signal--status${stravaLinked ? ' is-live' : ' is-muted'}`}>
                  <span>{t(stravaLinked ? 'runs.awaiting_error_code_linked' : 'runs.awaiting_error_code_disconnected')}</span>
                  <strong>{stravaLinked ? t('runs.awaiting_pipeline_strava') : t('runs.awaiting_pipeline_manual')}</strong>
                </article>
              </div>
            </section>
            <section className="runs-profile-glance" aria-label={t('runs.stitch_pattern_title')}>
              <section className="recent-runs-stats-grid">
                <article className="recent-runs-stat-card"><span>{t('runs.total_distance')}</span><strong>{totalDistanceText}</strong></article>
                <article className="recent-runs-stat-card"><span>{t('runs.average_pace')}</span><strong>{avgPaceText}</strong></article>
                <article className="recent-runs-stat-card"><span>{t('runs.metric_moving_time')}</span><strong>{totalTimeText}</strong></article>
              </section>
              {filteredRuns.length > 0 ? (
                <section className="recent-runs-insight-strip" aria-label={t('runs.stitch_pattern_title')}>
                  <article className="recent-runs-insight-card recent-runs-insight-card--primary">
                    <span>{t('runs.stitch_pattern_title')}</span>
                    <strong>{t('runs.insight_runs_count', { count: filteredRuns.length })}</strong>
                    <p>{t('runs.insight_active_days', { count: activeDaysCount })}</p>
                  </article>
                  <article className="recent-runs-insight-card">
                    <span>{t('runs.insight_fastest_label')}</span>
                    <strong>{fastestRun ? formatPace(Number(fastestRun.run.distanceKm || 0), Number(fastestRun.run.movingTimeSeconds || 0), lang) : '--'}</strong>
                    <p>{fastestRun?.run?.name || t('runs.default_run_name')}</p>
                  </article>
                  <article className="recent-runs-insight-card">
                    <span>{t('runs.insight_longest_label')}</span>
                    <strong>{longestRun ? formatDistance(Number(longestRun.distanceKm || 0), 1, lang) : '--'}</strong>
                    <p>{longestRun?.name || t('runs.default_run_name')}</p>
                  </article>
                </section>
              ) : null}
            </section>
            <section id="recent-runs-filters" className="recent-runs-chip-stack runs-profile-workbench">
              <div className="recent-runs-search-bar">
                <div className="recent-runs-search-input-wrap">
                  <AppIcon name="search" className="recent-runs-search-icon" />
                  <input
                    type="text"
                    className="recent-runs-search-input"
                    placeholder={t('runs.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button type="button" className="recent-runs-search-clear" onClick={() => setSearchQuery('')} aria-label={t('profile.close')}>
                      <AppIcon name="close" />
                    </button>
                  )}
                </div>
              </div>
              <div className="runs-profile-workbench__filters">
                <div className="recent-runs-chip-row">
                  {timeFilterOptions.map((option) => (
                    <button key={option.key} type="button" className={`recent-runs-chip${activeMode === option.key ? ' is-active' : ''}`} onClick={() => {
                      setActiveMode(option.key);
                      setSelectedYear(null);
                      setSelectedMonth(null);
                    }}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="recent-runs-chip-row recent-runs-chip-row--secondary">{renderSecondaryFilterRow()}</div>
              </div>
            </section>
            <section className="recent-runs-card-list" aria-label={t('runs.full_history')}>
          {loadState === 'loading' ? <div className="recent-runs-status recent-runs-status--loading">{t('runs.loading')}</div> : null}
          {loadState === 'error' ? <div className="recent-runs-status">{t('runs.load_error')}</div> : null}
          {loadState === 'ready' && filteredRuns.length === 0 ? <div className="recent-runs-status recent-runs-status--empty">{t('runs.empty')}</div> : null}
          {loadState === 'ready' && filteredRuns.length > 0 ? (
              <>
                <div className="recent-runs-page-list">
                  {visibleMonthGroups.map((group) => {
                    const collapsed = collapsedMonthKeys.has(group.key);
                    const panelId = `recent-runs-month-${group.key}`;
                    return (
                      <section
                        key={group.key}
                        className={`recent-runs-month-group${collapsed ? ' is-collapsed' : ''}`}
                        aria-label={group.label}
                      >
                        <button
                          type="button"
                          className="recent-runs-month-header recent-runs-month-toggle"
                          aria-expanded={!collapsed}
                          aria-controls={panelId}
                          onClick={() => toggleMonthFold(group.key)}
                        >
                          <span className="recent-runs-month-toggle-chevron" aria-hidden="true">
                            <AppIcon name={collapsed ? 'expand_more' : 'expand_less'} />
                          </span>
                          <h3 className="recent-runs-month-title">{group.label}</h3>
                          <span className="recent-runs-month-meta">
                            {t('runs.count_label', { count: group.runCount })}
                            {' · '}
                            {formatDistance(group.totalKm, 1, lang)}
                          </span>
                        </button>
                        <div
                          id={panelId}
                          className="recent-runs-month-grid"
                          hidden={collapsed}
                        >
                          {group.runs.map((run) => (
                            <RunCard
                              key={run.id || `${run.startTime || run.startDate}-${run.name || 'run'}`}
                              run={run}
                              t={t}
                              lang={lang}
                              routePreviewFallbacks={routePreviewFallbacks}
                              routeBboxes={routeBboxes}
                              onOpen={openRun}
                              onDelete={confirmDeleteRun}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
                {hasMoreRuns ? (
                  <div ref={loadMoreSentinelRef} className="recent-runs-load-more-sentinel" aria-live="polite">
                    {typeof IntersectionObserver === 'undefined' ? (
                      <button
                        type="button"
                        className="recent-runs-load-more"
                        onClick={() => setVisibleRunsCount((current) => Math.min(current + RECENT_RUNS_LOAD_BATCH_SIZE, filteredRuns.length))}
                      >
                        {t('runs.load_more')}
                      </button>
                    ) : <span>{t('runs.loading')}</span>}
                  </div>
                ) : null}
              </>
            ) : null}
            </section>
            <footer className="runner-shell-footer runner-dashboard-footer">
              <FooterNavLinks />
            </footer>
          </main>
        </div>
      </main>
      {renderImportModal()}
      <Modal
        isOpen={!!deleteTarget}
        onClose={closeDeleteModal}
        title={t('runs.delete_title')}
        icon={<AppIcon name="delete_sweep" className="runs-delete-modal-icon" />}
        shellClassName="runs-delete-modal-shell"
        cardClassName="runs-delete-modal-card"
      >
        <p className="runs-delete-modal-copy">
          {t('runs.delete_confirm', { name: deleteTarget?.name || t('runs.default_run_name') })}
        </p>
        <p className="runs-delete-modal-warning">{t('runs.delete_warning')}</p>
        <div className="runs-delete-modal-actions">
          <button type="button" className="btn-secondary" onClick={closeDeleteModal} disabled={deleting}>
            {t('runs.delete_cancel')}
          </button>
          <button type="button" className="btn-primary runs-delete-modal-confirm" onClick={handleDeleteRun} disabled={deleting}>
            {deleting ? t('runs.delete_in_progress') : t('runs.delete_confirm_button')}
          </button>
        </div>
      </Modal>
    </div>
  );
});

export default Runs;

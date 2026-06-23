import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import { formatDate, formatDistance } from '../utils/format';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import 'leaflet/dist/leaflet.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const HEATMAP_REQUEST_TIMEOUT_MS = 120000;
const HEATMAP_INITIAL_PAGE_SIZE = 5000;
const HEATMAP_INITIAL_COVERAGE_LIMIT = 60000;
const HEATMAP_BACKGROUND_PAGE_SIZE = 100000;
const MAX_HEATMAP_PAGES = 1000;
const ACTIVITIES_REQUEST_TIMEOUT_MS = 15000;
const HEATMAP_PREVIEW_RENDER_POINT_LIMIT = 3500;
const HEATMAP_FULL_RENDER_POINT_LIMIT = 12000;
const HEATMAP_FULL_DRAW_CHUNK_SIZE = 320;
const HEATMAP_CACHE_DB_NAME = 'hermes_heatmap_cache_v1';
const HEATMAP_CACHE_STORE_NAME = 'heatmaps';
const HEATMAP_CACHE_DB_VERSION = 1;
const HEATMAP_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SPEED_BANDS = [
  { key: 'slow', min: 0, color: '#ff375f' },
  { key: 'mid', min: 0.34, color: '#ff5a47' },
  { key: 'fast', min: 0.62, color: '#ff9f1c' },
  { key: 'peak', min: 0.84, color: '#ffd34f' },
];
let leafletModulesPromise = null;

async function loadLeafletModules() {
  if (!leafletModulesPromise) {
    leafletModulesPromise = import('leaflet').then((leafletModule) => leafletModule.default || leafletModule);
  }
  return leafletModulesPromise;
}

function getSpeedBand(speedRatio) {
  const safeRatio = clamp(Number.isFinite(speedRatio) ? speedRatio : 0.5, 0, 1);
  for (let index = SPEED_BANDS.length - 1; index >= 0; index -= 1) {
    if (safeRatio >= SPEED_BANDS[index].min) {
      return SPEED_BANDS[index];
    }
  }
  return SPEED_BANDS[0];
}

function getGpsDotStyle(speedRatio, zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;
  const normalizedZoom = clamp(safeZoom, 8, 18);
  const radius = clamp(0.9 + ((normalizedZoom - 8) / 10) * 1.7, 0.9, 2.6);
  const speedBand = getSpeedBand(speedRatio);
  return {
    color: speedBand.color,
    radius,
    fillColor: speedBand.color,
    fillOpacity: clamp(0.86 + ((normalizedZoom - 8) / 10) * 0.1, 0.86, 0.96),
    opacity: clamp(0.34 + ((normalizedZoom - 8) / 10) * 0.1, 0.34, 0.44),
    weight: clamp(radius * 0.28, 0.35, 0.85),
    interactive: false,
    bubblingMouseEvents: false,
  };
}

function normalizeRawHeatPoint(point) {
  if (Array.isArray(point)) {
    return {
      activityId: Number(point[0]),
      latitude: Number(point[1]),
      longitude: Number(point[2]),
      speedRatio: Number(point[3]),
    };
  }

  return {
    ...point,
    latitude: Number(point?.latitude),
    longitude: Number(point?.longitude),
  };
}

function normalizeHeatPointForRender(point) {
  const normalizedPoint = normalizeRawHeatPoint(point);
  const speedRatio = Number(normalizedPoint?.speedRatio);
  return {
    ...normalizedPoint,
    visualSpeedRatio: Number.isFinite(speedRatio) ? clamp(speedRatio, 0, 1) : 0.5,
  };
}

function buildHeatmapRenderPointPool(points, limit) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const cappedLimit = Math.max(1, Number(limit) || HEATMAP_PREVIEW_RENDER_POINT_LIMIT);
  const stride = Math.max(1, Math.ceil(points.length / cappedLimit));
  const renderPoints = [];
  for (let index = 0; index < points.length; index += stride) {
    const point = points[index];
    if (isValidGpsCoordinate(point?.latitude, point?.longitude)) {
      renderPoints.push(point);
    }
  }
  return buildVisibleGpsDots(renderPoints);
}

function normalizePointSpeedRatios(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points[0] && Number.isFinite(points[0].visualSpeedRatio)) return points;

  return points.map(normalizeHeatPointForRender);
}

function isValidGpsCoordinate(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}



function buildVisibleGpsDots(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  return points.filter((point) => isValidGpsCoordinate(point?.latitude, point?.longitude));
}

function buildMergedHeatmapPayload(basePayload, points, loadPhase = 'complete') {
  if (!basePayload) return null;

  const sourcePointCount = Number(basePayload.pointCount) || points.length;
  const hasCompleteGps = loadPhase === 'complete' && points.length >= sourcePointCount;
  return {
    ...basePayload,
    points,
    sampledPointCount: points.length,
    diagnostics: {
      ...(basePayload.diagnostics || {}),
      sourceGpsPointCount: Number(basePayload.diagnostics?.sourceGpsPointCount) || sourcePointCount,
      queriedGpsPointCount: points.length,
      returnedGpsPointCount: points.length,
      loadPhase,
      complete: hasCompleteGps,
    },
    page: null,
  };
}

function getHeatmapCacheKey(accountEmail) {
  const normalizedEmail = typeof accountEmail === 'string' ? accountEmail.trim().toLowerCase() : '';
  return normalizedEmail ? `profile-heatmap:${normalizedEmail}` : null;
}

function openHeatmapCacheDb() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = window.indexedDB.open(HEATMAP_CACHE_DB_NAME, HEATMAP_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HEATMAP_CACHE_STORE_NAME)) {
        database.createObjectStore(HEATMAP_CACHE_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readHeatmapCacheRecord(database, key) {
  if (!database || !key) return Promise.resolve(null);

  return new Promise((resolve) => {
    const transaction = database.transaction(HEATMAP_CACHE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(HEATMAP_CACHE_STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

function writeHeatmapCacheRecord(database, key, payload) {
  if (!database || !key || !payload || payload.diagnostics?.complete === false || !Array.isArray(payload.points)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const transaction = database.transaction(HEATMAP_CACHE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HEATMAP_CACHE_STORE_NAME);
    store.put({ key, savedAt: Date.now(), payload });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function markCachedHeatmapPayload(payload, savedAt) {
  if (!payload || !Array.isArray(payload.points) || !payload.bounds) return null;

  const cachedPointCount = payload.points.length;
  const sourcePointCount = Number(payload.diagnostics?.sourceGpsPointCount || payload.pointCount || cachedPointCount);
  return {
    ...payload,
    diagnostics: {
      ...(payload.diagnostics || {}),
      sourceGpsPointCount: sourcePointCount,
      queriedGpsPointCount: cachedPointCount,
      returnedGpsPointCount: cachedPointCount,
      loadPhase: 'cachedComplete',
      complete: true,
      cacheHit: true,
      cacheSavedAt: savedAt,
    },
  };
}

async function readCachedHeatmapPayload(cacheKey) {
  if (!cacheKey) return null;
  const database = await openHeatmapCacheDb();
  if (!database) return null;
  try {
    const record = await readHeatmapCacheRecord(database, cacheKey);
    if (!record?.payload || Date.now() - Number(record.savedAt || 0) > HEATMAP_CACHE_MAX_AGE_MS) return null;
    return markCachedHeatmapPayload(record.payload, record.savedAt);
  } finally {
    database.close();
  }
}

async function writeCachedHeatmapPayload(cacheKey, payload) {
  if (!cacheKey || !payload) return;
  const database = await openHeatmapCacheDb();
  if (!database) return;
  try {
    await writeHeatmapCacheRecord(database, cacheKey, payload);
  } finally {
    database.close();
  }
}

async function fetchHeatmapPage(offset, limit, signal) {
  const pagePayload = await apiJson(`/api/profile/heatmap?offset=${offset}&limit=${limit}`, { signal });
  if (!pagePayload || typeof pagePayload !== 'object') return null;
  return pagePayload;
}

async function fetchHeatmapCoverage(limit, signal) {
  const pagePayload = await apiJson(`/api/profile/heatmap?coverage=true&limit=${limit}`, { signal });
  if (!pagePayload || typeof pagePayload !== 'object') return null;
  return pagePayload;
}

async function fetchCompleteHeatmap(signal, onProgress) {
  const points = [];
  let offset = 0;
  let mergedPayload = null;
  let nextLimit = HEATMAP_INITIAL_PAGE_SIZE;

  const firstPagePayload = await fetchHeatmapPage(offset, nextLimit, signal);
  if (!firstPagePayload) return null;

  mergedPayload = firstPagePayload;
  const firstPagePoints = Array.isArray(firstPagePayload.points) ? firstPagePayload.points : [];
  for (const point of firstPagePoints) {
    points.push(normalizeHeatPointForRender(point));
  }

  if (typeof onProgress === 'function') {
    const firstProgress = buildMergedHeatmapPayload(mergedPayload, points.slice(), 'recentPreview');
    if (firstProgress) onProgress(firstProgress);
  }

  const sourcePointCount = Number(firstPagePayload.pointCount || 0);
  const coveragePayload = await fetchHeatmapCoverage(HEATMAP_INITIAL_COVERAGE_LIMIT, signal).catch(() => null);
  if (coveragePayload && typeof onProgress === 'function') {
    const coveragePoints = Array.isArray(coveragePayload.points) ? coveragePayload.points.map(normalizeHeatPointForRender) : [];
    const coverageProgress = buildMergedHeatmapPayload(coveragePayload, coveragePoints, 'coveragePreview');
    if (coverageProgress) onProgress(coverageProgress);
  }

  const firstReturnedPointCount = Number(firstPagePayload.page?.returnedPointCount || firstPagePoints.length);
  offset = Number(firstPagePayload.page?.offset || 0) + firstReturnedPointCount;
  nextLimit = HEATMAP_BACKGROUND_PAGE_SIZE;

  for (let pageIndex = 1; pageIndex < MAX_HEATMAP_PAGES; pageIndex += 1) {
    if (!firstPagePayload.page?.hasMore || offset >= sourcePointCount) {
      break;
    }

    const pagePayload = await fetchHeatmapPage(offset, nextLimit, signal);
    if (!pagePayload) return buildMergedHeatmapPayload(mergedPayload, points, 'partialFull');

    const pagePoints = Array.isArray(pagePayload.points) ? pagePayload.points : [];
    for (const point of pagePoints) {
      points.push(normalizeHeatPointForRender(point));
    }

    const returnedPointCount = Number(pagePayload.page?.returnedPointCount);
    const step = Number.isFinite(returnedPointCount) && returnedPointCount > 0
      ? returnedPointCount
      : pagePoints.length;
    const pageOffset = Number(pagePayload.page?.offset);
    const hasMore = Boolean(pagePayload.page?.hasMore);
    if (!hasMore || step <= 0) {
      break;
    }

    offset = (Number.isFinite(pageOffset) ? pageOffset : offset) + step;
  }

  return buildMergedHeatmapPayload(mergedPayload, points);
}

function formatCoordinate(value, positiveSuffix, negativeSuffix) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix;
  return `${Math.abs(value).toFixed(3)}\u00b0${suffix}`;
}

export default function Heatmap() {
  const { isAuthenticated, authHydrated, email: authEmail } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [runs, setRuns] = useState([]);
  const [heatmapState, setHeatmapState] = useState('loading');
  const [heatmapReloadToken, setHeatmapReloadToken] = useState(0);
  const [mapMountFailed, setMapMountFailed] = useState(false);
  const [viewBounds, setViewBounds] = useState(null);

  const mapShellRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const boundsRef = useRef(null);
  const dotOverlayRef = useRef(null);
  const latestPointsRef = useRef([]);
  const latestPreviewRenderPointsRef = useRef([]);
  const latestFullRenderPointsRef = useRef([]);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const profileData = await apiJson('/api/profile/me');
        if (!cancelled) {
          setProfile(profileData);
        }
      } catch {
        // The map can still render without the profile shell data.
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authHydrated, isAuthenticated, navigate]);

  useEffect(() => {
    if (!authHydrated || !isAuthenticated) return undefined;

    const heatmapController = new AbortController();
    const activitiesController = new AbortController();
    const heatmapTimeoutId = window.setTimeout(() => heatmapController.abort(), HEATMAP_REQUEST_TIMEOUT_MS);
    const activitiesTimeoutId = window.setTimeout(() => activitiesController.abort(), ACTIVITIES_REQUEST_TIMEOUT_MS);
    let cancelled = false;

    setHeatmapState('loading');
    setMapMountFailed(false);

    async function loadHeatmap() {
      const cacheKey = getHeatmapCacheKey(authEmail);
      let servedCachedHeatmap = false;
      const activitiesPromise = apiJson('/api/activities', { signal: activitiesController.signal }).catch(() => []);
      const cachedHeatmapPromise = readCachedHeatmapPayload(cacheKey).catch(() => null);
      try {
        const cachedHeatmap = await cachedHeatmapPromise;
        if (!cancelled && cachedHeatmap) {
          servedCachedHeatmap = true;
          setHeatmap(cachedHeatmap);
          setHeatmapState('ready');
        }

        const heatmapData = await fetchCompleteHeatmap(heatmapController.signal, (partialHeatmap) => {
          if (cancelled || servedCachedHeatmap) return;
          setHeatmap(partialHeatmap);
          setHeatmapState('ready');
        });
        const activitiesData = await activitiesPromise;

        if (cancelled) return;
        const completeHeatmap = heatmapData && typeof heatmapData === 'object' ? heatmapData : null;
        setHeatmap(completeHeatmap);
        setRuns(Array.isArray(activitiesData) ? activitiesData : []);
        setHeatmapState('ready');
        if (completeHeatmap && completeHeatmap.diagnostics?.complete !== false) {
          writeCachedHeatmapPayload(cacheKey, completeHeatmap).catch(() => {});
        }
      } catch {
        if (!cancelled && !servedCachedHeatmap) {
          setHeatmap(null);
          setHeatmapState('error');
        }
      } finally {
        window.clearTimeout(heatmapTimeoutId);
        window.clearTimeout(activitiesTimeoutId);
      }
    }

    loadHeatmap();

    return () => {
      cancelled = true;
      window.clearTimeout(heatmapTimeoutId);
      window.clearTimeout(activitiesTimeoutId);
      heatmapController.abort();
      activitiesController.abort();
    };
  }, [authEmail, authHydrated, isAuthenticated, heatmapReloadToken]);

  useEffect(() => {
    loadLeafletModules().catch(() => {
      // Let the mount effect handle the fallback state.
    });
  }, []);

  const points = useMemo(
    () => normalizePointSpeedRatios(Array.isArray(heatmap?.points) ? heatmap.points : []),
    [heatmap?.points],
  );
  const bounds = heatmap?.bounds || null;
  const hasBounds = Boolean(bounds);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    latestPointsRef.current = points;
    latestPreviewRenderPointsRef.current = buildHeatmapRenderPointPool(points, HEATMAP_PREVIEW_RENDER_POINT_LIMIT);
    latestFullRenderPointsRef.current = buildHeatmapRenderPointPool(points, HEATMAP_FULL_RENDER_POINT_LIMIT);
    const overlay = dotOverlayRef.current;
    if (!overlay?.syncRouteDots) return undefined;

    const renderMode = heatmap?.diagnostics?.complete === false ? 'preview' : 'full';
    const frameId = window.requestAnimationFrame(() => overlay.syncRouteDots(renderMode));
    return () => window.cancelAnimationFrame(frameId);
  }, [heatmap?.diagnostics?.complete, points]);

  useEffect(() => {
    if (!mapRef.current || !boundsRef.current || !hasBounds || heatmapState !== 'ready') return undefined;

    let disposed = false;
    const mapShellElement = mapShellRef.current;

    async function mountMap() {
      try {
        const L = await loadLeafletModules();
        if (disposed || !mapRef.current) return;

        if (dotOverlayRef.current?.destroy) {
          dotOverlayRef.current.destroy();
        }
        mapShellElement?.classList.remove('is-map-zooming');
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        dotOverlayRef.current = null;

        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          wheelDebounceTime: 24,
          wheelPxPerZoomLevel: 96,
          zoomAnimation: true,
          fadeAnimation: false,
          markerZoomAnimation: false,
          preferCanvas: true,
          dragging: true,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 20,
          updateWhenZooming: false,
          updateWhenIdle: false,
          keepBuffer: 10,
          className: 'heatmap-page-dark-tile-layer',
          errorTileUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22256%22 height=%22256%22 viewBox=%220 0 256 256%22%3E%3Crect width=%22256%22 height=%22256%22 fill=%22%2305070a%22/%3E%3C/svg%3E',
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        }).addTo(map);

        const dotCanvas = L.DomUtil.create('canvas', 'heatmap-page-dot-canvas leaflet-zoom-animated');
        dotCanvas.setAttribute('aria-hidden', 'true');
        dotCanvas.style.pointerEvents = 'none';
        map.getPanes().overlayPane.appendChild(dotCanvas);
        const dotContext = dotCanvas.getContext('2d');

        const fitMapToBounds = () => {
          const latestBounds = boundsRef.current;
          if (!latestBounds) return;
          map.fitBounds([
            [latestBounds.minLatitude, latestBounds.minLongitude],
            [latestBounds.maxLatitude, latestBounds.maxLongitude],
          ], {
            padding: [36, 36],
            maxZoom: 14,
          });
        };

        fitMapToBounds();
        window.setTimeout(() => {
          if (!disposed) {
            map.invalidateSize();
            fitMapToBounds();
          }
        }, 0);

        let drawFrameId = null;
        let fullDrawFrameId = null;
        let cancelFullDrawFrame = null;
        let activeFullDrawToken = 0;
        let lastViewBoundsKey = '';
        let isZoomingMap = false;
        let skipNextMovePreview = false;
        let zoomSettleTimeoutId = null;
        let zoomDotFrameId = null;
        let activeCanvasLayerOrigin = null;
        const canvasSize = { width: 0, height: 0, pixelRatio: 0 };
        const bufferCanvas = document.createElement('canvas');
        const bufferContext = bufferCanvas.getContext('2d');

        const updateViewBounds = (mapBounds) => {
          const nextViewBounds = {
            west: mapBounds.getWest(),
            east: mapBounds.getEast(),
            north: mapBounds.getNorth(),
            south: mapBounds.getSouth(),
          };
          const nextKey = `${nextViewBounds.west.toFixed(5)}:${nextViewBounds.east.toFixed(5)}:${nextViewBounds.north.toFixed(5)}:${nextViewBounds.south.toFixed(5)}`;
          if (nextKey === lastViewBoundsKey) return;
          lastViewBoundsKey = nextKey;
          setViewBounds(nextViewBounds);
        };

        const cancelFullDraw = () => {
          activeFullDrawToken += 1;
          if (fullDrawFrameId !== null && cancelFullDrawFrame) {
            cancelFullDrawFrame(fullDrawFrameId);
          }
          fullDrawFrameId = null;
          cancelFullDrawFrame = null;
        };

        const scheduleFullDrawChunk = (callback) => {
          if (typeof window.requestIdleCallback === 'function') {
            cancelFullDrawFrame = window.cancelIdleCallback.bind(window);
            fullDrawFrameId = window.requestIdleCallback(callback, { timeout: 420 });
            return;
          }
          cancelFullDrawFrame = window.clearTimeout.bind(window);
          fullDrawFrameId = window.setTimeout(() => callback({ timeRemaining: () => 4, didTimeout: true }), 24);
        };

        const drawRoutePoint = (context, point, zoom, renderMode, canvasLayerOrigin, radiusScale = 1) => {
          const projected = map.latLngToLayerPoint([point.latitude, point.longitude]).subtract(canvasLayerOrigin);
          const style = getGpsDotStyle(point.visualSpeedRatio, zoom);
          const scaledRadius = style.radius * radiusScale;
          context.beginPath();
          context.arc(projected.x, projected.y, scaledRadius, 0, Math.PI * 2);
          context.fillStyle = style.fillColor;
          context.globalAlpha = style.fillOpacity;
          context.fill();
          if (renderMode === 'full' && scaledRadius >= 1.4) {
            context.globalAlpha = style.opacity;
            context.lineWidth = style.weight * radiusScale;
            context.strokeStyle = style.color;
            context.stroke();
          }
          context.globalAlpha = 1;
        };

        const paintRouteDots = (renderMode = 'full') => {
          if (disposed) return;

          const zoom = map.getZoom();
          const mapBounds = map.getBounds();
          const size = map.getSize();
          const pixelRatio = window.devicePixelRatio || 1;
          const layerTopLeft = map.containerPointToLayerPoint([0, 0]);
          const canvasLayerOrigin = layerTopLeft;
          activeCanvasLayerOrigin = canvasLayerOrigin;
          L.DomUtil.setPosition(dotCanvas, canvasLayerOrigin);

          const canvasWidth = Math.max(1, Math.round(size.x * pixelRatio));
          const canvasHeight = Math.max(1, Math.round(size.y * pixelRatio));
          if (canvasSize.width !== canvasWidth || canvasSize.height !== canvasHeight || canvasSize.pixelRatio !== pixelRatio) {
            canvasSize.width = canvasWidth;
            canvasSize.height = canvasHeight;
            canvasSize.pixelRatio = pixelRatio;
            dotCanvas.width = canvasWidth;
            dotCanvas.height = canvasHeight;
            bufferCanvas.width = canvasWidth;
            bufferCanvas.height = canvasHeight;
            dotCanvas.style.width = `${size.x}px`;
            dotCanvas.style.height = `${size.y}px`;
          }

          const west = mapBounds.getWest();
          const east = mapBounds.getEast();
          const north = mapBounds.getNorth();
          const south = mapBounds.getSouth();
          const renderPoints = renderMode === 'preview'
            ? latestPreviewRenderPointsRef.current
            : latestFullRenderPointsRef.current;

          if (renderMode === 'full') {
            updateViewBounds(mapBounds);
          }

          cancelFullDraw();
          if (renderMode !== 'full' || renderPoints.length <= HEATMAP_FULL_DRAW_CHUNK_SIZE) {
            dotCanvas.style.opacity = renderMode === 'preview' ? '0.82' : '1';
            dotContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            dotContext.clearRect(0, 0, size.x, size.y);
            for (const point of renderPoints) {
              if (!isValidGpsCoordinate(point?.latitude, point?.longitude)) continue;
              if (point.latitude < south || point.latitude > north || point.longitude < west || point.longitude > east) continue;
              drawRoutePoint(dotContext, point, zoom, renderMode, canvasLayerOrigin);
            }
            return;
          }

          const drawToken = activeFullDrawToken;
          const visibleStyleWidth = dotCanvas.style.width;
          const visibleStyleHeight = dotCanvas.style.height;
          bufferCanvas.style.width = visibleStyleWidth;
          bufferCanvas.style.height = visibleStyleHeight;
          bufferContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          bufferContext.clearRect(0, 0, size.x, size.y);
          let pointIndex = 0;

          const drawFullChunk = (deadline) => {
            if (disposed || drawToken !== activeFullDrawToken) return;
            fullDrawFrameId = null;
            cancelFullDrawFrame = null;

            const startedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
              ? performance.now()
              : Date.now();
            const hasIdleTime = () => {
              if (deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() > 1) return true;
              const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
                ? performance.now()
                : Date.now();
              return now - startedAt < 5;
            };
            const endIndex = Math.min(pointIndex + HEATMAP_FULL_DRAW_CHUNK_SIZE, renderPoints.length);
            for (; pointIndex < endIndex && hasIdleTime(); pointIndex += 1) {
              const point = renderPoints[pointIndex];
              if (!isValidGpsCoordinate(point?.latitude, point?.longitude)) continue;
              if (point.latitude < south || point.latitude > north || point.longitude < west || point.longitude > east) continue;
              drawRoutePoint(bufferContext, point, zoom, 'full', canvasLayerOrigin);
            }

            if (pointIndex < renderPoints.length) {
              scheduleFullDrawChunk(drawFullChunk);
              return;
            }

            dotCanvas.style.opacity = '1';
            dotContext.setTransform(1, 0, 0, 1, 0, 0);
            dotContext.clearRect(0, 0, canvasWidth, canvasHeight);
            dotContext.drawImage(bufferCanvas, 0, 0);
          };

          scheduleFullDrawChunk(drawFullChunk);
        };

        const scheduleRouteDots = (renderMode = 'full') => {
          if (drawFrameId !== null) {
            window.cancelAnimationFrame(drawFrameId);
          }
          drawFrameId = window.requestAnimationFrame(() => {
            drawFrameId = null;
            paintRouteDots(renderMode);
          });
        };

        const getDotCanvasAnimatedScale = () => {
          const transform = window.getComputedStyle(dotCanvas).transform;
          if (!transform || transform === 'none') return 1;
          const matrix = transform.match(/^matrix\(([^,]+)/);
          const matrix3d = transform.match(/^matrix3d\(([^,]+)/);
          const rawScale = matrix?.[1] || matrix3d?.[1];
          const scale = Number(rawScale);
          return Number.isFinite(scale) && scale > 0 ? scale : 1;
        };

        const paintZoomRadiusCompensatedDots = () => {
          if (disposed || !isZoomingMap || !activeCanvasLayerOrigin) return;
          const size = map.getSize();
          const pixelRatio = window.devicePixelRatio || 1;
          const animatedScale = getDotCanvasAnimatedScale();
          const radiusScale = clamp(1 / animatedScale, 0.18, 1.9);
          const zoom = map.getZoom();
          const mapBounds = map.getBounds();
          const west = mapBounds.getWest();
          const east = mapBounds.getEast();
          const north = mapBounds.getNorth();
          const south = mapBounds.getSouth();

          dotContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          dotContext.clearRect(0, 0, size.x, size.y);
          for (const point of latestPreviewRenderPointsRef.current) {
            if (!isValidGpsCoordinate(point?.latitude, point?.longitude)) continue;
            if (point.latitude < south || point.latitude > north || point.longitude < west || point.longitude > east) continue;
            drawRoutePoint(dotContext, point, zoom, 'preview', activeCanvasLayerOrigin, radiusScale);
          }
        };

        const stopZoomRadiusCompensation = () => {
          if (zoomDotFrameId !== null) {
            window.cancelAnimationFrame(zoomDotFrameId);
            zoomDotFrameId = null;
          }
        };

        const runZoomRadiusCompensation = () => {
          zoomDotFrameId = null;
          paintZoomRadiusCompensatedDots();
          if (!disposed && isZoomingMap) {
            zoomDotFrameId = window.requestAnimationFrame(runZoomRadiusCompensation);
          }
        };

        const startZoomRadiusCompensation = () => {
          stopZoomRadiusCompensation();
          zoomDotFrameId = window.requestAnimationFrame(runZoomRadiusCompensation);
        };
        const finishZoomRender = () => {
          if (disposed) return;
          isZoomingMap = false;
          stopZoomRadiusCompensation();
          zoomSettleTimeoutId = null;
          dotCanvas.style.display = 'block';
          dotCanvas.style.opacity = '1';
          scheduleRouteDots('full');
          window.setTimeout(() => {
            if (!disposed) mapShellElement?.classList.remove('is-map-zooming');
          }, 120);
        };

        const animateRouteDotsZoom = (event) => {
          const scale = map.getZoomScale(event.zoom);
          const viewportNorthWest = map.containerPointToLatLng([0, 0]);
          const offset = map._latLngToNewLayerPoint(viewportNorthWest, event.zoom, event.center);
          L.DomUtil.setTransform(dotCanvas, offset, scale);
        };

        const scheduleZoomStart = () => {
          if (drawFrameId !== null) {
            window.cancelAnimationFrame(drawFrameId);
            drawFrameId = null;
          }
          cancelFullDraw();
          if (zoomSettleTimeoutId !== null) {
            window.clearTimeout(zoomSettleTimeoutId);
          }
          mapShellRef.current?.classList.add('is-map-zooming');
          isZoomingMap = true;
          skipNextMovePreview = true;
          dotCanvas.style.display = 'block';
          dotCanvas.style.opacity = '0.62';
          startZoomRadiusCompensation();
          zoomSettleTimeoutId = window.setTimeout(finishZoomRender, 480);
        };

        const scheduleZoomEnd = () => {
          if (zoomSettleTimeoutId !== null) {
            window.clearTimeout(zoomSettleTimeoutId);
          }
          finishZoomRender();
        };

        const scheduleMoveEnd = () => {
          if (isZoomingMap || skipNextMovePreview) {
            skipNextMovePreview = false;
            return;
          }
          scheduleRouteDots('preview');
        };

        dotOverlayRef.current = {
          syncRouteDots: scheduleRouteDots,
          destroy: () => {
            if (drawFrameId !== null) {
              window.cancelAnimationFrame(drawFrameId);
              drawFrameId = null;
            }
            if (zoomSettleTimeoutId !== null) {
              window.clearTimeout(zoomSettleTimeoutId);
              zoomSettleTimeoutId = null;
            }
            cancelFullDraw();
            stopZoomRadiusCompensation();
          },
        };
        map.on('zoomstart', scheduleZoomStart);
        map.on('zoomanim', animateRouteDotsZoom);
        map.on('zoomend', scheduleZoomEnd);
        map.on('moveend', scheduleMoveEnd);
        map.on('resize', () => scheduleRouteDots('preview'));
        scheduleRouteDots('preview');

        mapInstanceRef.current = map;
        setMapMountFailed(false);
      } catch {
        if (!disposed) {
          setMapMountFailed(true);
        }
      }
    }

    mountMap();

    return () => {
      disposed = true;
      if (dotOverlayRef.current?.destroy) {
        dotOverlayRef.current.destroy();
      }
      dotOverlayRef.current = null;
      mapShellElement?.classList.remove('is-map-zooming');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasBounds, heatmapState]);
  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const pointCount = Number(heatmap?.pointCount || 0);
  const diagnostics = heatmap?.diagnostics || null;
  const receivedGpsPointCount = Number(diagnostics?.returnedGpsPointCount ?? points.length);
  const sourceGpsPointCount = Number(diagnostics?.sourceGpsPointCount ?? pointCount);
  const gpsLoadComplete = diagnostics?.complete !== false;
  const gpsReceivedLabel = gpsLoadComplete && sourceGpsPointCount > 0
    ? `${receivedGpsPointCount}/${sourceGpsPointCount}`
    : t('heatmap.page_gps_loading_full');
  const gpsLoadingLabelRoot = gpsReceivedLabel.replace(/\.{3}$/, '');
  const gpsLoadingLabelPieces = Array.from(gpsLoadingLabelRoot);
  const activityCount = Number(heatmap?.activityCount || 0);
  const densityPerRun = activityCount > 0 ? Math.round(pointCount / activityCount) : 0;
  const centerLatitude = bounds ? (bounds.minLatitude + bounds.maxLatitude) / 2 : null;
  const centerLongitude = bounds ? (bounds.minLongitude + bounds.maxLongitude) / 2 : null;
  const centerLabel = bounds
    ? `${formatCoordinate(centerLatitude, 'N', 'S')} / ${formatCoordinate(centerLongitude, 'E', 'W')}`
    : '--';

  const filteredRuns = useMemo(() => {
    if (!viewBounds || !runs.length) return [];
    return runs.filter((run) => {
      const lat = Number(run.startLatitude);
      const lng = Number(run.startLongitude);
      if (!lat || !lng) return false;
      return (
        lat >= viewBounds.south
        && lat <= viewBounds.north
        && lng >= viewBounds.west
        && lng <= viewBounds.east
      );
    }).slice(0, 10);
  }, [viewBounds, runs]);

  const speedLegendLabels = {
    slow: t('heatmap.page_legend_slow'),
    mid: t('heatmap.page_legend_mid'),
    fast: t('heatmap.page_legend_fast'),
    peak: t('heatmap.page_legend_peak'),
  };
  const speedLegendBands = SPEED_BANDS.map((band) => ({
    key: band.key,
    label: speedLegendLabels[band.key] || band.key,
    color: band.color,
  }));

  const quickLinks = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'heatmap',
  }), [lang, t]);

  const zoomMap = (delta) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (delta > 0) {
      map.zoomIn();
      return;
    }
    map.zoomOut();
  };

  const recenterMap = () => {
    const map = mapInstanceRef.current;
    if (!map || !bounds) return;
    map.fitBounds([
      [bounds.minLatitude, bounds.minLongitude],
      [bounds.maxLatitude, bounds.maxLongitude],
    ], {
      padding: [36, 36],
      maxZoom: 14,
    });
  };

  const showMapOverlays = heatmapState === 'ready' && pointCount > 0 && !mapMountFailed;

  return (
    <div className="heatmap-page">
      <div ref={mapShellRef} className="heatmap-page-map-shell">
        <div ref={mapRef} className="heatmap-page-map-canvas" />
        <div className="heatmap-page-map-vignette" aria-hidden="true" />

        <header className="heatmap-page-topbar">
          <button
            type="button"
            className="heatmap-page-brand-pill"
            onClick={() => navigate('/profile')}
            aria-label={t('profile.dashboard_nav_dashboard')}
          >
            <HermesLogo dark />
            <span>{t('heatmap.page_kicker')}</span>
          </button>

          <button
            type="button"
            className="heatmap-page-search-pill"
            onClick={recenterMap}
            disabled={!showMapOverlays}
            aria-label={t('heatmap.page_recenter')}
          >
            <AppIcon name="search" className="heatmap-page-pill-icon" />
            <div className="heatmap-page-search-copy">
              <strong>{t('heatmap.page_recenter')}</strong>
              <span>{showMapOverlays ? centerLabel : t('heatmap.loading')}</span>
            </div>
          </button>

          <div className="heatmap-page-action-strip">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <button type="button" className="heatmap-page-secondary-btn is-overlay" onClick={() => navigate('/runs')}>
                {t('heatmap.page_open_runs')}
              </button>
              <button type="button" className="heatmap-page-primary-btn is-overlay" onClick={() => navigate('/settings')}>
                {t('heatmap.page_open_settings')}
              </button>
              <button
                type="button"
                className="runner-shell-avatar heatmap-page-avatar"
                aria-label={profile?.displayName || 'Hermes'}
                onClick={() => navigate('/profile')}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>

        {showMapOverlays ? (
          <>
            <nav className="heatmap-page-utility-rail" aria-label={t('profile.dashboard_nav_heatmap')}>
              {quickLinks.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cx('heatmap-page-utility-btn', item.active && 'is-active')}
                  onClick={() => navigate(item.route)}
                  aria-label={item.label}
                  title={item.label}
                >
                  <AppIcon name={item.icon} className="heatmap-page-utility-icon" />
                </button>
              ))}
              <div className="heatmap-page-utility-divider" aria-hidden="true" />
              <button
                type="button"
                className="heatmap-page-utility-btn"
                onClick={() => zoomMap(1)}
                aria-label={t('heatmap.page_zoom_in')}
                title={t('heatmap.page_zoom_in')}
              >
                <span className="heatmap-page-zoom-glyph" aria-hidden="true">+</span>
              </button>
              <button
                type="button"
                className="heatmap-page-utility-btn"
                onClick={() => zoomMap(-1)}
                aria-label={t('heatmap.page_zoom_out')}
                title={t('heatmap.page_zoom_out')}
              >
                <span className="heatmap-page-zoom-glyph" aria-hidden="true">-</span>
              </button>
              <button
                type="button"
                className="heatmap-page-utility-btn"
                onClick={recenterMap}
                aria-label={t('heatmap.page_recenter')}
                title={t('heatmap.page_recenter')}
              >
                <AppIcon name="map" className="heatmap-page-utility-icon" />
              </button>
            </nav>

            <aside className="heatmap-page-legend-card">
              <span className="heatmap-page-card-kicker">{t('heatmap.page_legend_title')}</span>
              <div className="heatmap-page-legend-scale" role="list" aria-label={t('heatmap.page_legend_title')}>
                {speedLegendBands.map((band) => (
                  <div key={band.key} className="heatmap-page-legend-band" role="listitem">
                    <span className="heatmap-page-legend-band-label">{band.label}</span>
                    <span
                      className="heatmap-page-legend-band-swatch"
                      style={{ background: band.color }}
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>

              <div className="heatmap-page-legend-meta">
                <div>
                  <span>{t('heatmap.page_center_label')}</span>
                  <strong>{centerLabel}</strong>
                </div>
                <div className="is-density">
                  <span>{t('heatmap.page_density_label')}</span>
                  <strong>{densityPerRun}</strong>
                </div>
                <div className={cx('is-density', diagnostics?.complete === false && 'is-warning')}>
                  <span>{t('heatmap.page_gps_received_label')}</span>
                  <strong>
                    {gpsLoadComplete ? gpsReceivedLabel : (
                      <span className="heatmap-page-gps-loading-text" aria-label={gpsReceivedLabel}>
                        <span className="heatmap-page-gps-loading-words" aria-hidden="true">
                          {gpsLoadingLabelPieces.map((piece, index) => (
                            <span key={`${piece}-${index}`} className="heatmap-page-gps-loading-piece">
                              {piece === ' ' ? '\u00a0' : piece}
                            </span>
                          ))}
                        </span>
                        <span className="heatmap-page-gps-loading-dots" aria-hidden="true">
                          <span>.</span>
                          <span>.</span>
                          <span>.</span>
                        </span>
                      </span>
                    )}
                  </strong>
                </div>
              </div>
            </aside>

            {filteredRuns.length > 0 && (
              <section className="heatmap-sessions-card">
                <span className="heatmap-page-card-kicker">{t('heatmap.page_sessions_in_view')}</span>
                <div className="heatmap-sessions-list">
                  {filteredRuns.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      className="heatmap-session-row"
                      onClick={() => navigate(`/run/${run.id}`)}
                    >
                      <div className="heatmap-session-main">
                        <strong>{run.name || t('profile.dashboard_session_fallback')}</strong>
                        <span>{formatDate(run.startTime || run.startDate, lang === 'zh-CN' ? 'zh-CN' : 'en-US')}</span>
                      </div>
                      <div className="heatmap-session-meta">
                        <strong>{formatDistance(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0), 1, lang, unit)}</strong>
                        <span>{t('heatmap.page_view_session')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}

        {heatmapState === 'loading' ? (
          <div className="heatmap-page-empty">
            <div className="heatmap-page-empty-copy">
              <span className="heatmap-page-card-kicker">{t('heatmap.page_map_kicker')}</span>
              <h3>{t('analysis.stitch_loading')}</h3>
              <p>{t('heatmap.page_copy')}</p>
            </div>
          </div>
        ) : null}

        {heatmapState === 'error' || mapMountFailed ? (
          <div className="heatmap-page-empty">
            <div className="heatmap-page-empty-copy">
              <span className="heatmap-page-card-kicker">{t('heatmap.page_empty_kicker')}</span>
              <h3>{t('analysis.stitch_load_error')}</h3>
              <p>{t('heatmap.page_empty_copy')}</p>
            </div>
            <div className="heatmap-page-empty-actions">
              <button type="button" className="heatmap-page-primary-btn" onClick={() => setHeatmapReloadToken((value) => value + 1)}>
                {t('profile.dashboard_nav_heatmap')}
              </button>
              <button type="button" className="heatmap-page-secondary-btn" onClick={() => navigate('/runs')}>
                {t('heatmap.page_open_runs')}
              </button>
            </div>
          </div>
        ) : null}

        {heatmapState === 'ready' && !pointCount ? (
          <div className="heatmap-page-empty">
            <div className="heatmap-page-empty-copy">
              <span className="heatmap-page-card-kicker">{t('heatmap.page_empty_kicker')}</span>
              <h3>{t('heatmap.empty')}</h3>
              <p>{t('heatmap.page_empty_copy')}</p>
            </div>
            <div className="heatmap-page-empty-actions">
              <button type="button" className="heatmap-page-secondary-btn" onClick={() => navigate('/runs')}>
                {t('heatmap.page_open_runs')}
              </button>
              <button type="button" className="heatmap-page-primary-btn" onClick={() => navigate('/settings')}>
                {t('heatmap.page_open_settings')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

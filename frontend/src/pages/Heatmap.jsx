import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import PageSkeleton from '../components/PageSkeleton';
import 'leaflet/dist/leaflet.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const HEATMAP_REQUEST_TIMEOUT_MS = 120000;
const HEATMAP_INITIAL_PAGE_SIZE = 5000;
const HEATMAP_INITIAL_COVERAGE_LIMIT = 60000;
const HEATMAP_BACKGROUND_PAGE_SIZE = 100000;
const MAX_HEATMAP_PAGES = 1000;
const HEATMAP_PREVIEW_RENDER_POINT_LIMIT = 3500;
const HEATMAP_FULL_RENDER_POINT_LIMIT = 12000;
const HEATMAP_FULL_DRAW_CHUNK_SIZE = 640;
const HEATMAP_CANVAS_PADDING = 0.25;
const HEATMAP_CANVAS_PIXEL_RATIO_CAP = 1.5;
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

function getGpsDotStyle(speedRatio) {
  const speedBand = getSpeedBand(speedRatio);
  return {
    color: speedBand.color,
    radius: 1.65,
    fillColor: speedBand.color,
    fillOpacity: 0.92,
    opacity: 0.38,
    weight: 0.48,
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
  let nextLimit = HEATMAP_INITIAL_PAGE_SIZE;

  const firstPagePayload = await fetchHeatmapPage(offset, nextLimit, signal);
  if (!firstPagePayload) return null;

  const firstPagePoints = Array.isArray(firstPagePayload.points) ? firstPagePayload.points : [];
  for (const point of firstPagePoints) {
    points.push(normalizeHeatPointForRender(point));
  }

  if (typeof onProgress === 'function') {
    const firstProgress = buildMergedHeatmapPayload(firstPagePayload, points.slice(), 'recentPreview');
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
    if (!pagePayload) return buildMergedHeatmapPayload(firstPagePayload, points, 'partialFull');

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

  return buildMergedHeatmapPayload(firstPagePayload, points);
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
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [heatmapState, setHeatmapState] = useState('loading');
  const [heatmapReloadToken, setHeatmapReloadToken] = useState(0);
  const [mapMountFailed, setMapMountFailed] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const zoomAnimationActiveRef = useRef(false);
  const queuedZoomStepsRef = useRef(0);
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
    const heatmapTimeoutId = window.setTimeout(() => heatmapController.abort(), HEATMAP_REQUEST_TIMEOUT_MS);
    let cancelled = false;

    setHeatmapState('loading');
    setMapMountFailed(false);

    async function loadHeatmap() {
      const cacheKey = getHeatmapCacheKey(authEmail);
      let servedCachedHeatmap = false;
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

        if (cancelled) return;
        const completeHeatmap = heatmapData && typeof heatmapData === 'object' ? heatmapData : null;
        setHeatmap(completeHeatmap);
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
      }
    }

    loadHeatmap();

    return () => {
      cancelled = true;
      window.clearTimeout(heatmapTimeoutId);
      heatmapController.abort();
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
    async function mountMap() {
      try {
        const L = await loadLeafletModules();
        if (disposed || !mapRef.current) return;

        if (dotOverlayRef.current?.destroy) {
          dotOverlayRef.current.destroy();
        }
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
          zoomAnimationThreshold: 1,
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
          updateInterval: 250,
          keepBuffer: 2,
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
        let isZoomingMap = false;
        let skipNextMovePreview = false;
        let zoomSettleTimeoutId = null;
        let canvasViewState = null;
        const canvasSize = { width: 0, height: 0, pixelRatio: 0 };
        const bufferCanvas = document.createElement('canvas');
        const bufferContext = bufferCanvas.getContext('2d');

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

        const paintRouteDots = (renderMode = 'full', onPaintComplete) => {
          if (disposed) return;

          const zoom = map.getZoom();
          const center = map.getCenter();
          const size = map.getSize();
          const paddedSize = size.multiplyBy(1 + HEATMAP_CANVAS_PADDING * 2).round();
          const pixelRatio = Math.min(window.devicePixelRatio || 1, HEATMAP_CANVAS_PIXEL_RATIO_CAP);
          const layerTopLeft = map.containerPointToLayerPoint(size.multiplyBy(-HEATMAP_CANVAS_PADDING)).round();
          const canvasLayerOrigin = layerTopLeft;

          const canvasWidth = Math.max(1, Math.round(paddedSize.x * pixelRatio));
          const canvasHeight = Math.max(1, Math.round(paddedSize.y * pixelRatio));
          const commitCanvasLayout = () => {
            L.DomUtil.setPosition(dotCanvas, canvasLayerOrigin);
            canvasViewState = { center, zoom };
            if (canvasSize.width !== canvasWidth || canvasSize.height !== canvasHeight || canvasSize.pixelRatio !== pixelRatio) {
              canvasSize.width = canvasWidth;
              canvasSize.height = canvasHeight;
              canvasSize.pixelRatio = pixelRatio;
              dotCanvas.width = canvasWidth;
              dotCanvas.height = canvasHeight;
              dotCanvas.style.width = `${paddedSize.x}px`;
              dotCanvas.style.height = `${paddedSize.y}px`;
            }
          };
          if (bufferCanvas.width !== canvasWidth || bufferCanvas.height !== canvasHeight) {
            bufferCanvas.width = canvasWidth;
            bufferCanvas.height = canvasHeight;
          }

          const paddedSouthEast = layerTopLeft.add(paddedSize);
          const paddedBounds = L.latLngBounds(
            map.layerPointToLatLng(layerTopLeft),
            map.layerPointToLatLng(paddedSouthEast),
          );
          const west = paddedBounds.getWest();
          const east = paddedBounds.getEast();
          const north = paddedBounds.getNorth();
          const south = paddedBounds.getSouth();
          const renderPoints = renderMode === 'preview'
            ? latestPreviewRenderPointsRef.current
            : latestFullRenderPointsRef.current;

          cancelFullDraw();
          if (renderMode !== 'full' || renderPoints.length <= HEATMAP_FULL_DRAW_CHUNK_SIZE) {
            commitCanvasLayout();
            dotContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            dotContext.clearRect(0, 0, paddedSize.x, paddedSize.y);
            for (const point of renderPoints) {
              if (!isValidGpsCoordinate(point?.latitude, point?.longitude)) continue;
              if (point.latitude < south || point.latitude > north || point.longitude < west || point.longitude > east) continue;
              drawRoutePoint(dotContext, point, zoom, renderMode, canvasLayerOrigin);
            }
            onPaintComplete?.();
            return;
          }

          const drawToken = activeFullDrawToken;
          const visibleStyleWidth = dotCanvas.style.width;
          const visibleStyleHeight = dotCanvas.style.height;
          bufferCanvas.style.width = visibleStyleWidth;
          bufferCanvas.style.height = visibleStyleHeight;
          bufferContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          bufferContext.clearRect(0, 0, paddedSize.x, paddedSize.y);
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

            commitCanvasLayout();
            dotContext.setTransform(1, 0, 0, 1, 0, 0);
            dotContext.clearRect(0, 0, canvasWidth, canvasHeight);
            dotContext.drawImage(bufferCanvas, 0, 0);
            onPaintComplete?.();
          };

          scheduleFullDrawChunk(drawFullChunk);
        };

        const scheduleRouteDots = (renderMode = 'full', onPaintComplete) => {
          if (drawFrameId !== null) {
            window.cancelAnimationFrame(drawFrameId);
          }
          drawFrameId = window.requestAnimationFrame(() => {
            drawFrameId = null;
            paintRouteDots(renderMode, onPaintComplete);
          });
        };

        const finishZoomRender = () => {
          if (disposed) return;
          isZoomingMap = false;
          zoomAnimationActiveRef.current = false;
          zoomSettleTimeoutId = null;
          scheduleRouteDots('full');
        };

        const animateRouteDotsZoom = (event) => {
          if (!canvasViewState) return;
          const scale = map.getZoomScale(event.zoom, canvasViewState.zoom);
          const viewHalf = map.getSize().multiplyBy(0.5 + HEATMAP_CANVAS_PADDING);
          const currentCenterPoint = map.project(canvasViewState.center, event.zoom);
          const offset = viewHalf
            .multiplyBy(-scale)
            .add(currentCenterPoint)
            .subtract(map._getNewPixelOrigin(event.center, event.zoom));
          L.DomUtil.setTransform(dotCanvas, offset, scale);
        };

        const scheduleZoomStart = () => {
          zoomAnimationActiveRef.current = true;
          if (drawFrameId !== null) {
            window.cancelAnimationFrame(drawFrameId);
            drawFrameId = null;
          }
          cancelFullDraw();
          if (zoomSettleTimeoutId !== null) {
            window.clearTimeout(zoomSettleTimeoutId);
          }
          isZoomingMap = true;
          skipNextMovePreview = true;
          zoomSettleTimeoutId = window.setTimeout(finishZoomRender, 480);
        };

        const scheduleZoomEnd = () => {
          if (zoomSettleTimeoutId !== null) {
            window.clearTimeout(zoomSettleTimeoutId);
          }
          zoomSettleTimeoutId = null;

          const queuedZoomDelta = queuedZoomStepsRef.current;
          queuedZoomStepsRef.current = 0;
          if (queuedZoomDelta === 0) {
            finishZoomRender();
            return;
          }
          const nextZoom = clamp(map.getZoom() + queuedZoomDelta, map.getMinZoom(), map.getMaxZoom());
          if (nextZoom === map.getZoom()) {
            finishZoomRender();
            return;
          }
          window.requestAnimationFrame(() => {
            if (disposed) return;
            map.setZoom(nextZoom, { animate: true });
          });
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
            zoomAnimationActiveRef.current = false;
            queuedZoomStepsRef.current = 0;
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
  const activityCount = Number(heatmap?.activityCount || 0);
  const densityPerRun = activityCount > 0 ? Math.round(pointCount / activityCount) : 0;
  const centerLatitude = bounds ? (bounds.minLatitude + bounds.maxLatitude) / 2 : null;
  const centerLongitude = bounds ? (bounds.minLongitude + bounds.maxLongitude) / 2 : null;
  const centerLabel = bounds
    ? `${formatCoordinate(centerLatitude, 'N', 'S')} / ${formatCoordinate(centerLongitude, 'E', 'W')}`
    : '--';

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
    const zoomStep = Math.sign(delta);
    if (zoomStep === 0) return;
    if (zoomAnimationActiveRef.current) {
      queuedZoomStepsRef.current = clamp(
        queuedZoomStepsRef.current + zoomStep,
        -3,
        3,
      );
      return;
    }
    const targetZoom = clamp(map.getZoom() + zoomStep, map.getMinZoom(), map.getMaxZoom());
    if (targetZoom === map.getZoom()) return;
    zoomAnimationActiveRef.current = true;
    map.setZoom(targetZoom, { animate: true });
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

  if (heatmapState === 'loading') return <PageSkeleton variant="heatmap" />;

  return (
    <div className="heatmap-page">
      <div className="heatmap-page-map-shell">
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
                        <span className="heatmap-page-gps-loading-signal" aria-hidden="true">
                          <span />
                        </span>
                        <span className="heatmap-page-gps-loading-label" aria-hidden="true">
                          {gpsLoadingLabelRoot}
                        </span>
                        <span className="heatmap-page-gps-loading-bars" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </span>
                    )}
                  </strong>
                </div>
              </div>
            </aside>

          </>
        ) : null}

        {heatmapState === 'loading' ? (
          <div className="heatmap-page-empty heatmap-page-empty--loading">
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

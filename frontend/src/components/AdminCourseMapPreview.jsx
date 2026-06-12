import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { getBackendBaseUrl } from '../api';

const ADMIN_REVIEW_PREVIEW_MAX_TILE_ZOOM = 19;
const ADMIN_REVIEW_PREVIEW_MAX_ROUTE_ZOOM = 14;
const ADMIN_REVIEW_PREVIEW_TILE_FALLBACK_MS = 1600;

function asFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOverlayBounds(rawBounds) {
  if (!rawBounds || typeof rawBounds !== 'object') return null;
  const north = asFiniteNumber(rawBounds.north);
  const south = asFiniteNumber(rawBounds.south);
  const east = asFiniteNumber(rawBounds.east);
  const west = asFiniteNumber(rawBounds.west);
  if (north == null || south == null || east == null || west == null) return null;
  if (north <= south || east <= west) return null;
  return { north, south, east, west };
}

function normalizeRoutePoints(rawPoints) {
  if (!Array.isArray(rawPoints)) return [];
  return rawPoints
    .map((point) => {
      if (!point || typeof point !== 'object') return null;
      const lat = asFiniteNumber(point.lat);
      const lng = asFiniteNumber(point.lng);
      if (lat == null || lng == null) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { lat, lng, label: typeof point.label === 'string' ? point.label : '' };
    })
    .filter(Boolean);
}

function isBrowserLoadableImageUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  if (normalized.startsWith('data:image/') || normalized.startsWith('blob:') || trimmed.startsWith('/')) {
    return true;
  }
  if (normalized.startsWith('https://')) return true;
  if (normalized.startsWith('http://') && typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(trimmed).origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return false;
}

function resolvePreviewImageUrl(preview) {
  if (!preview || typeof preview !== 'object') return '';
  const candidates = [
    preview.previewImageUrl,
    preview.imageUrl,
    preview.sourceImageUrl,
  ];
  return candidates.find(isBrowserLoadableImageUrl) || '';
}

function resolvePreviewSummary(preview) {
  if (!preview || typeof preview !== 'object') return '';
  return typeof preview.summary === 'string' ? preview.summary.trim() : '';
}

function normalizeFallbackCenter(rawCenter) {
  if (!rawCenter || typeof rawCenter !== 'object') return null;
  const lat = asFiniteNumber(rawCenter.lat ?? rawCenter.latitude);
  const lng = asFiniteNumber(rawCenter.lng ?? rawCenter.longitude);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat,
    lng,
    label: typeof rawCenter.label === 'string' ? rawCenter.label : '',
  };
}

export default function AdminCourseMapPreview({
  preview,
  title,
  emptyLabel,
  variant = 'panel',
  forceLiveMap = false,
  fallbackCenter = null,
  allowImageFallback = true,
  unalignedLabel = '',
}) {
  const mapHostRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const isCardVariant = variant === 'card';

  const imageUrl = resolvePreviewImageUrl(preview);
  const overlayBounds = useMemo(() => normalizeOverlayBounds(preview?.overlayBounds), [preview?.overlayBounds]);
  const routePoints = useMemo(() => normalizeRoutePoints(preview?.routePoints), [preview?.routePoints]);
  const polylinePoints = useMemo(() => routePoints.map((point) => [point.lat, point.lng]), [routePoints]);
  const fallbackLatLng = useMemo(() => {
    const normalized = normalizeFallbackCenter(fallbackCenter);
    return normalized ? [normalized.lat, normalized.lng] : null;
  }, [fallbackCenter]);
  const tileUrl = useMemo(() => `${getBackendBaseUrl()}/api/maps/tiles/{z}/{x}/{y}.png`, []);
  const fallbackTileUrl = useMemo(() => 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', []);
  const hasAlignedRoute = polylinePoints.length > 1;
  const hasAlignedOverlay = Boolean(imageUrl) && Boolean(overlayBounds) && hasAlignedRoute;
  const hasRenderableAlignment = hasAlignedOverlay || hasAlignedRoute;
  const hasFallbackCenter = Boolean(fallbackLatLng);
  const shouldRenderMap = !mapFailed && (hasRenderableAlignment || (forceLiveMap && hasFallbackCenter));
  const canRenderImage = Boolean(imageUrl) && !imageFailed;
  const shouldAllowImageFallback = allowImageFallback || hasRenderableAlignment;
  const previewSummary = useMemo(() => resolvePreviewSummary(preview), [preview]);
  const showPreviewSummary = Boolean(previewSummary) && !hasRenderableAlignment;
  const fallbackLabel = previewSummary || (preview && unalignedLabel ? unalignedLabel : emptyLabel);

  useEffect(() => {
    setMapReady(false);
    setMapFailed(false);
    setImageFailed(false);
  }, [imageUrl, overlayBounds, preview, hasAlignedRoute, forceLiveMap, hasFallbackCenter]);

  useEffect(() => {
    if (!mapHostRef.current || !shouldRenderMap) return undefined;
    let cancelled = false;
    let resizeTimer = null;
    let tileFallbackTimer = null;

    const clearTileFallbackTimer = () => {
      if (tileFallbackTimer) {
        clearTimeout(tileFallbackTimer);
        tileFallbackTimer = null;
      }
    };

    import('leaflet').then((leafletModule) => {
      if (cancelled || !mapHostRef.current) return;
      const L = leafletModule.default || leafletModule;
      const map = L.map(mapHostRef.current, {
        zoomControl: false,
        attributionControl: true,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false,
        maxZoom: ADMIN_REVIEW_PREVIEW_MAX_TILE_ZOOM,
      });

      const createPreviewPane = (name, zIndex) => {
        const pane = map.createPane(name);
        pane.style.zIndex = String(zIndex);
        pane.style.pointerEvents = 'none';
        return pane;
      };

      createPreviewPane('admin-review-preview__tile-pane', 180);
      createPreviewPane('admin-review-preview__source-pane', 260);
      createPreviewPane('admin-review-preview__route-shadow-pane', 420);
      createPreviewPane('admin-review-preview__route-pane', 430);
      createPreviewPane('admin-review-preview__marker-pane', 440);

      const resolvedOverlayBounds = overlayBounds
        ? L.latLngBounds(
          [overlayBounds.south, overlayBounds.west],
          [overlayBounds.north, overlayBounds.east],
        )
        : null;
      let activeTileLayer = null;
      let polyline = null;
      let switchedToFallbackTiles = false;
      let tileLoadConfirmed = false;

      const revealMap = () => {
        if (!cancelled) setMapReady(true);
      };

      const forceVisibleTiles = (layer) => {
        const container = layer.getContainer?.();
        if (typeof HTMLElement !== 'undefined' && container instanceof HTMLElement) {
          container.style.mixBlendMode = 'normal';
          container.style.opacity = '1';
          container.style.filter = 'none';
        }
        const tileElements = container?.querySelectorAll?.('img.leaflet-tile') || [];
        tileElements.forEach((tile) => {
          tile.style.mixBlendMode = 'normal';
          tile.style.opacity = '1';
          tile.style.filter = 'none';
          tile.style.visibility = 'visible';
          tile.style.display = 'block';
          tile.style.maxWidth = 'none';
          tile.style.maxHeight = 'none';
        });
      };

      function switchToFallbackTiles() {
        if (cancelled || switchedToFallbackTiles) return;
        switchedToFallbackTiles = true;
        tileLoadConfirmed = false;
        clearTileFallbackTimer();
        if (activeTileLayer) {
          activeTileLayer.off();
          map.removeLayer(activeTileLayer);
        }
        activeTileLayer = attachTileLayer(fallbackTileUrl);
        map.invalidateSize({ pan: false });
        applyPreviewViewport();
        activeTileLayer?.redraw?.();
      }

      function attachTileLayer(url) {
        const layer = L.tileLayer(url, {
          pane: 'admin-review-preview__tile-pane',
          maxZoom: ADMIN_REVIEW_PREVIEW_MAX_TILE_ZOOM,
          maxNativeZoom: ADMIN_REVIEW_PREVIEW_MAX_TILE_ZOOM,
          attribution: '&copy; OpenStreetMap contributors',
          className: 'admin-review-preview__osm-tile',
        }).addTo(map);
        layer.on('tileload', () => {
          forceVisibleTiles(layer);
          tileLoadConfirmed = true;
          clearTileFallbackTimer();
          revealMap();
        });
        layer.on('tileerror', () => {
          if (url === fallbackTileUrl) return;
          switchToFallbackTiles();
        });
        return layer;
      }

      const applyPreviewViewport = () => {
        if (polyline) {
          map.fitBounds(polyline.getBounds().pad(0.08), {
            padding: [18, 18],
            maxZoom: ADMIN_REVIEW_PREVIEW_MAX_ROUTE_ZOOM,
          });
          return;
        }
        if (hasAlignedOverlay && resolvedOverlayBounds) {
          map.fitBounds(resolvedOverlayBounds.pad(0.05), {
            padding: [18, 18],
            maxZoom: ADMIN_REVIEW_PREVIEW_MAX_ROUTE_ZOOM,
          });
          return;
        }
        if (fallbackLatLng) {
          map.setView(fallbackLatLng, 11, { animate: false });
        }
      };

      if (hasAlignedOverlay && resolvedOverlayBounds) {
        L.imageOverlay(imageUrl, resolvedOverlayBounds, {
          pane: 'admin-review-preview__source-pane',
          opacity: 0.22,
          interactive: false,
          className: 'admin-review-preview__map-overlay',
        }).addTo(map);
      }

      if (hasAlignedRoute) {
        L.polyline(polylinePoints, {
          pane: 'admin-review-preview__route-shadow-pane',
          color: '#15202b',
          weight: 8,
          opacity: 0.34,
          interactive: false,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        polyline = L.polyline(polylinePoints, {
          pane: 'admin-review-preview__route-pane',
          color: '#f07561',
          weight: 4,
          opacity: 0.98,
          interactive: false,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }

      if (!hasAlignedRoute && fallbackLatLng) {
        L.circleMarker(fallbackLatLng, {
          pane: 'admin-review-preview__marker-pane',
          radius: 6,
          weight: 2,
          color: '#f07561',
          fillColor: '#ffb4a7',
          fillOpacity: 0.82,
        }).addTo(map);
      }

      activeTileLayer = attachTileLayer(tileUrl);
      applyPreviewViewport();
      tileFallbackTimer = setTimeout(() => {
        if (!tileLoadConfirmed && !switchedToFallbackTiles) {
          switchToFallbackTiles();
        }
      }, ADMIN_REVIEW_PREVIEW_TILE_FALLBACK_MS);

      const finalizeLayout = () => {
        if (cancelled) return;
        map.invalidateSize({ pan: false });
        applyPreviewViewport();
        activeTileLayer?.redraw?.();
      };

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(finalizeLayout);
      }
      resizeTimer = setTimeout(finalizeLayout, 150);
      mapInstanceRef.current = map;
    }).catch(() => {
      if (!cancelled) {
        setMapFailed(true);
      }
    });

    return () => {
      cancelled = true;
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      clearTileFallbackTimer();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [fallbackLatLng, fallbackTileUrl, hasAlignedOverlay, hasAlignedRoute, imageUrl, overlayBounds, polylinePoints, shouldRenderMap, tileUrl]);

  if (shouldRenderMap) {
    return (
      <div className={`admin-review-preview admin-review-preview--map${isCardVariant ? ' admin-review-preview--card' : ''}`}>
        <div className="admin-review-preview__image-layer">
          {!mapReady && shouldAllowImageFallback && canRenderImage ? (
            <img
              src={imageUrl}
              alt={title}
              className={`admin-review-preview__image${isCardVariant ? ' admin-review-preview__image--card' : ''}`}
              onError={() => setImageFailed(true)}
            />
          ) : null}
        </div>
        <div className="admin-review-preview__map-layer">
          <div
            ref={mapHostRef}
            className={`admin-review-preview__map${isCardVariant ? ' admin-review-preview__map--card' : ''}${mapReady ? ' is-ready' : ''}`}
            aria-label={title}
          />
        </div>
        {!mapReady && !canRenderImage ? <div className="admin-review-preview__map-wash" aria-hidden="true" /> : null}
        {showPreviewSummary ? (
          <div className="admin-review-preview__summary-overlay">
            <p>{previewSummary}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (allowImageFallback && canRenderImage) {
    return (
      <div className={`admin-review-preview${isCardVariant ? ' admin-review-preview--card' : ''}`}>
        <img
          src={imageUrl}
          alt={title}
          className={`admin-review-preview__image${isCardVariant ? ' admin-review-preview__image--card' : ''}`}
          onError={() => setImageFailed(true)}
        />
        {showPreviewSummary ? (
          <div className="admin-review-preview__summary-overlay">
            <p>{previewSummary}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`admin-review-preview${isCardVariant ? ' admin-review-preview--card' : ''}`}>
      <div className="admin-review-preview__empty">{fallbackLabel}</div>
    </div>
  );
}

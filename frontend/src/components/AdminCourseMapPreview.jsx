import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { getBackendBaseUrl } from '../api';

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

function resolvePreviewImageUrl(preview) {
  if (!preview || typeof preview !== 'object') return '';
  return typeof preview.previewImageUrl === 'string' && preview.previewImageUrl
    ? preview.previewImageUrl
    : typeof preview.imageUrl === 'string' && preview.imageUrl
      ? preview.imageUrl
      : typeof preview.sourceImageUrl === 'string' && preview.sourceImageUrl
        ? preview.sourceImageUrl
        : '';
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
  const hasAlignedRoute = polylinePoints.length > 1;
  const hasAlignedOverlay = Boolean(imageUrl) && Boolean(overlayBounds) && hasAlignedRoute;
  const hasFallbackCenter = Boolean(fallbackLatLng);
  const shouldRenderMap = !mapFailed && (hasAlignedOverlay || hasAlignedRoute || (forceLiveMap && hasFallbackCenter));
  const canRenderImage = Boolean(imageUrl) && !imageFailed;

  useEffect(() => {
    setMapReady(false);
    setMapFailed(false);
    setImageFailed(false);
  }, [imageUrl, overlayBounds, preview, hasAlignedRoute, forceLiveMap, hasFallbackCenter]);

  useEffect(() => {
    if (!mapHostRef.current || !shouldRenderMap) return undefined;
    let cancelled = false;
    let resizeTimer = null;

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
      });

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const resolvedOverlayBounds = overlayBounds
        ? L.latLngBounds(
          [overlayBounds.south, overlayBounds.west],
          [overlayBounds.north, overlayBounds.east],
        )
        : null;
      let polyline = null;

      const applyPreviewViewport = () => {
        if (hasAlignedOverlay && resolvedOverlayBounds) {
          map.fitBounds(resolvedOverlayBounds.pad(0.05), { padding: [18, 18] });
          return;
        }
        if (polyline) {
          map.fitBounds(polyline.getBounds().pad(0.08), { padding: [18, 18] });
          return;
        }
        if (fallbackLatLng) {
          map.setView(fallbackLatLng, 11, { animate: false });
        }
      };

      if (hasAlignedOverlay && resolvedOverlayBounds) {
        L.imageOverlay(imageUrl, resolvedOverlayBounds, {
          opacity: 0.72,
          interactive: false,
          className: 'admin-review-preview__map-overlay',
        }).addTo(map);
      }

      if (hasAlignedRoute) {
        polyline = L.polyline(polylinePoints, {
          color: '#f07561',
          weight: 4,
          opacity: 0.92,
        }).addTo(map);
      }

      if (!hasAlignedRoute && fallbackLatLng) {
        L.circleMarker(fallbackLatLng, {
          radius: 6,
          weight: 2,
          color: '#f07561',
          fillColor: '#ffb4a7',
          fillOpacity: 0.82,
        }).addTo(map);
      }

      applyPreviewViewport();

      const finalizeLayout = () => {
        if (cancelled) return;
        map.invalidateSize({ pan: false });
        applyPreviewViewport();
        tileLayer.redraw?.();
        setMapReady(true);
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [fallbackLatLng, hasAlignedOverlay, hasAlignedRoute, imageUrl, overlayBounds, polylinePoints, shouldRenderMap, tileUrl]);

  if (shouldRenderMap) {
    return (
      <div className={`admin-review-preview admin-review-preview--map${isCardVariant ? ' admin-review-preview--card' : ''}`}>
        <div className="admin-review-preview__image-layer">
          {!mapReady && canRenderImage ? (
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
      </div>
    );
  }

  if (canRenderImage) {
    return (
      <div className={`admin-review-preview${isCardVariant ? ' admin-review-preview--card' : ''}`}>
        <img
          src={imageUrl}
          alt={title}
          className={`admin-review-preview__image${isCardVariant ? ' admin-review-preview__image--card' : ''}`}
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`admin-review-preview${isCardVariant ? ' admin-review-preview--card' : ''}`}>
      <div className="admin-review-preview__empty">{emptyLabel}</div>
    </div>
  );
}

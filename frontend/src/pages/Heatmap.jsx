import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import 'leaflet/dist/leaflet.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
let leafletModulesPromise = null;

async function loadLeafletModules() {
  if (!leafletModulesPromise) {
    leafletModulesPromise = import('leaflet').then(async (leafletModule) => {
      const L = leafletModule.default || leafletModule;
      if (!L.heatLayer) {
        window.L = L;
        await import('leaflet.heat');
      }
      return L;
    });
  }
  return leafletModulesPromise;
}

function getHeatLayerOptions(zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;
  const normalizedZoom = clamp(safeZoom, 8, 18);
  const zoomProgress = (normalizedZoom - 8) / 10;

  return {
    radius: Math.round(clamp(2 + zoomProgress * 4, 2, 6)),
    blur: Math.round(clamp(1 + zoomProgress * 2, 1, 3)),
    maxZoom: 18,
    minOpacity: clamp(0.03 + zoomProgress * 0.05, 0.03, 0.08),
    gradient: {
      0.08: '#3a0e16',
      0.36: '#ff375f',
      0.7: '#ff8c2b',
      1.0: '#ffd34f',
    },
  };
}

function buildHeatLayerPoints(points, zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;
  const normalizedZoom = clamp(safeZoom, 8, 18);
  const zoomBoost = clamp(0.18 + ((normalizedZoom - 8) / 10) * 0.1, 0.18, 0.28);

  return points.map((point) => {
    const baseIntensity = clamp(
      Number.isFinite(point.speedRatio) ? point.speedRatio : point.intensity || 0.5,
      0.06,
      1,
    );
    return [
      point.latitude,
      point.longitude,
      clamp(baseIntensity * zoomBoost, 0.04, 0.6),
    ];
  });
}

function getRouteSegmentColor(speedRatio) {
  const safeRatio = clamp(Number.isFinite(speedRatio) ? speedRatio : 0.5, 0, 1);
  if (safeRatio >= 0.84) return '#ffd34f';
  if (safeRatio >= 0.62) return '#ff9f1c';
  if (safeRatio >= 0.34) return '#ff5a47';
  return '#ff375f';
}

function getGpsDotStyle(speedRatio, zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;
  const normalizedZoom = clamp(safeZoom, 8, 18);
  const radius = clamp(1.2 + ((normalizedZoom - 8) / 10) * 2.3, 1.2, 3.5);
  return {
    color: getRouteSegmentColor(speedRatio),
    radius,
    fillColor: getRouteSegmentColor(speedRatio),
    fillOpacity: clamp(0.76 + ((normalizedZoom - 8) / 10) * 0.14, 0.76, 0.9),
    opacity: clamp(0.2 + ((normalizedZoom - 8) / 10) * 0.08, 0.2, 0.28),
    weight: clamp(radius * 0.28, 0.4, 1),
    interactive: false,
    bubblingMouseEvents: false,
  };
}

function getGpsDotStride(pointCount, zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;
  if (safeZoom >= 15 || pointCount <= 220) return 1;
  if (safeZoom >= 14 || pointCount <= 420) return 2;
  if (safeZoom >= 13) return 2;
  if (safeZoom >= 11) return pointCount <= 900 ? 2 : 3;
  if (safeZoom >= 9) return pointCount <= 1200 ? 3 : 4;
  return pointCount <= 1600 ? 4 : 5;
}

function buildVisibleGpsDots(points, zoom) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const stride = getGpsDotStride(points.length, zoom);
  const visibleDots = [];
  let lastActivityId = null;
  let activityPointIndex = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const nextPoint = points[index + 1] || null;
    const activityChanged = point.activityId !== lastActivityId;
    if (activityChanged) {
      activityPointIndex = 0;
    }

    const isActivityHead = activityChanged;
    const isActivityTail = !nextPoint || nextPoint.activityId !== point.activityId;
    const shouldKeep = isActivityHead || isActivityTail || activityPointIndex % stride === 0;

    if (shouldKeep) {
      visibleDots.push(point);
    }

    lastActivityId = point.activityId;
    activityPointIndex += 1;
  }

  return visibleDots;
}

function formatCoordinate(value, positiveSuffix, negativeSuffix) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix;
  return `${Math.abs(value).toFixed(3)}°${suffix}`;
}

export default function Heatmap() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [heatmapState, setHeatmapState] = useState('loading');
  const [heatmapReloadToken, setHeatmapReloadToken] = useState(0);
  const [mapMountFailed, setMapMountFailed] = useState(false);
  const [isFocusGridCollapsed, setIsFocusGridCollapsed] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
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
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    let cancelled = false;

    setHeatmapState('loading');
    setMapMountFailed(false);

    async function loadHeatmap() {
      try {
        const heatmapData = await apiJson('/api/profile/heatmap', { signal: controller.signal });
        if (cancelled) return;
        setHeatmap(heatmapData && typeof heatmapData === 'object' ? heatmapData : null);
        setHeatmapState('ready');
      } catch {
        if (!cancelled) {
          setHeatmap(null);
          setHeatmapState('error');
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    loadHeatmap();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isAuthenticated, heatmapReloadToken]);

  useEffect(() => {
    loadLeafletModules().catch(() => {
      // Let the mount effect handle the fallback state.
    });
  }, []);

  useEffect(() => {
    const points = Array.isArray(heatmap?.points) ? heatmap.points : [];
    const bounds = heatmap?.bounds || null;
    if (!mapRef.current || !points.length || !bounds || heatmapState !== 'ready') return undefined;

    let disposed = false;

    async function mountMap() {
      try {
        const L = await loadLeafletModules();
        if (disposed || !mapRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          dragging: true,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 20,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        }).addTo(map);

        const heatLayer = L.heatLayer(
          buildHeatLayerPoints(points, map.getZoom()),
          getHeatLayerOptions(map.getZoom()),
        ).addTo(map);
        const routeDotsLayer = L.layerGroup().addTo(map);
        const canvasRenderer = L.canvas({ padding: 0.35 });

        const fitMapToBounds = () => {
          map.fitBounds([
            [bounds.minLatitude, bounds.minLongitude],
            [bounds.maxLatitude, bounds.maxLongitude],
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

        const syncHeatLayerDensity = () => {
          const zoom = map.getZoom();
          heatLayer.setLatLngs(buildHeatLayerPoints(points, map.getZoom()));
          heatLayer.setOptions(getHeatLayerOptions(zoom));
          heatLayer.redraw();

          routeDotsLayer.clearLayers();
          const visibleDots = buildVisibleGpsDots(points, zoom);
          visibleDots.forEach((point) => {
            L.circleMarker([point.latitude, point.longitude], {
              ...getGpsDotStyle(point.speedRatio, zoom),
              renderer: canvasRenderer,
            }).addTo(routeDotsLayer);
          });
        };

        map.on('zoomend', syncHeatLayerDensity);
        syncHeatLayerDensity();

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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [heatmap, heatmapState]);

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const pointCount = Number(heatmap?.pointCount || 0);
  const activityCount = Number(heatmap?.activityCount || 0);
  const densityPerRun = activityCount > 0 ? Math.round(pointCount / activityCount) : 0;
  const bounds = heatmap?.bounds || null;
  const centerLatitude = bounds ? (bounds.minLatitude + bounds.maxLatitude) / 2 : null;
  const centerLongitude = bounds ? (bounds.minLongitude + bounds.maxLongitude) / 2 : null;
  const centerLabel = bounds
    ? `${formatCoordinate(centerLatitude, 'N', 'S')} / ${formatCoordinate(centerLongitude, 'E', 'W')}`
    : '--';

  const focusCards = [
    { label: t('heatmap.page_runs_label'), value: activityCount },
    { label: t('heatmap.page_points_label'), value: pointCount },
    { label: t('heatmap.page_density_label'), value: densityPerRun },
  ];

  const quickLinks = [
    { key: 'profile', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'runs', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map', active: true },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

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
              <span>{showMapOverlays ? centerLabel : t('heatmap_loading')}</span>
            </div>
          </button>

          <div className="heatmap-page-filter-strip" aria-label={t('heatmap.page_map_title')}>
            <span className="heatmap-page-filter-pill is-active">{t('heatmap.page_filter_speed')}</span>
            <span className="heatmap-page-filter-pill">{t('heatmap.page_filter_runs')}</span>
            <span className="heatmap-page-filter-pill">{t('heatmap.page_filter_all_time')}</span>
          </div>

          <div className="heatmap-page-action-strip">
            <button type="button" className="heatmap-page-secondary-btn is-overlay" onClick={() => navigate('/runs')}>
              {t('heatmap.page_open_runs')}
            </button>
            <button type="button" className="heatmap-page-primary-btn is-overlay" onClick={() => navigate('/settings')}>
              {t('heatmap.page_open_settings')}
            </button>
            <button
              type="button"
              className="analysis-stitch-avatar heatmap-page-avatar"
              aria-label={profile?.displayName || 'Hermes'}
              onClick={() => navigate('/profile')}
            >
              {initials}
            </button>
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

            <section className={cx('heatmap-page-story-card', isFocusGridCollapsed && 'is-collapsed')}>
              {isFocusGridCollapsed ? (
                <button
                  type="button"
                  className="heatmap-page-focus-toggle is-collapsed"
                  onClick={() => setIsFocusGridCollapsed(false)}
                  aria-label={t('heatmap.page_focus_expand')}
                  title={t('heatmap.page_focus_expand')}
                  aria-pressed="true"
                  aria-expanded="false"
                >
                  <span className="heatmap-page-focus-toggle-dot" aria-hidden="true" />
                </button>
              ) : (
                <>
                  <div className="heatmap-page-story-head">
                    <span className="heatmap-page-card-kicker">{t('heatmap.page_map_kicker')}</span>
                    <button
                      type="button"
                      className="heatmap-page-focus-toggle"
                      onClick={() => setIsFocusGridCollapsed(true)}
                      aria-label={t('heatmap.page_focus_collapse')}
                      title={t('heatmap.page_focus_collapse')}
                      aria-pressed="false"
                      aria-expanded="true"
                    >
                      <span className="heatmap-page-focus-toggle-dot" aria-hidden="true" />
                    </button>
                  </div>
                  <h1>{t('heatmap.page_title')}</h1>
                  <p>{t('heatmap.page_copy')}</p>

                  <div className="heatmap-page-focus-grid">
                    {focusCards.map((card) => (
                      <div key={card.label} className="heatmap-page-focus-card">
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <aside className="heatmap-page-legend-card">
              <span className="heatmap-page-card-kicker">{t('heatmap.page_legend_title')}</span>
              <div className="heatmap-page-legend-scale" aria-hidden="true">
                <span className="is-slow" />
                <span className="is-mid" />
                <span className="is-fast" />
              </div>
              <div className="heatmap-page-legend-labels">
                <span>{t('heatmap.page_legend_slow')}</span>
                <span>{t('heatmap.page_legend_mid')}</span>
                <span>{t('heatmap.page_legend_fast')}</span>
              </div>

              <div className="heatmap-page-legend-meta">
                <div>
                  <span>{t('heatmap.page_center_label')}</span>
                  <strong>{centerLabel}</strong>
                </div>
                <div>
                  <span>{t('heatmap.page_density_label')}</span>
                  <strong>{densityPerRun}</strong>
                </div>
              </div>
            </aside>
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
              <h3>{t('heatmap_empty')}</h3>
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

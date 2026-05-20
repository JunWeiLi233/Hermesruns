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
const SPEED_BANDS = [
  { key: 'slow', min: 0, color: '#ff375f' },
  { key: 'mid', min: 0.34, color: '#ff5a47' },
  { key: 'fast', min: 0.62, color: '#ff9f1c' },
  { key: 'peak', min: 0.84, color: '#ffd34f' },
];
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
    radius: Math.round(clamp(2 + zoomProgress * 3, 2, 5)),
    blur: Math.round(clamp(1 + zoomProgress * 1, 1, 2)),
    maxZoom: 18,
    minOpacity: clamp(0.015 + zoomProgress * 0.03, 0.015, 0.045),
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
  const zoomBoost = clamp(0.11 + ((normalizedZoom - 8) / 10) * 0.07, 0.11, 0.18);

  return points.map((point) => {
    const baseIntensity = clamp(
      Number.isFinite(point.visualSpeedRatio)
        ? point.visualSpeedRatio
        : (Number.isFinite(point.speedRatio) ? point.speedRatio : point.intensity || 0.5),
      0.06,
      1,
    );
    return [
      point.latitude,
      point.longitude,
      clamp(baseIntensity * zoomBoost, 0.025, 0.36),
    ];
  });
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
  const radius = clamp(1.5 + ((normalizedZoom - 8) / 10) * 2.7, 1.5, 4.2);
  const speedBand = getSpeedBand(speedRatio);
  return {
    color: speedBand.color,
    radius,
    fillColor: speedBand.color,
    fillOpacity: clamp(0.86 + ((normalizedZoom - 8) / 10) * 0.1, 0.86, 0.96),
    opacity: clamp(0.34 + ((normalizedZoom - 8) / 10) * 0.1, 0.34, 0.44),
    weight: clamp(radius * 0.34, 0.6, 1.5),
    interactive: false,
    bubblingMouseEvents: false,
  };
}

function normalizePointSpeedRatios(points) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const sortableSpeeds = points
    .map((point) => Number(point?.speedRatio))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (sortableSpeeds.length <= 1) {
    return points.map((point) => ({
      ...point,
      visualSpeedRatio: Number.isFinite(Number(point?.speedRatio)) ? Number(point.speedRatio) : 0.5,
    }));
  }

  const resolvePercentile = (rawSpeedRatio) => {
    const safeRatio = Number(rawSpeedRatio);
    if (!Number.isFinite(safeRatio)) return 0.5;

    let low = 0;
    let high = sortableSpeeds.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (sortableSpeeds[mid] <= safeRatio) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return clamp((low - 1) / (sortableSpeeds.length - 1), 0, 1);
  };

  return points.map((point) => ({
    ...point,
    visualSpeedRatio: resolvePercentile(point?.speedRatio),
  }));
}

function getGpsDotStride(pointCount, zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 12;
  if (safeZoom >= 15 || pointCount <= 360) return 1;
  if (safeZoom >= 13 || pointCount <= 720) return 2;
  if (safeZoom >= 11 || pointCount <= 1400) return 3;
  return pointCount <= 2200 ? 4 : 5;
}

function buildVisibleGpsDots(points, zoom) {
  if (!Array.isArray(points) || points.length === 0) return [];

  const visibleDots = [];
  let activityStart = 0;

  while (activityStart < points.length) {
    const activityId = points[activityStart]?.activityId;
    let activityEnd = activityStart + 1;
    while (activityEnd < points.length && points[activityEnd]?.activityId === activityId) {
      activityEnd += 1;
    }

    const activityPoints = points.slice(activityStart, activityEnd);
    const stride = getGpsDotStride(activityPoints.length, zoom);

    for (let activityIndex = 0; activityIndex < activityPoints.length; activityIndex += 1) {
      const point = activityPoints[activityIndex];
      const isActivityHead = activityIndex === 0;
      const isActivityTail = activityIndex === activityPoints.length - 1;
      const shouldKeep = isActivityHead || isActivityTail || activityIndex % stride === 0;

      if (shouldKeep) {
        visibleDots.push(point);
      }
    }

    activityStart = activityEnd;
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
  const { isAuthenticated, authHydrated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [runs, setRuns] = useState([]);
  const [heatmapState, setHeatmapState] = useState('loading');
  const [heatmapReloadToken, setHeatmapReloadToken] = useState(0);
  const [mapMountFailed, setMapMountFailed] = useState(false);
  const [isFocusGridCollapsed, setIsFocusGridCollapsed] = useState(false);
  const [viewBounds, setViewBounds] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

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

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    let cancelled = false;

    setHeatmapState('loading');
    setMapMountFailed(false);

    async function loadHeatmap() {
      try {
        const [heatmapData, activitiesData] = await Promise.all([
          apiJson('/api/profile/heatmap', { signal: controller.signal }),
          apiJson('/api/activities', { signal: controller.signal }),
        ]);

        if (cancelled) return;
        setHeatmap(heatmapData && typeof heatmapData === 'object' ? heatmapData : null);
        setRuns(Array.isArray(activitiesData) ? activitiesData : []);
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
  }, [authHydrated, isAuthenticated, heatmapReloadToken]);

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

  useEffect(() => {
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
          const bounds = map.getBounds();
          setViewBounds({
            west: bounds.getWest(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
            south: bounds.getSouth(),
          });

          heatLayer.setLatLngs(buildHeatLayerPoints(points, map.getZoom()));
          heatLayer.setOptions(getHeatLayerOptions(zoom));
          heatLayer.redraw();

          routeDotsLayer.clearLayers();
          const visibleDots = buildVisibleGpsDots(points, zoom);
          visibleDots.forEach((point) => {
            L.circleMarker([point.latitude, point.longitude], {
              ...getGpsDotStyle(point.visualSpeedRatio, zoom),
              renderer: canvasRenderer,
            }).addTo(routeDotsLayer);
          });
        };

        map.on('zoomend', syncHeatLayerDensity);
        map.on('moveend', syncHeatLayerDensity);
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
  }, [bounds, heatmapState, points]);

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const pointCount = Number(heatmap?.pointCount || 0);
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

  const focusCards = [
    { label: t('heatmap.page_runs_label'), value: activityCount },
    { label: t('heatmap.page_points_label'), value: pointCount },
    { label: t('heatmap.page_density_label'), value: densityPerRun, emphasis: 'density' },
  ];
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
                      <div
                        key={card.label}
                        className={cx('heatmap-page-focus-card', card.emphasis === 'density' && 'is-density')}
                      >
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

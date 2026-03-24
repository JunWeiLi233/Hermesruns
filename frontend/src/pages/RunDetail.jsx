import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import { formatDuration, formatLongDate, formatPace } from '../utils/format';
import LanguageSwitcher from '../components/LanguageSwitcher';
import 'leaflet/dist/leaflet.css';

function haversineMeters([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyRoute(distanceKm, gapM) {
  if (!distanceKm || distanceKm <= 0) return 'Unknown';
  if (gapM <= Math.max(120, distanceKm * 40)) return 'Loop';
  if (gapM <= distanceKm * 160) return 'Out and back';
  return 'Point to point';
}

function buildInsights(points, activity) {
  if (!points.length) {
    return { pointCount: 0, computedDistanceKm: null, startFinishGapMeters: null, boundingSpanKm: null, efficiency: null, routeShape: 'No GPS route', centerPoint: null, centerLabel: 'Not available' };
  }
  let dist = 0, minLat = points[0][0], maxLat = points[0][0], minLng = points[0][1], maxLng = points[0][1];
  for (let i = 1; i < points.length; i++) {
    dist += haversineMeters(points[i - 1], points[i]);
    minLat = Math.min(minLat, points[i][0]); maxLat = Math.max(maxLat, points[i][0]);
    minLng = Math.min(minLng, points[i][1]); maxLng = Math.max(maxLng, points[i][1]);
  }
  const center = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  const gap = haversineMeters(points[0], points[points.length - 1]);
  const span = haversineMeters([minLat, minLng], [maxLat, maxLng]);
  const distKm = dist / 1000;
  return {
    pointCount: points.length, computedDistanceKm: distKm, startFinishGapMeters: gap,
    boundingSpanKm: span / 1000, efficiency: dist > 0 ? span / dist : null,
    routeShape: classifyRoute(distKm, gap), centerPoint: center,
    centerLabel: `${center[0].toFixed(4)}, ${center[1].toFixed(4)}`,
  };
}

export default function RunDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();

  const [run, setRun] = useState(null);
  const [points, setPoints] = useState([]);
  const [insights, setInsights] = useState(null);
  const [syncBtnText, setSyncBtnText] = useState('');
  const [syncDisabled, setSyncDisabled] = useState(false);
  const [shoes, setShoes] = useState([]);
  const [shoeDropdownOpen, setShoeDropdownOpen] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Load run from sessionStorage or by ID
  useEffect(() => {
    const raw = sessionStorage.getItem('hermes_selected_run');
    if (raw) {
      const parsed = JSON.parse(raw);
      setRun(parsed);
    }
  }, [id]);

  // Load available shoes
  useEffect(() => {
    if (!isAuthenticated) return;
    apiJson('/api/shoes').then(data => setShoes(Array.isArray(data) ? data : [])).catch(() => {});
  }, [isAuthenticated]);

  async function assignShoe(shoeId) {
    if (!run?.id) return;
    try {
      await apiFetch(`/api/shoes/${shoeId}/assign/${run.id}`, { method: 'PATCH' });
      setRun(prev => ({
        ...prev,
        shoeId: shoeId === 0 ? null : shoeId,
        shoeName: shoeId === 0 ? null : (() => {
          const s = shoes.find(sh => sh.id === shoeId);
          return s ? [s.brand, s.model].filter(Boolean).join(' ') || s.nickname : null;
        })(),
      }));
      setShoeDropdownOpen(false);
    } catch { /* ignored */ }
  }

  // Fetch GPS points
  useEffect(() => {
    if (!run?.id || !isAuthenticated) return;
    async function fetchPoints() {
      try {
        const res = await apiFetch(`/api/activities/${run.id}/points`);
        if (!res.ok) return;
        const data = await res.json();
        const pts = Array.isArray(data)
          ? data.map(p => [Number(p.latitude), Number(p.longitude)]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
          : [];
        setPoints(pts);
        setInsights(buildInsights(pts, run));
      } catch { /* ignored */ }
    }
    fetchPoints();
  }, [run, isAuthenticated]);

  // Render map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !insights) return;
    if (!points.length) return;

    import('leaflet').then(L => {
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true, dragging: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const line = L.polyline(points, { color: '#ff6b2c', weight: 4, opacity: 0.92 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });

      L.circleMarker(points[0], { radius: 7, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 })
        .bindTooltip(t('run_detail.start')).addTo(map);
      L.circleMarker(points[points.length - 1], { radius: 7, color: '#10203d', fillColor: '#10203d', fillOpacity: 1 })
        .bindTooltip(t('run_detail.finish')).addTo(map);

      if (insights.centerPoint) {
        L.circleMarker(insights.centerPoint, { radius: 5, color: '#ea4f1f', fillColor: '#ffd2bf', fillOpacity: 0.95 })
          .bindTooltip(t('run_detail.route_center_marker')).addTo(map);
      }

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [points, insights]);

  // Resolve distance/time
  const distKm = useMemo(() => {
    if (!run) return null;
    const src = Number(run.distanceKm || 0);
    if (src > 0) return src;
    if (run.distanceMeters > 0) return run.distanceMeters / 1000;
    return insights?.computedDistanceKm;
  }, [run, insights]);

  const movingSec = useMemo(() => {
    if (!run) return null;
    const m = Number(run.movingTimeSeconds || 0);
    if (m > 0) return m;
    const d = Number(run.durationSeconds || 0);
    return d > 0 ? d : null;
  }, [run]);

  async function handleResync() {
    setSyncDisabled(true);
    setSyncBtnText(t('run_detail.syncing'));
    try {
      const res = await apiFetch('/api/strava/sync');
      setSyncBtnText(res.ok ? t('run_detail.sync_started') : t('run_detail.sync_failed'));
    } catch {
      setSyncBtnText(t('run_detail.sync_failed'));
    }
    setTimeout(() => { setSyncDisabled(false); setSyncBtnText(''); }, 3200);
  }

  if (!run) {
    return (
      <div className="dashboard-body history-detail-page">
        <LanguageSwitcher />
        <div className="empty-state" style={{ width: 'min(100%, 860px)', margin: '80px auto 0', padding: '42px 32px', borderRadius: 28, textAlign: 'center' }}>
          <h1>{t('run_detail.no_run_selected')}</h1>
          <p><Link to="/runs">{t('run_detail.back_to_runs')}</Link> {t('run_detail.no_run_selected_copy')}</p>
        </div>
      </div>
    );
  }

  const dateText = formatLongDate(run.startTime || run.startDate, lang);

  const performanceRows = [
    [t('run_detail.perf_distance'), distKm != null ? `${distKm.toFixed(2)} km` : t('run_detail.not_available')],
    [t('run_detail.perf_moving_time'), movingSec ? formatDuration(movingSec) : t('run_detail.not_available')],
    [t('run_detail.perf_average_pace'), distKm && movingSec ? formatPace(distKm, movingSec, lang) : t('run_detail.not_available')],
    [t('run_detail.perf_max_speed'), run.maxSpeedMps != null ? `${(run.maxSpeedMps * 3.6).toFixed(1)} km/h` : t('run_detail.not_available')],
    [t('run_detail.perf_average_heart_rate'), run.averageHeartRate != null ? `${Math.round(run.averageHeartRate)} bpm` : t('run_detail.not_available')],
    [t('run_detail.perf_max_heart_rate'), run.maxHeartRate != null ? `${Math.round(run.maxHeartRate)} bpm` : t('run_detail.not_available')],
    [t('run_detail.perf_average_cadence'), run.averageCadence != null ? `${Math.round(run.averageCadence)} spm` : t('run_detail.not_available')],
    [t('run_detail.perf_average_power'), run.averageWatts != null ? `${Math.round(run.averageWatts)} W` : t('run_detail.not_available')],
    [t('run_detail.perf_calories'), run.calories != null ? `${run.calories} kcal` : t('run_detail.not_available')],
    [t('run_detail.perf_elevation_gain'), run.totalElevationGain != null ? `${Math.round(run.totalElevationGain)} m` : t('run_detail.not_available')],
  ];

  const routeRows = insights ? [
    [t('run_detail.route_gps_samples'), insights.pointCount ? insights.pointCount.toLocaleString() : t('run_detail.no_route_data')],
    [t('run_detail.route_gps_distance'), insights.computedDistanceKm != null ? `${insights.computedDistanceKm.toFixed(2)} km` : t('run_detail.not_available')],
    [t('run_detail.route_start_finish_gap'), insights.startFinishGapMeters != null ? `${Math.round(insights.startFinishGapMeters)} m` : t('run_detail.not_available')],
    [t('run_detail.route_bounding_span'), insights.boundingSpanKm != null ? `${insights.boundingSpanKm.toFixed(2)} km` : t('run_detail.not_available')],
    [t('run_detail.route_shape'), insights.routeShape],
    [t('run_detail.route_efficiency'), insights.efficiency != null ? `${Math.round(insights.efficiency * 100)}%` : t('run_detail.not_available')],
    [t('run_detail.route_center'), insights.centerLabel],
    [t('run_detail.route_source_file'), run.sourceFileName || t('run_detail.not_available')],
  ] : [];

  const heroMeta = [dateText, run.provider, insights?.pointCount ? `${insights.pointCount.toLocaleString()} ${t('run_detail.gps_samples_suffix')}` : null].filter(Boolean).join(' \u2022 ') || t('run_detail.imported_activity');

  return (
    <div className="dashboard-body history-detail-page">
      <LanguageSwitcher />
      <div className="topbar">
        <div className="topbar-left">
          <Link to="/runs" className="back-link">
            <span>&larr;</span>
            <span>{t('run_detail.back_to_runs')}</span>
          </Link>
          <div className="topbar-title">
            <strong>{run.name || 'Run'}</strong>
            <span>{dateText || t('run_detail.date_unavailable')}</span>
          </div>
        </div>
        <div className="topbar-actions">
          {run.provider && <div className="provider-pill">{run.provider}</div>}
          {run.provider === 'STRAVA' && (
            <button className="sync-btn" disabled={syncDisabled} onClick={handleResync}>
              {syncBtnText || t('run_detail.resync_strava')}
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-shell">
        {points.length > 0 ? (
          <div ref={mapRef} id="route-map" style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="no-map-state" style={{ display: 'flex' }}>{t('run_detail.no_map')}</div>
        )}
      </div>

      <main className="shell">
        {/* Hero Card */}
        <section className="hero-card">
          <div>
            <span className="eyebrow">{t('run_detail.hero_eyebrow')}</span>
            <h1 className="hero-title">{run.name || 'Run'}</h1>
            <div className="hero-meta">{heroMeta}</div>
          </div>
          <div className="hero-metrics">
            <article className="metric-card">
              <span className="metric-label">{t('run_detail.metric_distance')}</span>
              <span className="metric-value">{distKm != null ? `${distKm.toFixed(2)} km` : '--'}</span>
              <span className="metric-subtext">
                {insights?.computedDistanceKm != null
                  ? t('run_detail.gps_trace_estimate', { distance: insights.computedDistanceKm.toFixed(2) })
                  : t('run_detail.source_distance_only')}
              </span>
            </article>
            <article className="metric-card">
              <span className="metric-label">{t('run_detail.metric_moving_time')}</span>
              <span className="metric-value">{movingSec ? formatDuration(movingSec) : '--'}</span>
              <span className="metric-subtext">{t('run_detail.metric_moving_time_note')}</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">{t('run_detail.metric_average_pace')}</span>
              <span className="metric-value">{distKm && movingSec ? formatPace(distKm, movingSec, lang) : '--'}</span>
              <span className="metric-subtext">{t('run_detail.metric_average_pace_note')}</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">{t('run_detail.metric_route_shape')}</span>
              <span className="metric-value">{insights?.routeShape || '--'}</span>
              <span className="metric-subtext">{t('run_detail.metric_route_shape_note')}</span>
            </article>
          </div>
        </section>

        {/* Shoe Section */}
        <section className="shoe-run-section">
          <span className="shoe-run-label">{t('run_detail.shoe')}</span>
          {run.shoeId ? (
            <div className="shoe-run-linked">
              <span className="shoe-run-name">{run.shoeName}</span>
              <button type="button" className="shoe-run-btn" onClick={() => setShoeDropdownOpen(!shoeDropdownOpen)}>{t('run_detail.change_shoe')}</button>
              <button type="button" className="shoe-run-btn shoe-run-unlink" onClick={() => assignShoe(0)}>{t('run_detail.unlink_shoe')}</button>
            </div>
          ) : (
            <div className="shoe-run-linked">
              <span className="shoe-run-empty">{t('run_detail.no_shoe')}</span>
              <button type="button" className="shoe-run-btn" onClick={() => setShoeDropdownOpen(!shoeDropdownOpen)}>{t('run_detail.link_shoe')}</button>
            </div>
          )}
          {shoeDropdownOpen && shoes.length > 0 && (
            <div className="shoe-run-dropdown">
              {shoes.filter(s => !s.retired).map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`shoe-run-option${s.id === run.shoeId ? ' active' : ''}`}
                  onClick={() => assignShoe(s.id)}
                >
                  {[s.brand, s.model].filter(Boolean).join(' ') || s.nickname || '—'}
                  {s.isPrimary && ' ★'}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Stats Grid */}
        <section className="section-grid">
          <article className="section-card">
            <h2>{t('run_detail.performance_metrics')}</h2>
            <div className="stats-table">
              {performanceRows.map(([label, value], i) => (
                <div key={i} className="stats-row"><span>{label}</span><span>{value}</span></div>
              ))}
            </div>
          </article>
          <article className="section-card">
            <h2>{t('run_detail.route_intelligence')}</h2>
            <div className="stats-table">
              {routeRows.map(([label, value], i) => (
                <div key={i} className="stats-row"><span>{label}</span><span>{value}</span></div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

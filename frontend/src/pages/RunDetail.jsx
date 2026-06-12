import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import { formatDuration, formatLongDate, formatPace, formatPaceSeconds } from '../utils/format';
import { formatShoeDisplayName } from '../utils/shoeNames';
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'leaflet/dist/leaflet.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler);

function readSelectedRunFromSession(expectedId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('hermes_selected_run');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (expectedId != null && String(parsed.id) !== String(expectedId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function haversineMeters([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyRoute(distanceKm, gapM) {
  if (!distanceKm || distanceKm <= 0) return 'unknown';
  if (gapM <= Math.max(120, distanceKm * 40)) return 'loop';
  if (gapM <= distanceKm * 160) return 'out_and_back';
  return 'point_to_point';
}

function buildInsights(points) {
  if (!points.length) {
    return {
      pointCount: 0,
      computedDistanceKm: null,
      startFinishGapMeters: null,
      boundingSpanKm: null,
      efficiency: null,
      routeShapeKey: 'none',
      centerPoint: null,
      centerLabel: null,
    };
  }
  let dist = 0;
  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    dist += haversineMeters(points[i - 1], points[i]);
    minLat = Math.min(minLat, points[i][0]);
    maxLat = Math.max(maxLat, points[i][0]);
    minLng = Math.min(minLng, points[i][1]);
    maxLng = Math.max(maxLng, points[i][1]);
  }
  const center = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  const gap = haversineMeters(points[0], points[points.length - 1]);
  const span = haversineMeters([minLat, minLng], [maxLat, maxLng]);
  const distKm = dist / 1000;
  return {
    pointCount: points.length,
    computedDistanceKm: distKm,
    startFinishGapMeters: gap,
    boundingSpanKm: span / 1000,
    efficiency: dist > 0 ? span / dist : null,
    routeShapeKey: classifyRoute(distKm, gap),
    centerPoint: center,
    centerLabel: `${center[0].toFixed(4)}, ${center[1].toFixed(4)}`,
  };
}

function formatLapElevation(lap) {
  const raw = lap?.elevationGainMeters ?? lap?.elevationGain ?? lap?.elevationDeltaMeters;
  const value = Number(raw);
  if (!Number.isFinite(value)) return '--';
  return `${value > 0 ? '+' : ''}${value.toFixed(0)} m`;
}

export default function RunDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();

  const [run, setRun] = useState(() => readSelectedRunFromSession(id));
  const [isBootstrappingRun, setIsBootstrappingRun] = useState(true);
  const [points, setPoints] = useState([]);
  const [insights, setInsights] = useState(null);
  const [syncBtnText, setSyncBtnText] = useState('');
  const [syncDisabled, setSyncDisabled] = useState(false);
  const [shoes, setShoes] = useState([]);
  const [shoeDropdownOpen, setShoeDropdownOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [elevationStatus, setElevationStatus] = useState(null);
  const [recalibratingElevation, setRecalibratingElevation] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [showAllSplits, setShowAllSplits] = useState(false);
  const [recentRuns, setRecentRuns] = useState([]);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  function getRouteShapeLabel(shapeKey) {
    switch (shapeKey) {
      case 'loop':
        return t('run_detail.route_shape_loop');
      case 'out_and_back':
        return t('run_detail.route_shape_out_and_back');
      case 'point_to_point':
        return t('run_detail.route_shape_point_to_point');
      case 'none':
        return t('run_detail.route_shape_none');
      default:
        return t('run_detail.route_shape_unknown');
    }
  }

  useEffect(() => {
    const cachedRun = readSelectedRunFromSession(id);
    if (cachedRun) {
      setRun(cachedRun);
      setIsBootstrappingRun(false);
      return;
    }

    if (!isAuthenticated || !id) {
      setRun(null);
      setIsBootstrappingRun(false);
      return;
    }

    let cancelled = false;

    async function bootstrapRunFromActivities() {
      setIsBootstrappingRun(true);
      try {
        const activities = await apiJson('/api/activities');
        if (cancelled) return;
        const matchedRun = Array.isArray(activities)
          ? activities.find((activity) => String(activity?.id) === String(id))
          : null;
        setRun(matchedRun || null);
        if (matchedRun && typeof window !== 'undefined') {
          sessionStorage.setItem('hermes_selected_run', JSON.stringify(matchedRun));
        }
      } catch {
        if (!cancelled) {
          setRun(null);
        }
      } finally {
        if (!cancelled) {
          setIsBootstrappingRun(false);
        }
      }
    }

    bootstrapRunFromActivities();

    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiJson('/api/shoes').then((data) => setShoes(Array.isArray(data) ? data : [])).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    apiJson('/api/activities').then((data) => {
      if (Array.isArray(data)) {
        setRecentRuns(data.filter((r) => r.distanceKm > 0 && r.movingTimeSeconds > 0 && String(r.id) !== String(id)));
      }
    }).catch(() => {});
  }, [isAuthenticated, id]);

  async function assignShoe(shoeId) {
    if (!run?.id) return;
    try {
      await apiFetch(`/api/shoes/${shoeId}/assign/${run.id}`, { method: 'PATCH' });
      setRun((prev) => ({
        ...prev,
        shoeId: shoeId === 0 ? null : shoeId,
        shoeName: shoeId === 0 ? null : (() => {
          const shoe = shoes.find((item) => item.id === shoeId);
          return shoe
            ? formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang })
            : null;
        })(),
      }));
      setShoeDropdownOpen(false);
    } catch {
      // ignored
    }
  }

  useEffect(() => {
    if (!run?.id || !isAuthenticated) return;
    async function fetchPoints() {
      try {
        const [res, analyticsRes, elevStatusRes] = await Promise.all([
          apiFetch(`/api/activities/${run.id}/points`),
          apiFetch(`/api/activities/${run.id}/analytics`),
          apiFetch(`/api/activities/${run.id}/elevation/status`),
        ]);
        if (!res.ok) return;
        const data = await res.json();
        const pts = Array.isArray(data)
          ? data.map((p) => [Number(p.latitude), Number(p.longitude)]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
          : [];
        setPoints(pts);
        setInsights(buildInsights(pts));
        if (analyticsRes.ok) {
          const payload = await analyticsRes.json();
          setAnalytics(payload && typeof payload === 'object' ? payload : null);
        }
        if (elevStatusRes.ok) {
          const payload = await elevStatusRes.json();
          setElevationStatus(payload && typeof payload === 'object' ? payload : null);
        }
      } catch {
        // ignored
      }
    }
    fetchPoints();
  }, [run, isAuthenticated]);

  async function handleElevationRecalibration() {
    if (!run?.id || recalibratingElevation) return;
    setRecalibratingElevation(true);
    try {
      const res = await apiFetch(`/api/activities/${run.id}/elevation/recalibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: points.map(([latitude, longitude]) => ({ latitude, longitude })) }),
      });
      if (!res.ok) return;
      const [analyticsRes, statusRes] = await Promise.all([
        apiFetch(`/api/activities/${run.id}/analytics`),
        apiFetch(`/api/activities/${run.id}/elevation/status`),
      ]);
      if (analyticsRes.ok) {
        const payload = await analyticsRes.json();
        setAnalytics(payload && typeof payload === 'object' ? payload : null);
      }
      if (statusRes.ok) {
        const payload = await statusRes.json();
        setElevationStatus(payload && typeof payload === 'object' ? payload : null);
      }
    } finally {
      setRecalibratingElevation(false);
    }
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !insights) return;
    if (!points.length) return;

    import('leaflet').then((L) => {
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true, dragging: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const line = L.polyline(points, { color: '#f07561', weight: 4, opacity: 0.92 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });

      L.circleMarker(points[0], { radius: 6, color: '#121212', fillColor: '#121212', fillOpacity: 1, weight: 2 })
        .bindTooltip(t('run_detail.start')).addTo(map);
      L.circleMarker(points[points.length - 1], { radius: 7, color: '#f49787', fillColor: '#f49787', fillOpacity: 1 })
        .bindTooltip(t('run_detail.finish')).addTo(map);

      if (insights.centerPoint) {
        L.circleMarker(insights.centerPoint, { radius: 5, color: '#fce6de', fillColor: '#fce6de', fillOpacity: 0.95 })
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
  }, [insights, points, t]);

  const distKm = useMemo(() => {
    if (!run) return null;
    const direct = Number(run.distanceKm || 0);
    if (direct > 0) return direct;
    if (run.distanceMeters > 0) return run.distanceMeters / 1000;
    return insights?.computedDistanceKm;
  }, [run, insights]);

  const movingSec = useMemo(() => {
    if (!run) return null;
    const moving = Number(run.movingTimeSeconds || 0);
    if (moving > 0) return moving;
    const duration = Number(run.durationSeconds || 0);
    return duration > 0 ? duration : null;
  }, [run]);

  const lapRows = useMemo(() => (Array.isArray(analytics?.laps) ? analytics.laps : []), [analytics]);

  const hrChartData = useMemo(() => {
    const source = lapRows
      .map((lap, index) => ({ index, label: `${lap.distanceKm ? `${lap.distanceKm.toFixed(1)} km` : `#${lap.lapIndex || index + 1}`}`, hr: Number(lap.averageHeartRate || 0) }))
      .filter((point) => point.hr > 0);
    if (source.length < 2) return null;
    return {
      labels: source.map((p) => p.label),
      datasets: [
        {
          label: t('run_detail.average_hr'),
          data: source.map((p) => p.hr),
          borderColor: '#f49787',
          backgroundColor: 'rgba(240, 117, 97, 0.18)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#f49787',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          borderWidth: 2.5,
        },
      ],
    };
  }, [lapRows, t]);

  const hrChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(18, 18, 18, 0.92)',
        titleColor: '#fce6de',
        bodyColor: '#e1e1e1',
        cornerRadius: 10,
        padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} bpm`,
        },
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
        min: Math.max(0, Math.min(...(hrChartData?.datasets?.[0]?.data || [0])) - 15),
        max: Math.max(...(hrChartData?.datasets?.[0]?.data || [0])) + 15,
      },
    },
  }), [hrChartData]);

  const hasHrData = hrChartData && hrChartData.datasets[0].data.length >= 2;

  const lapElevationGains = useMemo(() => {
    const profile = analytics?.elevationProfile;
    if (!Array.isArray(profile) || profile.length < 2) return null;
    if (!lapRows.length) return null;
    return lapRows.map((lap) => {
      const startKm = ((lap.lapIndex || 1) - 1) * (lap.distanceKm || 1);
      const endKm = startKm + (lap.distanceKm || 1);
      let gain = 0;
      for (let i = 1; i < profile.length; i++) {
        const prev = profile[i - 1];
        const curr = profile[i];
        if (curr.distanceKm >= startKm && curr.distanceKm <= endKm) {
          const delta = (curr.elevationMeters || 0) - (prev.elevationMeters || 0);
          if (delta > 0) gain += delta;
        }
      }
      return gain > 0 ? gain : null;
    });
  }, [analytics?.elevationProfile, lapRows]);

  const runComparison = useMemo(() => {
    if (!run || !recentRuns.length) return null;
    const distKm = run.distanceKm > 0 ? run.distanceKm : (run.distanceMeters > 0 ? run.distanceMeters / 1000 : null);
    const movingSec = run.movingTimeSeconds > 0 ? run.movingTimeSeconds : null;
    if (!distKm || !movingSec) return null;
    const thisPace = movingSec / distKm;
    const windowSizes = [5, 10, 20];
    let bestWindow = null;
    for (const window of windowSizes) {
      const comparable = recentRuns
        .filter((r) => r.distanceKm > 0 && r.movingTimeSeconds > 0)
        .sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0))
        .slice(0, window);
      if (comparable.length < 2) continue;
      const avgPace = comparable.reduce((sum, r) => sum + (r.movingTimeSeconds / r.distanceKm), 0) / comparable.length;
      const pctDiff = ((avgPace - thisPace) / avgPace) * 100;
      bestWindow = { window, count: comparable.length, recentAvgPace: avgPace, pctDiff };
      break;
    }
    if (!bestWindow) return null;
    let direction;
    if (Math.abs(bestWindow.pctDiff) < 1.5) direction = 'same';
    else if (bestWindow.pctDiff > 0) direction = 'faster';
    else direction = 'slower';
    return {
      ...bestWindow,
      direction,
      absPct: Math.abs(bestWindow.pctDiff).toFixed(1),
      recentRuns: bestWindow.count,
      paceTrend: direction === 'faster' ? 'improving' : direction === 'slower' ? 'declining' : 'stable',
    };
  }, [run, recentRuns]);

  const elevationPoints = useMemo(() => {
    const profile = analytics?.elevationProfile;
    if (!Array.isArray(profile) || profile.length < 2) return null;
    const xs = profile.map((p) => Number(p.distanceKm || 0));
    const ys = profile.map((p) => Number(p.elevationMeters || 0));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = 640;
    const height = 180;
    const pad = 16;
    const spanX = Math.max(1e-9, maxX - minX);
    const spanY = Math.max(1e-9, maxY - minY);
    const path = profile.map((p, index) => {
      const x = pad + ((p.distanceKm - minX) / spanX) * (width - pad * 2);
      const y = height - pad - ((p.elevationMeters - minY) / spanY) * (height - pad * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    return { path, minY, maxY };
  }, [analytics]);

  async function handleResync() {
    setSyncDisabled(true);
    setSyncBtnText(t('run_detail.syncing'));
    try {
      const res = await apiFetch('/api/strava/sync');
      setSyncBtnText(res.ok ? t('run_detail.sync_started') : t('run_detail.sync_failed'));
    } catch {
      setSyncBtnText(t('run_detail.sync_failed'));
    }
    window.setTimeout(() => {
      setSyncDisabled(false);
      setSyncBtnText('');
    }, 3200);
  }

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({
          title: run?.name || t('run_detail.detail_title'),
          text: t('run_detail.share_summary'),
          url,
        });
      } else if (navigator.clipboard?.writeText && url) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('share-unavailable');
      }
      setShareFeedback(t('run_detail.share_success'));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setShareFeedback(t('run_detail.share_failed'));
    }
    window.setTimeout(() => setShareFeedback(''), 2600);
  }

  if (isBootstrappingRun) {
    return (
      <div className="run-detail-page run-detail-profile-cockpit">
        <div className="run-detail-loading-card" aria-live="polite">
          <span className="run-detail-loading-kicker">{t('run_detail.hero_eyebrow')}</span>
          <h1>{t('run_detail.loading_summary')}</h1>
          <div className="run-detail-loading-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="run-detail-page run-detail-profile-cockpit">
        <div className="empty-state run-detail-empty-state" style={{ width: 'min(100%, 860px)', margin: '80px auto 0', padding: '42px 32px', borderRadius: 28, textAlign: 'center' }}>
          <h1>{t('run_detail.no_run_selected')}</h1>
          <p><Link to="/runs">{t('run_detail.back_to_runs')}</Link> {t('run_detail.no_run_selected_copy')}</p>
        </div>
      </div>
    );
  }

  const dateText = formatLongDate(run.startTime || run.startDate, lang);
  const startDate = new Date(run.startTime || run.startDate || 0);
  const metaSeparator = t('run_detail.meta_separator');
  const distanceUnitLabel = t('run_detail.unit_km');
  const paceUnitLabel = t('run_detail.unit_pace');
  const speedUnitLabel = t('run_detail.unit_kmh');
  const heartRateUnitLabel = t('run_detail.unit_bpm');
  const cadenceUnitLabel = t('run_detail.unit_spm');
  const powerUnitLabel = t('run_detail.unit_watt');
  const caloriesUnitLabel = t('run_detail.unit_kcal');
  const elevationUnitLabel = t('run_detail.unit_meter');
  const timeText = Number.isNaN(startDate.getTime())
    ? null
    : startDate.toLocaleTimeString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { hour: 'numeric', minute: '2-digit' });
  const heroMetaText = [
    dateText,
    timeText,
    run.locationCity || run.city || run.locationName || run.location || insights?.centerLabel,
  ].filter(Boolean).join(metaSeparator) || t('run_detail.imported_activity');

  const performanceRows = [
    [t('run_detail.perf_distance'), distKm != null ? `${distKm.toFixed(2)} ${distanceUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.perf_moving_time'), movingSec ? formatDuration(movingSec) : t('run_detail.not_available')],
    [t('run_detail.perf_average_pace'), distKm && movingSec ? formatPace(distKm, movingSec, lang) : t('run_detail.not_available')],
    [t('run_detail.perf_max_speed'), run.maxSpeedMps != null ? `${(run.maxSpeedMps * 3.6).toFixed(1)} ${speedUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.perf_average_heart_rate'), run.averageHeartRate != null ? `${Math.round(run.averageHeartRate)} ${heartRateUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.perf_max_heart_rate'), run.maxHeartRate != null ? `${Math.round(run.maxHeartRate)} ${heartRateUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.perf_average_cadence'), run.averageCadence != null ? `${Math.round(run.averageCadence)} ${cadenceUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.perf_average_power'), run.averageWatts != null ? `${Math.round(run.averageWatts)} ${powerUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.perf_calories'), run.calories != null ? `${run.calories} ${caloriesUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.perf_elevation_gain'), run.totalElevationGain != null ? `${Math.round(run.totalElevationGain)} ${elevationUnitLabel}` : t('run_detail.not_available')],
  ];

  const routeRows = insights ? [
    [t('run_detail.route_gps_samples'), insights.pointCount ? insights.pointCount.toLocaleString() : t('run_detail.no_route_data')],
    [t('run_detail.route_gps_distance'), insights.computedDistanceKm != null ? `${insights.computedDistanceKm.toFixed(2)} ${distanceUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.route_start_finish_gap'), insights.startFinishGapMeters != null ? `${Math.round(insights.startFinishGapMeters)} ${elevationUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.route_bounding_span'), insights.boundingSpanKm != null ? `${insights.boundingSpanKm.toFixed(2)} ${distanceUnitLabel}` : t('run_detail.not_available')],
    [t('run_detail.route_shape'), getRouteShapeLabel(insights.routeShapeKey)],
    [t('run_detail.route_efficiency'), insights.efficiency != null ? `${Math.round(insights.efficiency * 100)}%` : t('run_detail.not_available')],
    [t('run_detail.route_center'), insights.centerLabel || t('run_detail.not_available')],
    [t('run_detail.route_source_file'), run.sourceFileName || t('run_detail.not_available')],
  ] : [];

  const linkedShoe = run?.shoeId ? shoes.find((shoe) => shoe.id === run.shoeId) : null;
  const linkedShoeName = run?.shoeName
    || (linkedShoe
      ? formatShoeDisplayName({ brand: linkedShoe.brand, model: linkedShoe.model, nickname: linkedShoe.nickname, lang })
      : null);
  const linkedShoeMileage = linkedShoe?.currentDistanceKm != null
    ? `${linkedShoe.currentDistanceKm.toFixed(0)} ${distanceUnitLabel}`
    : null;
  const linkedShoeUsage = linkedShoe?.maxDistanceKm > 0 && linkedShoe?.currentDistanceKm >= 0
    ? Math.min(100, (linkedShoe.currentDistanceKm / linkedShoe.maxDistanceKm) * 100)
    : null;

  const visibleLapRows = showAllSplits ? lapRows : lapRows.slice(0, 5);
  const fastestVisibleLapIndex = visibleLapRows.reduce((bestIndex, lap, index, source) => {
    if (!lap?.pace) return bestIndex;
    if (bestIndex === -1) return index;
    return String(lap.pace) < String(source[bestIndex]?.pace || '') ? index : bestIndex;
  }, -1);

  const distanceValue = distKm != null ? distKm.toFixed(2) : '--';
  const paceValue = distKm && movingSec ? formatPace(distKm, movingSec, lang) : '--';
  const paceMetricValue = distKm && movingSec ? formatPaceSeconds(movingSec / distKm) : '--';
  const timeValue = movingSec ? formatDuration(movingSec) : '--';
  const cadenceValue = analytics?.averageCadence || run.averageCadence;
  const strideLengthValue = analytics?.averageStrideLengthMeters;
  const powerValue = run.averageWatts;

  return (
    <div className="run-detail-page run-detail-profile-cockpit">
      <div className="run-detail-topbar">
        <div className="run-detail-topbar-left">
          <Link to="/runs" className="run-detail-icon-btn" aria-label={t('run_detail.back_to_runs')}>
            <span aria-hidden="true">&larr;</span>
          </Link>
          <div className="run-detail-heading">
            <h1>{run.name || t('run_detail.detail_title')}</h1>
            <p>{heroMetaText}</p>
          </div>
        </div>
        <div className="run-detail-topbar-actions">
          <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
            {run.provider && <div className="run-detail-provider-pill">{run.provider}</div>}
            {run.provider === 'STRAVA' && (
              <button className="run-detail-action-btn" disabled={syncDisabled} onClick={handleResync}>
                {syncBtnText || t('run_detail.resync_strava')}
              </button>
            )}
            <button type="button" className="run-detail-icon-btn is-text" onClick={handleShare} aria-label={t('run_detail.share')}>
              <span>{shareFeedback || t('run_detail.share')}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="run-detail-shell">
        <section className="run-detail-hero-grid run-detail-profile-hero">
          <div className="run-detail-map-card run-detail-profile-map">
            {points.length > 0 ? (
              <div ref={mapRef} id="route-map" style={{ width: '100%', height: '100%' }} />
            ) : (
              <div className="run-detail-no-map">{t('run_detail.no_map')}</div>
            )}
            <div className="run-detail-map-overlay">
              <span>{t('run_detail.metric_distance')}</span>
              <strong>{distanceValue} {distanceUnitLabel}</strong>
            </div>
          </div>
          <div className="run-detail-stat-rail run-detail-profile-stat-rail">
            <article className="run-detail-stat-card is-accent">
              <span>{t('run_detail.metric_distance')}</span>
              <strong>{distanceValue}<em>{distanceUnitLabel}</em></strong>
            </article>
            <article className="run-detail-stat-card">
              <span>{t('run_detail.metric_average_pace')}</span>
              <strong>{paceMetricValue}{paceMetricValue !== '--' ? <em>{paceUnitLabel}</em> : null}</strong>
            </article>
            <article className="run-detail-stat-card">
              <span>{t('run_detail.metric_moving_time')}</span>
              <strong>{timeValue}</strong>
            </article>
          </div>
        </section>

        <section className="run-detail-main-grid">
          <div className="run-detail-primary-column">
            {analytics?.debrief && (
              <section className="run-detail-section run-detail-debrief-section">
                <h2>{t('run_detail.coach_debrief_title')}</h2>
                <div className="run-detail-panel run-detail-debrief-panel">
                  <div className="run-detail-debrief-header">
                    <div className="run-detail-debrief-readiness">
                      <span>{t('run_detail.pre_run_readiness')}</span>
                      <strong>{analytics.debrief.readinessScore}%</strong>
                    </div>
                    <AppIcon name="coach_voice" className="run-detail-debrief-icon" />
                  </div>
                  <div className="run-detail-debrief-content">
                    <p className="run-detail-debrief-interpretation">{analytics.debrief.interpretation}</p>
                    <div className="run-detail-debrief-guidance">
                      <span className="run-detail-debrief-guidance-label">{t('run_detail.next_day_guidance')}</span>
                      <p>{analytics.debrief.nextDayGuidance}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {runComparison && (
              <section className="run-detail-section run-detail-comparison-section">
                <h2>{t('run_detail.run_comparison_title')}</h2>
                <div className="run-detail-panel run-detail-comparison-panel">
                  <div className="run-detail-comparison-signal">
                    <span className={`run-detail-comparison-arrow run-detail-comparison-arrow--${runComparison.direction}`} aria-hidden="true">
                      {runComparison.direction === 'faster' ? '↑' : runComparison.direction === 'slower' ? '↓' : '→'}
                    </span>
                    <div>
                      <strong>
                        {runComparison.direction === 'faster'
                          ? t('run_detail.run_comparison_faster', { percent: runComparison.absPct, window: `${runComparison.recentRuns}-run` })
                          : runComparison.direction === 'slower'
                            ? t('run_detail.run_comparison_slower', { percent: runComparison.absPct, window: `${runComparison.recentRuns}-run` })
                            : t('run_detail.run_comparison_same', { window: `${runComparison.recentRuns}-run` })}
                      </strong>
                      <p>
                        {runComparison.paceTrend === 'improving' ? t('run_detail.run_comparison_improving')
                          : runComparison.paceTrend === 'declining' ? t('run_detail.run_comparison_declining')
                            : t('run_detail.run_comparison_stable')}
                        {' '}{t('run_detail.run_comparison_basis', { count: runComparison.recentRuns })}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="run-detail-section">
              <h2>{t('run_detail.physiological_response')}</h2>
              <div className="run-detail-panel">
                <div className="run-detail-panel-head">
                  <div>
                    <span>{t('run_detail.average_hr')}</span>
                    <strong>{run.averageHeartRate != null ? Math.round(run.averageHeartRate) : '--'} <em>{heartRateUnitLabel}</em></strong>
                  </div>
                  <div className="is-right">
                    <span>{t('run_detail.max_hr')}</span>
                    <strong>{run.maxHeartRate != null ? Math.round(run.maxHeartRate) : '--'} <em>{heartRateUnitLabel}</em></strong>
                  </div>
                </div>
                <div className="run-detail-hr-chart" style={lapRows.length > 8 ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } : undefined}>
                  <div className="run-detail-hr-zones">
                    <span>Z5</span>
                    <span>Z4</span>
                    <span>Z3</span>
                    <span>Z2</span>
                    <span>Z1</span>
                  </div>
                  {hasHrData ? (
                    <div className="run-detail-hr-chart-canvas" style={{ minWidth: Math.max(100, lapRows.length * 48), height: 180 }}>
                      <Line data={hrChartData} options={hrChartOptions} />
                    </div>
                  ) : (
                    <div className="run-detail-chart-empty">{t('run_detail.no_heart_rate_data')}</div>
                  )}
                </div>
                <div className="run-detail-chip-row">
                  <span className="run-detail-chip">
                    {t('run_detail.decoupling')}: {analytics?.cardiacDrift ? `${analytics.cardiacDrift.driftPercent.toFixed(2)}%` : '--'}
                  </span>
                  <span className="run-detail-chip">
                    {t('run_detail.first_half')}: {analytics?.cardiacDrift ? analytics.cardiacDrift.firstHalfPace : '--'}
                  </span>
                  <span className="run-detail-chip">
                    {t('run_detail.second_half')}: {analytics?.cardiacDrift ? analytics.cardiacDrift.secondHalfPace : '--'}
                  </span>
                </div>
              </div>
            </section>

            <section className="run-detail-section">
              <div className="run-detail-section-head">
                <h2>{t('run_detail.splits')}</h2>
                {lapRows.length > 5 && (
                  <button type="button" className="run-detail-link-btn" onClick={() => setShowAllSplits((prev) => !prev)}>
                    {showAllSplits ? t('run_detail.show_less') : t('run_detail.view_all')}
                  </button>
                )}
              </div>
              <div className="run-detail-panel run-detail-table-panel">
                <table className="run-detail-splits-table">
                  <thead>
                    <tr>
                      <th>{t('run_detail.split_unit')}</th>
                      <th>{t('run_detail.split_pace')}</th>
                      <th>{t('run_detail.split_elev')}</th>
                      <th>{t('run_detail.split_hr')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLapRows.length > 0 ? visibleLapRows.map((lap, index) => {
                      const lapGain = lapElevationGains ? lapElevationGains[index] : null;
                      return (
                        <tr key={`lap-${lap.lapIndex || index}`} className={index === fastestVisibleLapIndex ? 'is-highlight' : ''}>
                          <td>{lap.distanceKm ? `${lap.distanceKm.toFixed(1)} ${distanceUnitLabel}` : `#${lap.lapIndex || index + 1}`}</td>
                          <td>{lap.pace || '--'}</td>
                          <td>{lapGain != null ? `+${Math.round(lapGain)} ${elevationUnitLabel}` : formatLapElevation(lap)}</td>
                          <td>{lap.averageHeartRate ? Math.round(lap.averageHeartRate) : '--'}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="4" className="is-empty">{t('run_detail.no_lap_data')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="run-detail-side-column">
            <section className="run-detail-panel run-detail-efficiency-panel">
              <h3>{t('run_detail.efficiency')}</h3>
              <div className="run-detail-side-metric">
                <span>{t('run_detail.cadence')}</span>
                <strong>{cadenceValue ? Math.round(cadenceValue) : '--'} <em>{cadenceUnitLabel}</em></strong>
              </div>
              <div className="run-detail-divider" />
              <div className="run-detail-side-metric">
                <span>{t('run_detail.stride_length')}</span>
                <strong>{strideLengthValue ? strideLengthValue.toFixed(2) : '--'} <em>{elevationUnitLabel}</em></strong>
              </div>
              <div className="run-detail-divider" />
              <div className="run-detail-side-metric">
                <span>{t('run_detail.running_power')}</span>
                <strong>{powerValue ? Math.round(powerValue) : '--'} <em>{powerUnitLabel}</em></strong>
              </div>
            </section>

            <section className="run-detail-panel run-detail-gear-panel">
              <span className="run-detail-panel-label">{t('run_detail.gear_linked')}</span>
              <div className="run-detail-gear-row">
                <div className="run-detail-gear-art">
                  {linkedShoe?.photoUrl ? (
                    <img src={linkedShoe.photoUrl} alt={linkedShoeName || t('run_detail.shoe')} />
                  ) : (
                    <div className="run-detail-gear-placeholder">H</div>
                  )}
                </div>
                <div className="run-detail-gear-copy">
                  <strong>{linkedShoeName || t('run_detail.no_shoe')}</strong>
                  <span>{linkedShoeMileage ? t('run_detail.linked_shoe_mileage', { mileage: linkedShoeMileage }) : t('run_detail.no_shoe')}</span>
                  {linkedShoeUsage != null && (
                    <div className="run-detail-gear-usage">
                      <div style={{ width: `${linkedShoeUsage}%` }} />
                    </div>
                  )}
                </div>
              </div>
              <div className="run-detail-gear-actions">
                <button type="button" className="run-detail-link-btn" onClick={() => setShoeDropdownOpen((prev) => !prev)}>
                  {run.shoeId ? t('run_detail.change_shoe') : t('run_detail.link_shoe')}
                </button>
                {run.shoeId && (
                  <button type="button" className="run-detail-link-btn is-danger" onClick={() => assignShoe(0)}>
                    {t('run_detail.unlink_shoe')}
                  </button>
                )}
              </div>
              {shoeDropdownOpen && shoes.length > 0 && (
                <div className="shoe-run-dropdown run-detail-dropdown">
                  {shoes.filter((shoe) => !shoe.retired).map((shoe) => (
                    <button
                      key={shoe.id}
                      type="button"
                      className={`shoe-run-option${shoe.id === run.shoeId ? ' active' : ''}`}
                      onClick={() => assignShoe(shoe.id)}
                    >
                      {formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang })}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="run-detail-panel">
              <h3>{t('run_detail.route_intelligence')}</h3>
              <div className="run-detail-info-list">
                <div><span>{t('run_detail.metric_route_shape')}</span><strong>{insights ? getRouteShapeLabel(insights.routeShapeKey) : '--'}</strong></div>
                <div><span>{t('run_detail.route_gps_samples')}</span><strong>{insights?.pointCount ? insights.pointCount.toLocaleString() : '--'}</strong></div>
                <div><span>{t('run_detail.perf_elevation_gain')}</span><strong>{run.totalElevationGain != null ? `${Math.round(run.totalElevationGain)} ${elevationUnitLabel}` : '--'}</strong></div>
              </div>
              {elevationStatus?.flagged && (
                <div className="run-detail-warning">
                  <p>{t('run_detail.elevation_warning')}</p>
                  <button type="button" className="run-detail-link-btn" disabled={recalibratingElevation} onClick={handleElevationRecalibration}>
                    {recalibratingElevation ? t('run_detail.recalibrating') : t('run_detail.recalibrate')}
                  </button>
                </div>
              )}
            </section>
          </aside>
        </section>

        <section className="run-detail-bottom-grid">
          <article className="run-detail-panel">
            <h3>{t('run_detail.performance_metrics')}</h3>
            <div className="run-detail-stat-list">
              {performanceRows.map(([label, value], index) => (
                <div key={`${label}-${index}`}><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
          </article>
          <article className="run-detail-panel">
            <h3>{t('run_detail.elevation_profile')}</h3>
            {elevationPoints ? (
              <>
                <svg viewBox="0 0 640 180" className="run-detail-elevation-graph" aria-hidden="true">
                  <path d={elevationPoints.path} fill="none" stroke="#f49787" strokeWidth="2.5" />
                </svg>
                <div className="run-detail-info-list">
                  <div>
                    <span>{t('run_detail.min_max_elevation')}</span>
                    <strong>{elevationPoints.minY.toFixed(1)} {elevationUnitLabel} / {elevationPoints.maxY.toFixed(1)} {elevationUnitLabel}</strong>
                  </div>
                  <div>
                    <span>{t('run_detail.route_efficiency')}</span>
                    <strong>{insights?.efficiency != null ? `${Math.round(insights.efficiency * 100)}%` : '--'}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="run-detail-chart-empty is-inline">{t('run_detail.no_elevation_stream')}</div>
            )}
          </article>
        </section>

        <section className="run-detail-bottom-grid">
          <article className="run-detail-panel">
            <h3>{t('run_detail.route_intelligence')}</h3>
            <div className="run-detail-stat-list">
              {routeRows.map(([label, value], index) => (
                <div key={`${label}-${index}`}><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
          </article>
          <article className="run-detail-panel">
            <h3>{t('run_detail.analysis_notes')}</h3>
            <div className="run-detail-info-list">
              <div><span>{t('run_detail.metric_average_pace')}</span><strong>{paceValue}</strong></div>
              <div><span>{t('run_detail.metric_moving_time')}</span><strong>{timeValue}</strong></div>
              <div><span>{t('run_detail.route_source_file')}</span><strong>{run.sourceFileName || t('run_detail.not_available')}</strong></div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

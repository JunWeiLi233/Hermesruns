import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { apiFetch, apiJson } from '../../api';
import { waitWhileDocumentHidden } from '../../utils/pageVisibility';
import { cachedApiJson, invalidateResourceCache } from '../../api/resourceCache';
import AppIcon from '../../components/AppIcon';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import FooterNavLinks from '../../components/FooterNavLinks';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import RunsSubpageNav from '../../components/RunsSubpageNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { formatDuration, formatLongDate, formatPaceSeconds } from '../../utils/format';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import { buildRunDetailPath } from '../../utils/runRoute';
import { formatShoeDisplayName } from '../../utils/shoeNames';
import {
  Chart as ChartJS,
  CategoryScale,
  Decimation,
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler, Decimation);

const TELEMETRY_CHART_SAMPLE_INTERVAL_SECONDS = 0.1;
const TELEMETRY_CHART_RENDER_POINT_BUDGET = 12000;
const RUN_DETAIL_STRAVA_SYNC_POLL_INTERVAL_MS = 2000;
const RUN_DETAIL_STRAVA_SYNC_POLL_DEADLINE_MS = 120000;

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

function formatTelemetryInteractionTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '--';
  const total = Math.round(value);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function getTelemetrySamples(series) {
  return Array.isArray(series?.samples)
    ? series.samples
      .map((sample) => ({
        t: Number(sample?.t),
        value: Number(sample?.value),
        distanceKm: sample?.distanceKm == null ? null : Number(sample.distanceKm),
      }))
      .filter((sample) => Number.isFinite(sample.t) && Number.isFinite(sample.value))
    : [];
}

function formatTelemetryValue(value, key) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  if (key === 'strideLength' || key === 'verticalOscillationCm') return numeric.toFixed(2);
  return numeric.toFixed(0);
}

function getTelemetryDisplaySample(samples) {
  return samples[Math.floor(samples.length * 0.66)] || samples[samples.length - 1] || null;
}

function getTelemetryValueBounds(samples) {
  let min = Infinity;
  let max = -Infinity;

  for (const sample of samples) {
    const value = Number(sample?.value);
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : { min: 0, max: 1 };
}

function interpolateTelemetrySample(current, next, targetTime) {
  const span = next.t - current.t;
  if (span <= 0) return { ...next, t: Number(targetTime.toFixed(1)) };
  const ratio = (targetTime - current.t) / span;
  const interpolatedDistance = current.distanceKm != null && next.distanceKm != null
    ? current.distanceKm + (next.distanceKm - current.distanceKm) * ratio
    : ratio < 0.5 ? current.distanceKm : next.distanceKm;

  return {
    t: Number(targetTime.toFixed(1)),
    value: current.value + (next.value - current.value) * ratio,
    distanceKm: interpolatedDistance == null ? null : Number(interpolatedDistance.toFixed(3)),
  };
}

function resampleTelemetrySamples(
  samples,
  intervalSeconds = TELEMETRY_CHART_SAMPLE_INTERVAL_SECONDS,
  maxRenderPoints = TELEMETRY_CHART_RENDER_POINT_BUDGET,
) {
  if (!Array.isArray(samples) || samples.length < 2) return samples;
  const sortedSamples = [...samples].sort((a, b) => a.t - b.t);
  const first = sortedSamples[0];
  const last = sortedSamples[sortedSamples.length - 1];
  if (!Number.isFinite(first?.t) || !Number.isFinite(last?.t) || last.t <= first.t) return sortedSamples;

  const ticksPerSecond = Math.round(1 / intervalSeconds);
  const startTick = Math.round(first.t * ticksPerSecond);
  const endTick = Math.round(last.t * ticksPerSecond);
  const totalTicks = endTick - startTick + 1;
  const tickStep = Math.max(1, Math.ceil(totalTicks / Math.max(1, maxRenderPoints)));
  const resampled = [];
  let segmentIndex = 0;

  for (let tick = startTick; tick <= endTick; tick += tickStep) {
    const targetTime = tick / ticksPerSecond;
    while (segmentIndex < sortedSamples.length - 2 && sortedSamples[segmentIndex + 1].t < targetTime) {
      segmentIndex += 1;
    }
    const current = sortedSamples[segmentIndex];
    const next = sortedSamples[Math.min(segmentIndex + 1, sortedSamples.length - 1)];
    resampled.push(interpolateTelemetrySample(current, next, targetTime));
  }

  const lastRenderedTime = resampled[resampled.length - 1]?.t;
  const endTime = endTick / ticksPerSecond;
  if (lastRenderedTime !== endTime) {
    resampled.push(interpolateTelemetrySample(sortedSamples[sortedSamples.length - 2], last, endTime));
  }

  return resampled;
}

export default function RunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [run, setRun] = useState(() => readSelectedRunFromSession(id));
  const [isBootstrappingRun, setIsBootstrappingRun] = useState(true);
  const [points, setPoints] = useState([]);
  const [insights, setInsights] = useState(null);
  const [syncBtnText, setSyncBtnText] = useState('');
  const [syncDisabled, setSyncDisabled] = useState(false);
  const [shoes, setShoes] = useState([]);
  const [shoeDropdownOpen, setShoeDropdownOpen] = useState(false);
  const [assigningShoeId, setAssigningShoeId] = useState(null);
  const [shoeActionMessage, setShoeActionMessage] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [activeTelemetryKey, setActiveTelemetryKey] = useState('heartRate');
  const [selectedTelemetryPoint, setSelectedTelemetryPoint] = useState(null);
  const [elevationStatus, setElevationStatus] = useState(null);
  const [recalibratingElevation, setRecalibratingElevation] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [showAllSplits, setShowAllSplits] = useState(false);
  const [recentRuns, setRecentRuns] = useState([]);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'activities',
  }), [lang, t]);

  useEffect(() => {
    const cachedRun = readSelectedRunFromSession(id);
    if (cachedRun) {
      setRun(cachedRun);
      setIsBootstrappingRun(false);
    }

    if (!isAuthenticated || !id) {
      if (!cachedRun) {
        setRun(null);
      }
      setIsBootstrappingRun(false);
      return;
    }

    let cancelled = false;

    async function bootstrapRunFromActivities() {
      // A cached run paints instantly; the single-activity endpoint (not the
      // full /api/activities history, ~677KB in production) keeps it fresh.
      setIsBootstrappingRun(true);
      try {
        const matchedRun = await apiJson(`/api/activities?id=${id}`);
        if (cancelled) return;
        setRun(matchedRun && typeof matchedRun === 'object' ? matchedRun : null);
        if (matchedRun && typeof window !== 'undefined') {
          sessionStorage.setItem('hermes_selected_run', JSON.stringify(matchedRun));
        } else if (typeof window !== 'undefined') {
          sessionStorage.removeItem('hermes_selected_run');
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
    // /api/shoes stays uncached on purpose: its write sites (Shoes/AddShoes/
    // RunDetail assign/admin flows) cannot all be covered by invalidation.
    apiJson('/api/shoes').then((data) => setShoes(Array.isArray(data) ? data : [])).catch(() => {});
    cachedApiJson('/api/profile/me').then((data) => setProfile(data)).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    // The comparison windows use at most 20 recent runs and the sidebar shows
    // 4, so the most recent 30 feed items replace the full history download
    // (~677KB observed in production) this effect used to make.
    cachedApiJson('/api/activities?limit=30').then((data) => {
      if (Array.isArray(data)) {
        setRecentRuns(data.filter((r) => r.distanceKm > 0 && r.movingTimeSeconds > 0 && String(r.id) !== String(id)));
      }
    }).catch(() => {});
  }, [isAuthenticated, id]);

  async function assignShoe(shoeId) {
    if (!run?.id) {
      setShoeActionMessage(t('run_detail.shoe_assign_no_run'));
      return;
    }
    const normalizedShoeId = Number(shoeId);
    const isUnlinking = normalizedShoeId === 0;
    setAssigningShoeId(normalizedShoeId);
    setShoeActionMessage('');
    try {
      const response = await apiJson(`/api/shoes/${normalizedShoeId}/assign/${run.id}`, { method: 'PATCH' });
      if (response?.activityId != null && String(response.activityId) !== String(run.id)) {
        throw new Error('Activity mismatch');
      }
      // The assignment changed this run's shoeId inside /api/activities.
      invalidateResourceCache('/api/activities');
      const selectedShoe = isUnlinking
        ? null
        : shoes.find((item) => String(item.id) === String(normalizedShoeId));
      const selectedShoeName = selectedShoe
        ? formatShoeDisplayName({ brand: selectedShoe.brand, model: selectedShoe.model, nickname: selectedShoe.nickname, lang })
        : null;
      const nextShoeId = isUnlinking ? null : (response?.shoeId ?? normalizedShoeId);
      const nextShoeName = isUnlinking ? null : (response?.shoeName || selectedShoeName);

      setRun((prev) => {
        if (!prev) return prev;
        const nextRun = {
          ...prev,
          shoeId: nextShoeId,
          shoeName: nextShoeName,
        };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('hermes_selected_run', JSON.stringify(nextRun));
        }
        return nextRun;
      });
      setShoeDropdownOpen(false);
      setShoeActionMessage(isUnlinking
        ? t('run_detail.shoe_unlinked')
        : t('run_detail.shoe_linked', { shoe: nextShoeName || t('run_detail.shoe') }));
    } catch {
      setShoeActionMessage(t('run_detail.shoe_assign_failed'));
    } finally {
      setAssigningShoeId(null);
    }
  }

  useEffect(() => {
    // Key on the run id, not the run object: bootstrap and background
    // refreshes replace the object identity without changing the run, and
    // each replacement re-fetched points/analytics/telemetry/elevation
    // (observed fetching the quartet three times for one run).
    const runId = run?.id;
    if (!runId || !isAuthenticated) return;
    async function fetchPoints() {
      try {
        const [res, analyticsRes, telemetryRes] = await Promise.all([
          apiFetch(`/api/activities/${runId}/points`),
          apiFetch(`/api/activities/${runId}/analytics`),
          apiFetch(`/api/activities/${runId}/telemetry`),
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
        if (telemetryRes.ok) {
          const payload = await telemetryRes.json();
          setTelemetry(payload && typeof payload === 'object' ? payload : null);
        }
      } catch {
        // ignored
      }
    }
    async function fetchElevationStatus() {
      try {
        const elevStatusRes = await apiFetch(`/api/activities/${runId}/elevation/status`);
        if (elevStatusRes.ok) {
          const payload = await elevStatusRes.json();
          setElevationStatus(payload && typeof payload === 'object' ? payload : null);
        }
      } catch {
        // Elevation quality is advisory; it should not block the run detail page.
      }
    }
    fetchPoints();
    fetchElevationStatus();
  }, [run?.id, isAuthenticated]);

  useEffect(() => {
    setSelectedTelemetryPoint(null);
  }, [activeTelemetryKey, telemetry]);

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
      const [analyticsRes, telemetryRes, statusRes] = await Promise.all([
        apiFetch(`/api/activities/${run.id}/analytics`),
        apiFetch(`/api/activities/${run.id}/telemetry`),
        apiFetch(`/api/activities/${run.id}/elevation/status`),
      ]);
      if (analyticsRes.ok) {
        const payload = await analyticsRes.json();
        setAnalytics(payload && typeof payload === 'object' ? payload : null);
      }
      if (telemetryRes.ok) {
        const payload = await telemetryRes.json();
        setTelemetry(payload && typeof payload === 'object' ? payload : null);
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

    let disposed = false;
    let resizeObserver = null;
    let resizeTimeoutId = null;

    import('leaflet').then((L) => {
      if (disposed || !mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true, dragging: true });
      map.on('click', () => setIsMapExpanded((current) => !current));
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const line = L.polyline(points, { color: '#f07561', weight: 4, opacity: 0.92 }).addTo(map);
      const focusRouteAtTop = () => {
        const mapHeight = mapRef.current?.clientHeight || 0;
        if (mapHeight < 64) return;
        map.fitBounds(line.getBounds(), { padding: [32, 32], animate: false });
      };

      L.circleMarker(points[0], { radius: 6, color: '#121212', fillColor: '#121212', fillOpacity: 1, weight: 2 })
        .bindTooltip(t('run_detail.start')).addTo(map);
      L.circleMarker(points[points.length - 1], { radius: 7, color: '#f49787', fillColor: '#f49787', fillOpacity: 1 })
        .bindTooltip(t('run_detail.finish')).addTo(map);

      const resizeMap = () => {
        map.invalidateSize({ pan: false });
        focusRouteAtTop();
      };
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resizeMap);
        resizeObserver.observe(mapRef.current);
      }
      resizeMap();
      resizeTimeoutId = window.setTimeout(resizeMap, 0);
      mapInstanceRef.current = map;
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (resizeTimeoutId != null) window.clearTimeout(resizeTimeoutId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [insights, points, t]);

  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return undefined;
    const frameId = window.requestAnimationFrame(() => {
      mapInstanceRef.current?.invalidateSize({ pan: false });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isMapExpanded]);

  useEffect(() => {
    if (!isMapExpanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMapExpanded(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapExpanded]);

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

  const telemetryDefinitions = useMemo(() => [
    { key: 'heartRate', label: t('run_detail.telemetry_heart_rate'), unit: t('run_detail.unit_bpm'), color: '#b75f4a', fill: 'rgba(183, 95, 74, 0.18)', icon: 'monitor_heart' },
    { key: 'cadence', label: t('run_detail.telemetry_cadence'), unit: t('run_detail.unit_spm'), color: '#54756a', fill: 'rgba(84, 117, 106, 0.16)', icon: 'telemetry_cadence' },
    { key: 'strideLength', label: t('run_detail.telemetry_stride'), unit: t('run_detail.unit_meter'), color: '#9b6c35', fill: 'rgba(155, 108, 53, 0.15)', icon: 'telemetry_stride' },
    { key: 'groundContactTimeMs', label: t('run_detail.ground_contact_time'), unit: 'ms', color: '#7b684b', fill: 'rgba(123, 104, 75, 0.16)', icon: 'telemetry_ground_contact' },
    { key: 'verticalOscillationCm', label: t('run_detail.vertical_oscillation'), unit: 'cm', color: '#7d7565', fill: 'rgba(125, 117, 101, 0.16)', icon: 'telemetry_vertical' },
    { key: 'elevation', label: t('run_detail.telemetry_elevation'), unit: t('run_detail.unit_meter'), color: '#6f6b5e', fill: 'rgba(111, 107, 94, 0.16)', icon: 'telemetry_elevation' },
  ], [t]);
  const telemetryTabDefinitions = useMemo(() => telemetryDefinitions
    .map((definition, index) => {
      const samples = getTelemetrySamples(telemetry?.series?.[definition.key]);
      const displaySample = getTelemetryDisplaySample(samples);
      return {
        ...definition,
        displaySample,
        hasData: Boolean(displaySample),
        sourceIndex: index,
      };
    })
    .sort((a, b) => {
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      return a.sourceIndex - b.sourceIndex;
    }), [telemetry, telemetryDefinitions]);

  const activeTelemetryDefinition = telemetryDefinitions.find((definition) => definition.key === activeTelemetryKey) || telemetryDefinitions[0];
  const activeTelemetrySeries = telemetry?.series?.[activeTelemetryDefinition.key];
  const activeTelemetrySamples = useMemo(
    () => getTelemetrySamples(activeTelemetrySeries),
    [activeTelemetrySeries]
  );
  const activeTelemetryChartSamples = useMemo(
    () => resampleTelemetrySamples(activeTelemetrySamples),
    [activeTelemetrySamples]
  );
  const hasTelemetryData = activeTelemetrySamples.length >= 2;

  const telemetryChartData = useMemo(() => {
    if (!hasTelemetryData) return null;
    return {
      datasets: [
        {
          label: activeTelemetryDefinition.label,
          data: activeTelemetryChartSamples.map((sample) => ({ x: sample.t, y: sample.value })),
          parsing: false,
          normalized: true,
          borderColor: activeTelemetryDefinition.color,
          backgroundColor: activeTelemetryDefinition.fill,
          fill: true,
          tension: 0.22,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: activeTelemetryDefinition.color,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          borderWidth: 2,
        },
      ],
    };
  }, [activeTelemetryChartSamples, activeTelemetryDefinition, hasTelemetryData]);

  const telemetryChartOptions = useMemo(() => {
    const { min, max } = getTelemetryValueBounds(activeTelemetrySamples);
    const pad = Math.max(1, (max - min) * 0.12);
    return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    normalized: true,
    interaction: { intersect: false, mode: 'index' },
    onClick: (_event, elements) => {
      if (!elements?.length) return;
      const sample = activeTelemetryChartSamples[elements[0].index];
      if (sample) setSelectedTelemetryPoint({ ...sample, key: activeTelemetryDefinition.key });
    },
    plugins: {
      decimation: {
        enabled: activeTelemetryChartSamples.length > 2000,
        algorithm: 'lttb',
        samples: 1200,
        threshold: 2000,
      },
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(31, 29, 25, 0.94)',
        titleColor: '#fce6de',
        bodyColor: '#e1e1e1',
        cornerRadius: 10,
        padding: 12,
        callbacks: {
          title: (items) => formatTelemetryInteractionTime(items?.[0]?.parsed?.x),
          label: (ctx) => `${formatTelemetryValue(ctx.parsed.y, activeTelemetryDefinition.key)} ${activeTelemetryDefinition.unit}`,
          afterLabel: (ctx) => {
            const sample = activeTelemetryChartSamples[ctx.dataIndex];
            return sample?.distanceKm != null ? `${sample.distanceKm.toFixed(2)} km` : '';
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        display: false,
      },
      y: {
        display: false,
        min: Math.max(0, min - pad),
        max: max + pad,
      },
    },
  };
  }, [activeTelemetryChartSamples, activeTelemetryDefinition, activeTelemetrySamples]);

  const focusTelemetryPoint = selectedTelemetryPoint?.key === activeTelemetryDefinition.key
    ? selectedTelemetryPoint
    : getTelemetryDisplaySample(activeTelemetrySamples);
  const trainingEffect = telemetry?.trainingEffect && typeof telemetry.trainingEffect === 'object'
    ? telemetry.trainingEffect
    : null;
  const groundContactSamples = getTelemetrySamples(telemetry?.series?.groundContactTimeMs);
  const verticalOscillationSamples = getTelemetrySamples(telemetry?.series?.verticalOscillationCm);
  const latestGroundContact = groundContactSamples[groundContactSamples.length - 1] || null;
  const latestVerticalOscillation = verticalOscillationSamples[verticalOscillationSamples.length - 1] || null;

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

  async function refreshRunFromActivities() {
    if (!isAuthenticated || !id) return null;
    invalidateResourceCache('/api/activities?limit=30');
    try {
      const [matchedRun, activities] = await Promise.all([
        apiJson(`/api/activities?id=${id}`).catch(() => null),
        apiJson('/api/activities?limit=30').catch(() => null),
      ]);
      if (matchedRun && typeof matchedRun === 'object') {
        setRun(matchedRun);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('hermes_selected_run', JSON.stringify(matchedRun));
        }
      }
      if (Array.isArray(activities)) {
        setRecentRuns(activities.filter((activity) => (
          activity.distanceKm > 0
            && activity.movingTimeSeconds > 0
            && String(activity.id) !== String(id)
        )));
      }
      return matchedRun || null;
    } catch {
      return null;
    }
  }

  async function pollRunDetailStravaSyncCompletion() {
    const deadlineMs = Date.now() + RUN_DETAIL_STRAVA_SYNC_POLL_DEADLINE_MS;
    let sawActiveSync = false;

    while (Date.now() < deadlineMs) {
      await waitWhileDocumentHidden();
      let syncStatus;
      try {
        syncStatus = await apiJson('/api/auth/strava/sync-status');
      } catch {
        return null;
      }

      if (syncStatus?.active) sawActiveSync = true;
      const finished = syncStatus?.status === 'COMPLETED'
        || syncStatus?.status === 'FAILED'
        || (sawActiveSync && !syncStatus?.active);

      if (finished) {
        if (syncStatus?.status === 'COMPLETED') {
          await refreshRunFromActivities();
        }
        return syncStatus;
      }

      await new Promise((resolve) => window.setTimeout(resolve, RUN_DETAIL_STRAVA_SYNC_POLL_INTERVAL_MS));
    }

    return null;
  }

  async function handleResync() {
    setSyncDisabled(true);
    setSyncBtnText(t('run_detail.syncing'));
    try {
      const res = await apiFetch('/api/strava/sync');
      const rawMessage = (await res.text()).trim();
      if (!res.ok) {
        setSyncBtnText(t('run_detail.sync_failed'));
      } else if (/^Strava sync started$/i.test(rawMessage)) {
        setSyncBtnText(t('run_detail.sync_started'));
        const syncStatus = await pollRunDetailStravaSyncCompletion();
        if (syncStatus?.status === 'FAILED') {
          setSyncBtnText(t('run_detail.sync_failed'));
        }
      } else {
        setSyncBtnText(t('run_detail.sync_failed'));
      }
    } catch {
      setSyncBtnText(t('run_detail.sync_failed'));
    } finally {
      window.setTimeout(() => {
        setSyncDisabled(false);
        setSyncBtnText('');
      }, 3200);
    }
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

  const displayName = (profile?.displayName || profile?.email?.split('@')[0] || t('profile.default_name')).trim();
  const initials = displayName.slice(0, 1).toUpperCase();
  const shellPageTitle = run?.name || t('run_detail.detail_title');

  function handleSelectRecentRun(selectedRun) {
    if (!selectedRun?.id) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('hermes_selected_run', JSON.stringify(selectedRun));
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    setRun(selectedRun);
    setPoints([]);
    setInsights(null);
    setAnalytics(null);
    setTelemetry(null);
    setElevationStatus(null);
    setSelectedTelemetryPoint(null);
    navigate(buildRunDetailPath(selectedRun.id));
  }

  function renderRunnerShell(content, {
    hasCoachReview = false,
    hasComparison = false,
    showSections = false,
  } = {}) {
    return (
      <div className={`runner-shell-page runner-dashboard-page runs-dashboard-page run-detail-runner-page run-detail-v2-page${isMapExpanded ? ' is-route-map-expanded' : ''}${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <RunsSubpageNav
          collapsed={isSidebarCollapsed}
          hasCoachReview={hasCoachReview}
          hasComparison={hasComparison}
          lang={lang}
          navigate={navigate}
          onSelectRun={handleSelectRecentRun}
          onToggle={() => setIsSidebarCollapsed((current) => !current)}
          recentRuns={recentRuns}
          run={run}
          showSections={showSections}
          t={t}
        />

        <main className="runner-shell-main">
          <header className="runner-shell-topbar runner-dashboard-shell-topbar">
            <div className="runner-shell-topbar-left">
              <RunnerShellTopNav
                navItems={navItems}
                activeLabel={shellPageTitle}
                parentLabel={t('profile.dashboard_nav_activities')}
                parentRoute="/runs"
                navigate={navigate}
              />
            </div>
            <div className="runner-shell-topbar-actions">
              <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
                <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
                <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                  <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
                </button>
                <TopbarUserMenu initials={initials} label={t('components.account_menu.title')} showProfile />
              </div>
            </div>
          </header>

          <div className="runner-shell-canvas">{content}</div>
        </main>
      </div>
    );
  }

  if (isBootstrappingRun) {
    return renderRunnerShell(
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
      </div>,
    );
  }

  if (!run) {
    return renderRunnerShell(
      <div className="run-detail-page run-detail-profile-cockpit">
        <div className="empty-state run-detail-empty-state" style={{ width: 'min(100%, 860px)', margin: '80px auto 0', padding: '42px 32px', borderRadius: 28, textAlign: 'center' }}>
          <h1>{t('run_detail.no_run_selected')}</h1>
          <p><Link to="/runs">{t('run_detail.back_to_runs')}</Link> {t('run_detail.no_run_selected_copy')}</p>
        </div>
      </div>,
    );
  }

  const dateText = formatLongDate(run.startTime || run.startDate, lang);
  const metaSeparator = t('run_detail.meta_separator');
  const distanceUnitLabel = t('run_detail.unit_km');
  const paceUnitLabel = t('run_detail.unit_pace');
  const heartRateUnitLabel = t('run_detail.unit_bpm');
  const elevationUnitLabel = t('run_detail.unit_meter');
  const heroMetaText = [
    dateText,
    run.locationCity || run.city || run.locationName || run.location,
  ].filter(Boolean).join(metaSeparator) || t('run_detail.imported_activity');

  const activeShoes = shoes.filter((shoe) => !shoe.retired);
  const linkedShoe = run?.shoeId ? shoes.find((shoe) => String(shoe.id) === String(run.shoeId)) : null;
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
  const lapPaceSeconds = (lap) => {
    if (Number.isFinite(lap?.durationSeconds) && lap.durationSeconds > 0 && lap.distanceKm > 0) {
      return lap.durationSeconds / lap.distanceKm;
    }
    const match = /(\d+):(\d{2})/.exec(String(lap?.pace || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const fastestVisibleLapIndex = visibleLapRows.reduce((bestIndex, lap, index, source) => {
    const seconds = lapPaceSeconds(lap);
    if (seconds == null) return bestIndex;
    if (bestIndex === -1) return index;
    const bestSeconds = lapPaceSeconds(source[bestIndex]);
    return bestSeconds == null || seconds < bestSeconds ? index : bestIndex;
  }, -1);

  const distanceValue = distKm != null ? distKm.toFixed(2) : '--';
  const paceMetricValue = distKm && movingSec ? formatPaceSeconds(movingSec / distKm) : '--';
  const timeValue = movingSec ? formatDuration(movingSec) : '--';
  const aerobicEffect = Number(trainingEffect?.aerobic);
  const anaerobicEffect = Number(trainingEffect?.anaerobic);
  const trainingEffectAvailable = Boolean(trainingEffect?.available && Number.isFinite(aerobicEffect) && Number.isFinite(anaerobicEffect));
  const elevationProfile = Array.isArray(analytics?.elevationProfile) ? analytics.elevationProfile : [];
  const totalElevationGain = elevationProfile.length > 1
    ? elevationProfile.reduce((sum, point, index) => {
      if (index === 0) return sum;
      const current = point?.elevationMeters;
      const previous = elevationProfile[index - 1]?.elevationMeters;
      if (current == null || previous == null || !Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) return sum;
      const delta = Number(current) - Number(previous);
      return delta > 0 ? sum + delta : sum;
    }, 0)
    : null;
  const averageCadence = analytics?.averageCadence ?? run.averageCadence;
  const cadenceValue = averageCadence != null && Number.isFinite(Number(averageCadence)) && Number(averageCadence) > 0
    ? Math.round(Number(averageCadence))
    : null;
  const secondaryMetrics = [
    { key: 'avgHr', label: t('run_detail.average_hr'), value: run.averageHeartRate != null ? Math.round(run.averageHeartRate) : null, unit: heartRateUnitLabel },
    { key: 'maxHr', label: t('run_detail.max_hr'), value: run.maxHeartRate != null ? Math.round(run.maxHeartRate) : null, unit: heartRateUnitLabel },
    { key: 'elev', label: t('run_detail.perf_elevation_gain'), value: totalElevationGain != null ? Math.round(totalElevationGain) : null, unit: elevationUnitLabel },
    { key: 'cadence', label: t('run_detail.average_cadence'), value: cadenceValue, unit: t('run_detail.unit_spm') },
  ];
  const visibleLapPaces = visibleLapRows.map(lapPaceSeconds);
  const knownLapPaces = lapRows.map(lapPaceSeconds).filter((value) => value != null);
  const slowestLapPace = knownLapPaces.length ? Math.max(...knownLapPaces) : null;
  const fastestLapPace = knownLapPaces.length ? Math.min(...knownLapPaces) : null;
  const lapBarWidth = (seconds) => {
    if (seconds == null || slowestLapPace == null) return 0;
    const span = Math.max(1, slowestLapPace - fastestLapPace);
    return Math.round(35 + ((slowestLapPace - seconds) / span) * 65);
  };
  const telemetryBounds = hasTelemetryData ? getTelemetryValueBounds(activeTelemetrySamples) : null;
  const effectSegments = (value) => [1, 2, 3, 4, 5].map((step) => Number.isFinite(value) && value >= step - 0.5);
  return renderRunnerShell(
    <div className="run-detail-page run-detail-profile-cockpit run-detail-profile-minimal run-detail-v2">
      <div className="run-detail-shell run-detail-v2__shell">
        <section id="run-detail-overview" className="run-detail-v2__hero">
          <div className={`run-detail-v2__map${points.length > 0 ? '' : ' is-empty'}`}>
            {points.length > 0 ? (
              <>
                <div className="run-detail-map-background run-detail-v2__map-canvas">
                  <div ref={mapRef} id="route-map" style={{ width: '100%', height: '100%' }} />
                </div>
                <button type="button" className="run-detail-v2__map-expand" onClick={() => setIsMapExpanded((current) => !current)} aria-pressed={isMapExpanded}>
                  <AppIcon name={isMapExpanded ? 'close' : 'map'} />
                  {isMapExpanded ? t('run_detail.map_collapse') : t('run_detail.map_expand')}
                </button>
              </>
            ) : (
              <div className="run-detail-no-map">{t('run_detail.no_map')}</div>
            )}
          </div>

          <div className="run-detail-v2__summary">
            <div className="run-detail-v2__heading">
              <p className="run-detail-v2__meta">{heroMetaText}</p>
              <h1>{run.name || t('run_detail.detail_title')}</h1>
              <div className="run-detail-v2__actions">
                {run.provider && <span className="run-detail-provider-pill run-detail-v2__provider">{run.provider}</span>}
                {run.provider === 'STRAVA' && (
                  <button type="button" className="run-detail-v2__btn" disabled={syncDisabled} onClick={handleResync}>
                    <AppIcon name="sync" />
                    {syncBtnText || t('run_detail.resync_strava')}
                  </button>
                )}
                <button type="button" className="run-detail-v2__btn" onClick={handleShare} aria-label={t('run_detail.share')}>
                  <AppIcon name="upload" />
                  {shareFeedback || t('run_detail.share')}
                </button>
              </div>
            </div>

            <div className="run-detail-v2__primary">
              <div className="run-detail-v2__stat">
                <span>{t('run_detail.metric_distance')}</span>
                <strong>{distanceValue}<em>{distanceUnitLabel}</em></strong>
              </div>
              <div className="run-detail-v2__stat">
                <span>{t('run_detail.metric_average_pace')}</span>
                <strong>{paceMetricValue}{paceMetricValue !== '--' ? <em>{paceUnitLabel}</em> : null}</strong>
              </div>
              <div className="run-detail-v2__stat">
                <span>{t('run_detail.metric_moving_time')}</span>
                <strong>{timeValue}</strong>
              </div>
            </div>

            <div className="run-detail-v2__secondary">
              {secondaryMetrics.map((metric) => (
                <div key={metric.key} className="run-detail-v2__mini">
                  <span>{metric.label}</span>
                  <strong>{metric.value ?? '--'}{metric.value != null ? <em>{metric.unit}</em> : null}</strong>
                </div>
              ))}
            </div>

            {runComparison && (
              <div id="run-detail-comparison" className={`run-detail-v2__comparison is-${runComparison.direction}`}>
                <AppIcon name={runComparison.direction === 'slower' ? 'trending_down' : runComparison.direction === 'faster' ? 'trending_up' : 'trending_flat'} />
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
            )}
          </div>
        </section>

        {analytics?.debrief && (
          <section id="run-detail-coach" className="run-detail-v2__coach">
            <div className="run-detail-v2__coach-score">
              <span>{t('run_detail.coach_debrief_title')}</span>
              <strong>{analytics.debrief.readinessScore}<small>%</small></strong>
              <em>{t('run_detail.pre_run_readiness')}</em>
            </div>
            <p className="run-detail-v2__coach-read">{analytics.debrief.interpretation}</p>
            <div className="run-detail-v2__coach-next">
              <span>{t('run_detail.next_day_guidance')}</span>
              <p>{analytics.debrief.nextDayGuidance}</p>
            </div>
          </section>
        )}

        <section id="run-detail-telemetry" className="run-detail-v2__card run-detail-v2__telemetry">
          <div className="run-detail-v2__card-head">
            <h2>{t('run_detail.telemetry_title')}</h2>
            <div className="run-detail-v2__tabs" role="tablist" aria-label={t('run_detail.telemetry_title')}>
              {telemetryTabDefinitions.map((definition) => {
                const displaySample = definition.displaySample;
                const isActive = definition.key === activeTelemetryDefinition.key;
                return (
                  <button
                    key={definition.key}
                    type="button"
                    className={`run-detail-v2__tab${isActive ? ' is-active' : ''}`}
                    style={isActive ? { '--tab-color': definition.color } : undefined}
                    onClick={() => setActiveTelemetryKey(definition.key)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <span>{definition.label}</span>
                    <strong>
                      {displaySample ? formatTelemetryValue(displaySample.value, definition.key) : '--'}
                      {displaySample && <em>{definition.unit}</em>}
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="run-detail-v2__telemetry-stage">
            <div className="run-detail-v2__readout" style={{ '--tab-color': activeTelemetryDefinition.color }}>
              <span>{activeTelemetryDefinition.label}</span>
              <strong>
                {focusTelemetryPoint ? formatTelemetryValue(focusTelemetryPoint.value, activeTelemetryDefinition.key) : '--'}
                <em>{activeTelemetryDefinition.unit}</em>
              </strong>
              <p>
                {focusTelemetryPoint
                  ? t('run_detail.telemetry_focus_copy', {
                    time: formatTelemetryInteractionTime(focusTelemetryPoint.t),
                    distance: focusTelemetryPoint.distanceKm != null ? `${focusTelemetryPoint.distanceKm.toFixed(2)} ${distanceUnitLabel}` : '--',
                  })
                  : t('run_detail.telemetry_no_stream')}
              </p>
              {telemetryBounds ? (
                <dl className="run-detail-v2__bounds">
                  <div><dt>{t('run_detail.telemetry_min')}</dt><dd>{formatTelemetryValue(telemetryBounds.min, activeTelemetryDefinition.key)} {activeTelemetryDefinition.unit}</dd></div>
                  <div><dt>{t('run_detail.telemetry_max')}</dt><dd>{formatTelemetryValue(telemetryBounds.max, activeTelemetryDefinition.key)} {activeTelemetryDefinition.unit}</dd></div>
                </dl>
              ) : null}
            </div>
            <div className="run-detail-telemetry-chart run-detail-v2__chart">
              {telemetryChartData ? (
                <Line data={telemetryChartData} options={telemetryChartOptions} />
              ) : (
                <div className="run-detail-chart-empty">{t('run_detail.telemetry_no_stream')}</div>
              )}
            </div>
          </div>
          {elevationStatus?.flagged && (
            <div className="run-detail-warning">
              <p>{t('run_detail.elevation_warning')}</p>
              {elevationStatus?.canRecalibrate && (
                <button type="button" className="run-detail-link-btn run-detail-warning-action" disabled={recalibratingElevation} onClick={handleElevationRecalibration}>
                  {recalibratingElevation ? t('run_detail.recalibrating') : t('run_detail.recalibrate')}
                </button>
              )}
            </div>
          )}
        </section>

        <div className="run-detail-v2__lower">
          <section id="run-detail-splits" className="run-detail-v2__card run-detail-v2__splits">
            <div className="run-detail-v2__card-head">
              <h2>{t('run_detail.splits')}</h2>
              {lapRows.length > 5 && (
                <button type="button" className="run-detail-v2__link" onClick={() => setShowAllSplits((prev) => !prev)}>
                  {showAllSplits ? t('run_detail.show_less') : t('run_detail.view_all')}
                </button>
              )}
            </div>
            <table className="run-detail-splits-table run-detail-v2__splits-table">
              <thead>
                <tr>
                  <th>{t('run_detail.split_unit')}</th>
                  <th colSpan="2">{t('run_detail.split_pace')}</th>
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
                      <td className="run-detail-v2__pace-bar" aria-hidden="true"><span style={{ width: `${lapBarWidth(visibleLapPaces[index])}%` }} /></td>
                      <td className="run-detail-v2__pace">{lap.pace || '--'}</td>
                      <td>{lapGain != null ? `+${Math.round(lapGain)} ${elevationUnitLabel}` : formatLapElevation(lap)}</td>
                      <td>{lap.averageHeartRate ? Math.round(lap.averageHeartRate) : '--'}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="5" className="is-empty">{t('run_detail.no_lap_data')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <aside className="run-detail-v2__side">
            <section className="run-detail-v2__card run-detail-gear-section run-detail-v2__gear">
              <div className="run-detail-v2__card-head">
                <h3>{t('run_detail.gear_linked')}</h3>
                <div className="run-detail-gear-actions">
                  <button
                    type="button"
                    className="run-detail-v2__link"
                    disabled={assigningShoeId != null}
                    onClick={() => {
                      setShoeActionMessage('');
                      setShoeDropdownOpen((prev) => !prev);
                    }}
                  >
                    {assigningShoeId != null
                      ? t('run_detail.shoe_assigning')
                      : run.shoeId ? t('run_detail.change_shoe') : t('run_detail.link_shoe')}
                  </button>
                  {run.shoeId && (
                    <button type="button" className="run-detail-v2__link is-danger" disabled={assigningShoeId != null} onClick={() => assignShoe(0)}>
                      {t('run_detail.unlink_shoe')}
                    </button>
                  )}
                </div>
              </div>
              <div className="run-detail-gear-row">
                <div className="run-detail-gear-art">
                  {linkedShoe?.photoUrl ? (
                    <img src={linkedShoe.photoUrl} alt={linkedShoeName || t('run_detail.shoe')} width="800" height="800" loading="lazy" decoding="async" />
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
              {shoeDropdownOpen && (
                <div className="shoe-run-dropdown run-detail-dropdown" role="menu">
                  {activeShoes.length > 0 ? activeShoes.map((shoe) => (
                    <button
                      key={shoe.id}
                      type="button"
                      className={`shoe-run-option${String(shoe.id) === String(run.shoeId) ? ' active' : ''}`}
                      disabled={assigningShoeId != null}
                      onClick={() => assignShoe(shoe.id)}
                    >
                      {formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang })}
                    </button>
                  )) : (
                    <div className="shoe-run-empty">{t('run_detail.no_active_shoes')}</div>
                  )}
                </div>
              )}
              {shoeActionMessage && (
                <p className="run-detail-gear-status" aria-live="polite">{shoeActionMessage}</p>
              )}
            </section>

            <section className="run-detail-v2__card run-detail-v2__effect">
              <h3>{t('run_detail.training_effect_title')}</h3>
              {[
                ['aerobic', t('run_detail.aerobic_effect'), aerobicEffect],
                ['anaerobic', t('run_detail.anaerobic_effect'), anaerobicEffect],
              ].map(([key, label, value]) => (
                <div key={key} className="run-detail-v2__effect-row">
                  <div className="run-detail-v2__effect-head">
                    <span>{label}</span>
                    <strong>{trainingEffectAvailable ? value.toFixed(1) : '--'}</strong>
                  </div>
                  <div className="run-detail-v2__effect-scale" aria-hidden="true">
                    {effectSegments(trainingEffectAvailable ? value : NaN).map((filled, index) => (
                      <span key={index} className={filled ? 'is-filled' : ''} />
                    ))}
                  </div>
                </div>
              ))}
              {!trainingEffectAvailable && <p className="run-detail-v2__muted">{t('run_detail.training_effect_unavailable')}</p>}
            </section>

            <section className="run-detail-v2__card run-detail-v2__form">
              <h3>{t('run_detail.form_title')}</h3>
              <div className="run-detail-v2__form-grid">
                <div className="run-detail-v2__mini">
                  <span>{t('run_detail.ground_contact_time')}</span>
                  <strong>{latestGroundContact ? <>{formatTelemetryValue(latestGroundContact.value, 'groundContactTimeMs')}<em>ms</em></> : t('run_detail.not_captured')}</strong>
                </div>
                <div className="run-detail-v2__mini">
                  <span>{t('run_detail.vertical_oscillation')}</span>
                  <strong>{latestVerticalOscillation ? <>{formatTelemetryValue(latestVerticalOscillation.value, 'verticalOscillationCm')}<em>cm</em></> : t('run_detail.not_captured')}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
      <footer className="runner-shell-footer runner-dashboard-footer run-detail-footer">
        <FooterNavLinks />
      </footer>
    </div>,
    {
      hasCoachReview: Boolean(analytics?.debrief),
      hasComparison: Boolean(runComparison),
      showSections: true,
    },
  );
}

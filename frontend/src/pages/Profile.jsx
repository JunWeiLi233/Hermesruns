import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';
import { apiFetch, apiJson } from '../api';
import Modal from '../components/Modal';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import ImportDataGuide from '../components/ImportDataGuide';
import WeatherTemperatureBar from '../components/WeatherTemperatureBar';
import { TemperatureGlyph, WeatherGlyph } from '../components/WeatherGlyph';
import SectionCard from '../components/ui/SectionCard';
import MetricCard from '../components/ui/MetricCard';
import { formatDuration, formatPace } from '../utils/format';
import { getTodayRunRecommendation } from '../utils/todayRun';
import {
  estimateCurrentVdot,
  collectAllVdotEntries,
  computeRollingRepresentativeSeries,
  VDOT_LOOKBACK_MS,
} from '../utils/vdot';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import 'leaflet/dist/leaflet.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler,
);
const HEAT_GRADIENT_DARK = {
  0.0: '#0b1220',
  0.18: '#166534',
  0.4: '#22c55e',
  0.62: '#facc15',
  0.82: '#fb923c',
  1.0: '#ef4444',
};

const HEAT_GRADIENT_LIGHT = {
  0.0: '#14532d',
  0.2: '#22c55e',
  0.42: '#84cc16',
  0.64: '#facc15',
  0.84: '#fb923c',
  1.0: '#dc2626',
};

const CARTO_TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIB = '\u00a9 OpenStreetMap \u00a9 CARTO';

/** Track background only — one box, no inner % width (avoids grid/absolute overflow bugs). */
const PROFILE_BAR_TRACK_EMPTY = 'rgba(148, 163, 184, 0.25)';

function profileBarWarmBackground(pct) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0));
  return `linear-gradient(90deg, #fb923c 0%, #f97316 ${p}%, ${PROFILE_BAR_TRACK_EMPTY} ${p}%, ${PROFILE_BAR_TRACK_EMPTY} 100%)`;
}

function profileBarTempBackground(pct) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0));
  return `linear-gradient(90deg, #38bdf8 0%, #0284c7 ${p}%, ${PROFILE_BAR_TRACK_EMPTY} ${p}%, ${PROFILE_BAR_TRACK_EMPTY} 100%)`;
}

function pickNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function localizeStravaSyncMessage(message, t) {
  const normalized = String(message || '').trim();
  if (!normalized) return '';
  if (normalized === 'Strava sync started') return t('profile.strava_sync_started');
  if (normalized === 'No Strava account linked') return t('profile.strava_sync_not_linked');
  if (normalized === 'Strava token is invalid; please relink your Strava account.') {
    return t('profile.strava_sync_relink_required');
  }
  if (normalized === 'Invalid session') return t('common.session_expired');
  return normalized;
}

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getConsecutiveRunDayStreak(runs) {
  const sortedDays = [...new Set(
    runs
      .map((run) => new Date(run.startTime || run.startDate || 0))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()),
  )].sort((a, b) => b - a);

  if (sortedDays.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i += 1) {
    const diffDays = Math.round((sortedDays[i - 1] - sortedDays[i]) / 86400000);
    if (diffDays === 1) streak += 1;
    else break;
  }
  return streak;
}

function getConsecutiveRunWeekStreak(runs) {
  const sortedWeeks = [...new Set(
    runs
      .map((run) => new Date(run.startTime || run.startDate || 0))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => startOfWeek(date).getTime()),
  )].sort((a, b) => b - a);

  if (sortedWeeks.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < sortedWeeks.length; i += 1) {
    const diffWeeks = Math.round((sortedWeeks[i - 1] - sortedWeeks[i]) / (7 * 86400000));
    if (diffWeeks === 1) streak += 1;
    else break;
  }
  return streak;
}

function countKeywordRuns(runs, pattern) {
  return runs.reduce((total, run) => {
    const haystack = `${run.name || ''} ${run.title || ''} ${run.description || ''}`;
    return total + (pattern.test(haystack) ? 1 : 0);
  }, 0);
}

function RewardGlyph({ icon }) {
  if (icon === 'park') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 C9 3 7 5.2 7 8 c0 1.6 0.6 3 1.7 4 H5.8 l2.8 3.6 h2.3 V21 h2.2 v-5.4 h2.3 l2.8-3.6 h-2.9 C16.4 11 17 9.6 17 8 c0-2.8-2-5-5-5 Z" />
      </svg>
    );
  }
  if (icon === 'bridge') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17 h16 v2 H4 Z M5 15 c1.8 0 2.2-6 7-6 s5.2 6 7 6 v2 c-2 0-3.3-1.3-4.5-2.5 C13.5 13.3 13 13 12 13 s-1.5 0.3-2.5 1.5 C8.3 15.7 7 17 5 17 Z" />
      </svg>
    );
  }
  if (icon === 'city') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20 h16 v2 H4 Z M6 8 h4 v12 H6 Z M11 4 h7 v16 h-7 Z M7.5 10.5 h1 v1 h-1 Z M7.5 13.5 h1 v1 h-1 Z M13 7 h1.2 v1.2 H13 Z M15.8 7 h1.2 v1.2 h-1.2 Z M13 10 h1.2 v1.2 H13 Z M15.8 10 h1.2 v1.2 h-1.2 Z M13 13 h1.2 v1.2 H13 Z M15.8 13 h1.2 v1.2 h-1.2 Z" />
      </svg>
    );
  }
  if (icon === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2 h2 v3 H7 Z M15 2 h2 v3 h-2 Z M4 5 h16 v15 H4 Z M6 9 h12 v9 H6 Z" />
      </svg>
    );
  }
  if (icon === 'crown') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18 h16 l-1.5 3 h-13 Z M5 7 l4 4 3-6 3 6 4-4 1 9 H4 Z" />
      </svg>
    );
  }
  if (icon === 'summit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 20 11 6 l2.3 4 1.7-2 6 12 Z M13 6 h5 l-2 3 Z" />
      </svg>
    );
  }
  if (icon === 'streak') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2 6 13 h4 l-1 9 7-11 h-4 l1-9 Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 15 9 h7 l-5.5 4.2 2.1 7.1 L12 16.7 5.4 20.3 l2.1-7.1 L2 9 h7 Z" />
    </svg>
  );
}

export default function Profile() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { isDark } = useTheme();
  const { isMile } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [heatmapSummary, setHeatmapSummary] = useState('');
  const [heatmapEmpty, setHeatmapEmpty] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [years, setYears] = useState([]);

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [activeImportModal, setActiveImportModal] = useState(null);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [nameStatus, setNameStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [fitExportFiles, setFitExportFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);

  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminLimit, setGarminLimit] = useState(50);
  const [garminImporting, setGarminImporting] = useState(false);
  const [garminStatus, setGarminStatus] = useState('');
  const [garminStatusType, setGarminStatusType] = useState('');
  const [weatherContext, setWeatherContext] = useState(null);
  const [weatherSnapshot, setWeatherSnapshot] = useState(null);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [stravaSyncNotice, setStravaSyncNotice] = useState(null);
  const [profileShoes, setProfileShoes] = useState([]);
  const [aiQuota, setAiQuota] = useState(null);
  const [billingConfig, setBillingConfig] = useState(null);
  const [subscriptionMonths, setSubscriptionMonths] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [subscriptionCheckoutError, setSubscriptionCheckoutError] = useState('');
  const [checkoutBanner, setCheckoutBanner] = useState(null);

  const [mapReady, setMapReady] = useState(false);
  const [weeklyFlashIndex, setWeeklyFlashIndex] = useState(0);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const heatmapIsDarkRef = useRef(undefined);
  const stravaSyncPollRef = useRef(null);
  const importModalOpen = activeImportModal === 'manual';
  const garminModalOpen = activeImportModal === 'garmin';

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadProfile();
    loadActivities();
    loadShoes();
    loadAiQuota();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const c = await apiJson('/api/billing/config');
        setBillingConfig(c);
      } catch {
        setBillingConfig({ checkoutConfigured: false, provider: 'stripe' });
      }
    })();
  }, [isAuthenticated]);

  const stravaSessionPullRef = useRef(false);

  /** One Strava pull per browser session when linked; server also runs periodic Strava auto-sync. */
  useEffect(() => {
    if (!isAuthenticated || !profile?.stravaLinked || stravaSessionPullRef.current) return;
    stravaSessionPullRef.current = true;
    let cancelled = false;

    async function pollStravaSyncStatus() {
      try {
        const response = await apiJson('/api/auth/strava/sync-status');
        if (cancelled || !response || typeof response !== 'object') return;
        if (response.status === 'FAILED') {
          setStravaSyncNotice({
            tone: 'error',
            message: response.error || t('profile.strava_sync_failed'),
          });
          return;
        }
        if (response.status === 'RUNNING' || response.status === 'PENDING') {
          setStravaSyncNotice({
            tone: 'info',
            message: t('profile.strava_sync_processing'),
          });
          stravaSyncPollRef.current = window.setTimeout(pollStravaSyncStatus, 4000);
          return;
        }
        if (response.status === 'COMPLETED') {
          setStravaSyncNotice({
            tone: 'success',
            message: t('profile.strava_sync_completed'),
          });
        }
      } catch {
        setStravaSyncNotice({
          tone: 'error',
          message: t('profile.strava_sync_failed'),
        });
      }
    }

    (async () => {
      try {
        const prov = await apiJson('/api/auth/providers');
        if (cancelled || !prov.stravaConfigured) return;
        const res = await apiFetch('/api/strava/sync');
        const rawMessage = (await res.text()).trim();
        if (cancelled) return;
        const localizedMessage = localizeStravaSyncMessage(rawMessage, t);
        if (!res.ok) {
          setStravaSyncNotice({
            tone: 'error',
            message: localizedMessage || t('profile.strava_sync_failed'),
          });
          return;
        }
        if (rawMessage && rawMessage !== 'Strava sync started') {
          setStravaSyncNotice({
            tone: rawMessage.includes('invalid') || rawMessage.includes('No Strava')
              ? 'warning'
              : 'info',
            message: localizedMessage,
          });
          return;
        }
        setStravaSyncNotice({
          tone: 'info',
          message: t('profile.strava_sync_started'),
        });
        stravaSyncPollRef.current = window.setTimeout(pollStravaSyncStatus, 2500);
        await new Promise(r => setTimeout(r, 3500));
        if (!cancelled) loadActivities();
      } catch {
        setStravaSyncNotice({
          tone: 'error',
          message: t('profile.strava_sync_failed'),
        });
      }
    })();
    return () => {
      cancelled = true;
      if (stravaSyncPollRef.current) {
        window.clearTimeout(stravaSyncPollRef.current);
        stravaSyncPollRef.current = null;
      }
    };
  }, [isAuthenticated, profile?.stravaLinked, t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const co = params.get('checkout');
    if (co !== 'success' && co !== 'cancel') return;
    setCheckoutBanner(co);
    (async () => {
      try {
        const data = await apiJson('/api/shoes/ai-usage');
        setAiQuota(data);
      } catch { /* ignored */ }
    })();
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [isAuthenticated]);

  useEffect(() => {
    if (subscriptionModalOpen) setSubscriptionCheckoutError('');
  }, [subscriptionModalOpen]);

  async function loadProfile() {
    try {
      const [profileData, weatherData] = await Promise.all([
        apiJson('/api/profile/me'),
        apiJson('/api/v1/weather/context').catch(() => null),
      ]);
      setProfile(profileData);
      setWeatherContext(weatherData && typeof weatherData === 'object' ? weatherData : null);
    } catch {
      navigate('/login');
    }
  }

  async function loadAiQuota() {
    try {
      const data = await apiJson('/api/shoes/ai-usage');
      setAiQuota(data);
    } catch { /* ignored */ }
  }

  async function startStripeCheckout(ev) {
    ev?.stopPropagation?.();
    ev?.preventDefault?.();
    if (!billingConfig?.checkoutConfigured) return;
    setSubscriptionCheckoutError('');
    setCheckoutLoading(true);
    try {
      const data = await apiJson('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: subscriptionMonths }),
      });
      if (data?.url) window.location.href = data.url;
      else throw new Error('no checkout url');
    } catch (err) {
      setSubscriptionCheckoutError(err?.message || t('profile.subscription_checkout_error'));
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function loadShoes() {
    try {
      const data = await apiJson('/api/shoes/recent');
      setProfileShoes(Array.isArray(data) ? data : []);
    } catch { /* ignored */ }
  }

  async function loadActivities() {
    try {
      const data = await apiJson('/api/activities');
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      setRuns(list);
      populateYears(list);

      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('source') === 'strava') {
        setSyncCount(list.length);
        setSyncModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch { /* ignored */ }
  }

  function populateYears(list) {
    const ys = new Set();
    list.forEach(r => {
      const d = new Date(r.startDate || r.startTime);
      if (!isNaN(d.getTime())) ys.add(d.getFullYear());
    });
    setYears([...ys].sort((a, b) => b - a));
  }

  // Heatmap
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    import('leaflet').then(L => {
      const map = L.map(mapRef.current, { scrollWheelZoom: true, dragging: true })
        .setView([40.7306, -73.9352], 12);
      const tileUrl = isDark ? CARTO_TILE_DARK : CARTO_TILE_LIGHT;
      tileLayerRef.current = L.tileLayer(tileUrl, {
        attribution: CARTO_ATTRIB,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
    });
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = tileLayerRef.current;
    if (!map || !mapReady || !layer) return;
    if (heatmapIsDarkRef.current === undefined) {
      heatmapIsDarkRef.current = isDark;
      return;
    }
    if (heatmapIsDarkRef.current === isDark) return;
    heatmapIsDarkRef.current = isDark;
    import('leaflet').then(L => {
      const m = mapInstanceRef.current;
      const prev = tileLayerRef.current;
      if (!m || !prev) return;
      m.removeLayer(prev);
      const tileUrl = isDark ? CARTO_TILE_DARK : CARTO_TILE_LIGHT;
      tileLayerRef.current = L.tileLayer(tileUrl, {
        attribution: CARTO_ATTRIB,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(m);

      if (heatLayerRef.current) {
        heatLayerRef.current.setOptions({
          gradient: isDark ? HEAT_GRADIENT_DARK : HEAT_GRADIENT_LIGHT
        });
      }
    });
  }, [isDark, mapReady]);

  const renderHeatmap = useCallback(async (year) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setHeatmapSummary(t('profile.heatmap_loading'));
    const url = year ? `/api/activities/heatmap?year=${year}` : '/api/activities/heatmap';
    try {
      // Fetch data and preload leaflet modules in parallel
      const heatReady = import('leaflet').then(L => import('leaflet.heat').then(() => L));
      const res = await apiFetch(url);
      if (!res.ok) throw new Error();
      const [points, L] = await Promise.all([res.json(), heatReady]);

      if (!points || points.length === 0) {
        setHeatmapEmpty(true);
        setHeatmapSummary('');
        return;
      }
      setHeatmapEmpty(false);

      if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);

      const currentGradient = document.body.classList.contains('theme-midnight')
        ? HEAT_GRADIENT_DARK
        : HEAT_GRADIENT_LIGHT;

      // Compute bounds manually — avoids creating N L.latLng objects
      let minLat = points[0][0], maxLat = minLat, minLng = points[0][1], maxLng = minLng;
      for (let i = 1; i < points.length; i++) {
        const lat = points[i][0], lng = points[i][1];
        if (lat < minLat) minLat = lat; else if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; else if (lng > maxLng) maxLng = lng;
      }

      // Defer heat layer until layout/paint: leaflet.heat uses a canvas that throws if width/height are 0.
      const paintHeat = () => {
        map.invalidateSize();
        const size = map.getSize();
        if (size.x === 0 || size.y === 0) {
          setHeatmapSummary(t('profile.heatmap_map_not_visible'));
          return;
        }
        heatLayerRef.current = (L.default || L).heatLayer(points, {
          radius: 4, blur: 5, maxZoom: 18, max: 1.0, minOpacity: 0.4, gradient: currentGradient,
        }).addTo(map);
        map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [30, 30], maxZoom: 14 });
        map.invalidateSize();
        setHeatmapSummary(t('profile.heatmap_points_summary', { count: points.length.toLocaleString() }));
      };
      requestAnimationFrame(() => requestAnimationFrame(paintHeat));
    } catch {
      setHeatmapSummary(t('profile.heatmap_load_failed'));
    }
  }, [t]);

  useEffect(() => {
    if (mapReady && isAuthenticated) {
      renderHeatmap(selectedYear || null);
    }
  }, [selectedYear, renderHeatmap, isAuthenticated, mapReady]);

  // Stats
  const totalKm = runs.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalSec = runs.reduce((s, r) => s + (r.movingTimeSeconds || 0), 0);
  const totalRuns = runs.length;
  const unitDistance = isMile ? totalKm / 1.60934 : totalKm;
  const unitLabel = t(isMile ? 'analysis.unit_distance_mile' : 'analysis.unit_distance_km');
  const paceUnitLabel = t(isMile ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km');
  const distanceUnitShort = isMile ? 'mi' : 'km';
  const avgPaceStr = totalKm > 0
    ? `${formatDuration(totalSec / unitDistance)} ${paceUnitLabel}`
    : `0:00 ${paceUnitLabel}`;

  const weeklyHook = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);

    let thisWeekKm = 0;
    let lastWeekKm = 0;
    let thisWeekRuns = 0;
    let longestRunKm = 0;

    for (const run of runs) {
      const runDate = new Date(run.startTime || run.startDate || 0);
      if (Number.isNaN(runDate.getTime())) continue;
      const runDay = new Date(runDate.getFullYear(), runDate.getMonth(), runDate.getDate());
      const km = Number(run.distanceKm || 0);

      if (runDay >= weekStart) {
        thisWeekKm += km;
        thisWeekRuns += 1;
        if (km > longestRunKm) longestRunKm = km;
      } else if (runDay >= prevWeekStart && runDay < prevWeekEnd) {
        lastWeekKm += km;
      }
    }

    const unitThisWeek = isMile ? thisWeekKm / 1.60934 : thisWeekKm;
    const unitLastWeek = isMile ? lastWeekKm / 1.60934 : lastWeekKm;
    const unitLongest = isMile ? longestRunKm / 1.60934 : longestRunKm;
    const delta = unitThisWeek - unitLastWeek;
    const deltaAbs = Math.abs(delta);

    let headline;
    if (thisWeekRuns === 0) {
      headline = t('profile.weekly_flash.headline_empty', { unit: distanceUnitShort });
    } else if (unitLastWeek <= 0 && unitThisWeek > 0) {
      headline = t('profile.weekly_flash.headline_started', { distance: unitThisWeek.toFixed(1), unit: distanceUnitShort });
    } else if (delta > 0.05) {
      headline = t('profile.weekly_flash.headline_up', { delta: deltaAbs.toFixed(1), unit: distanceUnitShort });
    } else if (delta < -0.05) {
      headline = t('profile.weekly_flash.headline_down', { delta: deltaAbs.toFixed(1), unit: distanceUnitShort });
    } else {
      headline = t('profile.weekly_flash.headline_even');
    }

    let kicker;
    if (thisWeekRuns >= 4) {
      kicker = t('profile.weekly_flash.kicker_rhythm', { count: thisWeekRuns });
    } else if (longestRunKm >= 10) {
      kicker = t('profile.weekly_flash.kicker_longest', { distance: unitLongest.toFixed(1), unit: distanceUnitShort });
    } else if (unitLastWeek > unitThisWeek && unitLastWeek > 0) {
      kicker = t('profile.weekly_flash.kicker_gap', { distance: (unitLastWeek - unitThisWeek).toFixed(1), unit: distanceUnitShort });
    } else {
      kicker = t('profile.weekly_flash.kicker_easy');
    }

    return {
      headline,
      kicker,
      thisWeekDistance: unitThisWeek,
      lastWeekDistance: unitLastWeek,
      runCount: thisWeekRuns,
      longestRun: unitLongest,
    };
  }, [runs, isMile, distanceUnitShort, t]);

  const weeklyFlashcards = useMemo(() => {
    const cards = [
      {
        eyebrow: t('profile.weekly_flash.eyebrow_this_week'),
        title: weeklyHook.headline,
        body: weeklyHook.kicker,
        accent: `${weeklyHook.thisWeekDistance.toFixed(1)} ${distanceUnitShort}`,
      },
      {
        eyebrow: t('profile.weekly_flash.eyebrow_volume'),
        title: weeklyHook.runCount > 0
          ? t('profile.weekly_flash.volume_title_runs', { count: weeklyHook.runCount })
          : t('profile.weekly_flash.volume_title_empty'),
        body: weeklyHook.runCount > 0
          ? t('profile.weekly_flash.volume_body_runs', { distance: weeklyHook.thisWeekDistance.toFixed(1), unit: distanceUnitShort })
          : t('profile.weekly_flash.volume_body_empty'),
        accent: t('profile.weekly_flash.volume_accent', { count: weeklyHook.runCount }),
      },
      {
        eyebrow: t('profile.weekly_flash.eyebrow_longest'),
        title: weeklyHook.longestRun > 0
          ? t('profile.weekly_flash.longest_title_value', { distance: weeklyHook.longestRun.toFixed(1), unit: distanceUnitShort })
          : t('profile.weekly_flash.longest_title_empty'),
        body: weeklyHook.longestRun > 0
          ? t('profile.weekly_flash.longest_body_value')
          : t('profile.weekly_flash.longest_body_empty'),
        accent: `${weeklyHook.longestRun.toFixed(1)} ${distanceUnitShort}`,
      },
      {
        eyebrow: t('profile.weekly_flash.eyebrow_compare'),
        title: weeklyHook.lastWeekDistance > 0
          ? t('profile.weekly_flash.compare_title_value', { distance: weeklyHook.lastWeekDistance.toFixed(1), unit: distanceUnitShort })
          : t('profile.weekly_flash.compare_title_empty'),
        body: weeklyHook.thisWeekDistance >= weeklyHook.lastWeekDistance
          ? t('profile.weekly_flash.compare_body_ahead')
          : t('profile.weekly_flash.compare_body_behind'),
        accent: `${weeklyHook.lastWeekDistance.toFixed(1)} ${distanceUnitShort}`,
      },
    ];
    return cards;
  }, [weeklyHook, distanceUnitShort, t]);

  const activeWeeklyFlashcard = weeklyFlashcards[weeklyFlashIndex % Math.max(weeklyFlashcards.length, 1)];

  const rewardShowcase = useMemo(() => {
    const longestRunKm = runs.reduce((max, run) => Math.max(max, Number(run.distanceKm || 0)), 0);
    const streakDays = getConsecutiveRunDayStreak(runs);
    const streakWeeks = getConsecutiveRunWeekStreak(runs);
    const parkRuns = countKeywordRuns(runs, /\b(park|garden|greenway|trail)\b/i);
    const bridgeRuns = countKeywordRuns(runs, /\b(bridge|riverwalk|waterfront)\b/i);
    const cityRuns = countKeywordRuns(runs, /\b(city|downtown|plaza|campus|tower|building)\b/i);
    const earned = [
      {
        id: 'streak-7',
        icon: 'streak',
        title: lang === 'zh-CN' ? '七日连跑' : '7-Day Streak',
        subtitle: lang === 'zh-CN' ? `连续 ${streakDays} 天保持跑步节奏` : `${streakDays} straight days on the run`,
        earned: streakDays >= 7,
      },
      {
        id: 'streak-30',
        icon: 'calendar',
        title: lang === 'zh-CN' ? '三十日挑战' : '30-Day Challenge',
        subtitle: lang === 'zh-CN' ? '把短期坚持变成稳定习惯' : 'Turn consistency into a durable habit',
        earned: streakDays >= 30,
      },
      {
        id: 'weeks-4',
        icon: 'crown',
        title: lang === 'zh-CN' ? '四周连续训练' : '4-Week Flow',
        subtitle: lang === 'zh-CN' ? `已连续 ${streakWeeks} 周完成跑步` : `${streakWeeks} consecutive training weeks`,
        earned: streakWeeks >= 4,
      },
      {
        id: 'park',
        icon: 'park',
        title: lang === 'zh-CN' ? '公园探索家' : 'Park Explorer',
        subtitle: lang === 'zh-CN' ? `在路线名里捕捉到 ${parkRuns} 次公园或绿道探索` : `${parkRuns} park or trail themed efforts`,
        earned: parkRuns >= 1,
      },
      {
        id: 'bridge',
        icon: 'bridge',
        title: lang === 'zh-CN' ? '桥梁猎手' : 'Bridge Chaser',
        subtitle: lang === 'zh-CN' ? `已记录 ${bridgeRuns} 次桥边路线` : `${bridgeRuns} bridge or waterfront routes logged`,
        earned: bridgeRuns >= 1,
      },
      {
        id: 'city',
        icon: 'city',
        title: lang === 'zh-CN' ? '城市地标收藏家' : 'City Landmark Hunter',
        subtitle: lang === 'zh-CN' ? `已记录 ${cityRuns} 次城市地标路线` : `${cityRuns} city landmark style runs`,
        earned: cityRuns >= 1,
      },
      {
        id: 'long-run',
        icon: 'summit',
        title: lang === 'zh-CN' ? '长距离里程碑' : 'Long Run Milestone',
        subtitle: lang === 'zh-CN' ? `单次最长 ${longestRunKm.toFixed(1)} km` : `Longest single run: ${longestRunKm.toFixed(1)} km`,
        earned: longestRunKm >= 15,
      },
      {
        id: 'hundred-runs',
        icon: 'medal',
        title: lang === 'zh-CN' ? '百跑徽章' : 'Hundred Run Badge',
        subtitle: lang === 'zh-CN' ? `累计 ${runs.length} 次跑步` : `${runs.length} total runs recorded`,
        earned: runs.length >= 100,
      },
    ];

    const earnedRewards = earned.filter((item) => item.earned);
    const upcomingRewards = earned.filter((item) => !item.earned).slice(0, 3);
    const mapHighlights = [
      parkRuns > 0 ? { key: 'park', icon: 'park', label: lang === 'zh-CN' ? '公园路线' : 'Park routes', count: parkRuns } : null,
      bridgeRuns > 0 ? { key: 'bridge', icon: 'bridge', label: lang === 'zh-CN' ? '桥梁路线' : 'Bridge routes', count: bridgeRuns } : null,
      cityRuns > 0 ? { key: 'city', icon: 'city', label: lang === 'zh-CN' ? '城市地标' : 'City landmarks', count: cityRuns } : null,
    ].filter(Boolean);

    return {
      earnedRewards,
      upcomingRewards,
      mapHighlights,
    };
  }, [lang, runs]);

  const {
    recommendation: todayRecommendation,
    tone: recommendationTone,
  } = getTodayRunRecommendation({ runs, t, lang });

  const profileVdot = useMemo(() => estimateCurrentVdot(runs).representativeVdot, [runs]);

  const vo2ProgressChart = useMemo(() => {
    const sorted = collectAllVdotEntries(runs);
    if (sorted.length === 0) return null;
    const scatterData = sorted.map((e) => ({
      x: e.date.getTime(),
      y: Math.round(e.vdot * 10) / 10,
    }));
    const rolling = computeRollingRepresentativeSeries(sorted, VDOT_LOOKBACK_MS);
    const lineData = rolling.map((p) => ({ x: p.x, y: p.y }));
    return {
      datasets: [
        {
          label: t('profile.vo2_chart_per_run'),
          data: scatterData,
          backgroundColor: 'rgba(13, 148, 136, 0.35)',
          borderColor: 'rgba(13, 148, 136, 0.55)',
          pointRadius: 3,
          pointHoverRadius: 6,
          showLine: false,
          order: 2,
        },
        {
          label: t('profile.vo2_chart_trend'),
          data: lineData,
          type: 'line',
          borderColor: '#0f766e',
          backgroundColor: 'rgba(13, 148, 136, 0.06)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.35,
          order: 1,
        },
      ],
    };
  }, [runs, t]);

  const vo2ChartOptions = useMemo(() => {
    const textColor = isDark ? '#e2e8f0' : '#334155';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, padding: 10, font: { size: 10 }, color: textColor },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              return new Date(items[0].parsed.x).toLocaleDateString(lang, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
            },
            label: (ctx) => {
              const v = ctx.parsed.y;
              if (v == null) return '';
              const name = ctx.dataset.label || '';
              return `${name}: ${typeof v === 'number' ? v.toFixed(1) : v} ${t('profile.vo2_unit_short')}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          grid: { display: false },
          ticks: {
            color: textColor,
            maxTicksLimit: 5,
            callback: (value) => new Date(value).toLocaleDateString(lang, { month: 'short', year: '2-digit' }),
          },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor },
          title: {
            display: true,
            text: t('profile.vo2_chart_y_title'),
            color: textColor,
            font: { size: 10 },
          },
        },
      },
    };
  }, [isDark, lang, t]);

  // Daily steps from running (last 14 days)
  const dailySteps = (() => {
    const STEPS_PER_KM = 1282; // avg stride ~0.78m
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, date: d, steps: 0, km: 0 });
    }
    for (const run of runs) {
      const rd = new Date(run.startTime || run.startDate);
      const rKey = rd.toISOString().slice(0, 10);
      const day = days.find(d => d.key === rKey);
      if (day) {
        const km = run.distanceKm || 0;
        day.km += km;
        day.steps += Math.round(km * STEPS_PER_KM);
      }
    }
    return days;
  })();
  const maxSteps = Math.max(1, ...dailySteps.map(d => d.steps));
  const todaySteps = dailySteps[dailySteps.length - 1];
  const weekSteps = dailySteps.slice(-7).reduce((s, d) => s + d.steps, 0);

  /** Recorded kcal when present; else ~65 kcal/km (rough running estimate). */
  const caloriesSummary = useMemo(() => {
    const ROUGH_KCAL_PER_KM = 65;
    function kcalForRun(run) {
      const c = Number(run.calories);
      if (Number.isFinite(c) && c > 0) return Math.round(c);
      const km = Number(run.distanceKm || 0);
      if (km <= 0) return 0;
      return Math.round(km * ROUGH_KCAL_PER_KM);
    }
    const now = new Date();
    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), date: d, kcal: 0 });
    }
    const cutoff7 = Date.now() - 7 * 86400000;
    const cutoff28 = Date.now() - 28 * 86400000;
    let totalAll = 0;
    let week7 = 0;
    let week28 = 0;
    for (const run of runs) {
      const t = new Date(run.startTime || run.startDate).getTime();
      if (Number.isNaN(t)) continue;
      const k = kcalForRun(run);
      if (k <= 0) continue;
      totalAll += k;
      if (t >= cutoff7) week7 += k;
      if (t >= cutoff28) week28 += k;
      const rKey = new Date(run.startTime || run.startDate).toISOString().slice(0, 10);
      const day = days.find((x) => x.key === rKey);
      if (day) day.kcal += k;
    }
    const todayK = days[days.length - 1].kcal;
    return {
      dailyCalories: days,
      total: totalAll,
      week7,
      week28,
      today: todayK,
    };
  }, [runs]);

  const maxDailyKcal = Math.max(1, ...caloriesSummary.dailyCalories.map((d) => d.kcal));

  const systemStatus = useMemo(() => {
    const currentTempC = pickNumber(
      weatherContext?.currentDewPointC,
      profile?.weather?.temperatureC,
      profile?.currentTemperatureC,
      profile?.currentTempC,
      profile?.systemStatus?.temperatureC,
    );
    const baseline14dC = pickNumber(
      weatherContext?.baselineDewPoint14dC,
      profile?.weather?.baseline14dC,
      profile?.temperatureBaseline14dC,
      profile?.baseline14dC,
      profile?.systemStatus?.baseline14dC,
    );
    const impactDeltaC = pickNumber(
      weatherContext?.climateShockDeltaC,
      profile?.weather?.impactDeltaC,
      profile?.temperatureImpactDeltaC,
      profile?.impactDeltaC,
      profile?.systemStatus?.impactDeltaC,
      currentTempC != null && baseline14dC != null ? currentTempC - baseline14dC : null,
    );
    const heatAdaptationSecPerKm = pickNumber(
      weatherContext?.pacePenaltySecPerKm,
      profile?.weather?.heatAdaptationSecPerKm,
      profile?.heatAdaptationSecPerKm,
      profile?.systemStatus?.heatAdaptationSecPerKm,
      0,
    );
    const todayTempShiftC = pickNumber(
      weatherContext?.climateShockDeltaC,
      profile?.weather?.todayTempShiftC,
      profile?.todayTempShiftC,
      profile?.systemStatus?.todayTempShiftC,
      impactDeltaC,
    );
    return {
      available: weatherContext?.available ?? false,
      currentTempC,
      baseline14dC,
      impactDeltaC,
      heatAdaptationSecPerKm,
      todayTempShiftC,
      acclimatizationDay: weatherContext?.acclimatizationDay ?? null,
      acclimatizationStatus: weatherContext?.acclimatizationStatus ?? null,
      message: weatherContext?.message ?? '',
    };
  }, [profile, weatherContext]);

  const heatPaceBarPct = useMemo(() => {
    const sec = systemStatus.heatAdaptationSecPerKm ?? 0;
    return Math.max(0, Math.min(100, ((sec + 30) / 60) * 100));
  }, [systemStatus.heatAdaptationSecPerKm]);

  /** Maps °C shift vs 14d baseline to bar fill. ±15°C → 0–100% so typical days do not peg the bar. */
  const tempShiftBarPct = useMemo(() => {
    const delta = systemStatus.todayTempShiftC;
    if (!Number.isFinite(delta)) return 0;
    return Math.max(0, Math.min(100, ((delta + 15) / 30) * 100));
  }, [systemStatus.todayTempShiftC]);

  function formatTemp(value, digits = 1) {
    if (!Number.isFinite(value)) return '—';
    return `${value.toFixed(digits)}°C`;
  }

  function formatSignedTemp(value, digits = 1) {
    if (!Number.isFinite(value)) return '—';
    const signed = value >= 0 ? `+${value.toFixed(digits)}` : value.toFixed(digits);
    return `${signed}°C`;
  }

  function formatSignedPaceSec(value) {
    if (!Number.isFinite(value)) return `— ${t('analysis.chart_unit_seconds_km')}`;
    const rounded = Math.round(value);
    const signed = rounded >= 0 ? `+${rounded}` : `${rounded}`;
    return `${signed} ${t('analysis.chart_unit_seconds_km')}`;
  }

  const preferFahrenheit = useMemo(
    () => typeof navigator !== 'undefined' && /^en-?US/i.test(navigator.language || ''),
    [],
  );

  function formatAmbientTemp(value) {
    if (!Number.isFinite(value)) return '--';
    if (preferFahrenheit) return `${Math.round((value * 9) / 5 + 32)}°F`;
    return `${Math.round(value)}°C`;
  }

  function displayMetricTemp(value, digits = 1) {
    if (!Number.isFinite(value)) return '--';
    return `${Number(value).toFixed(digits)}°C`;
  }

  function displaySignedMetricTemp(value, digits = 1) {
    if (!Number.isFinite(value)) return '--';
    const signed = value >= 0 ? `+${Number(value).toFixed(digits)}` : Number(value).toFixed(digits);
    return `${signed}°C`;
  }

  function displaySignedPace(value) {
    if (!Number.isFinite(value)) return `-- ${t('analysis.chart_unit_seconds_km')}`;
    const rounded = Math.round(value);
    const signed = rounded >= 0 ? `+${rounded}` : `${rounded}`;
    return `${signed} ${t('analysis.chart_unit_seconds_km')}`;
  }

  // Personal Records
  const personalRecords = (() => {
    if (runs.length === 0) return null;

    // Standard race distances (km)
    const PR_DISTANCES = [
      { key: '1km', label: '1 km', dist: 1 },
      { key: '3km', label: '3 km', dist: 3 },
      { key: '5km', label: '5K', dist: 5 },
      { key: '10km', label: '10K', dist: 10 },
      { key: 'half', label: 'Half', dist: 21.0975 },
      { key: 'marathon', label: 'Marathon', dist: 42.195 },
    ];

    // Find best time for each distance category
    // A run qualifies if its distance is within ±10% of the target
    const records = {};
    for (const pr of PR_DISTANCES) {
      const lower = pr.dist * 0.9;
      const upper = pr.dist * 1.1;
      let best = null;
      for (const run of runs) {
        const km = run.distanceKm || 0;
        const sec = run.movingTimeSeconds || 0;
        if (km >= lower && km <= upper && sec > 0) {
          // Normalize pace to exact distance for fair comparison
          const normalizedSec = Math.round((sec / km) * pr.dist);
          if (!best || normalizedSec < best.time) {
            best = {
              time: normalizedSec,
              rawTime: sec,
              km,
              date: run.startTime || run.startDate,
              name: run.name,
              pace: sec / km,
            };
          }
        }
      }
      if (best) records[pr.key] = best;
    }

    // Overall stats
    let longestRun = null;
    let fastestPace = null;
    let mostElevation = null;
    for (const run of runs) {
      const km = run.distanceKm || 0;
      const sec = run.movingTimeSeconds || 0;
      if (km > 0 && (!longestRun || km > longestRun.km)) {
        longestRun = { km, date: run.startTime || run.startDate, name: run.name };
      }
      if (km >= 1 && sec > 0) {
        const pace = sec / km;
        if (!fastestPace || pace < fastestPace.pace) {
          fastestPace = { pace, km, date: run.startTime || run.startDate, name: run.name };
        }
      }
      if (run.totalElevationGain > 0 && (!mostElevation || run.totalElevationGain > mostElevation.gain)) {
        mostElevation = { gain: run.totalElevationGain, date: run.startTime || run.startDate, name: run.name };
      }
    }

    return { distances: PR_DISTANCES, records, longestRun, fastestPace, mostElevation };
  })();

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Name modal
  async function handleSaveName(e) {
    e.preventDefault();
    setNameStatus('');
    try {
      await apiFetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayNameInput }),
      });
      setProfile(prev => ({ ...prev, displayName: displayNameInput }));
      setNameModalOpen(false);
    } catch {
      setNameStatus(t('profile.name_save_failed'));
    }
  }

  // Import modal
  async function handleImport(e) {
    e.preventDefault();
    setImportStatus('');
    const formData = new FormData();
    let hasFiles = false;

    if (fitExportFiles) {
      for (const f of fitExportFiles) { formData.append('exports', f); hasFiles = true; }
    }
    if (corosFiles) {
      for (const f of corosFiles) { formData.append('coros', f); hasFiles = true; }
    }
    if (huaweiFiles) {
      for (const f of huaweiFiles) { formData.append('huawei', f); hasFiles = true; }
    }
    if (!hasFiles) return;

    try {
      const res = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      setActiveImportModal(null);
      loadActivities();
      renderHeatmap(selectedYear || null);
    } catch {
      setImportStatus(t('profile.import_failed'));
    }
  }

  function openManualImportFromGarmin() {
    if (garminImporting) return;
    setActiveImportModal('manual');
  }

  async function handleGarminImport(e) {
    e.preventDefault();
    if (!garminEmail.trim() || !garminPassword.trim()) return;
    setGarminImporting(true);
    setGarminStatus('');
    setGarminStatusType('');

    try {
      const res = await apiFetch('/api/garmin/connect/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garminEmail: garminEmail.trim(),
          garminPassword: garminPassword,
          limit: garminLimit,
        }),
      });

      if (res.status === 409) {
        setGarminStatus(t('profile.garmin_connect_already_running'));
        setGarminStatusType('warn');
        setGarminImporting(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('profile.garmin_connect_failed'));
      }

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 120;
      const poll = async () => {
        if (attempts >= maxAttempts) {
          setGarminStatus(t('profile.garmin_connect_failed'));
          setGarminStatusType('error');
          setGarminImporting(false);
          return;
        }
        attempts++;

        try {
          const statusData = await apiJson('/api/garmin/connect/import/status');
          if (statusData.active) {
            const progress = statusData.importedRuns > 0
              ? t('profile.garmin_connect_progress_count', { count: statusData.importedRuns })
              : t('profile.garmin_connect_importing');
            setGarminStatus(progress);
            setGarminStatusType('info');
            setTimeout(poll, 2000);
            return;
          }

          setGarminImporting(false);
          if (statusData.status === 'COMPLETED') {
            if (statusData.importedRuns > 0) {
              setGarminStatus(
                t('profile.garmin_connect_success')
                  .replace('{imported}', statusData.importedRuns)
                  .replace('{points}', statusData.importedPoints)
              );
              setGarminStatusType('success');
              loadActivities();
              renderHeatmap(selectedYear || null);
            } else {
              setGarminStatus(statusData.message || t('profile.garmin_connect_no_runs'));
              setGarminStatusType('info');
            }
          } else if (statusData.status === 'FAILED') {
            setGarminStatus(statusData.message || t('profile.garmin_connect_failed'));
            setGarminStatusType('error');
          }
        } catch {
          setTimeout(poll, 3000);
        }
      };

      setTimeout(poll, 3000);
    } catch (err) {
      setGarminStatus(err.message || t('profile.garmin_connect_failed'));
      setGarminStatusType('error');
      setGarminImporting(false);
    }
  }

  return (
    <AuthenticatedPageChrome
      bodyClassName="classic-profile-page"
      profile={profile}
      menuActions={{
        onChangeName: () => { setDisplayNameInput(profile?.displayName || ''); setNameModalOpen(true); },
        onImportData: () => setActiveImportModal('garmin'),
      }}
    >

      <main className="dashboard-container">
        <section className="profile-hero-strip">
          <MetricCard
            tone="accent"
            label={t('profile.weekly_mileage')}
            value={`${unitDistance.toFixed(1)} ${distanceUnitShort}`}
            hint={t('profile.analysis_hint')}
          />
          <MetricCard
            label={t('profile.avg_pace')}
            value={avgPaceStr}
            hint={t('profile.run_count', { count: totalRuns })}
          />
          <MetricCard
            label={t('profile.today_run_title')}
            value={todayRecommendation.type}
            hint={todayRecommendation.distance}
          />
          <MetricCard
            tone="success"
            label={t('profile.vo2_card_title')}
            value={profileVdot > 0 ? profileVdot.toFixed(1) : '--'}
            hint={profileVdot > 0 ? t('profile.vo2_card_subtitle') : t('profile.vo2_no_data')}
          />
        </section>

        {stravaSyncNotice && (
          <section className={`card strava-sync-notice strava-sync-notice--${stravaSyncNotice.tone}`}>
            <div className="strava-sync-notice__icon" aria-hidden="true">
              <RewardGlyph icon={stravaSyncNotice.tone === 'error' ? 'streak' : stravaSyncNotice.tone === 'warning' ? 'bridge' : 'medal'} />
            </div>
            <div className="strava-sync-notice__copy">
              <strong>{t('profile.strava_sync_status_title')}</strong>
              <p>{stravaSyncNotice.message}</p>
            </div>
          </section>
        )}

        {/* Heatmap */}
        <SectionCard
          className="heatmap-section"
          title={t('profile.heatmap')}
          subtitle={heatmapSummary}
          actions={(
            <select
              className="filter-dropdown"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              <option value="">{t('profile.heatmap_all_time')}</option>
              {years.map(y => (
                <option key={y} value={y}>{y} {t('profile.season_suffix')}</option>
              ))}
            </select>
          )}
        >
          <div className="heatmap-map-shell">
            <div ref={mapRef} className="heatmap-map-canvas" />
            {rewardShowcase.mapHighlights.length > 0 && (
              <div className="heatmap-landmark-overlay" aria-hidden="true">
                {rewardShowcase.mapHighlights.map((highlight) => (
                  <div key={highlight.key} className={`heatmap-landmark-chip heatmap-landmark-chip--${highlight.key}`}>
                    <span className="heatmap-landmark-chip__icon">
                      <RewardGlyph icon={highlight.icon} />
                    </span>
                    <span className="heatmap-landmark-chip__label">{highlight.label}</span>
                    <span className="heatmap-landmark-chip__count">{highlight.count}</span>
                  </div>
                ))}
              </div>
            )}
            {heatmapEmpty && <div className="heatmap-empty-state">{t('profile.heatmap_empty')}</div>}
          </div>
          <div className="heatmap-scale-strip" aria-hidden="true">
            <span>{t('profile.heatmap_scale_low')}</span>
            <div className="heatmap-scale-bar" />
            <span>{t('profile.heatmap_scale_high')}</span>
          </div>
        </SectionCard>

        <SectionCard
          className="reward-section"
          title={t('profile.rewards_title')}
          subtitle={t('profile.rewards_subtitle')}
        >
          <div className="reward-grid">
            {rewardShowcase.earnedRewards.length > 0 ? rewardShowcase.earnedRewards.map((reward) => (
              <article key={reward.id} className="reward-card reward-card--earned">
                <div className="reward-card__icon">
                  <RewardGlyph icon={reward.icon} />
                </div>
                <div className="reward-card__body">
                  <h3>{reward.title}</h3>
                  <p>{reward.subtitle}</p>
                </div>
                <span className="reward-card__badge">{t('profile.rewards_earned')}</span>
              </article>
            )) : (
              <div className="reward-empty-state">{t('profile.rewards_empty')}</div>
            )}
          </div>
          {rewardShowcase.upcomingRewards.length > 0 && (
            <div className="reward-upcoming">
              <div className="reward-upcoming__title">{t('profile.rewards_next')}</div>
              <div className="reward-grid reward-grid--upcoming">
                {rewardShowcase.upcomingRewards.map((reward) => (
                  <article key={reward.id} className="reward-card reward-card--locked">
                    <div className="reward-card__icon">
                      <RewardGlyph icon={reward.icon} />
                    </div>
                    <div className="reward-card__body">
                      <h3>{reward.title}</h3>
                      <p>{reward.subtitle}</p>
                    </div>
                    <span className="reward-card__badge">{t('profile.rewards_locked')}</span>
                  </article>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {activeWeeklyFlashcard && (
          <section
            className="card weekly-flashcard"
            onClick={() => setWeeklyFlashIndex((prev) => (prev + 1) % weeklyFlashcards.length)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setWeeklyFlashIndex((prev) => (prev + 1) % weeklyFlashcards.length);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t('profile.weekly_flash.aria_label')}
          >
            <div className="weekly-flashcard-copy">
              <span className="weekly-flashcard-eyebrow">{activeWeeklyFlashcard.eyebrow}</span>
              <h3>{activeWeeklyFlashcard.title}</h3>
              <p>{activeWeeklyFlashcard.body}</p>
            </div>
            <div className="weekly-flashcard-side">
              <strong>{activeWeeklyFlashcard.accent}</strong>
              <span>{t('profile.weekly_flash.tap_next')}</span>
              <div className="weekly-flashcard-dots" aria-hidden="true">
                {weeklyFlashcards.map((_, index) => (
                  <span
                    key={index}
                    className={`weekly-flashcard-dot${index === weeklyFlashIndex ? ' active' : ''}`}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Bottom Grid */}
        <div className="bottom-grid profile-layout-grid">
          <section className="card data-analyze-section analysis-split-card">
            <div
              className="analysis-primary-section"
              onClick={() => navigate('/analysis')}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate('/analysis');
                }
              }}
              title={t('profile.analysis_title_attr')}
            >
              <div className="top-link-row">
                <h2>{t('profile.analysis_title')}</h2>
                <span className="card-cta">&rarr;</span>
              </div>
              <div className="stat-block">
                <span className="stat-label">{t('profile.weekly_mileage')}</span>
                <span className="stat-value">{unitDistance.toFixed(1)} <small>{unitLabel}</small></span>
              </div>
              <div className="stat-block">
                <span className="stat-label">{t('profile.avg_pace')}</span>
                <span className="stat-value">{avgPaceStr}</span>
              </div>
              <p className="analysis-hint">{t('profile.analysis_hint')}</p>
            </div>

            <div className="analysis-vo2-section" aria-label={t('profile.vo2_card_title')}>
              <div
                className="analysis-vo2-clickable"
                onClick={() => navigate('/analysis')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate('/analysis');
                  }
                }}
                role="link"
                tabIndex={0}
                title={t('profile.vo2_card_cta')}
              >
                <div className="analysis-vo2-header">
                  <h3>{t('profile.vo2_card_title')}</h3>
                  <span className="card-cta" aria-hidden="true">&rarr;</span>
                </div>
                <p className="analysis-vo2-subtitle">{t('profile.vo2_card_subtitle')}</p>
                {profileVdot > 0 ? (
                  <>
                    <div className="analysis-vo2-value-row">
                      <span className="analysis-vo2-value">{profileVdot.toFixed(1)}</span>
                      <span className="analysis-vo2-unit">{t('profile.vo2_unit_short')}</span>
                    </div>
                    <p className="analysis-vo2-copy">{t('profile.vo2_card_copy')}</p>
                  </>
                ) : (
                  <p className="analysis-vo2-empty">{t('profile.vo2_no_data')}</p>
                )}
              </div>

              {profileVdot > 0 && vo2ProgressChart && vo2ProgressChart.datasets[0].data.length > 0 && (
                <div className="analysis-vo2-chart-wrap">
                  <p className="analysis-vo2-chart-title">{t('profile.vo2_chart_heading')}</p>
                  <div className="analysis-vo2-chart-canvas">
                    <Scatter data={vo2ProgressChart} options={vo2ChartOptions} />
                  </div>
                </div>
              )}

              <div
                className="analysis-vo2-footer analysis-vo2-clickable"
                onClick={() => navigate('/analysis')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate('/analysis');
                  }
                }}
                role="link"
                tabIndex={0}
              >
                {t('profile.vo2_card_cta')}
              </div>
            </div>

            <div
              className="analysis-recommend-section analysis-recommend-link"
              onClick={() => navigate('/today-run')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate('/today-run');
                }
              }}
              role="button"
              tabIndex={0}
              title={t('profile.today_run_open_details')}
            >
              <div className="analysis-recommend-header">
                <div>
                  <h3>{t('profile.today_run_title')}</h3>
                  <p>{t('profile.today_run_copy')}</p>
                </div>
                <div className="analysis-recommend-header-actions">
                  <span className={`analysis-recommend-pill tone-${recommendationTone.key}`}>{todayRecommendation.type}</span>
                  <span className="analysis-recommend-arrow" aria-hidden="true">&rarr;</span>
                </div>
              </div>

              <div className={`analysis-recommend-type-card tone-${recommendationTone.key}`}>
                <span className="analysis-recommend-type-icon" aria-hidden="true">{recommendationTone.icon}</span>
                <div className="analysis-recommend-type-copy">
                  <span className="stat-label">{t('profile.today_run_type_label')}</span>
                  <strong>{todayRecommendation.type}</strong>
                </div>
              </div>

              <div className="analysis-recommend-grid">
                <article className="analysis-recommend-card">
                  <span className="stat-label">{t('profile.today_run_focus')}</span>
                  <strong>{todayRecommendation.title}</strong>
                </article>
                <article className="analysis-recommend-card">
                  <span className="stat-label">{t('profile.today_run_distance')}</span>
                  <strong>{todayRecommendation.distance}</strong>
                </article>
                <article className="analysis-recommend-card">
                  <span className="stat-label">{t('profile.today_run_pace')}</span>
                  <strong>{todayRecommendation.pace}</strong>
                </article>
              </div>

              <p className="analysis-recommend-purpose">{todayRecommendation.purpose}</p>
              <div className="analysis-recommend-link-copy">{t('profile.today_run_open_details')}</div>
            </div>
          </section>

          <div className="right-column">
            <SectionCard
              className="recent-running-section"
              title={t('profile.recent_runs')}
              actions={
                <button type="button" className="btn-secondary recent-runs-link-btn" onClick={() => navigate('/runs')}>
                  {t('profile.view_history')}
                </button>
              }
            >
              <ul className="run-list">
                {runs.length === 0 ? (
                  <div className="run-empty-state">
                    <div className="loading-text">{t('profile.syncing_runs')}</div>
                  </div>
                ) : (
                  runs.slice(0, 4).map((run, i) => {
                    const date = new Date(run.startTime || run.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    const mins = Math.floor((run.movingTimeSeconds || 0) / 60);
                    const secs = Math.min(59, Math.round((run.movingTimeSeconds || 0) % 60));
                    return (
                      <li key={i} className="run-item run-item-clickable" onClick={() => navigate('/runs')}>
                        <div className="run-info">
                          <strong>{run.name || 'Run'}</strong><br />
                          <span className="run-date">{date}</span>
                        </div>
                        <div className="run-stats run-stats-accent">
                          {isMile ? ((run.distanceKm || 0) / 1.60934).toFixed(1) : (run.distanceKm || 0).toFixed(1)} {distanceUnitShort} &bull; {mins}:{String(secs).padStart(2, '0')}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </SectionCard>

            {/* Subscription */}
            {aiQuota && (
              <section className="card subscription-section">
                {checkoutBanner && (
                  <div
                    className={
                      checkoutBanner === 'success'
                        ? 'subscription-toast subscription-toast--success'
                        : 'subscription-toast subscription-toast--muted'
                    }
                    role="status"
                  >
                    <span>{checkoutBanner === 'success' ? t('profile.subscription_checkout_success') : t('profile.subscription_checkout_cancel')}</span>
                    <button
                      type="button"
                      className="subscription-toast-close"
                      onClick={() => setCheckoutBanner(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
                <h2 className="section-title-with-gap">{t('profile.subscription_title')}</h2>
                <div
                  className="subscription-card subscription-card--clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSubscriptionModalOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSubscriptionModalOpen(true);
                    }
                  }}
                >
                  <div className="subscription-tier-row">
                    <span className={`subscription-badge ${aiQuota.tier === 'PRO' ? 'subscription-badge-pro' : 'subscription-badge-free'}`}>
                      {aiQuota.tier === 'PRO' ? 'PRO' : 'FREE'}
                    </span>
                    {aiQuota.tier !== 'PRO' && !aiQuota.admin && aiQuota.experiencePhase === 'NEW_USER' && (
                      <span className="subscription-user-phase">{t('profile.user_tag_new')}</span>
                    )}
                    {aiQuota.tier !== 'PRO' && !aiQuota.admin && aiQuota.experiencePhase === 'REGULAR_USER' && (
                      <span className="subscription-user-phase">{t('profile.user_tag_regular')}</span>
                    )}
                    {aiQuota.tier === 'PRO' && aiQuota.proExpiresAt && (
                      <span className="subscription-expires">{t('profile.pro_expires', { date: new Date(aiQuota.proExpiresAt).toLocaleDateString() })}</span>
                    )}
                  </div>
                  <div className="subscription-quota-info">
                    {aiQuota.admin ? (
                      <p className="subscription-detail">{t('profile.ai_unlimited')}</p>
                    ) : aiQuota.tier === 'PRO' ? (
                      <p className="subscription-detail">{t('profile.ai_pro_usage', { used: aiQuota.monthlyUsed, limit: aiQuota.monthlyLimit })}</p>
                    ) : aiQuota.quotaType === 'new_user' ? (
                      <p className="subscription-detail">{t('profile.ai_new_user_usage', { totalAfter: aiQuota.userFreeTotal ?? 3 })}</p>
                    ) : (
                      <p className="subscription-detail">{t('profile.ai_user_free_usage', { remaining: aiQuota.scansRemaining, total: aiQuota.userFreeTotal ?? 3 })}</p>
                    )}
                  </div>
                  {aiQuota.tier !== 'PRO' && !aiQuota.admin && (
                    <div className="subscription-upgrade">
                      <p className="subscription-upgrade-hint">{t('profile.upgrade_hint')}</p>
                    </div>
                  )}
                  <p className="subscription-click-hint">{t('profile.subscription_click_hint')}</p>
                </div>
              </section>
            )}

            {/* Connected Services */}
            <section className="card connected-services-section">
              <h2 className="section-title-with-gap">{t('profile.connected_services')}</h2>

              {/* Garmin Connect — account-based import */}
              <div className="service-row service-row--primary">
                <div className="service-icon service-icon--garmin">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 7v7" />
                    <path d="m9.5 11.5 2.5 2.5 2.5-2.5" />
                    <path d="M8 18h8" />
                  </svg>
                </div>
                <div className="service-info">
                  <strong>{t('profile.garmin_connect_title')}</strong>
                  <span className="service-status service-status-off">{t('profile.garmin_connect_status')}</span>
                </div>
                <div className="service-action">
                  <button className="btn-service btn-service-connect" type="button" onClick={() => setActiveImportModal('garmin')}>
                    {t('profile.garmin_connect_import')}
                  </button>
                </div>
              </div>
              <p className="service-hint">{t('profile.garmin_connect_hint')}</p>

              {/* COROS — file import */}
              <div className="service-row service-row-separated">
                <div className="service-icon service-icon--coros">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </div>
                <div className="service-info">
                  <strong>{t('profile.coros_watch_title')}</strong>
                  <span className="service-status service-status-off">{t('profile.coros_watch_status')}</span>
                </div>
                <div className="service-action">
                  <button className="btn-service btn-service-connect" type="button" onClick={() => setActiveImportModal('manual')}>
                    {t('profile.watch_import_files')}
                  </button>
                </div>
              </div>
              <p className="service-hint">{t('profile.coros_watch_hint')}</p>

              {/* Huawei Health — file import */}
              <div className="service-row service-row-offset">
                <div className="service-icon service-icon--huawei">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="5" width="12" height="14" rx="3" />
                    <path d="M9 12h6M12 9v6" />
                  </svg>
                </div>
                <div className="service-info">
                  <strong>{t('profile.huawei_watch_title')}</strong>
                  <span className="service-status service-status-off">{t('profile.huawei_watch_status')}</span>
                </div>
                <div className="service-action">
                  <button className="btn-service btn-service-connect" type="button" onClick={() => setActiveImportModal('manual')}>
                    {t('profile.watch_import_files')}
                  </button>
                </div>
              </div>
              <p className="service-hint">{t('profile.huawei_watch_hint')}</p>
            </section>

            <section className="card running-shoes-section running-shoes-clickable" onClick={() => navigate('/shoes')}>
              <div className="card-header card-header-gap">
                <h2 className="section-title-reset">{t('profile.gear_tracker')}</h2>
                <span className="card-link-accent">
                  {t('profile.view_all_shoes')}
                </span>
              </div>
              {profileShoes.length === 0 ? (
                <div className="run-empty-state">
                  <div className="loading-text">{t('profile.no_shoes')}</div>
                </div>
              ) : (
                <>
                  <p className="shoe-count-copy">
                    {t('profile.shoe_count', { count: profileShoes.filter(s => !s.retired).length })}
                  </p>
                  {profileShoes.slice(0, 3).map(shoe => {
                    const current = shoe.currentDistanceKm || 0;
                    const max = shoe.maxDistanceKm || 650;
                    const pct = Math.min(100, (current / max) * 100);
                    const name = [shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.nickname || '—';
                    return (
                      <div key={shoe.id} className="shoe-tracker">
                        <div className="shoe-info">
                          <strong>{name}</strong>
                          {shoe.isPrimary && <span className="shoe-primary-star">★</span>}
                        </div>
                        <div className="mileage-bar-container"><div className="mileage-bar" style={{ width: `${pct}%` }} /></div>
                        <span className="mileage-text">
                          {(isMile ? current / 1.60934 : current).toFixed(1)} / {(isMile ? max / 1.60934 : max).toFixed(0)} {distanceUnitShort}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          </div>
        </div>

        {/* Daily Running Steps */}
        <section className="card daily-steps-section">
          <h2>{t('profile.daily_steps')}</h2>
          <div className="steps-summary">
            <div className="steps-stat">
              <span className="steps-stat-value">{todaySteps.steps.toLocaleString()}</span>
              <span className="steps-stat-label">{t('profile.steps_today')}</span>
            </div>
            <div className="steps-stat">
              <span className="steps-stat-value">{weekSteps.toLocaleString()}</span>
              <span className="steps-stat-label">{t('profile.steps_week')}</span>
            </div>
            <div className="steps-stat">
              <span className="steps-stat-value">{isMile ? (todaySteps.km / 1.60934).toFixed(1) : todaySteps.km.toFixed(1)} {unitLabel}</span>
              <span className="steps-stat-label">{t('profile.steps_distance')}</span>
            </div>
          </div>
          <div className="steps-chart">
            {dailySteps.map((d, i) => {
              const pct = maxSteps > 0 ? (d.steps / maxSteps) * 100 : 0;
              const isToday = i === dailySteps.length - 1;
              const dayLabel = d.date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { weekday: 'narrow' });
              const dateLabel = `${d.date.getMonth() + 1}/${d.date.getDate()}`;
              return (
                <div key={d.key} className={`steps-bar-col${isToday ? ' steps-bar-today' : ''}`}>
                  <span className="steps-bar-count">{d.steps > 0 ? d.steps.toLocaleString() : ''}</span>
                  <div className="steps-bar-track">
                    <div
                      className={`steps-bar-fill${d.steps === 0 ? ' steps-bar-empty' : ''}`}
                      style={{ height: `${Math.max(d.steps > 0 ? 4 : 0, pct)}%` }}
                    />
                  </div>
                  <span className="steps-bar-day">{dayLabel}</span>
                  <span className="steps-bar-date">{dateLabel}</span>
                </div>
              );
            })}
          </div>
          <p className="steps-hint">{t('profile.steps_hint')}</p>
        </section>

        {/* Calories — sync or distance-based estimate */}
        <section className="card calories-section">
          <h2>{t('profile.calories_title')}</h2>
          <div className="calories-summary">
            <div className="calories-stat">
              <span className="calories-stat-value">{caloriesSummary.today.toLocaleString()}</span>
              <span className="calories-stat-label">{t('profile.calories_today')}</span>
              <span className="calories-stat-unit">{t('profile.calories_unit')}</span>
            </div>
            <div className="calories-stat">
              <span className="calories-stat-value">{caloriesSummary.week7.toLocaleString()}</span>
              <span className="calories-stat-label">{t('profile.calories_week')}</span>
              <span className="calories-stat-unit">{t('profile.calories_unit')}</span>
            </div>
            <div className="calories-stat">
              <span className="calories-stat-value">{caloriesSummary.week28.toLocaleString()}</span>
              <span className="calories-stat-label">{t('profile.calories_month')}</span>
              <span className="calories-stat-unit">{t('profile.calories_unit')}</span>
            </div>
            <div className="calories-stat calories-stat--total">
              <span className="calories-stat-value">{caloriesSummary.total.toLocaleString()}</span>
              <span className="calories-stat-label">{t('profile.calories_total')}</span>
              <span className="calories-stat-unit">{t('profile.calories_unit')}</span>
            </div>
          </div>
          <div className="calories-chart">
            {caloriesSummary.dailyCalories.map((d, i) => {
              const pct = maxDailyKcal > 0 ? (d.kcal / maxDailyKcal) * 100 : 0;
              const isToday = i === caloriesSummary.dailyCalories.length - 1;
              const dayLabel = d.date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { weekday: 'narrow' });
              const dateLabel = `${d.date.getMonth() + 1}/${d.date.getDate()}`;
              return (
                <div key={d.key} className={`calories-bar-col${isToday ? ' calories-bar-today' : ''}`}>
                  <span className="calories-bar-count">{d.kcal > 0 ? d.kcal.toLocaleString() : ''}</span>
                  <div className="calories-bar-track">
                    <div
                      className={`calories-bar-fill${d.kcal === 0 ? ' calories-bar-empty' : ''}`}
                      style={{ height: `${Math.max(d.kcal > 0 ? 4 : 0, pct)}%` }}
                    />
                  </div>
                  <span className="calories-bar-day">{dayLabel}</span>
                  <span className="calories-bar-date">{dateLabel}</span>
                </div>
              );
            })}
          </div>
          <p className="calories-hint">{t('profile.calories_hint')}</p>
        </section>

        {/* Personal Records */}
        {personalRecords && (
          <section className="card pr-section">
            <h2>{t('profile.pr_title')}</h2>

            {/* Overall records row */}
            <div className="pr-highlights">
              {personalRecords.longestRun && (
                <div className="pr-highlight-card">
                  <span className="pr-highlight-icon">📏</span>
                  <span className="pr-highlight-value">{isMile ? (personalRecords.longestRun.km / 1.60934).toFixed(1) : personalRecords.longestRun.km.toFixed(1)} {unitLabel}</span>
                  <span className="pr-highlight-label">{t('profile.pr_longest')}</span>
                  <span className="pr-highlight-date">
                    {new Date(personalRecords.longestRun.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              {personalRecords.fastestPace && (
                <div className="pr-highlight-card">
                  <span className="pr-highlight-icon">⚡</span>
                  <span className="pr-highlight-value">{formatTime(isMile ? personalRecords.fastestPace.pace * 1.60934 : personalRecords.fastestPace.pace)} {isMile ? '/mi' : '/km'}</span>
                  <span className="pr-highlight-label">{t('profile.pr_fastest_pace')}</span>
                  <span className="pr-highlight-date">
                    {new Date(personalRecords.fastestPace.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              {personalRecords.mostElevation && (
                <div className="pr-highlight-card">
                  <span className="pr-highlight-icon">⛰️</span>
                  <span className="pr-highlight-value">{Math.round(personalRecords.mostElevation.gain)} m</span>
                  <span className="pr-highlight-label">{t('profile.pr_most_elevation')}</span>
                  <span className="pr-highlight-date">
                    {new Date(personalRecords.mostElevation.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* Race distance PRs */}
            <div className="pr-table">
              <div className="pr-table-header">
                <span>{t('profile.pr_distance')}</span>
                <span>{t('profile.pr_time')}</span>
                <span>{t('profile.pr_pace')}</span>
                <span>{t('profile.pr_date')}</span>
              </div>
              {personalRecords.distances.map(pr => {
                const rec = personalRecords.records[pr.key];
                return (
                  <div key={pr.key} className={`pr-table-row${rec ? '' : ' pr-table-row-empty'}`}>
                    <span className="pr-table-dist">{pr.label}</span>
                    {rec ? (
                      <>
                        <span className="pr-table-time">{formatTime(rec.time)}</span>
                        <span className="pr-table-pace">{formatTime(isMile ? rec.pace * 1.60934 : rec.pace)} {isMile ? '/mi' : '/km'}</span>
                        <span className="pr-table-date">
                          {new Date(rec.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </>
                    ) : (
                      <span className="pr-table-none pr-table-none-wide">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="card profile-system-status-section">
          <div className="card-header profile-system-status-head">
            <h2>{t('profile.system_status_title')}</h2>
          </div>

          <div className="profile-system-engine">
            <div className="profile-system-engine-title">
              <span className="profile-system-icon" aria-hidden="true">☀️</span>
              <strong>{t('profile.system_heat_engine_title')}</strong>
            </div>
            <p className="profile-system-engine-copy">
              {t('profile.system_heat_engine_line_1', {
                current: formatTemp(systemStatus.currentTempC, 1),
                baseline: formatTemp(systemStatus.baseline14dC, 2),
              })}
            </p>
            <p className="profile-system-engine-copy">
              {t('profile.system_heat_engine_line_2', {
                delta: formatSignedTemp(systemStatus.impactDeltaC, 2),
              })}
            </p>
          </div>

          <div className="profile-system-bars">
            <article className="profile-system-bar-card">
              <div className="profile-system-bar-header">
                <span className="profile-system-bar-label">
                  <span className="profile-system-icon" aria-hidden="true">🌤️</span>
                  {t('profile.system_heat_pace_bar')}
                </span>
                <strong>{formatSignedPaceSec(systemStatus.heatAdaptationSecPerKm)}</strong>
              </div>
              <div
                className="profile-system-bar-track"
                aria-hidden="true"
                style={{ background: profileBarWarmBackground(heatPaceBarPct) }}
              />
            </article>

            <article className="profile-system-bar-card">
              <div className="profile-system-bar-header">
                <span className="profile-system-bar-label">
                  <span className="profile-system-icon" aria-hidden="true">🌡️</span>
                  {t('profile.system_today_temp_bar')}
                </span>
                <strong>{formatSignedTemp(systemStatus.todayTempShiftC, 1)}</strong>
              </div>
              <div
                className="profile-system-bar-track"
                aria-hidden="true"
                style={{ background: profileBarTempBackground(tempShiftBarPct) }}
              />
            </article>
          </div>
        </section>
        <section className="card profile-weather-section">
          <div className="profile-weather-header">
            <div className="profile-weather-copy">
              <span className="profile-weather-kicker">{t('profile.weather_card_kicker')}</span>
              <h2>{t('profile.weather_card_title')}</h2>
              <p>
                {systemStatus.message
                  || (systemStatus.available
                    ? t('profile.weather_card_subtitle')
                    : t('profile.weather_card_unavailable'))}
              </p>
            </div>

            <div className="profile-weather-now-card">
              <div className="profile-weather-now-icon">
                <WeatherGlyph
                  code={weatherSnapshot?.current?.code}
                  title={t('profile.weather_condition_label')}
                  className="profile-weather-now-glyph"
                />
              </div>
              <div className="profile-weather-now-copy">
                <span className="profile-weather-now-label">{t('profile.weather_current_label')}</span>
                <strong>{formatAmbientTemp(weatherSnapshot?.current?.temp)}</strong>
                <span className="profile-weather-now-meta">
                  {systemStatus.available
                    ? t('profile.weather_heat_day', { day: systemStatus.acclimatizationDay ?? '--' })
                    : t('common.weather_error')}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-weather-stat-strip">
            <article className="profile-weather-stat-card">
              <div className="profile-weather-stat-icon">
                <TemperatureGlyph title={t('profile.weather_current_label')} />
              </div>
              <div className="profile-weather-stat-copy">
                <span>{t('profile.weather_current_label')}</span>
                <strong>{formatAmbientTemp(weatherSnapshot?.current?.temp)}</strong>
              </div>
            </article>
            <article className="profile-weather-stat-card">
              <div className="profile-weather-stat-icon">
                <WeatherGlyph code={weatherSnapshot?.current?.code} title={t('profile.weather_baseline_label')} />
              </div>
              <div className="profile-weather-stat-copy">
                <span>{t('profile.weather_baseline_label')}</span>
                <strong>{displayMetricTemp(systemStatus.baseline14dC, 1)}</strong>
              </div>
            </article>
            <article className="profile-weather-stat-card">
              <div className="profile-weather-stat-icon">
                <TemperatureGlyph title={t('profile.weather_shift_label')} />
              </div>
              <div className="profile-weather-stat-copy">
                <span>{t('profile.weather_shift_label')}</span>
                <strong>{displaySignedMetricTemp(systemStatus.todayTempShiftC, 1)}</strong>
              </div>
            </article>
          </div>

          <div className="profile-system-engine profile-weather-engine">
            <div className="profile-system-engine-title">
              <TemperatureGlyph className="profile-system-icon" title={t('profile.system_heat_engine_title')} />
              <strong>{t('profile.system_heat_engine_title')}</strong>
            </div>
            <p className="profile-system-engine-copy">
              {t('profile.system_heat_engine_line_1', {
                current: displayMetricTemp(systemStatus.currentTempC, 1),
                baseline: displayMetricTemp(systemStatus.baseline14dC, 2),
              })}
            </p>
            <p className="profile-system-engine-copy">
              {t('profile.system_heat_engine_line_2', {
                delta: displaySignedMetricTemp(systemStatus.impactDeltaC, 2),
              })}
            </p>
          </div>

          <div className="profile-system-bars">
            <article className="profile-system-bar-card">
              <div className="profile-system-bar-header">
                <span className="profile-system-bar-label">
                  <TemperatureGlyph className="profile-system-icon" title={t('profile.system_heat_pace_bar')} />
                  {t('profile.system_heat_pace_bar')}
                </span>
                <strong>{displaySignedPace(systemStatus.heatAdaptationSecPerKm)}</strong>
              </div>
              <div
                className="profile-system-bar-track"
                aria-hidden="true"
                style={{ background: profileBarWarmBackground(heatPaceBarPct) }}
              />
            </article>

            <article className="profile-system-bar-card">
              <div className="profile-system-bar-header">
                <span className="profile-system-bar-label">
                  <WeatherGlyph code={weatherSnapshot?.current?.code} className="profile-system-icon" title={t('profile.system_today_temp_bar')} />
                  {t('profile.system_today_temp_bar')}
                </span>
                <strong>{displaySignedMetricTemp(systemStatus.todayTempShiftC, 1)}</strong>
              </div>
              <div
                className="profile-system-bar-track"
                aria-hidden="true"
                style={{ background: profileBarTempBackground(tempShiftBarPct) }}
              />
            </article>
          </div>

          <div className="profile-weather-forecast-shell">
            <div className="profile-weather-forecast-head">
              <strong>{t('common.weather_forecast')}</strong>
              <span>{t('profile.weather_forecast_hint')}</span>
            </div>
            <WeatherTemperatureBar variant="inline" onSnapshotChange={setWeatherSnapshot} />
          </div>
        </section>
      </main>

      {/* Subscription plans */}
      <Modal
        isOpen={subscriptionModalOpen && !!aiQuota}
        onClose={() => setSubscriptionModalOpen(false)}
        title={t('profile.subscription_modal_title')}
      >
        {aiQuota && (
          <>
            <p className="subscription-modal-subtitle">{t('profile.subscription_modal_subtitle')}</p>
            {aiQuota.admin && (
              <p className="subscription-modal-admin-note">{t('profile.subscription_admin_plans_note')}</p>
            )}
            <div className="subscription-plan-grid">
              <article
                className={`subscription-plan-card ${!aiQuota.admin && aiQuota.tier !== 'PRO' ? 'subscription-plan-card--current' : ''}`}
              >
                <div className="subscription-plan-card-head">
                  <span className="subscription-badge subscription-badge-free">{t('profile.subscription_tier_free_title')}</span>
                  {!aiQuota.admin && aiQuota.tier !== 'PRO' && (
                    <span className="subscription-current-pill">{t('profile.subscription_current_badge')}</span>
                  )}
                </div>
                <ul className="subscription-feature-list">
                  <li>{t('profile.subscription_free_f1')}</li>
                  <li>{t('profile.subscription_free_f2')}</li>
                  <li>{t('profile.subscription_free_f3')}</li>
                </ul>
                <p className="subscription-plan-card-foot">{t('profile.subscription_tier_free_body')}</p>
              </article>
              <article
                className={`subscription-plan-card subscription-plan-card--pro ${!aiQuota.admin && aiQuota.tier === 'PRO' ? 'subscription-plan-card--current' : ''}`}
              >
                <div className="subscription-plan-card-head">
                  <span className="subscription-badge subscription-badge-pro">{t('profile.subscription_tier_pro_title')}</span>
                  {!aiQuota.admin && aiQuota.tier === 'PRO' && (
                    <span className="subscription-current-pill">{t('profile.subscription_current_badge')}</span>
                  )}
                </div>
                <ul className="subscription-feature-list">
                  <li>{t('profile.subscription_pro_f1')}</li>
                  <li>{t('profile.subscription_pro_f2')}</li>
                  <li>{t('profile.subscription_pro_f3')}</li>
                </ul>
                {billingConfig?.priceLabel && (
                  <p className="subscription-price-label">{billingConfig.priceLabel}</p>
                )}
                <p className="subscription-price-disclaimer">{t('profile.subscription_price_disclaimer')}</p>
                <p className="subscription-plan-card-foot">{t('profile.subscription_tier_pro_body')}</p>
                {!aiQuota.admin && billingConfig?.checkoutConfigured && (
                  <div className="subscription-checkout-block" onClick={e => e.stopPropagation()}>
                    <label className="subscription-months-label">
                      <span>{t('profile.subscription_months_label')}</span>
                      <select
                        className="subscription-months-select"
                        value={subscriptionMonths}
                        onChange={e => setSubscriptionMonths(Number(e.target.value))}
                      >
                        {[1, 3, 6, 12].map(m => (
                          <option key={m} value={m}>
                            {t('profile.subscription_months_suffix', { n: m })}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-primary subscription-checkout-btn"
                      disabled={checkoutLoading}
                      onClick={startStripeCheckout}
                    >
                      {checkoutLoading ? t('profile.subscription_checkout_loading') : (aiQuota.tier === 'PRO' ? t('profile.subscription_checkout_extend') : t('profile.subscription_checkout_pro'))}
                    </button>
                    <p className="subscription-checkout-note">{t('profile.subscription_checkout_redirect_note')}</p>
                    <p className="subscription-powered-by">{t('profile.subscription_powered_by')}</p>
                  </div>
                )}
                {!aiQuota.admin && !billingConfig?.checkoutConfigured && (
                  <p className="subscription-pro-cta">{t('profile.subscription_pro_cta')}</p>
                )}
                {subscriptionCheckoutError && (
                  <div className="modal-status subscription-checkout-error">{subscriptionCheckoutError}</div>
                )}
              </article>
            </div>
          </>
        )}
      </Modal>

      {/* Name Modal */}
      <Modal isOpen={nameModalOpen} onClose={() => setNameModalOpen(false)} title={t('profile.name_modal_title')}>
        <form onSubmit={handleSaveName}>
          <label className="modal-label">{t('profile.name_label')}</label>
          <input
            type="text"
            maxLength={60}
            placeholder={t('profile.name_placeholder')}
            value={displayNameInput}
            onChange={e => setDisplayNameInput(e.target.value)}
          />
          {nameStatus && <div className="modal-status">{nameStatus}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setNameModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.save_name')}</button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setActiveImportModal(null)} title={t('profile.import_modal_title')}>
        <form onSubmit={handleImport}>
          <ImportDataGuide />
          <p className="modal-help">{t('profile.import_hint')}</p>
          <div className="import-source-grid">
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.fit_export_source_title')}</span>
                  <span className="import-source-hint">{t('profile.fit_export_source_hint')}</span>
                </div>
                <span className="import-source-tag">FIT/GPX</span>
              </div>
              <label className="modal-label">{t('profile.fit_export_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setFitExportFiles(e.target.files)} />
              <p className="selected-file-name">{fitExportFiles?.length ? t('profile.selected_files_count', { count: fitExportFiles.length }) : t('profile.no_file_selected')}</p>
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.coros_source_title')}</span>
                  <span className="import-source-hint">{t('profile.coros_source_hint')}</span>
                </div>
                <span className="import-source-tag">COROS</span>
              </div>
              <label className="modal-label">{t('profile.coros_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setCorosFiles(e.target.files)} />
              <p className="selected-file-name">{corosFiles?.length ? t('profile.selected_files_count', { count: corosFiles.length }) : t('profile.no_file_selected')}</p>
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.huawei_source_title')}</span>
                  <span className="import-source-hint">{t('profile.huawei_source_hint')}</span>
                </div>
                <span className="import-source-tag">HUAWEI</span>
              </div>
              <label className="modal-label">{t('profile.huawei_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setHuaweiFiles(e.target.files)} />
              <p className="selected-file-name">{huaweiFiles?.length ? t('profile.selected_files_count', { count: huaweiFiles.length }) : t('profile.no_file_selected')}</p>
            </section>
          </div>
          <p className="import-summary-line">{t('profile.import_batch_hint')}</p>
          {importStatus && <div className="modal-status">{importStatus}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setActiveImportModal(null)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.upload_file')}</button>
          </div>
        </form>
      </Modal>

      {/* Sync Modal */}
      {syncModalOpen && (
        <div className="modal-overlay modal-overlay-visible">
          <div className="sync-modal">
            <div className="sync-modal-header">
              <h3 className="sync-modal-title">{t('profile.sync_modal_title')}</h3>
              <span className="sync-modal-close" onClick={() => setSyncModalOpen(false)}>&#10005;</span>
            </div>
            <div className="sync-body">
              <div className="sync-col">
                <h4>{t('profile.sync_loaded_from_server')}</h4>
                <div className="sync-row">
                  <span className="sync-label sync-label-wide">{t('profile.sync_activities')}</span>
                  <div className="sync-check">&#10003;</div>
                  <span className="sync-value">{t('profile.sync_activity_count', { count: syncCount })}</span>
                </div>
              </div>
              <div className="sync-col">
                <h4>{t('profile.sync_server_processing')}</h4>
                <div className="sync-row">
                  <span className="sync-label">{t('profile.sync_database')}</span>
                  <div className="status-bar-bg">
                    <div className="status-bar-fill status-bar-full" />
                  </div>
                  <span>100%</span>
                </div>
                <div className="sync-row">
                  <span className="sync-label">{t('profile.sync_statistics')}</span>
                  <div className="status-bar-bg">
                    <div className="status-bar-fill status-bar-orange status-bar-full" />
                  </div>
                  <span>100%</span>
                </div>
              </div>
            </div>
            <div className="sync-modal-footer">
              <button
                className="btn-close-modal"
                onClick={() => setSyncModalOpen(false)}
              >
                {t('profile.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Garmin Connect Import Modal */}
      <Modal isOpen={garminModalOpen} onClose={() => { if (!garminImporting) setActiveImportModal(null); }} title={t('profile.garmin_connect_modal_title')}>
        <form onSubmit={handleGarminImport} className="garmin-import-form">
          <section className="garmin-import-hero">
            <div className="garmin-import-hero-main">
              <div className="service-icon service-icon--garmin garmin-import-hero-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 7v7" />
                  <path d="m9.5 11.5 2.5 2.5 2.5-2.5" />
                  <path d="M8 18h8" />
                </svg>
              </div>
              <div className="garmin-import-hero-copy">
                <strong>{t('profile.garmin_connect_title')}</strong>
                <p>{t('profile.garmin_connect_brand_copy')}</p>
              </div>
            </div>
            <span className="garmin-import-pill">{t('profile.garmin_connect_status')}</span>
          </section>

          <p className="garmin-credentials-note">
            {t('profile.garmin_connect_credentials_note')}
          </p>

          <div className="garmin-import-field-grid">
            <div className="garmin-import-field">
              <label className="modal-label">{t('profile.garmin_connect_email_label')}</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={garminEmail}
                onChange={e => setGarminEmail(e.target.value)}
                disabled={garminImporting}
                required
                autoComplete="username"
              />
            </div>

            <div className="garmin-import-field">
              <label className="modal-label">{t('profile.garmin_connect_password_label')}</label>
              <input
                type="password"
                value={garminPassword}
                onChange={e => setGarminPassword(e.target.value)}
                disabled={garminImporting}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="garmin-import-field">
            <label className="modal-label">{t('profile.garmin_connect_limit_label')}</label>
            <select
              value={garminLimit}
              onChange={e => setGarminLimit(Number(e.target.value))}
              disabled={garminImporting}
              className="garmin-import-limit"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          {garminStatus && (
            <div className={`garmin-import-status garmin-import-status--${garminStatusType || 'info'}`}>
              {garminStatus}
            </div>
          )}

          <div className="modal-actions garmin-import-actions">
            <button
              type="button"
              className="btn-secondary modal-button"
              onClick={() => { if (!garminImporting) setActiveImportModal(null); }}
              disabled={garminImporting}
            >
              {t('profile.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary modal-button"
              disabled={garminImporting || !garminEmail.trim() || !garminPassword.trim()}
            >
              {garminImporting ? t('profile.garmin_connect_importing') : t('profile.garmin_connect_start')}
            </button>
          </div>

          <div className="garmin-import-secondary">
            <span>{t('profile.garmin_connect_secondary_hint')}</span>
            <button
              type="button"
              className="btn-secondary modal-button garmin-import-secondary-button"
              onClick={openManualImportFromGarmin}
              disabled={garminImporting}
            >
              {t('profile.garmin_connect_secondary_manual')}
            </button>
          </div>
        </form>
      </Modal>
    </AuthenticatedPageChrome>
  );
}

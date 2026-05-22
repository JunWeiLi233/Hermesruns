import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson, getBackendBaseUrl } from '../api';
import AppIcon from '../components/AppIcon';
import CoachIdentityBadge from '../components/CoachIdentityBadge';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import TopbarUserMenu from '../components/TopbarUserMenu';
import { resolveAssignedCoach } from '../utils/coachIdentity';
import { formatDuration } from '../utils/format';
import { resolveProfileDisplayName, resolveProfileInitial } from '../utils/profileIdentity';
import { estimateCurrentVdot, predictRaceTimeCalibrated } from '../utils/vdot';
import { resolveRaceIntel } from '../utils/raceIntel';
import worldRaceCatalog from '../data/worldRaceCatalog';
import { getCachedRaceImage, resolveRaceImage, invalidateRaceImageCache } from '../utils/raceImage';
import { deriveRaceMapTrust } from '../utils/raceDetailMapTrust';
import { shouldFetchRaceElevationProfile } from '../utils/raceDetailRequestPolicy';

const DEFAULT_HERO_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAF-j8MVIZBaOa4qq1rYw7hnzMPZGyRTeaO7f5ojhfDSBPjz6qfENN3s8WjkUPksPxWqm5Ou9DlpJo50YGOg2UBflxkDa4KDh242OhPDsAcvArSXG_zW7rNjkFksE1UWJY2ki4AO2WYkbwVzRkboLxOgkaWRa_KhIs_Dc2pFWpFAG2jXxtcQ-1nBEsFwRTbNGOQQ966BWFfSM2WQabYKQuiK1MvWc5Cwq_3GzbEmLfQBtieNgbCMSZtLNIe5hGE1fGulcEWmAha60-4';
const EVENT_DAY_OVERRIDES = {
  'tokyo-marathon': 1,
  'boston-marathon': 20,
  'london-marathon': 26,
  'berlin-marathon': 27,
  'chicago-marathon': 11,
  'new-york-city-marathon': 1,
  'valencia-marathon': 6,
};
const ELEVATION_SAMPLE_INTERVAL_KM = 0.05;
let leafletModulePromise = null;

function loadLeafletModule() {
  if (!leafletModulePromise) {
    leafletModulePromise = import('leaflet').then((module) => module.default || module);
  }
  return leafletModulePromise;
}

function projectedRaceDate(race) {
  const now = new Date();
  const month = Math.max(1, Math.min(12, Number(race?.month || now.getMonth() + 1)));
  const day = EVENT_DAY_OVERRIDES[race?.id] || 15;
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day, 8, 0, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    year += 1;
  }
  return new Date(year, month - 1, day, 8, 0, 0, 0);
}

function buildCountdownParts(targetDate) {
  const remainingMs = Math.max(0, targetDate.getTime() - Date.now());
  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

function padCountdown(value) {
  return String(Math.max(0, Number(value || 0))).padStart(2, '0');
}

function buildRaceTopnavTitle(heroLabels, race) {
  const parts = [heroLabels?.primary, heroLabels?.secondary].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return race?.name || '';
}

function normalizeTileX(tileX, zoom) {
  const worldTileCount = 2 ** Math.max(0, zoom);
  return ((tileX % worldTileCount) + worldTileCount) % worldTileCount;
}

const buildStreetTileFallbackSnapshot = (map, tileUrlTemplate) => {
  if (!map || !tileUrlTemplate) return null;
  const pixelBounds = map.getPixelBounds?.();
  if (!pixelBounds) return null;
  const zoom = Math.max(0, Math.min(19, Math.round(map.getZoom?.() ?? 0)));
  const tileSize = 256;
  const worldTileCount = 2 ** zoom;
  const minTileX = Math.floor(pixelBounds.min.x / tileSize);
  const maxTileX = Math.floor((pixelBounds.max.x - 1) / tileSize);
  const minTileY = Math.floor(pixelBounds.min.y / tileSize);
  const maxTileY = Math.floor((pixelBounds.max.y - 1) / tileSize);
  const tiles = [];

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    if (tileY < 0 || tileY >= worldTileCount) continue;
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const normalizedTileX = normalizeTileX(tileX, zoom);
      tiles.push({
        key: `${zoom}-${normalizedTileX}-${tileY}`,
        url: tileUrlTemplate
          .replace('{z}', String(zoom))
          .replace('{x}', String(normalizedTileX))
          .replace('{y}', String(tileY)),
        left: (tileX * tileSize) - pixelBounds.min.x,
        top: (tileY * tileSize) - pixelBounds.min.y,
      });
    }
  }

  if (!tiles.length) return null;
  return {
    zoom,
    width: Math.max(1, pixelBounds.max.x - pixelBounds.min.x),
    height: Math.max(1, pixelBounds.max.y - pixelBounds.min.y),
    tiles,
  };
};

function buildElevationProfile(ascentMeters, courseKey, absoluteProfile) {
  if (Array.isArray(absoluteProfile) && absoluteProfile.length) {
    return absoluteProfile.map((meters, index) => ({
      key: `${courseKey || 'custom'}-${index}`,
      meters: Math.round(Number(meters || 0)),
    }));
  }

  const baseByCourse = {
    flat_city: [36, 34, 30, 28, 36, 42, 48, 38, 32, 26, 24, 34, 41, 46, 52, 34, 28, 24, 32, 40, 48, 54, 44, 36, 30],
    rolling_city: [34, 30, 26, 24, 34, 44, 54, 42, 34, 30, 28, 36, 46, 56, 62, 42, 32, 26, 34, 44, 54, 60, 48, 40, 34],
    bridge_rolling: [32, 28, 24, 22, 36, 52, 70, 48, 34, 28, 24, 30, 44, 62, 78, 46, 32, 24, 30, 40, 52, 62, 46, 34, 28],
    point_to_point: [38, 36, 34, 32, 34, 36, 40, 42, 44, 46, 50, 56, 62, 66, 70, 54, 42, 34, 28, 24, 22, 24, 26, 28, 30],
    coastal_hilly: [42, 38, 34, 28, 36, 52, 68, 56, 44, 36, 32, 40, 58, 72, 82, 58, 42, 34, 40, 54, 68, 78, 62, 48, 40],
    trail_hilly: [48, 42, 36, 32, 46, 64, 82, 68, 52, 44, 40, 50, 72, 88, 96, 70, 52, 40, 46, 62, 80, 92, 76, 58, 46],
  };

  const base = baseByCourse[courseKey] || baseByCourse.flat_city;
  const scale = Math.max(0.72, Math.min(1.38, ascentMeters / 140));
  return base.map((value, index) => ({
    key: `${courseKey}-${index}`,
    meters: Math.max(8, Math.round(value * scale)),
  }));
}

function buildElevationDistanceMarks(distanceKm, sampleCount) {
  const totalKm = (distanceKm != null && Number.isFinite(Number(distanceKm)) && Number(distanceKm) > 0)
    ? Number(distanceKm)
    : Math.max(sampleCount - 1, 1);
  if (sampleCount <= 1) return [0];

  const sampleMarks = [0];
  const sampleSteps = Math.max(1, Math.floor(totalKm / ELEVATION_SAMPLE_INTERVAL_KM));
  for (let step = 1; step <= sampleSteps; step += 1) {
    sampleMarks.push(Number((step * ELEVATION_SAMPLE_INTERVAL_KM).toFixed(3)));
  }
  const lastDistance = sampleMarks[sampleMarks.length - 1];
  if (Math.abs(totalKm - lastDistance) > 0.001) {
    sampleMarks.push(Number(totalKm.toFixed(3)));
  }

  if (sampleMarks.length === sampleCount) {
    return sampleMarks;
  }

  const step = totalKm / Math.max(sampleCount - 1, 1);
  return Array.from({ length: sampleCount }, (_, index) => Number((step * index).toFixed(3)));
}

function formatElevationMarkerLabel(km, raceTotalKm, index, totalCount) {
  const isFinish = index === totalCount - 1 && Math.abs(km - raceTotalKm) > 0.05;
  if (isFinish) return 'F';
  if (Math.abs(km - Math.round(km)) < 0.05) return String(Math.round(km));
  return km.toFixed(1);
}

function buildElevationGraph(profile, distanceKm) {
  if (!Array.isArray(profile) || profile.length === 0) {
    return null;
  }

  const raceTotalKm = (distanceKm != null && Number.isFinite(Number(distanceKm)) && Number(distanceKm) > 0)
    ? Number(distanceKm)
    : 42.195;

  const width = Math.max(960, Math.round(raceTotalKm * 28) + 68);
  const height = 260;
  const baseY = 214;
  const leftPad = 26;
  const rightPad = 20;
  const topPad = 24;
  const drawableWidth = width - leftPad - rightPad;
  const minMeters = Math.min(...profile.map((point) => Number(point.meters || 0)));
  const maxMeters = Math.max(...profile.map((point) => Number(point.meters || 0)), 1);
  const rangeMeters = Math.max(8, maxMeters - minMeters);
  const distanceMarks = buildElevationDistanceMarks(raceTotalKm, profile.length);

  const points = profile.map((point, index) => {
    const km = distanceMarks[index] ?? ((raceTotalKm * index) / Math.max(profile.length - 1, 1));
    const x = leftPad + (drawableWidth * km) / Math.max(raceTotalKm, 0.1);
    const normalized = (Number(point.meters || 0) - minMeters) / rangeMeters;
    const y = baseY - normalized * (baseY - topPad);
    return {
      ...point,
      x,
      y,
      km,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseY} L ${points[0].x.toFixed(1)} ${baseY} Z`;

  const markers = points.filter((point, index) => {
    const isFinish = index === points.length - 1;
    const roundedKm = Math.round(point.km);
    const isWholeKilometer = Math.abs(point.km - roundedKm) < 0.05;
    return isFinish || roundedKm === 0 || isWholeKilometer;
  }).map((point, markerIndex) => {
    const index = points.indexOf(point);
    const isFinish = index === points.length - 1;
    const roundedKm = Math.round(point.km);
    const isMajor = isFinish || roundedKm === 0 || roundedKm % 5 === 0;
    return {
      id: `marker-${markerIndex}`,
      x: point.x,
      y: point.y,
      value: point.meters,
      km: point.km,
      label: formatElevationMarkerLabel(point.km, raceTotalKm, index, points.length),
      isMajor,
      isFinish,
    };
  });

  return {
    width,
    height,
    baseY,
    areaPath,
    linePath,
    points,
    markers,
    peakMeters: maxMeters,
  };
}

function buildCoachInsight(t, race, raceMeta, prediction) {
  const courseTone = t(`races.intel_course_${raceMeta?.courseKey || 'flat_city'}_title`);
  if (!prediction) {
    return t('races.detail_coach_no_prediction', { course: courseTone, race: race?.name || '' });
  }
  if ((raceMeta?.predictionPenaltyPct || 0) >= 3) {
    return t('races.detail_coach_hard_course', {
      course: courseTone,
      time: formatDuration(prediction.adjustedSeconds),
    });
  }
  return t('races.detail_coach_fast_course', {
    course: courseTone,
    time: formatDuration(prediction.adjustedSeconds),
  });
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRaceHeroLabels(race) {
  const fullName = String(race?.name || '').trim();
  const city = String(race?.city || '').trim();
  if (!fullName) {
    return {
      primary: city || '',
      secondary: '',
    };
  }
  if (!city) {
    return {
      primary: fullName,
      secondary: '',
    };
  }

  const leadingCityPattern = new RegExp(`^${escapeRegex(city)}\\s+`, 'i');
  const withoutCity = fullName.replace(leadingCityPattern, '').trim();
  if (!withoutCity) {
    return {
      primary: city,
      secondary: '',
    };
  }

  const withoutLeadingCityWord = withoutCity.replace(/^city\s+/i, '').trim();
  return {
    primary: city,
    secondary: withoutLeadingCityWord || withoutCity,
  };
}

const EMPTY_COURSE_MAP = Object.freeze({
  previewImageUrl: '',
  imageUrl: '',
  overlayImageUrl: '',
  source: '',
  routeAvailable: false,
  confidence: 0,
  summary: '',
  viewportBounds: null,
  routePoints: [],
  elevationSamples: [],
  totalClimbMeters: null,
  aiAssisted: false,
});

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

function toLeafletBoundsCorners(bounds) {
  if (!bounds) return null;
  return [[bounds.south, bounds.west], [bounds.north, bounds.east]];
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
      return {
        lat,
        lng,
        label: typeof point.label === 'string' ? point.label.trim() : '',
      };
    })
    .filter(Boolean);
}

function resolveCourseMapPreviewImageUrl(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.previewImageUrl === 'string' && payload.previewImageUrl) return payload.previewImageUrl;
  if (typeof payload.imageUrl === 'string' && payload.imageUrl) return payload.imageUrl;
  if (typeof payload.sourceImageUrl === 'string' && payload.sourceImageUrl) return payload.sourceImageUrl;
  return '';
}

function normalizeCourseMapPayload(payload) {
  if (!payload || typeof payload !== 'object') return EMPTY_COURSE_MAP;
  const confidence = Math.max(0, Math.min(100, Math.round(asFiniteNumber(payload.confidence) ?? 0)));
  const totalClimbMeters = asFiniteNumber(payload.totalClimbMeters);
  return {
    previewImageUrl: resolveCourseMapPreviewImageUrl(payload),
    imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : '',
    overlayImageUrl: typeof payload.overlayImageUrl === 'string' ? payload.overlayImageUrl : '',
    source: typeof payload.source === 'string' ? payload.source : '',
    routeAvailable: payload.routeAvailable === true,
    confidence,
    summary: typeof payload.summary === 'string' ? payload.summary : '',
    viewportBounds: normalizeOverlayBounds(payload.viewportBounds),
    routePoints: normalizeRoutePoints(payload.routePoints),
    elevationSamples: Array.isArray(payload.elevationSamples)
      ? payload.elevationSamples
        .map((sample) => asFiniteNumber(sample))
        .filter((sample) => sample != null)
        .map((sample) => Math.round(sample))
      : [],
    totalClimbMeters: totalClimbMeters == null ? null : Math.round(totalClimbMeters),
    aiAssisted: payload.aiAssisted === true,
  };
}

export default function RacesDetail() {
  const { raceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [resolvedHeroImage, setResolvedHeroImage] = useState(() => getCachedRaceImage(location.state?.race || worldRaceCatalog.find((entry) => entry.id === raceId) || null).imageUrl || '');
  const [courseMapData, setCourseMapData] = useState(EMPTY_COURSE_MAP);
  const [courseMapRequestSettled, setCourseMapRequestSettled] = useState(false);
  const [elevationProfileImage, setElevationProfileImage] = useState('');
  const [elevationProfileSource, setElevationProfileSource] = useState('');
  const [elevationProfileSamples, setElevationProfileSamples] = useState([]);
  const [activeElevationPointIndex, setActiveElevationPointIndex] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [routeMapReady, setRouteMapReady] = useState(false);
  const [routeMapPainted, setRouteMapPainted] = useState(false);
  const [streetTileFallback, setStreetTileFallback] = useState(null);
  const raceDetailElevationChartRef = useRef(null);
  const raceDetailElevationStageRef = useRef(null);
  const elevationSvgRef = useRef(null);
  const routeMapRef = useRef(null);
  const routeMapInstanceRef = useRef(null);
  const tileUrl = useMemo(() => `${getBackendBaseUrl()}/api/maps/tiles/{z}/{x}/{y}.png?v=20260420b`, []);
  const fallbackTileUrl = useMemo(() => 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', []);

  const race = useMemo(() => {
    const fromState = location.state?.race || null;
    if (fromState?.id === raceId) return fromState;
    return worldRaceCatalog.find((entry) => entry.id === raceId) || null;
  }, [location.state, raceId]);
  const catalogRace = useMemo(
    () => worldRaceCatalog.find((entry) => entry.id === raceId) || null,
    [raceId],
  );
  const fallbackMapLatitude = useMemo(
    () => asFiniteNumber(race?.lat) ?? asFiniteNumber(catalogRace?.lat),
    [catalogRace?.lat, race?.lat],
  );
  const fallbackMapLongitude = useMemo(
    () => asFiniteNumber(race?.lng) ?? asFiniteNumber(catalogRace?.lng),
    [catalogRace?.lng, race?.lng],
  );

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !race?.name) {
      setCourseMapData(EMPTY_COURSE_MAP);
      setCourseMapRequestSettled(false);
      return undefined;
    }

    setCourseMapData(EMPTY_COURSE_MAP);
    setCourseMapRequestSettled(false);

    (async () => {
      try {
        const params = new URLSearchParams({
          raceId: race.id || raceId || '',
          name: race.name,
          city: race.city || '',
          country: race.country || '',
          website: race.officialWebsite || '',
        });
        if (fallbackMapLatitude != null) params.set('lat', String(fallbackMapLatitude));
        if (fallbackMapLongitude != null) params.set('lng', String(fallbackMapLongitude));
        if (race.distanceKm != null) params.set('distanceKm', String(race.distanceKm));
        const data = await apiJson(`/api/races/course-map?${params.toString()}`);
        if (!cancelled) {
          setCourseMapData(normalizeCourseMapPayload(data));
          setCourseMapRequestSettled(true);
        }
      } catch {
        if (!cancelled) {
          setCourseMapData(EMPTY_COURSE_MAP);
          setCourseMapRequestSettled(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackMapLatitude, fallbackMapLongitude, isAuthenticated, race, raceId]);

  useEffect(() => {
    let cancelled = false;
    const hasAlignedElevationSamples = Array.isArray(courseMapData.elevationSamples) && courseMapData.elevationSamples.length > 0;
    const shouldFetch = shouldFetchRaceElevationProfile({
      isAuthenticated,
      raceName: race?.name,
      courseMapRequestSettled,
      hasAlignedElevationSamples,
    });

    if (!shouldFetch) {
      if (hasAlignedElevationSamples) {
        setElevationProfileSamples(courseMapData.elevationSamples);
        setElevationProfileSource(t('races.detail_course_route_source'));
      } else {
        setElevationProfileImage('');
        setElevationProfileSource('');
        setElevationProfileSamples([]);
      }
      return undefined;
    }
    (async () => {
      try {
        const params = new URLSearchParams({
          name: race.name,
          city: race.city || '',
          country: race.country || '',
          website: race.officialWebsite || '',
        });
        const data = await apiJson(`/api/races/elevation-profile?${params.toString()}`);
        if (!cancelled) {
          setElevationProfileImage(typeof data?.imageUrl === 'string' ? data.imageUrl : '');
          setElevationProfileSource(typeof data?.source === 'string' ? data.source : '');
          setElevationProfileSamples(Array.isArray(data?.profileSamples) ? data.profileSamples.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : []);
        }
      } catch {
        if (!cancelled) {
          setElevationProfileImage('');
          setElevationProfileSource('');
          setElevationProfileSamples([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseMapData.elevationSamples, courseMapRequestSettled, isAuthenticated, race, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!race) {
      navigate('/races');
      return;
    }

    let cancelled = false;
    setLoadState('ready');

    (async () => {
      try {
        const [profileData, activities] = await Promise.all([
          apiJson('/api/profile/me').catch(() => null),
          apiJson('/api/activities/analysis').catch(() => []),
        ]);
        if (cancelled) return;
        const runList = Array.isArray(activities) ? activities : [];
        runList.sort((a, b) => new Date(b.startTime || b.startDate || 0).getTime() - new Date(a.startTime || a.startDate || 0).getTime());
        setProfile(profileData || null);
        setRuns(runList);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load race detail activities', err);
        setProfile(null);
        setRuns([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate, race]);

  useEffect(() => {
    let cancelled = false;
    if (!race) return undefined;
    if (location.state?.image) {
      setResolvedHeroImage(location.state.image);
    } else {
      setResolvedHeroImage('');
    }

    (async () => {
      const resolved = await resolveRaceImage(race);
      if (!cancelled && resolved.imageUrl) {
        setResolvedHeroImage(resolved.imageUrl);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.state, race]);

  const displayName = resolveProfileDisplayName(profile, t('profile.default_name'), email);
  const initials = resolveProfileInitial(profile, t('profile.default_name'), email);
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);
  const navItems = [
    { key: 'dashboard', icon: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile' },
    { key: 'analysis', icon: 'insights', label: t('profile.dashboard_nav_analysis'), route: '/analysis' },
    { key: 'activities', icon: 'history', label: t('profile.dashboard_nav_activities'), route: '/runs' },
    { key: 'heatmap', icon: 'map', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap' },
    { key: 'territory', icon: 'territory', label: t('profile.dashboard_nav_territory'), route: '/territory' },
    { key: 'weather_engine', icon: 'thermostat', label: t('profile.dashboard_nav_weather_engine'), route: '/weather' },
    { key: 'shoes', icon: 'straighten', label: t('profile.dashboard_nav_shoes'), route: '/shoes' },
    { key: 'races', icon: 'flag', label: t('profile.dashboard_nav_races'), route: '/races', active: true },
    { key: 'schedule', icon: 'calendar_today', label: t('profile.dashboard_nav_schedule'), route: '/schedule' },
    { key: 'muscle', icon: 'fitness_center', label: t('muscle_training.nav_label'), route: '/muscle-training' },
    { key: 'workflows', icon: 'account_tree', label: t('profile.dashboard_nav_workflows'), route: '/workflows' },
  ];

  const heroImage = resolvedHeroImage || race?.heroImage || race?.image || DEFAULT_HERO_IMAGE;
  const raceMeta = useMemo(() => resolveRaceIntel(race), [race]);
  const fallbackInterpretedElevationProfile = useMemo(() => {
    if (!Array.isArray(elevationProfileSamples) || !elevationProfileSamples.length) return null;
    const peak = Math.max(24, Math.round(raceMeta?.ascentMeters || 0), ...elevationProfileSamples);
    return elevationProfileSamples.map((sample) => {
      const ratio = Math.max(0, Math.min(100, Number(sample || 0))) / 100;
      return Math.max(8, Math.round(ratio * peak));
    });
  }, [elevationProfileSamples, raceMeta]);
  const mapCenter = useMemo(
    () => (fallbackMapLatitude != null && fallbackMapLongitude != null
      ? [fallbackMapLatitude, fallbackMapLongitude]
      : null),
    [fallbackMapLatitude, fallbackMapLongitude],
  );
  const mapTrust = useMemo(() => deriveRaceMapTrust({
    imageUrl: courseMapData.previewImageUrl || courseMapData.imageUrl,
    overlayBounds: courseMapData.viewportBounds,
    routePoints: courseMapData.routePoints,
    confidence: courseMapData.confidence,
    distanceKm: race?.distanceKm,
    mapCenter,
  }), [courseMapData.confidence, courseMapData.imageUrl, courseMapData.previewImageUrl, courseMapData.routePoints, courseMapData.viewportBounds, mapCenter, race?.distanceKm]);
  const routePoints = useMemo(() => mapTrust.routePoints, [mapTrust.routePoints]);
  const routeMapPoints = useMemo(() => routePoints.map((point) => [point.lat, point.lng]), [routePoints]);
  const hasAlignedRoute = mapTrust.trustedRouteGeometry && courseMapData.routeAvailable && routeMapPoints.length > 1;
  const hasTrustedCourseMapOverlay = hasAlignedRoute && mapTrust.trustedOverlay;
  const courseMapImageOverlayBounds = useMemo(
    () => (hasTrustedCourseMapOverlay && courseMapData.overlayImageUrl
      ? toLeafletBoundsCorners(courseMapData.viewportBounds)
      : null),
    [courseMapData.overlayImageUrl, courseMapData.viewportBounds, hasTrustedCourseMapOverlay],
  );
  const hasTransparentCourseMapOverlay = Boolean(courseMapImageOverlayBounds && courseMapData.overlayImageUrl);
  const hasCityLevelCourseMap = mapTrust.cityLevelMatch && courseMapData.routeAvailable && !hasAlignedRoute;
  const mapViewportBounds = mapTrust.viewportBounds || courseMapData.viewportBounds;
  const absoluteElevationProfile = useMemo(
    () => (courseMapData.elevationSamples.length ? courseMapData.elevationSamples : fallbackInterpretedElevationProfile),
    [courseMapData.elevationSamples, fallbackInterpretedElevationProfile],
  );
  const displayedCourseGain = useMemo(
    () => (courseMapData.totalClimbMeters != null ? courseMapData.totalClimbMeters : Math.round(raceMeta?.ascentMeters || 0)),
    [courseMapData.totalClimbMeters, raceMeta],
  );
  const targetDate = useMemo(() => projectedRaceDate(race), [race]);
  const countdown = useMemo(() => buildCountdownParts(targetDate), [targetDate]);
  const bestVdot = useMemo(() => estimateCurrentVdot(runs).representativeVdot, [runs]);
  const prediction = useMemo(() => {
    if (!race || !raceMeta || !bestVdot || bestVdot <= 0) return null;
    const baseMinutes = predictRaceTimeCalibrated(bestVdot, Math.round(Number(race.distanceKm || 0) * 1000), runs);
    if (!baseMinutes) return null;
    const adjustedSeconds = Math.round(baseMinutes * 60 * (1 + (raceMeta.predictionPenaltyPct || 0) / 100));
    return {
      adjustedSeconds,
      penaltyPct: raceMeta.predictionPenaltyPct || 0,
      bestVdot,
    };
  }, [bestVdot, race, raceMeta, runs]);
  const elevationBars = useMemo(() => {
    if (!absoluteElevationProfile || !absoluteElevationProfile.length) return null;
    return buildElevationProfile(displayedCourseGain || 0, raceMeta?.courseKey || 'flat_city', absoluteElevationProfile);
  }, [absoluteElevationProfile, displayedCourseGain, raceMeta]);
  const elevationGraph = useMemo(
    () => buildElevationGraph(elevationBars, race?.distanceKm),
    [elevationBars, race],
  );
  const activeElevationPoint = useMemo(() => {
    if (!elevationGraph) return null;
    if (activeElevationPointIndex == null) return null;
    return elevationGraph.points[activeElevationPointIndex] || null;
  }, [activeElevationPointIndex, elevationGraph]);

  useLayoutEffect(() => {
    if (!elevationGraph || !raceDetailElevationChartRef.current || !raceDetailElevationStageRef.current) return undefined;
    const chartViewport = raceDetailElevationChartRef.current;
    const chartStage = raceDetailElevationStageRef.current;

    const centerChartViewport = () => {
      const stageWidth = chartStage.scrollWidth || chartStage.offsetWidth || elevationGraph.width;
      const midpointPoint = elevationGraph.points[Math.floor(elevationGraph.points.length / 2)];
      const targetScrollLeft = Math.max(
        0,
        Math.min(
          chartViewport.scrollWidth - chartViewport.clientWidth,
          (midpointPoint?.x || stageWidth / 2) - (chartViewport.clientWidth / 2),
        ),
      );
      chartViewport.scrollLeft = targetScrollLeft;
    };

    const frameId = window.requestAnimationFrame(() => window.requestAnimationFrame(centerChartViewport));
    const settleTimer = window.setTimeout(centerChartViewport, 140);
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => centerChartViewport());
      resizeObserver.observe(chartViewport);
      resizeObserver.observe(chartStage);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(settleTimer);
      resizeObserver?.disconnect();
    };
  }, [elevationGraph, raceId]);

  const elevationTooltipLabel = 'Elevation';
  function handleElevationPointerMove(event) {
    if (!elevationGraph || !elevationSvgRef.current) return;
    const rect = elevationSvgRef.current.getBoundingClientRect();
    if (!rect.width) return;
    const relativeX = ((event.clientX - rect.left) / rect.width) * elevationGraph.width;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    elevationGraph.points.forEach((point, index) => {
      const distance = Math.abs(point.x - relativeX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setActiveElevationPointIndex(nearestIndex);
  }

  const coachInsight = useMemo(() => buildCoachInsight(t, race, raceMeta, prediction), [prediction, race, raceMeta, t]);
  const heroLabels = useMemo(() => buildRaceHeroLabels(race), [race]);
  const topnavTitle = useMemo(() => buildRaceTopnavTitle(heroLabels, race), [heroLabels, race]);
  const mapCardCopy = useMemo(() => {
    const city = race?.city || race?.name || '';
    if (hasAlignedRoute) {
      return {
        badge: t('races.detail_map_route_badge'),
        title: t('races.detail_route_title', { city }),
        source: t('races.detail_map_route_source', { confidence: courseMapData.confidence }),
      };
    }
    if (hasCityLevelCourseMap) {
      return {
        badge: t('races.detail_map_detected_badge'),
        title: t('races.detail_map_city_title', { city }),
        source: t('races.detail_map_detected_source'),
      };
    }
    return {
      badge: t('races.detail_map_city_badge'),
      title: t('races.detail_map_city_title', { city }),
      source: t('races.detail_map_city_source'),
    };
  }, [courseMapData.confidence, hasAlignedRoute, hasCityLevelCourseMap, race, t]);

  useEffect(() => {
    setRouteMapReady(false);
    setRouteMapPainted(false);
    setStreetTileFallback(null);
    // Clear map instance when route data changes to allow re-initialization with new data
    if (routeMapInstanceRef.current) {
      routeMapInstanceRef.current.remove();
      routeMapInstanceRef.current = null;
    }
  }, [courseMapData.imageUrl, courseMapData.overlayImageUrl, courseMapData.previewImageUrl, hasAlignedRoute, race?.id, routeMapPoints.length]);

  useEffect(() => {
    if (!routeMapRef.current || !race || routeMapInstanceRef.current) return undefined;
    const routeMapHost = routeMapRef.current;
    let resizeTimer = null;
    let tileFallbackTimer = null;
    let cancelled = false;
    let createdMap = null;
    let hasAppliedInitialViewport = false;

    if (cancelled || !routeMapRef.current) return undefined;
    if (routeMapRef.current !== routeMapHost || routeMapInstanceRef.current) return undefined;
    if (routeMapHost._leaflet_id) {
      delete routeMapHost._leaflet_id;
    }
    routeMapHost.innerHTML = '';

    (async () => {
      try {
      const L = await loadLeafletModule();
      if (cancelled || !routeMapRef.current) return;
      if (routeMapRef.current !== routeMapHost || routeMapInstanceRef.current) return;
      const map = L.map(routeMapHost, {
        zoomControl: true,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        tap: false,
      });
      const courseImagePane = map.createPane('race-detail-course-image');
      courseImagePane.style.zIndex = '430';
      courseImagePane.style.pointerEvents = 'none';
      courseImagePane.style.mixBlendMode = 'multiply';
      const routeShadowPane = map.createPane('race-detail-route-shadow');
      routeShadowPane.style.zIndex = '440';
      const routePane = map.createPane('race-detail-route');
      routePane.style.zIndex = '450';
      const routeMarkerPane = map.createPane('race-detail-route-marker');
      routeMarkerPane.style.zIndex = '460';
      const tilePane = map.getPane('tilePane');
      if (tilePane) {
        tilePane.style.mixBlendMode = 'normal';
        tilePane.style.opacity = '1';
        tilePane.style.filter = 'none';
      }
      const tileAttribution = '&copy; OpenStreetMap contributors';
      let activeTileLayer = null;
      let switchedToFallbackTiles = false;
      let tileLoadConfirmed = false;
      const refreshStreetTileFallback = (tileTemplate = tileUrl) => {
        if (cancelled) return;
        setStreetTileFallback(buildStreetTileFallbackSnapshot(map, tileTemplate));
      };
      const switchToFallbackTiles = () => {
        if (cancelled || switchedToFallbackTiles) return;
        switchedToFallbackTiles = true;
        tileLoadConfirmed = false;
        if (tileFallbackTimer) {
          clearTimeout(tileFallbackTimer);
          tileFallbackTimer = null;
        }
        if (activeTileLayer) {
          activeTileLayer.off();
          map.removeLayer(activeTileLayer);
        }
        activeTileLayer = attachTileLayer(fallbackTileUrl);
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => {
            map.invalidateSize({ pan: false });
            activeTileLayer?.redraw?.();
            refreshStreetTileFallback(fallbackTileUrl);
          });
        }
      };
      const attachTileLayer = (url) => {
        const layer = L.tileLayer(url, {
          maxZoom: 19,
          attribution: tileAttribution,
        }).addTo(map);
        layer.on('tileload', () => {
          const container = layer.getContainer?.();
          if (container instanceof HTMLElement) {
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
          tileLoadConfirmed = true;
          setStreetTileFallback(null);
          if (tileFallbackTimer) {
            clearTimeout(tileFallbackTimer);
            tileFallbackTimer = null;
          }
        });
        layer.on('tileerror', () => {
          if (url === fallbackTileUrl) return;
          switchToFallbackTiles();
        });
        return layer;
      };
      const finalizeMapLayout = () => {
        if (cancelled) return;
        map.invalidateSize({ pan: false });
        applyRouteMapViewport();
        activeTileLayer?.redraw?.();
        setRouteMapPainted(true);
        setRouteMapReady(true);
      };
      const renderFallbackCityMap = () => {
        if (mapCenter) {
          const singleBounds = L.latLngBounds(
            [mapCenter[0] - 0.05, mapCenter[1] - 0.08],
            [mapCenter[0] + 0.05, mapCenter[1] + 0.08],
          );
          map.fitBounds(singleBounds, { padding: [26, 26] });
          L.circleMarker(mapCenter, {
            radius: 8,
            color: '#fff6f2',
            weight: 2,
            fillColor: '#f07561',
            fillOpacity: 0.96,
          }).addTo(map);
        } else {
          map.setView([0, 0], 1);
        }
      };
      let polyline = null;
      const applyRouteMapViewport = ({ force = false } = {}) => {
        if (hasAppliedInitialViewport && !force) return;
        if (hasAlignedRoute && polyline) {
          map.fitBounds(polyline.getBounds().pad(0.12), { padding: [26, 26], maxZoom: 16 });
        } else {
          renderFallbackCityMap();
        }
        hasAppliedInitialViewport = true;
      };

      if (hasTransparentCourseMapOverlay) {
        L.imageOverlay(courseMapData.overlayImageUrl, courseMapImageOverlayBounds, {
          pane: 'race-detail-course-image',
          opacity: 0.72,
          interactive: false,
          className: 'race-detail-course-map-overlay',
        }).addTo(map);
      }

      if (hasAlignedRoute) {
        L.polyline(routeMapPoints, {
          color: '#fff6f2',
          weight: 9,
          opacity: 0.92,
          pane: 'race-detail-route-shadow',
        }).addTo(map);

        polyline = L.polyline(routeMapPoints, {
          color: '#f07561',
          weight: 6,
          opacity: 0.98,
          pane: 'race-detail-route',
        }).addTo(map);

        const startMarker = L.circleMarker(routeMapPoints[0], {
          radius: 7,
          color: '#101214',
          weight: 2,
          fillColor: '#7ce8b4',
          fillOpacity: 1,
          pane: 'race-detail-route-marker',
        }).addTo(map);
        if (routePoints[0]?.label) {
          startMarker.bindTooltip(routePoints[0].label, { direction: 'top', offset: [0, -6] });
        }

        const finishMarker = L.circleMarker(routeMapPoints[routeMapPoints.length - 1], {
          radius: 8,
          color: '#fff6f2',
          weight: 2,
          fillColor: '#f07561',
          fillOpacity: 1,
          pane: 'race-detail-route-marker',
        }).addTo(map);
        if (routePoints[routePoints.length - 1]?.label) {
          finishMarker.bindTooltip(routePoints[routePoints.length - 1].label, { direction: 'top', offset: [0, -6] });
        }
      }
      map.invalidateSize({ pan: false });
      applyRouteMapViewport({ force: true });
      activeTileLayer = attachTileLayer(tileUrl);
      tileFallbackTimer = setTimeout(() => {
        if (!tileLoadConfirmed && !switchedToFallbackTiles) {
          refreshStreetTileFallback(tileUrl);
          map.invalidateSize({ pan: false });
          applyRouteMapViewport({ force: true });
          activeTileLayer?.redraw?.();
        }
      }, 2200);

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(finalizeMapLayout);
      } else {
        finalizeMapLayout();
      }
      resizeTimer = setTimeout(finalizeMapLayout, 180);
      if (!cancelled) {
        routeMapInstanceRef.current = map;
        createdMap = map;
        setRouteMapReady(true);
      }
      } catch (error) {
        if (!cancelled) {
          console.error('Race detail Leaflet map failed to initialize.', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      if (tileFallbackTimer) {
        clearTimeout(tileFallbackTimer);
      }
      if (createdMap && routeMapInstanceRef.current === createdMap) {
        routeMapInstanceRef.current.remove();
        routeMapInstanceRef.current = null;
      } else if (createdMap) {
        createdMap.remove();
      }
    };
  }, [courseMapData.imageUrl, courseMapData.overlayImageUrl, courseMapData.previewImageUrl, courseMapData.viewportBounds, courseMapImageOverlayBounds, fallbackTileUrl, hasAlignedRoute, hasTransparentCourseMapOverlay, loadState, mapCenter, mapViewportBounds, race, routeMapPoints, routePoints, tileUrl]);

  if (loadState !== 'ready') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t(loadState === 'error' ? 'races.stitch_load_error' : 'races.stitch_loading')}</div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page races-dashboard-page race-detail-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('races.stitch_sidebar_tagline')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>

        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
              aria-label={item.label}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar race-detail-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              parentLabel={t('profile.dashboard_nav_races')}
              parentRoute="/races"
              activeLabel={topnavTitle}
              navigate={navigate}
            />
          </div>

          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <TopbarUserMenu initials={initials} label={displayName} />
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <div className="race-detail-layout">
            <section className="race-detail-hero">
              <img className="race-detail-hero-image" src={heroImage} alt={race?.name || t('races.detail_nav')} onError={(e) => { e.target.onerror = null; const fallback = race?.heroImage || race?.image || DEFAULT_HERO_IMAGE; if (e.target.src !== fallback) { e.target.src = fallback; } setResolvedHeroImage(''); invalidateRaceImageCache(race); }} />
              <div className="race-detail-hero-overlay" />
              <div className="race-detail-hero-body">
                <div className="race-detail-hero-main">
                  <span className="race-detail-pill">{t('races.detail_badge')}</span>
                  <div className="race-detail-hero-kicker">
                    <span>{race?.location}</span>
                    <span>{targetDate.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <h1>
                    {heroLabels.primary || race?.city || race?.name}
                    {heroLabels.secondary ? <span>{heroLabels.secondary}</span> : null}
                  </h1>
                  <div className="race-detail-hero-meta">
                    <div><AppIcon name="location_on" className="runner-dashboard-side-link-icon" /> <span>{race?.location}</span></div>
                    <div><AppIcon name="calendar_today" className="runner-dashboard-side-link-icon" /> <span>{targetDate.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
                  </div>
                </div>

                <div className="race-detail-countdown">
                  <div className="race-detail-count-card">
                    <strong>{padCountdown(countdown.days)}</strong>
                    <span>{t('races.detail_count_days')}</span>
                  </div>
                  <div className="race-detail-count-card">
                    <strong>{padCountdown(countdown.hours)}</strong>
                    <span>{t('races.detail_count_hours')}</span>
                  </div>
                  <div className="race-detail-count-card">
                    <strong>{padCountdown(countdown.minutes)}</strong>
                    <span>{t('races.detail_count_minutes')}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="race-detail-grid">
              <section className="race-detail-command-strip">
                <div className="race-detail-stats">
                  <article className="race-detail-stat-card">
                    <span>{t('races.detail_stat_distance')}</span>
                    <strong>{Number(race?.distanceKm || 0).toFixed(1)}<em>km</em></strong>
                  </article>
                  <article className="race-detail-stat-card is-accent">
                    <span>{t('races.detail_stat_prediction')}</span>
                    <strong>{prediction ? formatDuration(prediction.adjustedSeconds) : '--'}</strong>
                  </article>
                </div>

                <article className="race-detail-coach-card">
                  <div className="race-detail-card-head">
                    <AppIcon name="psychology" className="runner-dashboard-side-link-icon" />
                    <span>{t('races.detail_coach_title')}</span>
                  </div>
                  <p>{coachInsight}</p>
                  <div className="race-detail-coach-footer">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} />
                  </div>
                </article>
              </section>

              <article className="race-detail-course-card">
                <div className="race-detail-course-head">
                  <div>
                    <h2>{t('races.detail_course_title')}</h2>
                    <p>{t('races.detail_course_subtitle')}</p>
                  </div>
                  <div className="race-detail-course-metrics">
                    <div>
                      <span>{t('races.detail_course_gain')}</span>
                      <strong>{Math.round(displayedCourseGain || 0)}m</strong>
                    </div>
                    <div>
                      <span>{t('races.detail_course_peak')}</span>
                      <strong>{Math.round(elevationGraph?.peakMeters || 0)}m</strong>
                    </div>
                  </div>
                </div>
                <div ref={raceDetailElevationChartRef} className="race-detail-elevation-chart">
                  {elevationGraph ? (
                    <div ref={raceDetailElevationStageRef} className="race-detail-elevation-stage" style={{ width: `${elevationGraph.width}px` }}>
                      {activeElevationPoint ? (
                        <div
                          className={`race-detail-elevation-tooltip${activeElevationPoint.x <= 120 ? ' is-left' : activeElevationPoint.x >= elevationGraph.width - 120 ? ' is-right' : ''}${activeElevationPoint.y <= 84 ? ' is-below' : ''}`}
                          style={{
                            left: `${activeElevationPoint.x}px`,
                            top: `${Math.max(18, activeElevationPoint.y - 10)}px`,
                          }}
                          role="status"
                          aria-live="polite"
                        >
                          <strong>{`${elevationTooltipLabel}: ${activeElevationPoint.meters}m`}</strong>
                          <span>{`Course point: ${activeElevationPoint.km.toFixed(1)} km`}</span>
                        </div>
                      ) : null}
                      <svg
                        ref={elevationSvgRef}
                        className="race-detail-elevation-svg"
                        style={{ width: `${elevationGraph.width}px` }}
                        viewBox={`0 0 ${elevationGraph.width} ${elevationGraph.height}`}
                        role="img"
                        aria-label={t('races.detail_course_profile')}
                        onPointerMove={handleElevationPointerMove}
                        onPointerLeave={() => setActiveElevationPointIndex(null)}
                      >
                        <defs>
                          <linearGradient id="race-detail-elevation-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(255, 180, 167, 0.34)" />
                            <stop offset="45%" stopColor="rgba(240, 117, 97, 0.24)" />
                            <stop offset="100%" stopColor="rgba(240, 117, 97, 0.06)" />
                          </linearGradient>
                        </defs>
                      <rect className="race-detail-elevation-base" x="0" y={elevationGraph.baseY} width={elevationGraph.width} height={elevationGraph.height - elevationGraph.baseY} rx="18" />
                      <path className="race-detail-elevation-area" d={elevationGraph.areaPath} />
                      <path className="race-detail-elevation-line" d={elevationGraph.linePath} />
                      <g className="race-detail-elevation-scrubber" aria-hidden="true">
                        {activeElevationPoint ? (
                          <>
                            <line className="race-detail-elevation-scrubber-line" x1={activeElevationPoint.x} y1={activeElevationPoint.y} x2={activeElevationPoint.x} y2={elevationGraph.baseY} />
                            <circle className="race-detail-elevation-scrubber-dot" cx={activeElevationPoint.x} cy={activeElevationPoint.y} r="6" />
                          </>
                        ) : null}
                      </g>
                      {elevationGraph.markers.map((marker) => (
                        <g
                          key={marker.id}
                          className={`race-detail-elevation-marker${activeElevationPoint && Math.abs(activeElevationPoint.x - marker.x) < 8 ? ' is-active' : ''}${marker.isMajor ? ' is-major' : ' is-minor'}`}
                        >
                          <line
                            className={`race-detail-elevation-guide${marker.isMajor ? '' : ' is-minor'}`}
                            x1={marker.x}
                            y1={marker.isMajor ? marker.y : elevationGraph.baseY - 18}
                            x2={marker.x}
                            y2={elevationGraph.baseY}
                          />
                          {marker.isMajor ? (
                            <text className="race-detail-elevation-value" x={marker.x} y={Math.max(18, marker.y - 10)} textAnchor="middle">
                              {marker.value}m
                            </text>
                          ) : null}
                          <circle className={`race-detail-elevation-node${marker.isMajor ? '' : ' is-minor'}`} cx={marker.x} cy={elevationGraph.baseY} r={marker.isMajor ? 11 : 7} />
                          <text className="race-detail-elevation-node-label" x={marker.x} y={elevationGraph.baseY + 4} textAnchor="middle">
                            {marker.label}
                          </text>
                        </g>
                      ))}
                      </svg>
                    </div>
                  ) : (
                    <div className="race-detail-elevation-empty">
                      <strong>{t('races.detail_course_empty_title')}</strong>
                      <span>{elevationProfileSource || t('races.detail_course_empty_body')}</span>
                    </div>
                  )}
                </div>
                <div className="race-detail-course-footnote">
                  <span>{t(courseMapData.elevationSamples.length ? 'races.detail_course_hover_hint_aligned' : 'races.detail_course_hover_hint')}</span>
                  {courseMapData.elevationSamples.length ? (
                    <span>{t('races.detail_course_route_source')}</span>
                  ) : elevationProfileImage ? (
                    <a href={elevationProfileImage} target="_blank" rel="noreferrer">
                      {t('races.detail_course_source_link')}
                    </a>
                  ) : elevationProfileSource ? (
                    <span>{elevationProfileSource}</span>
                  ) : null}
                </div>
                <div className="race-detail-course-axis">
                  <span>{t('races.detail_course_axis_start')}</span>
                  <span>10K</span>
                  <span>{t('races.detail_course_axis_half')}</span>
                  <span>30K</span>
                  <span>{t('races.detail_course_axis_finish')}</span>
                </div>
              </article>

              <section className="race-detail-lower-stack">
                <article className={`race-detail-map-stage${hasAlignedRoute ? ' has-route' : ''}`}>
                  <div
                    className="race-detail-map-canvas"
                    role="region"
                    aria-label={mapCardCopy.title}
                    aria-describedby="race-detail-map-access-copy"
                  >
                    {streetTileFallback ? (
                      <div className="race-detail-map-street-fallback" aria-hidden="true">
                        {streetTileFallback.tiles.map((tile) => (
                          <img
                            key={tile.key}
                            className="race-detail-map-street-fallback-tile"
                            src={tile.url}
                            alt=""
                            style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
                          />
                        ))}
                      </div>
                    ) : null}
                    <div
                      ref={routeMapRef}
                      className={`race-detail-map-leaflet${routeMapReady ? ' is-mounted' : ''}${routeMapPainted ? ' is-ready' : ''}`}
                    />
                  </div>
                  <p id="race-detail-map-access-copy" className="sr-only">
                    {`${mapCardCopy.title}. ${mapCardCopy.source}. ${race?.officialWebsite ? t('races.intel_official_site') : ''}`}
                  </p>
                </article>

              </section>
            </section>

            <footer className="runner-shell-footer runner-dashboard-footer">
              <FooterNavLinks />
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}

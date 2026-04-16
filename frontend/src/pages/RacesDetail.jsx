import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import CoachIdentityBadge from '../components/CoachIdentityBadge';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import { resolveAssignedCoach } from '../utils/coachIdentity';
import { formatDuration } from '../utils/format';
import { resolveProfileDisplayName, resolveProfileInitial } from '../utils/profileIdentity';
import { estimateCurrentVdot, predictRaceTimeCalibrated } from '../utils/vdot';
import { resolveRaceIntel } from '../utils/raceIntel';
import worldRaceCatalog from '../data/worldRaceCatalog';
import { getCachedRaceImage, resolveRaceImage } from '../utils/raceImage';

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

function buildElevationProfile(ascentMeters, courseKey, absoluteProfile) {
  if (Array.isArray(absoluteProfile) && absoluteProfile.length) {
    return absoluteProfile.map((meters, index) => ({
      key: `${courseKey || 'custom'}-${index}`,
      meters: Math.round(Number(meters || 0)),
      isHighlight: index === 6 || index === 12 || index === 18 || index === absoluteProfile.length - 1,
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
    isHighlight: index === 6 || index === 14 || index === 21,
  }));
}

function buildElevationGraph(profile) {
  if (!Array.isArray(profile) || profile.length === 0) {
    return null;
  }

  const width = 960;
  const height = 260;
  const baseY = 214;
  const leftPad = 26;
  const rightPad = 20;
  const topPad = 24;
  const drawableWidth = width - leftPad - rightPad;
  const minMeters = Math.min(...profile.map((point) => Number(point.meters || 0)));
  const maxMeters = Math.max(...profile.map((point) => Number(point.meters || 0)), 1);
  const rangeMeters = Math.max(8, maxMeters - minMeters);

  const points = profile.map((point, index) => {
    const x = leftPad + (drawableWidth / Math.max(profile.length - 1, 1)) * index;
    const normalized = (Number(point.meters || 0) - minMeters) / rangeMeters;
    const y = baseY - normalized * (baseY - topPad);
    const km = (42.195 * index) / Math.max(profile.length - 1, 1);
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

  const markerIndexes = [0, 6, 12, 18, profile.length - 1]
    .filter((value, index, array) => array.indexOf(value) === index)
    .filter((index) => points[index]);

  const markers = markerIndexes.map((index, order) => ({
    id: `marker-${index}`,
    x: points[index].x,
    y: points[index].y,
    value: points[index].meters,
    label: ['S', '10', '21', '30', 'F'][order] || String(order + 1),
  }));

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

function confidenceFromRuns(prediction, runsNearTarget) {
  if (!prediction) return 0;
  return Math.max(72, Math.min(96, 76 + Math.min(runsNearTarget, 5) * 4));
}

function buildCoachInsight(t, race, raceMeta, prediction, confidence) {
  const courseTone = t(`races.intel_course_${raceMeta?.courseKey || 'flat_city'}_title`);
  if (!prediction) {
    return t('races.detail_coach_no_prediction', { course: courseTone, race: race?.name || '' });
  }
  if ((raceMeta?.predictionPenaltyPct || 0) >= 3) {
    return t('races.detail_coach_hard_course', {
      course: courseTone,
      time: formatDuration(prediction.adjustedSeconds),
      confidence,
    });
  }
  return t('races.detail_coach_fast_course', {
    course: courseTone,
    time: formatDuration(prediction.adjustedSeconds),
    confidence,
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
  imageUrl: '',
  source: '',
  courseMapDetected: false,
  confidence: 0,
  summary: '',
  overlayBounds: null,
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

function normalizeCourseMapPayload(payload) {
  if (!payload || typeof payload !== 'object') return EMPTY_COURSE_MAP;
  const confidence = Math.max(0, Math.min(100, Math.round(asFiniteNumber(payload.confidence) ?? 0)));
  const totalClimbMeters = asFiniteNumber(payload.totalClimbMeters);
  return {
    imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : '',
    source: typeof payload.source === 'string' ? payload.source : '',
    courseMapDetected: payload.courseMapDetected === true,
    confidence,
    summary: typeof payload.summary === 'string' ? payload.summary : '',
    overlayBounds: normalizeOverlayBounds(payload.overlayBounds),
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
  const [savedRaces, setSavedRaces] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [resolvedHeroImage, setResolvedHeroImage] = useState(() => getCachedRaceImage(location.state?.race || worldRaceCatalog.find((entry) => entry.id === raceId) || null).imageUrl || '');
  const [courseMapData, setCourseMapData] = useState(EMPTY_COURSE_MAP);
  const [elevationProfileImage, setElevationProfileImage] = useState('');
  const [elevationProfileSource, setElevationProfileSource] = useState('');
  const [elevationProfileSamples, setElevationProfileSamples] = useState([]);
  const [activeElevationPointIndex, setActiveElevationPointIndex] = useState(null);
  const [routeMapReady, setRouteMapReady] = useState(false);
  const elevationSvgRef = useRef(null);
  const routeMapRef = useRef(null);
  const routeMapInstanceRef = useRef(null);

  const race = useMemo(() => {
    const fromState = location.state?.race || null;
    if (fromState?.id === raceId) return fromState;
    return worldRaceCatalog.find((entry) => entry.id === raceId) || null;
  }, [location.state, raceId]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !race?.name) {
      setCourseMapData(EMPTY_COURSE_MAP);
      return undefined;
    }

    setCourseMapData(EMPTY_COURSE_MAP);

    (async () => {
      try {
        const params = new URLSearchParams({
          raceId: race.id || raceId || '',
          name: race.name,
          city: race.city || '',
          country: race.country || '',
          website: race.officialWebsite || '',
        });
        if (race.lat != null) params.set('lat', String(race.lat));
        if (race.lng != null) params.set('lng', String(race.lng));
        if (race.distanceKm != null) params.set('distanceKm', String(race.distanceKm));
        const data = await apiJson(`/api/races/course-map?${params.toString()}`);
        if (!cancelled) {
          setCourseMapData(normalizeCourseMapPayload(data));
        }
      } catch {
        if (!cancelled) {
          setCourseMapData(EMPTY_COURSE_MAP);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, race, raceId]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !race?.name) return undefined;

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
  }, [isAuthenticated, race]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!race) {
      navigate('/races');
      return;
    }

    (async () => {
      setLoadState('loading');
      try {
        const [profileData, activities, raceData] = await Promise.all([
          apiJson('/api/profile/me').catch(() => null),
          apiJson('/api/activities'),
          apiJson('/api/races').catch(() => []),
        ]);
        const runList = Array.isArray(activities) ? activities : [];
        runList.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
        setProfile(profileData || null);
        setRuns(runList);
        setSavedRaces(Array.isArray(raceData) ? raceData : []);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    })();
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
    { key: 'shoes', icon: 'straighten', label: t('profile.dashboard_nav_shoes'), route: '/shoes' },
    { key: 'races', icon: 'flag', label: t('profile.dashboard_nav_races'), route: '/races', active: true },
    { key: 'schedule', icon: 'calendar_today', label: t('profile.dashboard_nav_schedule'), route: '/schedule' },
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
  const routePoints = useMemo(() => courseMapData.routePoints, [courseMapData.routePoints]);
  const routeMapPoints = useMemo(() => routePoints.map((point) => [point.lat, point.lng]), [routePoints]);
  const hasAlignedRoute = routeMapPoints.length > 1;
  const hasAlignedOverlay = Boolean(courseMapData.imageUrl) && Boolean(courseMapData.overlayBounds) && hasAlignedRoute;
  const hasCourseMapCandidate = Boolean(courseMapData.imageUrl);
  const absoluteElevationProfile = useMemo(
    () => (courseMapData.elevationSamples.length ? courseMapData.elevationSamples : fallbackInterpretedElevationProfile),
    [courseMapData.elevationSamples, fallbackInterpretedElevationProfile],
  );
  const displayedCourseGain = useMemo(
    () => (courseMapData.totalClimbMeters != null ? courseMapData.totalClimbMeters : Math.round(raceMeta?.ascentMeters || 0)),
    [courseMapData.totalClimbMeters, raceMeta],
  );
  const mapCenter = useMemo(() => (race?.lat != null && race?.lng != null ? [race.lat, race.lng] : null), [race]);
  const targetDate = useMemo(() => projectedRaceDate(race), [race]);
  const countdown = useMemo(() => buildCountdownParts(targetDate), [targetDate]);
  const bestVdot = useMemo(() => estimateCurrentVdot(runs).representativeVdot, [runs]);
  const nearRuns = useMemo(() => {
    if (!race) return [];
    const targetKm = Number(race.distanceKm || 0);
    if (!targetKm) return [];
    return runs.filter((run) => {
      const km = Number(run.distanceKm || 0);
      return km >= targetKm * 0.8 && km <= targetKm * 1.2;
    });
  }, [race, runs]);
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
  const confidence = useMemo(() => confidenceFromRuns(prediction, nearRuns.length), [nearRuns.length, prediction]);
  const elevationBars = useMemo(
    () => (absoluteElevationProfile
      ? buildElevationProfile(displayedCourseGain || 0, raceMeta?.courseKey || 'flat_city', absoluteElevationProfile)
      : null),
    [absoluteElevationProfile, displayedCourseGain, raceMeta],
  );
  const elevationGraph = useMemo(
    () => buildElevationGraph(elevationBars),
    [elevationBars],
  );
  const activeElevationPoint = useMemo(() => {
    if (!elevationGraph) return null;
    if (activeElevationPointIndex == null) return null;
    return elevationGraph.points[activeElevationPointIndex] || null;
  }, [activeElevationPointIndex, elevationGraph]);
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

  const savedRace = useMemo(() => savedRaces.find((entry) => entry.name === race?.name || entry.id === race?.id), [race, savedRaces]);
  const readinessItems = useMemo(() => ([
    {
      key: 'plan',
      done: !!savedRace,
      label: t('races.detail_ready_plan'),
      meta: savedRace ? t('races.detail_ready_plan_done') : t('races.detail_ready_plan_pending'),
    },
    {
      key: 'fitness',
      done: nearRuns.length >= 2,
      label: t('races.detail_ready_fitness'),
      meta: nearRuns.length >= 2
        ? t('races.detail_ready_fitness_done', { count: nearRuns.length })
        : t('races.detail_ready_fitness_pending'),
    },
    {
      key: 'prediction',
      done: !!prediction,
      label: t('races.detail_ready_prediction'),
      meta: prediction ? t('races.detail_ready_prediction_done', { confidence }) : t('races.detail_ready_prediction_pending'),
    },
  ]), [confidence, nearRuns.length, prediction, savedRace, t]);
  const coachInsight = useMemo(() => buildCoachInsight(t, race, raceMeta, prediction, confidence), [confidence, prediction, race, raceMeta, t]);
  const heroLabels = useMemo(() => buildRaceHeroLabels(race), [race]);
  const topnavTitle = useMemo(() => buildRaceTopnavTitle(heroLabels, race), [heroLabels, race]);
  const mapCardCopy = useMemo(() => {
    const city = race?.city || race?.name || '';
    if (hasAlignedOverlay) {
      return {
        badge: t('races.detail_map_overlay_badge'),
        title: t('races.detail_route_title', { city }),
        source: t('races.detail_map_overlay_source', { confidence: courseMapData.confidence }),
      };
    }
    if (hasAlignedRoute) {
      return {
        badge: t('races.detail_map_route_badge'),
        title: t('races.detail_route_title', { city }),
        source: t('races.detail_map_route_source', { confidence: courseMapData.confidence }),
      };
    }
    if (hasCourseMapCandidate) {
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
  }, [courseMapData.confidence, hasAlignedOverlay, hasAlignedRoute, hasCourseMapCandidate, race, t]);

  useEffect(() => {
    setRouteMapReady(false);
  }, [hasAlignedOverlay, hasAlignedRoute, race?.id]);

  useEffect(() => {
    if (!routeMapRef.current || !race || routeMapInstanceRef.current) return undefined;
    let resizeTimer = null;

    import('leaflet').then((leafletModule) => {
      if (!routeMapRef.current || routeMapInstanceRef.current) return;
      const L = leafletModule.default || leafletModule;
      const map = L.map(routeMapRef.current, {
        zoomControl: false,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        tap: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      const finalizeMapLayout = () => {
        map.invalidateSize({ pan: false });
      };

      const overlayBounds = courseMapData.overlayBounds
        ? L.latLngBounds(
          [courseMapData.overlayBounds.south, courseMapData.overlayBounds.west],
          [courseMapData.overlayBounds.north, courseMapData.overlayBounds.east],
        )
        : null;

      if (hasAlignedOverlay && overlayBounds) {
        L.imageOverlay(courseMapData.imageUrl, overlayBounds, {
          opacity: 0.74,
          interactive: false,
          className: 'race-detail-map-ai-overlay',
        }).addTo(map);
        map.fitBounds(overlayBounds.pad(0.04), { padding: [26, 26] });
      }

      if (hasAlignedRoute) {
        const polyline = L.polyline(routeMapPoints, {
          color: '#f07561',
          weight: 5,
          opacity: 0.92,
        }).addTo(map);
        if (!hasAlignedOverlay) {
          const bounds = polyline.getBounds().pad(0.24);
          map.fitBounds(bounds, { padding: [26, 26] });
        }

        L.circleMarker(routeMapPoints[0], {
          radius: 7,
          color: '#101214',
          weight: 2,
          fillColor: '#7ce8b4',
          fillOpacity: 1,
        }).addTo(map);

        L.circleMarker(routeMapPoints[routeMapPoints.length - 1], {
          radius: 8,
          color: '#fff6f2',
          weight: 2,
          fillColor: '#f07561',
          fillOpacity: 1,
        }).addTo(map);
      } else if (mapCenter) {
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
      }

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(finalizeMapLayout);
      } else {
        finalizeMapLayout();
      }
      resizeTimer = setTimeout(finalizeMapLayout, 180);
      setRouteMapReady(true);

      routeMapInstanceRef.current = map;
    }).catch(() => {});

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      if (routeMapInstanceRef.current) {
        routeMapInstanceRef.current.remove();
        routeMapInstanceRef.current = null;
      }
    };
  }, [courseMapData.imageUrl, courseMapData.overlayBounds, hasAlignedOverlay, hasAlignedRoute, mapCenter, race, routeMapPoints]);

  if (loadState === 'loading') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('runs.loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('runs.load_error')}</div></div>;
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
            <div className="runner-shell-topnav runner-shell-topnav--editorial-detail">
              <button type="button" className="runner-shell-topnav-brand" onClick={() => navigate('/profile')}>
                HERMES
              </button>
              <button type="button" className="runner-shell-topnav-link" onClick={() => navigate('/races')}>
                {t('profile.dashboard_nav_races')}
              </button>
              <span className="runner-shell-topnav-link is-section is-active">{topnavTitle}</span>
            </div>
          </div>

          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={displayName}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <div className="race-detail-layout">
            <section className="race-detail-hero">
              <img className="race-detail-hero-image" src={heroImage} alt={race?.name || t('races.detail_nav')} />
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
                  <article className="race-detail-stat-card">
                    <span>{t('races.detail_stat_confidence')}</span>
                    <strong>{prediction ? confidence : '--'}<em>%</em></strong>
                    <div className="race-detail-confidence-bar">
                      <i style={{ width: `${prediction ? confidence : 0}%` }} />
                    </div>
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
                <div className="race-detail-elevation-chart">
                  {elevationGraph ? (
                    <>
                      {activeElevationPoint ? (
                        <div
                          className={`race-detail-elevation-tooltip${activeElevationPoint.x <= 120 ? ' is-left' : activeElevationPoint.x >= elevationGraph.width - 120 ? ' is-right' : ''}`}
                          style={{
                            left: `${(activeElevationPoint.x / elevationGraph.width) * 100}%`,
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
                          className={`race-detail-elevation-marker${activeElevationPoint && Math.abs(activeElevationPoint.x - marker.x) < 6 ? ' is-active' : ''}`}
                        >
                          <line className="race-detail-elevation-guide" x1={marker.x} y1={marker.y} x2={marker.x} y2={elevationGraph.baseY} />
                          <text className="race-detail-elevation-value" x={marker.x} y={Math.max(18, marker.y - 10)} textAnchor="middle">
                            {marker.value}m
                          </text>
                          <circle className="race-detail-elevation-node" cx={marker.x} cy={elevationGraph.baseY} r="11" />
                          <text className="race-detail-elevation-node-label" x={marker.x} y={elevationGraph.baseY + 4} textAnchor="middle">
                            {marker.label}
                          </text>
                        </g>
                      ))}
                      </svg>
                    </>
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

              <section className="race-detail-lower-grid">
                <article className="race-detail-map-card">
                  <div
                    ref={routeMapRef}
                    className={`race-detail-map-canvas${routeMapReady ? ' is-ready' : ''}${hasAlignedOverlay ? ' has-aligned-overlay' : ''}`}
                    aria-label={mapCardCopy.title}
                  />
                  <div className={`race-detail-map-overlay${hasAlignedOverlay ? ' is-ai-overlay' : ''}`} />
                  <div className="race-detail-map-copy">
                    <span>{mapCardCopy.badge}</span>
                    <strong>{mapCardCopy.title}</strong>
                  </div>
                  <div className="race-detail-map-actions">
                    <span className="race-detail-map-source">{mapCardCopy.source}</span>
                    {race?.officialWebsite ? (
                      <a className="race-detail-map-btn" href={race.officialWebsite} target="_blank" rel="noreferrer">
                        {t('races.intel_official_site')}
                      </a>
                    ) : null}
                  </div>
                </article>

                <article className="race-detail-readiness-card">
                  <div className="race-detail-readiness-head">
                    <h3>{t('races.detail_readiness_title')}</h3>
                    <span>{prediction ? `${confidence}%` : '--'}</span>
                  </div>
                  <div className="race-detail-checklist">
                    {readinessItems.map((item) => (
                      <div key={item.key} className={`race-detail-check-row${item.done ? ' is-done' : ''}`}>
                        <div>
                          <strong>{item.label}</strong>
                          <span>{item.meta}</span>
                        </div>
                        <AppIcon name={item.done ? 'check_circle' : 'radio_button_unchecked'} className="runner-dashboard-side-link-icon" />
                      </div>
                    ))}
                  </div>
                  <div className="race-detail-playbook-actions">
                    <button type="button" className="race-detail-playbook-btn" onClick={() => navigate('/races')}>
                      {t('races.detail_back')}
                    </button>
                    {savedRace ? (
                      <button type="button" className="race-detail-playbook-btn is-secondary" onClick={() => navigate('/schedule')}>
                        {t('races.stitch_view_training_plan')}
                      </button>
                    ) : null}
                  </div>
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import { apiJson } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import 'leaflet/dist/leaflet.css';

let leafletPromise = null;

async function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = import('leaflet').then((module) => module.default || module);
  }
  return leafletPromise;
}

const COPY = {
  en: {
    pageName: 'Territory',
    loading: 'Building territory map',
    settings: 'Open settings',
    todayRun: 'Open today run',
    demoMode: 'Demo territory',
    liveMode: 'Live territory',
    yourTerritory: 'Your territory',
    streets: 'GPS segments',
    coverage: 'Coverage',
    rank: 'Rank',
    allTerritories: 'All',
    myTerritory: 'Mine',
    contested: 'Contested',
    unclaimed: 'Unclaimed',
    leaderboard: 'Territory leaderboard',
    zones: 'Zones & contests',
    nextTarget: 'Coach pick — next conquest',
    recent: 'Recently captured',
    contests: 'Active contests',
    cities: 'Cities covered',
    claimed: 'Secured',
    by: 'vs',
    owner: 'Held by',
    difficulty: 'Effort',
    planRun: 'Plan the route',
    noTarget: 'Keep stacking GPS runs to unlock a meaningful conquest target.',
    secureHint: 'Run 2 more segments in this zone to lock it down.',
    noCities: 'Sync GPS runs in more places and Hermes will rank every city you touch.',
    briefKicker: 'Conquered space',
    briefHeld: 'zones secured',
    briefContested: 'under contest',
    briefRank: 'of',
    // Polygon brief copy
    conqueredSpace: 'Conquered space',
    closedLoopRuns: 'closed-loop runs',
    polygonEmptyTitle: 'Conquered space',
    polygonEmptyDesc: 'Run a closed loop — start and end within ~80 m of each other — and your shape lights up here. Out-and-back routes don\'t enclose territory.',
    polygonEmptyAction: 'View runs',
    polygonDoubleCountNote: 'Sum of polygon areas; overlapping runs may double-count.',
    showZoneView: 'Show zone view',
    hideZoneView: 'Hide zone view',
    polygonViewLabel: 'Polygon view',
    zoneViewLabel: 'Zone view',
  },
  'zh-CN': {
    pageName: '领地',
    loading: '正在生成领地地图',
    settings: '打开设置',
    todayRun: '打开今日训练',
    demoMode: '演示领地',
    liveMode: '实时领地',
    yourTerritory: '你的领地',
    streets: 'GPS 路段',
    coverage: '覆盖率',
    rank: '排名',
    allTerritories: '全部',
    myTerritory: '我的',
    contested: '争夺中',
    unclaimed: '未占领',
    leaderboard: '领地排行榜',
    zones: '区域与争夺',
    nextTarget: '教练建议 — 下个占领目标',
    recent: '最近占领',
    contests: '正在争夺',
    cities: '覆盖城市',
    claimed: '已稳固',
    by: 'vs',
    owner: '持有者',
    difficulty: '难度',
    planRun: '规划路线',
    noTarget: '继续积累 GPS 跑步，Hermes 会生成更有意义的争夺目标。',
    secureHint: '再跑 2 个这个区域内的路段，就能稳住这块领地。',
    noCities: '在更多城市同步 GPS 跑步后，Hermes 会为你统计每座城市的领地。',
    briefKicker: '征服空间',
    briefHeld: '个区域已稳固',
    briefContested: '个正在争夺',
    briefRank: '/',
    // Polygon brief copy
    conqueredSpace: '征服空间',
    closedLoopRuns: '条环形路线',
    polygonEmptyTitle: '征服空间',
    polygonEmptyDesc: '跑一条环形路线——起点和终点相距不超过 80 米——你的形状就会在这里点亮。往返路线不会圈出领地。',
    polygonEmptyAction: '查看跑步记录',
    polygonDoubleCountNote: '面积为各多边形之和；重叠路线可能重复计算。',
    showZoneView: '显示区域视图',
    hideZoneView: '隐藏区域视图',
    polygonViewLabel: '多边形视图',
    zoneViewLabel: '区域视图',
  },
};

const DEMO_TERRITORY = {
  available: false,
  mode: 'demo',
  center: { latitude: 37.822, longitude: -122.25, zoom: 14 },
  summary: { areaKm2: 14.2, cellCount: 27, coveragePct: 38, rank: 1, totalRunners: 42 },
  leaderboard: [
    { id: 1, name: 'You (Sasha)', color: '#f07561', active: true, cellCount: 27, areaKm2: 14.2, sampleCount: 1284, coveragePct: 38 },
    { id: 2, name: 'Kai Chen', color: '#5b9cf5', active: false, cellCount: 22, areaKm2: 11.8, sampleCount: 1042, coveragePct: 31 },
    { id: 3, name: 'Mia Torres', color: '#86efac', active: false, cellCount: 18, areaKm2: 9.4, sampleCount: 876, coveragePct: 25 },
    { id: 4, name: 'Leo Park', color: '#fbbf24', active: false, cellCount: 13, areaKm2: 7.1, sampleCount: 648, coveragePct: 19 },
    { id: 5, name: 'Nora Strom', color: '#c084fc', active: false, cellCount: 10, areaKm2: 5.6, sampleCount: 512, coveragePct: 15 },
  ],
  territories: [
    { id: 'oakland-hills', name: 'Oakland Hills', ownerId: 1, ownerName: 'You', color: '#f07561', polygon: [[37.815, -122.265], [37.825, -122.245], [37.835, -122.24], [37.84, -122.255], [37.838, -122.275], [37.828, -122.285], [37.818, -122.28]], sampleCount: 128, contested: false },
    { id: 'lake-merritt', name: 'Lake Merritt Loop', ownerId: 1, ownerName: 'You', color: '#f07561', polygon: [[37.8, -122.26], [37.81, -122.245], [37.82, -122.25], [37.815, -122.27], [37.805, -122.275]], sampleCount: 94, contested: true, challengerName: 'Kai Chen' },
    { id: 'montclair', name: 'Montclair', ownerId: 1, ownerName: 'You', color: '#f07561', polygon: [[37.835, -122.235], [37.845, -122.22], [37.85, -122.23], [37.848, -122.245], [37.84, -122.248]], sampleCount: 86, contested: false },
    { id: 'rockridge', name: 'Rockridge', ownerId: 2, ownerName: 'Kai Chen', color: '#5b9cf5', polygon: [[37.842, -122.255], [37.852, -122.24], [37.858, -122.245], [37.855, -122.26], [37.848, -122.265]], sampleCount: 76, contested: false },
    { id: 'north-oakland', name: 'North Oakland', ownerId: 2, ownerName: 'Kai Chen', color: '#5b9cf5', polygon: [[37.85, -122.235], [37.86, -122.22], [37.865, -122.23], [37.858, -122.24]], sampleCount: 64, contested: false },
    { id: 'lakeshore', name: 'Lakeshore Ave', ownerId: 3, ownerName: 'Mia Torres', color: '#86efac', polygon: [[37.795, -122.275], [37.805, -122.26], [37.812, -122.268], [37.808, -122.282], [37.8, -122.288]], sampleCount: 58, contested: false },
    { id: 'piedmont', name: 'Piedmont Ave', ownerId: 3, ownerName: 'Mia Torres', color: '#86efac', polygon: [[37.808, -122.25], [37.815, -122.24], [37.82, -122.248], [37.815, -122.258]], sampleCount: 54, contested: true, challengerName: 'You' },
    { id: 'bay-farm', name: 'Bay Farm Island', ownerId: 4, ownerName: 'Leo Park', color: '#fbbf24', polygon: [[37.76, -122.24], [37.77, -122.225], [37.778, -122.232], [37.775, -122.248], [37.768, -122.252]], sampleCount: 48, contested: false },
    { id: 'temescal', name: 'Temescal', ownerId: 5, ownerName: 'Nora Strom', color: '#c084fc', polygon: [[37.83, -122.22], [37.838, -122.208], [37.845, -122.215], [37.84, -122.228]], sampleCount: 42, contested: false },
  ],
  zones: [
    { id: 'oakland-hills', name: 'Oakland Hills', ownerName: 'You', color: '#f07561', areaKm2: 4.8, contested: false, challengerName: null, sampleCount: 128 },
    { id: 'lake-merritt', name: 'Lake Merritt Loop', ownerName: 'You', color: '#f07561', areaKm2: 2.1, contested: true, challengerName: 'Kai Chen', sampleCount: 94 },
    { id: 'rockridge', name: 'Rockridge', ownerName: 'Kai Chen', color: '#5b9cf5', areaKm2: 3.2, contested: false, challengerName: null, sampleCount: 76 },
    { id: 'temescal', name: 'Temescal', ownerName: 'You', color: '#f07561', areaKm2: 1.9, contested: false, challengerName: null, sampleCount: 72 },
    { id: 'piedmont', name: 'Piedmont Ave', ownerName: 'Mia Torres', color: '#86efac', areaKm2: 1.4, contested: true, challengerName: 'You', sampleCount: 54 },
    { id: 'bay-farm', name: 'Bay Farm Island', ownerName: 'Leo Park', color: '#fbbf24', areaKm2: 2.8, contested: false, challengerName: null, sampleCount: 48 },
    { id: 'montclair', name: 'Montclair', ownerName: 'You', color: '#f07561', areaKm2: 3.1, contested: false, challengerName: null, sampleCount: 86 },
  ],
  recentCaptures: [
    { name: 'Moraga Ave', dateLabel: '29 APR', sampleCount: 24, km: 1.2 },
    { name: 'Skyline Blvd (S)', dateLabel: '26 APR', sampleCount: 18, km: 2.8 },
    { name: 'Lakeshore Ave', dateLabel: '25 APR', sampleCount: 12, km: 0.6 },
    { name: 'Broadway Terrace', dateLabel: '22 APR', sampleCount: 10, km: 1.4 },
    { name: 'Tunnel Rd', dateLabel: '19 APR', sampleCount: 8, km: 1.8 },
  ],
  nextTarget: { name: 'Piedmont Ave district', ownerName: 'Mia Torres', areaKm2: 1.4, samplesToContest: 12, difficulty: 'Easy reach' },
  cities: [
    { city: 'Oakland, CA', areaKm2: 14.2, coveragePct: 38, streets: 1284 },
    { city: 'San Francisco, CA', areaKm2: 4.8, coveragePct: 8, streets: 412 },
    { city: 'Berkeley, CA', areaKm2: 2.1, coveragePct: 22, streets: 186 },
  ],
};

function getCopy(lang, key) {
  return (COPY[lang] || COPY.en)[key] || COPY.en[key] || key;
}

function getDisplayName(profile, fallback) {
  const displayName = typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
  const emailName = typeof profile?.email === 'string' ? profile.email.split('@')[0] : '';
  const raw = displayName || emailName || String(fallback || '');
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function safeColor(color, fallback = '#f07561') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : fallback;
}

function isOwnedByActive(cell) {
  return cell?.ownerName === 'You' || cell?.active === true;
}

function cellCenter(cell) {
  const polygon = Array.isArray(cell?.polygon) ? cell.polygon : [];
  if (Number.isFinite(cell?.centerLat) && Number.isFinite(cell?.centerLng)) {
    return [cell.centerLat, cell.centerLng];
  }
  if (!polygon.length) return null;
  const totals = polygon.reduce((acc, point) => {
    const lat = Number(point?.[0]);
    const lng = Number(point?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return acc;
    return { lat: acc.lat + lat, lng: acc.lng + lng, count: acc.count + 1 };
  }, { lat: 0, lng: 0, count: 0 });
  return totals.count > 0 ? [totals.lat / totals.count, totals.lng / totals.count] : null;
}

function runnerMarkerPositions(territory, leaderboard) {
  const cells = Array.isArray(territory?.territories) ? territory.territories : [];
  return leaderboard
    .map((runner) => {
      const ownedCell = cells.find((cell) => cell.ownerId === runner.id || cell.ownerName === runner.name || (runner.active && isOwnedByActive(cell)));
      const position = cellCenter(ownedCell);
      return position ? { ...runner, position } : null;
    })
    .filter(Boolean);
}

function contestShare(zone) {
  const raw = Number(zone?.sampleCount || 0);
  const owner = Math.min(72, Math.max(56, raw || 62));
  return { owner, challenger: 100 - owner };
}

/** Read the coral stroke color from CSS custom properties at runtime */
function getCoralStroke() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-coral-strong').trim() || '#f07561';
}

function TerritoryMap({ territory, filter, leaderboard, polygons, showPolygons }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);
  const polygonLayerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;

      const center = territory?.center || DEMO_TERRITORY.center;
      const map = L.map(mapRef.current, {
        center: [center.latitude, center.longitude],
        zoom: center.zoom || 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    mountMap();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [territory]);

  // Paint zone/territory polygons (existing zone view)
  useEffect(() => {
    let cancelled = false;

    async function paintTerritories() {
      const map = mapInstanceRef.current;
      if (!map) return;
      const L = await loadLeaflet();
      if (cancelled) return;

      if (layerRef.current) {
        layerRef.current.remove();
      }
      const layer = L.layerGroup().addTo(map);
      const cells = Array.isArray(territory?.territories) ? territory.territories : [];
      const visibleCells = cells.filter((cell) => {
        if (filter === 'mine') return isOwnedByActive(cell);
        if (filter === 'contested') return cell.contested;
        if (filter === 'unclaimed') return !cell.ownerName;
        return true;
      });

      visibleCells.forEach((cell) => {
        const color = safeColor(cell.color);
        L.polygon(cell.polygon, {
          color,
          weight: cell.contested ? 2.2 : 1.5,
          opacity: cell.contested ? 0.84 : 0.62,
          fillColor: color,
          fillOpacity: isOwnedByActive(cell) ? 0.35 : 0.2,
          dashArray: cell.contested ? '6 4' : null,
        }).bindTooltip(`${cell.name} - ${cell.ownerName || 'Unclaimed'}`).addTo(layer);
      });

      runnerMarkerPositions(territory, leaderboard).forEach((runner) => {
        const color = safeColor(runner.color);
        const size = runner.active ? 16 : 10;
        const icon = L.divIcon({
          className: 'terr-marker',
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 12px ${color}80;"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker(runner.position, { icon }).addTo(layer);
      });

      if (visibleCells.length > 0) {
        const bounds = L.latLngBounds(visibleCells.flatMap((cell) => cell.polygon));
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14 });
        }
      }
      layerRef.current = layer;
    }

    paintTerritories();
    return () => {
      cancelled = true;
    };
  }, [territory, filter, leaderboard]);

  // Paint closed-loop polygons from /api/territory/polygons
  useEffect(() => {
    let cancelled = false;

    async function paintPolygons() {
      const map = mapInstanceRef.current;
      if (!map) return;
      const L = await loadLeaflet();
      if (cancelled) return;

      if (polygonLayerRef.current) {
        polygonLayerRef.current.remove();
        polygonLayerRef.current = null;
      }

      if (!showPolygons || !Array.isArray(polygons) || polygons.length === 0) return;

      const strokeColor = getCoralStroke();
      const layer = L.layerGroup().addTo(map);

      const allCoords = [];
      polygons.forEach((poly) => {
        if (!Array.isArray(poly.coordinates) || poly.coordinates.length < 3) return;
        const areaKm2 = ((poly.areaSquareMeters || 0) / 1_000_000).toFixed(2);
        L.polygon(poly.coordinates, {
          color: strokeColor,
          weight: 2,
          opacity: 0.88,
          fillColor: strokeColor,
          fillOpacity: 0.22,
        }).bindTooltip(`${areaKm2} km²`).addTo(layer);
        poly.coordinates.forEach((coord) => allCoords.push(coord));
      });

      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14 });
        }
      }

      polygonLayerRef.current = layer;
    }

    paintPolygons();
    return () => {
      cancelled = true;
    };
  }, [polygons, showPolygons]);

  return <div ref={mapRef} className="terr-leaflet-map" />;
}

export default function Territory() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const wt = (key) => getCopy(lang, key);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [territory, setTerritory] = useState(DEMO_TERRITORY);
  const [loadState, setLoadState] = useState('loading');
  const [filter, setFilter] = useState('all');

  // Polygon state
  const [polygonData, setPolygonData] = useState(null);
  const [showZoneView, setShowZoneView] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    async function loadTerritoryData() {
      setLoadState('loading');
      try {
        const [profileData, territoryData, polygonsData] = await Promise.all([
          apiJson('/api/profile/me').catch(() => null),
          apiJson('/api/territory').catch(() => null),
          apiJson('/api/territory/polygons').catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(profileData && typeof profileData === 'object' ? profileData : null);
        setTerritory(territoryData?.available ? territoryData : DEMO_TERRITORY);
        setPolygonData(polygonsData && typeof polygonsData === 'object' ? polygonsData : null);
        setLoadState('ready');
      } catch {
        if (!cancelled) {
          setTerritory(DEMO_TERRITORY);
          setLoadState('ready');
        }
      }
    }

    loadTerritoryData();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate]);

  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'territory' }),
    [lang, t],
  );
  const initials = getDisplayName(profile, t('profile.default_name')).slice(0, 1).toUpperCase();
  const summary = territory?.summary || DEMO_TERRITORY.summary;
  const leaderboard = territory?.leaderboard?.length ? territory.leaderboard : DEMO_TERRITORY.leaderboard;
  const zones = territory?.zones?.length ? territory.zones : DEMO_TERRITORY.zones;
  const recentCaptures = territory?.recentCaptures?.length ? territory.recentCaptures : DEMO_TERRITORY.recentCaptures;
  const activeContests = zones.filter((zone) => zone.contested);
  const cities = territory?.cities?.length ? territory.cities : DEMO_TERRITORY.cities;
  const modeLabel = loadState === 'loading' ? wt('loading') : (territory?.mode === 'live' ? wt('liveMode') : wt('demoMode'));

  const myZones = zones.filter((z) => z.ownerName === 'You' || isOwnedByActive(z));
  const myContested = zones.filter((z) => z.contested && (z.ownerName === 'You' || z.challengerName === 'You'));

  const targetDescription = territory?.nextTarget
    ? (lang === 'zh-CN'
      ? `再获得 ${territory.nextTarget.samplesToContest} 个 GPS 采样点，就能从 ${territory.nextTarget.ownerName} 手里争夺这块区域。把它接到一次轻松跑里，不需要额外硬冲。`
      : `${territory.nextTarget.samplesToContest} more GPS samples puts you in contest range against ${territory.nextTarget.ownerName}. Fold it into an easy route — no separate workout needed.`)
    : wt('noTarget');

  // Polygon-derived values
  const polygons = useMemo(() => polygonData?.polygons || [], [polygonData]);
  const totalAreaSqm = polygonData?.totalAreaSquareMeters || 0;
  const polygonCount = polygonData?.polygonCount || 0;
  const totalAreaKm2 = (totalAreaSqm / 1_000_000).toFixed(1);
  const hasPolygons = polygonCount > 0;

  // Today's polygon: check if any polygon was created today
  const todayPolygon = useMemo(() => {
    if (!polygons.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    return polygons.find((p) => p.createdAt && String(p.createdAt).slice(0, 10) === today) || null;
  }, [polygons]);

  const todayAreaKm2 = todayPolygon
    ? ((todayPolygon.areaSquareMeters || 0) / 1_000_000).toFixed(1)
    : null;

  // Coach-voice insight for polygon brief
  const polygonInsight = useMemo(() => {
    if (!hasPolygons) return null;
    if (lang === 'zh-CN') {
      const base = `你的征服空间 — 共 ${totalAreaKm2} km²，来自 ${polygonCount} 条环形路线。`;
      return todayAreaKm2
        ? `${base}今天的路线新增了 ${todayAreaKm2} km²。`
        : base;
    }
    const base = `Your conquered space — ${totalAreaKm2} km² across ${polygonCount} closed-loop ${polygonCount === 1 ? 'run' : 'runs'}.`;
    return todayAreaKm2
      ? `${base} Today's run added ${todayAreaKm2} km².`
      : base;
  }, [hasPolygons, totalAreaKm2, polygonCount, todayAreaKm2, lang]);

  return (
    <div className={`runner-shell-page territory-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{wt('pageName')}</span>
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
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runner-shell-sidebar-footer">
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/today-run')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">+</span>
            <span className="runner-dashboard-workout-btn-label">{wt('todayRun')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <div className="runner-shell-topnav">
              <span className="runner-shell-topnav-link is-active">{wt('pageName')}</span>
              <span className="territory-mode-pill">{modeLabel}</span>
            </div>
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={wt('settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={getDisplayName(profile, t('profile.default_name'))} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas territory-canvas">

          {/* Coach brief — above the fold answer — polygon-first */}
          <section className="terr-brief">
            <div className="terr-brief-kicker">
              <AppIcon name="territory" className="terr-brief-icon" />
              <span>{wt('conqueredSpace')}</span>
            </div>

            {hasPolygons ? (
              <>
                <div className="terr-brief-kpis">
                  <div className="terr-brief-kpi terr-brief-kpi--area">
                    <strong>{totalAreaKm2}<small> km²</small></strong>
                    <span>{wt('conqueredSpace')}</span>
                  </div>
                  <div className="terr-brief-kpi">
                    <strong>{polygonCount}<small> {wt('closedLoopRuns')}</small></strong>
                    <span>{wt('yourTerritory')}</span>
                  </div>
                  {todayAreaKm2 && (
                    <div className="terr-brief-kpi terr-brief-kpi--area">
                      <strong>+{todayAreaKm2}<small> km²</small></strong>
                      <span>{lang === 'zh-CN' ? '今日新增' : 'Today added'}</span>
                    </div>
                  )}
                  <div className="terr-brief-kpi">
                    <strong>{myZones.length}<small> {wt('briefHeld')}</small></strong>
                    <span>{wt('coverage')} {summary.coveragePct}%</span>
                  </div>
                  {myContested.length > 0 && (
                    <div className="terr-brief-kpi terr-brief-kpi--alert">
                      <strong>{myContested.length}<small> {wt('briefContested')}</small></strong>
                      <span>{myContested.map((z) => z.name).join(', ')}</span>
                    </div>
                  )}
                </div>
                {polygonInsight && (
                  <p className="terr-brief-insight">{polygonInsight}</p>
                )}
                <p className="terr-brief-double-count-note">{wt('polygonDoubleCountNote')}</p>
              </>
            ) : (
              <div className="terr-brief-empty-polygons">
                <p className="terr-brief-empty-desc">{wt('polygonEmptyDesc')}</p>
                <button
                  type="button"
                  className="terr-brief-empty-cta"
                  onClick={() => navigate('/runs')}
                >
                  {wt('polygonEmptyAction')}
                </button>
              </div>
            )}
          </section>

          {/* Map section */}
          <section className="terr-map-section">
            <TerritoryMap
              territory={territory}
              filter={filter}
              leaderboard={leaderboard}
              polygons={polygons}
              showPolygons={!showZoneView}
            />

            <div className="terr-overlay-filters">
              {/* Polygon / zone view toggle pill */}
              <button
                type="button"
                className={`terr-pill terr-pill--view-toggle${showZoneView ? '' : ' is-active'}`}
                onClick={() => setShowZoneView(false)}
                aria-pressed={!showZoneView}
              >
                {wt('polygonViewLabel')}
              </button>
              <button
                type="button"
                className={`terr-pill terr-pill--view-toggle${showZoneView ? ' is-active' : ''}`}
                onClick={() => setShowZoneView(true)}
                aria-pressed={showZoneView}
              >
                {wt('zoneViewLabel')}
              </button>

              {/* Zone filter pills — visible only in zone view */}
              {showZoneView && [
                ['all', wt('allTerritories')],
                ['mine', wt('myTerritory')],
                ['contested', wt('contested')],
                ['unclaimed', wt('unclaimed')],
              ].map(([key, label]) => (
                <button key={key} type="button" className={`terr-pill${filter === key ? ' is-active' : ''}`} onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="terr-overlay-legend">
              {leaderboard.slice(0, 6).map((runner) => (
                <span key={runner.id} className="terr-legend-item">
                  <span className="terr-legend-dot" style={{ background: safeColor(runner.color) }} />
                  {String(runner.name || '').split('(')[0].trim()}
                </span>
              ))}
            </div>
          </section>

          {/* Zone/grid view — secondary, behind disclosure */}
          {showZoneView && (
            <section className="terr-below-grid">
              <article className="terr-card terr-leaderboard">
                <span className="section-label terr-section-label">{wt('leaderboard')}</span>
                <div className="terr-lb-list">
                  {leaderboard.map((runner, index) => (
                    <div key={runner.id} className={`terr-lb-row${runner.active ? ' is-you' : ''}`}>
                      <span className="terr-lb-rank">#{index + 1}</span>
                      <span className="terr-lb-swatch" style={{ background: safeColor(runner.color) }} />
                      <div className="terr-lb-info">
                        <strong>{runner.name}</strong>
                        <span>{runner.sampleCount} {wt('streets')} · {runner.coveragePct}%</span>
                      </div>
                      <strong className="terr-lb-area">{runner.areaKm2} km²</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="terr-card terr-zones-card">
                <span className="section-label terr-section-label">{wt('zones')}</span>
                <div className="terr-zone-list">
                  {zones.map((zone) => (
                    <div key={zone.id} className={`terr-zone-row${zone.contested ? ' is-contested' : ''}`}>
                      <span className="terr-zone-swatch" style={{ background: safeColor(zone.color) }} />
                      <div className="terr-zone-info">
                        <strong>{zone.name}</strong>
                        <span>{zone.ownerName} · {zone.areaKm2 || 0} km²</span>
                      </div>
                      <span className={`terr-mini-pill${zone.contested ? ' is-warning' : ' is-accent'}`}>
                        {zone.contested ? `${wt('contested')} ${wt('by')} ${zone.challengerName || 'rival'}` : wt('claimed')}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="terr-card terr-target-card">
                <span className="section-label terr-section-label">{wt('nextTarget')}</span>
                {territory?.nextTarget ? (
                  <>
                    <h3>{territory.nextTarget.name}</h3>
                    <p>{targetDescription}</p>
                    <div className="terr-target-meta">
                      <span>{territory.nextTarget.areaKm2} km²</span>
                      <span>{wt('owner')}: {territory.nextTarget.ownerName}</span>
                      <span>{wt('difficulty')}: {territory.nextTarget.difficulty}</span>
                    </div>
                    <button type="button" className="today-run-stitch-primary-btn terr-target-button" onClick={() => navigate('/schedule')}>
                      {wt('planRun')}
                    </button>
                  </>
                ) : (
                  <div className="terr-target-empty">
                    <p>{wt('noTarget')}</p>
                    <button type="button" className="today-run-stitch-primary-btn terr-target-button" onClick={() => navigate('/runs')}>
                      {lang === 'zh-CN' ? '查看跑步记录' : 'View my runs'}
                    </button>
                  </div>
                )}
              </article>

              <article className="terr-card terr-recent-card">
                <span className="section-label terr-section-label">{wt('recent')}</span>
                <div className="terr-recent-list">
                  {recentCaptures.map((capture) => (
                    <div key={`${capture.name}-${capture.dateLabel}`} className="terr-recent-row">
                      <AppIcon name="territory" />
                      <div className="terr-recent-info">
                        <strong>{capture.name}</strong>
                        <span>{capture.dateLabel} · {capture.km ? `${capture.km} km` : `${capture.sampleCount} ${wt('streets')}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="terr-card terr-contests-card">
                <span className="section-label terr-section-label">{wt('contests')}</span>
                {(activeContests.length ? activeContests : zones.slice(0, 2)).map((zone) => {
                  const share = contestShare(zone);
                  const challengerColor = safeColor(
                    leaderboard.find((runner) => zone.challengerName && runner.name?.includes(zone.challengerName === 'You' ? 'You' : zone.challengerName))?.color,
                    '#5b9cf5',
                  );
                  return (
                    <div key={`contest-${zone.id}`} className="terr-contest-block">
                      <div className="terr-contest-head">
                        <span className="terr-zone-swatch" style={{ background: safeColor(zone.color) }} />
                        <h4>{zone.name}</h4>
                        <span className="terr-mini-pill is-warning">{zone.contested ? wt('contested') : wt('claimed')}</span>
                      </div>
                      <div className="terr-contest-bar">
                        <div className="terr-bar-side" style={{ flex: share.owner }}>
                          <span style={{ background: safeColor(zone.color) }} />
                          <small>{zone.ownerName} · {share.owner}%</small>
                        </div>
                        <div className="terr-bar-side" style={{ flex: share.challenger }}>
                          <span style={{ background: challengerColor }} />
                          <small>{zone.challengerName || wt('contested')} · {share.challenger}%</small>
                        </div>
                      </div>
                      <p className="terr-contest-hint">{wt('secureHint')}</p>
                    </div>
                  );
                })}
              </article>

              <article className="terr-card terr-cities-card">
                <span className="section-label terr-section-label">{wt('cities')}</span>
                <div className="terr-cities-list">
                  {cities.length ? cities.map((city) => (
                    <div key={city.city || city.name} className="terr-city-row">
                      <div className="terr-city-info">
                        <strong>{city.city || city.name}</strong>
                        <span>{city.streets || city.sampleCount || 0} {wt('streets')} · {city.coveragePct || 0}%</span>
                      </div>
                      <strong className="terr-city-area">{city.areaKm2 || city.area || 0} km²</strong>
                    </div>
                  )) : <p className="terr-empty-copy">{wt('noCities')}</p>}
                </div>
              </article>
            </section>
          )}

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}

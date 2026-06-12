import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import { apiFetch, apiJson } from '../api';
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

if (typeof window !== 'undefined') {
  void loadLeaflet();
}

const MAP_CHROME_COPY = {
  en: {
    pageTitle: 'Territory',
    recenter: 'Recenter',
    loadingTerritory: 'Loading territory',
    viewRuns: 'View runs',
    settings: 'Open settings',
    gameHud: 'Territory game status',
    modeTabs: 'Territory modes',
    myTerritories: 'My Territories',
    singlePlayer: 'Single Player',
    myClub: 'My Club',
    kingOfArea: 'King of the area',
    territoryRunner: 'Territory runner',
    localBattle: 'Local battle',
    you: 'You',
    opponent: 'Opponent',
    leaderboard: 'Leaderboard',
    events: 'Events',
    territoriesTab: 'Territories',
    history: 'History',
    overall: 'Overall',
    totalArea: 'Total area',
    zonesControlled: 'Zones',
    playerTerritory: 'My territory',
    controlledLand: 'Controlled land',
    coverage: 'Coverage',
    rank: 'Rank',
    ownedSectors: 'Owned sectors',
    captureFeed: 'Capture feed',
    nextTarget: 'Next target',
    samplesToContest: 'Samples to contest',
    samples: 'samples',
    loadingKicker: 'Live territory board',
    loadingCopy: 'Every run adds real ground to your board. Hold your strongest sectors and pressure the next target.',
    startRun: 'Start next run',
    targetPressure: 'Target pressure',
    sectorValue: 'Every 1KM\u00b2 strengthens control',
    colorThemes: 'Color themes',
    allThemes: 'All users',
    allThemesHint: 'Show every owner',
    territoryScope: 'Territory scope',
    ownTerritory: 'Own territory',
    ownTerritoryHint: 'Show only your land',
    globalTerritory: 'Global territory',
    globalTerritoryHint: 'Show every user',
    focusTheme: 'Focus theme',
    activeTheme: 'Current',
    rivalTheme: 'Rival',
    themeRegions: 'regions',
    themeRegion: 'region',
    themeAreaUnknown: 'Area pending',
    ownerInfoTitle: 'Territory owner',
    username: 'Username',
    status: 'Status',
    ownedArea: 'Owned area',
    mappedRegions: 'Mapped regions',
    ownerId: 'Owner ID',
    closeOwnerInfo: 'Close owner info',
    clickTerritoryOwner: 'Click territory owned by',
  },
  'zh-CN': {
    pageTitle: '\u9886\u5730',
    recenter: '\u91cd\u65b0\u5c45\u4e2d',
    loadingTerritory: '\u6b63\u5728\u8f7d\u5165\u9886\u5730',
    viewRuns: '\u67e5\u770b\u8dd1\u6b65\u8bb0\u5f55',
    settings: '\u6253\u5f00\u8bbe\u7f6e',
    gameHud: '\u9886\u5730\u6e38\u620f\u72b6\u6001',
    modeTabs: '\u9886\u5730\u6a21\u5f0f',
    myTerritories: '\u6211\u7684\u9886\u5730',
    singlePlayer: '\u5355\u4eba\u6a21\u5f0f',
    myClub: '\u6211\u7684\u4ff1\u4e50\u90e8',
    kingOfArea: '\u533a\u57df\u4e4b\u738b',
    territoryRunner: '\u9886\u5730\u8dd1\u8005',
    localBattle: '\u672c\u5730\u5bf9\u6218',
    you: '\u4f60',
    opponent: '\u5bf9\u624b',
    leaderboard: '\u6392\u884c\u699c',
    events: '\u6d3b\u52a8',
    territoriesTab: '\u9886\u5730',
    history: '\u5386\u53f2',
    overall: '\u603b\u699c',
    totalArea: '\u603b\u9762\u79ef',
    zonesControlled: '\u63a7\u5236\u533a',
    playerTerritory: '\u6211\u7684\u9886\u5730',
    controlledLand: '\u5df2\u63a7\u5236\u571f\u5730',
    coverage: '\u8986\u76d6\u7387',
    rank: '\u6392\u540d',
    ownedSectors: '\u5df2\u5360\u533a\u5757',
    captureFeed: '\u5360\u9886\u52a8\u6001',
    nextTarget: '\u4e0b\u4e00\u76ee\u6807',
    samplesToContest: '\u4e89\u593a\u6240\u9700\u91c7\u6837',
    samples: '\u91c7\u6837',
    loadingKicker: '\u5b9e\u65f6\u9886\u5730\u68cb\u76d8',
    loadingCopy: '\u6bcf\u6b21\u8dd1\u6b65\u90fd\u4f1a\u4e3a\u4f60\u7684\u68cb\u76d8\u589e\u52a0\u771f\u5b9e\u5730\u9762\u3002\u5b88\u4f4f\u6700\u5f3a\u533a\u5757\uff0c\u5411\u4e0b\u4e00\u76ee\u6807\u65bd\u538b\u3002',
    startRun: '\u5f00\u59cb\u4e0b\u4e00\u6b21\u8dd1\u6b65',
    targetPressure: '\u76ee\u6807\u538b\u529b',
    sectorValue: '\u6bcf 1KM\u00b2 \u90fd\u4f1a\u589e\u5f3a\u63a7\u5236\u529b',
    colorThemes: '\u9886\u5730\u914d\u8272',
    allThemes: '\u5168\u90e8\u7528\u6237',
    allThemesHint: '\u663e\u793a\u6240\u6709\u7528\u6237',
    territoryScope: '\u9886\u5730\u89c6\u56fe',
    ownTerritory: '\u6211\u7684\u9886\u5730',
    ownTerritoryHint: '\u53ea\u770b\u4f60\u7684\u571f\u5730',
    globalTerritory: '\u5168\u5c40\u9886\u5730',
    globalTerritoryHint: '\u663e\u793a\u6240\u6709\u7528\u6237',
    focusTheme: '\u805a\u7126\u914d\u8272',
    activeTheme: '\u5f53\u524d',
    rivalTheme: '\u5bf9\u624b',
    themeRegions: '\u4e2a\u533a\u57df',
    themeRegion: '\u4e2a\u533a\u57df',
    themeAreaUnknown: '\u9762\u79ef\u8ba1\u7b97\u4e2d',
    ownerInfoTitle: '\u9886\u5730\u6240\u6709\u8005',
    username: '\u7528\u6237\u540d',
    status: '\u72b6\u6001',
    ownedArea: '\u5360\u6709\u9762\u79ef',
    mappedRegions: '\u5730\u56fe\u533a\u57df',
    ownerId: '\u7528\u6237 ID',
    closeOwnerInfo: '\u5173\u95ed\u6240\u6709\u8005\u4fe1\u606f',
    clickTerritoryOwner: '\u70b9\u51fb\u9886\u5730\u6240\u6709\u8005',
  },
};

const EMPTY_TERRITORY = {
  available: false,
  mode: 'empty',
  center: null,
  summary: { areaKm2: 0, cellCount: 0, coveragePct: 0, rank: null, totalRunners: 0 },
  leaderboard: [],
  territories: [],
  zones: [],
  recentCaptures: [],
  nextTarget: null,
  cities: [],
};


function safeColor(color, fallback = '#f07561') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : fallback;
}

function mapChromeCopy(lang, key) {
  return MAP_CHROME_COPY[lang]?.[key] || MAP_CHROME_COPY.en[key] || key;
}

function TerritoryInitialLoading({
  label,
  copy,
  kicker,
  centerLabel,
  runsLabel,
  settingsLabel,
  initials,
  onProfile,
  onRuns,
  onSettings,
}) {
  return (
    <div className="heatmap-page territory-loading-page" aria-busy="true">
      <div className="heatmap-page-map-shell">
        <div className="heatmap-page-map-canvas" aria-hidden="true" />
        <div className="heatmap-page-map-vignette" aria-hidden="true" />

        <header className="heatmap-page-topbar" aria-label={label}>
          <button
            type="button"
            className="heatmap-page-brand-pill"
            onClick={onProfile}
            aria-label={`Hermes ${kicker}`}
          >
            <HermesLogo dark />
            <span>{kicker}</span>
          </button>

          <button
            type="button"
            className="heatmap-page-search-pill"
            disabled
            aria-label={centerLabel}
          >
            <AppIcon name="search" className="heatmap-page-pill-icon" />
            <div className="heatmap-page-search-copy">
              <strong>{centerLabel}</strong>
              <span>{label}</span>
            </div>
          </button>

          <div className="heatmap-page-action-strip">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <button type="button" className="heatmap-page-secondary-btn is-overlay" onClick={onRuns}>
                {runsLabel}
              </button>
              <button type="button" className="heatmap-page-primary-btn is-overlay" onClick={onSettings}>
                {settingsLabel}
              </button>
              <button
                type="button"
                className="runner-shell-avatar heatmap-page-avatar"
                aria-label="Hermes"
                onClick={onProfile}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="heatmap-page-empty" role="status" aria-live="polite">
          <div className="heatmap-page-empty-copy">
            <span className="heatmap-page-card-kicker">{kicker}</span>
            <h3>{label}</h3>
            <p>{copy}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCoordinate(value, positiveSuffix, negativeSuffix) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return `${Math.abs(numeric).toFixed(3)}\u00b0${numeric >= 0 ? positiveSuffix : negativeSuffix}`;
}

function formatCenterLabel(center) {
  const lat = formatCoordinate(center?.latitude, 'N', 'S');
  const lng = formatCoordinate(center?.longitude, 'E', 'W');
  return `${lat} / ${lng}`;
}

function formatTerritoryArea(value, fallback = '0KM\u00b2') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const fixed = numeric >= 100 ? numeric.toFixed(0) : numeric >= 10 ? numeric.toFixed(1) : numeric.toFixed(2);
  return `${fixed.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')}KM\u00b2`;
}

function formatTerritoryPercent(value, fallback = '--') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return `${Math.round(Math.max(0, Math.min(100, numeric)))}%`;
}

function formatTerritoryRank(summary) {
  const rank = Number(summary?.rank);
  const total = Number(summary?.totalRunners);
  if (!Number.isFinite(rank) || rank <= 0) return '--';
  return Number.isFinite(total) && total > 0 ? `#${rank} / ${total}` : `#${rank}`;
}

function formatSampleCount(value, fallback = '0') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.max(0, numeric));
}

function runnerDisplayName(runner, profile, fallback = 'You') {
  const runnerName = String(runner?.name || '').trim();
  if (runner?.active) {
    const profileName = String(profile?.displayName || profile?.email || '').trim();
    if (profileName) return profileName;
  }
  return runnerName || fallback;
}

function runnerInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'H';
  return words.slice(0, 2).map((word) => word.slice(0, 1).toUpperCase()).join('');
}

function territoryLeaderboardRows(territory, profile) {
  const rows = Array.isArray(territory?.leaderboard) ? territory.leaderboard : [];
  if (rows.length) return rows.slice(0, 8);
  return [{
    id: 'active-runner',
    name: runnerDisplayName(null, profile),
    color: '#f07561',
    active: true,
    areaKm2: Number(territory?.summary?.areaKm2) || 0,
    coveragePct: Number(territory?.summary?.coveragePct) || 0,
    cellCount: Number(territory?.summary?.cellCount) || 0,
  }];
}

function activeTerritoryRunner(territory, profile) {
  const rows = territoryLeaderboardRows(territory, profile);
  return rows.find((runner) => runner?.active) || rows[0] || null;
}

function rivalTerritoryRunner(territory) {
  const rows = Array.isArray(territory?.leaderboard) ? territory.leaderboard : [];
  return rows.find((runner) => !runner?.active) || null;
}

function clampShare(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function territoryBattleShares(territory, activeRunner, rivalRunner) {
  const activeShare = clampShare(activeRunner?.coveragePct ?? territory?.summary?.coveragePct);
  const rivalShare = rivalRunner ? clampShare(rivalRunner.coveragePct) : Math.max(0, 100 - activeShare);
  const total = Math.max(activeShare + rivalShare, 1);
  return {
    active: (activeShare / total) * 100,
    rival: (rivalShare / total) * 100,
  };
}

function normalizeOwnerName(value) {
  return String(value || '').trim().toLowerCase();
}

function ownedTerritoryZones(territory, activeName) {
  const activeOwnerName = normalizeOwnerName(activeName);
  return (Array.isArray(territory?.zones) ? territory.zones : [])
    .filter((zone) => {
      const ownerName = normalizeOwnerName(zone?.ownerName);
      return ownerName === 'you' || (!!activeOwnerName && ownerName === activeOwnerName);
    })
    .sort((a, b) => {
      const controlDelta = Number(b?.controlPct || 0) - Number(a?.controlPct || 0);
      if (controlDelta !== 0) return controlDelta;
      return Number(b?.sampleCount || 0) - Number(a?.sampleCount || 0);
    })
    .slice(0, 4);
}

function recentCaptureRows(territory) {
  return (Array.isArray(territory?.recentCaptures) ? territory.recentCaptures : []).slice(0, 2);
}

function isValidMapCenter(center) {
  return Number.isFinite(Number(center?.latitude)) && Number.isFinite(Number(center?.longitude));
}

function territoryInitialZoom(center) {
  const zoom = Number(center?.zoom);
  return Math.min(Math.max(Number.isFinite(zoom) ? zoom : 13, 12), 14);
}

function territoryBoundsKey(bounds) {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  return [
    southWest.lat.toFixed(6),
    southWest.lng.toFixed(6),
    northEast.lat.toFixed(6),
    northEast.lng.toFixed(6),
  ].join(':');
}

function ensureActiveConcretePathsInView(map) {
  const container = map?.getContainer?.();
  if (!container) return;

  const activePaths = Array.from(container.querySelectorAll('.terr-land-mask-concrete-land--active'));
  if (!activePaths.length) return;

  const containerRect = container.getBoundingClientRect();
  const hasClippedActivePath = activePaths.some((path) => {
    const rect = path.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return rect.left < containerRect.left
      || rect.right > containerRect.right
      || rect.top < containerRect.top
      || rect.bottom > containerRect.bottom;
  });

  const currentZoom = Number(map.getZoom?.());
  if (hasClippedActivePath && Number.isFinite(currentZoom) && currentZoom < 12) {
    map.setZoom(12, { animate: false });
  }
}

/** Read the coral stroke color from CSS custom properties at runtime */
function getCoralStroke() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-coral-strong').trim() || '#f07561';
}

const MAX_MASK_CELLS_TO_RENDER = 200000;
const TERRITORY_POLYGON_REFRESH_MS = 2500;
const TERRITORY_POLYGON_INITIAL_DELAY_MS = 120;
const TERRITORY_CACHE_VERSION = 'global-owner-territory-cache-v97-concrete-boundary-sampling';
const TERRITORY_SHELL_CACHE_KEY_PREFIX = 'hermes_territory_shell_';
const TERRITORY_POLYGON_CACHE_DB = 'hermes-territory-cache';
const TERRITORY_POLYGON_CACHE_DB_VERSION = 2;
const TERRITORY_POLYGON_CACHE_STORE = 'territory-polygons';
const TERRITORY_POLYGON_CACHE_KEY_PREFIX = 'polygons:';
const TERRITORY_RENDER_CACHE_STORE = 'territory-render';
const TERRITORY_RENDER_CACHE_KEY_PREFIX = 'render:';
const TERRITORY_RENDER_INDEX_CACHE_KEY_PREFIX = 'hermes_territory_render_index_';
const TERRITORY_CACHED_RENDER_PREVIEW_MAX_POINTS_PER_OWNER = 5200;
const TERRITORY_CACHED_RENDER_PREVIEW_MAX_RIVAL_REGIONS_PER_OWNER = 12;
const TERRITORY_CACHED_RENDER_PREVIEW_TOLERANCE_METERS = 24;
const TERRITORY_INTERACTIVE_RENDER_MAX_ACTIVE_POINTS_PER_OWNER = Number.POSITIVE_INFINITY;
const TERRITORY_INTERACTIVE_RENDER_MAX_RIVAL_POINTS_PER_OWNER = 5200;
const TERRITORY_MAX_AUTO_FIT_SPAN_METERS = 8_000;
const TERRITORY_GLOBAL_INITIAL_RENDER_MAX_OWNERS = 96;
const METERS_PER_DEG_LAT = 111_320;
const LAND_MASK_RENDER_SUBDIVISION = 3;
const LAND_MASK_SUBDIVIDED_CELL_TILE_FACTOR = 9;
const LAND_MASK_SOURCE_FOOTPRINT_RADIUS_RATIO = 0.48;
const LAND_MASK_ROUTE_CORRIDOR_RADIUS_RATIO = 0.72;
const LAND_MASK_ROUTE_CORRIDOR_STEP_RATIO = 0.45;
const LAND_MASK_ROUTE_INTERIOR_DISTANCE_RATIO = 4.0;
const LAND_MASK_ROUTE_TRACE_MAX_SEGMENT_RATIO = 3.0;
const LAND_MASK_COMPONENT_BRIDGE_MAX_METERS = 180;
const LAND_MASK_COMPONENT_BRIDGE_RADIUS_RATIO = 0.55;
const LAND_MASK_COMPONENT_BRIDGE_STEP_RATIO = 0.45;
const LAND_MASK_COMPONENT_BRIDGE_MIN_TILES = 8;
const LAND_MASK_COMPONENT_BRIDGE_MAX_EDGES = 96;
const LAND_MASK_INTERNAL_CORRIDOR_MAX_METERS = 44;
const LAND_MASK_INTERNAL_CORRIDOR_MIN_TILES = 24;
const LAND_MASK_INTERNAL_CORRIDOR_MAX_ADDED_RATIO = 0.85;
const LAND_MASK_DENSE_SEAM_MIN_TILES = 8_000;
const LAND_MASK_DENSE_SEAM_MIN_COMPONENTS = 3;
const LAND_MASK_DENSE_SEAM_MIN_DENSITY = 0.48;
const LAND_MASK_DENSE_SEAM_MAX_METERS = 132;
const LAND_MASK_DENSE_SEAM_MAX_ADDED_RATIO = 0.95;
const LAND_MASK_DENSE_SEAM_MAX_SCAN_CELLS = 650_000;
const LAND_MASK_TOPOLOGY_CLOSE_RADIUS_RATIO = 3.0;
const LAND_MASK_TOPOLOGY_CLOSE_MAX_RADIUS_CELLS = 12;
const LAND_MASK_TOPOLOGY_CLOSE_MIN_TILES = 48;
const LAND_MASK_TOPOLOGY_CLOSE_MAX_ADDED_RATIO = 0.65;
const LAND_MASK_TOPOLOGY_CLOSE_MAX_DILATION_OPS = 120_000;
const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_AREA_SQUARE_METERS = 5_000_000;
const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_TILES = 30_000;
const LAND_MASK_SOLID_COMPONENT_MIN_DENSITY = 0.18;
const LAND_MASK_TOPOLOGY_LARGE_CLOSE_RADIUS_RATIO = 3.0;
const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_RADIUS_CELLS = 12;
const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_ADDED_RATIO = 0.65;
const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_DILATION_OPS = 80_000;
const LAND_MASK_TILE_OVERLAP_RATIO = 0.18;
const LAND_MASK_CONTOUR_SIMPLIFY_RATIO = 3.5;
const LAND_MASK_SMOOTHING_PASSES = 5;
const LAND_MASK_CURVE_PASSES = 3;
const LAND_MASK_ROUTE_CORRIDOR_CONTOUR_SIMPLIFY_RATIO = 0.7;
const LAND_MASK_ROUTE_CORRIDOR_CORNER_RADIUS_RATIO = 1.2;
const LAND_MASK_ROUTE_CORRIDOR_SMOOTHING_PASSES = 1;
const LAND_MASK_LARGE_BAY_COLLAPSE_WIDTH_RATIO = 16.0;
const LAND_MASK_LARGE_BAY_COLLAPSE_MAX_ARC_RATIO = 80;
const LAND_MASK_LARGE_BAY_COLLAPSE_MIN_ARC_RATIO = 4.0;
const LAND_MASK_LARGE_BAY_COLLAPSE_MIN_ARC_TO_CHORD = 1.6;
const LAND_MASK_LARGE_BAY_COLLAPSE_MAX_PER_LOOP = 160;
const LAND_MASK_SMALL_LOOP_POINT_LIMIT = 44;
const LAND_MASK_TINY_LOOP_POINT_LIMIT = 24;
const LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP = 800;
const LAND_MASK_CORNER_RADIUS_RATIO = 5.5;
const LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS = 4;
const LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS = 4_000;
const LAND_MASK_MIN_CONTOUR_PERIMETER_METERS = 260;
const LAND_MASK_MIN_VISIBLE_COMPONENT_TILES = 10;
const LAND_MASK_EDGE_COMPONENT_MIN_VISIBLE_TILES = 4;
const LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER = 32;
const LAND_MASK_GLOBAL_ACTIVE_VISIBLE_REGIONS_PER_OWNER = Number.POSITIVE_INFINITY;
const LAND_MASK_MAX_LOCAL_VIEW_REGIONS_PER_OWNER = 144;
const LAND_MASK_VISIBLE_REGION_DIVERSITY_METERS = 6_000;
const LAND_MASK_CONTOUR_WEIGHT = { active: 2.0, rival: 0.8 };
const LAND_MASK_CONTOUR_OPACITY = { active: 0.86, rival: 0.2 };
const LAND_MASK_CONCRETE_LAND_OPACITY = { active: 0.72, rival: 0.18 };
const LAND_MASK_CONCRETE_LAND_EDGE_WEIGHT = 0;
const LAND_MASK_CONCRETE_LAND_EDGE_OPACITY = { active: 0, rival: 0 };
const LAND_MASK_SHARED_EDGE_CURVE_RATIO = 0.38;
const TERRITORY_OWNER_COLOR_PALETTE = [
  '#f07561',
  '#5b9cf5',
  '#c084fc',
  '#22d3ee',
  '#fbbf24',
  '#34d399',
  '#fb7185',
  '#818cf8',
  '#f97316',
  '#14b8a6',
  '#e879f9',
  '#60a5fa',
  '#a3e635',
  '#facc15',
  '#4ade80',
  '#38bdf8',
];
const TERRITORY_OWNER_COLOR_NEAR_METERS = 5200;
const TERRITORY_OWNER_COLOR_MIN_SEPARATION = 72;
const TERRITORY_LAYER_PANES = [
  { name: 'territory-rival-fill-pane', className: 'terr-leaflet-territory-pane--rival-fill', zIndex: 430 },
  { name: 'territory-rival-contour-pane', className: 'terr-leaflet-territory-pane--rival-contour', zIndex: 440 },
  { name: 'territory-active-fill-pane', className: 'terr-leaflet-territory-pane--active-fill', zIndex: 450 },
  { name: 'territory-active-contour-pane', className: 'terr-leaflet-territory-pane--active-contour', zIndex: 460 },
];
const TERRITORY_OWNER_FOCUS_BASE_CLASSES = [
  'terr-land-mask-concrete-land',
  'terr-land-mask-contour',
];
const TERRITORY_OWNER_FOCUS_SUFFIXES = [
  'theme-all',
  'theme-selected',
  'theme-dimmed',
];

function hasCoordinatePolygon(poly) {
  return Array.isArray(poly?.coordinates) && poly.coordinates.length >= 3;
}

function hasCellMaskPolygon(poly) {
  return Array.isArray(poly?.cells) && poly.cells.length > 0;
}

function hasDrawableTerritoryPolygon(poly) {
  return hasCellMaskPolygon(poly);
}

function hasDrawableTerritoryPolygonData(data) {
  return Array.isArray(data?.polygons) && data.polygons.some(hasDrawableTerritoryPolygon);
}

function territoryLayerRenderers(L, map) {
  TERRITORY_LAYER_PANES.forEach(({ name, className, zIndex }) => {
    const pane = map.getPane(name) || map.createPane(name);
    pane.classList.add('terr-leaflet-territory-pane', className);
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = 'auto';
  });

  return {
    rivalFill: L.svg({ padding: 0.65, pane: 'territory-rival-fill-pane' }),
    rivalContour: L.svg({ padding: 0.65, pane: 'territory-rival-contour-pane' }),
    activeFill: L.svg({ padding: 0.65, pane: 'territory-active-fill-pane' }),
    activeContour: L.svg({ padding: 0.65, pane: 'territory-active-contour-pane' }),
  };
}

function territoryRenderOwnerSetKey(entries) {
  const ownerKeys = new Set();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const ownerKey = String(entry?.ownerKey || '');
    if (ownerKey) ownerKeys.add(ownerKey);
  });
  return Array.from(ownerKeys).sort().join('|');
}

function territoryOwnerFocusClassToken(ownerKey, selectedOwnerKeyValue, baseClassName) {
  if (!selectedOwnerKeyValue) return `${baseClassName}--theme-all`;
  return ownerKey === selectedOwnerKeyValue
    ? `${baseClassName}--theme-selected`
    : `${baseClassName}--theme-dimmed`;
}

function territoryOwnerFocusClassName(ownerKey, selectedOwnerKeyValue, baseClassName) {
  return ` ${territoryOwnerFocusClassToken(ownerKey, selectedOwnerKeyValue, baseClassName)}`;
}

function applyTerritoryOwnerFocusClasses(layer, selectedOwnerKeyValue) {
  if (!layer || typeof layer.eachLayer !== 'function') return;
  layer.eachLayer((childLayer) => {
    const element = childLayer?.getElement?.();
    if (!element?.classList) return;
    const ownerKey = String(element.dataset?.hermesOwnerKey || '');
    TERRITORY_OWNER_FOCUS_BASE_CLASSES.forEach((baseClassName) => {
      if (!element.classList.contains(baseClassName)) return;
      TERRITORY_OWNER_FOCUS_SUFFIXES.forEach((suffix) => {
        element.classList.remove(`${baseClassName}--${suffix}`);
      });
      element.classList.add(territoryOwnerFocusClassToken(ownerKey, selectedOwnerKeyValue, baseClassName));
    });
  });
}

function polygonOwnerMergeKey(poly, fallbackIndex) {
  if (poly?.ownerId !== null && poly?.ownerId !== undefined) {
    return `owner:${poly.ownerId}`;
  }

  const ownerName = String(poly?.ownerName || '').trim().toLowerCase();
  if (ownerName) {
    return `owner-name:${ownerName}`;
  }

  return `owner-color:${safeColor(poly?.color)}:${poly?.active ? 'active' : 'rival'}:${fallbackIndex}`;
}

function renderCellMaskPolygonsBySource(polygons) {
  return (Array.isArray(polygons) ? polygons : [])
    .filter(hasCellMaskPolygon)
    .map((poly, index) => ({
      ...poly,
      ownerKey: String(poly?.ownerKey || polygonOwnerMergeKey(poly, index)),
      sourceKey: [
        polygonOwnerMergeKey(poly, index),
        poly?.activityId !== null && poly?.activityId !== undefined ? `activity:${poly.activityId}` : `source:${poly?.id ?? index}`,
      ].join('|'),
    }));
}

function rawTerritoryPolygonBounds(poly) {
  const sourcePoints = hasCellMaskPolygon(poly)
    ? poly.cells.map((cell) => [cell?.latitude, cell?.longitude])
    : (hasCoordinatePolygon(poly) ? poly.coordinates : []);
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  sourcePoints.forEach((point) => {
    const latitude = Number(point?.[0]);
    const longitude = Number(point?.[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  });

  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
    return null;
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    center: {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
    },
  };
}

function rawTerritoryBoundsDistanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const latGap = a.maxLat < b.minLat ? b.minLat - a.maxLat : (b.maxLat < a.minLat ? a.minLat - b.maxLat : 0);
  const lngGap = a.maxLng < b.minLng ? b.minLng - a.maxLng : (b.maxLng < a.minLng ? a.minLng - b.maxLng : 0);
  const latitude = (a.center.latitude + b.center.latitude) / 2;
  const cosLat = Math.max(1e-6, Math.abs(Math.cos((latitude * Math.PI) / 180)));
  return Math.hypot(latGap * METERS_PER_DEG_LAT, lngGap * METERS_PER_DEG_LAT * cosLat);
}

function initialGlobalTerritoryRenderPolygons(ownerPolygons) {
  const polygonsWithInfo = (Array.isArray(ownerPolygons) ? ownerPolygons : [])
    .map((poly, index) => ({ poly, index, bounds: rawTerritoryPolygonBounds(poly) }))
    .filter((entry) => hasDrawableTerritoryPolygon(entry.poly));
  const activeEntries = polygonsWithInfo.filter((entry) => entry.poly?.active === true);

  if (!activeEntries.length || polygonsWithInfo.length <= TERRITORY_GLOBAL_INITIAL_RENDER_MAX_OWNERS) {
    return polygonsWithInfo.map((entry) => entry.poly);
  }

  const activeBounds = activeEntries
    .map((entry) => entry.bounds)
    .filter(Boolean)
    .reduce((merged, bounds) => (merged ? ({
      minLat: Math.min(merged.minLat, bounds.minLat),
      maxLat: Math.max(merged.maxLat, bounds.maxLat),
      minLng: Math.min(merged.minLng, bounds.minLng),
      maxLng: Math.max(merged.maxLng, bounds.maxLng),
      center: {
        latitude: (Math.min(merged.minLat, bounds.minLat) + Math.max(merged.maxLat, bounds.maxLat)) / 2,
        longitude: (Math.min(merged.minLng, bounds.minLng) + Math.max(merged.maxLng, bounds.maxLng)) / 2,
      },
    }) : bounds), null);

  if (!activeBounds) {
    return polygonsWithInfo
      .slice(0, TERRITORY_GLOBAL_INITIAL_RENDER_MAX_OWNERS)
      .map((entry) => entry.poly);
  }

  const activeKeys = new Set(activeEntries.map((entry) => String(entry.poly?.ownerKey || polygonOwnerMergeKey(entry.poly, entry.index))));
  const rivalEntries = polygonsWithInfo
    .filter((entry) => !activeKeys.has(String(entry.poly?.ownerKey || polygonOwnerMergeKey(entry.poly, entry.index))))
    .map((entry) => ({
      ...entry,
      distanceMeters: rawTerritoryBoundsDistanceMeters(activeBounds, entry.bounds),
      areaSquareMeters: Number(entry.poly?.areaSquareMeters) || 0,
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters || b.areaSquareMeters - a.areaSquareMeters || a.index - b.index);
  const selectedRivals = rivalEntries
    .slice(0, Math.max(0, TERRITORY_GLOBAL_INITIAL_RENDER_MAX_OWNERS - activeKeys.size));

  return [...activeEntries, ...selectedRivals]
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.poly);
}

function territoryMaskRenderGrid(polygons) {
  let totalCellCount = 0;
  let sourceCellMeters = Number.POSITIVE_INFINITY;
  let cosLat = 1;
  let hasReferenceLatitude = false;

  for (const poly of Array.isArray(polygons) ? polygons : []) {
    const polygonCellMeters = Number(poly?.cellMeters);
    if (Number.isFinite(polygonCellMeters) && polygonCellMeters > 0) {
      sourceCellMeters = Math.min(sourceCellMeters, polygonCellMeters);
    }

    for (const cell of Array.isArray(poly?.cells) ? poly.cells : []) {
      const latitude = Number(cell?.latitude);
      const longitude = Number(cell?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue;
      }

      totalCellCount += 1;
      if (!hasReferenceLatitude) {
        cosLat = Math.max(1e-6, Math.abs(Math.cos((latitude * Math.PI) / 180)));
        hasReferenceLatitude = true;
      }
    }
  }

  const baseCellMeters = Number.isFinite(sourceCellMeters) ? sourceCellMeters : 36;
  const canSubdivide = totalCellCount > 0
    && totalCellCount * LAND_MASK_SUBDIVIDED_CELL_TILE_FACTOR <= MAX_MASK_CELLS_TO_RENDER;
  const bucketScale = canSubdivide
    ? 1 / LAND_MASK_RENDER_SUBDIVISION
    : Math.max(1, Math.ceil(Math.sqrt(totalCellCount / MAX_MASK_CELLS_TO_RENDER)));

  return {
    cosLat,
    sourceCellMeters: baseCellMeters,
    tileMeters: baseCellMeters * bucketScale,
  };
}

function shouldRefreshTerritoryPolygons(polygonsData) {
  const pendingActivityCount = Number(polygonsData?.pendingActivityCount || 0);
  return Boolean(polygonsData?.backfillInProgress || pendingActivityCount > 0);
}

function emptyTerritoryPolygonPayload(polygonsData) {
  const data = polygonsData && typeof polygonsData === 'object' ? { ...polygonsData } : {};
  return {
    ...data,
    polygons: [],
    polygonCount: 0,
    activePolygonCount: 0,
    totalAreaSquareMeters: 0,
    activeAreaSquareMeters: 0,
    backfillInProgress: Boolean(data.backfillInProgress),
    pendingActivityCount: Number(data.pendingActivityCount || 0),
  };
}

function readTerritoryStoredValue(key) {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeTerritoryStoredValue(key, value) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Storage may be unavailable or full. Cache misses should never break the map.
  }
}

function removeTerritoryStoredValue(key) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable. Cache cleanup should never break the map.
  }
}

function territoryCacheAccountKey() {
  const email = String(readTerritoryStoredValue('hermes_email') || '').trim().toLowerCase();
  const token = String(readTerritoryStoredValue('hermes_jwt') || '').trim();
  if (!email || !token) return null;
  return encodeURIComponent(email);
}

function territoryPayloadSignature(data) {
  let hash = 2166136261;
  const serialized = JSON.stringify(data || null);
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${TERRITORY_CACHE_VERSION}:${(hash >>> 0).toString(36)}:${serialized.length}`;
}

function normalizeTerritoryServerSignature(value) {
  let normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.startsWith('W/')) {
    normalized = normalized.slice(2).trim();
  }
  if (normalized.length >= 2 && normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function territoryPolygonRefreshHeaders(signature) {
  const normalizedSignature = normalizeTerritoryServerSignature(signature);
  return normalizedSignature ? { 'If-None-Match': normalizedSignature } : {};
}

function normalizeEntityTag(value) {
  let normalized = String(value || '').trim();
  if (normalized.startsWith('W/')) {
    normalized = normalized.slice(2).trim();
  }
  if (normalized.length >= 2 && normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function territoryPolygonResponseSignature(response) {
  return normalizeTerritoryServerSignature(
    response?.headers?.get?.('X-Hermes-Territory-Polygon-Signature')
    || response?.headers?.get?.('ETag')
    || '',
  );
}

function territoryShellCacheKey() {
  const accountKey = territoryCacheAccountKey();
  return accountKey ? `${TERRITORY_SHELL_CACHE_KEY_PREFIX}${accountKey}` : null;
}

function readCachedTerritoryShell() {
  const cacheKey = territoryShellCacheKey();
  if (!cacheKey) return null;

  try {
    const cached = JSON.parse(readTerritoryStoredValue(cacheKey) || 'null');
    if (cached?.version !== TERRITORY_CACHE_VERSION || !cached?.data || !cached?.signature) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCachedTerritoryShell(data, signature = territoryPayloadSignature(data)) {
  const cacheKey = territoryShellCacheKey();
  if (!cacheKey || !data || typeof data !== 'object') return;

  writeTerritoryStoredValue(cacheKey, JSON.stringify({
    version: TERRITORY_CACHE_VERSION,
    savedAt: Date.now(),
    signature,
    data,
  }));
}

function territoryPolygonCacheKey() {
  const accountKey = territoryCacheAccountKey();
  return accountKey ? `${TERRITORY_POLYGON_CACHE_KEY_PREFIX}${accountKey}` : null;
}

let territoryPolygonDbPromise = null;

function openTerritoryPolygonCacheDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  if (territoryPolygonDbPromise) {
    return territoryPolygonDbPromise.then((db) => {
      // If the cached DB was closed (e.g. version change), reopen.
      if (!db) return null;
      try {
        void db.objectStoreNames;
        return db;
      } catch {
        territoryPolygonDbPromise = null;
        return openTerritoryPolygonCacheDb();
      }
    });
  }

  territoryPolygonDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(TERRITORY_POLYGON_CACHE_DB, TERRITORY_POLYGON_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TERRITORY_POLYGON_CACHE_STORE)) {
        db.createObjectStore(TERRITORY_POLYGON_CACHE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(TERRITORY_RENDER_CACHE_STORE)) {
        db.createObjectStore(TERRITORY_RENDER_CACHE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return territoryPolygonDbPromise;
}

function readTerritoryIndexedCache(storeName, cacheKey) {
  if (!cacheKey) return Promise.resolve(null);

  return openTerritoryPolygonCacheDb().then((db) => new Promise((resolve) => {
    if (!db) {
      resolve(null);
      return;
    }

    if (!db.objectStoreNames.contains(storeName)) {
      resolve(null);
      return;
    }

    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(cacheKey);
    request.onsuccess = () => {
      const cached = request.result;
      resolve(
        cached?.version === TERRITORY_CACHE_VERSION && cached?.signature && cached?.data
          ? cached
          : null,
      );
    };
    request.onerror = () => resolve(null);
    transaction.onerror = () => resolve(null);
  })).catch(() => null);
}

function writeTerritoryIndexedCache(storeName, cacheKey, data, signature) {
  if (!cacheKey || !data || typeof data !== 'object') return Promise.resolve();

  return openTerritoryPolygonCacheDb().then((db) => new Promise((resolve) => {
    if (!db) {
      resolve();
      return;
    }

    if (!db.objectStoreNames.contains(storeName)) {
      resolve();
      return;
    }

    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put({
      key: cacheKey,
      version: TERRITORY_CACHE_VERSION,
      savedAt: Date.now(),
      signature,
      data,
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  })).catch(() => {});
}

function deleteTerritoryIndexedCache(storeName, cacheKey) {
  if (!cacheKey) return Promise.resolve();

  return openTerritoryPolygonCacheDb().then((db) => new Promise((resolve) => {
    if (!db || !db.objectStoreNames.contains(storeName)) {
      resolve();
      return;
    }

    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(cacheKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  })).catch(() => {});
}

function readCachedTerritoryPolygons() {
  return readTerritoryIndexedCache(TERRITORY_POLYGON_CACHE_STORE, territoryPolygonCacheKey())
    .then((cached) => (
      hasDrawableTerritoryPolygonData(cached?.data) ? cached : null
    ));
}

function writeCachedTerritoryPolygons(data, signature = territoryPayloadSignature(data)) {
  return writeTerritoryIndexedCache(TERRITORY_POLYGON_CACHE_STORE, territoryPolygonCacheKey(), data, signature);
}

function territoryRenderCacheKey(polygonSignature) {
  const accountKey = territoryCacheAccountKey();
  return accountKey && polygonSignature
    ? `${TERRITORY_RENDER_CACHE_KEY_PREFIX}${accountKey}:${polygonSignature}`
    : null;
}

function territoryRenderIndexCacheKey() {
  const accountKey = territoryCacheAccountKey();
  return accountKey ? `${TERRITORY_RENDER_INDEX_CACHE_KEY_PREFIX}${accountKey}` : null;
}

function readCachedTerritoryRenderIndex() {
  const cacheKey = territoryRenderIndexCacheKey();
  if (!cacheKey) return null;

  try {
    const cachedIndex = JSON.parse(readTerritoryStoredValue(cacheKey) || 'null');
    if (cachedIndex?.version !== TERRITORY_CACHE_VERSION || !cachedIndex?.signature) {
      return null;
    }
    return cachedIndex;
  } catch {
    return null;
  }
}

function writeCachedTerritoryRenderIndex(signature) {
  const cacheKey = territoryRenderIndexCacheKey();
  if (!cacheKey || !signature) return;

  writeTerritoryStoredValue(cacheKey, JSON.stringify({
    version: TERRITORY_CACHE_VERSION,
    savedAt: Date.now(),
    signature,
  }));
}

function readCachedTerritoryRender(polygonSignature) {
  return readTerritoryIndexedCache(TERRITORY_RENDER_CACHE_STORE, territoryRenderCacheKey(polygonSignature))
    .then((cached) => (
      hasDrawableTerritoryRenderData(cached?.data) ? cached : null
    ));
}

function readCachedTerritoryLatestRender() {
  const cachedIndex = readCachedTerritoryRenderIndex();
  return cachedIndex?.signature
    ? readCachedTerritoryRender(cachedIndex.signature)
    : Promise.resolve(null);
}

function clearCachedTerritoryPolygons() {
  return deleteTerritoryIndexedCache(TERRITORY_POLYGON_CACHE_STORE, territoryPolygonCacheKey());
}

function clearCachedTerritoryLatestRender(...signatures) {
  const cachedIndex = readCachedTerritoryRenderIndex();
  const renderSignatures = new Set([
    cachedIndex?.signature,
    ...signatures,
  ].map(normalizeTerritoryServerSignature).filter(Boolean));
  const indexKey = territoryRenderIndexCacheKey();
  if (indexKey) {
    removeTerritoryStoredValue(indexKey);
  }

  renderSignatures.forEach((signature) => {
    deleteTerritoryIndexedCache(TERRITORY_RENDER_CACHE_STORE, territoryRenderCacheKey(signature));
  });
}

function writeCachedTerritoryRender(polygonSignature, data) {
  return writeTerritoryIndexedCache(
    TERRITORY_RENDER_CACHE_STORE,
    territoryRenderCacheKey(polygonSignature),
    data,
    polygonSignature,
  ).then(() => writeCachedTerritoryRenderIndex(polygonSignature));
}

function sealedMaskTileBounds(latitude, longitude, tileMeters, cosLat) {
  const tileExpansion = 1 + LAND_MASK_TILE_OVERLAP_RATIO;
  const halfLat = ((tileMeters / METERS_PER_DEG_LAT) / 2) * tileExpansion;
  const halfLng = ((tileMeters / (METERS_PER_DEG_LAT * cosLat)) / 2) * tileExpansion;
  return [
    [latitude - halfLat, longitude - halfLng],
    [latitude + halfLat, longitude + halfLng],
  ];
}

function concreteMaskTileFromGrid(gridX, gridY, tileMeters, cosLat, template = {}) {
  const latitude = (gridY * tileMeters) / METERS_PER_DEG_LAT;
  const longitude = (gridX * tileMeters) / (METERS_PER_DEG_LAT * cosLat);
  return {
    ...template,
    gridX,
    gridY,
    latitude,
    longitude,
    tileMeters,
    cosLat,
    bounds: sealedMaskTileBounds(latitude, longitude, tileMeters, cosLat),
  };
}

function aggregateMaskCells(cells, cellMeters, renderGrid = {}) {
  const validCells = (Array.isArray(cells) ? cells : [])
    .map((cell) => ({
      latitude: Number(cell?.latitude),
      longitude: Number(cell?.longitude),
    }))
    .filter((cell) => Number.isFinite(cell.latitude) && Number.isFinite(cell.longitude));

  if (!validCells.length) return [];

  const sourceCellMeters = Number(cellMeters);
  const baseCellMeters = Number.isFinite(sourceCellMeters) && sourceCellMeters > 0 ? sourceCellMeters : 36;
  const fallbackBucketScale = Math.max(1, Math.ceil(Math.sqrt(validCells.length / MAX_MASK_CELLS_TO_RENDER)));
  const requestedTileMeters = Number(renderGrid?.tileMeters);
  const tileMeters = Number.isFinite(requestedTileMeters) && requestedTileMeters > 0
    ? requestedTileMeters
    : baseCellMeters * fallbackBucketScale;
  const requestedCosLat = Number(renderGrid?.cosLat);
  const renderCosLat = Number.isFinite(requestedCosLat) && requestedCosLat > 0 ? requestedCosLat : 1;
  const tiles = new Map();

  validCells.forEach((cell) => {
    const gridY = Math.round((cell.latitude * METERS_PER_DEG_LAT) / tileMeters);
    const gridX = Math.round((cell.longitude * METERS_PER_DEG_LAT * renderCosLat) / tileMeters);
    const sourceRadiusMeters = baseCellMeters * LAND_MASK_SOURCE_FOOTPRINT_RADIUS_RATIO;
    const radiusCells = Math.ceil(sourceRadiusMeters / tileMeters);
    for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
      for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
        if (sourceRadiusMeters > 0) {
          const distanceMeters = Math.sqrt((dx * dx) + (dy * dy)) * tileMeters;
          if (distanceMeters > sourceRadiusMeters) continue;
        }

        const tileGridY = gridY + dy;
        const tileGridX = gridX + dx;
        const key = `${tileGridY}:${tileGridX}`;
        if (tiles.has(key)) continue;
        tiles.set(key, concreteMaskTileFromGrid(tileGridX, tileGridY, tileMeters, renderCosLat));
      }
    }
  });

  return Array.from(tiles.values());
}

function routeTraceConcretePoints(trace) {
  return (Array.isArray(trace?.points) ? trace.points : [])
    .map((point) => ({
      latitude: Number(point?.latitude),
      longitude: Number(point?.longitude),
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

function gridSegmentLengthMeters(segment, tileMeters) {
  if (!segment || !Number.isFinite(tileMeters) || tileMeters <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const dx = segment.end.gridX - segment.start.gridX;
  const dy = segment.end.gridY - segment.start.gridY;
  return Math.sqrt((dx * dx) + (dy * dy)) * tileMeters;
}

function routeTraceConcreteMaxSegmentMeters(renderGrid = {}) {
  const sourceCellMeters = Number(renderGrid?.sourceCellMeters);
  return Number.isFinite(sourceCellMeters) && sourceCellMeters > 0
    ? sourceCellMeters * LAND_MASK_ROUTE_TRACE_MAX_SEGMENT_RATIO
    : Number.POSITIVE_INFINITY;
}

function routeTraceSegments(poly, renderGrid = {}, options = {}) {
  const tileMeters = Number(renderGrid?.tileMeters);
  const cosLat = Number(renderGrid?.cosLat);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) {
    return [];
  }
  const maxSegmentMeters = Number(options?.maxSegmentMeters);

  const segments = [];
  (Array.isArray(poly?.routeTraces) ? poly.routeTraces : []).forEach((trace) => {
    const points = routeTraceConcretePoints(trace).map((point) => ({
      gridX: (point.longitude * METERS_PER_DEG_LAT * cosLat) / tileMeters,
      gridY: (point.latitude * METERS_PER_DEG_LAT) / tileMeters,
    }));
    for (let index = 1; index < points.length; index += 1) {
      const segment = { start: points[index - 1], end: points[index] };
      if (Number.isFinite(maxSegmentMeters) && gridSegmentLengthMeters(segment, tileMeters) > maxSegmentMeters) {
        continue;
      }
      segments.push(segment);
    }
  });
  return segments;
}

function gridPointSegmentDistanceMeters(point, segment, tileMeters) {
  const dx = segment.end.gridX - segment.start.gridX;
  const dy = segment.end.gridY - segment.start.gridY;
  const segmentLengthSquared = (dx * dx) + (dy * dy);
  if (segmentLengthSquared <= 0) {
    return Math.sqrt(((point.gridX - segment.start.gridX) ** 2) + ((point.gridY - segment.start.gridY) ** 2)) * tileMeters;
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      (((point.gridX - segment.start.gridX) * dx) + ((point.gridY - segment.start.gridY) * dy)) / segmentLengthSquared,
    ),
  );
  const closestX = segment.start.gridX + (projection * dx);
  const closestY = segment.start.gridY + (projection * dy);
  return Math.sqrt(((point.gridX - closestX) ** 2) + ((point.gridY - closestY) ** 2)) * tileMeters;
}

function tileIsNearRouteSegments(tile, segments, thresholdMeters, tileMeters) {
  if (!Array.isArray(segments) || !segments.length) return false;
  const point = { gridX: Number(tile?.gridX), gridY: Number(tile?.gridY) };
  if (!Number.isFinite(point.gridX) || !Number.isFinite(point.gridY)) return false;
  return segments.some((segment) => gridPointSegmentDistanceMeters(point, segment, tileMeters) <= thresholdMeters);
}

function routeSegmentSpatialIndex(segments, thresholdMeters, tileMeters) {
  if (!Array.isArray(segments) || !segments.length) return null;
  const thresholdCells = Number(thresholdMeters) / Number(tileMeters);
  if (!Number.isFinite(thresholdCells) || thresholdCells < 0) return null;

  const bucketSize = Math.max(4, Math.ceil(Math.max(1, thresholdCells) * 2));
  const buckets = new Map();
  segments.forEach((segment) => {
    const minX = Math.floor((Math.min(segment.start.gridX, segment.end.gridX) - thresholdCells) / bucketSize);
    const maxX = Math.floor((Math.max(segment.start.gridX, segment.end.gridX) + thresholdCells) / bucketSize);
    const minY = Math.floor((Math.min(segment.start.gridY, segment.end.gridY) - thresholdCells) / bucketSize);
    const maxY = Math.floor((Math.max(segment.start.gridY, segment.end.gridY) + thresholdCells) / bucketSize);
    for (let bucketY = minY; bucketY <= maxY; bucketY += 1) {
      for (let bucketX = minX; bucketX <= maxX; bucketX += 1) {
        const key = `${bucketY}:${bucketX}`;
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.push(segment);
        } else {
          buckets.set(key, [segment]);
        }
      }
    }
  });

  return { bucketSize, buckets };
}

function routeSegmentCandidatesForTile(tile, segments, segmentIndex) {
  if (!segmentIndex?.buckets || !Number.isFinite(segmentIndex.bucketSize) || segmentIndex.bucketSize <= 0) {
    return segments;
  }

  const gridX = Number(tile?.gridX);
  const gridY = Number(tile?.gridY);
  if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return [];
  const bucketX = Math.floor(gridX / segmentIndex.bucketSize);
  const bucketY = Math.floor(gridY / segmentIndex.bucketSize);
  return segmentIndex.buckets.get(`${bucketY}:${bucketX}`) || [];
}

function routeTraceUniformTiles(poly, renderGrid, concreteTiles, providedSegments = null) {
  const validConcreteTiles = (Array.isArray(concreteTiles) ? concreteTiles : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (!validConcreteTiles.length) return [];

  const tileMeters = Number(renderGrid?.tileMeters);
  const cosLat = Number(renderGrid?.cosLat);
  const baseCellMeters = Number(renderGrid?.sourceCellMeters);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) return [];
  if (!Number.isFinite(baseCellMeters) || baseCellMeters <= 0) return [];

  const maxSegmentMeters = routeTraceConcreteMaxSegmentMeters(renderGrid);
  const segments = Array.isArray(providedSegments)
    ? providedSegments
    : routeTraceSegments(poly, renderGrid, { maxSegmentMeters });
  if (!segments.length) return [];

  const template = validConcreteTiles[0];
  const corridorTiles = new Map();
  const corridorRadiusMeters = baseCellMeters * LAND_MASK_ROUTE_CORRIDOR_RADIUS_RATIO;
  const radiusCells = Math.ceil(corridorRadiusMeters / tileMeters);
  const stepCells = Math.max(0.25, (baseCellMeters / tileMeters) * LAND_MASK_ROUTE_CORRIDOR_STEP_RATIO);

  const addTile = (gridX, gridY) => {
    const key = `${gridY}:${gridX}`;
    if (corridorTiles.has(key)) return;
    corridorTiles.set(key, concreteMaskTileFromGrid(gridX, gridY, tileMeters, cosLat, template));
  };

  segments.forEach((segment) => {
    const dx = segment.end.gridX - segment.start.gridX;
    const dy = segment.end.gridY - segment.start.gridY;
    const distanceCells = Math.sqrt((dx * dx) + (dy * dy));
    const steps = Math.max(1, Math.ceil(distanceCells / stepCells));

    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const centerX = Math.round(segment.start.gridX + (dx * ratio));
      const centerY = Math.round(segment.start.gridY + (dy * ratio));
      for (let offsetY = -radiusCells; offsetY <= radiusCells; offsetY += 1) {
        for (let offsetX = -radiusCells; offsetX <= radiusCells; offsetX += 1) {
          const distanceMeters = Math.sqrt((offsetX * offsetX) + (offsetY * offsetY)) * tileMeters;
          if (distanceMeters > corridorRadiusMeters) continue;
          addTile(centerX + offsetX, centerY + offsetY);
        }
      }
    }
  });

  return Array.from(corridorTiles.values());
}

function maskBridgeBoundaryTiles(component, occupiedKeys) {
  return (Array.isArray(component) ? component : []).filter((tile) => (
    Number.isFinite(tile?.gridX)
    && Number.isFinite(tile?.gridY)
    && neighborKeys(tile).some((neighborKey) => !occupiedKeys.has(neighborKey))
  ));
}

function maskComponentBounds(component) {
  const validTiles = (Array.isArray(component) ? component : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (!validTiles.length) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  validTiles.forEach((tile) => {
    minX = Math.min(minX, tile.gridX);
    maxX = Math.max(maxX, tile.gridX);
    minY = Math.min(minY, tile.gridY);
    maxY = Math.max(maxY, tile.gridY);
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
}

function maskComponentDensity(component, bounds = maskComponentBounds(component)) {
  const validTileCount = (Array.isArray(component) ? component : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY))
    .length;
  if (!validTileCount || !bounds) return 0;

  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const boxCells = width * height;
  if (width <= 0 || height <= 0 || boxCells <= 0) return 0;

  return validTileCount / boxCells;
}

function maskBoundsGapCells(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const gapX = Math.max(0, Math.max(left.minX, right.minX) - Math.min(left.maxX, right.maxX));
  const gapY = Math.max(0, Math.max(left.minY, right.minY) - Math.min(left.maxY, right.maxY));
  return Math.sqrt((gapX * gapX) + (gapY * gapY));
}

function nearestMaskComponentBridge(leftTiles, rightTiles, maxDistanceCells) {
  let best = null;
  const maxDistanceSquared = maxDistanceCells * maxDistanceCells;

  leftTiles.forEach((leftTile) => {
    rightTiles.forEach((rightTile) => {
      const dx = rightTile.gridX - leftTile.gridX;
      const dy = rightTile.gridY - leftTile.gridY;
      const distanceSquared = (dx * dx) + (dy * dy);
      if (distanceSquared > maxDistanceSquared) return;
      if (!best || distanceSquared < best.distanceSquared) {
        best = {
          from: leftTile,
          to: rightTile,
          distanceSquared,
        };
      }
    });
  });

  return best;
}

function bridgeNearbyMaskComponents(tiles, renderGrid = {}) {
  const validTiles = (Array.isArray(tiles) ? tiles : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (validTiles.length < LAND_MASK_COMPONENT_BRIDGE_MIN_TILES * 2) return validTiles;

  const tileMeters = Number(renderGrid?.tileMeters);
  const cosLat = Number(renderGrid?.cosLat);
  const sourceCellMeters = Number(renderGrid?.sourceCellMeters);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) return validTiles;
  if (!Number.isFinite(sourceCellMeters) || sourceCellMeters <= 0) return validTiles;

  const existingTiles = new Map(validTiles.map((tile) => [maskTileClaimKey(tile), tile]));
  const components = maskTileConnectedComponents(validTiles)
    .filter((component) => component.length >= LAND_MASK_COMPONENT_BRIDGE_MIN_TILES);
  if (components.length < 2) return validTiles;

  const maxDistanceCells = LAND_MASK_COMPONENT_BRIDGE_MAX_METERS / tileMeters;
  const occupiedKeys = new Set(existingTiles.keys());
  const records = components.map((component, index) => ({
    index,
    component,
    bounds: maskComponentBounds(component),
    boundary: maskBridgeBoundaryTiles(component, occupiedKeys),
  })).filter((record) => record.boundary.length > 0 && record.bounds);

  if (records.length < 2) return validTiles;

  const edges = [];
  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
      const left = records[leftIndex];
      const right = records[rightIndex];
      if (maskBoundsGapCells(left.bounds, right.bounds) > maxDistanceCells) continue;
      const bridge = nearestMaskComponentBridge(left.boundary, right.boundary, maxDistanceCells);
      if (!bridge) continue;
      edges.push({
        left: left.index,
        right: right.index,
        from: bridge.from,
        to: bridge.to,
        distanceSquared: bridge.distanceSquared,
      });
    }
  }

  if (!edges.length) return validTiles;

  const parent = new Map(records.map((record) => [record.index, record.index]));
  const find = (index) => {
    const currentParent = parent.get(index);
    if (currentParent === index) return index;
    const root = find(currentParent);
    parent.set(index, root);
    return root;
  };
  const unite = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return false;
    parent.set(rightRoot, leftRoot);
    return true;
  };

  const bridgeRadiusMeters = sourceCellMeters * LAND_MASK_COMPONENT_BRIDGE_RADIUS_RATIO;
  const radiusCells = Math.ceil(bridgeRadiusMeters / tileMeters);
  const stepCells = Math.max(0.25, (sourceCellMeters / tileMeters) * LAND_MASK_COMPONENT_BRIDGE_STEP_RATIO);
  const template = validTiles[0];
  let addedEdges = 0;

  const addBridgeTile = (gridX, gridY) => {
    const key = `${gridY}:${gridX}`;
    if (existingTiles.has(key)) return;
    existingTiles.set(key, concreteMaskTileFromGrid(gridX, gridY, tileMeters, cosLat, template));
  };

  edges
    .sort((left, right) => left.distanceSquared - right.distanceSquared)
    .some((edge) => {
      if (addedEdges >= LAND_MASK_COMPONENT_BRIDGE_MAX_EDGES) return true;
      if (!unite(edge.left, edge.right)) return false;

      const dx = edge.to.gridX - edge.from.gridX;
      const dy = edge.to.gridY - edge.from.gridY;
      const distanceCells = Math.sqrt((dx * dx) + (dy * dy));
      const steps = Math.max(1, Math.ceil(distanceCells / stepCells));
      for (let step = 0; step <= steps; step += 1) {
        const ratio = step / steps;
        const centerX = Math.round(edge.from.gridX + (dx * ratio));
        const centerY = Math.round(edge.from.gridY + (dy * ratio));
        for (let offsetY = -radiusCells; offsetY <= radiusCells; offsetY += 1) {
          for (let offsetX = -radiusCells; offsetX <= radiusCells; offsetX += 1) {
            if (Math.sqrt((offsetX * offsetX) + (offsetY * offsetY)) * tileMeters > bridgeRadiusMeters) continue;
            addBridgeTile(centerX + offsetX, centerY + offsetY);
          }
        }
      }
      addedEdges += 1;
      return false;
    });

  return Array.from(existingTiles.values());
}

function sealInternalMaskCorridors(tiles, renderGrid = {}) {
  const validTiles = (Array.isArray(tiles) ? tiles : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (validTiles.length < LAND_MASK_INTERNAL_CORRIDOR_MIN_TILES) return validTiles;

  const tileMeters = Number(renderGrid?.tileMeters);
  const cosLat = Number(renderGrid?.cosLat);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) {
    return validTiles;
  }

  const maxGapCells = Math.max(1, Math.floor(LAND_MASK_INTERNAL_CORRIDOR_MAX_METERS / tileMeters));
  const existingTiles = new Map(validTiles.map((tile) => [maskTileClaimKey(tile), tile]));
  const rowRuns = new Map();
  const columnRuns = new Map();
  const candidateTiles = new Map();
  const maxAddedTiles = Math.max(24, Math.floor(validTiles.length * LAND_MASK_INTERNAL_CORRIDOR_MAX_ADDED_RATIO));
  const template = validTiles[0];

  validTiles.forEach((tile) => {
    const row = rowRuns.get(tile.gridY) || [];
    row.push(tile.gridX);
    rowRuns.set(tile.gridY, row);

    const column = columnRuns.get(tile.gridX) || [];
    column.push(tile.gridY);
    columnRuns.set(tile.gridX, column);
  });

  const addCandidate = (gridX, gridY, gapCells) => {
    const key = `${gridY}:${gridX}`;
    if (existingTiles.has(key)) return;
    const current = candidateTiles.get(key);
    if (current && current.gapCells <= gapCells) return;
    candidateTiles.set(key, {
      gapCells,
      tile: concreteMaskTileFromGrid(gridX, gridY, tileMeters, cosLat, template),
    });
  };

  const collectLinearGaps = (runs, horizontal) => {
    runs.forEach((values, fixedGrid) => {
      const sorted = [...new Set(values)]
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const next = sorted[index];
        const missingCells = next - previous - 1;
        if (missingCells <= 0 || missingCells > maxGapCells) continue;
        for (let value = previous + 1; value < next; value += 1) {
          if (horizontal) {
            addCandidate(value, fixedGrid, missingCells);
          } else {
            addCandidate(fixedGrid, value, missingCells);
          }
        }
      }
    });
  };

  collectLinearGaps(rowRuns, true);
  collectLinearGaps(columnRuns, false);

  [...candidateTiles.values()]
    .sort((left, right) => left.gapCells - right.gapCells)
    .slice(0, maxAddedTiles)
    .forEach(({ tile }) => {
      existingTiles.set(maskTileClaimKey(tile), tile);
    });

  return Array.from(existingTiles.values());
}

function sealDenseMaskVoids(tiles, renderGrid = {}) {
  const validTiles = (Array.isArray(tiles) ? tiles : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (validTiles.length < LAND_MASK_DENSE_SEAM_MIN_TILES) return validTiles;

  const tileMeters = Number(renderGrid?.tileMeters);
  const cosLat = Number(renderGrid?.cosLat);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) {
    return validTiles;
  }

  const componentCount = maskTileConnectedComponents(validTiles).length;
  if (componentCount < LAND_MASK_DENSE_SEAM_MIN_COMPONENTS) return validTiles;

  const bounds = maskComponentBounds(validTiles);
  if (!bounds) return validTiles;

  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const scanCells = width * height;
  if (
    width <= 0
    || height <= 0
    || scanCells <= 0
    || scanCells > LAND_MASK_DENSE_SEAM_MAX_SCAN_CELLS
  ) {
    return validTiles;
  }

  const existingTiles = new Map(validTiles.map((tile) => [maskTileClaimKey(tile), tile]));
  const density = existingTiles.size / scanCells;
  if (density < LAND_MASK_DENSE_SEAM_MIN_DENSITY) return validTiles;

  const minX = bounds.minX - 1;
  const maxX = bounds.maxX + 1;
  const minY = bounds.minY - 1;
  const maxY = bounds.maxY + 1;
  const maxGapCells = Math.max(1, Math.floor(LAND_MASK_DENSE_SEAM_MAX_METERS / tileMeters));
  const maxAddedTiles = Math.max(96, Math.floor(validTiles.length * LAND_MASK_DENSE_SEAM_MAX_ADDED_RATIO));
  const template = validTiles[0];
  const candidateKeys = new Set();

  const keyAt = (gridX, gridY) => `${gridY}:${gridX}`;
  const inExpandedBounds = (gridX, gridY) => (
    gridX >= minX && gridX <= maxX && gridY >= minY && gridY <= maxY
  );
  const inInnerBounds = (gridX, gridY) => (
    gridX >= bounds.minX && gridX <= bounds.maxX && gridY >= bounds.minY && gridY <= bounds.maxY
  );
  const addCandidate = (gridX, gridY) => {
    const key = keyAt(gridX, gridY);
    if (existingTiles.has(key)) return;
    candidateKeys.add(key);
  };

  const outsideKeys = new Set();
  const queue = [];
  const pushOutside = (gridX, gridY) => {
    if (!inExpandedBounds(gridX, gridY)) return;
    const key = keyAt(gridX, gridY);
    if (existingTiles.has(key) || outsideKeys.has(key)) return;
    outsideKeys.add(key);
    queue.push({ gridX, gridY });
  };

  for (let gridX = minX; gridX <= maxX; gridX += 1) {
    pushOutside(gridX, minY);
    pushOutside(gridX, maxY);
  }
  for (let gridY = minY + 1; gridY < maxY; gridY += 1) {
    pushOutside(minX, gridY);
    pushOutside(maxX, gridY);
  }

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const { gridX, gridY } = queue[queueIndex];
    queueIndex += 1;
    pushOutside(gridX + 1, gridY);
    pushOutside(gridX - 1, gridY);
    pushOutside(gridX, gridY + 1);
    pushOutside(gridX, gridY - 1);
  }

  for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 1) {
    for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 1) {
      const key = keyAt(gridX, gridY);
      if (!existingTiles.has(key) && !outsideKeys.has(key)) {
        addCandidate(gridX, gridY);
      }
    }
  }

  const boundedGap = (gridX, gridY, deltaX, deltaY) => {
    let before = 0;
    let beforeX = gridX - deltaX;
    let beforeY = gridY - deltaY;
    while (inInnerBounds(beforeX, beforeY) && !existingTiles.has(keyAt(beforeX, beforeY))) {
      before += 1;
      if (before > maxGapCells) return false;
      beforeX -= deltaX;
      beforeY -= deltaY;
    }

    let after = 0;
    let afterX = gridX + deltaX;
    let afterY = gridY + deltaY;
    while (inInnerBounds(afterX, afterY) && !existingTiles.has(keyAt(afterX, afterY))) {
      after += 1;
      if (after > maxGapCells) return false;
      afterX += deltaX;
      afterY += deltaY;
    }

    const gapCells = before + 1 + after;
    return gapCells <= maxGapCells
      && existingTiles.has(keyAt(beforeX, beforeY))
      && existingTiles.has(keyAt(afterX, afterY));
  };

  for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 1) {
    for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 1) {
      const key = keyAt(gridX, gridY);
      if (existingTiles.has(key) || candidateKeys.has(key)) continue;
      if (boundedGap(gridX, gridY, 1, 0) || boundedGap(gridX, gridY, 0, 1)) {
        addCandidate(gridX, gridY);
      }
    }
  }

  Array.from(candidateKeys)
    .slice(0, maxAddedTiles)
    .forEach((key) => {
      const { gridX, gridY } = parseMaskTileClaimKey(key);
      if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return;
      existingTiles.set(key, concreteMaskTileFromGrid(gridX, gridY, tileMeters, cosLat, template));
    });

  return Array.from(existingTiles.values());
}

function maskDiskOffsets(radiusCells) {
  const radius = Math.max(0, Math.floor(Number(radiusCells) || 0));
  const offsets = [];
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      if (Math.sqrt((offsetX * offsetX) + (offsetY * offsetY)) > radius) continue;
      offsets.push({ offsetX, offsetY });
    }
  }
  return offsets;
}

function parseMaskTileClaimKey(key) {
  const [gridY, gridX] = String(key).split(':').map((value) => Number(value));
  return { gridX, gridY };
}

function closeThinMaskBays(tiles, renderGrid = {}, options = {}) {
  const validTiles = (Array.isArray(tiles) ? tiles : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (validTiles.length < LAND_MASK_TOPOLOGY_CLOSE_MIN_TILES) return validTiles;

  const tileMeters = Number(renderGrid?.tileMeters);
  const cosLat = Number(renderGrid?.cosLat);
  const sourceCellMeters = Number(renderGrid?.sourceCellMeters);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) {
    return validTiles;
  }
  if (!Number.isFinite(sourceCellMeters) || sourceCellMeters <= 0) return validTiles;

  const largeLandmass = Boolean(options?.largeLandmass);
  const closeRadiusRatio = largeLandmass
    ? LAND_MASK_TOPOLOGY_LARGE_CLOSE_RADIUS_RATIO
    : LAND_MASK_TOPOLOGY_CLOSE_RADIUS_RATIO;
  const maxRadiusCells = largeLandmass
    ? LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_RADIUS_CELLS
    : LAND_MASK_TOPOLOGY_CLOSE_MAX_RADIUS_CELLS;
  const maxAddedRatio = largeLandmass
    ? LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_ADDED_RATIO
    : LAND_MASK_TOPOLOGY_CLOSE_MAX_ADDED_RATIO;
  const closeRadiusMeters = sourceCellMeters * closeRadiusRatio;
  const radiusCells = Math.min(
    maxRadiusCells,
    Math.max(1, Math.ceil(closeRadiusMeters / tileMeters)),
  );
  if (radiusCells <= 0) return validTiles;

  const offsets = maskDiskOffsets(radiusCells);
  if (!offsets.length) return validTiles;

  const maxDilationOps = largeLandmass
    ? LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_DILATION_OPS
    : LAND_MASK_TOPOLOGY_CLOSE_MAX_DILATION_OPS;
  if (validTiles.length * offsets.length > maxDilationOps) {
    return validTiles;
  }

  const existingTiles = new Map(validTiles.map((tile) => [maskTileClaimKey(tile), tile]));
  const dilatedKeys = new Set(existingTiles.keys());

  validTiles.forEach((tile) => {
    offsets.forEach(({ offsetX, offsetY }) => {
      dilatedKeys.add(`${tile.gridY + offsetY}:${tile.gridX + offsetX}`);
    });
  });

  const candidateTiles = [];
  const maxAddedTiles = Math.max(
    24,
    Math.floor(validTiles.length * maxAddedRatio),
  );
  const template = validTiles[0];

  dilatedKeys.forEach((key) => {
    if (existingTiles.has(key)) return;
    const { gridX, gridY } = parseMaskTileClaimKey(key);
    if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return;

    let closesBay = true;
    let originalSupport = 0;
    for (const { offsetX, offsetY } of offsets) {
      const neighborKey = `${gridY + offsetY}:${gridX + offsetX}`;
      if (!dilatedKeys.has(neighborKey)) {
        closesBay = false;
        break;
      }
      if (existingTiles.has(neighborKey)) {
        originalSupport += 1;
      }
    }
    if (!closesBay) return;

    candidateTiles.push({
      originalSupport,
      tile: concreteMaskTileFromGrid(gridX, gridY, tileMeters, cosLat, template),
    });
  });

  candidateTiles
    .sort((left, right) => right.originalSupport - left.originalSupport)
    .slice(0, maxAddedTiles)
    .forEach(({ tile }) => {
      existingTiles.set(maskTileClaimKey(tile), tile);
    });

  return Array.from(existingTiles.values());
}

function repairConsistentMaskTiles(tiles, renderGrid = {}, options = {}) {
  return closeThinMaskBays(
    sealDenseMaskVoids(
      sealInternalMaskCorridors(
        bridgeNearbyMaskComponents(tiles, renderGrid),
        renderGrid,
      ),
      renderGrid,
    ),
    renderGrid,
    options,
  );
}

function consistentMaskTiles(poly, renderGrid, concreteTiles) {
  const areaSquareMeters = Number(poly?.areaSquareMeters);
  const largeLandmass = (
    (Number.isFinite(areaSquareMeters) && areaSquareMeters >= LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_AREA_SQUARE_METERS)
    || (Array.isArray(concreteTiles) && concreteTiles.length >= LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_TILES)
  );
  const repairOptions = { largeLandmass };

  const maxSegmentMeters = routeTraceConcreteMaxSegmentMeters(renderGrid);
  const segments = routeTraceSegments(poly, renderGrid, { maxSegmentMeters });
  const routeTiles = routeTraceUniformTiles(poly, renderGrid, concreteTiles, segments);
  if (!routeTiles.length) return repairConsistentMaskTiles(concreteTiles, renderGrid, repairOptions);

  const tileMeters = Number(renderGrid?.tileMeters);
  const sourceCellMeters = Number(renderGrid?.sourceCellMeters);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(sourceCellMeters) || sourceCellMeters <= 0) {
    return routeTiles;
  }

  const interiorDistanceMeters = sourceCellMeters * LAND_MASK_ROUTE_INTERIOR_DISTANCE_RATIO;
  const segmentIndex = routeSegmentSpatialIndex(segments, interiorDistanceMeters, tileMeters);
  const tilesByKey = new Map(routeTiles.map((tile) => [maskTileClaimKey(tile), tile]));
  (Array.isArray(concreteTiles) ? concreteTiles : []).forEach((tile) => {
    const candidateSegments = routeSegmentCandidatesForTile(tile, segments, segmentIndex);
    if (!poly?.active && tileIsNearRouteSegments(tile, candidateSegments, interiorDistanceMeters, tileMeters)) return;
    tilesByKey.set(maskTileClaimKey(tile), tile);
  });

  return repairConsistentMaskTiles(Array.from(tilesByKey.values()), renderGrid, repairOptions);
}

function maskTileClaimKey(tile) {
  return `${tile.gridY}:${tile.gridX}`;
}

function neighborKeys(tile) {
  return [
    `${tile.gridY + 1}:${tile.gridX}`,
    `${tile.gridY - 1}:${tile.gridX}`,
    `${tile.gridY}:${tile.gridX + 1}`,
    `${tile.gridY}:${tile.gridX - 1}`,
  ];
}

function resolveMaskTileOwnership(polygons, renderGrid) {
  const sourceEntries = (Array.isArray(polygons) ? polygons : []).map((poly) => ({
    poly,
    concreteTiles: hasCellMaskPolygon(poly)
      ? aggregateMaskCells(poly.cells, poly.cellMeters, renderGrid)
      : null,
    ownedConcreteKeys: new Set(),
  }));
  const concreteOwnerByKey = new Map();

  sourceEntries.forEach((entry, ownerIndex) => {
    (Array.isArray(entry.concreteTiles) ? entry.concreteTiles : []).forEach((tile) => {
      const key = maskTileClaimKey(tile);
      if (concreteOwnerByKey.has(key)) return;
      concreteOwnerByKey.set(key, ownerIndex);
      entry.ownedConcreteKeys.add(key);
    });
  });

  return sourceEntries.map((entry, ownerIndex) => {
    const { poly, concreteTiles, ownedConcreteKeys } = entry;
    if (!hasCellMaskPolygon(poly)) {
      return { poly, tiles: null };
    }

    const ownedConcreteTiles = (Array.isArray(concreteTiles) ? concreteTiles : [])
      .filter((tile) => ownedConcreteKeys.has(maskTileClaimKey(tile)));
    const sourceTiles = consistentMaskTiles(poly, renderGrid, ownedConcreteTiles);
    const exactOwnershipTiles = sourceTiles.filter((tile) => {
      const concreteOwnerIndex = concreteOwnerByKey.get(maskTileClaimKey(tile));
      return concreteOwnerIndex === undefined || concreteOwnerIndex === ownerIndex;
    });
    // Backend ownership is already resolved by newest activity time and source-cell footprint.
    // Do not delete small components here: a legitimate updated park loop can be smaller than
    // an older surrounding conqueror mask and still needs to render on top.
    const tiles = exactOwnershipTiles;

    return { poly, tiles };
  });
}

function repairMergedOwnerMaskTiles(tiles, renderGrid = {}) {
  const validTiles = (Array.isArray(tiles) ? tiles : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (validTiles.length < LAND_MASK_INTERNAL_CORRIDOR_MIN_TILES) {
    return validTiles;
  }

  // Source masks are already computed by the backend and normalized per source before
  // ownership resolution. After owner union, keep the exact cells: sealing gaps here
  // can turn a dense set of open-route corridors into one fake landmass.
  return validTiles;
}

function mergeResolvedMaskEntriesByOwner(renderEntries, renderGrid = {}) {
  const groups = new Map();
  const mergedEntries = [];

  (Array.isArray(renderEntries) ? renderEntries : []).forEach(({ poly, tiles }, index) => {
    if (!hasCellMaskPolygon(poly) || !Array.isArray(tiles) || tiles.length === 0) {
      return;
    }

    const ownerKey = String(poly?.ownerKey || polygonOwnerMergeKey(poly, index));
    let group = groups.get(ownerKey);
    if (!group) {
      group = {
        poly: {
          ...poly,
          ownerKey,
          activityId: poly?.activityId ?? null,
          areaSquareMeters: 0,
          routeTraces: [],
          sourcePolygonCount: 0,
        },
        tilesByKey: new Map(),
      };
      groups.set(ownerKey, group);
      mergedEntries.push(group);
    }

    tiles.forEach((tile) => {
      const key = maskTileClaimKey(tile);
      if (!group.tilesByKey.has(key)) {
        group.tilesByKey.set(key, tile);
      }
    });

    group.poly.active = Boolean(group.poly.active || poly?.active);
    group.poly.color = group.poly.active
      ? safeColor(poly?.color, group.poly.color)
      : safeColor(group.poly.color || poly?.color);
    group.poly.ownerName = group.poly.ownerName || poly?.ownerName;
    group.poly.ownerId = group.poly.ownerId ?? poly?.ownerId;
    group.poly.cellMeters = Math.min(
      Number.isFinite(Number(group.poly.cellMeters)) ? Number(group.poly.cellMeters) : Number.POSITIVE_INFINITY,
      Number.isFinite(Number(poly?.cellMeters)) ? Number(poly.cellMeters) : Number.POSITIVE_INFINITY,
    );
    group.poly.areaSquareMeters += Number(poly?.areaSquareMeters) || 0;
    group.poly.sourcePolygonCount += 1;
    if (Array.isArray(poly?.routeTraces) && poly.routeTraces.length > 0) {
      group.poly.routeTraces.push(...poly.routeTraces);
    }
    if (group.poly.sourcePolygonCount > 1) {
      group.poly.activityId = null;
    }
    if (poly?.createdAt && (!group.poly.createdAt || String(poly.createdAt) > String(group.poly.createdAt))) {
      group.poly.createdAt = poly.createdAt;
    }
  });

  return mergedEntries
    .map((group) => {
      const cellMeters = Number(group.poly.cellMeters);
      const tiles = repairMergedOwnerMaskTiles(Array.from(group.tilesByKey.values()), renderGrid);
      return {
        poly: {
          ...group.poly,
          cellMeters: Number.isFinite(cellMeters) ? cellMeters : undefined,
        },
        tiles,
      };
    })
    .filter((entry) => entry.tiles.length > 0);
}

function maskVertexKey(vertex) {
  return `${vertex.x}:${vertex.y}`;
}

function maskVertexToLatLng(vertex, tileMeters, cosLat) {
  return [
    ((vertex.y / 2) * tileMeters) / METERS_PER_DEG_LAT,
    ((vertex.x / 2) * tileMeters) / (METERS_PER_DEG_LAT * cosLat),
  ];
}

function maskSharedEdgeMidpoint(from, to) {
  const midpoint = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const segmentLength = Math.sqrt((dx * dx) + (dy * dy));
  if (segmentLength <= 0) return midpoint;

  const offset = segmentLength * LAND_MASK_SHARED_EDGE_CURVE_RATIO;
  if (Math.abs(dx) < Math.abs(dy)) {
    const sign = Math.abs(Math.round(midpoint.x)) % 4 < 2 ? 1 : -1;
    return { x: midpoint.x + (offset * sign), y: midpoint.y };
  }

  const sign = Math.abs(Math.round(midpoint.y)) % 4 < 2 ? 1 : -1;
  return { x: midpoint.x, y: midpoint.y + (offset * sign) };
}

function maskTileConnectedComponents(tiles) {
  const tilesByKey = new Map(
    (Array.isArray(tiles) ? tiles : [])
      .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY))
      .map((tile) => [maskTileClaimKey(tile), tile]),
  );
  const remainingKeys = new Set(tilesByKey.keys());
  const components = [];

  while (remainingKeys.size > 0) {
    const startKey = remainingKeys.values().next().value;
    const stack = [startKey];
    const component = [];
    remainingKeys.delete(startKey);

    while (stack.length > 0) {
      const key = stack.pop();
      const tile = tilesByKey.get(key);
      if (!tile) continue;
      component.push(tile);
      neighborKeys(tile).forEach((neighborKey) => {
        if (remainingKeys.has(neighborKey)) {
          remainingKeys.delete(neighborKey);
          stack.push(neighborKey);
        }
      });
    }

    if (component.length > 0) {
      components.push(component);
    }
  }

  return components;
}

function visibleMaskConnectedComponents(components, options = {}) {
  const validComponents = (Array.isArray(components) ? components : [])
    .filter((component) => Array.isArray(component) && component.length > 0);
  if (!validComponents.length) return [];
  if (options?.preserveAll) return validComponents;

  const visibleComponents = validComponents.filter((component) => {
    const minTiles = component.some((tile) => tile?.hasSharedBoundary)
      ? LAND_MASK_EDGE_COMPONENT_MIN_VISIBLE_TILES
      : LAND_MASK_MIN_VISIBLE_COMPONENT_TILES;
    return component.length >= minTiles;
  });

  if (visibleComponents.length > 0) {
    return visibleComponents;
  }

  return validComponents
    .slice()
    .sort((a, b) => b.length - a.length)
    .slice(0, 1);
}

function visualMaskRegions(tiles, options = {}) {
  const regions = [];
  visibleMaskConnectedComponents(maskTileConnectedComponents(tiles)).forEach((component) => {
    const componentRegions = maskBoundaryLoops(component, options)
      .filter((loop) => loop.length >= 4);
    visibleMaskLandRegions(componentRegions, options).forEach((region) => regions.push(region));
  });
  return regions;
}

function maskBoundaryLoops(tiles, options = {}) {
  if (!Array.isArray(tiles) || !tiles.length) return [];

  const tileMeters = Number(tiles[0]?.tileMeters);
  const cosLat = Number(tiles[0]?.cosLat);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) return [];

  const occupied = new Set(
    tiles
      .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY))
      .map((tile) => `${tile.gridY}:${tile.gridX}`),
  );
  const globalOccupied = options?.globalOccupied instanceof Set ? options.globalOccupied : null;
  const edgeRecords = [];

  const addEdge = (from, to, neighborKey) => {
    edgeRecords.push({
      key: `${maskVertexKey(from)}>${maskVertexKey(to)}`,
      from,
      to,
      shared: Boolean(globalOccupied?.has(neighborKey)),
    });
  };

  tiles.forEach((tile) => {
    if (!Number.isFinite(tile?.gridX) || !Number.isFinite(tile?.gridY)) return;

    const { gridX, gridY } = tile;
    const west = (gridX * 2) - 1;
    const east = (gridX * 2) + 1;
    const south = (gridY * 2) - 1;
    const north = (gridY * 2) + 1;

    const northKey = `${gridY + 1}:${gridX}`;
    const eastKey = `${gridY}:${gridX + 1}`;
    const southKey = `${gridY - 1}:${gridX}`;
    const westKey = `${gridY}:${gridX - 1}`;
    if (!occupied.has(northKey)) addEdge({ x: west, y: north }, { x: east, y: north }, northKey);
    if (!occupied.has(eastKey)) addEdge({ x: east, y: north }, { x: east, y: south }, eastKey);
    if (!occupied.has(southKey)) addEdge({ x: east, y: south }, { x: west, y: south }, southKey);
    if (!occupied.has(westKey)) addEdge({ x: west, y: south }, { x: west, y: north }, westKey);
  });

  const remaining = new Map(edgeRecords.map((edge) => [edge.key, edge]));
  const edgesByStart = new Map();
  edgeRecords.forEach((edge) => {
    const startKey = maskVertexKey(edge.from);
    const edges = edgesByStart.get(startKey) || [];
    edges.push(edge);
    edgesByStart.set(startKey, edges);
  });

  const loops = [];
  while (remaining.size > 0) {
    let edge = remaining.values().next().value;
    const startKey = maskVertexKey(edge.from);
    const loop = [];
    let guard = 0;

    while (edge && remaining.has(edge.key) && guard < edgeRecords.length + 2) {
      guard += 1;
      const endpoint = edge.to;
      if (edge.shared) {
        loop.hasSharedBoundary = true;
      }
      const fromPoint = maskVertexToLatLng(edge.from, tileMeters, cosLat);
      fromPoint.hasSharedBoundary = Boolean(edge.shared);
      loop.push(fromPoint);
      if (edge.shared) {
        const midpoint = maskVertexToLatLng(maskSharedEdgeMidpoint(edge.from, endpoint), tileMeters, cosLat);
        midpoint.hasSharedBoundary = true;
        loop.push(midpoint);
      }
      remaining.delete(edge.key);

      const endpointKey = maskVertexKey(endpoint);
      if (endpointKey === startKey) {
        const endpointPoint = maskVertexToLatLng(endpoint, tileMeters, cosLat);
        endpointPoint.hasSharedBoundary = Boolean(edge.shared);
        loop.push(endpointPoint);
        break;
      }

      edge = (edgesByStart.get(endpointKey) || []).find((candidate) => remaining.has(candidate.key));
      if (!edge) {
        loop.push(maskVertexToLatLng(endpoint, tileMeters, cosLat));
      }
    }

    if (loop.length >= 4) {
      loops.push(loop);
    }
  }

  return loops;
}

function maskSmoothingPassCount(pointCount, requestedPasses) {
  let effectivePasses = Math.max(0, Math.floor(Number(requestedPasses) || 0));
  if (pointCount <= LAND_MASK_TINY_LOOP_POINT_LIMIT) {
    effectivePasses = Math.min(effectivePasses, 2);
  } else if (pointCount <= LAND_MASK_SMALL_LOOP_POINT_LIMIT) {
    effectivePasses = Math.min(effectivePasses, 3);
  }
  while (
    effectivePasses > 0
    && pointCount * (3 ** effectivePasses) > LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP
  ) {
    effectivePasses -= 1;
  }
  return effectivePasses;
}

function maskPointToMeters(point, cosLat) {
  return {
    x: point[1] * METERS_PER_DEG_LAT * cosLat,
    y: point[0] * METERS_PER_DEG_LAT,
  };
}

function maskPointSegmentDistanceSquared(point, start, end, cosLat) {
  const projectedPoint = maskPointToMeters(point, cosLat);
  const projectedStart = maskPointToMeters(start, cosLat);
  const projectedEnd = maskPointToMeters(end, cosLat);
  const segmentX = projectedEnd.x - projectedStart.x;
  const segmentY = projectedEnd.y - projectedStart.y;
  const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);

  if (segmentLengthSquared <= 0) {
    const dx = projectedPoint.x - projectedStart.x;
    const dy = projectedPoint.y - projectedStart.y;
    return (dx * dx) + (dy * dy);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      (((projectedPoint.x - projectedStart.x) * segmentX) + ((projectedPoint.y - projectedStart.y) * segmentY))
        / segmentLengthSquared,
    ),
  );
  const closestX = projectedStart.x + (projection * segmentX);
  const closestY = projectedStart.y + (projection * segmentY);
  const dx = projectedPoint.x - closestX;
  const dy = projectedPoint.y - closestY;
  return (dx * dx) + (dy * dy);
}

function simplifyMaskLine(points, toleranceMeters, cosLat) {
  if (!Array.isArray(points) || points.length <= 2 || !Number.isFinite(toleranceMeters) || toleranceMeters <= 0) {
    return Array.isArray(points) ? points : [];
  }

  const toleranceSquared = toleranceMeters * toleranceMeters;
  const keep = new Array(points.length).fill(false);
  const stack = [[0, points.length - 1]];
  keep[0] = true;
  keep[points.length - 1] = true;

  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop();
    let farthestIndex = -1;
    let farthestDistance = toleranceSquared;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = maskPointSegmentDistanceSquared(points[index], points[startIndex], points[endIndex], cosLat);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    }

    if (farthestIndex > -1) {
      keep[farthestIndex] = true;
      stack.push([startIndex, farthestIndex], [farthestIndex, endIndex]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

function simplifyClosedMaskLoop(points, toleranceMeters, cosLat) {
  if (!Array.isArray(points) || points.length < 8) return points;

  const anchor = points[0];
  let splitIndex = Math.floor(points.length / 2);
  let farthestDistance = -1;
  for (let index = 1; index < points.length; index += 1) {
    const distance = maskPointSegmentDistanceSquared(points[index], anchor, anchor, cosLat);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      splitIndex = index;
    }
  }

  const firstArc = simplifyMaskLine(points.slice(0, splitIndex + 1), toleranceMeters, cosLat);
  const secondArc = simplifyMaskLine([...points.slice(splitIndex), points[0]], toleranceMeters, cosLat);
  const simplified = [...firstArc.slice(0, -1), ...secondArc.slice(0, -1)];
  return simplified.length >= 3 ? simplified : points;
}

function interpolateMaskPoint(start, end, fraction) {
  return [
    start[0] + ((end[0] - start[0]) * fraction),
    start[1] + ((end[1] - start[1]) * fraction),
  ];
}

function quadraticMaskPoint(start, control, end, fraction) {
  const inverse = 1 - fraction;
  return [
    (inverse * inverse * start[0]) + (2 * inverse * fraction * control[0]) + (fraction * fraction * end[0]),
    (inverse * inverse * start[1]) + (2 * inverse * fraction * control[1]) + (fraction * fraction * end[1]),
  ];
}

function maskPointDistanceMeters(start, end, cosLat) {
  const projectedStart = maskPointToMeters(start, cosLat);
  const projectedEnd = maskPointToMeters(end, cosLat);
  const dx = projectedEnd.x - projectedStart.x;
  const dy = projectedEnd.y - projectedStart.y;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function closedMaskLoopOpenPoints(loop) {
  const points = (Array.isArray(loop) ? loop : [])
    .map((point) => {
      const normalized = [Number(point?.[0]), Number(point?.[1])];
      normalized.hasSharedBoundary = Boolean(point?.hasSharedBoundary);
      return normalized;
    })
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) {
    points.pop();
  }
  return points;
}

function maskLoopAreaMetersSquared(loop, cosLat) {
  return Math.abs(maskLoopSignedAreaMetersSquared(loop, cosLat));
}

function maskLoopSignedAreaMetersSquared(loop, cosLat) {
  const points = closedMaskLoopOpenPoints(loop);
  if (points.length < 3 || !Number.isFinite(cosLat) || cosLat <= 0) return 0;

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = maskPointToMeters(points[index], cosLat);
    const next = maskPointToMeters(points[(index + 1) % points.length], cosLat);
    area += (current.x * next.y) - (next.x * current.y);
  }
  return area / 2;
}

function maskLoopPerimeterMeters(loop, cosLat) {
  const points = closedMaskLoopOpenPoints(loop);
  if (points.length < 3 || !Number.isFinite(cosLat) || cosLat <= 0) return 0;

  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    perimeter += maskPointDistanceMeters(points[index], points[(index + 1) % points.length], cosLat);
  }
  return perimeter;
}

function maskArcAreaMetersSquared(points, cosLat) {
  if (!Array.isArray(points) || points.length < 3 || !Number.isFinite(cosLat) || cosLat <= 0) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = maskPointToMeters(points[index], cosLat);
    const next = maskPointToMeters(points[(index + 1) % points.length], cosLat);
    area += (current.x * next.y) - (next.x * current.y);
  }
  return Math.abs(area) / 2;
}

function collapseLargeMaskBays(points, options = {}) {
  const open = closedMaskLoopOpenPoints(points);
  if (open.length < 12) return open;

  const cosLat = Number(options?.cosLat);
  const sourceCellMeters = Number(options?.sourceCellMeters);
  if (!Number.isFinite(cosLat) || cosLat <= 0 || !Number.isFinite(sourceCellMeters) || sourceCellMeters <= 0) {
    return open;
  }

  const maxChordMeters = sourceCellMeters * LAND_MASK_LARGE_BAY_COLLAPSE_WIDTH_RATIO;
  const maxArcMeters = sourceCellMeters * LAND_MASK_LARGE_BAY_COLLAPSE_MAX_ARC_RATIO;
  const minArcMeters = sourceCellMeters * LAND_MASK_LARGE_BAY_COLLAPSE_MIN_ARC_RATIO;
  const maxCollapses = Math.max(0, LAND_MASK_LARGE_BAY_COLLAPSE_MAX_PER_LOOP);
  if (maxChordMeters <= 0 || maxArcMeters <= 0 || minArcMeters <= 0 || maxCollapses <= 0) return open;

  const result = [];
  let collapseCount = 0;

  for (let startIndex = 0; startIndex < open.length; startIndex += 1) {
    const startPoint = open[startIndex];
    result.push(startPoint);

    if (collapseCount >= maxCollapses || startIndex >= open.length - 4) {
      continue;
    }

    let arcMeters = 0;
    let best = null;
    for (let endIndex = startIndex + 3; endIndex < open.length - 1; endIndex += 1) {
      arcMeters += maskPointDistanceMeters(open[endIndex - 1], open[endIndex], cosLat);
      if (arcMeters > maxArcMeters) break;
      if (arcMeters < minArcMeters) continue;

      const endPoint = open[endIndex];
      const chordMeters = maskPointDistanceMeters(startPoint, endPoint, cosLat);
      if (chordMeters <= 0 || chordMeters > maxChordMeters) continue;
      if (arcMeters < chordMeters * LAND_MASK_LARGE_BAY_COLLAPSE_MIN_ARC_TO_CHORD) continue;
      if (open.slice(startIndex, endIndex + 1).some((point) => point?.hasSharedBoundary)) continue;

      const bayArea = maskArcAreaMetersSquared([startPoint, ...open.slice(startIndex + 1, endIndex + 1)], cosLat);
      const maxBayArea = Math.max(
        sourceCellMeters * sourceCellMeters * 6,
        chordMeters * arcMeters * 2,
      );
      if (bayArea > maxBayArea) continue;

      const score = (arcMeters / chordMeters) + (arcMeters / Math.max(sourceCellMeters, 1));
      if (!best || score > best.score) {
        best = { endIndex, score };
      }
    }

    if (best) {
      startIndex = best.endIndex - 1;
      collapseCount += 1;
    }
  }

  if (collapseCount > 0 && !options?.singlePass) {
    return collapseLargeMaskBays(result, { ...options, singlePass: true });
  }

  return result.length >= 3 ? result : open;
}

function roundClosedMaskLoopCorners(points, radiusMeters, cosLat, passes) {
  if (!Array.isArray(points) || points.length < 3 || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return Array.isArray(points) ? points : [];
  }

  let rounded = points.slice();
  const effectivePasses = Math.max(1, Math.floor(Number(passes) || 1));
  for (let pass = 0; pass < effectivePasses; pass += 1) {
    const next = [];
    for (let index = 0; index < rounded.length; index += 1) {
      const previous = rounded[(index - 1 + rounded.length) % rounded.length];
      const current = rounded[index];
      const following = rounded[(index + 1) % rounded.length];
      const previousDistance = maskPointDistanceMeters(previous, current, cosLat);
      const nextDistance = maskPointDistanceMeters(current, following, cosLat);
      if (previousDistance <= 0 || nextDistance <= 0) {
        next.push(current);
        continue;
      }

      const cornerDistance = Math.min(radiusMeters, previousDistance * 0.49, nextDistance * 0.49);
      const previousFraction = cornerDistance / previousDistance;
      const nextFraction = cornerDistance / nextDistance;
      const approach = interpolateMaskPoint(current, previous, previousFraction);
      const leave = interpolateMaskPoint(current, following, nextFraction);
      const chordMidpoint = interpolateMaskPoint(approach, leave, 0.5);
      const arcControl = interpolateMaskPoint(current, chordMidpoint, 0.82);
      next.push(approach);
      next.push(quadraticMaskPoint(approach, arcControl, leave, 0.17));
      next.push(quadraticMaskPoint(approach, arcControl, leave, 0.33));
      next.push(quadraticMaskPoint(approach, arcControl, leave, 0.5));
      next.push(quadraticMaskPoint(approach, arcControl, leave, 0.67));
      next.push(quadraticMaskPoint(approach, arcControl, leave, 0.83));
      next.push(leave);
    }
    rounded = next;
    if (rounded.length >= LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP) {
      break;
    }
  }

  return rounded;
}

function curveClosedMaskLoop(points, passes) {
  if (!Array.isArray(points) || points.length < 3) {
    return Array.isArray(points) ? points : [];
  }

  let curved = points.slice();
  const effectivePasses = Math.max(0, Math.floor(Number(passes) || 0));
  for (let pass = 0; pass < effectivePasses; pass += 1) {
    if (curved.length >= LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP) {
      break;
    }

    const next = [];
    for (let index = 0; index < curved.length; index += 1) {
      const current = curved[index];
      const following = curved[(index + 1) % curved.length];
      next.push(interpolateMaskPoint(current, following, 0.25));
      next.push(interpolateMaskPoint(current, following, 0.75));
    }
    curved = next;
  }

  return curved;
}

function smoothMaskBoundaryLoop(loop, options = {}) {
  const passes = typeof options === 'number'
    ? options
    : Number.isFinite(Number(options?.passes))
      ? Number(options.passes)
      : LAND_MASK_SMOOTHING_PASSES;
  const tileMeters = typeof options === 'object' ? Number(options?.tileMeters) : Number.NaN;
  const sourceCellMeters = typeof options === 'object' ? Number(options?.sourceCellMeters) : Number.NaN;
  const providedCosLat = typeof options === 'object' ? Number(options?.cosLat) : Number.NaN;
  const points = closedMaskLoopOpenPoints(loop);

  if (points.length < 3) return [];

  const open = points;
  const fallbackCosLat = Math.max(1e-6, Math.abs(Math.cos((open[0][0] * Math.PI) / 180)));
  const cosLat = Number.isFinite(providedCosLat) && providedCosLat > 0 ? providedCosLat : fallbackCosLat;
  if (options?.preserveAll) {
    const closed = [...open, open[0]];
    closed.hasSharedBoundary = Boolean(loop.hasSharedBoundary);
    return closed;
  }
  const routeCorridor = Boolean(options?.routeCorridor);
  let contourSimplifyRatio = LAND_MASK_CONTOUR_SIMPLIFY_RATIO;
  if (routeCorridor) {
    contourSimplifyRatio = LAND_MASK_ROUTE_CORRIDOR_CONTOUR_SIMPLIFY_RATIO;
  } else if (open.length <= LAND_MASK_TINY_LOOP_POINT_LIMIT) {
    contourSimplifyRatio = LAND_MASK_CONTOUR_SIMPLIFY_RATIO * 0.45;
  } else if (open.length <= LAND_MASK_SMALL_LOOP_POINT_LIMIT) {
    contourSimplifyRatio = LAND_MASK_CONTOUR_SIMPLIFY_RATIO * 0.7;
  }
  const contourBaseMeters = Number.isFinite(tileMeters) && tileMeters > 0
    ? tileMeters
    : Number.isFinite(sourceCellMeters) && sourceCellMeters > 0
      ? sourceCellMeters
      : 36;
  const simplifyToleranceMeters = contourBaseMeters
    * contourSimplifyRatio;

  const baySourceCellMeters = Number.isFinite(sourceCellMeters) && sourceCellMeters > 0
    ? sourceCellMeters
    : contourBaseMeters;
  const bayCollapsed = options?.largeLandmass
    ? collapseLargeMaskBays(open, { cosLat, sourceCellMeters: baySourceCellMeters })
    : open;
  const simplified = simplifyClosedMaskLoop(bayCollapsed, simplifyToleranceMeters, cosLat);
  const smoothingPasses = routeCorridor
    ? Math.min(LAND_MASK_ROUTE_CORRIDOR_SMOOTHING_PASSES, maskSmoothingPassCount(simplified.length, passes))
    : maskSmoothingPassCount(simplified.length, passes);
  const cornerRadiusMeters = contourBaseMeters
    * (routeCorridor ? LAND_MASK_ROUTE_CORRIDOR_CORNER_RADIUS_RATIO : LAND_MASK_CORNER_RADIUS_RATIO);
  const smoothed = roundClosedMaskLoopCorners(simplified, cornerRadiusMeters, cosLat, smoothingPasses);
  const curvePasses = open.length <= LAND_MASK_TINY_LOOP_POINT_LIMIT
    ? 1
    : (routeCorridor ? 1 : LAND_MASK_CURVE_PASSES);
  const curved = curveClosedMaskLoop(smoothed, curvePasses);
  const closed = [...curved, curved[0]];
  closed.hasSharedBoundary = Boolean(loop.hasSharedBoundary);

  return closed;
}

function visibleMaskLandRegions(exactRegions, options = {}) {
  return (Array.isArray(exactRegions) ? exactRegions : [])
    .filter((loop) => loop.length >= LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS)
    .map((loop) => smoothMaskBoundaryLoop(loop, options))
    .filter((loop) => loop.length >= 4);
}

function visibleMaskContourRegions(exactRegions, options = {}) {
  const providedCosLat = Number(options?.cosLat);
  const fallbackLoop = (Array.isArray(exactRegions) ? exactRegions : []).find((loop) => Array.isArray(loop) && loop.length > 0);
  const fallbackLat = Number(fallbackLoop?.[0]?.[0]);
  const cosLat = Number.isFinite(providedCosLat) && providedCosLat > 0
    ? providedCosLat
    : Math.max(1e-6, Math.abs(Math.cos(((Number.isFinite(fallbackLat) ? fallbackLat : 0) * Math.PI) / 180)));
  const preserveAll = Boolean(options?.preserveAll);

  return (Array.isArray(exactRegions) ? exactRegions : [])
    .filter((loop) => loop.length >= LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS)
    .filter((loop) => preserveAll
      || loop.hasSharedBoundary
      || maskLoopAreaMetersSquared(loop, cosLat) >= LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS
      || maskLoopPerimeterMeters(loop, cosLat) >= LAND_MASK_MIN_CONTOUR_PERIMETER_METERS)
    .map((loop) => smoothMaskBoundaryLoop(loop, { ...options, cosLat }))
    .filter((loop) => loop.length >= 4);
}

function visibleMaskLandGroupLoops(regions, options = {}) {
  const drawableRegions = (Array.isArray(regions) ? regions : [])
    .filter((loop) => Array.isArray(loop) && loop.length >= LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS);
  if (drawableRegions.length <= 1) return drawableRegions;
  if (options?.preserveAll) return drawableRegions;

  const providedCosLat = Number(options?.cosLat);
  const fallbackLoop = drawableRegions.find((loop) => Array.isArray(loop) && loop.length > 0);
  const fallbackLat = Number(fallbackLoop?.[0]?.[0]);
  const cosLat = Number.isFinite(providedCosLat) && providedCosLat > 0
    ? providedCosLat
    : Math.max(1e-6, Math.abs(Math.cos(((Number.isFinite(fallbackLat) ? fallbackLat : 0) * Math.PI) / 180)));

  const measuredRegions = drawableRegions.map((loop) => ({
    loop,
    signedArea: maskLoopSignedAreaMetersSquared(loop, cosLat),
    area: maskLoopAreaMetersSquared(loop, cosLat),
    perimeter: maskLoopPerimeterMeters(loop, cosLat),
  }));
  const dominantRegion = measuredRegions
    .slice()
    .sort((left, right) => right.area - left.area)[0];
  const dominantOrientation = Math.sign(dominantRegion?.signedArea || 0);

  return measuredRegions
    .filter((entry) => {
      const isOuter = entry.loop === dominantRegion?.loop;
      if (isOuter || entry.loop.hasSharedBoundary) return true;

      const orientation = Math.sign(entry.signedArea || 0);
      return dominantOrientation !== 0 && orientation === dominantOrientation;
    })
    .map((entry) => entry.loop);
}

function territoryMaskRegionGroupLimit(maxGroups, options = {}) {
  const numericLimit = Number(maxGroups);
  if (options?.preserveAll || numericLimit === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY;
  }
  return Number.isFinite(numericLimit) && numericLimit > 0
    ? Math.max(1, Math.floor(numericLimit))
    : LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER;
}

function selectDiverseMaskRegionGroups(entries, maxGroups = LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER, options = {}) {
  const limit = territoryMaskRegionGroupLimit(maxGroups, options);
  const viewport = options?.viewport || null;
  const ranked = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.regions?.length > 0)
    .sort((left, right) => right.score - left.score);
  const selected = [];
  const selectedIndexes = new Set();
  const selectEntry = (entry, index) => {
    if (selected.length >= limit || selectedIndexes.has(index)) return;
    selected.push(entry);
    selectedIndexes.add(index);
  };

  if (viewport?.center && Number.isFinite(Number(viewport.radiusMeters))) {
    ranked
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        const distance = territoryCenterDistanceMeters(entry.center, viewport.center);
        return Number.isFinite(distance)
          && distance <= (Number(viewport.radiusMeters) + Math.max(entry.spanMeters / 2, 420));
      })
      .sort((left, right) => (
        right.entry.score - left.entry.score
        || territoryCenterDistanceMeters(left.entry.center, viewport.center)
        - territoryCenterDistanceMeters(right.entry.center, viewport.center)
        || left.index - right.index
      ))
      .forEach(({ entry, index }) => selectEntry(entry, index));
  }

  ranked.forEach((entry, index) => {
    if (selected.length >= limit) return;
    const isDistant = selected.every((selectedEntry) => (
      territoryCenterDistanceMeters(entry.center, selectedEntry.center) >= LAND_MASK_VISIBLE_REGION_DIVERSITY_METERS
    ));
    if (!isDistant) return;
    selectEntry(entry, index);
  });

  ranked.forEach((entry, index) => {
    selectEntry(entry, index);
  });

  return selected;
}

function visibleMaskLandRegionGroups(regionGroups, options = {}) {
  const entries = (Array.isArray(regionGroups) ? regionGroups : [])
    .map((source) => {
      const regions = Array.isArray(source?.regions) ? source.regions : source;
      const groupOptions = source?.options && typeof source.options === 'object'
        ? { ...options, ...source.options }
        : options;
      const drawableRegions = visibleMaskContourRegions(visibleMaskLandGroupLoops(regions, groupOptions), groupOptions);
      if (!drawableRegions.length) return null;

      const providedCosLat = Number(groupOptions?.cosLat);
      const fallbackLoop = drawableRegions.find((loop) => Array.isArray(loop) && loop.length > 0);
      const fallbackLat = Number(fallbackLoop?.[0]?.[0]);
      const cosLat = Number.isFinite(providedCosLat) && providedCosLat > 0
        ? providedCosLat
        : Math.max(1e-6, Math.abs(Math.cos(((Number.isFinite(fallbackLat) ? fallbackLat : 0) * Math.PI) / 180)));
      const score = drawableRegions.reduce((total, loop) => (
        total + maskLoopAreaMetersSquared(loop, cosLat) + (maskLoopPerimeterMeters(loop, cosLat) * 8)
      ), 0);
      const bounds = territoryCoordinateBounds(drawableRegions.flat());
      const center = territoryBoundsCenter(bounds);
      return {
        regions: drawableRegions,
        score,
        bounds,
        center,
        spanMeters: territoryBoundsSpanMeters(bounds),
      };
    })
    .filter(Boolean);
  const maxGroups = territoryMaskRegionGroupLimit(options?.maxGroups, options);
  return selectDiverseMaskRegionGroups(entries, maxGroups, options)
    .map((entry) => entry.regions);
}

function limitMaskRegionGroupsByLoopBudget(regionGroups, maxLoops = LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER) {
  const loopBudget = territoryMaskRegionGroupLimit(maxLoops);
  const limitedGroups = [];
  let usedLoops = 0;

  (Array.isArray(regionGroups) ? regionGroups : []).some((regions) => {
    const drawableRegions = (Array.isArray(regions) ? regions : [])
      .filter((region) => Array.isArray(region) && region.length >= 4);
    if (!drawableRegions.length) return false;
    const remaining = loopBudget - usedLoops;
    if (remaining <= 0) return true;
    limitedGroups.push(drawableRegions.slice(0, remaining));
    usedLoops += Math.min(drawableRegions.length, remaining);
    return usedLoops >= loopBudget;
  });

  return limitedGroups;
}

function outerMaskContourRegions(regionGroups, options = {}) {
  const providedCosLat = Number(options?.cosLat);
  const fallbackGroup = (Array.isArray(regionGroups) ? regionGroups : [])
    .find((group) => Array.isArray(group) && group.length > 0);
  const fallbackLoop = fallbackGroup?.find((loop) => Array.isArray(loop) && loop.length > 0);
  const fallbackLat = Number(fallbackLoop?.[0]?.[0]);
  const cosLat = Number.isFinite(providedCosLat) && providedCosLat > 0
    ? providedCosLat
    : Math.max(1e-6, Math.abs(Math.cos(((Number.isFinite(fallbackLat) ? fallbackLat : 0) * Math.PI) / 180)));

  const rankedRegionGroups = (Array.isArray(regionGroups) ? regionGroups : [])
    .map((regions) => {
      const drawableRegions = (Array.isArray(regions) ? regions : [])
        .filter((loop) => loop.length >= LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS);
      if (!drawableRegions.length) return null;

      const measuredRegions = drawableRegions.map((loop) => ({
        loop,
        signedArea: maskLoopSignedAreaMetersSquared(loop, cosLat),
        area: maskLoopAreaMetersSquared(loop, cosLat),
        perimeter: maskLoopPerimeterMeters(loop, cosLat),
      }));
      let maxArea = 0;
      let maxPerimeter = 0;
      measuredRegions.forEach((entry) => {
        maxArea = Math.max(maxArea, entry.area);
        maxPerimeter = Math.max(maxPerimeter, entry.perimeter);
      });
      const hasSharedBoundary = measuredRegions.some((entry) => entry.loop.hasSharedBoundary);
      if (
        !hasSharedBoundary
        && maxArea < LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS
        && maxPerimeter < LAND_MASK_MIN_CONTOUR_PERIMETER_METERS
      ) {
        return null;
      }

      const dominantRegion = measuredRegions
        .slice()
        .sort((left, right) => right.area - left.area)[0];
      const dominantOrientation = Math.sign(dominantRegion?.signedArea || 0);
      const outerRegions = measuredRegions
        .filter((entry) => {
          const orientation = Math.sign(entry.signedArea || 0);
          return dominantOrientation === 0
            ? entry.area === maxArea
            : orientation === dominantOrientation;
        })
        .map((entry) => entry.loop);

      return {
        hasSharedBoundary,
        outerRegions,
        score: maxArea + (maxPerimeter * 8),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      b.score - a.score
      || Number(b.hasSharedBoundary) - Number(a.hasSharedBoundary)
    ))
    .slice(0, LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER);

  const contourRegions = [];
  rankedRegionGroups.some(({ outerRegions }) => {
    visibleMaskContourRegions(outerRegions, { ...options, cosLat }).some((region) => {
      contourRegions.push(region);
      return contourRegions.length >= LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER;
    });
    return contourRegions.length >= LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER;
  });
  return contourRegions;
}

function visibleMaskStrokeRegions(regions) {
  return (Array.isArray(regions) ? regions : [])
    .filter((loop) => Array.isArray(loop) && loop.length >= 4);
}

function decimateClosedRegion(region, stride, maxOpenPoints = Number.POSITIVE_INFINITY) {
  const open = closedMaskLoopOpenPoints(region);
  if (open.length < 3) return [];
  const targetOpenPoints = Number.isFinite(Number(maxOpenPoints))
    ? Math.max(3, Math.floor(Number(maxOpenPoints)))
    : open.length;
  const step = Math.max(1, Math.floor(Number(stride) || 1), Math.ceil(open.length / targetOpenPoints));
  let decimated = open.filter((_, index) => index === 0 || index % step === 0).slice(0, targetOpenPoints);
  if (decimated.length < 3) {
    decimated = [
      open[0],
      open[Math.floor(open.length / 3)],
      open[Math.floor((open.length * 2) / 3)],
    ].filter(Boolean);
  }
  if (decimated.length < 3) return [];
  return [...decimated, decimated[0]];
}

function simplifyCachedPreviewRegion(region) {
  if (!Array.isArray(region) || region.length < 4) return [];
  const fallbackLat = Number(region?.[0]?.[0]);
  const cosLat = Math.max(
    1e-6,
    Math.abs(Math.cos(((Number.isFinite(fallbackLat) ? fallbackLat : 0) * Math.PI) / 180)),
  );
  const simplified = simplifyClosedMaskLoop(region, TERRITORY_CACHED_RENDER_PREVIEW_TOLERANCE_METERS, cosLat);
  const open = closedMaskLoopOpenPoints(simplified);
  return open.length >= 3 ? [...open, open[0]] : [];
}

function selectCachedPreviewRegions(scoredRegions, maxRegions) {
  const cappedRegionCount = Math.max(1, Math.floor(Number(maxRegions) || 1));
  const sortedRegions = scoredRegions.slice().sort((a, b) => b.score - a.score);
  const selected = [];
  const selectedRegions = new Set();

  sortedRegions.forEach((entry) => {
    if (selected.length >= cappedRegionCount) return;
    if (selectedRegions.has(entry.region)) return;
    selected.push(entry);
    selectedRegions.add(entry.region);
  });

  return selected;
}

function previewRegionSet(regions, options = {}) {
  const maxRegions = Math.max(1, Math.floor(Number(options?.maxRegions) || 1));
  const simplifiedRegions = (Array.isArray(regions) ? regions : [])
    .map(simplifyCachedPreviewRegion)
    .filter((region) => region.length >= 4);
  const rankedRegions = selectCachedPreviewRegions(simplifiedRegions
    .map((region) => {
      const fallbackLat = Number(region?.[0]?.[0]);
      const cosLat = Math.max(
        1e-6,
        Math.abs(Math.cos(((Number.isFinite(fallbackLat) ? fallbackLat : 0) * Math.PI) / 180)),
      );
      return {
        region,
        score: maskLoopAreaMetersSquared(region, cosLat) + (maskLoopPerimeterMeters(region, cosLat) * 8),
      };
    }), maxRegions);

  let remainingPointBudget = TERRITORY_CACHED_RENDER_PREVIEW_MAX_POINTS_PER_OWNER;
  return rankedRegions
    .map(({ region }, index) => {
      const regionsLeft = Math.max(1, rankedRegions.length - index);
      const maxClosedPointsForRegion = Math.max(4, Math.floor(remainingPointBudget / regionsLeft));
      const decimated = decimateClosedRegion(region, 1, maxClosedPointsForRegion - 1);
      remainingPointBudget = Math.max(0, remainingPointBudget - decimated.length);
      return decimated;
    })
    .filter((region) => region.length >= 4);
}

function cachedPreviewRenderEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const previewLandRegions = entry.active
      ? (Array.isArray(entry.landRegions) ? entry.landRegions : [])
      : previewRegionSet(entry.landRegions, { maxRegions: TERRITORY_CACHED_RENDER_PREVIEW_MAX_RIVAL_REGIONS_PER_OWNER });
    const previewContourRegions = entry.active
      ? (Array.isArray(entry.contourRegions) ? entry.contourRegions : [])
      : previewRegionSet(entry.contourRegions, { maxRegions: TERRITORY_CACHED_RENDER_PREVIEW_MAX_RIVAL_REGIONS_PER_OWNER });
    return {
      ...entry,
      landRegions: previewLandRegions,
      landRegionGroups: Array.isArray(entry.landRegionGroups) ? entry.landRegionGroups : [],
      contourRegions: previewContourRegions,
    };
  }).filter((entry) => entry.landRegions.length > 0 || entry.contourRegions.length > 0);
}

function interactiveDisplayRegionGroups(regionGroups, maxPoints) {
  const drawableGroups = (Array.isArray(regionGroups) ? regionGroups : [])
    .map((regions) => (Array.isArray(regions) ? regions : [])
      .filter((region) => Array.isArray(region) && region.length >= 4))
    .filter((regions) => regions.length > 0);
  const regionCount = drawableGroups.reduce((total, regions) => total + regions.length, 0);
  if (!regionCount) return [];

  let remainingRegions = regionCount;
  let remainingPointBudget = Math.max(regionCount * 4, Math.floor(Number(maxPoints) || 0));
  return drawableGroups
    .map((regions) => regions
      .map((region) => {
        const maxClosedPointsForRegion = Math.max(4, Math.floor(remainingPointBudget / Math.max(1, remainingRegions)));
        const decimated = decimateClosedRegion(region, 1, maxClosedPointsForRegion - 1);
        remainingPointBudget = Math.max(0, remainingPointBudget - decimated.length);
        remainingRegions -= 1;
        return decimated;
      })
      .filter((region) => region.length >= 4))
    .filter((regions) => regions.length > 0);
}

function interactiveDisplayRegionSet(regions, maxPoints) {
  const drawableRegions = (Array.isArray(regions) ? regions : [])
    .filter((region) => Array.isArray(region) && region.length >= 4);
  if (!drawableRegions.length) return [];

  let remainingRegions = drawableRegions.length;
  let remainingPointBudget = Math.max(drawableRegions.length * 4, Math.floor(Number(maxPoints) || 0));
  return drawableRegions
    .map((region) => {
      const maxClosedPointsForRegion = Math.max(4, Math.floor(remainingPointBudget / Math.max(1, remainingRegions)));
      const decimated = decimateClosedRegion(region, 1, maxClosedPointsForRegion - 1);
      remainingPointBudget = Math.max(0, remainingPointBudget - decimated.length);
      remainingRegions -= 1;
      return decimated;
    })
    .filter((region) => region.length >= 4);
}

function interactiveDisplayRenderEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const maxPoints = entry?.active
        ? TERRITORY_INTERACTIVE_RENDER_MAX_ACTIVE_POINTS_PER_OWNER
        : TERRITORY_INTERACTIVE_RENDER_MAX_RIVAL_POINTS_PER_OWNER;
      const landRegionGroups = interactiveDisplayRegionGroups(entry?.landRegionGroups, maxPoints);
      const landRegions = landRegionGroups.length > 0
        ? landRegionGroups.flat()
        : interactiveDisplayRegionSet(entry?.landRegions, maxPoints);
      const contourRegions = landRegionGroups.length > 0
        ? landRegions
        : interactiveDisplayRegionSet(entry?.contourRegions, maxPoints);
      return {
        ...entry,
        landRegions,
        landRegionGroups,
        contourRegions,
      };
    })
    .filter((entry) => entry.landRegions.length > 0 || entry.contourRegions.length > 0);
}

function cachedPreviewBoundsCoords(entries) {
  const coords = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const boundsRegions = Array.isArray(entry.landRegions) && entry.landRegions.length > 0
      ? entry.landRegions
      : entry.contourRegions;
    (Array.isArray(boundsRegions) ? boundsRegions : []).forEach((region) => {
      if (Array.isArray(region)) {
        region.forEach((coord) => coords.push(coord));
      }
    });
  });
  return coords;
}

function territoryCoordinateBounds(coords) {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let count = 0;

  (Array.isArray(coords) ? coords : []).forEach((coord) => {
    if (!isDrawableTerritoryCoordinate(coord)) return;
    const lat = Number(coord[0]);
    const lng = Number(coord[1]);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    count += 1;
  });

  return count > 0 ? {
    minLat, maxLat, minLng, maxLng, count,
  } : null;
}

function territoryBoundsSpanMeters(bounds) {
  if (!bounds) return 0;
  const minLat = Number(bounds.minLat);
  const maxLat = Number(bounds.maxLat);
  const minLng = Number(bounds.minLng);
  const maxLng = Number(bounds.maxLng);
  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) return 0;
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.max(0.08, Math.cos((midLat * Math.PI) / 180));
  const latMeters = Math.abs(maxLat - minLat) * METERS_PER_DEG_LAT;
  const lngMeters = Math.abs(maxLng - minLng) * METERS_PER_DEG_LAT * cosLat;
  return Math.max(latMeters, lngMeters);
}

function territoryBoundsCenter(bounds) {
  if (!bounds) return null;
  return {
    latitude: (Number(bounds.minLat) + Number(bounds.maxLat)) / 2,
    longitude: (Number(bounds.minLng) + Number(bounds.maxLng)) / 2,
  };
}

function territoryCenterDistanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const aLat = Number(a.latitude);
  const aLng = Number(a.longitude);
  const bLat = Number(b.latitude);
  const bLng = Number(b.longitude);
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const midLat = (aLat + bLat) / 2;
  const cosLat = Math.max(0.08, Math.cos((midLat * Math.PI) / 180));
  const latMeters = (aLat - bLat) * METERS_PER_DEG_LAT;
  const lngMeters = (aLng - bLng) * METERS_PER_DEG_LAT * cosLat;
  return Math.sqrt((latMeters * latMeters) + (lngMeters * lngMeters));
}

function territoryLeafletLatLngToCenter(latLng) {
  const latitude = Number(latLng?.lat);
  const longitude = Number(latLng?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function territoryMapViewportInfo(map) {
  try {
    const center = territoryLeafletLatLngToCenter(map?.getCenter?.());
    const bounds = map?.getBounds?.();
    if (!center || !bounds?.isValid?.()) return null;
    const corners = [
      territoryLeafletLatLngToCenter(bounds.getNorthEast?.()),
      territoryLeafletLatLngToCenter(bounds.getNorthWest?.()),
      territoryLeafletLatLngToCenter(bounds.getSouthEast?.()),
      territoryLeafletLatLngToCenter(bounds.getSouthWest?.()),
    ].filter(Boolean);
    const radiusMeters = corners.reduce((largest, corner) => (
      Math.max(largest, territoryCenterDistanceMeters(center, corner))
    ), 0);
    return {
      center,
      radiusMeters: Math.max(900, radiusMeters * 1.2),
      zoom: Number(map?.getZoom?.()),
    };
  } catch {
    return null;
  }
}

function territoryMapViewportKey(map) {
  const viewport = territoryMapViewportInfo(map);
  const zoom = Number(map?.getZoom?.());
  if (!viewport?.center || !Number.isFinite(zoom)) return '';
  return [
    Math.round(zoom * 10) / 10,
    Math.round(viewport.center.latitude * 10000) / 10000,
    Math.round(viewport.center.longitude * 10000) / 10000,
    Math.round(Number(viewport.radiusMeters) / 100),
  ].join(':');
}

function territoryBoundsDegreesArea(bounds) {
  if (!bounds) return 0;
  const latSpan = Math.max(0, Math.abs(Number(bounds.maxLat) - Number(bounds.minLat)));
  const lngSpan = Math.max(0, Math.abs(Number(bounds.maxLng) - Number(bounds.minLng)));
  return latSpan * lngSpan;
}

function territoryFitEntryInfo(entry) {
  const coords = cachedPreviewBoundsCoords([entry]).filter(isDrawableTerritoryCoordinate);
  const bounds = territoryCoordinateBounds(coords);
  const center = territoryBoundsCenter(bounds);
  if (!bounds || !center || coords.length <= 0) {
    return null;
  }

  const declaredArea = Number(entry?.areaSquareMeters);
  const areaScore = Number.isFinite(declaredArea) && declaredArea > 0
    ? Math.sqrt(declaredArea)
    : territoryBoundsDegreesArea(bounds) * 1000000;
  return {
    entry,
    coords,
    bounds,
    center,
    score: Math.max(1, areaScore) + coords.length,
  };
}

function territoryRegionInfo(region, index = 0) {
  const coords = (Array.isArray(region) ? region : []).filter(isDrawableTerritoryCoordinate);
  const bounds = territoryCoordinateBounds(coords);
  const center = territoryBoundsCenter(bounds);
  if (!bounds || !center || coords.length <= 0) {
    return null;
  }
  return {
    index,
    coords,
    bounds,
    center,
    score: territoryBoundsDegreesArea(bounds) * 1000000 + coords.length,
  };
}

function territoryTraceCoords(trace) {
  return routeTraceConcretePoints(trace).map((point) => [point.latitude, point.longitude]);
}

function territoryTraceRecencyScore(trace, index = 0) {
  const createdAtScore = Date.parse(String(trace?.createdAt || ''));
  if (Number.isFinite(createdAtScore)) {
    return createdAtScore;
  }
  const activityId = Number(trace?.activityId);
  if (Number.isFinite(activityId)) {
    return activityId;
  }
  return -index;
}

function territoryTraceFocusScore(traceInfo) {
  const spanMeters = territoryBoundsSpanMeters(traceInfo.bounds);
  return spanMeters * Math.max(1, traceInfo.coords.length);
}

function territoryRecentOwnerFocusCoords(entry) {
  const allCoords = cachedPreviewBoundsCoords([entry]).filter(isDrawableTerritoryCoordinate);
  const allBounds = territoryCoordinateBounds(allCoords);
  if (!allBounds || territoryBoundsSpanMeters(allBounds) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS) {
    return allCoords;
  }

  const sourceRegions = Array.isArray(entry?.landRegions) && entry.landRegions.length > 0
    ? entry.landRegions
    : entry?.contourRegions;
  const regionInfos = (Array.isArray(sourceRegions) ? sourceRegions : [])
    .map(territoryRegionInfo)
    .filter(Boolean);

  const traceInfos = (Array.isArray(entry?.routeTraces) ? entry.routeTraces : [])
    .map((trace, index) => ({
      trace,
      index,
      coords: territoryTraceCoords(trace),
      bounds: null,
      recency: territoryTraceRecencyScore(trace, index),
    }))
    .filter((traceInfo) => traceInfo.coords.length > 0)
    .map((traceInfo) => ({
      ...traceInfo,
      bounds: territoryCoordinateBounds(traceInfo.coords),
    }));
  const traceRecencies = traceInfos
    .map((traceInfo) => traceInfo.recency)
    .filter(Number.isFinite);
  let minTraceRecency = Number.POSITIVE_INFINITY;
  let maxTraceRecency = Number.NEGATIVE_INFINITY;
  traceRecencies.forEach((recency) => {
    minTraceRecency = Math.min(minTraceRecency, recency);
    maxTraceRecency = Math.max(maxTraceRecency, recency);
  });
  const hasDistinctTraceTimes = traceRecencies.length > 1
    && (maxTraceRecency - minTraceRecency) > 60_000;
  const recentTrace = traceInfos
    .sort((a, b) => (
      hasDistinctTraceTimes
        ? b.recency - a.recency || territoryTraceFocusScore(b) - territoryTraceFocusScore(a) || a.index - b.index
        : territoryTraceFocusScore(b) - territoryTraceFocusScore(a) || b.recency - a.recency || a.index - b.index
    ))[0];

  if (recentTrace) {
    const traceCenter = territoryBoundsCenter(territoryCoordinateBounds(recentTrace.coords));
    const localRegions = traceCenter
      ? regionInfos.filter((regionInfo) => (
        territoryCenterDistanceMeters(regionInfo.center, traceCenter) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS
      ))
      : [];
    const localCoords = [];
    localRegions.forEach((regionInfo) => {
      (Array.isArray(regionInfo.coords) ? regionInfo.coords : []).forEach((coord) => localCoords.push(coord));
    });
    return localCoords.length > 0 ? localCoords : recentTrace.coords;
  }

  const largestRegion = regionInfos.sort((a, b) => b.score - a.score || a.index - b.index)[0];
  return largestRegion?.coords?.length > 0 ? largestRegion.coords : allCoords;
}

function territoryOwnerFocusBoundsCoords(entries) {
  const coords = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    territoryRecentOwnerFocusCoords(entry).forEach((coord) => coords.push(coord));
  });
  return coords.length > 0 ? coords : cachedPreviewBoundsCoords(entries);
}

function territoryDefaultBoundsCoords(entries, allCoords) {
  const allBounds = territoryCoordinateBounds(allCoords);
  if (!allBounds || territoryBoundsSpanMeters(allBounds) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS) {
    return allCoords;
  }

  const entryInfos = (Array.isArray(entries) ? entries : [])
    .map(territoryFitEntryInfo)
    .filter(Boolean);
  if (entryInfos.length <= 0) {
    return allCoords;
  }

  let bestCluster = null;
  entryInfos.forEach((candidate) => {
    const localInfos = entryInfos.filter((entryInfo) => (
      territoryCenterDistanceMeters(entryInfo.center, candidate.center) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS
    ));
    const score = localInfos.reduce((total, entryInfo) => total + entryInfo.score, 0);
    if (!bestCluster || score > bestCluster.score) {
      bestCluster = { score, localInfos };
    }
  });

  const bestCoords = cachedPreviewBoundsCoords((bestCluster?.localInfos || []).map((entryInfo) => entryInfo.entry));
  return bestCoords.length > 0 ? bestCoords : allCoords;
}

function mergeTerritoryCoordinateBounds(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return {
    minLat: Math.min(Number(a.minLat), Number(b.minLat)),
    maxLat: Math.max(Number(a.maxLat), Number(b.maxLat)),
    minLng: Math.min(Number(a.minLng), Number(b.minLng)),
    maxLng: Math.max(Number(a.maxLng), Number(b.maxLng)),
    count: (Number(a.count) || 0) + (Number(b.count) || 0),
  };
}

function territoryColorSourceCoords(source) {
  const boundsRegions = Array.isArray(source?.landRegions) && source.landRegions.length > 0
    ? source.landRegions
    : source?.contourRegions;
  if (Array.isArray(boundsRegions) && boundsRegions.length > 0) {
    return cachedPreviewBoundsCoords([source]).filter(isDrawableTerritoryCoordinate);
  }
  if (Array.isArray(source?.coordinates)) {
    return source.coordinates.filter(isDrawableTerritoryCoordinate);
  }
  if (Array.isArray(source?.cells)) {
    return source.cells
      .map((cell) => [Number(cell?.latitude), Number(cell?.longitude)])
      .filter(isDrawableTerritoryCoordinate);
  }
  return [];
}

function territoryColorSourceBounds(source) {
  if (source?.bounds) {
    return source.bounds;
  }
  return territoryCoordinateBounds(territoryColorSourceCoords(source));
}

function territoryBoundsDistanceMeters(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }
  const latGap = Math.max(0, Math.max(Number(a.minLat), Number(b.minLat)) - Math.min(Number(a.maxLat), Number(b.maxLat)));
  const lngGap = Math.max(0, Math.max(Number(a.minLng), Number(b.minLng)) - Math.min(Number(a.maxLng), Number(b.maxLng)));
  const midLat = (
    Number(a.minLat) + Number(a.maxLat) + Number(b.minLat) + Number(b.maxLat)
  ) / 4;
  const cosLat = Math.max(0.08, Math.cos((midLat * Math.PI) / 180));
  const latMeters = latGap * METERS_PER_DEG_LAT;
  const lngMeters = lngGap * METERS_PER_DEG_LAT * cosLat;
  return Math.sqrt((latMeters * latMeters) + (lngMeters * lngMeters));
}

function territoryOwnerBoundsAreNear(a, b) {
  return territoryBoundsDistanceMeters(a, b) <= TERRITORY_OWNER_COLOR_NEAR_METERS;
}

function territoryStringHash(value) {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function territoryHexToRgb(color) {
  const normalized = safeColor(color, '').replace('#', '');
  if (normalized.length !== 6) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function territoryRgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation = delta / (1 - Math.abs((2 * lightness) - 1));
  let hue = 0;
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * (((blue - red) / delta) + 2);
  } else {
    hue = 60 * (((red - green) / delta) + 4);
  }
  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation,
    lightness,
  };
}

function territoryColorSeparation(a, b) {
  const rgbA = territoryHexToRgb(a);
  const rgbB = territoryHexToRgb(b);
  if (!rgbA || !rgbB) {
    return 0;
  }
  const hslA = territoryRgbToHsl(rgbA);
  const hslB = territoryRgbToHsl(rgbB);
  const hueDelta = Math.abs(hslA.hue - hslB.hue);
  const hueDistance = Math.min(hueDelta, 360 - hueDelta);
  const saturationDistance = Math.abs(hslA.saturation - hslB.saturation) * 42;
  const lightnessDistance = Math.abs(hslA.lightness - hslB.lightness) * 82;
  return hueDistance + saturationDistance + lightnessDistance;
}

function territoryColorCandidateList(ownerKey, originalColor) {
  const colors = [];
  const seen = new Set();
  const addColor = (color) => {
    const safe = safeColor(color, '');
    const key = safe.toLowerCase();
    if (!safe || seen.has(key)) return;
    seen.add(key);
    colors.push(safe);
  };

  addColor(originalColor);
  const shift = territoryStringHash(ownerKey) % TERRITORY_OWNER_COLOR_PALETTE.length;
  for (let index = 0; index < TERRITORY_OWNER_COLOR_PALETTE.length; index += 1) {
    addColor(TERRITORY_OWNER_COLOR_PALETTE[(index + shift) % TERRITORY_OWNER_COLOR_PALETTE.length]);
  }
  return colors;
}

function territoryMinColorSeparation(color, neighbors) {
  if (!neighbors.length) {
    return Number.POSITIVE_INFINITY;
  }
  return neighbors.reduce((lowest, neighbor) => (
    Math.min(lowest, territoryColorSeparation(color, neighbor.assignedColor))
  ), Number.POSITIVE_INFINITY);
}

function territoryChooseLocalOwnerColor(owner, neighbors) {
  const originalColor = safeColor(
    owner.originalColor,
    owner.active ? '#f07561' : TERRITORY_OWNER_COLOR_PALETTE[territoryStringHash(owner.ownerKey) % TERRITORY_OWNER_COLOR_PALETTE.length],
  );
  if (owner.active) {
    return originalColor;
  }

  const originalSeparation = territoryMinColorSeparation(originalColor, neighbors);
  if (originalSeparation >= TERRITORY_OWNER_COLOR_MIN_SEPARATION) {
    return originalColor;
  }

  return territoryColorCandidateList(owner.ownerKey, originalColor).reduce((best, color) => {
    const minSeparation = territoryMinColorSeparation(color, neighbors);
    const exactNeighborPenalty = neighbors.some((neighbor) => (
      safeColor(neighbor.assignedColor, '').toLowerCase() === safeColor(color, '').toLowerCase()
    )) ? -1000 : 0;
    const originalBonus = safeColor(color, '').toLowerCase() === originalColor.toLowerCase() ? 0.5 : 0;
    const score = minSeparation + exactNeighborPenalty + originalBonus;
    return score > best.score ? { color, score } : best;
  }, { color: originalColor, score: originalSeparation }).color;
}

function territoryAssignLocalOwnerColors(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const owners = new Map();

  safeEntries.forEach((entry, index) => {
    const ownerKey = String(entry?.ownerKey || polygonOwnerMergeKey(entry, index));
    const active = Boolean(entry?.active);
    const fallbackColor = active
      ? '#f07561'
      : TERRITORY_OWNER_COLOR_PALETTE[territoryStringHash(ownerKey) % TERRITORY_OWNER_COLOR_PALETTE.length];
    const originalColor = safeColor(entry?.color || entry?.borderColor, fallbackColor);
    let owner = owners.get(ownerKey);
    if (!owner) {
      owner = {
        ownerKey,
        active,
        originalColor,
        areaSquareMeters: 0,
        firstIndex: index,
        bounds: null,
        assignedColor: originalColor,
      };
      owners.set(ownerKey, owner);
    }

    owner.active = Boolean(owner.active || active);
    owner.originalColor = owner.active
      ? safeColor(originalColor, owner.originalColor)
      : safeColor(owner.originalColor || originalColor, originalColor);
    owner.areaSquareMeters += Number(entry?.areaSquareMeters) || 0;
    owner.bounds = mergeTerritoryCoordinateBounds(owner.bounds, territoryColorSourceBounds(entry));
  });

  const assignedOwners = [];
  Array.from(owners.values())
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (b.areaSquareMeters !== a.areaSquareMeters) return b.areaSquareMeters - a.areaSquareMeters;
      return a.firstIndex - b.firstIndex;
    })
    .forEach((owner) => {
      const neighbors = assignedOwners.filter((candidate) => (
        territoryOwnerBoundsAreNear(owner.bounds, candidate.bounds)
      ));
      owner.assignedColor = territoryChooseLocalOwnerColor(owner, neighbors);
      assignedOwners.push(owner);
    });

  return safeEntries.map((entry, index) => {
    const ownerKey = String(entry?.ownerKey || polygonOwnerMergeKey(entry, index));
    const owner = owners.get(ownerKey);
    const color = safeColor(owner?.assignedColor || entry?.color || entry?.borderColor);
    return {
      ...entry,
      ownerKey,
      color,
      borderColor: color,
    };
  });
}

function isDrawableTerritoryCoordinate(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  return Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1]));
}

function isDrawableTerritoryRegion(region) {
  return Array.isArray(region)
    && region.length >= 4
    && region.every(isDrawableTerritoryCoordinate);
}

function isDrawableTerritoryRenderEntry(entry) {
  const landRegions = Array.isArray(entry?.landRegions) ? entry.landRegions : [];
  const contourRegions = Array.isArray(entry?.contourRegions) ? entry.contourRegions : [];
  return landRegions.some(isDrawableTerritoryRegion) || contourRegions.some(isDrawableTerritoryRegion);
}

function hasDrawableTerritoryRenderData(data) {
  return Boolean(
    data
    && Array.isArray(data.allCoords)
    && data.allCoords.some(isDrawableTerritoryCoordinate)
    && Array.isArray(data.contourRenderEntries)
    && data.contourRenderEntries.some(isDrawableTerritoryRenderEntry),
  );
}

function territoryThemeRegionCount(source) {
  const sourceCount = Number(source?.sourcePolygonCount);
  if (Number.isFinite(sourceCount) && sourceCount > 0) {
    return sourceCount;
  }

  const landRegionCount = Array.isArray(source?.landRegions) ? source.landRegions.length : 0;
  const contourRegionCount = Array.isArray(source?.contourRegions) ? source.contourRegions.length : 0;
  const cellCount = Array.isArray(source?.cells) ? source.cells.length : 0;
  return Math.max(1, landRegionCount, contourRegionCount, cellCount > 0 ? 1 : 0);
}

function territoryThemeSources(polygons, cachedRenderSnapshot) {
  const polygonSources = (Array.isArray(polygons) ? polygons : [])
    .filter(hasCellMaskPolygon);
  if (polygonSources.length) {
    return polygonSources;
  }

  const cachedEntries = cachedRenderSnapshot?.data?.contourRenderEntries;
  const previewEntries = cachedRenderSnapshot?.data?.previewContourRenderEntries;
  if (!hasDrawableTerritoryRenderData(cachedRenderSnapshot?.data)) {
    return [];
  }
  return Array.isArray(cachedEntries) && cachedEntries.length > 0
    ? cachedEntries
    : (Array.isArray(previewEntries) ? previewEntries : []);
}

function territoryOwnerThemes(polygons, cachedRenderSnapshot, profile, lang) {
  const themes = new Map();
  territoryThemeSources(polygons, cachedRenderSnapshot).forEach((source, index) => {
    const ownerKey = String(source?.ownerKey || polygonOwnerMergeKey(source, index));
    const active = Boolean(source?.active);
    const color = safeColor(source?.color || source?.borderColor, active ? '#f07561' : '#82ffd8');
    const ownerName = String(source?.ownerName || '').trim();
    let theme = themes.get(ownerKey);

    if (!theme) {
      theme = {
        ownerKey,
        ownerName,
        ownerId: source?.ownerId ?? null,
        active,
        color,
        areaSquareMeters: 0,
        hasKnownArea: false,
        regionCount: 0,
        bounds: null,
      };
      themes.set(ownerKey, theme);
    }

    theme.active = Boolean(theme.active || active);
    theme.color = theme.active ? safeColor(color, theme.color) : safeColor(theme.color || color, color);
    theme.ownerName = theme.ownerName || ownerName;
    theme.ownerId = theme.ownerId ?? source?.ownerId ?? null;
    theme.regionCount += territoryThemeRegionCount(source);
    theme.bounds = mergeTerritoryCoordinateBounds(theme.bounds, territoryColorSourceBounds(source));

    const areaSquareMeters = Number(source?.areaSquareMeters);
    if (Number.isFinite(areaSquareMeters) && areaSquareMeters > 0) {
      theme.areaSquareMeters += areaSquareMeters;
      theme.hasKnownArea = true;
    }
  });

  return territoryAssignLocalOwnerColors(Array.from(themes.values()))
    .map((theme) => {
      const activeOwnerName = normalizeOwnerName(theme.ownerName);
      const label = (theme.active && activeOwnerName === 'you')
        ? mapChromeCopy(lang, 'you')
        : (
          theme.ownerName || (theme.active
            ? runnerDisplayName(null, profile, mapChromeCopy(lang, 'you'))
            : mapChromeCopy(lang, 'opponent'))
        );
      const regionCount = Math.max(1, Math.round(theme.regionCount));
      return {
        ...theme,
        label,
        statusLabel: theme.active ? mapChromeCopy(lang, 'activeTheme') : mapChromeCopy(lang, 'rivalTheme'),
        ownerIdLabel: theme.ownerId !== null && theme.ownerId !== undefined ? String(theme.ownerId) : '',
        areaLabel: theme.hasKnownArea
          ? formatTerritoryArea(theme.areaSquareMeters / 1_000_000)
          : mapChromeCopy(lang, 'themeAreaUnknown'),
        regionLabel: `${formatSampleCount(regionCount)} ${mapChromeCopy(lang, regionCount === 1 ? 'themeRegion' : 'themeRegions')}`,
      };
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.hasKnownArea !== b.hasKnownArea) return a.hasKnownArea ? -1 : 1;
      if (b.areaSquareMeters !== a.areaSquareMeters) return b.areaSquareMeters - a.areaSquareMeters;
      if (b.regionCount !== a.regionCount) return b.regionCount - a.regionCount;
      return a.label.localeCompare(b.label);
    });
}

const TERRITORY_ALL_THEME_FALLBACK_COLORS = ['#f07561', '#5b9cf5', '#a855f7', '#82ffd8'];

function territorySignificantThemeColors(themes) {
  const colors = [];
  const seen = new Set();
  (Array.isArray(themes) ? themes : []).forEach((theme) => {
    const color = safeColor(theme?.color, '');
    const key = color.toLowerCase();
    if (!color || seen.has(key)) {
      return;
    }
    seen.add(key);
    colors.push(color);
  });
  return colors.length > 0 ? colors.slice(0, 5) : TERRITORY_ALL_THEME_FALLBACK_COLORS;
}

function territoryAllThemeStyle(themes) {
  const significantColors = territorySignificantThemeColors(themes);
  const displayColors = [...significantColors];
  while (displayColors.length < 4) {
    displayColors.push(TERRITORY_ALL_THEME_FALLBACK_COLORS[displayColors.length % TERRITORY_ALL_THEME_FALLBACK_COLORS.length]);
  }

  const bandStops = displayColors.map((color, index) => {
    const start = Math.round((index / displayColors.length) * 100);
    const end = Math.round(((index + 1) / displayColors.length) * 100);
    return `${color} ${start}% ${end}%`;
  }).join(', ');

  return {
    '--terr-theme-color': displayColors[0],
    '--terr-theme-all-gradient': `conic-gradient(from 35deg, ${displayColors.join(', ')}, ${displayColors[0]})`,
    '--terr-theme-all-band': `linear-gradient(90deg, ${bandStops})`,
  };
}

function TerritoryScopeSwitch({
  themes,
  scope,
  activeTheme,
  onScopeChange,
  copy,
}) {
  const ownAvailable = Boolean(activeTheme?.ownerKey);
  const ownSelected = scope === 'own' && ownAvailable;
  const globalSelected = !ownSelected;

  return (
    <aside className="terr-scope-switcher" aria-label={copy('territoryScope')}>
      <button
        type="button"
        className={`terr-scope-button terr-scope-button--own${ownSelected ? ' is-selected' : ''}`}
        style={{ '--terr-theme-color': safeColor(activeTheme?.color, '#f07561') }}
        aria-pressed={ownSelected}
        disabled={!ownAvailable}
        onClick={() => onScopeChange('own')}
      >
        <span className="terr-scope-swatch" aria-hidden="true" />
        <span className="terr-scope-copy">
          <strong>{copy('ownTerritory')}</strong>
          <small>{copy('ownTerritoryHint')}</small>
        </span>
      </button>
      <button
        type="button"
        className={`terr-scope-button terr-scope-button--global${globalSelected ? ' is-selected' : ''}`}
        style={territoryAllThemeStyle(themes)}
        aria-pressed={globalSelected}
        onClick={() => onScopeChange('global')}
      >
        <span className="terr-scope-swatch terr-scope-swatch--global" aria-hidden="true" />
        <span className="terr-scope-copy">
          <strong>{copy('globalTerritory')}</strong>
          <small>{copy('globalTerritoryHint')}</small>
        </span>
      </button>
    </aside>
  );
}

function TerritoryOwnerInfoPanel({
  owner,
  copy,
  onClose,
}) {
  if (!owner) {
    return null;
  }

  return (
    <aside
      className={`terr-owner-inspector${owner.active ? ' is-active-owner' : ''}`}
      style={{ '--terr-owner-color': owner.color }}
      aria-label={`${copy('ownerInfoTitle')}: ${owner.label}`}
      aria-live="polite"
    >
      <div className="terr-owner-inspector-head">
        <span className="terr-owner-inspector-swatch" aria-hidden="true" />
        <span className="terr-owner-inspector-title">
          <small>{copy('ownerInfoTitle')}</small>
          <strong>{owner.label}</strong>
        </span>
        <button
          type="button"
          className="terr-owner-inspector-close"
          onClick={onClose}
          aria-label={copy('closeOwnerInfo')}
        >
          <AppIcon name="close" />
        </button>
      </div>

      <dl className="terr-owner-inspector-grid">
        <div>
          <dt>{copy('username')}</dt>
          <dd>{owner.label}</dd>
        </div>
        <div>
          <dt>{copy('status')}</dt>
          <dd>{owner.statusLabel}</dd>
        </div>
        <div>
          <dt>{copy('ownedArea')}</dt>
          <dd>{owner.areaLabel}</dd>
        </div>
        <div>
          <dt>{copy('mappedRegions')}</dt>
          <dd>{owner.regionLabel}</dd>
        </div>
        {owner.ownerIdLabel ? (
          <div>
            <dt>{copy('ownerId')}</dt>
            <dd>{owner.ownerIdLabel}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

function TerritoryMap({
  territory,
  polygons,
  polygonSignature,
  cachedRenderSnapshot,
  showPolygons,
  recenterSignal,
  selectedOwnerKey,
  focusOwnerKey,
  focusSignal,
  onTerritoryOwnerClick,
  lang,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const lastFittedConcreteBoundsKeyRef = useRef(null);
  const lastFittedConcreteIntentKeyRef = useRef(null);
  const lastFittedConcreteActionKeyRef = useRef(null);
  const lastFittedConcreteSourceKeyRef = useRef(null);
  const viewportMovedAfterFitRef = useRef(false);
  const programmaticFitInProgressRef = useRef(false);
  const ownerClickHandlerRef = useRef(onTerritoryOwnerClick);
  const processedRenderCacheRef = useRef(null);
  const lastRenderedTerritoryOwnerSetKeyRef = useRef('');
  const lastRenderedTerritoryGeometryKeyRef = useRef('');
  const [mapReady, setMapReady] = useState(false);
  const [mapViewportKey, setMapViewportKey] = useState('');
  const territoryCenter = isValidMapCenter(territory?.center) ? territory.center : null;

  useEffect(() => {
    ownerClickHandlerRef.current = onTerritoryOwnerClick;
  }, [onTerritoryOwnerClick]);

  useEffect(() => {
    let cancelled = false;
    let mountedMapContainer = null;
    let updateMountedMapViewportKey = null;

    async function mountMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      if (!territoryCenter) return;
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;

      const center = territoryCenter;
      const latitude = Number(center.latitude);
      const longitude = Number(center.longitude);
      const mapContainer = mapRef.current;
      mountedMapContainer = mapContainer;
      const map = L.map(mapContainer, {
        center: [latitude, longitude],
        zoom: territoryInitialZoom(center),
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      });
      map.setView([latitude, longitude], territoryInitialZoom(center), { animate: false });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        className: 'territory-real-world-tile',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      updateMountedMapViewportKey = () => {
        if (!cancelled) {
          if (programmaticFitInProgressRef.current) {
            programmaticFitInProgressRef.current = false;
          } else {
            viewportMovedAfterFitRef.current = true;
          }
          setMapViewportKey(territoryMapViewportKey(map));
        }
      };
      map.on('moveend zoomend', updateMountedMapViewportKey);
      updateMountedMapViewportKey();
      Object.defineProperty(mapContainer, '__hermesTerritoryMap', {
        configurable: true,
        enumerable: false,
        value: map,
      });
      setMapReady(true);
    }

    mountMap();
    return () => {
      cancelled = true;
      setMapReady(false);
      const mapContainer = mountedMapContainer;
      if (mapContainer && Object.prototype.hasOwnProperty.call(mapContainer, '__hermesTerritoryMap')) {
        delete mapContainer.__hermesTerritoryMap;
      }
      if (mapInstanceRef.current) {
        if (updateMountedMapViewportKey) {
          mapInstanceRef.current.off('moveend zoomend', updateMountedMapViewportKey);
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      lastFittedConcreteBoundsKeyRef.current = null;
      lastFittedConcreteIntentKeyRef.current = null;
      lastFittedConcreteActionKeyRef.current = null;
      lastFittedConcreteSourceKeyRef.current = null;
      viewportMovedAfterFitRef.current = false;
      programmaticFitInProgressRef.current = false;
      lastRenderedTerritoryOwnerSetKeyRef.current = '';
      lastRenderedTerritoryGeometryKeyRef.current = '';
      setMapViewportKey('');
    };
  }, [territoryCenter?.latitude, territoryCenter?.longitude, territoryCenter?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map || !territoryCenter || showPolygons || polygons.length > 0) return;
    const center = territoryCenter;
    const latitude = Number(center.latitude);
    const longitude = Number(center.longitude);
    map.setView([latitude, longitude], territoryInitialZoom(center), { animate: false });
  }, [mapReady, polygons.length, showPolygons, territoryCenter]);

  // Paint closed-loop polygons from /api/territory/polygons
  useEffect(() => {
    let cancelled = false;

    async function paintPolygons() {
      const map = mapInstanceRef.current;
      if (!mapReady || !map) return;
      const L = await loadLeaflet();
      if (cancelled) return;

      const selectedOwnerKeyValue = String(selectedOwnerKey || '');
      const focusOwnerKeyValue = String(focusOwnerKey || '');
      const shouldUseGlobalRenderCache = !selectedOwnerKeyValue;
      const hasRawPolygons = showPolygons && Array.isArray(polygons) && polygons.length > 0;
      const shouldUseProcessedRenderCache = !hasRawPolygons || (shouldUseGlobalRenderCache && Boolean(polygonSignature));
      const memoryRenderSnapshot = processedRenderCacheRef.current;
      const memoryRenderData = shouldUseProcessedRenderCache
        && memoryRenderSnapshot?.signature
        && polygonSignature
        && memoryRenderSnapshot.signature === polygonSignature
        && hasDrawableTerritoryRenderData(memoryRenderSnapshot?.data)
        ? memoryRenderSnapshot.data
        : null;
      const snapshotData = memoryRenderData
        || (shouldUseProcessedRenderCache
        && cachedRenderSnapshot?.signature
        && (!polygonSignature || cachedRenderSnapshot.signature === polygonSignature)
        && hasDrawableTerritoryRenderData(cachedRenderSnapshot?.data)
        ? cachedRenderSnapshot.data
        : null);

      if (!hasRawPolygons && !snapshotData) {
        if (polygonLayerRef.current) {
          polygonLayerRef.current.remove();
          polygonLayerRef.current = null;
        }
        lastRenderedTerritoryOwnerSetKeyRef.current = '';
        lastRenderedTerritoryGeometryKeyRef.current = '';
        lastFittedConcreteBoundsKeyRef.current = null;
        return;
      }

      const strokeColor = getCoralStroke();
      const renderViewport = territoryMapViewportInfo(map);
      const shouldUseViewportRegionPriority = Boolean(selectedOwnerKeyValue);

      let allCoords = [];
      let contourRenderEntries = [];
      const renderMode = cachedRenderSnapshot?.mode === 'preview' ? 'preview' : 'full';
      const cachedRender = snapshotData
        ? { data: snapshotData }
        : (shouldUseProcessedRenderCache && (shouldUseGlobalRenderCache || selectedOwnerKeyValue) && polygonSignature
            ? await readCachedTerritoryRender(polygonSignature)
            : null);
      if (
        cachedRender?.data
        && hasDrawableTerritoryRenderData(cachedRender.data)
      ) {
        if (polygonSignature) {
          processedRenderCacheRef.current = {
            signature: polygonSignature,
            data: cachedRender.data,
          };
        }
        const fullCachedEntries = Array.isArray(cachedRender.data.contourRenderEntries)
          ? cachedRender.data.contourRenderEntries
          : [];
        const previewCachedEntries = renderMode === 'preview'
          && Array.isArray(cachedRender.data.previewContourRenderEntries)
          && cachedRender.data.previewContourRenderEntries.length > 0
          ? cachedRender.data.previewContourRenderEntries
          : fullCachedEntries;
        const focusCachedOwnerKey = selectedOwnerKeyValue || focusOwnerKeyValue;
        const focusedFullCachedEntries = focusCachedOwnerKey
          ? fullCachedEntries.filter((entry) => String(entry?.ownerKey || '') === focusCachedOwnerKey)
          : [];
        const cachedEntries = selectedOwnerKeyValue
          ? focusedFullCachedEntries
          : (renderMode === 'preview' && focusedFullCachedEntries.length > 0
              ? [
                  ...previewCachedEntries.filter((entry) => String(entry?.ownerKey || '') !== focusCachedOwnerKey),
                  ...focusedFullCachedEntries,
                ]
              : previewCachedEntries);
        contourRenderEntries = cachedEntries;
        const focusedCachedEntries = focusCachedOwnerKey
          ? cachedEntries.filter((entry) => String(entry?.ownerKey || '') === focusCachedOwnerKey)
          : [];
        allCoords = focusedCachedEntries.length > 0
          ? territoryOwnerFocusBoundsCoords(focusedCachedEntries)
          : (renderMode === 'preview' ? cachedPreviewBoundsCoords(cachedEntries) : cachedRender.data.allCoords);
      } else {
        const ownerPolygons = renderCellMaskPolygonsBySource(polygons);
        const renderPolygons = selectedOwnerKeyValue
          ? ownerPolygons.filter((poly, index) => String(poly?.ownerKey || polygonOwnerMergeKey(poly, index)) === selectedOwnerKeyValue)
          : initialGlobalTerritoryRenderPolygons(ownerPolygons);
        const renderGrid = territoryMaskRenderGrid(renderPolygons);
        const sourceRenderEntries = resolveMaskTileOwnership(renderPolygons, renderGrid).slice().reverse();
        const renderEntries = mergeResolvedMaskEntriesByOwner(sourceRenderEntries, renderGrid);
        const globalOccupied = new Set();
        renderEntries.forEach(({ tiles }) => {
          (Array.isArray(tiles) ? tiles : []).forEach((tile) => {
            globalOccupied.add(maskTileClaimKey(tile));
          });
        });
        renderEntries.forEach(({ poly, tiles }, renderIndex) => {
          const active = Boolean(poly.active);
          const color = safeColor(poly.color, strokeColor);
          const ownerKey = String(poly.ownerKey || polygonOwnerMergeKey(poly, renderIndex));

          if (!hasCellMaskPolygon(poly)) return;

          const sourceCellMeters = Number(renderGrid.sourceCellMeters);
          const tileMeters = Number(tiles?.[0]?.tileMeters);
          const cosLat = Number(tiles?.[0]?.cosLat);
          const routeInteriorDistanceMeters = sourceCellMeters * LAND_MASK_ROUTE_INTERIOR_DISTANCE_RATIO;
          const routeSegments = routeTraceSegments(poly, renderGrid, {
            maxSegmentMeters: routeTraceConcreteMaxSegmentMeters(renderGrid),
          });
          const routeSegmentIndex = routeSegmentSpatialIndex(routeSegments, routeInteriorDistanceMeters, tileMeters);
          const componentRecords = visibleMaskConnectedComponents(maskTileConnectedComponents(tiles), { preserveAll: active })
            .map((component) => {
              const regions = maskBoundaryLoops(component, { globalOccupied }).filter((loop) => loop.length >= 4);
              if (!regions.length) return null;

              const componentBounds = maskComponentBounds(component);
              const componentDensity = maskComponentDensity(component, componentBounds);
              const componentAreaSquareMeters = Number.isFinite(tileMeters) && tileMeters > 0
                ? component.length * tileMeters * tileMeters
                : 0;
              const largeLandmass = (
                componentDensity >= LAND_MASK_SOLID_COMPONENT_MIN_DENSITY
                && (
                  componentAreaSquareMeters >= LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_AREA_SQUARE_METERS
                  || component.length >= LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_TILES
                )
              );
              const routeCorridor = !largeLandmass
                && routeSegments.length > 0
                && Number.isFinite(routeInteriorDistanceMeters)
                && routeInteriorDistanceMeters > 0
                && component.some((tile) => tileIsNearRouteSegments(
                  tile,
                  routeSegmentCandidatesForTile(tile, routeSegments, routeSegmentIndex),
                  routeInteriorDistanceMeters,
                  tileMeters,
                ));

              return {
                regions,
                options: { largeLandmass, routeCorridor, preserveAll: active },
              };
            })
            .filter(Boolean);
          const exactRegionGroups = componentRecords.map((record) => record.regions);
          const exactRegions = exactRegionGroups.flat();
          const useLocalViewportRegionBudget = shouldUseViewportRegionPriority
            && viewportMovedAfterFitRef.current
            && lastFittedConcreteBoundsKeyRef.current !== null
            && Number(renderViewport?.zoom) > 12;
          const activeRegionBudget = LAND_MASK_GLOBAL_ACTIVE_VISIBLE_REGIONS_PER_OWNER;
          const standardRegionBudget = useLocalViewportRegionBudget
            ? LAND_MASK_MAX_LOCAL_VIEW_REGIONS_PER_OWNER
            : LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER;
          const concreteLandRegionBudget = active ? activeRegionBudget : standardRegionBudget;
          const regionOptions = {
            tileMeters,
            sourceCellMeters,
            cosLat,
            globalOccupied,
            preserveAll: active,
            viewport: shouldUseViewportRegionPriority ? renderViewport : null,
            maxGroups: concreteLandRegionBudget,
          };
          const concreteLandRegionGroups = limitMaskRegionGroupsByLoopBudget(
            visibleMaskLandRegionGroups(componentRecords, regionOptions),
            concreteLandRegionBudget,
          );
          const concreteLandRegions = visibleMaskStrokeRegions(concreteLandRegionGroups.flat(), { cosLat });
          const concreteContourRegions = concreteLandRegions;
          exactRegions.forEach((region) => {
            region.forEach((coord) => allCoords.push(coord));
          });
          concreteLandRegions.forEach((region) => {
            region.forEach((coord) => allCoords.push(coord));
          });
          concreteContourRegions.forEach((region) => {
            region.forEach((coord) => allCoords.push(coord));
          });

          contourRenderEntries.push({
            ownerKey,
            active,
            color,
            borderColor: color,
            ownerName: String(poly.ownerName || '').trim(),
            ownerId: poly.ownerId ?? null,
            areaSquareMeters: Number(poly?.areaSquareMeters) || 0,
            activityId: poly.activityId ?? null,
            createdAt: poly.createdAt ?? null,
            routeTraces: Array.isArray(poly.routeTraces) ? poly.routeTraces : [],
            landRegions: concreteLandRegions,
            landRegionGroups: concreteLandRegionGroups,
            contourRegions: concreteContourRegions,
          });
        });
        const fullContourRenderEntries = contourRenderEntries;
        const fullCoords = allCoords;
        const previewContourRenderEntries = cachedPreviewRenderEntries(fullContourRenderEntries);
        const scopedRenderCoversAllOwners = renderPolygons.length === ownerPolygons.length;
        if ((shouldUseGlobalRenderCache || scopedRenderCoversAllOwners) && polygonSignature && fullContourRenderEntries.length > 0) {
          const renderData = {
            allCoords: fullCoords,
            contourRenderEntries: fullContourRenderEntries,
            previewContourRenderEntries,
          };
          processedRenderCacheRef.current = {
            signature: polygonSignature,
            data: renderData,
          };
          writeCachedTerritoryRender(polygonSignature, renderData);
        }
        contourRenderEntries = fullContourRenderEntries;
        allCoords = fullCoords;
      }

      contourRenderEntries = territoryAssignLocalOwnerColors(contourRenderEntries.map((entry, index) => ({
        ...entry,
        ownerKey: String(entry?.ownerKey || polygonOwnerMergeKey(entry, index)),
      })));
      contourRenderEntries = interactiveDisplayRenderEntries(contourRenderEntries);

      const targetOwnerSetKey = territoryRenderOwnerSetKey(contourRenderEntries);
      const stableViewportGeometryKey = shouldUseGlobalRenderCache && polygonSignature
        ? 'global-stable'
        : (mapViewportKey || 'initial');
      const geometryKey = [
        polygonSignature || 'no-signature',
        hasRawPolygons ? 'raw' : 'cached',
        renderMode,
        stableViewportGeometryKey,
        recenterSignal,
        lang || 'en',
      ].join('|');
      if (
        polygonLayerRef.current
        && targetOwnerSetKey
        && targetOwnerSetKey === lastRenderedTerritoryOwnerSetKeyRef.current
        && geometryKey === lastRenderedTerritoryGeometryKeyRef.current
      ) {
        applyTerritoryOwnerFocusClasses(polygonLayerRef.current, selectedOwnerKeyValue);
        return;
      }

      const previousLayer = polygonLayerRef.current;
      const layer = L.layerGroup().addTo(map);
      const renderers = territoryLayerRenderers(L, map);

      function ownerFocusClass(ownerKey, baseClassName) {
        return territoryOwnerFocusClassName(ownerKey, selectedOwnerKeyValue, baseClassName);
      }

      function inspectOwnerFromPath(event, { ownerKey }) {
        if (!ownerKey) return;
        L.DomEvent.stopPropagation(event);
        L.DomEvent.preventDefault(event);
        ownerClickHandlerRef.current?.(ownerKey);
      }

      function markTerritoryPathOwner(path, { active, ownerName, ownerId, ownerKey }) {
        const mapLang = lang || 'en';
        const ownerLabel = ownerName || (active ? mapChromeCopy(mapLang, 'you') : mapChromeCopy(mapLang, 'opponent'));
        const mark = () => {
          const element = path?.getElement?.();
          if (!element) return;
          element.dataset.hermesOwnerActive = active ? 'true' : 'false';
          if (ownerKey) element.dataset.hermesOwnerKey = ownerKey;
          if (ownerName) element.dataset.hermesOwnerName = ownerName;
          if (ownerId !== null && ownerId !== undefined) {
            element.dataset.hermesOwnerId = String(ownerId);
          }
          element.setAttribute('role', 'button');
          element.setAttribute('tabindex', '0');
          element.setAttribute('aria-label', `${mapChromeCopy(mapLang, 'clickTerritoryOwner')} ${ownerLabel}`);
          if (!element.__hermesTerritoryOwnerKeydownBound) {
            element.__hermesTerritoryOwnerKeydownBound = true;
            element.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                inspectOwnerFromPath(event, { ownerKey });
              }
            });
          }
        };
        path.on?.('click', (event) => inspectOwnerFromPath(event, { ownerKey }));
        path.on?.('add', mark);
        mark();
      }

      function paintLandRegions(entries, renderer) {
        entries.forEach(({ active, color, ownerName, ownerId, ownerKey, landRegions, landRegionGroups }) => {
          const drawableLandRegions = (Array.isArray(landRegions) ? landRegions : [])
            .filter((region) => Array.isArray(region) && region.length >= 4);
          const drawableLandRegionGroups = (Array.isArray(landRegionGroups) ? landRegionGroups : [])
            .map((regions) => (Array.isArray(regions) ? regions : [])
              .filter((region) => Array.isArray(region) && region.length >= 4))
            .filter((regions) => regions.length > 0);
          const landLatLngs = drawableLandRegionGroups.length > 0
            ? drawableLandRegionGroups
            : drawableLandRegions.map((region) => [region]);
          if (!landLatLngs.length) return;

          const concreteLand = L.polygon(landLatLngs, {
            color,
            renderer,
            weight: LAND_MASK_CONCRETE_LAND_EDGE_WEIGHT,
            opacity: active
              ? LAND_MASK_CONCRETE_LAND_EDGE_OPACITY.active
              : LAND_MASK_CONCRETE_LAND_EDGE_OPACITY.rival,
            stroke: false,
            fillColor: color,
            fillOpacity: active ? LAND_MASK_CONCRETE_LAND_OPACITY.active : LAND_MASK_CONCRETE_LAND_OPACITY.rival,
            fillRule: 'nonzero',
            interactive: true,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 0,
            className: `terr-land-mask-concrete-land${active ? ' terr-land-mask-concrete-land--active' : ' terr-land-mask-concrete-land--rival'}${ownerFocusClass(ownerKey, 'terr-land-mask-concrete-land')}`,
          }).addTo(layer);
          markTerritoryPathOwner(concreteLand, { active, ownerName, ownerId, ownerKey });
        });
      }

      function paintContourRegions(entries, renderer) {
        entries.forEach(({ active, borderColor, ownerName, ownerId, ownerKey, contourRegions }) => {
          const drawableContourRegions = (Array.isArray(contourRegions) ? contourRegions : [])
            .filter((region) => Array.isArray(region) && region.length >= 4);
          if (!drawableContourRegions.length) return;

          const contour = L.polygon(drawableContourRegions.map((region) => [region]), {
            color: borderColor,
            renderer,
            weight: active ? LAND_MASK_CONTOUR_WEIGHT.active : LAND_MASK_CONTOUR_WEIGHT.rival,
            opacity: active ? LAND_MASK_CONTOUR_OPACITY.active : LAND_MASK_CONTOUR_OPACITY.rival,
            fill: false,
            fillOpacity: 0,
            interactive: true,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 0,
            className: `terr-land-mask-contour${active ? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'}${ownerFocusClass(ownerKey, 'terr-land-mask-contour')}`,
          }).addTo(layer);
          markTerritoryPathOwner(contour, { active, ownerName, ownerId, ownerKey });
        });
      }

      const rivalEntries = contourRenderEntries.filter((entry) => !entry.active);
      const activeEntries = contourRenderEntries.filter((entry) => entry.active);
      paintLandRegions(rivalEntries, renderers.rivalFill);
      paintContourRegions(rivalEntries, renderers.rivalContour);
      paintLandRegions(activeEntries, renderers.activeFill);
      paintContourRegions(activeEntries, renderers.activeContour);

      if (previousLayer && previousLayer !== layer) {
        previousLayer.remove();
      }

      if (recenterSignal === 0 && selectedOwnerKeyValue && activeEntries.length > 0) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!cancelled) ensureActiveConcretePathsInView(map);
            window.setTimeout(() => {
              if (!cancelled) ensureActiveConcretePathsInView(map);
            }, 450);
          });
        });
      }

      const selectedEntries = selectedOwnerKeyValue
        ? contourRenderEntries.filter((entry) => entry.ownerKey === selectedOwnerKeyValue)
        : [];
      const focusedEntries = selectedEntries.length > 0
        ? selectedEntries
        : (focusOwnerKeyValue ? contourRenderEntries.filter((entry) => entry.ownerKey === focusOwnerKeyValue) : []);
      const boundsCoords = focusedEntries.length > 0
        ? territoryOwnerFocusBoundsCoords(focusedEntries)
        : territoryDefaultBoundsCoords(contourRenderEntries, allCoords);

      if (boundsCoords.length > 0) {
        const bounds = L.latLngBounds(boundsCoords);
        if (bounds.isValid()) {
          const focusKey = selectedOwnerKeyValue || (focusOwnerKeyValue ? `focus:${focusOwnerKeyValue}` : 'all');
          const boundsKey = `${focusKey}:${focusSignal}:${territoryBoundsKey(bounds)}`;
          const fitActionKey = `${focusKey}:${focusSignal}:${recenterSignal}`;
          const fitSourceKey = polygonSignature || 'no-signature';
          const fitIntentKey = `${fitActionKey}:${fitSourceKey}`;
          const fitActionChanged = lastFittedConcreteActionKeyRef.current !== fitActionKey;
          const fitSourceChanged = lastFittedConcreteSourceKeyRef.current !== fitSourceKey;
          const actualFocusOrRecenterIntent = lastFittedConcreteActionKeyRef.current !== null && fitActionChanged;
          const manualViewportLocksFit = viewportMovedAfterFitRef.current
            && lastFittedConcreteBoundsKeyRef.current !== null
            && recenterSignal <= 0
            && !actualFocusOrRecenterIntent;
          const shouldFitConcreteBounds = !manualViewportLocksFit && (
            lastFittedConcreteBoundsKeyRef.current === null
            || fitActionChanged
            || (fitSourceChanged && !viewportMovedAfterFitRef.current)
          );
          if (shouldFitConcreteBounds && (
            lastFittedConcreteBoundsKeyRef.current !== boundsKey
            || lastFittedConcreteIntentKeyRef.current !== fitIntentKey
          )) {
            const applyConcreteBounds = () => {
              if (cancelled) return;
              const redrawConcreteLayer = () => {
                if (cancelled) return;
                layer.eachLayer((childLayer) => {
                  if (typeof childLayer?.redraw === 'function') {
                    childLayer.redraw();
                  }
                });
              };
              map.invalidateSize({ pan: false });
              map.once('moveend', redrawConcreteLayer);
              programmaticFitInProgressRef.current = true;
              window.setTimeout(() => {
                programmaticFitInProgressRef.current = false;
              }, 900);
              if (recenterSignal > 0) {
                map.flyToBounds(bounds, {
                  padding: focusedEntries.length > 0 ? [76, 76] : [34, 34],
                  maxZoom: focusedEntries.length > 0 ? 14 : 14,
                  duration: focusedEntries.length > 0 ? 0.65 : 0.8,
                });
              } else if (focusedEntries.length > 0) {
                map.fitBounds(bounds, { padding: [76, 76], maxZoom: 14, animate: false });
              } else {
                map.fitBounds(bounds, { padding: [34, 34], maxZoom: 12, animate: false });
                map.setZoom(Math.min(map.getZoom(), 12), { animate: false });
              }
              lastFittedConcreteBoundsKeyRef.current = boundsKey;
              lastFittedConcreteIntentKeyRef.current = fitIntentKey;
              lastFittedConcreteActionKeyRef.current = fitActionKey;
              lastFittedConcreteSourceKeyRef.current = fitSourceKey;
              viewportMovedAfterFitRef.current = false;
              window.requestAnimationFrame(() => {
                window.requestAnimationFrame(redrawConcreteLayer);
              });
              window.setTimeout(redrawConcreteLayer, 260);
            };

            applyConcreteBounds();
          }
        }
      }

      polygonLayerRef.current = layer;
      lastRenderedTerritoryOwnerSetKeyRef.current = targetOwnerSetKey;
      lastRenderedTerritoryGeometryKeyRef.current = geometryKey;
    }

    paintPolygons();
    return () => {
      cancelled = true;
    };
  }, [polygons, polygonSignature, cachedRenderSnapshot, showPolygons, mapReady, mapViewportKey, recenterSignal, selectedOwnerKey, focusOwnerKey, focusSignal, lang]);

  return <div ref={mapRef} className="terr-leaflet-map" />;
}

export default function Territory() {
  const navigate = useNavigate();
  const { isAuthenticated, authHydrated, email, logout } = useAuth();
  const { t, lang } = useI18n();
  const initialTerritoryShell = readCachedTerritoryShell();
  const [territory, setTerritory] = useState(() => initialTerritoryShell?.data || null);
  const [polygonData, setPolygonData] = useState(undefined);
  const [polygonDataSignature, setPolygonDataSignature] = useState('');
  const [cachedRenderSnapshot, setCachedRenderSnapshot] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [scopeFocusSignal, setScopeFocusSignal] = useState(0);
  const [territoryScope, setTerritoryScope] = useState('global');
  const [inspectedOwnerKey, setInspectedOwnerKey] = useState('');
  const territoryShellSignatureRef = useRef(initialTerritoryShell?.signature || '');
  const polygonSignatureRef = useRef('');
  const cacheAccountKeyRef = useRef(territoryCacheAccountKey());

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const activeCacheAccountKey = territoryCacheAccountKey();
    if (cacheAccountKeyRef.current !== activeCacheAccountKey) {
      cacheAccountKeyRef.current = activeCacheAccountKey;
      polygonSignatureRef.current = '';
      setPolygonData(undefined);
      setPolygonDataSignature('');
      setCachedRenderSnapshot(null);
      setScopeFocusSignal(0);
      setTerritoryScope('global');
      setInspectedOwnerKey('');
      const cachedShell = readCachedTerritoryShell();
      territoryShellSignatureRef.current = cachedShell?.signature || '';
      setTerritory(cachedShell?.data || null);
    }

    let cancelled = false;
    let polygonInitialTimer = null;
    let polygonRefreshTimer = null;
    let freshPolygonsLoaded = false;
    let cachedPolygonsLoaded = false;

    function commitTerritoryShellData(territoryData, serverEtag = '') {
      const nextTerritory = territoryData?.available ? territoryData : EMPTY_TERRITORY;
      const nextSignature = serverEtag || territoryPayloadSignature(nextTerritory);
      if (nextSignature !== territoryShellSignatureRef.current) {
        territoryShellSignatureRef.current = nextSignature;
        setTerritory(nextTerritory);
      }
      writeCachedTerritoryShell(nextTerritory, nextSignature);
    }

    function commitTerritoryPolygons(polygonsData, serverSignature = '') {
      if (!polygonsData || typeof polygonsData !== 'object') {
        if (!polygonSignatureRef.current) {
          setPolygonData(null);
          setPolygonDataSignature('');
        }
        return;
      }

      const nextSignature = normalizeTerritoryServerSignature(serverSignature) || territoryPayloadSignature(polygonsData);
      if (nextSignature === polygonSignatureRef.current) {
        return;
      }
      polygonSignatureRef.current = nextSignature;
      setCachedRenderSnapshot((current) => (
        current?.signature === nextSignature ? current : null
      ));
      setPolygonData(polygonsData);
      setPolygonDataSignature(nextSignature);

      if (!shouldRefreshTerritoryPolygons(polygonsData)) {
        writeCachedTerritoryPolygons(polygonsData, nextSignature);
      }
    }

    function commitEmptyTerritoryPolygons(polygonsData, serverSignature = '') {
      const emptyData = emptyTerritoryPolygonPayload(polygonsData);
      const nextSignature = normalizeTerritoryServerSignature(serverSignature) || territoryPayloadSignature(emptyData);
      const previousSignature = polygonSignatureRef.current;
      polygonSignatureRef.current = nextSignature;
      setCachedRenderSnapshot(null);
      setPolygonData(emptyData);
      setPolygonDataSignature(nextSignature);
      clearCachedTerritoryLatestRender(previousSignature, nextSignature);
      clearCachedTerritoryPolygons();
    }

    async function loadTerritoryShellData() {
      try {
        const [profileData, territoryResult] = await Promise.all([
          apiJson('/api/profile/me').catch(() => null),
          (async () => {
            const currentSignature = territoryShellSignatureRef.current;
            const headers = currentSignature
              ? { 'If-None-Match': `"${currentSignature}"` }
              : undefined;
            const response = await apiFetch('/api/territory', { headers }).catch(() => null);
            if (!response) return { data: null, etag: null };
            if (response.status === 401) return { data: null, etag: null, unauthorized: true };
            if (response.status === 304) return { data: null, etag: currentSignature };
            if (!response.ok) return { data: null, etag: null };
            const etag = normalizeEntityTag(response.headers.get('ETag') || '');
            const data = await response.json().catch(() => null);
            return { data, etag: etag || null };
          })(),
        ]);
        if (cancelled) return;
        setProfile(profileData && typeof profileData === 'object' ? profileData : null);
        if (territoryResult?.unauthorized) {
          logout();
          return;
        }
        if (territoryResult?.data !== null && territoryResult?.data !== undefined) {
          commitTerritoryShellData(territoryResult.data, territoryResult.etag);
        } else if (territoryResult?.etag) {
          territoryShellSignatureRef.current = territoryResult.etag;
        }
      } catch {
        if (!cancelled && !territoryShellSignatureRef.current) {
          setTerritory(EMPTY_TERRITORY);
        }
      }
    }

    async function loadTerritoryPolygons() {
      if (polygonRefreshTimer) {
        window.clearTimeout(polygonRefreshTimer);
        polygonRefreshTimer = null;
      }

      // Render-only cache may be enough for an instant preview, but it is derived
      // data. Only a hydrated raw polygon payload can safely suppress a canonical
      // polygon fetch with 304; otherwise an orphaned/bad render cache can blank
      // the map while still showing owner chips.
      const hasUsablePaintCache = cachedPolygonsLoaded;
      const currentCachedSignature = hasUsablePaintCache ? polygonSignatureRef.current : '';
      const canUseConditionalRefresh = hasUsablePaintCache && Boolean(currentCachedSignature);
      const polygonUrl = canUseConditionalRefresh
        ? '/api/territory/polygons?initial=true&cells=false'
        : '/api/territory/polygons?initial=true';
      const response = await apiFetch(polygonUrl, {
        headers: canUseConditionalRefresh ? territoryPolygonRefreshHeaders(currentCachedSignature) : {},
      }).catch(() => null);
      if (cancelled) return;

      if (response?.status === 304) {
        return;
      }
      if (response?.status === 401) {
        logout();
        return;
      }

      let polygonResponse = response;
      let polygonsData = polygonResponse?.ok
        ? await polygonResponse.json().catch(() => null)
        : null;

      if (polygonResponse?.ok && canUseConditionalRefresh && !hasDrawableTerritoryPolygonData(polygonsData)) {
        polygonResponse = await apiFetch('/api/territory/polygons?initial=true').catch(() => null);
        if (cancelled) return;
        if (polygonResponse?.status === 401) {
          logout();
          return;
        }
        polygonsData = polygonResponse?.ok
          ? await polygonResponse.json().catch(() => null)
          : null;
      }

      if (!hasDrawableTerritoryPolygonData(polygonsData)) {
        if (polygonResponse?.ok) {
          commitEmptyTerritoryPolygons(polygonsData, territoryPolygonResponseSignature(polygonResponse));
          freshPolygonsLoaded = true;
          cachedPolygonsLoaded = false;
        } else if (!polygonSignatureRef.current) {
          setPolygonData(null);
          setPolygonDataSignature('');
        }
        return;
      }

      const drawablePolygonsData = polygonsData;
      if (cancelled) return;

      commitTerritoryPolygons(drawablePolygonsData, territoryPolygonResponseSignature(polygonResponse));
      freshPolygonsLoaded = true;
      cachedPolygonsLoaded = true;
      if (shouldRefreshTerritoryPolygons(drawablePolygonsData)) {
        polygonRefreshTimer = window.setTimeout(loadTerritoryPolygons, TERRITORY_POLYGON_REFRESH_MS);
      }
    }

    // Fire cached reads and both API calls in parallel 鈥?cached data renders instantly,
    // fresh API data overlays when it arrives.
    function scheduleInitialPolygonLoad() {
      if (polygonInitialTimer) {
        window.clearTimeout(polygonInitialTimer);
      }
      polygonInitialTimer = window.setTimeout(loadTerritoryPolygons, TERRITORY_POLYGON_INITIAL_DELAY_MS);
    }

    readCachedTerritoryPolygons().then((cached) => {
      if (cancelled || !cached || freshPolygonsLoaded) return;
      cachedPolygonsLoaded = true;
      polygonSignatureRef.current = cached.signature;
      setPolygonData(cached.data);
      setPolygonDataSignature(cached.signature);
    });
    readCachedTerritoryLatestRender().then((cached) => {
      if (cancelled || !cached || freshPolygonsLoaded) return;
      const hasPreviewEntries = Array.isArray(cached.data?.previewContourRenderEntries)
        && cached.data.previewContourRenderEntries.length > 0;
      setCachedRenderSnapshot({ signature: cached.signature, data: cached.data, mode: hasPreviewEntries ? 'preview' : 'full' });
      if (hasPreviewEntries) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!cancelled && !freshPolygonsLoaded) {
              setCachedRenderSnapshot({ signature: cached.signature, data: cached.data, mode: 'full' });
            }
          });
        });
      }
    });
    loadTerritoryShellData();
    scheduleInitialPolygonLoad();
    return () => {
      cancelled = true;
      if (polygonInitialTimer) {
        window.clearTimeout(polygonInitialTimer);
      }
      if (polygonRefreshTimer) {
        window.clearTimeout(polygonRefreshTimer);
      }
    };
  }, [authHydrated, isAuthenticated, navigate, email, logout]);

  // Preload Leaflet as soon as we know the user is authenticated, so the map
  // library is already loaded when territory data arrives.
  useEffect(() => {
    if (authHydrated && isAuthenticated) {
      loadLeaflet();
    }
  }, [authHydrated, isAuthenticated]);

  const polygons = useMemo(() => {
    const backendPolygons = Array.isArray(polygonData?.polygons)
      ? polygonData.polygons.filter(hasDrawableTerritoryPolygon)
      : [];
    if (polygonData === undefined) {
      return [];
    }
    return backendPolygons;
  }, [polygonData]);
    // Fire cached reads and both API calls in parallel — cached data renders instantly,
    // fresh API data overlays when it arrives.
  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'territory' }),
    [lang, t],
  );
  const tc = (key) => mapChromeCopy(lang, key);
  const center = territory?.center || null;
  const initials = String(profile?.displayName || profile?.email || 'H').trim().slice(0, 1).toUpperCase() || 'H';
  const hasCachedRenderSnapshot = Boolean(
    cachedRenderSnapshot?.data
    && cachedRenderSnapshot?.signature
    && hasDrawableTerritoryRenderData(cachedRenderSnapshot.data),
  );
  const ownerThemes = useMemo(
    () => territoryOwnerThemes(polygons, cachedRenderSnapshot, profile, lang),
    [polygons, cachedRenderSnapshot, profile, lang],
  );
  const activeOwnerTheme = ownerThemes.find((theme) => theme.active) || null;
  const selectedOwnerKey = territoryScope === 'own' ? activeOwnerTheme?.ownerKey || '' : '';
  const focusOwnerKey = activeOwnerTheme?.ownerKey || '';

  useEffect(() => {
    if (polygonData !== undefined && ownerThemes.length > 0 && territoryScope === 'own' && !activeOwnerTheme) {
      setTerritoryScope('global');
    }
  }, [activeOwnerTheme, ownerThemes.length, polygonData, territoryScope]);

  useEffect(() => {
    if (!inspectedOwnerKey) return;
    if (!ownerThemes.some((theme) => theme.ownerKey === inspectedOwnerKey)) {
      setInspectedOwnerKey('');
    }
  }, [ownerThemes, inspectedOwnerKey]);

  const inspectedOwner = ownerThemes.find((theme) => theme.ownerKey === inspectedOwnerKey) || null;

  function handleScopeChange(nextScope) {
    setTerritoryScope(nextScope === 'own' ? 'own' : 'global');
    setInspectedOwnerKey('');
    setScopeFocusSignal((value) => value + 1);
  }

  function handleTerritoryOwnerClick(ownerKey) {
    if (!ownerKey) return;
    setInspectedOwnerKey(ownerKey);
  }

  if (!authHydrated || !isAuthenticated || territory === null) {
    return (
      <TerritoryInitialLoading
        label={tc('loadingTerritory')}
        copy={tc('loadingCopy')}
        kicker={tc('loadingKicker')}
        centerLabel={tc('recenter')}
        runsLabel={tc('viewRuns')}
        settingsLabel={tc('settings')}
        initials={initials}
        onProfile={() => navigate('/profile')}
        onRuns={() => navigate('/runs')}
        onSettings={() => navigate('/settings')}
      />
    );
  }

  return (
    <div className="runner-shell-page territory-page territory-heatmap-outline territory-map-only runner-dashboard-page">
      <main className="runner-shell-main">
        <div className="runner-shell-canvas territory-canvas">
          <section className="terr-map-section terr-map-section--lands-only" aria-label="Territory land map">
            <div className="terr-map-topbar terr-map-titlebar" aria-label={tc('pageTitle')}>
              <div className="terr-map-brand-pill terr-map-brand-pill--static" aria-label={`Hermes ${tc('pageTitle')}`}>
                <HermesLogo dark />
                <strong>{tc('pageTitle')}</strong>
              </div>

              <button
                type="button"
                className="terr-map-sector-pill terr-map-recenter-pill"
                onClick={() => setRecenterSignal((value) => value + 1)}
                aria-label={tc('recenter')}
              >
                <AppIcon name="search" className="terr-map-pill-icon" />
                <div className="terr-map-sector-copy">
                  <span>{tc('recenter')}</span>
                  <strong>{center ? formatCenterLabel(center) : tc('loadingTerritory')}</strong>
                </div>
              </button>

              <div className="terr-map-action-strip">
                <button type="button" className="terr-map-secondary-btn" onClick={() => navigate('/runs')}>
                  {tc('viewRuns')}
                </button>
                <button type="button" className="terr-map-primary-btn" onClick={() => navigate('/settings')}>
                  {tc('settings')}
                </button>
                <button
                  type="button"
                  className="runner-shell-avatar terr-map-avatar"
                  onClick={() => navigate('/profile')}
                  aria-label={t('profile.dashboard_nav_dashboard') || 'Profile'}
                >
                  {initials}
                </button>
              </div>
            </div>

            <nav className="terr-map-utility-rail terr-map-utility-rail--navigation-only" aria-label={t('profile.dashboard_nav_territory') || 'Territory navigation'}>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`terr-map-utility-btn${item.active ? ' is-active' : ''}`}
                  onClick={() => navigate(item.route)}
                  aria-label={item.label}
                  title={item.label}
                >
                  <AppIcon name={item.icon} className="terr-map-utility-icon" />
                </button>
              ))}
            </nav>

            <TerritoryMap
              territory={territory}
              polygons={polygons}
              polygonSignature={polygonDataSignature}
              cachedRenderSnapshot={cachedRenderSnapshot}
              showPolygons={polygons.length > 0 || hasCachedRenderSnapshot}
              recenterSignal={recenterSignal}
              selectedOwnerKey={selectedOwnerKey}
              focusOwnerKey={focusOwnerKey}
              focusSignal={scopeFocusSignal}
              onTerritoryOwnerClick={handleTerritoryOwnerClick}
              lang={lang}
            />

            <TerritoryOwnerInfoPanel
              owner={inspectedOwner}
              copy={tc}
              onClose={() => setInspectedOwnerKey('')}
            />

            <TerritoryScopeSwitch
              themes={ownerThemes}
              scope={territoryScope}
              activeTheme={activeOwnerTheme}
              onScopeChange={handleScopeChange}
              copy={tc}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

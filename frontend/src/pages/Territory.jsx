import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
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
    campaignPanel: 'Territory campaign',
    campaignKicker: 'Live conquest board',
    campaignTitle: 'Run. Claim. Defend.',
    campaignBody: 'Every run adds real ground to your board. Hold your strongest sectors and pressure the next target.',
    startRun: 'Start next run',
    targetPressure: 'Target pressure',
    sectorValue: 'Every 1KM\u00b2 strengthens control',
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
    campaignPanel: '\u9886\u5730\u6218\u5c40',
    campaignKicker: '\u5b9e\u65f6\u5360\u9886\u68cb\u76d8',
    campaignTitle: '\u5954\u8dd1\u3002\u5360\u9886\u3002\u5b88\u4f4f\u3002',
    campaignBody: '\u6bcf\u6b21\u8dd1\u6b65\u90fd\u4f1a\u4e3a\u4f60\u7684\u68cb\u76d8\u589e\u52a0\u771f\u5b9e\u5730\u9762\u3002\u5b88\u4f4f\u6700\u5f3a\u533a\u5757\uff0c\u5411\u4e0b\u4e00\u76ee\u6807\u65bd\u538b\u3002',
    startRun: '\u5f00\u59cb\u4e0b\u4e00\u6b21\u8dd1\u6b65',
    targetPressure: '\u76ee\u6807\u538b\u529b',
    sectorValue: '\u6bcf 1KM\u00b2 \u90fd\u4f1a\u589e\u5f3a\u63a7\u5236\u529b',
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

/** Read the coral stroke color from CSS custom properties at runtime */
function getCoralStroke() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-coral-strong').trim() || '#f07561';
}

const MAX_MASK_CELLS_TO_RENDER = 200000;
const TERRITORY_POLYGON_REFRESH_MS = 2500;
const TERRITORY_POLYGON_INITIAL_DELAY_MS = 120;
const METERS_PER_DEG_LAT = 111_320;
const LAND_MASK_RENDER_SUBDIVISION = 3;
const LAND_MASK_SUBDIVIDED_CELL_TILE_FACTOR = 9;
const LAND_MASK_SOURCE_BRUSH_RADIUS_RATIO = 1.45;
const LAND_MASK_TILE_OVERLAP_RATIO = 0.18;
const LAND_MASK_CONTOUR_SIMPLIFY_RATIO = 12;
const LAND_MASK_SMOOTHING_PASSES = 8;
const LAND_MASK_CURVE_PASSES = 3;
const LAND_MASK_SMALL_LOOP_POINT_LIMIT = 44;
const LAND_MASK_TINY_LOOP_POINT_LIMIT = 24;
const LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP = 3600;
const LAND_MASK_CORNER_RADIUS_RATIO = 18;
const LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS = 10;
const LAND_MASK_MIN_VISIBLE_COMPACTNESS = 0.032;
const LAND_MASK_MAX_VISIBLE_ASPECT_RATIO = 8;
const LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS = 18_000;
const LAND_MASK_CONTOUR_PRUNE_PASSES = 2;
const LAND_MASK_CONTOUR_PRUNE_MIN_NEIGHBORS = 3;
const LAND_MASK_CONTOUR_CORE_MIN_NEIGHBORS = 4;
const LAND_MASK_LARGE_COMPONENT_MIN_TILES = 40;
const LAND_MASK_CONTOUR_WEIGHT = { active: 4.4, rival: 1.25 };
const LAND_MASK_CONTOUR_OPACITY = { active: 0.98, rival: 0.26 };
const LAND_MASK_CONCRETE_LAND_OPACITY = { active: 0.72, rival: 0.2 };
const LAND_MASK_CONCRETE_LAND_EDGE_WEIGHT = 0;
const LAND_MASK_CONCRETE_LAND_EDGE_OPACITY = { active: 0, rival: 0 };
const LAND_MASK_CONTOUR_SCREEN_SIMPLIFY_PX = 0.25;
const LAND_MASK_CONTOUR_REFERENCE_ZOOM = 14;
const LAND_MASK_CONTOUR_CUBIC_TENSION = 0.62;
const LAND_MASK_CONTOUR_CONTROL_PADDING_RATIO = 0.72;
const LAND_MASK_AXIS_SEGMENT_SOFTEN_PX = 64;
const LAND_MASK_AXIS_SEGMENT_MIN_PX = 10;
const LAND_MASK_SHARED_EDGE_CURVE_RATIO = 0.38;
const TERRITORY_LAYER_PANES = [
  { name: 'territory-rival-fill-pane', className: 'terr-leaflet-territory-pane--rival-fill', zIndex: 430 },
  { name: 'territory-rival-contour-pane', className: 'terr-leaflet-territory-pane--rival-contour', zIndex: 440 },
  { name: 'territory-active-fill-pane', className: 'terr-leaflet-territory-pane--active-fill', zIndex: 450 },
  { name: 'territory-active-contour-pane', className: 'terr-leaflet-territory-pane--active-contour', zIndex: 460 },
];

function hasCoordinatePolygon(poly) {
  return Array.isArray(poly?.coordinates) && poly.coordinates.length >= 3;
}

function hasCellMaskPolygon(poly) {
  return Array.isArray(poly?.cells) && poly.cells.length > 0;
}

function territoryLayerRenderers(L, map) {
  TERRITORY_LAYER_PANES.forEach(({ name, className, zIndex }) => {
    const pane = map.getPane(name) || map.createPane(name);
    pane.classList.add('terr-leaflet-territory-pane', className);
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = 'none';
  });

  return {
    rivalFill: L.svg({ padding: 0.65, pane: 'territory-rival-fill-pane' }),
    rivalContour: L.svg({ padding: 0.65, pane: 'territory-rival-contour-pane' }),
    activeFill: L.svg({ padding: 0.65, pane: 'territory-active-fill-pane' }),
    activeContour: L.svg({ padding: 0.65, pane: 'territory-active-contour-pane' }),
  };
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

function mergeCellMaskPolygonsByOwner(polygons) {
  const groups = new Map();
  const mergedPolygons = [];

  (Array.isArray(polygons) ? polygons : []).forEach((poly, index) => {
    if (!hasCellMaskPolygon(poly)) {
      mergedPolygons.push(poly);
      return;
    }

    const key = polygonOwnerMergeKey(poly, index);
    let group = groups.get(key);
    if (!group) {
      group = {
        ...poly,
        id: poly.id ?? key,
        activityId: poly.activityId ?? null,
        cells: [],
        routeTraces: [],
        areaSquareMeters: 0,
        sourcePolygonCount: 0,
      };
      groups.set(key, group);
      mergedPolygons.push(group);
    }

    group.cells.push(...poly.cells);
    if (Array.isArray(poly.routeTraces)) {
      group.routeTraces.push(...poly.routeTraces);
    }
    group.areaSquareMeters += Number(poly.areaSquareMeters) || 0;
    group.active = Boolean(group.active || poly.active);
    group.color = group.active ? safeColor(poly.color, group.color) : safeColor(group.color || poly.color);
    group.ownerName = group.ownerName || poly.ownerName;
    group.ownerId = group.ownerId ?? poly.ownerId;
    group.cellMeters = Math.min(
      Number.isFinite(Number(group.cellMeters)) ? Number(group.cellMeters) : Number.POSITIVE_INFINITY,
      Number.isFinite(Number(poly.cellMeters)) ? Number(poly.cellMeters) : Number.POSITIVE_INFINITY,
    );
    group.sourcePolygonCount += 1;
  });

  mergedPolygons.forEach((poly) => {
    if (hasCellMaskPolygon(poly) && !Number.isFinite(Number(poly.cellMeters))) {
      poly.cellMeters = undefined;
    }
  });

  // Preserve backend ownership order. The backend sends latest occupation first; render code
  // reverses that order so older land paints first and the newest owner wins visual conflicts.
  return mergedPolygons;
}

function polygonRenderBounds(poly) {
  const points = hasCellMaskPolygon(poly)
    ? poly.cells.map((cell) => [cell?.latitude, cell?.longitude])
    : (hasCoordinatePolygon(poly) ? poly.coordinates : []);
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    const latitude = Number(point?.[0]);
    const longitude = Number(point?.[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  });

  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
    return null;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function mergeBounds(boundsList) {
  const validBounds = (Array.isArray(boundsList) ? boundsList : []).filter(Boolean);
  if (!validBounds.length) {
    return null;
  }
  return validBounds.reduce((merged, bounds) => ({
    minLat: Math.min(merged.minLat, bounds.minLat),
    maxLat: Math.max(merged.maxLat, bounds.maxLat),
    minLng: Math.min(merged.minLng, bounds.minLng),
    maxLng: Math.max(merged.maxLng, bounds.maxLng),
  }));
}

function boundsOverlap(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.minLat <= b.maxLat
    && a.maxLat >= b.minLat
    && a.minLng <= b.maxLng
    && a.maxLng >= b.minLng;
}

function polygonsNearActiveTerritory(polygons) {
  const safePolygons = Array.isArray(polygons) ? polygons : [];
  const activeBounds = mergeBounds(safePolygons
    .filter((poly) => poly?.active === true)
    .map(polygonRenderBounds));
  if (!activeBounds) {
    return safePolygons;
  }

  return safePolygons.filter((poly) => (
    poly?.active === true || boundsOverlap(polygonRenderBounds(poly), activeBounds)
  ));
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

function ownsTerritoryCell(cell) {
  if (!cell || !Array.isArray(cell.polygon) || cell.polygon.length < 3) {
    return false;
  }
  if (String(cell.ownerName || '').trim().toLowerCase() === 'you') {
    return true;
  }

  const activeScore = Number(cell.activeScore);
  const ownerScore = Number(cell.ownerScore);
  return Number.isFinite(activeScore)
    && Number.isFinite(ownerScore)
    && activeScore > 0
    && activeScore >= ownerScore;
}

function territoryCellFallbackPolygons(territory) {
  if (!Array.isArray(territory?.territories)) {
    return [];
  }

  return territory.territories
    .filter(ownsTerritoryCell)
    .map((cell, index) => ({
      id: `territory-cell:${cell.id || index}`,
      ownerName: 'You',
      color: safeColor(cell.color),
      active: true,
      coordinates: cell.polygon,
      cells: [],
      shapeType: 'territory-cell',
    }));
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
    const sourceRadiusMeters = tileMeters < baseCellMeters ? baseCellMeters * LAND_MASK_SOURCE_BRUSH_RADIUS_RATIO : 0;
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

        const latitude = (tileGridY * tileMeters) / METERS_PER_DEG_LAT;
        const longitude = (tileGridX * tileMeters) / (METERS_PER_DEG_LAT * renderCosLat);
        tiles.set(key, {
          gridX: tileGridX,
          gridY: tileGridY,
          latitude,
          longitude,
          tileMeters,
          cosLat: renderCosLat,
          bounds: sealedMaskTileBounds(latitude, longitude, tileMeters, renderCosLat),
        });
      }
    }
  });

  return Array.from(tiles.values());
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

function pruneMaskContourTiles(tiles) {
  const validTiles = (Array.isArray(tiles) ? tiles : [])
    .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY));
  if (validTiles.length < 4) return validTiles;

  let activeKeys = new Set(validTiles.map((tile) => maskTileClaimKey(tile)));
  const tilesByKey = new Map(validTiles.map((tile) => [maskTileClaimKey(tile), tile]));

  for (let pass = 0; pass < LAND_MASK_CONTOUR_PRUNE_PASSES; pass += 1) {
    const nextKeys = new Set();
    activeKeys.forEach((key) => {
      const tile = tilesByKey.get(key);
      if (!tile) return;
      const neighborCount = neighborKeys(tile).filter((neighborKey) => activeKeys.has(neighborKey)).length;
      if (neighborCount >= LAND_MASK_CONTOUR_PRUNE_MIN_NEIGHBORS) {
        nextKeys.add(key);
      }
    });

    if (nextKeys.size < 4 || nextKeys.size === activeKeys.size) {
      break;
    }
    activeKeys = nextKeys;
  }

  const coreKeys = new Set();
  activeKeys.forEach((key) => {
    const tile = tilesByKey.get(key);
    if (!tile) return;
    const neighborCount = neighborKeys(tile).filter((neighborKey) => activeKeys.has(neighborKey)).length;
    if (neighborCount >= LAND_MASK_CONTOUR_CORE_MIN_NEIGHBORS) {
      coreKeys.add(key);
    }
  });

  if (coreKeys.size >= 4) {
    const openedKeys = new Set(coreKeys);
    coreKeys.forEach((key) => {
      const tile = tilesByKey.get(key);
      if (!tile) return;
      neighborKeys(tile).forEach((neighborKey) => {
        if (activeKeys.has(neighborKey)) {
          openedKeys.add(neighborKey);
        }
      });
    });
    if (openedKeys.size >= 4) {
      activeKeys = openedKeys;
    }
  }

  return Array.from(activeKeys)
    .map((key) => tilesByKey.get(key))
    .filter(Boolean);
}

function resolveMaskTileOwnership(polygons, renderGrid) {
  const claimedTiles = new Set();

  return (Array.isArray(polygons) ? polygons : []).map((poly) => {
    if (!hasCellMaskPolygon(poly)) {
      return { poly, tiles: null };
    }

    const tilesByKey = new Map();
    const concreteTiles = aggregateMaskCells(poly.cells, poly.cellMeters, renderGrid);
    concreteTiles.forEach((tile) => {
      tilesByKey.set(maskTileClaimKey(tile), tile);
    });

    const tiles = Array.from(tilesByKey.values())
      .filter((tile) => {
        const key = maskTileClaimKey(tile);
        if (claimedTiles.has(key)) {
          return false;
        }
        claimedTiles.add(key);
        return true;
      });

    return { poly, tiles };
  });
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

function visualMaskRegions(tiles, options = {}) {
  return maskTileConnectedComponents(tiles).flatMap((component) => {
    const contourComponent = component.length >= LAND_MASK_LARGE_COMPONENT_MIN_TILES
      ? component
      : pruneMaskContourTiles(component);
    const componentRegions = maskBoundaryLoops(contourComponent, options)
      .filter((loop) => loop.length >= 4);
    return visibleMaskContourRegions(componentRegions, options);
  });
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
      loop.push(maskVertexToLatLng(edge.from, tileMeters, cosLat));
      if (edge.shared) {
        loop.push(maskVertexToLatLng(maskSharedEdgeMidpoint(edge.from, endpoint), tileMeters, cosLat));
      }
      remaining.delete(edge.key);

      const endpointKey = maskVertexKey(endpoint);
      if (endpointKey === startKey) {
        loop.push(maskVertexToLatLng(endpoint, tileMeters, cosLat));
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

function maskLoopAreaMetersSquared(points, cosLat) {
  const open = closedMaskLoopOpenPoints(points);
  if (open.length < 3) return 0;

  let area = 0;
  for (let index = 0; index < open.length; index += 1) {
    const current = maskPointToMeters(open[index], cosLat);
    const next = maskPointToMeters(open[(index + 1) % open.length], cosLat);
    area += (current.x * next.y) - (next.x * current.y);
  }
  return Math.abs(area) / 2;
}

function maskLoopPerimeterMeters(points, cosLat) {
  const open = closedMaskLoopOpenPoints(points);
  if (open.length < 3) return 0;

  let perimeter = 0;
  for (let index = 0; index < open.length; index += 1) {
    perimeter += maskPointDistanceMeters(open[index], open[(index + 1) % open.length], cosLat);
  }
  return perimeter;
}

function maskLoopCompactness(points, cosLat) {
  const area = maskLoopAreaMetersSquared(points, cosLat);
  const perimeter = maskLoopPerimeterMeters(points, cosLat);
  if (area <= 0 || perimeter <= 0) return 0;
  return (4 * Math.PI * area) / (perimeter * perimeter);
}

function maskLoopAspectRatio(points, cosLat) {
  const open = closedMaskLoopOpenPoints(points);
  if (open.length < 3) return Infinity;

  const projected = open.map((point) => maskPointToMeters(point, cosLat));
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  if (shortest <= 0 || longest <= 0) return Infinity;
  return longest / shortest;
}

function closedMaskLoopOpenPoints(loop) {
  const points = (Array.isArray(loop) ? loop : [])
    .map((point) => [Number(point?.[0]), Number(point?.[1])])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) {
    points.pop();
  }
  return points;
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
  const contourSimplifyRatio = open.length <= LAND_MASK_TINY_LOOP_POINT_LIMIT
    ? LAND_MASK_CONTOUR_SIMPLIFY_RATIO * 0.45
    : open.length <= LAND_MASK_SMALL_LOOP_POINT_LIMIT
      ? LAND_MASK_CONTOUR_SIMPLIFY_RATIO * 0.7
      : LAND_MASK_CONTOUR_SIMPLIFY_RATIO;
  const contourBaseMeters = Math.max(
    Number.isFinite(tileMeters) && tileMeters > 0 ? tileMeters : 36,
    Number.isFinite(sourceCellMeters) && sourceCellMeters > 0 ? sourceCellMeters : 0,
  );
  const simplifyToleranceMeters = contourBaseMeters
    * contourSimplifyRatio;

  const simplified = simplifyClosedMaskLoop(open, simplifyToleranceMeters, cosLat);
  const smoothingPasses = maskSmoothingPassCount(simplified.length, passes);
  const cornerRadiusMeters = contourBaseMeters
    * LAND_MASK_CORNER_RADIUS_RATIO;
  const smoothed = roundClosedMaskLoopCorners(simplified, cornerRadiusMeters, cosLat, smoothingPasses);
  const curvePasses = open.length <= LAND_MASK_TINY_LOOP_POINT_LIMIT
    ? 1
    : LAND_MASK_CURVE_PASSES;
  const curved = curveClosedMaskLoop(smoothed, curvePasses);
  const closed = [...curved, curved[0]];
  closed.hasSharedBoundary = Boolean(loop.hasSharedBoundary);

  return closed;
}

function visibleMaskContourRegions(exactRegions, options = {}) {
  const providedCosLat = Number(options?.cosLat);
  const fallbackLoop = Array.isArray(exactRegions) ? exactRegions.find((loop) => Array.isArray(loop) && loop.length > 0) : null;
  const fallbackPoint = Array.isArray(fallbackLoop) ? fallbackLoop[0] : null;
  const fallbackCosLat = Array.isArray(fallbackPoint)
    ? Math.max(1e-6, Math.abs(Math.cos((Number(fallbackPoint[0]) * Math.PI) / 180)))
    : 1;
  const cosLat = Number.isFinite(providedCosLat) && providedCosLat > 0 ? providedCosLat : fallbackCosLat;
  return (Array.isArray(exactRegions) ? exactRegions : [])
    .filter((loop) => loop.length >= LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS)
    .filter((loop) => maskLoopCompactness(loop, cosLat) >= LAND_MASK_MIN_VISIBLE_COMPACTNESS)
    .filter((loop) => maskLoopAspectRatio(loop, cosLat) <= LAND_MASK_MAX_VISIBLE_ASPECT_RATIO)
    .map((loop) => smoothMaskBoundaryLoop(loop, options))
    .filter((loop) => loop.length >= 4);
}

function visibleMaskStrokeRegions(regions, options = {}) {
  const providedCosLat = Number(options?.cosLat);
  const fallbackLoop = Array.isArray(regions) ? regions.find((loop) => Array.isArray(loop) && loop.length > 0) : null;
  const fallbackPoint = Array.isArray(fallbackLoop) ? fallbackLoop[0] : null;
  const fallbackCosLat = Array.isArray(fallbackPoint)
    ? Math.max(1e-6, Math.abs(Math.cos((Number(fallbackPoint[0]) * Math.PI) / 180)))
    : 1;
  const cosLat = Number.isFinite(providedCosLat) && providedCosLat > 0 ? providedCosLat : fallbackCosLat;

  return (Array.isArray(regions) ? regions : [])
    .filter((loop) => maskLoopAreaMetersSquared(loop, cosLat) >= LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS);
}

function dedupeLayerPoints(points, tolerancePixels = 0.75) {
  const deduped = [];
  const toleranceSquared = tolerancePixels * tolerancePixels;
  (Array.isArray(points) ? points : []).forEach((point) => {
    const previous = deduped[deduped.length - 1];
    if (previous) {
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      if ((dx * dx) + (dy * dy) <= toleranceSquared) return;
    }
    deduped.push(point);
  });

  const first = deduped[0];
  const last = deduped[deduped.length - 1];
  if (first && last) {
    const dx = first.x - last.x;
    const dy = first.y - last.y;
    if ((dx * dx) + (dy * dy) <= toleranceSquared) {
      deduped.pop();
    }
  }
  return deduped;
}

function layerPointDistanceToSegmentSquared(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);
  if (segmentLengthSquared <= 0) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return (dx * dx) + (dy * dy);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      (((point.x - start.x) * segmentX) + ((point.y - start.y) * segmentY)) / segmentLengthSquared,
    ),
  );
  const closestX = start.x + (projection * segmentX);
  const closestY = start.y + (projection * segmentY);
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return (dx * dx) + (dy * dy);
}

function simplifyLayerPointLine(points, tolerancePixels) {
  if (!Array.isArray(points) || points.length <= 2 || !Number.isFinite(tolerancePixels) || tolerancePixels <= 0) {
    return Array.isArray(points) ? points : [];
  }

  const toleranceSquared = tolerancePixels * tolerancePixels;
  const keep = new Array(points.length).fill(false);
  const stack = [[0, points.length - 1]];
  keep[0] = true;
  keep[points.length - 1] = true;

  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop();
    let farthestIndex = -1;
    let farthestDistance = toleranceSquared;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = layerPointDistanceToSegmentSquared(points[index], points[startIndex], points[endIndex]);
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

function simplifyClosedLayerPoints(points, tolerancePixels = LAND_MASK_CONTOUR_SCREEN_SIMPLIFY_PX) {
  if (!Array.isArray(points) || points.length < 8) return Array.isArray(points) ? points : [];

  const anchor = points[0];
  let splitIndex = Math.floor(points.length / 2);
  let farthestDistance = -1;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - anchor.x;
    const dy = points[index].y - anchor.y;
    const distance = (dx * dx) + (dy * dy);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      splitIndex = index;
    }
  }

  const firstArc = simplifyLayerPointLine(points.slice(0, splitIndex + 1), tolerancePixels);
  const secondArc = simplifyLayerPointLine([...points.slice(splitIndex), points[0]], tolerancePixels);
  const simplified = [...firstArc.slice(0, -1), ...secondArc.slice(0, -1)];
  return simplified.length >= 3 ? simplified : points;
}

function softenAxisAlignedLayerSegments(points) {
  if (!Array.isArray(points) || points.length < 3) return Array.isArray(points) ? points : [];

  const softened = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    softened.push(current);

    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const segmentLength = Math.sqrt((dx * dx) + (dy * dy));
    if (segmentLength < LAND_MASK_AXIS_SEGMENT_MIN_PX) continue;

    const axisSkew = Math.min(Math.abs(dx), Math.abs(dy)) / Math.max(Math.abs(dx), Math.abs(dy), 1);
    if (axisSkew > 0.12) continue;

    const previous = points[(index - 1 + points.length) % points.length];
    const following = points[(index + 2) % points.length];
    const direction = ((previous.x - next.x) * (following.y - current.y))
      - ((previous.y - next.y) * (following.x - current.x));
    const sign = direction >= 0 ? 1 : -1;
    const offset = Math.min(LAND_MASK_AXIS_SEGMENT_SOFTEN_PX, segmentLength * 0.24);
    const unitX = dx / segmentLength;
    const unitY = dy / segmentLength;

    softened.push({
      x: current.x + (dx * 0.5) + (-unitY * offset * sign),
      y: current.y + (dy * 0.5) + (unitX * offset * sign),
    });
  }

  return softened;
}

function stableContourLatLngPoints(map, region) {
  if (!map || !Array.isArray(region) || region.length < 4) return [];

  const referencePoints = dedupeLayerPoints(closedMaskLoopOpenPoints(region)
    .map((point) => map.project(point, LAND_MASK_CONTOUR_REFERENCE_ZOOM))
    .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)));
  const basePoints = simplifyClosedLayerPoints(referencePoints);
  const stableReferencePoints = softenAxisAlignedLayerSegments(basePoints);
  return stableReferencePoints
    .map((point) => map.unproject(point, LAND_MASK_CONTOUR_REFERENCE_ZOOM))
    .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
}

function stableContourSignature(points) {
  if (!Array.isArray(points) || points.length === 0) return '0:0';

  let hash = 2166136261;
  points.forEach((point) => {
    const token = `${point.lat.toFixed(7)},${point.lng.toFixed(7)};`;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  });
  return `${points.length}:${(hash >>> 0).toString(36)}`;
}

function clampLayerControlPoint(control, start, end) {
  const segmentLength = Math.sqrt(((end.x - start.x) ** 2) + ((end.y - start.y) ** 2));
  const padding = Math.max(4, segmentLength * LAND_MASK_CONTOUR_CONTROL_PADDING_RATIO);
  const minX = Math.min(start.x, end.x) - padding;
  const maxX = Math.max(start.x, end.x) + padding;
  const minY = Math.min(start.y, end.y) - padding;
  const maxY = Math.max(start.y, end.y) + padding;
  return {
    x: Math.max(minX, Math.min(maxX, control.x)),
    y: Math.max(minY, Math.min(maxY, control.y)),
  };
}

function cubicContourControls(previous, current, next, following) {
  const first = clampLayerControlPoint({
    x: current.x + ((next.x - previous.x) * LAND_MASK_CONTOUR_CUBIC_TENSION),
    y: current.y + ((next.y - previous.y) * LAND_MASK_CONTOUR_CUBIC_TENSION),
  }, current, next);
  const second = clampLayerControlPoint({
    x: next.x - ((following.x - current.x) * LAND_MASK_CONTOUR_CUBIC_TENSION),
    y: next.y - ((following.y - current.y) * LAND_MASK_CONTOUR_CUBIC_TENSION),
  }, current, next);
  return { first, second };
}

function smoothContourSvgPath(map, stableRegion) {
  if (!map || !Array.isArray(stableRegion) || stableRegion.length < 3) return '';

  const points = stableRegion
    .map((point) => map.latLngToLayerPoint(point))
    .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (points.length < 3) return '';

  let path = `M${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const following = points[(index + 2) % points.length];
    const { first, second } = cubicContourControls(previous, current, next, following);
    path += `C${first.x} ${first.y} ${second.x} ${second.y} ${next.x} ${next.y}`;
  }
  return `${path}Z`;
}

function attachSmoothTerritoryPath(map, territoryPath, region) {
  if (!map || !territoryPath || !Array.isArray(region)) return;
  const stableRegion = stableContourLatLngPoints(map, region);
  const stableSignature = stableContourSignature(stableRegion);

  const updatePath = () => {
    const pathElement = territoryPath._path;
    if (!pathElement) return;
    const path = smoothContourSvgPath(map, stableRegion);
    if (path) {
      pathElement.setAttribute('d', path);
      pathElement.dataset.hermesContourReferenceZoom = String(LAND_MASK_CONTOUR_REFERENCE_ZOOM);
      pathElement.dataset.hermesStableContourPoints = String(stableRegion.length);
      pathElement.dataset.hermesStableContourSignature = stableSignature;
    }
  };

  territoryPath.on('add', () => {
    window.requestAnimationFrame(updatePath);
  });
  territoryPath.on('remove', () => {
    map.off('zoomend viewreset moveend', updatePath);
  });
  map.on('zoomend viewreset moveend', updatePath);
  window.requestAnimationFrame(updatePath);
}

function TerritoryMap({ territory, polygons, showPolygons, recenterSignal }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const territoryCenter = isValidMapCenter(territory?.center) ? territory.center : null;

  useEffect(() => {
    let cancelled = false;
    let mountedMapContainer = null;

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
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
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

      if (polygonLayerRef.current) {
        polygonLayerRef.current.remove();
        polygonLayerRef.current = null;
      }

      if (!showPolygons || !Array.isArray(polygons) || polygons.length === 0) return;

      const strokeColor = getCoralStroke();
      const layer = L.layerGroup().addTo(map);
      const renderers = territoryLayerRenderers(L, map);

      const allCoords = [];
      const localPolygons = polygonsNearActiveTerritory(polygons);
      const ownerPolygons = mergeCellMaskPolygonsByOwner(localPolygons);
      const renderGrid = territoryMaskRenderGrid(ownerPolygons);
      const renderEntries = resolveMaskTileOwnership(ownerPolygons, renderGrid).slice().reverse();
      const globalOccupied = new Set(renderEntries.flatMap(({ tiles }) => (
        Array.isArray(tiles) ? tiles.map((tile) => maskTileClaimKey(tile)) : []
      )));
      const contourRenderEntries = [];
      renderEntries.forEach(({ poly, tiles }) => {
        const color = safeColor(poly.color, strokeColor);

        if (!hasCellMaskPolygon(poly) && hasCoordinatePolygon(poly)) {
          contourRenderEntries.push({
            active: Boolean(poly.active),
            color,
            borderColor: color,
            landRegions: [poly.coordinates],
            contourRegions: [poly.coordinates],
          });
          poly.coordinates.forEach((coord) => allCoords.push(coord));
          return;
        }

        if (!hasCellMaskPolygon(poly)) return;

        const tileMeters = Number(tiles?.[0]?.tileMeters);
        const cosLat = Number(tiles?.[0]?.cosLat);
        const exactRegions = maskTileConnectedComponents(tiles).flatMap((component) => maskBoundaryLoops(component, { globalOccupied }))
          .filter((loop) => loop.length >= 4);
        const sourceCellMeters = Number(renderGrid.sourceCellMeters);
        const concreteRegions = visualMaskRegions(tiles, {
          tileMeters,
          sourceCellMeters,
          cosLat,
          globalOccupied,
        });
        const visibleConcreteRegions = visibleMaskStrokeRegions(concreteRegions, { cosLat });
        exactRegions.forEach((region) => {
          region.forEach((coord) => allCoords.push(coord));
        });

        contourRenderEntries.push({
          active: Boolean(poly.active),
          color,
          borderColor: color,
          landRegions: visibleConcreteRegions,
          contourRegions: visibleConcreteRegions,
        });
      });

      function paintLandRegions(entries, renderer) {
        entries.forEach(({ active, color, landRegions }) => {
          landRegions.forEach((region) => {
            const concreteLand = L.polygon(region, {
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
              interactive: false,
              lineCap: 'round',
              lineJoin: 'round',
              smoothFactor: 0.35,
              className: `terr-land-mask-concrete-land${active ? ' terr-land-mask-concrete-land--active' : ' terr-land-mask-concrete-land--rival'}`,
            }).addTo(layer);
            attachSmoothTerritoryPath(map, concreteLand, region);
          });
        });
      }

      function paintContourRegions(entries, renderer) {
        entries.forEach(({ active, borderColor, contourRegions }) => {
          contourRegions.forEach((region) => {
            const contourLine = L.polyline(region, {
              color: borderColor,
              renderer,
              weight: active ? LAND_MASK_CONTOUR_WEIGHT.active : LAND_MASK_CONTOUR_WEIGHT.rival,
              opacity: active ? LAND_MASK_CONTOUR_OPACITY.active : LAND_MASK_CONTOUR_OPACITY.rival,
              interactive: false,
              lineCap: 'round',
              lineJoin: 'round',
              smoothFactor: 0.35,
              className: `terr-land-mask-contour${active ? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'}`,
            }).addTo(layer);
            attachSmoothTerritoryPath(map, contourLine, region);
          });
        });
      }

      const rivalEntries = contourRenderEntries.filter((entry) => !entry.active);
      const activeEntries = contourRenderEntries.filter((entry) => entry.active);
      paintLandRegions(rivalEntries, renderers.rivalFill);
      paintContourRegions(rivalEntries, renderers.rivalContour);
      paintLandRegions(activeEntries, renderers.activeFill);
      paintContourRegions(activeEntries, renderers.activeContour);

      if (recenterSignal > 0) {
        if (allCoords.length > 0) {
          const bounds = L.latLngBounds(allCoords);
          if (bounds.isValid()) {
            map.flyToBounds(bounds, { padding: [34, 34], maxZoom: 14, duration: 0.8 });
          }
        }
      }

      polygonLayerRef.current = layer;
    }

    paintPolygons();
    return () => {
      cancelled = true;
    };
  }, [polygons, showPolygons, mapReady, recenterSignal]);

  return <div ref={mapRef} className="terr-leaflet-map" />;
}

export default function Territory() {
  const navigate = useNavigate();
  const { isAuthenticated, authHydrated } = useAuth();
  const { t, lang } = useI18n();
  const [territory, setTerritory] = useState(null);
  const [polygonData, setPolygonData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recenterSignal, setRecenterSignal] = useState(0);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    let initialPolygonTimer = null;
    let polygonRefreshTimer = null;

    function scheduleInitialPolygonLoad() {
      if (initialPolygonTimer) {
        window.clearTimeout(initialPolygonTimer);
      }
      initialPolygonTimer = window.setTimeout(() => {
        initialPolygonTimer = null;
        loadTerritoryPolygons();
      }, TERRITORY_POLYGON_INITIAL_DELAY_MS);
    }

    async function loadTerritoryShellData() {
      try {
        const [profileData, territoryData] = await Promise.all([
          apiJson('/api/profile/me').catch(() => null),
          apiJson('/api/territory').catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(profileData && typeof profileData === 'object' ? profileData : null);
        setTerritory(territoryData?.available ? territoryData : EMPTY_TERRITORY);
        scheduleInitialPolygonLoad();
      } catch {
        if (!cancelled) {
          setTerritory(EMPTY_TERRITORY);
          scheduleInitialPolygonLoad();
        }
      }
    }

    async function loadTerritoryPolygons() {
      if (polygonRefreshTimer) {
        window.clearTimeout(polygonRefreshTimer);
        polygonRefreshTimer = null;
      }

      const polygonsData = await apiJson('/api/territory/polygons').catch(() => null);
      if (cancelled) return;

      setPolygonData(polygonsData && typeof polygonsData === 'object' ? polygonsData : null);
      if (shouldRefreshTerritoryPolygons(polygonsData)) {
        polygonRefreshTimer = window.setTimeout(loadTerritoryPolygons, TERRITORY_POLYGON_REFRESH_MS);
      }
    }

    loadTerritoryShellData();
    return () => {
      cancelled = true;
      if (initialPolygonTimer) {
        window.clearTimeout(initialPolygonTimer);
      }
      if (polygonRefreshTimer) {
        window.clearTimeout(polygonRefreshTimer);
      }
    };
  }, [authHydrated, isAuthenticated, navigate]);

  const polygons = useMemo(() => {
    const backendPolygons = Array.isArray(polygonData?.polygons) ? polygonData.polygons : [];
    const hasActiveBackendPolygon = backendPolygons.some((poly) => poly?.active === true);
    return hasActiveBackendPolygon ? backendPolygons : territoryCellFallbackPolygons(territory);
  }, [polygonData, territory]);
  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'territory' }),
    [lang, t],
  );
  const tc = (key) => mapChromeCopy(lang, key);
  const center = territory?.center || null;
  const initials = String(profile?.displayName || profile?.email || 'H').trim().slice(0, 1).toUpperCase() || 'H';
  const leaderboardRows = territoryLeaderboardRows(territory, profile);
  const activeLeader = activeTerritoryRunner(territory, profile);
  const rivalLeader = rivalTerritoryRunner(territory);
  const battleShares = territoryBattleShares(territory, activeLeader, rivalLeader);
  const activeName = runnerDisplayName(activeLeader, profile, tc('you'));
  const rivalName = runnerDisplayName(rivalLeader, null, tc('opponent'));
  const activeColor = safeColor(activeLeader?.color);
  const rivalColor = safeColor(rivalLeader?.color, '#82ffd8');
  const summary = territory?.summary || EMPTY_TERRITORY.summary;
  const ownedZones = ownedTerritoryZones(territory, activeName);
  const recentCaptures = recentCaptureRows(territory);
  const nextTarget = territory?.nextTarget || null;

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

            <aside
              className="terr-game-campaign-panel"
              aria-label={tc('campaignPanel')}
              style={{
                '--terr-active-color': activeColor,
                '--terr-rival-color': rivalColor,
              }}
            >
              <span className="terr-game-campaign-kicker">
                <AppIcon name="territory" />
                {tc('campaignKicker')}
              </span>
              <h1 className="terr-game-campaign-title">{tc('campaignTitle')}</h1>
              <p className="terr-game-campaign-body">{tc('campaignBody')}</p>
              <div className="terr-game-campaign-actions">
                <button type="button" className="terr-game-campaign-primary" onClick={() => navigate('/today-run')}>
                  {tc('startRun')}
                </button>
                <button type="button" className="terr-game-campaign-secondary" onClick={() => setRecenterSignal((value) => value + 1)}>
                  {tc('recenter')}
                </button>
              </div>
              <div className="terr-game-campaign-strip" aria-label={tc('targetPressure')}>
                <span>
                  <small>{tc('nextTarget')}</small>
                  <strong>{nextTarget?.name || rivalName}</strong>
                </span>
                <span>
                  <small>{tc('samplesToContest')}</small>
                  <strong>{formatSampleCount(nextTarget?.samplesToContest)} {tc('samples')}</strong>
                </span>
                <span>
                  <small>{tc('sectorValue')}</small>
                  <strong>{formatTerritoryArea(summary.areaKm2)}</strong>
                </span>
              </div>
            </aside>

            <div
              className="terr-game-hud"
              aria-label={tc('gameHud')}
              style={{
                '--terr-active-color': activeColor,
                '--terr-rival-color': rivalColor,
                '--terr-active-share': `${battleShares.active}%`,
                '--terr-rival-share': `${battleShares.rival}%`,
              }}
            >
              <div className="terr-game-mode-tabs" role="tablist" aria-label={tc('modeTabs')}>
                <span role="tab" aria-selected="false">{tc('myTerritories')}</span>
                <span role="tab" aria-selected="true">{tc('singlePlayer')}</span>
                <span role="tab" aria-selected="false">{tc('myClub')}</span>
              </div>

              <div className="terr-game-player-card">
                <span className="terr-game-alert" aria-hidden="true">
                  <AppIcon name="notifications" />
                </span>
                <span className="terr-game-player-avatar">{runnerInitials(activeName)}</span>
                <div className="terr-game-player-copy">
                  <strong>{activeName}</strong>
                  <span>
                    <AppIcon name="workspace_premium" />
                    {activeLeader?.active ? tc('kingOfArea') : tc('territoryRunner')}
                  </span>
                </div>
                <strong className="terr-game-area-score">{formatTerritoryArea(activeLeader?.areaKm2 ?? summary.areaKm2)}</strong>
              </div>

              <div className="terr-game-battle-card" aria-label={tc('localBattle')}>
                <div className="terr-game-battle-labels">
                  <span>{tc('you')}</span>
                  <strong>{tc('localBattle')}</strong>
                  <span>{tc('opponent')}</span>
                </div>
                <div className="terr-game-battle-meter" aria-hidden="true">
                  <span className="is-you" />
                  <span className="is-rival" />
                </div>
                <div className="terr-game-battle-names">
                  <span>{activeName}</span>
                  <span>{rivalName}</span>
                </div>
              </div>
            </div>

            <aside
              className="terr-game-territory-dock"
              aria-label={tc('playerTerritory')}
              style={{
                '--terr-active-color': activeColor,
                '--terr-rival-color': rivalColor,
                '--terr-active-share': `${battleShares.active}%`,
              }}
            >
              <section className="terr-game-dock-primary" aria-label={tc('controlledLand')}>
                <div className="terr-game-dock-heading">
                  <span>{tc('playerTerritory')}</span>
                  <strong>{formatTerritoryArea(summary.areaKm2)}</strong>
                </div>
                <div className="terr-game-dock-meter" aria-hidden="true">
                  <span />
                </div>
                <div className="terr-game-dock-metrics">
                  <span>
                    <small>{tc('coverage')}</small>
                    <strong>{formatTerritoryPercent(summary.coveragePct)}</strong>
                  </span>
                  <span>
                    <small>{tc('rank')}</small>
                    <strong>{formatTerritoryRank(summary)}</strong>
                  </span>
                  <span>
                    <small>{tc('zonesControlled')}</small>
                    <strong>{summary.cellCount || 0}</strong>
                  </span>
                </div>
              </section>

              <section className="terr-game-zone-panel" aria-label={tc('ownedSectors')}>
                <div className="terr-game-panel-title">
                  <strong>{tc('ownedSectors')}</strong>
                  <span>{ownedZones.length || summary.cellCount || 0}</span>
                </div>
                <div className="terr-game-zone-list">
                  {(ownedZones.length ? ownedZones : [{ name: tc('loadingTerritory'), controlPct: summary.coveragePct, areaKm2: summary.areaKm2 }]).map((zone, index) => (
                    <div
                      key={zone.id || zone.name || index}
                      className="terr-game-zone-row"
                    >
                      <span>
                        <strong>{zone.name || tc('territoriesTab')}</strong>
                        <small>{formatTerritoryArea(zone.areaKm2)}</small>
                      </span>
                      <em>{formatTerritoryPercent(zone.controlPct)}</em>
                    </div>
                  ))}
                </div>
              </section>

              <section className="terr-game-intel-panel" aria-label={tc('nextTarget')}>
                <div className="terr-game-target-card">
                  <span>{tc('nextTarget')}</span>
                  <strong>{nextTarget?.name || rivalName}</strong>
                  <small>
                    {tc('samplesToContest')}: {formatSampleCount(nextTarget?.samplesToContest)} {tc('samples')}
                  </small>
                </div>

                <div className="terr-game-capture-feed" aria-label={tc('captureFeed')}>
                  <div className="terr-game-panel-title">
                    <strong>{tc('captureFeed')}</strong>
                    <span>{recentCaptures.length}</span>
                  </div>
                  {(recentCaptures.length ? recentCaptures : [{ name: tc('loadingTerritory'), dateLabel: '--', sampleCount: 0 }]).map((capture, index) => (
                    <div key={`${capture.name || 'capture'}-${index}`} className="terr-game-capture-row">
                      <span>
                        <strong>{capture.name || tc('territoriesTab')}</strong>
                        <small>{capture.dateLabel || '--'}</small>
                      </span>
                      <em>{formatSampleCount(capture.sampleCount)}</em>
                    </div>
                  ))}
                </div>
              </section>

              <section className="terr-game-rival-stack" aria-label={tc('leaderboard')}>
                <div className="terr-game-panel-title">
                  <strong>{tc('leaderboard')}</strong>
                  <span>{tc('localBattle')}</span>
                </div>
                <div className="terr-game-leaderboard-list">
                  {leaderboardRows.slice(0, 3).map((runner, index) => {
                    const rowName = runnerDisplayName(runner, profile, tc('opponent'));
                    return (
                      <div
                        key={runner.id || `${rowName}-${index}`}
                        className={`terr-game-leaderboard-row${runner.active ? ' is-active' : ''}`}
                        style={{ '--terr-row-color': safeColor(runner.color, index % 2 === 0 ? '#5b9cf5' : '#86efac') }}
                      >
                        <strong className="terr-game-row-rank">{runner.rank || index + 1}</strong>
                        <span className="terr-game-row-avatar">{runnerInitials(rowName)}</span>
                        <span className="terr-game-row-name">
                          <strong>{rowName}</strong>
                          <small>{runner.active ? tc('you') : tc('opponent')}</small>
                        </span>
                        <strong className="terr-game-row-area">{formatTerritoryArea(runner.areaKm2)}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            </aside>

            <TerritoryMap
              territory={territory}
              polygons={polygons}
              showPolygons={polygons.length > 0}
              recenterSignal={recenterSignal}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

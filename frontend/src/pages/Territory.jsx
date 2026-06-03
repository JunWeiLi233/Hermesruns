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
    viewRuns: 'View runs',
    settings: 'Open settings',
  },
  'zh-CN': {
    pageTitle: '\u9886\u5730',
    recenter: '\u91cd\u65b0\u5c45\u4e2d',
    viewRuns: '\u67e5\u770b\u8dd1\u6b65\u8bb0\u5f55',
    settings: '\u6253\u5f00\u8bbe\u7f6e',
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


function safeColor(color, fallback = '#f07561') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : fallback;
}

function mapLayerColor(color, fallback = '#f07561') {
  const safe = safeColor(color, fallback);
  const normalized = safe.toLowerCase();
  const neonMap = {
    '#86efac': '#37ff7f',
    '#55d982': '#37ff7f',
    '#f07561': '#ff4f3f',
    '#ef4444': '#ff3b35',
    '#60a5fa': '#246bff',
    '#3b82f6': '#246bff',
    '#2563eb': '#244cff',
    '#facc15': '#fff15a',
    '#eab308': '#fff15a',
    '#22d3ee': '#53fff0',
    '#a855f7': '#b32cff',
    '#ec4899': '#ff1493',
  };
  return neonMap[normalized] || safe;
}

function mapChromeCopy(lang, key) {
  return MAP_CHROME_COPY[lang]?.[key] || MAP_CHROME_COPY.en[key] || key;
}

function formatCoordinate(value, positiveSuffix, negativeSuffix) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `0.000\u00b0${positiveSuffix}`;
  return `${Math.abs(numeric).toFixed(3)}\u00b0${numeric >= 0 ? positiveSuffix : negativeSuffix}`;
}

function formatCenterLabel(center) {
  const lat = formatCoordinate(center?.latitude, 'N', 'S');
  const lng = formatCoordinate(center?.longitude, 'E', 'W');
  return `${lat} / ${lng}`;
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

function escapeMarkerHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function moveTerritoryCamera(map, bounds, recenterSignal, center) {
  if (!map) return;

  if (recenterSignal > 0) {
    if (!bounds?.isValid?.()) return;
    map.flyToBounds(bounds, { padding: [34, 34], maxZoom: 14, duration: 0.8 });
    return;
  }

  const latitude = Number(center?.latitude);
  const longitude = Number(center?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    map.setView([latitude, longitude], territoryInitialZoom(center), { animate: false });
  }
}

function territoryInitialZoom(center) {
  const zoom = Number(center?.zoom);
  return Math.max(Number.isFinite(zoom) ? zoom : 14, 14);
}

/** Read the coral stroke color from CSS custom properties at runtime */
function getCoralStroke() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-coral-strong').trim() || '#f07561';
}

function paintTerritoryLandRegion(L, map, layer, region, options = {}) {
  const color = options.color || '#f07561';
  const active = Boolean(options.active);
  const renderer = options.renderer || L.svg({ padding: 0.65 });
  const className = options.className ? ` ${options.className}` : '';
  const coverageRegion = Array.isArray(options.coverageRegion) && options.coverageRegion.length >= 4
    ? options.coverageRegion
    : null;
  const contourRegion = Array.isArray(options.contourRegion) && options.contourRegion.length >= 4
    ? options.contourRegion
    : region;

  if (coverageRegion && coverageRegion !== region) {
    L.polygon(coverageRegion, {
      color,
      renderer,
      weight: 0,
      opacity: 0,
      stroke: false,
      fillColor: color,
      fillRule: 'nonzero',
      fillOpacity: active ? LAND_MASK_COVERAGE_LAND_OPACITY.active : LAND_MASK_COVERAGE_LAND_OPACITY.rival,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 0.35,
      className: `terr-land-mask-exact-underlay${className}`,
    }).addTo(layer);
  }

  const concreteLand = L.polygon(region, {
    color,
    renderer,
    weight: 0,
    opacity: 0,
    stroke: false,
    fillColor: color,
    fillRule: 'nonzero',
    fillOpacity: active ? LAND_MASK_CONCRETE_LAND_OPACITY.active : LAND_MASK_CONCRETE_LAND_OPACITY.rival,
    interactive: false,
    lineCap: 'round',
    lineJoin: 'round',
    smoothFactor: 0.35,
    className: `terr-land-mask-concrete-land${className}`,
  }).addTo(layer);

  const contourLine = L.polyline(contourRegion, {
    color,
    renderer,
    weight: LAND_MASK_CONTOUR_WEIGHT,
    opacity: LAND_MASK_CONTOUR_OPACITY,
    interactive: false,
    lineCap: 'round',
    lineJoin: 'round',
    smoothFactor: 0.35,
    className: `terr-land-mask-contour${className}`,
  }).addTo(layer);
}

const MAX_MASK_CELLS_TO_RENDER = 200000;
const TERRITORY_POLYGON_REFRESH_MS = 2500;
const TERRITORY_POLYGON_INITIAL_DELAY_MS = 120;
const METERS_PER_DEG_LAT = 111_320;
const LAND_MASK_RENDER_SUBDIVISION = 3;
const LAND_MASK_SUBDIVIDED_CELL_TILE_FACTOR = 9;
const LAND_MASK_SOURCE_BRUSH_RADIUS_RATIO = 1.45;
const LAND_MASK_TILE_OVERLAP_RATIO = 0.18;
const LAND_MASK_CONTOUR_SIMPLIFY_RATIO = 4;
const LAND_MASK_SMOOTHING_PASSES = 4;
const LAND_MASK_CURVE_PASSES = 2;
const LAND_MASK_SMALL_LOOP_POINT_LIMIT = 44;
const LAND_MASK_TINY_LOOP_POINT_LIMIT = 24;
const LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP = 3600;
const LAND_MASK_CORNER_RADIUS_RATIO = 4;
const LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS = 10;
const LAND_MASK_MIN_VISIBLE_COMPACTNESS = 0.032;
const LAND_MASK_MAX_VISIBLE_ASPECT_RATIO = 8;
const LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS = 1_200;
const LAND_MASK_CONTOUR_PRUNE_PASSES = 2;
const LAND_MASK_CONTOUR_PRUNE_MIN_NEIGHBORS = 3;
const LAND_MASK_CONTOUR_CORE_MIN_NEIGHBORS = 4;
const LAND_MASK_LARGE_COMPONENT_MIN_TILES = 40;
const LAND_MASK_CONTOUR_WEIGHT = 3;
const LAND_MASK_CONTOUR_OPACITY = 1;
const LAND_MASK_CONCRETE_LAND_OPACITY = { active: 0.42, rival: 0.34 };
const LAND_MASK_COVERAGE_LAND_OPACITY = { active: 0.22, rival: 0.18 };

function hasCoordinatePolygon(poly) {
  return Array.isArray(poly?.coordinates) && poly.coordinates.length >= 3;
}

function hasCellMaskPolygon(poly) {
  return Array.isArray(poly?.cells) && poly.cells.length > 0;
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
  // reverses that order so older land paints first and the newest claim becomes the top layer.
  return mergedPolygons;
}

function zoneCellCenter(cell) {
  const centerLat = Number(cell?.centerLat);
  const centerLng = Number(cell?.centerLng);
  if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
    return { latitude: centerLat, longitude: centerLng };
  }

  const polygon = Array.isArray(cell?.polygon) ? cell.polygon : [];
  const points = polygon
    .map((point) => [Number(point?.[0]), Number(point?.[1])])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
  if (!points.length) return null;

  return {
    latitude: points.reduce((total, point) => total + point[0], 0) / points.length,
    longitude: points.reduce((total, point) => total + point[1], 0) / points.length,
  };
}

function zoneCellMeters(cell) {
  const polygon = Array.isArray(cell?.polygon) ? cell.polygon : [];
  const points = polygon
    .map((point) => [Number(point?.[0]), Number(point?.[1])])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
  if (points.length < 3) return 720;

  const latitudes = points.map((point) => point[0]);
  const longitudes = points.map((point) => point[1]);
  const centerLatitude = latitudes.reduce((total, latitude) => total + latitude, 0) / latitudes.length;
  const cosLat = Math.max(1e-6, Math.abs(Math.cos((centerLatitude * Math.PI) / 180)));
  const heightMeters = (Math.max(...latitudes) - Math.min(...latitudes)) * METERS_PER_DEG_LAT;
  const widthMeters = (Math.max(...longitudes) - Math.min(...longitudes)) * METERS_PER_DEG_LAT * cosLat;
  const meters = Math.max(heightMeters, widthMeters);
  return Number.isFinite(meters) && meters > 0 ? meters : 720;
}

function fallbackZoneMaskPolygons(cells) {
  const groups = new Map();

  (Array.isArray(cells) ? cells : []).forEach((cell, index) => {
    const center = zoneCellCenter(cell);
    if (!center) return;

    const key = cell?.ownerId !== null && cell?.ownerId !== undefined
      ? `owner:${cell.ownerId}`
      : `owner-name:${String(cell?.ownerName || 'unclaimed').trim().toLowerCase()}:${safeColor(cell?.color)}:${index}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        id: key,
        ownerId: cell?.ownerId ?? null,
        ownerName: cell?.ownerName || 'Unclaimed',
        color: safeColor(cell?.color),
        active: isOwnedByActive(cell),
        className: cell.contested ? 'terr-contested-polygon' : null,
        cells: [],
        cellMeters: zoneCellMeters(cell),
      };
      groups.set(key, group);
    }

    group.active = Boolean(group.active || isOwnedByActive(cell));
    group.className = group.className || (cell.contested ? 'terr-contested-polygon' : null);
    group.color = group.active ? safeColor(cell?.color, group.color) : safeColor(group.color || cell?.color);
    group.cellMeters = Math.min(group.cellMeters, zoneCellMeters(cell));
    group.cells.push(center);
  });

  return Array.from(groups.values()).filter((poly) => poly.cells.length > 0);
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
  return (Array.isArray(polygons) ? polygons : []).map((poly) => {
    if (!hasCellMaskPolygon(poly)) {
      return { poly, tiles: null };
    }

    const tilesByKey = new Map();
    const concreteTiles = aggregateMaskCells(poly.cells, poly.cellMeters, renderGrid);
    concreteTiles.forEach((tile) => {
      tilesByKey.set(maskTileClaimKey(tile), tile);
    });

    return { poly, tiles: Array.from(tilesByKey.values()) };
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
    const componentRegions = maskBoundaryLoops(component, options)
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
      loop.push(maskVertexToLatLng(edge.from, tileMeters, cosLat));
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

function pairedVisibleMaskRegions(tiles, options = {}) {
  return maskTileConnectedComponents(tiles).flatMap((component) => {
    const exactRegions = maskBoundaryLoops(component, options)
      .filter((loop) => loop.length >= 4);

    return exactRegions.map((exactRegion) => {
      const smoothedRegions = visibleMaskStrokeRegions(
        visibleMaskContourRegions([exactRegion], options),
        options,
      );
      const visibleRegion = smoothedRegions[0] || exactRegion;
      return {
        coverageRegion: exactRegion,
        landRegion: visibleRegion,
        contourRegion: visibleRegion,
      };
    });
  });
}

function TerritoryMap({ territory, filter, leaderboard, polygons, showPolygons, recenterSignal }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let mountedMapContainer = null;

    async function mountMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;

      const center = territory?.center || DEMO_TERRITORY.center;
      const mapContainer = mapRef.current;
      mountedMapContainer = mapContainer;
      const map = L.map(mapContainer, {
        center: [center.latitude, center.longitude],
        zoom: territoryInitialZoom(center),
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      });

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
  }, []);

  // Paint zone/territory polygons (existing zone view).
  // Base repaint contract: [territory, filter, leaderboard, mapReady, showPolygons].
  useEffect(() => {
    let cancelled = false;

    async function paintTerritories() {
      const map = mapInstanceRef.current;
      if (!mapReady || !map) return;
      const L = await loadLeaflet();
      if (cancelled) return;

      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
      if (showPolygons) return;
      const layer = L.layerGroup().addTo(map);
      const cells = Array.isArray(territory?.territories) ? territory.territories : [];
      const visibleCells = cells.filter((cell) => {
        if (filter === 'mine') return isOwnedByActive(cell);
        if (filter === 'contested') return cell.contested;
        if (filter === 'unclaimed') return !cell.ownerName;
        return true;
      }).filter((cell) => Array.isArray(cell?.polygon) && cell.polygon.length >= 3);

      const fallbackPolygons = fallbackZoneMaskPolygons(visibleCells);
      const fallbackRenderGrid = territoryMaskRenderGrid(fallbackPolygons);
      const fallbackRenderEntries = resolveMaskTileOwnership(fallbackPolygons, fallbackRenderGrid).slice().reverse();
      const fallbackGlobalOccupied = new Set(fallbackRenderEntries.flatMap(({ tiles }) => (
        Array.isArray(tiles) ? tiles.map((tile) => maskTileClaimKey(tile)) : []
      )));
      const fallbackContourEntries = fallbackRenderEntries.flatMap(({ poly, tiles }) => {
        if (!Array.isArray(tiles) || !tiles.length) return [];

        const tileMeters = Number(tiles?.[0]?.tileMeters);
        const cosLat = Number(tiles?.[0]?.cosLat);
        const sourceCellMeters = Number(fallbackRenderGrid.sourceCellMeters);
        const pairedRegions = pairedVisibleMaskRegions(tiles, {
          tileMeters,
          sourceCellMeters,
          cosLat,
          globalOccupied: fallbackGlobalOccupied,
        });
        return [{
          active: Boolean(poly.active),
          color: mapLayerColor(poly.color),
          className: poly.className || null,
          coverageRegions: pairedRegions.map((region) => region.coverageRegion),
          landRegions: pairedRegions.map((region) => region.landRegion),
          contourRegions: pairedRegions.map((region) => region.contourRegion),
        }];
      });

      fallbackContourEntries.forEach(({ active, color, className, coverageRegions, landRegions, contourRegions }) => {
        landRegions.forEach((region, index) => {
          paintTerritoryLandRegion(L, map, layer, region, {
            active,
            color,
            className,
            coverageRegion: coverageRegions?.[index],
            contourRegion: contourRegions[index] || region,
          });
        });
      });

      runnerMarkerPositions(territory, leaderboard).forEach((runner) => {
        const color = mapLayerColor(runner.color);
        const size = runner.active ? 30 : 24;
        const initial = String(runner.name || 'R').trim().slice(0, 1).toUpperCase();
        const icon = L.divIcon({
          className: 'terr-marker',
          html: `<div class="terr-runner-marker${runner.active ? ' terr-runner-marker--active' : ''}" style="--terr-runner-color:${color};--terr-rival-delay:${(Number(runner.id) || 0) * 0.18}s;">${escapeMarkerHtml(initial)}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker(runner.position, {
          icon,
          zIndexOffset: runner.active ? 1000 : 0,
        }).addTo(layer);
      });

      if (visibleCells.length > 0) {
        const bounds = L.latLngBounds(visibleCells.flatMap((cell) => cell.polygon));
        moveTerritoryCamera(map, bounds, recenterSignal, territory?.center || DEMO_TERRITORY.center);
      }
      layerRef.current = layer;
    }

    paintTerritories();
    return () => {
      cancelled = true;
    };
  }, [territory, filter, leaderboard, mapReady, showPolygons, recenterSignal]);

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
      const visualRenderer = L.svg({ padding: 0.65 });

      const allCoords = [];
      const ownerPolygons = mergeCellMaskPolygonsByOwner(polygons);
      const renderGrid = territoryMaskRenderGrid(ownerPolygons);
      const renderEntries = resolveMaskTileOwnership(ownerPolygons, renderGrid).slice().reverse();
      const globalOccupied = new Set(renderEntries.flatMap(({ tiles }) => (
        Array.isArray(tiles) ? tiles.map((tile) => maskTileClaimKey(tile)) : []
      )));
      const contourRenderEntries = [];
      renderEntries.forEach(({ poly, tiles }) => {
        const color = mapLayerColor(poly.color, strokeColor);

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
        const pairedRegions = pairedVisibleMaskRegions(tiles, {
          tileMeters,
          sourceCellMeters,
          cosLat,
          globalOccupied,
        });
        exactRegions.forEach((region) => {
          region.forEach((coord) => allCoords.push(coord));
        });

        contourRenderEntries.push({
          active: Boolean(poly.active),
          color,
          borderColor: color,
          coverageRegions: pairedRegions.map((region) => region.coverageRegion),
          landRegions: pairedRegions.map((region) => region.landRegion),
          contourRegions: pairedRegions.map((region) => region.contourRegion),
        });
      });

      contourRenderEntries.forEach(({ active, color, coverageRegions, landRegions, contourRegions }) => {
        landRegions.forEach((region, index) => {
          paintTerritoryLandRegion(L, map, layer, region, {
            active,
            color,
            renderer: visualRenderer,
            coverageRegion: coverageRegions?.[index],
            contourRegion: contourRegions[index] || region,
          });
        });
      });

      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        moveTerritoryCamera(map, bounds, recenterSignal, territory?.center || DEMO_TERRITORY.center);
      }

      polygonLayerRef.current = layer;
    }

    paintPolygons();
    return () => {
      cancelled = true;
    };
  }, [polygons, showPolygons, mapReady, recenterSignal, territory?.center]);

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
        setTerritory(territoryData?.available ? territoryData : DEMO_TERRITORY);
        scheduleInitialPolygonLoad();
      } catch {
        if (!cancelled) {
          setTerritory(DEMO_TERRITORY);
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

  const leaderboard = territory?.leaderboard?.length ? territory.leaderboard : DEMO_TERRITORY.leaderboard;
  const polygons = useMemo(() => polygonData?.polygons || [], [polygonData]);
  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'territory' }),
    [lang, t],
  );
  const tc = (key) => mapChromeCopy(lang, key);
  const center = territory?.center || DEMO_TERRITORY.center;
  const initials = String(profile?.displayName || profile?.email || 'H').trim().slice(0, 1).toUpperCase() || 'H';

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
                  <strong>{formatCenterLabel(center)}</strong>
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
              filter="all"
              leaderboard={leaderboard}
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

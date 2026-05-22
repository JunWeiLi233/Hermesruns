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
    pageTitle: '领地',
    recenter: '重新居中',
    viewRuns: '查看跑步记录',
    settings: '打开设置',
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

function mapChromeCopy(lang, key) {
  return MAP_CHROME_COPY[lang]?.[key] || MAP_CHROME_COPY.en[key] || key;
}

function formatCoordinate(value, positiveSuffix, negativeSuffix) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `0.000°${positiveSuffix}`;
  return `${Math.abs(numeric).toFixed(3)}°${numeric >= 0 ? positiveSuffix : negativeSuffix}`;
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

function contestShare(zone) {
  const raw = Number(zone?.sampleCount || 0);
  const owner = Math.min(72, Math.max(56, raw || 62));
  return { owner, challenger: 100 - owner };
}

/** Read the coral stroke color from CSS custom properties at runtime */
function getCoralStroke() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-coral-strong').trim() || '#f07561';
}

const MAX_MASK_CELLS_TO_RENDER = 14000;
const TERRITORY_POLYGON_REFRESH_MS = 2500;
const METERS_PER_DEG_LAT = 111_320;
const LAND_MASK_TILE_OVERLAP_RATIO = 0.18;

function hasCoordinatePolygon(poly) {
  return Array.isArray(poly?.coordinates) && poly.coordinates.length >= 3;
}

function hasCellMaskPolygon(poly) {
  return Array.isArray(poly?.cells) && poly.cells.length > 0;
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

function aggregateMaskCells(cells, cellMeters) {
  const validCells = (Array.isArray(cells) ? cells : [])
    .map((cell) => ({
      latitude: Number(cell?.latitude),
      longitude: Number(cell?.longitude),
    }))
    .filter((cell) => Number.isFinite(cell.latitude) && Number.isFinite(cell.longitude));

  if (!validCells.length) return [];

  const sourceCellMeters = Number(cellMeters);
  const baseCellMeters = Number.isFinite(sourceCellMeters) && sourceCellMeters > 0 ? sourceCellMeters : 36;
  const bucketScale = Math.max(1, Math.ceil(Math.sqrt(validCells.length / MAX_MASK_CELLS_TO_RENDER)));
  const tileMeters = baseCellMeters * bucketScale;
  const refLat = validCells[0].latitude;
  const cosLat = Math.max(1e-6, Math.abs(Math.cos((refLat * Math.PI) / 180)));
  const tiles = new Map();

  validCells.forEach((cell) => {
    const gridY = Math.round((cell.latitude * METERS_PER_DEG_LAT) / tileMeters);
    const gridX = Math.round((cell.longitude * METERS_PER_DEG_LAT * cosLat) / tileMeters);
    const key = `${gridY}:${gridX}`;
    if (tiles.has(key)) return;

    const latitude = (gridY * tileMeters) / METERS_PER_DEG_LAT;
    const longitude = (gridX * tileMeters) / (METERS_PER_DEG_LAT * cosLat);
    tiles.set(key, {
      gridX,
      gridY,
      latitude,
      longitude,
      tileMeters,
      cosLat,
      bounds: sealedMaskTileBounds(latitude, longitude, tileMeters, cosLat),
    });
  });

  return Array.from(tiles.values());
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

function maskBoundaryLoops(tiles) {
  if (!Array.isArray(tiles) || !tiles.length) return [];

  const tileMeters = Number(tiles[0]?.tileMeters);
  const cosLat = Number(tiles[0]?.cosLat);
  if (!Number.isFinite(tileMeters) || tileMeters <= 0 || !Number.isFinite(cosLat) || cosLat <= 0) return [];

  const occupied = new Set(
    tiles
      .filter((tile) => Number.isFinite(tile?.gridX) && Number.isFinite(tile?.gridY))
      .map((tile) => `${tile.gridY}:${tile.gridX}`),
  );
  const edgeRecords = [];

  const addEdge = (from, to) => {
    edgeRecords.push({
      key: `${maskVertexKey(from)}>${maskVertexKey(to)}`,
      from,
      to,
    });
  };

  tiles.forEach((tile) => {
    if (!Number.isFinite(tile?.gridX) || !Number.isFinite(tile?.gridY)) return;

    const { gridX, gridY } = tile;
    const west = (gridX * 2) - 1;
    const east = (gridX * 2) + 1;
    const south = (gridY * 2) - 1;
    const north = (gridY * 2) + 1;

    if (!occupied.has(`${gridY + 1}:${gridX}`)) addEdge({ x: west, y: north }, { x: east, y: north });
    if (!occupied.has(`${gridY}:${gridX + 1}`)) addEdge({ x: east, y: north }, { x: east, y: south });
    if (!occupied.has(`${gridY - 1}:${gridX}`)) addEdge({ x: east, y: south }, { x: west, y: south });
    if (!occupied.has(`${gridY}:${gridX - 1}`)) addEdge({ x: west, y: south }, { x: west, y: north });
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

function routeTraceLatLngs(trace) {
  return (Array.isArray(trace?.points) ? trace.points : [])
    .map((point) => [Number(point?.latitude), Number(point?.longitude)])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
}

/**
 * Groups mask cells into connected components (4-neighbour adjacency on the source grid) and
 * returns one centroid per cluster. Used to anchor a pixel-radius marker per cluster so the
 * territory stays visible when zooming far enough out that the geographic-meter tiles become
 * sub-pixel and disappear from the Leaflet canvas.
 */
function buildOwnedClusters(cells, cellMeters) {
  if (!Array.isArray(cells) || cells.length === 0) return [];
  const meters = Number(cellMeters);
  if (!Number.isFinite(meters) || meters <= 0) return [];

  const refLat = Number(cells[0]?.latitude);
  if (!Number.isFinite(refLat)) return [];
  const cosLat = Math.max(1e-6, Math.abs(Math.cos((refLat * Math.PI) / 180)));

  const positions = new Map();
  const grid = new Array(cells.length);
  for (let i = 0; i < cells.length; i += 1) {
    const lat = Number(cells[i]?.latitude);
    const lng = Number(cells[i]?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      grid[i] = null;
      continue;
    }
    const gx = Math.round((lng * METERS_PER_DEG_LAT * cosLat) / meters);
    const gy = Math.round((lat * METERS_PER_DEG_LAT) / meters);
    positions.set(`${gx}:${gy}`, i);
    grid[i] = { gx, gy, lat, lng };
  }

  const parent = new Int32Array(cells.length);
  for (let i = 0; i < parent.length; i += 1) parent[i] = i;
  const find = (x) => {
    let cur = x;
    while (parent[cur] !== cur) {
      parent[cur] = parent[parent[cur]];
      cur = parent[cur];
    }
    return cur;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < grid.length; i += 1) {
    const c = grid[i];
    if (!c) continue;
    const east = positions.get(`${c.gx + 1}:${c.gy}`);
    const north = positions.get(`${c.gx}:${c.gy + 1}`);
    if (Number.isInteger(east)) union(i, east);
    if (Number.isInteger(north)) union(i, north);
  }

  const clusterMap = new Map();
  for (let i = 0; i < grid.length; i += 1) {
    const c = grid[i];
    if (!c) continue;
    const root = find(i);
    let cluster = clusterMap.get(root);
    if (!cluster) {
      cluster = { sumLat: 0, sumLng: 0, count: 0 };
      clusterMap.set(root, cluster);
    }
    cluster.sumLat += c.lat;
    cluster.sumLng += c.lng;
    cluster.count += 1;
  }

  return Array.from(clusterMap.values())
    .map((cluster) => ({
      lat: cluster.sumLat / cluster.count,
      lng: cluster.sumLng / cluster.count,
      count: cluster.count,
    }))
    .sort((a, b) => b.count - a.count);
}

function TerritoryMap({ territory, filter, leaderboard, polygons, showPolygons, recenterSignal }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

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
      setMapReady(true);
    }

    mountMap();
    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Paint zone/territory polygons (existing zone view)
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
  }, [territory, filter, leaderboard, mapReady, showPolygons]);

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

      const allCoords = [];
      polygons.forEach((poly) => {
        const areaKm2 = ((poly.areaSquareMeters || 0) / 1_000_000).toFixed(2);
        const color = safeColor(poly.color, strokeColor);

        if (hasCoordinatePolygon(poly)) {
          L.polygon(poly.coordinates, {
            color,
            weight: 2,
            opacity: 0.88,
            fillColor: color,
            fillOpacity: 0.22,
          }).bindTooltip(`${areaKm2} km虏`).addTo(layer);
          poly.coordinates.forEach((coord) => allCoords.push(coord));
          return;
        }

        if (!hasCellMaskPolygon(poly)) return;

        const tiles = aggregateMaskCells(poly.cells, poly.cellMeters);
        (Array.isArray(poly.routeTraces) ? poly.routeTraces : []).forEach((trace) => {
          const points = routeTraceLatLngs(trace);
          if (points.length < 2) return;
          points.forEach((coord) => allCoords.push(coord));
        });

        // Anchor circleMarkers per connected cluster — pixel-radius shapes that keep the
        // territory visible at very low zoom levels where the geographic-meter tiles below
        // become sub-pixel and stop painting. Added before tiles so the tile fill covers them
        // at high zoom (Leaflet canvas draws shapes in add order).
        buildOwnedClusters(poly.cells, poly.cellMeters).forEach((cluster) => {
          const radius = Math.max(4, Math.min(10, Math.sqrt(cluster.count) * 0.45));
          L.circleMarker([cluster.lat, cluster.lng], {
            radius,
            fillColor: color,
            color: 'rgba(13, 13, 13, 0.55)',
            weight: 1.25,
            opacity: 0.9,
            fillOpacity: poly.active ? 0.85 : 0.5,
            interactive: false,
            className: 'terr-land-mask-anchor',
          }).addTo(layer);
        });

        tiles.forEach((tile) => {
          const coord = [tile.latitude, tile.longitude];
          allCoords.push(coord);
          L.rectangle(tile.bounds, {
            color,
            weight: 0,
            stroke: false,
            fillColor: color,
            fillOpacity: poly.active ? 0.9 : 0.46,
            interactive: false,
            className: 'terr-land-mask-tile',
          }).addTo(layer);
        });

        const shouldDrawConcreteBorder = !poly.active || tiles.length >= 1500;
        if (shouldDrawConcreteBorder) {
          maskBoundaryLoops(tiles).forEach((loop) => {
            L.polyline(loop, {
              color,
              weight: poly.active ? 8 : 6,
              opacity: poly.active ? 0.16 : 0.11,
              lineCap: 'round',
              lineJoin: 'round',
              smoothFactor: 1.35,
              interactive: false,
              className: 'terr-land-mask-border-halo',
            }).addTo(layer);

            L.polyline(loop, {
              color,
              weight: poly.active ? 2.75 : 2.1,
              opacity: poly.active ? 0.8 : 0.62,
              lineCap: 'round',
              lineJoin: 'round',
              smoothFactor: 1.35,
              interactive: false,
              className: 'terr-land-mask-border',
            }).addTo(layer);
          });
        }
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
    let polygonRefreshTimer = null;
    async function loadTerritoryData() {
      if (polygonRefreshTimer) {
        window.clearTimeout(polygonRefreshTimer);
        polygonRefreshTimer = null;
      }

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

        if (shouldRefreshTerritoryPolygons(polygonsData)) {
          polygonRefreshTimer = window.setTimeout(loadTerritoryData, TERRITORY_POLYGON_REFRESH_MS);
        }
      } catch {
        if (!cancelled) {
          setTerritory(DEMO_TERRITORY);
        }
      }
    }

    loadTerritoryData();
    return () => {
      cancelled = true;
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
              showPolygons
              recenterSignal={recenterSignal}
            />
          </section>
        </div>
      </main>
    </div>
  );
}


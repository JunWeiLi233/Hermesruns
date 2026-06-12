#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(root, 'backend', 'src', 'main', 'resources', 'static');
const port = Number(process.env.TERRITORY_PROOF_PORT || 8092);
const host = '127.0.0.1';
const center = { latitude: 40.7368, longitude: -73.8235, zoom: 15 };
const cellMeters = 10;
const cosLat = Math.max(1e-6, Math.abs(Math.cos((center.latitude * Math.PI) / 180)));

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.map', 'application/json; charset=utf-8'],
]);

function cellAt(gridX, gridY) {
  return {
    latitude: center.latitude + ((gridY * cellMeters) / 111_320),
    longitude: center.longitude + ((gridX * cellMeters) / (111_320 * cosLat)),
  };
}

function rectangleCells(minX, maxX, minY, maxY, include = () => true) {
  const cells = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (include(x, y)) {
        cells.push(cellAt(x, y));
      }
    }
  }
  return cells;
}

function uniqueCells(cells) {
  const seen = new Set();
  return cells.filter((cell) => {
    const key = `${cell.latitude.toFixed(7)}:${cell.longitude.toFixed(7)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function blobCells(minX, maxX, minY, maxY, include) {
  const cells = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (include(x, y)) {
        cells.push(cellAt(x, y));
      }
    }
  }
  return uniqueCells(cells);
}

function ellipseCells(centerX, centerY, radiusX, radiusY, wobble = 0, trim = () => false) {
  const minX = Math.floor(centerX - radiusX - 3);
  const maxX = Math.ceil(centerX + radiusX + 3);
  const minY = Math.floor(centerY - radiusY - 3);
  const maxY = Math.ceil(centerY + radiusY + 3);
  return blobCells(minX, maxX, minY, maxY, (x, y) => {
    const dx = (x - centerX) / radiusX;
    const dy = (y - centerY) / radiusY;
    const ripple = wobble * Math.sin((x * 0.19) + (y * 0.11));
    return ((dx * dx) + (dy * dy)) <= 1 + ripple && !trim(x, y);
  });
}

function capsuleCells(x1, y1, x2, y2, radius, trim = () => false) {
  const minX = Math.floor(Math.min(x1, x2) - radius - 3);
  const maxX = Math.ceil(Math.max(x1, x2) + radius + 3);
  const minY = Math.floor(Math.min(y1, y2) - radius - 3);
  const maxY = Math.ceil(Math.max(y1, y2) + radius + 3);
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lengthSquared = (vx * vx) + (vy * vy);
  return blobCells(minX, maxX, minY, maxY, (x, y) => {
    const t = lengthSquared > 0
      ? Math.max(0, Math.min(1, (((x - x1) * vx) + ((y - y1) * vy)) / lengthSquared))
      : 0;
    const px = x1 + (vx * t);
    const py = y1 + (vy * t);
    const dx = x - px;
    const dy = y - py;
    const width = radius + (Math.sin(y * 0.16) * 1.8);
    return ((dx * dx) + (dy * dy)) <= width * width && !trim(x, y);
  });
}

function polygonCells(points, trim = () => false) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.floor(Math.min(...xs) - 2);
  const maxX = Math.ceil(Math.max(...xs) + 2);
  const minY = Math.floor(Math.min(...ys) - 2);
  const maxY = Math.ceil(Math.max(...ys) + 2);

  return blobCells(minX, maxX, minY, maxY, (x, y) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      const crosses = ((yi > y) !== (yj > y))
        && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9)) + xi);
      if (crosses) inside = !inside;
    }
    return inside && !trim(x, y);
  });
}

function unionCells(...groups) {
  return uniqueCells(groups.flat());
}

function routePointAt(gridX, gridY) {
  const cell = cellAt(gridX, gridY);
  return {
    latitude: cell.latitude,
    longitude: cell.longitude,
  };
}

function ownerPolygon({ id, ownerId, ownerName, color, active, cells, routeTraces = [] }) {
  return {
    id,
    ownerId,
    ownerName,
    color,
    active,
    cellMeters,
    areaSquareMeters: cells.length * cellMeters * cellMeters,
    cells,
    routeTraces,
  };
}

function mockPolygons() {
  const redCorridor = unionCells(
    capsuleCells(0, -116, 0, 118, 13.2),
    polygonCells([[-22, -54], [22, -55], [31, -18], [23, 19], [25, 58], [7, 76], [-23, 58], [-21, 18], [-31, -18]]),
    capsuleCells(-9, -96, 9, 96, 6.4),
  );
  const blueNorth = unionCells(
    ellipseCells(-66, 59, 55, 31, 0.11, (x, y) => x > -12 && y < 43),
    ellipseCells(68, 59, 55, 31, 0.11, (x, y) => x < 12 && y < 43),
  );
  const yellowSouth = unionCells(
    ellipseCells(-68, -58, 62, 37, 0.09, (x, y) => x > -10 && y > -88),
    ellipseCells(68, -58, 62, 37, 0.09, (x, y) => x < 10 && y > -88),
  );

  // Newest occupation first: red must claim the corridor where masks conflict.
  return [
    ownerPolygon({
      id: 'red-latest',
      ownerId: 1,
      ownerName: 'Latest Runner',
      color: '#f07561',
      active: true,
      cells: redCorridor,
      routeTraces: [{
        activityId: 9001,
        routeRadiusMeters: 18,
        createdAt: '2026-06-02T12:00:00Z',
        points: [
          routePointAt(-2, -72),
          routePointAt(-1, -40),
          routePointAt(0, -14),
          routePointAt(2, 14),
          routePointAt(2, 42),
          routePointAt(4, 66),
        ],
      }],
    }),
    ownerPolygon({ id: 'blue-north', ownerId: 2, ownerName: 'Blue Rival', color: '#5b9cf5', active: false, cells: blueNorth }),
    ownerPolygon({ id: 'yellow-south', ownerId: 3, ownerName: 'Gold Rival', color: '#fbbf24', active: false, cells: yellowSouth }),
  ];
}

const polygons = mockPolygons();

function json(response, body) {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function injectProofBootstrap(html) {
  const bootstrap = `
<script>
localStorage.setItem('hermes_jwt', 'territory-proof-token');
localStorage.setItem('hermes_email', 'strava+140971747@hermes.local');
localStorage.setItem('hermes_role', 'USER');
{
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url && url.startsWith('http://localhost:8080/api/')) {
      return nativeFetch(url.replace('http://localhost:8080', 'http://${host}:${port}'), init);
    }
    return nativeFetch(input, init);
  };
}
</script>`;
  return html.replace('</head>', `${bootstrap}\n</head>`);
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(extension) || 'application/octet-stream',
    });
    response.end(extension === '.html' ? injectProofBootstrap(data.toString('utf8')) : data);
  });
}

function routeApi(request, response) {
  if (request.url === '/api/auth/protected/ping') {
    json(response, { email: 'strava+140971747@hermes.local', role: 'USER', admin: false });
    return;
  }
  if (request.url === '/api/profile/me') {
    json(response, { email: 'strava+140971747@hermes.local', displayName: 'Territory Proof Runner' });
    return;
  }
  if (request.url === '/api/territory') {
    json(response, {
      available: true,
      mode: 'proof',
      center,
      summary: { areaKm2: 1.7, cellCount: 455, coveragePct: 74, rank: 1, totalRunners: 3 },
      leaderboard: [
        { id: 1, name: 'Latest Runner', color: '#f07561', active: true, cellCount: 110, areaKm2: 0.14 },
        { id: 2, name: 'Blue Rival', color: '#5b9cf5', active: false, cellCount: 170, areaKm2: 0.22 },
        { id: 3, name: 'Gold Rival', color: '#fbbf24', active: false, cellCount: 175, areaKm2: 0.23 },
      ],
      territories: [],
      zones: [],
      recentCaptures: [],
    });
    return;
  }
  if (request.url === '/api/territory/polygons') {
    json(response, {
      polygons,
      polygonCount: polygons.length,
      totalAreaSquareMeters: polygons.reduce((sum, polygon) => sum + polygon.areaSquareMeters, 0),
      backfillInProgress: false,
      pendingActivityCount: 0,
    });
    return;
  }
  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'not_found' }));
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/')) {
    routeApi(request, response);
    return;
  }

  const pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  const normalized = path.normalize(pathname).replace(/^([/\\])+/, '');
  const candidate = path.join(staticRoot, normalized || 'index.html');
  const resolved = path.resolve(candidate);

  if (!resolved.startsWith(path.resolve(staticRoot))) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.stat(resolved, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(response, resolved);
      return;
    }
    sendFile(response, path.join(staticRoot, 'index.html'));
  });
});

server.listen(port, host, () => {
  console.log(`territory proof server listening on http://${host}:${port}`);
});

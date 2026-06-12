import { chromium } from '../node_modules/playwright/index.mjs';

const baseUrl = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:8080';

const email = process.env.HERMES_VERIFY_EMAIL || 'strava+140971747@hermes.local';
const password = process.env.HERMES_VERIFY_PASSWORD || 'HermesDev2026!';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function distanceMeters(left, right) {
  const leftLat = Number(left?.latitude);
  const leftLng = Number(left?.longitude);
  const rightLat = Number(right?.latitude);
  const rightLng = Number(right?.longitude);
  if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }
  const metersPerDegLat = 111_320;
  const cosLat = Math.cos((((leftLat + rightLat) * 0.5) * Math.PI) / 180);
  return Math.hypot((rightLng - leftLng) * cosLat * metersPerDegLat, (rightLat - leftLat) * metersPerDegLat);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(30_000);

  const login = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  const loginBody = await login.json().catch(() => ({}));
  assert(login.ok() && loginBody.token, `login failed ${login.status()}`);

  const polygonResponse = await page.request.get(`${baseUrl}/api/territory/polygons`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  const polygonData = await polygonResponse.json().catch(() => ({}));
  assert(polygonResponse.ok(), `territory polygons failed ${polygonResponse.status()}`);

  const activePolygons = Array.isArray(polygonData?.polygons)
    ? polygonData.polygons.filter((polygon) => polygon?.active === true)
    : [];
  const activeCells = activePolygons.flatMap((polygon) => (
    Array.isArray(polygon.cells) ? polygon.cells : []
  ));

  await page.addInitScript(({ token, userEmail }) => {
    localStorage.setItem('hermes_jwt', token);
    localStorage.setItem('hermes_email', userEmail);
    localStorage.setItem('hermes_role', 'USER');
    localStorage.setItem('hermes_lang', 'zh-CN');
    sessionStorage.setItem('hermes_strava_auto_sync_at', String(Date.now()));
  }, { token: loginBody.token, userEmail: email });

  await page.goto(`${baseUrl}/territory?proof=cell-render`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('.terr-leaflet-map')?.__hermesTerritoryMap, { timeout: 45_000 });

  if (activeCells.length === 0) {
    const proof = await page.evaluate(() => ({
      url: location.href,
      mapZoom: document.querySelector('.terr-leaflet-map')?.__hermesTerritoryMap?.getZoom?.() ?? null,
      activePathCount: document.querySelectorAll('.terr-land-mask-concrete-land--active').length,
      activeContourCount: document.querySelectorAll('.terr-land-mask-contour--active').length,
      totalBackendCells: 0,
      visibleBackendCells: 0,
      sampledBackendCells: 0,
      missingCellCount: 0,
    }));
    assert(proof.activePathCount === 0, `frontend rendered false active territory fill without backend cells: ${JSON.stringify(proof)}`);
    assert(proof.activeContourCount === 0, `frontend rendered false active territory contour without backend cells: ${JSON.stringify(proof)}`);
    console.log(JSON.stringify({
      ok: true,
      etag: polygonResponse.headers()['etag'] || null,
      proof,
    }, null, 2));
    await browser.close();
    process.exit(0);
  }

  const proof = await page.evaluate(({ cells }) => {
    const mapEl = document.querySelector('.terr-leaflet-map');
    const map = mapEl?.__hermesTerritoryMap;
    const activePaths = Array.from(document.querySelectorAll('.terr-land-mask-concrete-land--active'));
    const mapRect = mapEl.getBoundingClientRect();
    const visibleCells = cells.filter((cell) => {
      const point = map.latLngToContainerPoint([Number(cell.latitude), Number(cell.longitude)]);
      return point.x >= 0 && point.y >= 0 && point.x <= mapRect.width && point.y <= mapRect.height;
    });
    const sampleStride = Math.max(1, Math.floor(visibleCells.length / 600));
    const sampledCells = visibleCells.filter((_, index) => index % sampleStride === 0).slice(0, 700);

    function pointInActiveFill(containerPoint) {
      const screenPoint = new DOMPoint(mapRect.left + containerPoint.x, mapRect.top + containerPoint.y);
      return activePaths.some((path) => {
        try {
          const matrix = path.getScreenCTM?.();
          return Boolean(matrix && path.isPointInFill?.(screenPoint.matrixTransform(matrix.inverse())));
        } catch {
          return false;
        }
      });
    }

    const missingCells = sampledCells.filter((cell) => {
      const point = map.latLngToContainerPoint([Number(cell.latitude), Number(cell.longitude)]);
      return !pointInActiveFill(point);
    });

    const filledSamples = [];
    const gridColumns = 36;
    const gridRows = 24;
    for (let yIndex = 0; yIndex < gridRows; yIndex += 1) {
      for (let xIndex = 0; xIndex < gridColumns; xIndex += 1) {
        const x = ((xIndex + 0.5) * mapRect.width) / gridColumns;
        const y = ((yIndex + 0.5) * mapRect.height) / gridRows;
        if (!pointInActiveFill({ x, y })) continue;
        const latLng = map.containerPointToLatLng([x, y]);
        filledSamples.push({ latitude: latLng.lat, longitude: latLng.lng });
      }
    }

    return {
      url: location.href,
      mapZoom: map.getZoom(),
      activePathCount: activePaths.length,
      activeMoveCommands: (activePaths[0]?.getAttribute('d') || '').match(/M/g)?.length || 0,
      totalBackendCells: cells.length,
      visibleBackendCells: visibleCells.length,
      sampledBackendCells: sampledCells.length,
      missingCellCount: missingCells.length,
      missingCellSample: missingCells.slice(0, 12),
      filledSampleCount: filledSamples.length,
      filledSamples,
    };
  }, { cells: activeCells });

  const wrongFillDistances = proof.filledSamples
    .map((point) => Math.min(...activeCells.map((cell) => distanceMeters(point, cell))))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const percentile = (ratio) => (
    wrongFillDistances.length
      ? wrongFillDistances[Math.min(wrongFillDistances.length - 1, Math.floor(wrongFillDistances.length * ratio))]
      : null
  );
  const wrongFillProof = {
    samples: wrongFillDistances.length,
    p50: percentile(0.5) == null ? null : Math.round(percentile(0.5)),
    p90: percentile(0.9) == null ? null : Math.round(percentile(0.9)),
    max: wrongFillDistances.length ? Math.round(wrongFillDistances[wrongFillDistances.length - 1]) : null,
    over48m: wrongFillDistances.filter((distance) => distance > 48).length,
  };

  assert(
    proof.sampledBackendCells >= 20,
    `not enough visible backend cells sampled: ${JSON.stringify(proof)}`,
  );
  assert(
    proof.missingCellCount === 0,
    `rendered active fill has gaps over backend-owned cells: ${JSON.stringify(proof.missingCellSample)}`,
  );
  assert(
    wrongFillProof.samples === 0 || wrongFillProof.p90 <= 48,
    `rendered active fill contains territory far from backend cells: ${JSON.stringify(wrongFillProof)}`,
  );

  console.log(JSON.stringify({
    ok: true,
    etag: polygonResponse.headers()['etag'] || null,
    proof: {
      ...proof,
      filledSamples: undefined,
      wrongFillNearestBackendCellMeters: wrongFillProof,
    },
  }, null, 2));
} finally {
  await browser.close();
}

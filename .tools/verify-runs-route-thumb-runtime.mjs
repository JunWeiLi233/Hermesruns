import { chromium } from '../node_modules/playwright/index.mjs';

const baseUrl = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:8080';

const email = process.env.HERMES_VERIFY_EMAIL || 'strava+140971747@hermes.local';
const password = process.env.HERMES_VERIFY_PASSWORD || 'HermesDev2026!';

const ROUTE_PREVIEW_VIEW_SIZE = 100;
const ROUTE_PREVIEW_PADDING = 24;
const ROUTE_PREVIEW_INNER_SIZE = ROUTE_PREVIEW_VIEW_SIZE - (ROUTE_PREVIEW_PADDING * 2);

function shiftFrameIntoWorld(min, span) {
  if (span >= 1) return { min: 0, max: 1 };
  const shiftedMin = Math.max(0, Math.min(1 - span, min));
  return { min: shiftedMin, max: shiftedMin + span };
}

function buildRouteViewportFrame(routeFrame, viewportAspect) {
  const xSpan = Math.max(0.0000001, routeFrame.maxX - routeFrame.minX);
  const ySpan = Math.max(0.0000001, routeFrame.maxY - routeFrame.minY);
  const aspect = Number.isFinite(viewportAspect) && viewportAspect > 0 ? viewportAspect : 1;
  const innerRatio = ROUTE_PREVIEW_INNER_SIZE / ROUTE_PREVIEW_VIEW_SIZE;
  const minViewXSpan = xSpan / innerRatio;
  const minViewYSpan = ySpan / innerRatio;
  let viewXSpan = minViewXSpan;
  let viewYSpan = minViewYSpan;
  if (viewXSpan / viewYSpan < aspect) {
    viewXSpan = viewYSpan * aspect;
  } else {
    viewYSpan = viewXSpan / aspect;
  }
  viewXSpan = Math.min(1, Math.max(viewXSpan, 0.0000001));
  viewYSpan = Math.min(1, Math.max(viewYSpan, 0.0000001));
  const centerX = (routeFrame.minX + routeFrame.maxX) / 2;
  const centerY = (routeFrame.minY + routeFrame.maxY) / 2;
  const xFrame = shiftFrameIntoWorld(centerX - (viewXSpan / 2), viewXSpan);
  const yFrame = shiftFrameIntoWorld(centerY - (viewYSpan / 2), viewYSpan);
  return {
    minX: xFrame.min,
    maxX: xFrame.max,
    minY: yFrame.min,
    maxY: yFrame.max,
  };
}

function buildRoutePreviewPath(points, viewportAspect) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const projected = points.map(([lat, lng]) => {
    const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const latRad = (clampedLat * Math.PI) / 180;
    const x = Math.max(0, Math.min(1, (lng + 180) / 360));
    const y = Math.max(0, Math.min(1, (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2));
    return [x, y];
  });
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const routeFrame = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
  if (![routeFrame.minX, routeFrame.maxX, routeFrame.minY, routeFrame.maxY].every(Number.isFinite)) return null;
  const viewportFrame = buildRouteViewportFrame(routeFrame, viewportAspect);
  const xSpan = Math.max(0.0000001, viewportFrame.maxX - viewportFrame.minX);
  const ySpan = Math.max(0.0000001, viewportFrame.maxY - viewportFrame.minY);
  return projected
    .map(([worldX, worldY], index) => {
      const x = ((worldX - viewportFrame.minX) / xSpan) * ROUTE_PREVIEW_VIEW_SIZE;
      const y = ((worldY - viewportFrame.minY) / ySpan) * ROUTE_PREVIEW_VIEW_SIZE;
      return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function normalizePointPayload(payload) {
  return Array.isArray(payload)
    ? payload
      .map((point) => [Number(point.latitude), Number(point.longitude)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
    : [];
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(25000);

  const login = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  const loginBody = await login.json().catch(() => ({}));
  if (!login.ok() || !loginBody.token) {
    throw new Error(`login failed ${login.status()}`);
  }

  await page.addInitScript(({ token, email: userEmail }) => {
    localStorage.setItem('hermes_jwt', token);
    localStorage.setItem('hermes_email', userEmail);
    localStorage.setItem('hermes_role', 'USER');
    localStorage.setItem('hermes_lang', 'zh-CN');
    sessionStorage.setItem('hermes_strava_auto_sync_at', String(Date.now()));
  }, { token: loginBody.token, email });

  await page.goto(`${baseUrl}/runs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (new URL(page.url()).pathname === '/login') {
    throw new Error('runs page redirected to /login after seeded shared-runner auth');
  }
  await page.waitForSelector('button.recent-runs-card[data-run-id] .recent-runs-thumb-route-line');
  const visibleRunIds = await page.evaluate(() => (
    Array.from(document.querySelectorAll('button.recent-runs-card[data-run-id]'))
      .map((card) => card.getAttribute('data-run-id'))
      .filter(Boolean)
      .slice(0, 3)
  ));
  const runId = visibleRunIds[0];
  if (!runId) throw new Error('first run card missing data-run-id');

  const routePreviewResponse = await page.request.get(
    `${baseUrl}/api/activities/route-previews?ids=${encodeURIComponent(visibleRunIds.join(','))}`,
    { headers: { Authorization: `Bearer ${loginBody.token}` } },
  );
  if (!routePreviewResponse.ok()) {
    throw new Error(`route previews request failed ${routePreviewResponse.status()}`);
  }
  const routePreviewPayload = await routePreviewResponse.json();
  const routePreviewItems = Array.isArray(routePreviewPayload) ? routePreviewPayload : [];
  const routePreviewById = new Map(
    routePreviewItems
      .map((item) => [String(item?.activityId), item])
      .filter(([id]) => id && id !== 'undefined'),
  );

  const visibleRunProofs = [];
  for (const id of visibleRunIds) {
    const routePreviewItem = routePreviewById.get(String(id));
    if (!routePreviewItem) {
      throw new Error(`route preview response missing visible run ${id}`);
    }
    const previewPoints = normalizePointPayload(routePreviewItem.points);
    if (previewPoints.length < 2) {
      throw new Error(`route preview response has insufficient points for run ${id}: ${previewPoints.length}`);
    }

    const pointsResponse = await page.request.get(`${baseUrl}/api/activities/${id}/points`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    if (!pointsResponse.ok()) {
      throw new Error(`points request failed for run ${id}: HTTP ${pointsResponse.status()}`);
    }
    const points = normalizePointPayload(await pointsResponse.json());
    const thumbAspectProof = await page.evaluate((currentRunId) => {
      const card = document.querySelector(`button.recent-runs-card[data-run-id="${CSS.escape(currentRunId)}"]`);
      const thumb = card?.querySelector('.recent-runs-thumb');
      const rect = thumb?.getBoundingClientRect();
      const width = rect ? Number(rect.width.toFixed(2)) : null;
      const height = rect ? Number(rect.height.toFixed(2)) : null;
      return rect
        ? {
          width,
          height,
          aspect: width / height,
        }
        : null;
    }, id);
    if (!thumbAspectProof?.width || !thumbAspectProof?.height) {
      throw new Error(`could not measure route thumbnail aspect for run ${id}: ${JSON.stringify(thumbAspectProof)}`);
    }
    const expectedPath = buildRoutePreviewPath(previewPoints, thumbAspectProof.aspect);
    if (!expectedPath) throw new Error(`could not build route preview from batch route-previews endpoint for run ${id}`);

    try {
      await page.waitForFunction(({ runId: currentRunId, expected }) => {
        const card = document.querySelector(`button.recent-runs-card[data-run-id="${CSS.escape(currentRunId)}"]`);
        return card?.querySelector('.recent-runs-thumb-route-line')?.getAttribute('d') === expected;
      }, { runId: id, expected: expectedPath });
    } catch (error) {
      const mismatchProof = await page.evaluate(({ runId: currentRunId, expected }) => {
        const card = document.querySelector(`button.recent-runs-card[data-run-id="${CSS.escape(currentRunId)}"]`);
        const path = card?.querySelector('.recent-runs-thumb-route-line')?.getAttribute('d') || "";
        return {
          runId: currentRunId,
          cardPresent: Boolean(card),
          actualLength: path.length,
          expectedLength: expected.length,
          actualCommandCount: path ? path.split(' L ').length : 0,
          expectedCommandCount: expected.split(' L ').length,
          actualPrefix: path.slice(0, 80),
          expectedPrefix: expected.slice(0, 80),
        };
      }, { runId: id, expected: expectedPath });
      throw new Error(`run ${id} thumbnail never matched route-previews endpoint: ${JSON.stringify(mismatchProof)}`);
    }

    await page.waitForFunction((currentRunId) => {
      const card = document.querySelector(`button.recent-runs-card[data-run-id="${CSS.escape(currentRunId)}"]`);
      const tiles = Array.from(card?.querySelectorAll('.recent-runs-thumb-route-tile[data-route-tile-layer]') || []);
      return tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth === 256 && tile.naturalHeight === 256);
    }, id);

    const cardProof = await page.evaluate(({ runId: currentRunId, expected }) => {
      const card = document.querySelector(`button.recent-runs-card[data-run-id="${CSS.escape(currentRunId)}"]`);
      const thumb = card?.querySelector('.recent-runs-thumb');
      const svg = card?.querySelector('.recent-runs-thumb-route-svg');
      const path = card?.querySelector('.recent-runs-thumb-route-line');
      const tiles = Array.from(card?.querySelectorAll('.recent-runs-thumb-route-tile[data-route-tile-layer]') || []);
      const tile = tiles[0];
      const lineBox = path?.getBBox ? path.getBBox() : null;
      const thumbRect = thumb?.getBoundingClientRect();
      const tileRect = tile?.getBoundingClientRect();
      const svgStyle = svg ? getComputedStyle(svg) : null;
      const tileStyle = tile ? getComputedStyle(tile) : null;
      const tileSquareDeltaPx = tileRect ? Math.abs(tileRect.width - tileRect.height) : null;
      const tileProofs = tiles.map((tileNode) => {
        const rect = tileNode.getBoundingClientRect();
        const key = tileNode.getAttribute('data-route-tile-layer') || '';
        const zoom = Number(key.split('-')[0]);
        return {
          key,
          zoom: Number.isFinite(zoom) ? zoom : null,
          src: tileNode.currentSrc || tileNode.getAttribute('src') || null,
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
          naturalWidth: tileNode.naturalWidth,
          naturalHeight: tileNode.naturalHeight,
        };
      });
      const tileZooms = tileProofs.map((proof) => proof.zoom).filter(Number.isFinite);
      const tileMaxCssPx = tileProofs.length
        ? Math.max(...tileProofs.map((proof) => Math.max(proof.width, proof.height)))
        : null;
      return {
        runId: currentRunId,
        pathMatchesRoutePreviewEndpoint: path?.getAttribute('d') === expected,
        pathCommandCount: (path?.getAttribute('d') || '').split(' L ').length,
        expectedCommandCount: expected.split(' L ').length,
        svgPreserveAspectRatio: svg?.getAttribute('preserveAspectRatio') || null,
        tileLayerCount: tiles.length,
        tileZooms,
        minTileZoom: tileZooms.length ? Math.min(...tileZooms) : null,
        maxTileCssPx: tileMaxCssPx == null ? null : Number(tileMaxCssPx.toFixed(2)),
        tileProofs,
        zOrder: {
          svg: svgStyle?.zIndex || null,
          tile: tileStyle?.zIndex || null,
        },
        tileSizing: tileStyle && thumbRect && tileRect
          ? {
            maxWidth: tileStyle.maxWidth,
            maxHeight: tileStyle.maxHeight,
            objectFit: tileStyle.objectFit,
            thumbWidth: Number(thumbRect.width.toFixed(2)),
            tileWidth: Number(tileRect.width.toFixed(2)),
            thumbHeight: Number(thumbRect.height.toFixed(2)),
            tileHeight: Number(tileRect.height.toFixed(2)),
            squareDeltaPx: Number(tileSquareDeltaPx.toFixed(2)),
          }
          : null,
        lineBox: lineBox
          ? {
            x: Number(lineBox.x.toFixed(2)),
            y: Number(lineBox.y.toFixed(2)),
            width: Number(lineBox.width.toFixed(2)),
            height: Number(lineBox.height.toFixed(2)),
          }
          : null,
      };
    }, { runId: id, expected: expectedPath });

    if (!cardProof.pathMatchesRoutePreviewEndpoint) throw new Error(`thumbnail path does not match route-previews endpoint for run ${id}`);
    if (cardProof.pathCommandCount !== previewPoints.length) throw new Error(`thumbnail path count does not match preview sample count for run ${id}`);
    if (Number(routePreviewItem.pointCount || 0) < previewPoints.length) {
      throw new Error(`route preview sample count exceeds reported GPS point count for run ${id}`);
    }
    if (points.length !== Number(routePreviewItem.pointCount || 0)) {
      throw new Error(`route preview pointCount does not match /points payload for run ${id}`);
    }
    if (cardProof.svgPreserveAspectRatio !== 'none') throw new Error(`thumbnail SVG preserveAspectRatio is not none for run ${id}`);
    if (cardProof.tileLayerCount < 1) throw new Error(`thumbnail has no real-world map tile layer for run ${id}`);
    if (cardProof.minTileZoom == null || cardProof.minTileZoom < 13) {
      throw new Error(`thumbnail map is using low-detail tiles instead of street-level tiles for run ${id}: ${JSON.stringify(cardProof.tileProofs)}`);
    }
    if (cardProof.maxTileCssPx == null || cardProof.maxTileCssPx > 384) {
      throw new Error(`thumbnail map tile is too oversized to match street detail for run ${id}: ${JSON.stringify(cardProof.tileProofs)}`);
    }
    if (!cardProof.tileProofs.every((proof) => proof.src && proof.src.includes('/dark_nolabels/'))) {
      throw new Error(`thumbnail map tiles are not using the expected CartoDB dark basemap for run ${id}: ${JSON.stringify(cardProof.tileProofs)}`);
    }
    if (!cardProof.tileProofs.every((proof) => proof.naturalWidth === 256 && proof.naturalHeight === 256)) {
      throw new Error(`thumbnail map tile images did not load as 256px Web Mercator tiles for run ${id}: ${JSON.stringify(cardProof.tileProofs)}`);
    }
    if (Number(cardProof.zOrder.svg) <= Number(cardProof.zOrder.tile)) {
      throw new Error(`route SVG is not above map tile layer for run ${id}: ${JSON.stringify(cardProof.zOrder)}`);
    }
    if (cardProof.tileSizing?.maxWidth !== 'none' || cardProof.tileSizing?.maxHeight !== 'none') {
      throw new Error(`map tile layer is still capped by global image CSS for run ${id}: ${JSON.stringify(cardProof.tileSizing)}`);
    }
    if (cardProof.tileSizing?.squareDeltaPx == null || cardProof.tileSizing.squareDeltaPx > 1) {
      throw new Error(`map tile layer is not preserving square map pixels for run ${id}: ${JSON.stringify(cardProof.tileSizing)}`);
    }

    visibleRunProofs.push({
      ...cardProof,
      thumbAspect: thumbAspectProof.aspect,
      routePointCount: points.length,
      previewPointCount: previewPoints.length,
    });
  }

  const runsProof = await page.evaluate(({ runId: id }) => {
    const card = document.querySelector(`button.recent-runs-card[data-run-id="${CSS.escape(id)}"]`);
    return {
      page: location.href,
      runId: id,
      visibleRunCardCount: document.querySelectorAll('button.recent-runs-card[data-run-id]').length,
      firstCardStillPresent: Boolean(card),
    };
  }, { runId });

  await page.goto(`${baseUrl}/run/${runId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.leaflet-container');
  const detailProof = await page.evaluate((id) => ({
    page: location.href,
    runIdInUrl: location.pathname.endsWith(`/run/${id}`),
    leafletContainers: document.querySelectorAll('.leaflet-container').length,
  }), runId);

  if (!detailProof.runIdInUrl || detailProof.leafletContainers < 1) throw new Error('run detail route proof failed');

  console.log(JSON.stringify({
    runsProof,
    visibleRunProofs,
    detailProof,
  }, null, 2));
} finally {
  await browser.close();
}

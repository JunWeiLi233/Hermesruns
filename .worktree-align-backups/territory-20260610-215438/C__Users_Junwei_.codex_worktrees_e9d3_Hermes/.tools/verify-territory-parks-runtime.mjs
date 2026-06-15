import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const screenshotDir = resolveRootPath(readArg("--screenshot-dir", "task-images"));
const sharedEmail = readArg("--email", process.env.APP_LOCAL_SHARED_RUNNER_EMAIL || "strava+140971747@hermes.local");
const sharedPassword = readArg("--password", process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "HermesDev2026!");

const requiredViews = [
  {
    key: "central-park-z13",
    label: "Central Park zoom 13",
    center: [40.781, -73.966],
    zoom: 13,
    box: { minLat: 40.764, maxLat: 40.801, minLng: -73.982, maxLng: -73.949 },
    minBackendCells: 20,
    minNearPoints: 8,
    minTracePoints: 40,
    maxInteriorCells: 2,
    requireCenterFill: false,
  },
  {
    key: "central-park-z15",
    label: "Central Park zoom 15",
    center: [40.781, -73.966],
    zoom: 15,
    box: { minLat: 40.764, maxLat: 40.801, minLng: -73.982, maxLng: -73.949 },
    minBackendCells: 20,
    minNearPoints: 4,
    minTracePoints: 40,
    maxInteriorCells: 2,
    requireCenterFill: false,
  },
  {
    key: "prospect-park-z13",
    label: "Prospect Park zoom 13",
    center: [40.661, -73.969],
    zoom: 13,
    box: { minLat: 40.648, maxLat: 40.672, minLng: -73.982, maxLng: -73.956 },
    minBackendCells: 20,
    minNearPoints: 8,
    minTracePoints: 40,
    maxInteriorCells: 2,
    requireCenterFill: false,
  },
  {
    key: "prospect-park-z15",
    label: "Prospect Park zoom 15",
    center: [40.661, -73.969],
    zoom: 15,
    box: { minLat: 40.648, maxLat: 40.672, minLng: -73.982, maxLng: -73.956 },
    minBackendCells: 20,
    minNearPoints: 4,
    minTracePoints: 40,
    maxInteriorCells: 2,
    requireCenterFill: false,
  },
  {
    key: "queens-z12",
    label: "Queens zoom 12",
    center: [40.747, -73.816],
    zoom: 12,
    box: { minLat: 40.70, maxLat: 40.79, minLng: -73.90, maxLng: -73.74 },
    minBackendCells: 100,
    minNearPoints: 80,
    minTracePoints: 0,
    requireCenterFill: false,
  },
];

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRootPath(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function inBox(point, box) {
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= box.minLat
    && latitude <= box.maxLat
    && longitude >= box.minLng
    && longitude <= box.maxLng;
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
  const dx = (rightLng - leftLng) * cosLat * metersPerDegLat;
  const dy = (rightLat - leftLat) * metersPerDegLat;
  return Math.hypot(dx, dy);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`Playwright is not installed or not resolvable: ${error?.message || error}`);
  }
}

async function login() {
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sharedEmail, password: sharedPassword }),
  });
  const data = await response.json().catch(() => null);
  assert(response.ok && data?.token, `Login failed for ${sharedEmail}: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function fetchBackendPolygons(token) {
  const response = await fetch(new URL("/api/territory/polygons", baseUrl), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null);
  assert(response.ok && Array.isArray(data?.polygons), `Polygon API failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}

function backendBoxProof(polygons) {
  const activePolygons = polygons.filter((polygon) => polygon?.active === true);
  assert(activePolygons.length > 0, "No active shared-user polygon returned by /api/territory/polygons.");

  return requiredViews.reduce((proof, view) => {
    const cells = activePolygons.flatMap((polygon) => (
      Array.isArray(polygon.cells) ? polygon.cells : []
    ));
    const traces = activePolygons.flatMap((polygon) => (
      Array.isArray(polygon.routeTraces) ? polygon.routeTraces : []
    ));
    const cellCount = cells.filter((cell) => inBox(cell, view.box)).length;
    const interiorCellCount = cells.filter((cell) => (
      distanceMeters(cell, { latitude: view.center[0], longitude: view.center[1] }) <= 90
    )).length;
    const tracePointCount = traces.reduce((sum, trace) => (
      sum + (Array.isArray(trace?.points) ? trace.points.filter((point) => inBox(point, view.box)).length : 0)
    ), 0);
    proof[view.key] = { cellCount, interiorCellCount, tracePointCount };
    return proof;
  }, {});
}

async function clearTerritoryCaches(page) {
  await page.goto(new URL("/login?territory-cache-clear=parks-proof", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  }).catch(() => {});
  await page.evaluate(async () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.toLowerCase().includes("territory")) {
        localStorage.removeItem(key);
      }
    });
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("hermes-territory-cache");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
}

async function seedPageAuth(page, authSeed) {
  await page.addInitScript(({ token, email }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));
  }, authSeed);
}

fs.mkdirSync(screenshotDir, { recursive: true });

const loginData = await login();
const polygonData = await fetchBackendPolygons(loginData.token);
const backendProof = backendBoxProof(polygonData.polygons);
requiredViews.forEach((view) => {
  assert(
    backendProof[view.key].cellCount >= view.minBackendCells,
    `${view.label} backend active cells too low: ${JSON.stringify(backendProof[view.key])}`,
  );
  if (Number.isFinite(view.minTracePoints) && view.minTracePoints > 0) {
    assert(
      backendProof[view.key].tracePointCount >= view.minTracePoints,
      `${view.label} backend active route trace points too low: ${JSON.stringify(backendProof[view.key])}`,
    );
  }
  if (Number.isFinite(view.maxInteriorCells)) {
    assert(
      backendProof[view.key].interiorCellCount <= view.maxInteriorCells,
      `${view.label} backend filled an open-route park interior: ${JSON.stringify(backendProof[view.key])}`,
    );
  }
});

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error?.message || String(error)));

  await clearTerritoryCaches(page);
  await seedPageAuth(page, { token: loginData.token, email: loginData.email || sharedEmail });
  await page.goto(new URL("/territory?proof=parks-runtime", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await page.waitForFunction(() => (
    document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap
    && document.querySelectorAll(".terr-land-mask-concrete-land--active").length > 0
  ), { timeout: 45_000 });
  // Territory auto-fits all active land shortly after first paint; wait for it before forcing
  // zoom-specific proof views so the app does not race and recenter the verifier.
  await page.waitForTimeout(1_600);

  const views = {};
  for (const view of requiredViews) {
    await page.evaluate(({ center, zoom }) => {
      const map = document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap;
      map.setView(center, zoom, { animate: false });
      map.invalidateSize({ pan: false });
    }, view);
    await page.waitForTimeout(850);

    const proof = await page.evaluate(({ center }) => {
      const map = document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap;
      const centerPoint = map.latLngToLayerPoint(center);
      const containerPoint = map.latLngToContainerPoint(center);
      const containerRect = map.getContainer().getBoundingClientRect();
      const screenPoint = new DOMPoint(containerRect.left + containerPoint.x, containerRect.top + containerPoint.y);
      const parsePathNumbers = (pathData) => (
        Array.from(String(pathData || "").matchAll(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)).map((match) => Number(match[0]))
      );
      const activePaths = Array.from(document.querySelectorAll(".terr-land-mask-concrete-land--active"));
      const activeContours = Array.from(document.querySelectorAll(".terr-land-mask-contour--active"));
      const activeCenterFill = activePaths.some((path) => {
        try {
          const matrix = path.getScreenCTM?.();
          if (!matrix || typeof path.isPointInFill !== "function") return false;
          return path.isPointInFill(screenPoint.matrixTransform(matrix.inverse()));
        } catch {
          return false;
        }
      });
      let closestActivePointPx = Number.POSITIVE_INFINITY;
      let nearPointCount = 0;
      let totalPointPairs = 0;
      const dLengths = [];

      activePaths.forEach((path) => {
        const pathData = path.getAttribute("d") || "";
        dLengths.push(pathData.length);
        const numbers = parsePathNumbers(pathData);
        for (let index = 0; index + 1 < numbers.length; index += 2) {
          const x = numbers[index];
          const y = numbers[index + 1];
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          totalPointPairs += 1;
          const distance = Math.hypot(x - centerPoint.x, y - centerPoint.y);
          closestActivePointPx = Math.min(closestActivePointPx, distance);
          if (distance <= 220) {
            nearPointCount += 1;
          }
        }
      });

      return {
        mapZoom: map.getZoom(),
        activeConcrete: activePaths.length,
        activeContour: activeContours.length,
        activeCenterFill,
        dLengths,
        totalPointPairs,
        nearPointCount,
        closestActivePointPx: Number.isFinite(closestActivePointPx) ? Math.round(closestActivePointPx) : null,
        tileFilter: getComputedStyle(document.querySelector(".territory-real-world-tile") || document.querySelector(".leaflet-tile"))?.filter || null,
      };
    }, view);

    assert(proof.activeConcrete > 0, `${view.label} rendered no active concrete path.`);
    assert(proof.activeContour > 0, `${view.label} rendered no active contour path.`);
    if (view.requireCenterFill) {
      assert(proof.activeCenterFill === true, `${view.label} active concrete does not fill the target center: ${JSON.stringify(proof)}`);
    } else {
      assert(proof.nearPointCount >= view.minNearPoints, `${view.label} active geometry missing near view center: ${JSON.stringify(proof)}`);
      assert(proof.closestActivePointPx !== null && proof.closestActivePointPx <= 220, `${view.label} closest active point is too far: ${JSON.stringify(proof)}`);
      if (Number.isFinite(view.maxInteriorCells)) {
        assert(proof.activeCenterFill === false, `${view.label} rendered a filled park interior for an open route: ${JSON.stringify(proof)}`);
      }
    }
    assert(proof.tileFilter === "none", `${view.label} map tiles are filtered/blurred: ${proof.tileFilter}`);

    const screenshotPath = path.join(screenshotDir, `territory-parks-proof-${view.key}.jpg`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    views[view.key] = {
      ...proof,
      backend: backendProof[view.key],
      screenshot: path.relative(root, screenshotPath).replaceAll("\\", "/"),
    };
  }

  assert(consoleErrors.length === 0, `Console errors during Territory park proof: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    ok: true,
    email: sharedEmail,
    polygonCount: polygonData.polygons.length,
    views,
  }, null, 2));
} finally {
  await browser.close();
}

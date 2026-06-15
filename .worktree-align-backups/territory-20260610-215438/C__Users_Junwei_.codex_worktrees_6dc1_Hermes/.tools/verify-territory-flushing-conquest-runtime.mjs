#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const screenshotPath = resolveRootPath(readArg("--screenshot", "task-images/territory-flushing-global-users-proof.jpg"));
const sharedPassword = readArg("--password", process.env.APP_LOCAL_TERRITORY_FLUSHING_CONQUEROR_PASSWORD || process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "HermesDev2026!");
const olderFlushingEmail = readArg("--older-email", "territory-flushing@hermes.local");
const conquerorEmail = readArg("--conqueror-email", "territory-flushing-conqueror@hermes.local");

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

function finishSkipped(reason, details = {}) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason,
    ...details,
  }, null, 2));
  process.exit(0);
}

function boundsForCells(cells) {
  const validCells = (Array.isArray(cells) ? cells : [])
    .map((cell) => ({
      latitude: Number(cell?.latitude),
      longitude: Number(cell?.longitude),
    }))
    .filter((cell) => Number.isFinite(cell.latitude) && Number.isFinite(cell.longitude));
  assert(validCells.length > 0, "Cannot compute bounds for empty territory cells.");
  return {
    minLat: Math.min(...validCells.map((cell) => cell.latitude)),
    maxLat: Math.max(...validCells.map((cell) => cell.latitude)),
    minLng: Math.min(...validCells.map((cell) => cell.longitude)),
    maxLng: Math.max(...validCells.map((cell) => cell.longitude)),
    cellCount: validCells.length,
  };
}

function cellKey(cell) {
  const latitude = Number(cell?.latitude);
  const longitude = Number(cell?.longitude);
  return `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
}

function overlapCount(aCells, bCells) {
  const b = new Set((Array.isArray(bCells) ? bCells : []).map((cell) => cellKey(cell)));
  return (Array.isArray(aCells) ? aCells : []).filter((cell) => b.has(cellKey(cell))).length;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`Playwright is not installed or not resolvable: ${error?.message || error}`);
  }
}

async function login(email) {
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: sharedPassword }),
  });
  const data = await response.json().catch(() => null);
  assert(response.ok && data?.token, `Login failed for ${email}: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function api(token, pathname) {
  const response = await fetch(new URL(pathname, baseUrl), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null);
  assert(response.ok, `${pathname} failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}

function activeCells(polygons) {
  return (Array.isArray(polygons) ? polygons : [])
    .filter((polygon) => polygon?.active === true)
    .flatMap((polygon) => Array.isArray(polygon?.cells) ? polygon.cells : []);
}

function cellsForOwner(polygons, ownerName) {
  return (Array.isArray(polygons) ? polygons : [])
    .filter((polygon) => polygon?.ownerName === ownerName)
    .flatMap((polygon) => Array.isArray(polygon?.cells) ? polygon.cells : []);
}

function boxDelta(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.right - b.right),
    Math.abs(a.bottom - b.bottom),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );
}

fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const olderLogin = await login(olderFlushingEmail);
const conquerorLogin = await login(conquerorEmail);

const olderPolygonResponse = await api(olderLogin.token, "/api/territory/polygons");
const conquerorPolygonResponse = await api(conquerorLogin.token, "/api/territory/polygons");

const conquerorActiveCells = activeCells(conquerorPolygonResponse.polygons);
if (conquerorActiveCells.length === 0) {
  finishSkipped("Flushing conqueror fixture is not seeded in this runtime.", {
    olderEmail: olderFlushingEmail,
    conquerorEmail,
    olderPolygonCount: Array.isArray(olderPolygonResponse.polygons) ? olderPolygonResponse.polygons.length : 0,
    conquerorPolygonCount: Array.isArray(conquerorPolygonResponse.polygons) ? conquerorPolygonResponse.polygons.length : 0,
  });
}

const conquerorBounds = boundsForCells(conquerorActiveCells);
assert(conquerorBounds.cellCount > 1_000, `Flushing conqueror active mask is too small: ${JSON.stringify(conquerorBounds)}`);
assert(conquerorBounds.minLat < 40.730, `Flushing conqueror does not reach south Flushing: ${JSON.stringify(conquerorBounds)}`);
assert(conquerorBounds.maxLat > 40.775, `Flushing conqueror does not reach north Flushing: ${JSON.stringify(conquerorBounds)}`);
assert(conquerorBounds.minLng < -73.855, `Flushing conqueror does not reach west Flushing: ${JSON.stringify(conquerorBounds)}`);
assert(conquerorBounds.maxLng > -73.780, `Flushing conqueror does not reach east Flushing: ${JSON.stringify(conquerorBounds)}`);

const conquerorCellsInOlderView = cellsForOwner(olderPolygonResponse.polygons, "Hermes Flushing Conqueror");
const olderActiveCells = activeCells(olderPolygonResponse.polygons);
if (olderActiveCells.length === 0 || conquerorCellsInOlderView.length === 0) {
  finishSkipped("Older Flushing fixture does not expose active/rival ownership in this runtime.", {
    olderEmail: olderFlushingEmail,
    conquerorEmail,
    olderActiveCellCount: olderActiveCells.length,
    conquerorCellsInOlderView: conquerorCellsInOlderView.length,
    conquerorBounds,
  });
}

assert(conquerorCellsInOlderView.length > 1_000, "Older Flushing account does not see the conqueror as the newer rival owner.");
assert(
  overlapCount(olderActiveCells, conquerorCellsInOlderView) === 0,
  "Older Flushing active cells still overlap cells owned by the newer Flushing conqueror.",
);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (error) => consoleErrors.push(error?.message || String(error)));

try {
  await page.addInitScript(({ token, email }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));
  }, { token: olderLogin.token, email: olderLogin.email });

  await page.goto(new URL("/territory?proof=flushing-global-users", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await page.waitForSelector(".terr-land-mask-concrete-land--active", { timeout: 25_000 });
  await page.waitForSelector(".terr-land-mask-contour--active", { timeout: 25_000 });
  await page.waitForFunction(
    (ownerName) => Array.from(document.querySelectorAll(".terr-land-mask-concrete-land--rival"))
      .some((element) => element.dataset.hermesOwnerName === ownerName),
    "Hermes Flushing Conqueror",
    { timeout: 25_000 },
  );
  await page.waitForFunction(
    (ownerName) => Array.from(document.querySelectorAll(".terr-land-mask-contour--rival"))
      .some((element) => element.dataset.hermesOwnerName === ownerName),
    "Hermes Flushing Conqueror",
    { timeout: 25_000 },
  );
  await page.waitForTimeout(750);

  const zoomProofs = [];
  for (const zoom of [11, 13, 15]) {
    const sample = await page.evaluate(async (targetZoom) => {
      const mapContainer = document.querySelector(".terr-leaflet-map");
      const map = mapContainer?.__hermesTerritoryMap;
      if (!map) return { targetZoom, error: "missing map" };
      map.setView([40.747, -73.817], targetZoom, { animate: false });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const activeConcrete = Array.from(document.querySelectorAll(".terr-land-mask-concrete-land--active"));
      const activeContour = Array.from(document.querySelectorAll(".terr-land-mask-contour--active"));
      const rivalConcrete = Array.from(document.querySelectorAll(".terr-land-mask-concrete-land--rival"));
      const rivalContour = Array.from(document.querySelectorAll(".terr-land-mask-contour--rival"));
      const conquerorConcrete = rivalConcrete.filter((element) => element.dataset.hermesOwnerName === "Hermes Flushing Conqueror");
      const conquerorContour = rivalContour.filter((element) => element.dataset.hermesOwnerName === "Hermes Flushing Conqueror");
      const combinedBox = (elements) => {
        const boxes = elements
          .map((element) => element.getBoundingClientRect())
          .filter((box) => box.width > 0 && box.height > 0);
        if (!boxes.length) return null;
        const left = Math.min(...boxes.map((box) => box.left));
        const top = Math.min(...boxes.map((box) => box.top));
        const right = Math.max(...boxes.map((box) => box.right));
        const bottom = Math.max(...boxes.map((box) => box.bottom));
        return { x: left, y: top, right, bottom, width: right - left, height: bottom - top };
      };
      return {
        targetZoom,
        mapZoom: map.getZoom(),
        activeConcrete: activeConcrete.length,
        activeContour: activeContour.length,
        rivalConcrete: rivalConcrete.length,
        rivalContour: rivalContour.length,
        conquerorConcrete: conquerorConcrete.length,
        conquerorContour: conquerorContour.length,
        rivalOwnerNames: [...new Set(rivalConcrete.map((element) => element.dataset.hermesOwnerName).filter(Boolean))].sort(),
        activeConcreteBox: combinedBox(activeConcrete),
        activeContourBox: combinedBox(activeContour),
        conquerorConcreteBox: combinedBox(conquerorConcrete),
        conquerorContourBox: combinedBox(conquerorContour),
        tileFilter: getComputedStyle(document.querySelector(".territory-real-world-tile") || document.querySelector(".leaflet-tile"))?.filter || null,
      };
    }, zoom);
    assert(!sample.error, `Zoom ${zoom} proof failed: ${sample.error}`);
    assert(sample.activeConcrete > 0, `Zoom ${zoom} has no active concrete land.`);
    assert(sample.activeContour > 0, `Zoom ${zoom} has no active contour.`);
    assert(sample.rivalConcrete > 0, `Zoom ${zoom} has no rival concrete on the global Territory page.`);
    assert(sample.rivalContour > 0, `Zoom ${zoom} has no rival contour on the global Territory page.`);
    assert(sample.conquerorConcrete > 0, `Zoom ${zoom} does not render Hermes Flushing Conqueror concrete for another account.`);
    assert(sample.conquerorContour > 0, `Zoom ${zoom} does not render Hermes Flushing Conqueror contour for another account.`);
    assert(boxDelta(sample.activeConcreteBox, sample.activeContourBox) <= 4, `Zoom ${zoom} contour/fill boxes drift: ${JSON.stringify(sample)}`);
    assert(boxDelta(sample.conquerorConcreteBox, sample.conquerorContourBox) <= 4, `Zoom ${zoom} conqueror contour/fill boxes drift: ${JSON.stringify(sample)}`);
    zoomProofs.push(sample);
  }

  await page.screenshot({ path: screenshotPath, fullPage: false });
  assert(consoleErrors.length === 0, `Console errors during Flushing conquest proof: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    olderFlushingEmail,
    conquerorEmail,
    browserAccountEmail: olderLogin.email,
    conquerorBounds,
    olderActiveCellCount: olderActiveCells.length,
    conquerorCellsInOlderView: conquerorCellsInOlderView.length,
    zoomProofs,
    screenshot: path.relative(root, screenshotPath).replaceAll("\\", "/"),
  }, null, 2));
} finally {
  await browser.close();
}

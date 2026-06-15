#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const screenshotPath = resolveRootPath(readArg("--screenshot", "task-images/territory-live-shared-account-proof.jpg"));
const sharedEmail = readArg("--email", "strava+140971747@hermes.local");
const requestedZoom = Number(readArg("--zoom", ""));

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRootPath(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function readConfiguredSharedPassword() {
  if (process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD) {
    return process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD;
  }
  const candidates = ["Hermes.local.env.ps1", "Hermes.local.env.example.ps1", ".env.example"];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!fs.existsSync(file)) {
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    const powershellMatch = text.match(/APP_LOCAL_SHARED_RUNNER_PASSWORD\s*=\s*"([^"]+)"/);
    if (powershellMatch?.[1] && !powershellMatch[1].includes("<set-local-password>")) {
      return powershellMatch[1];
    }
    const envMatch = text.match(/^APP_LOCAL_SHARED_RUNNER_PASSWORD=(.+)$/m);
    if (envMatch?.[1] && !envMatch[1].includes("<set-local-password>")) {
      return envMatch[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function boxAlignmentDelta(fillBox, contourBox) {
  if (!fillBox || !contourBox) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(
    Math.abs(Number(fillBox.x) - Number(contourBox.x)),
    Math.abs(Number(fillBox.y) - Number(contourBox.y)),
    Math.abs(Number(fillBox.right) - Number(contourBox.right)),
    Math.abs(Number(fillBox.bottom) - Number(contourBox.bottom)),
    Math.abs(Number(fillBox.width) - Number(contourBox.width)),
    Math.abs(Number(fillBox.height) - Number(contourBox.height)),
  );
}

function assertContourFillBoxesAligned(fillBox, contourBox, context) {
  const delta = boxAlignmentDelta(fillBox, contourBox);
  assert(
    delta <= 4,
    `${context} active contour drifted away from active concrete fill: delta=${delta}, fill=${JSON.stringify(fillBox)}, contour=${JSON.stringify(contourBox)}`,
  );
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

const sharedPassword = readConfiguredSharedPassword();
assert(sharedPassword, "No local shared-runner password is configured in env or example files.");

fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});
page.on("pageerror", (error) => {
  consoleErrors.push(error?.message || String(error));
});

try {
  const loginData = await login();
  const expectedPolygonsResponse = await fetch(new URL("/api/territory/polygons", baseUrl), {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const expectedPolygons = await expectedPolygonsResponse.json().catch(() => null);
  assert(
    expectedPolygonsResponse.ok,
    `Preflight territory polygons API failed: HTTP ${expectedPolygonsResponse.status} ${JSON.stringify(expectedPolygons)}`,
  );
  const expectedActiveBackendCells = Array.isArray(expectedPolygons?.polygons)
    ? expectedPolygons.polygons
        .filter((polygon) => polygon?.active === true)
        .reduce((sum, polygon) => sum + (Array.isArray(polygon?.cells) ? polygon.cells.length : 0), 0)
    : 0;

  await page.addInitScript(({ token, email }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));
  }, { token: loginData.token, email: loginData.email || sharedEmail });

  await page.goto(new URL("/territory?proof=live-shared", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForFunction(() => {
    return document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap
      && document.querySelectorAll(".terr-scope-button").length === 2;
  }, { timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll(".leaflet-tile").length > 0, { timeout: 30_000 });
  if (expectedActiveBackendCells > 0) {
    await page.waitForFunction(() => {
      return document.querySelectorAll(".terr-land-mask-contour--active").length > 0
        || document.querySelectorAll(".terr-land-mask-concrete-land--active").length > 0;
    }, { timeout: 30_000 });
  }

  if (Number.isFinite(requestedZoom) && requestedZoom > 0) {
    await page.evaluate(async (zoom) => {
      const container = document.querySelector(".terr-leaflet-map");
      const map = container?.__hermesTerritoryMap;
      const contours = Array.from(document.querySelectorAll(".terr-land-mask-contour--active"));
      if (!map || !container || !contours.length) {
        return;
      }
      const largest = contours.reduce((best, element) => {
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        return area > best.area ? { element, rect, area } : best;
      }, { element: contours[0], rect: contours[0].getBoundingClientRect(), area: -1 });
      const mapRect = container.getBoundingClientRect();
      const centerX = largest.rect.left + (largest.rect.width / 2) - mapRect.left;
      const centerY = largest.rect.top + (largest.rect.height / 2) - mapRect.top;
      const latLng = map.containerPointToLatLng([centerX, centerY]);
      map.setView(latLng, zoom, { animate: false });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, requestedZoom);
    await page.waitForFunction((zoom) => {
      const map = document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap;
      return map?.getZoom?.() === zoom;
    }, requestedZoom, { timeout: 10_000 });
  }

  await page.screenshot({ path: screenshotPath, fullPage: false });

  const proof = await page.evaluate(async () => {
    const q = (selector) => Array.from(document.querySelectorAll(selector));
    const token = localStorage.getItem("hermes_jwt");

    async function api(pathname) {
      const response = await fetch(pathname, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, data };
    }

    const profile = await api("/api/profile/me").catch((error) => ({ ok: false, error: String(error) }));
    const polygons = await api("/api/territory/polygons").catch((error) => ({ ok: false, error: String(error) }));
    const territory = await api("/api/territory").catch((error) => ({ ok: false, error: String(error) }));

    const activePolygons = Array.isArray(polygons?.data?.polygons)
      ? polygons.data.polygons.filter((polygon) => polygon?.active === true)
      : [];
    const rivalPolygons = Array.isArray(polygons?.data?.polygons)
      ? polygons.data.polygons.filter((polygon) => polygon?.active === false)
      : [];
    const activeConcrete = q(".terr-land-mask-concrete-land--active");
    const activeContour = q(".terr-land-mask-contour--active");
    const rivalConcrete = q(".terr-land-mask-concrete-land--rival");
    const rivalContour = q(".terr-land-mask-contour--rival");
    const syntheticFields = q(".terr-land-mask-territory-field, .terr-land-mask-field, .terr-land-mask-coverage");
    const permanentZoneLabels = q(".terr-zone-label");
    const permanentLeafletTooltips = q(".leaflet-tooltip-permanent");
    const helperPaths = q([
      ".terr-land-mask-contour-glow",
      ".terr-land-mask-contour-falloff",
      ".terr-land-mask-border",
      ".terr-land-mask-border-halo",
      ".terr-land-mask-ground-shadow",
      ".terr-land-mask-highlight",
      ".terr-land-mask-region-floor",
      ".terr-land-mask-region-exact",
      ".terr-land-mask-resolved-underlay",
      ".terr-land-mask-conflict-seam",
      ".terr-land-mask-shared-boundary",
    ].join(", "));

    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const combinedBox = (elements) => {
      const rects = elements
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      if (!rects.length) {
        return null;
      }
      const left = Math.min(...rects.map((rect) => rect.left));
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      return {
        x: Math.round(left),
        y: Math.round(top),
        right: Math.round(right),
        bottom: Math.round(bottom),
        width: Math.round(right - left),
        height: Math.round(bottom - top),
      };
    };
    const styleOf = (element) => {
      const style = getComputedStyle(element);
      return {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        fill: style.fill,
        fillOpacity: style.fillOpacity,
        fillRule: element.getAttribute("fill-rule") || style.fillRule,
        filter: style.filter,
      };
    };
    const pseudoStyleOf = (selector, pseudo) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const style = getComputedStyle(element, pseudo);
      return {
        content: style.content,
        display: style.display,
        background: style.background,
        backgroundImage: style.backgroundImage,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
      };
    };
    const layerStackAt = (x, y) => document.elementsFromPoint(x, y).slice(0, 10).map((element) => {
      const style = getComputedStyle(element);
      return {
        tagName: element.tagName,
        className: typeof element.className === "string" ? element.className : String(element.className?.baseVal || ""),
        id: element.id || "",
        zIndex: style.zIndex,
        background: style.background,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        rect: box(element),
      };
    });
    const pathSubpathSignedAreas = (pathData) => {
      const tokens = String(pathData || "").match(/[MLHVQCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
      const subpaths = [];
      let index = 0;
      let current = null;
      let currentPoint = null;
      const readNumber = () => {
        const value = Number(tokens[index]);
        index += 1;
        return value;
      };
      const isCommand = (token) => /^[MLHVQCZ]$/i.test(String(token || ""));
      const appendPoint = (x, y) => {
        if (!current) {
          current = [];
        }
        if (Number.isFinite(x) && Number.isFinite(y)) {
          currentPoint = { x, y };
          current.push(currentPoint);
        }
      };
      const pushCurrent = () => {
        if (current?.length >= 3) {
          subpaths.push(current);
        }
        current = null;
        currentPoint = null;
      };
      while (index < tokens.length) {
        const token = String(tokens[index]);
        index += 1;
        if (token === "M") {
          pushCurrent();
          appendPoint(readNumber(), readNumber());
          while (index < tokens.length && !isCommand(tokens[index])) {
            appendPoint(readNumber(), readNumber());
          }
        } else if (token === "L") {
          while (index < tokens.length && !isCommand(tokens[index])) {
            appendPoint(readNumber(), readNumber());
          }
        } else if (token === "H") {
          while (index < tokens.length && !isCommand(tokens[index])) {
            const x = readNumber();
            appendPoint(x, currentPoint?.y);
          }
        } else if (token === "V") {
          while (index < tokens.length && !isCommand(tokens[index])) {
            const y = readNumber();
            appendPoint(currentPoint?.x, y);
          }
        } else if (token === "C") {
          while (index < tokens.length && !isCommand(tokens[index])) {
            index += 4;
            appendPoint(readNumber(), readNumber());
          }
        } else if (token === "Q") {
          while (index < tokens.length && !isCommand(tokens[index])) {
            index += 2;
            appendPoint(readNumber(), readNumber());
          }
        } else if (token === "Z") {
          pushCurrent();
        }
      }
      pushCurrent();

      return subpaths.map((points) => {
        let area = 0;
        for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
          const currentPoint = points[pointIndex];
          const nextPoint = points[(pointIndex + 1) % points.length];
          area += (currentPoint.x * nextPoint.y) - (nextPoint.x * currentPoint.y);
        }
        return area / 2;
      });
    };
    const tile = document.querySelector(".leaflet-tile");
    const tileStyle = tile ? getComputedStyle(tile) : null;
    const activeConcretePathData = activeConcrete[0]?.getAttribute("d") || "";
    const activeConcreteSubpathAreas = pathSubpathSignedAreas(activeConcretePathData);
    const activeConcreteMoveCommandCount = (activeConcretePathData.match(/M/g) || []).length;
    const activeConcreteSmallSubpathCount = activeConcreteSubpathAreas
      .filter((area) => Math.abs(area) > 0 && Math.abs(area) < 1800)
      .length;
    const activeConcreteSubpathSigns = [...new Set(activeConcreteSubpathAreas
      .map((area) => Math.sign(area))
      .filter((sign) => sign !== 0))];
    const contourDetailOf = (element) => {
      const d = element?.getAttribute("d") || "";
      const commands = d.match(/[MLHVQCZ]/g) || [];
      return {
        box: element ? box(element) : null,
        referenceZoom: element?.dataset?.hermesContourReferenceZoom || "",
        stableContourPoints: Number(element?.dataset?.hermesStableContourPoints || 0),
        stableContourSignature: element?.dataset?.hermesStableContourSignature || "",
        cubicCount: commands.filter((command) => command === "C").length,
        lineCount: commands.filter((command) => ["L", "H", "V"].includes(command)).length,
      };
    };

    return {
      url: window.location.href,
      mapZoom: document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap?.getZoom?.() ?? null,
      tokenPresent: Boolean(token),
      storedEmail: localStorage.getItem("hermes_email"),
      profileStatus: profile?.status,
      profileOk: profile?.ok,
      profileName: profile?.data?.displayName || profile?.data?.name || profile?.data?.runner?.displayName || null,
      polygonsStatus: polygons?.status,
      polygonsOk: polygons?.ok,
      polygonCount: polygons?.data?.polygonCount ?? null,
      activePolygonCount: activePolygons.length,
      rivalPolygonCount: rivalPolygons.length,
      activeShapeTypes: [...new Set(activePolygons.map((polygon) => polygon?.shapeType).filter(Boolean))],
      rivalShapeTypes: [...new Set(rivalPolygons.map((polygon) => polygon?.shapeType).filter(Boolean))],
      activeBackendCells: activePolygons.reduce((sum, polygon) => sum + (Array.isArray(polygon?.cells) ? polygon.cells.length : 0), 0),
      rivalBackendCells: rivalPolygons.reduce((sum, polygon) => sum + (Array.isArray(polygon?.cells) ? polygon.cells.length : 0), 0),
      activeBackendArea: activePolygons.reduce((sum, polygon) => sum + (Number(polygon?.areaSquareMeters) || 0), 0),
      rivalOwnerNames: [...new Set(rivalPolygons.map((polygon) => polygon?.ownerName).filter(Boolean))].sort(),
      activeRouteTraceCount: activePolygons.reduce((sum, polygon) => sum + (Array.isArray(polygon?.routeTraces) ? polygon.routeTraces.length : 0), 0),
      activeRouteTracePointCount: activePolygons.reduce((sum, polygon) => {
        return sum + (Array.isArray(polygon?.routeTraces)
          ? polygon.routeTraces.reduce((traceSum, trace) => traceSum + (Array.isArray(trace?.points) ? trace.points.length : 0), 0)
          : 0);
      }, 0),
      territoryStatus: territory?.status,
      territoryOk: territory?.ok,
      territoryCellCount: Array.isArray(territory?.data?.territories) ? territory.data.territories.length : null,
      dom: {
        activeConcrete: activeConcrete.length,
        activeContour: activeContour.length,
        rivalConcrete: rivalConcrete.length,
        rivalContour: rivalContour.length,
        rivalOwnerNames: [...new Set(rivalConcrete.map((element) => element.dataset.hermesOwnerName).filter(Boolean))].sort(),
        syntheticFields: syntheticFields.length,
        permanentZoneLabels: permanentZoneLabels.length,
        permanentLeafletTooltips: permanentLeafletTooltips.length,
        helperPaths: helperPaths.length,
        activeConcreteBoxes: activeConcrete.slice(0, 12).map(box),
        activeContourBoxes: activeContour.slice(0, 12).map(box),
        activeConcreteBox: combinedBox(activeConcrete),
        activeContourBox: combinedBox(activeContour),
        activeConcreteStyle: activeConcrete[0] ? styleOf(activeConcrete[0]) : null,
        activeContourStyle: activeContour[0] ? styleOf(activeContour[0]) : null,
        activeContourDetails: activeContour.map(contourDetailOf),
        activeConcreteSubpathCount: activeConcreteSubpathAreas.length,
        activeConcreteMoveCommandCount,
        activeConcreteSmallSubpathCount,
        activeConcreteSubpathSigns,
        mapTileCount: q(".leaflet-tile").length,
        mapTileStyle: tileStyle ? {
          filter: tileStyle.filter,
          opacity: tileStyle.opacity,
          mixBlendMode: tileStyle.mixBlendMode,
        } : null,
        mapSectionAfterStyle: pseudoStyleOf(".terr-map-section", "::after"),
        territoryMapSectionAfterStyle: pseudoStyleOf(".territory-map-section", "::after"),
        topRightLayerStack: layerStackAt(window.innerWidth - 36, 120),
      },
    };
  });

  assert(proof.tokenPresent, "Shared-account login did not persist an auth token.");
  assert(proof.storedEmail === sharedEmail, `Unexpected logged-in email: ${proof.storedEmail}`);
  assert(proof.profileOk, `Profile API failed after shared-account login: ${proof.profileStatus}`);
  assert(proof.profileName === "Hermes Shared Runner", `Unexpected shared-account profile name: ${proof.profileName}`);
  assert(proof.polygonsOk, `Territory polygons API failed: ${proof.polygonsStatus}`);
  if (proof.activeBackendCells > 0) {
    assert(proof.activePolygonCount > 0, "Territory polygons API returned no active owned polygons.");
    assert(proof.activeShapeTypes.includes("land-mask"), `Active territory is not backed by land-mask cells: ${proof.activeShapeTypes.join(",")}`);
    assert(proof.activeRouteTraceCount > 0, "Active union territory did not expose route traces for concrete geometry repair.");
    assert(proof.activeRouteTracePointCount > 0, "Active route traces did not expose any points for concrete geometry repair.");
    assert(proof.dom.activeConcrete > 0, "Live /territory rendered no active concrete land paths.");
    assert(
      proof.dom.activeConcrete <= Math.max(4, proof.activePolygonCount * 4),
      `Live /territory rendered too many active concrete fill paths, which can create stacked opacity layers: ${proof.dom.activeConcrete}`,
    );
    assert(
      proof.dom.activeConcreteStyle?.fillRule === "nonzero",
      `Live /territory active concrete fill should use nonzero so overlapping same-owner coverage remains additive: ${proof.dom.activeConcreteStyle?.fillRule}`,
    );
    assert(
      proof.dom.activeConcreteSubpathCount >= proof.dom.activeConcreteMoveCommandCount,
      `Live /territory active concrete path parsing lost subpaths: ${JSON.stringify(proof.dom)}`,
    );
    assert(proof.dom.activeContour > 0, "Live /territory rendered no active contour paths.");
    assert(proof.dom.activeContour <= 64, `Live /territory rendered too many active contour loops: ${proof.dom.activeContour}`);
    assertContourFillBoxesAligned(proof.dom.activeConcreteBox, proof.dom.activeContourBox, "Live /territory");
  } else {
    assert(proof.activePolygonCount === 0, `Shared-account open routes should not be returned as active territory polygons: ${proof.activePolygonCount}`);
    assert(proof.dom.activeConcrete === 0, `Shared-account open routes rendered false active territory fill paths: ${proof.dom.activeConcrete}`);
    assert(proof.dom.activeContour === 0, `Shared-account open routes rendered false active territory contours: ${proof.dom.activeContour}`);
  }
  if (Number.isFinite(requestedZoom) && requestedZoom > 0) {
    assert(proof.mapZoom === requestedZoom, `Live /territory did not stay at requested zoom ${requestedZoom}: ${proof.mapZoom}`);
    assert(
      proof.dom.activeContourDetails.every((detail) => detail.lineCount > 0 && detail.cubicCount === 0),
      `Zoomed active contour should use exact line-command geometry, not independent cubic smoothing: ${JSON.stringify(proof.dom.activeContourDetails)}`,
    );
  }
  assert(
    proof.rivalBackendCells === 0 || proof.dom.rivalConcrete > 0,
    `Live /territory returned rival backend cells but rendered no rival concrete paths: ${proof.rivalBackendCells}`,
  );
  assert(
    proof.rivalBackendCells === 0 || proof.dom.rivalContour > 0,
    `Live /territory returned rival backend cells but rendered no rival contour paths: ${proof.rivalBackendCells}`,
  );
  assert(
    proof.rivalBackendCells === 0 || proof.dom.rivalOwnerNames.length > 0,
    `Live /territory rendered rival paths without owner metadata: ${JSON.stringify(proof.dom.rivalOwnerNames)}`,
  );
  assert(proof.dom.syntheticFields === 0, `Live /territory rendered synthetic field paths: ${proof.dom.syntheticFields}`);
  assert(proof.dom.permanentZoneLabels === 0, `Live /territory restored overlap-prone permanent zone labels: ${proof.dom.permanentZoneLabels}`);
  assert(proof.dom.permanentLeafletTooltips === 0, `Live /territory restored permanent Leaflet tooltips: ${proof.dom.permanentLeafletTooltips}`);
  assert(proof.dom.helperPaths === 0, `Live /territory rendered helper/halo paths: ${proof.dom.helperPaths}`);
  assert(proof.dom.mapTileCount > 0, "Live /territory did not render real map tiles.");
  assert(proof.dom.mapTileStyle?.filter === "none", `Map tiles are filtered/blurred: ${proof.dom.mapTileStyle?.filter}`);
  assert(
    !proof.dom.mapSectionAfterStyle
      || proof.dom.mapSectionAfterStyle.content === "none"
      || proof.dom.mapSectionAfterStyle.display === "none",
    `Territory map section still renders an extra pseudo overlay layer: ${JSON.stringify(proof.dom.mapSectionAfterStyle)}`,
  );
  assert(
    !proof.dom.mapSectionAfterStyle
      || proof.dom.mapSectionAfterStyle.backgroundImage === "none"
      || proof.dom.mapSectionAfterStyle.display === "none",
    `Territory map section pseudo overlay still paints a background: ${JSON.stringify(proof.dom.mapSectionAfterStyle)}`,
  );

  console.log(JSON.stringify({
    ok: true,
    url: proof.url,
    screenshot: screenshotPath,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 5),
    proof,
  }, null, 2));
} finally {
  await browser.close().catch(() => {});
}
